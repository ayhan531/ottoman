import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
let fail = 0;

// 1) Tüm hisseler: ana sayfada ve Hisse Ara'da
{
  const p = await b.newPage({ viewport:{width:393,height:851}, isMobile:true, hasTouch:true });
  const hata = []; p.on("pageerror", e => hata.push(String(e).slice(0,140)));
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1800);

  const basliklar = await p.evaluate(() => [...document.querySelectorAll(".h-title")].map(x => x.textContent.trim()));
  const sayac = await p.evaluate(() => document.querySelector(".h-count")?.textContent || "yok");
  // Aşağı kaydırınca liste büyüyor mu
  const once = await p.evaluate(() => document.querySelectorAll(".inst-row").length);
  await p.evaluate(() => { const el = document.querySelector(".esube-body") || document.scrollingElement; el.scrollTop = el.scrollHeight; });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const el = document.querySelector(".esube-body") || document.scrollingElement; el.scrollTop = el.scrollHeight; });
  await p.waitForTimeout(900);
  const sonra = await p.evaluate(() => document.querySelectorAll(".inst-row").length);

  // Hisse Ara: yazmadan liste
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][2]?.click());
  await p.waitForTimeout(1500);
  const arama = await p.evaluate(() => {
    const panel = document.querySelector(".sheet-panel, .dialog-panel");
    return { baslik: panel?.querySelector("h3,h2,.sheet-title")?.textContent || panel?.innerText.split("\n")[0], satir: document.querySelectorAll(".picker-list .inst-row").length };
  });
  const iyi = basliklar.some((x) => x.startsWith("Tüm hisseler")) && sonra > once && !hata.length;
  if (!iyi) fail++;
  console.log(`Tüm hisseler -> basliklar:${JSON.stringify(basliklar)} sayac:${sayac} satir ${once}→${sonra} hata:${JSON.stringify(hata)} ${iyi ? "TAMAM" : "SORUN"}`);
  await p.close();
}

// 2) Hisse Ara panelinde arama yazmadan liste çıkıyor mu
{
  const p = await b.newPage({ viewport:{width:393,height:851}, isMobile:true, hasTouch:true });
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1700);
  await p.evaluate(() => { const a = [...document.querySelectorAll(".link-all")].find(x => x.innerText.trim() === "Tümü"); a && a.click(); });
  await p.waitForTimeout(1300);
  const sonuc = await p.evaluate(() => ({
    baslik: (document.querySelector(".sheet-panel, .dialog-panel")?.innerText || "").split("\n")[0],
    sayac: document.querySelector(".picker-count")?.textContent,
    satir: document.querySelectorAll(".picker-list .inst-row").length,
    kaydirilabilir: (() => { const l = document.querySelector(".picker-list"); return l ? l.scrollHeight > l.clientHeight : false; })(),
  }));
  const iyi = sonuc.satir > 20 && sonuc.kaydirilabilir;
  if (!iyi) fail++;
  console.log(`Hisse Ara -> ${JSON.stringify(sonuc)} ${iyi ? "TAMAM" : "SORUN"}`);
  await p.close();
}

console.log(fail === 0 ? "HEPSI TEMIZ" : `SORUNLU: ${fail}`);
await b.close();
