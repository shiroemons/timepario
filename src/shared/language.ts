export type Language = "en" | "ja";

function supported(tag: string): Language | undefined {
  const base = tag.trim().toLowerCase().split("-")[0];
  return base === "ja" || base === "en" ? base : undefined;
}

export function browserLanguage(languages: readonly string[]): Language {
  for (const tag of languages) {
    const language = supported(tag);
    if (language) return language;
  }
  return "en";
}

export function requestLanguage(header: string | undefined): Language {
  const preferences = (header ?? "").split(",").map((part, index) => {
    const [tag = "", ...parameters] = part.trim().split(";");
    const quality = parameters.find((parameter) => /^\s*q=/i.test(parameter));
    const value = quality ? quality.trim().slice(2) : "1";
    const weight = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value) ? Number(value) : 0;
    return { language: supported(tag), weight, index };
  });
  preferences.sort((a, b) => b.weight - a.weight || a.index - b.index);
  return preferences.find((entry) => entry.weight > 0 && entry.language)?.language ?? "en";
}

export function dateLocale(language: Language): string {
  return language === "ja" ? "ja-JP" : "en-US";
}
