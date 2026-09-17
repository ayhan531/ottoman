// Hızlı emir paneli — MainPage.QuickTrade.cs / MainPage.Trade.cs birebir karşılığı.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { Symbol, SearchBox, Dialog, Sheet, Divided } from "./ui.jsx";
import {
  money, percent, move, signed, parseAmount, group, isMarketOpen, businessDays, search,
  BIST, FUNDS, IPO, listFor,
} from "./market.js";
import { api } from "./store.js";

const KIND_NAMES = ["Hisse", "Fon", "Halka Arz"];
const KIND_MARKETS = [BIST, FUNDS, IPO];

const dateTime = (value) =>
  value ? new Date(value).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;

export function TradeHeader({ stock, onClose, watched, onToggleWatch, updatedAt }) {
  const up = stock.change >= 0;
  const stamp = dateTime(updatedAt);
  return (
    <div className="thead">
      <div className="logo"><Symbol logo={stock.logo} letter={stock.symbol} size={46} /></div>
      <div className="sym">
        {stock.symbol}
        <button className="star" onClick={onToggleWatch} aria-label="Takip listesi" style={{ color: watched ? "var(--purple)" : "var(--muted)", display: "flex", padding: 5 }}>
          <Icon name={watched ? "star-filled" : "star"} size={18} />
        </button>
      </div>
      <button className="icon-btn soft sm trade-close" onClick={onClose} aria-label="Kapat"><Icon name="close" size={18} /></button>
      <div className="nm">{stock.name}</div>
      <div className="price">{money(stock.price)}</div>
      <div className="src">
        <i className="dot" style={{ background: stamp ? "var(--green)" : "var(--ink-orange)" }} />
        {stamp || "Veri bekleniyor"}
      </div>
      <div className="badge-wrap">
        <span className={`move-badge ${up ? "up" : "down"}`}>
          <Icon name={up ? "trend" : "trend-down"} size={13} />
          {(up ? "+" : "−") + percent(Math.abs(stock.change))}
          <span>{(up ? "+" : "−") + money(Math.abs(stock.dayDelta || 0))}</span>
        </span>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="box">{children}</div>
    </div>
  );
}

const Info = ({ label, value }) => (
  <div className="field">
    <label>{label}</label>
    <div className="box"><span className="ro">{value}</span></div>
  </div>
);

