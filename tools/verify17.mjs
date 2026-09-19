import { chromium } from "playwright";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE14 = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1";
const CRIOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
let fail = 0;

const kur = async (ua, url = "http://127.0.0.1:4173") => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua, isMobile: true, hasTouch: true });
  await ctx.grantPermissions(["notifications"], { origin: "http://127.0.0.1:4173" });
  const p = await ctx.newPage();
  const hata = [];
  p.on("pageerror", (e) => hata.push(String(e).slice(0, 120)));
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  return { ctx, p, hata };
};

for (const [ad, ua] of [["iOS 17 Safari", IPHONE], ["iOS 14 Safari", IPHONE14], ["iOS Chrome", CRIOS]]) {
  const { ctx, p, hata } = await kur(ua);
  await p.waitForTimeout(4200);
  const sonuc = await p.evaluate(() => {
    const panel = document.querySelector(".sheet-panel, .dialog-panel");
    const ok = document.querySelector(".ios-pointer");
    const r = ok?.getBoundingClientRect();
    return {
      acildi: Boolean(panel),
      adimlar: [...document.querySelectorAll(".ios-steps li .ios-copy strong")].map((x) => x.textContent),
      okYeri: ok ? (r.top > innerHeight / 2 ? "altta" : "ustte") : "yok",
      safariUyari: /önce Safari'de açın/.test(document.body.innerText),
      tasma: panel ? panel.scrollHeight - panel.clientHeight : null,
    };
  });
  const beklenenOk = ad === "iOS Chrome" ? "yok" : ad === "iOS 14 Safari" ? "ustte" : "altta";
  const iyi = sonuc.acildi && sonuc.adimlar.length === 3 && sonuc.okYeri === beklenenOk
    && sonuc.safariUyari === (ad === "iOS Chrome") && sonuc.tasma <= 1 && !hata.length;
  if (!iyi) fail++;
  console.log(`${ad} -> ${JSON.stringify(sonuc)} ${iyi ? "TAMAM" : "BEKLENEN ok:" + beklenenOk + " hata:" + JSON.stringify(hata)}`);
  await ctx.close();
}

{
  const { ctx, p, hata } = await kur(IPHONE, "http://127.0.0.1:4173/?uygulama=1");
  await p.waitForTimeout(4200);
  const sonuc = await p.evaluate(() => {
    const panel = document.querySelector(".sheet-panel, .dialog-panel");
    return {
      metin: panel?.innerText.replace(/\s+/g, " ").slice(0, 110) || "yok",
      dugme: [...document.querySelectorAll(".sheet-panel button, .dialog-panel button")].map((x) => x.innerText.trim()).filter(Boolean),
      tasma: panel ? panel.scrollHeight - panel.clientHeight : null,
    };
  });
  const iyi = /Bildirim/.test(sonuc.metin) && sonuc.dugme.includes("Bildirimlere izin ver") && !hata.length;
  if (!iyi) fail++;
  console.log(`Ana ekrandan acilis -> ${JSON.stringify(sonuc)} ${iyi ? "TAMAM" : "hata:" + JSON.stringify(hata)}`);
  await ctx.close();
}

console.log(fail === 0 ? "HEPSI TEMIZ" : `SORUNLU: ${fail}`);
await b.close();
