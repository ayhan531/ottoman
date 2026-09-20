import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const TELEGRAM = "Mozilla/5.0 (Linux; Android 14; SM-S911B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36";
const IOS_IG = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Instagram 320.0.0";
let fail = 0;
const yerel = (p) => p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
const hazir = async (p, url = "http://127.0.0.1:4173") => {
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1700);
};

// 1) Haber satırları: fotoğraflı, taşma yok, meta satırı var
for (const [ad, w, h] of [["telefon", 393, 851], ["tablet", 820, 1180], ["masaüstü", 1440, 900]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500, userAgent: ANDROID });
  const hata = []; p.on("pageerror", e => hata.push(String(e).slice(0, 140)));
  await yerel(p); await hazir(p);
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][1]?.click());
  await p.waitForTimeout(1600);
  const haber = await p.evaluate(() => {
    const satirlar = [...document.querySelectorAll(".nrow")];
    const olc = (r) => { const im = r.querySelector(".nthumb img"); const k = r.getBoundingClientRect();
      const bas = r.querySelector("h3"); const meta = r.querySelector(".nmeta");
      return { foto: r.classList.contains("nrow-foto"), gorsel: im ? Math.round(im.getBoundingClientRect().width) : 0,
        yuk: Math.round(k.height), meta: meta ? meta.textContent.trim().length : 0,
        tasma: bas ? bas.scrollWidth > bas.clientWidth + 1 : false,
        genisTasma: r.scrollWidth > r.clientWidth + 1 };
    };
    const t = satirlar.map(olc);
    return { satir: t.length, fotolu: t.filter(x => x.foto).length, gorselGen: [...new Set(t.map(x => x.gorsel))],
      metasiz: t.filter(x => x.meta === 0).length, tasan: t.filter(x => x.tasma || x.genisTasma).length,
      yuk: [...new Set(t.map(x => x.yuk))].sort((a, b) => a - b) };
  });
  const iyi = haber.satir > 0 && haber.fotolu === haber.satir && haber.tasan === 0 && haber.metasiz === 0 && !hata.length;
  if (!iyi) fail++;
  console.log(`Haber ${ad} -> ${JSON.stringify(haber)} hata:${JSON.stringify(hata)} ${iyi ? "TAMAM" : "SORUN"}`);
  await p.screenshot({ path: `/tmp/news-${ad}.png` });
  await p.close();
}

// 2) Bozuk görsel -> işarete düşüyor mu
{
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, userAgent: ANDROID });
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (/icon-192\.png/.test(u)) return r.abort();            // görseller gelmiyor gibi davran
    return /127\.0\.0\.1|localhost/.test(u) ? r.continue() : r.abort();
  });
  await hazir(p);
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][1]?.click());
  await p.waitForTimeout(1800);
  const d = await p.evaluate(() => {
    const s = [...document.querySelectorAll(".nrow")];
    return { satir: s.length, isaretli: s.filter(x => x.querySelector(".nmark")).length, bosKare: s.filter(x => x.querySelector(".nthumb")).length };
  });
  const iyi = d.satir > 0 && d.isaretli === d.satir && d.bosKare === 0;
  if (!iyi) fail++;
  console.log(`Görsel gelmezse -> ${JSON.stringify(d)} ${iyi ? "TAMAM" : "SORUN"}`);
  await p.close();
}

// 3) Telegram içi (Android WebView): kurulum ekranı tarayıcıya çıkış düğmesi veriyor mu.
// Chromium tanımadığı şemayı açmaz ama konsola yazar; şemayı oradan doğruluyoruz.
for (const [ad, ua, beklenen] of [["Telegram/Android", TELEGRAM, /intent:\/\//], ["Instagram/iOS", IOS_IG, /x-safari-http/]]) {
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, userAgent: ua });
  await yerel(p);
  const kayit = [];
  p.on("console", (m) => kayit.push(m.text().slice(0, 200)));
  p.on("framenavigated", (f) => kayit.push("nav:" + f.url().slice(0, 120)));
  await hazir(p, "http://127.0.0.1:4173/?kur=1");
  await p.waitForTimeout(1400);
  const durum = await p.evaluate(() => ({
    acik: Boolean(document.querySelector(".overlay .sheet-panel")),
    dugmeler: [...document.querySelectorAll(".overlay .btn")].map(x => x.textContent.trim()),
    baglanti: document.querySelector(".overlay a.btn")?.getAttribute("href") || "",
  }));
  const ilk = await p.$(".overlay .btn");
  if (ilk) await ilk.click();
  await p.waitForTimeout(2200);
  const iyi = durum.acik && durum.dugmeler.length >= 2 && beklenen.test(durum.baglanti);
  if (!iyi) fail++;
  console.log(`${ad} -> ${JSON.stringify(durum).slice(0, 320)} iz:${JSON.stringify(kayit.filter(t => /intent|safari|chrome|kur=1/i.test(t)).slice(0, 3))} ${iyi ? "TAMAM" : "SORUN"}`);
  await p.close();
}

console.log(fail ? `SORUN: ${fail}` : "HEPSİ TAMAM");
await b.close();
