import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport:{width:393,height:851} });
const p = await ctx.newPage();
await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
console.log("1. yukleme kontrol:", await p.evaluate(() => Boolean(navigator.serviceWorker.controller)));
await p.waitForTimeout(2000);
console.log("2 sn sonra kontrol:", await p.evaluate(() => Boolean(navigator.serviceWorker.controller)));
// Yeni bir API cagrisi yap
console.log("api cagrisi:", await p.evaluate(() => fetch("/api/market").then(r => r.status)));
await p.waitForTimeout(1200);
console.log("kutular:", JSON.stringify(await p.evaluate(async () => {
  const s = {}; for (const ad of await caches.keys()) s[ad] = (await (await caches.open(ad)).keys()).map(r => new URL(r.url).pathname);
  return s;
})));
await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
console.log("reload sonrasi kontrol:", await p.evaluate(() => Boolean(navigator.serviceWorker.controller)));
console.log("kutular2:", JSON.stringify(await p.evaluate(async () => {
  const s = {}; for (const ad of await caches.keys()) s[ad] = (await (await caches.open(ad)).keys()).map(r => new URL(r.url).pathname + new URL(r.url).search);
  return s;
})));
await b.close();
