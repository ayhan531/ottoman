// Piyasa sekmeleri, endeks üyelikleri ve APK'daki biçimleyiciler (Models/DemoAccount.cs).

export const MARKET_NAMES = [
  "BIST Tüm",
  "BIST 100",
  "BIST 30",
  "BIST Katılım",
  "BIST Temettü",
  "Halka Arzlar",
  "Fonlar",
  "Döviz",
  "BIST 50",
];

export const BIST = 0, BIST100 = 1, BIST30 = 2, PARTICIPATION = 3, DIVIDEND = 4, IPO = 5, FUNDS = 6, CURRENCY = 7, BIST50 = 8;

/** Sekmelerin ekranda gösterilme sırası (dahili numaralarla karışmasın diye ayrı tutulur). */
export const MARKET_TAB_ORDER = [BIST, BIST100, BIST50, BIST30, PARTICIPATION, IPO, FUNDS, CURRENCY];
/** Haberler ekranı Temettü'yü de bir filtre olarak gösterir; aynı sırayı korur. */
export const NEWS_TAB_ORDER = [BIST, BIST100, BIST50, BIST30, PARTICIPATION, DIVIDEND, IPO, FUNDS, CURRENCY];

/** Alım-satımı backend'de desteklenen sekmeler; diğerlerinde "referansınız ile iletişime geçin" çıkar. */
export const TRADABLE_MARKETS = new Set([BIST, BIST100, BIST30, DIVIDEND, BIST50]);

/** Al/Sat ekranı hiç açılmayan piyasalar için gösterilecek yönlendirme metni (bkz. Trade.jsx REFERRAL_TEXT). */
export const MARKET_CONTACT_TEXT = {
  [IPO]: "Halka arz alış satışları için referansınız ile iletişime geçiniz.",
  [FUNDS]: "Fon alış satışları için referansınız ile iletişime geçiniz.",
  [CURRENCY]: "Döviz alış satışları için referansınız ile iletişime geçiniz.",
  [PARTICIPATION]: "Katılım hisse alış satışları için referansınız ile iletişime geçiniz.",
};

const XU030 = ["AKBNK","AKSEN","ALARK","ASELS","ASTOR","BIMAS","BRSAN","EKGYO","ENKAI","EREGL","FROTO","GARAN","GUBRF","HEKTS","ISCTR","KCHOL","KOZAL","KRDMD","MGROS","ODAS","OYAKC","PETKM","PGSUS","SAHOL","SASA","SISE","TCELL","THYAO","TOASO","TUPRS"];

// XU050 (BIST 50 endeksi) bileşenleri — getmidas.com ve infoyatirim.com XU050 listeleriyle çapraz doğrulanmıştır (Eylül 2026).
const XU050 = ["AEFES","AKBNK","AKSEN","ALARK","ASELS","ASTOR","BIMAS","BRSAN","BTCIM","CANTE","CCOLA","CIMSA","DSTKF","ECILC","EFOR","EKGYO","ENKAI","EREGL","FROTO","GARAN","GLRMK","GUBRF","HALKB","HEKTS","ISCTR","KCHOL","KRDMD","KTLEV","KUYAS","MGROS","MIATK","OYAKC","PASEU","PETKM","PGSUS","SAHOL","SASA","SISE","TAVHL","TCELL","THYAO","TOASO","TRALT","TRMET","TTKOM","TUPRS","TURSG","ULKER","VAKBN","YKBNK"];

