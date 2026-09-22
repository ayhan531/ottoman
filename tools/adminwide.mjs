import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
await p.evaluate(() => { try { localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForTimeout(1700);
await p.evaluate(() => [...document.querySelectorAll("button")].find(x=>x.getAttribute("title")==="Admin")?.click());
await p.waitForTimeout(1800);
console.log(await p.evaluate(() => ({
  yanGorunur: getComputedStyle(document.querySelector(".ac-yan")).display,
  hamburger: getComputedStyle(document.querySelector(".ac-menu-btn")).display,
  geriDugme: Boolean(document.querySelector(".ac-drawer-geri")),
  altBaslik: document.querySelector(".ac-top-copy small")?.textContent,
})));
await p.screenshot({ path: "/tmp/w-dash.png" });
const git = async (ad, dosya) => {
  await p.evaluate((h) => [...document.querySelectorAll(".ac-drawer-group button")].find(x=>(x.querySelector("span")?.textContent||"").trim()===h)?.click(), ad);
  await p.waitForTimeout(800);
  await p.screenshot({ path: dosya });
};
await git("Bakiye Detayları", "/tmp/w-bakiye.png");
await git("T+2 Takip", "/tmp/w-t2.png");
await git("Onay Bekleyenler", "/tmp/w-onay.png");
await git("Para Yatırma Talepleri", "/tmp/w-yatir.png");
await git("Piyasa Kontrolü", "/tmp/w-piyasa.png");
await b.close();
