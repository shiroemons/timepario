import { APP } from "./config";
import type { Language } from "./language";
import { en, messagesFor } from "./messages";
import { japaneseZoneNames } from "./zone-names-ja";

export interface Zone {
  id: string;
  timeZone: string;
  label: string;
  description: string;
}

export interface ParsedPath {
  mode: "auto" | "explicit";
  zones: Zone[];
  canonicalPath: string;
}

export class ZoneInputError extends Error {
  readonly code: keyof typeof en.errors;

  constructor(code: keyof typeof en.errors) {
    super(en.errors[code]);
    this.name = "ZoneInputError";
    this.code = code;
  }
}

const aliases = {
  jst: "Asia/Tokyo",
  pst: "Etc/GMT+8",
  pt: "America/Los_Angeles",
  utc: "UTC",
  et: "America/New_York",
} as const;

type Alias = keyof typeof aliases;
const japaneseZoneNamesByLowercase = new Map(
  Object.entries(japaneseZoneNames).map(([timeZone, name]) => [timeZone.toLowerCase(), name]),
);

function japaneseZoneLabel(timeZone: string): string {
  const translated = japaneseZoneNamesByLowercase.get(timeZone.toLowerCase());
  if (translated) return translated;
  try {
    const formatter = new Intl.DateTimeFormat("ja", { timeZone, timeZoneName: "longGeneric" });
    const canonical = formatter.resolvedOptions().timeZone;
    const canonicalName = japaneseZoneNamesByLowercase.get(canonical.toLowerCase());
    if (canonicalName) return canonicalName;
    // CLDR に未収録の新しい地域でも、実行環境が持つ日本語の時間帯名を表示する。
    const zoneName = formatter
      .formatToParts(new Date(0))
      .find((part) => part.type === "timeZoneName")?.value;
    return zoneName ? `${zoneName}の地域` : "地域のタイムゾーン";
  } catch (error) {
    // サーバーで検証済みでも端末の ICU が非対応なら、時刻欄でエラーを案内する。
    if (!(error instanceof RangeError)) throw error;
    return "未対応のタイムゾーン";
  }
}

// 表示だけを翻訳し、識別子とタイムゾーンはURL・時刻計算用に維持する。
export function localizeZone(zone: Zone, language: Language): Zone {
  const messages = messagesFor(language);
  const alias = aliasFor(zone.timeZone);
  if (alias) return { ...zone, ...messages.zones[alias] };
  const englishLabel = zone.timeZone.split("/").at(-1)?.replaceAll("_", " ") ?? zone.timeZone;
  return {
    ...zone,
    label: language === "ja" ? japaneseZoneLabel(zone.timeZone) : englishLabel,
    description: `${zone.timeZone} · ${messages.zones.iana}`,
  };
}
const majorRegions = [
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
  "America/Chicago",
  "America/Denver",
  "America/Toronto",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Africa/Johannesburg",
  "Africa/Cairo",
] as const;

function aliasZone(id: Alias): Zone {
  return { id, timeZone: aliases[id], ...en.zones[id] };
}

function aliasFor(timeZone: string): Alias | undefined {
  return (Object.keys(aliases) as Alias[]).find(
    (id) => aliases[id].toLowerCase() === timeZone.toLowerCase(),
  );
}

function validateIdentifier(identifier: string): void {
  if (
    identifier.length === 0 ||
    identifier.length > 100 ||
    !/^[A-Za-z][A-Za-z0-9_+-]*(?:[~/][A-Za-z0-9_+-]+)*$/.test(identifier)
  ) {
    throw new ZoneInputError("invalidZone");
  }
}

export function resolveZone(identifier: string): Zone {
  validateIdentifier(identifier);
  const lower = identifier.toLowerCase();
  const shortAlias = Object.hasOwn(aliases, lower) ? (lower as Alias) : undefined;
  if (/^(cst|ist|est|mst|hst|ast|bst|cdt|edt|mdt|pdt)$/i.test(identifier)) {
    throw new ZoneInputError("ambiguousZone");
  }
  const timeZone = shortAlias ? aliases[shortAlias] : identifier.replaceAll("~", "/");
  const directAlias = aliasFor(timeZone);
  try {
    new Intl.DateTimeFormat(APP.locale, { timeZone });
  } catch {
    throw new ZoneInputError("unsupportedZone");
  }
  if (directAlias) return aliasZone(directAlias);
  // ICU と WebKit の別名解決の差に依存せず、定義済み以外の IANA 名は保持する。
  const label = timeZone.split("/").at(-1)?.replaceAll("_", " ") ?? timeZone;
  return {
    id: timeZone.replaceAll("/", "~"),
    timeZone,
    label,
    description: `${timeZone} · ${en.zones.iana}`,
  };
}

export function zoneFromTimeZone(timeZone: string): Zone {
  return resolveZone(timeZone);
}

function uniqueZones(zones: readonly Zone[]): Zone[] {
  const seen = new Set<string>();
  return zones.filter((zone) => {
    const key = zone.id.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateCount(zones: readonly Zone[]): void {
  if (zones.length === 0) throw new ZoneInputError("noZones");
  if (zones.length > APP.maxClocks) throw new ZoneInputError("tooManyZones");
}

function serialize(zones: readonly Zone[]): string {
  return `/${zones.map((zone) => encodeURIComponent(zone.id)).join(",")}`;
}

export function parsePath(path: string): ParsedPath {
  if (path.length > 1024) throw new ZoneInputError("pathTooLong");
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ZoneInputError("invalidPath");
  }
  if (path === "/") return { mode: "auto", zones: [], canonicalPath: "/" };
  let decoded: string;
  try {
    decoded = decodeURIComponent(path.slice(1));
  } catch {
    throw new ZoneInputError("invalidEncoding");
  }
  const identifiers = decoded.split(",");
  if (identifiers.some((identifier) => identifier.length === 0)) {
    throw new ZoneInputError("emptyZone");
  }
  const zones = uniqueZones(identifiers.map(resolveZone));
  validateCount(zones);
  return { mode: "explicit", zones, canonicalPath: serialize(zones) };
}

export function pathForZones(zones: readonly Zone[]): string {
  // サーバーで検証済みの時計はブラウザーが非対応でも共有・並べ替え可能にする。
  const normalized = uniqueZones(
    zones.map((zone) => {
      validateIdentifier(zone.id);
      const alias = Object.hasOwn(aliases, zone.id.toLowerCase())
        ? (zone.id.toLowerCase() as Alias)
        : aliasFor(zone.id.replaceAll("~", "/"));
      return { ...zone, id: alias ?? zone.id.replaceAll("/", "~") };
    }),
  );
  validateCount(normalized);
  return serialize(normalized);
}

export function getCandidates(): Zone[] {
  let supported: string[] = [];
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      supported = Intl.supportedValuesOf("timeZone");
    } catch {
      // 部分実装のブラウザーでも主要候補から選択できるようにする。
    }
  }
  const candidates: Zone[] = [];
  for (const identifier of [...Object.keys(aliases), ...majorRegions, ...supported]) {
    try {
      candidates.push(resolveZone(identifier));
    } catch (error) {
      // 一つの地域が非対応でも、実行環境で利用可能な候補は残す。
      if (!(error instanceof ZoneInputError)) throw error;
    }
  }
  return uniqueZones(candidates);
}
