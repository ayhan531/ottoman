# -*- coding: utf-8 -*-
"""Fotoğraflı Türk finans haberleri; sekmenin konusuna göre gruplanır.

İki tür kaynak var:
  * GORSELLI  – haberin görselini beslemede veren yayıncılar.
  * BIST_YOGUN – borsa haberi bol ama beslemede görsel vermeyen yayıncılar;
    bu haberlerin fotoğrafı sayfadaki og:image etiketinden alınır.

Her haber ancak https bir fotoğrafı varsa listeye giriyor. Sekmeye dağıtım
önce konu anahtarlarıyla, sonra endeks üyesi şirket adı/kodu ile yapılıyor;
böylece "BIST 30" sekmesinde gerçekten BIST 30 şirketlerinin haberi çıkıyor.
"""

from __future__ import annotations

import re
import threading
import time
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser

MRSS = "{http://search.yahoo.com/mrss/}content"
MRSS_THUMB = "{http://search.yahoo.com/mrss/}thumbnail"
ICERIK = "{http://purl.org/rss/1.0/modules/content/}encoded"
AJAN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

# Görselini beslemede veren kaynaklar.
GORSELLI = [
    ("TRT Haber", "https://www.trthaber.com/ekonomi_articles.rss"),
    ("Hürriyet", "https://www.hurriyet.com.tr/rss/ekonomi"),
    ("Dünya", "https://www.dunya.com/rss"),
    ("Ekonomim", "https://www.ekonomim.com/rss"),
    ("Habertürk", "https://www.haberturk.com/rss/kategori/ekonomi.xml"),
    ("Milliyet", "https://www.milliyet.com.tr/rss/rssnew/ekonomirss.xml"),
    ("Sabah", "https://www.sabah.com.tr/rss/ekonomi.xml"),
    ("Investing", "https://tr.investing.com/rss/news_25.rss"),
    ("Investing", "https://tr.investing.com/rss/news_301.rss"),
]

# Borsa haberi yoğun ama görselsiz kaynaklar: fotoğraf sayfadan alınır.
BIST_YOGUN = [
    ("Borsa Gündem", "https://www.borsagundem.com/rss"),
    ("CNN Türk", "https://www.cnnturk.com/feed/rss/ekonomi/news"),
    ("Anadolu Ajansı", "https://www.aa.com.tr/tr/rss/default?cat=ekonomi"),
    ("BloombergHT", "https://www.bloomberght.com/rss"),
]

YENILEME_SANIYE = 600
SAYFADAN_EN_FAZLA = 45          # bir tazelemede kaç sayfadan fotoğraf aranacak
_kilit = threading.Lock()
_onbellek: dict = {"items": [], "updated": 0.0, "errors": []}
_gorsel_onbellek: dict[str, str] = {}

# ---------------------------------------------------------------- endeksler
XU030 = (
    "AKBNK", "AKSEN", "ALARK", "ASELS", "ASTOR", "BIMAS", "BRSAN", "EKGYO", "ENKAI", "EREGL",
    "FROTO", "GARAN", "GUBRF", "HEKTS", "ISCTR", "KCHOL", "KOZAL", "KRDMD", "MGROS", "ODAS",
    "OYAKC", "PETKM", "PGSUS", "SAHOL", "SASA", "SISE", "TCELL", "THYAO", "TOASO", "TUPRS",
)

