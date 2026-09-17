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

const routes = {
  "/api/me": () => read("me.json"),
  "/api/market": () => read("market.json"),
  "/api/news": () => read("news.json"),
  "/api/portfolio": () => read("portfolio.json"),
  "/api/orders": () => read("orders.json"),
  "/api/notifications": () => read("notifications.json"),
  "/api/system-bank-accounts": () => read("bank.json"),
  "/api/public/config": () => read("config.json"),
  "/api/portfolio/history": () => ({ history: history() }),
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
  const route = routes[url.pathname];
  if (route) {
    const body = JSON.stringify(route());
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
