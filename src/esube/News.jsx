// Haberler — MainPage.News.cs birebir karşılığı.
import React, { useMemo, useState } from "react";
import Icon from "./icons.jsx";
import { SearchBox, Segments, Divided, CenteredHeader } from "./ui.jsx";
import { MARKET_NAMES, fold } from "./market.js";

// Her piyasa sekmesinin kendi haber sorgusu (NewsFeed.cs'teki sorguların karşılığı).
const QUERIES = [
  ["borsa", "bist", "hisse", "endeks", "kap"],
  ["bist 100", "bist100", "endeks", "borsa"],
  ["bist 30", "bist30", "banka", "holding"],
  ["katılım", "faizsiz", "islami", "endeks"],
  ["temettü", "kar payı", "kâr payı", "dağıtım"],
  ["halka arz", "arz", "borsada işlem"],
  ["yatırım fonu", "fon", "portföy"],
  ["dolar", "euro", "kur", "döviz", "altın"],
];

const newsDate = (value) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "";

function NewsRow({ item, onOpen }) {
  return (
    <button className="nrow" onClick={() => onOpen(item)}>
      <span className="nthumb">
        {item.image_url ? <img src={item.image_url} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <Icon name="news" size={22} />}
      </span>
      <h3>{item.title}</h3>
    </button>
  );
}

export function Article({ item, onBack }) {
  return (
    <div className="page gap-14">
      <CenteredHeader title={item.title || "Haber"} onBack={onBack} />
      {item.image_url && (
        <div className="article-photo">
          <img src={item.image_url} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
        </div>
      )}
      {item.published_at && <span style={{ fontSize: "calc(12.5px * var(--s))", color: "var(--muted)" }}>{newsDate(item.published_at)}</span>}
      <div className="article-body">{item.body || item.summary || "Bu haber için özet metni bulunmuyor."}</div>
      {item.source && <span style={{ fontSize: "calc(11.5px * var(--s))", color: "var(--muted)", paddingTop: 10 }}>Kaynak: {item.source}</span>}
    </div>
  );
}

export default function News({ brandBar, marketTab, setMarketTab, items, state, onOpen }) {
  const [query, setQuery] = useState("");

  const forTab = useMemo(() => {
    if (!items.length) return [];
    const keys = QUERIES[marketTab] || [];
    const matched = items.filter((item) => {
      const hay = fold(`${item.title || ""} ${item.summary || ""}`);
      return keys.some((key) => hay.includes(fold(key)));
    });
    // Sekme için eşleşme yoksa genel akış gösterilir (kaynak tek bir Türkçe finans akışıdır).
    return matched.length >= 4 ? matched : items;
  }, [items, marketTab]);

  const shown = useMemo(() => {
    const needle = fold(query);
    if (!needle) return forTab;
    return forTab.filter((item) => fold(item.title || "").includes(needle));
  }, [forTab, query]);

  return (
    <div className="page gap-14">
      {brandBar}
      <SearchBox placeholder="Haber ara" value={query} onChange={setQuery} />
      <Segments titles={MARKET_NAMES} active={marketTab} onSelect={setMarketTab} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div className="h-title">{MARKET_NAMES[marketTab]}</div>
        {shown.length ? (
          <Divided>{shown.map((item, index) => <NewsRow key={item.id || index} item={item} onOpen={onOpen} />)}</Divided>
        ) : (
          <div className="notice-box">
            {state === "failed"
              ? "Haberler alınamadı. Bağlantını kontrol et."
              : query.trim()
                ? `“${query.trim()}” için haber bulunamadı.`
                : "Haberler yükleniyor…"}
          </div>
        )}
      </div>
    </div>
  );
}
