// Yazı boyutu doğrulaması: Küçük / Orta / Büyük ölçeklerde ana ekranları çeker ve taşma arar.
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });

for (const size of [0, 2]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  await p.evaluate((s) => {
    try { localStorage.setItem("ottoman.textSize", String(s)); localStorage.setItem("ottoman.dark", "false"); localStorage.setItem("ottoman.lang", "0"); } catch {}
  }, size);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1200);

  const shot = async (name) => p.screenshot({ path: `shots/ts${size}-${name}.png` });
  await shot("home");
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][3].click());
  await p.waitForTimeout(700);
  await shot("portfolio");
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][4].click());
  await p.waitForTimeout(700);
  await shot("account");
  await p.evaluate(() => document.querySelector(".navbar button:nth-child(1)").click());
  await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector(".inst-row").click());
  await p.waitForTimeout(700);
  await shot("trade");

  // yatay taşma kontrolü
  const overflow = await p.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll(".esube *, .overlay *")) {
      if (el.scrollWidth - el.clientWidth > 2 && getComputedStyle(el).overflowX === "visible") {
        bad.push(`${el.className || el.tagName} (+${el.scrollWidth - el.clientWidth}px)`);
      }
    }
    return { docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, bad: bad.slice(0, 12) };
  });
  console.log("textSize", size, JSON.stringify(overflow));
  await p.close();
}
await b.close();
