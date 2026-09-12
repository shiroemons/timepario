import { expect, test } from "@playwright/test";

const fixed = new Date("2026-07-01T12:34:56Z");

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(fixed.getTime() - 60_000) });
  await page.clock.pauseAt(fixed);
});

test("comparison is optional, signed and temporary without changing the shared URL", async ({
  page,
}) => {
  await page.goto("/jst,pst,utc");
  const select = page.getByRole("combobox", { name: "Compare with", exact: true });
  await expect(select).toHaveValue("");
  await expect(page.locator(".zone-id")).toHaveText(["Asia/Tokyo", "Etc/GMT+8", "UTC"]);
  const historyLength = await page.evaluate(() => history.length);
  await select.selectOption("jst");
  await expect(page.locator(".zone-id")).toHaveText([
    "Reference ±0 hours",
    "−17 hours vs. reference",
    "−9 hours vs. reference",
  ]);
  await expect(page.locator('[data-zone="utc"] .zone-id')).toHaveAttribute(
    "aria-label",
    "Time difference from Tokyo: −9 hours",
  );
  await expect(page.locator('[data-zone="jst"] .zone-id')).toHaveAttribute("title", "Asia/Tokyo");
  await select.selectOption("pst");
  await expect(page.locator(".zone-id")).toHaveText([
    "+17 hours vs. reference",
    "Reference ±0 hours",
    "+8 hours vs. reference",
  ]);
  await expect(page.locator(".clock-offset")).toHaveText(["UTC+09:00", "UTC−08:00", "UTC+00:00"]);
  await expect(page).toHaveURL(/\/jst,pst,utc$/);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await expect(page.getByRole("button", { name: "Add clock", exact: true })).toBeDisabled();
  await page.reload();
  await expect(select).toHaveValue("");
  await expect(page.locator(".zone-id")).toHaveText(["Asia/Tokyo", "Etc/GMT+8", "UTC"]);
});

test("comparison includes fractional hours and follows a daylight saving transition", async ({
  page,
}) => {
  await page.goto("/jst,Asia~Kathmandu,utc");
  const select = page.getByRole("combobox", { name: "Compare with", exact: true });
  await select.selectOption("Asia~Kathmandu");
  await expect(page.locator(".zone-id")).toHaveText([
    "+3 hours 15 minutes vs. reference",
    "Reference ±0 hours",
    "−5 hours 45 minutes vs. reference",
  ]);
  await page.goto("/utc,pt,pst");
  await page.clock.setSystemTime(new Date("2024-03-10T09:59:59Z"));
  await select.selectOption("pt");
  await expect(page.locator(".zone-id")).toHaveText([
    "+8 hours vs. reference",
    "Reference ±0 hours",
    "±0 hours vs. reference",
  ]);
  await page.clock.runFor(1000);
  await expect(page.locator(".zone-id")).toHaveText([
    "+7 hours vs. reference",
    "Reference ±0 hours",
    "−1 hour vs. reference",
  ]);
});

test("comparison follows its selected zone through reordering and resets when removed or changed", async ({
  page,
}) => {
  await page.goto("/jst,pt,utc");
  const select = page.getByRole("combobox", { name: "Compare with", exact: true });
  await select.selectOption("jst");
  await page.locator('[data-zone="jst"] [data-action="later"]').click();
  await expect(select).toHaveValue("jst");
  await expect(page.locator('[data-zone="jst"] .zone-id')).toHaveText("Reference ±0 hours");
  await page.goBack();
  await expect(select).toHaveValue("jst");
  await page.locator('[data-zone="jst"] [data-action="remove"]').click();
  await expect(select).toHaveValue("");
  await expect(page.locator(".zone-id")).toHaveText(["America/Los_Angeles", "UTC"]);
  await page.goBack();
  await expect(select).toHaveValue("");
  await select.selectOption("jst");
  await page.locator('[data-zone="jst"] [data-action="change"]').click();
  await page.getByRole("searchbox").fill("Europe/London");
  await page.locator(".zone-option").first().click();
  await expect(select).toHaveValue("");
  await expect(page.locator(".zone-id").first()).toHaveText("Europe/London");
});

test("unsupported reference reports unavailable differences while healthy clocks continue", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Intl.DateTimeFormat = new Proxy(Intl.DateTimeFormat, {
      construct(target, args) {
        if (args[1]?.timeZone === "Asia/Tokyo") throw new RangeError("Unsupported");
        return Reflect.construct(target, args);
      },
    });
  });
  await page.goto("/jst,utc");
  const select = page.getByRole("combobox", { name: "Compare with", exact: true });
  await select.selectOption("jst");
  await expect(page.locator(".zone-id")).toHaveText([
    "Difference unavailable",
    "Difference unavailable",
  ]);
  await expect(page.locator('[data-zone="utc"] .digital-time')).toHaveText("12:34:56");
  await page.clock.runFor(1000);
  await expect(page.locator('[data-zone="utc"] .digital-time')).toHaveText("12:34:57");
  await select.selectOption("utc");
  await expect(page.locator(".zone-id")).toHaveText([
    "Difference unavailable",
    "Reference ±0 hours",
  ]);
  await select.selectOption("");
  await expect(page.locator(".zone-id")).toHaveText(["Asia/Tokyo", "UTC"]);
});

test.describe("Japanese comparison layout", () => {
  test.use({ locale: "ja-JP" });
  for (const [width, height] of [
    [390, 844],
    [1280, 720],
  ] as const) {
    test(`reference differences keep three clock cards compact at ${width}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height });
      await page.goto("/jst,pt,utc");
      await expect(page.locator(".clock-card")).toHaveCount(3);
      const before = await page
        .locator(".clock-card")
        .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
      const select = page.getByRole("combobox", { name: "時差の基準", exact: true });
      await select.selectOption("jst");
      await expect(page.locator(".zone-id")).toHaveText([
        "比較の基準 ±0時間",
        "基準より −16時間",
        "基準より −9時間",
      ]);
      const after = await page
        .locator(".clock-card")
        .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
      after.forEach((cardHeight, index) => {
        expect(cardHeight).toBeLessThanOrEqual((before[index] ?? 0) + 1);
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      for (const card of await page.locator(".clock-card").all()) {
        const box = await card.boundingBox();
        expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
      }
      await page.screenshot({
        path: `output/playwright/${testInfo.project.name}-ja-comparison-${width}.png`,
        fullPage: true,
      });
    });
  }
});
