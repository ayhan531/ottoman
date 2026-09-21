import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
for (const [ad, w, h] of [["telefon", 393, 851], ["masaustu", 1280, 900]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1400);
  const olcum = await p.evaluate(() => {
    const e = document.querySelector(".corporate-licence");
    if (!e) return null;
    const k = e.getBoundingClientRect();
    return { metin: e.innerText.trim(), genislik: Math.round(k.width), tasma: e.scrollWidth > e.clientWidth + 1,
      sayfaTasmasi: document.documentElement.scrollWidth > window.innerWidth + 2 };
  });
  console.log(ad, JSON.stringify(olcum));
  await p.screenshot({ path: `/tmp/hero-${ad}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(h, 860) } });
  await p.close();
}
await b.close();
