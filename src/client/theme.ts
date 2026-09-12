// 描画前に読み込む独立スクリプト。時計の起動やネットワークを待たずに配色を決める。
(() => {
  const key = "timepario-theme";
  const root = document.documentElement;
  const system = matchMedia("(prefers-color-scheme: dark)");
  const color = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  let options: HTMLButtonElement[] = [];
  let preference = "system";
  let memoryOnly = false;

  function normalize(value: string | null) {
    return value === "light" || value === "dark" ? value : "system";
  }

  function apply() {
    const resolved = preference === "system" ? (system.matches ? "dark" : "light") : preference;
    root.dataset.theme = resolved;
    if (color) color.content = resolved === "dark" ? "#151e1b" : "#f5f5ef";
    for (const option of options) {
      const selected = option.dataset.themeOption === preference;
      option.setAttribute("aria-pressed", String(selected));
      option.dataset.selected = String(selected);
    }
  }

  function restore() {
    try {
      if (!memoryOnly) preference = normalize(localStorage.getItem(key));
    } catch {
      // 保存領域を拒否するブラウザーでも、このページ内で選んだ設定は維持する。
    }
    apply();
  }

  restore();
  system.addEventListener("change", apply);
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) restore();
  });
  window.addEventListener("pageshow", restore);
  document.addEventListener("DOMContentLoaded", () => {
    options = [...document.querySelectorAll<HTMLButtonElement>("[data-theme-option]")];
    if (!options.length) return;
    const labels =
      document.documentElement.lang === "ja"
        ? ["テーマ", "システム", "ライト", "ダーク"]
        : ["Theme", "System", "Light", "Dark"];
    document.querySelector(".theme-control legend")?.replaceChildren(labels[0] ?? "");
    for (const option of options) {
      const label =
        labels[
          option.dataset.themeOption === "system"
            ? 1
            : option.dataset.themeOption === "light"
              ? 2
              : 3
        ];
      if (label) {
        option.setAttribute("aria-label", label);
        option.title = label;
      }
      option.disabled = false;
      option.addEventListener("click", () => {
        preference = normalize(option.dataset.themeOption ?? null);
        apply();
        try {
          localStorage.setItem(key, preference);
        } catch {
          // 永続化できなくても表示切替を利用できるよう、メモリー内の選択を優先する。
          memoryOnly = true;
        }
      });
    }
    apply();
  });
})();
