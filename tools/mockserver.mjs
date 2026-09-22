// Yerelde ekran görüntüsü almak için: dist/ + fixtures/ üzerinden basit API taklidi.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const fixtures = path.join(root, "fixtures");

const read = (name) => JSON.parse(fs.readFileSync(path.join(fixtures, name), "utf8"));

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const history = () => {
  const out = [];
  const base = 141000;
  let value = base;
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000);
    value = value * (1 + (Math.sin(i * 0.8) * 0.012 + 0.0035));
    out.push({ day: day.toISOString().slice(0, 10), value: Math.round(value * 100) / 100 });
  }
  return out;
};

const ANON = process.env.ANON === "1";
const ADMIN = process.env.ADMIN === "1";

const asAdmin = (payload) => {
  if (!ADMIN) return payload;
  const copy = JSON.parse(JSON.stringify(payload));
  if (copy.user) copy.user.role = "admin";
  return copy;
};

const adminRoutes = {
  "/api/admin/summary": () => ({ summary: { users: 3, users_total: 3, pending_orders: 1, pending_money: 1, orders_pending: 1, cash_total: 500000, blocked_total: 12500, pending_balance_total: 3400 } }),
  "/api/admin/users": () => ({ users: [
    { id: 2, full_name: "Ottoman Test Kullanıcı", status: "approved", status_label: "Onaylandı", email: "test@ottoman.local", account_no: "OT000002", phone: "05550000000", tc: "10000000146", tc_masked: "100*****146", tc_valid: true, cash_balance: 123456.78, order_count: 4, buy_count: 3, sell_count: 1, transaction_count: 6, kyc_status_label: "Onaylandı" },
    { id: 3, full_name: "Bekleyen Başvuru", status: "pending", status_label: "Beklemede", email: "yeni@ottoman.local", account_no: "OT000003", phone: "05551112233", cash_balance: 0, tc: "10000000146", tc_masked: "100*****146", tc_valid: true },
    { id: 4, full_name: "Sahte Kimlik", status: "under_review", status_label: "İncelemede", email: "sahte@ottoman.local", account_no: "OT000004", phone: "05559998877", cash_balance: 0, tc: "12345678901", tc_masked: "123*****901", tc_valid: false },
  ] }),
  "/api/admin/orders": () => ({ orders: [
    { id: 11, symbol: "THYAO", side: "buy", side_label: "Alış", full_name: "Ottoman Test Kullanıcı", quantity: 100, total: 28925, status: "pending", status_label: "Beklemede" },
  ] }),
  "/api/admin/money": () => ({ money_requests: [
    { id: 5, request_type: "deposit", type_label: "Para Yatırma", full_name: "Ottoman Test Kullanıcı", account_no: "OT000002", phone: "05550000000", created_at_label: "21 Eylül 2026 14:02", amount: 5000, status: "pending", status_label: "Beklemede" },
    { id: 6, request_type: "withdraw", type_label: "Para Çekme", full_name: "Ottoman Test Kullanıcı", account_no: "OT000002", phone: "05550000000", created_at_label: "21 Eylül 2026 15:20", amount: 2500, iban: "TR12 0006 7000 0000 0000 0000 07", status: "pending", status_label: "Beklemede" },
    { id: 7, request_type: "credit", type_label: "Kredi Başvurusu", full_name: "Ottoman Test Kullanıcı", account_no: "OT000002", phone: "05550000000", created_at_label: "20 Eylül 2026 09:11", amount: 50000, status: "pending", status_label: "Beklemede" },
  ] }),
  "/api/admin/reports": () => ({ users: [1, 2], audit: [1, 2, 3], reconciliation: { cash: 500000, blocked: 0 } }),
  "/api/admin/system-settings": () => ({ settings: { t2_enabled: "0", commission_rate: "0.002", minimum_deposit: "100", minimum_withdraw: "50", trading_open: "600", trading_close: "1080", brand_name: "Ottoman Yatırım", credit_monthly_interest_rate: "2.5", credit_loan_term_months: "12", credit_late_interest_rate: "4.5", credit_multiplier: "7", credit_margin_call_ratio: "50" } }),
  "/api/admin/bank-accounts": () => ({
    system_bank_accounts: [
      { id: 1, bank_name: "Ziraat Bankası", account_holder: "Ottoman Yatırım A.Ş.", iban: "TR120001000000000000000001", branch_name: "Merkez", description: "Ana tahsilat", is_active: 1, sort_order: 0 },
      { id: 2, bank_name: "Garanti BBVA", account_holder: "Ottoman Yatırım A.Ş.", iban: "TR120006200000000000000002", branch_name: "Levent", description: "", is_active: 0, sort_order: 1 },
    ],
    user_bank_accounts: [
      { id: 7, full_name: "Ottoman Test Kullanıcı", bank_name: "Yapı Kredi", iban: "TR120006700000000000000007" },
    ],
  }),
  "/api/admin/positions": () => ({ positions: [
    { id: 1, user_id: 2, full_name: "Ottoman Test Kullanıcı", symbol: "THYAO", quantity: 292, avg_price: 248.4, current_price: 289.25, market_value: 84461, pnl: 11928.2 },
    { id: 2, user_id: 2, full_name: "Ottoman Test Kullanıcı", symbol: "ASELS", quantity: 150, avg_price: 358.4, current_price: 379.75, market_value: 56962.5, pnl: 3202.5 },
  ] }),
  "/api/admin/user-balances": () => ({ balances: [
    { id: 2, user_id: 2, full_name: "Ottoman Test Kullanıcı", account_no: "OT000002", email: "test@ottoman.local", cash_balance: 123456.78, blocked_balance: 12500, pending_balance: 3400, credit_limit: 25000 },
    { id: 3, user_id: 3, full_name: "Bekleyen Başvuru", account_no: "OT000003", email: "yeni@ottoman.local", cash_balance: 0, blocked_balance: 0, pending_balance: 0, credit_limit: 0 },
  ] }),
  "/api/admin/t2-settlements": () => ({ t2_settlements: [
    { id: 3, user_id: 2, full_name: "Ottoman Test Kullanıcı", code: "TUPRS", name: "Tüpraş", quantity: 50, amount: 20600, remaining_amount: 20600, display_amount: 20600, status: "pending", status_label: "Bekliyor", created_at_label: "22 Eylül 2026 12:48", settlement_date: Math.floor(Date.now() / 1000) + 160000, settlement_date_label: "24 Eylül 2026 10:00" },
    { id: 2, user_id: 2, full_name: "Ottoman Test Kullanıcı", code: "THYAO", name: "Türk Hava Yolları", quantity: 30, amount: 8400, remaining_amount: 0, display_amount: 8400, status: "settled", status_label: "Çözüldü", created_at_label: "16 Eylül 2026 10:02", settlement_date: Math.floor(Date.now() / 1000) - 80000, settlement_date_label: "18 Eylül 2026 10:00" },
  ] }),
  "/api/admin/stock-names": () => ({ total: 903, edited: 1, names: [
    { symbol: "A1CAP", name: "A1 Capital Yatirim Menkul Degerler A.S.", asset_class: "stock", custom: false, updated_at: "" },
    { symbol: "ASELS", name: "Aselsan Elektronik Sanayi ve Ticaret A.S.", asset_class: "stock", custom: false, updated_at: "" },
    { symbol: "THYAO", name: "Türk Hava Yolları", asset_class: "stock", custom: true, updated_at: "20 Eylül 2026 23:10" },
    { symbol: "TUPRS", name: "Tupras Turkiye Petrol Rafinerileri A.S.", asset_class: "stock", custom: false, updated_at: "" },
  ] }),
  "/api/admin/stock-descriptions": () => ({ descriptions: [
    { symbol: "THYAO", description: "Türkiye'nin bayrak taşıyıcı havayolu şirketi.", risk_note: "Yakıt ve kur riski yüksek", updated_at: 0 },
  ] }),
  "/api/admin/prices": () => ({
    feed_enabled: true, manual_count: 1, total: 919,
    status: { updated_at_label: "22 Eylül 2026 04:40", source: "trrealapi-market", symbol_count: 919 },
    prices: [
      { symbol: "THYAO", name: "Türk Hava Yolları", price: 288, change_pct: 0.88, asset_class: "stock", manual: false, updated_at: "22 Eylül 2026 04:40" },
      { symbol: "ASELS", name: "Aselsan Elektronik", price: 379.75, change_pct: -1.2, asset_class: "stock", manual: true, updated_at: "22 Eylül 2026 03:10" },
      { symbol: "TUPRS", name: "Tüpraş", price: 417.25, change_pct: 2.4, asset_class: "stock", manual: false, updated_at: "22 Eylül 2026 04:40" },
      { symbol: "XU100", name: "BIST 100 Index", price: 13284.42, change_pct: -1.67, asset_class: "index", manual: false, updated_at: "22 Eylül 2026 04:40" },
    ],
  }),
  "/api/admin/market-feed": () => ({ ok: true, feed_enabled: false }),
  "/api/admin/audit": () => ({ audit: [
    { id: 41, action: "approve_order", entity_type: "order", entity_id: 11, actor_name: "Admin", ip_address: "88.23.4.9", created_at_label: "20 Eylül 2026 23:40", reference: "GM-DNT-00000041" },
    { id: 40, action: "save_stock_name", entity_type: "instrument", entity_id: null, actor_name: "Admin", ip_address: "88.23.4.9", created_at_label: "20 Eylül 2026 23:12", reference: "GM-DNT-00000040" },
  ] }),
  "/api/admin/documents": () => ({ documents: [
    { id: 4, user_id: 3, full_name: "Bekleyen Başvuru", doc_type: "id_front", doc_type_label: "Kimlik ön yüz", status: "pending", status_label: "Beklemede" },
  ] }),
  "/api/admin/transactions": () => ({ transactions: [
    { id: 90, user_id: 2, code: "THYAO", transaction_type: "trade_buy", type_label: "Hisse Alım", quantity: 100, price: 289.25, total: 28925, balance_after: 94531.78, created_at_label: "17 Eylül 2026 14:02" },
    { id: 91, user_id: 2, code: "TUPRS", transaction_type: "trade_sell", type_label: "Hisse Satım", quantity: 50, price: 412, total: 20600, balance_after: 115131.78, created_at_label: "16 Eylül 2026 11:20" },
    { id: 92, user_id: 2, code: "", transaction_type: "admin_add", type_label: "TL Yükleme", quantity: 0, price: 0, total: 25000, balance_after: 123456.78, created_at_label: "15 Eylül 2026 09:05" },
  ] }),
};

