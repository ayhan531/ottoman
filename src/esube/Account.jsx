// Hesap — MainPage.Home.cs içindeki BuildAccount() birebir karşılığı.
import React, { useState } from "react";
import Icon from "./icons.jsx";
import { Divided } from "./ui.jsx";
import { money } from "./market.js";

const Row = ({ title, subtitle, onClick }) => (
  <button className="list-row" onClick={onClick}>
    <span className="copy"><strong>{title}</strong><span>{subtitle}</span></span>
    <Icon name="chevron" size={18} color="var(--muted)" />
  </button>
);

export default function Account({
  brandBar, me, account, stockValue, monogram, onOpenPersonal, onOpenSecurity, onOpenContracts,
  onOpenNotifySettings, onTransfer, onHistory, onNotice, onPortfolio, onBankAccounts, version,
}) {
  const [hidden, setHidden] = useState(false);
  const cash = Number(account?.cash_balance || 0);
  const blocked = Number(account?.blocked_balance || 0);
  const available = Math.max(0, cash - blocked);
  const total = cash + stockValue;
  const mask = (text) => (hidden ? "••••••" : text);

  return (
    <div className="page gap-13">
      {brandBar}

      <button className="card outline pcard" onClick={onOpenPersonal}>
        <span className="ava n44">{me?.avatar_url ? <img src={me.avatar_url} alt="" /> : monogram}</span>
        <span className="who">
          <strong>{me?.full_name || "İsim Soyisim"}</strong>
          <span>Müşteri No: {me?.account_no || me?.id || "—"}</span>
        </span>
        <Icon name="chevron" size={18} color="var(--muted)" />
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="summary-head">
          <span>Finansal özet</span>
          <button className="eye-btn" onClick={() => setHidden((current) => !current)} aria-label="Tutarları gizle">
            <Icon name={hidden ? "eye-off" : "eye"} size={18} />
          </button>
        </div>
        <div className="card outline amount-list" onClick={onPortfolio} role="button" tabIndex={0}>
          <Divided>
            <div className="amount-row">
              <span className="lbl">Kullanılabilir bakiye</span>
              <span className="val b p">{mask(money(available))}</span>
            </div>
            <div className="amount-row">
              <span className="lbl"><Icon name="lock" size={15} color="var(--muted)" />Emirlerdeki bakiye</span>
              <span className="val b o">{mask(money(blocked))}</span>
            </div>
            <div className="amount-row">
              <span className="lbl">Portföy değeri</span>
              <span className="val">{mask(money(stockValue))}</span>
            </div>
            <div className="amount-row">
              <span className="lbl">Toplam değer</span>
              <span className="val b">{mask(money(total))}</span>
            </div>
          </Divided>
        </div>
      </div>

      <div className="quick-grid">
        <button className="tile-btn" onClick={() => onTransfer(true)}>
          <span className="tile" style={{ background: "var(--tint-green)", color: "var(--ink-green)" }}><Icon name="arrow-down" size={19} /></span>
          <span>Para yatır</span>
        </button>
        <button className="tile-btn" onClick={() => onTransfer(false)}>
          <span className="tile" style={{ background: "var(--tint-blue)", color: "var(--ink-blue)" }}><Icon name="arrow-up" size={19} /></span>
          <span>Para çek</span>
        </button>
        <button className="tile-btn" onClick={onBankAccounts}>
          <span className="tile" style={{ background: "var(--lavender)", color: "var(--purple)" }}><Icon name="card" size={19} /></span>
          <span>Banka hesaplarım</span>
        </button>
        <button className="tile-btn" onClick={onHistory}>
          <span className="tile" style={{ background: "var(--soft)", color: "var(--muted)" }}><Icon name="orders" size={19} /></span>
          <span>İşlem geçmişi</span>
        </button>
      </div>

      <span className="section-label">Hesap İşlemleri</span>
      <div className="card outline list-card">
        <Divided>
          <Row title="Kişisel bilgiler" subtitle="Kimlik ve iletişim bilgilerinizi yönetin" onClick={onOpenPersonal} />
          <Row title="Güvenlik" subtitle="Şifre, oturumlar ve güvenlik ayarları" onClick={onOpenSecurity} />
          <Row title="Banka hesaplarım" subtitle="Para yatırma ve çekme işlemleri için hesaplarınız" onClick={onBankAccounts} />
          <Row title="Sözleşmeler" subtitle="Çerçeve sözleşme, risk bildirimi ve bilgilendirme metinleri" onClick={onOpenContracts} />
        </Divided>
      </div>

      <span className="section-label">Diğer</span>
      <div className="card outline list-card">
        <Divided>
          <Row title="Bildirim ayarları" subtitle="Fiyat, haber ve işlem bildirimleri" onClick={onOpenNotifySettings} />
          <Row
            title="Yardım ve destek"
            subtitle="Sıkça sorulan sorular ve iletişim"
            onClick={() => onNotice("Yardım ve destek", "Al/Sat ekranından bir hisse seç, fiyat ve lot bilgilerini gir ve emri incele.")}
          />
          <Row
            title="Uygulama hakkında"
            subtitle={`Sürüm ${version} · Sürümünüz güncel.`}
            onClick={() => onNotice("Ottoman", `Sürüm ${version} · Sürümünüz güncel.`)}
          />
        </Divided>
      </div>
    </div>
  );
}
