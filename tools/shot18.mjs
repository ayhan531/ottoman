import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const kur = async () => {
  const p = await b.newPage({ viewport:{width:393,height:851}, isMobile:true, hasTouch:true, userAgent:ANDROID, deviceScaleFactor:2, colorScheme:"dark" });
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1700);
  return p;
};
let p = await kur();
await p.evaluate(() => [...document.querySelectorAll(".navbar button")][3]?.click());
await p.waitForTimeout(1300);
await p.evaluate(() => document.querySelector(".pf-eye")?.click());
await p.waitForTimeout(700);
await p.screenshot({ path: "shots/gizli-nokta.png" });
await p.close();

p = await kur();
await p.evaluate(() => document.querySelector(".esube .ava")?.click());
await p.waitForTimeout(600);
await p.evaluate(() => [...document.querySelectorAll("button")].find(x => x.innerText.trim() === "Uygulamayı yükle")?.click());
await p.waitForTimeout(1000);
await p.screenshot({ path: "shots/kurulum-android.png" });
await p.close();
await b.close();
console.log("cekildi");
