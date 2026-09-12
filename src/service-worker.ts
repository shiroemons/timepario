/// <reference lib="webworker" />

export {};

declare const __PWA_VERSION__: string;
declare const __PRECACHE__: readonly { url: string; digest: string }[];

const worker = self as unknown as ServiceWorkerGlobalScope;
const prefix = "timepario-pwa-";
const cacheName = `${prefix}${__PWA_VERSION__}`;
const offlineUrl = `/offline?v=${__PWA_VERSION__}`;
const cachedUrls = new Set(
  __PRECACHE__.map(({ url }) => new URL(url, worker.location.origin).href),
);

async function install() {
  try {
    // 全レスポンスを検証してから保存し、デプロイ途中の別版を混在させない。
    const responses = await Promise.all(
      __PRECACHE__.map(async ({ url, digest }) => {
        const response = await fetch(new Request(url, { cache: "reload" }));
        if (!response.ok) throw new Error(`PWA asset unavailable: ${url} (${response.status})`);
        if (url === offlineUrl) {
          if (
            !(await response.clone().text()).includes(`data-build-revision="${__PWA_VERSION__}"`)
          ) {
            throw new Error("The offline shell belongs to a different build.");
          }
        } else {
          const bytes = await response.clone().arrayBuffer();
          const hash = Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            (byte) => byte.toString(16).padStart(2, "0"),
          ).join("");
          if (hash !== digest) throw new Error(`PWA asset revision mismatch: ${url}`);
        }
        return [url, response] as const;
      }),
    );
    const cache = await caches.open(cacheName);
    await Promise.all(responses.map(([url, response]) => cache.put(url, response)));
  } catch (error) {
    await caches.delete(cacheName);
    throw error;
  }
}

worker.addEventListener("install", (event) => event.waitUntil(install()));
worker.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(prefix) && name !== cacheName)
          .map((name) => caches.delete(name)),
      );
      await worker.clients.claim();
    })(),
  );
});

async function navigate(request: Request): Promise<Response> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 3000);
  try {
    // オンラインの 400/404 もそのまま返し、URL の入力誤りを隠さない。
    return await fetch(request, { signal: abort.signal });
  } catch {
    const cached = await (await caches.open(cacheName)).match(offlineUrl, { ignoreVary: true });
    return (
      cached ??
      new Response("TimePario is unavailable offline. Reconnect and reload.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  } finally {
    clearTimeout(timer);
  }
}

worker.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== worker.location.origin) return;
  if (cachedUrls.has(url.href)) {
    event.respondWith(
      (async () => {
        const cached = await (await caches.open(cacheName)).match(request, { ignoreVary: true });
        return cached ?? fetch(request);
      })(),
    );
  } else if (
    request.mode === "navigate" &&
    !url.pathname.startsWith("/assets/") &&
    !/^\/api(?:\/|$)/.test(url.pathname) &&
    !/\.[a-z0-9]+$/i.test(url.pathname)
  ) {
    event.respondWith(navigate(request));
  }
});
