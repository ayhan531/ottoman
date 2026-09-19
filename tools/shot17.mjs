import { chromium } from "playwright";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
for (const [ad, url, tema] of [["ios-kurulum", "http://127.0.0.1:4173", "dark"], ["ios-bildirim", "http://127.0.0.1:4173/?uygulama=1", "dark"]]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE, isMobile: true, hasTouch: true, colorScheme: tema, deviceScaleFactor: 2 });
  await ctx.grantPermissions(["notifications"], { origin: "http://127.0.0.1:4173" });
  const p = await ctx.newPage();
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4300);
  await p.screenshot({ path: `shots/${ad}.png` });
  await ctx.close();
}
await b.close();
console.log("cekildi");
