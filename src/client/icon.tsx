import { type IconName, iconPaths } from "./icons";

const themeIconPaths = {
  "theme-system": "M4 5h16v12H4ZM8 21h8M12 17v4",
  "theme-light":
    "M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.42 1.42M16.94 16.94l1.42 1.42M5.64 18.36l1.42-1.42M16.94 7.06l1.42-1.42M16 12a4 4 0 1 1-8 0 4 4 0 1 1 8 0",
  "theme-dark": "M20 15.4A8 8 0 0 1 8.6 4 8.5 8.5 0 1 0 20 15.4Z",
} as const;

type SvgIconName = IconName | keyof typeof themeIconPaths;

function iconPath(name: SvgIconName) {
  return name in themeIconPaths
    ? themeIconPaths[name as keyof typeof themeIconPaths]
    : iconPaths[name as IconName];
}

export function SvgIcon({ name }: { name: SvgIconName }) {
  return (
    <svg class="ui-icon" data-icon={name} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={iconPath(name)} />
    </svg>
  );
}
