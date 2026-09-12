import { createServer, request as requestUpstream } from "node:http";
import type { Socket } from "node:net";
import { test as base, expect, type Page } from "@playwright/test";

interface ServerGate {
  origin: string;
  blockedRequests: () => number;
  available: (value: boolean) => void;
}

const test = base.extend<{ serverGate: ServerGate }>({
  serverGate: async ({ baseURL }, use) => {
    const upstream = new URL(baseURL ?? "http://127.0.0.1:8787");
    let available = true;
    let blocked = 0;
    const sockets = new Set<Socket>();
    const server = createServer((incoming, outgoing) => {
      if (!available) {
        blocked++;
        incoming.socket.destroy();
        return;
      }
      const forwarded = requestUpstream(
        new URL(incoming.url ?? "/", upstream),
        {
          method: incoming.method,
          headers: { ...incoming.headers, host: upstream.host },
        },
        (response) => {
          outgoing.writeHead(response.statusCode ?? 502, response.headers);
          response.pipe(outgoing);
        },
      );
      forwarded.on("error", () => outgoing.destroy());
      incoming.on("aborted", () => forwarded.destroy());
      outgoing.on("close", () => forwarded.destroy());
      incoming.pipe(forwarded);
    });
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.once("close", () => sockets.delete(socket));
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("The isolated proxy needs a TCP port");
    try {
      await use({
        origin: `http://127.0.0.1:${address.port}`,
        blockedRequests: () => blocked,
        available: (value) => {
          available = value;
        },
      });
    } finally {
      for (const socket of sockets) socket.destroy();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
});

async function ready(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state),
      { timeout: 15000 },
    )
    .toBe("activated");
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
}

