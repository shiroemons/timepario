import { afterEach, describe, expect, it, vi } from "vitest";
import { formatRelativeOffset, readClock, readZoneAbbreviation } from "../../src/shared/time";

const at = (iso: string, zone: string) => readClock(new Date(iso), zone);

afterEach(() => vi.restoreAllMocks());

describe("clock readings", () => {
  it.each([
    ["04:59:59", "lateNight"],
    ["05:00:00", "morning"],
    ["11:59:59", "morning"],
    ["12:00:00", "day"],
    ["15:59:59", "day"],
    ["16:00:00", "evening"],
    ["18:59:59", "evening"],
    ["19:00:00", "night"],
    ["23:59:59", "night"],
    ["00:00:00", "lateNight"],
  ])("classifies local %s as %s", (time, dayPeriod) => {
    expect(at(`2026-07-01T${time}Z`, "UTC").dayPeriod).toBe(dayPeriod);
  });

  it("derives each face period from its own zone at the same instant", () => {
    const now = "2026-07-01T12:00:00Z";
    expect(at(now, "Asia/Tokyo").dayPeriod).toBe("night");
    expect(at(now, "America/Los_Angeles").dayPeriod).toBe("morning");
    expect(at(now, "UTC").dayPeriod).toBe("day");
    expect(at(now, "Etc/GMT+8").dayPeriod).toBe("lateNight");
  });

  it("shows evening independently of another region's next calendar day", () => {
    const now = "2026-07-01T16:00:00Z";
    expect(at(now, "UTC").dayPeriod).toBe("evening");
    expect(at(now, "Asia/Tokyo")).toMatchObject({ time: "01:00:00", dayPeriod: "lateNight" });
    expect(at(now, "Etc/GMT+8")).toMatchObject({ time: "08:00:00", dayPeriod: "morning" });
  });

  it("uses one set of time parts for the digital display and all three hands", () => {
    const reading = at("2024-06-15T04:30:45.999Z", "Asia/Tokyo");
    expect(reading.time).toBe("13:30:45");
    expect(reading.date).toBe("Sat, Jun 15, 2024");
    expect(reading.offset).toBe("UTC+09:00");
    expect(reading.secondAngle).toBe(270);
    expect(reading.minuteAngle).toBe(184.5);
    expect(reading.hourAngle).toBeCloseTo(45.375);
  });

  it("keeps PST fixed while PT follows daylight saving", () => {
    expect(at("2024-07-01T12:00:00Z", "Etc/GMT+8")).toMatchObject({
      time: "04:00:00",
      offset: "UTC−08:00",
      dayPeriod: "lateNight",
    });
    expect(at("2024-07-01T12:00:00Z", "America/Los_Angeles")).toMatchObject({
      time: "05:00:00",
      offset: "UTC−07:00",
      dayPeriod: "morning",
    });
    expect(at("2024-01-01T12:00:00Z", "America/Los_Angeles")).toMatchObject({
      time: "04:00:00",
      offset: "UTC−08:00",
      dayPeriod: "lateNight",
    });
  });

  it.each([
    ["2024-03-10T09:59:59Z", "01:59:59", "UTC−08:00"],
    ["2024-03-10T10:00:00Z", "03:00:00", "UTC−07:00"],
    ["2024-11-03T08:59:59Z", "01:59:59", "UTC−07:00"],
    ["2024-11-03T09:00:00Z", "01:00:00", "UTC−08:00"],
  ])("tracks a Pacific DST boundary at %s", (iso, time, offset) => {
    expect(at(iso, "America/Los_Angeles")).toMatchObject({ time, offset });
  });

  it.each([
    ["Asia/Kolkata", "05:30:00", "UTC+05:30"],
    ["Asia/Kathmandu", "05:45:00", "UTC+05:45"],
    ["America/St_Johns", "20:30:00", "UTC−03:30"],
    ["Pacific/Chatham", "13:45:00", "UTC+13:45"],
  ])("supports fractional offsets for %s", (zone, time, offset) => {
    expect(at("2024-01-01T00:00:00Z", zone)).toMatchObject({ time, offset });
  });

  it.each([
    ["2024-12-31T15:00:00Z", "Asia/Tokyo", "00:00:00", "Wed, Jan 1, 2025"],
    ["2024-03-01T00:00:00Z", "Etc/GMT+8", "16:00:00", "Thu, Feb 29, 2024"],
    ["2024-04-30T23:59:59Z", "UTC", "23:59:59", "Tue, Apr 30, 2024"],
    ["2024-05-01T00:00:00Z", "UTC", "00:00:00", "Wed, May 1, 2024"],
  ])("handles midnight and calendar boundaries at %s", (iso, zone, time, date) => {
    expect(at(iso, zone)).toMatchObject({ time, date });
  });

  it("renders midnight as 00 and resets the hands at the next second", () => {
    expect(at("2024-01-01T23:59:59Z", "UTC").secondAngle).toBe(354);
    expect(at("2024-01-02T00:00:00Z", "UTC")).toMatchObject({
      time: "00:00:00",
      offset: "UTC+00:00",
      hourAngle: 0,
      minuteAngle: 0,
      secondAngle: 0,
    });
  });

  it("recomputes from the supplied timestamp after time moves backwards", () => {
    expect(at("2024-07-01T12:00:00Z", "UTC").time).toBe("12:00:00");
    expect(at("2024-07-01T11:42:03Z", "UTC").time).toBe("11:42:03");
  });

  it("separates display locale from zone and numeric clock arithmetic", () => {
    const reading = readClock(new Date("2024-06-15T04:30:45Z"), "Asia/Tokyo", "ar-EG");
    expect(reading.time).toBe("13:30:45");
    expect(reading.hourAngle).toBeCloseTo(45.375);
    expect(reading.offset).toBe("UTC+09:00");
    expect(reading.date).not.toBe("Sat, Jun 15, 2024");
  });

  it("reports invalid dates and unsupported zones without substituting UTC", () => {
    expect(() => readClock(new Date(Number.NaN), "UTC")).toThrow(/valid date/);
    expect(() => at("2024-01-01T00:00:00Z", "Not/A_Zone")).toThrow(RangeError);
  });

  it("reuses formatters across ticks while keeping locale and zone independent", () => {
    const formatterConstructor = vi.spyOn(Intl, "DateTimeFormat");
    const first = readClock(new Date("2024-01-01T00:00:00Z"), "Africa/Nairobi", "en-GB");
    const next = readClock(new Date("2024-01-01T00:00:01Z"), "Africa/Nairobi", "en-GB");
    expect(formatterConstructor).toHaveBeenCalledTimes(2);
    expect(first.time).toBe("03:00:00");
    expect(next.time).toBe("03:00:01");
    readClock(new Date("2024-01-01T00:00:00Z"), "Africa/Nairobi", "de-DE");
    expect(formatterConstructor).toHaveBeenCalledTimes(4);
    readClock(new Date("2024-01-01T00:00:00Z"), "Africa/Cairo", "de-DE");
    expect(formatterConstructor).toHaveBeenCalledTimes(6);
  });
});

