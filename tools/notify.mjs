import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
p.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await p.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
await p.evaluate(() => [...document.querySelectorAll(".navbar button")][4].click());
await p.waitForTimeout(700);
await p.locator('.list-row:has-text("Bildirim ayarları")').click();
await p.waitForTimeout(800);
await p.screenshot({ path: "shots/18-notify.png" });
await p.locator(".page-head button").click();
await p.waitForTimeout(600);
await p.locator('.list-row:has-text("Kişisel bilgiler")').click();
await p.waitForTimeout(700);
await p.screenshot({ path: "shots/14-personal.png" });
await b.close();
console.log("ok");
