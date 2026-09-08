# Code review — 2026-09-01, working tree on `feat/phase-4-day-types`

Review of the Phase 4 change — the schedules picker, the calendar panel, the
confirm dialog, id-minting at the parse boundary, six library mutators, and the
CSS and reflow work that came with them — against `4fd92c9` *"docs: caveat every
inherited research doc, and fix four dead links (#19)"*. Nothing was committed
at review time, so the scope was the working tree; the range against
`origin/main` is empty.

Effort: `high`. Three findings, **all three fixed** in the same session, plus a
**fourth found while fixing the second** that turned out to predate the phase —
see **What was changed** at the bottom. The findings below are recorded as they
were written, before the fixes.

The phase's load-bearing parts hold up. `withUniqueIds`' two-pass claim-then-mint
is correct — pre-registering every claimed id in pass one is exactly what stops a
mint from colliding with a row further down, and the first claimant of a
duplicated id keeps it, which is what makes `duplicateSchedule` safe. The
calendar re-pointing on delete is right in both directions. The Escape guard, the
index clamping and the editor's draft round trip are all sound.

All three findings are in the same place instead: **the dated-exception form**,
which is the one surface in this phase where an untrusted string and a boundary
cap meet a control that reports neither. Two of them make a user action silently
do nothing.

---

## Summary

| # | Where | Severity | Finding |
| --- | --- | --- | --- |
| 1 | `src/app/_lib/library.ts:270` | High | `setOverride` at the cap discards the entry being added, not an old one |
| 2 | `src/app/_components/CalendarPanel.tsx:182` | Medium | The raw date-input string reaches `setOverride` unvalidated |
| 3 | `src/app/_components/SettingsView.tsx:74` | Low | The inactive tab's `aria-controls` names an id that is not in the DOM |
| 4 | `src/app/globals.css:1072` | Medium | *Found during the fix, not the review:* the `aria-invalid` border has never painted, since Phase 3 |

---

## 1. `setOverride` at the cap discards the entry being added

**Where:** `src/app/_lib/library.ts:270`, with `src/lib/parse.ts:317` and
`src/app/_components/CalendarPanel.tsx:98`.

```ts
export function setOverride(library, date, scheduleId): Library {
  const others = library.calendar.overrides.filter((entry) => entry.date !== date);

  return withCalendar(library, {
    ...library.calendar,
    overrides: [...others, { date, scheduleId }],
  });
}
```

The new entry is appended **last**, and `parseCalendar` applies the cap by
slicing the **first** 400 before sorting:

```ts
for (const raw of rawOverrides.slice(0, SCHEDULE_LIMITS.overrides)) {
```

So at 400 overrides the array handed to the parser is 401 long, the slice keeps
the 400 that were already there, and the one the user just asked for is the one
thrown away. The function returns a library that looks successfully updated and
is not.

Verified by running it: 400 in, `setOverride` for a new date, 400 out, and
`overrides.some((o) => o.date === "2099-12-25")` is `false`.

**It is reachable from the UI without the guard the form has.** `#override-add`
is disabled at `atOverrideLimit`, but the "Use this schedule today" select at
`CalendarPanel.tsx:98` is not gated at all, and it calls the same `setOverride`.
On a full calendar, choosing a schedule for today changes nothing and says
nothing — and the select then snaps back to its previous value on the next
render, because its value is derived from the state that did not change.

**The guard the form does have is also wrong in the other direction.**
`atOverrideLimit` is `overrides.length >= 400` regardless of the date typed, but
`setOverride` *replaces* an entry for a date that already exists — which cannot
grow the list. At the cap, correcting an exception you already have is refused by
a disabled button, while adding a new one through the Today select is accepted
and silently dropped. Both halves are backwards.

Verified: at the cap, `setOverride(full, existingDate, "assembly")` updates that
entry correctly. The list stays at 400.

**Fix:** refuse in the mutator rather than letting the boundary discard silently
— `if (others.length >= SCHEDULE_LIMITS.overrides) return library` catches
exactly the case that grows the list and leaves replacement working. Then make
the UI's gate mean the same thing: disabled only when the date typed is *new*,
with a message saying the calendar is full, and the Today select disabled on the
same condition since every option that would work is unavailable.

Note the cap itself is not the problem and should not be raised. It is a boundary
protection against a hostile payload, and `AGENTS.md` is explicit that
decompression is a boundary. What is wrong is a user-facing mutator relying on it
for flow control.

---

## 2. The raw date-input string reaches `setOverride` unvalidated

**Where:** `src/app/_components/CalendarPanel.tsx:182`, with
`src/app/_components/CalendarPanel.tsx:160` and `src/lib/parse.ts:102`.

```tsx
onClick={() => {
  save(setOverride(library, newDate, newScheduleId || null));
  setNewDate("");
}}
```

`newDate` is whatever the date input reported. `IsoDate` is a bare `string`
alias — deliberately, and the type comment says so — so nothing in the signature
catches this, and `setOverride` has no `parseIsoDate` of its own. The bad value
travels to `parseCalendar`, which drops it, while `setNewDate("")` clears the
field. The result is a control that accepts a click, empties itself, and does
nothing, with no error bound to any field.

This is the shape `AGENTS.md` bans by name: *"errors associated to their field
(`aria-describedby`) — not just a red border"*. Here there is not even a red
border.

**It is reachable.** Chrome's `<input type="date">` accepts years well past four
digits — a typo of `20260` for `2026` yields `"20260-09-14"`, which is a value
the control considers valid and `parseIsoDate` rejects on its
`/^\d{4}-\d{2}-\d{2}$/` test. Verified: `parseIsoDate("20260-09-14")` is `null`,
and `setOverride(DEFAULT_LIBRARY, "20260-09-14", "regular")` returns a library
whose `overrides` is `[]`.

Note this is a *reporting* failure, not a data-integrity one. The boundary held:
nothing invalid was stored, which is the parser doing its job. What is missing is
the half of "parse, don't validate" that the editor already does properly — the
structured error being shown to the person who caused it.

**Fix:** parse at the control. `parseIsoDate(newDate)` decides whether Add is
enabled, and drives an `aria-invalid` plus an `aria-describedby` message on the
input, matching `PeriodRow`. A guard in `setOverride` as well, so the mutator
refuses rather than appears to succeed, makes the data behaviour unit-testable
without a DOM.

---

## 3. The inactive tab's `aria-controls` names an id that is not in the DOM

**Where:** `src/app/_components/SettingsView.tsx:74`.

```tsx
aria-pressed={panel === id}
aria-controls={`panel-${id}`}
```

Only one panel renders at a time, so while Schedules is showing there is no
`#panel-calendar` anywhere on the page and the Calendar tab's `aria-controls`
is a dangling IDREF. ARIA requires an IDREF to resolve; a dangling one is
undefined behaviour that assistive technology is free to report as a broken
relationship or to ignore entirely.

Low severity — `aria-pressed` already carries the state that matters, and the
panel is the next element in DOM order — but it is a real ARIA error, and this
repo runs `eslint-plugin-jsx-a11y` at full `recommended` precisely because the
cheap ones should not accumulate. The rule that would have caught it,
`jsx-a11y/aria-proptypes`, checks the attribute's *type* and cannot know whether
an id exists at runtime.

**Fix:** drop `aria-controls`. These are pressed-state buttons, not tabs — the
decision recorded in the build log — and a toggle whose panel immediately follows
it in DOM order gains nothing from the attribute. Making it conditional on the
tab being pressed would also resolve the IDREF, but a button saying "I control
the thing that is currently showing" is close to tautology.

---

## Checked and cleared

Recorded so the same ground is not re-covered:

- **`withUniqueIds`' two passes are both necessary and correctly ordered.** Pass
  one claims every usable id *before* pass two mints anything, which is what
  stops `s2` being minted for row 0 while row 3 already answers to `s2`. The
  first claimant of a duplicated id keeps it, which is the property
  `duplicateSchedule` relies on to leave the original's calendar days intact.
- **The `filter(isIdentified)` narrowing cannot shorten the list.** Every entry
  passed through `withUniqueIds` first, and the 12-entry test asserts the count
  survives.
- **`ScheduleEditor`'s `isIdentified` guard is unreachable, not a silent drop.**
  `toDraft` carries the schedule's id into the draft and `draftToInput` passes it
  through, so the parsed value always has one.
- **The editor's `key={`${index}:${schedule.id}`}` remounts at the right times.**
  Both parts change on a chip switch; the id changes when index 0 is deleted and
  its neighbour slides in; neither changes on a rename, which is what keeps the
  cursor in the name field.
- **Index clamping is correct across all three structural changes.** `Math.min`
  against `count - 1` covers deleting the last chip; create and duplicate select
  before saving and land on the right entry.
- **The Escape guard is in the right place and the right shape.**
  `document.querySelector("dialog[open]")` is evaluated during the bubble phase,
  before the dialog's close runs as the event's default action.
- **`deleteSchedule` dropping overrides rather than letting them degrade is
  correct**, and is the opposite call from weekdays for a good reason: a null
  override *means* closure, a null weekday means no school.
- **Every gate passes on the working tree:** `eslint .`, `tsc --noEmit`,
  `vitest run` (244/244), `markdownlint-cli`, and `playwright test`
  (108 passed / 10 parked).

---

## Recommended order

1. Finding 1 — the only one that loses a user's data, and the mutator guard is
   what makes the UI gate expressible.
2. Finding 2 — same file, same form, and the two fixes share the disabled-state
   logic on the Add button.
3. Finding 3 — one attribute.

---

## What was changed

All three fixed on 2026-09-01, in the recommended order.

**Finding 1 — `src/app/_lib/library.ts`.** `setOverride` gained a cap guard on
`others`, not on the current list:

```ts
const others = library.calendar.overrides.filter((entry) => entry.date !== validDate);
if (others.length >= SCHEDULE_LIMITS.overrides) return library;
```

That is the distinction the review turned on. `others` excludes any entry for the
date being written, so replacing is measured at 399 and stays legal at the cap,
while a genuinely new date is measured at 400 and is refused. The function now
returns the library **by identity** when it refuses, which is what makes the
refusal detectable rather than a new object that looks like a successful write.

The cap in `parseCalendar` was left alone. Keeping the first 400 is correct for
an untrusted payload arriving from storage or a link; it was never flow control.

**Finding 2 — `src/app/_lib/library.ts` and
`src/app/_components/CalendarPanel.tsx`.** Two halves, deliberately:

- The mutator parses the date and refuses when it is not one, so the data
  behaviour is unit-testable with no DOM.
- The panel parses it too, because *a mutator that refuses is still a control
  that did nothing*. `parseIsoDate(newDate)` now drives the Add button's
  disabled state, an `aria-invalid` on the input, and an `aria-describedby`
  message — the same shape `PeriodRow` already used, which is what `AGENTS.md`
  asks for.

The "calendar is full" state got the same treatment: a message bound to the
control it blocks, in both places an override can be written. The Today select is
**disabled** in that state rather than left to fail silently, and disabling costs
nothing — at the cap the only option that would work is "Follow the weekday
default", which is already its value whenever it is blocked.

### A fourth defect, found while fixing the second

Widening `globals.css`'s invalid-field rule from `.editor [aria-invalid="true"]`
to cover the calendar panel turned up something worse: **that rule had never
painted anything, in either place, for the whole of Phase 3 and Phase 4.**

`.editor [aria-invalid="true"]` is specificity (0,2,0). `.editor
input[type="text"]` is (0,2,1) and sets the `border` SHORTHAND, which resets
`border-color` along with the width and style. The shorthand won every time.

Measured rather than reasoned about, in Chrome, before and after:

| Field | State | Computed `border-top-color` |
| --- | --- | --- |
| Editor period name | valid | `rgb(107, 85, 68)` |
| Editor period name | `aria-invalid="true"` | `rgb(107, 85, 68)` |
| Calendar date | `aria-invalid="true"` | `rgb(107, 85, 68)` |

`--danger` is `#d8453f`. Nothing on that list was ever red.

**Why no test caught it.** Every assertion in `editor.spec.ts` checked the
ATTRIBUTE — `toHaveAttribute("aria-invalid", "true")` — which was always set
correctly. The attribute was never the broken half. The repo's own rule that a
red border is not enough on its own is what made this survivable rather than
serious: the message and the `aria-describedby` binding did work, so the
information reached everyone; it just reached sighted users as plain text with no
emphasis.

**Fixed** with a new section at the end of `globals.css` that names the element
in each selector — taking it to (0,2,1) — and relies on being last in the file to
win the resulting tie against both control skins. Both E2E suites now assert the
COMPUTED colour rather than the attribute.

The general lesson is about the assertion, not the cascade: a test that checks
the attribute a style keys off is not a test of the style. Where the visual state
is the point, measure the pixel.

**Finding 3 — `src/app/_components/SettingsView.tsx`.** `aria-controls` removed
from the tabs, with the reasoning kept in the component's doc comment so it is
not re-added.

### Tests

**Unit, `src/app/_lib/library.test.ts` — 36 to 44.** Four refused dates
(five-digit year, empty string, month 13, 29 February in a non-leap year), each
asserted with `toBe(DEFAULT_LIBRARY)` so an accidental "returns a fresh empty
library" cannot pass. Then a `describe` block on a calendar built up to the cap
**through `setOverride` itself**, covering: a new date refused by identity, an
existing date still replaced, and removing one as the way back under the cap.

**E2E, `e2e/calendar.spec.ts` — 8 to 11, and `e2e/editor.spec.ts` gained a
computed-colour assertion.** The half a unit test cannot reach.
Chrome really will hold `20260-09-14` in a date input, so the first test types
it, asserts the button is disabled and the message is bound, then corrects the
year and asserts the error clears and the add succeeds. The other two plant a
400-exception calendar through storage and assert the blocked Today select, the
blocked Add for a new date, the *unblocked* Add for a date already listed, and
the recovery after a removal.

### Verified after the change

- `npm run lint`, `npm run typecheck`, `npx vitest run` (252/252),
  `npx playwright test` (111 passed / 10 parked) and `npx markdownlint-cli` all
  pass.
- Re-ran the three assertions that reproduced the bugs before the fix. All three
  now fail against the old behaviour and pass against the new one.
