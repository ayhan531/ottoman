// Alt sayfalar — Ayarlar, Güvenlik, Şifre, Kişisel Bilgiler, İletişim, Bildirim Ayarları, Sözleşmeler.
import React, { useMemo, useState } from "react";
import Icon from "./icons.jsx";
import { Divided, Toggle, Sheet, Choices, CenteredHeader, PageHeader } from "./ui.jsx";
import { CONTRACTS, PRIVACY } from "./contracts.js";
import { locale } from "./lang.js";
import { T } from "./lang.js";

export const SCALE_NAMES = ["Küçük", "Orta", "Büyük"];
export const SCALE_VALUES = [0.9, 1, 1.12];
export const ACCENT_NAMES = ["Mor", "Mavi", "Turkuaz", "Yeşil", "Turuncu", "Pembe", "Kırmızı", "Lacivert", "Gri"];
export const ACCENT_LIGHT = ["#7054F6", "#2F72E8", "#0E9AA7", "#1E9E6A", "#E3922F", "#D9479A", "#D6453D", "#2B3A8C", "#4B5563"];
export const ACCENT_NIGHT = ["#7B69DE", "#5187DB", "#30A7B2", "#37AF82", "#D49447", "#D061A3", "#D25E56", "#6E7BC4", "#8E949F"];
export const LANG_NAMES = ["Türkçe", "English", "Azərbaycanca", "Deutsch", "Français"];
export const DATA_NAMES = ["Canlı veri", "Yalnızca Wi-Fi", "Tasarruf"];

/* ---------- ortak satırlar ---------- */

const SettingsRow = ({ icon, label, value, chevron, onClick, tail }) => {
  const content = (
    <>
      <span className="ic">{typeof icon === "string" && icon.length <= 2 ? icon : <Icon name={icon} size={20} />}</span>
      <span className="lb">{label}</span>
      {tail || (value ? <span className="vl">{value}</span> : <span />)}
      {chevron ? <Icon name="chevron" size={18} color="var(--muted)" /> : <span />}
    </>
  );
  return onClick
    ? <button className="srow" onClick={onClick}>{content}</button>
    : <div className="srow">{content}</div>;
};

export const SecRow = ({ icon, label, note, tail, chevron, onClick }) => {
  const content = (
    <>
      <span className="disc"><Icon name={icon} size={20} /></span>
      <span className="copy"><strong>{label}</strong><span>{note}</span></span>
      {tail || <span />}
      {chevron ? <Icon name="chevron" size={18} color="var(--muted)" /> : <span />}
    </>
  );
  return onClick ? <button className="sec-row" onClick={onClick}>{content}</button> : <div className="sec-row">{content}</div>;
};

export const InfoRow = ({ title, note, chevron, tail, onClick }) => {
  const content = (
    <>
      <span className="copy"><strong>{title}</strong><span>{note}</span></span>
      {tail || <span />}
      {chevron ? <Icon name="chevron" size={18} color="var(--muted)" /> : <span />}
    </>
  );
  return onClick ? <button className="info-row" onClick={onClick}>{content}</button> : <div className="info-row">{content}</div>;
};

const Section = ({ heading, children }) => (
  <div className="sec-section">
    {heading && <div className="head">{heading}</div>}
    <div className="sec-card"><Divided>{children}</Divided></div>
  </div>
);

/* ---------- Ayarlar ---------- */

