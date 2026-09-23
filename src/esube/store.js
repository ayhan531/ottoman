// Tercihler (APK'daki Preferences), API çağrıları ve canlı veri akışı.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toInstrument } from "./market.js";

const KEY = "ottoman.";

export const readPref = (name, fallback) => {
  try {
    const raw = localStorage.getItem(KEY + name);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const writePref = (name, value) => {
  try { localStorage.setItem(KEY + name, JSON.stringify(value)); } catch { /* özel pencere */ }
};

export function usePref(name, fallback) {
  const [value, setValue] = useState(() => readPref(name, fallback));
  const set = useCallback((next) => {
    setValue((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      writePref(name, resolved);
      return resolved;
    });
  }, [name]);
  return [value, set];
}

export const api = async (path, options = {}) => {
  const isForm = options.body instanceof FormData;
  const response = await fetch(path, {
    credentials: "include",
    headers: isForm ? options.headers || {} : { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
};

const MARKET_MS = 30_000;
const NEWS_MS = 10 * 60_000;

export function useMarket() {
  const [instruments, setInstruments] = useState([]);
  const [meta, setMeta] = useState(null);
  const [state, setState] = useState("loading");
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/market");
      setInstruments((data.quotes || []).map(toInstrument));
      setMeta(data.meta || null);
      setState("live");
    } catch {
      setState((current) => (current === "live" ? "live" : "failed"));
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, MARKET_MS);
    return () => clearInterval(timer.current);
  }, [load]);

  return { instruments, meta, state, reload: load };
}

/** Sekme başına haber akışı (APK'daki NewsFeed.LoadAsync(market) karşılığı). */
export function useNews(market = 0) {
  const [feeds, setFeeds] = useState({});
  const [state, setState] = useState("loading");

  const load = useCallback(async (which) => {
    try {
      const data = await api(`/api/market-news?market=${which}`);
      const rows = data.items || [];
      setFeeds((current) => ({ ...current, [which]: rows }));
      setState(rows.length ? "live" : "failed");
    } catch {
      setState((current) => (current === "live" ? "live" : "failed"));
    }
  }, []);

  useEffect(() => {
    setState((current) => (feeds[market]?.length ? "live" : "loading"));
    load(market);
    const timer = setInterval(() => load(market), NEWS_MS);
    return () => clearInterval(timer);
    // feeds bilerek bağımlılık değil: her sekme değişiminde tek bir çekim yeter.
  }, [load, market]);

  return { items: feeds[market] || [], state, reload: () => load(market) };
}

export function usePortfolio(enabled) {
  const [data, setData] = useState(null);
  const load = useCallback(async () => {
    if (!enabled) return;
    try { setData(await api("/api/portfolio")); } catch { /* oturum yok */ }
  }, [enabled]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 45_000);
    return () => clearInterval(timer);
  }, [load]);
  return { data, reload: load };
}

export function useMoneyRequests(enabled) {
  const [items, setItems] = useState([]);
  const load = useCallback(async () => {
    if (!enabled) return;
    try { setItems((await api("/api/money-requests")).money_requests || []); } catch { /* oturum yok */ }
  }, [enabled]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 45_000);
    return () => clearInterval(timer);
  }, [load]);
  return { items, reload: load };
}

export function useNotifications(enabled) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await api("/api/notifications");
      setItems(data.notifications || []);
      setUnread(Number(data.unread_count || 0));
    } catch { /* yoksay */ }
  }, [enabled]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);
  const markRead = useCallback(async () => {
    if (!unread) return;
    try { await api("/api/notifications/read", { method: "POST", body: "{}" }); setUnread(0); } catch { /* yoksay */ }
  }, [unread]);
  return { items, unread, reload: load, markRead };
}

/** Portföy pozisyonlarını canlı fiyatla birleştirir (DemoAccount.ApplyQuotes karşılığı). */
export function useHoldings(portfolio, instruments) {
  return useMemo(() => {
    const byCode = new Map(instruments.map((item) => [item.code, item]));
    const positions = portfolio?.positions || [];
    return positions
      .map((position) => {
        const quote = byCode.get(position.symbol);
        const price = Number(quote?.price || position.current_price || position.avg_price || 0);
        const quantity = Number(position.quantity || 0);
        const avgCost = Number(position.avg_price || 0);
        const value = quantity * price;
        const cost = quantity * avgCost;
        return {
          symbol: position.symbol,
          code: position.symbol,
          name: quote?.name || position.symbol,
          logo: quote?.logo || "",
          quantity,
          avgCost,
          price,
          change: Number(quote?.change || 0),
          dayDelta: Number(quote?.dayDelta || 0),
          value,
          cost,
          profit: value - cost,
          kind: "stock",
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [portfolio, instruments]);
}
