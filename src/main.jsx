import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown, ArrowLeftRight, ArrowUp, Bell, CheckCircle2, ChevronDown, ChevronRight,
  CircleUserRound, CreditCard, Eye, EyeOff, FileText, Home, Info, Landmark, LockKeyhole,
  Moon, Newspaper, PieChart, Search, ShieldCheck, Star, Sun, Users, X,
} from "lucide-react";
import "./style.css";
import "./extra.css";

const tabs = ["BIST Tüm", "BIST 100", "BIST 30", "BIST Katılım", "BIST Temettü", "Halka Arzlar", "Fonlar", "Döviz"];
const contactOnlyTabs = new Set(["Halka Arzlar", "Fonlar", "Döviz"]);
const stocks = [
  { code: "TUPRS", name: "Tüpraş", price: "₺412,50", rawPrice: 412.5, change: "-%0,78", rawChange: -0.78, assetClass: "stock", color: "#101217", mark: "tupras" },
  { code: "THYAO", name: "Türk Hava Yolları", price: "₺285,25", rawPrice: 285.25, change: "-%3,47", rawChange: -3.47, assetClass: "stock", color: "#d90812", mark: "thy" },
  { code: "ASELS", name: "Aselsan", price: "₺377,00", rawPrice: 377, change: "+%1,21", rawChange: 1.21, assetClass: "stock", color: "#087fc4", mark: "aselsan" },
  { code: "KCHOL", name: "Koç Holding", price: "₺174,20", rawPrice: 174.2, change: "+%0,62", rawChange: 0.62, assetClass: "stock", color: "#183b8f", mark: "bars" },
  { code: "BIMAS", name: "BİM Mağazalar", price: "₺532,00", rawPrice: 532, change: "+%0,44", rawChange: 0.44, assetClass: "stock", color: "#d71920", mark: "bars" },
];
const fallbackNews = [
  ["market", "Borsa İstanbul'da iki hisseye tedbir: Açığa satış ve kredili işlem yasağı"],
  ["cash", "BİST 100 endeksinde hızlı düşüş: Gün 13.892 puan seviyesinden kapandı"],
  ["bist", "SON DAKİKA | Borsa salı gününü düşüşle tamamladı"],
  ["plain", "Piyasa özeti: Borsa, Döviz, Altın ve Kripto piyasalarındaki son durum"],
  ["lens", "Borsa İstanbul'da 11 şirket yeni iş ilişkisi duyurdu"],
];

const money = (value) => `₺${Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (value) => `${Number(value || 0) >= 0 ? "+" : "-"}%${Math.abs(Number(value || 0)).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compactDate = () => new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
const markFor = (symbol = "") => ({ TUPRS: "tupras", THYAO: "thy", ASELS: "aselsan", TDGYO: "bars", CEMZY: "cem", BMSTL: "bms", PATEK: "patek" }[symbol] || "bars");
const colorFor = (symbol = "") => ({ TUPRS: "#101217", THYAO: "#d90812", ASELS: "#087fc4", CEMZY: "#f00815", PATEK: "#11151a", BIMAS: "#d71920", KCHOL: "#183b8f" }[symbol] || "#7657ff");
const quoteToStock = (q) => ({
  code: q.symbol || q.code,
  name: q.name || q.symbol || q.code,
  price: money(q.price),
  rawPrice: Number(q.price || 0),
  change: pct(q.change_pct),
  rawChange: Number(q.change_pct || 0),
  assetClass: q.asset_class || "stock",
  color: colorFor(q.symbol || q.code),
  mark: markFor(q.symbol || q.code),
});
const api = async (path, options = {}) => {
  const isForm = options.body instanceof FormData;
  const res = await fetch(path, {
    credentials: "include",
    headers: isForm ? (options.headers || {}) : { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
};

function StatusBar() {
  return <div className="status"><span>20:30</span><span className="status-icons">◒ ◒ ◉</span><span className="status-right">◆ ◢ ▮</span></div>;
}

function BrandHeader({ showAvatar = true, onNotify, dark, toggleDark, openProfile, me }) {
  return (
    <header className="brand-header">
      {showAvatar ? <button className="avatar profile-trigger" onClick={openProfile}>İS</button> : <div />}
      <div className="brand">Ottoman</div>
      <div className="header-actions">
        <button onClick={onNotify} title="Bildirimler"><Bell size={27} /></button>
        <button onClick={toggleDark} title="Tema">{dark ? <Sun size={30} /> : <Moon size={30} />}</button>
        {me?.role === "admin" && <button className="admin-chip" title="Admin">Admin</button>}
      </div>
    </header>
  );
}

function SearchBox({ placeholder, value, onChange }) {
  return <label className="search"><Search size={31} /><input value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} /></label>;
}

function MarketTabs({ active, onChange }) {
  return <div className="market-tabs">{tabs.map((tab) => <button className={active === tab ? "active" : ""} onClick={() => onChange?.(tab)} key={tab}>{tab}</button>)}</div>;
}

function filterMarket(list, tab, search) {
  if (contactOnlyTabs.has(tab)) return [];
  let next = list.filter((item) => item.assetClass === "stock");
  if (tab === "BIST 100") next = next.slice(0, 100);
  if (tab === "BIST 30") next = next.slice(0, 30);
  if (tab === "BIST Katılım") next = next.filter((item, index) => ["ASELS", "KCHOL", "BIMAS"].includes(item.code) || index % 2 === 0);
  if (tab === "BIST Temettü") next = next.filter((item, index) => ["TUPRS", "BIMAS", "KCHOL"].includes(item.code) || index % 3 === 0);
  const needle = search.trim().toLocaleLowerCase("tr-TR");
  if (needle) next = next.filter((item) => `${item.code} ${item.name}`.toLocaleLowerCase("tr-TR").includes(needle));
  return next;
}

function StockLogo({ item, pale = false }) {
  return <div className={`stock-logo ${pale ? "pale" : ""}`} style={{ "--logo": item.color }}><span className={`mark ${item.mark}`}>{item.mark === "aselsan" ? "aselsan" : item.mark === "cem" ? "Cem" : item.mark === "bms" ? "BMS" : item.mark === "armada" ? "armada" : ""}</span></div>;
}

function StockRow({ item, onClick, favorite, toggleFavorite }) {
  const positive = String(item.change).startsWith("+");
  return (
    <button className="stock-row" onClick={onClick}>
      <StockLogo item={item} />
      <div className="stock-copy"><strong>{item.code}</strong><span>{item.name}</span></div>
      <span className="inline-star" role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); toggleFavorite?.(item.code); }}><Star size={20} fill={favorite ? "#7657ff" : "none"} /></span>
      <div className="stock-price"><strong>{item.price}</strong><span className={positive ? "up" : "down"}>{item.change}</span></div>
    </button>
  );
}

function MarketStatusCard({ tab, loading = false }) {
  if (tab === "BIST Tüm") return null;
  return (
    <section className="market-status-card">
      <div><h2>Piyasa Durumu</h2>{loading ? <p>Piyasa verisi yükleniyor...</p> : <p><strong>16.645,08</strong><span> −%2,16 · −366,67</span></p>}</div>
      <b><i /> Kapalı</b>
      {!loading && <div className="market-mini"><span>Yükselenler <strong>%7</strong></span><span>Düşenler <strong>%93</strong></span><span>Toplam Hacim: <strong>136,55 Mr ₺</strong></span></div>}
    </section>
  );
}

