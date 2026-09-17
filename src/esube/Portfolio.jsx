// Portföy — MainPage.Portfolio.cs birebir karşılığı.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { Symbol, SearchBox, Divided, Donut, Spark, Sheet } from "./ui.jsx";
import { money, percent, signed, delta, fold } from "./market.js";

const MINT = "#7FE3C4", ROSE = "#FF9EB5", MINT_SOFT = "#CFF5E6", ROSE_SOFT = "#FFD6E0", CASH_TONE = "#FFD48A";
const FAINT = "rgba(255,255,255,.72)";

const pctText = (value) => (value >= 0 ? "+" : "−") + percent(Math.abs(value || 0));
const stars = (text) => "★".repeat(Math.min(8, Math.max(4, String(text).length - 2)));

/* ---------- kart yığını (Deck) ---------- */
const Deck = ({ children }) => (
  <div className="pf-deck">
    <i className="under u1" />
    <i className="under u2" />
    {children}
  </div>
);

/* ---------- özet kartı ---------- */

function SummaryCard({ total, profit, ratio, available, t2, stockValue, cost, cash, hidden, onToggleHidden }) {
  const basis = (profit >= 0 ? cost : stockValue) + Math.abs(profit) + cash;
  const share = (value) => (basis === 0 ? 0 : value / basis);
  const stockShare = share(profit >= 0 ? cost : stockValue);
  const gainShare = share(Math.abs(profit));
  const cashShare = share(cash);
  const gainTone = profit >= 0 ? MINT : ROSE;
  const mask = (text) => (hidden ? stars(text) : text);

  return (
    <div className="pf-card">
      <div className="pf-grid">
        <div className="pf-head" style={{ gridColumn: "1 / -1" }}>
          <span>Portföy özeti</span>
          <button className="pf-eye" onClick={onToggleHidden} aria-label="Tutarları gizle">
            <Icon name={hidden ? "eye-off" : "eye"} size={18} />
          </button>
        </div>

        <div className={`pf-total${hidden ? " masked" : ""}`}>{mask(money(total))}</div>

        <div className={`pf-gain ${profit >= 0 ? "plus" : "minus"}${hidden ? " masked" : ""}`}>
          {hidden ? stars("xxxxxxx") : `${delta(profit, ratio)} ${profit >= 0 ? "toplam kâr" : "toplam zarar"}`}
        </div>

        <div className="pf-mini">
          <div><span>Kullanılabilir</span><b className={hidden ? "masked" : ""}>{mask(money(available))}</b></div>
          <div><span>T+2 Bakiye</span><b className={hidden ? "masked" : ""}>{mask(money(t2))}</b></div>
        </div>

        <div className="pf-alloc" style={hidden ? { filter: "blur(9px)", opacity: 0.85 } : undefined}>
          <Donut
            parts={[[stockShare, "#fff"], [gainShare, gainTone], [cashShare, CASH_TONE]]}
            center={`%${Math.round(stockShare * 100)}`}
            size={76}
          />
          <div className="pf-legend">
            <div><i style={{ background: "#fff" }} />Pozisyonlar · %{Math.round(stockShare * 100)}</div>
            <div><i style={{ background: CASH_TONE }} />Bakiye · %{Math.round(cashShare * 100)}</div>
            <div><i style={{ background: gainTone }} />{profit >= 0 ? "Kâr" : "Zarar"} · {pctText(ratio)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- getiri kartı ---------- */

function ReturnsCard({ holdings, profit, ratio, history, historyState, onRetry }) {
  const tone = profit >= 0 ? MINT_SOFT : ROSE_SOFT;
  const best = holdings
    .filter((item) => item.quantity > 0 && item.cost > 0)
    .sort((a, b) => b.profit / b.cost - a.profit / a.cost)[0];

  const points = useMemo(() => {
    if (!history || history.length < 2) return [];
    const base = history[0].value || 1;
    return history.map((row, index) => {
      const daily = index === 0 ? 0 : (row.value / (history[index - 1].value || 1) - 1) * 100;
      return {
        value: (row.value / base - 1) * 100,
        date: new Date(row.day).toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short" }),
        label: pctText(daily),
        up: daily >= 0,
      };
    });
  }, [history]);

  const weekChange = useMemo(() => {
    if (!history || history.length < 2) return null;
    const last = history[history.length - 1].value;
    const target = history[Math.max(0, history.length - 6)].value;
    return target ? (last / target - 1) * 100 : 0;
  }, [history]);

  const monthChange = useMemo(() => {
    if (!history || history.length < 2) return null;
    const last = history[history.length - 1].value;
    const first = history[0].value;
    return first ? (last / first - 1) * 100 : 0;
  }, [history]);

  const line = points.length && points[points.length - 1].value >= 0 ? MINT : ROSE;

  return (
    <div className="pf-card" style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div className="rowline">
        <strong style={{ fontSize: "calc(16px * var(--s))" }}>Getiri Özeti</strong>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: FAINT, fontSize: "calc(12px * var(--s))" }}>
          <Icon name="bars" size={18} />
          Pozisyon sayısı: {holdings.filter((item) => item.quantity > 0).length}
        </span>
      </div>

      <div className="returns-body" style={{ flex: 1 }}>
        <div className="returns-figures">
          <span className="lbl">Toplam getiri</span>
          <span className="amt" style={{ color: tone }}>{signed(profit)}</span>
          <span className="rat" style={{ color: tone }}>({pctText(ratio)})</span>
        </div>
        <div style={{ minWidth: 0, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
          {points.length >= 2 ? (
            <Spark points={points} line={line} fill={`${line}2e`} upBubble={MINT_SOFT} downBubble={ROSE_SOFT} height={116} />
          ) : (
            <button onClick={onRetry} style={{ color: FAINT, fontSize: "calc(12px * var(--s))", textAlign: "right" }}>
              {historyState === "failed" ? "Grafik alınamadı. Dokunup yeniden dene." : "Grafik verisi birikiyor…"}
            </button>
          )}
        </div>
      </div>

      <div className="returns-stats">
        <div className="st">
          <span>1 Hafta</span>
          <b style={{ color: weekChange === null ? FAINT : weekChange >= 0 ? MINT_SOFT : ROSE_SOFT }}>{weekChange === null ? "—" : pctText(weekChange)}</b>
        </div>
        <div className="st">
          <span>1 Ay</span>
          <b style={{ color: monthChange === null ? FAINT : monthChange >= 0 ? MINT_SOFT : ROSE_SOFT }}>{monthChange === null ? "—" : pctText(monthChange)}</b>
        </div>
        <div className="returns-best">
          <span className="lbl">En yüksek getiri</span>
          {best ? (
            <span className="row">
              <Symbol logo={best.logo} letter={best.symbol} size={24} />
              {best.symbol}
              <span style={{ color: best.profit >= 0 ? MINT_SOFT : ROSE_SOFT }}>{pctText((best.profit / best.cost) * 100)}</span>
            </span>
          ) : (
            <span className="row">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- işlem kartı ---------- */

const parseAvgCost = (note = "") => {
  const match = /Ortalama maliyet:\s*([\d.,]+)/.exec(note);
  return match ? Number(match[1].replace(",", ".")) : 0;
};
const parseFee = (note = "") => {
  const match = /Komisyon:\s*([\d.,]+)/.exec(note);
  return match ? Number(match[1].replace(",", ".")) : 0;
};

export function toTrade(row) {
  const buy = row.transaction_type === "trade_buy";
  const quantity = Number(row.quantity || 0);
  const price = Number(row.price || 0);
  const total = quantity * price;
  const avgCost = buy ? price : parseAvgCost(row.note) || price;
  const fee = parseFee(row.note);
  const net = buy ? total + fee : total - fee;
  const profit = buy ? 0 : net - quantity * avgCost;
  return {
    symbol: row.code || "",
    name: row.name || row.code || "",
    buy,
    quantity,
    price,
    total,
    fee,
    net,
    avgCost,
    profit,
    profitPercent: avgCost && quantity ? (profit / (quantity * avgCost)) * 100 : 0,
    date: new Date((Number(row.created_at) || 0) * 1000),
  };
}

function TransactionCard({ trade, logo, onOpen }) {
  const sell = !trade.buy;
  const content = (
    <div className="trx-grid">
      <Symbol logo={logo} letter={trade.symbol} size={40} tinted />
      <span className="c">
        <span className="hd">
          <strong>{trade.symbol}</strong>
          <span className={`badge-sm ${sell ? "sell" : "buy"}`}>{sell ? "SATIŞ" : "ALIŞ"}</span>
        </span>
        <span>{trade.quantity} lot &nbsp;{money(trade.price)}</span>
      </span>
      <span className="r">
        {sell && <span className="pl" style={{ color: trade.profit >= 0 ? "var(--green)" : "var(--red)" }}>{delta(trade.profit, trade.profitPercent)}</span>}
        <span className={`tot${sell ? "" : " b"}`}>{money(trade.total)}</span>
        <span className="dt">{trade.date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} {trade.date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
      </span>
    </div>
  );
  return sell
    ? <button className="trx-card" onClick={() => onOpen(trade)}>{content}</button>
    : <div className="trx-card">{content}</div>;
}

/* ---------- işlem detayı ---------- */

export function TransactionDetail({ trade, logo, onClose }) {
  const tone = trade.profit >= 0 ? "var(--green)" : "var(--red)";
  const Row = ({ label, value, strong }) => (
    <div className="detail-row">
      <span className="l" style={{ color: "var(--muted)" }}>{label}</span>
      <span className="v" style={strong ? { fontWeight: 700 } : undefined}>{value}</span>
    </div>
  );
  const head = (
    <div style={{ display: "grid", gridTemplateColumns: "38px 1fr", gap: 11, alignItems: "center" }}>
      <Symbol logo={logo} letter={trade.symbol} size={38} />
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <strong style={{ fontSize: "calc(18px * var(--s))" }}>{trade.symbol}</strong>
        <span style={{ fontSize: "calc(13px * var(--s))", color: "var(--muted)" }}>{trade.name}</span>
      </span>
    </div>
  );
  return (
    <Sheet title={head} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <span className="spill">Gerçekleşti</span>
        {!trade.buy && (
          <div className={`pl-box ${trade.profit >= 0 ? "plus" : "minus"}`}>
            <div className="cap">
              <span className="t">K/Z Oranı</span>
              <span className="pct" style={{ color: tone }}>{pctText(trade.profitPercent)}</span>
            </div>
            <span className="amt" style={{ color: tone, fontSize: "calc(12px * var(--s))" }}>{signed(trade.profit)}</span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: "calc(12.5px * var(--s))", fontWeight: 700, color: "var(--muted)" }}>İşlem detayları</span>
          <Row label={trade.buy ? "Alınan adet" : "Satılan adet"} value={`${trade.quantity} lot`} />
          <Row label={trade.buy ? "Alış tarihi" : "Satış tarihi"} value={trade.date.toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })} />
          {!trade.buy && <Row label="Ort. alış fiyatı" value={money(trade.avgCost)} />}
          <Row label={trade.buy ? "Alış fiyatı" : "Satış fiyatı"} value={money(trade.price)} />
          <Row label="Toplam Maliyet" value={money(trade.buy ? trade.total : trade.quantity * trade.avgCost)} />
          <Row label="Komisyon" value={trade.fee > 0 ? money(trade.fee) : "Ücretsiz"} />
          <Row label="Net Sonuç" value={money(trade.net)} strong />
        </div>
        <div className="hline" />
        <button className="btn tall" onClick={onClose}>Devam et</button>
      </div>
    </Sheet>
  );
}

/* ---------- ekran ---------- */

export default function Portfolio({
  brand, holdings, account, orders, transactions, instruments, history, historyState, onRetryHistory,
  tab, setTab, card, setCard, hidden, setHidden, openPosition, onCancelOrder, onCreateOrder,
}) {
  const lane = useRef(null);
  const viewport = useRef(null);
  const [drag, setDrag] = useState(null);
  const [width, setWidth] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(0);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const node = viewport.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    setWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  const stride = width + 12;
  const offset = drag === null ? -card * stride : drag;

  const onPointerDown = (event) => {
    if (event.target.closest(".spark") || event.target.closest("button")) return;
    setDrag(-card * stride);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.startX = event.clientX;
    event.currentTarget.dataset.origin = -card * stride;
  };
  const onPointerMove = (event) => {
    if (drag === null) return;
    const start = Number(event.currentTarget.dataset.startX || 0);
    const origin = Number(event.currentTarget.dataset.origin || 0);
    setDrag(Math.min(0, Math.max(-stride, origin + (event.clientX - start))));
  };
  const onPointerUp = () => {
    if (drag === null) return;
    const moved = -drag / stride;
    setCard(card === 0 ? (moved > 0.3 ? 1 : 0) : moved < 0.7 ? 0 : 1);
    setDrag(null);
  };

  const cash = Number(account?.cash_balance || 0);
  const blocked = Number(account?.blocked_balance || 0);
  const pending = Number(account?.pending_balance || 0);
  const available = Math.max(0, cash - blocked);
  const t2 = cash + pending;
  const stockValue = holdings.reduce((sum, item) => sum + item.value, 0);
  const cost = holdings.reduce((sum, item) => sum + item.cost, 0);
  const profit = stockValue - cost;
  const ratio = cost === 0 ? 0 : (profit / cost) * 100;
  const total = stockValue + cash;

  const logoOf = useMemo(() => {
    const map = new Map(instruments.map((item) => [item.code, item.logo]));
    return (code) => map.get(code) || "";
  }, [instruments]);

  const positions = useMemo(() => {
    const needle = fold(query);
    return holdings.filter((item) => item.quantity > 0 && (!needle || fold(`${item.symbol} ${item.name}`).includes(needle)));
  }, [holdings, query]);

  const trades = useMemo(() => {
    const needle = query.trim().toLocaleUpperCase("tr-TR");
    return transactions
      .filter((row) => row.transaction_type === "trade_buy" || row.transaction_type === "trade_sell" || row.transaction_type === "stock_sale")
      .map(toTrade)
      .filter((trade) => (filter === 0 || (filter === 1 ? trade.buy : !trade.buy)) && (!needle || trade.symbol.includes(needle)))
      .sort((a, b) => b.date - a.date);
  }, [transactions, filter, query]);

  return (
    <div className="page gap-16">
      {brand}

      <div
        className="pf-viewport"
        ref={viewport}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="pf-lane"
          ref={lane}
          style={{ transform: `translateX(${offset}px)`, transition: drag === null ? "transform .26s cubic-bezier(.33,1,.68,1)" : "none" }}
        >
          <div style={{ width: width || "100%", flex: "none" }}>
            <Deck>
              <SummaryCard
                total={total} profit={profit} ratio={ratio} available={available} t2={t2}
                stockValue={stockValue} cost={cost} cash={cash}
                hidden={hidden} onToggleHidden={() => setHidden(!hidden)}
              />
            </Deck>
          </div>
          <div style={{ width: width || "100%", flex: "none" }}>
            <Deck>
              <ReturnsCard
                holdings={holdings} profit={profit} ratio={ratio}
                history={history} historyState={historyState} onRetry={onRetryHistory}
              />
            </Deck>
          </div>
        </div>
      </div>

      <div className="pf-dots">
        <i className={card === 0 ? "on" : ""} onClick={() => setCard(0)} />
        <i className={card === 1 ? "on" : ""} onClick={() => setCard(1)} />
      </div>

      <div className="pf-tabs">
        {["Pozisyonlar", "Emirler", "Geçmiş"].map((name, index) => (
          <button key={name} className={tab === index ? "on" : ""} onClick={() => setTab(index)}>{name}</button>
        ))}
      </div>

      {tab === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SearchBox placeholder="İşlem ara" value={query} onChange={setQuery} />
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: "calc(18px * var(--s))", fontWeight: 700 }}>Pozisyonlarım</span>
            <span style={{ fontSize: "calc(11.5px * var(--s))", color: "var(--muted)" }}>{positions.length} pozisyon</span>
          </div>
          {positions.length ? (
            <Divided>
              {positions.map((item) => {
                const itemRatio = item.cost === 0 ? 0 : (item.profit / item.cost) * 100;
                return (
                  <button key={item.symbol} className="inst-row holding" onClick={() => openPosition(item)}>
                    <Symbol logo={item.logo} letter={item.symbol} size={46} tinted />
                    <span className="inst-copy">
                      <strong>{item.symbol}</strong>
                      <span>{item.name}</span>
                      <small>{item.quantity} lot · Ort. maliyet {money(item.avgCost)}</small>
                    </span>
                    <span className="inst-tail">
                      <span className="inst-price">
                        <span className="pl" style={{ color: item.profit >= 0 ? "var(--green)" : "var(--red)" }}>{delta(item.profit, itemRatio)}</span>
                        <span className="val">{money(item.value)}</span>
                      </span>
                      <Icon name="chevron" size={18} color="var(--muted)" />
                    </span>
                  </button>
                );
              })}
            </Divided>
          ) : (
            <div className="notice-box">{query ? `“${query}” için pozisyon bulunamadı.` : "Portföyünde henüz hisse yok."}</div>
          )}
        </div>
      )}

      {tab === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {orders.length ? orders.map((order) => (
            <div className="order-card" key={order.id}>
              <div className="rowline">
                <strong style={{ fontSize: "calc(15.5px * var(--s))" }}>{order.symbol}</strong>
                <span style={{ fontSize: "calc(12px * var(--s))", fontWeight: 700, color: order.side === "buy" ? "var(--green)" : "var(--red)" }}>
                  {order.side === "buy" ? "Alış" : "Satış"}
                </span>
              </div>
              <span style={{ fontSize: "calc(12px * var(--s))", color: "var(--muted)" }}>
                {order.quantity} lot &nbsp;{money(order.limit_price)} &nbsp;{order.status_label || "Beklemede"}
              </span>
              <button className="btn ghost" onClick={() => onCancelOrder(order)}>Emri iptal et</button>
            </div>
          )) : (
            <>
              <div className="empty-note">Bekleyen emir bulunmuyor.</div>
              <button className="btn" onClick={onCreateOrder}>Emir oluştur</button>
            </>
          )}
        </div>
      )}

      {tab === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <SearchBox placeholder="İşlem ara" value={query} onChange={setQuery} />
          <div className="rowline">
            <div className="chips">
              {["Tümü", "Alış", "Satış"].map((name, index) => (
                <button key={name} className={filter === index ? "on" : ""} onClick={() => setFilter(index)}>{name}</button>
              ))}
            </div>
            <button className="icon-btn" aria-label="Tarihe göre filtrele"><Icon name="calendar" size={20} color="var(--muted)" /></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {trades.length ? trades.map((trade, index) => (
              <TransactionCard key={index} trade={trade} logo={logoOf(trade.symbol)} onOpen={setDetail} />
            )) : (
              <div className="notice-box" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <strong style={{ fontSize: "calc(18px * var(--s))", color: "var(--ink)" }}>İşlem bulunamadı</strong>
                <span>Arama veya filtreni değiştirebilirsin.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {detail && <TransactionDetail trade={detail} logo={logoOf(detail.symbol)} onClose={() => setDetail(null)} />}
    </div>
  );
}
