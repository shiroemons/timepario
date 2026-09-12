import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const output = fileURLToPath(new URL("../public/og.png", import.meta.url));
const palettes = {
  day: { face: "#e6f3f8", marks: "#476e82", hand: "#24546c", second: "#b45732" },
  night: { face: "#24364f", marks: "#b5c4d5", hand: "#f4f3e9", second: "#f5b48c" },
  morning: { face: "#fff0cc", marks: "#806440", hand: "#654923", second: "#af512d" },
};

function clock(x, label, period, hour) {
  const colors = palettes[period];
  const ticks = Array.from({ length: 12 }, (_, index) => {
    const angle = (index * Math.PI) / 6;
    const inner = index % 3 === 0 ? 79 : 83;
    return `M ${Math.sin(angle) * inner} ${-Math.cos(angle) * inner} L ${Math.sin(angle) * 89} ${-Math.cos(angle) * 89}`;
  }).join(" ");
  return `<g transform="translate(${x} 373)">
    <g transform="scale(1.28)">
      <circle r="98" fill="${colors.face}" />
      <path d="${ticks}" fill="none" stroke="${colors.marks}" stroke-width="1.4" stroke-linecap="round" />
      <g fill="${colors.marks}" font-size="10" text-anchor="middle">
        <text x="0" y="-63">12</text><text x="68" y="4">3</text>
        <text x="0" y="71">6</text><text x="-68" y="4">9</text>
      </g>
      <g stroke-linecap="round">
        <path d="M 0 4 V -47" transform="rotate(${hour * 30 + 12})" stroke="${colors.hand}" stroke-width="5" />
        <path d="M 0 7 V -65" transform="rotate(144)" stroke="${colors.hand}" stroke-width="3" />
        <path d="M 0 15 V -72" transform="rotate(252)" stroke="${colors.second}" stroke-width="1.2" />
      </g>
      <circle r="4" fill="${colors.hand}" /><circle r="1.5" fill="${colors.second}" />
    </g>
    <text y="174" fill="#d6e2df" font-size="25" font-weight="600" letter-spacing="3" text-anchor="middle">${label}</text>
  </g>`;
}

// 文字盤は共有カード用の固定イラスト。閲覧時点の時刻やライブデータを示さない。
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <style>text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }</style>
  <rect width="1200" height="630" fill="#141d21" />
  <g transform="translate(80 78)" fill="none" stroke="#8fc4ac" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="25" cy="25" r="23" /><path d="M25 11v14l10 7" />
  </g>
  <text x="150" y="123" fill="#f2f6f2" font-size="72" font-weight="650" letter-spacing="-3">TimePario</text>
  <text x="80" y="178" fill="#b1c4c0" font-size="30" letter-spacing="0.1">World clocks, side by side.</text>
  ${clock(210, "UTC", "day", 0)}
  ${clock(600, "TOKYO", "night", 9)}
  ${clock(990, "PACIFIC", "morning", 5)}
</svg>`;

await mkdir(new URL("../public/", import.meta.url), { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<html><body style="margin:0;background:#141d21">${svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: output });
  console.log(`Generated ${output} (1200 × 630)`);
} finally {
  await browser.close();
}
