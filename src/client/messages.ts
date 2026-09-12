import { APP } from "../shared/config";
import type { Language } from "../shared/language";

export const ui = {
  tagline: APP.tagline,
  share: "Copy link",
  copyTitle: "Copy a link to the displayed clocks",
  copySuccess: "Link copied",
  fullscreen: "Full screen",
  expandedView: "Expanded view",
  exitExpanded: "Return to clocks",
  offlineUnavailable:
    "Offline setup failed. These clocks still work while this page stays open. Reload when online to try again.",
  exitFullscreen: "Exit full screen",
  fullscreenHint: "Press Esc to return",
  fullscreenFallback: "Expanded view · Full screen is unavailable. Press Esc to return.",
  fullscreenExitFailure: "Use Esc or your browser controls to exit full screen.",
  add: "Add clock",
  detecting: "Detecting your time zone…",
  automatic: "Your device time zone",
  explicit: "A little perspective, across time zones.",
  fallback: "Your device time zone could not be detected. Showing UTC.",
  loading: "Waiting for your browser",
  limit: "All 3 clocks are in use. Change or remove a clock to add another.",
  capacity: (count: number) => `${count} of 3 clocks`,
  compareLabel: "Compare with",
  compareNone: "None",
  comparisonBase: (difference: string) => `Reference ${difference}`,
  comparisonValue: (difference: string) => `${difference} vs. reference`,
  comparisonAccessible: (label: string, difference: string) =>
    `Time difference from ${label}: ${difference}`,
  comparisonUnavailable: "Difference unavailable",
  change: (label: string) => `Change ${label}`,
  remove: (label: string) => `Remove ${label}`,
  earlier: (label: string) => `Move ${label} earlier`,
  later: (label: string) => `Move ${label} later`,
  drag: (label: string) => `Drag to reorder ${label}`,
  morning: "Morning",
  day: "Day",
  evening: "Evening",
  night: "Night",
  lateNight: "Late night",
  keepOne: "Keep at least one clock",
  unsupported:
    "This browser cannot display this time zone. Try another region or update your browser.",
  clockLabel: (label: string) => `${label} clock`,
  addTitle: "Add a time zone",
  changeTitle: "Change time zone",
  close: "Close",
  searchLabel: "Search regions or IANA time zones",
  searchPlaceholder: "Try London, Asia/Kathmandu, or PST",
  searchHint:
    "PST stays at UTC−08:00. Pacific Time (PT) follows daylight saving time. Use the down arrow key to browse results.",
  resultsLabel: "Time zone results",
  noResults: "No matching time zones. Try a region or a full IANA name.",
  selected: "Already displayed",
  added: (label: string) => `Added ${label}.`,
  changed: (label: string) => `Clock changed to ${label}.`,
  removed: (label: string) => `Removed ${label}.`,
  moved: (label: string) => `Moved ${label}.`,
  copied: "Share link copied.",
  copyFailed: "Copy is unavailable. Select the link below and copy it manually.",
  shareTitle: "Copy link manually",
  shareLabel: "Share URL",
  stateError: "These time zones cannot be loaded in this browser.",
  returnHome: "Back to your local clock",
  limitation:
    "Based on your device clock; synchronization with standard time is not guaranteed. Regional time rules depend on your browser’s time zone data.",
  javascript: "JavaScript is required to detect your time zone and run these clocks.",
} as const;

type UiMessages = {
  [K in keyof typeof ui]: (typeof ui)[K] extends string ? string : (typeof ui)[K];
};

const ja: UiMessages = {
  tagline: "世界の時刻を、並べて。",
  share: "リンクをコピー",
  copyTitle: "表示中の時計のリンクをコピー",
  copySuccess: "コピーしました",
  fullscreen: "全画面表示",
  expandedView: "拡大表示",
  exitExpanded: "通常表示へ戻る",
  offlineUnavailable:
    "オフライン利用の準備に失敗しました。このページを開いている間は時計を利用できます。オンライン時に再読み込みしてください。",
  exitFullscreen: "全画面表示を終了",
  fullscreenHint: "Escキーで戻る",
  fullscreenFallback: "拡大表示中 · 全画面表示を利用できません。Escキーで戻れます。",
  fullscreenExitFailure: "Escキーまたはブラウザーの操作で全画面表示を終了してください。",
  add: "時計を追加",
  detecting: "タイムゾーンを確認しています…",
  automatic: "端末のタイムゾーンを表示しています",
  explicit: "タイムゾーンを越えて、今を見渡す。",
  fallback: "端末のタイムゾーンを取得できませんでした。UTCを表示しています。",
  loading: "ブラウザーの起動を待っています",
  limit: "時計は最大3つです。別の時計を追加するには、変更または削除してください。",
  capacity: (count: number) => `${count} / 3 時計`,
  compareLabel: "時差の基準",
  compareNone: "未選択",
  comparisonBase: (difference: string) => `比較の基準 ${difference}`,
  comparisonValue: (difference: string) => `基準より ${difference}`,
  comparisonAccessible: (label: string, difference: string) => `${label}との時差：${difference}`,
  comparisonUnavailable: "時差を表示できません",
  change: (label: string) => `${label}を変更`,
  remove: (label: string) => `${label}を削除`,
  earlier: (label: string) => `${label}を前へ移動`,
  later: (label: string) => `${label}を後ろへ移動`,
  drag: (label: string) => `${label}をドラッグして並べ替え`,
  morning: "朝",
  day: "昼",
  evening: "夕方",
  night: "夜",
  lateNight: "深夜",
  keepOne: "時計は1つ以上必要です",
  unsupported:
    "このブラウザーではこのタイムゾーンを表示できません。別の地域を選ぶか、ブラウザーを更新してください。",
  clockLabel: (label: string) => `${label}の時計`,
  addTitle: "タイムゾーンを追加",
  changeTitle: "タイムゾーンを変更",
  close: "閉じる",
  searchLabel: "地域名またはIANAタイムゾーンを検索",
  searchPlaceholder: "例：ロンドン、Asia/Kathmandu、PST",
  searchHint:
    "PSTはUTC−08:00固定です。太平洋時間（PT）は夏時間に対応します。下矢印キーで検索結果に移動できます。",
  resultsLabel: "タイムゾーンの検索結果",
  noResults: "一致するタイムゾーンがありません。地域名または完全なIANA名を入力してください。",
  selected: "表示中",
  added: (label: string) => `${label}を追加しました。`,
  changed: (label: string) => `時計を${label}に変更しました。`,
  removed: (label: string) => `${label}を削除しました。`,
  moved: (label: string) => `${label}を移動しました。`,
  copied: "共有リンクをコピーしました。",
  copyFailed: "コピーできませんでした。下のリンクを選択して手動でコピーしてください。",
  shareTitle: "リンクを手動でコピー",
  shareLabel: "共有URL",
  stateError: "このブラウザーでは指定されたタイムゾーンを読み込めません。",
  returnHome: "端末の時計に戻る",
  limitation:
    "端末の時刻を使用しています。標準時との同期は保証されません。地域の時刻ルールはブラウザーのタイムゾーンデータに依存します。",
  javascript: "タイムゾーンの検出と時計の表示にはJavaScriptを有効にしてください。",
};

export const uiFor = (language: Language): UiMessages => (language === "ja" ? ja : ui);

export const facePath = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * Math.PI) / 6;
  const inner = index % 3 === 0 ? 79 : 83;
  return `M ${100 + Math.sin(angle) * inner} ${100 - Math.cos(angle) * inner} L ${100 + Math.sin(angle) * 89} ${100 - Math.cos(angle) * 89}`;
}).join(" ");
