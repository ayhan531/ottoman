import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
let fail = 0;
for (const [ad, ctx] of [
  ["Telefon 393", { viewport:{width:393,height:851}, isMobile:true, hasTouch:true }],
  ["Dar 360", { viewport:{width:360,height:740}, isMobile:true, hasTouch:true }],
  ["Masaustu 1280", { viewport:{width:1280,height:900} }],
]) {
  const p = await b.newPage(ctx);
  const hata = []; let payload = null;
  p.on("pageerror", (e) => hata.push(String(e).slice(0,140)));
  p.on("request", (r) => { if (r.url().includes("/api/register")) payload = r.postData() || ""; });
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  await p.evaluate(() => [...document.querySelectorAll("button,a")].find(x => /E-Şube Giriş/.test(x.innerText))?.click());
  await p.waitForTimeout(1300);
  await p.evaluate(() => [...document.querySelectorAll(".auth-tabs button")].find(x => x.innerText.trim() === "Hesap Oluştur")?.click());
  await p.waitForTimeout(700);

  const girdiler = await p.$$(".auth-field input");
  await girdiler[0].fill("Ayşe");
  await girdiler[1].fill("Yılmaz");
  await girdiler[2].fill("10000000146");
  await girdiler[3].fill("12/05/1992");
  const secmeler = await p.$$(".auth-field select");
  await secmeler[0].selectOption("İstanbul");
  await p.waitForTimeout(400);
  const ilceSayisi = await p.evaluate(() => [...document.querySelectorAll(".auth-field select")][1].options.length);
  await secmeler[1].selectOption("Kadıköy");
  const kalan = await p.$$(".auth-field input");
  await kalan[4].fill("05551234567");
  await kalan[5].fill("OT000002");
  await kalan[6].fill("ayse@ornek.com");
  await kalan[7].fill("Ottoman2026x");
  await kalan[8].fill("Ottoman2026x");
  await p.evaluate(() => document.querySelector(".checkline input")?.click());
  await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll(".auth-form2 button.confirm")][0]?.click());
  await p.waitForTimeout(1200);

  const alanlar = {};
  for (const m of (payload || "").matchAll(/name="([^"]+)"\r?\n\r?\n([^\r]*)/g)) alanlar[m[1]] = m[2];
  const beklenen = { full_name: "Ayşe Yılmaz", tc: "10000000146", phone: "05551234567",
    city: "İstanbul", district: "Kadıköy", birth_date: "1992-05-12", email: "ayse@ornek.com",
    referral_code: "OT000002", password: "Ottoman2026x" };
  const eksik = Object.entries(beklenen).filter(([k, v]) => alanlar[k] !== v);
  const tasma = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const iyi = payload && !eksik.length && ilceSayisi === 40 && tasma <= 0 && !hata.length;
  if (!iyi) fail++;
  console.log(`${ad} -> ilceSecenek:${ilceSayisi} yatayTasma:${tasma} eksikAlan:${JSON.stringify(eksik)} hata:${JSON.stringify(hata)} ${iyi ? "TAMAM" : "SORUN"}`);
  await p.close();
}
console.log(fail === 0 ? "HEPSI TEMIZ" : `SORUNLU: ${fail}`);
await b.close();
