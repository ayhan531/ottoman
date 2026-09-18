// E-Şube kabuğu — MainPage.xaml.cs (Navigate / BuildNavigation / BrandBar / Overlay) karşılığı.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { Symbol, SearchBox, Sheet, Dialog, Divided, Overlay } from "./ui.jsx";
import Home, { InstrumentRow } from "./Home.jsx";
import News, { Article } from "./News.jsx";
import Portfolio from "./Portfolio.jsx";
import Account from "./Account.jsx";
import { TradeHeader, TradePanel, ReviewOrder, OrderResult, QuickTrade } from "./Trade.jsx";
import {
  Settings, Security, TwoFactorPage, PasswordPage, Personal, Contact, NotifySettings, ContractsList, DocumentPage,
  SCALE_VALUES, ACCENT_NAMES, LANG_NAMES, NOTIFY_KEYS, PRIVACY,
} from "./Subpages.jsx";
import { api, usePref, useMarket, useNews, usePortfolio, useNotifications, useHoldings, readPref, writePref } from "./store.js";
import { listFor, search, money, monogram as monogramOf, BIST, TRADABLE_MARKETS, MARKET_NAMES, parseAmount } from "./market.js";
import { T, setLangIndex, LANG_CODES } from "./lang.js";

export const APP_VERSION = "1.6.3";

// APK'da kimlik bilgileri maskeli görünür: "1•• ••• ••• 46".
const maskTc = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 11 ? `${digits[0]}•• ••• ••• ${digits.slice(-2)}` : "1•• ••• ••• ••";
};

const NAV = [
  { title: "Ana Sayfa", icon: "home" },
  { title: "Haberler", icon: "news" },
  { title: "Al/Sat", icon: "trade" },
  { title: "Portföy", icon: "portfolio" },
  { title: "Hesap", icon: "user" },
];

