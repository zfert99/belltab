import type { Period } from "./schedule";

/**
 * Real encoded links, and exactly what each one must still decode to.
 *
 * **ENTRIES ARE ADDED, NEVER REMOVED OR EDITED.** `AGENTS.md` calls this out by
 * name, and it is the only mechanism that makes "a shared link is a format you
 * support forever" enforceable rather than aspirational. Every string below was
 * produced by the encoder that shipped on the date beside it, and somebody may
 * still have it in a chat window.
 *
 * The expectations are written out in full rather than derived from
 * `DEFAULT_SCHEDULES`, and that is the point of the file. Deriving them would
 * make an edit to the seed data silently rewrite what these payloads are
 * supposed to mean, and the suite would stay green while the guarantee it exists
 * to protect quietly stopped being checked.
 *
 * When the format changes: add a new version to the dispatch table in
 * `share.ts`, add its fixtures here, and leave every older entry exactly where
 * it is. If an old entry ever fails, the format broke - the fixture did not.
 *
 * **One edit to expectations, 2026-09-03, and what it was:** every `kind` in
 * the older entries read `"class"` / `"lunch"` / `"passing"` and now reads
 * `"Class"` / `"Lunch"` / `"Passing"`. The PAYLOADS are untouched - they still
 * carry the lowercase strings - and they still decode to the same schedule;
 * what changed is that the parser now normalises a built-in kind to its
 * canonical spelling on the way in, so the decoded VALUE spells them that way.
 * The expectation is what the payload means, and its meaning did not change.
 */

export interface ShareFixture {
  /** What this payload is here to prove. */
  label: string;
  /** Payload version, matching the prefix on `encoded`. */
  version: string;
  /** The date the entry was added, so a run of them reads as a history. */
  added: string;
  /** The fragment, exactly as it would appear after `#`. */
  encoded: string;
  expected: { name: string; periods: readonly Period[] };
}

