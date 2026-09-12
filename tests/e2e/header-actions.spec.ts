import { expect, test } from "@playwright/test";

for (const locale of ["ja-JP", "en-US"]) {
  test.describe(`header action feedback in ${locale}`, () => {
    test.use({ locale });

    for (const width of [360, 1280]) {
      test(`copy feedback keeps the layout stable at ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: width === 360 ? 640 : 720 });
        await page.addInitScript(() => {
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText: async () => {} },
          });
        });
        await page.clock.install({ time: new Date("2026-07-01T11:59:00Z") });
        await page.clock.pauseAt(new Date("2026-07-01T12:00:00Z"));
        await page.goto("/utc,jst,pst");
        const copy = page.locator("#share-button");
        const buttons = page.locator(".header-actions .button");
        for (const fontSize of [16, 32]) {
          await page.evaluate((size) => {
            document.documentElement.style.fontSize = `${size}px`;
          }, fontSize);
          await expect(copy).toHaveText(locale === "ja-JP" ? "リンクをコピー" : "Copy link");
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          const before = await buttons.evaluateAll((nodes) =>
            nodes.map((node) => {
              const box = node.getBoundingClientRect();
              return { x: box.x, y: box.y, width: box.width, height: box.height };
            }),
          );
          const imagePrefix = `output/playwright/${testInfo.project.name}-${locale}-${width}-header-${fontSize === 16 ? 100 : 200}`;
          await page.screenshot({ path: `${imagePrefix}-default.png`, fullPage: true });
          await page.locator("#presentation-button").hover();
          await page.locator("#fullscreen-button").focus();
          await page.screenshot({ path: `${imagePrefix}-hover-focus.png`, fullPage: true });
          await copy.click();
          await expect(copy).toHaveAttribute("data-copy-state", "success");
          await expect(copy).toHaveText(locale === "ja-JP" ? "コピーしました" : "Link copied");
          const after = await buttons.evaluateAll((nodes) =>
            nodes.map((node) => {
              const box = node.getBoundingClientRect();
              return { x: box.x, y: box.y, width: box.width, height: box.height };
            }),
          );
          expect(after).toHaveLength(3);
          for (let index = 0; index < after.length; index++) {
            for (const property of ["x", "y", "width", "height"] as const) {
              expect(
                Math.abs((after[index]?.[property] ?? 0) - (before[index]?.[property] ?? 0)),
              ).toBeLessThanOrEqual(1);
            }
          }
          await page.screenshot({ path: `${imagePrefix}-copied.png`, fullPage: true });
          await page.clock.runFor(2100);
          await expect(copy).toHaveText(locale === "ja-JP" ? "リンクをコピー" : "Copy link");
        }
      });
    }
  });
}
