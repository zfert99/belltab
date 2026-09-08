# Code review and browser QA — 2026-09-04, `main` at `44bba48`

A full-repository audit in two passes against `44bba48` *"docs: catch the
README, the Current state block and the roadmap up with the post-roadmap work
(#50)"*, with a clean working tree.

- **Pass 1 — static review.** Every file under `src/` (57), `e2e/` (16), the
  configs, both CI workflows and `Docs/`. Asked for by the user as "any places
  it could be simplified, condensed, or optimized".
- **Pass 2 — browser QA.** The running app driven through a real Chrome: what
  can be done, what can be broken, what can be seen. Asked for as a follow-up.

Baseline at review time was green: `npm run lint`, `npm run typecheck` and
`npx vitest run` (441 tests, 13 files) all pass.

**The engine holds up.** `stateAt`, `daySummaryAt` and `blockPositionAt` are
pure, the half-open `[start, end)` rule is applied identically everywhere it
appears, `shiftNow` correctly refuses to move the date, and there is no variable
anywhere in `src/` that holds a remaining-time number and reduces it. The
recompute-never-decrement invariant was confirmed *in the browser* by replacing
`window.Date` at runtime: the countdown, the tab title, the progress fill, the
strip and the announcer all followed the new clock on the next tick, which is
only possible if every one of them is derived rather than stored.

The parse boundary also holds under attack. A 764:1 deflate bomb, prototype-key
version markers, a 200,000-character fragment and an `<img onerror>` period name
were all refused or neutralised — details in §2.2.

**Eight defects were found, all in Pass 2**, and none of them touches the five
domain invariants. Two are worth fixing before the next deploy; the rest are
small. Pass 1 found no bugs at all — only documentation drift, dead code and
duplication, which is what that pass was asked for.

> **Status.** The findings below are recorded as they were written, before any
> fix. **B1 and B5** landed in #53, **B2** in #55, **B3** in #56, and **B4, B6
> and B8** are on `fix/small-audit-items` — see *What was changed* at the
> bottom. **B7** stays open, with the reason recorded there.
> B2's severity was **corrected from High to Low** while fixing it; the
> original text is kept below with the correction beside it. Everything else
> is still open.

---

## Summary

### Defects (Pass 2 — browser QA)

| # | Where | Severity | Finding |
| --- | --- | --- | --- |
| B1 | `src/app/globals.css:2020` | **High** | The Backup panel scrolls horizontally at 320px — a WCAG 2.2 SC 1.4.10 failure that `AGENTS.md` calls a blocking check |
| B2 | `src/app/layout.tsx:105` | Low *(was High — see the correction in §B2)* | Every **development** load with an explicit Light or Dark theme logs a React hydration mismatch; production logs nothing |
| B3 | `src/app/_lib/library.ts:97` | **Medium** | One unreadable byte silently replaces the whole library with the seeded defaults, and the next write destroys the original |
| B4 | `src/app/_components/App.tsx:461` | Medium | The Day button reports `aria-pressed="true"` while the Now view is on screen |
| B5 | `e2e/reflow.spec.ts:238`, `e2e/a11y.spec.ts:254` | Medium | Both test loops hardcode 3 of the 4 settings panels — the gap that let B1 ship |
| B6 | `src/app/_components/BackupPanel.tsx:155` | Low | "This backup holds 1 schedules" |
| B7 | `src/app/_components/CalendarPanel.tsx:93` | Low | Chrome blanks an impossible date, so Add is disabled with no explanation |
| B8 | `src/app/_components/App.tsx:389` | Low | `--` means both "clock not read yet" and "no schedule today" |

### Quality findings (Pass 1 — static review)

| # | Where | Kind | Finding |
| --- | --- | --- | --- |
| S1 | 3 files | Doc integrity | Three orphaned doc comments now sit on the wrong declaration |
| S2 | 4 places | Doc integrity | Four comments contradict the code they describe |
| S3 | `DayView.tsx:66` | Duplication | Hardcodes `"data-motion"` while `MOTION_ATTRIBUTE` exists unused |
| S4 | `globals.css` ×2 | Dead code | ~45 lines of CSS no markup can reach |
| S5 | 6 exports | Dead code | Exported symbols with no importer |
| S6 | `today.ts` | Condensation | One lookup written out four times |
| S7 | `bells.ts:89`,`:182` | Condensation | Two byte-identical functions over one listener set |
| S8 | `.github/workflows/ci.yml` | Optimization | `npm ci` runs five times per PR; 190 E2E tests run on three engines |
| S9 | `.gitignore:29` | Config | `.env*` silently overrides `!.env.example` |
| S10 | `Docs/` | Organization | `Docs/archive/` does not exist; the build log is 5,130 lines |

---

## Part 1 — Static review

### S1. Three orphaned doc comments

A declaration was inserted between a JSDoc block and the thing it documents. In
a repo where the comments *are* the design record, this silently reattributes
them.

- `src/app/_lib/today.ts:55` — *"The tab title for the whole view…"* now sits on
  `scheduleForToday`. It documents `tabTitleFor`, twenty lines below.
- `src/app/_components/PreferencesPanel.tsx:625` — *"The committed offset in
  words…"* now sits on `LARGE_OFFSET_SEC`. It documents `describeOffset`.
- `src/app/globals.css:861` — the `.strip__seam` comment now sits on
  `.strip__pair`, which has a comment of its own directly beneath it.

Three instances of one mechanical slip, not three coincidences.

### S2. Comments that contradict the code

- **`globals.css:787`** — section 13's header says *"Equal-width squares …
  Proportional cells would be an accurate timeline in which every passing period
  is an unreadable sliver."* The strip is now proportional bars and passing is
  not drawn at all. `.strip__cell--block`'s own comment forty lines later
  explicitly supersedes it, so one section contains two comments disagreeing
  about the design.
- **`globals.css:801`** — *"with dashes where a passing period joins two
  blocks."* Passing is not drawn.
- **`parse.ts:283`** — `unusedScheduleId`'s doc says *"Exported because creating
  and duplicating a schedule needs the same guarantee."* Nothing outside
  `parse.ts` imports it; both paths reach it through `parseScheduleCollection`.
- **`format.ts:52`** — `COUNTDOWN_UNITS` says *"Exported so nothing has to
  compare against the literal string."* No caller outside `format.ts` uses it.

### S3. The one duplicated literal the repo's own rule forbids

`src/app/_lib/theme.ts:76` exports `MOTION_ATTRIBUTE = "data-motion"` and
nothing imports it. `src/app/_components/DayView.tsx:66` hardcodes
`getAttribute("data-motion")` instead. `theme.ts`'s own header explains why
duplicated literals get pinned together — this is the case it was written for,
left unenforced.

### S4. Dead CSS (~45 lines)

- `.shiftall`, `.shiftall__field`, `.shiftall__label`, `.shiftall__unit`,
  `.shiftall__field input` (`globals.css:1457-1478`) — no markup anywhere in the
  repo, including tests.
- `.strip__cell--link`, `.strip__cell--link.strip__cell--future`,
  `.strip__pair:has(.strip__cell--link)`, `.is-big .strip__cell--link` — the
  connector cells the strip stopped rendering when passing periods stopped being
  drawn. `.strip__seam` replaced them.
- Two stray `/* ====` openers at `globals.css:745` and `:781`, left over from
  deleted section headers.

### S5. Exports with no importer

`ringChime`, `endOf`, `draftToInput`, `unusedScheduleId`, `COUNTDOWN_UNITS`,
`MOTION_ATTRIBUTE`. Also `src/app/_components/BackupPanel.tsx:36` creates
`fileRef`, attaches it, and never reads it — the re-pick fix uses
`event.target.value = ""`. And `formatPeriodLabel` accepts and forwards
`ClockOptions` that its only caller never passes.

### S6. `today.ts` writes one lookup four times

`viewForNow`, `scheduleForToday`, `scheduleIndexToEdit` and `scheduleNameOn`
each do `resolveScheduleId(...)` then `schedules.find(c => c.id === id)`.
`CalendarPanel.tsx:75` has a fifth variant. One
`scheduleOn(library, isoDate, weekday)` collapses three of them to a line each.

### S7. Duplicated plumbing in `bells.ts`

`subscribeToAudio` (`:89`) and `subscribeToPermission` (`:182`) are
byte-identical and share one `listeners` set. `audioServerSnapshot` and
`permissionServerSnapshot` both `return null`. Four functions where two would
do.

Related smaller repeats: `PENDING = "--"` is declared in both `App.tsx:36` and
`NowView.tsx:31`; `DayView.tsx:114` and `DayStrip.tsx:54` compute the same
`elapsed`/`length` pair before calling `percentOf` — the exact duplication
`percentOf` was extracted to stop; `addPeriod` (`draft.ts:188`) evaluates
`startMin + NEW_PERIOD_MINUTES > 24 * 60` three times in three adjacent
properties.

### S8. CI does redundant work

**190 E2E tests × 3 engines = 570 runs per PR.** Only a minority need
cross-engine coverage: the reflow gate, `<dialog>`/`showModal`, the native time
and date inputs, wake lock, notifications. Preference persistence, share
round-trips and calendar CRUD cannot differ per engine. Playwright test tags
plus a per-project `grep` would let Chrome run everything and WebKit/Firefox run
the tagged subset.

**`npm ci` runs five times per PR** — once each in `lint`, `typecheck`, `build`,
`unit`, `audit`. The first, second and fourth are seconds of work behind a full
install.

### S9. `.gitignore` defeats its own negation

`.gitignore:8` has `!.env.example`; `.gitignore:29` has a second `.env*` under
"Editor and OS". Later patterns win, so `.env.example` is ignored — confirmed
with `git check-ignore -v .env.example`, which names line 29. `AGENTS.md`
requires `.env.example` committed and none exists. Moot today (the app has no
env vars) but the rule is silently broken.

### S10. Documentation organization

`AGENTS.md` specifies `Docs/archive/` for "historical logs, superseded plans"
and reserves root `Docs/` for "active, living documents". **`Docs/archive/` does
not exist**, and five completed review documents (~1,370 lines) sit in the root
beside the plan and roadmap.

Separately, `Docs/build-log.md` is 372 KB / 5,130 lines — larger than all of
`src/` combined. The append-only rule is right, but it is now big enough that
reading it costs more per lookup than the reasoning in it is worth. Splitting
completed phases into `Docs/archive/build-log-phase-N.md` preserves every word.

Minor: `scripts/render-icons.mjs` imports from `"playwright"`, which is only a
transitive dependency of `@playwright/test`, and the file matches no ESLint
`files` pattern so it is unlinted.

---

## Part 2 — Browser QA

### 2.1 Method

`npm run dev` behind the Browser pane. Port 3000 was occupied, so
`.claude/launch.json` gained `"autoPort": true` — **the only change left in the
working tree by this audit.**

Time was controlled by replacing `window.Date` with a subclass anchored to a
chosen wall-clock instant. This is a strictly harder test than Playwright's
`clock.install`: nothing is told that time moved, so every value on screen has
to be recomputed from a fresh read to be correct. Every one of them was.

Storage was manipulated directly to reach states the UI cannot produce. Axe-core
4.10.2 was injected for the accessibility sweeps.

### 2.2 What was verified working

**The clock and its derived views.** Setting the clock to 09:30 moved the tab
title to `35m · Period 2`, the countdown to `34:47`, the day caption to
`2 of 7 · 4h 59m until dismissal`, the strip's second block to partially filled,
and fired the announcer with *"Period 2 has started."* — all on the next tick,
from one reading.

**The parse boundary under attack.** Every one of these was refused, with a
distinct message, and the tab survived with the clock still ticking:

| Attack | Result |
| --- | --- |
| 764:1 deflate bomb — 6,543 base64 chars inside the 8,192 cap, inflating to 5 MB | *"This link is damaged…"*, stopped mid-stream |
| 200,000-character fragment | *"This link is too long to be a schedule."* |
| Version marker `toString` / `valueOf` — inherited `Object.prototype` keys under the 8-char cap | *"…newer version of BellTab (format toString)…"* — the `Map` dispatch fix confirmed live |
| Version markers `constructor`, `__proto__` | Refused by the length cap first |
| `#1.` with bad base64, bad deflate, or empty payload | *"This link is damaged…"* |
| Period name `<img src=x onerror="window.__XSS=1">` | Stored verbatim, rendered as text, **zero** `<img>` elements created |

**Storage degradation.** Garbage in `belltab.v1` opens on the seeded defaults
with no crash. A 51-schedule library (one over the cap) is refused rather than
truncated, exactly as `SCHEDULE_LIMITS` documents.

**The editor.** An overlap produced *"Passing overlaps Period 1. Two periods
cannot run at the same time."*, bound to the offending row's start field, with
`aria-invalid="true"` and a genuinely painting red border
(`rgb(240, 107, 101)`) — the fix from the 2026-09-01 review is holding. The
countdown kept running the last valid version throughout, and **nothing was
written to storage while the draft was invalid.**

> Worth recording: the parser reports one overlap at a time, because it compares
> each period only with its sorted predecessor. That is provably sufficient to
> *detect* overlap — if `s[i].start >= s[i-1].end` for all `i`, then
> `s[2].start >= s[1].end >= s[0].end`, so a non-adjacent overlap cannot hide —
> but a long period swallowing several short ones takes several fix-and-recheck
> cycles to clear. The invariant is safe; only the message is incremental.

**The bell offset.** `12.5`, `9999` and `-301` each showed the range error and
**left the stored value untouched**, with the readout still naming the number
actually running. `-`, empty and `abc` blanked the box without committing.
`±300` at the cap were accepted. The ≥60s warning appeared at 90.

**Calibration.** Pressed at 09:3x with the nearest bell 35 minutes away it
refused — *"No bell in today's schedule is close enough to now"* — and kept the
old offset. Pressed at 10:04:10 with the 10:05 bell 50 seconds out it measured
`+49`, stored it, updated the box and reported *"Done — the countdown now runs
49 seconds ahead of this device's clock."* The sign is correct in both
directions.

**Import.** Every malformed file got its own message — not JSON, JSON but an
array, JSON of the wrong shape, and a backup with one bad period each produced a
different sentence — and **the parse ran before the confirmation**, so only a
valid file ever opened the dialog.

**Delete.** Deleting today's schedule showed the contextual warning *"It's the
schedule running today — the countdown will go blank"*, focus landed on
**Cancel** rather than Delete, the dialog was a real `:modal`, and on confirm
every weekday pointing at it fell back to `null` with the tab title becoming
`No school · BellTab`. The App-level Escape guard correctly declined to close
settings while the dialog was open.

**Keyboard.** The schedule chips are one tab stop (`tabIndex` 0 on the selected,
−1 on the rest); arrows move focus and selection together; Home and End go to
the ends; ArrowLeft at index 0 stops rather than wrapping.

**Device capabilities.** Notifications were genuinely `denied` in the test
profile, and the toggle correctly disabled itself and pointed at the real lever:
*"Notifications are blocked for this site. To turn them on, allow them in your
browser's site settings."* The chime resumed inside the click gesture and went
straight to `ready`, never showing `locked`.

**Reflow and axe.** No horizontal scroll at 320px on the Now view, the strip,
the Day view, Big mode, the editor, the calendar or the preferences panel. Axe
returned zero violations at any impact level on every surface scanned, in both
themes. The pre-paint theme script applies `data-theme` before React mounts,
with no flash.

### 2.3 Defects

#### B1 — The Backup panel fails the 320px reflow gate · **High**

**Where:** `src/app/globals.css:2020` (`#backup-import`).

At a 320px viewport the Backup panel makes the document scroll horizontally:

```text
document.documentElement.scrollWidth  345
document.documentElement.clientWidth  320
```

`AGENTS.md` calls the reflow gate "a blocking check" and names WCAG 2.2
SC 1.4.10 explicitly. Every other panel passes.

**Cause.** The native file input's intrinsic min-content width — the "Choose
File" button plus "No file chosen" — is 311.5px, and it is laid out in a
container being sized to its content, so `max-width: 100%` never binds. Setting
`display: none` on that one element drops `scrollWidth` from 345 to exactly 320,
which isolates it conclusively.

This is the same class of bug the stylesheet already documents at length for
`<select>` in the calendar panel: *"`min-width: 0` is what lets it… `min-width`
alone only permits shrinking; it does not reduce what the control asks for."*
The selects got `width: 100%; min-width: 0; max-width: 100%`. The file input
only ever got `max-width: 100%`.

**Fix, verified in the browser** — `scrollWidth` 345 → 320:

```css
.backup__file {
  min-width: 0;
  width: 100%;
}

#backup-import {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  /* …existing declarations… */
}
```

#### B2 — A hydration mismatch on every themed load · ~~High~~ **Low**

> **Correction, 2026-09-05.** The paragraph headed *Impact* below is wrong in
> one load-bearing sentence. It claims a "permanent error in the console of
> every themed user". Measured while fixing it: React 19 checks attribute
> mismatches **only in development builds**. A themed load of the production
> build was captured with a listener on every console message type before
> navigation — **zero lines**. So this is developer noise, not a user-facing
> defect. The fix stands, because a dev console that always has one error in
> it is where a real hydration bug goes unnoticed; but it is Low, not High,
> and the original claim was an inference presented as a measurement. The
> rest of the section is accurate as written.

**Where:** `src/app/layout.tsx:105`.

Any user who has chosen Light or Dark gets this on every page load:

```text
A tree hydrated but some attributes of the server rendered HTML didn't match
the client properties. This won't be patched up.
  <html lang="en" className="fredoka_… manrope_… ">
-   data-theme="light"
```

**Cause.** `THEME_SCRIPT` runs as the first thing in `<body>` and sets
`data-theme` on `<html>` before React hydrates. React then compares server HTML
(no attribute) against the live DOM (attribute present) and reports the
mismatch. This is inherent to the pre-paint theme-script pattern — the script is
*correct* and should stay; React simply needs to be told the root element is
expected to differ.

Confirmed by elimination: with `theme: "system"` the script sets nothing and
the error does not appear. It is specific to an explicit theme.

**Impact** is noise rather than a visual defect — the message itself says "This
won't be patched up", and the theme renders correctly. But it puts a permanent
error in the console of every themed user, which is exactly the condition under
which a *real* hydration bug later goes unnoticed. In dev it also shows as a
standing "1 Issue" badge.

**Fix, verified in the browser** — the standard remedy, one attribute:

```tsx
<html
  lang="en"
  className={`${fredoka.variable} ${manrope.variable} ${spaceMono.variable}`}
  suppressHydrationWarning
>
```

Verified in a fresh tab with `theme: "light"`: `data-theme` still applied
pre-paint, **zero console errors**, dev-overlay badge gone. `suppressHydrationWarning`
is one level deep only, so it silences the `<html>` attribute and nothing else.
The change was reverted after verification; the working tree is clean.

#### B3 — One bad byte silently discards the whole library · **Medium**

**Where:** `src/app/_lib/library.ts:97` (`loadLibrary`).

A library of four user schedules, one of which has a single period with
`endMin` before `startMin`, was written to storage. On load:

- the picker showed **`Regular`, `Delayed start`, `Half day`, `Assembly`** — the
  seeded defaults;
- `localStorage` still held **`My Regular`, `My Half Day`, `My Assembly`,
  `My Delayed`**;
- **no message of any kind was shown.**

The user sees their entire library apparently wiped. The moment they touch
anything, `saveLibrary` writes the four defaults over the four originals and the
data is gone.

**The degrade itself is right** and `library.ts` argues for it well: *"a tab that
will not open because of a bad byte is worse than one that opens on the seeded
schedules."* The gap is that `parseLibrary` — the import path — produces a
specific, user-readable error for exactly this input (*"That backup has a
schedule BellTab cannot read: A period has to end after it starts."*), and
`loadLibrary` throws that same information away.

**Reachability** is low: the editor cannot produce an invalid schedule, and the
caps are guarded in the UI. It needs a partial write (quota exceeded mid-write),
a future schema change, a lowered cap, or a hand-edit. But this is the only
data-loss path in an app that otherwise has none.

**Suggested fix.** Keep the degrade; add the notice. Surface "BellTab couldn't
read your saved schedules and has started fresh" in a dismissible banner, and —
the load-bearing half — do not overwrite the unreadable value until the user has
acknowledged it. That preserves both the always-opens property and the data.

#### B4 — The view switcher reports a view that is not rendered · **Medium**

**Where:** `src/app/_components/App.tsx:461`.

With Day selected and the day resolving to no-school:

```text
#view-day  aria-pressed  "true"
#day-view  in the DOM    false
#period-name             "No school today"   ← the Now view's empty state
```

`App.tsx:424` renders `DayView` only when
`screen === "day" && !big && shown?.kind === "scheduled"`, but
`aria-pressed={screen === "day"}` reports the *intent* rather than the *rendered*
view. A screen-reader user is told "Day, pressed" while looking at the Now
view's empty state.

Reachable on any weekend, or any closure day, for anyone who last used the Day
view. The fix is to derive the pressed state from the same condition the render
uses.

#### B5 — Both test loops cover 3 of the 4 settings panels · **Medium**

**Where:** `e2e/reflow.spec.ts:238` and `e2e/a11y.spec.ts:254`.

Both enumerate `["schedules", "calendar", "preferences"]`. `SettingsView`'s
`PANELS` constant has four entries. **Backup is the only panel with neither a
reflow test nor a 320px axe test, and it is the panel that fails B1.**

This is the root cause of B1 shipping, and it is worth fixing as its own change:
drive both loops off an exported panel list so a fifth panel cannot be added
without tests, rather than adding `"backup"` to two hardcoded arrays.

#### B6 — "This backup holds 1 schedules" · **Low**

**Where:** `src/app/_components/BackupPanel.tsx:155`.

Importing a one-schedule backup produces:

> This backup holds 1 schedules. Importing it replaces the 3 in this browser…

The export summary eleven lines above gets this right
(`{scheduleCount === 1 ? "schedule" : "schedules"}`). The dialog body does not.
`ShareOffer` also handles it correctly, so this is the one place in the app that
misses it.

#### B7 — An impossible date disables Add with no explanation · **Low**

**Where:** `src/app/_components/CalendarPanel.tsx:93`.

| Typed | Chrome keeps | Error shown | Add |
| --- | --- | --- | --- |
| `20260-09-14` | `20260-09-14` | yes | disabled |
| `2026-02-30` | `""` | **no** | disabled |
| `2026-13-01` | `""` | **no** | disabled |

Chrome's date input sanitises an impossible date to the empty string, and
`dateIsUnusable = newDate !== "" && parsedNewDate === null` correctly treats an
empty box as mid-edit rather than an error. The result is that two of the three
impossible-date classes leave the user with a dead Add button and no reason.

The app's validation is right and nothing bad is ever stored — this is purely
about feedback, and it is engine-dependent: on WebKit, which renders a plain
text box, the value survives and the error does show. Low severity because a
date *picker* makes these hard to type in the first place.

#### B8 — `--` means two different things · **Low**

**Where:** `src/app/_components/App.tsx:389`.

The header renders `PENDING` (`--`) for the schedule name whenever the view is
not `scheduled`, so it reads `--` both before the clock has been read *and* on a
genuine no-school day. On the "No school today" screen the wall clock beside it
shows a live `10:05`, so the `--` reads as "still loading" when it means
"nothing scheduled".

Also noted while looking at that screen: in the empty state the action button
paints above its own explanatory sentence (button at `top: 338`, detail at
`top: 386`) although the detail comes first in the DOM. Reading order is fine;
the visual order puts the call to action before its rationale.

---

## Suggested order of work

1. **B1 + B5 together.** The bug and the coverage gap that let it ship. Drive
   both test loops off a shared panel list so this class of miss cannot recur.
2. **B2.** One attribute, verified, removes a permanent console error for every
   themed user.
3. **B3.** The only data-loss path in the app. Worth designing rather than
   patching — the degrade stays, the notice and the write-deferral are new.
4. **B4, B6, B7, B8.** Small, independent, each a few lines.
5. **S1–S5** — comments and dead code, zero behaviour change.
6. **S6, S7** — condensation.
7. **S8** — CI, as its own PR so the timings can be watched.
8. **S9, S10** — config and documentation organization.

## What this audit changed

`.claude/launch.json` gained `"autoPort": true`, because port 3000 was held by
another dev server and the preview could not start without it. Nothing else in
the working tree was modified — the B1 and B2 fixes were applied only long
enough to measure, and reverted.

No build-log entries were written for the findings themselves, since nothing was
fixed. Each fix should carry its own entry when it lands, and B3 belongs in
**Open gaps** whether or not it is fixed now.

---

## What was changed

**B1 and B5, together**, because they are one problem from two sides: the panel
overflowed, and the reason nobody knew is that the gate never opened it.

- `src/app/globals.css` — `width: 100%` and `min-width: 0` on `.backup__file`
  and `#backup-import`. Page goes from 345px to 320px inside a 320px viewport.
- `src/app/_lib/panels.ts` — **new.** `PANELS` and `PANEL_IDS`, React-free so a
  Node spec can import them.
- `src/app/_components/SettingsView.tsx` — renders from the manifest and
  re-exports `PanelId`, so no caller changed.
- `e2e/reflow.spec.ts` — a per-panel loop over `PANEL_IDS` (Backup included for
  the first time), plus a guard test outside the width loop asserting the tabs
  the app *renders* equal the ids the suite *iterates*.
- `e2e/a11y.spec.ts` — the hardcoded three-panel array replaced by `PANEL_IDS`;
  the 320px axe sweep now covers four panels.

**Verified as a negative control, not assumed.** With the CSS reverted, exactly
one test fails, and its message is
`320px settings/backup: page scrolls horizontally (345 > 320)` with the widest
elements named. Sixteen others pass. A test that is green with and without the
fix is not a test.

**B2**, on `fix/theme-hydration-warning`, stacked on #53:

- `src/app/layout.tsx` — `suppressHydrationWarning` on `<html>`, with the
  comment explaining it is THEME_SCRIPT's other half and dev-only.
- `src/app/_lib/preferences.test.ts` — a source pin in the same spirit as the
  existing `THEME_SCRIPT` pins: reads `layout.tsx` and asserts the `<html>`
  element carries the attribute. Read from source because the layout imports
  `next/font/google`, which only resolves under Next's compiler. Negative
  control: removing the attribute turns exactly this test red.
- `e2e/preferences.spec.ts` — a themed **production** load must log zero
  console errors. Honest about what it is: it cannot see the dev-only warning
  (it passed before the fix, which is how the severity correction above was
  found) and does not claim to; it guards the things production *does* report.
- Dev preview with `theme: "light"`: attribute applied pre-paint, no Issues
  badge, no hydration error. Verified before and after.

**B3**, on `fix/unreadable-library-notice`. The design call, since it was
the one finding that needed one: keep the degrade, add what was missing, never
block.

- `src/app/_lib/library.ts` — `parseLibrary` errors carry a `field`
  (`json` / `shape` / `schedules`); new `loadLibraryReport` returns the library
  *and* a storage-voiced problem, `null` for a fresh install or a readable
  value. `loadLibrary` delegates to it.
- `src/app/_lib/libraryStore.ts` — records the problem inside `load` without
  emitting (it runs during render); `saveLibrary` copies the unreadable bytes
  to `belltab.v1.unreadable` **before** `store.save`, so the first edit can no
  longer destroy the only copy; `useLibraryProblem` / `dismissLibraryProblem`.
  Dismiss leaves the quarantine armed.
- `src/app/_components/LibraryNotice.tsx` — the banner, in the share offer's
  slot and styles, with **Download what was there** (Export's object-URL
  pattern, bytes verbatim) and **Dismiss**. Mounted in `App.tsx` above
  everything.
- Tests: six unit tests on `loadLibraryReport`; `e2e/library-notice.spec.ts`
  covers the sentence and reason, the fresh-install and readable no-shows, the
  quarantine-then-overwrite order with the live key readable afterwards, a real
  download read back from disk, dismiss, and 320px reflow.
- Verified in the dev preview end to end before the tests were run.

**B4, B6 and B8**, on `fix/small-audit-items`. Each a few lines; none touches
an invariant.

- **B4** — `src/app/_components/App.tsx`: one predicate, `dayViewShown`, now
  drives both the `DayView` render and the two buttons' `aria-pressed`, so
  they cannot disagree. The `screen` intent is kept; the list comes back the
  next day it can. The weekend test in `day-view.spec.ts` had asserted the
  old behaviour and now asserts the new; two switcher tests cover both
  directions.
- **B8** — `App.tsx`: `scheduleLabelFor` says "No school" / "No schedule" in
  the header, in the words the headline beneath already uses. `--` is now
  only ever the pre-mount placeholder. Two header tests in `countdown.spec.ts`.
- **B6** — `src/app/_components/BackupPanel.tsx`: one `pluralSchedules` owner
  for the export summary, the dialog body and the `window.confirm` fallback —
  which had the same bug and was not in the audit. One test in `share.spec.ts`.
- All three verified in the dev preview before the tests were written.

**B7 stays open, deliberately.** Chrome blanks an impossible typed date to
`""`, so the app cannot distinguish "cleared" from "typed nonsense" from the
value alone. The candidate signal is `validity.badInput` on the date control,
which my measurement could not exercise: setting the value programmatically
reported `badInput: false`, and a *typed* impossible date needs a real
segmented-control keystroke sequence per engine. Low severity — a date picker
makes these hard to type in the first place — and not worth a fix that is
guessed rather than measured. Recorded in Open gaps.

Still open: **B7**, and all of **S1–S10**.
