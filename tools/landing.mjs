import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
for (const [w, h, name] of [[390, 844, "mobile"], [1280, 900, "desktop"]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `shots/landing-${name}.png` });
  const btn = p.locator('button:has-text("E-Şube")').first();
  if (await btn.count()) {
    await btn.click();
    await p.waitForTimeout(700);
    await p.screenshot({ path: `shots/auth-${name}.png` });
  }
  await p.close();
}
await b.close();
console.log("ok");