const XU100_EXTRA = ["AEFES","AGHOL","AHGAZ","AKFGY","AKFYE","AKSA","ALFAS","ALTNY","ANSGR","ARCLK","ARDYZ","AVPGY","BERA","BFREN","BINHO","BOBET","BRYAT","BSOKE","BTCIM","CANTE","CCOLA","CIMSA","CVKMD","CWENE","DOAS","DOHOL","ECILC","EGEEN","ENERY","ENJSA","ESEN","EUPWR","EUREN","FENER","GESAN","GOLTS","GSDHO","GWIND","HTTBT","IPEKE","ISDMR","ISMEN","IZENR","KARSN","KAYSE","KCAER","KONTR","KONYA","KORDS","KOZAA","KTLEV","MAVI","MIATK","MPARK","OBAMS","OTKAR","PAPIL","PENTA","PSGYO","REEDR","SDTTR","SKBNK","SMRTG","SOKM","TAVHL","TKFEN","TMSN","TSKB","TTKOM","TTRAK","TUKAS","TURSG","ULKER","VAKBN","VESBE","VESTL","YEOTK","YKBNK","YYLGD","ZOREN"];

const XTMTU = ["AEFES","AKBNK","AKSA","ANSGR","ARCLK","ASELS","AYGAZ","BIMAS","BRISA","CCOLA","CIMSA","DOAS","ECILC","EGEEN","EKGYO","ENJSA","ENKAI","EREGL","FROTO","GARAN","GUBRF","ISCTR","ISDMR","KCHOL","KONYA","KORDS","MGROS","OTKAR","OYAKC","PETKM","PGSUS","SAHOL","SISE","SOKM","TAVHL","TCELL","TKFEN","TOASO","TRGYO","TSKB","TTKOM","TTRAK","TUPRS","TURSG","ULKER","VAKBN","VESBE","YKBNK","AGHOL","ALARK","BAGFS","BANVT","BUCIM","CEMTS","DEVA","GOLTS","HEKTS","INDES","ISMEN","KLMSN","LOGO","MPARK","NUHCM","PRKME","SARKY","SELEC","TATGD","TUKAS","VESTL","YATAS","ZOREN"];

const XHARZ = ["ALTNY","BINHO","OBAMS","REEDR","PAPIL","SDTTR","MIATK","KCAER","EUPWR","CVKMD","ALFAS","AHGAZ","AKFYE","BOBET","CANTE","CWENE","ENERY","ESEN","EUREN","GESAN","GOLTS","GWIND","HTTBT","IZENR","KAYSE","KONTR","KTLEV","PENTA","SMRTG","YEOTK","YYLGD","ARDYZ","AVPGY","BFREN","BSOKE","TUKAS","AAGYO","AKFIS","ALKLC","ARTMS","BIGCH","BORLS","BULGS","CGCAM","DCTTR","DOFER","EFORC","ENTRA","FORTE","GRTHO","HRKET","INTEM","KOCMT","LMKDC","MAGEN","MEGMT","MHRGY","MOGAN","OFSYM","ONRYT","PASEU","PCILT","PEKGY","PKENT","RGYAS","SAMAT","SEGYO","SURGY","TABGD","TNZTP","YIGIT"];

const setOf = (list) => new Set(list);
const S_XU030 = setOf(XU030);
const S_XU050 = setOf(XU050);
const S_XU100 = setOf([...XU030, ...XU100_EXTRA]);
const S_XTMTU = setOf(XTMTU);
const S_XHARZ = setOf(XHARZ);

/** Türkçe karakterleri sadeleştirip küçük harfe indirger (MarketData.Fold). */
export const fold = (value = "") =>
  value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/İ/g, "i")
    .replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u")
    .trim();

/** "1.234,56" — Türkçe sayı biçimi. */
export const trSayi = (value, digits = 2) =>
  Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const tr = (value, digits = 2) =>
  Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** "₺412,50" */
export const money = (value) => "₺" + tr(value);
/** Endeks/döviz gibi birim farkı olan değerler. */
export const amount = (value, currency) =>
  currency === "" ? tr(value) : currency === "USD" ? "$" + tr(value) : currency === "EUR" ? "€" + tr(value) : "₺" + tr(value);