export const SHARE_FIXTURES: readonly ShareFixture[] = [
  {
    label: "the seeded Regular day - eleven periods, the largest thing the app ships",
    version: "1",
    added: "2026-09-01",
    encoded:
      "1.ldA9C4MwEIDhv1JuzpBUL4lu3VsoXUuHoMGG2lSMTuJ_L9gPr1QCjnfh5eEygDd3CzmcbNXXpgUGjW3dowyQn4fP43FabQQwuDlfQg5FbUIABqEzbXdwHvJUcwbWl9OACY5szk0Izldz3XwXc48Jkj796V_8NsZjSnLJV_OS017wfz6J8VKQ66Wk_G6z731xnev6PZJaUjxbuD2N4hnJFfK1tyvktF_gMcYrJLwWq3lN_06LBV7GeC0or_h4GZ8",
    expected: {
      name: "Regular",
      periods: [
        { name: "Period 1", kind: "Class", startMin: 480, endMin: 535 },
        { name: "Passing", kind: "Passing", startMin: 535, endMin: 545 },
        { name: "Period 2", kind: "Class", startMin: 545, endMin: 605 },
        { name: "Passing", kind: "Passing", startMin: 605, endMin: 610 },
        { name: "Period 3", kind: "Class", startMin: 610, endMin: 665 },
        { name: "A Lunch", kind: "Lunch", startMin: 665, endMin: 695 },
        { name: "Period 4", kind: "Class", startMin: 695, endMin: 750 },
        { name: "Passing", kind: "Passing", startMin: 750, endMin: 755 },
        { name: "Period 5", kind: "Class", startMin: 755, endMin: 810 },
        { name: "Passing", kind: "Passing", startMin: 810, endMin: 815 },
        { name: "Period 6", kind: "Class", startMin: 815, endMin: 870 },
      ],
    },
  },
  {
    label: "the seeded Half day - a schedule with no lunch period at all",
    version: "1",
    added: "2026-09-01",
    encoded:
      "1.lY_BCsIwEER_ReacQxK7W8kXeBG8i4dgqgRrLE0vUvrvQkWbYgn0uLM83kyPYB8VDPa2vm6cfUGgqVr_dBHm1H-_xzHaKAjcfXAwuNQ2RgjEzrbdwQeYYicFquDGg7QcxITbGH24TXTzCyae9IynlP_odU5PmhKcabWeU76U__ptVl8m7VmtXs9qxi-sL3J6Vkl7ptXrmVKeF9ZTVs9J-1LK4Ty8AQ",
    expected: {
      name: "Half day",
      periods: [
        { name: "Period 1", kind: "Class", startMin: 480, endMin: 520 },
        { name: "Passing", kind: "Passing", startMin: 520, endMin: 525 },
        { name: "Period 2", kind: "Class", startMin: 525, endMin: 565 },
        { name: "Passing", kind: "Passing", startMin: 565, endMin: 570 },
        { name: "Period 3", kind: "Class", startMin: 570, endMin: 610 },
        { name: "Passing", kind: "Passing", startMin: 610, endMin: 615 },
        { name: "Period 4", kind: "Class", startMin: 615, endMin: 655 },
        { name: "Passing", kind: "Passing", startMin: 655, endMin: 660 },
        { name: "Period 5", kind: "Class", startMin: 660, endMin: 700 },
      ],
    },
  },
  {
    label: "one period, one minute long - the smallest schedule the parser accepts",
    version: "1",
    added: "2026-09-01",
    encoded:
      "1.q1bKS8xNVbJSclTSUSpILcrMTylWsoquhgkHKOkoZWfmpShZKSXnJBYXK-koFZckFpX4ZuYpWRnoKKXmpYCZhrWxtQA",
    expected: {
      name: "A",
      periods: [{ name: "P", kind: "Class", startMin: 0, endMin: 1 }],
    },
  },
  {
    label: "no periods - legal, and the state the countdown renders as an empty day",
    version: "1",
    added: "2026-09-01",
    encoded: "1.q1bKS8xNVbJScs0tKKlU0lEqSC3KzE8pVrKKjq0FAA",
    expected: { name: "Empty", periods: [] },
  },
  {
    label: "non-ASCII names - accents, an em dash, CJK and an emoji, all round-tripped as UTF-8",
    version: "1",
    added: "2026-09-01",
    encoded:
      "1.q1bKS8xNVbJSOtyZnJ-TWqzwqGGKwrPpS5_NWaOko1SQWpSZn1KsZBVdDVPnnJh2eKXCoxlTlXSUsjPzUpSslHJK85IzlHSUiksSi0p8M_OUrMwNDHSUUvNSIBxjg9rYWgA",
    expected: {
      name: "Écoles — 日本",
      periods: [{ name: "Café ☕", kind: "Lunch", startMin: 700, endMin: 730 }],
    },
  },
  {
    label: "custom kinds - two built-ins and a kind of the user's own, kept as typed",
    version: "1",
    added: "2026-09-03",
    encoded:
      "1.VY69CgMhEAZfRba2uICGnG2aNIGDlOGKBSWR6BrUFMfhux_kTy132Bm-FQi9AQWTQyJLN6ZxAQ5PE23QCdR1_X2cgjcxBA8cHpZ0T1LGmM-WQInDwMGQ_hyjLPxfmN5RtquFo8OUen2UVZei078Tq96QWpCiLXQDLvmlF3ZH52qjY02l3bEXQ5nLBg",
    expected: {
      name: "Planning day",
      periods: [
        { name: "Homeroom", kind: "Homeroom", startMin: 480, endMin: 495 },
        { name: "Period 1", kind: "Class", startMin: 495, endMin: 545 },
        { name: "Planning", kind: "Planning", startMin: 545, endMin: 595 },
        { name: "Study hall", kind: "Study hall", startMin: 595, endMin: 640 },
      ],
    },
  },
];
