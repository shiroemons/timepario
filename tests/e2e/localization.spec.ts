import { expect, test } from "@playwright/test";

const fixed = new Date("2026-07-01T12:34:56.000Z");

test.describe("Japanese browser preferences", () => {
  test.use({ locale: "ja-JP", timezoneId: "America/New_York" });
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(fixed.getTime() - 60_000) });
    await page.clock.pauseAt(fixed);
  });

  test("language follows browser preference independently of device and explicit zones", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.locator(".clock-card")).toHaveAttribute("data-zone", "et");
    await expect(
      page.getByRole("button", { name: "ニューヨークを変更", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".digital-time")).toHaveText("08:34:56");
    await expect(page.locator(".clock-date")).toContainText("7月1日");
    await page.goto("/jst,pst,pt");
    await expect(page.locator(".digital-time")).toHaveText(["21:34:56", "04:34:56", "05:34:56"]);
    await expect(page.locator(".clock-offset")).toHaveText(["UTC+09:00", "UTC−08:00", "UTC−07:00"]);
    await expect(page.locator(".zone-label")).toHaveText(["東京", "太平洋標準時", "ロサンゼルス"]);
    await expect(page.getByRole("button", { name: "時計を追加", exact: true })).toBeDisabled();
  });

  test("Japanese and English region searches preserve URL and localized history actions", async ({
    page,
  }) => {
    await page.goto("/utc");
    const add = page.getByRole("button", { name: "時計を追加", exact: true });
    await add.click();
    await expect(page.getByRole("dialog", { name: "タイムゾーンを追加" })).toBeVisible();
    await page.getByRole("searchbox").fill("ロンドン");
    await expect(page.locator(".option-name")).toHaveText([/^ロンドン \([^)]+\)$/]);
    await page.getByRole("searchbox").fill("London");
    await expect(page.locator(".option-name")).toHaveText([/^ロンドン \([^)]+\)$/]);
    await page.locator(".zone-option").click();
    await expect(page).toHaveURL(/\/utc,Europe~London$/);
    await expect(page.getByRole("status")).toHaveText("ロンドンを追加しました。");
    await page.getByRole("button", { name: "ロンドンを前へ移動", exact: true }).click();
    await expect(page).toHaveURL(/\/Europe~London,utc$/);
    await expect(page.getByRole("status")).toHaveText("ロンドンを移動しました。");
    await page.goBack();
    await expect(page.locator(".zone-label")).toHaveText(["UTC", "ロンドン"]);
    await page.getByRole("button", { name: "ロンドンを削除", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("ロンドンを削除しました。");
    await page.goBack();
    await add.click();
    await page.getByRole("searchbox").fill("not a valid zone");
    await expect(page.locator(".empty-results")).toContainText("一致するタイムゾーンがありません");
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await expect(add).toBeFocused();
  });

  test("picker shows current DST and fractional offsets and refreshes an open picker", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/utc");
    await page.getByRole("button", { name: "時計を追加", exact: true }).click();
    await page.getByRole("searchbox").fill("JST");
    await expect(page.locator(".option-name")).toHaveText(["東京 (JST)"]);
    await page.getByRole("searchbox").fill("PDT");
    await expect(
      page.locator(".zone-option").filter({ hasText: "ロサンゼルス (PDT)" }),
    ).toBeVisible();
    await page.getByRole("searchbox").fill("太平洋");
    await expect(
      page.locator(".zone-option").filter({ hasText: "太平洋標準時" }).locator(".option-offset"),
    ).toHaveText("UTC−08:00");
    const pacific = page.locator(".zone-option").filter({ hasText: "ロサンゼルス" });
    await expect(pacific.locator(".option-offset")).toHaveText("UTC−07:00");
    await expect(pacific.locator(".option-name")).toHaveText("ロサンゼルス (PDT)");
    await page.screenshot({
      path: `output/playwright/${testInfo.project.name}-ja-desktop-picker-pacific.png`,
      fullPage: true,
    });
    await page.clock.setSystemTime(new Date("2026-01-01T12:34:56Z"));
    await page.clock.runFor(1000);
    await expect(pacific.locator(".option-offset")).toHaveText("UTC−08:00");
    await expect(pacific.locator(".option-name")).toHaveText("ロサンゼルス (PST)");
    await page.getByRole("searchbox").fill("Asia/Kathmandu");
    await expect(page.locator(".zone-option").first().locator(".option-offset")).toHaveText(
      "UTC+05:45",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `output/playwright/${testInfo.project.name}-ja-mobile-picker-fractional.png`,
      fullPage: true,
    });
    await expect(page).toHaveURL(/\/utc$/);
  });

  test("localizes device fallback, unsupported clocks and clipboard failure", async ({ page }) => {
    await page.addInitScript(() => {
      Intl.DateTimeFormat = new Proxy(Intl.DateTimeFormat, {
        apply(target, thisArg, args) {
          if (!args.length) throw new RangeError("Device unavailable");
          return Reflect.apply(target, thisArg, args);
        },
        construct(target, args) {
          if (args[1]?.timeZone === "Asia/Tokyo") throw new RangeError("Unsupported");
          return Reflect.construct(target, args);
        },
      });
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    });
    await page.goto("/");
    await expect(page.locator("#mode-note")).toContainText("UTCを表示しています");
    await page.goto("/jst,utc");
    await expect(page.locator('[data-zone="jst"] .clock-error')).toContainText("表示できません");
    await page.getByRole("button", { name: "リンクをコピー", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "共有URL", exact: true })).toHaveValue(
      "http://127.0.0.1:8787/jst,utc",
    );
    await expect(page.getByRole("status")).toContainText("手動でコピーしてください");
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => {} } });
    });
    await page.getByRole("button", { name: "リンクをコピー", exact: true }).click();
    await expect(page.getByRole("button", { name: "コピーしました", exact: true })).toBeVisible();
    await expect(page.locator("#share-button [data-icon=check]")).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("共有リンクをコピーしました。");
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.clock.runFor(2000);
    await expect(page.getByRole("button", { name: "リンクをコピー", exact: true })).toBeVisible();
    await expect(page.locator("#share-button")).not.toHaveAttribute("data-copy-state", "success");
  });

  test("translates regions beyond the featured cities while preserving English search", async ({
    page,
  }) => {
    await page.goto("/utc");
    await page.getByRole("button", { name: "時計を追加", exact: true }).click();
    for (const [english, japanese] of [
      ["Bangkok", "バンコク"],
      ["Rome", "ローマ"],
      ["Nairobi", "ナイロビ"],
      ["Honolulu", "ホノルル"],
      ["Mexico City", "メキシコシティー"],
    ]) {
      await page.getByRole("searchbox").fill(english ?? "");
      await expect(page.locator(".option-name").first()).toContainText(`${japanese} (`);
      await page.getByRole("searchbox").fill(japanese ?? "");
      await expect(page.locator(".option-name").first()).toContainText(`${japanese} (`);
    }
    await page.locator(".zone-option").first().click();
    await expect(page).toHaveURL(/\/utc,America~Mexico_City$/);
    await expect(page.locator(".zone-label")).toHaveText(["UTC", "メキシコシティー"]);
  });
});

