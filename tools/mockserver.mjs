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
  "/api/admin/summary": () => ({ summary: { users_total: 3, orders_pending: 1, cash_total: 500000, blocked_total: 0 } }),
  "/api/admin/users": () => ({ users: [
    { id: 2, full_name: "Ottoman Test Kullanıcı", status: "approved", status_label: "Onaylandı", email: "test@ottoman.local", account_no: "OT000002", phone: "05550000000", cash_balance: 123456.78, order_count: 4, buy_count: 3, sell_count: 1, transaction_count: 6, kyc_status_label: "Onaylandı" },
    { id: 3, full_name: "Bekleyen Başvuru", status: "pending", status_label: "Beklemede", email: "yeni@ottoman.local", account_no: "OT000003", phone: "05551112233", cash_balance: 0 },
  ] }),
  "/api/admin/orders": () => ({ orders: [
    { id: 11, symbol: "THYAO", side: "buy", side_label: "Alış", full_name: "Ottoman Test Kullanıcı", quantity: 100, total: 28925, status: "pending", status_label: "Beklemede" },
  ] }),
  "/api/admin/money": () => ({ money_requests: [
    { id: 5, request_type: "deposit", type_label: "Para Yatırma", full_name: "Ottoman Test Kullanıcı", amount: 5000, status: "pending", status_label: "Beklemede" },
  ] }),
  "/api/admin/reports": () => ({ users: [1, 2], audit: [1, 2, 3], reconciliation: { cash: 500000, blocked: 0 } }),
  "/api/admin/system-settings": () => ({ settings: { t2_enabled: "0" } }),
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
  "/api/portfolio": () => read("portfolio.json"),
  "/api/orders": () => read("orders.json"),
  "/api/notifications": () => read("notifications.json"),
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
    const body = JSON.stringify(asAdmin(route()));
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
