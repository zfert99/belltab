import { describe, expect, it } from "vitest";
import { describeChime, describeNotify, type ChimeStatus, type NotifyStatus } from "./bells";

/**
 * The bells' wording, on the same argument as `wakeLock.test.ts`: the hook's
 * branches are browser behaviours (autoplay policy, a permission prompt, a
 * hidden tab) that `e2e/bells.spec.ts` drives against stubs on three engines,
 * while the sentences are pure, and they are the only way a user learns that a
 * ticked box cannot currently ring anything.
 */

const CHIME_STATUSES: readonly ChimeStatus[] = ["unsupported", "off", "locked", "ready"];
const NOTIFY_STATUSES: readonly NotifyStatus[] = [
  "unsupported",
  "off",
  "blocked",
  "unasked",
  "ready",
];

describe("describeChime", () => {
  it.each(CHIME_STATUSES)("says a full sentence for %s", (status) => {
    const sentence = describeChime(status);

    expect(sentence.length).toBeGreaterThan(0);
    expect(sentence.endsWith(".")).toBe(true);
  });

  it("says something different for every status", () => {
    expect(new Set(CHIME_STATUSES.map(describeChime)).size).toBe(CHIME_STATUSES.length);
  });

  it("tells a locked chime what will unlock it", () => {
    // `locked` is the status a restored preference wakes up in, and "tap the
    // page" is the entire remedy - a sentence that names the state without the
    // way out would leave the one user it exists for exactly where they were.
    expect(describeChime("locked")).toMatch(/tap|press/i);
  });
});

describe("describeNotify", () => {
  it.each(NOTIFY_STATUSES)("says a full sentence for %s", (status) => {
    const sentence = describeNotify(status);

    expect(sentence.length).toBeGreaterThan(0);
    expect(sentence.endsWith(".")).toBe(true);
  });

  it("says something different for every status", () => {
    expect(new Set(NOTIFY_STATUSES.map(describeNotify)).size).toBe(NOTIFY_STATUSES.length);
  });

  it("sends a blocked user to the browser's settings, not back to the toggle", () => {
    // Once denied, re-ticking the box cannot even raise the prompt - the ask
    // resolves denied without UI - so the only true instruction is the one that
    // leaves this app entirely.
    expect(describeNotify("blocked")).toContain("site settings");
  });

  it("keeps the honest qualifier on the working status", () => {
    // "In the background" is the load-bearing phrase: a notification about a
    // visible tab is suppressed on purpose, and the sentence that describes
    // success has to describe the actual behaviour or the suppression reads as
    // a bug the first time somebody watches for a toast with the tab open.
    expect(describeNotify("ready")).toContain("background");
  });
});
