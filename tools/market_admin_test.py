# -*- coding: utf-8 -*-
"""Piyasa kontrolu ve T+2 silme uclarini dener."""
import sys, io, json, os, time, subprocess, urllib.request, urllib.error, http.cookiejar
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
KOK = "http://127.0.0.1:8797"
cj = http.cookiejar.CookieJar()
acici = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def iste(yol, veri=None):
    govde = json.dumps(veri).encode("utf-8") if veri is not None else None
    r = urllib.request.Request(KOK + yol, data=govde, method="POST" if veri is not None else "GET")
    if govde:
        r.add_header("Content-Type", "application/json")
    try:
        with acici.open(r, timeout=60) as y:
            return y.status, json.loads(y.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8") or "{}")
        except Exception:
            return e.code, {}


db = os.path.join(os.getcwd(), "test_piyasa.db")
for ek in ("", "-wal", "-shm"):
    try:
        os.remove(db + ek)
    except OSError:
        pass
ortam = dict(os.environ, PORT="8797", DATABASE_PATH=db, ADMIN_TC="11111111110", ADMIN_PASSWORD="Admin12345")
sunucu = subprocess.Popen([sys.executable, "backend_server.py"], env=ortam, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
time.sleep(10)
hata = 0
try:
    print("giris:", iste("/api/login", {"tc": "11111111110", "password": "Admin12345"})[0])
    print("step-up:", iste("/api/admin/step-up", {"password": "Admin12345"})[0])

    kod, veri = iste("/api/admin/prices?q=THYAO")
    satir = (veri.get("prices") or [{}])[0]
    print("fiyat listesi:", kod, "toplam", veri.get("total"), "akis", veri.get("feed_enabled"), "ornek", satir.get("symbol"), satir.get("price"))
    if kod != 200 or not satir.get("symbol"):
        raise SystemExit("fiyat listesi alinamadi")

    # 1) Fiyati elle degistir
    kod, veri = iste("/api/admin/prices", {"symbol": "THYAO", "price": "999,50", "change_pct": "12,5"})
    print("fiyat degistir:", kod, veri)
    if kod != 200:
        hata += 1
    kod, veri = iste("/api/market")
    thy = [q for q in veri.get("quotes", []) if q["symbol"] == "THYAO"]
    oldu = bool(thy) and abs(float(thy[0]["price"]) - 999.5) < 0.001
    if not oldu:
        hata += 1
    print("musteri tarafinda fiyat:", thy[0]["price"] if thy else "-", "TAMAM" if oldu else "SORUN")

    # 2) Akisi kapat, fiyat degismesin
    kod, veri = iste("/api/admin/market-feed", {"enabled": False})
    print("akis kapandi:", kod, veri)
    if kod != 200:
        hata += 1
    kod, veri = iste("/api/market")
    thy2 = [q for q in veri.get("quotes", []) if q["symbol"] == "THYAO"]
    sabit = bool(thy2) and abs(float(thy2[0]["price"]) - 999.5) < 0.001
    if not sabit:
        hata += 1
    print("akis kapaliyken fiyat:", thy2[0]["price"] if thy2 else "-", "TAMAM" if sabit else "SORUN")

    kod, veri = iste("/api/admin/prices?q=THYAO")
    print("akis durumu:", veri.get("feed_enabled"), "elle verilen:", veri.get("manual_count"))
    if veri.get("feed_enabled") is not False:
        hata += 1

    # 3) Akisi geri ac, elle verilen fiyat korunsun
    iste("/api/admin/market-feed", {"enabled": True})
    kod, veri = iste("/api/market")
    thy3 = [q for q in veri.get("quotes", []) if q["symbol"] == "THYAO"]
    korundu = bool(thy3) and abs(float(thy3[0]["price"]) - 999.5) < 0.001
    if not korundu:
        hata += 1
    print("akis acikken elle fiyat korundu mu:", thy3[0]["price"] if thy3 else "-", "TAMAM" if korundu else "SORUN")

    # 4) Canliya dondur
    kod, veri = iste("/api/admin/prices", {"symbol": "THYAO", "price": ""})
    print("canliya donduruldu:", kod, veri)
    kod, veri = iste("/api/admin/prices?q=THYAO")
    geri = (veri.get("prices") or [{}])[0]
    if geri.get("manual") is not False:
        hata += 1
    print("artik elle mi:", geri.get("manual"), "fiyat:", geri.get("price"))

    print("SONUC:", "TAMAM" if hata == 0 else "SORUN %d" % hata)
finally:
    sunucu.terminate()
