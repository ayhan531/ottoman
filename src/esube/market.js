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
];

export const BIST = 0, BIST100 = 1, BIST30 = 2, PARTICIPATION = 3, DIVIDEND = 4, IPO = 5, FUNDS = 6, CURRENCY = 7;

/** Alım-satımı backend'de desteklenen sekmeler; diğerlerinde "referansınız ile iletişime geçin" çıkar. */
export const TRADABLE_MARKETS = new Set([BIST, BIST100, BIST30, PARTICIPATION, DIVIDEND]);

const XU030 = ["AKBNK","AKSEN","ALARK","ASELS","ASTOR","BIMAS","BRSAN","EKGYO","ENKAI","EREGL","FROTO","GARAN","GUBRF","HEKTS","ISCTR","KCHOL","KOZAL","KRDMD","MGROS","ODAS","OYAKC","PETKM","PGSUS","SAHOL","SASA","SISE","TCELL","THYAO","TOASO","TUPRS"];

const XU100_EXTRA = ["AEFES","AGHOL","AHGAZ","AKFGY","AKFYE","AKSA","ALFAS","ALTNY","ANSGR","ARCLK","ARDYZ","AVPGY","BERA","BFREN","BINHO","BOBET","BRYAT","BSOKE","BTCIM","CANTE","CCOLA","CIMSA","CVKMD","CWENE","DOAS","DOHOL","ECILC","EGEEN","ENERY","ENJSA","ESEN","EUPWR","EUREN","FENER","GESAN","GOLTS","GSDHO","GWIND","HTTBT","IPEKE","ISDMR","ISMEN","IZENR","KARSN","KAYSE","KCAER","KONTR","KONYA","KORDS","KOZAA","KTLEV","MAVI","MIATK","MPARK","OBAMS","OTKAR","PAPIL","PENTA","PSGYO","REEDR","SDTTR","SKBNK","SMRTG","SOKM","TAVHL","TKFEN","TMSN","TSKB","TTKOM","TTRAK","TUKAS","TURSG","ULKER","VAKBN","VESBE","VESTL","YEOTK","YKBNK","YYLGD","ZOREN"];

const XKTUM = ["ASELS","ASTOR","AKSEN","ALARK","BIMAS","BRSAN","CIMSA","EGEEN","EKGYO","ENJSA","ENKAI","EREGL","EUPWR","FROTO","GESAN","GUBRF","HEKTS","ISDMR","KARSN","KCAER","KCHOL","KONTR","KONYA","KORDS","KOZAA","KOZAL","KRDMD","MGROS","MIATK","OTKAR","OYAKC","PETKM","PGSUS","SASA","SISE","SMRTG","SOKM","TAVHL","TCELL","THYAO","TKFEN","TMSN","TOASO","TTKOM","TTRAK","TUKAS","TUPRS","ULKER","VESBE","VESTL","YEOTK","ZOREN","AHGAZ","AKFYE","ALFAS","BOBET","BTCIM","CANTE","CWENE","ESEN","EUREN","GOLTS","GWIND","IZENR","KAYSE","PAPIL","REEDR","SDTTR","TUREX","ALTNY","BINHO","OBAMS"];

const XTMTU = ["AEFES","AKBNK","AKSA","ANSGR","ARCLK","ASELS","AYGAZ","BIMAS","BRISA","CCOLA","CIMSA","DOAS","ECILC","EGEEN","EKGYO","ENJSA","ENKAI","EREGL","FROTO","GARAN","GUBRF","ISCTR","ISDMR","KCHOL","KONYA","KORDS","MGROS","OTKAR","OYAKC","PETKM","PGSUS","SAHOL","SISE","SOKM","TAVHL","TCELL","TKFEN","TOASO","TRGYO","TSKB","TTKOM","TTRAK","TUPRS","TURSG","ULKER","VAKBN","VESBE","YKBNK","AGHOL","ALARK","BAGFS","BANVT","BUCIM","CEMTS","DEVA","GOLTS","HEKTS","INDES","ISMEN","KLMSN","LOGO","MPARK","NUHCM","PRKME","SARKY","SELEC","TATGD","TUKAS","VESTL","YATAS","ZOREN"];

const XHARZ = ["ALTNY","BINHO","OBAMS","REEDR","PAPIL","SDTTR","MIATK","KCAER","EUPWR","CVKMD","ALFAS","AHGAZ","AKFYE","BOBET","CANTE","CWENE","ENERY","ESEN","EUREN","GESAN","GOLTS","GWIND","HTTBT","IZENR","KAYSE","KONTR","KTLEV","PENTA","SMRTG","YEOTK","YYLGD","ARDYZ","AVPGY","BFREN","BSOKE","TUKAS","AAGYO","AKFIS","ALKLC","ARTMS","BIGCH","BORLS","BULGS","CGCAM","DCTTR","DOFER","EFORC","ENTRA","FORTE","GRTHO","HRKET","INTEM","KOCMT","LMKDC","MAGEN","MEGMT","MHRGY","MOGAN","OFSYM","ONRYT","PASEU","PCILT","PEKGY","PKENT","RGYAS","SAMAT","SEGYO","SURGY","TABGD","TNZTP","YIGIT"];

const setOf = (list) => new Set(list);
const S_XU030 = setOf(XU030);
const S_XU100 = setOf([...XU030, ...XU100_EXTRA]);
const S_XKTUM = setOf(XKTUM);
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
/** "%4,55" */
export const percent = (value) => "%" + tr(value);
/** "+₺391,00" / "−₺391,00" */
export const signed = (value) => (Number(value) >= 0 ? "+" : "−") + money(Math.abs(Number(value) || 0));
/** "+%1,12" — Design.Move */
export const move = (value) => (Number(value) >= 0 ? "+" : "−") + percent(Math.abs(Number(value) || 0));
/** "−₺337,50 (%0,17)" */
export const delta = (amountValue, percentValue) => signed(amountValue) + " (" + percent(Math.abs(Number(percentValue) || 0)) + ")";

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

/** Borsa saatleri: hafta içi 10:00-18:00 İstanbul (MarketData.IsOpen). */
export const isMarketOpen = (date = new Date()) => {
  const istanbul = new Date(date.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const day = istanbul.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = istanbul.getHours() * 60 + istanbul.getMinutes();
  return minutes >= 600 && minutes < 1080;
};

/** İleriye doğru N iş günü (MarketData.BusinessDays). */
export const businessDays = (count) => {
  const date = new Date();
  let added = 0;
  while (added < count) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added += 1;
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
    volume: Number(quote.volume || 0),
    logo: quote.logo_url || "",
    assetClass: quote.asset_class || "stock",
    currency: isFx ? "TRY" : quote.asset_class === "index" ? "" : "TRY",
    kind: quote.asset_class === "fund" ? "fund" : quote.asset_class === "fx" ? "currency" : "stock",
  };
};

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
    case PARTICIPATION:
      return stocks.filter((item) => S_XKTUM.has(item.code));
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
