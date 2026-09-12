export const iconPaths = {
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2",
  copy: "M8 8h12v13H8ZM16 8V3H3v13h5",
  check: "m5 12 4 4L19 6",
  plus: "M12 5v14M5 12h14",
  change: "M7 17 17 7M7 7h10v10",
  earlier: "m14 6-6 6 6 6",
  later: "m10 6 6 6-6 6",
  close: "m6 6 12 12M18 6 6 18",
  grip: "M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01",
  fullscreen: "M9 3H3v6M15 3h6v6M21 15v6h-6M9 21H3v-6",
  expanded: "M3 4h18v16H3ZM3 8h18",
} as const;

export type IconName = keyof typeof iconPaths;

export function createIcon(name: IconName): SVGSVGElement {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("class", "ui-icon");
  svg.setAttribute("data-icon", name);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", iconPaths[name]);
  svg.append(path);
  return svg;
}
