import { APP } from "../shared/config";
import type { Language } from "../shared/language";
import { localizeZone, type Zone } from "../shared/zones";
import { SvgIcon } from "./icon";
import { facePath, uiFor } from "./messages";

export function AppShell({
  mode,
  zones,
  language,
}: {
  mode: "auto" | "explicit";
  zones: Zone[];
  language: Language;
}) {
  const ui = uiFor(language);
  const placeholders = zones.length ? zones.map((zone) => localizeZone(zone, language)) : [null];
  return (
    <main class="app-shell">
      <header class="app-header">
        <a class="brand" href="/" aria-label={APP.name}>
          <SvgIcon name="clock" />
          <span class="brand-label">{APP.name}</span>
        </a>
        <div class="header-actions">
          <button class="button" id="presentation-button" type="button" disabled>
            <SvgIcon name="expanded" />
            <span class="button-label" data-i18n="expandedView">
              {ui.expandedView}
            </span>
          </button>
          <button class="button" id="fullscreen-button" type="button" disabled>
            <SvgIcon name="fullscreen" />
            <span class="button-label" data-i18n="fullscreen">
              {ui.fullscreen}
            </span>
          </button>
          <button
            class="button share-button"
            id="share-button"
            type="button"
            title={ui.copyTitle}
            disabled
          >
            <SvgIcon name="copy" />
            <span class="button-label" data-i18n="share">
              {ui.share}
            </span>
          </button>
        </div>
      </header>
      <section class="workspace" aria-label={ui.tagline}>
        <div class="workspace-heading">
          <div>
            <h1 data-i18n="tagline">{ui.tagline}</h1>
            <p id="mode-note">{mode === "auto" ? ui.detecting : ui.explicit}</p>
          </div>
          <button class="button add-button" id="add-button" type="button" disabled>
            <SvgIcon name="plus" />
            <span class="button-label" data-i18n="add">
              {ui.add}
            </span>
          </button>
        </div>
        <div class="clock-grid" id="clock-grid" data-count={placeholders.length}>
          {placeholders.map((zone) => (
            <article class="clock-card placeholder" key={zone?.id ?? "auto"}>
              <div class="card-heading">
                <h2>{zone?.label ?? ui.loading}</h2>
                <p class="zone-description">{zone?.description ?? "\u00a0"}</p>
              </div>
              <div class="clock-body">
                <svg class="analog-clock" viewBox="0 0 200 200" aria-hidden="true">
                  <circle class="face" cx="100" cy="100" r="98" />
                  <path class="ticks" d={facePath} />
                  <circle class="pin" cx="100" cy="100" r="3" />
                </svg>
                <div class="clock-readout">
                  <p class="digital-time">--:--:--</p>
                  <p class="clock-date">&nbsp;</p>
                  <div class="clock-context">
                    <p class="clock-offset">&nbsp;</p>
                  </div>
                </div>
              </div>
              <div class="card-footer">
                <span class="zone-id">{zone?.timeZone ?? "\u00a0"}</span>
              </div>
            </article>
          ))}
        </div>
        <div class="workspace-meta">
          <div class="comparison-controls">
            <span id="capacity">{ui.capacity(placeholders.length)}</span>
            <label class="comparison-control" for="comparison-base">
              <span data-i18n="compareLabel">{ui.compareLabel}</span>
              <select id="comparison-base" aria-controls="clock-grid" disabled>
                <option value="" data-i18n="compareNone">
                  {ui.compareNone}
                </option>
              </select>
            </label>
          </div>
          <p id="limit-note" data-i18n="limit" hidden>
            {ui.limit}
          </p>
        </div>
        <p class="status" id="status" role="status" aria-live="polite" />
        <noscript>
          <p class="notice">{ui.javascript}</p>
        </noscript>
      </section>
      <footer class="app-footer">
        <span class="footer-mark">{APP.name}</span>
        <p data-i18n="limitation">{ui.limitation}</p>
      </footer>
      <div class="presentation-controls" id="presentation-controls" hidden>
        <p id="presentation-hint" role="status" aria-live="polite" />
        <button class="button" id="exit-fullscreen" type="button">
          <SvgIcon name="close" />
          <span class="button-label" id="presentation-exit-label" data-i18n="exitFullscreen">
            {ui.exitFullscreen}
          </span>
        </button>
      </div>
    </main>
  );
}
