import { Hono } from "hono";
import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import { AppShell } from "../client/shell";
import { APP } from "../shared/config";
import { type Language, requestLanguage } from "../shared/language";
import { messagesFor } from "../shared/messages";
import { localizeZone, parsePath, ZoneInputError } from "../shared/zones";
import { serverMessagesFor } from "./messages";
import { PWA_VERSION } from "./pwa-version";

const app = new Hono();

app.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("Content-Language", requestLanguage(c.req.header("Accept-Language")));
  c.header("Vary", "Accept-Language");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "DENY");
  c.header("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  c.header(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
  await next();
});

function Document({
  children,
  title,
  description,
  language,
  canonicalUrl,
  noIndex = false,
}: {
  children: Child;
  title?: string;
  description?: string;
  language: Language;
  canonicalUrl?: string;
  noIndex?: boolean;
}) {
  const messages = serverMessagesFor(language);
  const pageTitle = title ?? `${messages.worldClocks} · ${APP.name}`;
  const pageDescription = description ?? messages.description;
  const imageUrl = canonicalUrl ? new URL("/og.png", canonicalUrl).href : undefined;
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang={language}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="description" content={pageDescription} />
          <meta name="color-scheme" content="dark light" />
          <meta name="theme-color" content="#141d21" />
          <meta name="apple-mobile-web-app-title" content={APP.name} />
          <title>{pageTitle}</title>
          {noIndex && <meta name="robots" content="noindex" />}
          {!noIndex && canonicalUrl && (
            <>
              <link rel="canonical" href={canonicalUrl} />
              <meta property="og:site_name" content={APP.name} />
              <meta property="og:type" content="website" />
              <meta property="og:locale" content={language === "ja" ? "ja_JP" : "en_US"} />
              <meta property="og:title" content={pageTitle} />
              <meta property="og:description" content={pageDescription} />
              <meta property="og:url" content={canonicalUrl} />
              <meta property="og:image" content={imageUrl} />
              <meta property="og:image:type" content="image/png" />
              <meta property="og:image:width" content="1200" />
              <meta property="og:image:height" content="630" />
              <meta property="og:image:alt" content={messages.imageAlt} />
              <meta name="twitter:card" content="summary_large_image" />
              <meta name="twitter:title" content={pageTitle} />
              <meta name="twitter:description" content={pageDescription} />
              <meta name="twitter:image" content={imageUrl} />
              <meta name="twitter:image:alt" content={messages.imageAlt} />
            </>
          )}
          <link rel="icon" type="image/svg+xml" href={`/favicon.svg?v=${PWA_VERSION}`} />
          <link rel="apple-touch-icon" href={`/icons/apple-touch-icon.png?v=${PWA_VERSION}`} />
          <link rel="manifest" href={`/manifest.webmanifest?v=${PWA_VERSION}`} />
          <link rel="stylesheet" href={`/assets/app.css?v=${PWA_VERSION}`} />
        </head>
        <body>{children}</body>
      </html>
    </>
  );
}

app.get("*", (c) => {
  const language = requestLanguage(c.req.header("Accept-Language"));
  const messages = serverMessagesFor(language);
  const requestUrl = new URL(c.req.url);
  const pathname = requestUrl.pathname;
  if (pathname === "/offline") {
    return c.html(
      <Document language={language} noIndex>
        <div
          id="app"
          data-mode="auto"
          data-zones="[]"
          data-offline-shell="true"
          data-build-revision={PWA_VERSION}
        >
          <AppShell mode="auto" zones={[]} language={language} />
        </div>
        <script type="module" src={`/assets/app.js?v=${PWA_VERSION}`} />
      </Document>,
    );
  }
  if (
    pathname.startsWith("/assets/") ||
    /\.(?:js|css|map|svg|png|jpg|ico|txt|webmanifest|woff2?)$/.test(pathname)
  ) {
    return c.text(messages.notFound, 404);
  }

  try {
    const state = parsePath(pathname);
    if (pathname !== state.canonicalPath) {
      return c.redirect(state.canonicalPath, 308);
    }
    const labels = new Intl.ListFormat(language, { type: "conjunction" }).format(
      state.zones.map((zone) => localizeZone(zone, language).label),
    );
    return c.html(
      <Document
        language={language}
        canonicalUrl={new URL(state.canonicalPath, requestUrl.origin).href}
        title={`${labels ? messages.clocksTitle(labels) : messages.worldClocks} · ${APP.name}`}
        description={labels ? messages.clocksDescription(labels) : messages.description}
      >
        <div id="app" data-mode={state.mode} data-zones={JSON.stringify(state.zones)}>
          <AppShell mode={state.mode} zones={state.zones} language={language} />
        </div>
        <script type="module" src={`/assets/app.js?v=${PWA_VERSION}`} />
      </Document>,
    );
  } catch (error) {
    if (!(error instanceof ZoneInputError)) throw error;
    return c.html(
      <Document language={language} title={`${messages.invalidTitle} · ${APP.name}`} noIndex>
        <main class="error-page">
          <a class="brand" href="/">
            {APP.name}
          </a>
          <h1>{messages.invalidTitle}</h1>
          <p>{messagesFor(language).errors[error.code]}</p>
          <a href="/">{messages.backHome}</a>
        </main>
      </Document>,
      400,
    );
  }
});

app.onError((error, c) => {
  const language = requestLanguage(c.req.header("Accept-Language"));
  const messages = serverMessagesFor(language);
  console.error("Could not render clock page:", error);
  return c.html(
    <Document language={language} title={`${messages.unavailableTitle} · ${APP.name}`} noIndex>
      <main class="error-page">
        <h1>{messages.unavailableTitle}</h1>
        <p>{messages.unavailable}</p>
        <a href="/">{messages.backHome}</a>
      </main>
    </Document>,
    500,
  );
});

export default app;
