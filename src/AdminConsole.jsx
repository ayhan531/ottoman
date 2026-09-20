// Tam yetkili yönetim konsolu: müşteri, bakiye, pozisyon, banka, emir, para,
// belge, T+2 ve sistem ayarlarının tamamı buradan değiştirilir.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./esube/store.js";
import { gecerliTc, tcHatasi } from "./esube/kimlik.js";
import Icon from "./esube/icons.jsx";

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
  const [yeniSifre, setYeniSifre] = useState("");

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

  const sifreDegistir = () => {
    if (yeniSifre.length < 10) {
      onNotice("Şifre kısa", "En az 10 karakter, büyük harf, küçük harf ve rakam içermeli.");
      return undefined;
    }
    return calistir("sifre", async () => {
      await api(`/api/admin/users/${user.id}/password`, { method: "POST", body: JSON.stringify({ password: yeniSifre }) });
      setYeniSifre("");
    });
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

        <Section title="Kimlik ve giriş" note="T.C. kimlik numarası kayıt sırasında algoritmayla doğrulanır">
          <div className="ac-list">
            <div className="ac-line">
              <span>
                <strong>
                  T.C. {user.tc || user.tc_masked || "—"}
                  {user.tc_valid === false && <em className="ac-rozet kirmizi">algoritmaya uymuyor</em>}
                  {user.tc_valid === true && <em className="ac-rozet mor">doğrulandı</em>}
                </strong>
                <small>Müşteri no {user.account_no} · kayıt {user.created_at || ""}</small>
              </span>
            </div>
          </div>
          <div className="ac-form">
            <Field label="Yeni şifre (en az 10 karakter, büyük-küçük harf ve rakam)" wide>
              <Input value={yeniSifre} onChange={(e) => setYeniSifre(e.target.value)} placeholder="Yeni şifre" />
            </Field>
          </div>
          <button className="ac-ghost" disabled={busy === "sifre"} onClick={sifreDegistir}>
            {busy === "sifre" ? "Değiştiriliyor…" : "Şifreyi değiştir ve oturumları kapat"}
          </button>
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

const kopyala = async (metin) => {
  try { await navigator.clipboard.writeText(metin); return true; } catch { return false; }
};

function BankaKarti({ hesap, ilk, son, onDuzenle, onIslem, onTasi }) {
  return (
    <article className="bk-card">
      <header>
        <h4>{hesap.bank_name}{Number(hesap.is_active) ? "" : <em className="bk-pasif">Pasif</em>}</h4>
        <div className="bk-araclar">
          <button className="bk-ok" disabled={ilk} onClick={() => onTasi(hesap, -1)} aria-label="Yukarı taşı">↑</button>
          <button className="bk-ok" disabled={son} onClick={() => onTasi(hesap, 1)} aria-label="Aşağı taşı">↓</button>
          <button className="bk-duzenle" onClick={() => onDuzenle(hesap)} aria-label="Düzenle">✎</button>
          <button className="bk-sil" onClick={() => onIslem(hesap, "delete")} aria-label="Sil">🗑</button>
        </div>
      </header>
      <dl>
        <div><dt>IBAN:</dt><dd>{hesap.iban}</dd></div>
        <div><dt>Hesap Sahibi:</dt><dd>{hesap.account_holder}</dd></div>
        {hesap.branch_name && <div><dt>Şube:</dt><dd>{hesap.branch_name}</dd></div>}
        {hesap.description && (
          <div className="bk-aciklama">
            <dt>Açıklama:</dt>
            <dd>{hesap.description}</dd>
            <button className="ac-ghost bk-kopya" onClick={() => kopyala(hesap.description)}>Kopyala</button>
          </div>
        )}
      </dl>
      <footer>
        <button className="ac-ghost" onClick={() => onIslem(hesap, "toggle")}>
          {Number(hesap.is_active) ? "Pasifleştir" : "Aktifleştir"}
        </button>
      </footer>
    </article>
  );
}

function BankaFormu({ form, setForm, onKaydet, onIptal, busy }) {
  return (
    <div className="modal-layer">
      <section className="trade-modal readable-modal bk-modal">
        <button className="close" onClick={onIptal} aria-label="Kapat">×</button>
        <h2>{form.id ? "Hesap Düzenle" : "Yeni Hesap"}</h2>
        <div className="ac-form">
          <Field label="Banka Adı *" wide><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></Field>
          <Field label="IBAN *" wide><Input value={form.iban} placeholder="TR00 0000 0000 0000 0000 0000 00" onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase() })} /></Field>
          <Field label="Hesap Sahibi *" wide><Input value={form.account_holder} onChange={(e) => setForm({ ...form, account_holder: e.target.value })} /></Field>
          <Field label="Şube Adı" wide><Input value={form.branch_name} onChange={(e) => setForm({ ...form, branch_name: e.target.value })} /></Field>
          <Field label="Açıklama" wide><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Sıra"><Input inputMode="numeric" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></Field>
          <Field label="Aktif">
            <Select value={String(form.is_active)} onChange={(v) => setForm({ ...form, is_active: v })} options={[["1", "Aktif"], ["0", "Pasif"]]} />
          </Field>
        </div>
        <div className="ac-actions">
          <button className="ac-ghost" onClick={onIptal}>İptal</button>
          <button className="confirm" disabled={busy} onClick={onKaydet}>{busy ? "Kaydediliyor…" : form.id ? "Güncelle" : "Ekle"}</button>
        </div>
      </section>
    </div>
  );
}

