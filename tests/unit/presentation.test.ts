import { describe, expect, it } from "vitest";
import { isExpandedView, urlForExpandedView } from "../../src/client/presentation";

describe("expanded view URL state", () => {
  it.each(["?view=expanded", "?utm_source=share&view=expanded"])("recognizes %s", (search) => {
    expect(isExpandedView(search)).toBe(true);
  });

  it.each(["", "?view=fullscreen", "?view=Expanded", "?view=expanded%20"])(
    "ignores %s",
    (search) => {
      expect(isExpandedView(search)).toBe(false);
    },
  );

  it("adds and removes only the expanded view query", () => {
    const url = new URL("https://time.example/jst,utc?utm_source=share#clocks");
    expect(urlForExpandedView(url, true)).toBe("/jst,utc?utm_source=share&view=expanded#clocks");
    expect(urlForExpandedView(new URL("https://time.example/jst,utc?view=expanded"), false)).toBe(
      "/jst,utc",
    );
  });
});
