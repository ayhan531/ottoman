import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
await p.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
await p.evaluate(() => [...document.querySelectorAll("button, a")].find((x) => /giriş|e-şube|hesap/i.test(x.textContent || ""))?.click());
await p.waitForTimeout(1200);
// T.C. alanına klavyeyle odaklan (focus-visible tetiklensin)
await p.keyboard.press("Tab");
await p.keyboard.press("Tab");
await p.keyboard.press("Tab");
await p.waitForTimeout(300);
const odak = await p.evaluate(() => {
  const e = document.activeElement;
  const s = getComputedStyle(e);
  return { etiket: e.tagName, sinif: e.className, outline: s.outlineStyle + " " + s.outlineWidth + " " + s.outlineColor, golge: s.boxShadow };
});
console.log("odaklanan:", JSON.stringify(odak));
const kutu = await p.$(".auth-field input");
await kutu?.click();
await p.waitForTimeout(300);
const tiklananOdak = await p.evaluate(() => {
  const e = document.activeElement; const s = getComputedStyle(e);
  return { outline: s.outlineStyle + " " + s.outlineWidth + " " + s.outlineColor, golge: s.boxShadow };
});
console.log("tıklanan alan:", JSON.stringify(tiklananOdak));
await p.screenshot({ path: "/tmp/auth-odak.png" });
await b.close();
