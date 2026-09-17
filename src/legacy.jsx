// Eski e-şube kabuğundan korunan parçalar: giriş ekranı ve admin paneli.
// Bunlar APK'da bulunmayan, kuruma özgü ekranlardır; extra.css/style.css ile biçimlenir.
import React, { useState } from "react";
import { Bell, CheckCircle2, Moon, ShieldCheck, Sun, X } from "lucide-react";
import { api } from "./esube/store.js";

const money = (value) => `₺${Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

function AdminPanel({ data, refresh, logout, onClose }) {
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
      {["Özet", "Müşteriler"].includes(tab) && <><h2 className="solo-title">Müşteriler</h2>{users.slice(0, 20).map((u) => <div className="admin-row admin-user-row" key={u.id} onClick={() => setSelectedUser(u)}><span><strong>{u.full_name}</strong><small>{u.status_label || u.status} · {u.email} · {u.account_no} · {u.phone || "telefon yok"}</small></span>{u.status !== "approved" && <b><button onClick={(e) => { e.stopPropagation(); act(`/api/admin/users/${u.id}/approve`, "approve"); }}>Onay</button></b>}</div>)}</>}
      {["Özet", "Para"].includes(tab) && <><h2 className="solo-title">Para Talepleri</h2>{moneyReqs.slice(0, 20).map((m) => <div className="admin-row" key={m.id}><span><strong>{m.type_label || m.request_type}</strong><small>{m.full_name} · {money(m.amount)} · {m.status_label || m.status}</small></span>{m.status === "pending" && <b><button onClick={() => act(`/api/admin/money/${m.id}/approve`, "approve")}>Onay</button><button onClick={() => act(`/api/admin/money/${m.id}/reject`, "reject")}>Ret</button></b>}</div>)}</>}
      {tab === "Risk" && <section className="admin-matrix">{[["Risk skoru", "İzleniyor", `${pendingUsers} kullanıcı onay/uyum kuyruğunda`], ["KYC/KVKK", "Aktif", "Sözleşme ve kimlik statüsü kullanıcı kartında"], ["Sözleşmeler", "Kayıtlı", "KVKK, risk bildirimi ve e-şube kabulü"], ["Limit aşımı", money(exposure), "Toplam emir hacmi"], ["Şüpheli işlem", pendingMoney ? "İncele" : "Temiz", `${money(pendingMoney)} bekleyen para talebi`], ["Oturum sağlığı", "Step-up", "Kritik admin işlemlerinde şifre doğrulama"]].map(([x, state, detail]) => <article key={x}><span>{x}</span><strong>{state}</strong><small>{detail}</small></article>)}</section>}
      {tab === "Sistem" && <section className="settings-card report-card">{[["Piyasa veri akışı", `${marketMeta.ok === false ? "Yedekli" : "Çalışıyor"} · ${marketMeta.source || "trrealapi-market"}`], ["Haber servisi", `${newsMeta.ok === false ? "Yedekli" : "Çalışıyor"} · ${newsMeta.count || 0} haber`], ["Emir motoru", `${orders.length} emir · canlı fiyat doğrulama`], ["Para hareketleri", `${moneyReqs.length} talep · ${money(pendingMoney)} bekleyen`], ["Admin step-up", "Kritik işlem öncesi parola doğrulama"], ["Audit log", `${reports.audit?.length || 0} son kayıt görünür`]].map(([x, detail]) => <button className="settings-row" key={x}><span><strong>{x}</strong><small>{detail}</small></span><CheckCircle2 /></button>)}<button className={`settings-row t2-toggle-row${t2Enabled ? " on" : ""}`} onClick={toggleT2}><span><strong>T+2 sistemi</strong><small>{t2Enabled ? "Açık · satış bakiyesi T+2 gününde serbest kalır" : "Kapalı · satış bakiyesi anında kullanılabilir"}</small></span><b className="toggle-pill">{t2Enabled ? "Açık" : "Kapalı"}</b></button></section>}
      {tab === "Raporlar" && <section className="settings-card report-card">{[["Risk ve Uyum", `Kullanıcı statüleri: ${(reports.users || []).length} grup`], ["Operasyon", `Bekleyen emir ${orders.filter((o) => o.status === "pending").length} · para talebi ${moneyReqs.filter((m) => m.status === "pending").length}`], ["Müşteri 360", `Bakiye, emir, para, sözleşme, güvenlik ve işlem geçmişi`], ["Mutabakat", `Nakit ${money(reports.reconciliation?.cash || summary.cash_total || 0)} · Bloke ${money(reports.reconciliation?.blocked || summary.blocked_total || 0)}`]].map(([title, detail]) => <button className="settings-row" key={title}><span><strong>{title}</strong><small>{detail}</small></span><CheckCircle2 /></button>)}</section>}
      {selectedUser && <div className="modal-layer"><section className="trade-modal readable-modal admin-profile"><button className="close" onClick={() => setSelectedUser(null)}><X /></button><h2>{selectedUser.full_name}</h2><p className="subtle-count">{selectedUser.account_no} · {selectedUser.status_label || selectedUser.status}</p><div className="admin-matrix mini">{["Ana Bakiye", "Alış", "Satış", "İşlem", "KVKK", "Risk"].map((x, i) => <article key={x}><span>{x}</span><strong>{[money(selectedUser.cash_balance || 0), selectedUser.buy_count || 0, selectedUser.sell_count || 0, selectedUser.transaction_count || 0, "Kabul", "Orta"][i]}</strong></article>)}</div><h3 className="muted-heading">Ana bakiye düzeltme</h3><div className="admin-balance-edit"><input id={`balance-${selectedUser.id}`} placeholder="Yeni ana bakiye" inputMode="decimal" defaultValue={Number(selectedUser.cash_balance || 0).toFixed(2)} /><button onClick={() => setUserBalance(selectedUser)}>Bakiyeyi Düzelt</button></div><h3 className="muted-heading">İşlem geçmişi</h3><div className="settings-card"><div className="settings-row"><span><strong>Toplam emir</strong><small>{selectedUser.order_count || 0} adet · Alış {selectedUser.buy_count || 0} · Satış {selectedUser.sell_count || 0}</small></span></div><div className="settings-row"><span><strong>Son hareket</strong><small>{selectedUser.transaction_count || 0} işlem kaydı · {money(selectedUser.cash_balance || 0)} bakiye</small></span></div><div className="settings-row"><span><strong>KYC / Sözleşme</strong><small>{selectedUser.kyc_status_label || selectedUser.kyc_status || "Onaylandı"} · Tam</small></span></div></div><button className="confirm" onClick={() => setSelectedUser(null)}>Kapat</button></section></div>}
    </main><div className="home-indicator" /></div></div>
  );
}

export { AuthScreen, AdminPanel };
