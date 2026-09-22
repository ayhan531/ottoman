// Ana Sayfa — MainPage.Home.cs birebir karşılığı.
import React, { useMemo, useState } from "react";
import Icon from "./icons.jsx";
import { Symbol, SearchBox, Segments, Divided, Sheet, LazyList } from "./ui.jsx";
import {
  MARKET_NAMES, BIST, BIST100, BIST30, PARTICIPATION, CURRENCY, DIVIDEND, IPO, FUNDS,
  MARKET_CONTACT_TEXT,
  listFor, indexFor, breadth, turnover, movers, search, money, amount, move, percent,
  volumeText, isMarketOpen, parseAmount,
} from "./market.js";
import { T } from "./lang.js";

export function InstrumentRow({ item, onClick, extra }) {
  const up = item.change >= 0;
  return (
    <button className="inst-row" onClick={onClick}>
      <Symbol logo={item.logo} letter={item.symbol} size={34} />
      <span className="inst-copy">
        <strong>{item.symbol}</strong>
        <span>{item.name}</span>
        {extra}
      </span>
      <span className="inst-price">
        <strong>{amount(item.price, item.currency)}</strong>
        <span className={up ? "up" : "down"}>{move(item.change)}</span>
      </span>
    </button>
  );
}

export function MarketStatus({ market, list, instruments, state }) {
  const open = isMarketOpen();
  const index = indexFor(market, instruments);
  const { rising, falling } = breadth(list);
  const totalCount = rising + falling;
  const risePercent = totalCount === 0 ? 50 : Math.round((rising * 100) / totalCount);
  const fallPercent = 100 - risePercent;
  const value = turnover(list);

  return (
    <section className="card outline market-status">
      <div className="rowline">
        <span className="h-title" style={{ fontSize: "calc(15.5px * var(--s))" }}>{T("Piyasa Durumu")}</span>
        <span className={`pill ${open ? "open" : "closed"}`}><i className="dot" />{T(open ? "Açık" : "Kapalı")}</span>
      </div>

      {state !== "live" || !list.length ? (
        <span style={{ fontSize: "calc(12.5px * var(--s))", color: "var(--muted)" }}>
          {T(state === "failed" ? "Piyasa verisi alınamadı. Sayfayı yenile." : "Piyasa verisi yükleniyor…")}
        </span>
      ) : (
        <>
          {index && (
            <div className="rowline">
              <span className="index-level">{amount(index.price, "")}</span>
              <span className={`move-badge ${index.change >= 0 ? "up" : "down"}`}>
                <Icon name={index.change >= 0 ? "trend" : "trend-down"} size={13} />
                {move(index.change)}
                <span>{(index.change >= 0 ? "+" : "−") + Math.abs(index.dayDelta).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </span>
            </div>
          )}
          <div className="breadth-labels">
            <span className="up"><Icon name="trend" size={14} />{T("Yükselenler")}</span>
            <span className="down">{T("Düşenler")}<Icon name="trend-down" size={14} /></span>
          </div>
          <div className="breadth-bar">
            <i className="g" style={{ flex: Math.max(risePercent, 1) }}>%{risePercent}</i>
            <i className="r" style={{ flex: Math.max(fallPercent, 1) }}>%{fallPercent}</i>
          </div>
          <div className="volume-badge">
            <i className="dot" />
            <span>{T("Toplam Hacim:")}</span>
            <b>{volumeText(value)}</b>
          </div>
        </>
      )}
    </section>
  );
}

function Converter({ rates, onNotice }) {
  const [amountText, setAmountText] = useState("100");
  const [code, setCode] = useState("USD");
  const [toTry, setToTry] = useState(true);
  const [picking, setPicking] = useState(false);

  const rate = rates.find((item) => item.code === `${code}TRY`);
  const parsed = parseAmount(amountText);
  const value = !rate || rate.price <= 0 || !Number.isFinite(parsed)
    ? null
    : toTry ? parsed * rate.price : parsed / rate.price;

  return (
    <section className="card outline converter">
      <div className="fx-row">
        <div className="fx-box">
          <input inputMode="decimal" value={amountText} onChange={(event) => setAmountText(event.target.value)} placeholder="0" />
          <button className="fx-unit" onClick={() => setPicking(true)}>{toTry ? code : "₺"}<Icon name="down" size={16} /></button>
        </div>
        <button className="icon-btn lav" onClick={() => setToTry((current) => !current)} aria-label={T("Yönü çevir")}>
          <Icon name="swap" size={21} />
        </button>
        <div className="fx-box">
          <span className="result">
            {value === null ? "—" : toTry ? money(value) : value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="fx-unit">{toTry ? "₺" : code}</span>
        </div>
      </div>
      <span className="note">
        {rate ? `1 ${code} = ${money(rate.price)} · ${T("ECB kuru")}` : T("Kur henüz yüklenmedi.")}
      </span>

      {picking && (
        <Sheet title={T("Döviz seç")} onClose={() => setPicking(false)}>
          <Divided>
            {rates.map((item) => {
              const short = item.code.slice(0, 3);
              const on = short === code;
              return (
                <button
                  key={item.code}
                  className="rowline"
                  style={{ padding: "11px 0", width: "100%" }}
                  onClick={() => { setCode(short); setPicking(false); }}
                >
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
                    <strong style={{ fontSize: "calc(15px * var(--s))", color: on ? "var(--purple)" : "var(--ink)" }}>{short}</strong>
                    <span style={{ fontSize: "calc(12px * var(--s))", color: "var(--muted)" }}>{item.name}</span>
                  </span>
                  {on ? <Icon name="check" size={20} color="var(--purple)" /> : <span />}
                </button>
              );
            })}
          </Divided>
        </Sheet>
      )}
    </section>
  );
}

// Ana sayfada Al/Sat sekmeleri: BIST Temettü burada gösterilmez, yalnızca
// Haberler'de bir filtre olarak kalır (patron talebi).
const HOME_MARKETS = MARKET_NAMES.map((name, value) => ({ name, value })).filter((m) => m.value !== DIVIDEND);

export default function Home({
  brandBar, marketTab, setMarketTab, instruments, state, watchlist, openTrade, onNotice, onAllStocks,
}) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => listFor(marketTab, instruments), [marketTab, instruments]);
  const homeActive = Math.max(0, HOME_MARKETS.findIndex((m) => m.value === marketTab));
  const trimmed = query.trim();
  const results = useMemo(() => (trimmed ? search(trimmed, list) : []), [trimmed, list]);

  const watched = useMemo(
    () => watchlist.map((code) => list.find((item) => item.code === code)).filter(Boolean),
    [watchlist, list]
  );

  const showStatus = marketTab === BIST100 || marketTab === BIST30 || marketTab === PARTICIPATION;
  const rising = useMemo(() => (marketTab === BIST ? movers(list, true) : []), [marketTab, list]);
  const falling = useMemo(() => (marketTab === BIST ? movers(list, false) : []), [marketTab, list]);

  let heading = T("Takip listem");
  let body = null;

  if (trimmed) {
    heading = T("Arama sonuçları");
    body = results.length ? (
      <LazyList items={results} render={(item) => <InstrumentRow key={item.code} item={item} onClick={() => openTrade(item)} />} />
    ) : (
      <div className="notice-box">{state === "live" ? `“${trimmed}”${T(" için sonuç bulunamadı.")}` : T("Liste henüz yüklenmedi.")}</div>
    );
  } else if (marketTab === BIST) {
    body = (
      <>
        <Divided>
          {watched.map((item) => <InstrumentRow key={item.code} item={item} onClick={() => openTrade(item)} />)}
        </Divided>
        {!watched.length && <div className="notice-box">{T("Takip listen boş. Bir hisseye dokunup yıldıza bas.")}</div>}
        {state === "live" && (
          <>
            <div style={{ paddingTop: 16 }}>
              <div className="h-title">{T("Öne çıkan yükselenler")}</div>
              <Divided>{rising.map((item) => <InstrumentRow key={item.code} item={item} onClick={() => openTrade(item)} />)}</Divided>
            </div>
            <div style={{ paddingTop: 16 }}>
              <div className="h-title">{T("Öne çıkan düşenler")}</div>
              <Divided>{falling.map((item) => <InstrumentRow key={item.code} item={item} onClick={() => openTrade(item)} />)}</Divided>
            </div>
            <div style={{ paddingTop: 16 }}>
              <div className="h-title">{T("Tüm hisseler")} <em className="h-count">{list.length}</em></div>
              <LazyList
                items={list}
                render={(item) => <InstrumentRow key={item.code} item={item} onClick={() => openTrade(item)} />}
              />
            </div>
          </>
        )}
      </>
    );
  } else if (marketTab === IPO || marketTab === FUNDS) {
    heading = T(MARKET_NAMES[marketTab]);
    body = (
      <div className="referral-note">
        <Icon name="headset" size={22} color="var(--muted)" />
        <span>{T(MARKET_CONTACT_TEXT[marketTab])}</span>
      </div>
    );
  } else {
    heading = T(MARKET_NAMES[marketTab]);
    body = list.length ? (
      <LazyList items={list} render={(item) => <InstrumentRow key={item.code} item={item} onClick={() => openTrade(item)} />} />
    ) : (
      <div className="notice-box">{T(state === "failed" ? "Fiyatlar alınamadı. Bağlantını kontrol et." : "Fiyatlar yükleniyor…")}</div>
    );
  }

  const rates = useMemo(() => listFor(CURRENCY, instruments), [instruments]);

  return (
    <div className="page gap-14">
      {brandBar}
      <SearchBox placeholder={T("Ara")} value={query} onChange={setQuery} />
      <Segments titles={HOME_MARKETS.map((m) => T(m.name))} active={homeActive} onSelect={(index) => setMarketTab(HOME_MARKETS[index].value)} />
      {showStatus && <MarketStatus market={marketTab} list={list} instruments={instruments} state={state} />}
      {marketTab === CURRENCY && rates.length > 0 && <Converter rates={rates} onNotice={onNotice} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div className="rowline">
          <span className="h-title">{heading}</span>
          <button className="link-all" onClick={onAllStocks}>{T("Tümü")}</button>
        </div>
        {body}
      </div>
    </div>
  );
}
