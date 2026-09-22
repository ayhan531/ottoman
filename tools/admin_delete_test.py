# -*- coding: utf-8 -*-
"""Yeni musteri silme ucunu dener."""
import sys, io, json, os, time, subprocess, urllib.request, urllib.error, http.cookiejar
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
KOK = "http://127.0.0.1:8798"
cj = http.cookiejar.CookieJar()
acici = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def iste(yol, veri=None):
    govde = json.dumps(veri).encode("utf-8") if veri is not None else None
    r = urllib.request.Request(KOK + yol, data=govde, method="POST" if veri is not None else "GET")
    if govde:
        r.add_header("Content-Type", "application/json")
    try:
        with acici.open(r, timeout=30) as y:
            return y.status, json.loads(y.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8") or "{}")
        except Exception:
            return e.code, {}


db = os.path.join(os.getcwd(), "test_sil.db")
for ek in ("", "-wal", "-shm"):
    try:
        os.remove(db + ek)
    except OSError:
        pass
ortam = dict(os.environ, PORT="8798", DATABASE_PATH=db, ADMIN_TC="11111111110", ADMIN_PASSWORD="Admin12345")
sunucu = subprocess.Popen([sys.executable, "backend_server.py"], env=ortam, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
time.sleep(6)
hata = 0
try:
    print("giris:", iste("/api/login", {"tc": "11111111110", "password": "Admin12345"})[0])
    print("step-up:", iste("/api/admin/step-up", {"password": "Admin12345"})[0])

    kod, veri = iste("/api/admin/create-user", {
        "tc": "10000000146", "full_name": "Silinecek Musteri", "phone": "05551112233",
        "email": "sil@ottoman.local", "password": "Ottoman12345a", "status": "approved", "opening_balance": 500,
    })
    print("musteri acildi:", kod, veri)
    uid = veri.get("id")
    if not uid:
        raise SystemExit("musteri acilamadi")

    # Onaysiz silme reddedilmeli
    kod, veri = iste("/api/admin/users/%d/delete" % uid, {"confirm": "evet"})
    oldu = kod >= 400
    if not oldu:
        hata += 1
    print("onaysiz silme:", kod, veri, "TAMAM (reddedildi)" if oldu else "SORUN")

    # Dogru onayla silme
    kod, veri = iste("/api/admin/users/%d/delete" % uid, {"confirm": "SIL"})
    if kod != 200:
        hata += 1
    print("silme:", kod, veri)

    kod, veri = iste("/api/admin/users")
    kalan = [u for u in veri.get("users", []) if u["id"] == uid]
    if kalan:
        hata += 1
    print("listede kaldi mi:", bool(kalan), "TAMAM" if not kalan else "SORUN")

    # Ayni TC ile yeniden acilabiliyor mu (kayit gercekten gitti mi)
    kod, veri = iste("/api/admin/create-user", {
        "tc": "10000000146", "full_name": "Yeni Musteri", "phone": "05551112233",
        "email": "yeni@ottoman.local", "password": "Ottoman12345a", "status": "approved",
    })
    if kod not in (200, 201):
        hata += 1
    print("ayni TC ile tekrar acma:", kod, veri)

    kod, veri = iste("/api/admin/audit?q=delete_user")
    print("denetim kaydinda:", len(veri.get("audit", [])), "kayit")
    if not veri.get("audit"):
        hata += 1

    print("SONUC:", "TAMAM" if hata == 0 else "SORUN %d" % hata)
finally:
    sunucu.terminate()
