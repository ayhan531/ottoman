// Admin paneli doğrulaması: panel açılır, kullanıcı kartı ve işlem geçmişi çekilir.
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 });
p.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text()); });

await p.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
await p.evaluate(() => { try { localStorage.setItem("ottoman.dark", "false"); localStorage.setItem("ottoman.lang", "0"); } catch {} });
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1200);

const admin = p.locator('.brandbar-actions button[title="Admin"]');
if (await admin.count()) {
  await admin.click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "shots/admin-1.png" });
  const user = p.locator(".admin-user-row").first();
  if (await user.count()) {
    await user.click();
    await p.waitForTimeout(1500);
    await p.screenshot({ path: "shots/admin-2.png" });
  } else {
    console.log("kullanıcı satırı yok");
  }
  const sys = p.locator('.admin-tabs button:has-text("Sistem")');
  if (await sys.count()) {
    await p.keyboard.press("Escape");
    await p.locator('.trade-modal .close, .admin-profile .confirm').first().click().catch(() => {});
    await p.waitForTimeout(400);
    await sys.click();
    await p.waitForTimeout(700);
    await p.screenshot({ path: "shots/admin-3.png" });
  }
} else {
  console.log("Admin düğmesi görünmedi");
}
await b.close();
console.log("ok");
