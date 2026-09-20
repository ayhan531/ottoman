import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
for (const [ad, koyu] of [["haber-koyu", true], ["haber-acik", false]]) {
  const p = await b.newPage({ viewport:{width:393,height:851}, isMobile:true, hasTouch:true, deviceScaleFactor:2, colorScheme: koyu ? "dark" : "light" });
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1700);
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][1]?.click());
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `shots/${ad}.png` });
  await p.close();
}
await b.close();
console.log("cekildi");
