import { type IconName, iconPaths } from "./icons";

export function SvgIcon({ name }: { name: IconName }) {
  return (
    <svg class="ui-icon" data-icon={name} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={iconPaths[name]} />
    </svg>
  );
}