XU100_EK = (
    "AEFES", "AGHOL", "AHGAZ", "AKFGY", "AKFYE", "AKSA", "ALFAS", "ALTNY", "ANSGR", "ARCLK",
    "ARDYZ", "AVPGY", "BERA", "BFREN", "BINHO", "BOBET", "BRYAT", "BSOKE", "BTCIM", "CANTE",
    "CCOLA", "CIMSA", "CVKMD", "CWENE", "DOAS", "DOHOL", "ECILC", "EGEEN", "ENERY", "ENJSA",
    "ESEN", "EUPWR", "EUREN", "FENER", "GESAN", "GOLTS", "GSDHO", "GWIND", "HTTBT", "IPEKE",
    "ISDMR", "ISMEN", "IZENR", "KARSN", "KAYSE", "KCAER", "KONTR", "KONYA", "KORDS", "KOZAA",
    "KTLEV", "MAVI", "MIATK", "MPARK", "OBAMS", "OTKAR", "PAPIL", "PENTA", "PSGYO", "REEDR",
    "SDTTR", "SKBNK", "SMRTG", "SOKM", "TAVHL", "TKFEN", "TMSN", "TSKB", "TTKOM", "TTRAK",
    "TUKAS", "TURSG", "ULKER", "VAKBN", "VESBE", "VESTL", "YEOTK", "YKBNK", "YYLGD", "ZOREN",
)

XKTUM = (
    "ASELS", "ASTOR", "AKSEN", "ALARK", "BIMAS", "BRSAN", "CIMSA", "EGEEN", "EKGYO", "ENJSA",
    "ENKAI", "EREGL", "EUPWR", "FROTO", "GESAN", "GUBRF", "HEKTS", "ISDMR", "KARSN", "KCAER",
    "KCHOL", "KONTR", "KONYA", "KORDS", "KOZAA", "KOZAL", "KRDMD", "MGROS", "MIATK", "OTKAR",
    "OYAKC", "PETKM", "PGSUS", "SASA", "SISE", "SMRTG", "SOKM", "TAVHL", "TCELL", "THYAO",
    "TKFEN", "TMSN", "TOASO", "TTKOM", "TTRAK", "TUKAS", "TUPRS", "ULKER", "VESBE", "VESTL",
    "YEOTK", "ZOREN", "AHGAZ", "AKFYE", "ALFAS", "BOBET", "BTCIM", "CANTE", "CWENE", "ESEN",
    "EUREN", "GOLTS", "GWIND", "IZENR", "KAYSE", "PAPIL", "REEDR", "SDTTR", "TUREX", "ALTNY",
    "BINHO", "OBAMS",
)

XTMTU = (
    "AEFES", "AKBNK", "AKSA", "ANSGR", "ARCLK", "ASELS", "AYGAZ", "BIMAS", "BRISA", "CCOLA",
    "CIMSA", "DOAS", "ECILC", "EGEEN", "EKGYO", "ENJSA", "ENKAI", "EREGL", "FROTO", "GARAN",
    "GUBRF", "ISCTR", "ISDMR", "KCHOL", "KONYA", "KORDS", "MGROS", "OTKAR", "OYAKC", "PETKM",
    "PGSUS", "SAHOL", "SISE", "SOKM", "TAVHL", "TCELL", "TKFEN", "TOASO", "TRGYO", "TSKB",
    "TTKOM", "TTRAK", "TUPRS", "TURSG", "ULKER", "VAKBN", "VESBE", "YKBNK", "AGHOL", "ALARK",
    "BAGFS", "BANVT", "BUCIM", "CEMTS", "DEVA", "GOLTS", "HEKTS", "INDES", "ISMEN", "KLMSN",
    "LOGO", "MPARK", "NUHCM", "PRKME", "SARKY", "SELEC", "TATGD", "TUKAS", "VESTL", "YATAS",
    "ZOREN",
)

