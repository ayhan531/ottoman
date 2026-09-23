// Haberler — MainPage.News.cs birebir karşılığı.
import React, { useMemo, useState } from "react";
import Icon from "./icons.jsx";
import { SearchBox, Segments, Divided, CenteredHeader } from "./ui.jsx";
import { MARKET_NAMES, NEWS_TAB_ORDER, fold } from "./market.js";
import { T, locale } from "./lang.js";

const newsDate = (value) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleString(locale(), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "";

/* Haber satırı: fotoğraflı. Görsel gelmezse ya da yer tutucu kadar küçükse
   satır işaretle gösterilir; liste böylece hiçbir zaman boş kare göstermez. */
function NewsRow({ item, onOpen }) {
  const [bozuk, setBozuk] = useState(false);
  const gorsel = item.image_url || item.photo_url || "";
  const fotoVar = Boolean(gorsel) && !bozuk;
  return (
    <button className={fotoVar ? "nrow nrow-foto" : "nrow"} onClick={() => onOpen(item)}>
      {fotoVar ? (
        <span className="nthumb">
          <img
            src={gorsel}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setBozuk(true)}
            onLoad={(event) => {
              const g = event.currentTarget;
              if (g.naturalWidth < 80 || g.naturalHeight < 60) setBozuk(true);
            }}
          />
        </span>
      ) : (
        <span className="nmark" aria-hidden="true"><Icon name="news" size={15} /></span>
      )}
      <span className="ncol">
        <h3>{item.title}</h3>
        <span className="nmeta">
          {item.source || ""}
          {item.source && item.published_at ? " · " : ""}
          {newsDate(item.published_at)}
        </span>
      </span>
    </button>
  );
}

export function Article({ item, onBack }) {
  const [gorselBozuk, setGorselBozuk] = useState(false);
  return (
    <div className="page gap-14">
      <CenteredHeader title={item.title || T("Haber")} onBack={onBack} />
      {item.image_url && !gorselBozuk && (
        <div className="article-photo">
          <img
            src={item.image_url}
            alt=""
            onError={() => setGorselBozuk(true)}
            onLoad={(event) => {
              const g = event.currentTarget;
              // Boş/yer tutucu görseller (çok küçük ya da aşırı ince) gösterilmez.
              if (g.naturalWidth < 120 || g.naturalHeight < 80) setGorselBozuk(true);
            }}
          />
        </div>
      )}
      {item.published_at && <span style={{ fontSize: "calc(12.5px * var(--s))", color: "var(--muted)" }}>{newsDate(item.published_at)}</span>}
      <div className="article-body">{item.body || item.summary || T("Bu haber için özet metni bulunmuyor.")}</div>
      {item.source && <span style={{ fontSize: "calc(11.5px * var(--s))", color: "var(--muted)", paddingTop: 10 }}>{T("Kaynak:")} {item.source}</span>}
    </div>
  );
}

const NEWS_MARKETS = NEWS_TAB_ORDER.map((value) => ({ name: MARKET_NAMES[value], value }));

export default function News({ brandBar, marketTab, setMarketTab, items, state, onOpen }) {
  const newsActive = Math.max(0, NEWS_MARKETS.findIndex((m) => m.value === marketTab));
  const [query, setQuery] = useState("");

  // Akış zaten sekmenin kendi sorgusuyla geliyor; burada yalnızca başlık araması süzer.
  const shown = useMemo(() => {
    const needle = fold(query);
    if (!needle) return items;
    return items.filter((item) => fold(item.title || "").includes(needle));
  }, [items, query]);

  return (
    <div className="page gap-14">
      {brandBar}
      <SearchBox placeholder={T("Haber ara")} value={query} onChange={setQuery} />
      <Segments titles={NEWS_MARKETS.map((m) => T(m.name))} active={newsActive} onSelect={(index) => setMarketTab(NEWS_MARKETS[index].value)} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div className="h-title">{T(MARKET_NAMES[marketTab])}</div>
        {shown.length ? (
          <Divided>{shown.map((item, index) => <NewsRow key={item.id || index} item={item} onOpen={onOpen} />)}</Divided>
        ) : (
          <div className="notice-box">
            {state === "failed"
              ? T("Haberler alınamadı. Bağlantını kontrol et.")
              : query.trim()
                ? `“${query.trim()}”${T(" için haber bulunamadı.")}`
                : T("Haberler yükleniyor…")}
          </div>
        )}
      </div>
    </div>
  );
}
