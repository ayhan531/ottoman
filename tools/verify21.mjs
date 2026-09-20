import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport:{width:393,height:851}, isMobile:true, hasTouch:true });
const p = await ctx.newPage();
const hata = []; p.on("pageerror", e => hata.push(String(e).slice(0,140)));
await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
await p.evaluate(() => { try { localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
await p.reload({ waitUntil: "domcontentloaded" });
// Servis çalışanı sayfayı devralana kadar bekle
await p.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(2500);

// Servis çalışanı hazır mı
const sw = await p.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return { durum: reg.active ? "etkin" : "yok", kontrol: Boolean(navigator.serviceWorker.controller) };
});
// Önbellek dolsun diye gez
await p.evaluate(() => [...document.querySelectorAll(".navbar button")][3]?.click());
await p.waitForTimeout(1200);
await p.evaluate(() => [...document.querySelectorAll(".navbar button")][0]?.click());
await p.waitForTimeout(1500);
const kutular = await p.evaluate(async () => {
  const adlar = await caches.keys();
  const sonuc = {};
  for (const ad of adlar) sonuc[ad] = (await (await caches.open(ad)).keys()).length;
  return sonuc;
});

// Çevrimdışına al ve yeniden yükle
await ctx.setOffline(true);
await p.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
await p.waitForTimeout(3000);
const cevrimdisi = await p.evaluate(() => ({
  esube: Boolean(document.querySelector(".esube")),
  tarayiciHatasi: /ERR_INTERNET_DISCONNECTED|bağlı değil|No internet/i.test(document.body.innerText),
  serit: document.querySelector(".offline-bar")?.textContent?.trim() || "yok",
  hisseSatiri: document.querySelectorAll(".inst-row").length,
  baslik: document.querySelector(".h-title")?.textContent || "yok",
}));
await ctx.setOffline(false);

const iyi = cevrimdisi.esube && !cevrimdisi.tarayiciHatasi && cevrimdisi.hisseSatiri > 0 && cevrimdisi.serit !== "yok";
console.log("sw:", JSON.stringify(sw));
console.log("onbellek:", JSON.stringify(kutular));
console.log("cevrimdisi:", JSON.stringify(cevrimdisi));
console.log("js hata:", JSON.stringify(hata));
console.log(iyi ? "TAMAM" : "SORUN");
await b.close();
