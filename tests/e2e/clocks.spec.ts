import { expect, test } from "@playwright/test";

const fixed = new Date("2026-07-01T12:34:56.000Z");
test("case-insensitive IANA search cannot add duplicate clocks", async ({ page }) => {
  await page.goto("/Europe~London");
  await page.getByRole("button", { name: "Add clock", exact: true }).click();
  await page.getByRole("searchbox").fill("europe/london");
  const options = page.locator(".zone-option");
  expect(await options.count()).toBeGreaterThan(0);
  for (const option of await options.all()) await expect(option).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.locator(".clock-card")).toHaveCount(1);
  await expect(page).toHaveURL(/\/Europe~London$/);
});
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(fixed.getTime() - 60_000) });
  await page.clock.pauseAt(fixed);
});

test("device zone, explicit precedence, stable SVG and seconds", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".clock-card")).toHaveAttribute("data-zone", "et");
  await expect(page.locator(".digital-time")).toHaveText("08:34:56");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/jst,pst,pt");
  await expect(page.locator(".digital-time")).toHaveText(["21:34:56", "04:34:56", "05:34:56"]);
  await expect(page.locator(".clock-offset")).toHaveText(["UTC+09:00", "UTC−08:00", "UTC−07:00"]);
  await expect(page.locator(".zone-label")).toHaveText([
    "Tokyo (JST)",
    "Pacific Standard Time (PST)",
    "Los Angeles (PDT)",
  ]);
  await expect(page.locator('[data-zone="jst"] .hand-second')).toHaveAttribute(
    "transform",
    "rotate(336 100 100)",
  );
  await page.locator('[data-zone="jst"]').evaluate((node) => {
    node.setAttribute("data-preserved", "true");
  });
  await page.clock.runFor(1000);
  await expect(page.locator(".digital-time")).toHaveText(["21:34:57", "04:34:57", "05:34:57"]);
  await page.clock.setSystemTime(new Date("2026-01-01T12:34:56Z"));
  await page.clock.runFor(1000);
  await expect(page.locator(".zone-label")).toHaveText([
    "Tokyo (JST)",
    "Pacific Standard Time (PST)",
    "Los Angeles (PST)",
  ]);
  await expect(page.locator('[data-zone="jst"]')).toHaveAttribute("data-preserved", "true");
  await expect(page.locator(".digital-time[aria-live]")).toHaveCount(0);
});

test("add, search, change, reorder, remove, reload and history", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add clock", exact: true }).click();
  await page.getByRole("searchbox").fill("Kathmandu");
  await page.locator(".zone-option").filter({ hasText: "Kathmandu" }).first().click();
  await expect(page).toHaveURL(/\/et,Asia~Kathmandu$/);
  await expect(page.locator(".digital-time")).toHaveText(["08:34:56", "18:19:56"]);
  await page.getByRole("button", { name: "Add clock", exact: true }).click();
  await page.getByRole("searchbox").fill("PST");
  await page.locator(".zone-option").filter({ hasText: "Etc/GMT+8" }).click();
  await expect(page.getByRole("button", { name: "Add clock", exact: true })).toBeDisabled();
  await expect(page.locator("#limit-note")).toBeVisible();
  await page.locator('[data-zone="pst"] [data-action="earlier"]').click();
  await expect(page).toHaveURL(/\/et,pst,Asia~Kathmandu$/);
  await page.locator('[data-zone="pst"] [data-action="change"]').click();
  await page.getByRole("searchbox").fill("Europe/London");
  await page.locator(".zone-option").filter({ hasText: "Europe/London" }).first().click();
  await expect(page).toHaveURL(/\/et,Europe~London,Asia~Kathmandu$/);
  await page.reload();
  await expect(page.locator(".clock-card")).toHaveCount(3);
  await page.locator('[data-zone="Europe~London"] [data-action="remove"]').click();
  await expect(page).toHaveURL(/\/et,Asia~Kathmandu$/);
  await page.goBack();
  await expect(page.locator(".clock-card")).toHaveCount(3);
  await page.goForward();
  await expect(page.locator(".clock-card")).toHaveCount(2);
});