function BankPanel({ onNotice, ensure }) {
  const [veri, setVeri] = useState({ system_bank_accounts: [], user_bank_accounts: [] });
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const yukle = useCallback(async () => {
    try { setVeri(await api("/api/admin/bank-accounts")); } catch { /* yoksay */ }
  }, []);
  useEffect(() => { yukle(); }, [yukle]);

  const hesaplar = veri.system_bank_accounts || [];

  const kaydet = async () => {
    if (!form.bank_name.trim() || !form.account_holder.trim() || !form.iban.trim()) {
      return onNotice("Eksik bilgi", "Banka adı, IBAN ve hesap sahibi zorunlu.");
    }
    if (!(await ensure())) return;
    setBusy(true);
    try {
      await api("/api/admin/bank-accounts", { method: "POST", body: JSON.stringify(form) });
      setForm(null);
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

  // Sıralama: komşu hesapla sort_order değerleri takas edilir.
  const tasi = async (hesap, yon) => {
    const sira = hesaplar.findIndex((x) => x.id === hesap.id);
    const komsu = hesaplar[sira + yon];
    if (!komsu) return;
    if (!(await ensure())) return;
    try {
      await api("/api/admin/bank-accounts", { method: "POST", body: JSON.stringify({ ...hesap, sort_order: sira + yon }) });
      await api("/api/admin/bank-accounts", { method: "POST", body: JSON.stringify({ ...komsu, sort_order: sira }) });
      await yukle();
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Sıra değiştirilemedi");
    }
  };

  return (
    <>
      <Section
        title="Banka Hesapları"
        note="Para yatırma için kullanılan sistem banka hesapları"
        action={<button className="confirm bk-yeni" onClick={() => setForm({ ...BOS_BANKA, sort_order: hesaplar.length })}>+ Yeni Hesap</button>}
      >
        <div className="bk-list">
          {hesaplar.map((hesap, index) => (
            <BankaKarti
              key={hesap.id}
              hesap={hesap}
              ilk={index === 0}
              son={index === hesaplar.length - 1}
              onDuzenle={(h) => setForm({ ...BOS_BANKA, ...h, is_active: String(h.is_active ?? 1) })}
              onIslem={islem}
              onTasi={tasi}
            />
          ))}
          {!hesaplar.length && <div className="ac-line"><span><strong>Hesap yok</strong><small>Henüz kurum hesabı tanımlanmamış</small></span></div>}
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

      {form && <BankaFormu form={form} setForm={setForm} onKaydet={kaydet} onIptal={() => setForm(null)} busy={busy} />}
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

/* ---------- ortak yardımcılar ---------- */

/** Bir uçtan veri çeker, yenileme düğmesi için reload verir. */
function useEndpoint(url, key, bagimlilik = []) {
  const [items, setItems] = useState([]);
  const [durum, setDurum] = useState("loading");
  const load = useCallback(async () => {
    setDurum("loading");
    try {
      const veri = await api(url);
      setItems(veri[key] || []);
      setDurum("ok");
    } catch {
      setItems([]);
      setDurum("failed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key]);
  useEffect(() => { load(); }, [load, ...bagimlilik]);
  return { items, durum, reload: load, setItems };
}

/** Arama kutusu + kayıt sayısı. */
function AraSatiri({ value, onChange, placeholder, sag }) {
  return (
    <div className="ac-toolbar">
      <input className="ac-search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {sag}
    </div>
  );
}

const fold = (value) => String(value || "").toLocaleLowerCase("tr-TR");
const eslesir = (item, alanlar, needle) =>
  !needle || alanlar.some((alan) => fold(item[alan]).includes(needle));

function Satir({ ust, alt, sag, onClick, rozet }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className="ac-line" onClick={onClick}>
      <span>
        <strong>{ust} {rozet}</strong>
        <small>{alt}</small>
      </span>
      {sag ? <b className="ac-line-actions">{sag}</b> : onClick ? <b className="ac-chevron">›</b> : null}
    </Tag>
  );
}

const Bos = ({ metin = "Kayıt yok" }) => <div className="ac-line"><span><strong>{metin}</strong><small>Bu listede gösterilecek bir şey yok</small></span></div>;

/* ---------- 1. Dashboard ---------- */

function Dashboard({ summary, users, orders, moneyReqs, onGit }) {
  const onayli = users.filter((u) => u.status === "approved").length;
  const bekleyenOnay = users.filter((u) => u.status !== "approved" && u.status !== "rejected").length
    + orders.filter((o) => o.status === "pending").length
    + moneyReqs.filter((m) => m.status === "pending").length;
  const oran = users.length ? Math.round((onayli / users.length) * 100) : 0;
  const sahteTc = users.filter((u) => u.tc_valid === false).length;
  const sonIslemler = orders.slice(0, 6);

  return (
    <>
      <Section title="Sistem genel görünümü" note="Panelden değiştirilemeyen hiçbir şey yok">
        <div className="ac-cards">
          <article className="mavi"><span>Toplam Kullanıcı</span><strong>{summary.users ?? users.length}</strong></article>
          <article className="sari"><span>Bekleyen Onay</span><strong>{bekleyenOnay}</strong></article>
          <article className="yesil"><span>Onaylı Kullanıcı</span><strong>{onayli}</strong></article>
          <article className="mor"><span>Toplam İşlem</span><strong>{orders.length}</strong></article>
          <article><span>Toplam Nakit</span><strong>{money(summary.cash_total || 0)}</strong></article>
          <article><span>Bloke Bakiye</span><strong>{money(summary.blocked_total || 0)}</strong></article>
          <article><span>T+2 Bekleyen</span><strong>{money(summary.pending_balance_total || 0)}</strong></article>
          <article className={sahteTc ? "kirmizi" : ""}><span>Şüpheli T.C.</span><strong>{sahteTc}</strong></article>
        </div>
      </Section>

      <Section title="Son İşlemler" note={`${orders.length} emir kaydı`} action={<button className="ac-ghost" onClick={() => onGit("Emirler")}>Tümü</button>}>
        <div className="ac-list">
          {sonIslemler.map((o) => (
            <Satir key={o.id}
              ust={`${o.symbol} · ${o.quantity} adet`}
              alt={`${o.full_name} · ${o.status_label || o.status}`}
              sag={<em className={o.side === "buy" ? "ac-al" : "ac-sat"}>{money(o.total)} {o.side === "buy" ? "ALIŞ" : "SATIŞ"}</em>}
            />
          ))}
          {!sonIslemler.length && <Bos metin="Henüz işlem yok" />}
        </div>
      </Section>

      <Section title="Onay Oranı">
        <div className="ac-cards">
          <article><span>Onay Oranı</span><strong>{oran}%</strong></article>
          <article className="sari"><span>Bekleyen</span><strong>{bekleyenOnay}</strong></article>
          <article><span>Bekleyen Emir</span><strong>{summary.pending_orders ?? 0}</strong></article>
          <article><span>Bekleyen Para</span><strong>{summary.pending_money ?? 0}</strong></article>
        </div>
      </Section>
    </>
  );
}

/* ---------- 2. Yeni müşteri ---------- */

function YeniMusteri({ onNotice, ensure, refresh, onKapat }) {
  const [form, setForm] = useState({ full_name: "", tc: "", phone: "", email: "", city: "", district: "", password: "", status: "approved", opening_balance: "" });
  const [busy, setBusy] = useState(false);
  const alan = (ad) => (e) => setForm((x) => ({ ...x, [ad]: e.target.value }));
  const tcTamam = gecerliTc(form.tc);

  const kaydet = async () => {
    if (!tcTamam) return onNotice("T.C. hatalı", "Girdiğin numara T.C. kimlik algoritmasına uymuyor.");
    if (!(await ensure())) return;
    setBusy(true);
    try {
      await api("/api/admin/create-user", { method: "POST", body: JSON.stringify({ ...form, opening_balance: Number(form.opening_balance || 0) }) });
      await refresh();
      onNotice("Müşteri açıldı", `${form.full_name} eklendi.`);
      onKapat();
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Müşteri oluşturulamadı");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-layer" onClick={onKapat}>
      <section className="trade-modal readable-modal ac-editor" onClick={(e) => e.stopPropagation()}>
        <h2>Yeni müşteri</h2>
        <div className="ac-form">
          <Field label="Ad Soyad" wide><Input value={form.full_name} onChange={alan("full_name")} placeholder="Ad Soyad" /></Field>
          <Field label="T.C. Kimlik No">
            <Input inputMode="numeric" maxLength={11} value={form.tc} placeholder="11 haneli"
              className={form.tc.length === 11 ? (tcTamam ? "tc-ok" : "tc-hatali") : ""}
              onChange={(e) => setForm((x) => ({ ...x, tc: e.target.value.replace(/\D/g, "") }))} />
            {form.tc.length === 11 && <small className={tcTamam ? "alan-tamam" : "alan-hata"}>{tcTamam ? "Doğrulandı" : tcHatasi(form.tc)}</small>}
          </Field>
          <Field label="Telefon"><Input value={form.phone} onChange={alan("phone")} placeholder="5xx xxx xx xx" /></Field>
          <Field label="E-posta"><Input value={form.email} onChange={alan("email")} placeholder="ornek@eposta.com" /></Field>
          <Field label="İl"><Input value={form.city} onChange={alan("city")} /></Field>
          <Field label="İlçe"><Input value={form.district} onChange={alan("district")} /></Field>
          <Field label="Şifre"><Input value={form.password} onChange={alan("password")} placeholder="En az 10 karakter" /></Field>
          <Field label="Açılış bakiyesi (₺)"><Input inputMode="decimal" value={form.opening_balance} onChange={alan("opening_balance")} placeholder="0" /></Field>
          <Field label="Durum"><Select value={form.status} onChange={(v) => setForm((x) => ({ ...x, status: v }))} options={STATUS} /></Field>
        </div>
        <div className="ac-actions">
          <button className="ac-ghost" onClick={onKapat}>Vazgeç</button>
          <button className="confirm" disabled={busy} onClick={kaydet}>{busy ? "Açılıyor…" : "Müşteriyi aç"}</button>
        </div>
      </section>
    </div>
  );
}

/* ---------- 3. Kullanıcılar ---------- */

function UsersPanel({ users, onSec, onNotice, ensure, refresh }) {
  const [query, setQuery] = useState("");
  const [durum, setDurum] = useState("hepsi");
  const [yeni, setYeni] = useState(false);

  const liste = useMemo(() => {
    const needle = fold(query);
    return users.filter((u) =>
      (durum === "hepsi" || u.status === durum) &&
      (durum !== "supheli" || u.tc_valid === false) &&
      eslesir(u, ["full_name", "email", "account_no", "phone", "tc"], needle));
  }, [users, query, durum]);

  const supheli = users.filter((u) => u.tc_valid === false).length;

  return (
    <>
      <Section
        title="Kullanıcılar"
        note={`${liste.length} kayıt${supheli ? ` · ${supheli} şüpheli T.C.` : ""} · karta dokunup her alanı değiştirebilirsin`}
        action={<button className="ac-ghost" onClick={() => setYeni(true)}>+ Yeni müşteri</button>}
      >
        <AraSatiri value={query} onChange={setQuery} placeholder="Ad, e-posta, müşteri no, telefon, T.C." />
        <div className="ac-chips">
          {[["hepsi", "Hepsi"], ["approved", "Onaylı"], ["pending", "Beklemede"], ["under_review", "İncelemede"], ["rejected", "Reddedildi"], ["supheli", "Şüpheli T.C."]].map(([k, ad]) => (
            <button key={k} className={durum === k ? "on" : ""} onClick={() => setDurum(k)}>{ad}</button>
          ))}
        </div>
        <div className="ac-list scroll">
          {liste.map((user) => (
            <Satir key={user.id}
              ust={user.full_name}
              rozet={user.tc_valid === false ? <em className="ac-rozet kirmizi">şüpheli T.C.</em> : null}
              alt={`${user.status_label || user.status} · ${user.account_no} · ${user.tc_masked || ""} · ${money(user.cash_balance || 0)}`}
              onClick={() => onSec(user)}
            />
          ))}
          {!liste.length && <Bos metin="Aramaya uyan müşteri yok" />}
        </div>
      </Section>
      {yeni && <YeniMusteri onNotice={onNotice} ensure={ensure} refresh={refresh} onKapat={() => setYeni(false)} />}
    </>
  );
}

/* ---------- 4. Portföyler ---------- */

function PortfolioPanel({ onNotice, ensure }) {
  const { items, reload } = useEndpoint("/api/admin/positions", "positions");
  const [query, setQuery] = useState("");
  const liste = useMemo(() => {
    const needle = fold(query);
    return items.filter((p) => eslesir(p, ["symbol", "full_name"], needle));
  }, [items, query]);

  const toplamDeger = liste.reduce((sum, p) => sum + Number(p.market_value || 0), 0);
  const kisiler = new Set(liste.map((p) => p.user_id)).size;

  const sil = async (p) => {
    if (!(await ensure())) return;
    try {
      await api("/api/admin/positions", { method: "POST", body: JSON.stringify({ user_id: p.user_id, symbol: p.symbol, action: "set", quantity: 0, price: p.avg_price, note: "Admin sildi" }) });
      await reload();
      onNotice("Silindi", `${p.symbol} pozisyonu kaldırıldı.`);
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Pozisyon silinemedi");
    }
  };

  return (
    <Section title="Portföy Yönetimi" note="Kullanıcı portföylerini görüntüle ve düzenle" action={<button className="ac-ghost" onClick={reload}>Yenile</button>}>
      <AraSatiri value={query} onChange={setQuery} placeholder="Hisse kodu, isim veya kullanıcı ara…" />
      <div className="ac-cards">
        <article><span>Toplam Kullanıcı</span><strong>{kisiler}</strong></article>
        <article><span>Toplam Pozisyon</span><strong>{liste.length}</strong></article>
        <article className="mor"><span>Toplam Değer</span><strong>{money(toplamDeger)}</strong></article>
      </div>
      <div className="ac-list scroll">
        {liste.map((p) => (
          <Satir key={`${p.user_id}-${p.symbol}`}
            ust={`${p.symbol} · ${p.quantity} adet`}
            alt={`${p.full_name} · maliyet ${money(p.avg_price)} · değer ${money(p.market_value)} · K/Z ${money(p.pnl)}`}
            sag={<button className="ac-danger small" onClick={() => sil(p)}>Sil</button>}
          />
        ))}
        {!liste.length && <Bos metin="Pozisyon yok" />}
      </div>
    </Section>
  );
}

/* ---------- 5. Bakiye detayları ---------- */

function BalancePanel({ onSec }) {
  const { items, reload } = useEndpoint("/api/admin/user-balances", "balances");
  const [query, setQuery] = useState("");
  const liste = useMemo(() => {
    const needle = fold(query);
    return items.filter((b) => eslesir(b, ["full_name", "account_no", "email"], needle));
  }, [items, query]);
  const topla = (alan) => liste.reduce((sum, b) => sum + Number(b[alan] || 0), 0);

  return (
    <Section title="Bakiye Detayları" note="Nakit, bloke, T+2 ve kredi limiti" action={<button className="ac-ghost" onClick={reload}>Yenile</button>}>
      <AraSatiri value={query} onChange={setQuery} placeholder="Müşteri ara…" />
      <div className="ac-cards">
        <article className="yesil"><span>Toplam Nakit</span><strong>{money(topla("cash_balance"))}</strong></article>
        <article className="sari"><span>Bloke</span><strong>{money(topla("blocked_balance"))}</strong></article>
        <article className="mavi"><span>T+2 Bekleyen</span><strong>{money(topla("pending_balance"))}</strong></article>
        <article className="mor"><span>Kredi Limiti</span><strong>{money(topla("credit_limit"))}</strong></article>
      </div>
      <div className="ac-list scroll">
        {liste.map((b) => (
          <Satir key={b.id}
            ust={`${b.full_name} · ${money(b.cash_balance)}`}
            alt={`${b.account_no} · bloke ${money(b.blocked_balance)} · T+2 ${money(b.pending_balance)} · kredi ${money(b.credit_limit)}`}
            onClick={onSec ? () => onSec(b) : undefined}
          />
        ))}
        {!liste.length && <Bos metin="Kayıt yok" />}
      </div>
    </Section>
  );
}

/* ---------- 6. Emirler ---------- */

function OrdersPanel({ orders, ensure, onNotice, refresh }) {
  const [query, setQuery] = useState("");
  const [durum, setDurum] = useState("pending");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(0);

  const liste = useMemo(() => {
    const needle = fold(query);
    return orders.filter((o) => (durum === "hepsi" || o.status === durum) && eslesir(o, ["symbol", "full_name"], needle));
  }, [orders, query, durum]);

  const calistir = async (order, action) => {
    const gerekce = reason.trim();
    if (gerekce.length < 8) return onNotice("Gerekçe kısa", "Onay veya ret için en az 8 karakter gerekçe yaz.");
    if (!(await ensure())) return;
    setBusy(order.id);
    try {
      await api(`/api/admin/orders/${order.id}/${action}`, { method: "POST", body: JSON.stringify({ reason: gerekce }) });
      await refresh();
      setReason("");
      onNotice("Tamam", action === "approve" ? "Emir onaylandı." : "Emir reddedildi.");
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "İşlem tamamlanamadı");
    } finally {
      setBusy(0);
    }
  };

  const toplam = liste.reduce((sum, o) => sum + Number(o.total || 0), 0);

  return (
    <Section title="Emirler" note={`${liste.length} emir · toplam ${money(toplam)}`}>
      <AraSatiri value={query} onChange={setQuery} placeholder="Hisse veya müşteri ara…" />
      <div className="ac-chips">
        {[["pending", "Bekleyen"], ["approved", "Onaylı"], ["filled", "Gerçekleşen"], ["rejected", "Reddedilen"], ["cancelled", "İptal"], ["hepsi", "Hepsi"]].map(([k, ad]) => (
          <button key={k} className={durum === k ? "on" : ""} onClick={() => setDurum(k)}>{ad}</button>
        ))}
      </div>
      <div className="ac-form">
        <Field label="Gerekçe (onay/ret için zorunlu, en az 8 karakter)" wide>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn: Piyasa fiyatı doğrulandı" />
        </Field>
      </div>
      <div className="ac-list scroll">
        {liste.map((o) => (
          <Satir key={o.id}
            ust={`${o.symbol} · ${o.side === "buy" ? "ALIŞ" : "SATIŞ"} · ${o.quantity} lot`}
            alt={`${o.full_name} · ${money(o.total)} · ${o.status_label || o.status}`}
            sag={o.status === "pending" ? (
              <>
                <button className="ac-ghost" disabled={busy === o.id} onClick={() => calistir(o, "approve")}>Onayla</button>
                <button className="ac-danger small" disabled={busy === o.id} onClick={() => calistir(o, "reject")}>Reddet</button>
              </>
            ) : null}
          />
        ))}
        {!liste.length && <Bos metin="Bu süzgeçte emir yok" />}
      </div>
    </Section>
  );
}

/* ---------- 7. Para talepleri (yatırma / çekme / kredi) ---------- */

function MoneyPanel({ moneyReqs, tur, baslik, not, ensure, onNotice, refresh }) {
  const [reason, setReason] = useState("");
  const [durum, setDurum] = useState("pending");
  const [busy, setBusy] = useState(0);

  const liste = useMemo(
    () => moneyReqs.filter((m) => (tur === "hepsi" || m.request_type === tur) && (durum === "hepsi" || m.status === durum)),
    [moneyReqs, tur, durum],
  );
  const toplam = liste.reduce((sum, m) => sum + Number(m.amount || 0), 0);

  const calistir = async (item, action) => {
    const gerekce = reason.trim();
    if (gerekce.length < 8) return onNotice("Gerekçe kısa", "Onay veya ret için en az 8 karakter gerekçe yaz.");
    if (!(await ensure())) return;
    setBusy(item.id);
    try {
      await api(`/api/admin/money/${item.id}/${action}`, { method: "POST", body: JSON.stringify({ reason: gerekce }) });
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
    <Section title={baslik} note={`${liste.length} talep · toplam ${money(toplam)} · ${not}`}>
      <div className="ac-chips">
        {[["pending", "Bekleyen"], ["approved", "Onaylı"], ["rejected", "Reddedilen"], ["hepsi", "Hepsi"]].map(([k, ad]) => (
          <button key={k} className={durum === k ? "on" : ""} onClick={() => setDurum(k)}>{ad}</button>
        ))}
      </div>
      <div className="ac-form">
        <Field label="Gerekçe (en az 8 karakter)" wide>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn: Dekont doğrulandı" />
        </Field>
      </div>
      <div className="ac-list scroll">
        {liste.map((m) => (
          <Satir key={m.id}
            ust={`${money(m.amount)} · ${m.type_label || m.request_type}`}
            alt={`${m.full_name} · ${m.status_label || m.status}${m.iban ? ` · ${m.iban}` : ""}`}
            sag={m.status === "pending" ? (
              <>
                <button className="ac-ghost" disabled={busy === m.id} onClick={() => calistir(m, "approve")}>Onayla</button>
                <button className="ac-danger small" disabled={busy === m.id} onClick={() => calistir(m, "reject")}>Reddet</button>
              </>
            ) : null}
          />
        ))}
        {!liste.length && <Bos metin="Talep yok" />}
      </div>
    </Section>
  );
}

/* ---------- 8. T+2 takip ---------- */

function T2Panel({ ensure, onNotice }) {
  const { items, reload } = useEndpoint("/api/admin/t2-settlements", "t2_settlements");
  const [durum, setDurum] = useState("pending");
  const [busy, setBusy] = useState(0);
  const liste = items.filter((t) => durum === "hepsi" || t.status === durum);
  const bekleyen = items.filter((t) => t.status === "pending").reduce((s, t) => s + Number(t.remaining_amount || 0), 0);

  const serbest = async (t) => {
    if (!(await ensure())) return;
    setBusy(t.id);
    try {
      await api(`/api/admin/t2-settlements/${t.id}`, { method: "POST", body: "{}" });
      await reload();
      onNotice("Serbest bırakıldı", `${money(t.remaining_amount)} nakde geçti.`);
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "İşlem tamamlanamadı");
    } finally {
      setBusy(0);
    }
  };

  return (
    <Section title="T+2 Takip" note={`Bekleyen ${money(bekleyen)} · vadesi gelenler kendiliğinden çözülür`} action={<button className="ac-ghost" onClick={reload}>Yenile</button>}>
      <div className="ac-chips">
        {[["pending", "Bekleyen"], ["settled", "Çözülen"], ["hepsi", "Hepsi"]].map(([k, ad]) => (
          <button key={k} className={durum === k ? "on" : ""} onClick={() => setDurum(k)}>{ad}</button>
        ))}
      </div>
      <div className="ac-list scroll">
        {liste.map((t) => (
          <Satir key={t.id}
            ust={`${money(t.display_amount)} · ${t.symbol || "nakit"}`}
            alt={`${t.full_name} · ${t.status_label || t.status} · ${t.created_at_label || ""}`}
            sag={t.status === "pending" ? <button className="ac-ghost" disabled={busy === t.id} onClick={() => serbest(t)}>Şimdi serbest bırak</button> : null}
          />
        ))}
        {!liste.length && <Bos metin="Kayıt yok" />}
      </div>
    </Section>
  );
}

/* ---------- 9. Onay bekleyenler ---------- */

function PendingPanel({ users, orders, moneyReqs, onGit }) {
  const bekleyenUsers = users.filter((u) => u.status === "pending" || u.status === "under_review" || u.status === "awaiting_back");
  const bekleyenOrders = orders.filter((o) => o.status === "pending");
  const bekleyenPara = moneyReqs.filter((m) => m.status === "pending");
  const kutular = [
    ["Müşteri onayı", bekleyenUsers.length, "Kullanıcılar"],
    ["Emir onayı", bekleyenOrders.length, "Emirler"],
    ["Para yatırma", bekleyenPara.filter((m) => m.request_type === "deposit").length, "Para Yatırma"],
    ["Para çekme", bekleyenPara.filter((m) => m.request_type === "withdraw").length, "Para Çekme"],
    ["Kredi", bekleyenPara.filter((m) => m.request_type === "credit").length, "Krediler"],
  ];
  return (
    <Section title="Onay Bekleyenler" note="Tek ekranda tüm kuyruklar">
      <div className="ac-cards">
        {kutular.map(([ad, sayi, hedef]) => (
          <article key={ad} className={sayi ? "sari" : ""} onClick={() => onGit(hedef)} style={{ cursor: "pointer" }}>
            <span>{ad}</span><strong>{sayi}</strong>
          </article>
        ))}
      </div>
      <div className="ac-list scroll">
        {bekleyenUsers.map((u) => <Satir key={`u${u.id}`} ust={`Müşteri · ${u.full_name}`} alt={`${u.account_no} · ${u.status_label || u.status}`} onClick={() => onGit("Kullanıcılar")} />)}
        {bekleyenOrders.map((o) => <Satir key={`o${o.id}`} ust={`Emir · ${o.symbol} ${o.quantity} lot`} alt={`${o.full_name} · ${money(o.total)}`} onClick={() => onGit("Emirler")} />)}
        {bekleyenPara.map((m) => <Satir key={`m${m.id}`} ust={`${m.type_label || m.request_type} · ${money(m.amount)}`} alt={m.full_name} onClick={() => onGit(m.request_type === "withdraw" ? "Para Çekme" : "Para Yatırma")} />)}
        {!bekleyenUsers.length && !bekleyenOrders.length && !bekleyenPara.length && <Bos metin="Bekleyen bir şey yok" />}
      </div>
    </Section>
  );
}

/* ---------- 10. Hisse isimleri ---------- */

function StockNamesPanel({ onNotice, ensure }) {
  const [kayitlar, setKayitlar] = useState([]);
  const [bilgi, setBilgi] = useState({ total: 0, edited: 0 });
  const [query, setQuery] = useState("");
  const [duzenlenen, setDuzenlenen] = useState(null);
  const [ad, setAd] = useState("");
  const [busy, setBusy] = useState(false);
  const [adet, setAdet] = useState(60);

  const yukle = useCallback(async () => {
    try {
      const veri = await api("/api/admin/stock-names");
      setKayitlar(veri.names || []);
      setBilgi({ total: veri.total || 0, edited: veri.edited || 0 });
    } catch {
      setKayitlar([]);
    }
  }, []);
  useEffect(() => { yukle(); }, [yukle]);
  useEffect(() => { setAdet(60); }, [query]);

  const liste = useMemo(() => {
    const needle = fold(query);
    return kayitlar.filter((k) => !needle || fold(k.symbol).includes(needle) || fold(k.name).includes(needle));
  }, [kayitlar, query]);

  const kaydet = async () => {
    if (!(await ensure())) return;
    setBusy(true);
    try {
      await api("/api/admin/stock-names", { method: "POST", body: JSON.stringify({ symbol: duzenlenen.symbol, name: ad.trim() }) });
      await yukle();
      onNotice("Kaydedildi", ad.trim() ? `${duzenlenen.symbol} artık “${ad.trim()}”.` : `${duzenlenen.symbol} borsadaki adına döndü.`);
      setDuzenlenen(null);
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Ad kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Hisse İsimleri" note={`Toplam ${bilgi.total} hisse · Düzenlenmiş: ${bilgi.edited}`} action={<button className="ac-ghost" onClick={yukle}>Yenile</button>}>
      <AraSatiri value={query} onChange={setQuery} placeholder="Hisse ara…" />
      <div className="ac-list scroll tall">
        {liste.slice(0, adet).map((k) => (
          <Satir key={k.symbol}
            ust={<><em className="ac-kod">{k.symbol}</em> {k.name}</>}
            rozet={k.custom ? <em className="ac-rozet mor">düzenlendi</em> : null}
            alt={k.custom ? `Panelden değiştirildi · ${k.updated_at}` : "Borsadan gelen ad"}
            sag={<button className="ac-ghost" onClick={() => { setDuzenlenen(k); setAd(k.custom ? k.name : ""); }}>Düzenle</button>}
          />
        ))}
        {liste.length > adet && (
          <button className="ac-line ac-more" onClick={() => setAdet((x) => x + 120)}>
            <span><strong>Daha fazla göster</strong><small>{liste.length - adet} hisse daha</small></span>
          </button>
        )}
        {!liste.length && <Bos metin="Hisse bulunamadı" />}
      </div>

      {duzenlenen && (
        <div className="modal-layer" onClick={() => setDuzenlenen(null)}>
          <section className="trade-modal readable-modal ac-notice" onClick={(e) => e.stopPropagation()}>
            <h2>{duzenlenen.symbol}</h2>
            <p className="subtle-count">Borsadaki adı: {duzenlenen.custom ? "—" : duzenlenen.name}</p>
            <Field label="Görünecek ad (boş bırakırsan borsadaki ada döner)" wide>
              <Input value={ad} onChange={(e) => setAd(e.target.value)} placeholder={duzenlenen.name} />
            </Field>
            <div className="ac-actions">
              <button className="ac-ghost" onClick={() => setDuzenlenen(null)}>Vazgeç</button>
              <button className="confirm" disabled={busy} onClick={kaydet}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>
            </div>
          </section>
        </div>
      )}
    </Section>
  );
}

/* ---------- 11. Hisse açıklamaları ---------- */

function StockDescPanel({ onNotice, ensure }) {
  const { items, reload } = useEndpoint("/api/admin/stock-descriptions", "descriptions");
  const [form, setForm] = useState({ symbol: "", description: "", risk_note: "" });
  const [busy, setBusy] = useState(false);

  const kaydet = async () => {
    if (!form.symbol.trim()) return onNotice("Kod gerekli", "Önce hisse kodunu yaz.");
    if (!(await ensure())) return;
    setBusy(true);
    try {
      await api("/api/admin/stock-descriptions", { method: "POST", body: JSON.stringify(form) });
      await reload();
      onNotice("Kaydedildi", `${form.symbol.toUpperCase()} açıklaması güncellendi.`);
      setForm({ symbol: "", description: "", risk_note: "" });
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Hisse Açıklamaları" note={`${items.length} açıklama · müşteri hisse kartında görür`}>
      <div className="ac-form">
        <Field label="Hisse kodu"><Input value={form.symbol} onChange={(e) => setForm((x) => ({ ...x, symbol: e.target.value.toUpperCase() }))} placeholder="THYAO" /></Field>
        <Field label="Risk notu"><Input value={form.risk_note} onChange={(e) => setForm((x) => ({ ...x, risk_note: e.target.value }))} placeholder="Örn: Yüksek dalgalanma" /></Field>
        <Field label="Açıklama" wide><Input value={form.description} onChange={(e) => setForm((x) => ({ ...x, description: e.target.value }))} placeholder="Şirket hakkında kısa bilgi" /></Field>
      </div>
      <button className="confirm" disabled={busy} onClick={kaydet}>{busy ? "Kaydediliyor…" : "Açıklamayı kaydet"}</button>
      <div className="ac-list scroll">
        {items.map((d) => (
          <Satir key={d.symbol} ust={d.symbol} alt={d.description || d.risk_note || "—"}
            sag={<button className="ac-ghost" onClick={() => setForm({ symbol: d.symbol, description: d.description || "", risk_note: d.risk_note || "" })}>Düzenle</button>} />
        ))}
        {!items.length && <Bos metin="Açıklama yok" />}
      </div>
    </Section>
  );
}

/* ---------- 12. Kredi ayarları ---------- */

const KREDI_ALANLARI = [
  ["credit_monthly_interest_rate", "Aylık faiz oranı (%)"],
  ["credit_loan_term_months", "Vade (ay)"],
  ["credit_late_interest_rate", "Gecikme faizi (%)"],
  ["credit_multiplier", "Kredi çarpanı (teminatın katı)"],
  ["credit_margin_call_ratio", "Teminat tamamlama oranı (%)"],
];

function CreditPanel({ settings, moneyReqs, ensure, onNotice, refresh }) {
  const [form, setForm] = useState(() => Object.fromEntries(KREDI_ALANLARI.map(([k]) => [k, settings[k] ?? ""])));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(Object.fromEntries(KREDI_ALANLARI.map(([k]) => [k, settings[k] ?? ""]))); }, [settings]);

  const kaydet = async () => {
    if (!(await ensure())) return;
    setBusy(true);
    try {
      await api("/api/admin/system-settings", { method: "POST", body: JSON.stringify({ settings: form }) });
      await refresh();
      onNotice("Kaydedildi", "Kredi ayarları güncellendi.");
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <MoneyPanel moneyReqs={moneyReqs} tur="credit" baslik="Kredi Başvuruları" not="limit talepleri" ensure={ensure} onNotice={onNotice} refresh={refresh} />
      <Section title="Kredi Ayarları" note="Faiz, vade ve teminat kuralları">
        <div className="ac-form">
          {KREDI_ALANLARI.map(([anahtar, etiket]) => (
            <Field key={anahtar} label={etiket}>
              <Input value={form[anahtar] ?? ""} onChange={(e) => setForm((x) => ({ ...x, [anahtar]: e.target.value }))} />
            </Field>
          ))}
        </div>
        <button className="confirm" disabled={busy} onClick={kaydet}>{busy ? "Kaydediliyor…" : "Kredi ayarlarını kaydet"}</button>
      </Section>
    </>
  );
}

/* ---------- 13. Denetim kaydı ---------- */

function AuditPanel() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const yukle = useCallback(async (arama) => {
    try {
      const veri = await api(`/api/admin/audit?q=${encodeURIComponent(arama || "")}`);
      setItems(veri.audit || []);
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => {
    const zaman = setTimeout(() => yukle(query), 250);
    return () => clearTimeout(zaman);
  }, [query, yukle]);

  return (
    <Section title="Denetim Kaydı" note={`${items.length} kayıt · her yönetici işlemi burada`} action={<a className="ac-ghost" href="/api/admin/reports/export?type=audit">CSV indir</a>}>
      <AraSatiri value={query} onChange={setQuery} placeholder="İşlem, varlık veya yetkili ara…" />
      <div className="ac-list scroll tall">
        {items.map((a) => (
          <Satir key={a.id} ust={`${a.action} · ${a.entity_type}`} alt={`${a.actor_name || "Sistem"} · ${a.created_at_label} · ${a.ip_address || ""} · ${a.reference}`} />
        ))}
        {!items.length && <Bos metin="Kayıt yok" />}
      </div>
    </Section>
  );
}

/* ---------- konsol ---------- */

/** Yan menü: referanstaki sırayla, gruplu. */
const MENU = [
  ["Genel", [["Dashboard", "grid"]]],
  ["Müşteri", [["Kullanıcılar", "user"], ["Portföyler", "portfolio"], ["Bakiye Detayları", "card"], ["Belgeler", "list"]]],
  ["İşlem", [["Emirler", "swap"], ["T+2 Takip", "clock"], ["Onay Bekleyenler", "check"]]],
  ["Para", [["Banka Hesapları", "bank"], ["Para Yatırma", "deposit"], ["Para Çekme", "withdraw"], ["Krediler", "wallet"]]],
  ["Piyasa", [["Hisse İsimleri", "table"], ["Hisse Açıklamaları", "message"]]],
  ["Sistem", [["Sistem Ayarları", "gear"], ["Denetim Kaydı", "shield"]]],
];
const TUM_SAYFALAR = MENU.flatMap(([, satirlar]) => satirlar.map(([ad]) => ad));

export default function AdminConsole({ data, refresh, logout, onClose }) {
  const [sayfa, setSayfa] = useState("Dashboard");
  const [menuAcik, setMenuAcik] = useState(false);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState(null);
  const [documents, setDocuments] = useState([]);
  const lock = useLock();
  const dark = useDarkTheme();

  const onNotice = (baslik, metin) => setNotice({ baslik, metin });
  const git = (hedef) => { setSayfa(TUM_SAYFALAR.includes(hedef) ? hedef : "Dashboard"); setMenuAcik(false); };

  const summary = data?.summary || {};
  const users = data?.users || [];
  const orders = data?.orders || [];
  const moneyReqs = data?.money_requests || [];
  const settings = data?.system_settings || {};

  const belgeleriYukle = useCallback(
    () => api("/api/admin/documents").then((veri) => setDocuments(veri.documents || [])).catch(() => setDocuments([])),
    [],
  );
  useEffect(() => { if (sayfa === "Belgeler") belgeleriYukle(); }, [sayfa, belgeleriYukle]);

  // Menü açıkken gövde kaymasın.
  useEffect(() => {
    if (!menuAcik) return undefined;
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = onceki; };
  }, [menuAcik]);

  const bekleyenSayilari = {
    "Kullanıcılar": users.filter((u) => u.status !== "approved" && u.status !== "rejected").length,
    "Emirler": orders.filter((o) => o.status === "pending").length,
    "Para Yatırma": moneyReqs.filter((m) => m.status === "pending" && m.request_type === "deposit").length,
    "Para Çekme": moneyReqs.filter((m) => m.status === "pending" && m.request_type === "withdraw").length,
    "Krediler": moneyReqs.filter((m) => m.status === "pending" && m.request_type === "credit").length,
    "Onay Bekleyenler": moneyReqs.filter((m) => m.status === "pending").length + orders.filter((o) => o.status === "pending").length,
  };

  return (
    <div className={`stage admin-stage${dark ? " dark-mode" : ""}`}><div className="phone admin-phone">
      <main className="screen scroll admin-screen ac-root">
        <header className="ac-top">
          <button className="ac-menu-btn" onClick={() => setMenuAcik(true)} aria-label="Menü">☰</button>
          <div className="ac-top-copy">
            <h2>{sayfa}</h2>
            <small>{sayfa === "Dashboard" ? "Sistem genel görünümü" : "Yönetim"}</small>
          </div>
          <div className="ac-top-actions">
            <button className="ac-ghost" onClick={onClose}>Müşteri görünümü</button>
            <button className="ac-danger small" onClick={logout}>Çıkış</button>
          </div>
        </header>

        <div className="ac-lockbar">
          <span className={lock.gecerli() ? "on" : ""}>{lock.gecerli() ? "Yönetici kilidi açık" : "Yönetici kilidi kapalı"}</span>
          {!lock.gecerli() && <button className="ac-ghost" onClick={() => lock.ensure()}>Kilidi aç</button>}
        </div>

        {sayfa === "Dashboard" && <Dashboard summary={summary} users={users} orders={orders} moneyReqs={moneyReqs} onGit={git} />}
        {sayfa === "Kullanıcılar" && <UsersPanel users={users} onSec={setSelected} onNotice={onNotice} ensure={lock.ensure} refresh={refresh} />}
        {sayfa === "Portföyler" && <PortfolioPanel onNotice={onNotice} ensure={lock.ensure} />}
        {sayfa === "Bakiye Detayları" && <BalancePanel onSec={(b) => setSelected(users.find((u) => u.id === b.id) || null)} />}
        {sayfa === "Emirler" && <OrdersPanel orders={orders} ensure={lock.ensure} onNotice={onNotice} refresh={refresh} />}
        {sayfa === "T+2 Takip" && <T2Panel ensure={lock.ensure} onNotice={onNotice} />}
        {sayfa === "Onay Bekleyenler" && <PendingPanel users={users} orders={orders} moneyReqs={moneyReqs} onGit={git} />}
        {sayfa === "Banka Hesapları" && <BankPanel onNotice={onNotice} ensure={lock.ensure} />}
        {sayfa === "Para Yatırma" && <MoneyPanel moneyReqs={moneyReqs} tur="deposit" baslik="Para Yatırma Talepleri" not="dekont doğrulanınca onayla" ensure={lock.ensure} onNotice={onNotice} refresh={refresh} />}
        {sayfa === "Para Çekme" && <MoneyPanel moneyReqs={moneyReqs} tur="withdraw" baslik="Para Çekme Talepleri" not="IBAN kontrol edilir" ensure={lock.ensure} onNotice={onNotice} refresh={refresh} />}
        {sayfa === "Krediler" && <CreditPanel settings={settings} moneyReqs={moneyReqs} ensure={lock.ensure} onNotice={onNotice} refresh={refresh} />}
        {sayfa === "Hisse İsimleri" && <StockNamesPanel onNotice={onNotice} ensure={lock.ensure} />}
        {sayfa === "Hisse Açıklamaları" && <StockDescPanel onNotice={onNotice} ensure={lock.ensure} />}
        {sayfa === "Sistem Ayarları" && <SettingsPanel settings={settings} onNotice={onNotice} ensure={lock.ensure} refresh={refresh} />}
        {sayfa === "Denetim Kaydı" && <AuditPanel />}
        {sayfa === "Belgeler" && (
          <ApprovalList
            title="Kimlik belgeleri" note={`${documents.length} belge`} items={documents} reasonRequired
            ensure={lock.ensure} onNotice={onNotice} refresh={belgeleriYukle}
            render={(d) => (
              <span>
                <strong>{d.doc_type_label || d.doc_type}</strong>
                <small>{d.full_name} · {d.status_label || d.status}</small>
              </span>
            )}
            onAct={(d, action, note) => api(`/api/admin/documents/${d.id}/${action}`, { method: "POST", body: JSON.stringify({ note }) })}
          />
        )}
      </main>

      {menuAcik && (
        <div className="ac-drawer-layer" onClick={() => setMenuAcik(false)}>
          <nav className="ac-drawer" onClick={(e) => e.stopPropagation()}>
            <header>
              <div className="ac-drawer-brand">
                <span className="brand">Ottoman</span>
                <div><strong>Admin Panel</strong><small>Yönetim</small></div>
              </div>
              <button className="ac-drawer-close" onClick={() => setMenuAcik(false)} aria-label="Kapat">✕</button>
            </header>
            {MENU.map(([grup, satirlar]) => (
              <div className="ac-drawer-group" key={grup}>
                <h4>{grup}</h4>
                {satirlar.map(([ad, simge]) => (
                  <button key={ad} className={sayfa === ad ? "on" : ""} onClick={() => git(ad)}>
                    <i aria-hidden="true"><Icon name={simge} size={19} /></i>
                    <span>{ad}</span>
                    {bekleyenSayilari[ad] ? <em>{bekleyenSayilari[ad]}</em> : null}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </div>
      )}

      {selected && (
        <UserEditor user={selected} onClose={() => setSelected(null)} onNotice={onNotice} ensure={lock.ensure} refresh={refresh} />
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
      <div className="home-indicator" />
    </div></div>
  );
}
