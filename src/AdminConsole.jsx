// Tam yetkili yönetim konsolu: müşteri, bakiye, pozisyon, banka, emir, para,
// belge, T+2 ve sistem ayarlarının tamamı buradan değiştirilir.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./esube/store.js";

const money = (value) =>
  `₺${Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** E-şube teması koyu ise eski admin stil dosyasının koyu kuralları açılır. */
function useDarkTheme() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.dataset.theme === "dark"));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

const STATUS = [
  ["pending", "Beklemede"],
  ["under_review", "İncelemede"],
  ["awaiting_back", "Belge bekleniyor"],
  ["approved", "Onaylı"],
  ["rejected", "Reddedildi"],
];

/* ---------- yönetici kilidi ---------- */

function useLock() {
  const [until, setUntil] = useState(0);
  const [soru, setSoru] = useState(null); // { çöz, reddet }
  const gecerli = () => Date.now() < until;

  // Kritik işlemden önce çağrılır: kilit açıksa hemen, değilse şifre sorar.
  const ensure = useCallback(() => {
    if (Date.now() < until) return Promise.resolve(true);
    return new Promise((resolve) => setSoru({ resolve }));
  }, [until]);

  const dogrula = async (password) => {
    await api("/api/admin/step-up", { method: "POST", body: JSON.stringify({ password }) });
    // Sunucu 10 dakika veriyor; 30 sn pay bırakıyoruz.
    setUntil(Date.now() + 570 * 1000);
    soru?.resolve(true);
    setSoru(null);
  };

  const iptal = () => { soru?.resolve(false); setSoru(null); };

  return { ensure, gecerli, soru, dogrula, iptal };
}

function LockDialog({ onSubmit, onCancel }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const gonder = async (event) => {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(password);
    } catch (hata) {
      setError(hata?.message || "Şifre doğrulanamadı");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-layer">
      <form className="trade-modal readable-modal ac-lock" onSubmit={gonder}>
        <h2>Yönetici doğrulaması</h2>
        <p className="subtle-count">Kritik işlemler için admin şifreni gir. Doğrulama 10 dakika geçerlidir.</p>
        <input
          type="password"
          autoFocus
          value={password}
          placeholder="Admin şifresi"
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <span className="ac-error">{error}</span>}
        <div className="ac-actions">
          <button type="button" className="ac-ghost" onClick={onCancel}>Vazgeç</button>
          <button type="submit" className="confirm" disabled={busy || !password}>{busy ? "Doğrulanıyor…" : "Doğrula"}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- küçük parçalar ---------- */

const Field = ({ label, children, wide }) => (
  <label className={wide ? "ac-field wide" : "ac-field"}><span>{label}</span>{children}</label>
);

const Input = (props) => <input {...props} />;

const Select = ({ value, onChange, options }) => (
  <select value={value} onChange={(event) => onChange(event.target.value)}>
    {options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
  </select>
);

function Section({ title, note, children, action }) {
  return (
    <section className="ac-section">
      <header><div><h3>{title}</h3>{note && <small>{note}</small>}</div>{action}</header>
      {children}
    </section>
  );
}

/* ---------- müşteri düzenleyici ---------- */

function UserEditor({ user, onClose, onNotice, ensure, refresh }) {
  const [form, setForm] = useState({
    full_name: user.full_name || "", phone: user.phone || "", email: user.email || "",
    city: user.city || "", district: user.district || "", birth_date: user.birth_date || "",
    address: user.address || "", kyc_note: user.kyc_note || "", status: user.status || "pending",
  });
  const [busy, setBusy] = useState("");
  const [history, setHistory] = useState([]);
  const [positions, setPositions] = useState([]);
  const [balance, setBalance] = useState({ action: "set", amount: "", note: "" });
  const [position, setPosition] = useState({ action: "set", symbol: "", quantity: "", price: "", note: "" });
  const [hesap, setHesap] = useState(null);

  const yukle = useCallback(async () => {
    const [tx, poz, bak] = await Promise.all([
      api("/api/admin/transactions").catch(() => ({})),
      api("/api/admin/positions").catch(() => ({})),
      api("/api/admin/user-balances").catch(() => ({})),
    ]);
    setHistory((tx.transactions || []).filter((row) => Number(row.user_id) === Number(user.id)));
    setPositions((poz.positions || []).filter((row) => Number(row.user_id) === Number(user.id)));
    setHesap((bak.balances || bak.users || []).find((row) => Number(row.user_id ?? row.id) === Number(user.id)) || null);
  }, [user.id]);

  useEffect(() => { yukle(); }, [yukle]);

  const calistir = async (etiket, islem) => {
    if (!(await ensure())) return;
    setBusy(etiket);
    try {
      await islem();
      await Promise.all([refresh(), yukle()]);
      onNotice("Kaydedildi", "Değişiklik uygulandı.");
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "İşlem tamamlanamadı");
    } finally {
      setBusy("");
    }
  };

  const kaydet = () => calistir("profil", () =>
    api(`/api/admin/users/${user.id}`, { method: "POST", body: JSON.stringify(form) }));

  const bakiyeUygula = () => {
    const tutar = Number(String(balance.amount).replace(",", "."));
    if (!Number.isFinite(tutar) || tutar < 0) return onNotice("Tutar hatalı", "Sıfır ya da üzeri bir tutar gir.");
    if (balance.note.trim().length < 8) return onNotice("Gerekçe kısa", "Finansal değişiklik için en az 8 karakter gerekçe yaz.");
    return calistir("bakiye", () => api("/api/admin/balances", {
      method: "POST",
      body: JSON.stringify({ user_id: user.id, action: balance.action, amount: tutar, note: balance.note.trim() }),
    }));
  };

  const pozisyonUygula = () => {
    const adet = Number(position.quantity);
    const fiyat = Number(String(position.price).replace(",", "."));
    if (!position.symbol.trim()) return onNotice("Sembol gerekli", "Örnek: THYAO");
    if (!Number.isFinite(adet) || adet < 0) return onNotice("Adet hatalı", "Sıfır ya da üzeri bir adet gir.");
    if (!Number.isFinite(fiyat) || fiyat <= 0) return onNotice("Fiyat hatalı", "Sıfırdan büyük bir fiyat gir.");
    if (position.note.trim().length < 8) return onNotice("Gerekçe kısa", "Portföy değişikliği için en az 8 karakter gerekçe yaz.");
    return calistir("pozisyon", () => api("/api/admin/positions", {
      method: "POST",
      body: JSON.stringify({
        user_id: user.id, action: position.action, symbol: position.symbol.trim().toUpperCase(),
        quantity: adet, price: fiyat, note: position.note.trim(),
      }),
    }));
  };

  const sifirla = () => {
    if (!window.confirm(`${user.full_name} hesabı sıfırlanacak: pozisyonlar, emirler ve hareketler silinir. Onaylıyor musun?`)) return;
    return calistir("sifirla", () => api("/api/admin/reset-account", {
      method: "POST", body: JSON.stringify({ user_id: user.id }),
    }));
  };

  const nakit = Number(hesap?.cash_balance ?? user.cash_balance ?? 0);
  const bloke = Number(hesap?.blocked_balance ?? 0);
  const kredi = Number(hesap?.credit_limit ?? 0);

  return (
    <div className="modal-layer">
      <section className="trade-modal readable-modal ac-editor">
        <button className="close" onClick={onClose} aria-label="Kapat">×</button>
        <h2>{user.full_name}</h2>
        <p className="subtle-count">{user.account_no} · {user.email} · {user.phone || "telefon yok"}</p>

        <div className="ac-stats">
          <article><span>Nakit</span><strong>{money(nakit)}</strong></article>
          <article><span>Bloke</span><strong>{money(bloke)}</strong></article>
          <article><span>Kredi limiti</span><strong>{money(kredi)}</strong></article>
          <article><span>Pozisyon</span><strong>{positions.length}</strong></article>
        </div>

        <Section title="Kimlik ve iletişim" note="Tüm alanlar doğrudan değiştirilebilir">
          <div className="ac-form">
            <Field label="Ad soyad"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
            <Field label="Telefon"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="E-posta"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Doğum tarihi"><Input value={form.birth_date} placeholder="1990-01-01" onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></Field>
            <Field label="İl"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="İlçe"><Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></Field>
            <Field label="Adres" wide><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="Hesap durumu"><Select value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={STATUS} /></Field>
            <Field label="Uyum notu" wide><Input value={form.kyc_note} onChange={(e) => setForm({ ...form, kyc_note: e.target.value })} /></Field>
          </div>
          <button className="confirm" disabled={busy === "profil"} onClick={kaydet}>{busy === "profil" ? "Kaydediliyor…" : "Bilgileri kaydet"}</button>
        </Section>

        <Section title="Bakiye" note="Ana bakiyeyi belirle, ekle, düş ya da kredi limiti tanımla">
          <div className="ac-form">
            <Field label="İşlem">
              <Select
                value={balance.action}
                onChange={(v) => setBalance({ ...balance, action: v })}
                options={[["set", "Bakiyeyi şuna eşitle"], ["add", "Bakiyeye ekle"], ["subtract", "Bakiyeden düş"], ["credit", "Kredi limiti ekle"]]}
              />
            </Field>
            <Field label="Tutar (₺)"><Input inputMode="decimal" value={balance.amount} onChange={(e) => setBalance({ ...balance, amount: e.target.value })} /></Field>
            <Field label="Gerekçe (en az 8 karakter)" wide><Input value={balance.note} onChange={(e) => setBalance({ ...balance, note: e.target.value })} /></Field>
          </div>
          <button className="confirm" disabled={busy === "bakiye"} onClick={bakiyeUygula}>{busy === "bakiye" ? "Uygulanıyor…" : "Bakiyeyi uygula"}</button>
        </Section>

        <Section title="Portföy" note="Kullanıcının pozisyonlarını doğrudan ayarla">
          {positions.length > 0 && (
            <div className="ac-list">
              {positions.map((row) => (
                <div className="ac-line" key={`${row.symbol}-${row.id || row.symbol}`}>
                  <span><strong>{row.symbol}</strong><small>{row.quantity} lot · ort. {money(row.avg_price)}</small></span>
                  <button className="ac-ghost" onClick={() => setPosition({ action: "set", symbol: row.symbol, quantity: "0", price: String(row.avg_price || 1), note: "" })}>Sıfırla</button>
                </div>
              ))}
            </div>
          )}
          <div className="ac-form">
            <Field label="İşlem">
              <Select
                value={position.action}
                onChange={(v) => setPosition({ ...position, action: v })}
                options={[["set", "Pozisyonu şuna eşitle"], ["add", "Pozisyona ekle"], ["reduce", "Pozisyondan düş"]]}
              />
            </Field>
            <Field label="Sembol"><Input value={position.symbol} placeholder="THYAO" onChange={(e) => setPosition({ ...position, symbol: e.target.value.toUpperCase() })} /></Field>
            <Field label="Adet (lot)"><Input inputMode="numeric" value={position.quantity} onChange={(e) => setPosition({ ...position, quantity: e.target.value })} /></Field>
            <Field label="Ortalama fiyat"><Input inputMode="decimal" value={position.price} onChange={(e) => setPosition({ ...position, price: e.target.value })} /></Field>
            <Field label="Gerekçe (en az 8 karakter)" wide><Input value={position.note} onChange={(e) => setPosition({ ...position, note: e.target.value })} /></Field>
          </div>
          <button className="confirm" disabled={busy === "pozisyon"} onClick={pozisyonUygula}>{busy === "pozisyon" ? "Uygulanıyor…" : "Pozisyonu uygula"}</button>
        </Section>

        <Section title="Hareketler" note={`${history.length} kayıt`}>
          <div className="ac-list scroll">
            {history.length === 0 && <div className="ac-line"><span><strong>Kayıt yok</strong><small>Bu hesapta hareket bulunmuyor</small></span></div>}
            {history.slice(0, 40).map((row) => (
              <div className="ac-line" key={row.id}>
                <span>
                  <strong>{row.type_label || row.transaction_type}{row.code ? ` · ${row.code}` : ""}</strong>
                  <small>{row.quantity ? `${row.quantity} lot · ` : ""}{row.price ? `${money(row.price)} · ` : ""}{money(row.total)} · {row.created_at_label || ""}</small>
                </span>
                <b className="admin-amount">{money(row.balance_after)}</b>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tehlikeli bölge" note="Geri alınamaz">
          <button className="ac-danger" disabled={busy === "sifirla"} onClick={sifirla}>{busy === "sifirla" ? "Sıfırlanıyor…" : "Hesabı sıfırla"}</button>
        </Section>

        <button className="confirm" onClick={onClose}>Kapat</button>
      </section>
    </div>
  );
}

/* ---------- banka hesapları ---------- */

const BOS_BANKA = { id: 0, bank_name: "", account_holder: "", iban: "", branch_name: "", description: "", is_active: "1", sort_order: 0 };

function BankPanel({ onNotice, ensure }) {
  const [veri, setVeri] = useState({ system_bank_accounts: [], user_bank_accounts: [] });
  const [form, setForm] = useState(BOS_BANKA);
  const [busy, setBusy] = useState(false);

  const yukle = useCallback(async () => {
    try { setVeri(await api("/api/admin/bank-accounts")); } catch { /* yoksay */ }
  }, []);
  useEffect(() => { yukle(); }, [yukle]);

  const kaydet = async () => {
    if (!form.bank_name.trim() || !form.account_holder.trim() || !form.iban.trim()) {
      return onNotice("Eksik bilgi", "Banka adı, hesap sahibi ve IBAN zorunlu.");
    }
    if (!(await ensure())) return;
    setBusy(true);
    try {
      await api("/api/admin/bank-accounts", { method: "POST", body: JSON.stringify(form) });
      setForm(BOS_BANKA);
      await yukle();
      onNotice("Kaydedildi", "Banka hesabı güncellendi.");
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Banka hesabı kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const islem = async (hesap, action) => {
    if (action === "delete" && !window.confirm(`${hesap.bank_name} hesabı silinsin mi?`)) return;
    if (!(await ensure())) return;
    try {
      await api(`/api/admin/bank-accounts/${hesap.id}`, { method: "POST", body: JSON.stringify({ action }) });
      await yukle();
      onNotice("Tamam", action === "delete" ? "Hesap silindi." : "Hesap durumu değişti.");
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "İşlem tamamlanamadı");
    }
  };

  return (
    <>
      <Section title={form.id ? "Kurum hesabını düzenle" : "Yeni kurum hesabı"} note="Para yatırma ekranında müşterilere bu hesaplar gösterilir"
        action={form.id ? <button className="ac-ghost" onClick={() => setForm(BOS_BANKA)}>Yeni hesap</button> : null}>
        <div className="ac-form">
          <Field label="Banka adı"><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></Field>
          <Field label="Hesap sahibi"><Input value={form.account_holder} onChange={(e) => setForm({ ...form, account_holder: e.target.value })} /></Field>
          <Field label="IBAN" wide><Input value={form.iban} placeholder="TR00 0000 0000 0000 0000 0000 00" onChange={(e) => setForm({ ...form, iban: e.target.value })} /></Field>
          <Field label="Şube"><Input value={form.branch_name} onChange={(e) => setForm({ ...form, branch_name: e.target.value })} /></Field>
          <Field label="Sıra"><Input inputMode="numeric" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></Field>
          <Field label="Açıklama" wide><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Durum"><Select value={String(form.is_active)} onChange={(v) => setForm({ ...form, is_active: v })} options={[["1", "Aktif"], ["0", "Pasif"]]} /></Field>
        </div>
        <button className="confirm" disabled={busy} onClick={kaydet}>{busy ? "Kaydediliyor…" : form.id ? "Hesabı güncelle" : "Hesabı ekle"}</button>
      </Section>

      <Section title="Kurum hesapları" note={`${veri.system_bank_accounts?.length || 0} hesap`}>
        <div className="ac-list">
          {(veri.system_bank_accounts || []).map((hesap) => (
            <div className="ac-line" key={hesap.id}>
              <span>
                <strong>{hesap.bank_name} {Number(hesap.is_active) ? "" : "· pasif"}</strong>
                <small>{hesap.account_holder} · {hesap.iban}{hesap.branch_name ? ` · ${hesap.branch_name}` : ""}</small>
              </span>
              <b className="ac-line-actions">
                <button className="ac-ghost" onClick={() => setForm({ ...BOS_BANKA, ...hesap, is_active: String(hesap.is_active ?? 1) })}>Düzenle</button>
                <button className="ac-ghost" onClick={() => islem(hesap, "toggle")}>{Number(hesap.is_active) ? "Pasifleştir" : "Aktifleştir"}</button>
                <button className="ac-danger small" onClick={() => islem(hesap, "delete")}>Sil</button>
              </b>
            </div>
          ))}
          {!(veri.system_bank_accounts || []).length && <div className="ac-line"><span><strong>Hesap yok</strong><small>Henüz kurum hesabı tanımlanmamış</small></span></div>}
        </div>
      </Section>

      <Section title="Müşteri IBAN'ları" note={`${veri.user_bank_accounts?.length || 0} kayıt`}>
        <div className="ac-list scroll">
          {(veri.user_bank_accounts || []).map((hesap) => (
            <div className="ac-line" key={hesap.id}>
              <span><strong>{hesap.full_name || hesap.account_holder}</strong><small>{hesap.bank_name} · {hesap.iban}</small></span>
            </div>
          ))}
          {!(veri.user_bank_accounts || []).length && <div className="ac-line"><span><strong>Kayıt yok</strong><small>Müşteriler henüz IBAN eklememiş</small></span></div>}
        </div>
      </Section>
    </>
  );
}

/* ---------- sistem ayarları ---------- */

const AYAR_ADLARI = {
  t2_enabled: "T+2 sistemi (1 açık / 0 kapalı)",
  commission_rate: "Komisyon oranı",
  minimum_deposit: "En az para yatırma",
  minimum_withdraw: "En az para çekme",
  trading_open: "Seans açılış (dakika)",
  trading_close: "Seans kapanış (dakika)",
  maintenance_mode: "Bakım modu",
};

function SettingsPanel({ settings, onNotice, ensure, refresh }) {
  const [draft, setDraft] = useState(settings || {});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDraft(settings || {}); }, [settings]);

  const duzenlenebilir = useMemo(
    () => Object.keys(draft).filter((key) => /^(trading_|maintenance_|credit_|t2_|commission_|minimum_|official_|brand_|ui_|content_)/.test(key)).sort(),
    [draft],
  );

  const kaydet = async () => {
    if (!(await ensure())) return;
    setBusy(true);
    try {
      const gonderilecek = Object.fromEntries(duzenlenebilir.map((key) => [key, String(draft[key] ?? "")]));
      await api("/api/admin/system-settings", { method: "POST", body: JSON.stringify(gonderilecek) });
      await refresh();
      onNotice("Kaydedildi", "Sistem ayarları güncellendi.");
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Ayarlar kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Sistem ayarları" note={`${duzenlenebilir.length} ayar doğrudan değiştirilebilir`}>
      <div className="ac-form">
        {duzenlenebilir.map((key) => (
          <Field key={key} label={AYAR_ADLARI[key] || key} wide={String(draft[key] || "").length > 28}>
            <Input value={draft[key] ?? ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
          </Field>
        ))}
        {!duzenlenebilir.length && <span className="ac-empty">Ayar bulunamadı.</span>}
      </div>
      <button className="confirm" disabled={busy} onClick={kaydet}>{busy ? "Kaydediliyor…" : "Ayarları kaydet"}</button>
    </Section>
  );
}

/* ---------- onay kuyrukları ---------- */

function ApprovalList({ title, note, items, render, onAct, ensure, onNotice, refresh, reasonRequired }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(0);
  const calistir = async (item, action) => {
    const gerekce = reason.trim();
    if (reasonRequired && gerekce.length < 8) return onNotice("Gerekçe kısa", "Onay veya ret için en az 8 karakter gerekçe yaz.");
    if (!(await ensure())) return;
    setBusy(item.id);
    try {
      await onAct(item, action, gerekce || "Admin kararı");
      await refresh();
      setReason("");
      onNotice("Tamam", action === "approve" ? "Onaylandı." : "Reddedildi.");
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "İşlem tamamlanamadı");
    } finally {
      setBusy(0);
    }
  };
  return (
    <Section title={title} note={note}>
      {reasonRequired && (
        <div className="ac-form">
          <Field label="Gerekçe (onay/ret için zorunlu, en az 8 karakter)" wide>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn: Dekont doğrulandı" />
          </Field>
        </div>
      )}
      <div className="ac-list scroll">
        {items.length === 0 && <div className="ac-line"><span><strong>Kayıt yok</strong><small>Bekleyen bir şey yok</small></span></div>}
        {items.map((item) => (
          <div className="ac-line" key={item.id}>
            {render(item)}
            {item.status === "pending" && (
              <b className="ac-line-actions">
                <button className="ac-ghost" disabled={busy === item.id} onClick={() => calistir(item, "approve")}>Onayla</button>
                <button className="ac-danger small" disabled={busy === item.id} onClick={() => calistir(item, "reject")}>Reddet</button>
              </b>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------- konsol ---------- */

const TABS = ["Özet", "Müşteriler", "Emirler", "Para", "Bankalar", "Belgeler", "Sistem"];

export default function AdminConsole({ data, refresh, logout, onClose }) {
  const [tab, setTab] = useState("Özet");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState(null);
  const [documents, setDocuments] = useState([]);
  const lock = useLock();
  const dark = useDarkTheme();

  const onNotice = (baslik, metin) => setNotice({ baslik, metin });

  const summary = data?.summary || {};
  const users = data?.users || [];
  const orders = data?.orders || [];
  const moneyReqs = data?.money_requests || [];
  const settings = data?.system_settings || {};

  useEffect(() => {
    if (tab !== "Belgeler") return;
    api("/api/admin/documents").then((veri) => setDocuments(veri.documents || [])).catch(() => setDocuments([]));
  }, [tab]);

  const suzulmus = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return users;
    return users.filter((user) =>
      [user.full_name, user.email, user.account_no, user.phone, user.tc]
        .some((alan) => String(alan || "").toLocaleLowerCase("tr-TR").includes(needle)));
  }, [users, query]);

  const bekleyenPara = moneyReqs.filter((m) => m.status === "pending").reduce((sum, m) => sum + Number(m.amount || 0), 0);

  return (
    <div className={`stage admin-stage${dark ? " dark-mode" : ""}`}><div className="phone admin-phone"><main className="screen scroll admin-screen ac-root">
      <div className="section-title">
        <h2>Admin Paneli</h2>
        <b>
          <button onClick={onClose}>Müşteri görünümü</button>
          <button onClick={logout}>Çıkış</button>
        </b>
      </div>
      <div className="ac-lockbar">
        <span className={lock.gecerli() ? "on" : ""}>{lock.gecerli() ? "Yönetici kilidi açık" : "Yönetici kilidi kapalı"}</span>
        {!lock.gecerli() && <button className="ac-ghost" onClick={() => lock.ensure()}>Kilidi aç</button>}
      </div>

      <div className="segments admin-tabs">
        {TABS.map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}</button>)}
      </div>

      <div className="admin-grid">
        <article><span>Kullanıcı</span><strong>{summary.users_total ?? users.length}</strong></article>
        <article><span>Bekleyen emir</span><strong>{orders.filter((o) => o.status === "pending").length}</strong></article>
        <article><span>Bekleyen para</span><strong>{money(bekleyenPara)}</strong></article>
        <article><span>Toplam nakit</span><strong>{money(summary.cash_total || 0)}</strong></article>
      </div>

      {tab === "Özet" && (
        <Section title="Hızlı bakış" note="Tüm yetkiler bu paneldedir">
          <div className="ac-list">
            {[
              ["Müşteriler", "Kimlik, iletişim, durum, bakiye ve portföy değişikliği"],
              ["Emirler", "Bekleyen emirleri gerekçeyle onayla ya da reddet"],
              ["Para", "Yatırma ve çekme taleplerini yönet"],
              ["Bankalar", "Kurum IBAN'larını ekle, düzenle, sil"],
              ["Belgeler", "Kimlik belgelerini onayla ya da yeniden iste"],
              ["Sistem", "T+2, komisyon, limit ve içerik ayarları"],
            ].map(([ad, aciklama]) => (
              <button className="ac-line" key={ad} onClick={() => setTab(ad)}>
                <span><strong>{ad}</strong><small>{aciklama}</small></span>
                <b className="ac-chevron">›</b>
              </button>
            ))}
          </div>
        </Section>
      )}

      {tab === "Müşteriler" && (
        <Section title="Müşteriler" note={`${suzulmus.length} kayıt · karta dokunup her alanı değiştirebilirsin`}>
          <div className="ac-form">
            <Field label="Ara" wide><Input value={query} placeholder="Ad, e-posta, müşteri no, telefon" onChange={(e) => setQuery(e.target.value)} /></Field>
          </div>
          <div className="ac-list scroll">
            {suzulmus.map((user) => (
              <button className="ac-line" key={user.id} onClick={() => setSelected(user)}>
                <span>
                  <strong>{user.full_name}</strong>
                  <small>{user.status_label || user.status} · {user.account_no} · {money(user.cash_balance || 0)}</small>
                </span>
                <b className="ac-chevron">›</b>
              </button>
            ))}
            {!suzulmus.length && <div className="ac-line"><span><strong>Kayıt yok</strong><small>Aramaya uyan müşteri bulunamadı</small></span></div>}
          </div>
        </Section>
      )}

      {tab === "Emirler" && (
        <ApprovalList
          title="Emir kontrol" note={`${orders.length} emir`} items={orders} reasonRequired
          ensure={lock.ensure} onNotice={onNotice} refresh={refresh}
          render={(o) => (
            <span>
              <strong>{o.symbol} · {o.side_label || o.side}</strong>
              <small>{o.full_name} · {o.quantity} lot · {money(o.total)} · {o.status_label || o.status}</small>
            </span>
          )}
          onAct={(o, action, reason) => api(`/api/admin/orders/${o.id}/${action}`, { method: "POST", body: JSON.stringify({ reason }) })}
        />
      )}

      {tab === "Para" && (
        <ApprovalList
          title="Para talepleri" note={`${moneyReqs.length} talep`} items={moneyReqs} reasonRequired
          ensure={lock.ensure} onNotice={onNotice} refresh={refresh}
          render={(m) => (
            <span>
              <strong>{m.type_label || m.request_type} · {money(m.amount)}</strong>
              <small>{m.full_name} · {m.status_label || m.status}</small>
            </span>
          )}
          onAct={(m, action, reason) => api(`/api/admin/money/${m.id}/${action}`, { method: "POST", body: JSON.stringify({ reason }) })}
        />
      )}

      {tab === "Bankalar" && <BankPanel onNotice={onNotice} ensure={lock.ensure} />}

      {tab === "Belgeler" && (
        <ApprovalList
          title="Kimlik belgeleri" note={`${documents.length} belge`} items={documents} reasonRequired
          ensure={lock.ensure} onNotice={onNotice}
          refresh={() => api("/api/admin/documents").then((veri) => setDocuments(veri.documents || [])).catch(() => {})}
          render={(d) => (
            <span>
              <strong>{d.doc_type_label || d.doc_type}</strong>
              <small>{d.full_name} · {d.status_label || d.status}</small>
            </span>
          )}
          onAct={(d, action, note) => api(`/api/admin/documents/${d.id}/${action}`, { method: "POST", body: JSON.stringify({ note }) })}
        />
      )}

      {tab === "Sistem" && <SettingsPanel settings={settings} onNotice={onNotice} ensure={lock.ensure} refresh={refresh} />}

      {selected && (
        <UserEditor
          user={selected}
          onClose={() => setSelected(null)}
          onNotice={onNotice}
          ensure={lock.ensure}
          refresh={refresh}
        />
      )}

      {lock.soru && <LockDialog onSubmit={lock.dogrula} onCancel={lock.iptal} />}

      {notice && (
        <div className="modal-layer" onClick={() => setNotice(null)}>
          <section className="trade-modal readable-modal ac-notice" onClick={(e) => e.stopPropagation()}>
            <h2>{notice.baslik}</h2>
            <p className="subtle-count">{notice.metin}</p>
            <button className="confirm" onClick={() => setNotice(null)}>Tamam</button>
          </section>
        </div>
      )}
    </main><div className="home-indicator" /></div></div>
  );
}
