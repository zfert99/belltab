import { describe, it, expect } from "vitest";
import {
  formatClock,
  formatDuration,
  splitCountdown,
  formatDayCaption,
  formatPeriodLabel,
  formatTabTitle,
} from "./format.js";
import { DEFAULT_SCHEDULES } from "./schedule.js";

const regular = DEFAULT_SCHEDULES[0];
const h12 = { hour12: true };
const h24 = { hour12: false };

describe("formatClock", () => {
  it("defaults to 12-hour when given no options", () => {
    expect(formatClock(545)).toBe("9:05");
  });

  it.each([
    [480, "8:00"],
    [545, "9:05"],
    [720, "12:00"],
    [815, "1:35"],
    [0, "12:00"],
  ])("renders %i as %s in 12-hour", (minutes, expected) => {
    expect(formatClock(minutes, h12)).toBe(expected);
  });

  it.each([
    [480, "08:00"],
    [545, "09:05"],
    [720, "12:00"],
    [815, "13:35"],
    [0, "00:00"],
    [870, "14:30"],
    [1439, "23:59"],
  ])("renders %i as %s in 24-hour", (minutes, expected) => {
    expect(formatClock(minutes, h24)).toBe(expected);
  });

  it("agrees on the minute across both formats, all day", () => {
    for (let minute = 0; minute < 1440; minute++) {
      expect(formatClock(minute, h12).split(":")[1]).toBe(formatClock(minute, h24).split(":")[1]);
    }
  });

  // Uniform width means switching the preference cannot shift the layout.
  it("is always five characters in 24-hour", () => {
    const widths = new Set();
    for (let minute = 0; minute < 1440; minute++) widths.add(formatClock(minute, h24).length);
    expect([...widths]).toEqual([5]);
  });
});

describe("formatDuration", () => {
  it.each([
    [5, "5m"],
    [55, "55m"],
    [60, "1h"],
    [90, "1h 30m"],
    [0, "0m"],
  ])("renders %i minutes as %s", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe("splitCountdown", () => {
  it("shows minutes and seconds under an hour", () => {
    expect(splitCountdown(43 * 60 + 12)).toEqual({ major: "43", minor: "12" });
    expect(splitCountdown(61)).toEqual({ major: "1", minor: "01" });
  });

  // "218:12" is unreadable, so past an hour it flips to hours and minutes.
  // The two modes look identical, which is a known gap - see the build log.
  it("shows hours and minutes over an hour", () => {
    expect(splitCountdown(3600)).toEqual({ major: "1", minor: "00" });
    expect(splitCountdown(2 * 3600 + 38 * 60)).toEqual({ major: "2", minor: "38" });
  });

  it("clamps negatives rather than rendering them", () => {
    expect(splitCountdown(-90)).toEqual({ major: "0", minor: "00" });
  });

  it("floors fractional seconds", () => {
    expect(splitCountdown(59.9)).toEqual({ major: "0", minor: "59" });
  });
});

describe("formatDayCaption", () => {
  const position = { index: 3, total: 7 };

  it("counts toward the first bell before school", () => {
    const day = { phase: "before", remainingSec: 3600, progress: 0 };
    expect(formatDayCaption(day, position)).toBe("3 of 7 · 1:00 until first bell");
  });

  it("counts toward dismissal during the day", () => {
    const day = { phase: "during", remainingSec: 3 * 3600 + 38 * 60, progress: 0.4 };
    expect(formatDayCaption(day, position)).toBe("3 of 7 · 3:38 until dismissal");
  });

  it("stops counting once the day is done", () => {
    const day = { phase: "after", remainingSec: 0, progress: 1 };
    expect(formatDayCaption(day, position)).toBe("7 of 7 · done for today");
  });

  it("says so when there is no schedule", () => {
    expect(formatDayCaption({ phase: "empty", remainingSec: 0 }, { index: 0, total: 0 })).toBe(
      "No schedule",
    );
  });
});

describe("formatPeriodLabel", () => {
  it("follows the clock preference", () => {
    expect(formatPeriodLabel(regular.periods[2], h12)).toBe("Period 2 · 9:05–10:05");
    expect(formatPeriodLabel(regular.periods[2], h24)).toBe("Period 2 · 09:05–10:05");
    expect(formatPeriodLabel(regular.periods[10], h12)).toBe("Period 6 · 1:35–2:30");
  });
});

describe("formatTabTitle", () => {
  // Number first, so it survives truncation to a few characters in a crowded
  // tab strip.
  it("puts the number first", () => {
    const state = { phase: "during", current: { name: "Period 2" }, remainingSec: 43 * 60 };
    expect(formatTabTitle(state)).toBe("43m - Period 2");
  });

  // ceil, not floor: with 30 seconds left, "0m" reads as "it is over".
  it("rounds up, so it never reads 0m while a period is running", () => {
    const state = { phase: "during", current: { name: "Period 2" }, remainingSec: 30 };
    expect(formatTabTitle(state)).toBe("1m - Period 2");
  });

  it("names the next period when none is running", () => {
    const state = { phase: "before", next: { name: "Period 1" }, remainingSec: 600 };
    expect(formatTabTitle(state)).toBe("10m - Period 1");
  });

  it("has an end state and an empty state", () => {
    expect(formatTabTitle({ phase: "after", remainingSec: 0 })).toBe("Done - BellTab");
    expect(formatTabTitle({ phase: "empty", remainingSec: 0 })).toBe("BellTab");
  });
});
