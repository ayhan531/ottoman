// E-Şube kabuğu — MainPage.xaml.cs (Navigate / BuildNavigation / BrandBar / Overlay) karşılığı.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { Symbol, SearchBox, Sheet, Dialog, Divided, Overlay, LazyList } from "./ui.jsx";
import Home, { InstrumentRow } from "./Home.jsx";
import News, { Article } from "./News.jsx";
import Portfolio from "./Portfolio.jsx";
import Account from "./Account.jsx";
import { TradeHeader, TradePanel, ReviewOrder, OrderResult, QuickTrade } from "./Trade.jsx";
import {
  Settings, Security, TwoFactorPage, PasswordPage, Personal, Contact, NotifySettings, ContractsList, DocumentPage,
  SCALE_VALUES, ACCENT_NAMES, LANG_NAMES, NOTIFY_KEYS, PRIVACY,
} from "./Subpages.jsx";
import { api, usePref, useMarket, useNews, usePortfolio, useNotifications, useMoneyRequests, useHoldings, readPref, writePref } from "./store.js";
import { savedAccounts, forgetAccount, setPendingTc } from "./accounts.js";
import { useGeriTusu } from "./geri.js";
import { canInstall, onInstallChange, promptInstall, isStandalone, isApple, iosBrowser, iosToolbarAtBottom, uygulamaIciTarayici, tarayicidaAc, kurulumSemasi, adresiKopyala, kurulumAdresi, kurulumIstendi, pushState, enablePush, disablePush, syncPushPrefs } from "./pwa.js";
import { listFor, search, money, monogram as monogramOf, BIST, TRADABLE_MARKETS, MARKET_NAMES, MARKET_CONTACT_TEXT, IPO, FUNDS, PARTICIPATION, parseAmount, group } from "./market.js";
import { T, setLangIndex, LANG_CODES } from "./lang.js";

export const APP_VERSION = "1.6.3";

/** Bağlantı durumu; çevrimdışıyken kullanıcıya şerit gösterilir. */
function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const ac = () => setOnline(true);
    const kapat = () => setOnline(false);
    window.addEventListener("online", ac);
    window.addEventListener("offline", kapat);
    return () => {
      window.removeEventListener("online", ac);
      window.removeEventListener("offline", kapat);
    };
  }, []);
  return online;
}

/** Kimlik doğrulama belgesi yükleme: kimliğin ön yüzü ve arka yüzü - hesabın
 * onaylanması ve para yatır/çek işlemlerinin açılması için gönderilir (bkz.
 * backend api_upload_documents). Her biri bağımsız yüklenir. */
const KYC_DOC_LABELS = { identity_front: "Kimlik Ön Yüz", identity_back: "Kimlik Arka Yüz" };

