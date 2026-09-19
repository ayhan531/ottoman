import { chromium } from "playwright";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
let fail = 0;
for (const [label, ctx] of [
  ["iPhone 390", { viewport:{width:390,height:844}, userAgent:IPHONE, isMobile:true, hasTouch:true }],
  ["iPhone 430", { viewport:{width:430,height:932}, userAgent:IPHONE, isMobile:true, hasTouch:true }],
  ["Android 393", { viewport:{width:393,height:851}, isMobile:true, hasTouch:true }],
  ["Masaüstü 1280", { viewport:{width:1280,height:800} }],
]) {
  const p = await b.newPage(ctx);
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1400);

  const shell = await p.evaluate(() => {
    const s = document.querySelector(".esube").getBoundingClientRect();
    const head = document.querySelector(".esube .ava, .esube .topbar, .esube header");
    const cs = getComputedStyle(document.querySelector(".esube"));
    return {
      ust: Math.round(s.top), alt: Math.round(innerHeight - s.bottom),
      safeTop: getComputedStyle(document.documentElement).getPropertyValue("--safe-top").trim(),
      padUst: cs.paddingTop,
      basligaKadar: head ? Math.round(head.getBoundingClientRect().top - s.top) : null,
    };
  });

  // Ürün Türü kapısı: Al/Sat ekranında Fon ve Halka Arz seçilemez
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][2].click());
  await p.waitForTimeout(1500);
  const kind = {};
  for (const name of ["Fon", "Halka Arz"]) {
    await p.evaluate(() => document.querySelector(".kind-picker")?.click());
    await p.waitForTimeout(400);
    await p.evaluate((n) => {
      const btn = [...document.querySelectorAll(".kind-menu button")].find((x) => x.innerText.trim().startsWith(n));
      btn && btn.click();
    }, name);
    await p.waitForTimeout(800);
    const text = await p.evaluate(() => document.body.innerText);
    const uyari = /referansınız ile iletişime geçiniz/i.test(text);
    await p.evaluate(() => { [...document.querySelectorAll("button")].filter((x) => /^(Tamam|Kapat)$/.test(x.innerText.trim())).forEach((x) => x.click()); });
    await p.waitForTimeout(600);
    const etiket = await p.evaluate(() => document.querySelector(".kind-picker")?.innerText.trim() || "yok");
    kind[name] = `${uyari ? "uyarı" : "UYARI YOK"} / seçili:${etiket.replace(/\s+/g, " ")}`;
    if (!uyari || !/^Hisse/.test(etiket)) fail++;
  }
  if (shell.ust !== 0 || shell.alt !== 0 || shell.safeTop !== "0px" || shell.basligaKadar > 14) fail++;
  console.log(`${label} → kabuk:${JSON.stringify(shell)} ürünTürü:${JSON.stringify(kind)}`);
  await p.close();
}
console.log(fail === 0 ? "HEPSI TEMIZ" : `SORUNLU: ${fail}`);
await b.close();
