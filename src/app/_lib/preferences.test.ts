import { describe, expect, it } from "vitest";
import {
  BELL_OFFSET_LIMIT_SEC,
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  loadPreferences,
  parseBellOffset,
  serializePreferences,
} from "./preferences";
import { THEME_ATTRIBUTE, THEME_SCRIPT, THEMES, applyTheme, isTheme } from "./theme";

/**
 * The preferences boundary.
 *
 * Every value reaching `loadPreferences` is untrusted - `AGENTS.md` says so of
 * `localStorage` explicitly - so the interesting tests here are all the ways a
 * stored string can be wrong, and the rule that none of them may throw or take
 * a good field down with a bad one.
 */

describe("loadPreferences", () => {
  it("returns the defaults for an absent value", () => {
    expect(loadPreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it("round-trips what serializePreferences writes", () => {
    const preferences = { theme: "dark", bellOffsetSec: -18 } as const;
    expect(loadPreferences(serializePreferences(preferences))).toEqual(preferences);
  });

  it.each([
    ["not JSON at all", "{nope"],
    ["a JSON array", "[]"],
    ["a JSON string", '"dark"'],
    ["a JSON number", "7"],
    ["JSON null", "null"],
  ])("degrades to the defaults for %s", (_label, raw) => {
    expect(loadPreferences(raw)).toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps a good bell offset when the theme is unreadable", () => {
    // The whole reason this boundary degrades field by field rather than
    // all-or-nothing: a theme name that no longer exists says nothing about
    // whether a measured offset is still a usable number.
    const loaded = loadPreferences('{"theme":"solarized","bellOffsetSec":-9}');

    expect(loaded).toEqual({ theme: "system", bellOffsetSec: -9 });
  });

  it("keeps a good theme when the bell offset is unreadable", () => {
    expect(loadPreferences('{"theme":"light","bellOffsetSec":"twelve"}')).toEqual({
      theme: "light",
      bellOffsetSec: 0,
    });
  });

  it("degrades a missing field without touching the other", () => {
    expect(loadPreferences('{"theme":"dark"}')).toEqual({ theme: "dark", bellOffsetSec: 0 });
  });

  it("ignores fields it does not know about", () => {
    expect(loadPreferences('{"theme":"dark","wakeLock":true}')).toEqual({
      theme: "dark",
      bellOffsetSec: 0,
    });
  });

  it("accepts every theme it offers", () => {
    for (const theme of THEMES) {
      expect(loadPreferences(JSON.stringify({ theme })).theme).toBe(theme);
    }
  });
});

describe("parseBellOffset", () => {
  it("accepts an integer inside the cap, in both directions", () => {
    expect(parseBellOffset(0)).toBe(0);
    expect(parseBellOffset(12)).toBe(12);
    expect(parseBellOffset(-12)).toBe(-12);
  });

  it("accepts exactly the cap and refuses one past it", () => {
    expect(parseBellOffset(BELL_OFFSET_LIMIT_SEC)).toBe(BELL_OFFSET_LIMIT_SEC);
    expect(parseBellOffset(-BELL_OFFSET_LIMIT_SEC)).toBe(-BELL_OFFSET_LIMIT_SEC);
    expect(parseBellOffset(BELL_OFFSET_LIMIT_SEC + 1)).toBeNull();
    expect(parseBellOffset(-BELL_OFFSET_LIMIT_SEC - 1)).toBeNull();
  });

  it.each([
    ["a fraction", 1.5],
    ["a string", "12"],
    ["null", null],
    ["undefined", undefined],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["an object", { seconds: 12 }],
  ])("refuses %s", (_label, value) => {
    expect(parseBellOffset(value)).toBeNull();
  });

  it("normalises negative zero", () => {
    // -0 is an integer and inside the cap, so it reaches the panel and the
    // engine as a value that compares unequal to 0 under Object.is.
    expect(Object.is(parseBellOffset(-0), 0)).toBe(true);
  });
});

describe("the pre-paint theme script", () => {
  /**
   * The script cannot import anything - it runs before the first module - so it
   * repeats the storage key and the theme names as literals. These assertions
   * are what turns that duplication from a silent trap into a failing test: a
   * rename that misses the script would otherwise ship, and would revert every
   * explicit theme to the OS default for one frame on every load.
   */
  it("reads the key preferences are actually stored under", () => {
    expect(THEME_SCRIPT).toContain(PREFERENCES_KEY);
  });

  it("writes the attribute the stylesheet branches on", () => {
    expect(THEME_SCRIPT).toContain(THEME_ATTRIBUTE);
  });

  it("names both explicit themes and not the implicit one", () => {
    expect(THEME_SCRIPT).toContain('"light"');
    expect(THEME_SCRIPT).toContain('"dark"');
    // "system" means "leave the attribute off"; a script that set it would make
    // :root[data-theme="dark"] stop matching for a reason nothing explains.
    expect(THEME_SCRIPT).not.toContain('"system"');
  });

  it("swallows its own failures", () => {
    // localStorage throws on ACCESS in private mode and under a block-site-data
    // setting. This is the first script on the page; one that throws takes the
    // whole of it down.
    expect(THEME_SCRIPT).toContain("try{");
    expect(THEME_SCRIPT).toContain("catch");
  });
});

describe("isTheme", () => {
  it("accepts the three themes and nothing else", () => {
    for (const theme of THEMES) expect(isTheme(theme)).toBe(true);
    for (const value of ["", "Dark", "solarized", null, 3, {}]) expect(isTheme(value)).toBe(false);
  });
});

describe("applyTheme", () => {
  /** A stand-in for `<html>`; this file needs no DOM beyond the two methods. */
  function fakeRoot() {
    const attributes = new Map<string, string>();

    return {
      attributes,
      setAttribute: (name: string, value: string) => void attributes.set(name, value),
      removeAttribute: (name: string) => void attributes.delete(name),
    } as unknown as HTMLElement & { attributes: Map<string, string> };
  }

  it("sets the attribute for an explicit theme", () => {
    const root = fakeRoot();

    applyTheme(root, "dark");
    expect(root.attributes.get(THEME_ATTRIBUTE)).toBe("dark");

    applyTheme(root, "light");
    expect(root.attributes.get(THEME_ATTRIBUTE)).toBe("light");
  });

  it("REMOVES the attribute for system rather than setting it to 'system'", () => {
    const root = fakeRoot();

    applyTheme(root, "dark");
    applyTheme(root, "system");

    expect(root.attributes.has(THEME_ATTRIBUTE)).toBe(false);
  });
});
