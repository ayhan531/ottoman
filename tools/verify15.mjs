import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
let fail = 0;
for (const [label, ctx] of [
  ["iPhone 390", { viewport:{width:390,height:844}, userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", isMobile:true, hasTouch:true }],
  ["Android 393", { viewport:{width:393,height:851}, isMobile:true, hasTouch:true }],
  ["Masaüstü 1280", { viewport:{width:1280,height:800} }],
]) {
  const p = await b.newPage(ctx);
  const hatalar = [];
  p.on("pageerror", (e) => hatalar.push(String(e).slice(0, 120)));
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1600);

  // Kurulum sayfası
  await p.evaluate(() => document.querySelector(".esube .ava")?.click());
  await p.waitForTimeout(600);
  await p.evaluate(() => [...document.querySelectorAll("button")].find(x => x.innerText.trim() === "Uygulamayı yükle")?.click());
  await p.waitForTimeout(900);
  const kurulum = await p.evaluate(() => {
    const panel = document.querySelector(".sheet-panel, .dialog-panel");
    if (!panel) return { yok: true };
    const img = panel.querySelector(".install-hero img");
    return {
      metin: panel.innerText.replace(/\s+/g, " ").slice(0, 120),
      simge: img ? `${img.naturalWidth}x${img.naturalHeight}` : "yok",
      tasma: panel.scrollHeight - panel.clientHeight,
    };
  });
  await p.keyboard.press("Escape"); await p.waitForTimeout(500);

  // Bildirim ayarları
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][4]?.click());
  await p.waitForTimeout(800);
  await p.evaluate(() => [...document.querySelectorAll("button")].find(x => x.innerText.trim().startsWith("Bildirim"))?.click());
  await p.waitForTimeout(900);
  const bildirim = await p.evaluate(() => {
    const t = document.body.innerText;
    return { cihazSatiri: /Cihaz Bildirimleri/.test(t), not: (t.match(/Cihaz Bildirimleri\n([^\n]*)/) || [])[1] || "" };
  });

  const sw = await p.evaluate(() => navigator.serviceWorker?.controller ? "kayitli" : (navigator.serviceWorker ? "destekli" : "yok"));
  if (kurulum.yok || kurulum.simge === "yok" || kurulum.tasma > 1 || !bildirim.cihazSatiri || hatalar.length) fail++;
  console.log(`${label} → kurulum:${JSON.stringify(kurulum)} bildirim:${JSON.stringify(bildirim)} sw:${sw} hata:${JSON.stringify(hatalar)}`);
  await p.close();
}
console.log(fail === 0 ? "HEPSI TEMIZ" : `SORUNLU: ${fail}`);
await b.close();
