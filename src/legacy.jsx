// Eski e-şube kabuğundan korunan parçalar: giriş ekranı ve admin paneli.
// Bunlar APK'da bulunmayan, kuruma özgü ekranlardır; extra.css/style.css ile biçimlenir.
import React, { useEffect, useMemo, useState } from "react";
import { Bell, Calendar, CheckCircle2, Eye, EyeOff, Moon, ShieldCheck, Sun, X } from "lucide-react";
import { api } from "./esube/store.js";
import { rememberAccount, takePendingTc } from "./esube/accounts.js";
import { ILLER, ilceleri } from "./esube/regions.js";
import { gecerliTc, tcHatasi } from "./esube/kimlik.js";
import Icon from "./esube/icons.jsx";
import { CONTRACTS } from "./esube/contracts.js";

const money = (value) => `₺${Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compactDate = () => new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

function BrandHeader({ showAvatar = true, showBrand = true, onNotify, unreadCount = 0, dark, toggleDark, openProfile, openAdmin, me }) {
  return (
    <header className="brand-header">
      {showAvatar ? <button className="avatar profile-trigger" onClick={openProfile}>{me?.avatar_url ? <img src={me.avatar_url} alt="" /> : "İS"}</button> : <div />}
      <div className="brand">{showBrand ? "Ottoman" : ""}</div>
      <div className="header-actions">
        {me?.role === "admin" && <button className="admin-chip" onClick={openAdmin} title="Admin paneline git"><ShieldCheck size={14} /> Admin</button>}
        <button className="bell-button" onClick={onNotify} title="Bildirimler"><Bell size={27} />{unreadCount > 0 && <i className="notify-dot" />}</button>
        <button onClick={toggleDark} title="Tema">{dark ? <Sun size={30} /> : <Moon size={30} />}</button>
      </div>
    </header>
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

function AuthTicker() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let canli = true;
    const cek = () => api("/api/market")
      .then((veri) => {
        if (!canli) return;
        const hisseler = (veri.quotes || []).filter((q) => q.asset_class === "stock" && Number(q.price) > 0);
        hisseler.sort((a, b) => Number(b.change_pct || 0) - Number(a.change_pct || 0));
        setRows(hisseler.slice(0, 14));
      })
      .catch(() => {});
    cek();
    const zaman = setInterval(cek, 60000);
    return () => { canli = false; clearInterval(zaman); };
  }, []);
  if (!rows.length) return null;
  const seri = [...rows, ...rows];
  return (
    <div className="auth-ticker" aria-hidden="true">
      <div className="auth-ticker-lane">
        {seri.map((row, index) => (
          <span key={`${row.symbol}-${index}`}>
            <b>{row.symbol}</b>
            <i className={Number(row.change_pct) >= 0 ? "up" : "down"}>
              {Number(row.change_pct) >= 0 ? "+" : "−"}{Math.abs(Number(row.change_pct || 0)).toFixed(2).replace(".", ",")}%
            </i>
          </span>
        ))}
      </div>
    </div>
  );
}

const Alan = ({ label, children, genis }) => (
  <label className={genis ? "auth-field wide" : "auth-field"}><span>{label}</span>{children}</label>
);

const SifreAlani = ({ name, placeholder, value, onChange }) => {
  const [acik, setAcik] = useState(false);
  return (
    <span className="auth-secret">
      <input name={name} type={acik ? "text" : "password"} placeholder={placeholder} value={value} onChange={onChange} required />
      <button type="button" onClick={() => setAcik(!acik)} aria-label="Şifreyi göster">
        {acik ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  );
};

/** Backend password_is_strong ile birebir aynı 4 kriter: uzunluk>=10,
    büyük harf, küçük harf, rakam. "guclu" olmadan hesap açılamaz. */
export const sifreGucu = (value) => {
  const v = String(value || "");
  if (!v) return null;
  const kriterler = [v.length >= 10, /[A-ZÇĞİÖŞÜ]/.test(v), /[a-zçğıöşü]/.test(v), /\d/.test(v)];
  const puan = kriterler.filter(Boolean).length;
  return puan === 4 ? "guclu" : puan >= 2 ? "orta" : "zayif";
};

const SifreGucMetre = ({ value }) => {
  const seviye = sifreGucu(value);
  if (!seviye) return null;
  const etiket = { zayif: "Zayıf", orta: "Orta", guclu: "Güçlü" }[seviye];
  return (
    <div className={`auth-strength ${seviye}`}>
      <i /><i /><i />
      <span>{etiket}</span>
    </div>
  );
};

/** GG/AA/YYYY: rakamlar yazıldıkça otomatik "/" ekler; sağdaki takvim ikonu
    gizli bir native tarih girişini tetikler (her tarayıcıda kendi seçicisini açar). */
const dogumBicimle = (raw) => {
  const rakam = String(raw || "").replace(/\D/g, "").slice(0, 8);
  const gun = rakam.slice(0, 2), ay = rakam.slice(2, 4), yil = rakam.slice(4, 8);
  return [gun, ay, yil].filter(Boolean).join("/");
};

const DogumAlani = ({ value, onChange }) => {
  const isoValue = (() => {
    const [g, a, y] = String(value || "").split("/");
    return g && a && y && y.length === 4 ? `${y}-${a.padStart(2, "0")}-${g.padStart(2, "0")}` : "";
  })();
  return (
    <span className="auth-secret auth-dob">
      <input inputMode="numeric" placeholder="GG/AA/YYYY" value={value}
        onChange={(event) => onChange(dogumBicimle(event.target.value))} required maxLength={10} />
      <span className="auth-dob-pick">
        <Calendar size={18} />
        <input type="date" tabIndex={-1} aria-label="Takvimden seç" value={isoValue}
          onChange={(event) => {
            const [y, a, g] = event.target.value.split("-");
            if (y && a && g) onChange(`${g}/${a}/${y}`);
          }} />
      </span>
    </span>
  );
};

/** Metni başlık/madde/paragraf bloklarına ayırır (Sözleşmeler ekranındaki DocumentPage ile aynı mantık). */
const belgeBloklariniAyir = (doc) => {
  const out = [];
  for (const raw of (doc?.body || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("* ")) { out.push({ type: "bullet", text: line.slice(2) }); continue; }
    const numbered = line.length > 2 && /^\d/.test(line) && line.indexOf(". ") >= 0 && line.indexOf(". ") < 4;
    const heading = line.startsWith("Madde ") || numbered || (line.length < 64 && !".;:,".includes(line[line.length - 1]));
    out.push({ type: heading ? "head" : "text", text: line });
  }
  return out;
};

const KAYIT_SOZLESME_ADIMLARI = () => {
  const bul = (anahtar) => CONTRACTS.find((c) => c.title.includes(anahtar));
  return [
    { key: "kvkk", title: "KVKK Aydınlatma Metni", doc: bul("Kişisel Verilerin Korunması") },
    { key: "risk", title: "Risk Bildirimi", doc: bul("Risk Bildirimi") },
    { key: "sozlesme", title: "E-Şube Sözleşmesi", doc: bul("Çerçeve Sözleşmesi") },
  ].filter((adim) => adim.doc);
};

/** Sözleşmeleri okumadan onaylanamaz: her metin sonuna kadar kaydırılmadan
    "Devam Et" açılmaz; son metin de okunduktan sonra kabul tamamlanır. */
function SozlesmeModal({ onClose, onComplete }) {
  const adimlar = useMemo(KAYIT_SOZLESME_ADIMLARI, []);
  const [index, setIndex] = useState(0);
  const [okunanlar, setOkunanlar] = useState(() => new Set());
  const adim = adimlar[index];
  const okundu = adim ? okunanlar.has(adim.key) : false;
  const blocks = useMemo(() => belgeBloklariniAyir(adim?.doc), [adim]);

  const kaydirildi = (event) => {
    const el = event.currentTarget;
    if (el.scrollHeight - (el.scrollTop + el.clientHeight) < 16) {
      setOkunanlar((eski) => (eski.has(adim.key) ? eski : new Set(eski).add(adim.key)));
    }
  };

  const devamEt = () => {
    if (!okundu) return;
    if (index < adimlar.length - 1) setIndex((i) => i + 1);
    else onComplete();
  };

  if (!adim) return null;

  return (
    <div className="modal-layer sozlesme-layer" onClick={onClose}>
      <section className="trade-modal sozlesme-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="close" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        <div className="sozlesme-progress">
          {adimlar.map((a, i) => <span key={a.key} className={i <= index ? "on" : ""} />)}
        </div>
        <h2>{adim.title}</h2>
        <div className="doc-card sozlesme-body" onScroll={kaydirildi}>
          {blocks.map((block, i) =>
            block.type === "head" ? <h3 key={i}>{block.text}</h3>
              : block.type === "bullet" ? <div className="bullet" key={i}><span>•</span><span>{block.text}</span></div>
                : <p key={i}>{block.text}</p>
          )}
        </div>
        {!okundu && <small className="sozlesme-hint">Devam edebilmek için metnin tamamını okuyup en alta kaydırmalısın.</small>}
        <button type="button" className="confirm" disabled={!okundu} onClick={devamEt}>
          {index < adimlar.length - 1 ? "Okudum, Devam Et" : "Okudum, Kabul Ediyorum"}
        </button>
      </section>
    </div>
  );
}

const BOS_KAYIT = {
  ad: "", soyad: "", tc: "", dogum: "", il: "", ilce: "",
  telefon: "", eposta: "", referans: "", sifre: "", sifre2: "",
};

function AuthScreen({ onAuthed, back, initialMode }) {
  const [mode, setMode] = useState(initialMode === "register" ? "register" : "login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [kayit, setKayit] = useState(BOS_KAYIT);
  const [sozlesme, setSozlesme] = useState(false);
  const [sozlesmeModal, setSozlesmeModal] = useState(false);
  // Hesap değiştirilirken kimlik numarası hazır gelir; şifre her zaman istenir.
  const [prefillTc] = useState(() => takePendingTc());
  const [girisTc, setGirisTc] = useState(prefillTc);
  const [girisSifre, setGirisSifre] = useState("");

  const alan = (ad) => (event) => setKayit((eski) => ({ ...eski, [ad]: event.target.value }));

  const girisYap = async (event) => {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify({ tc: girisTc, password: girisSifre }) });
      const data = await api("/api/me");
      rememberAccount({ ...(data?.user || data || {}), tc: String(girisTc || "") });
      onAuthed(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const hesapOlustur = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!gecerliTc(kayit.tc)) return setMessage("T.C. kimlik numarası geçersiz. Lütfen kimliğinizdeki numarayı girin.");
    if (kayit.sifre !== kayit.sifre2) return setMessage("Şifreler aynı değil.");
    if (!sozlesme) return setMessage("Sözleşmeleri kabul etmelisin.");
    const parcalar = kayit.dogum.split(/[./-]/).map((x) => x.trim());
    const dogum = parcalar.length === 3 && parcalar[0].length === 2
      ? `${parcalar[2]}-${parcalar[1]}-${parcalar[0]}`
      : kayit.dogum;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("full_name", `${kayit.ad.trim()} ${kayit.soyad.trim()}`.trim());
      fd.append("tc", kayit.tc);
      fd.append("phone", kayit.telefon);
      fd.append("email", kayit.eposta);
      fd.append("city", kayit.il);
      fd.append("district", kayit.ilce);
      fd.append("birth_date", dogum);
      fd.append("password", kayit.sifre);
      fd.append("referral_code", kayit.referans);
      fd.append("accept_kvkk", "1");
      fd.append("accept_distance_contract", "1");
      fd.append("accept_risk_disclosure", "1");
      for (const [key, value] of Object.entries({
        risk_experience: "2", risk_horizon: "2", risk_loss: "2", risk_income: "2",
        trade_frequency: "2", knowledge_level: "2", education: "Lisans",
        occupation: "Belirtilmedi", traded_products: "Pay", investment_goal: "Uzun vadeli",
        agreements_version: "2026-09",
      })) fd.append(key, value);
      await api("/api/register", { method: "POST", body: fd });
      setKayit(BOS_KAYIT);
      setSozlesme(false);
      setMode("login");
      setMessage("Başvurun alındı. Onaydan sonra giriş yapabilirsin.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const ilceler = ilceleri(kayit.il);

  return (
    <div className="stage auth-stage"><div className="phone auth-phone"><main className="screen scroll auth-screen auth-v2">
      <AuthTicker />
      <button className="ghost-back" onClick={back}>Ana sayfa</button>
      <div className="auth-logo brand">Ottoman Yatırım</div>

      <div className="auth-tabs">
        <button className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setMessage(""); }}>Giriş Yap</button>
        <button className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setMessage(""); }}>Hesap Oluştur</button>
      </div>

      {mode === "login" ? (
        <form className="auth-form2" onSubmit={girisYap}>
          <h4>HESAP BİLGİLERİ</h4>
          <div className="auth-box">
            <Alan label="T.C. Kimlik No" genis>
              <input inputMode="numeric" maxLength={11} placeholder="11 haneli" value={girisTc}
                onChange={(event) => setGirisTc(event.target.value.replace(/\D/g, ""))} required />
            </Alan>
            <Alan label="Şifre" genis>
              <SifreAlani name="password" placeholder="Şifreniz" value={girisSifre} onChange={(event) => setGirisSifre(event.target.value)} />
            </Alan>
          </div>
          {message && <div className="warning">{message}</div>}
          <button className="confirm" disabled={busy}>{busy ? "Giriş yapılıyor…" : "Giriş Yap"}</button>
        </form>
      ) : (
        <form className="auth-form2" onSubmit={hesapOlustur}>
          <h4>KİŞİSEL BİLGİLER</h4>
          <div className="auth-box">
            <Alan label="Ad"><input placeholder="Adınız" value={kayit.ad} onChange={alan("ad")} required /></Alan>
            <Alan label="Soyad"><input placeholder="Soyadınız" value={kayit.soyad} onChange={alan("soyad")} required /></Alan>
            <Alan label="T.C. Kimlik No">
              <input
                inputMode="numeric"
                maxLength={11}
                placeholder="11 haneli"
                value={kayit.tc}
                className={kayit.tc.length === 11 ? (gecerliTc(kayit.tc) ? "tc-ok" : "tc-hatali") : ""}
                onChange={(event) => setKayit((e) => ({ ...e, tc: event.target.value.replace(/\D/g, "") }))}
                required
              />
              {/* Sahte numarayla kayıt olunmasın: numara girilirken kontrol edilir. */}
              {kayit.tc.length >= 11 && !gecerliTc(kayit.tc) && <small className="alan-hata">{tcHatasi(kayit.tc)}</small>}
              {kayit.tc.length === 11 && gecerliTc(kayit.tc) && <small className="alan-tamam">Kimlik numarası doğrulandı</small>}
            </Alan>
            <Alan label="Doğum Tarihi"><DogumAlani value={kayit.dogum} onChange={(v) => setKayit((eski) => ({ ...eski, dogum: v }))} /></Alan>
          </div>

          <h4>İKAMET BİLGİLERİ</h4>
          <div className="auth-box">
            <Alan label="İl">
              <select value={kayit.il} onChange={(event) => setKayit((e) => ({ ...e, il: event.target.value, ilce: "" }))} required>
                <option value="">İl seçiniz</option>
                {ILLER.map((il) => <option key={il} value={il}>{il}</option>)}
              </select>
            </Alan>
            <Alan label="İlçe">
              <select value={kayit.ilce} onChange={alan("ilce")} disabled={!ilceler.length} required>
                <option value="">İlçe seçiniz</option>
                {ilceler.map((ilce) => <option key={ilce} value={ilce}>{ilce}</option>)}
              </select>
            </Alan>
          </div>

          <h4>İLETİŞİM</h4>
          <div className="auth-box">
            <Alan label="Telefon">
              <input inputMode="tel" placeholder="05XXXXXXXXX" value={kayit.telefon}
                onChange={(event) => setKayit((e) => ({ ...e, telefon: event.target.value.replace(/[^\d+ ]/g, "") }))} required />
            </Alan>
            <Alan label="Referans (Opsiyonel)"><input placeholder="Referans no" value={kayit.referans} onChange={alan("referans")} /></Alan>
            <Alan label="E-posta (Opsiyonel)" genis><input type="email" placeholder="ornek@eposta.com" value={kayit.eposta} onChange={alan("eposta")} /></Alan>
          </div>

          <h4>GÜVENLİK</h4>
          <div className="auth-box">
            <Alan label="Şifre" genis>
              <SifreAlani name="password" placeholder="En az 10 karakter, büyük-küçük harf ve rakam" value={kayit.sifre} onChange={alan("sifre")} />
              <SifreGucMetre value={kayit.sifre} />
            </Alan>
            <Alan label="Şifre Tekrar" genis>
              <SifreAlani name="password_confirm" placeholder="Şifrenizi tekrar girin" value={kayit.sifre2} onChange={alan("sifre2")} />
            </Alan>
          </div>

          <button type="button" className={`checkline sozlesme-trigger${sozlesme ? " on" : ""}`} onClick={() => setSozlesmeModal(true)}>
            <span className="fake-check">{sozlesme && <Icon name="check" size={12} color="#fff" />}</span>
            <span>KVKK aydınlatma metni, risk bildirimi ve e-şube sözleşmelerini {sozlesme ? "okudum, kabul ettim." : "okumak ve kabul etmek için dokun."}</span>
          </button>
          {message && <div className="warning">{message}</div>}
          <button className="confirm" disabled={busy || sifreGucu(kayit.sifre) !== "guclu"}>{busy ? "Gönderiliyor…" : "Hesap Oluştur"}</button>
        </form>
      )}
    </main>
    {sozlesmeModal && (
      <SozlesmeModal
        onClose={() => setSozlesmeModal(false)}
        onComplete={() => { setSozlesme(true); setSozlesmeModal(false); }}
      />
    )}
    <div className="home-indicator" /></div></div>
  );
}

function AdminPanel({ data, refresh, logout, onClose }) {
  const [tab, setTab] = useState("Özet");
  const [selectedUser, setSelectedUser] = useState(null);
  // Seçilen kullanıcının işlem geçmişi; kart açılınca çekilir.
  const [userHistory, setUserHistory] = useState([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const openUser = async (user) => {
    setSelectedUser(user);
    setUserHistory([]);
    setHistoryBusy(true);
    try {
      const all = await api("/api/admin/transactions");
      setUserHistory((all.transactions || []).filter((row) => Number(row.user_id) === Number(user.id)));
    } catch {
      setUserHistory([]);
    } finally {
      setHistoryBusy(false);
    }
  };
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
  const t2Enabled = data?.system_settings?.t2_enabled === "1";
  const toggleT2 = async () => {
    const password = prompt("Admin şifrenizi tekrar girin");
    if (!password) return;
    await api("/api/admin/step-up", { method: "POST", body: JSON.stringify({ password }) });
    await api("/api/admin/system-settings", { method: "POST", body: JSON.stringify({ t2_enabled: t2Enabled ? "0" : "1" }) });
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
      <div className="section-title"><h2>Admin Paneli</h2><b><button onClick={onClose}>Müşteri görünümü</button><button onClick={logout}>Çıkış</button></b></div>
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
      {["Özet", "Müşteriler"].includes(tab) && <><h2 className="solo-title">Müşteriler</h2>{users.slice(0, 20).map((u) => <div className="admin-row admin-user-row" key={u.id} onClick={() => openUser(u)}><span><strong>{u.full_name}</strong><small>{u.status_label || u.status} · {u.email} · {u.account_no} · {u.phone || "telefon yok"}</small></span>{u.status !== "approved" && <b><button onClick={(e) => { e.stopPropagation(); act(`/api/admin/users/${u.id}/approve`, "approve"); }}>Onay</button></b>}</div>)}</>}
      {["Özet", "Para"].includes(tab) && <><h2 className="solo-title">Para Talepleri</h2>{moneyReqs.slice(0, 20).map((m) => <div className="admin-row" key={m.id}><span><strong>{m.type_label || m.request_type}</strong><small>{m.full_name} · {money(m.amount)} · {m.status_label || m.status}</small></span>{m.status === "pending" && <b><button onClick={() => act(`/api/admin/money/${m.id}/approve`, "approve")}>Onay</button><button onClick={() => act(`/api/admin/money/${m.id}/reject`, "reject")}>Ret</button></b>}</div>)}</>}
      {tab === "Risk" && <section className="admin-matrix">{[["Risk skoru", "İzleniyor", `${pendingUsers} kullanıcı onay/uyum kuyruğunda`], ["KYC/KVKK", "Aktif", "Sözleşme ve kimlik statüsü kullanıcı kartında"], ["Sözleşmeler", "Kayıtlı", "KVKK, risk bildirimi ve e-şube kabulü"], ["Limit aşımı", money(exposure), "Toplam emir hacmi"], ["Şüpheli işlem", pendingMoney ? "İncele" : "Temiz", `${money(pendingMoney)} bekleyen para talebi`], ["Oturum sağlığı", "Step-up", "Kritik admin işlemlerinde şifre doğrulama"]].map(([x, state, detail]) => <article key={x}><span>{x}</span><strong>{state}</strong><small>{detail}</small></article>)}</section>}
      {tab === "Sistem" && <section className="settings-card report-card">{[["Piyasa veri akışı", `${marketMeta.ok === false ? "Yedekli" : "Çalışıyor"} · ${marketMeta.source || "trrealapi-market"}`], ["Haber servisi", `${newsMeta.ok === false ? "Yedekli" : "Çalışıyor"} · ${newsMeta.count || 0} haber`], ["Emir motoru", `${orders.length} emir · canlı fiyat doğrulama`], ["Para hareketleri", `${moneyReqs.length} talep · ${money(pendingMoney)} bekleyen`], ["Admin step-up", "Kritik işlem öncesi parola doğrulama"], ["Audit log", `${reports.audit?.length || 0} son kayıt görünür`]].map(([x, detail]) => <button className="settings-row" key={x}><span><strong>{x}</strong><small>{detail}</small></span><CheckCircle2 /></button>)}<button className={`settings-row t2-toggle-row${t2Enabled ? " on" : ""}`} onClick={toggleT2}><span><strong>T+2 sistemi</strong><small>{t2Enabled ? "Açık · satış bakiyesi T+2 gününde serbest kalır" : "Kapalı · satış bakiyesi anında kullanılabilir"}</small></span><b className="toggle-pill">{t2Enabled ? "Açık" : "Kapalı"}</b></button></section>}
      {tab === "Raporlar" && <section className="settings-card report-card">{[["Risk ve Uyum", `Kullanıcı statüleri: ${(reports.users || []).length} grup`], ["Operasyon", `Bekleyen emir ${orders.filter((o) => o.status === "pending").length} · para talebi ${moneyReqs.filter((m) => m.status === "pending").length}`], ["Müşteri 360", `Bakiye, emir, para, sözleşme, güvenlik ve işlem geçmişi`], ["Mutabakat", `Nakit ${money(reports.reconciliation?.cash || summary.cash_total || 0)} · Bloke ${money(reports.reconciliation?.blocked || summary.blocked_total || 0)}`]].map(([title, detail]) => <button className="settings-row" key={title}><span><strong>{title}</strong><small>{detail}</small></span><CheckCircle2 /></button>)}</section>}
      {selectedUser && <div className="modal-layer"><section className="trade-modal readable-modal admin-profile"><button className="close" onClick={() => setSelectedUser(null)}><X /></button><h2>{selectedUser.full_name}</h2><p className="subtle-count">{selectedUser.account_no} · {selectedUser.status_label || selectedUser.status}</p><div className="admin-matrix mini">{["Ana Bakiye", "Alış", "Satış", "İşlem", "KVKK", "Risk"].map((x, i) => <article key={x}><span>{x}</span><strong>{[money(selectedUser.cash_balance || 0), selectedUser.buy_count || 0, selectedUser.sell_count || 0, selectedUser.transaction_count || 0, "Kabul", "Orta"][i]}</strong></article>)}</div><h3 className="muted-heading">Ana bakiye düzeltme</h3><div className="admin-balance-edit"><input id={`balance-${selectedUser.id}`} placeholder="Yeni ana bakiye" inputMode="decimal" defaultValue={Number(selectedUser.cash_balance || 0).toFixed(2)} /><button onClick={() => setUserBalance(selectedUser)}>Bakiyeyi Düzelt</button></div><h3 className="muted-heading">İşlem geçmişi</h3><div className="settings-card"><div className="settings-row"><span><strong>Toplam emir</strong><small>{selectedUser.order_count || 0} adet · Alış {selectedUser.buy_count || 0} · Satış {selectedUser.sell_count || 0}</small></span></div><div className="settings-row"><span><strong>KYC / Sözleşme</strong><small>{selectedUser.kyc_status_label || selectedUser.kyc_status || "Onaylandı"} · Tam</small></span></div>{historyBusy && <div className="settings-row"><span><strong>Yükleniyor…</strong><small>Hareket kayıtları çekiliyor</small></span></div>}{!historyBusy && userHistory.length === 0 && <div className="settings-row"><span><strong>Kayıt yok</strong><small>Bu kullanıcıda henüz hareket bulunmuyor</small></span></div>}{userHistory.slice(0, 25).map((row) => <div className="settings-row" key={row.id}><span><strong>{row.type_label || row.transaction_type}{row.code ? ` · ${row.code}` : ""}</strong><small>{row.quantity ? `${row.quantity} lot · ` : ""}{row.price ? `${money(row.price)} · ` : ""}{money(row.total)} · {row.created_at_label || ""}</small></span><b className="admin-amount">{money(row.balance_after)}</b></div>)}</div><button className="confirm" onClick={() => setSelectedUser(null)}>Kapat</button></section></div>}
    </main><div className="home-indicator" /></div></div>
  );
}

export { AuthScreen, AdminPanel };
