// Ekran görüntüsü alıcı: yerel mock sunucudan sayfa sayfa görüntü üretir.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:4173";
const OUT = "shots";
fs.mkdirSync(OUT, { recursive: true });

const width = Number(process.env.W || 390);
const height = Number(process.env.H || 844);
const theme = process.env.THEME || "light";
const only = process.env.ONLY || "";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });

page.on("pageerror", (error) => console.log("PAGE ERROR:", error.message));
page.on("console", (message) => { if (message.type() === "error") console.log("CONSOLE:", message.text()); });

await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate((mode) => {
  try { localStorage.setItem("ottoman.dark", JSON.stringify(mode === "dark")); } catch {}
}, theme);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const shot = async (name) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
};

const tap = async (selector, index = 0) => {
  const items = page.locator(selector);
  if (await items.count() > index) { await items.nth(index).click(); await page.waitForTimeout(500); return true; }
  console.log("missing:", selector, index);
  return false;
};

const nav = async (label) => tap(`.navbar button:has-text("${label}")`);

const steps = {
  async home() { await shot("01-home"); },
  async homeTabs() {
    await tap('.mseg button:has-text("BIST 100")');
    await shot("02-bist100");
    await tap('.mseg button:has-text("BIST 30")');
    await shot("03-bist30");
    await tap('.mseg button:has-text("Fonlar")');
    await shot("04-fonlar");
    await tap('.mseg button:has-text("Döviz")');
    await shot("05-doviz");
    await tap('.mseg button:has-text("BIST Tüm")');
  },
  async trade() {
    await tap(".inst-row", 0);
    await shot("06-trade-dialog");
    await page.keyboard.press("Escape");
  },
  async news() { await nav("Haberler"); await shot("07-news"); },
  async portfolio() {
    await nav("Portföy");
    await shot("08-portfolio");
    await tap(".pf-dots i", 1);
    await shot("09-portfolio-returns");
    await tap('.pf-tabs button:has-text("Emirler")');
    await shot("10-portfolio-orders");
    await tap('.pf-tabs button:has-text("Geçmiş")');
    await shot("11-portfolio-history");
    await tap('.pf-tabs button:has-text("Pozisyonlar")');
    await tap(".inst-row.holding", 0);
    await shot("12-position-sheet");
    await page.keyboard.press("Escape");
  },
  async account() {
    await nav("Hesap");
    await shot("13-account");
    await tap('.list-row:has-text("Kişisel bilgiler")');
    await shot("14-personal");
    await tap(".page-head button");
    await tap('.list-row:has-text("Güvenlik")');
    await shot("15-security");
    await tap(".page-head button");
    await tap('.list-row:has-text("Sözleşmeler")');
    await shot("16-contracts");
    await tap(".contract-row", 0);
    await shot("17-document");
    await tap(".page-head button");
    await tap(".page-head button");
    await tap('.list-row:has-text("Bildirim ayarları")');
    await shot("18-notify");
    await tap(".page-head button");
  },
  async profile() {
    await nav("Ana Sayfa");
    await tap(".brandbar .ava");
    await shot("19-profile-menu");
    await tap('.menu-row:has-text("Ayarlar")');
    await shot("20-settings");
    await tap('.srow:has-text("Renk modu")');
    await shot("21-accents");
    await page.keyboard.press("Escape");
    await tap(".page-head button");
  },
  async notifications() {
    await nav("Ana Sayfa");
    await tap('.brandbar-actions button[aria-label="Bildirimler"]');
    await shot("22-notifications");
    await page.keyboard.press("Escape");
  },
  async quickTrade() {
    await nav("Ana Sayfa");
    await tap('.navbar button:has-text("Al/Sat")');
    await shot("23-quicktrade");
    await page.keyboard.press("Escape");
  },
};

for (const [name, run] of Object.entries(steps)) {
  if (only && !only.split(",").includes(name)) continue;
  try { await run(); } catch (error) { console.log("step failed", name, error.message); }
}

await browser.close();