export function Settings({
  onBack, monogram, onProfile, dark, setDark, textSize, setTextSize, accent, setAccent,
  lang, setLang, dataMode, setDataMode, onNotify, onSecurity, onContracts, onPrivacy, version,
  me, accounts = [], onSwitchAccount, onAddAccount, onRemoveAccount,
}) {
  const [picker, setPicker] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const currentNo = me?.account_no || "";

  return (
    <div className="page gap-12">
      <div className="page-head with-tail">
        <button className="icon-btn" onClick={onBack} aria-label={T("Geri")}><Icon name="back" size={21} /></button>
        <h1 className="t22">{T("Ayarlar")}</h1>
        <button className="ava n36 lav" onClick={onProfile}>{monogram}</button>
      </div>

      <div className="settings-head">{T("Görünüm")}</div>
      <div className="scard">
        <Divided>
          <SettingsRow
            icon="sun"
            label={T("Tema")}
            tail={
              <span className="seg-pill">
                <button className={!dark ? "active" : ""} onClick={() => setDark(false)}>{T("Açık")}</button>
                <button className={dark ? "active" : ""} onClick={() => setDark(true)}>{T("Koyu")}</button>
              </span>
            }
          />
          <SettingsRow icon="Aa" label={T("Yazı boyutu")} value={T(SCALE_NAMES[textSize])} chevron onClick={() => setPicker("scale")} />
          <SettingsRow
            icon="palette"
            label={T("Renk modu")}
            chevron
            onClick={() => setPicker("accent")}
            tail={
              <span className="vl">
                <i style={{ width: 12, height: 12, borderRadius: 6, background: (dark ? ACCENT_NIGHT : ACCENT_LIGHT)[accent], display: "block" }} />
                {T(ACCENT_NAMES[accent])}
              </span>
            }
          />
        </Divided>
      </div>

      <div className="scard"><SettingsRow icon="bell" label={T("Bildirim tercihleri")} chevron onClick={onNotify} /></div>
      <div className="scard"><SettingsRow icon="shield" label={T("Güvenlik ayarları")} chevron onClick={onSecurity} /></div>
      <div className="scard"><SettingsRow icon="globe" label={T("Dil ve Bölge")} value={LANG_NAMES[lang]} chevron onClick={() => setPicker("lang")} /></div>
      <div className="scard">
        <SettingsRow icon="bars" label={T("Veri kullanımı")} value={T(DATA_NAMES[dataMode])} chevron onClick={() => setPicker("data")} />
      </div>

      <div className="settings-head">{T("Hesaplar")}</div>
      <div className="scard">
        <Divided>
          {accounts.map((item) => {
            const current = Boolean(currentNo) && item.accountNo === currentNo;
            return (
              <div className="acc-row" key={item.tc}>
                <span className="ava n36 lav">{(item.name || "?").trim().slice(0, 1).toLocaleUpperCase("tr-TR")}</span>
                <span className="copy">
                  <strong>{item.name}</strong>
                  <span>{item.accountNo || item.tc}</span>
                </span>
                {current
                  ? <span className="badge-sm buy">{T("Bu hesap")}</span>
                  : <button className="link-all" onClick={() => onSwitchAccount?.(item.tc)}>{T("Geçiş yap")}</button>}
                <button className="icon-btn" aria-label={T("Hesabı sil")} disabled={current} onClick={() => setConfirmRemove(item)}>
                  <Icon name="trash" size={18} color={current ? "var(--edge)" : "var(--muted)"} />
                </button>
              </div>
            );
          })}
          <SettingsRow icon="plus" label={T("Hesap ekle")} chevron onClick={onAddAccount} />
        </Divided>
      </div>

      <div className="settings-head">{T("Yasal ve Uygulama")}</div>
      <div className="scard">
        <Divided>
          <SettingsRow icon="orders" label={T("Sözleşmeler")} chevron onClick={onContracts} />
          <SettingsRow icon="shield" label={T("Gizlilik Politikası")} chevron onClick={onPrivacy} />
          <SettingsRow icon="info" label={T("Uygulama sürümü")} value={version} />
        </Divided>
      </div>

      {confirmRemove && (
        <Sheet title={T("Hesabı sil")} onClose={() => setConfirmRemove(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ fontSize: "calc(13.5px * var(--s))", color: "var(--muted)" }}>
              {T("Hesap yalnızca bu cihazdaki hızlı geçiş listesinden çıkar; e-şube hesabın kapanmaz.")}
            </span>
            <strong style={{ fontSize: "calc(15px * var(--s))" }}>{confirmRemove.name}</strong>
            <button className="btn primary-lg" onClick={() => { onRemoveAccount?.(confirmRemove.tc); setConfirmRemove(null); }}>{T("Listeden çıkar")}</button>
            <button className="btn ghost" onClick={() => setConfirmRemove(null)}>{T("Vazgeç")}</button>
          </div>
        </Sheet>
      )}
      {picker === "scale" && (
        <Sheet title={T("Yazı boyutu")} onClose={() => setPicker(null)}>
          <Choices names={SCALE_NAMES.map(T)} selected={textSize} onChoose={(index) => { setTextSize(index); setPicker(null); }} />
        </Sheet>
      )}
      {picker === "lang" && (
        <Sheet title={T("Dil ve Bölge")} onClose={() => setPicker(null)}>
          <Choices names={LANG_NAMES} selected={lang} onChoose={(index) => { setLang(index); setPicker(null); }} />
        </Sheet>
      )}
      {picker === "data" && (
        <Sheet title={T("Veri kullanımı")} onClose={() => setPicker(null)}>
          <Choices names={DATA_NAMES.map(T)} selected={dataMode} onChoose={(index) => { setDataMode(index); setPicker(null); }} />
        </Sheet>
      )}
      {picker === "accent" && (
        <Sheet title={T("Renk modu")} onClose={() => setPicker(null)}>
          <div className="accent-grid">
            {ACCENT_NAMES.map((name, index) => {
              const color = (dark ? ACCENT_NIGHT : ACCENT_LIGHT)[index];
              const on = accent === index;
              return (
                <button key={name} className={on ? "on" : ""} onClick={() => { setAccent(index); setPicker(null); }}>
                  <span className="ring" style={on ? { borderColor: color } : undefined}>
                    <span className="swatch" style={{ background: color }}>{on && <Icon name="check" size={24} />}</span>
                  </span>
                  <span style={on ? { color } : undefined}>{T(name)}</span>
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ---------- Güvenlik ---------- */

export function Security({ onBack, onPassword, onTwoFactor, sessions, onRevoke, confirmOn, setConfirmOn, passwordChangedAt, twoFactor, twoFactorMethod }) {
  const [devices, setDevices] = useState(false);
  const [openSessions, setOpenSessions] = useState(false);
  const changed = passwordChangedAt ? new Date(passwordChangedAt) : null;

  return (
    <div className="page gap-14">
      <CenteredHeader title={T("Güvenlik")} onBack={onBack} />
      <Section heading={T("HESAP GÜVENLİĞİ")}>
        <SecRow
          icon="lock"
          label={T("Şifre Değiştir")}
          note={changed ? `${T("Son değiştirme:")} ${changed.toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" })}` : T("Şifreni güncelle")}
          chevron
          onClick={onPassword}
        />
        <SecRow
          icon="shield"
          label={T("İki Adımlı Doğrulama")}
          note={twoFactor ? `${T("Açık •")} ${T(twoFactorMethod === 0 ? "SMS doğrulaması" : "Doğrulama uygulaması")}` : T("Kapalı")}
          chevron
          onClick={onTwoFactor}
        />
      </Section>
      <Section heading={T("GİRİŞ VE CİHAZLAR")}>
        <SecRow
          icon="phone"
          label={T("İşlem Onayı")}
          note={T("Para çekme ve kritik işlemlerde doğrulama")}
          tail={<Toggle on={confirmOn} onChange={setConfirmOn} />}
        />
        <SecRow icon="laptop" label={T("Güvenilir Cihazlar")} note={`${sessions.length} ${T("kayıtlı cihaz")}`} chevron onClick={() => setDevices(true)} />
        <SecRow icon="clock" label={T("Aktif Oturumlar")} note={`${sessions.length} ${T("aktif oturum")}`} chevron onClick={() => setOpenSessions(true)} />
      </Section>

      {(devices || openSessions) && (
        <Sheet title={T(devices ? "Güvenilir Cihazlar" : "Aktif Oturumlar")} onClose={() => { setDevices(false); setOpenSessions(false); }}>
          <Divided>
            {sessions.map((session) => {
              const mobile = /Mobile|Android|iPhone/i.test(session.device || "");
              return (
                <div className="sec-row" key={session.id}>
                  <span className="disc"><Icon name={mobile ? "phone" : "laptop"} size={20} /></span>
                  <span className="copy">
                    <strong>{(session.device || "").split(")")[0].split("(").pop() || "Cihaz"}</strong>
                    <span>{session.ip_address} · {T("Son giriş")} {session.last_seen_at}</span>
                  </span>
                  {session.current
                    ? <span className="badge-sm buy" style={{ padding: "3px 8px", fontSize: "calc(11px * var(--s))" }}>{T("Bu cihaz")}</span>
                    : <button className="link-all" onClick={() => onRevoke(session.id)}>{T("Kapat")}</button>}
                  <span />
                </div>
              );
            })}
          </Divided>
        </Sheet>
      )}
    </div>
  );
}

/* ---------- İki Adımlı Doğrulama ---------- */

// APK'daki maskeli gösterim: "+90 5•• ••• •• 42".
export const maskPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "").replace(/^90/, "").replace(/^0/, "");
  return digits.length >= 10 ? `+90 ${digits[0]}•• ••• •• ${digits.slice(-2)}` : "+90 5•• ••• •• ••";
};

const Radio = ({ on }) => (
  <span className="radio" data-on={on ? "1" : "0"}><i /></span>
);

export function TwoFactorPage({ onBack, twoFactor, twoFactorMethod, confirmOn, phone, onSave }) {
  const [enabled, setEnabled] = useState(twoFactor);
  const [method, setMethod] = useState(twoFactorMethod);
  const [confirm, setConfirm] = useState(confirmOn);

  return (
    <div className="page gap-14">
      <CenteredHeader title={T("İki Adımlı Doğrulama")} onBack={onBack} />
      <span style={{ fontSize: "calc(14px * var(--s))", color: "var(--muted)" }}>{T("Girişte ek doğrulama ile hesabınızı koruyun.")}</span>

      <div className="sec-card">
        <Divided>
          <SecRow
            icon="shield"
            label={T("İki Adımlı Doğrulama")}
            note={T("Hesabınızı daha güvenli hale getirin.")}
            tail={<Toggle on={enabled} onChange={setEnabled} />}
          />
        </Divided>
      </div>

      <Section heading={T("DOĞRULAMA YÖNTEMİ")}>
        <SecRow
          icon="message"
          label={T("SMS Doğrulama")}
          note={maskPhone(phone)}
          tail={<Radio on={method === 0} />}
          onClick={() => setMethod(0)}
        />
        <SecRow
          icon="phone"
          label={T("Doğrulama Uygulaması")}
          note={T("Google Authenticator, Microsoft Authenticator")}
          tail={<Radio on={method === 1} />}
          onClick={() => setMethod(1)}
        />
      </Section>

      <div className="sec-card">
        <Divided>
          <SecRow
            icon="phone"
            label={T("İşlem Onayı")}
            note={T("Para çekme ve kritik işlemlerde ek doğrulama")}
            tail={<Toggle on={confirm} onChange={setConfirm} />}
          />
        </Divided>
      </div>

      <button className="btn primary-lg" onClick={() => onSave(enabled, method, confirm)}>{T("Kaydet ve Devam Et")}</button>
    </div>
  );
}

/* ---------- Şifre Değiştir ---------- */

const RULES = ["En az 8 karakter", "Büyük ve küçük harf", "En az bir rakam", "Özel karakter"];
const checkRules = (text = "") => [
  text.length >= 8,
  /[A-ZĞÜŞİÖÇ]/.test(text) && /[a-zğüşıöç]/.test(text),
  /\d/.test(text),
  /[^\p{L}\d\s]/u.test(text),
];

function PasswordField({ label, value, onChange }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="pw-field">
      <label>{label}</label>
      <div className="box">
        <input type={shown ? "text" : "password"} value={value} placeholder="••••••••" onChange={(event) => onChange(event.target.value)} />
        <button className="icon-btn" onClick={() => setShown((current) => !current)} aria-label={T("Göster")}>
          <Icon name={shown ? "eye-off" : "eye"} size={20} color="var(--muted)" />
        </button>
      </div>
    </div>
  );
}

export function PasswordPage({ onBack, onSubmit }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = checkRules(next);
  const count = ok.filter(Boolean).length;
  const tone = count <= 1 ? "var(--red)" : count === 2 ? "var(--ink-orange)" : count === 3 ? "var(--purple)" : "var(--green)";
  const grade = !next ? "" : T(count <= 1 ? "Zayıf" : count === 2 ? "Orta" : count === 3 ? "İyi" : "Güçlü");

  const send = async () => {
    const problem = !current ? "Mevcut şifreni gir."
      : !ok.every(Boolean) ? "Yeni şifre dört kuralı da karşılamalı."
        : again !== next ? "Yeni şifreler eşleşmiyor."
          : current === next ? "Yeni şifre mevcut şifreyle aynı olamaz." : null;
    if (problem) { setError(T(problem)); return; }
    setBusy(true);
    try { await onSubmit(current, next); } catch (problemError) { setError(problemError.message); } finally { setBusy(false); }
  };

  return (
    <div className="page gap-14">
      <CenteredHeader title={T("Şifre Değiştir")} onBack={onBack} />
      <PasswordField label={T("Mevcut Şifre")} value={current} onChange={setCurrent} />
      <PasswordField label={T("Yeni Şifre")} value={next} onChange={setNext} />
      <PasswordField label={T("Yeni Şifre Tekrar")} value={again} onChange={setAgain} />
      <div className="sec-section">
        <div className="head">{T("ŞİFRE GÜVENLİĞİ")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 2px" }}>
          <div className="meter">
            <div className="bar">{[0, 1, 2, 3].map((index) => <i key={index} style={index < count ? { background: tone } : undefined} />)}</div>
            <span className="grade" style={{ color: tone }}>{grade}</span>
          </div>
          {RULES.map((rule, index) => (
            <div className={`rule${ok[index] ? " ok" : ""}`} key={rule}>
              <span className="disc"><Icon name="check" size={15} /></span>
              {T(rule)}
            </div>
          ))}
        </div>
      </div>
      {error && <span style={{ fontSize: "calc(12.5px * var(--s))", color: "var(--red)" }}>{error}</span>}
      <button className="btn primary-lg" disabled={busy} onClick={send}>{T("Şifreyi Değiştir")}</button>
    </div>
  );
}

/* ---------- Kişisel Bilgiler ---------- */

export function Personal({ onBack, me, onContact, onIdentity, onAvatar, monogram }) {
  return (
    <div className="page gap-14">
      <CenteredHeader title={T("Kişisel Bilgiler")} onBack={onBack} />
      <div className="sec-card">
        <Divided>
          <button className="sec-row" onClick={onAvatar}>
            <span className="ava n44 lav" style={{ overflow: "hidden" }}>
              {me?.avatar_url ? <img src={me.avatar_url} alt="" /> : monogram}
            </span>
            <span className="copy">
              <strong>{T("Profil fotoğrafı")}</strong>
              <span>{me?.avatar_url ? T("Fotoğrafı değiştir") : T("Fotoğraf yükle")}</span>
            </span>
            <span />
            <Icon name="chevron" size={18} color="var(--muted)" />
          </button>
          <InfoRow title={T("Kimlik Bilgileri")} note={T("Ad soyad, T.C. kimlik no ve doğum tarihi")} chevron onClick={onIdentity} />
          <InfoRow title={T("İletişim Bilgileri")} note={T("E-posta ve tebligat tercihiniz")} chevron onClick={onContact} />
        </Divided>
      </div>
    </div>
  );
}

export function Contact({ onBack, me, onNotice, channel, setChannel }) {
  const [picker, setPicker] = useState(false);
  const channels = ["E-posta", "SMS", "Posta"];
  return (
    <div className="page gap-14">
      <CenteredHeader title={T("İletişim Bilgileri")} onBack={onBack} />
      <div className="sec-card">
        <Divided>
          <InfoRow title={T("E-posta")} note={me?.email || T("E-postanızı giriniz")} chevron onClick={() => onNotice("E-posta", "Değişiklik için kayıtlı telefonuna doğrulama kodu gönderilir; bu sürümde kapalı.")} />
          <InfoRow title={T("Tebligat Tercihi")} note={T(channels[channel] || channels[0])} chevron onClick={() => setPicker(true)} />
        </Divided>
      </div>
      {picker && (
        <Sheet title={T("Tebligat Tercihi")} onClose={() => setPicker(false)}>
          <Choices names={channels.map((item) => T(item))} selected={channel} onChoose={(index) => { setChannel(index); setPicker(false); }} />
        </Sheet>
      )}
      <div className="contact-note">
        <Icon name="info" size={22} color="var(--muted)" />
        <span>{T("E-posta değişiklikleri için doğrulama gerekir.")}</span>
      </div>
    </div>
  );
}

/* ---------- Bildirim Ayarları ---------- */

const NOTIFY_KEYS = ["notify-price", "notify-news", "notify-trade", "notify-referral"];
const QUIET_HOURS = ["Kapalı", "22:00 - 08:00", "23:00 - 07:00", "00:00 - 08:00"];
const WEEKLY = ["Kapalı", "Her pazartesi 09:00", "Her cuma 18:00", "Her pazar 20:00"];

export function NotifySettings({ onBack, draft, setDraft, quiet, setQuiet, weekly, setWeekly, onSave }) {
  const [picker, setPicker] = useState(null);
  const anyOn = NOTIFY_KEYS.some((key) => draft[key]);
  const setAll = (on) => setDraft(Object.fromEntries(NOTIFY_KEYS.map((key) => [key, on])));

  const Type = ({ id, title, note }) => (
    <InfoRow title={title} note={note} tail={<Toggle on={Boolean(draft[id])} onChange={(on) => setDraft({ ...draft, [id]: on })} />} />
  );

  return (
    <div className="page gap-12 notify-page">
      <CenteredHeader title={T("Bildirim Ayarları")} onBack={onBack} />
      <div className="sec-card">
        <InfoRow title={T("Tüm Bildirimler")} note={T("Tüm bildirimleri tek dokunuşla aç veya kapat")} tail={<Toggle on={anyOn} onChange={setAll} />} />
      </div>
      <Section heading={T("BİLDİRİM TÜRLERİ")}>
        <Type id="notify-price" title={T("Fiyat Bildirimleri")} note={T("İzlediğiniz hisselerde fiyat uyarıları")} />
        <Type id="notify-news" title={T("Haber Bildirimleri")} note={T("Piyasa haberleri ve şirket duyuruları")} />
        <Type id="notify-trade" title={T("İşlem Bildirimleri")} note={T("Alım, satım ve emir gerçekleşmeleri")} />
        <Type id="notify-referral" title={T("Referans Bildirimleri")} note={T("Referansınızın işlem ve fırsat duyuruları")} />
      </Section>
      <Section heading={T("ZAMANLAMA")}>
        <InfoRow title={T("Sessiz Saatler")} note={T(QUIET_HOURS[quiet])} chevron onClick={() => setPicker("quiet")} />
        <InfoRow title={T("Haftalık Özet")} note={T(WEEKLY[weekly])} chevron onClick={() => setPicker("weekly")} />
      </Section>
      <button className="btn primary-lg" onClick={onSave}>{T("Kaydet")}</button>

      {picker === "quiet" && (
        <Sheet title={T("Sessiz Saatler")} onClose={() => setPicker(null)}>
          <Choices names={QUIET_HOURS.map(T)} selected={quiet} onChoose={(index) => { setQuiet(index); setPicker(null); }} />
        </Sheet>
      )}
      {picker === "weekly" && (
        <Sheet title={T("Haftalık Özet")} onClose={() => setPicker(null)}>
          <Choices names={WEEKLY.map(T)} selected={weekly} onChoose={(index) => { setWeekly(index); setPicker(null); }} />
        </Sheet>
      )}
    </div>
  );
}

export { NOTIFY_KEYS };

/* ---------- Sözleşmeler ---------- */

export function ContractsList({ onBack, onOpen }) {
  return (
    <div className="page gap-12">
      <PageHeader title={T("Sözleşmeler")} onBack={onBack} />
      <div className="card outline" style={{ padding: "3px 16px" }}>
        <Divided>
          {CONTRACTS.map((item, index) => (
            <button className="contract-row" key={item.title} onClick={() => onOpen(item)}>
              <span className="num">{index + 1}</span>
              <span style={{ textAlign: "left" }}>{item.title}</span>
              <Icon name="chevron" size={18} color="var(--muted)" />
            </button>
          ))}
        </Divided>
      </div>
      <span style={{ fontSize: "calc(12px * var(--s))", color: "var(--muted)" }}>{T("Bu metinler bilgilendirme amaçlıdır.")}</span>
    </div>
  );
}

export function DocumentPage({ document: doc, onBack }) {
  const blocks = useMemo(() => {
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
  }, [doc]);

  return (
    <div className="page gap-14">
      <PageHeader title={doc?.title || "Belge"} onBack={onBack} />
      <div className="doc-card">
        {blocks.map((block, index) =>
          block.type === "head" ? <h3 key={index}>{block.text}</h3>
            : block.type === "bullet" ? <div className="bullet" key={index}><span>•</span><span>{block.text}</span></div>
              : <p key={index}>{block.text}</p>
        )}
      </div>
    </div>
  );
}

export { CONTRACTS, PRIVACY };