// Yahoo kapanış serisi taklidi: son 22 iş günü, gerçekçi dalgalanma.
const mockSeries = () => {
  const out = {};
  const seeds = { THYAO: [265, 289.25], ASELS: [352, 379.75] };
  for (const [symbol, [start, end]] of Object.entries(seeds)) {
    const rows = [];
    for (let i = 21; i >= 0; i--) {
      const date = new Date(Date.UTC(2026, 8, 18) - i * 86400000);
      if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
      const t = (21 - i) / 21;
      const wobble = Math.sin(i * 1.7) * (end - start) * 0.12;
      rows.push({ day: date.toISOString().slice(0, 10), close: Number((start + (end - start) * t + wobble).toFixed(2)) });
    }
    out[symbol] = rows;
  }
  return out;
};

const routes = {
  "/api/me": () => read("me.json"),
  "/api/market": () => read("market.json"),
  "/api/news": () => read("news.json"),
  "/api/market-news": (url) => {
    const market = Number(new URL(url, "http://x").searchParams.get("market") || 0);
    const names = ["Borsa İstanbul", "BIST 100", "BIST 30", "katılım endeksi", "temettü", "halka arz", "yatırım fonu", "dolar euro kur"];
    const base = read("news.json").items || [];
    return { market, query: names[market], items: base.slice(market, market + 6).map((item, index) => ({ ...item, title: `${names[market]} · ${item.title}`, id: `${market}-${index}` })), meta: { ok: true } };
  },
  "/api/portfolio": () => read("portfolio.json"),
  "/api/orders": () => read("orders.json"),
  "/api/notifications": () => read("notifications.json"),
  // Gerçek sunucudaki VAPID açık anahtarının yerine geçen geçerli bir P-256 noktası.
  "/api/push/key": () => ({ key: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U" }),
  "/api/push/subscribe": () => ({ ok: true }),
  "/api/push/unsubscribe": () => ({ ok: true }),
  "/api/system-bank-accounts": () => read("bank.json"),
  "/api/public/config": () => read("config.json"),
  "/api/portfolio/history": () => ({ history: history(), series: mockSeries() }),
  "/api/profile/security": () => ({ two_factor_enabled: false, sessions: [
    { id: "a", current: true, created_at: "2026-09-17 19:49", last_seen_at: "2026-09-17 19:52", ip_address: "88.23.4.9", device: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari" },
    { id: "b", current: false, created_at: "2026-09-14 10:02", last_seen_at: "2026-09-15 08:31", ip_address: "88.23.4.9", device: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome" },
  ] }),
};

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (ANON && url.pathname === "/api/me") {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Oturum yok" }));
    return;
  }
  const route = routes[url.pathname] || adminRoutes[url.pathname];
  if (route) {
    const body = JSON.stringify(asAdmin(route(req.url)));
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(body);
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("{}");
    return;
  }
  let file = path.join(dist, url.pathname === "/" ? "index.html" : url.pathname.slice(1));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, "index.html");
  res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
}).listen(4173, () => console.log("mock http://127.0.0.1:4173"));
