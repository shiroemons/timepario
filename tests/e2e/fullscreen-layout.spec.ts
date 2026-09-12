import { expect, test } from "@playwright/test";

for (const locale of ["ja-JP", "en-US"]) {
  test.describe(`presentation layout in ${locale}`, () => {
    test.use({ locale });

    for (const [width, height] of [
      [360, 640],
      [1280, 720],
      [1920, 1080],
    ] as const) {
      for (const path of ["/utc", "/utc,jst", "/utc,jst,pst"]) {
        const count = path.split(",").length;
        test(`${count} clocks at ${width}x${height}`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width, height });
          await page.clock.install({ time: new Date("2026-07-01T11:59:00Z") });
          await page.clock.pauseAt(new Date("2026-07-01T12:00:00Z"));
          await page.goto(path);
          if (width === 360 && count === 3) {
            for (const fontSize of [16, 32]) {
              await page.evaluate((size) => {
                document.documentElement.style.fontSize = `${size}px`;
              }, fontSize);
              expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              ).toBe(true);
              for (const button of await page.locator(".header-actions .button").all()) {
                await expect(button).toBeVisible();
              }
              await page.screenshot({
                path: `output/playwright/${testInfo.project.name}-${locale}-360-header-actions-${fontSize === 16 ? 100 : 200}-percent.png`,
                fullPage: true,
              });
            }
            await page.evaluate(() => {
              document.documentElement.style.fontSize = "16px";
            });
          }
          await page.locator("#comparison-base").selectOption("utc");
          await page.locator("#presentation-button").click();
          const app = page.locator("#app");
          const assertLastClockReachable = async () => {
            const lastClock = page.locator(".clock-card").last();
            for (const selector of [".digital-time", ".zone-id[data-comparison]"]) {
              const content = lastClock.locator(selector);
              await content.scrollIntoViewIfNeeded();
              const box = await content.boundingBox();
              expect(box).not.toBeNull();
              if (box) {
                expect(box.x).toBeGreaterThanOrEqual(-1);
                expect(box.y).toBeGreaterThanOrEqual(-1);
                expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
                expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
              }
            }
            await app.evaluate((root) => {
              root.scrollTop = 0;
            });
          };
          await expect(app).toHaveClass(/is-presentation/);
          await expect(page.locator(".clock-card")).toHaveCount(count);
          await expect(page.locator(".app-header")).toBeHidden();
          await expect(page.locator(".workspace-heading")).toBeHidden();
          await expect(page.locator(".workspace-meta")).toBeHidden();
          const comparisons = page.locator(".zone-id[data-comparison]");
          await expect(comparisons).toHaveCount(count);
          for (const comparison of await comparisons.all()) await expect(comparison).toBeVisible();
          const geometry = await app.evaluate((root) => ({
            width: root.clientWidth,
            height: root.clientHeight,
            scrollWidth: root.scrollWidth,
            scrollHeight: root.scrollHeight,
            cards: [...root.querySelectorAll(".clock-card")].map((card) => {
              const box = card.getBoundingClientRect();
              const parts = [".analog-clock", ".digital-time", ".clock-date", ".clock-context"].map(
                (selector) => {
                  const part = card.querySelector(selector)?.getBoundingClientRect();
                  return part ? { left: part.left, right: part.right } : null;
                },
              );
              return { left: box.left, right: box.right, bottom: box.bottom, parts };
            }),
          }));
          expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
          if (width > 640) expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.height);
          for (const card of geometry.cards) {
            if (width > 640) expect(card.bottom).toBeLessThanOrEqual(height);
            for (const part of card.parts) {
              expect(part).not.toBeNull();
              expect(part?.left).toBeGreaterThanOrEqual(card.left - 1);
              expect(part?.right).toBeLessThanOrEqual(card.right + 1);
            }
          }
          await page.clock.runFor(3200);
          await assertLastClockReachable();
          await page.screenshot({
            path: `output/playwright/${testInfo.project.name}-${locale}-${width}-fullscreen-${count}.png`,
            fullPage: true,
          });
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "32px";
          });
          expect(await app.evaluate((root) => root.scrollWidth <= root.clientWidth)).toBe(true);
          await assertLastClockReachable();
          await page.screenshot({
            path: `output/playwright/${testInfo.project.name}-${locale}-${width}-fullscreen-${count}-text-200-percent.png`,
            fullPage: true,
          });
        });
      }
    }
  });
}
