import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCandidates,
  localizeZone,
  parsePath,
  pathForZones,
  resolveZone,
  ZoneInputError,
  zoneFromTimeZone,
} from "../../src/shared/zones";

afterEach(() => vi.restoreAllMocks());

describe("clock URL parsing", () => {
  it("leaves the root in automatic mode without assuming the server zone", () => {
    expect(parsePath("/")).toEqual({ mode: "auto", zones: [], canonicalPath: "/" });
  });

  it("normalizes shortcuts and defined IANA equivalents, keeping their first position", () => {
    const parsed = parsePath("/PT,JST,Asia~Tokyo,America~Los_Angeles,UTC");
    expect(parsed.zones.map(({ id }) => id)).toEqual(["pt", "jst", "utc"]);
    expect(parsed.canonicalPath).toBe("/pt,jst,utc");
    expect(parsed.mode).toBe("explicit");
  });

  it("preserves multi-level IANA identifiers and round-trips the order", () => {
    const path = "/Europe~London,America~Argentina~Buenos_Aires,Asia~Kathmandu";
    const parsed = parsePath(path);
    expect(parsed.zones.map(({ timeZone }) => timeZone)).toEqual([
      "Europe/London",
      "America/Argentina/Buenos_Aires",
      "Asia/Kathmandu",
    ]);
    expect(pathForZones(parsed.zones)).toBe(path);
    expect(parsePath(parsed.canonicalPath).canonicalPath).toBe(path);
  });

  it("accepts raw or encoded IANA slashes and decodes only once", () => {
    expect(parsePath("/Asia%2FTokyo,America/Argentina/Buenos_Aires").canonicalPath).toBe(
      "/jst,America~Argentina~Buenos_Aires",
    );
    expect(parsePath("/%4A%53%54%2Cutc").canonicalPath).toBe("/jst,utc");
    expect(() => parsePath("/Asia%252FTokyo")).toThrow(ZoneInputError);
    expect(() => resolveZone("%6Ast")).toThrow(ZoneInputError);
  });

  it("deduplicates before applying the three-clock limit", () => {
    expect(parsePath("/JST,jst,Asia~Tokyo,pt,utc").zones).toHaveLength(3);
    expect(() => parsePath("/jst,pt,utc,et")).toThrow(/at most three/);
  });

  it("does not merge fixed PST, regional PT, or regions sharing an offset", () => {
    const parsed = parsePath("/pst,pt,America~Vancouver");
    expect(parsed.zones.map(({ timeZone }) => timeZone)).toEqual([
      "Etc/GMT+8",
      "America/Los_Angeles",
      "America/Vancouver",
    ]);
    expect(parsePath("/jst,Asia~Seoul").zones).toHaveLength(2);
    expect(parsePath("/Etc~GMT%2B8,pst").canonicalPath).toBe("/pst");
  });

  it.each([
    "/unknown",
    "/CST",
    "/IST",
    "/jst,",
    "/,utc",
    "/jst,,utc",
    "/%",
    "/%E0%A4%A",
    "/%FF",
    "/jst%00",
    "/jst%20",
    "/jst/",
    "//utc",
    "jst",
    "/%3Cscript%3Ealert(1)%3C%2Fscript%3E",
    "/utc?zone=jst",
    `/${"a".repeat(1024)}`,
  ])("rejects invalid input %s without dropping values", (path) => {
    expect(() => parsePath(path)).toThrow(ZoneInputError);
  });

  it("deduplicates the same IANA name regardless of case", () => {
    expect(parsePath("/Europe~London,europe~london").zones).toHaveLength(1);
  });

  it("rejects excessive path length before processing identifiers", () => {
    expect(() => parsePath(`/${"a".repeat(1024)}`)).toThrow(/too long/);
  });

  it("validates aliases through Intl instead of supportedValuesOf membership", () => {
    vi.spyOn(Intl, "supportedValuesOf").mockReturnValue([]);
    expect(resolveZone("US/Pacific").id).toBe("US~Pacific");
    expect(resolveZone("America/Argentina/Buenos_Aires").timeZone).toBe(
      "America/Argentina/Buenos_Aires",
    );
    expect(zoneFromTimeZone("Asia/Tokyo").id).toBe("jst");
  });

  it.each([
    ["US/Pacific", "America/Los_Angeles", "/US~Pacific"],
    ["Etc/UTC", "UTC", "/Etc~UTC"],
  ])("preserves %s regardless of runtime alias resolution", (input, resolved, path) => {
    const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
    const resolution = vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions");
    for (const runtimeValue of [input, resolved]) {
      resolution.mockImplementation(function (this: Intl.DateTimeFormat) {
        return { ...originalResolvedOptions.call(this), timeZone: runtimeValue };
      });
      expect(parsePath(`/${input.replaceAll("/", "~")}`).canonicalPath).toBe(path);
      expect(pathForZones([resolveZone(input)])).toBe(path);
    }
  });

  it("safely serializes structured zones and checks minimum and maximum", () => {
    expect(pathForZones([resolveZone("utc"), resolveZone("jst"), resolveZone("utc")])).toBe(
      "/utc,jst",
    );
    expect(() => pathForZones([])).toThrow(/at least one/);
    expect(() => pathForZones(["jst", "pt", "utc", "et"].map(resolveZone))).toThrow(
      /at most three/,
    );
    expect(() =>
      pathForZones([{ id: "<script>", timeZone: "UTC", label: "", description: "" }]),
    ).toThrow(ZoneInputError);
  });

  it("serializes trusted server zones even when this runtime cannot display them", () => {
    const zones = [resolveZone("Europe/London"), resolveZone("jst")];
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new RangeError("Unsupported");
    });
    expect(pathForZones(zones)).toBe("/Europe~London,jst");
    expect(() => resolveZone("jst")).toThrow(ZoneInputError);
  });
});

