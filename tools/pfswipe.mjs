import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
let fail = 0;
for (const [ad, ctx] of [
  ["Android 393", { viewport:{width:393,height:851}, isMobile:true, hasTouch:true }],
  ["iPhone 390", { viewport:{width:390,height:844}, isMobile:true, hasTouch:true, userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" }],
  ["Masaustu 1280", { viewport:{width:1280,height:800} }],
]) {
  const p = await b.newPage(ctx);
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  // Kurulum önerisi ekranı testi kapatmasın.
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem("ottoman.install-hint", "true"); localStorage.setItem("ottoman.push-asked", "true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1700);
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][3]?.click());
  await p.waitForTimeout(1400);

  const kutu = await p.evaluate(() => { const r = document.querySelector(".pf-viewport").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const y = Math.round(kutu.y + kutu.h / 2);
  const bas = Math.round(kutu.x + kutu.w * 0.8);
  const bit = Math.round(kutu.x + kutu.w * 0.15);

  // Gerçek parmak hareketi: basılı tut, kaydır, bırak
  await p.mouse.move(bas, y);
  await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(Math.round(bas + (bit - bas) * (i / 8)), y + (i % 2), { steps: 1 });
  await p.mouse.up();
  await p.waitForTimeout(700);
  const sonra = await p.evaluate(() => ({
    aktif: [...document.querySelectorAll(".pf-dots i")].findIndex((x) => x.classList.contains("on")),
    yukseklik: Math.round(document.querySelector(".pf-viewport").getBoundingClientRect().height),
    kartBasligi: document.querySelector(".pf-slot:nth-child(2) .pf-card")?.innerText.split("\n")[0] || "",
    donusum: document.querySelector(".pf-lane").style.transform,
  }));

  // Geri kaydır
  await p.mouse.move(bit, y); await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(Math.round(bit + (bas - bit) * (i / 8)), y, { steps: 1 });
  await p.mouse.up();
  await p.waitForTimeout(700);
  const geri = await p.evaluate(() => ({
    aktif: [...document.querySelectorAll(".pf-dots i")].findIndex((x) => x.classList.contains("on")),
    yukseklik: Math.round(document.querySelector(".pf-viewport").getBoundingClientRect().height),
  }));

  // İki kart eşit boyda olmalı; kaydırma her iki yöne de çalışmalı.
  const iyi = sonra.aktif === 1 && geri.aktif === 0 && sonra.yukseklik === geri.yukseklik;
  if (!iyi) fail++;
  console.log(`${ad} -> saga kaydir:${JSON.stringify(sonra)} geri:${JSON.stringify(geri)} ${iyi ? "TAMAM" : "SORUN"}`);
  await p.close();
}
console.log(fail === 0 ? "HEPSI TEMIZ" : `SORUNLU: ${fail}`);
await b.close();