/** "4,55%" — yüzde işareti sonda (referans: +16,14% / -3,91%) */
export const percent = (value) => tr(value) + "%";
/** "+₺391,00" / "−₺391,00" */
export const signed = (value) => (Number(value) >= 0 ? "+" : "−") + money(Math.abs(Number(value) || 0));
/** "+1,12%" / "−1,12%" — Design.Move, yüzde işareti sonda */
export const move = (value) => (Number(value) >= 0 ? "+" : "−") + percent(Math.abs(Number(value) || 0));
/** "−₺337,50 (−0,17%)" — yüzde işareti sonda, kendi işaretiyle */
export const delta = (amountValue, percentValue) => signed(amountValue) + " (" + move(Number(percentValue) || 0) + ")";

/** 24.200,50 / 24200,5 / 24.5 biçimlerini okur (DemoAccount.ParseAmount). */
export const parseAmount = (text) => {
  if (text === null || text === undefined) return NaN;
  const raw = String(text).trim().replace(/[^\d.,-]/g, "");
  if (!raw) return NaN;
  let duz;
  if (raw.includes(",")) {
    // Virgül varsa ondalık odur, noktalar binlik ayracıdır: 1.234,56
    duz = raw.replace(/\./g, "").replace(",", ".");
  } else {
    const noktaSayisi = (raw.match(/\./g) || []).length;
    const sonParca = raw.split(".").pop();
    // Tek nokta ve ardından 3 hane değilse ondalıktır (288.5); değilse binliktir (40.000)
    duz = noktaSayisi === 1 && sonParca.length !== 3 ? raw : raw.replace(/\./g, "");
  }
  const value = Number(duz);
  return Number.isFinite(value) ? value : NaN;
};

/** Yazarken binlik ayraç koyar (24200 → 24.200). */
export const group = (text) => {
  // Alan zaten binlik ayraçlı yazıyor; kullanıcı yazdıkça noktalar yeniden
  // üretilir. Bu yüzden nokta HER ZAMAN binlik ayracıdır ve atılır; ondalık
  // yalnızca virgüldür. (Eskiden "40.000"in noktası ondalık sanılıp beş
  // haneden sonra tutar "40,00"a düşüyordu.)
  const raw = String(text ?? "").replace(/\./g, "").replace(/[^\d,]/g, "");
  if (!raw) return "";
  const parcalar = raw.split(",");
  const tam = parcalar[0].replace(/\D/g, "").slice(0, 12);
  const ondalik = parcalar.length > 1 ? "," + parcalar.slice(1).join("").replace(/\D/g, "").slice(0, 2) : "";
  const gruplu = tam ? Number(tam).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) : (ondalik ? "0" : "");
  return gruplu + ondalik;
};

/** İşlem hacmi: "123,45 Mr ₺" ya da "850,2 Mn ₺". */
export const volumeText = (turnover) =>
  turnover >= 1_000_000_000
    ? tr(turnover / 1_000_000_000) + " Mr ₺"
    : Number(turnover / 1_000_000).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " Mn ₺";

// Sabit resmi tatiller (Ay-Gün)
const FIXED_HOLIDAYS = new Set([
  "01-01", // Yılbaşı
  "04-23", // Ulusal Egemenlik ve Çocuk Bayramı
  "05-01", // Emek ve Dayanışma Günü
  "05-19", // Atatürk'ü Anma, Gençlik ve Spor Bayramı
  "07-15", // Demokrasi ve Milli Birlik Günü
  "08-30", // Zafer Bayramı
  "10-29", // Cumhuriyet Bayramı
]);

// Dini bayramlar (Yıl-Ay-Gün tam gün tatiller)
const RELIGIOUS_HOLIDAYS = new Set([
  // 2025
  "2025-03-30", "2025-03-31", "2025-04-01",
  "2025-06-06", "2025-06-07", "2025-06-08", "2025-06-09",
  // 2026
  "2026-03-20", "2026-03-21", "2026-03-22",
  "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30",
  // 2027
  "2027-03-10", "2027-03-11", "2027-03-12",
  "2027-05-17", "2027-05-18", "2027-05-19", "2027-05-20",
  // 2028
  "2028-02-27", "2028-02-28", "2028-02-29",
  "2028-05-05", "2028-05-06", "2028-05-07", "2028-05-08",
]);