function HomeScreen({ openTrade, market, favorites, toggleFavorite, common }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("BIST Tüm");
  const [contactTab, setContactTab] = useState(null);
  const live = filterMarket(market.length ? market : stocks, tab, search);
  const watched = favorites.size ? live.filter((item) => favorites.has(item.code)) : live.slice(0, 4);
  const gainers = [...live].sort((a, b) => b.rawChange - a.rawChange).slice(0, 6);
  const isSearching = Boolean(search.trim());
  const indexMode = tab !== "BIST Tüm" && !isSearching;
  return (
    <main className="screen scroll">
      <BrandHeader {...common} /><SearchBox placeholder="Ara" value={search} onChange={setSearch} /><MarketTabs active={tab} onChange={(next) => { setTab(next); if (contactOnlyTabs.has(next)) setContactTab(next); }} />
      <MarketStatusCard tab={tab} loading={!market.length && indexMode} />
      <div className="section-title"><h2>{isSearching ? "Arama sonuçları" : indexMode ? tab : "Takip listem"}</h2><button onClick={() => { setSearch(""); setTab("BIST Tüm"); }}>Tümü</button></div>
      {(isSearching || indexMode ? live : watched).map((item) => <StockRow key={item.code} item={item} favorite={favorites.has(item.code)} toggleFavorite={toggleFavorite} onClick={() => openTrade(item)} />)}
      {!isSearching && !indexMode && <><h2 className="solo-title">Öne çıkan yükselenler</h2>{gainers.map((item) => <StockRow key={item.code} item={item} favorite={favorites.has(item.code)} toggleFavorite={toggleFavorite} onClick={() => openTrade(item)} />)}</>}
      {contactTab && <ContactOnlyModal title={contactTab} onClose={() => setContactTab(null)} />}
    </main>
  );
}

function ContactOnlyModal({ title, onClose }) {
  return <div className="modal-layer"><section className="trade-modal readable-modal account-sheet"><div className="sheet-handle" /><button className="close" onClick={onClose}><X /></button><h2>{title}</h2><p className="contact-copy">{title} alış / satış işlemleri için referansınız ile iletişime geçiniz.</p><button className="confirm" onClick={onClose}>Tamam</button></section></div>;
}

const newsArtwork = {
  market: "/news/bist-markets.jpg",
  bist: "/news/bist-markets.jpg",
  cash: "/news/turkey-economy.jpg",
  mynet: "/news/turkey-economy.jpg",
  lens: "/news/company-disclosures.jpg",
  plain: "/news/company-disclosures.jpg",
};

function NewsThumb({ item = {}, type }) {
  const kind = item.type || type || "plain";
  const source = String(item.source || "").toLocaleLowerCase("tr-TR");
  const sourceArtwork = source.includes("tcmb") ? newsArtwork.cash : source.includes("borsa") ? newsArtwork.bist : source.includes("spk") || source.includes("kap") ? newsArtwork.lens : null;
  const src = sourceArtwork || newsArtwork[kind] || item.image_url || item.image || item.thumbnail || newsArtwork.plain;
  return <div className={`news-thumb ${kind}`}><img src={src} alt="" /><span>{item.source || (kind === "cash" ? "EKONOMİ" : kind === "bist" || kind === "market" ? "PİYASA" : "GÜNDEM")}</span></div>;
}

function NewsDetail({ item, onClose }) {
  return <div className="modal-layer"><section className="trade-modal readable-modal news-detail"><button className="close" onClick={onClose}><X /></button><NewsThumb item={item} /><p className="news-kicker">{item.source || "Ottoman Haber"}</p><h2>{item.title}</h2><p className="subtle-count">{item.date || compactDate()}</p><p>{item.body || "Piyasa verileri, Borsa İstanbul işlem hacmi, şirket haberleri ve makro gündem; yatırımcının hızlı okuyabileceği açık ve güvenilir bir özet halinde sunulur."}</p><button className="confirm" onClick={onClose}>Haberlere Dön</button></section></div>;
}

