# Code review and browser QA — 2026-09-10, `main` at `f1d58dc`

The closing review. A full-repository audit in five passes against `f1d58dc`
*"ci: the E2E job reuses the build, and `npm run e2e:smoke` runs nine core
journeys (#62)"*, with a clean working tree, asked for by the user as "one last
code review like we did for 2026-09-04": optimizations, condensations, dead
code, bugs, and a browser QA pass, each given real time.

- **Pass 1 — optimizations.** Every file under `src/`, `e2e/`, the configs and
  both workflows, read for per-tick, per-render and per-PR cost; bundle sizes
  taken from the production build; CI step timings from the last green run.
- **Pass 2 — condensations.** The same files read for duplication,
  over-abstraction and comment drift.
- **Pass 3 — dead code.** An AST export/import cross-reference over every
  TypeScript file, a selector-by-selector check of `globals.css` against the
  markup, a link and anchor checker over all 34 tracked Markdown files, and a
  read for unreachable branches.
- **Pass 4 — bugs.** An adversarial read of the engine, the parse boundary,
  the bells, the stores and the tests, with Node scripts against the pure
  engine where a hypothesis needed one. Recorded in §4.
- **Pass 5 — browser QA.** The dev build driven through the in-app Chrome
  with the DOM inspected directly and the clock replaced at runtime, plus the
  full Playwright suite against the production build, plus a `curl` of the
  production headers.

Baseline at review time was green: `npm run lint`, `npm run typecheck`,
`npx markdownlint-cli "**/*.md"` and `npx vitest run` (455 tests, 13 files)
all pass, and **`npm run e2e` passed 291 of 291 on Chrome** against a fresh
`next build` in 2.4 minutes. One caveat on the unit baseline: the local
`node_modules` still held `vitest@4.1.11` although `package.json` asks for
`^5.0.0` since #52, so the 455 ran on the old major locally; CI runs `npm ci`
and therefore the new one. Re-run on 5.0.0 at the end of this review — see
*What this review changed*.

**The engine holds up, again.** The recompute-never-decrement invariant was
confirmed in the browser the same way as on 2026-09-04, by replacing
`window.Date`: the digits, the tab title, the header clock, the progress fill,
the Day view caption and the announcer all followed the new clock on the next
tick, through a period boundary (10:04:56 → 10:05:00, "Passing has started."),
dismissal (14:29:57 → 14:30:00, "School is out.", `Done · BellTab`), the first
bell (07:59:58 → 08:00:00, "Period 1 has started."), a Saturday ("No school ·
BellTab"), and the midnight rollover (23:59:57 → 00:00:00, `480m · Period 1`
with the date advanced and nothing announced). A tab that "slept" from 09:30 to
12:36 woke into Period 5 with exactly one announcement, which is what the
2026-09-09 `crossedBell` rule promises.

**Something the research claimed was measured for real.** The preview tab
spent the middle of this session hidden, and after roughly five minutes Chrome
applied its intensive throttling: the one-second interval fired about once a
minute, and every snapshot taken between wakeups showed the same second. The
app's `visibilitychange` listener, fired by hand, brought every surface up to
date in one repaint. That is `Docs/research/background-timers-and-schedule-
modeling.md`'s central claim and the reason for the first invariant, observed
on a real engine rather than cited.

**Seven defects were found — one Medium, the rest Low — and none touches the
five invariants.** Pass 4 found five by reading and probing, and the three
that could be checked in a browser were then confirmed live: focus lands on
the gear button on every page load (P1), a period ending at 24:00 renders with
an empty end box (P3), and typing a bell offset can ring a bell (P4). Pass 5
found two more at the edges of the day. Passes 1–3 found no bugs, as on
2026-09-04 — only cost, duplication and drift, which is what they were asked
for — and the largest single item is again in `e2e/`, where six recipes are
spelled out across specs that `helpers.ts` was created to hold.

---

## Summary

### Defects (Pass 4 — static bugs, three confirmed live in Pass 5)

| # | Where | Severity | Finding |
| --- | --- | --- | --- |
| P1 | `src/app/_components/App.tsx:319-329` | **Medium** | Focus is moved to the gear button on every page load — the settings focus effect has no first-mount guard, unlike the Big-mode effect beside it |
| P2 | `src/app/_lib/draft.ts:76-95` | Low | A fractional length (`0.5`) makes `minutesToClock` emit `"08:0.5"`, which the time control blanks |
| P3 | `src/app/_lib/draft.ts:76-94`, `src/lib/parse.ts:110` | Low | A period ending at 24:00 is drafted as `end: "24:00"`, which `<input type="time">` cannot hold, so the end box is empty; `formatClock(1440)` reads `12:00` |
| P4 | `App.tsx:183-186`, `bells.ts:328-338` | Low | Changing the bell offset moves the shifted clock discontinuously and can ring a bell — including on the first keystroke of "12" and on a calibration press that lands exactly on a boundary |
| P5 | `App.tsx:246-269`, `ShareOffer.tsx:51` | Low | At the 50-schedule cap "Keep it" discards the shared schedule silently; at the 400-override cap it is kept but not made today's, contradicting the offer's sentence |

### Defects (Pass 5 — browser QA)

| # | Where | Severity | Finding |
| --- | --- | --- | --- |
| Q1 | `src/lib/engine.ts:118`, `:181` | Low | A period that ends at 24:00 never reaches the `after` phase, so its end bell never rings and "School is out." is never said |
| Q2 | `src/lib/format.ts:142` | Low | The tab title stays in minutes however long the wait: `480m · Period 1` at midnight, `1440m · Solo` for an all-day period |

Everything else driven held — see §5 for the list, including the things tried
that did not break.

### Quality findings (Passes 1–3)

| # | Where | Kind | Finding |
| --- | --- | --- | --- |
| O1 | `.github/workflows/ci.yml:173` | Optimization | `--with-deps` on the Chrome-only PR path spends ~39 s installing apt packages for a browser the runner already has |
| O2 | `e2e/reflow.spec.ts:41-44` | Optimization | "the page reflows to one column" is byte-for-byte the mid-period case of the loop below it — five redundant boots per PR |
| O3 | `App.tsx:439-449`, `SettingsView.tsx`, `ScheduleEditor.tsx:50`, `CalendarPanel.tsx:327,343` | Optimization | The whole settings tree reconciles once a second for values that change once a day |
| O4 | `src/lib/parse.ts:440` | Optimization | Overrides sort with `localeCompare` where `<` on ISO dates is correct, faster and locale-free |
| O5 | `package.json:42` | Dead dependency | `jsdom` is installed six times per PR and loaded by nothing; no file carries the pragma AGENTS.md describes |
| C1 | `e2e/*.spec.ts` (six recipes, ~40 sites) | Duplication | Live-region enumeration ×5, "wake the tab" ×4, `localStorage.getItem` via `evaluate` ×10, hand-built preferences blob ×20, hex→rgb ×2, hardcoded storage keys ×3 |
| C2 | `App.tsx:172,184,188,452,459-461,553` | Duplication | `shown?.kind === "scheduled" ? … : null` six times; one derived `running` value covers all of them |
| C3 | `BackupPanel.tsx:54-65`, `LibraryNotice.tsx:36-46` | Duplication | The download-a-blob routine, eleven identical lines, twice |
| C4 | Four panels | Duplication | The identical `<h2 id="settings-title">` in four panels, and `headingRef` drilled through four prop interfaces to reach it |
| C5 | `globals.css` (nine sites) | Duplication | Danger hover ×3, small-caps label ×3, pressable skin ×2, track+fill ×3, `.day` declared twice, strip flex ×3, the control skin ×4 (a recorded decision) |
| C6 | `preferences.ts:169-186` | Duplication | The boolean parse spelled out five times |
| C7 | `library.ts:367,394-407`; `:80-99` | Duplication | Three mutators share one `withOverrides` shape; `loadLibrary` has no caller outside its test |
| C8 | `today.ts:28-33,78-80,127-133`; `SchedulesPanel.tsx:66-70` | Duplication | An orphaned JSDoc on the wrong function, two one-line wrappers, and "is this today's schedule" resolved twice |
| C9 | `parse.ts`, `share.ts:62`, `library.ts:159` | Duplication | Five hand-built `{ ok: false, errors: [{ index: null, field, message }] }` literals |
| C10 | `DayView.tsx:115-116`, `DayStrip.tsx:54-56` | Duplication | Progress arithmetic re-derived outside the engine; the strip's past/future ternary is provably redundant |
| C11 | `NowView.tsx:45-51,284-295,31` | Condensation | A five-line wrapper component, two branches emitting the same string, and `PENDING` declared twice |
| C12 | `PreferencesPanel.tsx`, `CalendarPanel.tsx`, `SchedulesPanel.tsx`/`BackupPanel.tsx` | Condensation | Three identical checkbox fieldsets, two identical `<option>` lists, the modal-or-`confirm()` fallback twice |
| C13 | `panels.ts:23`, `App.tsx:127-129`, two test files | Types | Unions written out beside the arrays they could be derived from |
| C14 | `engine.test.ts:212-216`, `draft.test.ts:258,338`, `calibrate.test.ts:10-20` | Test duplication | A fixture rebuilt inside a `describe`, two `describe("updatePeriod")` blocks, a parse-or-throw helper rewritten |
| C15 | Eleven comments | Comment drift | Comments that describe code that has since changed — listed in §3.3 |
| D1 | `engine.ts:15` | Dead code | `export type DayPhase` has no reader anywhere |
| D2 | `preferences.ts:122-123` | Dead code | `export { THEMES }; export type { Theme };` — both consumers import from `theme.ts` |
| D3 | `globals.css:17,92,126` | Dead code | `--mint` is defined three times and read by nothing |
| D4 | `App.tsx:254` | Dead branch | `added.id === null` on an `IdentifiedSchedule` is always false |
| D5 | `e2e/strip.spec.ts:107` | Dead assertion | Asserts `.strip__cell--link` has count 0 — a class nothing has produced since 2026-09-05's S4 |
| D6 | `scripts/render-icons.mjs:13` | Config | Imports bare `playwright`, which is not a declared devDependency and resolves only by hoisting from `@playwright/test` |

---

## Part 1 — Optimizations

Measured where it could be: gzip sizes from the existing production build, a
timed `npx vitest run`, `playwright test --list`, and the per-step timings of
the last green PR run.

**The hot path is already efficient.** `useNow` is one `setInterval`, one
`visibilitychange` and one `focus` listener, all cleaned up, with a
second-resolution bail-out so a mid-second `focus` is a no-op render. No other
timer or `requestAnimationFrame` exists under `src/`. Per tick on the countdown
screen, `App` does `shiftNow` + `viewForNow` (one `resolveScheduleId` and one
`stateAt`, O(periods)); `NowView` does `splitCountdown`, `boundaryKey`,
`percentOf` and two `formatClock` calls; the strip and the Day view do one
pass over at most 60 periods. There is nothing here to memoise that would cost
less than the memo. `App` renders twice per tick because `useBellCrossings`
sets state during render; that is the shape the 2026-09-09 fix needs (a ref
double-counts under Strict Mode, a derived count re-introduces the bug) and
the doubled body is microseconds. `localStorage` is re-read on every snapshot
(about four `getItem` calls a second), served from the renderer cache and
compared as strings; the parse runs only when the string changes. The bundle
is ~172 KB gzipped of framework and **19 KB gzipped of application code**,
with zero runtime dependencies beyond the framework; the route prerenders
static; `next/font` self-hosts three families with four files preloaded.
Only three properties animate (`transform`/`box-shadow` on press, a 150 ms
`opacity` keyframe at a bell, `width` on the three fills), and `percentOf`
rounds to whole percents so the layout-triggering `width` changes every 36 s
on a 60-minute period.

### O1. `--with-deps` on the Chrome-only path — `ci.yml:173`

On every PR the E2E job runs `npx playwright install --with-deps chrome`. On
the last green PR run that step took **39 s** (14:20:49 → 14:21:28), in a job
whose Playwright step is 118 s. Chrome stable is preinstalled on
`ubuntu-latest`, so `install chrome` is a no-op; the time is `--with-deps`
running `apt-get update` and installing the Chromium dependency list. The
nightly and `main` runs genuinely need it for the WebKit build.

Change: `npx playwright install chrome` on the `chrome` branch of the step;
leave `--with-deps chrome webkit firefox` on the `all` branch. One run
confirms it. **Worth doing:** yes — one line, roughly 20% off PR wall time.

### O2. Five reflow tests that are their own duplicates — `reflow.spec.ts:41-44`

`"the page reflows to one column"` calls `openApp(page, MID_PERIOD)` and
`expectNoHorizontalScroll`. The loop immediately below runs `"the countdown
reflows to one column (mid-period)"`, which makes exactly those two calls with
the same fixture. Five redundant boots per PR, fifteen per nightly, and a
false impression of two independent checks. Delete the standalone test.

### O3. The settings tree reconciles once a second — `App.tsx:439-449`

`App` passes the live `now` into `SettingsView`, so while settings is open the
whole subtree re-renders every second: `SchedulesPanel` resolves the calendar
twice per tick, `ScheduleEditor` runs a full `parseDraft` → `parseSchedule`
(sort and overlap scan included) per tick, every `PeriodRow` rebuilds a `Set`
from the error list, and `CalendarPanel` reconciles nine `<select>`s of every
schedule plus every override row, calling `weekdayOf` twice per row. At the
caps that is roughly 2,500 elements and ~800 regex executions a second, for a
panel whose only per-second consumer is "The bell just rang".

React diffs it all to nothing, so the cost is CPU and battery rather than
jank, and with the seeded library it is invisible. **Worth doing:**
borderline. Derive a day-stable `{ isoDate, weekday }` in `App`, pass that to
three of the four panels, and `React.memo` them (their other props are already
referentially stable). Keep `now` for `PreferencesPanel` only.

### O4. `localeCompare` on ISO dates — `parse.ts:440`

`overrides.sort((a, b) => a.date.localeCompare(b.date))`. ISO dates compare
correctly with `<`, which `library.ts:379` already relies on. ICU collation is
roughly an order of magnitude slower per comparison and makes a pure
function's output depend on the locale. Runs per library load and per
calendar edit, ~1 ms at the cap. Drive-by only.

### O5. `jsdom` is loaded by nothing — `package.json:42`

`grep -rl 'vitest-environment jsdom' src` returns nothing;
`vitest.config.js` sets `environment: "node"`. Every unit test runs in Node.
The package and its ~30 transitive dependencies are installed on all six
`npm ci` runs per PR and widen the Dependabot and `npm audit` surface for
code the suite never executes. AGENTS.md's rule assumes it exists, so
removing it means the first React UI test adds it back; the honest
alternative is a one-line note in `vitest.config.js` that it is reserved.

### Checked and left alone

Per-panel boots in the reflow loop (20 boots for 20 measurements — the
per-panel shape is what B5 of the last audit asked for, and legibility earned
its cost). Editor keystrokes writing the whole library (~50 KB, ~0.2 ms; a
debounce would delay cross-tab sync for nothing measurable). The five
`checkout + setup-node + npm ci` blocks in CI (measured and decided in S8).
React Compiler (a new Babel dependency against the zero-dependency rule).
Anything that caches a remaining-time value, a `DayState` or a title string
across ticks — every such cache is the decrement bug in a different coat.

---

## Part 2 — Condensations

The 2026-09-04 items are in: S6 (`scheduleOn`) and S7 (`subscribeToBells`,
`serverSnapshotNull`) are both present. Three "related smaller repeats" listed
under S7 were not applied and still stand — `PENDING = "--"` in both
`App.tsx:37` and `NowView.tsx:31`; the `elapsed`/`length` pair in
`DayView.tsx:115-116` and `DayStrip.tsx:54-55`; and `addPeriod`'s
`startMin + NEW_PERIOD_MINUTES > 24 * 60` evaluated twice at
`draft.ts:188,190`. The S6 fix also left one orphaned comment (C8c).

### C1. `e2e/` repeats six recipes that `helpers.ts` exists to hold

- **Live-region enumeration, five copies** — `announcer.spec.ts:18,52-58`,
  `big-mode.spec.ts:159-165`, `day-view.spec.ts:130-137`,
  `editor.spec.ts:359-367`, `preferences.spec.ts:157-171`. Each redeclares
  the selector, the `` `${tagName}#${id || "(no id)"}` `` mapping, and three of
  them the baseline `["div#__next-route-announcer__", "p#period-announcer"]`.
  One `liveRegions(page)` and one `LIVE_REGIONS_BASELINE`. ~35 lines.
- **"Move the clock, then wake the tab", inline four times** —
  `countdown.spec.ts:26-35` has `returnToTab`; `big-mode.spec.ts:128-129`,
  `day-view.spec.ts:71-72`, `strip.spec.ts:91-92` spell it out;
  `bells.spec.ts:247-250` `crossBoundary` is a sibling. Promote both. The
  value is that "how a sleeping tab wakes" is defined once, as the helpers
  header says it should be.
- **`localStorage.getItem` through `page.evaluate`, ten sites**, while
  `library-notice.spec.ts:35-36` already has `stored(page, key)`.
- **The preferences blob built by hand twenty times**, with three specs each
  defining their own wrapper (`bells.spec.ts:255`, `strip.spec.ts:17`,
  `wake-lock.spec.ts:174`). One `prefs(overrides)`; leave the two tests at
  `preferences.spec.ts:341-349,375-383` that deliberately pin exact bytes.
- **Storage keys hardcoded where the constant exists** —
  `preferences.spec.ts:354` uses `"belltab.v1"`, `wake-lock.spec.ts:471,478`
  `"belltab.prefs.v1"`, and `library-notice.spec.ts:18` re-derives
  `UNREADABLE_KEY`. Zero lines; three drift points the helper was made to
  prevent.
- **`--danger` hex→rgb twice** — `editor.spec.ts:9-12` (declared above the
  `import` on line 13, the only import-after-code in the repo) and
  `calendar.spec.ts:331-338`.

Roughly 90 lines, no app risk, and it is the largest single item in this
review. Confidence High throughout.

### C2. `App.tsx` narrows `shown` six times

Lines 172, 184, 188, 452, 459-461 and 553 each write
`shown?.kind === "scheduled" ? shown.X : null`, three of them re-checking
`shifted !== null` because TypeScript cannot narrow through the
`dayViewShown` boolean. One derived value —
`running = shown?.kind === "scheduled" && shifted !== null ? { schedule,
state, nowSec } : null` — replaces all six, and `dayViewShown` becomes
`screen === "day" && !big && running !== null`. Related: `previewed` at
lines 142-150 hand-builds the `TodayView` literal that `viewForNow` returns
at `today.ts:64-69`; a `scheduledView(schedule, secOfDay)` export keeps the
shape minted in one file.

### C3. The download routine, twice

`BackupPanel.tsx:54-65` and `LibraryNotice.tsx:36-46` are the same eleven
lines (`new Blob`, `createObjectURL`, anchor, `download`, `click`,
`revokeObjectURL`) and both build `x-${now.isoDate}.json`. The notice's own
comment says "The same mechanism as Export". One `downloadJson(text, basename,
date)` in `_lib`.

### C4. Four identical panel headings and the ref drilled to reach them

`SchedulesPanel.tsx:121-123`, `CalendarPanel.tsx:119-121`,
`BackupPanel.tsx:94-96`, `PreferencesPanel.tsx:85-87` each render
`<h2 className="panel__title" id="settings-title" tabIndex={-1}
ref={headingRef}>`, so `headingRef` appears in four prop interfaces purely to
reach that line, and `PANELS` already holds each label. `SettingsView` can
render the wrapper and heading once. Ids are unchanged so the E2E contracts
hold; run the reflow loop after, since the `.panel` flex wrapper moves up a
level.

### C5. `globals.css` — repeated declaration blocks

- **Danger hover ×3** (`1309-1312`, `1530-1533`, `1839-1842`) — identical
  bodies; one selector list.
- **Small-caps label ×3 (+1 partial)** (`1409-1415`, `1453-1460`,
  `1722-1728`, `1619-1621`) — and `BackupPanel.tsx:129` and
  `CalendarPanel.tsx:132` borrow `weekday__name` for things that are not
  weekdays because it is the only class carrying the voice. A `.label-caps`
  utility fixes the borrow too.
- **Pressable skin ×2** (`.icon-button` 249-270, `.viewswitch__btn`
  561-579) — same border, radius, shadow, transition and `:active`.
- **Track + fill ×3** (`378-391`, `701-720`, `807-819`).
- **`.day` declared twice** (`502-503` then `589`) — the first `gap` is
  overridden by the second; drop `.day` from the first rule.
- **Strip flex ×3 on the same box** (`831`, `851-853`, `855-857`) — the
  `:has()` is always true because every pair contains a block, and
  `DayStrip.tsx:73` sets inline `flexGrow` anyway.
- **The control skin ×4** (`1252-1264`, `1751-1762`, `1951-1962`,
  `2022-2034`) — the comment at `2018-2021` records "three copies of six
  declarations is the shape this stylesheet has settled on" because a
  descendant selector would reach controls in other panels. There are four
  now, and a class on the elements reaches nothing unintended. ~30 lines,
  **but it reverses a documented decision** and belongs in Decisions with a
  superseding row, not as a silent cleanup.

### C6. The boolean parse, five times — `preferences.ts:169-186`

Five `typeof source.x === "boolean" ? source.x : DEFAULT_PREFERENCES.x`, and
a cast to an object type that lists all seven fields by hand. A two-line
`bool(value, fallback)` and `Partial<Record<keyof Preferences, unknown>>`.
`preferences.test.ts`'s `BOOLEAN_FIELDS` loop already pins the semantics.

### C7. `library.ts` — one helper for three mutators; one test-only wrapper

`removeOverride` (402-407), `removePastOverrides` (394-399) and the `others`
step of `setOverride` (367) all do `withCalendar(library, { ...calendar,
overrides: overrides.filter(pred) })`. A private `withOverrides(library, keep)`
makes each a one-liner. Separately, `loadLibrary` (97-99) is
`loadLibraryReport(raw).library` with no caller outside `library.test.ts`;
its nineteen-line JSDoc is the canonical "why degrade to defaults" argument,
cited from four other files, so removing the function means re-homing the
doc onto `loadLibraryReport`. Medium — twelve test call sites.

### C8. `today.ts` — wrappers, a double resolve, and an orphaned comment

- `scheduleForToday` (78-80) is `scheduleOn(...)` with one caller;
  `scheduleNameOn` (127-133) is `scheduleOn(...)?.name ?? null` with two.
  Export `scheduleOn` and drop the first.
- `SchedulesPanel.tsx:66-70` answers "is the selected schedule today's" by
  resolving today twice — `scheduleNameOn(...) !== null &&
  scheduleIndexToEdit(library, now) === index`. With `scheduleOn` exported it
  is one reference comparison.
- **The JSDoc at `today.ts:28-33`** ("Resolves the day and asks the engine…
  `@param library`… `@param now`") is `viewForNow`'s, stranded above
  `scheduleOn`'s own doc when S6 inserted the helper between them.
  `viewForNow` at line 52 now has no doc. Same species as the last audit's
  S1, and introduced by fixing S6.

### C9. Five hand-built refusals

`parse.ts:160-163, 350-353, 357-366`, `share.ts:62-65` (`shareError`) and
`library.ts:159-162` (`fail`) each spell
`{ ok: false, errors: [{ index: null, field, message }] }`. One
`refuse(field, message): ParseResult<never>` exported from `parse.ts`.

### C10. Progress arithmetic re-derived outside the engine

`DayView.tsx:115-116,144` and `DayStrip.tsx:54-56` both compute
`elapsed = nowSec - startMin * 60; length = (endMin - startMin) * 60;
percentOf(elapsed / length)`. The strip's
`status === "past" ? 100 : status === "future" ? 0 : percentOf(…)` is
redundant: `percentOf` clamps to [0, 100], past means the ratio is ≥ 1 and
future means it is < 0, so `percentOf(elapsed / length)` alone is identical.
A `periodProgressAt(period, nowSec)` in `engine.ts` beside `periodStatusAt`.

### C11. `NowView.tsx`

`NowView` (45-51) is a five-line wrapper rendering `<section
className="focus">` around `Focus` with identical props — one function. The
`strip = null` default at 45 makes `strip ?? null` at 96 redundant.
`nextLineFor` (284-295): the `gap` branch and the `during && next !== null`
branch return the identical string; after the `before` check, one
`if (state.next !== null)` covers both. `PENDING` is the S7 leftover.

### C12. Component-level twins

- `PreferencesPanel.tsx` — three checkbox fieldsets (93-111, 143-161,
  200-227) share the whole `fieldset > legend + p.field__hint + label.option >
  input[aria-describedby]` skeleton; a `ToggleField` collapses two outright.
  Eight `save({ ...preferences, X: v })` spreads; the "readout plus hidden
  polite alert of the same sentence" pattern twice (228-258, 364-378). Ids
  and `aria-describedby` must pass through verbatim for the E2E and axe
  suites.
- `CalendarPanel.tsx` — three `<option>` lists (145-151, 185-193, 261-269),
  the last two identical; `weekdayOf(entry.date)` twice per override row
  (327, 343).
- `SchedulesPanel.tsx:108-117` and `BackupPanel.tsx:77-85` — the same
  modal-or-`window.confirm` fallback shape.

### C13. Types written out beside the values they could derive from

`panels.ts:23` writes the `PanelId` union and `PANELS` lists the same four
ids — `PanelId = (typeof PANELS)[number]["id"]`. `App.tsx:127-129` re-types
the offer union that `ShareOffer.tsx:23` defines. `bells.test.ts:12-19` and
`wakeLock.test.ts:19-25` re-list the status unions as arrays; exporting
`as const` arrays from the source (as `THEMES` does) means the tests cannot
fall behind a sixth status.

### C14. Test fixtures

`engine.test.ts:212-216` rebuilds `regular` inside `describe("crossedBell")`
with a parse-or-throw IIFE, shadowing the `regular` built at line 20 with the
file's own `valid()`. `draft.test.ts` has two `describe("updatePeriod")`
blocks (258, 338). `calibrate.test.ts:10-20` rewrites the same
parse-or-throw helper. `today.test.ts:191-192` builds `LocalNow` literals
where `wednesday()`/`saturday()` exist.

### C15. Comments that no longer describe the code

| Where | Says | Is |
| --- | --- | --- |
| `globals.css:61-65` | The three faces "are NOT linked here… fall through to the platform's nearest equivalent" | Contradicted by the next comment and `layout.tsx`'s `next/font` |
| `globals.css:371-372` | The "until X" line "lives in the strip now" | `.bounds__next` still renders "Next: … at …" (`NowView.tsx:213`) |
| `globals.css:434-436` | Describes `.message__action` | Sits above `.message__secondary`'s own comment |
| `globals.css:895-896` | A bare `/* ====` opener with no title | The class S4 removed elsewhere |
| `globals.css:1203-1213`, `reflow.spec.ts:106-113` | "six columns", "45rem", "22.5rem for the time field" | Seven columns, container queries at 52rem/34rem |
| `manifest.ts:13-15` | A SW's one benefit "is recorded as an open gap with the SW named as its price" | `bells.ts:255-274` registers `public/sw.js` for exactly that, since 2026-09-04 |
| `PeriodRow.tsx:78-79` | "seven controls … seventy-seven fields" | Eight per row since the end box was added (`editor.spec.ts:469-472`) |
| `NowView.tsx:267` | `kind: "passing"` | Canonical spelling is `"Passing"` since 2026-09-03 |
| `announcer.spec.ts:13-15,36` | "What is still parked needs the editor (Phase 3)…", "until Phase 3" | Everything named is live |
| `libraryStore.ts:84-87` | Admits `raw === null` is redundant | Reordering the two clauses gives TS the narrowing without the dead one |
| `strip.spec.ts:107` | Asserts `.strip__cell--link` has count 0 | Nothing has produced that class since S4 — the assertion checks nothing (D5) |

### Already tight

`share.ts`, `clock.ts`, `dates.ts`, `calibrate.ts`, `schedule.ts`,
`format.ts`, `gesture.ts`, `localStore.ts`, `useNow.ts`, `useWakeLock`,
`icons.tsx`, `ConfirmDialog.tsx`, `ShareOffer.tsx`, the route files,
`share.fixtures.ts`, and every config file. `parse.ts`'s two-pass
`withUniqueIds` and `stateAt`'s trailing `after` return are each explained in
place and not worth touching. The two hand-rolled emitter trios (`bells.ts`,
`libraryStore.ts`) and the "first count rings nothing" rule implemented in
both `PeriodAnnouncer` and `useBells` were noticed and deliberately left:
render-time and effect-time semantics differ and both are load-bearing for
the "silent on first paint" tests.

---

## Part 3 — Dead code

Method: TypeScript-compiler cross-reference of every `export` against every
`import` (resolving `@/`), regex extraction of every selector, keyframe and
custom property in `globals.css` checked against TSX and e2e locators
(including dynamically built class fragments), a Node link and anchor checker
over all 34 tracked `.md` files, and a read of every non-test file for
unreachable branches.

The 2026-09-04 items (S4, S5) are fully closed: no `shiftall`, no
`strip__cell--link` in CSS, none of the six exports remains exported.

### D1–D3. Provably unused

- `engine.ts:15` `export type DayPhase` — the declaration is its only mention
  in `src/` and `e2e/`. `DayState` spells its own literals.
- `preferences.ts:122-123` `export { THEMES }; export type { Theme };` — both
  consumers (`PreferencesPanel.tsx:9`, `preferences.test.ts:11`) import from
  `theme.ts`. `Theme` is still used locally via the line-1 import; only the two
  re-export lines are dead.
- `globals.css:17,92,126` `--mint` — the only custom property in the file
  with zero `var(--mint` readers and zero mentions in TypeScript. The design
  system documents it as "Success / valid … used sparingly, if at all"; a
  palette token for a state the app never renders.

### D4. An always-false branch — `App.tsx:254`

`added === null || added.id === null || shifted === null`. `added` is an
`IdentifiedSchedule | null`, whose `id` is `ScheduleId` (a `string`);
`noUncheckedIndexedAccess` is off, so the index is typed non-undefined. The
middle clause compiles only because TypeScript permits `=== null` on any
type, and is always false.

### D5. An assertion that checks nothing — `strip.spec.ts:107`

`expect(page.locator("#strip .strip__cell--link")).toHaveCount(0)`. No
markup and no CSS has produced that class since S4 removed it. Drop it, or
assert the seam count alone.

### D6. An undeclared import — `scripts/render-icons.mjs:13`

`import { chromium } from "playwright"` — `playwright` is not in
`package.json`; it resolves only because `@playwright/test` hoists it. Works
today, breaks the day npm's hoisting changes or the script is run from another
tree. Declare it or import from `@playwright/test`.

### Test-only exports (judgment calls, all kept)

`loadLibrary` (see C7), `clockToMinutes`/`minutesToClock`,
`secondsSinceMidnight`/`localIsoDate`, `THEME_ATTRIBUTE`,
`ChimeStatus`/`NotifyStatus`, `SHARE_VERSION`/`SHARE_LIMITS`, `ClockOptions`
— each used inside its own module and exported so a test can pin it. Some
twenty-five `export` keywords on props interfaces and local types have no
importer at all (`BackupPanelProps`, `LibraryFault`, `OpenOptions`,
`overflowingElements` in `e2e/helpers.ts`, and so on); zero lines saved,
reasonable to leave as each module's type surface.

### Runtime-dead, type-serving, or deliberate (all kept)

`engine.ts:118-120`'s trailing `after` return (self-documented as
unreachable, returned rather than thrown "so a clock never dies mid-day");
`libraryStore.ts:87`'s `|| raw === null` (narrows `raw`); `App.tsx:452`'s
re-check of what `dayViewShown` already includes (narrows `shown`);
`NowView.tsx:90`'s `strip ?? null`; `SchedulesPanel.tsx:226`'s
`schedule === null || index === null`; `CalendarPanel.tsx:219`'s
`now !== null` in a handler that only renders when `now` is set;
`parse.ts:386`'s `filter(isIdentified)` that never filters ("Narrowing, not
filtering"). The three jsdom guards (`DayView.tsx:63,66`,
`ConfirmDialog.tsx:59`) protect an environment no test runs — with O5 they
are the same question.