test("search does not alter history and Escape returns keyboard focus", async ({ page }) => {
  await page.goto("/utc");
  const add = page.getByRole("button", { name: "Add clock", exact: true });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.keyboard.type("London");
  await expect(page).toHaveURL(/\/utc$/);
  await page.keyboard.press("Escape");
  await expect(add).toBeFocused();
  await expect(page.getByRole("button", { name: "Keep at least one clock" })).toBeDisabled();
  await page.keyboard.press("Enter");
  await page.getByRole("searchbox").fill("Europe/London");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".zone-option:not(:disabled)").first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/utc,Europe~London$/);
  const earlier = page.locator('[data-zone="Europe~London"] [data-action="earlier"]');
  await earlier.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/Europe~London,utc$/);
});

test("clicking outside the time-zone dialog closes it and restores focus", async ({ page }) => {
  await page.goto("/utc");
  const add = page.getByRole("button", { name: "Add clock", exact: true });
  await add.click();
  const dialog = page.getByRole("dialog", { name: "Add a time zone" });
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  await expect(add).toBeFocused();
});

test("clipboard failure exposes selected canonical URL and success is announced", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Denied");
        },
      },
    });
  });
  await page.goto("/");
  const copy = page.getByRole("button", { name: "Copy link", exact: true });
  await expect(copy).toHaveAttribute("title", "Copy a link to the displayed clocks");
  await copy.click();
  await expect(page.getByRole("textbox", { name: "Share URL" })).toHaveValue(
    "http://127.0.0.1:8787/et",
  );
  expect(
    await page
      .locator("#share-url")
      .evaluate(
        (node: HTMLInputElement) =>
          node.selectionEnd === node.value.length && node.selectionStart === 0,
      ),
  ).toBe(true);
  await page.mouse.click(5, 5);
  await expect(page.getByRole("dialog", { name: "Copy link manually" })).toBeHidden();
  await expect(copy).toBeFocused();
  await expect(copy).not.toHaveAttribute("data-copy-state", "success");
  await page.evaluate(() => {
    let calls = 0;
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: () => {
          document.documentElement.dataset.copyCalls = String(++calls);
          return new Promise<void>((resolve) =>
            window.addEventListener("finish-copy", () => resolve(), { once: true }),
          );
        },
      },
    });
  });
  await copy.click();
  await expect(page.locator("#share-button")).toBeDisabled();
  await expect(page.locator("#share-button")).toHaveAttribute("aria-busy", "true");
  await page.locator("#share-button").dispatchEvent("click");
  await expect(page.locator("html")).toHaveAttribute("data-copy-calls", "1");
  await page.evaluate(() => window.dispatchEvent(new Event("finish-copy")));
  await expect(page.getByRole("button", { name: "Link copied", exact: true })).toBeEnabled();
  await expect(page.locator("#share-button")).toHaveAttribute("data-copy-state", "success");
  await expect(page.locator("#share-button [data-icon=check]")).toBeVisible();
  await expect(page.locator("#share-button")).not.toHaveAttribute("aria-busy");
  await expect(page.getByRole("status")).toHaveText("Share link copied.");
  await page.clock.runFor(1999);
  await expect(page.getByRole("button", { name: "Link copied", exact: true })).toBeVisible();
  await page.clock.runFor(1);
  await expect(copy).toBeVisible();
  await expect(page.locator("#share-button [data-icon=copy]")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("fallback candidate list accepts valid aliases outside supportedValuesOf", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Intl, "supportedValuesOf", { value: undefined });
  });
  await page.goto("/utc");
  await page.getByRole("button", { name: "Add clock", exact: true }).click();
  await page.getByRole("searchbox").fill("US/Pacific");
  await page.locator(".zone-option").click();
  await expect(page).toHaveURL(/\/utc,US~Pacific$/);
  await expect(page.locator(".digital-time")).toHaveText(["12:34:56", "05:34:56"]);
  await page.reload();
  await expect(page).toHaveURL(/\/utc,US~Pacific$/);
  await expect(page.locator(".digital-time")).toHaveText(["12:34:56", "05:34:56"]);
});