export function TradePanel({
  stock, buying, sheet, searchable, instruments, cash, availableLots, watchlist,
  onToggleWatch, onPickStock, onClose, onSubmitted, onNotice, tradeKind, setTradeKind,
}) {
  const isFund = stock.kind === "fund";
  const isIpo = stock.kind === "ipo";
  const unit = isFund ? "pay" : "lot";
  const closed = !isFund && !isIpo && !isMarketOpen();

  const [buy, setBuy] = useState(isIpo ? true : buying);
  const [market, setMarket] = useState(!closed);
  const [byAmount, setByAmount] = useState(true);
  const [limitText, setLimitText] = useState(stock.price ? stock.price.toFixed(2).replace(".", ",") : "");
  const [quantityText, setQuantityText] = useState("");
  const [amountText, setAmountText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [kindOpen, setKindOpen] = useState(false);

  useEffect(() => {
    setBuy(isIpo ? true : buying);
    setMarket(!closed);
    setLimitText(stock.price ? stock.price.toFixed(2).replace(".", ",") : "");
    setQuantityText("");
    setAmountText("");
    setError("");
  }, [stock.symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const price = useMemo(() => {
    if (isFund || isIpo || market) return stock.price;
    const parsed = parseAmount(limitText);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : stock.price;
  }, [isFund, isIpo, market, limitText, stock.price]);

  const max = useMemo(() => {
    if (!buy) return availableLots;
    return price > 0 ? Math.floor(cash / (price * 1.001)) : 0;
  }, [buy, price, cash, availableLots]);

  const quantity = Number.parseInt(quantityText, 10) > 0 ? Number.parseInt(quantityText, 10) : 0;
  const total = quantity * price;
  const ratio = max > 0 ? Math.min(100, Math.max(0, Math.round((quantity * 100) / max))) : 0;

  const setQuantity = (value) => {
    const q = Math.max(0, Math.floor(value) || 0);
    setQuantityText(q > 0 ? String(q) : "");
    setAmountText(q > 0 ? (q * price).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
  };

  const onAmountChange = (raw) => {
    const pretty = group(raw);
    setAmountText(pretty);
    const value = parseAmount(pretty);
    const q = Number.isFinite(value) && price > 0 ? Math.floor(value / price) : 0;
    setQuantityText(q > 0 ? String(q) : "");
  };

  const matches = useMemo(() => {
    if (!searchable || !query.trim()) return [];
    return search(query, listFor(KIND_MARKETS[tradeKind], instruments), 5);
  }, [searchable, query, tradeKind, instruments]);

  const submit = async () => {
    setError("");
    if (quantity <= 0) { setError(isFund ? "En az 1 pay gir." : "En az 1 lot gir."); return; }
    if (isFund || isIpo) {
      onNotice(
        isIpo ? "Halka arz talebi" : "Fon işlemleri",
        "Bu ürün grubunda emir e-şube üzerinden iletilmiyor. Referansınız ile iletişime geçiniz."
      );
      return;
    }
    if (buy && total > cash) { setError("Yetersiz bakiye."); return; }
    if (!buy && quantity > availableLots) { setError("Satılabilir lot adedini aşıyorsun."); return; }
    onSubmitted({ stock, buy, quantity, price, market: market && !closed, duration: market ? "Günlük" : "İptale kadar" });
  };

  const priceField = isFund
    ? <Info label="Son açıklanan fon fiyatı" value={money(stock.price)} />
    : isIpo
      ? <Info label="Arz fiyatı" value={money(stock.price)} />
      : (
        <Field label="Limit fiyat (₺)">
          <input inputMode="decimal" value={limitText} onChange={(event) => setLimitText(event.target.value)} placeholder="0,00" />
        </Field>
      );

  const kindNames = isFund ? ["Alış", "Satış", "Tutar ile", "Pay ile"] : ["Alış", "Satış", "Piyasa", "Limit"];
  const typeOn = (index) => (index === 2 ? (isFund ? byAmount : market) : isFund ? !byAmount : !market);

  return (
    <div className="trade-body">
      {searchable && (
        <>
          <SearchBox placeholder="Hisse kodu / şirket adı ara" value={query} onChange={setQuery} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="kind-caption">
              Ürün Türü
              <button onClick={() => onNotice("Ürün Türü", "Arama yalnızca seçili türün listesinde yapılır ve alım/satım biçimi türe göre değişir: Hisse, Fon ya da Halka Arz.")} style={{ display: "flex", color: "var(--muted)" }}>
                <Icon name="info" size={15} />
              </button>
            </span>
            <button className="kind-picker" style={{ alignSelf: "flex-start" }} onClick={() => setKindOpen((open) => !open)}>
              {KIND_NAMES[tradeKind]}
              <Icon name="down" size={16} />
            </button>
            {kindOpen && (
              <div className="kind-menu" style={{ top: "100%", left: 0, marginTop: 6 }}>
                {KIND_NAMES.map((name, index) => (
                  <button
                    key={name}
                    className={index === tradeKind ? "on" : ""}
                    onClick={() => {
                      setKindOpen(false);
                      if (index === tradeKind) return;
                      setTradeKind(index);
                      const list = listFor(KIND_MARKETS[index], instruments);
                      const next = list.find((item) => item.code === stock.code) || list[0];
                      if (next) onPickStock(next);
                    }}
                  >
                    <span>{name}</span>
                    {index === tradeKind ? <Icon name="check" size={16} /> : <span />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {matches.length > 0 && (
            <Divided>
              {matches.map((item) => (
                <button key={item.code} className="match-row" onClick={() => { setQuery(""); onPickStock(item); }}>
                  <Symbol logo={item.logo} letter={item.symbol} size={30} />
                  <span className="c"><strong>{item.symbol}</strong><span>{item.name}</span></span>
                  <span className="p">{money(item.price)}</span>
                </button>
              ))}
            </Divided>
          )}
        </>
      )}

      {stock.quantity > 0 && (
        <div className="tstats">
          <div><span>Portföy</span><strong>{stock.quantity} {unit}</strong></div>
          <div><span>Maliyet</span><strong>{money(stock.avgCost)}</strong></div>
        </div>
      )}

      {!isIpo && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="seg2">
            <button
              className={typeOn(2) ? "on-type" : ""}
              disabled={!isFund && closed}
              onClick={() => (isFund ? setByAmount(true) : setMarket(true))}
            >
              {kindNames[2]}
            </button>
            <button className={typeOn(3) ? "on-type" : ""} onClick={() => (isFund ? setByAmount(false) : setMarket(false))}>
              {kindNames[3]}
            </button>
          </div>
          {closed && <div className="closed-note">Piyasa kapalı (10:00-18:00). Sadece limit emir verebilirsin.</div>}
          <div className="seg2">
            <button className={buy ? "on-buy" : ""} onClick={() => setBuy(true)}>Alış</button>
            <button className={!buy ? "on-sell" : ""} onClick={() => setBuy(false)}>Satış</button>
          </div>
        </div>
      )}

      {(isFund || isIpo || !market) && priceField}

      <div className="grid2">
        <Field label={isIpo ? "Talep lotu" : isFund ? (byAmount ? "Tahmini pay" : "Pay") : "Adet"}>
          <input
            inputMode="numeric"
            value={quantityText}
            readOnly={isFund && byAmount}
            onChange={(event) => setQuantity(Number.parseInt(event.target.value.replace(/\D/g, ""), 10) || 0)}
            placeholder="0"
          />
        </Field>
        <Field label={isIpo ? "Toplam talep (₺)" : isFund ? (byAmount ? "Tutar (₺)" : "Tahmini tutar (₺)") : "Tutar (₺)"}>
          <input
            inputMode="decimal"
            value={amountText}
            readOnly={isIpo || (isFund && !byAmount)}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="0,00"
          />
        </Field>
      </div>

      {isFund && <Info label="Valör" value={`T+2 · ${businessDays(2).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}`} />}

      {isIpo && (
        <div className="grid2">
          <Info label="Dağıtım yöntemi" value="Eşit dağıtım" />
          <Info
            label="Talep süresi"
            value={`${businessDays(1).getDate()}–${businessDays(3).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}`}
          />
        </div>
      )}

      <div className="shortcuts">
        {[25, 50, 75, 100].map((part) => (
          <button key={part} className="chip" onClick={() => setQuantity(Math.floor((max * part) / 100))}>%{part}</button>
        ))}
        <button className="all" onClick={() => setQuantity(max)}>Tümü</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="ratio-row"><span className="lbl">Oran</span><span className="val">%{ratio}</span></div>
        <input
          type="range"
          className="slider"
          min="0"
          max="100"
          value={ratio}
          onChange={(event) => setQuantity(Math.floor((max * Number(event.target.value)) / 100))}
        />
      </div>

      <div className="capacity">
        <span className="l">{buy ? "Kullanılabilir bakiye" : "Satılabilir adet"} <b>{buy ? money(cash) : `${max} ${unit}`}</b></span>
        {buy && <span className="r"><i className="vline" />Maks. {max} {unit}</span>}
      </div>

      {error && <div className="trade-error">{error}</div>}

      <div className={`trade-total ${buy ? "buy" : "sell"}`}>
        <span>{isIpo ? "Toplam talep" : "Tutar"}</span>
        <b style={{ color: buy ? "var(--green)" : "var(--red)" }}>{money(total)}</b>
      </div>

      <button
        className="btn"
        disabled={busy}
        style={{ background: buy ? "var(--green)" : "var(--red)", height: 46, borderRadius: 5, fontSize: "calc(15px * var(--s))" }}
        onClick={submit}
      >
        {isIpo ? "Talep oluştur" : buy ? "Alış emri ver" : "Satış emri ver"}
      </button>
    </div>
  );
}

/* ---------- emir onayı (ReviewOrder) ---------- */

export function ReviewOrder({ order, onCancel, onConfirmed }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { stock, buy, quantity, price, market } = order;
  const isFund = stock.kind === "fund";
  const isIpo = stock.kind === "ipo";

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          symbol: stock.code || stock.symbol,
          side: buy ? "buy" : "sell",
          order_type: market ? "market" : "limit",
          quantity,
          limit_price: price,
          amount_mode: "quantity",
          client_order_id: `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        }),
      });
      onConfirmed();
    } catch (problem) {
      setError(problem.message || "Emir iletilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const Row = ({ label, value, strong, tone }) => (
    <div className="detail-row">
      <span className="l">{label}</span>
      <span className={`v${strong ? " b" : ""}`} style={tone ? { color: tone } : undefined}>{value}</span>
    </div>
  );

  return (
    <Dialog
      title={isIpo ? "Halka arz talebini onayla" : buy ? "Alış emrini onayla" : "Satış emrini onayla"}
      onClose={onCancel}
      closable={false}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Row label="Emir" value={isIpo ? "Halka arz talebi" : isFund ? "Fon emri" : market ? "Piyasa" : "Limit"} />
        <Row label="İşlem" value={isIpo ? "Talep" : buy ? "Alış" : "Satış"} tone={buy ? "var(--green)" : "var(--red)"} />
        <Row label={isFund ? "Fon" : "Hisse"} value={stock.symbol} />
        <Row label={isFund ? "Fon fiyatı" : isIpo ? "Arz fiyatı" : "Fiyat"} value={money(price)} />
        <Row label={isFund ? "Pay" : isIpo ? "Talep lotu" : "Adet"} value={`${quantity} ${isFund ? "pay" : "lot"}`} />
        <div className="hline" />
        <Row label={isIpo ? "Toplam talep" : "Toplam"} value={money(quantity * price)} strong />
        {error && <div className="trade-error">{error}</div>}
        <div className="grid2">
          <button className="btn ghost" onClick={onCancel}>Vazgeç</button>
          <button className="btn" disabled={busy} onClick={confirm}>{busy ? "Gönderiliyor…" : "Onayla"}</button>
        </div>
      </div>
    </Dialog>
  );
}

/* ---------- sonuç kutusu (OrderResult) ---------- */

export function OrderResult({ order, onClose, onHistory, onOrders }) {
  const { stock, buy, quantity, price, market } = order;
  const isFund = stock.kind === "fund";
  const isIpo = stock.kind === "ipo";
  return (
    <Dialog
      title={market ? (buy ? "Alış gerçekleşti" : "Satış gerçekleşti") : isIpo ? "Talebin alındı" : "Emrin alındı"}
      onClose={onClose}
      closable={false}
      center
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "center" }}>
        <div className="result-mark"><Icon name="check" size={30} /></div>
        <strong style={{ fontSize: "calc(16px * var(--s))" }}>
          {stock.symbol} · {quantity}{isFund ? " pay · " : " lot · "}{money(price)}
        </strong>
        <span style={{ fontSize: "calc(13px * var(--s))", color: "var(--muted)" }}>
          {market
            ? "Portföyün ve bakiyen güncellendi; işlem geçmişine düştü."
            : isIpo
              ? "Halka arz talebini Portföy > Emirler altında izleyebilirsin."
              : "Limit emrini Portföy > Emirler altında izleyebilirsin."}
        </span>
        <button className="btn ghost" onClick={market ? onHistory : onOrders}>
          {market ? "İşlem geçmişine git" : "Emirlerimi gör"}
        </button>
        <button className="btn" onClick={onClose}>Bitti</button>
      </div>
    </Dialog>
  );
}

/* ---------- panel kabuğu: ortalanmış kutu ya da alttan sayfa ---------- */

export function QuickTrade({ asSheet, header, children, onClose }) {
  return asSheet
    ? <Sheet title={header} onClose={onClose} closable={false}>{children}</Sheet>
    : <Dialog title={header} onClose={onClose} closable={false}>{children}</Dialog>;
}
