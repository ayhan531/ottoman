import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport:{width:393,height:851}, isMobile:true, hasTouch:true, deviceScaleFactor:2, colorScheme:"dark" });
const p = await ctx.newPage();
await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
await p.evaluate(() => { try { localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(2200);

// Tüm hisseler bölümü
await p.evaluate(() => { const el = document.querySelector(".esube-body") || document.scrollingElement; el.scrollTop = el.scrollHeight * 0.62; });
await p.waitForTimeout(900);
await p.screenshot({ path: "shots/tum-hisseler.png" });

// Hisse Ara
await p.evaluate(() => [...document.querySelectorAll(".navbar button")][0]?.click());
await p.waitForTimeout(700);
await p.evaluate(() => { const a = [...document.querySelectorAll(".link-all")].find(x => x.innerText.trim() === "Tümü"); a && a.click(); });
await p.waitForTimeout(1200);
await p.screenshot({ path: "shots/hisse-ara.png" });
await p.keyboard.press("Escape");
await p.waitForTimeout(600);

// Çevrimdışı
await ctx.setOffline(true);
await p.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
await p.waitForTimeout(3000);
await p.screenshot({ path: "shots/cevrimdisi.png" });
await ctx.setOffline(false);
await b.close();
console.log("cekildi");