test("unsupported browser zone is isolated and survives changes and history", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Intl.DateTimeFormat;
    Intl.DateTimeFormat = new Proxy(original, {
      construct(target, args) {
        if (args[1]?.timeZone === "Asia/Tokyo") throw new RangeError("Unsupported");
        return Reflect.construct(target, args);
      },
    });
  });
  await page.goto("/jst,utc");
  await expect(page.locator('[data-zone="jst"] .clock-error')).toBeVisible();
  await expect(page.locator('[data-zone="utc"] .digital-time')).toHaveText("12:34:56");
  await page.locator('[data-zone="jst"] [data-action="later"]').click();
  await expect(page).toHaveURL(/\/utc,jst$/);
  await page.goBack();
  await expect(page.locator('[data-zone="jst"] .clock-error')).toBeVisible();
  await page.locator('[data-zone="jst"] [data-action="remove"]').click();
  await expect(page).toHaveURL(/\/utc$/);
});

test("device detection failure explains UTC fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Intl.DateTimeFormat = new Proxy(Intl.DateTimeFormat, {
      apply(target, thisArg, args) {
        if (args.length === 0) throw new RangeError("Device unavailable");
        return Reflect.apply(target, thisArg, args);
      },
    });
  });
  await page.goto("/");
  await expect(page.locator(".digital-time")).toHaveText("12:34:56");
  await expect(page.locator("#mode-note")).toHaveText(
    "Your device time zone could not be detected. Showing UTC.",
  );
  await expect(page).toHaveURL(/\/$/);
});

test("resume redetects auto zone, explicit clocks persist, back restores auto", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Intl.DateTimeFormat;
    Intl.DateTimeFormat = new Proxy(original, {
      apply(target, thisArg, args) {
        if (args.length === 0)
          return {
            resolvedOptions: () => ({
              timeZone: document.documentElement.dataset.testZone ?? "America/New_York",
            }),
          };
        return Reflect.apply(target, thisArg, args);
      },
    });
  });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.dataset.testZone = "Asia/Tokyo";
    window.dispatchEvent(new Event("focus"));
  });
  await expect(page.locator(".clock-card")).toHaveAttribute("data-zone", "jst");
  await page.getByRole("button", { name: "Add clock", exact: true }).click();
  await page.getByRole("searchbox").fill("UTC");
  await page
    .locator(".zone-option")
    .filter({ hasText: "Coordinated Universal Time" })
    .first()
    .click();
  await page.evaluate(() => {
    document.documentElement.dataset.testZone = "Europe/London";
    window.dispatchEvent(new Event("focus"));
  });
  await expect(page.locator(".clock-card")).toHaveCount(2);
  await expect(page).toHaveURL(/\/jst,utc$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".clock-card")).toHaveAttribute("data-zone", "Europe~London");
});

test("hidden clocks stop, resume catches up, repeated focus has only one update timer", async ({
  page,
}) => {
  await page.goto("/utc");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(5000);
  await expect(page.locator(".digital-time")).toHaveText("12:34:56");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
    for (let index = 0; index < 5; index++) window.dispatchEvent(new Event("focus"));
    document.documentElement.dataset.mutations = "0";
    const target = document.querySelector(".digital-time");
    if (target)
      new MutationObserver((records) => {
        document.documentElement.dataset.mutations = String(
          Number(document.documentElement.dataset.mutations) + records.length,
        );
      }).observe(target, { childList: true });
  });
  await expect(page.locator(".digital-time")).toHaveText("12:35:01");
  await page.clock.runFor(1000);
  await expect(page.locator(".digital-time")).toHaveText("12:35:02");
  await expect(page.locator("html")).toHaveAttribute("data-mutations", "1");
  await page.clock.setSystemTime(new Date("2027-01-01T00:00:00.000Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(page.locator(".digital-time")).toHaveText("00:00:00");
});