XHARZ = (
    "ALTNY", "BINHO", "OBAMS", "REEDR", "PAPIL", "SDTTR", "MIATK", "KCAER", "EUPWR", "CVKMD",
    "ALFAS", "AHGAZ", "AKFYE", "BOBET", "CANTE", "CWENE", "ENERY", "ESEN", "EUREN", "GESAN",
    "GOLTS", "GWIND", "HTTBT", "IZENR", "KAYSE", "KONTR", "KTLEV", "PENTA", "SMRTG", "YEOTK",
    "YYLGD", "ARDYZ", "AVPGY", "BFREN", "BSOKE", "TUKAS", "AAGYO", "AKFIS", "ALKLC", "ARTMS",
    "BIGCH", "BORLS", "BULGS", "CGCAM", "DCTTR", "DOFER", "EFORC", "ENTRA", "FORTE", "GRTHO",
    "HRKET", "INTEM", "KOCMT", "LMKDC", "MAGEN", "MEGMT", "MHRGY", "MOGAN", "OFSYM", "ONRYT",
    "PASEU", "PCILT", "PEKGY", "PKENT", "RGYAS", "SAMAT", "SEGYO", "SURGY", "TABGD", "TNZTP",
    "YIGIT",
)

XU100 = tuple(dict.fromkeys(XU030 + XU100_EK))
SEKME_ENDEKSI = {1: set(XU100), 2: set(XU030), 3: set(XKTUM), 4: set(XTMTU), 5: set(XHARZ)}

# Şirket kodu → şirket adı; sunucu açılışta gerçek listeyi veriyor (sirketleri_tanit).
_SIRKET_ADLARI: dict[str, str] = {}
_AD_KOD: list[tuple[str, str]] = []       # (katlanmış ad, kod) — uzundan kısaya


def sirketleri_tanit(adlar: dict) -> None:
    """Sunucudaki hisse listesinden şirket adlarını alır. Yalnızca BIST hisse
    kodları alınır; BTCUSD/USDTRY gibi kodlar haberi şirket haberi yapmasın."""
    global _AD_KOD
    if not adlar:
        return
    temiz = {}
    for kod, ad in adlar.items():
        kod = str(kod or "").strip().upper()
        ad = str(ad or "").strip()
        if not re.fullmatch(r"[A-Z]{4,6}", kod) or not ad or ad.upper() == kod:
            continue
        if kod.endswith("USD") or kod.endswith("TRY") or kod.endswith("EUR"):
            continue
        temiz[kod] = ad
    if not temiz:
        return
    _SIRKET_ADLARI.clear()
    _SIRKET_ADLARI.update(temiz)
    liste = []
    for kod, ad in temiz.items():
        sade = katla(ad)
        sade = re.sub(r"\b(a\.?s\.?|anonim|şirketi|sirketi|holding|sanayi|ticaret|ve|yatırım|yatirim|index|endeks)\b", " ", sade)
        sade = " ".join(sade.split())
        if len(sade) >= 7:
            liste.append((sade, kod))
    _AD_KOD = sorted(liste, key=lambda x: -len(x[0]))


