import { expect, test } from "@playwright/test";

const fixed = new Date("2026-07-01T12:34:56Z");

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(fixed.getTime() - 60_000) });
  await page.clock.pauseAt(fixed);
});

test("a shared expanded-view URL opens expanded and returns to its canonical clock URL", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      value: async () => {
        throw new Error("Expanded view must not request browser fullscreen");
      },
    });
  });
  await page.goto("/jst,utc?view=expanded");
  await expect(page.locator("#app")).toHaveClass(/is-presentation/);
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect(page).toHaveURL(/\/jst,utc\?view=expanded$/);
  await expect(page.getByRole("button", { name: "Return to clocks", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Return to clocks", exact: true }).click();
  await expect(page.locator("#app")).not.toHaveClass(/is-presentation/);
  await expect(page).toHaveURL(/\/jst,utc$/);
  await page.getByRole("button", { name: "Expanded view", exact: true }).click();
  await expect(page).toHaveURL(/\/jst,utc\?view=expanded$/);
  await page.getByRole("button", { name: "Return to clocks", exact: true }).click();
  await expect(page).toHaveURL(/\/jst,utc$/);
});

test("expanded view never requests browser fullscreen and restores its own trigger and comparison", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      value: async () => {
        document.documentElement.dataset.fullscreenRequested = "true";
        throw new Error("This API must not be called by expanded view");
      },
    });
  });
  await page.goto("/jst,utc");
  await page.getByRole("combobox", { name: "Compare with", exact: true }).selectOption("jst");
  const entry = page.locator("#presentation-button");
  await entry.click();
  await expect(page.locator("#app")).toHaveClass(/is-presentation/);
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect(page.locator("html")).not.toHaveAttribute("data-fullscreen-requested");
  await expect(page.locator("#presentation-hint")).toHaveText("Press Esc to return");
  await expect(page.locator(".zone-id")).toHaveText([
    "Reference ±0 hours",
    "−9 hours vs. reference",
  ]);
  await page.getByRole("button", { name: "Return to clocks", exact: true }).click();
  await expect(entry).toBeFocused();
  await expect(page.getByRole("combobox", { name: "Compare with", exact: true })).toHaveValue(
    "jst",
  );
  await expect(page).toHaveURL(/\/jst,utc$/);
  await entry.click();
  await page.keyboard.press("Escape");
  await expect(entry).toBeFocused();
  await expect(page.locator("html")).not.toHaveAttribute("data-fullscreen-requested");
});

test("trusted full-screen entry uses the browser API when available and returns without resetting clocks", async ({
  page,
}, testInfo) => {
  await page.goto("/jst,pt,utc");
  const entry = page.locator("#fullscreen-button");
  await page.getByRole("combobox", { name: "Compare with", exact: true }).selectOption("jst");
  await entry.click();
  await expect(page.locator("#app")).toHaveClass(/is-presentation/);
  await expect(entry).toBeEnabled();
  const native = await page.evaluate(
    () => document.fullscreenElement === document.querySelector("#app"),
  );
  console.info(
    `[${testInfo.project.name}] Native fullscreen: ${native ? "entered" : "unavailable; expanded view used"}`,
  );
  await testInfo.attach("native-fullscreen-result", {
    body: JSON.stringify({ native, browser: testInfo.project.name }),
    contentType: "application/json",
  });
  if (native) await expect(page.locator("#presentation-hint")).toHaveText("Press Esc to return");
  else await expect(page.locator("#presentation-hint")).toContainText("Full screen is unavailable");
  for (const change of await page.locator(".zone-change").all())
    await expect(change).toBeDisabled();
  await expect(page.locator(".zone-id")).toHaveText([
    "Reference ±0 hours",
    "−16 hours vs. reference",
    "−9 hours vs. reference",
  ]);
  await page.clock.runFor(1000);
  await expect(page.locator(".digital-time")).toHaveText(["21:34:57", "05:34:57", "12:34:57"]);
  await page.locator("#exit-fullscreen").click();
  await expect(page.locator("#app")).not.toHaveClass(/is-presentation/);
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect(entry).toBeFocused();
  await expect(page.getByRole("combobox", { name: "Compare with", exact: true })).toHaveValue(
    "jst",
  );
  await expect(page).toHaveURL(/\/jst,pt,utc$/);
});

