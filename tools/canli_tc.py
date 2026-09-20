# -*- coding: utf-8 -*-
"""Canli sunucuda sahte T.C. ile kayit denemesi (hesap acilmaz, sadece red beklenir)."""
import sys, io, uuid, urllib.request, urllib.error
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
KOK = "https://ottoman-eggb.onrender.com"


def kayit(tc):
    sinir = "----x%s" % uuid.uuid4().hex
    alanlar = {"full_name": "Sahte Deneme", "tc": tc, "phone": "05559998877", "email": "sahte%s@ornek.com" % tc[:4],
               "city": "Istanbul", "district": "Kadikoy", "birth_date": "1990-01-01", "address": "Adres",
               "password": "Ottoman12345a", "accept_kvkk": "1", "accept_distance_contract": "1",
               "accept_risk_disclosure": "1", "risk_experience": "2", "risk_horizon": "2", "risk_loss": "2",
               "risk_income": "2", "trade_frequency": "2", "knowledge_level": "2", "education": "Lisans",
               "occupation": "Memur", "traded_products": "Pay", "investment_goal": "Uzun vadeli"}
    parcalar = ["--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n" % (sinir, k, v) for k, v in alanlar.items()]
    govde = ("".join(parcalar) + "--%s--\r\n" % sinir).encode("utf-8")
    r = urllib.request.Request(KOK + "/api/register", data=govde, method="POST")
    r.add_header("Content-Type", "multipart/form-data; boundary=%s" % sinir)
    try:
        with urllib.request.urlopen(r, timeout=60) as y:
            return y.status, "HESAP ACILDI"
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:140]


hata = 0
for tc in ["12345678901", "11111111110", "99999999999", "00000000000"]:
    kod, mesaj = kayit(tc)
    iyi = kod >= 400
    if not iyi:
        hata += 1
    print("%-12s -> %s %s %s" % (tc, kod, mesaj, "TAMAM (reddedildi)" if iyi else "SORUN (kabul edildi!)"))
print("SONUC:", "TAMAM" if hata == 0 else "SORUN %d" % hata)