### Confirmed live

Every file in `public/` (`icon-*.png` from `manifest.ts` and
`render-icons.mjs`; `sw.js` from `bells.ts:264`), every workflow job and step,
every `.gitignore` entry, every `@smoke` tag (nine tests, matched by
`e2e:smoke`), every helper in `e2e/helpers.ts`, every fixture in
`share.fixtures.ts`. **Every relative link and every heading anchor in all 34
Markdown files resolves**, including everything moved to `Docs/archive/` on
2026-09-09 — the one apparent hit is a dead link quoted inside a fenced code
block in an archived review, which does not render. Every devDependency
except `jsdom` (O5) has a consumer.

Removable: about 18 lines at High confidence with zero risk; about 43 with
the judgment calls.

---

## Part 4 — Bugs (static pass)

Every file under `src/` and `e2e/` read adversarially. Hypotheses against the
pure engine were tested with a throwaway Vitest suite in the scratchpad — 31
engine probes and one jsdom render of `<App/>` — and nothing in the repo was
modified. The eight fixes from 2026-09-04 (B1–B8) were each re-read and are
complete; the one nuance is that `awaitingQuarantine` is set inside
`getSnapshot` (a render-time module write), harmless because `load` runs only
when the raw string changes.

### P1. Focus is stolen to the gear button on every load — `App.tsx:319-329` (Medium)

