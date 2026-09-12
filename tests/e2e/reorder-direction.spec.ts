import { expect, test } from "@playwright/test";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`reorder arrows follow the card layout with motion ${reducedMotion}`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/utc,jst,pst");
    await expect(page.locator(".clock-card")).toHaveCount(3);
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: width === 360 ? 640 : 720 });
      const cards = await page.locator(".clock-card").evaluateAll((nodes) =>
        nodes.map((node) => {
          const box = node.getBoundingClientRect();
          return { x: box.x, y: box.y };
        }),
      );
      const axis = width === 360 ? "y" : "x";
      expect(cards[1]?.[axis]).toBeGreaterThan(cards[0]?.[axis] ?? 0);
      for (const action of ["earlier", "later"]) {
        const arrow = page.locator(`.clock-card`).nth(1).locator(`[data-action="${action}"] path`);
        const points = await arrow.evaluate((node) => {
          const path = node as SVGPathElement;
          const matrix = path.getScreenCTM();
          if (!matrix) throw new Error("Arrow is not rendered on screen.");
          const length = path.getTotalLength();
          return [0, length / 2, length].map((distance) => {
            const point = path.getPointAtLength(distance).matrixTransform(matrix);
            return { x: point.x, y: point.y };
          });
        });
        const tail = ((points[0]?.[axis] ?? 0) + (points[2]?.[axis] ?? 0)) / 2;
        const tip = points[1]?.[axis] ?? 0;
        if (action === "earlier") expect(tip).toBeLessThan(tail - 1);
        else expect(tip).toBeGreaterThan(tail + 1);
      }
      if (width === 360) {
        await page.screenshot({
          path: `output/playwright/${testInfo.project.name}-360-reorder-arrows-${reducedMotion}.png`,
          fullPage: true,
        });
      }
    }
  });
}
