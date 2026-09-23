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

  // Patron talebiyle kaldırıldı: kritik işlemlerde artık admin şifresi
  // tekrar sorulmuyor, doğrudan izin veriliyor.
  const ensure = useCallback(() => Promise.resolve(true), []);

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
    tc: user.tc || "",
  });
  const [busy, setBusy] = useState("");
  const [history, setHistory] = useState([]);
  const [positions, setPositions] = useState([]);
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

  const pozisyonUygula = () => {
    const adet = Number(position.quantity);
    const fiyat = Number(String(position.price).replace(",", "."));
    if (!position.symbol.trim()) return onNotice("Sembol gerekli", "Örnek: THYAO");
    if (!Number.isFinite(adet) || adet < 0) return onNotice("Adet hatalı", "Sıfır ya da üzeri bir adet gir.");
    if (!Number.isFinite(fiyat) || fiyat <= 0) return onNotice("Fiyat hatalı", "Sıfırdan büyük bir fiyat gir.");
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
            <Field label="T.C. Kimlik No">
              <Input value={form.tc} maxLength={11} inputMode="numeric" onChange={(e) => setForm({ ...form, tc: e.target.value.replace(/\D/g, "").slice(0, 11) })} />
              {form.tc && !gecerliTc(form.tc) && <small className="ac-hint kirmizi">{tcHatasi(form.tc)}</small>}
            </Field>
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
            <Field label="Gerekçe (opsiyonel)" wide><Input value={position.note} onChange={(e) => setPosition({ ...position, note: e.target.value })} /></Field>
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

/** IBAN gibi kısa değerleri tek tıkla panoya kopyalar; kısa bir "Kopyalandı" geri bildirimi gösterir. */
function KopyaBtn({ metin, label = "Kopyala" }) {
  const [tamam, setTamam] = useState(false);
  if (!metin) return null;
  return (
    <button
      type="button"
      className="ac-ghost ac-kopya"
      onClick={async (e) => {
        e.stopPropagation();
        if (await kopyala(metin)) {
          setTamam(true);
          setTimeout(() => setTamam(false), 1400);
        }
      }}
    >
      {tamam ? "Kopyalandı" : label}
    </button>
  );
}

function BankaKarti({ hesap, ilk, son, onDuzenle, onIslem, onTasi }) {
  return (
    <article className="bk-card">
      <header>
        <h4>{hesap.bank_name}{Number(hesap.is_active) ? <em className="bk-aktif">Aktif</em> : <em className="bk-pasif">Pasif</em>}</h4>
        <div className="bk-araclar">
          <button className="bk-ok" disabled={ilk} onClick={() => onTasi(hesap, -1)} aria-label="Yukarı taşı">↑</button>
          <button className="bk-ok" disabled={son} onClick={() => onTasi(hesap, 1)} aria-label="Aşağı taşı">↓</button>
          <button className="bk-duzenle" onClick={() => onDuzenle(hesap)} aria-label="Düzenle">✎</button>
          <button className="bk-sil" onClick={() => onIslem(hesap, "delete")} aria-label="Sil">🗑</button>
        </div>
      </header>
      <dl>
        <div className="bk-iban-satir"><dt>IBAN:</dt><dd>{hesap.iban}</dd><KopyaBtn metin={hesap.iban} /></div>
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
              <KopyaBtn metin={hesap.iban} />
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
  trading_enabled: "İşlemler aktif",
  price_simulation: "Fiyat simülasyonu",
  brand_name: "Marka adı",
  brand_slogan: "Slogan",
  official_company_name: "Resmî unvan",
  official_registry_number: "Ticaret sicil no",
  official_mersis_number: "MERSİS no",
  official_address: "Adres",
  official_phone: "Telefon",
  official_email: "E-posta",
  official_license_text: "Lisans metni",
  commission_rate_bps: "Komisyon (baz puan)",
  ui_theme: "Varsayılan tema",
  content_footer_note: "Alt bilgi notu",
};

/** Referanstaki aç/kapat anahtarı. */
function Anahtar({ acik, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acik}
      disabled={disabled}
      className={`ac-switch${acik ? " on" : ""}`}
      onClick={() => !disabled && onChange(!acik)}
    >
      <i />
    </button>
  );
}

/* Referanstaki "İşlem Ayarları" kartı: üç anahtar. */
const ISLEM_ANAHTARLARI = [
  ["trading_enabled", "İşlemler Aktif", "Kullanıcılar alım-satım yapabilsin"],
  ["maintenance_mode", "Bakım Modu", "Platform bakım modunda"],
  ["price_simulation", "Fiyat Simülasyonu", "Piyasa saatleri dışında canlı fiyat simülasyonu"],
  ["t2_enabled", "T+2 Sistemi", "Satış tutarı iki iş günü bekler"],
];

function SettingsPanel({ settings, onNotice, ensure, refresh }) {
  const [draft, setDraft] = useState(settings || {});
  const [busy, setBusy] = useState(false);
  const [anahtarBusy, setAnahtarBusy] = useState("");
  useEffect(() => { setDraft(settings || {}); }, [settings]);

  const anahtarlar = new Set(ISLEM_ANAHTARLARI.map(([k]) => k));
  const duzenlenebilir = useMemo(
    () => Object.keys(draft)
      .filter((key) => /^(trading_|maintenance_|t2_|commission_|minimum_|official_|brand_|ui_|content_|price_)/.test(key))
      .filter((key) => !anahtarlar.has(key))   // kredi ayarları kendi sayfasında
      .sort(),
    [draft], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const anahtarDegistir = async (anahtar, deger) => {
    if (!(await ensure())) return;
    setAnahtarBusy(anahtar);
    try {
      await api("/api/admin/system-settings", { method: "POST", body: JSON.stringify({ [anahtar]: deger ? "1" : "0" }) });
      setDraft((x) => ({ ...x, [anahtar]: deger ? "1" : "0" }));
      await refresh();
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Ayar kaydedilemedi");
    } finally {
      setAnahtarBusy("");
    }
  };

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
    <>
      <Section title="İşlem Ayarları" note="Alım-satım işlemlerini kontrol edin">
        <div className="ac-list">
          {ISLEM_ANAHTARLARI.map(([anahtar, baslik, aciklama]) => (
            <div className="ac-line" key={anahtar}>
              <span><strong>{baslik}</strong><small>{aciklama}</small></span>
              <b className="ac-line-actions">
                <Anahtar
                  acik={String(draft[anahtar] ?? "0") === "1"}
                  disabled={anahtarBusy === anahtar}
                  onChange={(deger) => anahtarDegistir(anahtar, deger)}
                />
              </b>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Platform ayarları" note={`${duzenlenebilir.length} ayar doğrudan değiştirilebilir`}>
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
    </>
  );
}

/* ---------- onay kuyrukları ---------- */

/** Kullanıcı doğrulama kuyruğu: kişi başına kimlik durumu, arama ve belge inceleme. */
const KYC_ROZET_SINIFI = { review: "incele", approved: "onay", rejected: "ret", incomplete: "bekle" };
const KYC_ROZET_METNI = { review: "İnceleniyor", approved: "Onaylandı", rejected: "Reddedildi", incomplete: "Eksik Belge" };

function kycGrubu(user) {
  const durum = user.kyc_status || "pending";
  if (durum === "approved" || durum === "test_account") return "approved";
  if (durum === "under_review") return "review";
  if (durum === "rejected") return "rejected";
  return "incomplete"; // pending, awaiting_back
}

function KycQueuePanel({ users = [], documents = [], ensure, onNotice, refresh }) {
  const [query, setQuery] = useState("");
  const [durum, setDurum] = useState("hepsi");
  const [secili, setSecili] = useState(null);

  const sayilar = useMemo(() => {
    const acc = { review: 0, approved: 0, rejected: 0, incomplete: 0 };
    users.forEach((u) => { const g = kycGrubu(u); acc[g] = (acc[g] || 0) + 1; });
    return acc;
  }, [users]);

  const liste = useMemo(() => {
    const needle = fold(query);
    return users
      .filter((u) => durum === "hepsi" || kycGrubu(u) === durum)
      .filter((u) => eslesir(u, ["full_name", "account_no", "tc"], needle));
  }, [users, query, durum]);

  const sayac = (key, icon, deger) => (
    <button type="button" className={durum === key ? "on" : ""} onClick={() => setDurum(key)}>
      <Icon name={icon} size={16} />
      <b>{deger}</b>
    </button>
  );

  return (
    <Section title="Kullanıcı Doğrulama" note="Kimlik belgesi inceleme ve onay işlemleri">
      <div className="ac-kyc-sayaclar">
        {sayac("hepsi", "user", users.length)}
        {sayac("review", "clock", sayilar.review)}
        {sayac("approved", "check", sayilar.approved)}
        {sayac("rejected", "close", sayilar.rejected)}
        {sayac("incomplete", "question", sayilar.incomplete)}
      </div>
      <AraSatiri value={query} onChange={setQuery} placeholder="Ad, soyad, hesap no veya TC ile ara…" />
      <div className="ac-kisiler">
        {liste.map((user) => {
          const grup = kycGrubu(user);
          return (
            <article className="ac-kisi ac-kyc-satir" key={user.id}>
              <header>
                <span className="av"><Icon name="user" size={17} /></span>
                <span className="ad">
                  <strong>{user.full_name}</strong>
                  <small># {user.account_no}</small>
                </span>
                <em className={`ac-durum ${KYC_ROZET_SINIFI[grup]}`}>{KYC_ROZET_METNI[grup]}</em>
              </header>
              <ul>
                <li><Icon name="phone" size={13} /> {user.phone || "—"}</li>
                <li><Icon name="globe" size={13} /> {[user.district, user.city].filter(Boolean).join(", ") || "—"}</li>
              </ul>
              <footer>
                <button className="ac-ghost" style={{ flex: 1 }} onClick={() => setSecili(user)}>
                  <Icon name="eye" size={16} /> Belgeleri İncele
                </button>
              </footer>
            </article>
          );
        })}
        {!liste.length && <Bos metin="Kayıt yok" />}
      </div>

      {secili && (
        <KycUserModal
          user={secili}
          documents={documents.filter((d) => d.user_id === secili.id)}
          onClose={() => setSecili(null)}
          onNotice={onNotice}
          ensure={ensure}
          refresh={refresh}
        />
      )}
    </Section>
  );
}

/** Tek kullanıcının kimlik belgelerini inceleme modalı. */
function KycUserModal({ user, documents, onClose, onNotice, ensure, refresh }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(0);

  const calistir = async (doc, action) => {
    if (!(await ensure())) return;
    setBusy(doc.id);
    try {
      await api(`/api/admin/documents/${doc.id}/${action}`, { method: "POST", body: JSON.stringify({ note: reason.trim() || "Admin kararı" }) });
      await refresh();
      onNotice("Tamam", action === "approve" ? "Onaylandı." : action === "reject" ? "Reddedildi." : "Belge tekrar istendi.");
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "İşlem tamamlanamadı");
    } finally {
      setBusy(0);
    }
  };

  return (
    <div className="modal-layer" onClick={onClose}>
      <section className="trade-modal readable-modal ac-notice" onClick={(e) => e.stopPropagation()}>
        <h2>{user.full_name}</h2>
        <p className="subtle-count">#{user.account_no} · Kimlik belgeleri</p>
        <Field label="Gerekçe (opsiyonel)" wide>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn: Dekont doğrulandı" />
        </Field>
        <div className="ac-list scroll ac-kyc-belgeler" style={{ maxHeight: 420 }}>
          {documents.map((d) => (
            <div className="ac-line ac-kyc-belge" key={d.id}>
              {d.url && (
                <a href={d.url} target="_blank" rel="noreferrer" className="ac-kyc-thumb" title="Büyük görüntüle">
                  <img src={d.url} alt={d.doc_type_label || d.doc_type} loading="lazy" />
                </a>
              )}
              <span>
                <strong>{d.doc_type_label || d.doc_type}</strong>
                <small>{d.status_label || d.status}</small>
              </span>
              {d.status === "pending" && (
                <b className="ac-line-actions">
                  <button className="ac-ghost" disabled={busy === d.id} onClick={() => calistir(d, "approve")}>Onayla</button>
                  <button className="ac-danger small" disabled={busy === d.id} onClick={() => calistir(d, "reject")}>Reddet</button>
                </b>
              )}
            </div>
          ))}
          {!documents.length && <div className="ac-line"><span><strong>Belge yok</strong><small>Kullanıcı henüz belge yüklememiş</small></span></div>}
        </div>
        <button className="ac-ghost" onClick={onClose} style={{ marginTop: 10 }}>Kapat</button>
      </section>
    </div>
  );
}

function ApprovalList({ title, note, items, render, onAct, ensure, onNotice, refresh, reasonRequired }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(0);
  const calistir = async (item, action) => {
    const gerekce = reason.trim();

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
      <div className="ac-form">
        <Field label="Gerekçe (opsiyonel)" wide>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn: Dekont doğrulandı" />
        </Field>
      </div>
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

/** Referanstaki istatistik kartı: renkli sol şerit, sağ üstte simge. */
const StatKart = ({ renk, etiket, deger, simge }) => (
  <article className={renk}>
    <span>{etiket}{simge && <i aria-hidden="true"><Icon name={simge} size={19} /></i>}</span>
    <strong>{deger}</strong>
  </article>
);

function Dashboard({ summary, users, orders, moneyReqs, onGit }) {
  const onayli = users.filter((u) => u.status === "approved").length;
  const bekleyenOnay = users.filter((u) => u.status !== "approved" && u.status !== "rejected").length
    + orders.filter((o) => o.status === "pending").length
    + moneyReqs.filter((m) => m.status === "pending").length;
  const oran = users.length ? Math.round((onayli / users.length) * 100) : 0;
  const sahteTc = users.filter((u) => u.tc_valid === false).length;
  const sonIslemler = orders.slice(0, 5);

  return (
    <>
      <Section title="Sistem genel görünümü" note="Panelden değiştirilemeyen hiçbir şey yok">
        <div className="ac-cards iki">
          <StatKart renk="mavi" etiket="Toplam Kullanıcı" deger={summary.users ?? users.length} simge="user" />
          <StatKart renk="sari" etiket="Bekleyen Onay" deger={bekleyenOnay} simge="check" />
          <StatKart renk="yesil" etiket="Onaylı Kullanıcı" deger={onayli} simge="trend" />
          <StatKart renk="mavi" etiket="Toplam İşlem" deger={orders.length} simge="swap" />
        </div>
      </Section>

      <Section title="Son İşlemler" note={`${orders.length} emir kaydı`} action={<button className="ac-ghost" onClick={() => onGit("Emirler")}>Tümü</button>}>
        <div className="ac-list">
          {sonIslemler.map((o) => (
            <Satir key={o.id}
              ust={o.symbol}
              alt={`${o.quantity} adet · ${o.full_name}`}
              sag={<em className={o.side === "buy" ? "ac-al" : "ac-sat"}>{money(o.total)}<b>{o.side === "buy" ? "ALIŞ" : "SATIŞ"}</b></em>}
            />
          ))}
          {!sonIslemler.length && <Bos metin="Henüz işlem yok" />}
        </div>
      </Section>

      <Section title="Onay Oranı">
        <div className="ac-cards iki">
          <StatKart etiket="Onay Oranı" deger={`${oran}%`} />
          <StatKart renk="sari" etiket="Bekleyen" deger={bekleyenOnay} />
          <StatKart renk="yesil" etiket="Toplam Nakit" deger={money(summary.cash_total || 0)} />
          <StatKart renk="mor" etiket="T+2 Bekleyen" deger={money(summary.pending_balance_total || 0)} />
          <StatKart etiket="Bloke Bakiye" deger={money(summary.blocked_total || 0)} />
          <StatKart renk={sahteTc ? "kirmizi" : ""} etiket="Şüpheli T.C." deger={sahteTc} />
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

const DURUM_SINIFI = { approved: "onay", pending: "bekle", under_review: "incele", awaiting_back: "bekle", rejected: "ret" };

function UsersPanel({ users, onSec, onNotice, ensure, refresh }) {
  const [query, setQuery] = useState("");
  const [durum, setDurum] = useState("hepsi");
  const [yeni, setYeni] = useState(false);
  const [sifreKutusu, setSifreKutusu] = useState(null);
  const [yeniSifre, setYeniSifre] = useState("");
  const [busy, setBusy] = useState(false);

  const liste = useMemo(() => {
    const needle = fold(query);
    return users.filter((u) =>
      (durum === "hepsi" || (durum === "supheli" ? u.tc_valid === false : u.status === durum)) &&
      eslesir(u, ["full_name", "email", "account_no", "phone", "tc"], needle));
  }, [users, query, durum]);

  const say = (d) => users.filter((u) => (d === "hepsi" ? true : d === "supheli" ? u.tc_valid === false : u.status === d)).length;
  const supheli = say("supheli");

  const sifreKaydet = async () => {
    if (yeniSifre.length < 10) return onNotice("Şifre kısa", "En az 10 karakter, büyük harf, küçük harf ve rakam içermeli.");
    if (!(await ensure())) return;
    setBusy(true);
    try {
      await api(`/api/admin/users/${sifreKutusu.id}/password`, { method: "POST", body: JSON.stringify({ password: yeniSifre }) });
      onNotice("Şifre değişti", `${sifreKutusu.full_name} için yeni şifre kaydedildi, açık oturumlar kapatıldı.`);
      setSifreKutusu(null);
      setYeniSifre("");
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Şifre değiştirilemedi");
    } finally {
      setBusy(false);
    }
  };

  const sil = async (user) => {
    const cevap = window.prompt(`${user.full_name} hesabı ve tüm kayıtları kalıcı olarak silinecek. Onaylamak için SIL yaz:`);
    if (String(cevap || "").trim().toUpperCase() !== "SIL") return;
    if (!(await ensure())) return;
    try {
      await api(`/api/admin/users/${user.id}/delete`, { method: "POST", body: JSON.stringify({ confirm: "SIL" }) });
      await refresh();
      onNotice("Silindi", `${user.full_name} hesabı kaldırıldı.`);
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Hesap silinemedi");
    }
  };

  return (
    <>
      <Section
        title="Kullanıcılar"
        note={`${liste.length} kayıt${supheli ? ` · ${supheli} şüpheli T.C.` : ""}`}
        action={<button className="ac-ghost" onClick={() => setYeni(true)}>+ Yeni müşteri</button>}
      >
        <AraSatiri value={query} onChange={setQuery} placeholder="Ad, soyad, hesap numarası veya T.C. ile ara…" />
        <div className="ac-sekme">
          {[["hepsi", "Tümü"], ["approved", "Onaylandı"], ["pending", "Beklemede"], ["under_review", "İnceleniyor"], ["rejected", "Reddedildi"], ["supheli", "Şüpheli T.C."]].map(([k, ad]) => (
            <button key={k} className={durum === k ? "on" : ""} onClick={() => setDurum(k)}>{ad} ({say(k)})</button>
          ))}
        </div>

        <div className="ac-kisiler">
          {liste.map((user) => (
            <article className="ac-kisi" key={user.id}>
              <header>
                <span className="av"><Icon name="user" size={17} /></span>
                <span className="ad">
                  <strong>{user.full_name}</strong>
                  <small># {user.account_no}</small>
                </span>
                <em className={`ac-durum ${DURUM_SINIFI[user.status] || "bekle"}`}>{user.status_label || user.status}</em>
              </header>
              <ul>
                <li><Icon name="fingerprint" size={13} /> TC: {user.tc || user.tc_masked || "—"}{user.tc_valid === false && <em className="ac-rozet kirmizi">şüpheli</em>}</li>
                <li><Icon name="phone" size={13} /> {user.phone || "—"}</li>
                <li><Icon name="globe" size={13} /> {[user.district, user.city].filter(Boolean).join(", ") || "—"}</li>
                <li><Icon name="calendar" size={13} /> Kayıt: {user.created_at || "—"}</li>
                <li><Icon name="wallet" size={13} /> Bakiye: <b>{money(user.cash_balance || 0)}</b></li>
              </ul>
              <footer>
                <button className="ac-ghost" onClick={() => onSec(user)}>Düzenle</button>
                <button className="ac-ghost kare" aria-label="Şifre değiştir" title="Şifre değiştir" onClick={() => { setSifreKutusu(user); setYeniSifre(""); }}>
                  <Icon name="lock" size={16} />
                </button>
                <button className="ac-danger kare" aria-label="Sil" title="Hesabı sil" onClick={() => sil(user)}>
                  <Icon name="trash" size={16} />
                </button>
              </footer>
            </article>
          ))}
          {!liste.length && <Bos metin="Aramaya uyan müşteri yok" />}
        </div>
      </Section>

      {yeni && <YeniMusteri onNotice={onNotice} ensure={ensure} refresh={refresh} onKapat={() => setYeni(false)} />}

      {sifreKutusu && (
        <div className="modal-layer" onClick={() => setSifreKutusu(null)}>
          <section className="trade-modal readable-modal ac-notice" onClick={(e) => e.stopPropagation()}>
            <h2>Şifre değiştir</h2>
            <p className="subtle-count">{sifreKutusu.full_name} · {sifreKutusu.account_no}</p>
            <Field label="Yeni şifre (en az 10 karakter, büyük-küçük harf ve rakam)" wide>
              <Input value={yeniSifre} onChange={(e) => setYeniSifre(e.target.value)} placeholder="Yeni şifre" />
            </Field>
            <div className="ac-actions">
              <button className="ac-ghost" onClick={() => setSifreKutusu(null)}>Vazgeç</button>
              <button className="confirm" disabled={busy} onClick={sifreKaydet}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

/* ---------- 4. Portföyler ---------- */

function PortfolioPanel({ users = [], onNotice, ensure }) {
  const { items, reload } = useEndpoint("/api/admin/positions", "positions");
  const [query, setQuery] = useState("");
  const [kisi, setKisi] = useState("hepsi");
  const [duzenlenen, setDuzenlenen] = useState(null);
  const [form, setForm] = useState({ quantity: "", price: "", totalCost: "", valueOverride: "", note: "" });
  const [busy, setBusy] = useState(false);

  const liste = useMemo(() => {
    const needle = fold(query);
    return items.filter((p) =>
      (kisi === "hepsi" || String(p.user_id) === String(kisi)) &&
      eslesir(p, ["symbol", "full_name", "name"], needle));
  }, [items, query, kisi]);

  const toplamDeger = liste.reduce((sum, p) => sum + Number(p.market_value || 0), 0);
  const kisiler = new Set(liste.map((p) => p.user_id)).size;
  const kullaniciSecenekleri = [["hepsi", "Tüm Kullanıcılar"],
    ...users.map((u) => [String(u.id), `${u.full_name} (${u.account_no || u.id})`])];

  const kaydet = async () => {
    if (!(await ensure())) return;
    setBusy(true);
    try {
      await api("/api/admin/positions", {
        method: "POST",
        body: JSON.stringify({
          user_id: duzenlenen.user_id, symbol: duzenlenen.symbol, action: "set",
          quantity: Number(form.quantity) || 0,
          price: Number(String(form.price).replace(",", ".")) || duzenlenen.avg_price,
          total_cost: form.totalCost.trim() ? String(form.totalCost).replace(",", ".") : "",
          value_override: form.valueOverride.trim() ? String(form.valueOverride).replace(",", ".") : "",
          note: form.note.trim().length >= 8 ? form.note.trim() : "Pozisyon admin tarafından düzenlendi",
        }),
      });
      await reload();
      onNotice("Kaydedildi", `${duzenlenen.symbol} pozisyonu güncellendi.`);
      setDuzenlenen(null);
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Pozisyon kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const sil = async (p) => {
    if (!window.confirm(`${p.full_name} hesabındaki ${p.symbol} pozisyonu silinecek. Onaylıyor musun?`)) return;
    if (!(await ensure())) return;
    try {
      await api("/api/admin/positions", { method: "POST", body: JSON.stringify({ user_id: p.user_id, symbol: p.symbol, action: "set", quantity: 0, price: p.avg_price, note: "Pozisyon admin tarafından silindi" }) });
      await reload();
      onNotice("Silindi", `${p.symbol} pozisyonu kaldırıldı.`);
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Pozisyon silinemedi");
    }
  };

  return (
    <Section title="Portföy Yönetimi" note="Kullanıcı portföylerini görüntüleyin ve düzenleyin" action={<button className="ac-ghost" onClick={reload}>Yenile</button>}>
      <AraSatiri value={query} onChange={setQuery} placeholder="Hisse kodu, isim veya kullanıcı ara…" />
      <div className="ac-form">
        <Field label="Kullanıcı" wide><Select value={kisi} onChange={setKisi} options={kullaniciSecenekleri} /></Field>
      </div>

      <div className="ac-ozet">
        <div><span className="sim"><Icon name="user" size={18} /></span><span className="c"><small>Toplam Kullanıcı</small><strong>{kisiler}</strong></span></div>
        <div><span className="sim"><Icon name="portfolio" size={18} /></span><span className="c"><small>Toplam Pozisyon</small><strong>{liste.length}</strong></span></div>
        <div><span className="sim"><Icon name="wallet" size={18} /></span><span className="c"><small>Toplam Değer</small><strong>{money(toplamDeger)}</strong></span></div>
      </div>

      <div className="ac-poz-baslik">Pozisyonlar</div>

      {/* Geniş ekranda referanstaki tablo. */}
      <div className="ac-tablo-sarmal">
        <table className="ac-tablo">
          <thead>
            <tr>
              <th>Kullanıcı</th><th>Kod</th><th className="sag">Adet</th><th className="sag">Alış Fiyatı</th>
              <th className="sag">Güncel Fiyat</th><th className="sag">Maliyet</th><th className="sag">Değer</th>
              <th className="sag">K/Z</th><th />
            </tr>
          </thead>
          <tbody>
            {liste.map((p) => {
              const maliyet = Number(p.avg_price || 0) * Number(p.quantity || 0);
              const oran = maliyet > 0 ? (Number(p.pnl || 0) / maliyet) * 100 : 0;
              return (
                <tr key={`t-${p.user_id}-${p.symbol}`}>
                  <td><span className="kul"><strong>{p.full_name}</strong><small>{p.account_no || p.user_id}</small></span></td>
                  <td><span className="kod"><strong>{p.symbol}</strong><small>{p.name || p.company_name || ""}</small></span></td>
                  <td className="sag">{p.quantity}</td>
                  <td className="sag">{money(p.avg_price)}</td>
                  <td className="sag">{money(p.current_price)}</td>
                  <td className="sag">{money(maliyet)}</td>
                  <td className="sag">{money(p.market_value)}</td>
                  <td className={`sag ${Number(p.pnl) >= 0 ? "ac-al" : "ac-sat"}`}>
                    {money(p.pnl)}<small>({oran >= 0 ? "+" : "−"}{Math.abs(oran).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)</small>
                  </td>
                  <td className="sag">
                    <span className="ac-poz-islem">
                      <button className="ac-ghost kare" aria-label="Düzenle" onClick={() => { setDuzenlenen(p); setForm({ quantity: String(p.quantity), price: String(p.avg_price), totalCost: String((Number(p.avg_price) || 0) * (Number(p.quantity) || 0)), valueOverride: p.value_override != null ? String(p.value_override) : "", note: "" }); }}>
                        <Icon name="sliders" size={15} />
                      </button>
                      <button className="ac-danger kare" aria-label="Sil" onClick={() => sil(p)}><Icon name="trash" size={15} /></button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!liste.length && <Bos metin="Pozisyon yok" />}
      </div>

      {/* Telefonda kart görünümü. */}
      <div className="ac-list scroll tall ac-poz-kartlar">
        {liste.map((p) => (
          <div className="ac-poz" key={`${p.user_id}-${p.symbol}`}>
            <div className="ac-poz-ust">
              <span className="ac-poz-ad">
                <strong>{p.symbol}</strong>
                <small>{p.name || p.company_name || ""}</small>
                <small className="kisi"><Icon name="user" size={13} /> {p.full_name} {p.account_no ? `(${p.account_no})` : `(${p.user_id})`}</small>
              </span>
              <span className="ac-poz-islem">
                <button className="ac-ghost" aria-label="Düzenle" onClick={() => { setDuzenlenen(p); setForm({ quantity: String(p.quantity), price: String(p.avg_price), totalCost: String((Number(p.avg_price) || 0) * (Number(p.quantity) || 0)), valueOverride: p.value_override != null ? String(p.value_override) : "", note: "" }); }}>Düzenle</button>
                <button className="ac-danger small" aria-label="Sil" onClick={() => sil(p)}>Sil</button>
              </span>
            </div>
            <div className="ac-poz-alt">
              <span><small>Adet</small><strong>{p.quantity}</strong></span>
              <span><small>Alış Fiyatı</small><strong>{money(p.avg_price)}</strong></span>
              <span><small>Değer</small><strong>{money(p.market_value)}</strong></span>
              <span><small>K/Z</small><strong className={Number(p.pnl) >= 0 ? "ac-al" : "ac-sat"}>{money(p.pnl)}</strong></span>
            </div>
          </div>
        ))}
        {!liste.length && <Bos metin="Pozisyon yok" />}
      </div>

      {duzenlenen && (
        <div className="modal-layer" onClick={() => setDuzenlenen(null)}>
          <section className="trade-modal readable-modal ac-notice" onClick={(e) => e.stopPropagation()}>
            <h2>{duzenlenen.symbol}</h2>
            <p className="subtle-count">{duzenlenen.full_name}</p>
            <div className="ac-form">
              <Field label="Adet"><Input inputMode="numeric" value={form.quantity} onChange={(e) => setForm((x) => ({ ...x, quantity: e.target.value.replace(/\D/g, "") }))} /></Field>
              <Field label="Alış fiyatı"><Input inputMode="decimal" value={form.price} onChange={(e) => setForm((x) => ({ ...x, price: e.target.value }))} /></Field>
              <Field label="Toplam maliyet (opsiyonel)"><Input inputMode="decimal" value={form.totalCost} onChange={(e) => setForm((x) => ({ ...x, totalCost: e.target.value }))} placeholder="Doldurulursa alış fiyatının yerine geçer" /></Field>
              <Field label="Güncel değer fiyatı (opsiyonel)"><Input inputMode="decimal" value={form.valueOverride} onChange={(e) => setForm((x) => ({ ...x, valueOverride: e.target.value }))} placeholder="Boş bırakılırsa canlı fiyat kullanılır" /></Field>
              <Field label="Gerekçe (opsiyonel)" wide><Input value={form.note} onChange={(e) => setForm((x) => ({ ...x, note: e.target.value }))} placeholder="Örn: Müşteri talebi üzerine düzeltme" /></Field>
            </div>
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

/* ---------- 5. Bakiye detayları ---------- */

function BalancePanel({ onSec, ensure, onNotice }) {
  const { items, reload } = useEndpoint("/api/admin/user-balances", "balances");
  const [query, setQuery] = useState("");
  const [sira, setSira] = useState("ad");
  const [acik, setAcik] = useState(null);

  const liste = useMemo(() => {
    const needle = fold(query);
    const suzulmus = items.filter((b) => eslesir(b, ["full_name", "account_no", "email", "phone"], needle));
    const kopya = [...suzulmus];
    if (sira === "ad") kopya.sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || ""), "tr"));
    if (sira === "adTers") kopya.sort((a, b) => String(b.full_name || "").localeCompare(String(a.full_name || ""), "tr"));
    if (sira === "bakiyeCok") kopya.sort((a, b) => Number(b.cash_balance || 0) - Number(a.cash_balance || 0));
    if (sira === "bakiyeAz") kopya.sort((a, b) => Number(a.cash_balance || 0) - Number(b.cash_balance || 0));
    return kopya;
  }, [items, query, sira]);

  const topla = (alan) => liste.reduce((sum, b) => sum + Number(b[alan] || 0), 0);

  return (
    <Section title="Bakiye Detayları" note="Kullanıcı bakiyelerini detaylı görüntüleyin ve yönetin" action={<button className="ac-ghost" onClick={reload}>Yenile</button>}>
      <div className="ac-arama-sira">
        <input className="ac-search" value={query} placeholder="Ad, soyad, hesap no veya telefon ile ara…" onChange={(e) => setQuery(e.target.value)} />
        <Select value={sira} onChange={setSira} options={[["ad", "İsim (A-Z)"], ["adTers", "İsim (Z-A)"], ["bakiyeCok", "Bakiye (çoktan aza)"], ["bakiyeAz", "Bakiye (azdan çoka)"]]} />
      </div>

      <div className="ac-cards iki">
        <StatKart renk="yesil" etiket="Toplam Nakit" deger={money(topla("cash_balance"))} />
        <StatKart renk="sari" etiket="Bloke" deger={money(topla("blocked_balance"))} />
        <StatKart renk="mavi" etiket="T+2 Bekleyen" deger={money(topla("pending_balance"))} />
        <StatKart renk="mor" etiket="Kredi Limiti" deger={money(topla("credit_limit"))} />
      </div>

      <div className="ac-list scroll tall">
        {liste.map((b) => (
          <div className="ac-bakiye" key={b.id}>
            <button className="ust" onClick={() => setAcik(acik === b.id ? null : b.id)}>
              <span className="kim">
                <strong>{b.full_name}</strong>
                <small>Hesap No: {b.account_no} | Tel: {b.phone || "—"}</small>
              </span>
              <span className="tutar">
                <small>Mevcut Bakiye</small>
                <strong>{money(b.cash_balance)}</strong>
              </span>
              <b className={`ac-chevron${acik === b.id ? " acik" : ""}`}>⌄</b>
            </button>
            {acik === b.id && (
              <div className="alt">
                <div className="ac-poz-alt">
                  <span><small>Nakit</small><strong>{money(b.cash_balance)}</strong></span>
                  <span><small>Bloke</small><strong>{money(b.blocked_balance)}</strong></span>
                  <span><small>T+2 bekleyen</small><strong>{money(b.pending_balance)}</strong></span>
                  <span><small>Kredi limiti</small><strong>{money(b.credit_limit)}</strong></span>
                </div>
                <div className="ac-poz-islem">
                  <button className="ac-ghost" onClick={() => onSec?.(b)}>Hesabı aç ve düzenle</button>
                </div>
              </div>
            )}
          </div>
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
        <Field label="Gerekçe (opsiyonel)" wide>
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

/** Referanstaki kuyruk başlığı: Toplam / Beklemede / Onaylanan / Reddedilen. */
function KuyrukSayaclari({ items }) {
  const say = (d) => items.filter((x) => x.status === d).length;
  return (
    <div className="ac-sayac">
      <article><span>Toplam</span><strong>{items.length}</strong></article>
      <article><span>Beklemede</span><strong className="bekle">{say("pending")}</strong></article>
      <article><span>Onaylanan</span><strong className="onay">{say("approved")}</strong></article>
      <article><span>Reddedilen</span><strong className="ret">{say("rejected")}</strong></article>
    </div>
  );
}

function MoneyPanel({ moneyReqs, tur, baslik, not, ensure, onNotice, refresh }) {
  const [reason, setReason] = useState("");
  const [durum, setDurum] = useState("hepsi");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(0);

  const turdekiler = useMemo(
    () => moneyReqs.filter((m) => tur === "hepsi" || m.request_type === tur),
    [moneyReqs, tur],
  );
  const liste = useMemo(() => {
    const needle = fold(query);
    return turdekiler.filter((m) => (durum === "hepsi" || m.status === durum) && eslesir(m, ["full_name", "account_no", "iban"], needle));
  }, [turdekiler, durum, query]);
  const toplam = liste.reduce((sum, m) => sum + Number(m.amount || 0), 0);
  const say = (d) => turdekiler.filter((x) => d === "hepsi" || x.status === d).length;

  const calistir = async (item, action) => {
    const gerekce = reason.trim();
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
    <Section title={baslik} note={not}>
      <KuyrukSayaclari items={turdekiler} />
      <AraSatiri value={query} onChange={setQuery} placeholder="Ad, soyad veya hesap numarası ile ara…" />
      <div className="ac-sekme">
        {[["hepsi", "Tümü"], ["pending", "Bekleyen"], ["approved", "Onaylanan"], ["rejected", "Reddedilen"]].map(([k, ad]) => (
          <button key={k} className={durum === k ? "on" : ""} onClick={() => setDurum(k)}>{ad} ({say(k)})</button>
        ))}
      </div>
      <div className="ac-form">
        <Field label="Gerekçe (opsiyonel)" wide>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn: Dekont doğrulandı" />
        </Field>
      </div>
      <div className="ac-talep-liste">
        {liste.map((m) => (
          <article className="ac-talep" key={m.id}>
            <header>
              <strong>{m.full_name}</strong>
              <em className={`ac-durum ${m.status === "approved" ? "onay" : m.status === "rejected" ? "ret" : "bekle"}`}>{m.status_label || m.status}</em>
            </header>
            <ul>
              <li>Hesap No: {m.account_no || "—"}</li>
              <li>Telefon: {m.phone || "—"}</li>
              <li className="miktar">Miktar: <b>{money(m.amount)}</b></li>
              <li>Tarih: {m.created_at_label || "—"}</li>
              {m.iban && <li className="ac-iban-satiri">IBAN: {m.iban} <KopyaBtn metin={m.iban} /></li>}
              {m.note && <li className="not">Not: {m.note}</li>}
              {m.admin_note && <li className="not">Not: {m.admin_note}</li>}
            </ul>
            {m.status === "pending" && (
              <footer>
                <button className="ac-yukle-btn" disabled={busy === m.id} onClick={() => calistir(m, "approve")}>Onayla</button>
                <button className="ac-cikar-btn" disabled={busy === m.id} onClick={() => calistir(m, "reject")}>Reddet</button>
              </footer>
            )}
          </article>
        ))}
        {!liste.length && <Bos metin="Talep yok" />}
      </div>
      <span className="ac-empty">Listedeki toplam tutar: {money(toplam)}</span>
    </Section>
  );
}

/* ---------- 8. T+2 takip ---------- */

/** "1 gün 20 saat" biçiminde kalan süre. */
const kalanSure = (bitis) => {
  const fark = (Number(bitis) || 0) * 1000 - Date.now();
  if (fark <= 0) return "vadesi geldi";
  const gun = Math.floor(fark / 86400000);
  const saat = Math.floor((fark % 86400000) / 3600000);
  const dakika = Math.floor((fark % 3600000) / 60000);
  if (gun) return `${gun} gün ${saat} saat`;
  if (saat) return `${saat} saat ${dakika} dk`;
  return `${dakika} dk`;
};

function T2Panel({ ensure, onNotice, settings, refresh, users = [] }) {
  const { items, reload } = useEndpoint("/api/admin/t2-settlements", "t2_settlements");
  const [durum, setDurum] = useState("hepsi");
  const [kisi, setKisi] = useState("hepsi");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(0);
  const [toplu, setToplu] = useState(false);
  const t2Acik = String(settings?.t2_enabled ?? "1") === "1";

  const liste = useMemo(() => {
    const needle = fold(query);
    return items.filter((t) =>
      (durum === "hepsi" || t.status === durum) &&
      (kisi === "hepsi" || String(t.user_id) === String(kisi)) &&
      eslesir(t, ["code", "full_name", "name"], needle));
  }, [items, durum, kisi, query]);

  const bekleyenler = items.filter((t) => t.status === "pending");
  const bekleyenTutar = bekleyenler.reduce((s, t) => s + Number(t.remaining_amount || 0), 0);
  const cozulen = items.filter((t) => t.status !== "pending").reduce((s, t) => s + Number(t.amount || 0), 0);
  const kullaniciSecenek = [["hepsi", "Tüm Kullanıcılar"], ...users.map((u) => [String(u.id), u.full_name])];

  const t2Degistir = async () => {
    if (!(await ensure())) return;
    try {
      await api("/api/admin/system-settings", { method: "POST", body: JSON.stringify({ t2_enabled: t2Acik ? "0" : "1" }) });
      await refresh?.();
      onNotice("Kaydedildi", t2Acik ? "T+2 kapatıldı; satış tutarı anında nakde geçecek." : "T+2 açıldı.");
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Ayar kaydedilemedi");
    }
  };

  const coz = async (t) => {
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

  const sil = async (t) => {
    if (!window.confirm(`${t.full_name} · ${money(t.display_amount)} T+2 kaydı silinecek. Bekleyen tutar hesaptan düşer. Onaylıyor musun?`)) return;
    if (!(await ensure())) return;
    setBusy(t.id);
    try {
      await api(`/api/admin/t2-settlements/${t.id}/delete`, { method: "POST", body: "{}" });
      await reload();
      onNotice("Silindi", "T+2 kaydı kaldırıldı.");
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Kayıt silinemedi");
    } finally {
      setBusy(0);
    }
  };

  const hepsiniCoz = async () => {
    if (!bekleyenler.length) return onNotice("Bekleyen yok", "Çözülecek T+2 kaydı yok.");
    if (!(await ensure())) return;
    setToplu(true);
    let sayi = 0;
    try {
      for (const kayit of bekleyenler) {
        try { await api(`/api/admin/t2-settlements/${kayit.id}`, { method: "POST", body: "{}" }); sayi += 1; } catch { /* devam */ }
      }
      await reload();
      onNotice("Çözüldü", `${sayi} kayıt nakde geçirildi.`);
    } finally {
      setToplu(false);
    }
  };

  return (
    <Section title="T+2 Takip" note="Satış sonrası bekleyen bakiyeleri yönetin" action={<button className="ac-ghost" onClick={reload}>Yenile</button>}>
      <div className="ac-cards">
        <StatKart etiket="Bekleyen İşlem" deger={`${bekleyenler.length} adet`} />
        <StatKart renk="sari" etiket="Bekleyen Tutar" deger={money(bekleyenTutar)} />
        <StatKart renk="yesil" etiket="Tamamlanan Tutar" deger={money(cozulen)} />
      </div>

      <div className="ac-list">
        <div className="ac-line">
          <span><strong>T+2 sistemi {t2Acik ? "açık" : "kapalı"}</strong><small>{t2Acik ? "Satış tutarı iki iş günü bekler" : "Satış tutarı anında nakde geçer"}</small></span>
          <b className="ac-line-actions">
            <button className="ac-ghost" disabled={toplu || !bekleyenler.length} onClick={hepsiniCoz}>{toplu ? "Çözülüyor…" : "Hepsini çöz"}</button>
            <Anahtar acik={t2Acik} onChange={t2Degistir} />
          </b>
        </div>
      </div>

      <div className="ac-arama-sira">
        <input className="ac-search" value={query} placeholder="Hisse kodu veya kullanıcı ara…" onChange={(e) => setQuery(e.target.value)} />
        <Select value={kisi} onChange={setKisi} options={kullaniciSecenek} />
        <Select value={durum} onChange={setDurum} options={[["hepsi", "Tüm Durumlar"], ["pending", "Bekliyor"], ["settled", "Çözüldü"]]} />
      </div>

      <div className="ac-tablo-sarmal">
        <table className="ac-tablo">
          <thead>
            <tr><th>Kullanıcı</th><th>Hisse</th><th className="sag">Adet</th><th className="sag">Tutar</th><th>Satış Tarihi</th><th>Settlement</th><th>Kalan Süre</th><th>Durum</th><th>İşlemler</th></tr>
          </thead>
          <tbody>
            {liste.map((t) => (
              <tr key={t.id}>
                <td><span className="kul"><strong>{t.full_name}</strong><small>#{t.user_id}</small></span></td>
                <td><span className="kod"><strong>{t.code || t.symbol || "—"}</strong><small>{t.name || ""}</small></span></td>
                <td className="sag">{t.quantity || "—"}</td>
                <td className="sag">{money(t.display_amount)}</td>
                <td>{t.created_at_label || "—"}</td>
                <td>{t.settlement_date_label || "—"}</td>
                <td>{t.status === "pending" ? kalanSure(t.settlement_date) : "—"}</td>
                <td><em className={`ac-durum ${t.status === "pending" ? "bekle" : "onay"}`}>{t.status_label || t.status}</em></td>
                <td>
                  <span className="ac-poz-islem">
                    {t.status === "pending" && (
                      <button className="ac-ghost kare" title="Şimdi çöz" disabled={busy === t.id} onClick={() => coz(t)}><Icon name="check" size={15} /></button>
                    )}
                    <button className="ac-danger kare" title="Sil" disabled={busy === t.id} onClick={() => sil(t)}><Icon name="trash" size={15} /></button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!liste.length && <Bos metin="Kayıt yok" />}
      </div>

      <div className="ac-list scroll ac-poz-kartlar">
        {liste.map((t) => (
          <Satir key={`k-${t.id}`}
            ust={`${money(t.display_amount)} · ${t.code || "nakit"}`}
            alt={`${t.full_name} · ${t.status_label || t.status} · ${t.status === "pending" ? kalanSure(t.settlement_date) : t.created_at_label || ""}`}
            sag={(
              <>
                {t.status === "pending" && <button className="ac-ghost" disabled={busy === t.id} onClick={() => coz(t)}>Çöz</button>}
                <button className="ac-danger small" disabled={busy === t.id} onClick={() => sil(t)}>Sil</button>
              </>
            )}
          />
        ))}
        {!liste.length && <Bos metin="Kayıt yok" />}
      </div>
    </Section>
  );
}

/* ---------- 9. Onay bekleyenler ---------- */

function PendingPanel({ users, orders, moneyReqs, onGit, onSec }) {
  const [durum, setDurum] = useState("inceleniyor");
  const [query, setQuery] = useState("");

  const sayilar = {
    hepsi: users.length,
    inceleniyor: users.filter((u) => u.status === "under_review").length,
    approved: users.filter((u) => u.status === "approved").length,
    rejected: users.filter((u) => u.status === "rejected").length,
    pending: users.filter((u) => u.status === "pending" || u.status === "awaiting_back").length,
  };

  const liste = useMemo(() => {
    const needle = fold(query);
    return users.filter((u) => {
      const uyum = durum === "hepsi"
        || (durum === "inceleniyor" && u.status === "under_review")
        || (durum === "pending" && (u.status === "pending" || u.status === "awaiting_back"))
        || u.status === durum;
      return uyum && eslesir(u, ["full_name", "account_no", "tc", "phone"], needle);
    });
  }, [users, durum, query]);

  const bekleyenEmir = orders.filter((o) => o.status === "pending").length;
  const bekleyenPara = moneyReqs.filter((m) => m.status === "pending");

  return (
    <>
      <Section title="Onay Bekleyenler" note="Kimlik belgesi inceleme ve onay işlemleri">
        <div className="ac-sekme">
          {[["hepsi", "Tümü"], ["inceleniyor", "İnceleniyor"], ["approved", "Onaylı"], ["rejected", "Reddedilen"], ["pending", "Beklemede"]].map(([k, ad]) => (
            <button key={k} className={durum === k ? "on" : ""} onClick={() => setDurum(k)}>{ad} {sayilar[k]}</button>
          ))}
        </div>
        <AraSatiri value={query} onChange={setQuery} placeholder="Ad, soyad, hesap no veya TC ile ara…" />
        <div className="ac-kisiler">
          {liste.map((u) => (
            <article className="ac-kisi" key={u.id}>
              <header>
                <span className="av"><Icon name="user" size={17} /></span>
                <span className="ad"><strong>{u.full_name}</strong><small># {u.account_no}</small></span>
                <em className={`ac-durum ${DURUM_SINIFI[u.status] || "bekle"}`}>{u.status_label || u.status}</em>
              </header>
              <ul>
                <li><Icon name="phone" size={13} /> {u.phone || "—"}</li>
                <li><Icon name="globe" size={13} /> {[u.district, u.city].filter(Boolean).join(", ") || "—"}</li>
                <li><Icon name="list" size={13} /> {u.document_count || 0} belge</li>
              </ul>
              {u.kyc_missing_label && <em className="ac-rozet sari">{u.kyc_missing_label}</em>}
              <footer>
                <button className="ac-ghost" onClick={() => (onSec ? onSec(u) : onGit("Kullanıcı Doğrulama"))}>
                  <Icon name="eye" size={15} /> Belgeleri İncele
                </button>
              </footer>
            </article>
          ))}
          {!liste.length && <Bos metin="Bu süzgeçte kayıt yok" />}
        </div>
      </Section>

      <Section title="Diğer kuyruklar" note="Emir ve para talepleri">
        <div className="ac-cards iki">
          <article className={bekleyenEmir ? "sari" : ""} onClick={() => onGit("Emirler")} style={{ cursor: "pointer" }}>
            <span>Bekleyen emir</span><strong>{bekleyenEmir}</strong>
          </article>
          <article className={bekleyenPara.length ? "sari" : ""} onClick={() => onGit("Para Yatırma Talepleri")} style={{ cursor: "pointer" }}>
            <span>Bekleyen para talebi</span><strong>{bekleyenPara.length}</strong>
          </article>
        </div>
      </Section>
    </>
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
          <div className="ac-hisse" key={k.symbol}>
            <span className="kod">{k.symbol}</span>
            <span className="ad">
              {k.name}
              {k.custom && <em className="ac-rozet mor">düzenlendi</em>}
            </span>
            <button className="ac-ghost kare" aria-label="Düzenle" title="Adı düzenle"
              onClick={() => { setDuzenlenen(k); setAd(k.custom ? k.name : ""); }}>
              <Icon name="sliders" size={15} />
            </button>
          </div>
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

/* Referanstaki madde başlıkları, yer tutucuları ve otomatik-eklenir notları. */
const KREDI_METINLERI = [
  ["credit_contract_text_1", "Madde 1 - Kredi Kullanım Şartları", "Kredinin kullanım şartlarını yazın…", ""],
  ["credit_contract_text_2", "Madde 2 - Faiz ve Ödeme Koşulları (Ek Metin)", "Faiz oranları otomatik hesaplanır, ek bilgi yazabilirsiniz…", "Not: Faiz oranı ve vade bilgisi otomatik eklenir"],
  ["credit_contract_text_3", "Madde 3 - Gecikme Halinde", "Gecikme durumunda uygulanacak işlemleri yazın…", "Not: Gecikme faiz oranı otomatik eklenir"],
  ["credit_contract_text_4", "Madde 4 - Erken Ödeme", "Erken ödeme koşullarını yazın…", ""],
  ["credit_contract_text_5", "Madde 5 - Teminat ve Güvence", "Teminat ve güvence koşullarını yazın…", "Not: Teminat çağrısı oranı otomatik eklenir"],
  ["credit_contract_text_6", "Madde 6 - Fesih ve İptal", "Fesih ve iptal koşullarını yazın…", ""],
  ["credit_contract_text_7", "Madde 7 - Uyuşmazlık Çözümü", "Uyuşmazlık çözüm yollarını yazın…", ""],
];

function CreditSettings({ settings, ensure, onNotice, refresh }) {
  const tumu = [...KREDI_ALANLARI.map(([k]) => k), ...KREDI_METINLERI.map(([k]) => k)];
  const [form, setForm] = useState(() => Object.fromEntries(tumu.map((k) => [k, settings[k] ?? ""])));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(Object.fromEntries(tumu.map((k) => [k, settings[k] ?? ""]))); }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const kaydet = async () => {
    if (!(await ensure())) return;
    setBusy(true);
    try {
      await api("/api/admin/system-settings", { method: "POST", body: JSON.stringify(form) });
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
      <Section title="Kredi Ayarları" note="Faiz, vade ve teminat kuralları">
        <div className="ac-form">
          {KREDI_ALANLARI.map(([anahtar, etiket]) => (
            <Field key={anahtar} label={etiket}>
              <Input value={form[anahtar] ?? ""} onChange={(e) => setForm((x) => ({ ...x, [anahtar]: e.target.value }))} />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Kredi Sözleşmesi" note="Müşteri kredi başvurusunda bu maddeleri okur">
        <div className="ac-madde-liste">
          {KREDI_METINLERI.map(([anahtar, baslik, ipucu, not]) => (
            <div className="ac-madde" key={anahtar}>
              <label htmlFor={anahtar}>{baslik}</label>
              <textarea
                id={anahtar}
                rows={3}
                placeholder={ipucu}
                value={form[anahtar] ?? ""}
                onChange={(e) => setForm((x) => ({ ...x, [anahtar]: e.target.value }))}
              />
              {not && <small>{not}</small>}
            </div>
          ))}
        </div>
        <button className="confirm" disabled={busy} onClick={kaydet}>{busy ? "Kaydediliyor…" : "Tüm Ayarları Kaydet"}</button>
      </Section>
    </>
  );
}

/* ---------- 12b. Para yükleme ---------- */

/** Referanstaki "Bakiye Yönetimi": her müşteri kartında yükle / çıkar düğmesi. */
const BAKIYE_SIRALAMA = [
  ["isim", "İsim (A-Z)"],
  ["bakiye-yuksek", "Bakiye (yüksek-düşük)"],
  ["bakiye-dusuk", "Bakiye (düşük-yüksek)"],
];

function LoadMoneyPanel({ users = [], ensure, onNotice, refresh }) {
  const [query, setQuery] = useState("");
  const [siralama, setSiralama] = useState("isim");
  const [kutu, setKutu] = useState(null);   // { user, yon }
  const [form, setForm] = useState({ amount: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [adet, setAdet] = useState(20);

  const liste = useMemo(() => {
    const needle = fold(query);
    const filtreli = users.filter((u) => eslesir(u, ["full_name", "account_no", "email", "phone", "tc"], needle));
    const sirali = [...filtreli];
    if (siralama === "bakiye-yuksek") sirali.sort((a, b) => Number(b.cash_balance || 0) - Number(a.cash_balance || 0));
    else if (siralama === "bakiye-dusuk") sirali.sort((a, b) => Number(a.cash_balance || 0) - Number(b.cash_balance || 0));
    else sirali.sort((a, b) => fold(a.full_name).localeCompare(fold(b.full_name), "tr"));
    return sirali;
  }, [users, query, siralama]);

  const uygula = async () => {
    const tutar = Number(String(form.amount).replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(tutar) || tutar <= 0) return onNotice("Tutar hatalı", "Sıfırdan büyük bir tutar gir.");
    if (!(await ensure())) return;
    setBusy(true);
    try {
      await api("/api/admin/balances", {
        method: "POST",
        body: JSON.stringify({ user_id: kutu.user.id, action: kutu.yon === "yukle" ? "add" : "subtract", amount: tutar, note: form.note.trim() }),
      });
      await refresh();
      onNotice("Tamam", `${kutu.user.full_name}: ${money(tutar)} ${kutu.yon === "yukle" ? "yüklendi" : "çıkarıldı"}.`);
      setKutu(null);
      setForm({ amount: "", note: "" });
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Bakiye işlenemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Bakiye Yönetimi" note={`${liste.length} müşteri · bakiye yükleyin ya da çıkarın`}>
      <AraSatiri
        value={query}
        onChange={setQuery}
        placeholder="Ad, soyad, hesap numarası veya T.C. ile ara…"
        sag={(
          <select className="ac-select" value={siralama} onChange={(e) => setSiralama(e.target.value)} aria-label="Sıralama">
            {BAKIYE_SIRALAMA.map(([k, ad]) => <option key={k} value={k}>{ad}</option>)}
          </select>
        )}
      />
      <div className="ac-list scroll tall">
        {liste.slice(0, adet).map((u) => (
          <div className="ac-yukle" key={u.id}>
            <span className="bilgi">
              <strong>{u.full_name}</strong>
              <small>Hesap No: {u.account_no}</small>
              <small>Telefon: {u.phone || "—"}</small>
              <small>TC: {u.tc || u.tc_masked || "—"}</small>
              <small className="bakiye">Bakiye: {money(u.cash_balance || 0)}</small>
            </span>
            <span className="islem">
              <button className="ac-yukle-btn" onClick={() => { setKutu({ user: u, yon: "yukle" }); setForm({ amount: "", note: "" }); }}>+ Bakiye Yükle</button>
              <button className="ac-cikar-btn" onClick={() => { setKutu({ user: u, yon: "cikar" }); setForm({ amount: "", note: "" }); }}>− Bakiye Çıkar</button>
            </span>
          </div>
        ))}
        {liste.length > adet && (
          <button className="ac-line ac-more" onClick={() => setAdet((x) => x + 40)}>
            <span><strong>Daha fazla göster</strong><small>{liste.length - adet} müşteri daha</small></span>
          </button>
        )}
        {!liste.length && <Bos metin="Müşteri bulunamadı" />}
      </div>

      {kutu && (
        <div className="modal-layer" onClick={() => setKutu(null)}>
          <section className="trade-modal readable-modal ac-notice" onClick={(e) => e.stopPropagation()}>
            <h2>{kutu.yon === "yukle" ? "Bakiye Yükle" : "Bakiye Çıkar"}</h2>
            <p className="subtle-count">{kutu.user.full_name} · {kutu.user.account_no} · mevcut {money(kutu.user.cash_balance || 0)}</p>
            <Field label="Tutar (₺)" wide>
              <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm((x) => ({ ...x, amount: e.target.value }))} placeholder="0,00" />
            </Field>
            <Field label="Gerekçe (opsiyonel)" wide>
              <Input value={form.note} onChange={(e) => setForm((x) => ({ ...x, note: e.target.value }))} placeholder="Örn: Havale dekontu doğrulandı" />
            </Field>
            <div className="ac-actions">
              <button className="ac-ghost" onClick={() => setKutu(null)}>Vazgeç</button>
              <button className={kutu.yon === "yukle" ? "confirm" : "ac-danger"} disabled={busy} onClick={uygula}>
                {busy ? "İşleniyor…" : kutu.yon === "yukle" ? "Yükle" : "Çıkar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </Section>
  );
}

/* ---------- 12c. Piyasa kontrolü ---------- */

/** Borsadan fiyat çekmeyi durdurma ve hisse fiyatını elle belirleme. */
function MarketPanel({ ensure, onNotice }) {
  const [veri, setVeri] = useState({ prices: [], feed_enabled: true, manual_count: 0, total: 0, status: {} });
  const [query, setQuery] = useState("");
  const [adet, setAdet] = useState(40);
  const [kutu, setKutu] = useState(null);
  const [form, setForm] = useState({ price: "", change_pct: "" });
  const [busy, setBusy] = useState(false);

  const yukle = useCallback(async () => {
    try {
      setVeri(await api("/api/admin/prices"));
    } catch {
      setVeri({ prices: [], feed_enabled: true, manual_count: 0, total: 0, status: {} });
    }
  }, []);
  useEffect(() => { yukle(); }, [yukle]);
  useEffect(() => { setAdet(40); }, [query]);

  const liste = useMemo(() => {
    const needle = fold(query);
    return (veri.prices || []).filter((x) => !needle || fold(x.symbol).includes(needle) || fold(x.name).includes(needle));
  }, [veri, query]);

  const akisDegistir = async () => {
    if (!(await ensure())) return;
    try {
      await api("/api/admin/market-feed", { method: "POST", body: JSON.stringify({ enabled: !veri.feed_enabled }) });
      await yukle();
      onNotice(
        veri.feed_enabled ? "Fiyat akışı durdu" : "Fiyat akışı açıldı",
        veri.feed_enabled ? "Borsadan fiyat çekilmiyor; fiyatlar olduğu gibi duruyor." : "Fiyatlar yeniden borsadan geliyor.",
      );
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Ayar kaydedilemedi");
    }
  };

  const kaydet = async (sifirla = false) => {
    if (!(await ensure())) return;
    setBusy(true);
    try {
      await api("/api/admin/prices", {
        method: "POST",
        body: JSON.stringify({ symbol: kutu.symbol, price: sifirla ? "" : form.price, change_pct: sifirla ? "" : form.change_pct }),
      });
      await yukle();
      onNotice(sifirla ? "Canlıya döndü" : "Fiyat değişti",
        sifirla ? `${kutu.symbol} yeniden borsadan gelen fiyatı kullanacak.` : `${kutu.symbol} artık ${form.price} ₺.`);
      setKutu(null);
    } catch (hata) {
      onNotice("Olmadı", hata?.message || "Fiyat kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Piyasa Kontrolü" note={`${veri.total} enstrüman · ${veri.manual_count} tanesinin fiyatı elle verilmiş`} action={<button className="ac-ghost" onClick={yukle}>Yenile</button>}>
      <div className="ac-list">
        <div className="ac-line">
          <span>
            <strong>Borsadan fiyat çekme {veri.feed_enabled ? "açık" : "kapalı"}</strong>
            <small>{veri.feed_enabled
              ? "Fiyatlar canlı kaynaktan güncelleniyor"
              : "Fiyatlar donduruldu; yalnızca senin verdiğin fiyatlar geçerli"}</small>
          </span>
          <b className="ac-line-actions"><Anahtar acik={veri.feed_enabled} onChange={akisDegistir} /></b>
        </div>
        <div className="ac-line">
          <span>
            <strong>Son güncelleme</strong>
            <small>{veri.status?.updated_at_label || veri.status?.source || "—"} · {veri.status?.symbol_count ?? veri.total} sembol</small>
          </span>
        </div>
      </div>

      <AraSatiri value={query} onChange={setQuery} placeholder="Hisse kodu ya da şirket adı ara…" />
      <div className="ac-list scroll tall">
        {liste.slice(0, adet).map((x) => (
          <div className="ac-hisse fiyat" key={x.symbol}>
            <span className="kod">{x.symbol}</span>
            <span className="ad">{x.name}{x.manual && <em className="ac-rozet mor">elle</em>}</span>
            <span className="deg">
              <strong>{money(x.price)}</strong>
              <small className={Number(x.change_pct) >= 0 ? "ac-al" : "ac-sat"}>
                {Number(x.change_pct) >= 0 ? "+" : "−"}{Math.abs(Number(x.change_pct) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
              </small>
            </span>
            <button className="ac-ghost kare" aria-label="Fiyatı değiştir" title="Fiyatı değiştir"
              onClick={() => { setKutu(x); setForm({ price: String(x.price ?? "").replace(".", ","), change_pct: String(x.change_pct ?? "").replace(".", ",") }); }}>
              <Icon name="sliders" size={15} />
            </button>
          </div>
        ))}
        {liste.length > adet && (
          <button className="ac-line ac-more" onClick={() => setAdet((x) => x + 80)}>
            <span><strong>Daha fazla göster</strong><small>{liste.length - adet} enstrüman daha</small></span>
          </button>
        )}
        {!liste.length && <Bos metin="Enstrüman bulunamadı" />}
      </div>

      {kutu && (
        <div className="modal-layer" onClick={() => setKutu(null)}>
          <section className="trade-modal readable-modal ac-notice" onClick={(e) => e.stopPropagation()}>
            <h2>{kutu.symbol}</h2>
            <p className="subtle-count">{kutu.name} · şu an {money(kutu.price)}</p>
            <div className="ac-form">
              <Field label="Fiyat (₺)"><Input inputMode="decimal" value={form.price} onChange={(e) => setForm((x) => ({ ...x, price: e.target.value }))} /></Field>
              <Field label="Günlük değişim (%)"><Input inputMode="decimal" value={form.change_pct} onChange={(e) => setForm((x) => ({ ...x, change_pct: e.target.value }))} /></Field>
            </div>
            <span className="ac-empty">Verdiğin fiyat borsadan geleni ezer ve akış açık olsa bile korunur.</span>
            <div className="ac-actions">
              {kutu.manual && <button className="ac-ghost" disabled={busy} onClick={() => kaydet(true)}>Canlıya döndür</button>}
              <button className="ac-ghost" onClick={() => setKutu(null)}>Vazgeç</button>
              <button className="confirm" disabled={busy} onClick={() => kaydet(false)}>{busy ? "Kaydediliyor…" : "Fiyatı kaydet"}</button>
            </div>
          </section>
        </div>
      )}
    </Section>
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
  ["Dashboard", "grid"],
  ["Kullanıcılar", "user"],
  ["Portföyler", "portfolio"],
  ["Bakiye Detayları", "card"],
  ["Kredi Başvuruları", "wallet"],
  ["Kredi Ayarları", "list"],
  ["T+2 Takip", "clock"],
  ["Onay Bekleyenler", "check"],
  ["Banka Hesapları", "bank"],
  ["Para Yatırma Talepleri", "deposit"],
  ["Bakiye Yönetimi", "trend"],
  ["Para Çekme", "withdraw"],
  ["Hisse Açıklamaları", "table"],
  ["Sistem Ayarları", "gear"],
];

/* Referans paneldeki 14 başlık yukarıda; aşağıdakiler bizim sistemimizin
   fazladan yetkileri (emir onayı, kimlik belgeleri, denetim kaydı). */
const EK_MENU = [
  ["Piyasa Kontrolü", "trend"],
  ["Emirler", "swap"],
  ["Kullanıcı Doğrulama", "history"],
  ["Denetim Kaydı", "shield"],
];

/* Referanstaki sayfa alt başlıkları. */
const ALT_BASLIKLAR = {
  "Dashboard": "Sistem genel görünümü",
  "Kullanıcılar": "Kullanıcıları görüntüleyin ve yönetin",
  "Portföyler": "Kullanıcı portföylerini görüntüleyin ve düzenleyin",
  "Bakiye Detayları": "Nakit, bloke ve T+2 bakiyelerini izleyin",
  "Kredi Başvuruları": "Kredili yatırım başvurularını yönetin",
  "Kredi Ayarları": "Faiz, vade ve sözleşme maddelerini düzenleyin",
  "T+2 Takip": "Takas bekleyen tutarları izleyin",
  "Onay Bekleyenler": "Onay bekleyen tüm kayıtlar",
  "Banka Hesapları": "Kurum hesaplarını yönetin",
  "Para Yatırma Talepleri": "Yatırma taleplerini onaylayın",
  "Bakiye Yönetimi": "Müşteri bakiyesini yükleyin ya da çıkarın",
  "Para Çekme": "Çekme taleplerini onaylayın",
  "Hisse Açıklamaları": "Hisse adlarını ve açıklamalarını düzenleyin",
  "Sistem Ayarları": "Platform ayarlarını yapılandırın",
  "Piyasa Kontrolü": "Fiyat akışını durdurun, fiyatları elle belirleyin",
  "Emirler": "Emirleri onaylayın ya da reddedin",
  "Kullanıcı Doğrulama": "Kimlik belgesi inceleme ve onay işlemleri",
  "Denetim Kaydı": "Tüm yönetici işlemlerinin kaydı",
};

const TUM_SAYFALAR = [...MENU, ...EK_MENU].map(([ad]) => ad);

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
  useEffect(() => { if (sayfa === "Kullanıcı Doğrulama") belgeleriYukle(); }, [sayfa, belgeleriYukle]);

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
    "Para Yatırma Talepleri": moneyReqs.filter((m) => m.status === "pending" && m.request_type === "deposit").length,
    "Para Çekme": moneyReqs.filter((m) => m.status === "pending" && m.request_type === "withdraw").length,
    "Kredi Başvuruları": moneyReqs.filter((m) => m.status === "pending" && m.request_type === "credit").length,
    "Onay Bekleyenler": moneyReqs.filter((m) => m.status === "pending").length + orders.filter((o) => o.status === "pending").length,
  };

  /* Referansta yan menü geniş ekranda hep açık duruyor; telefonda çekmece. */
  const menu = (
    <nav className="ac-drawer" onClick={(e) => e.stopPropagation()}>
      <header>
        <div className="ac-drawer-brand">
          <span className="brand">Ottoman Yatırım</span>
          <div><strong>Admin Panel</strong><small>Yönetim</small></div>
        </div>
        <button className="ac-drawer-close" onClick={() => setMenuAcik(false)} aria-label="Kapat">✕</button>
      </header>
      <div className="ac-drawer-group">
        {MENU.map(([ad, simge]) => (
          <button key={ad} className={sayfa === ad ? "on" : ""} onClick={() => git(ad)}>
            <i aria-hidden="true"><Icon name={simge} size={19} /></i>
            <span>{ad}</span>
            {bekleyenSayilari[ad] ? <em>{bekleyenSayilari[ad]}</em> : null}
          </button>
        ))}
      </div>
      <div className="ac-drawer-group ek">
        <h4>Ottoman ek yetkiler</h4>
        {EK_MENU.map(([ad, simge]) => (
          <button key={ad} className={sayfa === ad ? "on" : ""} onClick={() => git(ad)}>
            <i aria-hidden="true"><Icon name={simge} size={19} /></i>
            <span>{ad}</span>
            {bekleyenSayilari[ad] ? <em>{bekleyenSayilari[ad]}</em> : null}
          </button>
        ))}
      </div>
      <button className="ac-drawer-geri" onClick={onClose}>← Ana Sayfaya Dön</button>
    </nav>
  );

  return (
    <div className={`stage admin-stage${dark ? " dark-mode" : ""}`}><div className="phone admin-phone ac-kabuk">
      <aside className="ac-yan">{menu}</aside>
      <main className="screen scroll admin-screen ac-root">
        <header className="ac-top">
          <button className="ac-menu-btn" onClick={() => setMenuAcik(true)} aria-label="Menü">☰</button>
          <div className="ac-top-copy">
            <h2>{sayfa}</h2>
            <small>{ALT_BASLIKLAR[sayfa] || "Yönetim"}</small>
          </div>
          <div className="ac-top-actions">
            <button className="ac-ghost" onClick={onClose}>Müşteri görünümü</button>
            <button className="ac-danger small" onClick={logout}>Çıkış</button>
          </div>
        </header>

        {sayfa === "Dashboard" && <Dashboard summary={summary} users={users} orders={orders} moneyReqs={moneyReqs} onGit={git} />}
        {sayfa === "Kullanıcılar" && <UsersPanel users={users} onSec={setSelected} onNotice={onNotice} ensure={lock.ensure} refresh={refresh} />}
        {sayfa === "Portföyler" && <PortfolioPanel users={users} onNotice={onNotice} ensure={lock.ensure} />}
        {sayfa === "Bakiye Detayları" && <BalancePanel ensure={lock.ensure} onNotice={onNotice} onSec={(b) => setSelected(users.find((u) => u.id === b.id) || null)} />}
        {sayfa === "Kredi Başvuruları" && <MoneyPanel moneyReqs={moneyReqs} tur="credit" baslik="Kredi Başvuruları" not="limit talepleri" ensure={lock.ensure} onNotice={onNotice} refresh={refresh} />}
        {sayfa === "Kredi Ayarları" && <CreditSettings settings={settings} ensure={lock.ensure} onNotice={onNotice} refresh={refresh} />}
        {sayfa === "T+2 Takip" && <T2Panel ensure={lock.ensure} onNotice={onNotice} settings={settings} refresh={refresh} users={users} />}
        {sayfa === "Onay Bekleyenler" && <PendingPanel users={users} orders={orders} moneyReqs={moneyReqs} onGit={git} onSec={setSelected} />}
        {sayfa === "Banka Hesapları" && <BankPanel onNotice={onNotice} ensure={lock.ensure} />}
        {sayfa === "Para Yatırma Talepleri" && <MoneyPanel moneyReqs={moneyReqs} tur="deposit" baslik="Para Yatırma Talepleri" not="dekont doğrulanınca onayla" ensure={lock.ensure} onNotice={onNotice} refresh={refresh} />}
        {sayfa === "Bakiye Yönetimi" && <LoadMoneyPanel users={users} ensure={lock.ensure} onNotice={onNotice} refresh={refresh} />}
        {sayfa === "Para Çekme" && <MoneyPanel moneyReqs={moneyReqs} tur="withdraw" baslik="Para Çekme Talepleri" not="IBAN kontrol edilir" ensure={lock.ensure} onNotice={onNotice} refresh={refresh} />}
        {sayfa === "Hisse Açıklamaları" && <StockNamesPanel onNotice={onNotice} ensure={lock.ensure} />}
        {sayfa === "Sistem Ayarları" && <SettingsPanel settings={settings} onNotice={onNotice} ensure={lock.ensure} refresh={refresh} />}
        {sayfa === "Piyasa Kontrolü" && <MarketPanel ensure={lock.ensure} onNotice={onNotice} />}
        {sayfa === "Emirler" && <OrdersPanel orders={orders} ensure={lock.ensure} onNotice={onNotice} refresh={refresh} />}
        {sayfa === "Denetim Kaydı" && <AuditPanel />}
        {sayfa === "Kullanıcı Doğrulama" && (
          <KycQueuePanel users={users} documents={documents} ensure={lock.ensure} onNotice={onNotice} refresh={belgeleriYukle} />
        )}
      </main>

      {menuAcik && (
        <div className="ac-drawer-layer" onClick={() => setMenuAcik(false)}>{menu}</div>
      )}

      {selected && (
        <UserEditor user={selected} onClose={() => setSelected(null)} onNotice={onNotice} ensure={lock.ensure} refresh={refresh} />
      )}

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