```ts
useEffect(() => {
  if (settingsOpen) { /* … */ return; }
  const opener = openerIdRef.current === null ? null : document.getElementById(openerIdRef.current);
  (opener ?? toggleRef.current)?.focus();
}, [settingsOpen]);
```

The effect runs once on mount with `settingsOpen === false` and falls through
to `toggleRef.current?.focus()`. The Big-mode effect twenty lines above
carries a `hasBeenBig` guard whose comment names exactly this hazard —
"without the guard that would steal focus … before the user has touched
anything" — and an E2E test for it (`e2e/big-mode.spec.ts:76`); the settings
effect has neither. Present since the effect was introduced in Phase 3
(`13e2473`).

**Confirmed twice.** A jsdom render of `<App/>` under `act` leaves
`document.activeElement` on `button#settings-toggle`; a fresh load in the
preview Chrome does the same (`:focus-visible` is false there because the
heuristic wants a prior keyboard interaction, so no ring paints — but the
element is focused). A screen-reader user hears "Edit the schedule, button"
as the first thing on every load, and Tab starts after the header rather than
at the top of the document. The existing Big-mode test checks only
`#view-big`; the element that *is* focused is one selector away. Fix: a
`hasOpenedSettings` ref, the same shape as `hasBeenBig`, and a negative-control
E2E asserting the gear is *not* focused after `openApp`.

