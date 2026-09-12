import type { Language } from "./language";

export const en = {
  pageTitle: "World clocks",
  home: "Back to your local clock",
  invalidUrl: "This clock link is not valid",
  javascriptRequired: "JavaScript is required to display and update these clocks.",
  deviceTimeNotice:
    "Clocks use your device time. Synchronization with standard time is not guaranteed.",
  timeZoneNotice: "Regional time rules depend on the time zone data in your browser and runtime.",
  errors: {
    pathTooLong: "The clock link is too long. Use a shorter list of time zones.",
    invalidPath: "A clock link must start with a single slash.",
    invalidEncoding: "The clock link contains invalid URL encoding.",
    emptyZone: "The clock link contains an empty time zone.",
    tooManyZones: "A clock link can contain at most three different time zones.",
    noZones: "Choose at least one time zone.",
    invalidZone: "This time zone identifier is invalid.",
    ambiguousZone: "This abbreviation is ambiguous. Choose a region or a defined shortcut.",
    unsupportedZone: "This time zone is unknown or is not supported by this runtime.",
  },
  zones: {
    jst: { label: "Tokyo", description: "Japan time · UTC+09:00" },
    pst: { label: "Pacific Standard Time", description: "Fixed UTC−08:00 · no daylight saving" },
    pt: { label: "Los Angeles", description: "Pacific time · follows daylight saving" },
    utc: { label: "UTC", description: "Coordinated Universal Time · UTC+00:00" },
    et: { label: "New York", description: "Eastern time · follows daylight saving" },
    iana: "IANA time zone",
  },
} as const;

type Translated<T> = { [K in keyof T]: T[K] extends string ? string : Translated<T[K]> };

export const ja: Translated<typeof en> = {
  pageTitle: "世界時計",
  home: "端末の時計に戻る",
  invalidUrl: "時計のリンクが正しくありません",
  javascriptRequired: "時計を表示・更新するにはJavaScriptを有効にしてください。",
  deviceTimeNotice: "時計は端末の時刻を使用します。標準時との同期は保証されません。",
  timeZoneNotice: "地域の時刻ルールはブラウザーと実行環境のタイムゾーンデータに依存します。",
  errors: {
    pathTooLong: "時計のリンクが長すぎます。タイムゾーンのリストを短くしてください。",
    invalidPath: "時計のリンクは1つのスラッシュから始めてください。",
    invalidEncoding: "時計のリンクに正しくないURLエンコードが含まれています。",
    emptyZone: "時計のリンクに空のタイムゾーンが含まれています。",
    tooManyZones: "時計のリンクには最大3つの異なるタイムゾーンを指定できます。",
    noZones: "タイムゾーンを1つ以上選択してください。",
    invalidZone: "タイムゾーンの識別子が正しくありません。",
    ambiguousZone: "この略称は複数の地域を指します。地域名または定義済みの略称を選択してください。",
    unsupportedZone: "このタイムゾーンは不明か、この実行環境では対応していません。",
  },
  zones: {
    jst: { label: "東京", description: "日本時間 · UTC+09:00" },
    pst: { label: "太平洋標準時", description: "UTC−08:00固定 · 夏時間なし" },
    pt: { label: "ロサンゼルス", description: "太平洋時間 · 夏時間に対応" },
    utc: { label: "UTC", description: "協定世界時 · UTC+00:00" },
    et: { label: "ニューヨーク", description: "米国東部時間 · 夏時間に対応" },
    iana: "IANAタイムゾーン",
  },
};

export const messagesFor = (language: Language) => (language === "ja" ? ja : en);
