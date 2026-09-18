// Dil doğrulaması: seçili dilde ana ekranları çeker.
import { chromium } from "playwright";

const langs = (process.env.LANGS || "1,2,3,4").split(",").map(Number);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });

for (const index of langs) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  await p.evaluate((i) => {
    try { localStorage.setItem("ottoman.lang", String(i)); localStorage.setItem("ottoman.dark", "false"); } catch {}
  }, index);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `shots/lang${index}-home.png` });
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][3].click());
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/lang${index}-portfolio.png` });
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")][4].click());
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/lang${index}-account.png` });
  await p.close();
  console.log("lang", index);
}
await b.close();