// Yarım gün resmi tatiller (Arife günleri ve 28 Ekim)
// 28 Ekim her yıl yarım gündür.
const HALF_DAY_HOLIDAYS = new Set([
  // 2025
  "2025-03-29", "2025-06-05",
  // 2026
  "2026-03-19", "2026-05-26",
  // 2027
  "2027-03-09", "2027-05-16",
  // 2028
  "2028-02-26", "2028-05-04",
]);

/** İstanbul saat dilimine göre tarih ve saat bileşenlerini ayrıştırır. */
export const getIstanbulTime = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const partMap = {};
  for (const p of parts) partMap[p.type] = p.value;
  const year = partMap.year;
  const month = partMap.month;
  const day = partMap.day;
  const hour = Number(partMap.hour);
  const minute = Number(partMap.minute);
  const yyyy_mm_dd = `${year}-${month}-${day}`;
  const mm_dd = `${month}-${day}`;
  const minutes = hour * 60 + minute;
  const dayOfWeekFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    weekday: "short",
  });
  const dayOfWeekStr = dayOfWeekFormatter.format(date);
  const isWeekend = dayOfWeekStr === "Sat" || dayOfWeekStr === "Sun";
  return { year, month, day, hour, minute, minutes, yyyy_mm_dd, mm_dd, dayOfWeekStr, isWeekend };
};

/**
 * Borsa İstanbul seans durumu:
 * - Hafta sonları kapalı (Cumartesi / Pazar)
 * - Resmi ve dini tatillerde kapalı
 * - Yarım günlerde (Arife ve 28 Ekim): 10:00 - 12:40 (kapanış 13:00)
 * - Normal günlerde: 10:00 - 18:05 (sürekli işlem ve kapanış seansı)
 */
export const isMarketOpen = (date = new Date()) => {
  const ist = getIstanbulTime(date);
  if (ist.isWeekend) return false;
  if (FIXED_HOLIDAYS.has(ist.mm_dd) || RELIGIOUS_HOLIDAYS.has(ist.yyyy_mm_dd)) {
    return false;
  }
  const isHalfDay = ist.mm_dd === "10-28" || HALF_DAY_HOLIDAYS.has(ist.yyyy_mm_dd);
  if (isHalfDay) {
    return ist.minutes >= 600 && ist.minutes < 780; // 10:00 - 13:00
  }
  return ist.minutes >= 600 && ist.minutes < 1085; // 10:00 - 18:05
};

/** İleriye doğru N iş günü (MarketData.BusinessDays). */
export const businessDays = (count) => {
  const date = new Date();
  let added = 0;
  while (added < count) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6 && isMarketOpen(new Date(date.setHours(12, 0, 0, 0)))) {
      added += 1;
    }
  }
  return date;
};


// APK'daki MarketData.Currencies tablosuyla birebir (ikinci sözcük küçük harf).
const CURRENCY_NAMES = {
  USDTRY: "Amerikan doları",
  EURTRY: "Euro",
  GBPTRY: "İngiliz sterlini",
  CHFTRY: "İsviçre frangı",
  JPYTRY: "Japon yeni",
  CADTRY: "Kanada doları",
  AUDTRY: "Avustralya doları",
  SEKTRY: "İsveç kronu",
  NOKTRY: "Norveç kronu",
  DKKTRY: "Danimarka kronu",
};

