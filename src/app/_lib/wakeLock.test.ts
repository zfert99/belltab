import { describe, expect, it } from "vitest";
import { describeWakeLock, type WakeLockStatus } from "./wakeLock";

/**
 * The wake lock's wording.
 *
 * The hook itself is deliberately not tested here. Every branch it has is a
 * browser behaviour - a rejected request, a lock the tab took back when it was
 * hidden, an engine with no API at all - and a jsdom `navigator` stub asserting
 * against a hand-written fake would prove that the fake matches the code rather
 * than that the code matches a browser. `e2e/wake-lock.spec.ts` drives the real
 * thing on three engines, including a stubbed refusal.
 *
 * What is worth pinning without a browser is the sentence each status produces,
 * because those sentences are the ONLY way a user finds out that a ticked box
 * did not take effect. Silence is the failure mode being designed against.
 */

const ALL_STATUSES: readonly WakeLockStatus[] = [
  "unsupported",
  "off",
  "held",
  "waiting",
  "refused",
];

describe("describeWakeLock", () => {
  it.each(ALL_STATUSES)("says something for %s", (status) => {
    const sentence = describeWakeLock(status);

    expect(sentence.length).toBeGreaterThan(0);
    // A readout that does not end in a full stop is a fragment, and this one
    // sits directly under a checkbox where a fragment reads as a label.
    expect(sentence.endsWith(".")).toBe(true);
  });

  it("says something DIFFERENT for every status", () => {
    // The point of five statuses rather than a boolean is that they are five
    // different facts. Two of them sharing a sentence would collapse the
    // distinction where the user can see it while leaving it in the types,
    // which is the version of this bug that no type checker catches.
    const sentences = new Set(ALL_STATUSES.map(describeWakeLock));

    expect(sentences.size).toBe(ALL_STATUSES.length);
  });

  it("names a cause for the two statuses that mean something is wrong", () => {
    // "It didn't work" is not an answer anybody can act on. `unsupported` has to
    // pin the blame on the browser and `refused` on the device, because those
    // are the two different things the user would go and change.
    expect(describeWakeLock("unsupported")).toContain("browser");
    expect(describeWakeLock("refused")).toContain("Battery saver");
  });

  it("tells a refused user what will make it try again", () => {
    // The refusal's cause clears without an event, and the retry is on the
    // next touch - a sentence that named the cause without the remedy would
    // leave the one user it exists for pressing a box that already looks on.
    expect(describeWakeLock("refused")).toMatch(/tap|key/i);
  });

  it("does not call an ordinary hidden tab a failure", () => {
    // `waiting` is the status a backgrounded tab sits in for hours at a time,
    // and it is entirely correct. Wording it as a problem would train users to
    // ignore the one line that also reports real ones.
    const waiting = describeWakeLock("waiting");

    expect(waiting).not.toMatch(/refus|cannot|fail|error/i);
    expect(waiting).toContain("visible");
  });
});
