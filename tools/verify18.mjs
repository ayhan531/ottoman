import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
let fail = 0;
const kur = async (ua, opts = {}) => {
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, userAgent: ua, ...opts });
  const hata = [];
  p.on("pageerror", (e) => hata.push(String(e).slice(0, 140)));
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1700);
  return { p, hata };
};

// 1) Gizli tutar noktayla gösterilmeli
{
  const { p, hata } = await kur(ANDROID);
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][3]?.click());
  await p.waitForTimeout(1300);
  await p.evaluate(() => document.querySelector(".pf-eye")?.click());
  await p.waitForTimeout(600);
  const gizli = await p.evaluate(() => ({
    toplam: document.querySelector(".pf-total")?.textContent,
    yildizVar: /★/.test(document.body.innerText),
    noktaVar: /•/.test(document.querySelector(".pf-total")?.textContent || ""),
    esitKart: (() => { const s = [...document.querySelectorAll(".pf-slot")].map(x => Math.round(x.offsetHeight)); return s[0] === s[1] ? "evet" : `hayır ${s}`; })(),
  }));
  const iyi = gizli.noktaVar && !gizli.yildizVar && gizli.esitKart === "evet" && !hata.length;
  if (!iyi) fail++;
  console.log(`Gizli tutar -> ${JSON.stringify(gizli)} ${iyi ? "TAMAM" : "SORUN " + JSON.stringify(hata)}`);
  await p.close();
}

// 2) İki adımlı doğrulamada SMS olmamalı
{
  const { p, hata } = await kur(ANDROID);
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][4]?.click());
  await p.waitForTimeout(900);
  await p.evaluate(() => [...document.querySelectorAll("button")].find(x => x.innerText.trim().startsWith("Güvenlik"))?.click());
  await p.waitForTimeout(900);
  await p.evaluate(() => [...document.querySelectorAll("button")].find(x => /İki Adımlı/.test(x.innerText))?.click());
  await p.waitForTimeout(900);
  const t = await p.evaluate(() => document.body.innerText);
  const iyi = /İki Adımlı Doğrulama/.test(t) && !/SMS/.test(t) && /Doğrulama Uygulaması/.test(t) && !hata.length;
  if (!iyi) fail++;
  console.log(`2FA -> smsVar:${/SMS/.test(t)} uygulamaVar:${/Doğrulama Uygulaması/.test(t)} ${iyi ? "TAMAM" : "SORUN"}`);
  await p.close();
}

// 3) Kurulum ekranı: Android'de düğme, iOS'ta adımlar, bilgisayar satırı yok
for (const [ad, ua] of [["Android", ANDROID], ["iPhone", IPHONE]]) {
  const { p, hata } = await kur(ua);
  await p.evaluate(() => document.querySelector(".esube .ava")?.click());
  await p.waitForTimeout(600);
  await p.evaluate(() => [...document.querySelectorAll("button")].find(x => x.innerText.trim() === "Uygulamayı yükle")?.click());
  await p.waitForTimeout(1000);
  const k = await p.evaluate(() => {
    const panel = document.querySelector(".sheet-panel, .dialog-panel");
    return { metin: panel?.innerText.replace(/\s+/g, " ") || "yok",
             adim: panel?.querySelectorAll(".ios-steps li").length || 0,
             dugmeler: [...(panel?.querySelectorAll("button.btn") || [])].map(x => x.innerText.trim()) };
  });
  const bilgisayarYok = !/Bilgisayar/.test(k.metin);
  const altYaziYok = !/tek dokunuşla kendi e-şubeniz/.test(k.metin);
  const iyi = k.adim >= 2 && bilgisayarYok && altYaziYok && !hata.length;
  if (!iyi) fail++;
  console.log(`Kurulum ${ad} -> adim:${k.adim} bilgisayarYok:${bilgisayarYok} altYaziYok:${altYaziYok} dugme:${JSON.stringify(k.dugmeler)} ${iyi ? "TAMAM" : "SORUN"}`);
  await p.close();
}
console.log(fail === 0 ? "HEPSI TEMIZ" : `SORUNLU: ${fail}`);
await b.close();