/** API kaydını APK'daki Instrument biçimine çevirir. */
export const toInstrument = (quote) => {
  const changePct = Number(quote.change_pct || 0);
  const price = Number(quote.price || 0);
  const previous = 1 + changePct / 100 === 0 ? price : price / (1 + changePct / 100);
  const symbol = String(quote.symbol || "");
  const isFx = quote.asset_class === "fx";
  return {
    symbol: isFx ? symbol.replace(/TRY$/, "/TRY") : symbol,
    code: symbol,
    name: isFx ? CURRENCY_NAMES[symbol] || quote.name || symbol : String(quote.name || symbol).trim(),
    price,
    change: changePct,
    dayDelta: price - previous,
    previousClose: previous,
    rawPrice: price,
    volume: Number(quote.volume || 0),
    logo: quote.logo_url || "",
    assetClass: quote.asset_class || "stock",
    currency: isFx ? "TRY" : quote.asset_class === "index" ? "" : "TRY",
    kind: quote.asset_class === "fund" ? "fund" : quote.asset_class === "fx" ? "currency" : "stock",
    // Katilim Endeksi uygunlugu: admin panelinden elle yonetilen, "son
    // guncelleme" tarihi tasiyan tek dogruluk kaynagi (bkz. backend
    // participation_index tablosu) - statik/derlenmis bir listeye
    // gomulmedi ki KAP duyurusu geldiginde deploy beklemeden guncellensin.
    participationCompliant: Boolean(quote.participation_compliant),
    participationUpdatedAt: quote.participation_updated_at || null,
    participationNote: quote.participation_note || "",
  };
};

/** Hisse fiyat aralığına göre izin verilen maksimum sapma (+/-). */
export function getMaxDeviation(price) {
  const p = Number(price) || 0;
  if (p <= 50.0) return 0.09;
  if (p <= 200.0) return 0.10;
  return 0.20;
}

/** Sapma büyüklüğüne göre tek bir 2 saniyelik adımda yapılabilecek makul adım boyutları. */
export function getDeviationSteps(maxDev) {
  if (maxDev <= 0.09) return [0.01, 0.02, 0.03];
  if (maxDev <= 0.10) return [0.01, 0.02, 0.03, 0.04];
  return [0.02, 0.03, 0.04, 0.05];
}

/**
 * 2 saniyede bir hisse fiyatlarına kontrollü rastgele sapma uygular:
 * - 0 - 50 TL: [-0.09, +0.09]
 * - 50 - 200 TL: [-0.10, +0.10]
 * - 200+ TL: [-0.20, +0.20]
 * - Yön: Tamamen rastgele, sırayla (+, -) değil.
 * - Çok fazla üst üste aynı yönde gitmeyi önler (maksimum 3 ardışık hareket).
 * - Belirlenen sınırları ASLA aşmaz.
 * - Gerçek fiyata olan kümülatif sapma kesinlikle [-maxDev, +maxDev] arasındadır.
 */
export function applyPriceDeviations(baseList, deviationState) {
  return baseList.map((item) => {
    if (item.assetClass !== "stock" || !(item.price > 0)) {
      return item;
    }

    const basePrice = item.rawPrice ?? item.price;
    const maxDev = getMaxDeviation(basePrice);
    const steps = getDeviationSteps(maxDev);
    const state = deviationState[item.code] || { delta: 0, streak: 0, dir: 0 };
    let { delta, streak, dir: lastDir } = state;

    let dir = 0;
    // Sınır koruması: maksimum sapmayı aşmamak için zorunlu yön dönüşü
    if (delta >= maxDev - 0.005) {
      dir = -1;
    } else if (delta <= -maxDev + 0.005) {
      dir = 1;
    } else if (streak >= 3) {
      // 3 veya daha fazla kez üst üste aynı yönde gittiyse ters yöne dön
      dir = -lastDir;
    } else if (streak === 2) {
      // 2 kez üst üste gittiyse %75 ters yöne dön, %25 devam et
      dir = Math.random() < 0.75 ? -lastDir : lastDir;
    } else if (streak === 1) {
      // Ortalama dönüş eğilimi: sapma belirgin derecede arttıysa merkeze doğru meyil ver
      const probUp = delta > maxDev * 0.4 ? 0.35 : delta < -maxDev * 0.4 ? 0.65 : 0.5;
      dir = Math.random() < probUp ? 1 : -1;
    } else {
      dir = Math.random() < 0.5 ? 1 : -1;
    }

    const step = steps[Math.floor(Math.random() * steps.length)];
    let nextDelta = Math.round((delta + dir * step) * 100) / 100;
    if (nextDelta > maxDev) nextDelta = maxDev;
    if (nextDelta < -maxDev) nextDelta = -maxDev;

    // Sınıra çarptığı için değişim olmadıysa ters yöne adım at
    if (nextDelta === delta) {
      dir = -dir;
      nextDelta = Math.round((delta + dir * step) * 100) / 100;
      if (nextDelta > maxDev) nextDelta = maxDev;
      if (nextDelta < -maxDev) nextDelta = -maxDev;
    }

    if (dir === lastDir) {
      streak += 1;
    } else {
      streak = 1;
      lastDir = dir;
    }

    deviationState[item.code] = { delta: nextDelta, streak, dir: lastDir };

    const newPrice = Math.max(0.01, Math.round((basePrice + nextDelta) * 100) / 100);
    const previous = item.previousClose ?? (1 + item.change / 100 === 0 ? basePrice : basePrice / (1 + item.change / 100));
    const dayDelta = Math.round((newPrice - previous) * 100) / 100;
    const change = previous > 0 ? Math.round(((newPrice - previous) / previous) * 10000) / 100 : item.change;

    return {
      ...item,
      price: newPrice,
      dayDelta,
      change,
    };
  });
}

