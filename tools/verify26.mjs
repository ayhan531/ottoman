import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
let fail = 0;

// 2) Kayıt ekranında T.C. doğrulaması
{
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
  const hata = []; p.on("pageerror", (e) => hata.push(String(e).slice(0, 160)));
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  // Tanıtım sayfasından giriş ekranına, oradan "Hesap Oluştur" sekmesine
  await p.evaluate(() => {
    const giris = [...document.querySelectorAll("button, a")].find((x) => /giriş|e-şube|hesap/i.test(x.textContent || ""));
    giris?.click();
  });
  await p.waitForTimeout(1200);
  await p.evaluate(() => [...document.querySelectorAll(".auth-tabs button")].find((x) => /Hesap Oluştur/i.test(x.textContent))?.click());
  await p.waitForTimeout(600);
  const sonuc = [];
  for (const [tc, beklenen] of [["12345678901", "hatali"], ["11111111110", "hatali"], ["10000000146", "ok"], ["53700000032", "hatali"]]) {
    const durum = await p.evaluate((deger) => {
      const alanlar = [...document.querySelectorAll("input")];
      const alan = alanlar.find((x) => x.maxLength === 11);
      if (!alan) return "alan-yok";
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(alan, deger);
      alan.dispatchEvent(new Event("input", { bubbles: true }));
      return null;
    }, tc);
    if (durum === "alan-yok") { sonuc.push([tc, "alan-yok"]); fail++; continue; }
    await p.waitForTimeout(250);
    const gorunen = await p.evaluate(() => {
      const alan = [...document.querySelectorAll("input")].find((x) => x.maxLength === 11);
      const kutu = alan?.closest("label, .auth-field") || alan?.parentElement;
      return { sinif: alan?.className || "", not: (kutu?.innerText || "").split("\n").slice(-1)[0] };
    });
    const dogru = beklenen === "ok" ? gorunen.sinif.includes("tc-ok") : gorunen.sinif.includes("tc-hatali");
    if (!dogru) fail++;
    sonuc.push([tc, beklenen, gorunen.sinif, gorunen.not, dogru ? "TAMAM" : "SORUN"]);
  }
  console.log("T.C. kontrolü ->", JSON.stringify(sonuc), "hata:", JSON.stringify(hata));
  if (hata.length) fail++;
  await p.screenshot({ path: "/tmp/a-tc.png" });
  await p.close();
}

console.log(fail ? `SORUN: ${fail}` : "HEPSİ TAMAM");
await b.close();
