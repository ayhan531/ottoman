import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
await p.locator('.navbar button:has-text("Portföy")').click();
await p.waitForTimeout(600);
await p.locator('.inst-row.holding').first().click();
await p.waitForTimeout(700);
const info = await p.evaluate(() => {
  const panel = document.querySelector('.sheet-panel');
  const out = [];
  const walk = (node, depth) => {
    for (const child of node.children) {
      const r = child.getBoundingClientRect();
      out.push(`${"  ".repeat(depth)}${child.tagName}.${child.className}  y=${Math.round(r.top)} h=${Math.round(r.height)}`);
      if (depth < 2) walk(child, depth + 1);
    }
  };
  walk(panel, 0);
  return out.join("\n");
});
console.log(info);
await b.close();
