import { describe, it, expect } from "vitest";
import {
  formatClock,
  formatDuration,
  formatDayCaption,
  formatRemaining,
  splitCountdown,
  formatPeriodLabel,
  formatTabTitle,
  announcementFor,
  boundaryKey,
  type ClockOptions,
} from "./format";
import type { DayState, DaySummary } from "./engine";
import { DEFAULT_SCHEDULES, type Period } from "./schedule";

const regular = DEFAULT_SCHEDULES[0];
const h12: ClockOptions = { hour12: true };
const h24: ClockOptions = { hour12: false };

/**
 * `DayState` is a discriminated union, so these builders spell out the whole
 * shape rather than the two or three fields the formatter reads.
 *
 * That is a feature: the times a state is faked in a test are exactly the
 * times it is easiest to fake one the engine could never produce.
 */
const somePeriod = (name: string): Period => ({
  name,
  kind: "class",
  startMin: 545,
  endMin: 605,
});

const during = (name: string, remainingSec: number): DayState => ({
  phase: "during",
  current: somePeriod(name),
  next: null,
  remainingSec,
  progress: 0.5,
});

const before = (name: string, remainingSec: number): DayState => ({
  phase: "before",
  current: null,
  next: somePeriod(name),
  remainingSec,
  progress: 0,
});

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
    const widths = new Set<number>();
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
    expect(splitCountdown(43 * 60 + 12)).toEqual({ major: "43", minor: "12", unit: "min : sec" });
    expect(splitCountdown(61)).toEqual({ major: "1", minor: "01", unit: "min : sec" });
  });

  // "218:12" is unreadable, so past an hour it flips to hours and minutes.
  it("shows hours and minutes over an hour", () => {
    expect(splitCountdown(3600)).toEqual({ major: "1", minor: "00", unit: "hr : min" });
    expect(splitCountdown(2 * 3600 + 38 * 60)).toEqual({
      major: "2",
      minor: "38",
      unit: "hr : min",
    });
  });

  // The two modes render identically, so "3:38" alone could be three hours or
  // three minutes. The unit is what stops the clock being ambiguous about
  // itself, and it has to flip at exactly the same boundary as the numbers.
  it("names its own units, and switches them at the hour", () => {
    expect(splitCountdown(3599).unit).toBe("min : sec");
    expect(splitCountdown(3600).unit).toBe("hr : min");
  });

  it("clamps negatives rather than rendering them", () => {
    expect(splitCountdown(-90)).toEqual({ major: "0", minor: "00", unit: "min : sec" });
  });

  it("floors fractional seconds", () => {
    expect(splitCountdown(59.9)).toEqual({ major: "0", minor: "59", unit: "min : sec" });
  });
});

describe("formatPeriodLabel", () => {
  it("follows the clock preference", () => {
    expect(formatPeriodLabel(regular.periods[2], h12)).toBe("Period 2 · 9:05–10:05");
    expect(formatPeriodLabel(regular.periods[2], h24)).toBe("Period 2 · 09:05–10:05");
    expect(formatPeriodLabel(regular.periods[10], h12)).toBe("Period 6 · 1:35–2:30");
  });

  it("defaults to 12-hour, like formatClock", () => {
    expect(formatPeriodLabel(regular.periods[2])).toBe("Period 2 · 9:05–10:05");
  });
});

describe("formatTabTitle", () => {
  // Number first, so it survives truncation to a few characters in a crowded
  // tab strip.
  it("puts the number first", () => {
    expect(formatTabTitle(during("Period 2", 43 * 60))).toBe("43m · Period 2");
  });

  // ceil, not floor: with 30 seconds left, "0m" reads as "it is over".
  it("rounds up, so it never reads 0m while a period is running", () => {
    expect(formatTabTitle(during("Period 2", 30))).toBe("1m · Period 2");
  });

  it("names the next period when none is running", () => {
    expect(formatTabTitle(before("Period 1", 600))).toBe("10m · Period 1");
  });

  it("has an end state and an empty state", () => {
    const after: DayState = {
      phase: "after",
      current: null,
      next: null,
      remainingSec: 0,
      progress: 1,
    };
    const empty: DayState = {
      phase: "empty",
      current: null,
      next: null,
      remainingSec: 0,
      progress: 0,
    };
    expect(formatTabTitle(after)).toBe("Done · BellTab");
    expect(formatTabTitle(empty)).toBe("BellTab");
  });
});

describe("formatRemaining", () => {
  // The Day view prints this directly beneath rows formatted by
  // formatDuration ("55m", "1h 30m"), where a bare "1:20" reads as one minute
  // twenty. Spelling the units out is the whole point of the function.
  it("never produces a bare colon form", () => {
    for (const seconds of [0, 1, 59, 60, 3599, 3600, 3601, 12 * 3600]) {
      expect(formatRemaining(seconds)).not.toMatch(/^\d+:\d{2}$/);
    }
  });

  it.each([
    [0, "0m 00s"],
    [59, "0m 59s"],
    [60, "1m 00s"],
    [49 * 60 + 16, "49m 16s"],
    [59 * 60 + 59, "59m 59s"],
  ])("spells minutes and seconds under an hour: %i -> %s", (seconds, expected) => {
    expect(formatRemaining(seconds)).toBe(expected);
  });

  it.each([
    [3600, "1h 00m"],
    [3600 + 5 * 60, "1h 05m"],
    [3600 + 20 * 60 + 59, "1h 20m"],
    [6 * 3600 + 24 * 60, "6h 24m"],
  ])("flips to hours and minutes at an hour: %i -> %s", (seconds, expected) => {
    expect(formatRemaining(seconds)).toBe(expected);
  });

  // The minor part stays padded even though formatDuration would not pad it:
  // this string ticks once a second, and an unpadded seconds place changes its
  // width every ten seconds.
  it("pads the minor part so a ticking value keeps its width", () => {
    expect(formatRemaining(65)).toBe("1m 05s");
    expect(formatRemaining(3600 + 60)).toBe("1h 01m");
  });

  // Same floor as splitCountdown: a countdown that has run out shows zero, not
  // a negative number, if a repaint lands a moment late.
  it("floors at zero rather than going negative", () => {
    expect(formatRemaining(-30)).toBe("0m 00s");
  });
});

