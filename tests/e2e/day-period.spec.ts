import { expect, test } from "@playwright/test";

function contrast(first: string, second: string): number {
  function luminance(color: string): number {
    const channels = color
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number);
    if (channels?.length !== 3) throw new Error(`Unexpected color: ${color}`);
    return channels.reduce((sum, channel, index) => {
      const value = channel / 255;
      const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      return sum + linear * ([0.2126, 0.7152, 0.0722][index] ?? 0);
    }, 0);
  }
  const values = [luminance(first), luminance(second)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

for (const locale of ["en-US", "ja-JP"]) {
  test.describe(`local day periods in ${locale}`, () => {
    test.use({ locale });

    for (const width of [360, 1280]) {
      for (const scene of [
        {
          name: "day-periods",
          now: "2026-07-01T12:00:00Z",
          path: "/jst,pt,utc",
          periods: ["night", "morning", "day"],
          en: ["Night", "Morning", "Day"],
          ja: ["夜", "朝", "昼"],
        },
        {
          name: "late-night",
          now: "2026-07-01T12:00:00Z",
          path: "/utc,jst,pst",
          periods: ["day", "night", "lateNight"],
          en: ["Day", "Night", "Late night"],
          ja: ["昼", "夜", "深夜"],
        },
        {
          name: "evening",
          now: "2026-07-01T16:00:00Z",
          path: "/utc,jst,pst",
          periods: ["evening", "lateNight", "morning"],
          en: ["Evening", "Late night", "Morning"],
          ja: ["夕方", "深夜", "朝"],
        },
      ]) {
        test(`${scene.name} stays readable at ${width}px`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width, height: width === 360 ? 640 : 720 });
          await page.clock.install({ time: new Date(new Date(scene.now).getTime() - 60_000) });
          await page.clock.pauseAt(new Date(scene.now));
          await page.goto(scene.path);
          await expect(page.locator(".day-period")).toHaveText(
            locale === "ja-JP" ? scene.ja : scene.en,
          );
          const periods = await page.locator(".clock-card").evaluateAll((cards) =>
            cards.map((card) => {
              const face = card.querySelector(".face");
              const hand = card.querySelector(".hand-hour");
              const numeral = card.querySelector(".numeral");
              return {
                name: card.getAttribute("data-period"),
                fill: face ? getComputedStyle(face).fill : "",
                hand: hand ? getComputedStyle(hand).stroke : "",
                numeral: numeral ? getComputedStyle(numeral).fill : "",
                bottom: card.getBoundingClientRect().bottom,
              };
            }),
          );
          expect(periods.map((period) => period.name)).toEqual(scene.periods);
          expect(new Set(periods.map((period) => period.fill)).size).toBe(3);
          for (const period of periods) {
            expect(contrast(period.fill, period.hand)).toBeGreaterThanOrEqual(3);
            expect(contrast(period.fill, period.numeral)).toBeGreaterThanOrEqual(4.5);
            expect(period.bottom).toBeLessThanOrEqual(width === 360 ? 640 : 720);
          }
          await page.screenshot({
            path: `output/playwright/${testInfo.project.name}-${locale}-${width}-${scene.name}.png`,
            fullPage: true,
          });
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "32px";
          });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          await page.screenshot({
            path: `output/playwright/${testInfo.project.name}-${locale}-${width}-${scene.name}-text-200-percent.png`,
            fullPage: true,
          });
        });
      }
    }
  });
}

for (const { before, after, from, to } of [
  {
    before: "2026-07-01T14:59:59Z",
    after: "2026-07-01T15:00:00Z",
    from: "night",
    to: "lateNight",
  },
  {
    before: "2026-07-01T19:59:59Z",
    after: "2026-07-01T20:00:00Z",
    from: "lateNight",
    to: "morning",
  },
  {
    before: "2026-07-01T02:59:59Z",
    after: "2026-07-01T03:00:00Z",
    from: "morning",
    to: "day",
  },
  {
    before: "2026-07-01T06:59:59Z",
    after: "2026-07-01T07:00:00Z",
    from: "day",
    to: "evening",
  },
  {
    before: "2026-07-01T09:59:59Z",
    after: "2026-07-01T10:00:00Z",
    from: "evening",
    to: "night",
  },
]) {
  test(`face changes from ${from} to ${to} at the local boundary`, async ({ page }) => {
    await page.clock.install({ time: new Date(new Date(before).getTime() - 60_000) });
    await page.clock.pauseAt(new Date(before));
    await page.goto("/jst");
    await expect(page.locator(".clock-card")).toHaveAttribute("data-period", from);
    const previousFill = await page
      .locator(".face")
      .evaluate((face) => getComputedStyle(face).fill);
    await page.clock.runFor(new Date(after).getTime() - new Date(before).getTime());
    await expect(page.locator(".clock-card")).toHaveAttribute("data-period", to);
    const nextFill = await page.locator(".face").evaluate((face) => getComputedStyle(face).fill);
    expect(nextFill).not.toBe(previousFill);
  });
}

test("unknown server clock does not claim a local day period", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:8787/jst,pt,utc");
    await expect(page.locator(".digital-time")).toHaveText(["--:--:--", "--:--:--", "--:--:--"]);
    await expect(page.locator(".clock-card[data-period]")).toHaveCount(0);
    await expect(page.locator(".day-period")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