### P2. `minutesToClock` is not integer-safe — `draft.ts:76-80, 88-95` (Low)

`<input type="number" step="1">` still accepts a typed `0.5`.
`endOf("08:00", "0.5")` computes 480.5, the `> 1440` guard passes, and
`minutesToClock(480.5)` returns `"08:0.5"`. The time control sanitises that to
blank, so the end box empties while the length box shows `0.5`; the parser
then refuses `endMin: 480.5` ("That is not a length."), bound to both boxes.
Recoverable, but the draft briefly holds a string that is not a time. The
same root lets `movePeriod` (`draft.ts:280`) produce `"1674:39"` when a
neighbour's length is absurd. Probe:
`updatePeriod(d, "0", { length: "0.5" }).periods[0].end === "08:0.5"`.

### P3. 24:00 is legal to the parser and impossible for the time control — `draft.ts:76-94`, `parse.ts:110` (Low)

The parser deliberately allows `endMin: 1440` ("Midnight-as-end (1440) is
legal"). `toDraft` then emits `end: "24:00"`, `endOf` also returns `"24:00"`
at exactly 1440 (its guard is `> 1440`), and `clockToMinutes("24:00")` is
`null`. **Confirmed live:** with the all-day schedule from §5.2 loaded, the
editor shows Start `00:00`, End `""` (with `badInput` false — the control
simply holds nothing), Length `1440`, and no error. The schedule still saves,
because only the length is read. Also `formatClock(1440)` renders `12:00` in
12-hour mode, so a 23:00–24:00 period reads `11:00–12:00`. Together with Q1
this makes 1440 a value the parser accepts and three surfaces cannot show;
refusing it at the boundary closes all three at once.

### P4. The bell offset moves the clock, and a moved clock rings — `App.tsx:183-186`, `bells.ts:328-338` (Low)

`useBellCrossings` compares consecutive *shifted* seconds. Typing an offset
moves the shifted reading discontinuously. **Confirmed live:** with the clock
at 09:04:50 and Period 2 at 09:05, typing `12` into the offset field made the
announcer say "Period 2 has started." and the title jump from `1m · Passing`
to `60m · Period 2` — before the user had left the Preferences panel. The
reverse also holds: lowering the offset after a bell rewinds past it, and the
same bell rings again a minute later. Calibration is a real trigger — "The
bell just rang" pressed at 10:04:10 stores +50 and lands the shifted clock on
10:05:00 exactly.

This is consistent with "every derived view of the clock agrees, including the
ones you hear", and a moved offset *is* a moved clock — but it has the same
user-facing shape as #61 ("editing a preference rang a bell"). A design call:
either accept it and say so in Decisions, or reset `seen.sec` when
`bellOffsetSec` changes so the first reading after an offset edit is a fresh
baseline rather than a crossing.

### P5. The caps make "Keep it" lie — `App.tsx:246-269`, `ShareOffer.tsx:51` (Low)

`addSchedule` and `setOverride` both return the library unchanged at their
caps by design. `resolveOffer(true)` then saves, clears the offer and strips
the fragment: at 50 schedules the shared schedule vanishes with no message; at
400 overrides it is added but not made today's, while the offer said "Keep it
and it runs today". Probe: `setOverride(withS, today, added.id) === withS` on
a 400-override library. Two sentences in the offer, gated on the counts, would
close it.

### Informational

- `weekdayOf("2026-02-31")` returns a weekday (day is only checked `≤ 31`).
  Unreachable — every caller passes a `parseIsoDate`-minted string — and the
  algorithm itself is correct: brute-forced 1900–2100 against `Date.UTC`
  with zero mismatches.
- Chime unlock listens on `pointerdown`, which grants user activation for
  `pointerType === "mouse"` only; on touch the grant arrives at `pointerup`,
  so the first tap may call `resume()` too early and the second succeed. A
  browser-behaviour claim, not measured on hardware — per AGENTS.md it needs
  one before it is acted on; listening on `pointerup` as well is the cheap
  answer if it is.
- The editor's draft is initialised once, by design, so two tabs editing the
  same schedule are last-writer-wins on the whole schedule with no signal.
  Documented at `ScheduleEditor.tsx:48`; recorded because "the projector tab"
  is the advertised second tab.
- Imported backups have no cap on `id` length (`parse.ts:234`); a
  100,000-character id parses and becomes an `<option value>`. Bloat only —
  share links strip ids.

### Tests weaker than they read

- `e2e/countdown.spec.ts:140` "does not repaint when nothing has changed"
  asserts the digits still read `35:00` after a same-second `focus`; they
  would with or without `useNow`'s equality bail-out.
- `e2e/big-mode.spec.ts:76` "does not steal focus on first paint" checks
  `#view-big` only (see P1).
- `e2e/share.spec.ts:306` and `e2e/editor.spec.ts:344` accept
  `stored === null` as a pass, which is the state they start in; still
  meaningful if the buggy path saves.

### Tried to break, could not

Half-open `[start, end)` is applied identically in `stateAt`,
`periodStatusAt`, `crossedBell` and `blockPositionAt`; gap progress is 0 at
the previous end and tends to 1 at the next start; single-period, empty,
back-to-back, minute 0 and 86399 all correct; `formatTabTitle` at one second
left is `1m`, never `0m`; `splitCountdown` clamps negatives. `shiftNow` never
moves the date. `weekdayOf` is correct for every valid date 1900–2100 and
`parseIsoDate` agrees with `Date.UTC` validity over 1999–2101 × months 0–13 ×
days 0–32, leap rules included. `localIsoDate` and `secondsSinceMidnight` use
local getters, DST cases pinned under a pinned `TZ`. At the parse boundary,
`-0`, sparse arrays, zero-width spaces, control characters and 60-code-unit
emoji names all behave as the caps intend; `withUniqueIds`' first-claimant
rule holds; a hand-crafted payload carrying `id: "regular"` decodes with it
but `addSchedule` strips it before it can hijack the calendar; the six
historical share fixtures decode. In the draft, `1e1`, negative, huge and
blank lengths reach the parser as errors bound to the right boxes and
`movePeriod` with a blank length yields an error state, never a saved
overlap. `useBellCrossings` counts once per render however many bells were
slept through; the `message === ""` guard silences `before` and `empty`; the
worker's `whenActive` gating and the page fallback are consistent; #61 is
complete. `storage` with `key === null` is handled, a throwing `localStorage`
freezes to the cache, quarantine writes before overwrite, and every
`useSyncExternalStore` snapshot is referentially stable. The wake lock
re-acquires on `visibilitychange`, guards an in-flight request, drops a
toggle-off during one, and releases on unmount. No time-dependent value is
rendered before the first effect; every list key is unique by construction;
the Escape ordering against `<dialog>` and the opener-by-id focus return both
hold.

---

## Part 5 — Browser QA

Driven in the in-app Chrome against `next dev` at `localhost:3000/bell`, with
the accessibility tree and computed styles read directly rather than from
screenshots (the preview pane was hidden for most of the session, which is
also what made the throttling observation possible). Every check below was
made on a fresh-install state (`belltab.v1` and `belltab.prefs.v1` removed).

### 5.1 What held

- **Fresh install.** Renders `Regular 9:18`, the countdown, `Next: Passing
  at 10:05`, the Now/Day/Big switcher and the wake-lock signpost; strip off;
  one `aria-live` region (`p#period-announcer`, polite) plus Next's route
  announcer; `viewport` is `width=device-width, initial-scale=1` with no
  `maximum-scale`; nothing written to storage until a valid edit is made.
  The only console error on load is the preview tool's own probe of the
  origin root, which `basePath` correctly 404s.
- **The editor.** Setting Period 1's end to 09:10 marks the field
  `aria-invalid="true"` with `aria-describedby="period-1-error"` → "Passing
  overlaps Period 1. Two periods cannot run at the same time." in
  `var(--danger-text)`; the length box updates to 70; **nothing is saved**
  and the title keeps counting on the last valid version. Setting it back
  writes the library. "Move earlier" is disabled on the first row and "Move
  later" on the last. The `Kind` field is a text box over a `datalist` of
  eight built-in kinds. Delete schedule opens a modal `<dialog>` with focus on
  Cancel; Cancel returns focus to the Delete button.
- **The Day view and Big mode.** Day: caption "2 of 7 · 5h 08m until
  dismissal", "2 earlier periods" collapsed, the running row with live
  seconds, `aria-pressed` true on Day and false on Now. Big mode: `is-big` on
  `<body>`, the switcher gone, focus on the exit pill; exiting restores focus
  to the Big mode button and comes back to the Day view with its `aria-
  pressed` intact.
- **Share links, the happy path.** A v1 fragment built by hand for a
  schedule named `Shared <img src=x onerror=alert(1)> Day` with a period named
  `Block A <b>bold</b>`: the offer sentence, the header, the title and the
  Day view all show the strings **as text** — zero `<img>`, zero `<b>` in the
  document — and the countdown is already running the shared schedule before
  anything is clicked. "No thanks" puts Regular back, clears the hash, writes
  nothing. Re-opening the link and "Keep it" adds the schedule as `s1`, writes
  a dated exception for today pointing at it, leaves the weekday default
  alone, clears the hash and closes settings. Both via `hashchange`, the
  same-document path.
- **Share links, nine malformed fragments.** `#1.zz!z` → damaged; `#99.abc`
  → newer version (format 99); `#nodot`, `#__proto__.abc`,
  `#constructor.abc`, a 30-character version → missing its version marker;
  `#1.` + 9,000 chars → too long; `#1.AAAAAAAA` (not deflate) and `#1.` (empty
  payload) → damaged. Each with a Dismiss that clears the hash. No prototype
  pollution.
- **Imports.** Through the real `<input type="file">` with a `DataTransfer`:
  `not json at all` → "That file is not JSON…"; `[1,2,3]` → "…is not a
  BellTab backup"; a period ending before it starts → "…a schedule BellTab
  cannot read: A period has to end after it starts."; a `__proto__` key with
  an empty schedule list → offered honestly as "This backup holds 0
  schedules" behind the confirmation, and `({}).polluted` stayed undefined. A
  valid single-schedule backup → "This backup holds 1 schedule" (B6's plural
  is fixed) → Import → the library is replaced.
- **Cross-tab sync.** Selecting Dark in one tab set `data-theme="dark"` and
  `color-scheme: dark` there and, via the `storage` event, on the second tab's
  `<html>` without a reload; Light the same; ticking "Show the day as blocks"
  rendered the strip (`aria-hidden`, proportional `flex-grow`) in the other
  tab.
- **Preferences.** "The bell just rang" at 10:05:07 → offset −7, "Done — the
  countdown now runs 7 seconds behind this device's clock."; at 10:04:52 →
  +7 "ahead"; at 09:30 → "No bell in today's schedule is close enough to now,
  so nothing was measured." and the offset stays 0. Reset returns it to 0.
  Chime Test → "Period changes will be silent." (the box was unticked).
  Wake lock ticked in a hidden tab → "The screen will stay awake whenever
  this tab is visible." Notifications `denied` on this origin → the box is
  disabled with the readout and the hidden polite alert carrying the same
  sentence, which is the design (one visible, one for assistive tech), not a
  duplicate.
- **Production.** `curl -I` of `/bell` on `next start`: all five security
  headers present, `x-powered-by` absent, the root a 404, the manifest served
  as `application/manifest+json`, `sw.js` as JavaScript with `max-age=0`. The
  pre-paint theme script is the one inline script of ours, and the CSP still
  has no `script-src` — the Known limit from 2026-09-02, unchanged.
- **The suite.** `npm run e2e` on Chrome against the production build: 291
  passed, 0 flaky, 2.4 minutes — including the reflow gate at five widths
  over four countdown states and four panels, and the axe sweep.

### 5.2 Q1 — a period ending at 24:00 never ends (Low)

Imported a schedule whose one period runs `startMin: 0, endMin: 1440`. At
23:59:58 the countdown read "Solo 0:02 · 0m 02s until dismissal". At
00:00:00 the next day it read "Solo 24:00 hr : min · 24h 00m until
dismissal" with the title `1440m · Solo`, the announcer empty, and no bell.
`stateAt` guards `nowSec >= dayEndSec` for the `after` phase, and
`secOfDay` tops out at 86399, so a day whose last period ends at 1440 has no
second on which it is over: the `after` phase, the "School is out."
announcement, `Done · BellTab` and the dismissal bell are all unreachable.
`crossedBell` then treats the rollover (`toSec <= fromSec`) as a date change,
by design.

Real schools do not dismiss at midnight, the parser allows `endMin: 1440`
deliberately (a period may run to the end of the day), and every seeded and
realistic schedule is unaffected — hence Low. Options: refuse `endMin ===
1440` at the boundary, or let the announcer and bells treat the first tick of
a new day as the previous day's dismissal when the previous state was
`during` a period ending at 1440. The first is one line and one test; the
second is the more correct answer and touches `useBellCrossings`. A Known
limit if neither is done.

### 5.3 Q2 — minutes-only titles for long waits (Low)

`formatTabTitle` writes `${ceil(remainingSec / 60)}m · ${label}` for every
`before`, `during` and `gap` state, so a tab open overnight reads
`480m · Period 1` from midnight until the first bell, and Q1's all-day period
reads `1440m · Solo`. The body already switches to `hr : min` above an hour;
the title does not. "Number first" (the plan, the design system) still holds
with `8h · Period 1`. A design call rather than a defect — recorded because
the closing review is the last place it will be noticed.

### 5.4 Observed, not a defect: intensive throttling, live

After about five minutes hidden, the preview tab's one-second interval fired
roughly once a minute. Snapshots 2.5 s apart showed identical digits, and
"The bell just rang" pressed against a stale `now` measured −30 s instead of
−7 s because the *rendered* reading was thirty seconds behind the fake clock.
Dispatching `visibilitychange` — the event the app listens for — brought
every surface current in one repaint, and the same calibration press then
measured −7. This is the throttling the research describes, the reason
`useNow` recomputes on that event, and the first time this repo has watched
it happen rather than cited it. In real use the button is only pressable in
a visible tab, where the tick is not throttled.

### 5.5 Not reproducible from the hidden pane

Escape closing the delete dialog and Escape leaving settings could not be
exercised by synthetic key events through a hidden pane (the dialog stayed
open; both were closed by clicking). Both contracts are covered by
`e2e/confirm-dialog.spec.ts` and `e2e/editor.spec.ts`, which passed on Chrome
in this session. Reflow at 320 px was not eyeballed for the same reason; the
gate that measures it passed.

---

## What this review changed

Nothing in `src/`, `e2e/` or the configs. This file, the build log's session
entry, decisions, open gaps and bugs rows. `npm ci` was run at the end to
bring the local `node_modules` up to the lockfile (vitest 5.0.0, next 16.3.4):
**455 of 455 pass on vitest 5**, `npm audit` reports zero vulnerabilities, and
lint and typecheck are unchanged.

## Suggested order of work, if the project is not closed here

1. **P1** — the `hasOpenedSettings` guard and the negative-control test. The
   only Medium, a few lines, and it is felt on every load by the users the
   a11y rules are written for.
2. **Q1 + P3 together** — refuse `endMin: 1440` at the boundary, which
   closes the unreachable `after` phase, the empty end box and the `12:00`
   label in one line and one test; or teach the rollover to ring, which is
   the more correct answer and touches `useBellCrossings`.
3. **P4** — decide, and record the decision either way.
4. **P5, P2** — two sentences in the offer; an integer guard in `endOf`.
5. **O1 + O2** — CI, one PR, watch the timings.
6. **D1–D6, C8c, C15** — dead code and comment drift; zero behaviour change;
   one PR.
7. **C1** — the e2e helpers, one PR, largest saving and no app risk.
8. **C2, C3, C6, C7a, C8, C9, C10, C11, C14** — small pure collapses, can
   ship together.
9. **C4, C12, C13** — component and type refactors; run the reflow and axe
   loops after C4.
10. **C5** — CSS; 5a–5f mechanical; the control skin needs its Decisions row
    first.
11. **O3, O5, Q2** — borderline; skip if closing.

If the project *is* closed here, P1 and the 1440 pair (Q1 + P3) are the two
things worth fifteen minutes before the last commit: one is felt by every
screen-reader user on every load, and the other is a value the parser permits
and three surfaces cannot show. The comment drift in C15 is the design record
disagreeing with the code it describes, and is worth the same again.
