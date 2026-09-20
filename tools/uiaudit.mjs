import { chromium } from "playwright";

const OLC = [
  ["320x568", 320, 568, true], ["360x740", 360, 740, true], ["375x812", 375, 812, true],
  ["393x851", 393, 851, true], ["430x932", 430, 932, true],
  ["768x1024", 768, 1024, false], ["1024x768", 1024, 768, false], ["1280x900", 1280, 900, false],
];
const YAZI = [0, 1, 2];

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

for (const [olcAd, w, h, mobil] of OLC) {
  for (const yazi of YAZI) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: mobil, hasTouch: mobil });
    const hata = [];
    p.on("pageerror", (e) => hata.push(String(e).slice(0, 120)));
    await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
    await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
    await p.evaluate((ts) => {
      try {
        localStorage.clear();
        localStorage.setItem("ottoman.install-hint", "true");
        localStorage.setItem("ottoman.push-asked", "true");
        localStorage.setItem("ottoman.textSize", String(ts));
      } catch {}
    }, yazi);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1300);

    const ekranlar = [
      ["Ana Sayfa", async () => p.evaluate(() => [...document.querySelectorAll(".navbar button")][0]?.click())],
      ["Haberler", async () => p.evaluate(() => [...document.querySelectorAll(".navbar button")][1]?.click())],
      ["Al/Sat", async () => p.evaluate(() => [...document.querySelectorAll(".navbar button")][2]?.click())],
      ["Portföy", async () => { await p.keyboard.press("Escape"); await p.evaluate(() => [...document.querySelectorAll(".navbar button")][3]?.click()); }],
      ["Hesap", async () => p.evaluate(() => [...document.querySelectorAll(".navbar button")][4]?.click())],
      ["TL Yükle", async () => p.evaluate(() => [...document.querySelectorAll("button")].find((x) => /Para yatır/.test(x.innerText))?.click())],
      ["TL Çek", async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(400); await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => /Para çek/.test(x.innerText))?.click()); }],
      ["Ayarlar", async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(400); await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.innerText.trim().startsWith("Ayarlar"))?.click()); }],
      ["Bildirim", async () => p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.innerText.trim().startsWith("Bildirim"))?.click())],
    ];

    for (const [ad, git] of ekranlar) {
      await git();
      await p.waitForTimeout(420);
      const bulgu = await p.evaluate(DENETIM);
      if (bulgu.length) sorunlar.push({ olc: olcAd, yazi, ekran: ad, bulgu });
    }
    if (hata.length) sorunlar.push({ olc: olcAd, yazi, ekran: "js", bulgu: hata });
    await p.close();
  }
}

console.log(`Denetlenen: ${OLC.length} genişlik × ${YAZI.length} yazı boyu × 9 ekran = ${OLC.length * YAZI.length * 9}`);
if (!sorunlar.length) console.log("HIC SORUN YOK");
else {
  const ozet = {};
  for (const s of sorunlar) for (const x of s.bulgu) {
    const anahtar = `${x.tip || "js"} | ${x.sinif || x.metin || x}`;
    ozet[anahtar] = (ozet[anahtar] || 0) + 1;
  }
  console.log(`SORUN: ${sorunlar.length} ekran-ölçü kombinasyonu`);
  for (const [k, n] of Object.entries(ozet).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${n}x  ${k}`);
  console.log("ilk 3 ornek:", JSON.stringify(sorunlar.slice(0, 3), null, 1).slice(0, 1200));
}
await b.close();
