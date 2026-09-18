import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
for (const w of [360, 375, 414]) {
  const p = await b.newPage({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 });
  await p.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  await p.evaluate(() => { try { localStorage.setItem("ottoman.dark", "false"); } catch {} });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  await p.evaluate(() => [...document.querySelectorAll(".navbar button")].find((x) => x.textContent.includes("Portföy")).click());
  await p.waitForTimeout(700);
  await p.screenshot({ path: `shots/narrow-${w}.png` });
  await p.close();
}
await b.close();
console.log("ok");
