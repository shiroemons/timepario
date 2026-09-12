import { describe, expect, it } from "vitest";
import { browserLanguage, dateLocale, requestLanguage } from "../../src/shared/language";
import { readClock } from "../../src/shared/time";
import { localizeZone, parsePath, pathForZones, resolveZone } from "../../src/shared/zones";

describe("language negotiation", () => {
  it.each([
    [undefined, "en"],
    ["", "en"],
    ["ja-JP, en-US;q=0.9", "ja"],
    ["en-GB, ja;q=0.5", "en"],
    ["ja;q=0.5,en;q=0.9", "en"],
    ["fr,ja;q=0.5,en;q=0.1", "ja"],
    ["fr,de;q=0.5", "en"],
    ["JA-jp;q=1,en;q=1", "ja"],
    ["ja;q=0,en;q=0.3", "en"],
    ["ja;q=bad,en", "en"],
    ["ja;q=1.5,en", "en"],
    ["*,ja;q=0.8", "ja"],
  ])("chooses the preferred supported request language for %s", (header, language) => {
    expect(requestLanguage(header)).toBe(language);
  });

  it.each([
    [["ja-JP", "en-US"], "ja"],
    [["en-US", "ja"], "en"],
    [["fr-FR", "ja-JP"], "ja"],
    [["de-DE"], "en"],
    [[], "en"],
  ])("chooses navigator preferences %s", (preferences, language) => {
    expect(browserLanguage(preferences)).toBe(language);
  });

  it("localizes labels without changing canonical IDs, order, offsets or numeric time", () => {
    const zones = parsePath("/JST,pt,Asia~Kathmandu").zones;
    const localized = zones.map((zone) => localizeZone(zone, "ja"));
    expect(localized.map((zone) => zone.label)).toEqual(["東京", "ロサンゼルス", "カトマンズ"]);
    expect(pathForZones(localized)).toBe("/jst,pt,Asia~Kathmandu");
    const now = new Date("2026-07-01T12:34:56Z");
    const english = readClock(now, zones[0]?.timeZone ?? "", dateLocale("en"));
    const japanese = readClock(now, localized[0]?.timeZone ?? "", dateLocale("ja"));
    expect(japanese).toMatchObject({
      time: english.time,
      offset: english.offset,
      hourAngle: english.hourAngle,
    });
    expect(japanese.date).toContain("7月1日");
    expect(japanese.date).not.toBe(english.date);
  });

  it("translates IANA city names and can restore English labels", () => {
    expect(localizeZone(resolveZone("Africa/Nairobi"), "ja").label).toBe("ナイロビ");
    const japanese = localizeZone(resolveZone("jst"), "ja");
    expect(localizeZone(japanese, "en").label).toBe("Tokyo");
  });
});
