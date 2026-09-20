import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const TELEGRAM = "Mozilla/5.0 (Linux; Android 14; SM-S911B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36";
let fail = 0;

// 1) Haber satırları: hiç görsel yok, her satırda işaret var
{
  const p = await b.newPage({ viewport:{width:393,height:851}, isMobile:true, hasTouch:true, userAgent:ANDROID });
  const hata = []; p.on("pageerror", e => hata.push(String(e).slice(0,140)));
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1700);
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][1]?.click());
  await p.waitForTimeout(1600);
  const haber = await p.evaluate(() => {
    const satirlar = [...document.querySelectorAll(".nrow")];
    return {
      satir: satirlar.length,
      isaretli: satirlar.filter(x => x.querySelector(".nmark")).length,
      gorselli: satirlar.filter(x => x.querySelector("img")).length,
      yukseklikler: [...new Set(satirlar.map(x => Math.round(x.getBoundingClientRect().height)))].sort((a,b)=>a-b),
    };
  });
  const iyi = haber.satir > 0 && haber.isaretli === haber.satir && haber.gorselli === 0 && haber.yukseklikler.length <= 3 && !hata.length;
  if (!iyi) fail++;
  console.log(`Haberler -> ${JSON.stringify(haber)} hata:${JSON.stringify(hata)} ${iyi ? "TAMAM" : "SORUN"}`);
  await p.close();
}

// 2) Android kurulum düğmesi: teklif yoksa artık sessiz kalmıyor
for (const [ad, ua, beklenen] of [["Android Chrome", ANDROID, "Chrome bu sayfada"], ["Telegram içi", TELEGRAM, "Tarayıcıda aç"]]) {
  const p = await b.newPage({ viewport:{width:393,height:851}, isMobile:true, hasTouch:true, userAgent:ua });
  const hata = []; p.on("pageerror", e => hata.push(String(e).slice(0,140)));
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1700);
  await p.evaluate(() => document.querySelector(".esube .ava")?.click());
  await p.waitForTimeout(600);
  await p.evaluate(() => [...document.querySelectorAll("button")].find(x => x.innerText.trim() === "Uygulamayı yükle")?.click());
  await p.waitForTimeout(900);
  const uyariVar = await p.evaluate(() => /başka bir uygulamanın içinde/.test(document.body.innerText));
  await p.evaluate(() => [...document.querySelectorAll(".sheet-panel button.btn, .dialog-panel button.btn")].find(x => /Ana ekrana ekle/.test(x.innerText))?.click());
  await p.waitForTimeout(1100);
  const bildirim = await p.evaluate(() => {
    const paneller = [...document.querySelectorAll(".dialog-panel, .sheet-panel")].map(x => x.innerText);
    return paneller.join(" | ").replace(/\s+/g, " ").slice(0, 220);
  });
  const iyi = bildirim.includes(beklenen) && (ad !== "Telegram içi" || uyariVar) && !hata.length;
  if (!iyi) fail++;
  console.log(`Kurulum ${ad} -> uyariSeridi:${uyariVar} bildirim:"${bildirim.slice(0,110)}" ${iyi ? "TAMAM" : "SORUN"}`);
  await p.close();
}
console.log(fail === 0 ? "HEPSI TEMIZ" : `SORUNLU: ${fail}`);
await b.close();
