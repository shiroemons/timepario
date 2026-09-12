export type PresentationMode = "fullscreen" | "expanded";

const viewQueryParameter = "view";
const expandedView = "expanded";

export function isExpandedView(search: string): boolean {
  return new URLSearchParams(search).get(viewQueryParameter) === expandedView;
}

export function urlForExpandedView(url: URL, active: boolean): string {
  const next = new URL(url.href);
  if (active) next.searchParams.set(viewQueryParameter, expandedView);
  else next.searchParams.delete(viewQueryParameter);
  return `${next.pathname}${next.search}${next.hash}`;
}

type PresentationOptions = {
  enter: HTMLButtonElement;
  expanded: HTMLButtonElement;
  exit: HTMLButtonElement;
  exitLabel: HTMLElement;
  controls: HTMLElement;
  hint: HTMLElement;
  hintText: string;
  fallbackText: string;
  exitFailureText: string;
  nativeExitText: string;
  expandedExitText: string;
  initialExpanded?: boolean;
  onChange: (active: boolean, mode: PresentationMode | null) => void;
};

export function enablePresentation(app: HTMLElement, options: PresentationOptions): () => void {
  let active = false;
  let nativeActive = false;
  let pending = false;
  let mode: PresentationMode | null = null;
  let trigger = options.enter;
  let generation = 0;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const originalTabIndex = app.getAttribute("tabindex");
  const events = new AbortController();
  const listenerOptions = { signal: events.signal };

  function stopIdle() {
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    idleTimer = undefined;
  }

  function wake() {
    stopIdle();
    app.classList.remove("is-idle");
    if (active && !document.hidden) {
      idleTimer = setTimeout(() => app.classList.add("is-idle"), 3000);
    }
  }

  function leave() {
    if (!active) return;
    const previousMode = mode;
    active = false;
    nativeActive = false;
    mode = null;
    generation++;
    stopIdle();
    app.classList.remove("is-presentation", "is-idle");
    options.controls.hidden = true;
    options.onChange(false, previousMode);
    if (originalTabIndex === null) app.removeAttribute("tabindex");
    else app.setAttribute("tabindex", originalTabIndex);
    options.enter.disabled = pending;
    options.expanded.disabled = pending;
    if (!pending) trigger.focus();
  }

  async function exit() {
    if (!active) return;
    if (document.fullscreenElement === app && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {
        options.hint.textContent = options.exitFailureText;
        wake();
        return;
      }
    }
    leave();
  }

  function fallback() {
    options.hint.textContent = options.fallbackText;
    options.exitLabel.textContent = options.expandedExitText;
  }

  async function enter(native: boolean) {
    if (active || pending) return;
    active = true;
    mode = native ? "fullscreen" : "expanded";
    trigger = native ? options.enter : options.expanded;
    const current = ++generation;
    app.classList.add("is-presentation");
    app.setAttribute("tabindex", "-1");
    options.controls.hidden = false;
    options.hint.textContent = options.hintText;
    options.exitLabel.textContent = native ? options.nativeExitText : options.expandedExitText;
    options.onChange(true, mode);
    app.focus();
    wake();
    if (!native) return;
    if (!app.requestFullscreen) {
      fallback();
      return;
    }
    pending = true;
    options.enter.disabled = true;
    options.expanded.disabled = true;
    try {
      await app.requestFullscreen();
      // 申請中に戻る操作があった場合、遅れて成功した全画面表示も解除する。
      if (current !== generation || !active) {
        if (document.fullscreenElement === app) await document.exitFullscreen?.();
      } else if (document.fullscreenElement === app) {
        nativeActive = true;
      } else {
        fallback();
      }
    } catch {
      if (active && current === generation) fallback();
    } finally {
      pending = false;
      options.enter.disabled = false;
      options.expanded.disabled = false;
      if (!active) trigger.focus();
    }
  }

  options.enter.disabled = false;
  options.expanded.disabled = false;
  options.enter.addEventListener("click", () => void enter(true), listenerOptions);
  options.expanded.addEventListener("click", () => void enter(false), listenerOptions);
  options.exit.addEventListener("click", exit, listenerOptions);
  document.addEventListener(
    "fullscreenchange",
    () => {
      if (document.fullscreenElement === app) {
        nativeActive = active;
      } else if (nativeActive) {
        nativeActive = false;
        leave();
      }
    },
    listenerOptions,
  );
  window.addEventListener("pointermove", wake, listenerOptions);
  window.addEventListener("pointerdown", wake, listenerOptions);
  window.addEventListener(
    "keydown",
    (event) => {
      if (!active) return;
      wake();
      if (event.key === "Escape") {
        event.preventDefault();
        void exit();
      } else if (event.key === "Tab") {
        // macOS の Tab 移動設定にかかわらず、唯一の操作である終了ボタンへ移動する。
        event.preventDefault();
        options.exit.focus();
      }
    },
    listenerOptions,
  );
  document.addEventListener("visibilitychange", wake, listenerOptions);
  window.addEventListener("pagehide", stopIdle, listenerOptions);
  window.addEventListener("pageshow", wake, listenerOptions);
  if (options.initialExpanded) void enter(false);
  return () => {
    leave();
    generation++;
    stopIdle();
    events.abort();
  };
}
