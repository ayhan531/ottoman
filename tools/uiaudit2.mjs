import { chromium } from "playwright";

const OLC = [["320x568",320,568,true],["360x740",360,740,true],["393x851",393,851,true],["430x932",430,932,true],["768x1024",768,1024,false],["1280x900",1280,900,false]];

const DENETIM = () => {
  const bulgu = [];
  const kok = document.documentElement;
  const sayfaTasma = Math.round(kok.scrollWidth - kok.clientWidth);
  if (sayfaTasma > 1) bulgu.push({ tip: "sayfa-yatay-tasma", px: sayfaTasma });

  const gorunur = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05;
  };

  const hepsi = [...document.querySelectorAll("body *")].filter((el) => el.getClientRects().length && gorunur(el));

  for (const el of hepsi) {
    const cs = getComputedStyle(el);
    // 1) Yazı kırpılması: kutu içeriğinden dar ve taşma gizli
    const yatayTasma = Math.round(el.scrollWidth - el.clientWidth);
    const metin = (el.textContent || "").trim();
    if (yatayTasma > 1 && metin && el.children.length === 0
        && !/auto|scroll/.test(cs.overflowX) && cs.textOverflow !== "ellipsis"
        && cs.whiteSpace !== "nowrap") {
      bulgu.push({ tip: "yazi-kirpilmis", px: yatayTasma, sinif: el.className?.toString().slice(0, 40), metin: metin.slice(0, 40) });
    }
    // 2) Ebeveynin dışına taşma
    const ebeveyn = el.parentElement;
    const kirpanVar = (() => {
      let ust = el.parentElement;
      while (ust && ust !== document.body) {
        if (/auto|scroll|hidden/.test(getComputedStyle(ust).overflowX)) return true;
        ust = ust.parentElement;
      }
      return false;
    })();
    if (ebeveyn && ebeveyn !== document.body && !kirpanVar) {
      const pcs = getComputedStyle(ebeveyn);
      if (!/auto|scroll|hidden/.test(pcs.overflowX) && pcs.position !== "relative") {
        const r = el.getBoundingClientRect(), pr = ebeveyn.getBoundingClientRect();
        const sag = Math.round(r.right - pr.right);
        if (sag > 2 && cs.position === "static" && pr.width > 0) {
          bulgu.push({ tip: "ebeveyn-disina-tasma", px: sag, sinif: el.className?.toString().slice(0, 40) });
        }
      }
    }
  }

  // 3) Dikey akıştaki kardeşlerin üst üste binmesi
  const kaplar = [...document.querySelectorAll(".page, .sheet-panel, .dialog-panel, .auth-form2, .ac-form, .tl-sheet, .bk-card")];
  for (const kap of kaplar) {
    const cocuklar = [...kap.children].filter((el) => el.getClientRects().length && gorunur(el) && getComputedStyle(el).position === "static");
    for (let i = 0; i + 1 < cocuklar.length; i += 1) {
      const a = cocuklar[i].getBoundingClientRect(), b = cocuklar[i + 1].getBoundingClientRect();
      const binme = Math.round(a.bottom - b.top);
      if (binme > 2 && a.height > 0 && b.height > 0) {
        bulgu.push({ tip: "ust-uste-binme", px: binme, sinif: `${cocuklar[i].className} + ${cocuklar[i + 1].className}`.slice(0, 50) });
      }
    }
  }
  return bulgu;
};


const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const sorunlar = [];
let sayac = 0;

for (const [olcAd, w, h, mobil] of OLC) {
  const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: mobil, hasTouch: mobil });
  const hata = [];
  p.on("pageerror", (e) => hata.push(String(e).slice(0, 120)));
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.clear(); localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1400);

  const bak = async (ad) => {
    sayac += 1;
    const bulgu = await p.evaluate(DENETIM);
    if (bulgu.length) sorunlar.push({ olc: olcAd, ekran: ad, bulgu: bulgu.slice(0, 6) });
  };

  // Admin konsolu
  await p.evaluate(() => document.querySelector('button[title="Admin"]')?.click());
  await p.waitForTimeout(1500);
  for (const sekme of ["Özet", "Müşteriler", "Emirler", "Para", "Bankalar", "Belgeler", "Sistem"]) {
    await p.evaluate((s) => [...document.querySelectorAll(".admin-tabs button")].find(x => x.innerText.trim() === s)?.click(), sekme);
    await p.waitForTimeout(450);
    await bak("admin:" + sekme);
  }
  // Banka düzenleme kutusu
  await p.evaluate(() => [...document.querySelectorAll(".admin-tabs button")].find(x => x.innerText.trim() === "Bankalar")?.click());
  await p.waitForTimeout(450);
  await p.evaluate(() => document.querySelector(".bk-duzenle")?.click());
  await p.waitForTimeout(600);
  await bak("admin:banka-duzenle");
  await p.evaluate(() => [...document.querySelectorAll(".bk-modal .ac-ghost")].find(x => x.innerText.trim() === "İptal")?.click());
  await p.waitForTimeout(400);
  // Müşteri kartı
  await p.evaluate(() => [...document.querySelectorAll(".admin-tabs button")].find(x => x.innerText.trim() === "Müşteriler")?.click());
  await p.waitForTimeout(450);
  await p.evaluate(() => document.querySelectorAll(".ac-list .ac-line")[0]?.click());
  await p.waitForTimeout(900);
  await bak("admin:musteri-karti");
  await p.close();
}

// Tanıtım sayfası ve giriş/kayıt (oturumsuz)
for (const [olcAd, w, h, mobil] of OLC) {
  const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: mobil, hasTouch: mobil });
  const hata = [];
  p.on("pageerror", (e) => hata.push(String(e).slice(0, 120)));
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1400);
  sayac += 1;
  let bulgu = await p.evaluate(DENETIM);
  if (bulgu.length) sorunlar.push({ olc: olcAd, ekran: "tanitim", bulgu: bulgu.slice(0, 6) });

  await p.evaluate(() => [...document.querySelectorAll("button,a")].find(x => /E-Şube Giriş/.test(x.innerText))?.click());
  await p.waitForTimeout(1400);
  sayac += 1;
  bulgu = await p.evaluate(DENETIM);
  if (bulgu.length) sorunlar.push({ olc: olcAd, ekran: "giris", bulgu: bulgu.slice(0, 6) });

  await p.evaluate(() => [...document.querySelectorAll(".auth-tabs button")].find(x => x.innerText.trim() === "Hesap Oluştur")?.click());
  await p.waitForTimeout(700);
  await p.evaluate(() => { const s = document.querySelector(".auth-field select"); if (s) { s.value = "İstanbul"; s.dispatchEvent(new Event("change", { bubbles: true })); } });
  await p.waitForTimeout(600);
  sayac += 1;
  bulgu = await p.evaluate(DENETIM);
  if (bulgu.length) sorunlar.push({ olc: olcAd, ekran: "kayit", bulgu: bulgu.slice(0, 6) });
  if (hata.length) sorunlar.push({ olc: olcAd, ekran: "js", bulgu: hata });
  await p.close();
}

console.log("Denetlenen ekran:", sayac);
if (!sorunlar.length) console.log("HIC SORUN YOK");
else console.log(JSON.stringify(sorunlar, null, 1).slice(0, 2500));
await b.close();
