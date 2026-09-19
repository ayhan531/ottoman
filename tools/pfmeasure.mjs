import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
for (const [ad, ctx] of [
  ["Android 393", { viewport:{width:393,height:851}, isMobile:true, hasTouch:true }],
  ["iPhone 390", { viewport:{width:390,height:844}, isMobile:true, hasTouch:true, userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" }],
]) {
  const p = await b.newPage(ctx);
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1800);
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][3]?.click());
  await p.waitForTimeout(1500);
  const olcum = await p.evaluate(() => {
    const vp = document.querySelector(".pf-viewport");
    const slots = [...document.querySelectorAll(".pf-slot")];
    const kart = (s) => { const c = s.querySelector(".pf-card"); const ic = [...c.children].filter(x=>x.offsetHeight); const son = ic[ic.length-1]; return { kartY: Math.round(c.getBoundingClientRect().height), dogal: Math.round(c.scrollHeight), altBosluk: Math.round(c.getBoundingClientRect().bottom - son.getBoundingClientRect().bottom) }; };
    return {
      viewport: Math.round(vp.getBoundingClientRect().height),
      touchAction: getComputedStyle(vp).touchAction,
      kartlar: slots.map(kart),
    };
  });
  console.log(ad, JSON.stringify(olcum));
  await p.close();
}
await b.close();