describe("announcementFor", () => {
  it("names the period that just started", () => {
    expect(announcementFor(during("Period 2", 600))).toBe("Period 2 has started.");
  });

  it("names what is coming during a gap", () => {
    // Nothing has started, so "has started" would be a lie; what a listener
    // needs to know in a hole in the day is what the next bell is for.
    expect(
      announcementFor({
        phase: "gap",
        current: null,
        next: somePeriod("Period 3"),
        remainingSec: 240,
        progress: 0.5,
      }),
    ).toBe("Period 3 is next.");
  });

  it("says the day is over once", () => {
    expect(
      announcementFor({ phase: "after", current: null, next: null, remainingSec: 0, progress: 1 }),
    ).toBe("School is out.");
  });

  it("says nothing before the first bell or with no schedule", () => {
    // Silence is the correct output, not a missing case: before school nothing
    // has happened yet, and an empty schedule has no bells to ring.
    expect(announcementFor(before("Period 1", 3600))).toBe("");
    expect(
      announcementFor({ phase: "empty", current: null, next: null, remainingSec: 0, progress: 0 }),
    ).toBe("");
  });
});

describe("boundaryKey", () => {
  it("does not change when a running period is renamed", () => {
    // The regression this exists for: the retired build keyed the announcer on
    // the name, so typing "Chem" over "Period 2" in the editor produced four
    // announcements. Same times, same key, no announcement.
    expect(boundaryKey(during("Period 2", 600))).toBe(boundaryKey(during("Chem", 600)));
  });

  it("does not change as a period counts down", () => {
    expect(boundaryKey(during("Period 2", 3599))).toBe(boundaryKey(during("Period 2", 1)));
  });

  it("changes when the running period does", () => {
    const first: DayState = {
      phase: "during",
      current: { name: "Period 2", kind: "class", startMin: 545, endMin: 605 },
      next: null,
      remainingSec: 60,
      progress: 0.9,
    };
    const second: DayState = {
      phase: "during",
      current: { name: "Period 3", kind: "class", startMin: 610, endMin: 665 },
      next: null,
      remainingSec: 3300,
      progress: 0,
    };

    expect(boundaryKey(first)).not.toBe(boundaryKey(second));
  });

  it("identifies a gap by the period it leads to", () => {
    const gap = (nextName: string, nextStart: number): DayState => ({
      phase: "gap",
      current: null,
      next: { name: nextName, kind: "class", startMin: nextStart, endMin: nextStart + 55 },
      remainingSec: 240,
      progress: 0.5,
    });

    // Renaming the period a gap leads to is not a bell either.
    expect(boundaryKey(gap("Period 3", 610))).toBe(boundaryKey(gap("Chem", 610)));
    expect(boundaryKey(gap("Period 3", 610))).not.toBe(boundaryKey(gap("Period 3", 620)));
  });

  it("gives the phases with no period their own keys", () => {
    const flat = (phase: "before" | "after" | "empty"): DayState =>
      phase === "before"
        ? before("Period 1", 3600)
        : { phase, current: null, next: null, remainingSec: 0, progress: phase === "after" ? 1 : 0 };

    expect(new Set([boundaryKey(flat("before")), boundaryKey(flat("after")), boundaryKey(flat("empty"))]).size).toBe(3);
  });
});

describe("formatDayCaption", () => {
  const position = { index: 3, total: 7 };
  const day = (phase: DaySummary["phase"], remainingSec: number, progress: number): DaySummary => ({
    phase,
    remainingSec,
    progress,
  });

  it("counts toward the first bell before school", () => {
    expect(formatDayCaption(day("before", 3600, 0), position)).toBe(
      "3 of 7 · 1h 00m until first bell",
    );
  });

  it("counts toward dismissal during the day", () => {
    expect(formatDayCaption(day("during", 3 * 3600 + 38 * 60, 0.4), position)).toBe(
      "3 of 7 · 3h 38m until dismissal",
    );
  });

  // The regression this caption was written to prevent: one minute and one hour
  // both rendered as "1:00" while the caption carried no unit, which is the
  // whole reason splitCountdown returns one. They have to differ here.
  it("distinguishes an hour from a minute", () => {
    expect(formatDayCaption(day("before", 60, 0), position)).toBe(
      "3 of 7 · 1m 00s until first bell",
    );
    expect(formatDayCaption(day("before", 3600, 0), position)).not.toBe(
      formatDayCaption(day("before", 60, 0), position),
    );
  });

  it("stops counting once the day is done", () => {
    expect(formatDayCaption(day("after", 0, 1), position)).toBe("7 of 7 · done for today");
  });

  it("says so when there is no schedule", () => {
    expect(formatDayCaption(day("empty", 0, 0), { index: 0, total: 0 })).toBe("No schedule");
  });
});