describe("zone candidates", () => {
  it("provides Japanese names for every available time zone candidate", () => {
    const candidates = getCandidates();
    expect(candidates.length).toBeGreaterThan(300);
    for (const candidate of candidates) {
      const translated = localizeZone(candidate, "ja");
      if (candidate.id === "utc") expect(translated.label).toBe("UTC");
      else
        expect(translated.label, candidate.timeZone).toMatch(
          /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
        );
      expect(translated.id).toBe(candidate.id);
      expect(translated.timeZone).toBe(candidate.timeZone);
    }
  });

  it.each([
    ["Africa/Abidjan", "アビジャン"],
    ["America/Argentina/Buenos_Aires", "ブエノスアイレス"],
    ["America/Indiana/Indianapolis", "インディアナポリス"],
    ["Asia/Kolkata", "コルカタ"],
    ["Asia/Calcutta", "コルカタ"],
    ["Asia/Kathmandu", "カトマンズ"],
    ["Asia/Katmandu", "カトマンズ"],
    ["Europe/Kyiv", "キーウ"],
    ["Europe/Kiev", "キーウ"],
    ["US/Pacific", "ロサンゼルス"],
    ["Canada/Eastern", "トロント"],
    ["pacific/auckland", "オークランド"],
  ])(
    "translates %s while preserving its identifier and English search text",
    (identifier, expected) => {
      const zone = resolveZone(identifier);
      const translated = localizeZone(zone, "ja");
      expect(translated.label).toBe(expected);
      expect(translated.timeZone).toBe(zone.timeZone);
      expect(translated.description).toContain(zone.timeZone);
      expect(pathForZones([translated])).toBe(pathForZones([zone]));
      expect(localizeZone(translated, "en").label).toBe(zone.label);
    },
  );

  it("uses localized Intl names for regions absent from the bundled city data", () => {
    const zone = resolveZone("Etc/GMT-3");
    const translated = localizeZone(zone, "ja");
    expect(translated.label).toContain("GMT+03:00");
    expect(translated.label).toContain("地域");
    expect(translated.description).toContain("Etc/GMT-3");
  });

  it("uses runtime alias resolution when the requested name is absent from CLDR", () => {
    const zone = resolveZone("Etc/GMT-3");
    const original = Intl.DateTimeFormat.prototype.resolvedOptions;
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (
      this: Intl.DateTimeFormat,
    ) {
      return { ...original.call(this), timeZone: "Europe/Paris" };
    });
    expect(localizeZone(zone, "ja").label).toBe("パリ");
    expect(zone.timeZone).toBe("Etc/GMT-3");
  });

  it("keeps trusted unsupported zones readable when the browser cannot localize them", () => {
    const zone = resolveZone("Etc/GMT-3");
    const original = Intl.DateTimeFormat;
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      new Proxy(original, {
        construct() {
          throw new RangeError("Unsupported");
        },
      }),
    );
    expect(localizeZone(zone, "ja").label).toBe("未対応のタイムゾーン");
    expect(localizeZone(zone, "ja").timeZone).toBe(zone.timeZone);
  });

  it("includes distinct PST and PT with clear meanings and English region labels", () => {
    const candidates = getCandidates();
    expect(candidates.find(({ id }) => id === "pst")?.description).toMatch(
      /Fixed.*no daylight saving/,
    );
    expect(candidates.find(({ id }) => id === "pt")?.description).toMatch(
      /follows daylight saving/,
    );
    expect(candidates.find(({ timeZone }) => timeZone === "Asia/Kathmandu")?.label).toBe(
      "Kathmandu",
    );
  });

  it("falls back to major candidates when enumeration is absent", () => {
    vi.stubGlobal("Intl", Object.create(Intl, { supportedValuesOf: { value: undefined } }));
    try {
      const candidates = getCandidates();
      expect(candidates.some(({ id }) => id === "pst")).toBe(true);
      expect(candidates.some(({ id }) => id === "Europe~London")).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back when enumeration is only partially implemented", () => {
    vi.spyOn(Intl, "supportedValuesOf").mockImplementation(() => {
      throw new RangeError("Unsupported");
    });
    expect(getCandidates().length).toBeGreaterThan(5);
  });

  it("omits an unsupported candidate without breaking supported regions", () => {
    vi.spyOn(Intl, "supportedValuesOf").mockReturnValue(["Fake/Region", "Europe/London"]);
    expect(getCandidates().some(({ id }) => id === "Europe~London")).toBe(true);
    expect(getCandidates().some(({ id }) => id === "Fake~Region")).toBe(false);
  });
});