export default function App({ me, onLogout, onAdmin, onExit, refreshMe }) {
  /* ---- tercihler ---- */
  const [dark, setDark] = usePref("dark", () => window.matchMedia?.("(prefers-color-scheme: dark)").matches || false);
  const [accent, setAccent] = usePref("accent", 0);
  const [textSize, setTextSize] = usePref("textSize", 1);
  const [lang, setLang] = usePref("lang", 0);
  const [dataMode, setDataMode] = usePref("dataMode", 0);
  const [watchlist, setWatchlist] = usePref("watchlist", ["TUPRS", "THYAO", "ASELS"]);
  const [confirmOn, setConfirmOn] = usePref("confirm", true);
  const [twoFactor, setTwoFactor] = usePref("twofactor", true);
  const [twoFactorMethod, setTwoFactorMethod] = usePref("twofactor-method", 0);
  const [noticeChannel, setNoticeChannel] = usePref("notice-channel", 0);

  // Dil, çizimden önce kurulur ki T() bu turda doğru karşılığı versin.
  setLangIndex(lang);

  useEffect(() => {
    document.documentElement.lang = LANG_CODES[lang] || "tr";
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.accent = String(accent);
    root.style.setProperty("--s", String(SCALE_VALUES[Math.min(2, Math.max(0, textSize))]));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#171922" : "#ffffff");
  }, [dark, accent, textSize]);

  /* ---- veri ---- */
  const [marketTab, setMarketTab] = useState(0);
  const market = useMarket();
  const newsFeed = useNews(marketTab);
  const portfolio = usePortfolio(true);
  const notifications = useNotifications(true);
  const holdings = useHoldings(portfolio.data, market.instruments);

  const [history, setHistory] = useState([]);
  const [series, setSeries] = useState({});
  const [historyState, setHistoryState] = useState("loading");
  const loadHistory = useCallback(async () => {
    try {
      const data = await api("/api/portfolio/history");
      setHistory(data.history || []);
      setSeries(data.series || {});
      setHistoryState("live");
    } catch {
      setHistoryState("failed");
    }
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const [security, setSecurity] = useState({ sessions: [] });
  const loadSecurity = useCallback(async () => {
    try { setSecurity(await api("/api/profile/security")); } catch { /* yoksay */ }
  }, []);

  /* ---- gezinme ---- */
  const [tab, setTab] = useState(0);
  const [portfolioTab, setPortfolioTab] = useState(0);
  const [portfolioCard, setPortfolioCard] = useState(0);
  const [portfolioHidden, setPortfolioHidden] = useState(false);
  const [returnTo, setReturnTo] = useState(0);
  const [article, setArticle] = useState(null);
  const [document_, setDocument_] = useState(null);
  const body = useRef(null);

  const go = (next, from) => {
    if (from !== undefined) setReturnTo(from);
    setTab(next);
    body.current?.scrollTo({ top: 0 });
  };

  /* ---- katmanlar ---- */
  const [overlay, setOverlay] = useState(null); // {kind, ...}
  const [notice, setNotice] = useState(null);
  const [tradeKind, setTradeKind] = useState(0);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [orderResult, setOrderResult] = useState(null);

  const showNotice = (title, text) => setNotice({ title: T(title), text: T(text) });

  /* ---- profil fotoğrafı ---- */
  const avatarInput = useRef(null);
  const pickAvatar = () => avatarInput.current?.click();
  const uploadAvatar = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { showNotice("Profil fotoğrafı", "Yalnızca görsel dosyası yükleyebilirsin."); return; }
    const form = new FormData();
    form.append("avatar", file);
    try {
      await api("/api/profile/avatar", { method: "POST", body: form });
      await refreshMe?.();
    } catch (error) {
      showNotice("Profil fotoğrafı", error.message || "Fotoğraf yüklenemedi.");
    }
  };

  const instrumentByCode = useMemo(() => new Map(market.instruments.map((item) => [item.code, item])), [market.instruments]);
  const holdingByCode = useMemo(() => new Map(holdings.map((item) => [item.symbol, item])), [holdings]);

  /** Piyasa kaydını, varsa portföy pozisyonuyla birleştirir (DemoAccount.EnsureHolding). */
  const asStock = useCallback((item) => {
    if (!item) return null;
    const held = holdingByCode.get(item.code || item.symbol);
    return {
      ...item,
      symbol: item.symbol || item.code,
      code: item.code || item.symbol,
      quantity: held?.quantity || 0,
      avgCost: held?.avgCost || 0,
    };
  }, [holdingByCode]);

  const [lastStock, setLastStock] = useState(null);
  const openTrade = (item, { sheet = false, buying = true, searchable = false } = {}) => {
    const stock = asStock(item);
    if (!stock) return;
    setLastStock(stock);
    setOverlay({ kind: "trade", stock, sheet, buying, searchable });
  };

  const account = portfolio.data?.account || null;
  const orders = portfolio.data?.orders?.filter((order) => order.status === "pending") || [];
  const transactions = portfolio.data?.transactions || [];
  const bankAccounts = portfolio.data?.system_bank_accounts || [];
  const stockValue = holdings.reduce((sum, item) => sum + item.value, 0);
  const cash = Number(account?.cash_balance || 0);
  const blocked = Number(account?.blocked_balance || 0);
  const available = Math.max(0, cash - blocked);
  const monogram = monogramOf(me?.full_name || "İsim Soyisim");

  const toggleWatch = (code) =>
    setWatchlist((list) => (list.includes(code) ? list.filter((item) => item !== code) : [...list, code]));

  /* ---- üst şerit ---- */
  const brandBar = (
    <div className="brandbar">
      <button className="ava" onClick={() => setOverlay({ kind: "profile" })} aria-label={T("Profil")}>
        {me?.avatar_url ? <img src={me.avatar_url} alt="" /> : monogram}
      </button>
      <div className="brand-word">Ottoman</div>
      <div className="brandbar-actions">
        {me?.role === "admin" && (
          <button className="icon-btn lav" onClick={onAdmin} title="Admin"><Icon name="shield" size={20} /></button>
        )}
        <button className="icon-btn" onClick={() => { setOverlay({ kind: "notifications" }); notifications.markRead(); }} aria-label={T("Bildirimler")}>
          <Icon name="bell" size={21} />
          {notifications.unread > 0 && <i className="dot" />}
        </button>
        <button className="icon-btn" onClick={() => setDark(!dark)} aria-label={T("Tema")}>
          <Icon name={dark ? "sun" : "moon"} size={21} />
        </button>
      </div>
    </div>
  );

  /* ---- ekranlar ---- */
  const screen = (() => {
    switch (tab) {
      case 1:
        return (
          <News
            brandBar={brandBar}
            marketTab={marketTab}
            setMarketTab={setMarketTab}
            items={newsFeed.items}
            state={newsFeed.state}
            onOpen={(item) => { setArticle(item); go(14, 1); }}
          />
        );
      case 3:
        return (
          <Portfolio
            brand={<div className="brand-word">Ottoman</div>}
            holdings={holdings}
            account={account}
            orders={orders}
            transactions={transactions}
            instruments={market.instruments}
            history={history}
            series={series}
            historyState={historyState}
            onRetryHistory={loadHistory}
            tab={portfolioTab}
            setTab={setPortfolioTab}
            card={portfolioCard}
            setCard={setPortfolioCard}
            hidden={portfolioHidden}
            setHidden={setPortfolioHidden}
            openPosition={(item) => openTrade(item, { sheet: true, buying: false })}
            onCancelOrder={async (order) => {
              try { await api(`/api/orders/${order.id}/cancel`, { method: "POST", body: "{}" }); } catch (error) { showNotice("Emir iptali", error.message); }
              portfolio.reload();
            }}
            onCreateOrder={() => openTrade(lastStock || listFor(BIST, market.instruments)[0], { searchable: true })}
          />
        );
      case 4:
        return (
          <Account
            brandBar={brandBar}
            me={me}
            account={account}
            stockValue={stockValue}
            monogram={monogram}
            version={APP_VERSION}
            onOpenPersonal={() => go(11, 4)}
            onOpenSecurity={() => { loadSecurity(); go(8, 4); }}
            onOpenContracts={() => go(6, 4)}
            onOpenNotifySettings={() => go(13, 4)}
            onTransfer={(deposit) => setOverlay({ kind: "transfer", deposit })}
            onHistory={() => { setPortfolioTab(2); go(3); }}
            onPortfolio={() => go(3)}
            onBankAccounts={() => setOverlay({ kind: "banks" })}
            onNotice={showNotice}
          />
        );
      case 5:
        return (
          <Settings
            onBack={() => go(returnTo)}
            monogram={monogram}
            onProfile={() => setOverlay({ kind: "profile" })}
            dark={dark} setDark={setDark}
            textSize={textSize} setTextSize={setTextSize}
            accent={accent} setAccent={setAccent}
            lang={lang} setLang={setLang}
            dataMode={dataMode} setDataMode={setDataMode}
            onNotify={() => go(13, 5)}
            onSecurity={() => { loadSecurity(); go(8, 5); }}
            onContracts={() => go(6, 5)}
            onPrivacy={() => { setDocument_(PRIVACY); go(7, 5); }}
            version={APP_VERSION}
          />
        );
      case 6:
        return <ContractsList onBack={() => go(returnTo)} onOpen={(item) => { setDocument_(item); go(7, 6); }} />;
      case 7:
        return <DocumentPage document={document_} onBack={() => go(returnTo)} />;
      case 8:
        return (
          <Security
            onBack={() => go(returnTo)}
            onPassword={() => go(9, 8)}
            onTwoFactor={() => go(10, 8)}
            twoFactor={twoFactor}
            twoFactorMethod={twoFactorMethod}
            sessions={security.sessions || []}
            passwordChangedAt={security.password_changed_at}
            confirmOn={confirmOn}
            setConfirmOn={setConfirmOn}
            onRevoke={async (id) => {
              try { await api("/api/profile/sessions/revoke", { method: "POST", body: JSON.stringify({ session_id: id }) }); loadSecurity(); }
              catch (error) { showNotice("Oturum", error.message); }
            }}
          />
        );
      case 9:
        return (
          <PasswordPage
            onBack={() => go(8)}
            onSubmit={async (current, next) => {
              await api("/api/profile/password", { method: "POST", body: JSON.stringify({ current_password: current, new_password: next, new_password_confirm: next }) });
              go(8);
              showNotice("Şifre değiştirildi", "Yeni şifren kaydedildi; sonraki girişte onu kullan.");
            }}
          />
        );
      case 10:
        return (
          <TwoFactorPage
            onBack={() => go(8)}
            twoFactor={twoFactor}
            twoFactorMethod={twoFactorMethod}
            confirmOn={confirmOn}
            phone={me?.phone}
            onSave={(enabled, method, confirm) => {
              setTwoFactor(enabled);
              setTwoFactorMethod(method);
              setConfirmOn(confirm);
              go(8);
              showNotice("Kaydedildi", "Doğrulama tercihlerin güncellendi.");
            }}
          />
        );
      case 11:
        return (
          <Personal
            onBack={() => go(returnTo)}
            me={me}
            monogram={monogram}
            onAvatar={pickAvatar}
            onContact={() => go(12, 11)}
            onIdentity={() => setOverlay({ kind: "identity" })}
          />
        );
      case 12:
        return <Contact onBack={() => go(11)} me={me} onNotice={showNotice} channel={noticeChannel} setChannel={setNoticeChannel} />;
      case 13:
        return <NotifyHost onBack={() => go(returnTo)} onSaved={() => { go(returnTo); showNotice("Kaydedildi", "Bildirim tercihlerin güncellendi."); }} />;
      case 14:
        return <Article item={article || {}} onBack={() => go(1)} />;
      default:
        return (
          <Home
            brandBar={brandBar}
            marketTab={marketTab}
            setMarketTab={setMarketTab}
            instruments={market.instruments}
            state={market.state}
            watchlist={watchlist}
            openTrade={(item) => {
              if (!TRADABLE_MARKETS.has(marketTab)) {
                showNotice(MARKET_NAMES[marketTab], "Bu ürün grubunda işlem e-şube üzerinden yapılmıyor. Referansınız ile iletişime geçiniz.");
                return;
              }
              openTrade(item);
            }}
            onNotice={showNotice}
            onAllStocks={() => setOverlay({ kind: "picker" })}
          />
        );
    }
  })();

  const navActive = (index) =>
    tab === index || (tab === 14 ? index === 1 : tab >= 5 && index === 4);

  const navigate = (index) => {
    if (index === 2) {
      openTrade(lastStock || listFor(BIST, market.instruments)[0], { searchable: true });
      return;
    }
    go(index);
  };

  return (
    <div className="esube">
      <nav className="sidebar">
        <div className="brandmark">Ottoman</div>
        {NAV.map((item, index) => (
          <button key={item.title} className={index === 2 ? "trade-cta" : navActive(index) ? "active" : ""} onClick={() => navigate(index)}>
            <Icon name={item.icon} size={20} />
            {T(item.title)}
          </button>
        ))}
      </nav>

      <div className="esube-main">
        <div className="esube-body" ref={body}>{screen}</div>
        <nav className="navbar">
          {NAV.map((item, index) => (
            <button key={item.title} className={navActive(index) ? "active" : ""} onClick={() => navigate(index)}>
              {index === 2
                ? <span className="nav-center"><Icon name="trade" size={20} /></span>
                : <span className="nav-icon"><Icon name={item.icon} size={20} /></span>}
              <span>{T(item.title)}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Profil fotoğrafı seçici: kimlik dairesinden ve Kişisel Bilgiler'den açılır. */}
      <input
        ref={avatarInput}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(event) => { uploadAvatar(event.target.files?.[0]); event.target.value = ""; }}
      />

      {/* ---- katmanlar ---- */}

      {overlay?.kind === "profile" && (
        <ProfileMenu
          me={me}
          monogram={monogram}
          onAvatar={pickAvatar}
          onClose={() => setOverlay(null)}
          onSecurity={() => { setOverlay(null); loadSecurity(); go(8, tab); }}
          onSettings={() => { setOverlay(null); go(5, tab); }}
          onReferral={() => { setOverlay(null); showNotice("Referans Fırsatları", "Referansınız ile iletişime geçiniz."); }}
          onInstall={() => { setOverlay(null); setOverlay({ kind: "install" }); }}
          onLogout={onLogout}
        />
      )}

      {overlay?.kind === "notifications" && (
        <NotificationsCard items={notifications.items} onClose={() => setOverlay(null)} />
      )}

      {overlay?.kind === "install" && (
        <Sheet title={T("Uygulamayı yükle")} onClose={() => setOverlay(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ fontSize: "calc(13.5px * var(--s))", color: "var(--muted)" }}>
              {T("Ottoman E-Şube'yi telefonunun ana ekranına ekleyerek uygulama gibi kullanabilirsin.")}
            </span>
            <div className="sec-card">
              <Divided>
                <div className="sec-row">
                  <span className="disc"><Icon name="android" size={20} /></span>
                  <span className="copy"><strong>Android</strong><span>{T("Chrome menüsü → “Ana ekrana ekle”")}</span></span>
                  <span /><span />
                </div>
                <div className="sec-row">
                  <span className="disc"><Icon name="apple" size={20} /></span>
                  <span className="copy"><strong>{T("iPhone / iPad")}</strong><span>{T("Safari paylaş → “Ana Ekrana Ekle”")}</span></span>
                  <span /><span />
                </div>
              </Divided>
            </div>
            <button className="btn" onClick={() => setOverlay(null)}>{T("Tamam")}</button>
          </div>
        </Sheet>
      )}

      {overlay?.kind === "identity" && (
        <Sheet title={T("Kimlik Bilgileri")} onClose={() => setOverlay(null)}>
          <Divided>
            <ValueRow label={T("Ad Soyad")} value={me?.full_name || "—"} />
            <ValueRow label={T("T.C. Kimlik No")} value={maskTc(me?.tc)} />
            <ValueRow label={T("Doğum Tarihi")} value={me?.birth_date || "••.••.••••"} />
            <ValueRow label={T("Müşteri No")} value={me?.account_no || "—"} />
          </Divided>
        </Sheet>
      )}

      {overlay?.kind === "banks" && (
        <Sheet title={T("Banka hesaplarım")} onClose={() => setOverlay(null)}>
          {bankAccounts.length ? (
            <Divided>
              {bankAccounts.map((bank) => (
                <div className="info-row" key={bank.id}>
                  <span className="copy"><strong>{bank.bank_name}</strong><span>{bank.iban}</span></span>
                  <span /><span />
                </div>
              ))}
            </Divided>
          ) : (
            <span style={{ fontSize: "calc(14px * var(--s))", color: "var(--muted)" }}>{T("Tanımlı banka hesabı bulunmuyor.")}</span>
          )}
        </Sheet>
      )}

      {overlay?.kind === "picker" && (
        <StockPicker
          instruments={market.instruments}
          marketTab={marketTab}
          watchlist={watchlist}
          onClose={() => setOverlay(null)}
          onPick={(item) => { setOverlay(null); openTrade(item); }}
        />
      )}

      {overlay?.kind === "transfer" && (
        <TransferSheet
          deposit={overlay.deposit}
          available={available}
          bankAccounts={bankAccounts}
          onClose={() => setOverlay(null)}
          onDone={(message) => { setOverlay(null); portfolio.reload(); showNotice("İşlem tamamlandı", message); }}
        />
      )}

      {overlay?.kind === "trade" && !pendingOrder && !orderResult && (
        <QuickTrade
          asSheet={overlay.sheet}
          onClose={() => setOverlay(null)}
          header={
            <TradeHeader
              stock={overlay.stock}
              onClose={() => setOverlay(null)}
              watched={watchlist.includes(overlay.stock.code)}
              onToggleWatch={() => toggleWatch(overlay.stock.code)}
              updatedAt={market.meta?.updated_at ? market.meta.updated_at * 1000 : null}
            />
          }
        >
          <TradePanel
            stock={overlay.stock}
            buying={overlay.buying}
            sheet={overlay.sheet}
            searchable={overlay.searchable}
            instruments={market.instruments}
            cash={available}
            availableLots={holdingByCode.get(overlay.stock.code)?.quantity || 0}
            watchlist={watchlist}
            tradeKind={tradeKind}
            setTradeKind={setTradeKind}
            onToggleWatch={() => toggleWatch(overlay.stock.code)}
            onPickStock={(item) => openTrade(item, { sheet: overlay.sheet, searchable: overlay.searchable, buying: overlay.buying })}
            onClose={() => setOverlay(null)}
            onNotice={showNotice}
            onSubmitted={(order) => setPendingOrder(order)}
          />
        </QuickTrade>
      )}

      {pendingOrder && (
        <ReviewOrder
          order={pendingOrder}
          onCancel={() => { setPendingOrder(null); setOverlay(null); }}
          onConfirmed={() => {
            const done = pendingOrder;
            setPendingOrder(null);
            setOverlay(null);
            setOrderResult(done);
            portfolio.reload();
            loadHistory();
          }}
        />
      )}

      {orderResult && (
        <OrderResult
          order={orderResult}
          onClose={() => setOrderResult(null)}
          onHistory={() => { setOrderResult(null); setPortfolioTab(2); go(3); }}
          onOrders={() => { setOrderResult(null); setPortfolioTab(1); go(3); }}
        />
      )}

      {notice && (
        <Sheet title={notice.title} onClose={() => setNotice(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <span style={{ fontSize: "calc(15px * var(--s))", color: "var(--muted)" }}>{notice.text}</span>
            <button className="btn" onClick={() => setNotice(null)}>{T("Tamam")}</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ---------- yardımcı bileşenler ---------- */

const ValueRow = ({ label, value }) => (
  <div className="rowline" style={{ padding: "13px 0" }}>
    <span style={{ fontSize: "calc(14.5px * var(--s))", color: "var(--muted)" }}>{label}</span>
    <span style={{ fontSize: "calc(14.5px * var(--s))", fontWeight: 700 }}>{value}</span>
  </div>
);

function ProfileMenu({ me, monogram, onClose, onSecurity, onSettings, onLogout, onReferral, onInstall, onAvatar }) {
  return (
    <Overlay onClose={onClose}>
      <div className="popcard" style={{ top: 56, left: 16 }}>
        <i className="arrow" style={{ top: -6, left: 28 }} />
        <div className="pop-profile">
          {/* Daireye dokununca profil fotoğrafı seçilir. */}
          <button className="ava n50 lav avatar-edit" onClick={onAvatar} aria-label={T("Profil fotoğrafı")}>
            {me?.avatar_url ? <img src={me.avatar_url} alt="" /> : monogram}
            <i className="pen"><Icon name="plus" size={12} /></i>
          </button>
          <span className="who">
            <strong>{me?.full_name || "İsim Soyisim"}</strong>
            <span>{T("Müşteri No:")} {me?.account_no || "—"}</span>
            <small>{T("Bireysel Yatırım Hesabı")}</small>
          </span>
        </div>
        <div className="hline" />
        <div className="menu">
          <Divided>
            <button className="menu-row" onClick={onReferral}><Icon name="gift" size={20} />{T("Referans Fırsatları")}</button>
            <button className="menu-row" onClick={onSecurity}><Icon name="shield" size={20} />{T("Güvenlik")}</button>
            <button className="menu-row" onClick={onInstall}><Icon name="download" size={20} />{T("Uygulamayı yükle")}</button>
            <button className="menu-row" onClick={onSettings}><Icon name="gear" size={20} />{T("Ayarlar")}</button>
          </Divided>
        </div>
        <button className="foot" onClick={onLogout}><Icon name="logout" size={20} />{T("Çıkış Yap")}</button>
      </div>
    </Overlay>
  );
}

function NotificationsCard({ items, onClose }) {
  return (
    <Overlay onClose={onClose}>
      <div className="popcard" style={{ top: 56, right: 16 }}>
        <i className="arrow" style={{ top: -6, right: 68 }} />
        <div className="popcard-head"><h2>{T("Bildirimler")}</h2></div>
        <div className="hline" />
        {items.length ? (
          <div className="notify-list">
            <Divided>
              {items.map((item) => (
                <div className="notify-item" key={item.id}>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                  <small>{item.created_at_label || ""}</small>
                </div>
              ))}
            </Divided>
          </div>
        ) : (
          <div className="notify-empty">
            <span className="disc"><Icon name="bell" size={22} /></span>
            <p>{T("Henüz yeni bir bildirimin yok.")}</p>
          </div>
        )}
      </div>
    </Overlay>
  );
}

function StockPicker({ instruments, marketTab, watchlist, onClose, onPick }) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => listFor(marketTab, instruments), [marketTab, instruments]);
  const shown = query.trim()
    ? search(query, list, 20)
    : watchlist.map((code) => list.find((item) => item.code === code)).filter(Boolean);
  return (
    <Sheet title={T("Hisse seç")} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SearchBox placeholder={T("Hisse adı veya sembol")} value={query} onChange={setQuery} />
        {shown.length ? (
          <Divided>{shown.map((item) => <InstrumentRow key={item.code} item={item} onClick={() => onPick(item)} />)}</Divided>
        ) : (
          <span style={{ fontSize: "calc(13px * var(--s))", color: "var(--muted)" }}>{T("Sonuç bulunamadı.")}</span>
        )}
      </div>
    </Sheet>
  );
}

function TransferSheet({ deposit, available, bankAccounts, onClose, onDone }) {
  const [amountText, setAmountText] = useState("");
  const [holder, setHolder] = useState("");
  const [bank, setBank] = useState("");
  const [iban, setIban] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = parseAmount(amountText);
    if (!Number.isFinite(value) || value <= 0) { setError(T("Geçerli bir tutar gir.")); return; }
    setBusy(true);
    setError("");
    try {
      const payload = deposit
        ? { request_type: "deposit", amount: value, account_ref: bankAccounts[0]?.iban || "" }
        : { request_type: "withdraw", amount: value, account_holder: holder, bank_name: bank, iban };
      await api("/api/money-requests", { method: "POST", body: JSON.stringify(payload) });
      onDone(deposit ? "Para yatırma talebin alındı." : "Para çekme talebin alındı.");
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={T(deposit ? "Para yatır" : "Para çek")} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span style={{ fontSize: "calc(14px * var(--s))", color: "var(--muted)" }}>Bakiye · {money(available)}</span>
        <div className="card" style={{ background: "var(--soft)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "calc(23px * var(--s))", fontWeight: 700, color: "var(--purple)" }}>₺</span>
          <input
            inputMode="decimal"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            placeholder="0,00"
            style={{ fontSize: "calc(25px * var(--s))", width: "100%" }}
          />
        </div>
        {deposit ? (
          bankAccounts[0] && (
            <div className="sec-card" style={{ padding: "2px 14px" }}>
              <div className="info-row">
                <span className="copy"><strong>{bankAccounts[0].bank_name}</strong><span>{bankAccounts[0].iban}</span></span>
                <span /><span />
              </div>
            </div>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="field"><label>{T("Hesap sahibi")}</label><div className="box"><input value={holder} onChange={(event) => setHolder(event.target.value)} placeholder={T("Ad Soyad")} style={{ height: 42, width: "100%", fontSize: "calc(15px * var(--s))" }} /></div></div>
            <div className="field"><label>{T("Banka")}</label><div className="box"><input value={bank} onChange={(event) => setBank(event.target.value)} placeholder={T("Banka adı")} style={{ height: 42, width: "100%", fontSize: "calc(15px * var(--s))" }} /></div></div>
            <div className="field"><label>IBAN</label><div className="box"><input value={iban} onChange={(event) => setIban(event.target.value)} placeholder="TR.." style={{ height: 42, width: "100%", fontSize: "calc(15px * var(--s))" }} /></div></div>
          </div>
        )}
        {error && <span className="trade-error">{error}</span>}
        <button className="btn" disabled={busy} onClick={submit}>{T(deposit ? "Para yatır" : "Para çek")}</button>
      </div>
    </Sheet>
  );
}

function NotifyHost({ onBack, onSaved }) {
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(NOTIFY_KEYS.map((key) => [key, readPref(key, key !== "notify-referral")]))
  );
  const [quiet, setQuiet] = useState(() => readPref("notify-quiet", 1));
  const [weekly, setWeekly] = useState(() => readPref("notify-weekly", 1));
  return (
    <NotifySettings
      onBack={onBack}
      draft={draft}
      setDraft={setDraft}
      quiet={quiet}
      setQuiet={setQuiet}
      weekly={weekly}
      setWeekly={setWeekly}
      onSave={() => {
        Object.entries(draft).forEach(([key, value]) => writePref(key, value));
        writePref("notify-quiet", quiet);
        writePref("notify-weekly", weekly);
        onSaved();
      }}
    />
  );
}