describe("relative time differences", () => {
  it.each([
    [0, "±0時間", "±0 hours"],
    [-0, "±0時間", "±0 hours"],
    [9 * 3600, "+9時間", "+9 hours"],
    [-9 * 3600, "−9時間", "−9 hours"],
    [5 * 3600 + 30 * 60, "+5時間30分", "+5 hours 30 minutes"],
    [-(3 * 3600 + 30 * 60), "−3時間30分", "−3 hours 30 minutes"],
    [15 * 60, "+15分", "+15 minutes"],
    [-15 * 60, "−15分", "−15 minutes"],
    [3600, "+1時間", "+1 hour"],
    [-60, "−1分", "−1 minute"],
    [1, "+1秒", "+1 second"],
    [5 * 3600 + 41 * 60 + 16, "+5時間41分16秒", "+5 hours 41 minutes 16 seconds"],
  ])("formats a signed difference of %s seconds in both languages", (seconds, ja, en) => {
    expect(formatRelativeOffset(seconds, "ja")).toBe(ja);
    expect(formatRelativeOffset(seconds, "en")).toBe(en);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects an invalid difference %s", (seconds) => {
    expect(() => formatRelativeOffset(seconds, "ja")).toThrow(/integer number of seconds/);
  });

  it.each([
    ["2026-01-01T12:00:00Z", 17],
    ["2026-07-01T12:00:00Z", 16],
    ["2024-03-10T09:59:59Z", 17],
    ["2024-03-10T10:00:00Z", 16],
  ])("compares Japan and Pacific offsets at the same instant %s", (iso, hours) => {
    const japan = at(iso, "Asia/Tokyo");
    const pacific = at(iso, "America/Los_Angeles");
    const fixedPst = at(iso, "Etc/GMT+8");
    expect(japan.offsetSeconds).toBe(9 * 3600);
    expect(fixedPst.offsetSeconds).toBe(-8 * 3600);
    expect(japan.offsetSeconds - pacific.offsetSeconds).toBe(hours * 3600);
    expect(formatRelativeOffset(japan.offsetSeconds - fixedPst.offsetSeconds, "ja")).toBe(
      "+17時間",
    );
  });

  it("keeps fractional region differences in minutes and handles either base direction", () => {
    const kathmandu = at("2026-07-01T12:00:00Z", "Asia/Kathmandu");
    const kolkata = at("2026-07-01T12:00:00Z", "Asia/Kolkata");
    expect(kathmandu.offsetSeconds).toBe(5 * 3600 + 45 * 60);
    expect(kolkata.offsetSeconds).toBe(5 * 3600 + 30 * 60);
    expect(formatRelativeOffset(kathmandu.offsetSeconds - kolkata.offsetSeconds, "ja")).toBe(
      "+15分",
    );
    expect(formatRelativeOffset(kolkata.offsetSeconds - kathmandu.offsetSeconds, "en")).toBe(
      "−15 minutes",
    );
    expect(formatRelativeOffset(kolkata.offsetSeconds - kolkata.offsetSeconds, "ja")).toBe(
      "±0時間",
    );
  });

  it("preserves historical offsets with second precision", () => {
    const kathmandu = at("1900-01-01T12:00:00Z", "Asia/Kathmandu");
    expect(kathmandu.offsetSeconds).toBe(5 * 3600 + 41 * 60 + 16);
    expect(formatRelativeOffset(kathmandu.offsetSeconds, "ja")).toBe("+5時間41分16秒");
  });

  it("retains differences larger than one day across the date line", () => {
    const kiritimati = at("2026-07-01T12:00:00Z", "Pacific/Kiritimati");
    const west = at("2026-07-01T12:00:00Z", "Etc/GMT+12");
    const difference = kiritimati.offsetSeconds - west.offsetSeconds;
    expect(difference).toBe(26 * 3600);
    expect(formatRelativeOffset(difference, "ja")).toBe("+26時間");
    expect(formatRelativeOffset(-difference, "en")).toBe("−26 hours");
  });
});

