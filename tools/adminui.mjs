import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
let fail = 0;
for (const [ad, ctx] of [["Masaustu 1280", { viewport:{width:1280,height:900} }], ["Telefon 393", { viewport:{width:393,height:851}, isMobile:true, hasTouch:true }]]) {
  const p = await b.newPage(ctx);
  const hata = [];
  p.on("pageerror", (e) => hata.push(String(e).slice(0, 160)));
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1800);
  // Hesap > Admin girişi
  await p.evaluate(() => document.querySelector('button[title="Admin"]')?.click());
  await p.waitForTimeout(1800);
  const acildi = await p.evaluate(() => Boolean(document.querySelector(".ac-root")));
  const sekmeler = {};
  for (const sekme of ["Müşteriler", "Emirler", "Para", "Bankalar", "Belgeler", "Sistem"]) {
    await p.evaluate((s) => [...document.querySelectorAll(".admin-tabs button")].find(x => x.innerText.trim() === s)?.click(), sekme);
    await p.waitForTimeout(700);
    sekmeler[sekme] = await p.evaluate(() => ({
      baslik: document.querySelector(".ac-section h3")?.textContent || "yok",
      satir: document.querySelectorAll(".ac-line").length,
      alan: document.querySelectorAll(".ac-field input, .ac-field select").length,
    }));
  }
  // Müşteri kartını aç
  await p.evaluate(() => [...document.querySelectorAll(".admin-tabs button")].find(x => x.innerText.trim() === "Müşteriler")?.click());
  await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelectorAll(".ac-list .ac-line")[0]?.click());
  await p.waitForTimeout(1200);
  const kart = await p.evaluate(() => {
    const e = document.querySelector(".ac-editor");
    if (!e) return { yok: true };
    return {
      basliklar: [...e.querySelectorAll(".ac-section h3")].map(x => x.textContent),
      alanSayisi: e.querySelectorAll(".ac-field input, .ac-field select").length,
      istatistik: [...e.querySelectorAll(".ac-stats strong")].map(x => x.textContent),
      tasma: e.scrollWidth - e.clientWidth,
    };
  });
  // Kilit akışı: kaydete basınca şifre sorulmalı
  await p.evaluate(() => [...document.querySelectorAll(".ac-editor button")].find(x => /Bilgileri kaydet/.test(x.innerText))?.click());
  await p.waitForTimeout(700);
  const kilit = await p.evaluate(() => Boolean(document.querySelector(".ac-lock")));
  const iyi = acildi && !kart.yok && kart.basliklar.length >= 5 && kilit && kart.tasma <= 1 && !hata.length;
  if (!iyi) fail++;
  console.log(`${ad} -> acildi:${acildi} sekmeler:${JSON.stringify(sekmeler)}`);
  console.log(`   kart:${JSON.stringify(kart)} sifreSoruldu:${kilit} hata:${JSON.stringify(hata)} ${iyi ? "TAMAM" : "SORUN"}`);
  await p.close();
}
console.log(fail === 0 ? "HEPSI TEMIZ" : `SORUNLU: ${fail}`);
await b.close();
