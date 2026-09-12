import { expect, type Page, test } from "@playwright/test";

type ThemeChoice = "system" | "light" | "dark";

function themeOption(page: Page, choice: ThemeChoice) {
  return page.locator(`[data-theme-option="${choice}"]`);
}

async function expectThemeChoice(page: Page, choice: ThemeChoice) {
  await expect(themeOption(page, choice)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.theme-option[aria-pressed="true"]')).toHaveCount(1);
}

test("system preference follows OS changes and explicit choices persist across reloads", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/utc,jst");
  const root = page.locator("html");
  await expectThemeChoice(page, "system");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-theme", "light");
  await themeOption(page, "dark").click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#151e1b");
  await page.reload();
  await expectThemeChoice(page, "dark");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await themeOption(page, "light").click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveAttribute("data-theme", "light");
  await themeOption(page, "system").click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expectThemeChoice(page, "system");
  await expect(page.locator(".clock-card")).toHaveCount(2);
});

test("saved theme applies before application code and styles can finish loading", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("timepario-theme", "dark"));
  await page.route("**/assets/app.js?*", (route) => route.abort());
  await page.route("**/assets/app.css?*", (route) => route.abort());
  await page.goto("/utc");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectThemeChoice(page, "dark");
  await page.goto("/xyz");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".error-page")).toBeVisible();
});

test("invalid saved values use the system theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("timepario-theme", "unexpected"));
  await page.goto("/utc");
  await expectThemeChoice(page, "system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("storage denial keeps switching available without disrupting clocks", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage denied", "SecurityError");
      },
    });
  });
  await page.goto("/utc");
  await expectThemeChoice(page, "system");
  await themeOption(page, "light").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".digital-time")).not.toHaveText("--:--:--");
  expect(errors).toEqual([]);
});

test("a failed storage write preserves the current choice when the page is restored", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.goto("/utc");
  await themeOption(page, "light").click();
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
  );
  await expectThemeChoice(page, "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("theme changes and removal propagate between tabs", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/utc");
  const second = await context.newPage();
  await second.emulateMedia({ colorScheme: "light" });
  await second.goto("/jst");
  await themeOption(second, "dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectThemeChoice(page, "dark");
  await second.evaluate(() => localStorage.removeItem("timepario-theme"));
  await expectThemeChoice(page, "system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await second.close();
});

for (const locale of ["en-US", "ja-JP"]) {
  test.describe(`theme controls in ${locale}`, () => {
    test.use({ locale });
    test("shows icon options, accepts keyboard focus, and restores theme after expanded view", async ({
      page,
    }) => {
      await page.goto("/utc");
      const control = page.getByRole("group", {
        name: locale === "ja-JP" ? "テーマ" : "Theme",
        exact: true,
      });
      await expect(control.locator(".theme-option")).toHaveCount(3);
      await expect(control.locator(".theme-option .ui-icon")).toHaveCount(3);
      await themeOption(page, "system").focus();
      await expect(themeOption(page, "system")).toBeFocused();
      await themeOption(page, "light").focus();
      await expect(themeOption(page, "light")).toBeFocused();
      await page.keyboard.press("Enter");
      await expectThemeChoice(page, "light");
      await page.locator("#presentation-button").click();
      await expect(page.locator("#app")).toHaveClass(/is-presentation/);
      await page.keyboard.press("Escape");
      await expect(themeOption(page, "light")).toBeVisible();
      await expectThemeChoice(page, "light");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    });
  });
}
