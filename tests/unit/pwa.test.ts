import { createHash, webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { transform } from "esbuild";
import { afterEach, describe, expect, it, vi } from "vitest";

const origin = "https://timepario.test";
const asset = "console.log('clock')";
const digest = createHash("sha256").update(asset).digest("hex");
type StoredCaches = Map<string, Map<string, Response>>;

async function harness(version = "v1", stored: StoredCaches = new Map()) {
  const handlers = new Map<string, (event: unknown) => void>();
  const key = (request: string | Request) =>
    new URL(typeof request === "string" ? request : request.url, origin).href;
  const fetcher = vi.fn(async (request: Request | string): Promise<Response> => {
    return new Response(
      key(request).includes("/offline?")
        ? `<div data-build-revision="${version}">offline shell</div>`
        : asset,
    );
  });
  const claim = vi.fn(async () => {});
  const skipWaiting = vi.fn();
  const cacheStorage = {
    keys: async () => [...stored.keys()],
    delete: async (name: string) => stored.delete(name),
    open: async (name: string) => {
      if (!stored.has(name)) stored.set(name, new Map());
      const values = stored.get(name);
      return {
        put: async (request: Request | string, response: Response) =>
          values?.set(key(request), response.clone()),
        match: async (request: Request | string) => values?.get(key(request))?.clone(),
      };
    },
  };
  const source = await readFile("src/service-worker.ts", "utf8");
  const { code } = await transform(source, {
    loader: "ts",
    format: "iife",
    define: {
      __PWA_VERSION__: JSON.stringify(version),
      __PRECACHE__: JSON.stringify([
        { url: `/assets/app.js?v=${version}`, digest },
        { url: `/offline?v=${version}`, digest: "" },
      ]),
    },
  });
  runInNewContext(code, {
    self: {
      location: { origin },
      clients: { claim },
      skipWaiting,
      addEventListener: (name: string, listener: (event: unknown) => void) =>
        handlers.set(name, listener),
    },
    caches: cacheStorage,
    fetch: fetcher,
    crypto: webcrypto,
    Request: class extends Request {
      constructor(url: string, options?: RequestInit) {
        super(new URL(url, origin), options);
      }
    },
    Response,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
  });
  async function lifecycle(name: string) {
    let work: Promise<unknown> | undefined;
    handlers.get(name)?.({
      waitUntil: (promise: Promise<unknown>) => {
        work = promise;
      },
    });
    await work;
  }
  function request(path: string, navigation = false, method = "GET") {
    const req = new Request(new URL(path, origin), { method });
    if (navigation) Object.defineProperty(req, "mode", { value: "navigate" });
    let response: Promise<Response> | undefined;
    handlers.get("fetch")?.({
      request: req,
      respondWith: (promise: Promise<Response>) => {
        response = promise;
      },
    });
    return response;
  }
  return { stored, fetcher, claim, skipWaiting, lifecycle, request };
}

afterEach(() => vi.useRealTimers());

describe("PWA cache lifecycle", () => {
  it("installs validated assets, preserves unrelated caches, and only then claims pages", async () => {
    const caches: StoredCaches = new Map([
      ["timepario-pwa-old", new Map()],
      ["unrelated-app", new Map()],
    ]);
    const worker = await harness("v1", caches);
    await worker.lifecycle("install");
    expect(worker.skipWaiting).not.toHaveBeenCalled();
    expect(worker.claim).not.toHaveBeenCalled();
    await worker.lifecycle("activate");
    expect([...caches.keys()].sort()).toEqual(["timepario-pwa-v1", "unrelated-app"]);
    expect(worker.claim).toHaveBeenCalledOnce();
    const calls = worker.fetcher.mock.calls.length;
    expect(await (await worker.request("/assets/app.js?v=v1"))?.text()).toBe(asset);
    expect(worker.fetcher.mock.calls).toHaveLength(calls);
    expect(worker.request("/assets/app.js?v=v2")).toBeUndefined();
  });

  it("keeps the previous offline version after an incomplete update and replaces it after a valid update", async () => {
    const first = await harness();
    await first.lifecycle("install");
    const update = await harness("v2", first.stored);
    update.fetcher.mockResolvedValue(new Response("different deployment"));
    await expect(update.lifecycle("install")).rejects.toThrow(/revision|different build/);
    expect([...first.stored.keys()]).toEqual(["timepario-pwa-v1"]);
    const valid = await harness("v2", first.stored);
    await valid.lifecycle("install");
    expect(first.stored.has("timepario-pwa-v1")).toBe(true);
    await valid.lifecycle("activate");
    expect([...first.stored.keys()]).toEqual(["timepario-pwa-v2"]);
  });

  it("uses the shell only for failed navigations and preserves online errors", async () => {
    const worker = await harness();
    await worker.lifecycle("install");
    worker.fetcher.mockResolvedValue(new Response("invalid zone", { status: 400 }));
    expect((await worker.request("/invalid", true))?.status).toBe(400);
    worker.fetcher.mockRejectedValue(new TypeError("Offline"));
    expect(await (await worker.request("/jst,pt", true))?.text()).toContain("offline shell");
    for (const path of [
      "/assets/missing.js",
      "/missing.png",
      "/api/data",
      "https://other.test/utc",
    ])
      expect(worker.request(path, true)).toBeUndefined();
    expect(worker.request("/utc", true, "POST")).toBeUndefined();
  });

  it("falls back after the navigation timeout without waiting indefinitely", async () => {
    vi.useFakeTimers();
    const worker = await harness();
    await worker.lifecycle("install");
    worker.fetcher.mockImplementation((_request, ...rest: unknown[]) => {
      const options = rest[0] as RequestInit;
      return new Promise((_resolve, reject) =>
        options.signal?.addEventListener("abort", () => reject(new Error("Aborted"))),
      );
    });
    const response = worker.request("/jst,utc", true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await (await response)?.text()).toContain("offline shell");
  });
});
