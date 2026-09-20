# -*- coding: utf-8 -*-
"""Yeni admin uclarini yerel sunucuda dener: TC dogrulama, hisse adi, denetim."""
import sys, io, json, os, time, subprocess, urllib.request, urllib.error, http.cookiejar
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

KOK = "http://127.0.0.1:8799"
cj = http.cookiejar.CookieJar()
acici = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def iste(yol, veri=None, yontem=None):
    govde = json.dumps(veri).encode("utf-8") if veri is not None else None
    r = urllib.request.Request(KOK + yol, data=govde, method=yontem or ("POST" if veri is not None else "GET"))
    if govde:
        r.add_header("Content-Type", "application/json")
    try:
        with acici.open(r, timeout=30) as y:
            return y.status, json.loads(y.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        govde = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(govde or "{}")
        except Exception:
            return e.code, {"raw": govde[:200]}


ortam = dict(os.environ, PORT="8799", DB_PATH=os.path.join(os.getcwd(), "test_admin.db"),
             ADMIN_TC="11111111110", ADMIN_PASSWORD="Admin12345", REQUIRE_LIVE_MARKET_FOR_TRADING="0")
sunucu = subprocess.Popen([sys.executable, "backend_server.py"], env=ortam,
                          stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
time.sleep(6)
hata = 0
try:
    kod, veri = iste("/api/login", {"tc": "11111111110", "password": "Admin12345"})
    print("giris:", kod, veri.get("user", {}).get("role"))
    if kod != 200:
        raise SystemExit("admin girisi olmadi: %s" % veri)

    kod, veri = iste("/api/admin/step-up", {"password": "Admin12345"})
    print("step-up:", kod)
    if kod != 200:
        hata += 1

    # 1) Sahte TC ile kayit reddedilmeli, gercek TC kabul edilmeli
    for tc, bekle in [("12345678901", "red"), ("11111111110", "red"), ("10000000146", "kabul")]:
        kod, veri = iste("/api/admin/create-user", {
            "tc": tc, "full_name": "Test Kullanici", "phone": "05551112233",
            "email": "t%s@ottoman.local" % tc[:4], "password": "Ottoman12345a", "status": "approved",
            "opening_balance": 1000,
        })
        oldu = (kod in (200, 201)) if bekle == "kabul" else (kod >= 400)
        if not oldu:
            hata += 1
        print("create-user %-12s -> %s %s %s" % (tc, kod, str(veri)[:70], "TAMAM" if oldu else "SORUN"))

    # 2) Kullanici listesinde tc_valid bayragi
    kod, veri = iste("/api/admin/users")
    kullanicilar = veri.get("users", [])
    bayrakli = [u for u in kullanicilar if "tc_valid" in u]
    print("users: %d kayit, tc_valid alani olan: %d" % (len(kullanicilar), len(bayrakli)))
    if not kullanicilar or len(bayrakli) != len(kullanicilar):
        hata += 1

    # 3) Hisse adi listesi ve degistirme
    kod, veri = iste("/api/admin/stock-names")
    print("stock-names:", kod, "toplam", veri.get("total"))
    ornek = (veri.get("names") or [{}])[0].get("symbol")
    if ornek:
        iste("/api/admin/stock-names", {"symbol": ornek, "name": "Deneme Sirketi A.S."})
        kod, veri = iste("/api/admin/stock-names?q=" + ornek)
        satir = (veri.get("names") or [{}])[0]
        dogru = satir.get("name") == "Deneme Sirketi A.S." and satir.get("custom") is True
        if not dogru:
            hata += 1
        print("ad degistir kontrol:", satir.get("symbol"), satir.get("name"), satir.get("custom"), "TAMAM" if dogru else "SORUN")
        # Musteri tarafindaki piyasa listesinde de yeni ad gorunuyor mu?
        kod, veri = iste("/api/market")
        yeni = [q for q in veri.get("quotes", []) if q.get("symbol") == ornek]
        gorundu = bool(yeni) and yeni[0].get("name") == "Deneme Sirketi A.S."
        if not gorundu:
            hata += 1
        print("piyasa listesinde:", yeni[0].get("name") if yeni else "-", "TAMAM" if gorundu else "SORUN")
        iste("/api/admin/stock-names", {"symbol": ornek, "name": ""})

    # 4) Denetim kaydi
    kod, veri = iste("/api/admin/audit?q=stock")
    print("audit:", kod, len(veri.get("audit", [])), "kayit")
    if kod != 200 or not veri.get("audit"):
        hata += 1

    # 5) Diger uclar
    for yol in ["/api/admin/summary", "/api/admin/positions", "/api/admin/user-balances",
                "/api/admin/t2-settlements", "/api/admin/money", "/api/admin/orders",
                "/api/admin/system-settings", "/api/admin/stock-descriptions", "/api/admin/documents"]:
        kod, veri = iste(yol)
        if kod != 200:
            hata += 1
        print("%-34s -> %s" % (yol, kod))

    # 6) Sifre degistirme
    kod, veri = iste("/api/admin/users")
    musteriler = veri.get("users", [])
    if musteriler:
        uid = musteriler[0]["id"]
        kod, veri = iste("/api/admin/users/%d/password" % uid, {"password": "YeniSifre123a"})
        if kod != 200:
            hata += 1
        print("sifre degistir:", kod, veri)
        # Yeni sifreyle giris yapilabiliyor mu?
        cj2 = http.cookiejar.CookieJar()
        a2 = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj2))
        r = urllib.request.Request(KOK + "/api/login", data=json.dumps({"tc": "10000000146", "password": "YeniSifre123a"}).encode(), method="POST")
        r.add_header("Content-Type", "application/json")
        try:
            with a2.open(r, timeout=20) as y:
                print("yeni sifreyle giris:", y.status, "TAMAM")
        except urllib.error.HTTPError as e:
            print("yeni sifreyle giris:", e.code, e.read().decode("utf-8", "replace")[:120], "SORUN")
            hata += 1

    # 7) Kayit ucunda sahte TC reddi (musteri tarafi)
    import uuid
    sinir = "----x%s" % uuid.uuid4().hex
    def kayit(tc):
        parcalar = []
        alanlar = {"full_name": "Sahte Deneme", "tc": tc, "phone": "05559998877", "email": "s%s@x.com" % tc[:4],
                   "city": "Istanbul", "district": "Kadikoy", "birth_date": "1990-01-01", "address": "Adres",
                   "password": "Ottoman12345a", "accept_kvkk": "1", "accept_distance_contract": "1",
                   "accept_risk_disclosure": "1", "risk_experience": "2", "risk_horizon": "2", "risk_loss": "2",
                   "risk_income": "2", "trade_frequency": "2", "knowledge_level": "2", "education": "Lisans",
                   "occupation": "Memur", "traded_products": "Pay", "investment_goal": "Uzun vadeli"}
        for k, v in alanlar.items():
            parcalar.append("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n" % (sinir, k, v))
        govde = ("".join(parcalar) + "--%s--\r\n" % sinir).encode("utf-8")
        r = urllib.request.Request(KOK + "/api/register", data=govde, method="POST")
        r.add_header("Content-Type", "multipart/form-data; boundary=%s" % sinir)
        try:
            with urllib.request.urlopen(r, timeout=25) as y:
                return y.status, "kayit acildi"
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "replace")[:120]

    for tc, bekle in [("12345678901", "red"), ("11111111110", "red")]:
        kod, mesaj = kayit(tc)
        oldu = kod >= 400
        if not oldu:
            hata += 1
        print("register %-12s -> %s %s %s" % (tc, kod, mesaj, "TAMAM" if oldu else "SORUN"))

    print("SONUC:", "TAMAM" if hata == 0 else "SORUN %d" % hata)
finally:
    sunucu.terminate()
