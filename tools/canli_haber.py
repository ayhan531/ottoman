# -*- coding: utf-8 -*-
"""Canli sunucudaki haber sekmelerini dogrular."""
import sys, io, json, time, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

KOK = "https://ottoman-eggb.onrender.com"
ADLAR = ["BIST Tum", "BIST 100", "BIST 30", "BIST Katilim", "BIST Temettu", "Halka Arzlar", "Fonlar", "Doviz"]


def al(yol, zaman=120):
    r = urllib.request.Request(KOK + yol, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(r, timeout=zaman) as y:
        return json.loads(y.read().decode("utf-8"))


def gorsel_calisiyor(adres):
    try:
        r = urllib.request.Request(adres, headers={"User-Agent": "Mozilla/5.0"}, method="GET")
        with urllib.request.urlopen(r, timeout=15) as y:
            tur = y.headers.get("Content-Type", "")
            bas = y.read(600)
        return y.status == 200 and tur.startswith("image") and len(bas) > 200
    except Exception as e:
        return "HATA " + type(e).__name__


print("surum:", al("/api/public/config").get("branding", {}).get("name", "?"))
toplam_hata = 0
for s in range(8):
    try:
        veri = al("/api/market-news?market=%d" % s)
    except Exception as e:
        print("%d %-14s ISTEK HATASI %s" % (s, ADLAR[s], type(e).__name__))
        toplam_hata += 1
        continue
    haberler = veri.get("items", [])
    fotolu = [h for h in haberler if str(h.get("image_url", "")).startswith("https://")]
    print("=" * 74)
    print("%d %-14s adet=%d fotolu=%d kaynak=%s" % (s, ADLAR[s], len(haberler), len(fotolu),
                                                    veri.get("meta", {}).get("source", "")[:50]))
    if len(fotolu) != len(haberler) or not haberler:
        toplam_hata += 1
    for h in haberler[:4]:
        print("   -", h.get("source", ""), "|", h.get("title", "")[:62])
    if fotolu:
        print("   foto testi:", gorsel_calisiyor(fotolu[0]["image_url"]), fotolu[0]["image_url"][:70])
print("SONUC:", "TAMAM" if toplam_hata == 0 else "SORUN %d" % toplam_hata)
