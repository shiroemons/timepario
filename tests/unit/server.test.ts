import { describe, expect, it } from "vitest";
import app from "../../src/server/index";
import { PWA_VERSION } from "../../src/server/pwa-version";

describe("Worker HTML routes", () => {
  it("renders absolute canonical and social preview metadata from the request origin", async () => {
    const response = await app.request("https://preview.example:8443/jst,pt,utc?utm_source=share");
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("<title>Tokyo, Los Angeles, and UTC — world clocks · TimePario</title>");
    expect(html).toContain('rel="canonical" href="https://preview.example:8443/jst,pt,utc"');
    expect(html).toContain('property="og:url" content="https://preview.example:8443/jst,pt,utc"');
    expect(html).toContain('property="og:site_name" content="TimePario"');
    expect(html).toContain('property="og:type" content="website"');
    expect(html).toContain('property="og:locale" content="en_US"');
    expect(html).toContain('property="og:image" content="https://preview.example:8443/og.png"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).toContain(
      'property="og:image:alt" content="TimePario world clocks shown side by side"',
    );
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('name="twitter:image" content="https://preview.example:8443/og.png"');
    expect(html).toContain(
      'property="og:description" content="Compare the time in Tokyo, Los Angeles, and UTC, side by side.',
    );
    expect(html).not.toContain("utm_source");
  });

  it("localizes requested clock names and image descriptions for Japanese previews", async () => {
    const response = await app.request("https://time.example/jst,pt,utc", {
      headers: { "Accept-Language": "ja-JP" },
    });
    const html = await response.text();
    expect(html).toContain("<title>東京、ロサンゼルス、UTCの世界時計 · TimePario</title>");
    expect(html).toContain(
      'property="og:title" content="東京、ロサンゼルス、UTCの世界時計 · TimePario"',
    );
    expect(html).toContain(
      'property="og:description" content="東京、ロサンゼルス、UTCの時刻を並べて比較。',
    );
    expect(html).toContain('property="og:locale" content="ja_JP"');
    expect(html).toContain(
      'property="og:image:alt" content="TimeParioの世界時計を並べたプレビュー"',
    );
    expect(html).toContain(
      'name="twitter:title" content="東京、ロサンゼルス、UTCの世界時計 · TimePario"',
    );
    expect(html).toContain(
      'name="twitter:image:alt" content="TimeParioの世界時計を並べたプレビュー"',
    );
  });

  it("uses a generic home preview and canonical URLs for normalized IANA paths", async () => {
    const rootHtml = await (await app.request("https://time.example/?tracking=1")).text();
    const head = rootHtml.split("</head>")[0] ?? "";
    expect(head).toContain("<title>World clocks · TimePario</title>");
    expect(head).toContain('property="og:url" content="https://time.example/"');
    expect(head).not.toContain("Tokyo");
    expect(head).not.toContain("New York");
    const redirect = await app.request("https://time.example/JST,Asia~Tokyo,Europe~London");
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get("Location")).toBe("/jst,Europe~London");
    const canonicalHtml = await (
      await app.request("https://time.example/jst,Europe~London")
    ).text();
    expect(canonicalHtml).toContain(
      'property="og:url" content="https://time.example/jst,Europe~London"',
    );
  });

  it.each(["/offline", "/jst,,utc", "/xyz"])(
    "keeps internal or invalid pages out of indexing and clock previews: %s",
    async (path) => {
      const html = await (await app.request(`https://time.example${path}`)).text();
      expect(html).toContain('name="robots" content="noindex"');
      expect(html).not.toContain('property="og:');
      expect(html).not.toContain('name="twitter:');
      expect(html).not.toContain('rel="canonical"');
    },
  );

  it("does not inject query or invalid path text into social metadata", async () => {
    const payload = '<script>alert("metadata")</script>';
    const queryHtml = await (
      await app.request(`https://time.example/utc?text=${encodeURIComponent(payload)}`)
    ).text();
    expect(queryHtml).toContain('property="og:url" content="https://time.example/utc"');
    expect(queryHtml).not.toContain("alert");
    const invalid = await app.request(`https://time.example/${encodeURIComponent(payload)}`);
    expect(invalid.status).toBe(400);
    const invalidHtml = await invalid.text();
    expect(invalidHtml).not.toContain("alert");
    expect(invalidHtml).not.toMatch(/<script[^>]*>[^<]+<\/script>/);
    expect(invalidHtml).toContain('name="robots" content="noindex"');
  });

  it("negotiates Japanese per request without leaking language between responses", async () => {
    const [japanese, english] = await Promise.all([
      app.request("/jst,pt", { headers: { "Accept-Language": "en;q=0.5,ja-JP;q=1" } }),
      app.request("/jst,pt", { headers: { "Accept-Language": "fr-FR,en;q=0.8" } }),
    ]);
    const japaneseHtml = await japanese.text();
    expect(japanese.headers.get("Content-Language")).toBe("ja");
    expect(japanese.headers.get("Vary")).toContain("Accept-Language");
    expect(japaneseHtml).toContain('<html lang="ja">');
    expect(japaneseHtml).toContain("時計を追加");
    expect(japaneseHtml).toContain("東京");
    expect(japaneseHtml).toContain(
      "タイムゾーンの検出と時計の表示にはJavaScriptを有効にしてください。",
    );
    expect(english.headers.get("Content-Language")).toBe("en");
    expect(await english.text()).toContain("Add clock");
  });

  it("translates validation errors and preserves canonical redirects", async () => {
    const init = { headers: { "Accept-Language": "ja-JP" } };
    const invalid = await app.request("/jst,,utc", init);
    const html = await invalid.text();
    expect(invalid.status).toBe(400);
    expect(html).toContain("時計のリンクに空のタイムゾーンが含まれています。");
    expect(html).toContain("端末の時計に戻る");
    expect(html).not.toContain("This clock link");
    const redirect = await app.request("/JST,UTC", init);
    expect(redirect.headers.get("Location")).toBe("/jst,utc");
    const missing = await app.request("/assets/missing.js", init);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("ファイルが見つかりませんでした。");
  });

  it("renders a local placeholder without assuming the server time zone", async () => {
    const response = await app.request("/");
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('data-mode="auto"');
    expect(html).toContain("--:--:--");
    expect(html).toContain("<noscript>");
    expect(html).toContain(`src="/assets/app.js?v=${PWA_VERSION}"`);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src 'self'");
    expect(response.headers.get("Content-Security-Policy")).toContain("connect-src 'self'");
    expect(response.headers.get("Content-Security-Policy")).toContain("manifest-src 'self'");
    expect(response.headers.get("Content-Security-Policy")).toContain("worker-src 'self'");
  });

  it("links an installable manifest and icons with the same build revision", async () => {
    const html = await (await app.request("/utc")).text();
    expect(html).toContain(`href="/manifest.webmanifest?v=${PWA_VERSION}"`);
    expect(html).toContain(`href="/icons/apple-touch-icon.png?v=${PWA_VERSION}"`);
    expect(html).toContain('name="theme-color" content="#141d21"');
    expect(html).not.toContain("data-offline-shell");
  });

  it("provides a versioned offline shell without assuming a device or requested zone", async () => {
    const response = await app.request(`/offline?v=${PWA_VERSION}`, {
      headers: { "Accept-Language": "ja" },
    });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('data-offline-shell="true"');
    expect(html).toContain('data-mode="auto"');
    expect(html).toContain('data-zones="[]"');
    expect(html).toContain(`data-build-revision="${PWA_VERSION}"`);
    expect(html).toContain(`src="/assets/app.js?v=${PWA_VERSION}"`);
    expect(html).toContain("--:--:--");
    expect(html).toContain("時計を追加");
  });

  it("renders explicit clocks and preserves their requested order", async () => {
    const response = await app.request("/jst,pt,utc");
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('data-mode="explicit"');
    expect(html.indexOf("Asia/Tokyo")).toBeLessThan(html.indexOf("America/Los_Angeles"));
    expect(html).not.toMatch(/<script[^>]*>[^<]+<\/script>/);
  });

  it("redirects equivalent URLs to their canonical spelling once", async () => {
    const response = await app.request("/JST,Asia~Tokyo,UTC");
    expect(response.status).toBe(308);
    expect(response.headers.get("Location")).toBe("/jst,utc");
    expect((await app.request("/jst,utc")).status).toBe(200);
  });

  it.each(["/jst,,utc", "/xyz", "/%E0%A4%A", "/jst,pt,utc,et"])(
    "rejects invalid input with a recoverable 400: %s",
    async (path) => {
      const response = await app.request(path);
      expect(response.status).toBe(400);
      expect(await response.text()).toContain("Go to your local clock");
    },
  );

  it("does not treat missing assets as clock pages", async () => {
    for (const path of ["/assets/missing.js", "/missing.css", "/favicon.ico"]) {
      const response = await app.request(path);
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("text/plain");
    }
  });

  it("escapes malicious URL text in the error page", async () => {
    const response = await app.request(`/${encodeURIComponent('<img src=x onerror="alert(1)">')}`);
    const html = await response.text();
    expect(response.status).toBe(400);
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/<script[^>]*>[^<]+<\/script>/);
  });

  it.each(["/utc", "/offline", "/xyz"])(
    "loads the versioned theme bootstrap before styles under the existing CSP: %s",
    async (path) => {
      const response = await app.request(path);
      const html = await response.text();
      const bootstrap = `<script src="/assets/theme.js?v=${PWA_VERSION}"></script>`;
      expect(html).toContain(bootstrap);
      expect(html.indexOf(bootstrap)).toBeLessThan(html.indexOf('rel="stylesheet"'));
      expect(html).not.toMatch(/<script[^>]*>[^<]+<\/script>/);
      expect(response.headers.get("Content-Security-Policy")).not.toContain("unsafe-inline");
    },
  );
});
