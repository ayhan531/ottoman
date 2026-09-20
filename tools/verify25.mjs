import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
let fail = 0;

// 1) Müşteri düzenleyici: kimlik bölümü, şifre alanı, bakiye/pozisyon formları
{
  const p = await b.newPage({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
  const hata = []; p.on("pageerror", (e) => hata.push(String(e).slice(0, 160)));
  await p.route("**/*", (r) => (/127\.0\.0\.1|localhost/.test(r.request().url()) ? r.continue() : r.abort()));
  await p.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => { try { localStorage.setItem("ottoman.install-hint","true"); localStorage.setItem("ottoman.push-asked","true"); } catch {} });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1600);
  await p.evaluate(() => [...document.querySelectorAll("button")].find(x=>x.getAttribute("title")==="Admin")?.click());
  await p.waitForTimeout(1600);
  await p.evaluate(() => document.querySelector(".ac-menu-btn")?.click());
  await p.waitForTimeout(250);
  await p.evaluate(() => [...document.querySelectorAll(".ac-drawer-group button")].find(x=>(x.querySelector("span")?.textContent||"").trim()==="Kullanıcılar")?.click());
  await p.waitForTimeout(700);
  const supheliRozet = await p.evaluate(() => [...document.querySelectorAll(".ac-rozet.kirmizi")].length);
  // Şüpheli T.C. süzgeci
  await p.evaluate(() => [...document.querySelectorAll(".ac-chips button")].find(x=>x.textContent.includes("Şüpheli"))?.click());
  await p.waitForTimeout(400);
  const suzulmus = await p.evaluate(() => document.querySelectorAll(".ac-list .ac-line").length);
  await p.evaluate(() => [...document.querySelectorAll(".ac-chips button")].find(x=>x.textContent.trim()==="Hepsi")?.click());
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector(".ac-list .ac-line")?.click());
  await p.waitForTimeout(900);
  const editor = await p.evaluate(() => {
    const k = document.querySelector(".ac-editor");
    if (!k) return null;
    const metin = k.innerText;
    const tasan = [...k.querySelectorAll(".ac-section,.ac-line,.ac-field,.ac-stats article")].filter(e=>e.scrollWidth>e.clientWidth+2).length;
    return { bolumler: [...k.querySelectorAll(".ac-section h3")].map(x=>x.textContent.trim()), tcVar: /T\.C\./.test(metin), sifreVar: /Şifreyi değiştir/.test(metin), tasan };
  });
  const iyi = editor && editor.tcVar && editor.sifreVar && editor.tasan === 0 && supheliRozet >= 1 && suzulmus === 1 && !hata.length;
  if (!iyi) fail++;
  console.log(`Müşteri düzenleyici -> ${JSON.stringify({ supheliRozet, suzulmus, ...editor })} hata:${JSON.stringify(hata)} ${iyi ? "TAMAM" : "SORUN"}`);
  await p.screenshot({ path: "/tmp/a-editor.png" });
  await p.close();
}

console.log(fail ? `SORUN: ${fail}` : "HEPSİ TAMAM");
await b.close();
