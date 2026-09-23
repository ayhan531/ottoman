// Hesap — MainPage.Home.cs içindeki BuildAccount() birebir karşılığı.
import React, { useState } from "react";
import Icon from "./icons.jsx";
import { Divided } from "./ui.jsx";
import { money } from "./market.js";
import { T } from "./lang.js";

const Row = ({ title, subtitle, onClick }) => (
  <button className="list-row" onClick={onClick}>
    <span className="copy"><strong>{title}</strong><span>{subtitle}</span></span>
    <Icon name="chevron" size={18} color="var(--muted)" />
  </button>
);

export default function Account({
  brandBar, me, account, stockValue, monogram, onOpenPersonal, onOpenSecurity, onOpenContracts,
  onOpenNotifySettings, onTransfer, onHistory, onNotice, onPortfolio, onBankAccounts, version, onLogout,
  onOpenKyc, kycApproved, moneyRequests, onCancelMoneyRequest,
}) {
  const [hidden, setHidden] = useState(false);
  const cash = Number(account?.cash_balance || 0);
  const legacyBlocked = Number(account?.blocked_balance || 0);
  const pendingWithdrawals = Number(account?.pending_withdrawals || 0);
  const blocked = Number(account?.orders_reserved || 0);
  const available = Math.max(0, cash - legacyBlocked - pendingWithdrawals);
  const total = cash + stockValue;
  const mask = (text) => (hidden ? "••••••" : text);

  return (
    <div className="page gap-13">
      {brandBar}

      <button className="card outline pcard" onClick={onOpenPersonal}>
        <Icon name="chevron" size={18} color="var(--muted)" className="pcard-chevron" />
        <span className="ava n50">{me?.avatar_url ? <img src={me.avatar_url} alt="" /> : monogram}</span>
        <span className="who">
          <strong>{me?.full_name || "İsim Soyisim"}</strong>
          <span>{T("Müşteri No:")} {me?.account_no || me?.id || "—"}</span>
        </span>
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="summary-head">
          <span>{T("Finansal özet")}</span>
          <button className="eye-btn" onClick={() => setHidden((current) => !current)} aria-label={T("Tutarları gizle")}>
            <Icon name={hidden ? "eye-off" : "eye"} size={18} />
          </button>
        </div>
        <div className="card outline amount-list" onClick={onPortfolio} role="button" tabIndex={0}>
          <Divided>
            <div className="amount-row">
              <span className="lbl">{T("Kullanılabilir bakiye")}</span>
              <span className="val b p">{mask(money(available))}</span>
            </div>
            <div className="amount-row">
              <span className="lbl"><Icon name="lock" size={15} color="var(--muted)" />{T("Emirlerdeki bakiye")}</span>
              <span className="val b o">{mask(money(blocked))}</span>
            </div>
            <div className="amount-row">
              <span className="lbl">{T("Portföy değeri")}</span>
              <span className="val">{mask(money(stockValue))}</span>
            </div>
            <div className="amount-row">
              <span className="lbl">{T("Toplam değer")}</span>
              <span className="val b">{mask(money(total))}</span>
            </div>
          </Divided>
        </div>
      </div>

      <div className="quick-grid">
        <button className={`tile-btn${kycApproved ? "" : " tile-passive"}`} onClick={() => onTransfer(true)}>
          <span className="tile" style={{ background: "var(--tint-green)", color: "var(--ink-green)" }}><Icon name="arrow-down" size={19} /></span>
          <span>{T("Para yatır")}</span>
        </button>
        <button className={`tile-btn${kycApproved ? "" : " tile-passive"}`} onClick={() => onTransfer(false)}>
          <span className="tile" style={{ background: "var(--tint-blue)", color: "var(--ink-blue)" }}><Icon name="arrow-up" size={19} /></span>
          <span>{T("Para çek")}</span>
        </button>
        <button className={`tile-btn${kycApproved ? "" : " tile-passive"}`} onClick={onBankAccounts}>
          <span className="tile" style={{ background: "var(--lavender)", color: "var(--purple)" }}><Icon name="card" size={19} /></span>
          <span>{T("Banka hesaplarım")}</span>
        </button>
        <button className="tile-btn" onClick={onHistory}>
          <span className="tile" style={{ background: "var(--soft)", color: "var(--muted)" }}><Icon name="orders" size={19} /></span>
          <span>{T("Bakiye Geçmişi")}</span>
        </button>
      </div>

      <span className="section-label">{T("Bakiye Geçmişi")}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        {(moneyRequests && moneyRequests.length) ? moneyRequests.map((item) => {
          const renk = item.status === "rejected" ? "var(--red)" : item.status === "approved" ? "var(--green)" : "var(--ink-blue)";
          return (
            <div className="order-card" key={item.id}>
              <div className="rowline">
                <strong style={{ fontSize: "calc(15.5px * var(--s))" }}>{item.type_label}</strong>
                <span style={{ fontSize: "calc(12px * var(--s))", fontWeight: 700, color: "var(--ink-blue)" }}>{money(item.amount)}</span>
              </div>
              <span style={{ fontSize: "calc(12px * var(--s))", color: "var(--muted)" }}>
                {item.created_at_label} &nbsp;<b style={{ color: renk }}>{item.status_label || T("Beklemede")}</b>
              </span>
              {!!(item.status_label === "Reddedildi" && item.admin_note) && (
                <span style={{ fontSize: "calc(12px * var(--s))", color: "var(--red)" }}>{T("Not:")} {item.admin_note}</span>
              )}
              {item.status === "pending" && item.request_type === "withdraw" && (
                <button className="btn ghost" onClick={() => onCancelMoneyRequest?.(item)}>{T("Talebi iptal et")}</button>
              )}
            </div>
          );
        }) : (
          <div className="order-card">
            <span style={{ fontSize: "calc(13px * var(--s))", color: "var(--muted)" }}>
              {T("Henüz bir para yatırma veya çekme talebiniz yok.")}
            </span>
          </div>
        )}
      </div>

      {!kycApproved && (
        <div className="card outline kyc-banner" onClick={onOpenKyc} role="button" tabIndex={0}>
          <Icon name="lock" size={18} color="var(--red, #e5484d)" />
          <span>{T("Hesabınızı onaylamak için kimlik doğrulama yapmanız gerekmektedir.")}</span>
          <Icon name="chevron" size={18} color="var(--muted)" />
        </div>
      )}

      <span className="section-label">{T("Hesap İşlemleri")}</span>
      <div className="card outline list-card">
        <Divided>
          <Row title={T("Kişisel bilgiler")} subtitle={T("Kimlik ve iletişim bilgilerinizi yönetin")} onClick={onOpenPersonal} />
          <Row title={T("Güvenlik")} subtitle={T("Şifre, iki adımlı doğrulama ve güvenlik ayarları")} onClick={onOpenSecurity} />
          <Row
            title={T("Kimlik Doğrulama")}
            subtitle={kycApproved ? T("Onaylandı") : T("Hesabını onaylatmak için belgelerini yükle")}
            onClick={onOpenKyc}
          />
          <Row title={T("Banka hesaplarım")} subtitle={T("Para yatırma ve çekme işlemleri için hesaplarınız")} onClick={onBankAccounts} />
          <Row title={T("Sözleşmeler")} subtitle={T("Çerçeve sözleşme, risk bildirimi ve bilgilendirme metinleri")} onClick={onOpenContracts} />
        </Divided>
      </div>

      <span className="section-label">{T("Diğer")}</span>
      <div className="card outline list-card">
        <Divided>
          <Row title={T("Bildirim ayarları")} subtitle={T("Fiyat, haber ve işlem bildirimleri")} onClick={onOpenNotifySettings} />
          <Row
            title={T("Yardım ve destek")}
            subtitle={T("Sıkça sorulan sorular ve iletişim")}
            onClick={() => onNotice("Yardım ve destek", "Al/Sat ekranından bir hisse seç, fiyat ve lot bilgilerini gir ve emri incele.")}
          />
          <Row
            title={T("Uygulama hakkında")}
            subtitle={`${T("Sürüm")} ${version} · ${T("Sürümünüz güncel.")}`}
            onClick={() => onNotice("Ottoman Yatırım", `${T("Sürüm")} ${version} · ${T("Sürümünüz güncel.")}`)}
          />
        </Divided>
      </div>

      <button
        className="card outline list-card"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--red, #e5484d)", fontWeight: 600, padding: "14px" }}
        onClick={() => {
          if (window.confirm(T("Çıkış yapmak istediğinize emin misiniz?"))) onLogout?.();
        }}
      >
        <Icon name="logout" size={18} color="var(--red, #e5484d)" />
        {T("Çıkış Yap")}
      </button>
    </div>
  );
}