test("manifest, icons, revision URLs and service-worker headers are ready for installation", async ({
  page,
  request,
  browserName,
}) => {
  await page.goto("/utc");
  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute("href");
  if (!manifestUrl) throw new Error("The page must link its manifest");
  const response = await request.get(manifestUrl);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/manifest+json");
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    id: "/",
    name: "TimePario",
    short_name: "TimePario",
    scope: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#141d21",
    theme_color: "#141d21",
  });
  const revision = new URL(manifestUrl, page.url()).searchParams.get("v");
  expect(revision).toMatch(/^[a-f0-9]{20}$/);
  await expect(page.locator('script[src*="/assets/app.js"]')).toHaveAttribute(
    "src",
    `/assets/app.js?v=${revision}`,
  );
  expect(
    manifest.icons.map((icon: { sizes: string; purpose: string }) => [icon.sizes, icon.purpose]),
  ).toEqual([
    ["192x192", "any"],
    ["512x512", "any"],
    ["512x512", "maskable"],
  ]);
  for (const icon of manifest.icons) {
    expect(new URL(icon.src, page.url()).searchParams.get("v")).toBe(revision);
    const file = await request.get(icon.src);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toContain("image/png");
    const bytes = await file.body();
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`).toBe(icon.sizes);
  }
  const appleUrl = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  if (!appleUrl) throw new Error("The page must link its Apple touch icon");
  const apple = await (await request.get(appleUrl)).body();
  expect(apple.readUInt32BE(16)).toBe(180);
  expect(apple.readUInt32BE(20)).toBe(180);
  const serviceWorker = await request.get("/sw.js");
  expect(serviceWorker.status()).toBe(200);
  expect(serviceWorker.headers()["cache-control"]).toContain("no-cache");
  expect(serviceWorker.headers()["service-worker-allowed"]).toBe("/");
  if (browserName === "chromium") {
    await ready(page);
    const session = await page.context().newCDPSession(page);
    const appManifest = await session.send("Page.getAppManifest");
    expect(appManifest.errors).toEqual([]);
    const installability = await session.send("Page.getInstallabilityErrors");
    expect(installability.installabilityErrors).toEqual([]);
    await session.detach();
  }
});

test.describe("real offline service-worker lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    const fixed = new Date("2026-07-01T12:34:56.000Z");
    await page.clock.install({ time: new Date(fixed.getTime() - 60_000) });
    await page.clock.pauseAt(fixed);
  });

  test("unvisited clock URLs, reload, invalid URLs and local edits work offline", async ({
    page,
    context,
    browserName,
    serverGate,
  }) => {
    test.info().annotations.push({
      type: "network condition",
      description:
        browserName === "chromium"
          ? "Browser offline and upstream server unavailable"
          : "Upstream server unavailable; real Service Worker fallback",
    });
    const url = (path: string) => `${serverGate.origin}${path}`;
    await page.goto(url("/utc"));
    await ready(page);
    serverGate.available(false);
    if (browserName === "chromium") await context.setOffline(true);
    const offline = await page.goto(url("/Europe~Berlin,Asia~Kathmandu,pst"));
    expect(offline?.status()).toBe(200);
    await expect(page.locator("#app")).toHaveAttribute("data-offline-shell", "true");
    if (browserName !== "chromium") expect(serverGate.blockedRequests()).toBeGreaterThan(0);
    await expect(page.locator(".digital-time")).toHaveText(["14:34:56", "18:19:56", "04:34:56"]);
    await page.reload();
    await expect(page.locator(".clock-card")).toHaveCount(3);
    await page.locator('[data-zone="pst"] [data-action="earlier"]').click();
    await expect(page).toHaveURL(/\/Europe~Berlin,pst,Asia~Kathmandu$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/Europe~Berlin,Asia~Kathmandu,pst$/);
    await page.goto(url("/jst,,utc"));
    await expect(page.locator(".clock-card")).toHaveCount(0);
    await expect(page.locator("#clock-grid")).toContainText("empty time zone");
    await page.getByRole("link", { name: "Back to your local clock", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".clock-card")).toHaveAttribute("data-zone", "et");
    serverGate.available(true);
    if (browserName === "chromium") await context.setOffline(false);
    const online = await page.goto(url("/jst,pt"));
    expect(online?.status()).toBe(200);
    await expect(page.locator("#app")).not.toHaveAttribute("data-offline-shell", "true");
    await expect(page.locator(".clock-card")).toHaveCount(2);
  });

  test("unchanged updates reuse a consistent cache and never turn missing assets into HTML", async ({
    page,
    context,
    browserName,
    serverGate,
  }) => {
    test.info().annotations.push({
      type: "network condition",
      description:
        browserName === "chromium"
          ? "Browser offline and upstream server unavailable"
          : "Upstream server unavailable; real Service Worker fallback",
    });
    const url = (path: string) => `${serverGate.origin}${path}`;
    await page.goto(url("/jst,utc"));
    await ready(page);
    const cacheKeys = await page.evaluate(() => caches.keys());
    expect(cacheKeys.filter((key) => key.startsWith("timepario-pwa-"))).toHaveLength(1);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });
    expect(await page.evaluate(() => caches.keys())).toEqual(cacheKeys);
    const invalid = await page.goto(url("/jst,,utc"));
    expect(invalid?.status()).toBe(400);
    const missing = await page.goto(url("/assets/missing.js"));
    expect(missing?.status()).toBe(404);
    await page.goto(url("/jst,utc"));
    serverGate.available(false);
    if (browserName === "chromium") await context.setOffline(true);
    const rejected = await page.evaluate(async () => {
      try {
        await fetch("/assets/not-cached.js");
        return false;
      } catch {
        return true;
      }
    });
    expect(rejected).toBe(true);
    if (browserName !== "chromium") expect(serverGate.blockedRequests()).toBeGreaterThan(0);
    await page.reload();
    await expect(page.locator("#app")).toHaveAttribute("data-offline-shell", "true");
    await expect(page.locator(".digital-time")).toHaveText(["21:34:56", "12:34:56"]);
  });
});
