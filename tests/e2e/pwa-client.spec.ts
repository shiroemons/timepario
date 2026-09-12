import { expect, test } from "@playwright/test";

test.use({ locale: "ja-JP" });

test("registration starts after page load and reports a localized failure without stopping clocks", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: async () => {
          document.documentElement.dataset.registrationState = document.readyState;
          throw new Error("Registration denied");
        },
      },
    });
  });
  await page.goto("/utc");
  await expect(page.locator("html")).toHaveAttribute("data-registration-state", "complete");
  await expect(page.locator("#status")).toContainText("オフライン利用の準備に失敗しました");
  await expect(page.locator(".digital-time")).not.toHaveText("--:--:--");
  await expect(page.getByRole("button", { name: "時計を追加", exact: true })).toBeEnabled();
});

test("an initial installation failure is reported even after registration resolves", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const worker = Object.assign(new EventTarget(), { state: "installing" });
    const registration = Object.assign(new EventTarget(), { installing: worker, active: null });
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: async () => registration },
    });
    window.addEventListener("fail-installation", () => {
      worker.state = "redundant";
      worker.dispatchEvent(new Event("statechange"));
    });
  });
  await page.goto("/utc");
  await page.evaluate(() => window.dispatchEvent(new Event("fail-installation")));
  await expect(page.locator("#status")).toContainText("オフライン利用の準備に失敗しました");
  await expect(page.locator(".digital-time")).not.toHaveText("--:--:--");
});

test("a failed update preserves the existing offline version without claiming offline setup failed", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.addInitScript(() => {
    const worker = Object.assign(new EventTarget(), { state: "installing" });
    const registration = Object.assign(new EventTarget(), { installing: worker, active: {} });
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: async () => registration },
    });
    window.addEventListener("fail-installation", () => {
      worker.state = "redundant";
      worker.dispatchEvent(new Event("statechange"));
    });
  });
  await page.goto("/utc");
  await page.evaluate(() => window.dispatchEvent(new Event("fail-installation")));
  expect(warnings).toContain(
    "Offline update failed; the previous offline version remains available.",
  );
  await expect(page.locator("#status")).toBeEmpty();
});

for (const scenario of ["insecure", "unsupported"] as const) {
  test(`${scenario} service-worker context keeps ordinary clock behavior`, async ({ page }) => {
    await page.addInitScript((scenario) => {
      if (scenario === "insecure")
        Object.defineProperty(window, "isSecureContext", { value: false });
      Object.defineProperty(navigator, "serviceWorker", {
        value:
          scenario === "unsupported"
            ? undefined
            : {
                register: () => {
                  throw new Error("Must not register in an insecure context");
                },
              },
      });
    }, scenario);
    await page.goto("/utc");
    await expect(page.locator(".digital-time")).not.toHaveText("--:--:--");
    await expect(page.locator("#status")).toBeEmpty();
  });
}

test("offline fallback uses the requested clock path and invalid paths never turn into a device clock", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "serviceWorker", { value: undefined });
  });
  const shell = await request.get("/offline");
  expect(shell.status()).toBe(200);
  const body = await shell.text();
  expect(body).toContain('data-offline-shell="true"');
  await page.route("**/JST,UTC", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body }),
  );
  await page.goto("/JST,UTC");
  await expect(page).toHaveURL(/\/jst,utc$/);
  await expect(page.locator(".zone-label")).toHaveText(["東京 (JST)", "UTC (UTC)"]);
  await expect(page.locator(".clock-offset")).toHaveText(["UTC+09:00", "UTC+00:00"]);
  await page.route("**/jst,,utc", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body }),
  );
  await page.goto("/jst,,utc");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(
    "時計のリンクが正しくありません",
  );
  await expect(page.locator("#clock-grid")).toContainText("空のタイムゾーン");
  await expect(page.getByRole("link", { name: "端末の時計に戻る", exact: true })).toHaveAttribute(
    "href",
    "/",
  );
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".clock-card")).toHaveCount(0);
  await expect(page.locator("#capacity")).toHaveText("0 / 3 時計");
  await expect(page.getByRole("button", { name: "時計を追加", exact: true })).toBeDisabled();
});