function NewsScreen({ items = [], common }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("BIST Tüm");
  const [detail, setDetail] = useState(null);
  const list = (items.length ? items : fallbackNews.map(([type, title]) => ({ type, title }))).map((item, index) => ({
    type: item.type || (index % 4 === 0 ? "market" : index % 4 === 1 ? "cash" : index % 4 === 2 ? "bist" : "plain"),
    title: item.title || item.headline || item.text,
    body: item.body || item.summary,
    source: item.source,
    date: item.published_at,
    image_url: item.image_url || item.image || item.thumbnail,
  })).filter((item) => item.title?.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR")));
  const featured = list[0];
  const rows = featured && !search ? list.slice(1) : list;
  return (
    <main className="screen scroll">
      <BrandHeader {...common} /><SearchBox placeholder="Haber ara" value={search} onChange={setSearch} /><MarketTabs active={tab} onChange={setTab} />
      <div className="news-head"><span>Güncel Haberler</span><h1>{search ? "Arama sonuçları" : tab}</h1><p>{list.length} haber · SPK, TCMB, KAP ve piyasa kaynakları</p></div>
      {featured && !search && <button className="featured-news" onClick={() => setDetail(featured)}><NewsThumb item={featured} /><span><b>{featured.source || "Ottoman Haber"}</b><h2>{featured.title}</h2><small>{featured.date || compactDate()}</small></span><ChevronRight /></button>}
      <div className="news-list">{rows.length ? rows.map((item) => <button className="news-row" key={item.title} onClick={() => setDetail(item)}><NewsThumb item={item} /><span><b>{item.source || "Ottoman Haber"}</b><h3>{item.title}</h3><small>{item.date || compactDate()}</small></span><ChevronRight /></button>) : (!featured && <div className="empty-state">Aramana uygun haber bulunamadı.</div>)}</div>
      {detail && <NewsDetail item={detail} onClose={() => setDetail(null)} />}
    </main>
  );
}

function LiveDataStrip({ marketMeta, newsMeta }) {
  const marketOk = marketMeta?.ok ?? true;
  const newsOk = newsMeta?.ok ?? true;
  return <section className="live-data-strip">
    <article><span>Piyasa verisi</span><strong>{marketOk ? "Canlı kaynak aktif" : "Kaynak yedekli"}</strong><small>{marketMeta?.source || "trrealapi-market"} · {marketMeta?.symbol_count || marketMeta?.symbols || "çoklu"} sembol</small></article>
    <article><span>Haber akışı</span><strong>{newsOk ? "Resmi kaynak aktif" : "Yedek kaynak"}</strong><small>{newsMeta?.updated_at_label || compactDate()} · TCMB / SPK / Borsa İstanbul</small></article>
  </section>;
}

function TradeScreen({ market, openTrade, favorites, toggleFavorite, common }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("BIST Tüm");
  const list = filterMarket(market.length ? market : stocks, tab, search);
  const isSearching = Boolean(search.trim());
  return (
    <main className="screen scroll trade-screen-list">
      <BrandHeader {...common} /><SearchBox placeholder="Hisse kodu / şirket adı ara" value={search} onChange={setSearch} /><MarketTabs active={tab} onChange={setTab} />
      <MarketStatusCard tab={tab} loading={!market.length && tab !== "BIST Tüm"} />
      <section className="trade-hero"><div><span>Al/Sat</span><h1>Hisse seç, emri sen kur</h1><p>Piyasa, limit, adet ve tutar alanları seçtiğin hisseye göre açılır.</p></div><ArrowLeftRight size={38} /></section>
      <div className="section-title"><h2>Favoriler</h2><button onClick={() => setSearch("")}>Temizle</button></div>
      {(favorites.size ? list.filter((item) => favorites.has(item.code)) : list.slice(0, 3)).map((item) => <StockRow key={`fav-${item.code}`} item={item} favorite={favorites.has(item.code)} toggleFavorite={toggleFavorite} onClick={() => openTrade(item)} />)}
      <h2 className="solo-title">{isSearching ? "Arama sonuçları" : tab}</h2>
      {list.map((item) => <StockRow key={item.code} item={item} favorite={favorites.has(item.code)} toggleFavorite={toggleFavorite} onClick={() => openTrade(item)} />)}
    </main>
  );
}

function ListEmptyAware({ items, empty, render }) {
  return items.length ? items.map(render) : <div className="empty-state">{empty}</div>;
}

function PortfolioScreen({ openTrade, portfolio, common }) {
  const [segment, setSegment] = useState("Pozisyonlar");
  const [hidden, setHidden] = useState(false);
  const [search, setSearch] = useState("");
  const [chartPoint, setChartPoint] = useState(4);
  const account = portfolio?.account || {};
  const apiPositions = (portfolio?.positions || []).map((p) => ({
    code: p.symbol,
    name: p.name || p.symbol,
    lots: `${p.quantity} lot · Ort. maliyet ${money(p.avg_price)}`,
    profit: `${Number(p.pnl || 0) >= 0 ? "+" : "-"}${money(Math.abs(Number(p.pnl || 0)))} (%${Math.abs(p.avg_price ? ((Number(p.current_price || 0) - Number(p.avg_price || 0)) / Number(p.avg_price || 1)) * 100 : 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
    value: money(p.market_value),
    rawPrice: Number(p.current_price || p.avg_price || 0),
    color: colorFor(p.symbol),
    mark: markFor(p.symbol),
  }));
  const shownPositions = (apiPositions.length ? apiPositions : stocks.slice(0, 3).map((s, i) => ({ ...s, lots: `${[250, 150, 50][i]} lot · Ort. maliyet ${money(s.rawPrice * 0.94)}`, profit: `+${money(900 + i * 700)} (%4,65)`, value: money(s.rawPrice * [250, 150, 50][i]) }))).filter((p) => `${p.code} ${p.name}`.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR")));
  const orders = portfolio?.orders || [];
  const transactions = [...(portfolio?.transactions || []), ...(portfolio?.money_requests || [])];
  const cash = Number(account.cash_balance ?? 24200);
  const pending = Number(account.pending_balance ?? 24200);
  const portfolioValue = shownPositions.reduce((sum, p) => sum + Number(String(p.value).replace(/[₺.]/g, "").replace(",", ".") || 0), 0) || 164762.5;
  const totalValue = cash + pending + portfolioValue;
  const mask = (v) => hidden ? "••••••" : v;
  const chartData = [
    ["Pzt 7 Eyl", -1.18], ["Sal 8 Eyl", 0.72], ["Çar 9 Eyl", 1.94],
    ["Per 10 Eyl", 2.76], ["Cum 11 Eyl", -0.53], ["Pzt 14 Eyl", 4.63],
  ];
  const activeChart = chartData[chartPoint] || chartData[0];
  return (
    <main className="screen scroll portfolio-screen">
      <BrandHeader showAvatar={false} {...common} />
      <div className="portfolio-carousel" aria-label="Portföy özet ve getiri kartları">
        <section className="portfolio-card portfolio-summary-card">
          <div className="portfolio-top"><span>Portföy özeti</span><button onClick={() => setHidden(!hidden)}>{hidden ? <EyeOff size={24} /> : <Eye size={24} />}</button></div>
          <div className="portfolio-grid"><div><h1>{mask(money(totalValue))}</h1><p>{mask("+₺7.286,00")} toplam kâr</p><div className="balance-pair"><span>Kullanılabilir<strong>{mask(money(cash))}</strong></span><span>T+2 Bakiye<strong>{mask(money(pending))}</strong></span></div></div><div className="donut"><div>%83</div></div></div>
          <div className="legend"><span><i /> Pozisyonlar · %83</span><span><i /> Bakiye · %13</span><span><i /> Kâr · +%4,63</span></div>
        </section>
        <section className="portfolio-card chart-card">
          <div className="portfolio-top"><span>Getiri grafiği</span><b>{activeChart[0]} · %{activeChart[1].toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</b></div>
          <svg className="return-chart" viewBox="0 0 320 150" role="img" aria-label="Portföy getiri grafiği">
            <defs><linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#bdf7ce" stopOpacity=".55" /><stop offset="100%" stopColor="#bdf7ce" stopOpacity=".05" /></linearGradient></defs>
            <path d="M18 124 C42 86, 58 94, 78 56 S126 42, 143 75 S188 96, 205 50 S248 30, 302 42 L302 138 L18 138 Z" fill="url(#lineFill)" />
            <path d="M18 124 C42 86, 58 94, 78 56 S126 42, 143 75 S188 96, 205 50 S248 30, 302 42" fill="none" stroke="#9af0b4" strokeWidth="6" strokeLinecap="round" />
            <line x1={30 + chartPoint * 54} y1="22" x2={30 + chartPoint * 54} y2="138" stroke="rgba(255,255,255,.5)" strokeDasharray="5 6" />
            <circle cx={30 + chartPoint * 54} cy={chartPoint === 4 ? 50 : 68 - activeChart[1] * 6} r="9" fill="#9af0b4" stroke="#fff" strokeWidth="4" />
          </svg>
          <input className="chart-scrub" type="range" min="0" max={chartData.length - 1} value={chartPoint} onChange={(e) => setChartPoint(Number(e.target.value))} />
        </section>
      </div>
      <div className="segments">{["Pozisyonlar", "Emirler", "Geçmiş"].map((item) => <button className={segment === item ? "active" : ""} onClick={() => setSegment(item)} key={item}>{item}</button>)}</div>
      <SearchBox placeholder="İşlem ara" value={search} onChange={setSearch} /><h1 className="page-title lower">{segment}</h1>
      {segment === "Pozisyonlar" && shownPositions.map((item) => <button className="position-row" key={item.code} onClick={() => openTrade(item)}><StockLogo item={item} pale /><div className="stock-copy"><strong>{item.code}</strong><span>{item.name}</span><small>{item.lots}</small></div><div className="position-price"><strong>{mask(item.profit)}</strong><span>{mask(item.value)}</span></div><ChevronRight size={25} /></button>)}
      {segment === "Emirler" && <ListEmptyAware items={orders} empty="Henüz emir kaydı yok." render={(o) => <div className="admin-row" key={o.id}><span><strong>{o.symbol} · {o.side_label || o.side}</strong><small>{o.quantity} lot · {money(o.total)} · {o.status_label || o.status}</small></span></div>} />}
      {segment === "Geçmiş" && <ListEmptyAware items={transactions} empty="Henüz işlem geçmişi yok." render={(t, i) => <div className="admin-row" key={t.id || i}><span><strong>{t.type_label || t.event_type || "İşlem"}</strong><small>{money(t.amount || t.total || 0)} · {t.status_label || t.created_at || "Tamamlandı"}</small></span></div>} />}
    </main>
  );
}

function AccountScreen({ me, portfolio, openSubpage, logout, common }) {
  const [hidden, setHidden] = useState(false);
  const account = portfolio?.account || {};
  const posValue = (portfolio?.positions || []).reduce((sum, p) => sum + Number(p.market_value || 0), 0) || 164762.5;
  const cash = Number(account.cash_balance ?? 24200);
  const blocked = Number(account.blocked_balance ?? 0);
  const pending = Number(account.pending_balance ?? 24200);
  const mask = (v) => hidden ? "••••••" : v;
  const actions = [[ArrowDown, "Para yatır", "green"], [ArrowUp, "Para çek", "blue"], [CreditCard, "Banka hesaplarım", "purple"], [FileText, "İşlem geçmişi", "gray"]];
  const rows = [["Kişisel bilgiler", "Kimlik ve iletişim bilgilerinizi yönetin"], ["Güvenlik", "Şifre ve cihaz güvenliği"], ["Banka hesaplarım", "Para yatırma ve çekme işlemleri için hesaplarınız"], ["Sözleşmeler", "Çerçeve sözleşme, risk bildirimi ve bilgilendirme metinleri"]];
  return (
    <main className="screen scroll account-screen">
      <BrandHeader {...common} />
      <button className="profile-card" onClick={() => openSubpage("Kişisel bilgiler")}><div className="avatar">OT</div><div><h2>{me?.full_name || "İsim Soyisim"}</h2><p>Müşteri No: {me?.account_no || "12345678"}</p></div><ChevronRight /></button>
      <div className="label-row"><span>Finansal özet</span><button onClick={() => setHidden(!hidden)}>{hidden ? <EyeOff size={24} /> : <Eye size={24} />}</button></div>
      <section className="summary-card">{[["Kullanılabilir bakiye", money(cash), "purple"], ["Emirlerdeki bakiye", money(blocked), "orange"], ["Portföy değeri", money(posValue), ""], ["Toplam değer", money(cash + pending + posValue), ""]].map(([label, value, tone], i) => <div className="summary-line" key={label}><span>{i === 1 && <LockKeyhole size={19} />} {label}</span><strong className={tone}>{mask(value)}</strong></div>)}</section>
      <div className="quick-actions">{actions.map(([Icon, label, tone]) => <button key={label} onClick={() => openSubpage(label)}><span className={tone}><Icon size={30} /></span>{label}</button>)}</div>
      <h3 className="muted-heading">Hesap İşlemleri</h3>
      <section className="settings-card">{rows.map(([title, desc]) => <button className="settings-row" key={title} onClick={() => openSubpage(title)}><span><strong>{title}</strong><small>{desc}</small></span><ChevronRight /></button>)}</section>
      <h3 className="muted-heading">Diğer</h3>
      <section className="settings-card"><button className="settings-row" onClick={() => openSubpage("Bildirim ayarları")}><span><strong>Bildirim ayarları</strong><small>Fiyat, emir ve hesap bildirim tercihleri</small></span><ChevronRight /></button></section>
      <button className="logout-button" onClick={logout}>Çıkış Yap</button>
    </main>
  );
}

function ProfileMenu({ me, onClose, openSubpage, logout }) {
  const rows = [
    ["Referans Fırsatları", "Referansınız ile iletişime geçin", Users],
    ["Fotoğraf yükle", "Profil fotoğrafını güncelle", CircleUserRound],
    ["Güvenlik", "Şifre ve oturum ayarları", ShieldCheck],
    ["Uygulamayı yükle", "Android veya Apple için ana ekrana ekle", ArrowDown],
    ["Ayarlar", "Tema, yazı boyutu ve renk modu", Moon],
  ];
  return <div className="modal-layer"><section className="profile-menu-sheet"><button className="close" onClick={onClose}><X /></button><div className="profile-menu-head"><div className="avatar">İS</div><div><h2>{me?.full_name || "İsim Soyisim"}</h2><p>Müşteri No: {me?.account_no || "12345678"}</p><small>Bireysel Yatırım Hesabı</small></div></div>{rows.map(([title, desc, Icon]) => <button className="settings-row" key={title} onClick={() => { onClose(); openSubpage(title); }}><Icon /><span><strong>{title}</strong><small>{desc}</small></span><ChevronRight /></button>)}<button className="settings-row logout-row" onClick={logout}><ArrowUp /><span><strong>Çıkış Yap</strong><small>Güvenli çıkış</small></span></button></section></div>;
}

function TradeModal({ stock, onClose, refresh, favorites, toggleFavorite }) {
  const item = stock || stocks[0];
  const [amount, setAmount] = useState(0);
  const [side, setSide] = useState("buy");
  const [message, setMessage] = useState("");
  const price = Number(item.rawPrice || 412.5);
  const total = useMemo(() => amount * price, [amount, price]);
  const submitOrder = async () => {
    if (amount < 1) { setMessage("En az 1 lot gir."); return; }
    try {
      await api("/api/orders", { method: "POST", body: JSON.stringify({ symbol: item.code, side, order_type: "limit", quantity: Number(amount), limit_price: price }) });
      setMessage("Emir kaydedildi. Admin onayı bekliyor.");
      await refresh?.();
    } catch (error) {
      setMessage(error.message);
    }
  };
  return (
    <div className="modal-layer">
      <section className="trade-modal">
        <button className="close" onClick={onClose}><X size={34} /></button>
        <div className="trade-head"><StockLogo item={item} /><div><h2>{item.code} <button className="inline-star" onClick={() => toggleFavorite?.(item.code)}><Star size={25} fill={favorites?.has(item.code) ? "#7657ff" : "none"} /></button></h2><p>{item.name}</p><small><i /> Canlı fiyat</small></div><div className="trade-quote"><strong>{money(price)}</strong><span>{item.change || "-%0,78"}</span></div></div>
        <label className="field-label">Ürün Türü <Info size={18} /></label><button className="select-pill">Hisse <ChevronDown size={22} /></button>
        <div className="trade-stats"><span>Portföy<strong>250 lot</strong></span><span>Maliyet<strong>₺394,17</strong></span></div>
        <div className="order-type"><button>Piyasa</button><button className="active">Limit</button></div>
        <div className="warning">Piyasa kapalı (10:00-18:00). Sadece limit emir verebilirsin.</div>
        <div className="buy-sell"><button className={side === "buy" ? "buy" : ""} onClick={() => setSide("buy")}>Alış</button><button className={side === "sell" ? "sell" : ""} onClick={() => setSide("sell")}>Satış</button></div>
        <label className="field-label">Limit fiyat (₺)</label><div className="input-like">{price.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div className="dual-input"><label>Adet<input value={amount || ""} placeholder="0" onChange={(e) => setAmount(Number(e.target.value || 0))} /></label><label>Tutar (₺)<input value={total ? total.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""} placeholder="0,00" readOnly /></label></div>
        <div className="percent-row">{[25, 50, 75, 100].map((n) => <button onClick={() => setAmount(n)} key={n}>%{n}</button>)}<button className="text" onClick={() => setAmount(250)}>Tümü</button></div>
        <div className="range-line"><span>Oran</span><b>%{Math.min(100, Math.round((amount / 250) * 100)) || 0}</b><input type="range" min="0" max="250" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
        <div className="trade-capacity"><span>Kullanılabilir bakiye <strong>₺24.200,00</strong></span><span>Maks. 58 lot</span></div>
        <div className="profit-preview"><span><b>Net kâr / zarar</b><strong>+₺391,00</strong></span><span><b>K/Z Oranı</b><em>+4.97%</em></span></div>
        <div className="total-box"><span>Toplam</span><strong>{money(total)}</strong></div>
        {message && <div className="warning">{message}</div>}
        <button className={`confirm ${side === "sell" ? "danger" : ""}`} onClick={submitOrder}>{side === "buy" ? "Alış" : "Satış"} emri ver</button>
      </section>
    </div>
  );
}

function LandingPage({ openAuth }) {
  const [page, setPage] = useState("Ana sayfa");
  const nav = ["Ana sayfa", "Kurumsal", "Hizmetler", "Blog", "SSS", "Sözleşmeler", "İletişim"];
  const posts = ["BIST tarafında gün içi risk yönetimi", "Limit emir ve piyasa emri farkları", "T+2 bakiye yatırımcıya ne anlatır", "Temettü takvimini okuma rehberi"];
  const marketStrip = [["BIST 100", "13.892,40", "+0,51"], ["XU030", "14.467,25", "+0,37"], ["THYAO", "300,50", "+0,33"], ["ASELS", "381,25", "+1,21"]];
  const serviceCards = [
    [Landmark, "Borsa İstanbul", "BIST pay piyasasında canlı fiyatlarla hisse senedi alım satım işlemlerinizi güvenle yönetin."],
    [PieChart, "Yatırım Fonları", "Profesyonel yönetilen fon seçenekleriyle portföyünüzü çeşitlendirin ve yatırım hedeflerinizi takip edin."],
    [ArrowLeftRight, "Vadeli İşlemler", "VİOP vadeli ve opsiyon sözleşmelerini e-şube deneyimine uygun sade ekranlarla izleyin."],
    [Users, "Portföy Yönetimi", "Yatırım stratejinizi portföy, risk, kâr/zarar ve varlık dağılımı ekranlarıyla kontrol edin."],
  ];
  const numbers = [["4.166+", "aktif müşteri deneyimi"], ["₺2 Milyar", "yıllık işlem hacmi hedefi"], ["20+ Yıl", "piyasa deneyimi yaklaşımı"], ["99.8%", "platform erişilebilirliği hedefi"]];
  const why = ["Ücretsiz hesap açılışı ve hızlı e-şube başlangıcı", "Düşük komisyon, şeffaf ücret ve sade işlem ekranları", "Canlı piyasa verisi, haber akışı ve portföy takibi", "Kurumsal destek, uyum süreçleri ve güvenli operasyon altyapısı"];
  const testimonials = [
    ["Ahmet K.", "Ottoman Yatırım ile portföyümü daha kolay takip ediyor, işlem ekranlarını hızlı kullanabiliyorum."],
    ["Elif D.", "Analiz, haber ve portföy görünümü yatırım kararlarını daha bilinçli takip etmemi sağlıyor."],
    ["Mehmet S.", "Kurumsal yatırım ihtiyaçlarında şeffaf akış, destek ve işlem kontrolü önemli fark yaratıyor."],
  ];
  const partners = ["SPK", "Borsa İstanbul", "KAP", "TCMB", "Takasbank", "MKK"];
  const discover = [["Komisyon Oranları", "Rekabetçi ücretler"], ["Blog & Analiz", "Piyasa haberleri"], ["SSS", "Merak edilenler"], ["İletişim", "Bize ulaşın"]];
  const pageCopy = {
    Kurumsal: ["Güvenli yatırımın dijital adresi", "Ottoman Yatırım; müşteri kabul, risk profili, sözleşme, para hareketi ve emir onay süreçlerini tek merkezde yöneten kurumsal bir yatırım deneyimi sunar.", ["Lisanslı operasyon modeli", "KVKK ve risk bildirimi süreçleri", "Şeffaf müşteri ve emir takibi"]],
    Hizmetler: ["Yatırımcı hizmetleri", "Hisse al-sat, canlı piyasa, haber, portföy, para yatırma/çekme ve sözleşme yönetimi tek e-şube çatısı altında çalışır.", ["Canlı BIST ekranları", "Limit emir matematiği", "Admin onaylı para hareketleri"]],
    Blog: ["Piyasa okuryazarlığı", "Yatırımcıya sade, hızlı ve karar destekli içerikler sunan blog alanı.", posts],
    SSS: ["Sıkça sorulan sorular", "Hesap açılışı, para transferi, emir onayı ve sözleşme süreçleri hakkında kısa cevaplar.", ["Para yatırma ne zaman yansır?", "Emir neden onay bekler?", "Banka hesabımı nereden görürüm?"]],
    Sözleşmeler: ["Sözleşmeler ve formlar", "Çerçeve sözleşme, KVKK, risk bildirim formu ve e-şube kullanım koşulları yatırımcı panelinde tutulur.", ["KVKK Aydınlatma Metni", "Çerçeve Sözleşme", "Risk Bildirim Formu", "E-Şube Kullanım Koşulları"]],
    İletişim: ["Bize ulaşın", "Yatırımcı destek ekibi, operasyon ve müşteri temsilcisi kanalları tek iletişim merkezinde.", ["0850 000 00 00", "destek@ottomanyatirim.local", "İstanbul Finans Merkezi"]],
  };
  const content = pageCopy[page];
  return (
    <div className="landing">
      <header className="landing-nav"><div className="brand">Ottoman</div><nav>{nav.map((n) => <button className={page === n ? "active" : ""} key={n} onClick={() => setPage(n)}>{n}</button>)}</nav><button onClick={openAuth}>E-Şube Giriş</button></header>
      {page === "Ana sayfa" ? <>
        <section className="landing-hero"><div className="hero-copy"><span>Güvenli Yatırımın Adresi</span><h1>Ottoman Yatırım ile borsa, fon ve vadeli işlemlerde güvenle yatırım yapın.</h1><p>Ottoman Yatırım; Borsa İstanbul, yatırım fonları, vadeli işlemler ve portföy yönetimi süreçlerini dijital e-şube deneyimiyle yatırımcıya sunar.</p><div className="hero-actions"><button onClick={openAuth}>Hemen Başla</button><button className="secondary" onClick={() => setPage("Kurumsal")}>Kayıt Ol</button></div></div><div className="hero-terminal"><div className="terminal-top"><b>BIST 100</b><span>Canlı</span></div><strong>13.892,40</strong><small>+0,51% · Piyasa kapalıyken limit emir</small><div className="terminal-chart"><i /><i /><i /><i /><i /></div><div className="terminal-grid">{marketStrip.map(([code, value, change]) => <div key={code}><span>{code}</span><b>{value}</b><em>+%{change}</em></div>)}</div></div></section>
        <section className="landing-ticker">{marketStrip.concat(marketStrip).map(([code, value, change], index) => <div key={`${code}-${index}`}><b>{code}</b><span>{value}</span><em>+%{change}</em></div>)}</section>
        <section className="landing-section landing-services-deep"><div className="landing-section-head"><span>Hizmetlerimiz</span><h2>Yatırım Hizmetlerimiz</h2><p>Ottoman Yatırım olarak geniş ürün yelpazemizle yatırım hedeflerinize ulaşmanız için dijital e-şube çözümleri sunuyoruz.</p></div><div className="landing-cards landing-cards-inner">{serviceCards.map(([Icon, title, text]) => <article key={title}><Icon /><h3>{title}</h3><p>{text}</p><button>Detaylı bilgi</button></article>)}</div><button className="landing-more">Tüm hizmetlerimizi görüntüleyin</button></section>
        <section className="landing-stats"><div><span>Rakamlarla Ottoman Yatırım</span><h2>Güçlü dijital altyapı, ölçülebilir yatırım deneyimi.</h2></div><div className="stat-grid">{numbers.map(([value, label]) => <article key={value}><strong>{value}</strong><p>{label}</p></article>)}</div></section>
        <section className="landing-why"><div className="landing-section-head"><span>Neden Ottoman Yatırım?</span><h2>Yatırımcılar neden Ottoman Yatırım’ı tercih ediyor?</h2></div><div className="why-list">{why.map((item, index) => <article key={item}><b>{String(index + 1).padStart(2, "0")}</b><p>{item}</p></article>)}</div><button className="landing-more" onClick={openAuth}>Ücretsiz Hesap Aç</button></section>
        <section className="landing-testimonials"><div className="landing-section-head"><span>Müşterilerimiz Ne Diyor?</span><h2>Ottoman Yatırım müşterilerinin deneyimleri.</h2></div><div>{testimonials.map(([role, text]) => <article key={role}><p>“{text}”</p><strong>{role}</strong><small>Bireysel Yatırımcı</small></article>)}</div></section>
        <section className="landing-regulators"><div><span>Düzenleyici Kurumlar & İş Ortakları</span><h2>Resmi kaynaklar ve piyasa altyapısıyla uyumlu dijital yatırım akışı.</h2><p>Ottoman Yatırım; piyasa verisi, haber, sözleşme ve operasyon ekranlarında düzenli, anlaşılır ve kurumsal bir deneyim sunar.</p></div><div>{partners.map((item) => <article key={item}><CheckCircle2 /><strong>{item}</strong></article>)}</div></section>
        <section className="landing-discovery"><div><span>Ottoman Yatırım’ı Keşfedin</span><h2>Daha fazla bilgi için sayfalarımızı ziyaret edin.</h2><div className="discover-grid">{discover.map(([title, desc]) => <article key={title}><strong>{title}</strong><small>{desc}</small></article>)}</div></div><button onClick={openAuth}>E-Şube Giriş</button></section>
        <section className="landing-cta"><span>Yatırım Yolculuğunuza Bugün Başlayın</span><h2>Ottoman Yatırım ile ücretsiz hesap açın, borsa, yatırım fonları ve vadeli işlemleri tek ekrandan takip edin.</h2><p>Canlı fiyat, portföy, haber, para transferi ve işlem ekranlarıyla dijital yatırım deneyimini hemen başlatın.</p><button onClick={openAuth}>Ücretsiz Hesap Aç</button></section>
      </> : <section className="landing-page"><span>{page}</span><h1>{content[0]}</h1><p>{content[1]}</p><div className="landing-cards compact">{content[2].map((item) => <article key={item}><h3>{item}</h3><p>Detaylar Ottoman arayüzüne uyarlanmış kurumsal sayfa yapısında gösterilir.</p></article>)}</div></section>}
      <footer className="landing-footer">
        <div><strong>Ottoman Yatırım</strong><p>Güvenilir, yenilikçi ve dijital yatırım çözümleri.</p></div>
        <div><h3>Hızlı Erişim</h3><button onClick={() => setPage("Hizmetler")}>Hizmetlerimiz</button><button onClick={() => setPage("Blog")}>Blog & Analiz</button><button onClick={() => setPage("SSS")}>SSS</button></div>
        <div><h3>Hizmetlerimiz</h3><p>Borsa İstanbul</p><p>Yatırım Fonları</p><p>Vadeli İşlemler</p><p>Portföy Yönetimi</p></div>
        <div><h3>İletişim</h3><p>İstanbul Finans Merkezi</p><p>0850 000 00 00</p><p>destek@ottomanyatirim.local</p><button onClick={openAuth}>E-Şube Giriş</button></div>
      </footer>
    </div>
  );
}

function AuthScreen({ onAuthed, back }) {
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === "login") {
        await api("/api/login", { method: "POST", body: JSON.stringify(form) });
      } else {
        const fd = new FormData(event.currentTarget);
        fd.append("agreements_version", "2026-09");
        await api("/api/register", { method: "POST", body: fd });
        setMode("login");
        setMessage("Başvurun alındı. Admin onayından sonra giriş yapabilirsin.");
        return;
      }
      onAuthed(await api("/api/me"));
    } catch (error) {
      setMessage(error.message);
    }
  };
  return (
    <div className="stage auth-stage"><div className="phone auth-phone"><main className="screen scroll auth-screen">
      <button className="ghost-back" onClick={back}>Ana sayfa</button>
      <div className="auth-logo brand">Ottoman</div>
      <section className="auth-card">
        <h1>{mode === "login" ? "E-Şube Giriş" : "Müşteri Ol"}</h1>
        <p>Portföy, emir, T+2 bakiye, para yatırma/çekme ve canlı piyasa işlemleri tek güvenli oturumda.</p>
        <div className="segments"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Giriş</button><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Kayıt</button></div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <><input name="full_name" placeholder="Ad Soyad" required /><input name="phone" placeholder="Telefon" required /><input name="email" type="email" placeholder="E-posta (opsiyonel)" /><input name="city" placeholder="Şehir" defaultValue="İstanbul" /></>}
          <input name="tc" inputMode="numeric" maxLength="11" placeholder="T.C. kimlik / müşteri no" required />
          <input name="password" type="password" placeholder="Şifre" required />
          {mode === "register" && <><input name="password_confirm" type="password" placeholder="Şifre tekrar" required /><input type="hidden" name="accept_kvkk" value="1" /><input type="hidden" name="accept_distance_contract" value="1" /><input type="hidden" name="accept_risk_disclosure" value="1" /><input type="hidden" name="risk_experience" value="2" /><input type="hidden" name="risk_horizon" value="2" /><input type="hidden" name="risk_loss" value="2" /><input type="hidden" name="risk_income" value="2" /><input type="hidden" name="trade_frequency" value="2" /><input type="hidden" name="knowledge_level" value="2" /><label className="checkline"><input name="agreements" value="1" type="checkbox" required /> KVKK, risk bildirimi ve e-şube sözleşmelerini kabul ediyorum.</label></>}
          {message && <div className="warning">{message}</div>}
          <button className="confirm">{mode === "login" ? "Giriş Yap" : "Başvuruyu Oluştur"}</button>
        </form>
      </section>
    </main><div className="home-indicator" /></div></div>
  );
}

function AdminPanel({ data, refresh, logout }) {
  const [tab, setTab] = useState("Özet");
  const [selectedUser, setSelectedUser] = useState(null);
  const summary = data?.summary || {};
  const users = data?.users || [];
  const orders = data?.orders || [];
  const moneyReqs = data?.money_requests || [];
  const reports = data?.reports || {};
  const marketMeta = data?.market_meta || {};
  const newsMeta = data?.news_meta || {};
  const exposure = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const pendingMoney = moneyReqs.filter((m) => m.status === "pending").reduce((sum, m) => sum + Number(m.amount || 0), 0);
  const approvedUsers = users.filter((u) => u.status === "approved").length;
  const pendingUsers = users.filter((u) => u.status !== "approved").length;
  const rejectedOrders = orders.filter((o) => o.status === "rejected").length;
  const approvedOrders = orders.filter((o) => o.status === "approved").length;
  const act = async (path, verb) => {
    const reason = verb === "reject" ? prompt("Ret nedeni") || "Admin ret" : "Admin onayı";
    const password = prompt("Admin şifrenizi tekrar girin");
    if (!password) return;
    await api("/api/admin/step-up", { method: "POST", body: JSON.stringify({ password }) });
    await api(path, { method: "POST", body: JSON.stringify({ reason }) });
    await refresh();
  };
  const setUserBalance = async (user) => {
    const input = document.getElementById(`balance-${user.id}`);
    const amount = Number(String(input?.value || "").replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) return alert("Geçerli ana bakiye gir.");
    const password = prompt("Admin şifrenizi tekrar girin");
    if (!password) return;
    await api("/api/admin/step-up", { method: "POST", body: JSON.stringify({ password }) });
    await api("/api/admin/balances", { method: "POST", body: JSON.stringify({ user_id: user.id, action: "set", amount, note: "Admin doğrudan ana bakiye düzeltme" }) });
    await refresh();
    setSelectedUser((old) => old ? { ...old, cash_balance: amount } : old);
  };
  return (
    <div className="stage admin-stage"><div className="phone admin-phone"><main className="screen scroll admin-screen">
      <BrandHeader showAvatar={false} />
      <div className="section-title"><h2>Admin Paneli</h2><button onClick={logout}>Çıkış</button></div>
      <div className="segments admin-tabs">{["Özet", "Müşteriler", "Emirler", "Para", "Risk", "Sistem", "Raporlar"].map((x) => <button className={tab === x ? "active" : ""} onClick={() => setTab(x)} key={x}>{x}</button>)}</div>
      <div className="admin-grid">
        <article><span>Kullanıcı</span><strong>{summary.users_total ?? users.length}</strong></article>
        <article><span>Bekleyen Emir</span><strong>{summary.orders_pending ?? orders.filter((o) => o.status === "pending").length}</strong></article>
        <article><span>Para Talebi</span><strong>{money(pendingMoney)}</strong></article>
        <article><span>Toplam Emir Hacmi</span><strong>{money(exposure)}</strong></article>
      </div>
      <LiveDataStrip marketMeta={marketMeta} newsMeta={newsMeta} />
      {tab === "Özet" && <><section className="admin-command"><div><span>Operasyon Masası</span><h1>Tam yetkili kontrol merkezi</h1><p>Müşteri, emir, para, risk, sözleşme, haber, piyasa ve sistem kontrolleri tek ekranda izlenir.</p></div><div className="pulse-orbit"><b>LIVE</b></div></section><section className="admin-control-wall">{[["Onaylı müşteri", approvedUsers], ["Onay bekleyen", pendingUsers], ["Onaylı emir", approvedOrders], ["Reddedilen emir", rejectedOrders], ["Haber sayısı", newsMeta.count || 0], ["Piyasa sembolü", marketMeta.symbol_count || 0]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>Canlı panel metriği</small></article>)}</section></>}
      {["Özet", "Emirler"].includes(tab) && <><h2 className="solo-title">Emir Kontrol</h2>{orders.slice(0, 20).map((o) => <div className="admin-row" key={o.id}><span><strong>{o.symbol} {o.side_label || o.side}</strong><small>{o.full_name} · {o.quantity} lot · {money(o.total)} · {o.status_label || o.status}</small></span>{o.status === "pending" && <b><button onClick={() => act(`/api/admin/orders/${o.id}/approve`, "approve")}>Onay</button><button onClick={() => act(`/api/admin/orders/${o.id}/reject`, "reject")}>Ret</button></b>}</div>)}</>}
      {["Özet", "Müşteriler"].includes(tab) && <><h2 className="solo-title">Müşteriler</h2>{users.slice(0, 20).map((u) => <div className="admin-row admin-user-row" key={u.id} onClick={() => setSelectedUser(u)}><span><strong>{u.full_name}</strong><small>{u.status_label || u.status} · {u.email} · {u.account_no} · {u.phone || "telefon yok"}</small></span>{u.status !== "approved" && <b><button onClick={(e) => { e.stopPropagation(); act(`/api/admin/users/${u.id}/approve`, "approve"); }}>Onay</button></b>}</div>)}</>}
      {["Özet", "Para"].includes(tab) && <><h2 className="solo-title">Para Talepleri</h2>{moneyReqs.slice(0, 20).map((m) => <div className="admin-row" key={m.id}><span><strong>{m.type_label || m.request_type}</strong><small>{m.full_name} · {money(m.amount)} · {m.status_label || m.status}</small></span>{m.status === "pending" && <b><button onClick={() => act(`/api/admin/money/${m.id}/approve`, "approve")}>Onay</button><button onClick={() => act(`/api/admin/money/${m.id}/reject`, "reject")}>Ret</button></b>}</div>)}</>}
      {tab === "Risk" && <section className="admin-matrix">{[["Risk skoru", "İzleniyor", `${pendingUsers} kullanıcı onay/uyum kuyruğunda`], ["KYC/KVKK", "Aktif", "Sözleşme ve kimlik statüsü kullanıcı kartında"], ["Sözleşmeler", "Kayıtlı", "KVKK, risk bildirimi ve e-şube kabulü"], ["Limit aşımı", money(exposure), "Toplam emir hacmi"], ["Şüpheli işlem", pendingMoney ? "İncele" : "Temiz", `${money(pendingMoney)} bekleyen para talebi`], ["Oturum sağlığı", "Step-up", "Kritik admin işlemlerinde şifre doğrulama"]].map(([x, state, detail]) => <article key={x}><span>{x}</span><strong>{state}</strong><small>{detail}</small></article>)}</section>}
      {tab === "Sistem" && <section className="settings-card report-card">{[["Piyasa veri akışı", `${marketMeta.ok === false ? "Yedekli" : "Çalışıyor"} · ${marketMeta.source || "trrealapi-market"}`], ["Haber servisi", `${newsMeta.ok === false ? "Yedekli" : "Çalışıyor"} · ${newsMeta.count || 0} haber`], ["Emir motoru", `${orders.length} emir · canlı fiyat doğrulama`], ["Para hareketleri", `${moneyReqs.length} talep · ${money(pendingMoney)} bekleyen`], ["Admin step-up", "Kritik işlem öncesi parola doğrulama"], ["Audit log", `${reports.audit?.length || 0} son kayıt görünür`]].map(([x, detail]) => <button className="settings-row" key={x}><span><strong>{x}</strong><small>{detail}</small></span><CheckCircle2 /></button>)}<button className="settings-row"><span><strong>T+2 sistemi</strong><small>Varsayılan kapalı · satış sonrası admin isterse açar</small></span><Moon /></button></section>}
      {tab === "Raporlar" && <section className="settings-card report-card">{[["Risk ve Uyum", `Kullanıcı statüleri: ${(reports.users || []).length} grup`], ["Operasyon", `Bekleyen emir ${orders.filter((o) => o.status === "pending").length} · para talebi ${moneyReqs.filter((m) => m.status === "pending").length}`], ["Müşteri 360", `Bakiye, emir, para, sözleşme, güvenlik ve işlem geçmişi`], ["Mutabakat", `Nakit ${money(reports.reconciliation?.cash || summary.cash_total || 0)} · Bloke ${money(reports.reconciliation?.blocked || summary.blocked_total || 0)}`]].map(([title, detail]) => <button className="settings-row" key={title}><span><strong>{title}</strong><small>{detail}</small></span><CheckCircle2 /></button>)}</section>}
      {selectedUser && <div className="modal-layer"><section className="trade-modal readable-modal admin-profile"><button className="close" onClick={() => setSelectedUser(null)}><X /></button><h2>{selectedUser.full_name}</h2><p className="subtle-count">{selectedUser.account_no} · {selectedUser.status_label || selectedUser.status}</p><div className="admin-matrix mini">{["Ana Bakiye", "Alış", "Satış", "İşlem", "KVKK", "Risk"].map((x, i) => <article key={x}><span>{x}</span><strong>{[money(selectedUser.cash_balance || 0), selectedUser.buy_count || 0, selectedUser.sell_count || 0, selectedUser.transaction_count || 0, "Kabul", "Orta"][i]}</strong></article>)}</div><h3 className="muted-heading">Ana bakiye düzeltme</h3><div className="admin-balance-edit"><input id={`balance-${selectedUser.id}`} placeholder="Yeni ana bakiye" inputMode="decimal" defaultValue={Number(selectedUser.cash_balance || 0).toFixed(2)} /><button onClick={() => setUserBalance(selectedUser)}>Bakiyeyi Düzelt</button></div><h3 className="muted-heading">İşlem geçmişi</h3><div className="settings-card"><div className="settings-row"><span><strong>Toplam emir</strong><small>{selectedUser.order_count || 0} adet · Alış {selectedUser.buy_count || 0} · Satış {selectedUser.sell_count || 0}</small></span></div><div className="settings-row"><span><strong>Son hareket</strong><small>{selectedUser.transaction_count || 0} işlem kaydı · {money(selectedUser.cash_balance || 0)} bakiye</small></span></div><div className="settings-row"><span><strong>KYC / Sözleşme</strong><small>{selectedUser.kyc_status_label || selectedUser.kyc_status || "Onaylandı"} · Tam</small></span></div></div><button className="confirm" onClick={() => setSelectedUser(null)}>Kapat</button></section></div>}
    </main><div className="home-indicator" /></div></div>
  );
}

function Subpage({ title, onClose, refresh, me, portfolio }) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const type = title === "Para çek" ? "withdraw" : "deposit";
  const balance = money(portfolio?.account?.cash_balance ?? 24200);
  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = { request_type: type, amount: Number(amount), note: title };
      if (type === "withdraw") Object.assign(payload, { account_holder: me?.full_name || "İsim Soyisim", bank_name: "Ottoman Bank", iban: "TR330006100519786457841326" });
      await api("/api/money-requests", { method: "POST", body: JSON.stringify(payload) });
      setMessage(`${title} talebin alındı.`);
      await refresh?.();
    } catch (error) { setMessage(error.message); }
  };
  const history = [...(portfolio?.transactions || []), ...(portfolio?.money_requests || [])];
  return <div className="modal-layer"><section className="trade-modal readable-modal account-sheet"><div className="sheet-handle" /><button className="close" onClick={onClose}><X /></button><h2>{title}</h2>
    {["Para yatır", "Para çek"].includes(title) && <form className="auth-form money-sheet-form" onSubmit={submit}><p className="subtle-count">Bakiye · {balance}</p><label className="amount-entry"><span>₺</span><input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" type="number" required /></label><button className="confirm">{title}</button></form>}
    {title === "Banka hesaplarım" && <div className="bank-empty"><p>Tanımlı banka hesabı bulunmuyor.</p><button className="confirm" onClick={onClose}>Tamam</button></div>}
    {title === "İşlem geçmişi" && <ListEmptyAware items={history} empty="Henüz işlem yok." render={(t, i) => <div className="admin-row" key={t.id || i}><span><strong>{t.type_label || t.event_type || "İşlem"}</strong><small>{money(t.amount || t.total || 0)} · {t.status_label || t.created_at || "Tamamlandı"}</small></span></div>} />}
    {title === "Kişisel bilgiler" && <div className="settings-card"><div className="settings-row"><span><strong>Cep Telefonu</strong><small>{me?.phone || "+90 5-- -- --"}</small></span><ChevronRight /></div><div className="settings-row"><span><strong>E-posta</strong><small>{me?.email || "E-posta yok"}</small></span><ChevronRight /></div><div className="settings-row"><span><strong>Adres</strong><small>{me?.address || "Kayıtlı adres bulunmuyor"}</small></span><ChevronRight /></div><div className="settings-row"><span><strong>İl / İlçe</strong><small>{me?.city || "İstanbul"} / {me?.district || "Merkez"}</small></span><ChevronRight /></div><div className="settings-row"><span><strong>Tebligat Tercihi</strong><small>E-posta</small></span><CheckCircle2 /></div></div>}
    {title === "Güvenlik" && <div className="settings-card"><button className="settings-row"><span><strong>Şifre Değiştir</strong><small>Son değiştirme bilgisi ve parola yenileme</small></span><ChevronRight /></button><button className="settings-row"><span><strong>İşlem Onayı</strong><small>Para çekme ve kritik işlemlerde doğrulama</small></span><CheckCircle2 /></button><button className="settings-row"><span><strong>Güvenilir Cihazlar</strong><small>Bu oturuma bağlı cihazları görüntüle</small></span><ChevronRight /></button><button className="settings-row"><span><strong>Aktif Oturumlar</strong><small>1 aktif oturum</small></span><ChevronRight /></button></div>}
    {title === "Sözleşmeler" && <div className="settings-card">{["KVKK Aydınlatma Metni", "Çerçeve Sözleşme", "Risk Bildirim Formu", "E-Şube Kullanım Koşulları"].map((x) => <button className="settings-row" key={x}><span><strong>{x}</strong><small>Görüntüle ve kabul durumunu incele</small></span><FileText /></button>)}</div>}
    {title === "Bildirim ayarları" && <div className="settings-card">{["Tüm Bildirimler", "Fiyat Bildirimleri", "Haber Bildirimleri", "İşlem Bildirimleri", "Referans bildirimi"].map((x) => <button className="settings-row" key={x}><span><strong>{x}</strong><small>Açık</small></span><CheckCircle2 /></button>)}</div>}
    {title === "Referans Fırsatları" && <div className="bank-empty"><p>Referans fırsatları için referansınız ile iletişime geçiniz.</p><button className="confirm" onClick={onClose}>Tamam</button></div>}
    {title === "Fotoğraf yükle" && <div className="settings-card"><button className="settings-row"><span><strong>Profil fotoğrafı seç</strong><small>JPG veya PNG yükleyebilirsin.</small></span><CircleUserRound /></button></div>}
    {title === "Uygulamayı yükle" && <div className="settings-card"><button className="settings-row"><span><strong>Android</strong><small>Ana ekrana ekle ve uygulama gibi kullan.</small></span><ArrowDown /></button><button className="settings-row"><span><strong>Apple</strong><small>Safari paylaş menüsünden ana ekrana ekle.</small></span><ArrowDown /></button></div>}
    {title === "Ayarlar" && <div className="settings-card"><button className="settings-row"><span><strong>Tema</strong><small>Açık / Koyu</small></span><Moon /></button><button className="settings-row"><span><strong>Yazı boyutu</strong><small>Orta</small></span><ChevronRight /></button><button className="settings-row"><span><strong>Renk modu</strong><small>Mavi</small></span><ChevronRight /></button></div>}
    {message && <div className="warning">{message}</div>}
  </section></div>;
}

function Notifications({ onClose }) {
  return <div className="modal-layer"><section className="trade-modal readable-modal notifications-sheet"><button className="close" onClick={onClose}><X /></button><h2>Bildirimler</h2><div className="notice-empty"><Bell size={44} /><p>Henüz yeni bir bildirimin yok.</p></div></section></div>;
}

function Nav({ active, setActive }) {
  const items = [["home", "Ana Sayfa", Home], ["news", "Haberler", Newspaper], ["trade", "Al/Sat", ArrowLeftRight], ["portfolio", "Portföy", PieChart], ["account", "Hesap", CircleUserRound]];
  return <nav className="bottom-nav">{items.map(([id, label, Icon]) => <button className={`${active === id ? "active" : ""} ${id === "trade" ? "trade-tab" : ""}`} key={id} onClick={() => setActive(id)}><Icon size={id === "trade" ? 34 : 31} /><span>{label}</span></button>)}</nav>;
}

function App() {
  const [active, setActive] = useState("home");
  const [authOpen, setAuthOpen] = useState(false);
  const [trade, setTrade] = useState(null);
  const [subpage, setSubpage] = useState(null);
  const [notify, setNotify] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  const [dark, setDark] = useState(false);
  const [favorites, setFavorites] = useState(() => new Set(["TUPRS", "ASELS"]));
  const [me, setMe] = useState(null);
  const [market, setMarket] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  const [marketMeta, setMarketMeta] = useState({});
  const [newsMeta, setNewsMeta] = useState({});
  const [portfolio, setPortfolio] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const normalizeUser = (data) => data?.user || (data?.id ? data : null);
  const openTrade = (stock) => setTrade(stock || stocks[0]);
  const toggleFavorite = (code) => setFavorites((old) => {
    const next = new Set(old);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });
  const common = { onNotify: () => setNotify(true), dark, toggleDark: () => setDark((v) => !v), openProfile: () => setProfileMenu(true), me };
  const loadCore = async () => {
    const [m, n] = await Promise.allSettled([api("/api/market"), api("/api/news")]);
    if (m.status === "fulfilled") {
      setMarket((m.value.quotes || m.value.market || []).map(quoteToStock));
      setMarketMeta({ ...(m.value.meta || {}), source: m.value.source, symbol_count: (m.value.quotes || []).length, updated_at: m.value.updated_at });
    }
    if (n.status === "fulfilled") {
      setNewsItems(n.value.items || n.value.news || []);
      setNewsMeta({ ...(n.value.meta || {}), count: (n.value.items || n.value.news || []).length });
    }
  };
  const loadPortfolio = async () => {
    if (!me || me.role === "admin") return;
    const p = await api("/api/portfolio").catch(() => null);
    if (p) setPortfolio(p);
  };
  const loadAdmin = async () => {
    if (!me || me.role !== "admin") return;
    const [summary, users, orders, moneyData, reports] = await Promise.all([api("/api/admin/summary"), api("/api/admin/users"), api("/api/admin/orders"), api("/api/admin/money"), api("/api/admin/reports").catch(() => ({}))]);
    setAdminData({ ...(summary || {}), users: users.users || [], orders: orders.orders || [], money_requests: moneyData.money_requests || [], reports, market_meta: marketMeta, news_meta: newsMeta });
  };
  const refresh = async () => { await loadCore(); await loadPortfolio(); await loadAdmin(); };
  const logout = async () => {
    await api("/api/logout", { method: "POST", body: "{}" }).catch(() => {});
    setMe(null); setAdminData(null); setPortfolio(null); setAuthOpen(false);
  };
  useEffect(() => {
    loadCore();
    api("/api/me").then((data) => setMe(normalizeUser(data))).catch(() => setMe(null));
    const timer = setInterval(loadCore, 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { loadPortfolio(); loadAdmin(); }, [me]);
  if (!me && !authOpen) return <LandingPage openAuth={() => setAuthOpen(true)} />;
  if (!me) return <AuthScreen onAuthed={(data) => setMe(normalizeUser(data))} back={() => setAuthOpen(false)} />;
  if (me.role === "admin") return <AdminPanel data={{ ...(adminData || {}), market_meta: marketMeta, news_meta: newsMeta }} refresh={loadAdmin} logout={logout} />;
  return <div className={`stage app-stage ${dark ? "dark-mode" : ""}`}><div className="phone">
    {active === "home" && <HomeScreen openTrade={openTrade} market={market} favorites={favorites} toggleFavorite={toggleFavorite} common={common} />}
    {active === "news" && <NewsScreen items={newsItems} common={common} />}
    {active === "trade" && <TradeScreen market={market} openTrade={openTrade} favorites={favorites} toggleFavorite={toggleFavorite} common={common} />}
    {active === "portfolio" && <PortfolioScreen openTrade={openTrade} portfolio={portfolio} common={common} />}
    {active === "account" && <AccountScreen me={me} portfolio={portfolio} openSubpage={setSubpage} logout={logout} common={common} />}
    <Nav active={active} setActive={setActive} />{trade && <TradeModal stock={trade} onClose={() => setTrade(null)} refresh={refresh} favorites={favorites} toggleFavorite={toggleFavorite} />}{subpage && <Subpage title={subpage} onClose={() => setSubpage(null)} refresh={refresh} me={me} portfolio={portfolio} />}{notify && <Notifications onClose={() => setNotify(false)} />}{profileMenu && <ProfileMenu me={me} onClose={() => setProfileMenu(false)} openSubpage={setSubpage} logout={logout} />}<div className="home-indicator" /></div></div>;
}

createRoot(document.getElementById("app")).render(<App />);
