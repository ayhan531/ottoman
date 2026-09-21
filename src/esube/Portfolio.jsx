// Portföy — MainPage.Portfolio.cs birebir karşılığı.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { Symbol, SearchBox, Divided, Donut, Spark, Sheet } from "./ui.jsx";
import { money, signed, delta, fold, trSayi } from "./market.js";
import { T, locale } from "./lang.js";

const MINT = "#7FE3C4", ROSE = "#FF9EB5", MINT_SOFT = "#CFF5E6", ROSE_SOFT = "#FFD6E0", CASH_TONE = "#FFD48A";
const FAINT = "rgba(255,255,255,.72)";

/* Kâr/zarar oranı APK'daki gibi yazılır: yüzde işareti rakamın sonunda (+16,14%). */
const pctText = (value) => (value >= 0 ? "+" : "−") + trSayi(Math.abs(value || 0)) + "%";
/** Yerel saate göre YYYY-AA-GG; tarih süzgeci bununla karşılaştırır. */
const localDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
/* Göz kapalıyken tutarlar banka uygulamalarındaki gibi noktayla gizlenir.
   Genişliği .masked kuralı sınırlar. */
const DOTS = "••••••";
const SHORT_DOTS = "•••";

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
  const mask = (text) => (hidden ? DOTS : text);

  return (
    <div className="pf-card">
      <div className="pf-grid">
        <div className="pf-head" style={{ gridColumn: "1 / -1" }}>
          <span>{T("Portföy özeti")}</span>
          <button className="pf-eye" onClick={onToggleHidden} aria-label={T("Tutarları gizle")}>
            <Icon name={hidden ? "eye-off" : "eye"} size={18} />
          </button>
        </div>

        <div className={`pf-total${hidden ? " masked" : ""}`}>{mask(money(total))}</div>

        <div className={`pf-gain ${profit >= 0 ? "plus" : "minus"}${hidden ? " masked" : ""}`}>
          {hidden ? DOTS : `${delta(profit, ratio)} ${T(profit >= 0 ? "toplam kâr" : "toplam zarar")}`}
        </div>

        <div className="pf-mini">
          <div><span>{T("Kullanılabilir")}</span><b className={hidden ? "masked" : ""}>{mask(money(available))}</b></div>
          <div><span>{T("T+2 Bakiye")}</span><b className={hidden ? "masked" : ""}>{mask(money(t2))}</b></div>
        </div>

        {/* Göz kapalıyken rakamlar bulanıklaşmaz, noktayla gizlenir; halka da paysız çizilir. */}
        <div className="pf-alloc">
          <Donut
            parts={hidden ? [[1, "rgba(255,255,255,.45)"]] : [[stockShare, "#fff"], [gainShare, gainTone], [cashShare, CASH_TONE]]}
            center={hidden ? SHORT_DOTS : `%${Math.round(stockShare * 100)}`}
            size={76}
          />
          <div className="pf-legend">
            <div><i style={{ background: "#fff" }} />{T("Pozisyonlar")} · {hidden ? SHORT_DOTS : `%${Math.round(stockShare * 100)}`}</div>
            <div><i style={{ background: CASH_TONE }} />{T("Bakiye")} · {hidden ? SHORT_DOTS : `%${Math.round(cashShare * 100)}`}</div>
            <div><i style={{ background: gainTone }} />{T(profit >= 0 ? "Kâr" : "Zarar")} · {hidden ? SHORT_DOTS : pctText(ratio)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- getiri kartı ---------- */

/* APK'daki PriceHistory.Portfolio: günler bütün serilerin birleşimidir; bir hissenin
   o gün kapanışı yoksa önceki kapanış taşınır, henüz hiç kapanışı yoksa gün atlanır. */
const portfolioSeries = (series, holdings) => {
  const held = holdings.filter((item) => item.quantity > 0 && Array.isArray(series?.[item.symbol]) && series[item.symbol].length > 1);
  if (!held.length) return [];
  const days = [...new Set(held.flatMap((item) => series[item.symbol].map((row) => row.day)))].sort();
  const out = [];
  for (const day of days) {
    let total = 0;
    let complete = true;
    for (const item of held) {
      const rows = series[item.symbol];
      let close = null;
      for (const row of rows) { if (row.day <= day) close = row.close; else break; }
      if (close === null) { complete = false; break; }
      total += item.quantity * close;
    }
    if (complete) out.push({ day, value: total });
  }
  return out;
};

/* Değer ağırlıklı 1 hafta / 1 ay getirisi (APK: Perf.W / Perf.1M karşılığı). */
const weightedPerf = (series, holdings, back) => {
  let value = 0;
  let sum = 0;
  for (const item of holdings) {
    const rows = series?.[item.symbol];
    if (!(item.quantity > 0) || !Array.isArray(rows) || rows.length < 2) continue;
    const last = rows[rows.length - 1].close;
    const target = rows[Math.max(0, rows.length - 1 - back)].close;
    if (!target) continue;
    const worth = item.quantity * last;
    value += worth;
    sum += worth * ((last / target - 1) * 100);
  }
  return value === 0 ? null : sum / value;
};

function ReturnsCard({ holdings, profit, ratio, series, history, historyState, onRetry }) {
  const tone = profit >= 0 ? MINT_SOFT : ROSE_SOFT;
  const best = holdings
    .filter((item) => item.quantity > 0 && item.cost > 0)
    .sort((a, b) => b.profit / b.cost - a.profit / a.cost)[0];

  // Gerçek kapanışlardan çizilen seri; yoksa günlük portföy anlık görüntülerine düşer.
  const curve = useMemo(() => {
    const live = portfolioSeries(series, holdings);
    return live.length >= 2 ? live : (history || []);
  }, [series, holdings, history]);

  const points = useMemo(() => {
    if (curve.length < 2) return [];
    const base = curve[0].value || 1;
    return curve.map((row, index) => {
      const daily = index === 0 ? 0 : (row.value / (curve[index - 1].value || 1) - 1) * 100;
      return {
        value: (row.value / base - 1) * 100,
        date: new Date(row.day).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" }),
        label: pctText(daily),
        up: daily >= 0,
      };
    });
  }, [curve]);

  const weekChange = useMemo(() => weightedPerf(series, holdings, 5), [series, holdings]);
  const monthChange = useMemo(() => weightedPerf(series, holdings, 21), [series, holdings]);

  const line = points.length && points[points.length - 1].value >= 0 ? MINT : ROSE;

  return (
    <div className="pf-card" style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div className="rowline">
        <strong style={{ fontSize: "calc(16px * var(--s))" }}>{T("Getiri Özeti")}</strong>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: FAINT, fontSize: "calc(12px * var(--s))" }}>
          <Icon name="bars" size={18} />
          Pozisyon sayısı: {holdings.filter((item) => item.quantity > 0).length}
        </span>
      </div>

      <div className="returns-body" style={{ flex: 1 }}>
        <div className="returns-figures">
          <span className="lbl">{T("Toplam getiri")}</span>
          <span className="amt" style={{ color: tone }}>{signed(profit)}</span>
          <span className="rat" style={{ color: tone }}>({pctText(ratio)})</span>
        </div>
        <div style={{ minWidth: 0, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
          {points.length >= 2 ? (
            <Spark points={points} line={line} fill={`${line}2e`} upBubble={MINT_SOFT} downBubble={ROSE_SOFT} height={116} />
          ) : (
            <button onClick={onRetry} style={{ color: FAINT, fontSize: "calc(12px * var(--s))", textAlign: "right" }}>
              {T(historyState === "failed" ? "Grafik alınamadı. Dokunup yeniden dene." : "Grafik yükleniyor…")}
            </button>
          )}
        </div>
      </div>

      <div className="returns-stats">
        <div className="st">
          <span>{T("1 Hafta")}</span>
          <b style={{ color: weekChange === null ? FAINT : weekChange >= 0 ? MINT_SOFT : ROSE_SOFT }}>{weekChange === null ? "—" : pctText(weekChange)}</b>
        </div>
        <div className="st">
          <span>{T("1 Ay")}</span>
          <b style={{ color: monthChange === null ? FAINT : monthChange >= 0 ? MINT_SOFT : ROSE_SOFT }}>{monthChange === null ? "—" : pctText(monthChange)}</b>
        </div>
        <div className="returns-best">
          <span className="lbl">{T("En yüksek getiri")}</span>
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
          <span className={`badge-sm ${sell ? "sell" : "buy"}`}>{T(sell ? "SATIŞ" : "ALIŞ")}</span>
        </span>
        <span>{trade.quantity} {T("lot")} &nbsp;{money(trade.price)}</span>
      </span>
      <span className="r">
        {sell && <span className="pl" style={{ color: trade.profit >= 0 ? "var(--green)" : "var(--red)" }}>{delta(trade.profit, trade.profitPercent)}</span>}
        <span className={`tot${sell ? "" : " b"}`}>{money(trade.total)}</span>
        <span className="dt">{trade.date.toLocaleDateString(locale(), { day: "numeric", month: "short" })} {trade.date.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}</span>
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
        <span className="spill">{T("Gerçekleşti")}</span>
        {!trade.buy && (
          <div className={`pl-box ${trade.profit >= 0 ? "plus" : "minus"}`}>
            <div className="side">
              <span className="t">{T("Net kâr / zarar")}</span>
              <span className="amt" style={{ color: tone }}>{signed(trade.profit)}</span>
            </div>
            <div className="side end">
              <span className="t">{T("K/Z Oranı")}</span>
              <span className="pct" style={{ color: tone }}>{pctText(trade.profitPercent)}</span>
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: "calc(12.5px * var(--s))", fontWeight: 700, color: "var(--muted)" }}>{T("İşlem detayları")}</span>
          <Row label={T("Adet")} value={`${trade.quantity} ${T("lot")}`} />
          <Row label={T(trade.buy ? "Alış fiyatı" : "Satış fiyatı")} value={money(trade.price)} />
          <Row label={T("Toplam")} value={money(trade.total)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: "calc(12.5px * var(--s))", fontWeight: 700, color: "var(--muted)" }}>{T("Maliyet analizi")}</span>
          {!trade.buy && <Row label={T("Ort. alış")} value={money(trade.avgCost)} />}
          <Row label={T("Maliyet")} value={money(trade.buy ? trade.total : trade.quantity * trade.avgCost)} />
          <Row label={T(trade.buy ? "Net sonuç" : "Getiri")} value={money(trade.net)} strong />
        </div>
        <div className="hline" />
        <button className="btn tall" onClick={onClose}>{T("Devam et")}</button>
      </div>
    </Sheet>
  );
}

/* ---------- ekran ---------- */

export default function Portfolio({
  holdings, account, orders, transactions, instruments, series, history, historyState, onRetryHistory,
  tab, setTab, card, setCard, hidden, setHidden, openPosition, onCancelOrder, onCreateOrder,
}) {
  const lane = useRef(null);
  const viewport = useRef(null);
  const slots = useRef([]);
  const [drag, setDrag] = useState(null);
  const [width, setWidth] = useState(0);
  // Kartların kendi boyu; görüntü alanı açık karta göre yükselip alçalır ki
  // kısa kartın altında boşluk kalmasın.
  const [heights, setHeights] = useState([0, 0]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(0);
  const [detail, setDetail] = useState(null);
  const [day, setDay] = useState("");        // Geçmiş sekmesindeki tarih süzgeci (YYYY-AA-GG)
  const [dayPicker, setDayPicker] = useState(false);
  const [dayDraft, setDayDraft] = useState("");

  useEffect(() => {
    const node = viewport.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    setWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const olc = () => setHeights(slots.current.map((node) => (node ? Math.round(node.offsetHeight) : 0)));
    const observer = new ResizeObserver(olc);
    slots.current.forEach((node) => node && observer.observe(node));
    olc();
    return () => observer.disconnect();
  }, []);

  const stride = width + 12;
  const offset = drag === null ? -card * stride : drag;
  // İki kart eşit boyda: görüntü alanı her zaman uzun kartın boyunda kalır.
  const deckHeight = Math.max(heights[0] || 0, heights[1] || 0);

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

  // İşlem kaydında şirket adı yoksa piyasa listesinden tamamlanır.
  const nameOf = useMemo(() => {
    const map = new Map(instruments.map((item) => [item.code, item.name]));
    return (code, fallback) => (fallback && fallback !== code ? fallback : map.get(code) || fallback || code);
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
      .filter((trade) => (filter === 0 || (filter === 1 ? trade.buy : !trade.buy))
        && (!needle || trade.symbol.includes(needle))
        && (!day || localDay(trade.date) === day))
      .sort((a, b) => b.date - a.date);
  }, [transactions, filter, query, day]);

  return (
    <div className="page gap-16">
      <div
        className="pf-viewport"
        ref={viewport}
        style={{
          height: deckHeight ? `${deckHeight + 14}px` : undefined,
          transition: drag === null ? "height .26s cubic-bezier(.33,1,.68,1)" : "none",
        }}
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
          <div className="pf-slot" ref={(node) => { slots.current[0] = node; }} style={{ width: width || "100%" }}>
            <Deck>
              <SummaryCard
                total={total} profit={profit} ratio={ratio} available={available} t2={t2}
                stockValue={stockValue} cost={cost} cash={cash}
                hidden={hidden} onToggleHidden={() => setHidden(!hidden)}
              />
            </Deck>
          </div>
          <div className="pf-slot" ref={(node) => { slots.current[1] = node; }} style={{ width: width || "100%" }}>
            <Deck>
              <ReturnsCard
                holdings={holdings} profit={profit} ratio={ratio}
                series={series} history={history} historyState={historyState} onRetry={onRetryHistory}
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
          <button key={name} className={tab === index ? "on" : ""} onClick={() => setTab(index)}>{T(name)}</button>
        ))}
      </div>

      {tab === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SearchBox placeholder={T("İşlem ara")} value={query} onChange={setQuery} />
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: "calc(18px * var(--s))", fontWeight: 700 }}>{T("Pozisyonlarım")}</span>
            <span style={{ fontSize: "calc(11.5px * var(--s))", color: "var(--muted)" }}>{positions.length} {T("pozisyon")}</span>
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
                      <small>{item.quantity} {T("lot")} · {T("Ort. maliyet")} {money(item.avgCost)}</small>
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
            <div className="notice-box">{query ? `“${query}”${T(" için pozisyon bulunamadı.")}` : T("Portföyünde henüz hisse yok.")}</div>
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
                  {T(order.side === "buy" ? "Alış" : "Satış")}
                </span>
              </div>
              <span style={{ fontSize: "calc(12px * var(--s))", color: "var(--muted)" }}>
                {order.quantity} {T("lot")} &nbsp;{money(order.limit_price)} &nbsp;{order.status_label || T("Beklemede")}
              </span>
              <button className="btn ghost" onClick={() => onCancelOrder(order)}>{T("Emri iptal et")}</button>
            </div>
          )) : (
            <>
              <div className="empty-note">{T("Bekleyen emir bulunmuyor.")}</div>
              <button className="btn" onClick={onCreateOrder}>{T("Emir oluştur")}</button>
            </>
          )}
        </div>
      )}

      {tab === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <SearchBox placeholder={T("İşlem ara")} value={query} onChange={setQuery} />
          <div className="rowline">
            <div className="chips">
              {["Tümü", "Alış", "Satış"].map((name, index) => (
                <button key={name} className={filter === index ? "on" : ""} onClick={() => setFilter(index)}>{T(name)}</button>
              ))}
            </div>
            <button
              className={`icon-btn${day ? " lav" : ""}`}
              aria-label={T("Tarihe göre filtrele")}
              onClick={() => { setDayDraft(day || localDay(new Date())); setDayPicker(true); }}
            >
              <Icon name="calendar" size={20} color={day ? "var(--purple)" : "var(--muted)"} />
            </button>
          </div>
          {day && (
            <button className="rowline" style={{ width: "100%" }} onClick={() => setDay("")}>
              <span style={{ fontSize: "calc(12.5px * var(--s))", color: "var(--muted)" }}>
                {new Date(`${day}T00:00:00`).toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" })}
              </span>
              <span className="link-all">{T("Tüm tarihleri göster")}</span>
            </button>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {trades.length ? trades.map((trade, index) => (
              <TransactionCard key={index} trade={trade} logo={logoOf(trade.symbol)} onOpen={setDetail} />
            )) : (
              <div className="notice-box" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <strong style={{ fontSize: "calc(18px * var(--s))", color: "var(--ink)" }}>{T("İşlem bulunamadı")}</strong>
                <span>{T("Arama veya filtreni değiştirebilirsin.")}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {dayPicker && (
        <Sheet title={T("Tarihe göre filtrele")} onClose={() => setDayPicker(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <div className="field">
              <div className="box">
                <input
                  type="date"
                  value={dayDraft}
                  onChange={(event) => setDayDraft(event.target.value)}
                  style={{ height: 46, width: "100%", fontSize: "calc(16px * var(--s))" }}
                />
              </div>
            </div>
            <button className="btn" onClick={() => { setDay(dayDraft); setDayPicker(false); }}>{T("Tarihi uygula")}</button>
            <button className="btn ghost" onClick={() => { setDay(""); setDayPicker(false); }}>{T("Tüm tarihleri göster")}</button>
          </div>
        </Sheet>
      )}

      {detail && <TransactionDetail trade={{ ...detail, name: nameOf(detail.symbol, detail.name) }} logo={logoOf(detail.symbol)} onClose={() => setDetail(null)} />}
    </div>
  );
}