describe("time zone abbreviations", () => {
  it.each([
    ["Asia/Tokyo", "JST"],
    ["Etc/GMT+8", "PST"],
    ["UTC", "UTC"],
  ])("keeps the fixed abbreviation of %s year-round", (zone, expected) => {
    for (const month of ["01", "07"]) {
      expect(readZoneAbbreviation(new Date(`2026-${month}-01T12:00:00Z`), zone)).toBe(expected);
    }
  });

  it.each([
    ["2024-01-01T12:00:00Z", "PST"],
    ["2024-07-01T12:00:00Z", "PDT"],
    ["2024-03-10T09:59:59Z", "PST"],
    ["2024-03-10T10:00:00Z", "PDT"],
    ["2024-11-03T08:59:59Z", "PDT"],
    ["2024-11-03T09:00:00Z", "PST"],
  ])("reads the Pacific abbreviation at %s from time zone rules", (iso, expected) => {
    expect(readZoneAbbreviation(new Date(iso), "America/Los_Angeles")).toBe(expected);
  });

  it("uses an Intl GMT offset when a regional abbreviation is unavailable", () => {
    expect(readZoneAbbreviation(new Date("2026-07-01T12:00:00Z"), "Asia/Kathmandu")).toBe(
      "GMT+5:45",
    );
  });

  it("rejects invalid dates and unsupported time zones", () => {
    expect(() => readZoneAbbreviation(new Date(Number.NaN), "UTC")).toThrow(/valid date/);
    expect(() => readZoneAbbreviation(new Date("2026-07-01T12:00:00Z"), "Not/A_Zone")).toThrow(
      RangeError,
    );
  });

  it("reuses formatters while evicting older entries after many region searches", () => {
    const formatterConstructor = vi.spyOn(Intl, "DateTimeFormat");
    const now = new Date("2026-07-01T12:00:00Z");
    readZoneAbbreviation(now, "Pacific/Norfolk");
    const firstCount = formatterConstructor.mock.calls.length;
    readZoneAbbreviation(new Date("2026-01-01T12:00:00Z"), "Pacific/Norfolk");
    expect(formatterConstructor.mock.calls.length).toBe(firstCount);
    for (const zone of Intl.supportedValuesOf("timeZone").slice(0, 70)) {
      readZoneAbbreviation(now, zone);
    }
    const countAfterSearches = formatterConstructor.mock.calls.length;
    readZoneAbbreviation(now, "Pacific/Norfolk");
    expect(formatterConstructor.mock.calls.length).toBe(countAfterSearches + 1);
  });
});