function KycUpload({ documents, onNotice, onUploaded }) {
  const [busyType, setBusyType] = useState("");

  const latest = useMemo(() => {
    const map = {};
    for (const doc of documents || []) {
      const current = map[doc.doc_type];
      if (!current || Number(doc.id) > Number(current.id)) map[doc.doc_type] = doc;
    }
    return map;
  }, [documents]);

  const allApproved = Object.keys(KYC_DOC_LABELS).every((type) => latest[type]?.status === "approved");

  // Her belge bağımsız yüklenir: ön yüzü şimdi, arka yüzü daha sonra
  // gönderebilirsin - Fuzul referansındaki gibi her belgenin kendi durumu olur.
  const uploadOne = async (type, file) => {
    if (!file) return;
    setBusyType(type);
    try {
      const form = new FormData();
      form.append(type, file);
      await api("/api/profile/documents", { method: "POST", body: form });
      onNotice?.(T("Kimlik Doğrulama"), T("{label} onaya gönderildi.").replace("{label}", T(KYC_DOC_LABELS[type])));
      await onUploaded?.();
    } catch (error) {
      onNotice?.(T("Kimlik Doğrulama"), error.message || T("Belge yüklenemedi."));
    } finally {
      setBusyType("");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.4 }}>
        {T("Hesabını onaylatmak ve para yatırma/çekme işlemlerini açmak için kimliğinin ön yüzünü ve arka yüzünü yükle. Her belgeyi ayrı ayrı, istediğin sırayla yükleyebilirsin.")}
      </p>
      <div className="card outline list-card">
        <Divided>
          {Object.entries(KYC_DOC_LABELS).map(([type, label]) => {
            const doc = latest[type];
            const statusText = doc ? (doc.status_label || doc.status) : (busyType === type ? T("Yükleniyor…") : T("Bekleniyor"));
            const uploaded = Boolean(doc);
            return (
              <div className="settings-row" key={type}>
                <span>
                  <strong>{label}</strong>
                  <small className={uploaded ? "kyc-uploaded" : ""}>{statusText}</small>
                </span>
                <label className="ac-ghost" style={{ cursor: "pointer", padding: "8px 14px", borderRadius: 10, border: "1px solid var(--edge)" }}>
                  {busyType === type ? T("Yükleniyor…") : uploaded ? T("Yeniden yükle") : T("Yükle")}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={Boolean(busyType)}
                    style={{ display: "none" }}
                    onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; uploadOne(type, file); }}
                  />
                </label>
              </div>
            );
          })}
        </Divided>
      </div>
      {allApproved && (
        <div className="warning" style={{ color: "var(--ink-green, #159578)", background: "var(--tint-green, #e1f8ed)" }}>
          {T("Kimlik doğrulaman onaylandı.")}
        </div>
      )}
    </div>
  );
}

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
  const [accent, setAccent] = usePref("accent", 1);   // varsayılan renk modu: Mavi
  const [textSize, setTextSize] = usePref("textSize", 1);
  const [lang, setLang] = usePref("lang", 0);
  const [dataMode, setDataMode] = usePref("dataMode", 0);
  const [watchlist, setWatchlist] = usePref("watchlist", ["TUPRS", "THYAO", "ASELS"]);
  const [confirmOn, setConfirmOn] = usePref("confirm", true);
  const [twoFactor, setTwoFactor] = usePref("twofactor", true);
  const [twoFactorMethod, setTwoFactorMethod] = usePref("twofactor-method", 1);
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
  const moneyRequests = useMoneyRequests(true);
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

  // Cihazda kayıtlı hesaplar; geçiş yaparken şifre yeniden istenir.
  const [accounts, setAccounts] = useState(() => savedAccounts());
  useEffect(() => { setAccounts(savedAccounts()); }, [me?.account_no]);
  const switchAccount = useCallback((tc) => {
    setPendingTc(tc);
    onLogout?.();
  }, [onLogout]);

  // Bildirim türü anahtarları kapalıysa o kayıtlar listede görünmez.
  const visibleNotifications = useMemo(() => {
    const allow = {
      price: readPref("notify-price", true),
      news: readPref("notify-news", true),
      trade: readPref("notify-trade", true),
      referral: readPref("notify-referral", false),
    };
    return (notifications.items || []).filter((item) => {
      const category = String(item.category || "");
      if (category === "referral") return allow.referral;
      if (category === "fiyat" || category === "price") return allow.price;
      if (category === "haber" || category === "news") return allow.news;
      if (category === "islem" || category === "trade" || category === "emir") return allow.trade;
      return true;
    });
  }, [notifications.items]);

  // Otomatik öneri: uygulama kurulu değilse kurulum rehberi, kuruluysa bildirim izni.
  // iOS'ta izin isteği kullanıcı dokunuşu gerektirdiği için düğmeli bir ekranla sorulur.
  useEffect(() => {
    const zaman = setTimeout(async () => {
      if (isStandalone()) {
        if (readPref("push-asked", false) === true) return;
        const durum = await pushState();
        if (durum !== "kapali") return;
        setOverlay((mevcut) => mevcut || { kind: "push-prompt" });
        return;
      }
      // Bağlantıya "?kur=1" ile gelindi: kullanıcı kurulmak üzere buraya
      // yönlendirildi, ipucu sayacına bakmadan kurulum ekranı açılır.
      if (kurulumIstendi()) {
        setOverlay((mevcut) => mevcut || { kind: "install" });
        return;
      }
      if (readPref("install-hint", false) === true) return;
      if (!canInstall() && !isApple() && !uygulamaIciTarayici()) return;
      writePref("install-hint", true);
      setOverlay((mevcut) => mevcut || { kind: "install" });
    }, kurulumIstendi() ? 400 : 2500);
    return () => clearTimeout(zaman);
  }, []);

  // Ana ekrana eklendiğinde tek seferlik bildirim.
  useEffect(() => {
    const onInstalled = () => {
      api("/api/notifications/event", { method: "POST", body: JSON.stringify({ kind: "installed" }) })
        .then(() => notifications.reload?.())
        .catch(() => { /* bildirim kritik değil */ });
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, [notifications]);

  const [security, setSecurity] = useState({ sessions: [] });
  const loadSecurity = useCallback(async () => {
    try { setSecurity(await api("/api/profile/security")); } catch { /* yoksay */ }
  }, []);

  /* ---- gezinme ---- */
  const online = useOnline();
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

  /* Geri tuşu: önce açık katmanı, sonra alt sayfayı, sonra ana sayfayı
     kapatır; siteden ancak ana sayfadayken çıkar. */
  const geriDerinlik = (overlay ? 1 : 0) + (tab !== 0 ? 1 : 0);
  useGeriTusu(geriDerinlik > 0, () => {
    if (overlay) { setOverlay(null); return; }
    if (tab !== 0) { go(returnTo && returnTo !== tab ? returnTo : 0); return; }
  });
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
  const REFERRAL_ONLY = {
    fund: ["Fon işlemleri", "Fon alış satışları için referansınız ile iletişime geçiniz."],
    ipo: ["Halka arz talebi", "Halka arz alış satışları için referansınız ile iletişime geçiniz."],
    currency: ["Döviz işlemleri", "Döviz alış satışları için referansınız ile iletişime geçiniz."],
    participation: ["Katılım hisse işlemleri", "Katılım hisse alış satışları için referansınız ile iletişime geçiniz."],
  };
  const openTrade = (item, { sheet = false, buying = true, searchable = false } = {}) => {
    const stock = asStock(item);
    if (!stock) return;
    // Fon, halka arz ve döviz için emir ekranı hiç açılmaz; yönlendirme notu çıkar.
    const blocked = REFERRAL_ONLY[stock.kind];
    if (blocked) { showNotice(blocked[0], blocked[1]); return; }
    setLastStock(stock);
    setOverlay({ kind: "trade", stock, sheet, buying, searchable });
  };

  const account = portfolio.data?.account || null;
  const orders = portfolio.data?.orders?.filter((order) => order.status === "pending") || [];
  const transactions = portfolio.data?.transactions || [];
  const bankAccounts = portfolio.data?.system_bank_accounts || [];
  const kycDocuments = portfolio.data?.documents || [];
  const kycApproved = Boolean(me?.is_test_user) || me?.status === "approved";
  const stockValue = holdings.reduce((sum, item) => sum + item.value, 0);
  const cash = Number(account?.cash_balance || 0);
  const legacyBlocked = Number(account?.blocked_balance || 0);
  const pendingWithdrawals = Number(account?.pending_withdrawals || 0);
  const available = Math.max(0, cash - legacyBlocked - pendingWithdrawals);
  const monogram = monogramOf(me?.full_name || "İsim Soyisim");

  const toggleWatch = (code) =>
    setWatchlist((list) => (list.includes(code) ? list.filter((item) => item !== code) : [...list, code]));

  /* ---- üst şerit ---- */
  const brandBar = (
    <div className="brandbar">
      <button className="ava" onClick={() => setOverlay({ kind: "profile" })} aria-label={T("Profil")}>
        {me?.avatar_url ? <img src={me.avatar_url} alt="" /> : monogram}
      </button>
      <div className="brand-word">Ottoman Yatırım</div>
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
            onOpenKyc={() => setOverlay({ kind: "kyc" })}
            kycApproved={kycApproved}
            moneyRequests={moneyRequests.items || []}
            onCancelMoneyRequest={async (item) => {
              try {
                await api(`/api/money-requests/${item.id}/cancel`, { method: "POST", body: "{}" });
                moneyRequests.reload();
                portfolio.reload();
              } catch (error) { showNotice(T("Talep iptali"), error.message); }
            }}
            onTransfer={(deposit) => {
              if (!kycApproved) { showNotice(T("Kimlik Doğrulaması Olmadan İşlem Yapılamaz"), T("Para yatırma ve çekme işlemleri için önce Hesap İşlemleri altındaki Kimlik Doğrulama adımını tamamla.")); return; }
              setOverlay({ kind: "transfer", deposit });
            }}
            onHistory={() => { setPortfolioTab(2); go(3); }}
            onPortfolio={() => go(3)}
            onBankAccounts={() => {
              if (!kycApproved) { showNotice(T("Kimlik Doğrulaması Olmadan İşlem Yapılamaz"), T("Banka hesaplarını yönetmek için önce Hesap İşlemleri altındaki Kimlik Doğrulama adımını tamamla.")); return; }
              setOverlay({ kind: "banks" });
            }}
            onNotice={showNotice}
            onLogout={onLogout}
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
            me={me}
            accounts={accounts}
            onSwitchAccount={switchAccount}
            onAddAccount={() => { setPendingTc(""); onLogout?.(); }}
            onRemoveAccount={(tc) => { forgetAccount(tc); setAccounts(savedAccounts()); }}
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
        return <NotifyHost onBack={() => go(returnTo)} onNotice={showNotice} onSaved={() => { go(returnTo); showNotice("Kaydedildi", "Bildirim tercihlerin güncellendi."); }} />;
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
            kycApproved={kycApproved}
            onOpenKyc={() => setOverlay({ kind: "kyc" })}
            openTrade={(item) => {
              if (!TRADABLE_MARKETS.has(marketTab)) {
                const kind = marketTab === FUNDS ? "fund" : marketTab === IPO ? "ipo" : marketTab === PARTICIPATION ? "participation" : "currency";
                showNotice(REFERRAL_ONLY[kind][0], REFERRAL_ONLY[kind][1]);
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
      {!online && (
        <div className="offline-bar" role="status">
          <Icon name="info" size={15} />
          {T("Çevrimdışısın · son bilinen veriler gösteriliyor")}
        </div>
      )}
      <nav className="sidebar">
        <div className="brandmark"><span>Ottoman Yatırım</span></div>
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
        <NotificationsCard items={visibleNotifications} onClose={() => setOverlay(null)} />
      )}

      {overlay?.kind === "install" && (
        <InstallSheet onClose={() => setOverlay(null)} onNotice={showNotice} />
      )}

      {overlay?.kind === "push-prompt" && (
        <PushPrompt
          onClose={() => { writePref("push-asked", true); setOverlay(null); }}
          onNotice={showNotice}
        />
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

      {overlay?.kind === "kyc" && (
        <Sheet title={T("Kimlik Doğrulama")} onClose={() => setOverlay(null)}>
          <KycUpload documents={kycDocuments} onNotice={showNotice} onUploaded={() => { portfolio.reload(); refreshMe?.(); }} />
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
          me={me}
          onClose={() => setOverlay(null)}
          onDone={(message) => { setOverlay(null); portfolio.reload(); moneyRequests.reload(); showNotice("İşlem tamamlandı", message); }}
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
            kycApproved={kycApproved}
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
          t2Enabled={Boolean(portfolio.data?.settlement_settings?.t2_enabled)}
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
  // Arama yazılmadan da tüm hisseler görünür; takiptekiler en üste alınır.
  const shown = useMemo(() => {
    if (query.trim()) return search(query, list, 40);
    const takipte = watchlist.map((code) => list.find((item) => item.code === code)).filter(Boolean);
    const kodlar = new Set(takipte.map((item) => item.code));
    return [...takipte, ...list.filter((item) => !kodlar.has(item.code))];
  }, [query, list, watchlist]);
  // Fon ve halka arz için liste hiç gösterilmez, referans yönlendirmesi çıkar.
  if (marketTab === IPO || marketTab === FUNDS) {
    return (
      <Sheet title={T(MARKET_NAMES[marketTab])} onClose={onClose}>
        <div className="picker-body">
          <div className="referral-note">
            <Icon name="headset" size={22} color="var(--muted)" />
            <span>{T(MARKET_CONTACT_TEXT[marketTab])}</span>
          </div>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title={T("Hisse Ara")} onClose={onClose}>
      <div className="picker-body">
        <SearchBox placeholder={T("Hisse kodu veya adı yazın…")} value={query} onChange={setQuery} />
        <span className="picker-count">{shown.length} {T("hisse")}</span>
        <div className="picker-list">
          {shown.length ? (
            <LazyList items={shown} render={(item) => <InstrumentRow key={item.code} item={item} onClick={() => onPick(item)} />} />
          ) : (
            <span style={{ fontSize: "calc(13px * var(--s))", color: "var(--muted)" }}>{T("Sonuç bulunamadı.")}</span>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** Panoya kopyalar; clipboard yoksa eski yöntemle dener. */
const panoyaKopyala = async (metin) => {
  try {
    await navigator.clipboard.writeText(metin);
    return true;
  } catch {
    try {
      const alan = document.createElement("textarea");
      alan.value = metin;
      alan.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(alan);
      alan.select();
      const oldu = document.execCommand("copy");
      alan.remove();
      return oldu;
    } catch {
      return false;
    }
  }
};

function KopyaSatiri({ label, value, vurgu }) {
  const [kopyalandi, setKopyalandi] = useState(false);
  if (!value) return null;
  const kopyala = async () => {
    if (await panoyaKopyala(value)) {
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 1600);
    }
  };
  return (
    <div className={vurgu ? "bank-line accent" : "bank-line"}>
      <span className="bank-copy">
        <label>{label}</label>
        <strong>{value}</strong>
      </span>
      <button className="bank-copy-btn" onClick={kopyala} aria-label={T("Kopyala")}>
        <Icon name={kopyalandi ? "check" : "copy"} size={17} />
      </button>
    </div>
  );
}

function TransferSheet({ deposit, available, bankAccounts, me, onClose, onDone }) {
  const [amountText, setAmountText] = useState("");
  const [holder, setHolder] = useState(me?.full_name || "");
  const [bank, setBank] = useState("");
  const [iban, setIban] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const aktifHesaplar = (bankAccounts || []).filter((hesap) => Number(hesap.is_active ?? 1) === 1);

  const submit = async () => {
    const value = parseAmount(amountText);
    if (!Number.isFinite(value) || value <= 0) { setError(T("Geçerli bir tutar gir.")); return; }
    if (!deposit) {
      if (!holder.trim()) { setError(T("Hesap adını gir.")); return; }
      if (!bank.trim()) { setError(T("Banka adını gir.")); return; }
      if (iban.replace(/\s/g, "").length < 26) { setError(T("Geçerli bir IBAN gir.")); return; }
      if (value > available) { setError(T("Çekilebilir bakiyeden fazla tutar girdin.")); return; }
    }
    setBusy(true);
    setError("");
    try {
      const payload = deposit
        ? { request_type: "deposit", amount: value, account_ref: aktifHesaplar[0]?.iban || "" }
        : { request_type: "withdraw", amount: value, account_holder: holder.trim(), bank_name: bank.trim(), iban: iban.replace(/\s/g, "") };
      await api("/api/money-requests", { method: "POST", body: JSON.stringify(payload) });
      onDone(deposit ? "Para yatırma bildirimin alındı." : "Para çekme talebin alındı.");
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={T(deposit ? "TL Yükle" : "TL Çek")} onClose={onClose}>
      <div className="tl-sheet">
        {deposit ? (
          <>
            <span className="tl-note">{T("Aşağıdaki hesaplardan birine havale/EFT yapın")}</span>
            <div className="tl-banks">
              {aktifHesaplar.map((hesap) => (
                <div className="bank-card" key={hesap.id || hesap.iban}>
                  <div className="bank-head">{hesap.bank_name}</div>
                  <KopyaSatiri label={T("Hesap Sahibi")} value={hesap.account_holder} />
                  <KopyaSatiri label="IBAN" value={hesap.iban} />
                  <KopyaSatiri label={T("Açıklama")} value={hesap.description} vurgu />
                </div>
              ))}
              {!aktifHesaplar.length && (
                <div className="referral-note">
                  <Icon name="info" size={22} color="var(--muted)" />
                  <span>{T("Şu anda tanımlı bir yatırım hesabı yok. Referansınız ile iletişime geçiniz.")}</span>
                </div>
              )}
            </div>

            <label className="tl-field">
              <span>{T("Gönderilen Tutar")} (₺)</span>
              <input inputMode="decimal" value={amountText} placeholder="0,00"
                onChange={(event) => setAmountText(group(event.target.value))} />
            </label>
            <span className="tl-hint">{T("5-15 dakika içerisinde hesabınıza yansır.")}</span>
          </>
        ) : (
          <>
            <div className="tl-balance">
              <span>{T("ÇEKİLEBİLİR BAKİYE")}</span>
              <strong>{money(available)}</strong>
            </div>
            <label className="tl-field">
              <span>{T("Hesap Adı")}</span>
              <input value={holder} placeholder={T("Ad Soyad")} onChange={(event) => setHolder(event.target.value)} />
            </label>
            <label className="tl-field">
              <span>{T("Banka Adı")}</span>
              <input value={bank} placeholder={T("Banka adını giriniz")} onChange={(event) => setBank(event.target.value)} />
            </label>
            <label className="tl-field">
              <span>IBAN</span>
              <input value={iban} placeholder="TR00 0000 0000 0000 0000 0000 00" inputMode="text"
                onChange={(event) => setIban(event.target.value.toUpperCase())} />
            </label>
            <label className="tl-field">
              <span>{T("Çekim Tutarı")} (₺)</span>
              <input inputMode="decimal" value={amountText} placeholder="0,00"
                onChange={(event) => setAmountText(group(event.target.value))} />
            </label>
          </>
        )}
        {error && <span className="trade-error">{error}</span>}
        <button className="btn" disabled={busy} onClick={submit}>
          {T(busy ? "Gönderiliyor…" : deposit ? "Bildirimi Gönder" : "Çek")}
        </button>
        <button className="btn ghost" onClick={onClose}>{T("İptal")}</button>
      </div>
    </Sheet>
  );
}

/* ---------- İlk açılışta bildirim izni ---------- */

function PushPrompt({ onClose, onNotice }) {
  const [bekliyor, setBekliyor] = useState(false);
  const izinVer = async () => {
    setBekliyor(true);
    const durum = await enablePush();
    setBekliyor(false);
    writePref("push-asked", true);
    onClose();
    if (durum === "acik") onNotice("Bildirimler açık", "İşlem, referans ve piyasa bildirimleri artık bu cihaza düşecek.");
    else if (durum === "engellendi") onNotice("İzin verilmedi", "Ayarlar → Bildirimler bölümünden Ottoman için bildirimlere izin verebilirsiniz.");
    else if (durum === "hata") onNotice("Kurulamadı", "Bildirim aboneliği kurulamadı, birazdan tekrar deneyin.");
  };
  return (
    <Sheet title={T("Bildirimleri aç")} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="install-hero">
          <span className="push-bell"><Icon name="bell" size={30} /></span>
          <div className="install-copy">
            <strong>{T("Anlık bildirim")}</strong>
            <span>{T("Emirleriniz gerçekleştiğinde, referansınız işlem yaptığında ve takip ettiğiniz piyasada hareket olduğunda haberiniz olsun.")}</span>
          </div>
        </div>
        <button className="btn" disabled={bekliyor} onClick={izinVer}>{T(bekliyor ? "Açılıyor…" : "Bildirimlere izin ver")}</button>
        <button className="btn ghost" onClick={onClose}>{T("Daha sonra")}</button>
      </div>
    </Sheet>
  );
}

/* ---------- Uygulamayı yükle ---------- */

export function InstallSheet({ onClose, onNotice }) {
  const [kurulabilir, setKurulabilir] = useState(canInstall());
  const [kurulu, setKurulu] = useState(isStandalone());
  const [bekliyor, setBekliyor] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);
  const icTarayici = uygulamaIciTarayici();

  useEffect(() => onInstallChange(() => {
    setKurulabilir(canInstall());
    setKurulu(isStandalone());
  }), []);

  const yukle = async () => {
    setBekliyor(true);
    const sonuc = await promptInstall();
    setBekliyor(false);
    setKurulabilir(canInstall());
    if (sonuc === "accepted") {
      onClose();
      onNotice("Uygulama eklendi", "Ottoman artık ana ekranınızda. Kısayoldan açtığınızda doğrudan e-şubeye girersiniz.");
      return;
    }
    // Tarayıcı kurulum teklifini vermediyse düğme sessiz kalmasın; nedenini söyle.
    if (sonuc === "yok") {
      onNotice(
        "Tarayıcıdan ekleyin",
        uygulamaIciTarayici()
          ? "Bu sayfa başka bir uygulamanın içinde açıldı. Sağ üstteki ⋮ menüsünden “Tarayıcıda aç” deyip Chrome'da tekrar deneyin."
          : "Chrome bu sayfada kurulum penceresini vermedi. Sağ üstteki ⋮ menüsünden “Uygulamayı yükle” ya da “Ana ekrana ekle” seçeneğine dokunun.",
      );
    }
  };

  const altCubuk = iosToolbarAtBottom();
  const tarayici = iosBrowser();
  const androidMi = /Android/i.test(navigator.userAgent || "");
  const elmaAdimlari = [
    ["share", "Paylaş düğmesine dokunun", altCubuk ? "Ekranın altındaki ortadaki simge" : "Adres çubuğunun sağındaki simge"],
    ["addhome", "“Ana Ekrana Ekle”yi seçin", "Listeyi biraz yukarı kaydırın"],
    ["check", "Sağ üstten “Ekle”ye dokunun", "Ottoman simgesi ana ekrana gelir"],
  ];

  return (
    <Sheet title={T("Uygulamayı yükle")} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="install-hero">
          <img src="/icons/icon-192.png" alt="Ottoman Yatırım" width={64} height={64} />
          <div className="install-copy">
            <strong>Ottoman Yatırım</strong>
          </div>
        </div>

        {!kurulu && icTarayici && !kurulabilir ? (
          /* Telegram/Instagram gibi bir uygulamanın içindeyiz. Kurulum iznini
             yalnızca Chrome/Safari veriyor; tek dokunuşla oraya geçiliyor ve
             açılan sayfada bu ekran kendiliğinden geliyor. */
          <>
            <div className="referral-note">
              <Icon name="info" size={22} color="var(--purple)" />
              <span>{T(isApple()
                ? "Bu sayfa bir uygulamanın içinde açıldı. Aşağıdaki düğme Safari'yi açar ve kurulum orada kendiliğinden başlar."
                : "Bu sayfa bir uygulamanın içinde açıldı. Aşağıdaki düğme Chrome'u açar ve kurulum orada kendiliğinden başlar.")}</span>
            </div>
            {/* Bağlantı olarak veriliyor: uygulama içi tarayıcılar dokunmayla
                açılan şemaları geçirir, JavaScript ile yapılanı engelleyebilir. */}
            <a
              className="btn"
              href={kurulumSemasi()}
              rel="noreferrer"
              onClick={() => { setTimeout(() => { tarayicidaAc(); }, 900); }}
            >
              {T(isApple() ? "Safari'de aç ve kur" : "Chrome'da aç ve kur")}
            </a>
            <button
              className="btn ghost"
              onClick={async () => {
                const oldu = await adresiKopyala();
                setKopyalandi(oldu);
                if (!oldu) onNotice("Kopyalanamadı", kurulumAdresi());
              }}
            >
              {T(kopyalandi ? "Bağlantı kopyalandı" : "Bağlantıyı kopyala")}
            </button>
            <span style={{ fontSize: "calc(12px * var(--s))", color: "var(--muted)", lineHeight: 1.4 }}>
              {T("Düğme çalışmazsa sağ üstteki menüden “Tarayıcıda aç” diyebilirsiniz; adres aynı kalır.")}
            </span>
          </>
        ) : kurulu ? (
          <>
            <div className="referral-note">
              <Icon name="check" size={22} color="var(--pos)" />
              <span>{T("Uygulama bu cihaza kurulu. Bildirimleri açmak için Hesap → Ayarlar → Bildirim Ayarları → Cihaz Bildirimleri.")}</span>
            </div>
            <button className="btn" onClick={onClose}>{T("Tamam")}</button>
          </>
        ) : kurulabilir ? (
          <>
            <span style={{ fontSize: "calc(13.5px * var(--s))", color: "var(--muted)" }}>
              {T("Kurulum birkaç saniye sürer ve cihazda yer kaplamaz.")}
            </span>
            <button className="btn" disabled={bekliyor} onClick={yukle}>{T(bekliyor ? "Kuruluyor…" : "Ana ekrana ekle")}</button>
          </>
        ) : isApple() ? (
          <>
            {tarayici !== "safari" && (
              <div className="referral-note">
                <Icon name="info" size={22} color="var(--muted)" />
                <span>{T("Bu sayfayı önce Safari'de açın. Diğer tarayıcılardan eklenen kısayol uygulama gibi çalışmaz ve bildirim alamaz.")}</span>
              </div>
            )}
            <ol className="ios-steps">
              {elmaAdimlari.map(([icon, baslik, not], index) => (
                <li key={baslik}>
                  <span className="ios-no">{index + 1}</span>
                  <span className="ios-glyph"><Icon name={icon} size={22} /></span>
                  <span className="ios-copy"><strong>{T(baslik)}</strong><span>{T(not)}</span></span>
                </li>
              ))}
            </ol>
            <span style={{ fontSize: "calc(12.5px * var(--s))", color: "var(--muted)", lineHeight: 1.4 }}>
              {T("iPhone ve iPad'de bu üç adımı Apple zorunlu tutuyor; hiçbir site kendini otomatik kuramaz. Ekledikten sonra simgeden açtığınızda doğrudan e-şubeniz gelir ve bildirimler çalışır.")}
            </span>
            <button className="btn" onClick={onClose}>{T("Anladım")}</button>
            {tarayici === "safari" && (
              <div className={altCubuk ? "ios-pointer alt" : "ios-pointer ust"} aria-hidden="true">
                <Icon name="share" size={20} />
                <span>{T("Paylaş")}</span>
              </div>
            )}
          </>
        ) : androidMi ? (
          <>
            {uygulamaIciTarayici() && (
              <div className="referral-note">
                <Icon name="info" size={22} color="var(--muted)" />
                <span>{T("Bu sayfa başka bir uygulamanın içinde açık. Önce sağ üstteki ⋮ → “Tarayıcıda aç” deyin; kurulum yalnızca Chrome'da çalışır.")}</span>
              </div>
            )}
            <ol className="ios-steps">
              <li>
                <span className="ios-no">1</span>
                <span className="ios-glyph"><Icon name="android" size={22} /></span>
                <span className="ios-copy"><strong>{T("Sağ üstteki ⋮ menüsünü aç")}</strong><span>{T("Chrome'un üç nokta menüsü")}</span></span>
              </li>
              <li>
                <span className="ios-no">2</span>
                <span className="ios-glyph"><Icon name="download" size={22} /></span>
                <span className="ios-copy"><strong>{T("“Uygulamayı yükle”ye dokun")}</strong><span>{T("“Ana ekrana ekle” olarak da görünebilir")}</span></span>
              </li>
            </ol>
            <button className="btn" disabled={bekliyor} onClick={yukle}>{T(bekliyor ? "Kuruluyor…" : "Ana ekrana ekle")}</button>
          </>
        ) : (
          <>
            <div className="sec-card">
              <Divided>
                <div className="sec-row">
                  <span className="disc"><Icon name="laptop" size={20} /></span>
                  <span className="copy"><strong>{T("Bilgisayar")}</strong><span>{T("Adres çubuğundaki yükle simgesi ya da menü → “Yükle”")}</span></span>
                  <span /><span />
                </div>
              </Divided>
            </div>
            <button className="btn" onClick={onClose}>{T("Tamam")}</button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function NotifyHost({ onBack, onSaved, onNotice }) {
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(NOTIFY_KEYS.map((key) => [key, readPref(key, key !== "notify-referral")]))
  );
  const [quiet, setQuiet] = useState(() => readPref("notify-quiet", 1));
  const [weekly, setWeekly] = useState(() => readPref("notify-weekly", 1));

  // Cihaz bildirimi: tarayıcı izni + push aboneliği.
  const [push, setPush] = useState("kapali");
  useEffect(() => { let canli = true; pushState().then((durum) => canli && setPush(durum)); return () => { canli = false; }; }, []);
  const togglePush = async (on) => {
    setPush("bekliyor");
    const durum = on ? await enablePush() : await disablePush();
    setPush(durum);
    if (durum === "ana-ekran-gerekli") {
      onNotice?.("Cihaz bildirimi", "iPhone ve iPad'de bildirim için uygulamanın ana ekrana eklenmiş olması gerekir. Hesap → Uygulamayı yükle adımlarını izleyin.");
    } else if (durum === "engellendi") {
      onNotice?.("Bildirim izni kapalı", "Tarayıcı ayarlarından bu site için bildirimlere izin verdikten sonra tekrar deneyin.");
    } else if (durum === "desteklenmiyor") {
      onNotice?.("Cihaz bildirimi", "Bu tarayıcı cihaz bildirimlerini desteklemiyor.");
    } else if (durum === "hata") {
      onNotice?.("Cihaz bildirimi", "Abonelik kurulamadı, birazdan tekrar deneyin.");
    }
  };

  return (
    <NotifySettings
      onBack={onBack}
      push={push}
      onPush={togglePush}
      onPushTest={async () => {
        try {
          await api("/api/push/test", { method: "POST", body: "{}" });
          onNotice?.("Deneme gönderildi", "Bildirim birkaç saniye içinde cihazınıza düşer.");
        } catch (error) {
          onNotice?.("Gönderilemedi", error?.message || "Deneme bildirimi gönderilemedi.");
        }
      }}
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
        syncPushPrefs();
        onSaved();
      }}
    />
  );
}