test("direct URL normalization, HTTP errors, assets, CSP and zero periodic traffic", async ({
  page,
  request,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  const response = await page.goto("/JST,Asia~Tokyo,pt");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-security-policy"]).toContain("script-src 'self'");
  await expect(page).toHaveURL(/\/jst,pt$/);
  await expect(page.locator(".clock-card")).toHaveCount(2);
  const requests: string[] = [];
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
  });
  page.on("request", (req) => requests.push(req.url()));
  await page.clock.runFor(65000);
  expect(requests).toEqual([]);
  expect(failures).toEqual([]);
  expect((await request.get("/assets/missing.js")).status()).toBe(404);
  expect((await request.get("/assets/app.js")).status()).toBe(200);
  expect((await request.get("/assets/app.css")).status()).toBe(200);
  for (const path of [
    "/unknown",
    "/jst,,utc",
    "/jst,pt,utc,et",
    "/%E0%A4%A",
    "/%3Cscript%3Ealert(1)%3C~script%3E",
  ]) {
    expect((await request.get(path)).status()).toBe(400);
  }
});

test("JavaScript disabled shell contains only unknown time and explanation", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const response = await page.goto("http://127.0.0.1:8787/");
  await expect(page.locator(".digital-time")).toHaveText("--:--:--");
  await expect(page.locator("noscript .notice")).toBeVisible();
  expect(await response?.text()).toContain(
    "JavaScript is required to detect your time zone and run these clocks.",
  );
  await context.close();
});

for (const [width, height] of [
  [360, 640],
  [390, 844],
  [768, 1024],
  [1280, 720],
] as const) {
  test(`three clocks fit viewport ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto("/jst,pt,utc");
    await expect(page.locator(".digital-time")).toHaveText(["21:34:56", "05:34:56", "12:34:56"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const cards = await page.locator(".clock-card").all();
    for (const card of cards) {
      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
      const analog = await card.locator(".analog-clock").boundingBox();
      const readout = await card.locator(".clock-readout").boundingBox();
      expect(analog).not.toBeNull();
      expect(readout).not.toBeNull();
      if (box && analog && readout) {
        expect(readout.x + readout.width).toBeLessThanOrEqual(box.x + box.width);
        expect(
          analog.x + analog.width <= readout.x + 1 || analog.y + analog.height <= readout.y + 1,
        ).toBe(true);
      }
    }
    if (width > 640) {
      const topEdges = await page
        .locator(".digital-time")
        .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
      expect(Math.max(...topEdges) - Math.min(...topEdges)).toBeLessThanOrEqual(1);
    }
    await page.screenshot({
      path: `output/playwright/${testInfo.project.name}-${width}x${height}-3-clocks.png`,
      fullPage: true,
    });
  });
}

for (const path of ["/utc", "/jst,pt"]) {
  test(`desktop composition ${path}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(path);
    await expect(page.locator(".digital-time").first()).not.toHaveText("--:--:--");
    await page.screenshot({
      path: `output/playwright/${testInfo.project.name}-desktop-${path.includes(",") ? 2 : 1}-clocks.png`,
      fullPage: true,
    });
  });
}

test("200 percent text remains readable without horizontal overflow", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/jst,pt,utc");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `output/playwright/${testInfo.project.name}-360x640-text-200-percent.png`,
    fullPage: true,
  });
});

test("mobile search dialog and multi-level IANA names stay inside the viewport", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/America~Argentina~Buenos_Aires,Asia~Kathmandu,Europe~London");
  await expect(page.locator(".clock-card")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `output/playwright/${testInfo.project.name}-360x640-long-iana.png`,
    fullPage: true,
  });
  await page.locator(".zone-change").first().click();
  await page.getByRole("searchbox").fill("Pacific");
  await expect(page.getByRole("dialog")).toBeVisible();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    expect(box.y + box.height).toBeLessThanOrEqual(640);
  }
  await page.screenshot({
    path: `output/playwright/${testInfo.project.name}-360x640-search-dialog.png`,
    fullPage: true,
  });
});
