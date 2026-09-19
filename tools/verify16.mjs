import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
let fail = 0;
for (const [label, opts] of [
  ["Android 393", { viewport:{width:393,height:851}, isMobile:true, hasTouch:true }],
  ["Masaüstü 1280", { viewport:{width:1280,height:800} }],
]) {
  const ctx = await b.newContext(opts);
  await ctx.grantPermissions(["notifications"], { origin: "http://127.0.0.1:4173" });
  const p = await ctx.newPage();
  const hatalar = [];
  p.on("pageerror", (e) => hatalar.push(String(e).slice(0, 140)));
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1800);

  // Manifest ve servis çalışanı
  const temel = await p.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]')?.href || "";
    const man = link ? await fetch(link).then(r => r.json()).catch(() => null) : null;
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      manifest: man ? { ad: man.name, gorunum: man.display, baslangic: man.start_url, simge: man.icons.length } : "yok",
      apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href") || "yok",
      sw: reg ? "kayitli" : "yok",
    };
  });

  // Bildirim ayarları → cihaz bildirimi aç
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][4]?.click());
  await p.waitForTimeout(900);
  await p.evaluate(() => [...document.querySelectorAll("button")].find(x => x.innerText.trim().startsWith("Bildirim"))?.click());
  await p.waitForTimeout(900);
  const once = await p.evaluate(() => (document.body.innerText.match(/Cihaz Bildirimleri\n([^\n]*)/) || [])[1] || "");
  const abonelik = [];
  p.on("request", (r) => { if (r.url().includes("/api/push/")) abonelik.push(r.method() + " " + new URL(r.url()).pathname); });
  await p.evaluate(() => {
    const satir = [...document.querySelectorAll("*")].find(x => x.children.length === 0 && x.textContent.trim() === "Cihaz Bildirimleri");
    satir?.closest(".srow, .sec-row, div")?.querySelector("button, .toggle, [role=switch]")?.click();
  });
  await p.waitForTimeout(2500);
  const sonra = await p.evaluate(() => (document.body.innerText.match(/Cihaz Bildirimleri\n([^\n]*)/) || [])[1] || "");
  const izin = await p.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return { izin: Notification.permission, abone: sub ? "var" : "yok" };
  });

  if (temel.sw !== "kayitli" || temel.manifest === "yok" || hatalar.length) fail++;
  console.log(`${label} → ${JSON.stringify(temel)} once:"${once}" sonra:"${sonra}" ${JSON.stringify(izin)} istek:${JSON.stringify(abonelik)} hata:${JSON.stringify(hatalar)}`);
  await ctx.close();
}
console.log(fail === 0 ? "HEPSI TEMIZ" : `SORUNLU: ${fail}`);
await b.close();
