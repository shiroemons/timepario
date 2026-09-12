import { expect, test } from "@playwright/test";

for (const locale of ["en-US", "ja-JP"]) {
  test.describe(`icon alignment in ${locale}`, () => {
    test.use({ locale });

    for (const width of [360, 1280]) {
      test(`picker UTC offsets align right without overlapping names at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 720 });
        await page.goto("/utc");
        await page.locator("#add-button").click();
        await page.getByRole("searchbox").fill("Pacific");
        const offsets = page.locator(".option-offset");
        expect(await offsets.count()).toBeGreaterThan(1);
        for (const fontSize of [16, 32]) {
          await page.evaluate((size) => {
            document.documentElement.style.fontSize = `${size}px`;
          }, fontSize);
          const rows = await page.locator(".zone-option").evaluateAll((options) =>
            options.map((option) => {
              const content = option.querySelector(".option-content")?.getBoundingClientRect();
              const offset = option.querySelector(".option-offset")?.getBoundingClientRect();
              const row = option.getBoundingClientRect();
              return {
                right: offset?.right,
                inside: offset ? offset.right <= row.right && offset.left >= row.left : false,
                separate:
                  content && offset
                    ? content.right <= offset.left || content.bottom <= offset.top
                    : false,
              };
            }),
          );
          for (const row of rows) {
            expect(row.inside).toBe(true);
            expect(row.separate).toBe(true);
            expect(row.right).toBeDefined();
            expect(Math.abs((row.right ?? 0) - (rows[0]?.right ?? 0))).toBeLessThanOrEqual(1);
          }
          expect(
            await page.evaluate(() => {
              const results = document.querySelector(".zone-results");
              return (
                document.documentElement.scrollWidth <= innerWidth &&
                results !== null &&
                results.scrollWidth <= results.clientWidth
              );
            }),
          ).toBe(true);
        }
      });

      test(`labels and icons share a vertical center at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 720 });
        await page.goto("/utc,jst,pt");
        await expect(page.locator(".zone-change")).toHaveCount(3);

        for (const fontSize of [16, 32]) {
          await page.evaluate((size) => {
            document.documentElement.style.fontSize = `${size}px`;
          }, fontSize);
          const alignment = await page
            .locator(".brand:visible, .button:visible, .zone-change:visible")
            .evaluateAll((controls) =>
              controls.map((control) => {
                const icon = control.querySelector(".ui-icon")?.getBoundingClientRect();
                const label = control
                  .querySelector(".brand-label, .button-label, .zone-label")
                  ?.getBoundingClientRect();
                return {
                  text: control.textContent,
                  offset:
                    icon && label
                      ? Math.abs(icon.y + icon.height / 2 - label.y - label.height / 2)
                      : null,
                };
              }),
            );
          expect(alignment).toHaveLength(8);
          for (const { text, offset } of alignment) {
            expect(offset, `${text}: label and SVG must both exist`).not.toBeNull();
            expect(offset, `${text}: vertical center at ${fontSize}px`).toBeLessThanOrEqual(1);
          }
          const iconOffsets = await page.locator(".icon-button").evaluateAll((buttons) =>
            buttons.map((button) => {
              const box = button.getBoundingClientRect();
              const icon = button.querySelector(".ui-icon")?.getBoundingClientRect();
              return icon ? Math.abs(icon.y + icon.height / 2 - box.y - box.height / 2) : null;
            }),
          );
          expect(iconOffsets.length).toBeGreaterThan(0);
          for (const offset of iconOffsets) {
            expect(offset).not.toBeNull();
            expect(offset).toBeLessThanOrEqual(1);
          }
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
        }
      });
    }
  });
}
