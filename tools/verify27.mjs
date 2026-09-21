import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
let fail = 0;
const yerel = (p) => p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
const hazir = async (p, url = "http://127.0.0.1:4173") => {
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1700);
};

// 1) Tutar alanı: para ile çalışıyor, basamaklar bozulmuyor
{
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
  const hata = []; p.on("pageerror", (e) => hata.push(String(e).slice(0, 160)));
  await yerel(p); await hazir(p);
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")].find((x) => /Al\/Sat/i.test(x.innerText))?.click());
  await p.waitForTimeout(1200);
  const alanVar = await p.evaluate(() => [...document.querySelectorAll(".trade-body input")].length);
  const tutarAlani = p.locator(".trade-body input").nth(3);       // limit, adet, tutar sırası değişebilir
  const alanlar = await p.evaluate(() => [...document.querySelectorAll(".trade-body .field, .trade-body label")].map((x) => x.innerText.split("\n")[0]));
  // Tutar etiketli alanı bul
  const indeks = await p.evaluate(() => {
    const kutular = [...document.querySelectorAll(".trade-body input")];
    return kutular.findIndex((x) => /Tutar/i.test(x.closest("label,.field")?.innerText || ""));
  });
  let sonuc = { alanVar, alanlar, indeks };
  if (indeks >= 0) {
    const kutu = p.locator(".trade-body input").nth(indeks);
    await kutu.click();
    await kutu.type("40000", { delay: 60 });
    await p.waitForTimeout(300);
    const yazilan = await kutu.inputValue();
    const adet = await p.evaluate((i) => {
      const kutular = [...document.querySelectorAll(".trade-body input")];
      const a = kutular.find((x) => /Adet|Pay|Talep lotu/i.test(x.closest("label,.field")?.innerText || ""));
      return a ? a.value : "";
    }, indeks);
    await p.keyboard.press("Tab");
    await p.waitForTimeout(400);
    const blurSonrasi = await kutu.inputValue();
    sonuc = { ...sonuc, yazilan, adet, blurSonrasi };
    const iyi = yazilan === "40.000" && Number(adet) > 0 && /^[\d.]+,\d{2}$/.test(blurSonrasi);
    if (!iyi) fail++;
    console.log("Tutar alanı ->", JSON.stringify(sonuc), iyi ? "TAMAM" : "SORUN");
  } else {
    fail++;
    console.log("Tutar alanı bulunamadı ->", JSON.stringify(sonuc), "SORUN");
  }
  if (hata.length) { fail++; console.log("sayfa hatası", hata); }
  await p.screenshot({ path: "/tmp/tutar.png" });
  await p.close();
}

// 2) Geri tuşu: sekme/katman kapanır, siteden çıkmaz
{
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
  const hata = []; p.on("pageerror", (e) => hata.push(String(e).slice(0, 160)));
  await yerel(p); await hazir(p);
  const adimlar = [];
  // Haberler sekmesine geç
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][1]?.click());
  await p.waitForTimeout(900);
  adimlar.push(await p.evaluate(() => document.querySelector(".navbar button.on, .navbar button.active")?.innerText.trim() || document.body.innerText.slice(0, 20)));
  await p.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
  await p.waitForTimeout(900);
  const kaldi = await p.evaluate(() => ({ url: location.href, kok: Boolean(document.querySelector(".esube, .app-stage, #app")) , metin: document.body.innerText.slice(0, 40) }));
  const iyi = /127\.0\.0\.1/.test(kaldi.url) && kaldi.kok && !hata.length;
  if (!iyi) fail++;
  console.log("Geri tuşu ->", JSON.stringify({ adimlar, ...kaldi }), iyi ? "TAMAM (uygulamada kaldı)" : "SORUN");
  await p.close();
}

// 3) Yüzde biçimi: rakamın sonunda
{
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
  await yerel(p); await hazir(p);
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")].find((x) => /Portf/i.test(x.innerText))?.click());
  await p.waitForTimeout(1400);
  const metin = await p.evaluate(() => document.body.innerText);
  const sonEk = (metin.match(/[+−-]\s?\d+[.,]\d+%/g) || []).length;
  const onEk = (metin.match(/[+−-]%\s?\d/g) || []).length;
  const iyi = sonEk > 0 && onEk === 0;
  if (!iyi) fail++;
  console.log(`Yüzde biçimi -> sonda:${sonEk} başta:${onEk} ${iyi ? "TAMAM" : "SORUN"}`);
  await p.screenshot({ path: "/tmp/yuzde.png" });
  await p.close();
}

console.log(fail ? `SORUN: ${fail}` : "HEPSİ TAMAM");
await b.close();
