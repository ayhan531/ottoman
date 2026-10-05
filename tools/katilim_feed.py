"""BIST Katilim Tum endeksi uyeligi: Borsa Istanbul'un resmi 'hisse-endeks
dagilimi' dosyasindan (hisse_endeks_ds.csv) okunur ve participation_index
tablosuna uygulanir.

Dosya bicimi (resmi): ';' ayracli, ilk iki satir baslik. Sutunlar:
BILESEN KODU;BULTEN_ADI;ENDEKS KODU;ENDEKS ADI;ENDEKS INGILIZCE ADI;TARIH(GG/AA/YYYY)
Ornek satir: AEFES.E;ANADOLU EFES;XU100;BIST 100;BIST 100;06/10/2026
Katilim Tum endeksinin kodu XKTUM'dur.

Saf fonksiyonlar: ag ve sunucu bagimliligi yok, dogrudan test edilebilir."""
from __future__ import annotations

import calendar
import re
import sqlite3
import time

INDEX_CODE = "XKTUM"
MIN_SYMBOLS = 150          # bundan az sembol = bozuk/yarim dosya, uygulanmaz
MAX_SHRINK = 0.30          # onceki listeden %30'dan fazla kuculuyorsa supheli, uygulanmaz
NOTE_PREFIX = "BIST Katilim"                      # otomatik yonetilen satirlarin notu bununla baslar
OLD_SEED_NOTE = "Baslangic listesi - admin panelinden dogrulayin/guncelleyin"


def parse_csv(text: str) -> tuple[set[str], int]:
    """(XKTUM sembolleri, listenin tarihi - unix saniye). Hata olursa ValueError."""
    symbols: set[str] = set()
    stamp = ""
    for line in text.splitlines():
        parts = line.split(";")
        if len(parts) < 6 or parts[2].strip().upper() != INDEX_CODE:
            continue
        code = parts[0].strip().split(".")[0].upper()
        if re.fullmatch(r"[A-Z0-9]{2,8}", code):
            symbols.add(code)
        stamp = stamp or parts[5].strip()
    if len(symbols) < MIN_SYMBOLS:
        raise ValueError(f"{INDEX_CODE} icin yalnizca {len(symbols)} sembol bulundu (en az {MIN_SYMBOLS} beklenir); dosya bozuk ya da bicim degismis olabilir")
    match = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", stamp)
    if not match:
        raise ValueError(f"liste tarihi okunamadi: {stamp!r}")
    day, month, year = (int(x) for x in match.groups())
    return symbols, calendar.timegm((year, month, day, 0, 0, 0))


def _managed(note: str | None) -> bool:
    """Admin'in elle dokunmadigi (otomatik yonetilen) satir mi?"""
    note = note or ""
    return note == OLD_SEED_NOTE or note.startswith(NOTE_PREFIX)


def apply_list(conn: sqlite3.Connection, symbols: set[str], list_ts: int) -> dict:
    """Listeyi uygular. Admin'in notla elle isaretledigi satirlara dokunmaz.
    Doner: {total, added, removed, kept_manual}"""
    date = time.strftime("%d.%m.%Y", time.gmtime(list_ts))
    yes_note = f"BIST Katilim Tum resmi listesi ({date})"
    no_note = f"BIST Katilim Tum resmi listesinde yok ({date})"
    rows = {r["symbol"]: (int(r["compliant"]), r["note"]) for r in conn.execute("SELECT symbol, compliant, note FROM participation_index")}

    previous = sum(1 for compliant, note in rows.values() if compliant and _managed(note))
    if previous >= MIN_SYMBOLS and len(symbols) < previous * (1 - MAX_SHRINK):
        raise ValueError(f"yeni liste ({len(symbols)}) onceki listeden ({previous}) cok kucuk; supheli, uygulanmadi")

    added, removed, kept = [], [], []
    for symbol in sorted(symbols):
        was = rows.get(symbol)
        if was and not _managed(was[1]):
            kept.append(symbol)
            continue
        if not was or not was[0]:
            added.append(symbol)
        conn.execute(
            "INSERT INTO participation_index (symbol, compliant, note, updated_at) VALUES (?, 1, ?, ?)"
            " ON CONFLICT(symbol) DO UPDATE SET compliant=1, note=excluded.note, updated_at=excluded.updated_at",
            (symbol, yes_note, list_ts),
        )
    for symbol, (compliant, note) in rows.items():
        if symbol in symbols or not _managed(note):
            continue
        if compliant:
            removed.append(symbol)
        conn.execute(
            "UPDATE participation_index SET compliant=0, note=?, updated_at=? WHERE symbol=?",
            (no_note, list_ts, symbol),
        )
    return {"total": len(symbols), "added": added, "removed": removed, "kept_manual": kept}
