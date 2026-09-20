import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport:{width:393,height:851}, isMobile:true, hasTouch:true });
await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
await p.evaluate(() => { try { localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
await p.evaluate(() => [...document.querySelectorAll("button,a")].find(x => /E-Şube Giriş/.test(x.innerText))?.click());
await p.waitForTimeout(1400);
console.log(JSON.stringify(await p.evaluate(() => {
  const ekran = document.querySelector(".auth-screen");
  const tik = document.querySelector(".auth-ticker");
  const cs = getComputedStyle(ekran);
  return { ekranPadUst: cs.paddingTop, tickerUst: tik ? Math.round(tik.getBoundingClientRect().top - ekran.getBoundingClientRect().top) : "yok" };
})));
await b.close();
