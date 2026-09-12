import { APP } from "../shared/config";
import { browserLanguage, dateLocale } from "../shared/language";
import { en, messagesFor } from "../shared/messages";
import { formatRelativeOffset, readClock, readZoneAbbreviation } from "../shared/time";
import {
  getCandidates,
  localizeZone,
  parsePath,
  pathForZones,
  resolveZone,
  type Zone,
  ZoneInputError,
  zoneFromTimeZone,
} from "../shared/zones";
import { createIcon, type IconName } from "./icons";
import { facePath, uiFor } from "./messages";
import { enablePresentation } from "./presentation";
import { registerPwa } from "./pwa";
import { enableReordering } from "./sortable";

const root = document.querySelector<HTMLElement>("#app");
if (root) initialize(root);

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = "") {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string>) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function initialize(app: HTMLElement) {
  const language = browserLanguage(
    navigator.languages.length ? navigator.languages : [navigator.language],
  );
  const ui = uiFor(language);
  document.documentElement.lang = language;
  for (const node of app.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const value = ui[node.dataset.i18n as keyof typeof ui];
    if (typeof value === "string") node.textContent = value;
  }
  app.querySelector(".workspace")?.setAttribute("aria-label", ui.tagline);
  function required<T extends HTMLElement>(selector: string): T {
    const node = app.querySelector<T>(selector);
    if (!node) throw new Error(`Missing application element: ${selector}`);
    return node;
  }
  const grid = required("#clock-grid");
  const addButton = required<HTMLButtonElement>("#add-button");
  const shareButton = required<HTMLButtonElement>("#share-button");
  shareButton.title = ui.copyTitle;
  let copyBusy = false;
  let copyGeneration = 0;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  const modeNote = required("#mode-note");
  const status = required("#status");
  const capacity = required("#capacity");
  const limitNote = required("#limit-note");
  const comparisonSelect = required<HTMLSelectElement>("#comparison-base");
  let comparisonBaseId: string | null = null;
  let presentationActive = false;
  const explicitHistory = new Map<string, Zone[]>();
  let mode: "auto" | "explicit" = app.dataset.mode === "auto" ? "auto" : "explicit";
  let zones: Zone[] = JSON.parse(app.dataset.zones ?? "[]") as Zone[];
  let stateReady = true;
  let automaticFallback = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let selectedIndex: number | null = null;
  let dialogTrigger: HTMLElement | null = null;
  let currentCandidates: Zone[] = [];
  let candidateOffsets: { zone: Zone; node: HTMLElement; name: HTMLElement }[] = [];
  let offsetMinute = -1;
  type ClockView = {
    zone: Zone;
    article: HTMLElement;
    time: HTMLElement;
    date: HTMLElement;
    offset: HTMLElement;
    period: HTMLElement;
    label: HTMLElement;
    identifier: HTMLElement;
    hour: SVGLineElement;
    minute: SVGLineElement;
    second: SVGLineElement;
    body: HTMLElement;
    error: HTMLElement;
  };
  let views: ClockView[] = [];

  const picker = element("dialog", "zone-dialog");
  picker.setAttribute("aria-labelledby", "picker-title");
  const pickerHeader = element("div", "dialog-header");
  const pickerTitle = element("h2", "", ui.addTitle);
  pickerTitle.id = "picker-title";
  const closePicker = element("button", "icon-button");
  closePicker.append(createIcon("close"));
  closePicker.type = "button";
  closePicker.setAttribute("aria-label", ui.close);
  pickerHeader.append(pickerTitle, closePicker);
  const searchLabel = element("label", "field-label", ui.searchLabel);
  searchLabel.htmlFor = "zone-search";
  const search = element("input", "search-input");
  search.id = "zone-search";
  search.type = "search";
  search.maxLength = 200;
  search.placeholder = ui.searchPlaceholder;
  search.autocomplete = "off";
  search.spellcheck = false;
  search.setAttribute("aria-describedby", "search-hint");
  const hint = element("p", "search-hint", ui.searchHint);
  hint.id = "search-hint";
  const results = element("ul", "zone-results");
  results.setAttribute("aria-label", ui.resultsLabel);
  picker.append(pickerHeader, searchLabel, search, hint, results);

  const shareDialog = element("dialog", "share-dialog");
  shareDialog.setAttribute("aria-labelledby", "share-title");
  const shareHeader = element("div", "dialog-header");
  const shareTitle = element("h2", "", ui.shareTitle);
  shareTitle.id = "share-title";
  const closeShare = element("button", "icon-button");
  closeShare.append(createIcon("close"));
  closeShare.type = "button";
  closeShare.setAttribute("aria-label", ui.close);
  shareHeader.append(shareTitle, closeShare);
  const shareExplanation = element("p", "search-hint", ui.copyFailed);
  const shareLabel = element("label", "field-label", ui.shareLabel);
  shareLabel.htmlFor = "share-url";
  const shareInput = element("input", "share-input");
  shareInput.id = "share-url";
  shareInput.readOnly = true;
  shareDialog.append(shareHeader, shareExplanation, shareLabel, shareInput);
  document.body.append(picker, shareDialog);

  function announce(message: string) {
    status.textContent = message;
  }

  function detectZone() {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!detected) throw new Error("Unavailable device time zone");
      zones = [zoneFromTimeZone(detected)];
      automaticFallback = false;
    } catch {
      zones = [{ id: "utc", timeZone: "UTC", ...en.zones.utc }];
      automaticFallback = true;
    }
  }

  function iconButton(
    action: string,
    index: number,
    label: string,
    icon: IconName,
    disabled = false,
  ) {
    const button = element("button", "icon-button");
    button.append(createIcon(icon));
    button.type = "button";
    button.dataset.action = action;
    button.dataset.index = String(index);
    button.setAttribute("aria-label", label);
    button.title = label;
    button.disabled = disabled;
    return button;
  }

  function buildCard(zone: Zone, index: number): ClockView {
    const article = element("article", "clock-card");
    article.dataset.zone = zone.id;
    article.setAttribute("aria-label", ui.clockLabel(zone.label));
    const heading = element("div", "card-heading");
    const title = element("h2");
    const change = element("button", "zone-change");
    const label = element("span", "zone-label", zone.label);
    change.append(label, createIcon("change"));
    change.type = "button";
    change.disabled = presentationActive;
    change.dataset.action = "change";
    change.dataset.index = String(index);
    change.setAttribute("aria-label", ui.change(zone.label));
    title.append(change);
    heading.append(title, element("p", "zone-description", zone.description));
    const body = element("div", "clock-body");
    const face = svg("svg", {
      class: "analog-clock",
      viewBox: "0 0 200 200",
      "aria-hidden": "true",
    });
    face.append(
      svg("circle", { class: "face", cx: "100", cy: "100", r: "98" }),
      svg("path", { class: "ticks", d: facePath }),
    );
    for (const [value, x, y] of [
      ["12", "100", "37"],
      ["3", "168", "104"],
      ["6", "100", "171"],
      ["9", "32", "104"],
    ]) {
      const numeral = svg("text", {
        class: "numeral",
        x: x ?? "",
        y: y ?? "",
        "text-anchor": "middle",
      });
      numeral.textContent = value ?? "";
      face.append(numeral);
    }
    const hour = svg("line", { class: "hand-hour", x1: "100", y1: "104", x2: "100", y2: "53" });
    const minute = svg("line", { class: "hand-minute", x1: "100", y1: "107", x2: "100", y2: "35" });
    const second = svg("line", { class: "hand-second", x1: "100", y1: "115", x2: "100", y2: "28" });
    face.append(
      hour,
      minute,
      second,
      svg("circle", { class: "pin", cx: "100", cy: "100", r: "4" }),
      svg("circle", { class: "pin-core", cx: "100", cy: "100", r: "1.5" }),
    );
    const readout = element("div", "clock-readout");
    const time = element("p", "digital-time", "--:--:--");
    const date = element("p", "clock-date", "\u00a0");
    const offset = element("p", "clock-offset", "\u00a0");
    const period = element("span", "day-period");
    const context = element("div", "clock-context");
    context.append(offset, period);
    readout.append(time, date, context);
    body.append(face, readout);
    const error = element("p", "clock-error", ui.unsupported);
    error.hidden = true;
    const footer = element("div", "card-footer");
    const actions = element("div", "card-actions");
    const drag = iconButton("drag", index, ui.drag(zone.label), "grip", zones.length === 1);
    drag.classList.add("drag-handle");
    actions.append(
      drag,
      iconButton("earlier", index, ui.earlier(zone.label), "earlier", index === 0),
      iconButton("later", index, ui.later(zone.label), "later", index === zones.length - 1),
      iconButton(
        "remove",
        index,
        zones.length === 1 ? ui.keepOne : ui.remove(zone.label),
        "close",
        zones.length === 1,
      ),
    );
    const identifier = element("span", "zone-id", zone.timeZone);
    identifier.title = zone.timeZone;
    footer.append(identifier, actions);
    article.append(heading, body, error, footer);
    return {
      zone,
      article,
      body,
      error,
      time,
      date,
      offset,
      period,
      label,
      identifier,
      hour,
      minute,
      second,
    };
  }

  function renderCards() {
    copyGeneration++;
    showCopyFeedback();
    stateReady = true;
    zones = zones.map((zone) => localizeZone(zone, language));
    if (!zones.some((zone) => zone.id === comparisonBaseId)) comparisonBaseId = null;
    const none = element("option", "", ui.compareNone);
    none.value = "";
    comparisonSelect.replaceChildren(
      none,
      ...zones.map((zone) => {
        const option = element("option", "", zone.label);
        option.value = zone.id;
        return option;
      }),
    );
    comparisonSelect.value = comparisonBaseId ?? "";
    comparisonSelect.disabled = !zones.length;
    views = zones.map(buildCard);
    grid.replaceChildren(...views.map((view) => view.article));
    grid.dataset.count = String(zones.length);
    capacity.textContent = ui.capacity(zones.length);
    addButton.disabled = zones.length >= APP.maxClocks;
    addButton.setAttribute("aria-describedby", "limit-note");
    shareButton.disabled = copyBusy || !zones.length;
    limitNote.hidden = zones.length < APP.maxClocks;
    modeNote.textContent =
      mode === "auto" ? (automaticFallback ? ui.fallback : ui.automatic) : ui.explicit;
    updateTime();
  }

  function updateTime() {
    if (document.hidden) return;
    const now = new Date();
    const offsets = new Map<string, number>();
    if (picker.open && Math.floor(now.getTime() / 60_000) !== offsetMinute) updateOffsets(now);
    for (const view of views) {
      try {
        const clock = readClock(now, view.zone.timeZone, dateLocale(language));
        offsets.set(view.zone.id, clock.offsetSeconds);
        view.time.textContent = clock.time;
        view.date.textContent = clock.date;
        view.offset.textContent = clock.offset;
        view.period.textContent = ui[clock.dayPeriod];
        view.label.textContent = `${view.zone.label} (${readZoneAbbreviation(now, view.zone.timeZone)})`;
        view.article.dataset.period = clock.dayPeriod;
        view.hour.setAttribute("transform", `rotate(${clock.hourAngle} 100 100)`);
        view.minute.setAttribute("transform", `rotate(${clock.minuteAngle} 100 100)`);
        view.second.setAttribute("transform", `rotate(${clock.secondAngle} 100 100)`);
        view.body.hidden = false;
        view.error.hidden = true;
      } catch {
        delete view.article.dataset.period;
        view.period.textContent = "";
        view.label.textContent = view.zone.label;
        view.body.hidden = true;
        view.error.hidden = false;
      }
    }
    const base = zones.find((zone) => zone.id === comparisonBaseId);
    const baseOffset = base ? offsets.get(base.id) : undefined;
    for (const view of views) {
      if (!base) {
        view.identifier.textContent = view.zone.timeZone;
        view.identifier.removeAttribute("aria-label");
        view.identifier.removeAttribute("role");
        delete view.identifier.dataset.comparison;
        continue;
      }
      const offset = offsets.get(view.zone.id);
      const difference =
        baseOffset === undefined || offset === undefined
          ? ui.comparisonUnavailable
          : formatRelativeOffset(offset - baseOffset, language);
      view.identifier.dataset.comparison = "true";
      view.identifier.setAttribute("role", "note");
      view.identifier.setAttribute("aria-label", ui.comparisonAccessible(base.label, difference));
      view.identifier.textContent =
        baseOffset === undefined || offset === undefined
          ? difference
          : view.zone.id === base.id
            ? ui.comparisonBase(difference)
            : ui.comparisonValue(difference);
    }
  }

  function stopTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function schedule() {
    stopTimer();
    if (document.hidden) return;
    timer = setTimeout(
      () => {
        updateTime();
        schedule();
      },
      1000 - (Date.now() % 1000),
    );
  }

  function resume() {
    stopTimer();
    if (document.hidden || !stateReady) return;
    if (mode === "auto") {
      const previous = zones[0]?.id;
      const previousFallback = automaticFallback;
      detectZone();
      if (previous !== zones[0]?.id || previousFallback !== automaticFallback) renderCards();
      else updateTime();
    } else updateTime();
    schedule();
  }

  function commit(next: Zone[], message: string, focusIndex = 0) {
    next = next.filter(
      (zone, index, all) =>
        all.findIndex((other) => other.id.toLowerCase() === zone.id.toLowerCase()) === index,
    );
    if (!next.length || next.length > APP.maxClocks) return;
    const path = pathForZones(next);
    if (path !== location.pathname) history.pushState(null, "", path);
    explicitHistory.set(path, [...next]);
    zones = next;
    mode = "explicit";
    renderCards();
    announce(message);
    grid
      .querySelector<HTMLButtonElement>(`[data-action="change"][data-index="${focusIndex}"]`)
      ?.focus();
  }

  function showResults() {
    const now = new Date();
    const query = search.value.trim().toLowerCase();
    let candidates = currentCandidates.filter((zone) => {
      if (!query) return true;
      const translated = localizeZone(zone, language);
      let abbreviation = "";
      try {
        abbreviation = readZoneAbbreviation(now, zone.timeZone);
      } catch {
        // 候補の名前は残し、読めない時差は一覧の更新時に案内する。
      }
      return `${zone.label} ${zone.timeZone} ${zone.id} ${zone.description} ${translated.label} ${translated.description} ${abbreviation}`
        .toLowerCase()
        .includes(query);
    });
    if (query) {
      try {
        const typed = resolveZone(search.value.trim());
        if (!candidates.some((zone) => zone.timeZone === typed.timeZone))
          candidates = [typed, ...candidates];
      } catch {
        // 部分入力中は候補を検索し、無効な入力は一致する候補なしとして表示する。
      }
    }
    results.replaceChildren();
    candidateOffsets = [];
    for (const original of candidates) {
      const candidate = localizeZone(original, language);
      const item = element("li");
      const option = element("button", "zone-option");
      option.type = "button";
      const duplicate = zones.some(
        (zone, index) =>
          index !== selectedIndex && zone.id.toLowerCase() === candidate.id.toLowerCase(),
      );
      option.disabled = duplicate;
      const content = element("span", "option-content");
      const name = element("span", "option-name", candidate.label);
      const description = candidate.description.startsWith(candidate.timeZone)
        ? candidate.description
        : `${candidate.timeZone} · ${candidate.description}`;
      content.append(
        name,
        element("span", "option-detail", `${description}${duplicate ? ` · ${ui.selected}` : ""}`),
      );
      const offset = element("span", "option-offset");
      candidateOffsets.push({ zone: candidate, node: offset, name });
      option.append(content, offset);
      option.addEventListener("click", () => {
        const next = [...zones];
        const focusIndex = selectedIndex ?? next.length;
        if (selectedIndex === null) next.push(candidate);
        else next[selectedIndex] = candidate;
        const message =
          selectedIndex === null ? ui.added(candidate.label) : ui.changed(candidate.label);
        dialogTrigger = null;
        picker.close();
        commit(next, message, focusIndex);
      });
      item.append(option);
      results.append(item);
    }
    if (!candidates.length) results.append(element("li", "empty-results", ui.noResults));
    updateOffsets(now);
  }

  function updateOffsets(now: Date) {
    offsetMinute = Math.floor(now.getTime() / 60_000);
    for (const { zone, node, name } of candidateOffsets) {
      try {
        node.textContent = readClock(now, zone.timeZone).offset;
        name.textContent = `${zone.label} (${readZoneAbbreviation(now, zone.timeZone)})`;
        node.removeAttribute("title");
      } catch {
        node.textContent = "—";
        name.textContent = zone.label;
        node.title = ui.unsupported;
      }
    }
  }

  function openPicker(index: number | null, trigger: HTMLElement) {
    selectedIndex = index;
    dialogTrigger = trigger;
    pickerTitle.textContent = index === null ? ui.addTitle : ui.changeTitle;
    search.value = "";
    currentCandidates = getCandidates();
    showResults();
    picker.showModal();
    search.focus();
  }

  addButton.addEventListener("click", () => openPicker(null, addButton));
  comparisonSelect.addEventListener("change", () => {
    comparisonBaseId = zones.some((zone) => zone.id === comparisonSelect.value)
      ? comparisonSelect.value
      : null;
    updateTime();
  });
  search.addEventListener("input", showResults);
  search.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      results.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    }
  });
  results.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const options = [...results.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const destination = index + (event.key === "ArrowDown" ? 1 : -1);
    if (destination < 0) search.focus();
    else options[destination]?.focus();
  });
  picker.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      picker.close();
    }
  });
  for (const dialog of [picker, shareDialog]) {
    dialog.onclick = (event) => event.target === dialog && dialog.close();
  }
  closePicker.addEventListener("click", () => picker.close());
  closeShare.addEventListener("click", () => shareDialog.close());
  picker.addEventListener("close", () => {
    if (dialogTrigger?.isConnected) dialogTrigger.focus();
  });
  shareDialog.addEventListener("close", () => shareButton.focus());
  grid.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-action]");
    if (!button || button.disabled || button.dataset.action === "drag") return;
    const index = Number(button.dataset.index);
    const zone = zones[index];
    if (!zone) return;
    if (button.dataset.action === "change") {
      openPicker(index, button);
      return;
    }
    const next = [...zones];
    if (button.dataset.action === "remove" && next.length > 1) {
      next.splice(index, 1);
      commit(next, ui.removed(zone.label), Math.min(index, next.length - 1));
    } else {
      const destination = index + (button.dataset.action === "earlier" ? -1 : 1);
      const other = next[destination];
      if (!other) return;
      next[index] = other;
      next[destination] = zone;
      commit(next, ui.moved(zone.label), destination);
    }
  });
  enableReordering(grid, (from, to) => {
    if (from === to || !zones[from] || !zones[to]) return;
    const next = [...zones];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    commit(next, ui.moved(moved.label), to);
    grid.querySelector<HTMLButtonElement>(`[data-action="drag"][data-index="${to}"]`)?.focus();
  });
  function showCopyFeedback(success = false) {
    if (copyTimer !== undefined) clearTimeout(copyTimer);
    copyTimer = undefined;
    shareButton.replaceChildren(
      createIcon(success ? "check" : "copy"),
      element("span", "button-label", success ? ui.copySuccess : ui.share),
    );
    if (success) shareButton.dataset.copyState = "success";
    else delete shareButton.dataset.copyState;
  }

  shareButton.addEventListener("click", async () => {
    if (copyBusy || !stateReady || !zones.length) return;
    showCopyFeedback();
    const generation = ++copyGeneration;
    copyBusy = true;
    shareButton.disabled = true;
    shareButton.setAttribute("aria-busy", "true");
    const url = new URL(pathForZones(zones), location.origin).href;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(url);
      if (generation !== copyGeneration) return;
      showCopyFeedback(true);
      copyTimer = setTimeout(() => showCopyFeedback(), 2000);
      announce(ui.copied);
    } catch {
      if (generation !== copyGeneration) return;
      announce(ui.copyFailed);
      shareInput.value = url;
      if (!shareDialog.open) shareDialog.showModal();
      shareInput.focus();
      shareInput.select();
    } finally {
      copyBusy = false;
      shareButton.disabled = !stateReady || !zones.length;
      shareButton.removeAttribute("aria-busy");
    }
  });
  window.addEventListener("popstate", () => {
    picker.close();
    shareDialog.close();
    const cached = explicitHistory.get(location.pathname);
    try {
      if (cached) {
        mode = "explicit";
        zones = [...cached];
      } else {
        const parsed = parsePath(location.pathname);
        mode = parsed.mode;
        zones = parsed.zones;
        if (mode === "auto") detectZone();
        else explicitHistory.set(parsed.canonicalPath, [...zones]);
        if (parsed.canonicalPath !== location.pathname)
          history.replaceState(null, "", parsed.canonicalPath);
      }
      announce("");
      renderCards();
      schedule();
    } catch (error) {
      showStateError(error);
    }
  });

  function showStateError(error: unknown) {
    copyGeneration++;
    showCopyFeedback();
    stateReady = false;
    stopTimer();
    views = [];
    zones = [];
    const messages = messagesFor(language);
    const message = error instanceof ZoneInputError ? messages.errors[error.code] : ui.stateError;
    const notice = element("div", "notice");
    const home = element("a", "button", ui.returnHome);
    home.href = "/";
    notice.append(element("h2", "", messages.invalidUrl), element("p", "", message), home);
    grid.replaceChildren(notice);
    addButton.disabled = true;
    shareButton.disabled = true;
    comparisonBaseId = null;
    comparisonSelect.value = "";
    comparisonSelect.disabled = true;
    capacity.textContent = ui.capacity(0);
    modeNote.textContent = messages.invalidUrl;
    limitNote.hidden = true;
    announce(message);
  }
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("focus", resume);
  window.addEventListener("pageshow", resume);
  window.addEventListener("pagehide", () => {
    stopTimer();
    copyGeneration++;
    showCopyFeedback();
  });
  enablePresentation(app, {
    enter: required<HTMLButtonElement>("#fullscreen-button"),
    expanded: required<HTMLButtonElement>("#presentation-button"),
    exit: required<HTMLButtonElement>("#exit-fullscreen"),
    exitLabel: required("#presentation-exit-label"),
    controls: required("#presentation-controls"),
    hint: required("#presentation-hint"),
    hintText: ui.fullscreenHint,
    fallbackText: ui.fullscreenFallback,
    exitFailureText: ui.fullscreenExitFailure,
    nativeExitText: ui.exitFullscreen,
    expandedExitText: ui.exitExpanded,
    onChange(active) {
      presentationActive = active;
      if (active) {
        copyGeneration++;
        showCopyFeedback();
        dialogTrigger = null;
        picker.close();
        shareDialog.close();
      }
      for (const change of grid.querySelectorAll<HTMLButtonElement>(".zone-change")) {
        change.disabled = active;
      }
    },
  });
  registerPwa(() => announce(ui.offlineUnavailable));

  if (app.dataset.offlineShell === "true") {
    try {
      const parsed = parsePath(location.pathname);
      mode = parsed.mode;
      zones = parsed.zones;
      if (parsed.canonicalPath !== location.pathname)
        history.replaceState(null, "", parsed.canonicalPath);
    } catch (error) {
      showStateError(error);
      return;
    }
  }

  if (mode === "auto") detectZone();
  else {
    const canonical = pathForZones(zones);
    explicitHistory.set(canonical, [...zones]);
    if (canonical !== location.pathname) history.replaceState(null, "", canonical);
  }
  renderCards();
  schedule();
}