test("navigator preference updates all static and dynamic UI when request headers differ", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "en-US",
  });
  try {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "languages", { value: ["ja-JP", "en-US"] });
      Object.defineProperty(navigator, "language", { value: "ja-JP" });
    });
    const page = await context.newPage();
    const response = await page.goto("http://127.0.0.1:8787/utc");
    expect(await response?.text()).toContain('<html lang="en">');
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("世界の時刻を、並べて。");
    await expect(page.locator(".app-footer p")).toContainText("端末の時刻を使用しています");
    await page.getByRole("button", { name: "時計を追加", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "タイムゾーンを追加" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("unsupported browser language falls back to English without changing Tokyo device zone", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "fr-FR", timezoneId: "Asia/Tokyo" });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:8787/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator(".clock-card")).toHaveAttribute("data-zone", "jst");
    await expect(page.getByRole("button", { name: "Change Tokyo", exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("Japanese SSR and error pages work with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ja-JP", javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const response = await page.goto("http://127.0.0.1:8787/jst");
    expect(response?.headers()["content-language"]).toBe("ja");
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("東京");
    await expect(page.locator("noscript .notice")).toContainText("JavaScriptを有効にしてください");
    const invalid = await page.goto("http://127.0.0.1:8787/jst,,utc");
    expect(invalid?.status()).toBe(400);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "時計のリンクが正しくありません",
    );
    await expect(page.locator(".error-page p")).toContainText("空のタイムゾーン");
  } finally {
    await context.close();
  }
});
