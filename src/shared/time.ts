import { APP } from "./config";
import type { Language } from "./language";

export interface ClockReading {
  time: string;
  date: string;
  offset: string;
  offsetSeconds: number;
  dayPeriod: "lateNight" | "morning" | "day" | "evening" | "night";
  hourAngle: number;
  minuteAngle: number;
  secondAngle: number;
}

interface Formatters {
  parts: Intl.DateTimeFormat;
  date: Intl.DateTimeFormat;
}

const formatterCache = new Map<string, Formatters>();
const abbreviationCache = new Map<string, Intl.DateTimeFormat>();

export function readZoneAbbreviation(now: Date, timeZone: string): string {
  if (!Number.isFinite(now.getTime())) throw new RangeError("The clock requires a valid date.");
  // Intl が GMT 表記を返す地域には、アプリで定義した固定の略称を使用する。
  if (timeZone === "Asia/Tokyo") return "JST";
  if (timeZone === "Etc/GMT+8") return "PST";
  if (timeZone === "UTC") return "UTC";
  let formatter = abbreviationCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" });
    if (abbreviationCache.size >= 64) {
      const oldest = abbreviationCache.keys().next().value;
      if (oldest !== undefined) abbreviationCache.delete(oldest);
    }
    abbreviationCache.set(timeZone, formatter);
  }
  // 略称自体はキャッシュせず、夏時間の切り替わりを毎回日時から判定する。
  const abbreviation = formatter.formatToParts(now).find((part) => part.type === "timeZoneName");
  if (!abbreviation)
    throw new RangeError(`No time zone abbreviation is available for ${timeZone}.`);
  return abbreviation.value;
}

function getFormatters(timeZone: string, locale: string): Formatters {
  const key = JSON.stringify([timeZone, locale]);
  const cached = formatterCache.get(key);
  if (cached) return cached;
  const formatters = {
    parts: new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    date: new Intl.DateTimeFormat(locale, {
      timeZone,
      calendar: "gregory",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  };
  // 長く利用する画面でも履歴操作によるキャッシュの増加を制限する。
  if (formatterCache.size >= 64) {
    const oldest = formatterCache.keys().next().value;
    if (oldest !== undefined) formatterCache.delete(oldest);
  }
  formatterCache.set(key, formatters);
  return formatters;
}

const pad = (value: number): string => String(value).padStart(2, "0");

export function formatRelativeOffset(seconds: number, language: Language): string {
  if (!Number.isSafeInteger(seconds)) {
    throw new RangeError("A relative offset requires a safe integer number of seconds.");
  }
  const absolute = Math.abs(seconds);
  const values = [Math.floor(absolute / 3600), Math.floor((absolute % 3600) / 60), absolute % 60];
  const units = language === "ja" ? ["時間", "分", "秒"] : ["hour", "minute", "second"];
  const parts = values.flatMap((value, index) => {
    if (!value) return [];
    const unit = units[index];
    return [language === "ja" ? `${value}${unit}` : `${value} ${unit}${value === 1 ? "" : "s"}`];
  });
  const text = parts.length
    ? parts.join(language === "ja" ? "" : " ")
    : language === "ja"
      ? "0時間"
      : "0 hours";
  return `${seconds === 0 ? "±" : seconds < 0 ? "−" : "+"}${text}`;
}

export function readClock(now: Date, timeZone: string, locale: string = APP.locale): ClockReading {
  if (!Number.isFinite(now.getTime())) throw new RangeError("The clock requires a valid date.");
  const formatters = getFormatters(timeZone, locale);
  const values: Record<string, number> = {};
  for (const part of formatters.parts.formatToParts(now)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  const year = values.year ?? 0;
  const month = values.month ?? 0;
  const day = values.day ?? 0;
  const hour = values.hour ?? 0;
  const minute = values.minute ?? 0;
  const second = values.second ?? 0;
  const wallTime = new Date(0);
  wallTime.setUTCFullYear(year, month - 1, day);
  wallTime.setUTCHours(hour, minute, second, 0);
  const offsetSeconds = Math.round(
    (wallTime.getTime() - Math.floor(now.getTime() / 1000) * 1000) / 1000,
  );
  const absoluteOffset = Math.abs(offsetSeconds);
  const offsetHours = Math.floor(absoluteOffset / 3600);
  const offsetMinutes = Math.floor((absoluteOffset % 3600) / 60);
  const remainingSeconds = absoluteOffset % 60;
  const offset = `UTC${offsetSeconds < 0 ? "−" : "+"}${pad(offsetHours)}:${pad(offsetMinutes)}${remainingSeconds ? `:${pad(remainingSeconds)}` : ""}`;
  return {
    time: `${pad(hour)}:${pad(minute)}:${pad(second)}`,
    date: formatters.date.format(now),
    offset,
    offsetSeconds,
    dayPeriod:
      hour < 5
        ? "lateNight"
        : hour < 12
          ? "morning"
          : hour < 16
            ? "day"
            : hour < 19
              ? "evening"
              : "night",
    secondAngle: second * 6,
    minuteAngle: (minute + second / 60) * 6,
    hourAngle: ((hour % 12) + minute / 60 + second / 3600) * 30,
  };
}