for (const failure of ["unsupported", "rejected"] as const) {
  test(`native API ${failure} falls back honestly and Escape restores focus`, async ({ page }) => {
    await page.addInitScript((failure) => {
      Object.defineProperty(Element.prototype, "requestFullscreen", {
        configurable: true,
        value:
          failure === "unsupported"
            ? undefined
            : async () => {
                throw new Error("Denied");
              },
      });
    }, failure);
    await page.goto("/utc");
    const entry = page.locator("#fullscreen-button");
    await entry.click();
    await expect(page.locator("#app")).toHaveClass(/is-presentation/);
    await expect(page.locator("#presentation-hint")).toContainText("Expanded view");
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    await page.keyboard.press("Escape");
    await expect(page.locator("#app")).not.toHaveClass(/is-presentation/);
    await expect(entry).toBeFocused();
    await expect(page.locator(".zone-change")).toBeEnabled();
  });
}

test("idle controls wake on input, remain visible while focused and stop scheduling when hidden or exited", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", { value: undefined });
  });
  await page.goto("/utc");
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await page.clock.runFor(3000);
  await expect(page.locator("#app")).toHaveClass(/is-idle/);
  await expect(page.locator("#exit-fullscreen")).not.toBeVisible();
  await page.mouse.move(30, 30);
  await expect(page.locator("#app")).not.toHaveClass(/is-idle/);
  await page.keyboard.press("Tab");
  await expect(page.locator("#exit-fullscreen")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#exit-fullscreen")).toBeFocused();
  await page.clock.runFor(3000);
  await expect(page.locator("#exit-fullscreen")).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(5000);
  await expect(page.locator("#app")).not.toHaveClass(/is-idle/);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.keyboard.press("Escape");
  await page.clock.runFor(5000);
  await expect(page.locator("#app")).not.toHaveClass(/is-idle|is-presentation/);
});

test("fullscreenchange synchronizes a mocked native browser exit", async ({ page }) => {
  await page.addInitScript(() => {
    let fullscreen: Element | null = null;
    Object.defineProperty(document, "fullscreenElement", { get: () => fullscreen });
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      value: async function (this: Element) {
        fullscreen = this;
        document.dispatchEvent(new Event("fullscreenchange"));
      },
    });
    Object.defineProperty(document, "exitFullscreen", {
      value: async () => {
        fullscreen = null;
        document.dispatchEvent(new Event("fullscreenchange"));
      },
    });
  });
  await page.goto("/utc");
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect(page.locator("#app")).toHaveClass(/is-presentation/);
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator("#app")).not.toHaveClass(/is-presentation/);
  await expect(page.getByRole("button", { name: "Full screen", exact: true })).toBeFocused();
});

test("a mocked delayed native request cannot reopen presentation after Escape or issue duplicate requests", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let fullscreen: Element | null = null;
    let calls = 0;
    Object.defineProperty(document, "fullscreenElement", { get: () => fullscreen });
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      value: function (this: Element) {
        document.documentElement.dataset.fullscreenCalls = String(++calls);
        return new Promise<void>((resolve) => {
          window.addEventListener(
            "resolve-fullscreen",
            () => {
              fullscreen = this;
              document.dispatchEvent(new Event("fullscreenchange"));
              resolve();
            },
            { once: true },
          );
        });
      },
    });
    Object.defineProperty(document, "exitFullscreen", {
      value: async () => {
        fullscreen = null;
        document.dispatchEvent(new Event("fullscreenchange"));
      },
    });
  });
  await page.goto("/utc");
  const entry = page.locator("#fullscreen-button");
  await entry.click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#app")).not.toHaveClass(/is-presentation/);
  await entry.dispatchEvent("click");
  await expect(page.locator("html")).toHaveAttribute("data-fullscreen-calls", "1");
  await page.evaluate(() => window.dispatchEvent(new Event("resolve-fullscreen")));
  await expect(entry).toBeEnabled();
  await expect(entry).toBeFocused();
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await entry.click();
  await expect(page.locator("html")).toHaveAttribute("data-fullscreen-calls", "2");
  await page.evaluate(() => window.dispatchEvent(new Event("resolve-fullscreen")));
  await expect(page.locator("#app")).toHaveClass(/is-presentation/);
  await page.getByRole("button", { name: "Exit full screen", exact: true }).click();
  await expect(page.locator("#app")).not.toHaveClass(/is-presentation/);
});

test("presentation closes open dialogs and keeps history-rerendered titles disabled", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", { value: undefined });
  });
  await page.goto("/utc,jst");
  await page.locator('[data-zone="jst"] [data-action="earlier"]').click();
  await page.getByRole("button", { name: "Change Tokyo", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#fullscreen-button").dispatchEvent("click");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/utc,jst$/);
  for (const title of await page.locator(".zone-change").all()) await expect(title).toBeDisabled();
  await page.keyboard.press("Escape");
  for (const title of await page.locator(".zone-change").all()) await expect(title).toBeEnabled();
});