# ---------------------------------------------------------------- yardımcılar
class _Duz(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parcalar = []

    def handle_data(self, veri):
        self.parcalar.append(veri)


def duz_metin(deger: str) -> str:
    ayristirici = _Duz()
    ayristirici.feed(deger or "")
    return " ".join(" ".join(ayristirici.parcalar).split())


ALT = str.maketrans({"I": "ı", "İ": "i", "Ş": "ş", "Ğ": "ğ", "Ü": "ü", "Ö": "ö", "Ç": "ç"})
SADE = str.maketrans({"ı": "i", "ş": "s", "ğ": "g", "ü": "u", "ö": "o", "ç": "c",
                      "â": "a", "î": "i", "û": "u", "’": "'", "‘": "'"})


def katla(deger: str) -> str:
    """Karşılaştırma için sadeleştirir: BIST → bist, Temettü → temettu.
    Türkçe'de büyük I küçük ı olduğu için önce doğru küçültülüp sonra
    aksanlar kaldırılıyor; yoksa "BIST" aranırken "bıst" oluşuyordu."""
    return (deger or "").translate(ALT).lower().translate(SADE)


def _kalip(kelimeler) -> re.Pattern:
    """Kelime sınırlı arama kalıbı. Sonunda * olan kelimeler Türkçe ekleri de
    kabul eder ("borsa*" → borsada, borsanın); yıldızsız olanlar tam kelime
    aranır, böylece 'bist' Arabistan'ın, 'tl' fiyatlanır'ın içinde eşleşmez."""
    parcalar = []
    for kelime in kelimeler:
        ekli = kelime.endswith("*")
        govde = re.escape(katla(kelime[:-1] if ekli else kelime)).replace(r"\ ", r"\s+")
        parcalar.append(r"\b" + govde + (r"[a-z]{0,6}\b" if ekli else r"\b"))
    return re.compile("|".join(parcalar), re.UNICODE)


def _gecer(kalip: re.Pattern, metin: str) -> bool:
    return bool(kalip.search(metin))


# Finans dışı haberleri eler.
FINANS = (
    "borsa*", "bist", "hisse*", "endeks*", "temettü*", "halka arz*", "fon*", "piyasa*",
    "yatırım*", "faiz*", "döviz*", "dolar*", "euro*", "kur", "altın*", "tahvil*", "viop",
    "spk", "kap", "portföy*", "sermaye*", "banka*", "enflasyon*", "şirket*", "ihraç*",
    "menkul", "takasbank", "repo", "merkez bankası", "tcmb", "ekonomi*", "bilanço*",
    "kâr*", "zarar*", "ciro*", "yatırımcı*", "emtia*", "petrol*", "ons", "faaliyet*",
)
FINANS_KALIP = _kalip(FINANS)

# Türkiye piyasası işareti: yabancı borsa haberlerini BIST sekmelerinden ayırır.
TURKIYE = (
    "bist", "borsa istanbul", "türkiye*", "türk", "tcmb", "merkez bankası", "spk", "kap",
    "takasbank", "lira*", "tl", "istanbul*", "ankara*", "bddk", "viop", "hazine*", "tüik",
    "borsa*", "bakan*", "cumhurbaşkan*", "kayyum*", "epdk", "rekabet kurumu", "tefas",
    "katılım bankası", "ziraat*", "vakıfbank", "i̇ş bankası",
)
TURKIYE_KALIP = _kalip(TURKIYE)

# Sekme konusu anahtarları (0: BIST Tüm ... 7: Döviz)
SEKME_ANAHTARLARI = [
    ("bist", "borsa istanbul", "hisse*", "endeks*", "kap", "spk", "viop", "halka arz*", "temettü*"),
    ("bist 100", "bist100", "xu100", "bist-100", "endeks*", "borsa istanbul"),
    ("bist 30", "bist30", "xu030", "bist-30", "viop", "endeks kontrat*"),
    ("katılım*", "faizsiz", "islami finans", "kira sertifikası", "sukuk", "katılım endeks*"),
    ("temettü*", "kar payı", "kâr payı", "nakit temettü", "temettü verim*"),
    ("halka arz*", "borsada işlem görmeye", "ipo", "izahname*", "talep toplama*", "gong"),
    ("fon*", "yatırım fonu", "portföy*", "serbest fon*", "byf", "emeklilik fonu", "tefas"),
    ("dolar*", "euro", "kur", "altın*", "sterlin*", "döviz*", "ons", "gram*", "parite*"),
]
SEKME_KALIPLARI = [_kalip(k) for k in SEKME_ANAHTARLARI]


# Sekmeye özel arama: yayıncı beslemeleri her sekmeye yetecek haberi vermiyor,
# bu yüzden sekmenin konusu Bing Haberler'de aranıyor. Fotoğraf, haberin kendi
# sayfasındaki og:image etiketinden alınıyor (Bing'in küçük resmi bozuk geliyor).
BING_SORGULARI = [
    ("Borsa İstanbul hisse", "borsa istanbul son dakika hisse"),
    ("BIST 100 endeksi", "BIST 100 borsa kapanış"),
    ("BIST 30 endeksi", "BIST 30 hisseleri borsa"),
    ("katılım endeksi", "faizsiz yatırım katılım finans BIST"),
    ("temettü ödemesi Borsa İstanbul", "temettü dağıtan şirketler"),
    ("halka arz Borsa İstanbul", "halka arz talep toplama SPK onay"),
    ("yatırım fonu portföy SPK", "TEFAS yatırım fonu getiri"),
    ("dolar euro altın kuru", "altın fiyatları döviz piyasası"),
]

# Haber değil: fiyat sorgu sayfaları, çevirici sayfaları, tekrar eden kotasyonlar.
ARAC_SAYFASI = re.compile(
    r"(\([A-Z]{4,6}\)\s*hisse|hisse senedi\s*$|hisse senedi fiyatları|ne kadar|kaç tl|kac tl|"
    r"hisse fiyatı|canlı borsa|canli borsa|çevirici|hesaplama|kaç para|dolar kuru bugün|"
    r"en çok artan|en çok düşen|en cok artan|anlık|widget|"
    r"^\s*(borsa i̇stanbul|borsa istanbul|altın fiyatları|döviz kurları|hisse senetleri|"
    r"piyasalar|tüm piyasalar haberleri|son dakika haberleri|ekonomi haberleri)\s*$)",
    re.IGNORECASE,
)

_bing_onbellek: dict[int, dict] = {}


def _bing_hedef(baglanti: str) -> str:
    """Bing'in apiclick bağlantısındaki gerçek yayıncı adresini çıkarır."""
    if "apiclick.aspx" not in baglanti:
        return baglanti
    try:
        from urllib.parse import parse_qs, urlparse
        hedef = (parse_qs(urlparse(baglanti).query).get("url") or [""])[0]
    except ValueError:
        return baglanti
    return hedef or baglanti


def _bing_sorgu(sorgu: str) -> tuple:
    """Tek bir aramanın sonuç düğümleri ve ad alanı."""
    from urllib.parse import quote
    adres = ("https://www.bing.com/news/search?q=" + quote(sorgu, safe="")
             + "&format=rss&setlang=tr&cc=tr&qft=sortbydate%3d%221%22")
    for deneme in range(3):                       # Bing arada bozuk XML dönüyor
        try:
            istek = urllib.request.Request(adres, headers={"User-Agent": AJAN})
            with urllib.request.urlopen(istek, timeout=18) as yanit:
                ham = yanit.read()
            kok = ET.fromstring(ham)
            bildirim = re.search(rb'xmlns:News="([^"]+)"', ham[:4000])
            ns = unescape(bildirim.group(1).decode("utf-8", "replace")) if bildirim else ""
            return kok.findall(".//item"), ns
        except Exception:
            time.sleep(0.6)
    return [], ""


def _bing_oku(sekme: int, simdi: float) -> list[dict]:
    """Sekmenin konusuyla arama yapar; fotoğrafı haber sayfasından alır."""
    dugumler: list = []
    for sorgu in BING_SORGULARI[sekme]:
        parca, ad_alani = _bing_sorgu(sorgu)
        dugumler.extend((dugum, ad_alani) for dugum in parca)   # kaynak adı ad alanına bağlı

    adaylar: list[dict] = []
    gorulen: set[str] = set()
    for dugum, ns in dugumler:
        baslik = duz_metin(dugum.findtext("title"))
        baglanti = _bing_hedef((dugum.findtext("link") or "").strip())
        if not baslik or not baglanti.startswith("http") or ARAC_SAYFASI.search(baslik):
            continue
        anahtar = katla(baslik)[:90]
        if baglanti in gorulen or anahtar in gorulen:
            continue                              # iki sorgu aynı haberi getirmiş
        gorulen.add(baglanti)
        gorulen.add(anahtar)
        ozet = duz_metin(dugum.findtext("description"))
        metin = katla(baslik + " " + ozet)
        if not FINANS_KALIP.search(metin):
            continue
        if NON_LATIN.search(baslik):
            continue
        try:
            damga = parsedate_to_datetime(dugum.findtext("pubDate") or "").timestamp()
        except (TypeError, ValueError, OverflowError):
            damga = simdi
        if damga < simdi - 10 * 86400:
            continue
        kaynak = (dugum.findtext("{%s}Source" % ns) or "").strip() if ns else ""
        adaylar.append({
            "id": baglanti,
            "title": baslik,
            "url": baglanti,
            "summary": ozet[:400],
            "body": ozet[:1200],
            "image_url": "",
            "photo_url": "",
            "source": kaynak or "Haber",
            "published_ts": int(damga),
            "published_at": dugum.findtext("pubDate") or "",
            "_metin": metin,
            "_hedefli": True,
        })

    if adaylar:
        with ThreadPoolExecutor(max_workers=8) as havuz:
            for haber, adres_gorsel in zip(adaylar, havuz.map(lambda h: sayfadan_gorsel(h["url"]), adaylar)):
                haber["image_url"] = adres_gorsel
                haber["photo_url"] = adres_gorsel
    return [h for h in adaylar if h["image_url"].startswith("https://")]


def _bing_sekme(sekme: int) -> list[dict]:
    simdi = time.time()
    kayit = _bing_onbellek.get(sekme)
    if kayit and simdi - kayit["ts"] < YENILEME_SANIYE and kayit["items"]:
        return kayit["items"]
    haberler = _bing_oku(sekme, simdi)
    if haberler:
        for haber in haberler:
            haber["kodlar"] = _kodlari_bul(haber)
            haber["turkiye"] = bool(TURKIYE_KALIP.search(haber["_metin"])) or bool(haber["kodlar"])
        _bing_onbellek[sekme] = {"items": haberler, "ts": simdi}
        return haberler
    return kayit["items"] if kayit else []


NON_LATIN = re.compile(r"[\u0400-\u04FF\u0590-\u08FF\u3000-\u9FFF\uAC00-\uD7AF]")


def _gorsel_bul(dugum) -> str:
    for etiket in (MRSS, MRSS_THUMB, "enclosure"):
        alan = dugum.find(etiket)
        if alan is not None:
            adres = (alan.get("url") or "").strip()
            if adres.startswith("https://"):
                return adres
    for alan in ("description", ICERIK):
        govde = dugum.findtext(alan) or ""
        esles = re.search(r'<img[^>]+src="(https://[^"]+)"', unescape(govde))
        if esles:
            return esles.group(1)
    return ""


OG = re.compile(
    rb'<meta[^>]+(?:property|name)=["\'](?:og:image|og:image:url|twitter:image)["\'][^>]+content=["\']([^"\']+)["\']',
    re.I,
)
OG_TERS = re.compile(
    rb'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\']',
    re.I,
)


def sayfadan_gorsel(adres: str) -> str:
    """Haber sayfasındaki og:image etiketini okur."""
    if adres in _gorsel_onbellek:
        return _gorsel_onbellek[adres]
    bulunan = ""
    try:
        istek = urllib.request.Request(adres, headers={"User-Agent": AJAN})
        with urllib.request.urlopen(istek, timeout=8) as yanit:
            bas = yanit.read(250_000)
        esles = OG.search(bas) or OG_TERS.search(bas)
        if esles:
            aday = unescape(esles.group(1).decode("utf-8", "replace")).strip()
            if aday.startswith("//"):
                aday = "https:" + aday
            if aday.startswith("https://") and not aday.endswith(".svg"):
                bulunan = aday
    except Exception:                       # ağ/ayrıştırma sorunu haberi düşürsün, akışı değil
        bulunan = ""
    _gorsel_onbellek[adres] = bulunan
    return bulunan


def _besleme_oku(ad: str, adres: str, simdi: float, gorsel_sart: bool) -> list[dict]:
    istek = urllib.request.Request(adres, headers={"User-Agent": AJAN})
    with urllib.request.urlopen(istek, timeout=15) as yanit:
        ham = yanit.read(3_000_000)
    kok = ET.fromstring(ham)
    cikti = []
    for dugum in kok.findall(".//item"):
        baslik = duz_metin(dugum.findtext("title"))
        baglanti = (dugum.findtext("link") or "").strip()
        if not baslik or not baglanti.startswith("http"):
            continue
        gorsel = _gorsel_bul(dugum)
        if gorsel_sart and not gorsel:
            continue
        ozet = duz_metin(dugum.findtext("description"))
        metin = katla(baslik + " " + ozet)
        if not FINANS_KALIP.search(metin):
            continue
        try:
            damga = parsedate_to_datetime(dugum.findtext("pubDate") or "").timestamp()
        except (TypeError, ValueError, OverflowError):
            damga = simdi
        if damga > simdi + 3600 or damga < simdi - 10 * 86400:
            continue
        cikti.append({
            "id": baglanti,
            "title": baslik,
            "url": baglanti,
            "summary": ozet[:400],
            "body": ozet[:1200],
            "image_url": gorsel,
            "photo_url": gorsel,
            "source": ad,
            "published_ts": int(damga),
            "published_at": dugum.findtext("pubDate") or "",
            "_metin": metin,
        })
    return cikti


def _kodlari_bul(haber: dict) -> set[str]:
    """Haberde geçen şirket kodları: hem 'THYAO' gibi kodlar hem şirket adları."""
    kodlar = set()
    ham = haber["title"] + " " + haber["summary"]
    for aday in re.findall(r"\b[A-ZÇĞİÖŞÜ]{4,6}\b", ham):
        if aday in _SIRKET_ADLARI or aday in XU100 or aday in XHARZ:
            kodlar.add(aday)
    metin = haber["_metin"]
    for sade, kod in _AD_KOD:
        if sade in metin:
            kodlar.add(kod)
    return kodlar


def _tazele() -> None:
    simdi = time.time()
    if simdi - _onbellek["updated"] < YENILEME_SANIYE and _onbellek["items"]:
        return
    toplam: list[dict] = []
    hatalar: list[str] = []

    def getir(is_):
        ad, adres, sart = is_
        try:
            return _besleme_oku(ad, adres, simdi, sart)
        except Exception as hata:
            hatalar.append(f"{ad}: {type(hata).__name__}")
            return []

    isler = [(ad, adres, True) for ad, adres in GORSELLI] + [(ad, adres, False) for ad, adres in BIST_YOGUN]
    with ThreadPoolExecutor(max_workers=8) as havuz:
        for parca in havuz.map(getir, isler):
            toplam.extend(parca)

    # Tekrarları at (aynı haber birkaç yayıncıda olabiliyor).
    gorulen: set[str] = set()
    benzersiz: list[dict] = []
    for haber in sorted(toplam, key=lambda x: x["published_ts"], reverse=True):
        anahtar = katla(haber["title"])[:90]
        if anahtar in gorulen:
            continue
        gorulen.add(anahtar)
        haber["kodlar"] = _kodlari_bul(haber)
        haber["turkiye"] = bool(TURKIYE_KALIP.search(haber["_metin"])) or bool(haber["kodlar"])
        benzersiz.append(haber)

    # Fotoğrafı olmayan ama borsa açısından değerli haberlerin fotoğrafını sayfadan al.
    eksik = [h for h in benzersiz if not h["image_url"] and (h["kodlar"] or h["turkiye"])][:SAYFADAN_EN_FAZLA]
    if eksik:
        with ThreadPoolExecutor(max_workers=8) as havuz:
            for haber, adres in zip(eksik, havuz.map(lambda h: sayfadan_gorsel(h["url"]), eksik)):
                haber["image_url"] = adres
                haber["photo_url"] = adres

    fotolu = [h for h in benzersiz if h["image_url"].startswith("https://")]
    if not fotolu:
        _onbellek["errors"] = hatalar or ["kaynak yok"]
        return
    _onbellek.update(items=fotolu, updated=simdi, errors=hatalar)


def _sekme_puani(haber: dict, sekme: int) -> int:
    """Haberin sekmeye uygunluğu: 3 tam isabet, 2 endeks şirketi, 1 genel borsa, 0 uzak."""
    metin = haber["_metin"]
    tam = bool(SEKME_KALIPLARI[sekme].search(metin))
    endeks = SEKME_ENDEKSI.get(sekme)
    uye = bool(endeks and (haber["kodlar"] & endeks))

    if sekme == 7:                                   # Döviz: Türkiye şartı yok
        return 3 if tam else 0
    if sekme == 6:                                   # Fonlar
        if tam:
            return 3 if haber["turkiye"] else 2
        return 0
    if not haber["turkiye"]:                         # BIST sekmelerinde yabancı borsa haberi olmaz
        return 0
    if sekme == 0:
        return 3 if tam else (2 if haber["kodlar"] else 0)
    if uye and tam:
        return 3
    if uye:
        return 2
    if tam:
        return 2 if sekme in (3, 4, 5) else 3
    return 0


def sekme_haberleri(sekme: int, en_az: int = 12) -> tuple[list[dict], dict]:
    """Bir piyasa sekmesinin fotoğraflı haberleri, konuya yakınlığa göre sıralı.

    Sıra: (1) sekmenin konusuyla aranmış hedefli haberler, (2) yayıncı
    beslemelerinden sekmeye uyan haberler, (3) yetmezse genel BIST haberleri.
    """
    sekme = max(0, min(len(SEKME_ANAHTARLARI) - 1, int(sekme or 0)))
    with _kilit:
        _tazele()
        hepsi = list(_onbellek["items"])
        hatalar = list(_onbellek["errors"])
        guncelleme = _onbellek["updated"]

    try:
        hedefli = _bing_sekme(sekme)
    except Exception:
        hedefli = []

    secilen: list[dict] = []
    kimlikler: set[str] = set()
    baslik_izi: set[str] = set()

    def ekle(haber: dict) -> None:
        anahtar = katla(haber["title"])[:90]
        if haber["id"] in kimlikler or anahtar in baslik_izi:
            return
        kimlikler.add(haber["id"])
        baslik_izi.add(anahtar)
        secilen.append(haber)

    # Arama sonucu da olsa konuyla ya da BIST ile ilgisi olmayan haber girmez.
    for haber in sorted(hedefli, key=lambda h: -h["published_ts"]):
        if _sekme_puani(haber, sekme) >= 2 or _sekme_puani(haber, 0) >= 2:
            ekle(haber)

    uyanlar = [(h, _sekme_puani(h, sekme)) for h in hepsi]
    for haber in sorted([h for h, p in uyanlar if p >= 2],
                        key=lambda h: (-_sekme_puani(h, sekme), -h["published_ts"])):
        ekle(haber)

    if len(secilen) < en_az:
        # Yabancı borsa haberi ya da konu dışı haber girmez: az haber göstermek,
        # yanlış haber göstermekten iyi.
        for haber in sorted([h for h in hepsi if _sekme_puani(h, 0) >= 2], key=lambda h: -h["published_ts"]):
            if len(secilen) >= en_az:
                break
            ekle(haber)
    if len(secilen) < en_az and sekme in (6, 7):
        for haber in sorted(hepsi, key=lambda h: -h["published_ts"]):
            if len(secilen) >= en_az:
                break
            ekle(haber)

    temiz = []
    for haber in secilen[:40]:
        temiz.append({k: v for k, v in haber.items()
                      if not k.startswith("_") and k not in ("kodlar", "turkiye")})
    bilgi = {
        "ok": bool(temiz),
        "count": len(temiz),
        "targeted": len(hedefli),
        "updated_at": int(guncelleme),
        "sources": sorted({h["source"] for h in temiz}),
        "errors": hatalar,
    }
    return temiz, bilgi


def genel_haberler() -> tuple[list[dict], dict]:
    return sekme_haberleri(0, en_az=20)