/** Bir sekmenin listesini üretir. */
export function listFor(market, instruments) {
  const stocks = instruments.filter((item) => item.assetClass === "stock");
  switch (market) {
    case BIST:
      return stocks;
    case BIST100:
      return stocks.filter((item) => S_XU100.has(item.code));
    case BIST30:
      return stocks.filter((item) => S_XU030.has(item.code));
    case BIST50:
      return stocks.filter((item) => S_XU050.has(item.code));
    case PARTICIPATION:
      // Not: liste artik statik degil, backend'deki participation_index
      // tablosundan (admin paneli > Katilim Endeksi) geliyor - bkz. toInstrument.
      return stocks.filter((item) => item.participationCompliant).map((item) => ({ ...item, kind: "participation" }));
    case DIVIDEND:
      return stocks.filter((item) => S_XTMTU.has(item.code));
    case IPO:
      return stocks.filter((item) => S_XHARZ.has(item.code)).map((item) => ({ ...item, kind: "ipo" }));
    case FUNDS:
      return instruments.filter((item) => item.assetClass === "fund");
    case CURRENCY:
      return instruments.filter((item) => item.assetClass === "fx");
    default:
      return stocks;
  }
}

/** Sekmenin endeksi (Piyasa Durumu kartı). */
export const indexFor = (market, instruments) => {
  const code = market === BIST30 ? "XU030" : "XU100";
  return instruments.find((item) => item.code === code) || null;
};

/** Yükselen / düşen payı. */
export const breadth = (list) => {
  let rising = 0, falling = 0;
  for (const item of list) {
    if (item.change > 0) rising += 1;
    else if (item.change < 0) falling += 1;
  }
  return { rising, falling };
};

/** Toplam işlem hacmi (lot × fiyat). */
export const turnover = (list) => list.reduce((sum, item) => sum + item.volume * item.price, 0);

/** Arama: sembol ya da ad; Türkçe karakterler sadeleştirilir. */
export function search(query, list, limit = 0) {
  const needle = fold(query);
  if (!needle) return [];
  const exact = [];
  const starts = [];
  const rest = [];
  for (const item of list) {
    const code = fold(item.code);
    const name = fold(item.name);
    if (code === needle) exact.push(item);
    else if (code.startsWith(needle)) starts.push(item);
    else if (code.includes(needle) || name.includes(needle)) rest.push(item);
  }
  const all = [...exact, ...starts, ...rest];
  return limit > 0 ? all.slice(0, limit) : all;
}

/** Günün en çok yükselen / düşenleri. */
export const movers = (list, up, count = 7) =>
  [...list]
    .filter((item) => (up ? item.change > 0 : item.change < 0))
    .sort((a, b) => (up ? b.change - a.change : a.change - b.change))
    .slice(0, count);

export const monogram = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("tr-TR") || "??";
