import type { Language } from "../shared/language";

const en = {
  description: "Compare up to three world clocks, with accurate timezone rules and shareable URLs.",
  worldClocks: "World clocks",
  clocksTitle: (labels: string) => `${labels} — world clocks`,
  clocksDescription: (labels: string) =>
    `Compare the time in ${labels}, side by side. View analog and digital clocks, compare time differences, and share this clock arrangement.`,
  imageAlt: "TimePario world clocks shown side by side",
  invalidTitle: "This clock link is not valid",
  backHome: "Go to your local clock",
  notFound: "This file could not be found.",
  unavailableTitle: "The clocks could not load",
  unavailable: "Something went wrong while preparing this page. Please try again.",
} as const;

type ServerMessages = {
  [K in keyof typeof en]: (typeof en)[K] extends string ? string : (typeof en)[K];
};

const ja: ServerMessages = {
  description: "世界の時計を最大3つ並べて比較。タイムゾーンのルールに対応し、URLで共有できます。",
  worldClocks: "世界時計",
  clocksTitle: (labels: string) => `${labels}の世界時計`,
  clocksDescription: (labels: string) =>
    `${labels}の時刻を並べて比較。アナログ時計とデジタル時計、基準地域との時差を確認して、この時計の並びをURLで共有できます。`,
  imageAlt: "TimeParioの世界時計を並べたプレビュー",
  invalidTitle: "時計のリンクが正しくありません",
  backHome: "端末の時計に戻る",
  notFound: "ファイルが見つかりませんでした。",
  unavailableTitle: "時計を読み込めませんでした",
  unavailable: "ページの準備中に問題が発生しました。もう一度お試しください。",
};

export const serverMessagesFor = (language: Language) => (language === "ja" ? ja : en);
