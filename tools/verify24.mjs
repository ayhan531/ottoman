import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const SAYFALAR = ["Dashboard", "Kullanıcılar", "Portföyler", "Bakiye Detayları", "Kredi Başvuruları",
  "Kredi Ayarları", "T+2 Takip", "Onay Bekleyenler", "Banka Hesapları", "Para Yatırma Talepleri",
  "Para Yükleme", "Para Çekme", "Hisse Açıklamaları", "Sistem Ayarları",
  "Emirler", "Belgeler", "Denetim Kaydı"];
let fail = 0;

for (const [ad, w, h] of [["telefon", 393, 851], ["masaüstü", 1440, 900]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 });
  const hata = []; p.on("pageerror", (e) => hata.push(String(e).slice(0, 160)));
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.setItem("ottoman.install-hint", "true"); localStorage.setItem("ottoman.push-asked", "true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1600);
  // Admin düğmesi: başlık çubuğundaki kalkan
  const acildi = await p.evaluate(() => {
    const d = [...document.querySelectorAll("button")].find((x) => x.getAttribute("title") === "Admin" || /admin/i.test(x.getAttribute("aria-label") || ""));
    if (d) { d.click(); return true; }
    return false;
  });
  if (!acildi) { console.log(`${ad} -> admin düğmesi bulunamadı SORUN`); fail++; await p.close(); continue; }
  await p.waitForTimeout(1800);

  for (const sayfa of SAYFALAR) {
    await p.evaluate(() => document.querySelector(".ac-menu-btn")?.click());
    await p.waitForTimeout(260);
    const tiklandi = await p.evaluate((hedef) => {
      const d = [...document.querySelectorAll(".ac-drawer-group button")].find((x) => (x.querySelector("span")?.textContent || "").trim() === hedef);
      if (!d) return false;
      d.click();
      return true;
    }, sayfa);
    if (!tiklandi) { console.log(`${ad} · ${sayfa} -> menüde yok SORUN`); fail++; continue; }
    await p.waitForTimeout(700);
    const olcum = await p.evaluate(() => {
      const kok = document.querySelector(".ac-root");
      const baslik = document.querySelector(".ac-top-copy h2")?.textContent.trim() || "";
      const bolum = document.querySelectorAll(".ac-section").length;
      const tasan = [...kok.querySelectorAll(".ac-section, .ac-line, .ac-cards article, .ac-top")]
        .filter((e) => e.scrollWidth > e.clientWidth + 2).length;
      const yatay = document.documentElement.scrollWidth > window.innerWidth + 2;
      const ustUste = (() => {
        const kartlar = [...document.querySelectorAll(".ac-cards article")].map((e) => e.getBoundingClientRect());
        for (let i = 0; i < kartlar.length; i++) for (let j = i + 1; j < kartlar.length; j++) {
          const a = kartlar[i], c = kartlar[j];
          if (a.left < c.right - 2 && c.left < a.right - 2 && a.top < c.bottom - 2 && c.top < a.bottom - 2) return true;
        }
        return false;
      })();
      return { baslik, bolum, tasan, yatay, ustUste, metin: kok.innerText.length };
    });
    const iyi = olcum.baslik === sayfa && olcum.bolum > 0 && olcum.tasan === 0 && !olcum.yatay && !olcum.ustUste && olcum.metin > 120;
    if (!iyi) { fail++; console.log(`${ad} · ${sayfa} -> ${JSON.stringify(olcum)} SORUN`); }
  }
  console.log(`${ad}: ${SAYFALAR.length} sayfa gezildi, sayfa hatası: ${JSON.stringify(hata)}`);
  if (hata.length) fail++;
  await p.screenshot({ path: `/tmp/admin-${ad}.png` });
  await p.close();
}
console.log(fail ? `SORUN: ${fail}` : "HEPSİ TAMAM");
await b.close();
