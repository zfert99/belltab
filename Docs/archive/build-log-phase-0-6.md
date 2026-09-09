# BellTab — Build Log, Phases 0 to 6 (2026-08-26 to 2026-09-02)

**This is the session log for Phases 0 to 6 (2026-08-26 to 2026-09-02), moved here from `../build-log.md` on
2026-09-09.** It runs from the first plain-HTML commit through the manifest that closed Phase 6 - the plain build, the port to Next, the engine, the countdown, the editor, day types, sharing and comfort. Every entry is verbatim; only same-directory links gained
a `../`. The live log's Decisions, Deviations, Known limits, Open gaps, Closed
and Bugs found sections were NOT moved - those tables are most useful whole,
and the lessons are the part that gets read - so a date below may be discussed
there as well. Append-only still applies: nothing here is edited, and new
entries go in the live log.

---

## Session log

### 2026-08-26 09:27 — `src/index.html`

Markup only, no styling, no logic. Four regions: header bar, countdown block,
progress bar, bounds footer. Ten `id` attributes as JS sockets; classes reserved
for CSS. All time fields start as `--:--` placeholders so a broken script shows
obviously-empty rather than a confidently wrong clock. No `aria-live` on the
countdown — a per-second live region would flood a screen reader. Progress bar
is a plain `<div aria-hidden="true">`, not `<progress>`, since the same numbers
are stated as text around it.

### 2026-08-26 09:29 — `src/styles.css`

Biscuit Lab tokens copied verbatim, then a semantic layer on top. Light and dark
both ship. Added `bounds__edge--start` / `--end` classes to the HTML so the
footer can re-flow via `grid-template-areas` below 30rem. `tabular-nums` on every
clock value — without it the countdown physically twitches once a second as digit
widths change. `prefers-reduced-motion` collapses all transitions.

### 2026-08-26 09:33 — `src/schedule.js`

Hard-coded "Regular day": eleven periods, 8:00 to 14:30, explicit `Passing`
periods filling the mid-day gaps. Data only — no logic, no clock, no DOM. The
day deliberately does **not** tile: before 8:00 and after 14:30 belong to no
period, because those are real states the UI must render.

### 2026-08-26 ~10:30 — toolchain

No Node, no real Python on the machine. Installed Node.js LTS 24.19.0 via
`winget`. Started `npx serve src` on port 3000. Confirmed `schedule.js` serves as
`application/javascript` — the content type is precisely why `file://` cannot
work for modules.

### 2026-08-26 09:39 — `src/app.js`

The clock. Split into a pure half (`stateAt`, `formatClock`, `splitCountdown`,
`formatTabTitle`) and an impure half (`els`, `paint`, `tick`).

**The load-bearing rule:** `tick()` recomputes everything from `new Date()` every
time. No variable holds a remaining-time value that gets decremented. Hidden tabs
are throttled to roughly one wakeup per minute and frozen outright on mobile, so
a decrementing counter loses exactly as much time as the tab spent asleep and
never notices. `setInterval` being unreliable is *expected and harmless* here by
construction.

One `setInterval` in the whole app; `visibilitychange` and `focus` also call
`tick` so the number is already correct on return rather than up to a second
stale.

### 2026-08-26 ~11:15 — engine verification

Copied the pure half into a scratch file and ran 18 boundary checks under Node:
exact first bell, last second of a period, exact handoff between back-to-back
periods, last second of the day, exact last bell, midnight both sides, a real gap
in a non-tiling schedule, empty schedule, single-period schedule, and the
`formatClock` cases. All pass.

**This is the extraction signal.** The checks needed a hand-copied duplicate
because importing `app.js` under Node crashes on `document`. That friction is the
codebase saying where the file wants to split.

### 2026-08-26 11:38 — this document

Started the build log. Backfilled every entry above from file timestamps, the
session transcript, and `git log`.

### 2026-08-26 11:39 — markdown lint cleanup

`npx markdownlint-cli "**/*.md"` reported nine pre-existing errors, all in
`Docs/research/background-timers-and-schedule-modeling.md` — eight
MD032 (a bolded lead-in paragraph butted directly against the list below it) and
one MD047 (no trailing newline). Purely mechanical, no prose changed. Repo now
lints clean, which is the state `AGENTS.md` requires before concluding any
change.

### 2026-08-26 11:40 — `AGENTS.md` gains a build-log section

Promoted the "update the log with every change" convention from a conversational
agreement to a checked-in rule, as a new **The Build Log** section between
*Documentation Standards* and *Roadblock & Research Rules*. Spells out the four
things every change adds (session entry, decision row, open gap, bug entry) and
the three rules for the file itself (append don't rewrite, absolute local
timestamps, record deviations explicitly).

The point: a convention that lives only in a conversation dies when the
conversation does.

### 2026-08-26 11:42 — first feature commit

Added a `.gitignore` — the repo had none. Covers `node_modules/`, `.env*` (with
`.env.example` un-ignored per `AGENTS.md`), the Next build output that arrives at
Phase 0, Playwright and coverage artifacts, `.vercel`, and OS/editor cruft.

Work went onto `feat/countdown-plain-js` rather than straight onto `main`, per
the GitHub Flow rule. Two commits: the `src/` spike, then the documentation.

Discovered while checking git state: **`origin` already exists** and points at
`github.com/zfert99/belltab.git`. `Docs/roadmap.md` still claims the repo has no
commits and no remote. Logged as an open gap rather than silently edited — that
same status block carries the open questions about the repo name and whether the
path stays `/bell`, which are the user's calls.

### 2026-08-26 11:47 — day view, part 1: `src/index.html`

Restructured the markup for two views on one page. The existing countdown became
`<section class="focus" id="focus-view">`; a new `<section class="day">` holds
the day summary, a day-wide progress bar, and an empty `<ol id="period-list">`.

- **One page, two views, not two pages.** The repo rule is one clock and one
  subscriber; a second HTML file would need a second clock.
- **Period rows live in a `<template>`,** cloned once per period. Keeps the
  markup readable in the HTML file and lets JS build rows with `cloneNode` +
  `textContent` rather than concatenating strings into `innerHTML`.
- **Template fields use `data-field`, not `id`.** A template cloned eleven times
  would otherwise produce eleven copies of each id — invalid HTML, and
  `getElementById` only ever finds the first.
- **View switcher is two `aria-pressed` buttons, not a tablist.** A real tab
  widget owes arrow-key navigation and roving tabindex; two buttons are fully
  accessible with none of that ceremony.

No behaviour change yet — every id the current `app.js` writes to is preserved,
the day view ships `hidden`, and the switcher buttons are inert.

### 2026-08-26 11:52 — day view, part 2: `src/styles.css`

Four new sections (9–11 plus a reflow block): view containers, the switcher,
the day summary, and the period rows.

- **`[hidden] { display: none !important; }`** is load-bearing. The `hidden`
  attribute works via the UA stylesheet's `display: none`, which any author
  `display` outranks — so `.day { display: flex }` would have un-hidden the
  hidden view. This is the rare case where `!important` is the correct tool
  rather than a smell.
- **Three period states, marked four ways.** `--past` dims to `opacity: 0.55`
  (mild, because a past period is still information); `--current` gets heavier
  weight, larger type, a butterscotch time, and a visible progress track. The
  design system forbids encoding state by color alone, and JS additionally sets
  `aria-current`.
- **The per-row track exists in every row but only displays on the current
  one**, so rows do not change height as the day advances through them.
- **Switcher uses grape**, per the design system's "grape marks navigation".
  Pressed state is `background: var(--grape); color: var(--bg)` — because both
  tokens flip with the theme, one declaration reads correctly in light and dark.
- **Reflow:** below 30rem the period row's fixed `4.5rem` time column plus a
  long name forces horizontal scroll, so the row restacks via
  `grid-template-areas` — time and duration on one line, name beneath.

### 2026-08-26 11:58 — day view, part 3: `src/app.js`

Two new pure functions, a row builder, a second painter, and the view switch.

- **`daySummaryAt` is separate from `stateAt`, not bolted onto its return
  value.** They answer different questions — "which period is running" versus
  "how far through the day are we" — and the day bar spans gaps that `stateAt`
  reports as their own phase. Keeping them separate also meant the existing 18
  engine checks were untouched by this feature.
- **`periodStatusAt` reuses the same half-open rule** as `stateAt`, so a row
  cannot read as current in the list while the countdown has already moved on.
  Verified by sampling all 86400 seconds of the day at 7-second steps and
  asserting no second ever has two current periods.
- **Rows are cloned once, then only their contents change.** Rebuilding eleven
  `<li>`s per second would discard focus, scroll position, and any in-flight CSS
  transition sixty times a minute.
- **Only the visible view is painted.** `tick` branches on `activeView`, so the
  hidden view is not costing ~50 DOM writes a second. The consequence is that
  the newly revealed view is one tick stale, which is why `setView` ends by
  calling `tick()`.
- **`aria-current="time"`** on the running row — the ARIA token specifically for
  "the current one among a set of times", and the accessible counterpart to the
  butterscotch highlight.
- **View choice persists in `localStorage`, guarded by try/catch.** Not
  paranoia: `localStorage` throws outright when a browser is set to block site
  data and in some private-browsing modes, and an unguarded read at module load
  would take the app down before the first tick. Anything unrecognised degrades
  to `"now"` — the read is its own validation.

**Verification:** 16 new checks alongside the original 18, all passing — day
boundaries, the day bar spanning a hole in a non-tiling schedule, the four
`periodStatusAt` boundaries around 9:05–10:05, the no-two-current-periods sweep,
and `formatDuration`.

### 2026-08-26 12:06 — the period strip, part 1: data and markup

User direction: replace the day view's role as a separate screen with a **period
strip** living permanently under the timer — equal squares for the day's real
blocks, thin connectors for passing periods. The list view stays, as the
readable reference rather than the live view.

**`src/schedule.js`** gains a `kind` field per period (`class` / `lunch` /
`passing`) plus a `PERIOD_KINDS` export. The strip cannot infer square-vs-
connector from the label — a school may call passing "Transition", or name a
class something that contains the word. `kind` is the schedule's own answer.
This is the `{ startMin, endMin, label, kind }` shape the research doc
recommends, arriving early because the strip needs it.

**`src/index.html`**: the Now view loses its standalone period progress bar and
its "until X" line, both of which the strip subsumes, and its footer switches
from *period* bounds to *day* bounds with a `3 of 7 · 3:38 until dismissal`
caption. The Day view gains a disclosure button for collapsing finished periods.

- **The strip is `aria-hidden`.** It is a redundant visual rendering: the
  caption states the same position in words, and the Day view is the readable,
  navigable version. Fifteen unlabelled cells announced one by one would be
  noise. This is why the list view keeps earning its place.
- **One `<template>` for both shapes.** Square and connector share markup and a
  fill element; JS adds the modifier class.
- **Collapsing past periods uses a disclosure button with `aria-expanded`**,
  not a bare hide. The finished periods still exist and are retrievable, and
  the attribute is what tells assistive tech so.

**Known intermediate breakage:** `app.js` still queries `next-name`,
`progress-fill`, `period-start`, `period-end`, and `next-up`, which this commit
removed. The page throws until part 3 lands.

### 2026-08-26 12:11 — the period strip, part 2: `src/styles.css`

Sections 12 (strip) and 13 (disclosure); removed the now-dead
`.countdown__until` rule.

- **Squares are `flex: 1 1 0` with `aspect-ratio: 1`,** clamped
  `min-width: 18px` / `max-width: 56px`. They shrink to fit 320px and cap out
  rather than becoming slabs on a projector, staying square throughout.
- **The strip uses `gap`, not connector-as-spacer.** Two blocks can sit back to
  back with no passing between them — Period 3 into A Lunch does exactly this in
  the fixture schedule — and without a gap they fuse into one long rectangle.
  Worth remembering: the connectors are *periods*, not separators, so they are
  absent wherever the schedule has no passing.
- **Past fills `--fg-soft`, current fills `--accent`.** Butterscotch marks
  *now*, per the design system. Safe to lean on color here only because the
  strip is `aria-hidden` and the caption plus Day view carry the same state in
  text — the strip is never the sole carrier.
- **Hover cue is mouse-only by design.** Cells are `aria-hidden` and not
  focusable, so the caption swap is an extra for pointer users. The Day view is
  where those labels live for everyone else.
- **The disclosure marker is CSS `content` on an empty span**, rotated 90° when
  expanded — decoration belongs in the stylesheet, not the document.

### 2026-08-26 12:18 — the period strip, part 3: `src/app.js`

Three new pure functions (`blockPositionAt`, `formatDayCaption`,
`formatPeriodLabel`), a strip builder and painter, the caption swap, and the
past-period collapse. The Now view's old `paintFocus` targets are gone.

- **`blockPositionAt` counts blocks that have *started*,** so mid-passing the
  number holds at the block just finished rather than jumping to one that has
  not begun. Passing periods are excluded entirely: they are the seams, not the
  units a student counts.
- **Passing periods still get a cell.** Skipping them would leave time
  unaccounted for; the connector fills while you are in the hallway. Verified by
  sweeping the school day and asserting every sampled second sits in exactly one
  cell.
- **Hover borrows the caption instead of opening a tooltip.** No positioning
  code, no new tab stops, and it works on a touch tap. `hoveredPeriod` is read
  by `paintFocus`, so the swap survives ticks and reverts on `pointerleave`.
- **Past rows collapse via `row.hidden`,** with the disclosure label counting
  them (`3 earlier periods`). The label stays constant across states because
  `aria-expanded` already carries open-vs-closed — putting "Show"/"Hide" in the
  text too would make a screen reader announce the state twice.

**Verification:** 22 new checks, plus a static cross-check that every one of the
21 ids `app.js` queries exists in `index.html` and none are orphaned. That last
one matters here specifically — this change deleted five elements the previous
`app.js` depended on, and a missed one would have been a null-reference crash on
load rather than a visible mistake.

### 2026-08-26 12:34 — big mode (the projector view)

A third entry in the view switcher, but **not** a third set of markup: big mode
is the Now view with `is-big` on `<body>`. One painter, one strip, nothing that
can drift out of sync with the small version. The CSS is entirely "make it
bigger" or "take it away".

- **Sized against both axes.** `clamp(4rem, min(26vw, 30vh), 26rem)` — a
  vw-only clamp pushes the number off the top and bottom of a wide, short
  projector surface.
- **The wall clock survives the strip-down**; the schedule name, edit button,
  bounds footer, and switcher do not. A clock on a classroom projector earns
  its space; authoring chrome does not read at ten feet.
- **Fullscreen is an enhancement, never a requirement.** Feature-detected and
  every promise caught: the request is denied outright inside a
  permissions-restricted iframe, and the API is absent on iOS Safari for
  anything but `<video>`. Big mode is pure CSS, so a rejected fullscreen leaves
  it working rather than half-on.
- **`fullscreenchange` drops big mode** when fullscreen ends by any other route
  (F11, the browser's own Escape, the OS), so the page is never left stretched
  with no fullscreen and no explanation.
- **Escape is handled ourselves too**, because a denied or unsupported
  fullscreen leaves big mode running as plain CSS with no browser-level exit.
- **Focus is moved deliberately.** The switcher is `display: none` in big mode,
  so the button the user just clicked vanishes and focus would fall to `<body>`.
  `enterBig` hands focus to the exit button; `leaveBig` hands it back to the Big
  button.
- **The exit control dims with a color token, not opacity.** An opacity fade
  would have taken the label below the contrast floor while it was still the
  only way out of the mode.

**Verification:** id cross-check (23/23, none missing, none orphaned) and
`node --check` on both scripts. The engine was untouched, so the existing 56
checks still describe it.

### 2026-08-26 12:47 — settings, and Preferences

Settings opens from the header gear as a mode (like big mode), not a view:
`settingsOpen` is separate from `activeView`, so closing settings restores
whichever live view was showing. Three sections — Schedules, Calendar,
Preferences — of which only Preferences is built. The other two ship as honest
"not built yet" panels rather than non-functional UI; the Schedules panel names
the overlap decision as its blocker.

**Theme (system / light / dark).** "System" *removes* `data-theme` rather than
writing a value, so the stylesheet falls through to its `prefers-color-scheme`
block and keeps following the OS live — including when the user flips it with
the tab open. Writing `data-theme="light"` for "system" would freeze it at
whatever the OS said once.

**A render-blocking inline script in `<head>`** reads the stored theme before
first paint. This is the one inline script in the app and it earns its place:
`app.js` is a module, therefore deferred until after parsing, by which time the
page has already painted in the system theme. Without it, a user who chose light
on a dark-mode machine gets a dark flash on every single load. Noted for the
Next port — this is exactly the problem `next-themes` exists to solve, and CSP
will need a hash or nonce for it.

**12/24-hour is a parameter, not a module global.** `formatClock(minutes,
{ hour12 })` — a formatter that consults hidden state is a formatter you cannot
test. 24-hour pads the hour (`09:05`), 12-hour does not (`9:05`); that is the
convention in each, not an inconsistency.

**`paintStaticTimes()` is a new third category.** Times fixed by the schedule
(row start times, day bounds) are not per-tick work, but they are not
write-once either — switching to 24-hour has to rewrite all of them. Previously
they were written inside `buildPeriodRows`, which would have left them stale
after a preference change.

**Verification:** 22 new checks. Beyond the obvious conversions: all 1440
minutes of the day agree between the two formats on the minute component, and
24-hour output is always exactly 5 characters (so switching format cannot shift
the layout). Existing 56 checks still pass — `formatClock` with no options
still returns 12-hour, so nothing regressed.

### 2026-08-26 12:58 — overlap decision, and the header back button

**Overlaps stay blocked.** See the resolution under **Deviations**. The
`AGENTS.md` invariant is upheld, the editor mockup's warn-and-allow banner is
not built, and the Schedules panel copy now states the actual behaviour
("blocked at input time, naming the period they collide with") rather than
naming a blocker that no longer exists. No engine change was needed, which is
the point — `stateAt` returning exactly one current period stays true, and the
check asserting no second of the day has two current periods stays meaningful.

**The header gear becomes a back arrow inside settings.** One control, two
jobs, and the glyph and the accessible name change *together* — a back arrow
that still announces itself as "Settings" is exactly the mismatch that makes
icon-only buttons hostile to anyone not looking at the screen. `aria-expanded`
rides on top of both, because the settings region genuinely is a disclosure.

The initial state stays in the HTML rather than being written by JS at startup:
the markup has to say something before the module runs, and duplicating it in
`setSettingsOpen` would mean two owners of the same fact for no gain.

### 2026-08-26 13:22 — the schedule model, before the editor UI

The rest of settings needs data the app did not have: more than one schedule,
and a notion of which one applies today. Model first, UI next.

**`src/schedule.js` is now seed data, not *the* schedule.** Four schedules
(Regular, Delayed start, Half day, Assembly) plus `DEFAULT_CALENDAR`. Once the
user edits anything the edited copy lives in `localStorage`, and this file is
only read again on a reset.

**`parseSchedule` is the boundary.** Returns `{ ok: true, value }` or
`{ ok: false, errors }` — never a boolean, per the repo rule. Each error carries
the row index and the field within it, so the editor can bind the message to
that input with `aria-describedby` rather than reddening a border and leaving a
screen reader with nothing. Periods come out **sorted**; that is normalisation,
not rejection — the order rows were typed in is not the order the day runs in.

**Overlap is checked on a sorted copy, but errors keep the original index**, so
the message names the period actually collided with (*"A Lunch overlaps Period
4"*) while landing on the row the user is looking at.

**The seed data goes through the same parser as user input.** A typo in
`schedule.js` gets caught by the validator instead of shipping as a subtly
broken default, and the happy path exercises the parser on every load.

**Calendar dates are `"YYYY-MM-DD"` strings**, for the same reason times are
integers: a school day is a date on a wall calendar, not an instant.
`parseIsoDate` checks arithmetically rather than round-tripping through `Date`,
which silently rolls `2026-02-30` forward to March 2nd instead of rejecting it.

**An override to `null` is a closure, not a miss.** `resolveScheduleId` tests
for the *entry*, not its value, so a snow day beats a weekday that says school
is on. Getting this backwards would make every closure fall through to the
normal schedule.

**A calendar pointing at a deleted schedule degrades to "no school"** rather
than refusing the whole calendar — that is already a state the app renders.

**Midnight rollover is now handled.** `tick` compares the local date key and
re-resolves when it changes. A tab left open overnight on a projector would
otherwise show Friday's bells on Monday.

**`rebuildViews()`** replaces the strip cells and list rows when the schedule
changes, and clears `hoveredPeriod` — the old period objects are gone, and a
stale hover would caption a period that no longer exists.

**Verification:** 49 new checks, 127 total across five suites. Notable ones: all
four seed schedules pass their own validator; an end time equal to the next
start is legal while one minute of overlap is not; `1900-02-29` is rejected and
`2000-02-29` accepted; duplicate override dates collapse to the first; and a
null override resolves to no-school rather than falling through.

**Bug caught while writing this up:** `loadSchedules` was capping the number of
schedules with `SCHEDULE_LIMITS.periods` (60) — the wrong limit, right-looking
name. Added an explicit `schedules: 50`.

### 2026-08-26 13:41 — the Schedules editor

Chips to pick a schedule, a name field, per-period rows (Name / Kind / Start /
Length / delete), add, duplicate, delete, and shift-all.

- **The editor works on a draft, not on the live schedule.** A draft period
  holds `lengthMin` where a stored one holds `endMin` — that is what the form
  asks for and how bell schedules are actually written ("Period 2, 9:05, 60
  minutes"). Keeping start and length independent means an unparseable start
  time does not also destroy the length already typed.
- **Invalid drafts stay on screen and are simply not saved.** The user keeps
  what they typed and `localStorage` never holds a schedule that would fail to
  load. That is the whole reason the draft is separate from the store.
- **Validation runs on `input`, not `change`,** so errors follow typing rather
  than waiting for a field to be left. Safe precisely because nothing is
  committed unless it parses.
- **Errors get `aria-invalid` *and* `aria-describedby`.** A red border is
  invisible to a screen reader and ambiguous to anyone who cannot separate red
  from grey. Cherry is the emphasis, never the message.
- **The committed value is sorted; the draft keeps typed order.** Re-sorting
  rows under the cursor while someone edits a start time would be hostile.
- **Every control has a positional label** — "Start time of period 3", written
  by JS per row. "Start" alone is useless when tabbing sixty inputs, and the
  visible column headers cannot do this job: a header in a sibling element is
  not programmatically tied to a control inside a list item. Below 45rem the
  headers disappear and those labels stop being visually hidden.
- **Focus is managed on add and delete.** A new row takes focus (otherwise the
  user hunts for it); deleting lands focus on the row that took its place,
  because the button that had focus no longer exists.
- **Shift-all refuses rather than clamps.** Clamping at midnight would silently
  collapse the periods at the edge into each other and then report it as an
  overlap — an error message about the wrong thing.

### 2026-08-26 13:48 — the Calendar

Weekday map plus dated exceptions, and a line at the top saying what today
actually resolves to.

- **`""` is the wire form of `null`.** A `<select>` value is always a string,
  so "No school" has to be encoded and decoded rather than stored directly.
- **Adding an exception for a date that already has one replaces it**, rather
  than creating a duplicate the resolver would have to arbitrate between.
  `parseCalendar` also collapses duplicates on load, so both paths agree.
- **Deleting a schedule re-parses the calendar against the surviving ids**,
  turning dangling references into "no school" instead of leaving the calendar
  pointing at something gone.
- **The calendar re-renders on panel entry, not per edit.** Its selects list
  schedule names, so a rename in the Schedules panel must show up — but
  re-rendering per keystroke would blow away an open dropdown.
- **Weekday selects are `auto-fit, minmax(7.5rem, 1fr)`.** Seven fixed columns
  at 320px would be about 30px each.
- **Remove buttons are individually named** ("Remove exception on 2026-09-14").
  A list of buttons all reading "Remove" is the classic screen-reader dead end.

**Verification:** 127 checks still pass — this was all presentation over the
parser and resolver, which did not change. Static cross-checks: 55 ids declared
/ 51 queried / none missing, and all 13 `data-field` names match between the
templates and the queries.

### 2026-08-26 14:00 — `app.js` split into eight modules, and Vitest

PR #1 merged to `main` first; this is `refactor/split-app-js`. `app.js` was
1,710 lines with five hand-copies of its pure half living in a scratch
directory. Both problems solved together.

**The graph, strictly one-directional:**

```text
schedule.js  →  engine.js / parse.js / format.js  →  dom.js / store.js
             →  views.js  →  editor.js  →  app.js
```

Verified as a DAG by a script that resolves every named import against the
exporting module — no cycles, no unresolved names.

- **`tick` lives in `views.js`, not `app.js`.** The editor requests a repaint
  after every edit; if `tick` were in the entry point that is
  `editor.js ⇄ app.js`. Legal in ES modules and a reliable source of
  temporal-dead-zone bugs at module init. Putting `tick` with the things it
  paints removes the cycle without a callback indirection.
- **State lives on one exported `store` object, not exported `let` bindings.**
  An ES module import is a read-only live binding, so `import { schedules }`
  cannot be assigned to. Since the editor genuinely replaces those values they
  have to be fields on something. One object beat four setter functions.
- **`views.js` owns a `paused` flag rather than reading the editor's
  `settingsOpen`.** Same cycle problem, same shape of fix: the editor pushes
  the flag down, nothing reaches up.
- **`format.js` imports nothing.** The 12/24-hour preference was already a
  parameter, so it stayed a leaf. That decision paid for itself here.
- **`app.js` is now 110 lines** of wiring and startup with no logic.

**Vitest.** `environment: "node"` globally with a `// @vitest-environment
jsdom` pragma on the one file that needs a document, per `AGENTS.md`. Tests are
colocated. 115 tests across four files, replacing all five scratch suites —
which are now deleted, along with the hand-copy step that produced the encoding
bug logged above.

`src/app.test.js` is the one that earns its keep for a refactor like this: it
loads the real `index.html` into jsdom and boots the whole graph. A dangling
reference or a bad import passes every pure test and dies on load; this catches
it. It asserts shape, never specific numbers, because the countdown reads the
real clock.

**Bugs found during the split** — see **Bugs found** for both. One would have
shipped silently.

### 2026-08-26 14:13 — `src/` organised by layer

Eleven flat files became three tiers. `AGENTS.md` names `src/lib/` as the home
for the pure engine and warns off a `src/features/` domain split as premature
fragmentation at this size, so the division is **by layer, not by feature**:
`lib/` is pure, `ui/` touches the document, and `app.js` + `store.js` sit
between them at the root.

Moved with `git mv` so history follows each file rather than reading as
delete-plus-add.

- **`lib/` turned out to be self-contained.** Its four files only ever import
  each other, so not one import path inside it needed rewriting. That is the
  test of whether a layer boundary is real: if extracting it requires editing
  its contents, it was not a boundary.
- **`store.js` deliberately sits at the root.** It is not pure — localStorage
  and `document.documentElement` — but it is not UI either. A `state/` folder
  holding a single file would be worse than the ambiguity.
- **No `@/` alias.** `AGENTS.md` prescribes one, but that needs a bundler; with
  plain ES modules in a browser the paths have to be real. Two `../` hops is the
  worst it gets. This is owed at the Next port.

**Verification:** all 115 tests still pass, and every module returns 200 at its
new URL.

### 2026-08-26 14:25 — closing the open gaps

Eight of thirteen closed. The five left are deliberate deferrals, not oversights
(see **Open gaps** for each).

**The countdown now says what its units are.** `splitCountdown` returns a
`unit` alongside the numbers, rendered as a quiet `min : sec` / `hr : min`
caption. The two modes were visually identical, so `3:38` could have been three
hours or three minutes — a clock that is ambiguous about its own units is worse
than one that is merely ugly.

**`⚙`, `←` and `×` are inline SVG.** Both header icons live in the markup and
only their visibility changes; swapping `innerHTML` would have worked but
`innerHTML` is banned here, and an exception "just for an icon" is how that
rule stops being a rule.

**One `aria-live="polite"` region, firing only at period boundaries.** The
design system permits exactly this and forbids ever wrapping the countdown or
the title in one. It is silent on first paint — describing the current period
the instant the page loads is noise, not news — and it lives *outside* the
paused branch of `tick`, because the bell still rings while settings is open
and that is when a screen-reader user most needs telling.

**The Day view reveals the running row** on entry and at each period change,
`block: "nearest"` so a row already on screen is left alone, and reduced-motion
aware. Guarded by a feature check, because jsdom implements no scrolling at all.

**`window.confirm` replaced with a native `<dialog>`.** `showModal()` supplies
focus trapping, Escape-to-close, an inert background, and dialog semantics —
every part a hand-rolled overlay gets wrong. Cancel takes focus, not Delete: the
dangerous button should never be the one a stray Enter lands on. Where
`showModal` is unsupported the code proceeds rather than silently refusing the
delete the user asked for.

**The `els` staleness gap was closed by checking rather than fixing.** Every
rebuild in the app is `replaceChildren()` on a container, which replaces
children and not the container — so no reference in `dom.js` is ever
invalidated. Nothing needed changing; the invariant is now written down in the
file so it stays true.

**`Docs/roadmap.md` status rewritten** to describe reality, with the phase table
explicitly flagged as describing the Next.js destination rather than the current
state. The open questions in that block were left alone — they are the user's.

**Verification:** 120 tests (5 new). The new ones assert that the announcer is
the *only* live region on the page and that neither the countdown nor the period
name sits inside one — the rule is easy to break later with a well-meaning
addition, and cheap to guard now.

### 2026-08-26 14:40 — code review of `437ef54`

A `/code-review` pass over the previous commit, written up in full as
`Docs/archive/code-review-2026-08-26.md`. Five findings, all open; each has a row in
**Open gaps** above, and the two closed-gap rows the review contradicts are
marked superseded rather than deleted.

The three serious ones share a shape worth naming: the commit traded two
**browser-level** primitives for **page-level** ones — `window.confirm` for
`<dialog>.showModal()`, and a glyph for an `aria-live` region — and inherited
the page's problems along with its control. `window.confirm` dispatched no
keydown to the page, so the global Escape handler never saw it; a `<dialog>`
does, so Escape now closes settings out from under the modal. Nothing announced
before, so `tick()` running on every editor keystroke was harmless; now it makes
the announcer speak once per character typed.

Everything interactive was verified in a real Chrome against a static server
rather than argued from the source, because none of it is visible to the Vitest
suite: the announcer spam needs a period to actually be running, and the Escape
collision needs a real key event and a real `<dialog>`. jsdom 30 does not even
implement `showModal`, which is how finding 3 surfaced — the tests have been
taking the "delete without asking" branch all along.

The review also confirmed four things the commit got right, recorded so they are
not re-litigated: the SVG `hidden` swap really works (`[hidden] !important`
outranks `.icon { display: block }` and matches on an `SVGElement`), 320px
reflow holds with the dialog open, the rebuilt delete buttons keep their
accessible names, and the `els`-staleness invariant is genuinely true.

**No code changed.** The findings are recorded, not fixed.

### 2026-08-26 15:10 — closing the five code-review findings

Branch `fix/code-review-437ef54`. Everything in `Docs/archive/code-review-2026-08-26.md`
is fixed; that document gained a **What was changed** section and its status
line now says so. Tests 120 → 153.

**Finding 3, the silent delete.** `confirmDelete` fell through to `onConfirm()`
where `showModal` is missing. Now it calls `window.confirm` and obeys the
answer. Taken first, as the review recommended: it is three lines, it removes a
data-loss path, and it is what made every test below possible — jsdom is one of
the environments without `showModal`, so the suite had been taking the silent
branch on every run and the delete flow had no test at all.

**Finding 1, Escape.** The document's keydown handler now returns early while
`document.querySelector("dialog[open]")` matches. Queried generically rather
than checking `els.confirmDialog.open`, so a second dialog added later inherits
the rule instead of quietly reintroducing the bug. Separately,
`setSettingsOpen` closes the dialog with an explicit `"cancel"` — leaving
settings by *any* route (the header button, Escape, a view switch) has to take
the modal with it, because the dialog is a sibling of the settings view rather
than a child.

**Finding 2, the announcer.** Two changes. The guard is keyed on
`during:<startMin>-<endMin>` instead of the rendered name, and `refreshResolved`
raises a one-shot `announcerNeedsResync` flag that makes the next tick adopt the
new value without speaking it. Neither alone is enough: identity-keying stops
the per-keystroke spam from renames but not from an edit that moves the running
period, and the flag stops edits but leaves the same-name boundary silent. The
name-keying half turned out to be a live bug of its own — see **Bugs found**.

Suppressing announcements while `paused` was the obvious cheap fix and is
wrong: `announce()` is deliberately outside `tick()`'s paused branch because a
screen-reader user with settings open is precisely the person who cannot see the
countdown and most needs the bell.

**Finding 4, the live regions.** `#schedule-error` is `role="status"` now, not
`role="alert"` — it is refilled per keystroke, and assertive interrupts the user
mid-word. `#override-error` keeps `role="alert"`, which is correct for a
one-shot answer to pressing Add. A new `setMessage()` writes an error slot only
when the message actually changed, so a sentence that stays true across ten
keystrokes is announced once instead of ten times; `clearErrors()` no longer
blanks the schedule slot, since blank-then-refill is itself two mutations. The
name field also finally gets an `aria-describedby` pointing at the message that
explains its `aria-invalid`, which `AGENTS.md` has required all along.

**Finding 5, the Day view units.** `paintDay` carries `unit` into a new
`#day-remaining-units` caption styled to match the Now view's. The running row's
countdown became `formatRemaining` — `50m 00s`, `1h 20m` — rather than a units
caption, because that number renders inside a list whose other rows read `55m`
and `1h`; in that neighbourhood the only readable form is the one carrying its
own units. The minor part stays zero-padded even though `formatDuration` would
not pad it, because this string ticks and an unpadded seconds place changes its
width every ten seconds.

**Testing.** 33 new tests. The three lifecycle findings needed things the suite
could not previously do:

- **A frozen clock.** `vi.useFakeTimers({ toFake: ["Date"] })`, with a
  `freezeAt(hours, minutes)` helper that keeps today's date so `tick()`'s
  midnight-rollover check does not re-resolve the schedule mid-test. Only `Date`
  is faked — `app.js`'s `setInterval` is already running by then and replacing
  it would prove nothing. The pure engine suites are untouched and still take
  the time as an argument.
- **A `<dialog>` stub.** jsdom implements the `open` attribute but neither
  `showModal` nor `close`, so both are stubbed on the element for the supported
  path. That is a mock at a boundary — the platform — and it is the only way the
  supported path is reachable at all.
- **Mutation counting.** "Written once per message" is invisible in the rendered
  text, so that test observes the region with a `MutationObserver` and asserts
  one record across three keystrokes.

Every fix was then checked by re-breaking it and confirming a *named* test
fails. That caught three tests that were green for the wrong reason: with the
real clock sitting at 14:57 the school day was already over, so the Day view
assertions had no current row to be wrong about and the announcer tests had no
running period to mistake an edit for. Those are the tests the frozen clock
exists for — the first versions asserted shape only, and shape is exactly what
both bugs preserved.

**Not done:** none of this was re-verified in a real browser. The original
review measured all three lifecycle findings in Chrome and this session had no
browser to drive; the supported-`<dialog>` path and the 320 px reflow gate are
both owed a real run. Two rows added to **Open gaps** rather than a claim
implied by a green suite.

### 2026-08-26 15:14 — a browser, and the two gaps that needed one

The previous entry closed the five review findings and then owed two things it
could not do: verify the supported-`<dialog>` path outside jsdom, and re-measure
the 320 px reflow gate after the Day view's summary line gained a third element.
Both are now covered by a real Playwright suite.

**Tooling.** `@playwright/test` only, driving the Chrome already installed on
the machine via `channel: "chrome"`. No engine binaries were downloaded — three
packages, no `npx playwright install`. That is the same engine the code review
measured in, so the numbers below are directly comparable to the ones already in
this log. `AGENTS.md` names Playwright as this repo's E2E tool, so this is an
owed item arriving rather than a dependency argument.

**The dev server.** `npm run serve` pointed at a `serve` package that was never
installed, so the documented way to run the app did not work and Playwright had
nothing to serve from. Replaced with `scripts/serve.js`: forty lines of Node,
zero dependencies, `src/` only, with the traversal guard a file server should
have even on a developer's own machine. Probed with `..%2f`, `..%5c`, `....//`
and `%2e%2e%2f` variants — all 404, contained inside `src/`.

**What the suite covers.** 32 tests, three files.

- `reflow.spec.js` — the blocking gate, at 320/375/768/1024/1440, over the Now
  view, the Day view (collapsed and expanded), Big mode, all three settings
  panels, the open confirm dialog, and a 60-character unbroken period name.
- `confirm-dialog.spec.js` — findings 1 and 3: Escape, focus trapping,
  inertness, Cancel, Delete cascading into the calendar, and the documented
  backdrop caveat.
- `announcer.spec.js` — finding 2, including the review's own repro, plus the
  other half: that the bell still rings when the clock crosses a boundary.

**Measured at 320 CSS px**, 09:30 on a Wednesday:

```text
Now view          scrollWidth=320 clientWidth=320
Day view          scrollWidth=320 clientWidth=320
Big mode          scrollWidth=320 clientWidth=320
Settings          scrollWidth=320 clientWidth=320
dialog open       scrollWidth=320 clientWidth=320
dialog box        288x226 at x=16
```

The gate holds, and the dialog is the same 288 px the review measured. The
suite was then checked against a deliberate `min-width: 900px` on
`.day__remaining`: it fails with `950 > 320` and names the five widest
offenders, so it is a measurement rather than a formality.

**Finding 5, visible in Chrome:** the Day countdown reads `5:00` with
`units="hr : min"` beside it, and the running row's aside reads `35m 00s`.

**Finding 2, visible in Chrome:** typing `Chem` into the running period's name
now writes `[]` to the announcer. The review measured
`["C has started.", "Ch has started.", "Che has started.", "Chem has started."]`
at the same keystrokes.

**Every fix was re-broken and re-run.** Removing the Escape bail-out fails
`Escape dismisses the dialog and leaves settings standing` in Chrome — settings
hidden after one press, exactly the review's repro. Restoring the original
`announce()` fails two announcer tests including the typing one. Keying the
announcer on the name alone passes the E2E suite, because the default schedules
have no two adjacent periods sharing a name; that case is the unit suite's
`Twins` fixture, and it fails there.

**Two things the browser corrected**, both written up under **Bugs found**: the
review's "leaving settings by any route strands the dialog" turned out to be one
route, because a modal's inert background blocks the others; and Chrome's modal
tab cycle passes through `<body>` at its wrap point, which is not a focus escape
but does break the obvious `contains()` assertion.

**Still owed**, and now stated rather than assumed: WebKit and Firefox are
uncovered, nothing runs this in CI, and `README.md` still documents the Next.js
destination rather than the app that exists. Three rows in **Open gaps**.

### 2026-08-26 15:30 — the docs catch up to the app

`README.md` and `Docs/roadmap.md` both described the Next.js destination as
though it were the current state. That was harmless while only one person was
reading them and actively misleading to anyone else: the README's Local
development section told a reader to run `npm run dev` and open
`localhost:3000/bell`, and its "before calling any change done" line named
`npm run lint`, `npm run typecheck` and `npm run test:e2e`. **None of those five
things exist.** A reader following the README could not have started the app.

- **README, Stack:** now says plainly that today is plain HTML/CSS/ES modules
  with no build step and no runtime dependencies, and that Next/TypeScript/
  Tailwind is the destination. Vitest and Playwright are called out as already
  here and carrying over.
- **README, Local development:** `npm run serve`, with the reason a server is
  required at all (ES modules over `file://`), and the real check commands.
  Notes there is no `/bell` base path yet.
- **README, Docs table:** adds the build log and this review, and states the
  division of labour — the plan and roadmap describe the destination, the build
  log describes the app that exists, and **Deviations** is where they are
  reconciled.
- **Roadmap, status:** 120 tests → 153 unit plus 32 E2E, and an explicit note
  that two Phase 0 items (the test harness, the reflow gate) have arrived early
  in plain-JS form and carry over — while the scaffold, `basePath`, security
  headers, the `jsx-a11y` rule and GitHub Actions have not.
- **Roadmap, open questions:** the repo-and-remote question is resolved and
  struck through rather than deleted.

**One deviation found, recorded, not fixed:** the tab title separator. See
**Deviations** above. Four documents specify `43m · Period 2` and the code emits
`43m - Period 2`; the fix is one character and two test strings, and it does not
belong in a squash commit about code-review findings.

**Not touched:** the phase table itself. It still describes the Next.js track,
which the roadmap already says in as many words, and rewriting it is the port's
job rather than this branch's.

### 2026-08-26 15:38 — the tab title separator

The deviation recorded in the previous entry, closed. `formatTabTitle` emitted
`43m - Period 2`; the design system, the plan, the roadmap and the README all
specify `43m · Period 2`. Held back from PR #4 deliberately, because it changes
user-visible output and had no business riding along in a squash commit about
code-review findings. Its own branch, its own one-line diff.

`Done - BellTab` became `Done · BellTab` in the same change. That string is not
specified anywhere — but a function that emits a middot in one branch and a
hyphen in the other is worse than either choice made consistently.

**The estimate was wrong in a small, instructive way.** "One character and two
test strings" turned out to be four assertions: `grep` had been run for
`43m - Period 2` and `Done - BellTab`, the two places that spell out the whole
string, which missed `"1m - Period 2"` and `"10m - Period 1"` in the `Math.ceil`
and next-period cases. They surfaced when the suite went red rather than when
the change was scoped. Scoping a rename from a grep for the *example* rather
than the *shape* undercounts every time.

`formatDayCaption` and `formatPeriodLabel` were already on `·`. The tab title
was the only string in the file that was not — locally consistent, globally
odd, which is what a spec violation usually looks like from the inside.

**Verified in Chrome** rather than only in jsdom, because the separator is a
non-ASCII character rendered by the browser chrome:

```text
during        "35m · Period 2"
before        "60m · Period 1"
after         "Done · BellTab"
```

153 unit tests and 32 E2E tests pass. No docs changed — they were already right,
which was the whole point of the deviation.

### 2026-08-26 15:47 — Phase 0, part 1: CI and the security baseline

Branch `feat/phase-0-scaffold`. Phase 0 in `Docs/roadmap.md` bundles two
unrelated things — a Next.js scaffold, and the gates that scaffold was going to
be checked by. This entry is the second half only. The scaffold stays deferred,
per the plain-JS-first decision at the top of the Decisions table; the gates do
not need it and the repo has been running without them for a full day of
changes.

**What the repo had:** 153 Vitest tests, 32 Playwright tests, a markdownlint
config — and no way for any of them to fail anything. No workflow file existed,
so every gate `AGENTS.md` calls blocking was blocking only if the author
remembered to run it.

Added:

- `.github/workflows/ci.yml` — four jobs, in parallel: **Lint** (ESLint +
  markdownlint), **Unit tests**, **E2E (reflow gate)**, **npm audit**. Push to
  `main` and every pull request. `concurrency` cancels a superseded run.
- `.github/workflows/codeql.yml` — SAST on push, PR, and weekly on a cron. The
  cron matters: a repo that only scans on push stops being scanned the moment it
  goes quiet, which is precisely when a new query pattern lands.
- `.github/dependabot.yml` — npm and github-actions, weekly, minor/patch
  grouped into one PR. Security fixes still arrive ungrouped and immediately.
- `eslint.config.js` — flat config, `js.configs.recommended` plus `eqeqeq`,
  `no-var`, `prefer-const`, and `reportUnusedDisableDirectives`.
- `vercel.json` — the four baseline headers plus `frame-ancestors`.
- `.nvmrc` — Node 24, read by CI through `node-version-file`.

**ESLint needed four global scopes, not one.** The obvious config — browser
globals everywhere — fails immediately, and the failure is informative:
`src/app.test.js` reads the real `index.html` off disk with `node:fs` and
`process.cwd()`, because under the jsdom environment `import.meta.url` is the
`http` URL Vite serves the module from, not a file path. So a file that lives
under `src/` by the colocation rule runs under Node, not in a page. The scopes
ended up: `src/**/*.js` browser; `src/**/*.test.js` browser + Node;
`scripts/**` and `*.config.js` Node; `e2e/**` both, because a
`page.evaluate` callback is serialised and runs inside the page while the spec
around it runs in Node.

**`jsx-a11y` is not here, deliberately.** `AGENTS.md` requires it as a blocking
check. It lints JSX; there is no JSX. Installing it would produce a green check
over zero files, which is worse than an honest gap — so it is logged as one. The
real reason ESLint earns its place in a plain-JS repo is `no-undef`: with no
compiler, nothing catches a name that does not exist until a browser reaches it.

**One bug fell out of writing the CI job**, before the job ever ran: the
`lint:md` script in `package.json` was broken and had never been executed. See
Bugs found.

**Headers.** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and
`Permissions-Policy`, plus `Content-Security-Policy: frame-ancestors 'none'`.
The CSP is deliberately partial: a policy carrying only `frame-ancestors` does
not restrict scripts, so it ships the modern half of the clickjacking defence
without breaking the inline theme script that has to run before first paint. A
real `script-src` needs that script's hash and stays an open gap.

The `Permissions-Policy` is the one that took thought. The reflex is to deny
everything; that would break Phase 6's wake lock and chime in the worst possible
way — feature detection passes, the call rejects, and the cause is in a config
file nowhere near the code. `screen-wake-lock=(self)` and `autoplay=(self)` are
allowed on purpose, and now that reason is written down.

**Verified locally, all four CI commands:**

```text
npm run lint      0 problems
npm run lint:md   0 problems
npm test          153 passed (4 files)
npm run e2e       32 passed
npm audit         0 vulnerabilities
npm ci --dry-run  lockfile in sync
```

The three YAML files were parsed with `js-yaml` rather than eyeballed — a
workflow with a syntax error does not fail loudly, it simply never runs, which
looks identical to a repo with no CI.

**Still owed by Phase 0:** the Next scaffold and `basePath`, `jsx-a11y`,
`npm run typecheck`, and branch protection — which is a GitHub setting, not a
file, and cannot be committed. All four are in Open gaps.

### 2026-08-26 16:15 — the first CI run, and the two bugs it found

PR #6. The workflows from the previous entry ran for the first time. Five checks
green — Lint, Unit tests, npm audit, CodeQL, Analyze JavaScript — and **E2E red
with three failures**, which is the outcome the whole phase was for.

The prediction in the previous entry was wrong, usefully. The expected failure
was `playwright install --with-deps chrome` on an Ubuntu runner, the one step
that could only be verified by reasoning. It worked first time. What broke was
the thing nobody thought to doubt: what time the tests believed it was.

Both bugs are written up under **Bugs found**. In short:

1. **The harness bug.** `new Date("2026-09-02T09:30:00")` parses in the Node
   process's timezone while the browser is pinned to `America/New_York`. On a
   UTC runner the suite ran four hours early. Fixed on the fixtures, not in the
   workflow env — see the Decisions row for why the one-line `TZ` fix was the
   wrong one.
2. **A real app bug the harness bug exposed.** Before the first bell, at 768px,
   a 60-character period name scrolled the page sideways.
   `overflow-wrap: break-word` does not shrink min-content;
   `overflow-wrap: anywhere` does.

**A third bug, in the new CI itself:** the `upload-artifact` step reported "No
files were found with the provided path: playwright-report/". CI's reporter was
`"github"`, which annotates the PR diff but writes nothing to disk — so the run
that most needed a trace produced none. Now `[["github"], ["html", …]]`, and the
step uploads `test-results/` too, where `trace.zip` actually lands.

**Verification.** `TZ=UTC` on Windows reproduced all three CI failures exactly,
which is what turned this from "flaky on CI" into a diagnosis. After the fixes,
37 E2E tests (up from 32) pass under both `TZ=UTC` and local time, and 153 unit
tests pass. The new reflow case was watched fail against the old CSS before the
fix was restored.

```text
TZ=UTC   37 passed
local    37 passed
vitest   153 passed
eslint   0    markdownlint 0
```

**What this says about the phase.** The gates justified themselves on their
first run, and not in the way that was expected: the value was not that CI ran
the tests, it was that CI ran them *on a machine with different assumptions*. A
suite that has only ever executed on its author's laptop is testing the laptop
as much as the app.

### 2026-08-26 16:25 — branch protection, and what it actually enforces

`main` is protected. The settings are recorded here rather than left only in
the GitHub UI, because a rule nobody can read without admin access to a
settings page is a rule that gets silently changed:

```json
{
  "required_status_checks": {
    "strict": false,
    "contexts": ["Lint", "Unit tests", "npm audit", "E2E (reflow gate)", "Analyze JavaScript"]
  },
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "required_linear_history": true,
  "enforce_admins": false,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

Applied with `gh api -X PUT repos/zfert99/belltab/branches/main/protection`
and verified by reading it back, not by trusting the write.

**Approvals are zero on purpose.** `AGENTS.md` already says to leave approvals
off because GitHub blocks approving your own pull request; the trap is that
checking "Require a pull request before merging" in the UI silently defaults
the count to 1, which on a solo repo means nothing can ever merge. Requiring a
PR and requiring an approval are separate settings and only one of them is
wanted here.

**What is genuinely enforced, and what is not.** With `enforce_admins: false`,
the five checks gate the merge button on every pull request, and force pushes
and branch deletion are off for everyone. A direct push to `main` by the repo
owner is still possible. That is the deliberate trade recorded in Decisions:
on a repo with one author, the failure worth defending against is merging a red
branch, not the author reaching for `git push`.

The three reasoning notes behind the check list, the `strict` flag and the
admin flag are in **Decisions** rather than here, because each is a choice that
will look arbitrary in six weeks.

This entry is also the first change to go through the gate it describes: a
branch, a pull request, five green checks, and a squash merge. Nothing has been
pushed to `main` directly since it was turned on.

### 2026-08-26 16:45 — Dependabot's first batch, and a green check that proved nothing

Three PRs within a minute of the config landing: `actions/setup-node`,
`actions/checkout` and `actions/upload-artifact`, each 4 → 7. Three majors in
one hop is the shape that deserves reading rather than rubber-stamping.

**They are one change wearing three hats.** Every one of those majors is the
action moving its runtime to Node 24 and then to ESM. That also explains a
warning in the first CI run that went unchased at the time:

```text
Node.js 20 is deprecated. The following actions target Node.js 20 but are
being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4,
actions/upload-artifact@v4
```

The v4 pins were running on a compatibility shim. The bumps remove it.

Release notes for every major in between were read rather than skimmed, and
the breaking changes were checked against what this repo actually does:

| Breaking change | Touches us? |
| --- | --- |
| `setup-node` v5 auto-caches when `packageManager` is in package.json | No — no such field, and `cache: npm` is set explicitly |
| `setup-node` v6 limits auto-caching to npm | No — already explicit |
| `checkout` v6 persists credentials to a separate file | No — nothing reads the credential after checkout |
| `checkout` v7 blocks fork PR checkout for `pull_request_target` / `workflow_run` | No — neither trigger is used |
| `upload-artifact` v7 adds `archive:` for direct single-file uploads | No — unset, defaults unchanged |

**The interesting finding is about the evidence, not the versions.** All three
PRs came back with six green checks, and for two of them that means something:
`checkout` and `setup-node` run in every job, so a green run genuinely
exercised them.

For `upload-artifact` it means nothing at all. That step is `if: failure()`.
A passing run never executes it. The bump is therefore **unverified by
construction**, and the first time it would be exercised is the first red run —
exactly the moment the trace it uploads is wanted. Merged anyway, because a
first-party action on default parameters is a low risk, but merged with that
written down rather than hidden behind a green tick.

**Lesson:** "CI is green" answers a narrower question than it appears to. A
check only covers the code paths the run actually took, and a step guarded by
`if: failure()` is invisible to every successful run by design.

**The config gap the batch exposed.** Three pull requests, all editing the same
handful of lines in one file, each invalidating the other two on merge. The
`groups` block written yesterday covered only the npm ecosystem; the
`github-actions` entry had none. Now grouped — and grouped for **majors** too,
which the npm block deliberately does not do. The reasoning is in Decisions.

One operational note: two `gh pr merge` calls returned
`GraphQL: Something went wrong` and the merges had in fact succeeded on the
server. Reading the PR state back is the only reliable confirmation; the exit
code of the merge command is not.

### 2026-08-26 17:05 — Phase 0, part 2: the Next scaffold

Branch `feat/next-scaffold`. The half of Phase 0 that was deferred a day ago:
Next.js, React and TypeScript, `basePath`, the headers in their proper home,
the a11y lint rule, and `npm run typecheck`.

Scope is the roadmap's own gate — **CI green on an empty page**. The plain
build is untouched and still passes its 153 unit and 37 E2E tests, so the
scaffold is provably additive rather than a migration in disguise.

| | |
| --- | --- |
| Next.js | 16.3.3 |
| React | 19.2.8 |
| TypeScript | 6.0.3 (deliberately not 7.0.2) |
| ESLint | 9 (deliberately not 10) |

**The docs were read first, and they earned it.** AGENTS.md requires reading
`node_modules/next/dist/docs/` before writing code because this Next differs
from training data. Three things would have been wrong from memory:
Turbopack is now the default bundler; `next lint` was **removed** in 16 and
`next build` no longer runs the linter; and `next.config` with `.cjs` or
`.cts` extensions is unsupported. A fourth came from the compiler rather than
the docs — TypeScript 6 **deprecates `baseUrl`** and errors on it (TS5101),
so the `@/*` alias is `paths` alone, which resolves relative to the config.

**Two dependency ceilings, discovered by installing rather than assuming.**
Neither is in any changelog I would have thought to check:

- `eslint-plugin-jsx-a11y` supports no ESLint above 9, at any version.
- `typescript-eslint` **throws at import time** on TypeScript 7, and
  `eslint-config-next` depends on it, so the whole Next lint config fails to
  load. Not a warning — `throw new Error('typescript-eslint does not support
  TS 7.0.')`.

Both were resolved by pinning down rather than forcing through. The reasoning
is in Decisions; the short version is that a linting gate AGENTS.md calls
blocking outranks having the newest major of the linter.

**The `eslint-config-next` a11y subset.** The Next config bundles jsx-a11y and
enables 6 of its 32 recommended rules. Taking it at face value would have
produced a green accessibility check over 19% of the rule set — the same
shape of false comfort as the `if: failure()` artifact step two entries up.
The full `recommended` set is now spread on top, and was verified by writing a
deliberately broken component and watching four rules fire, three of them from
the omitted 26.

**`basePath` behaves exactly as AGENTS.md claims**, verified against a running
server rather than trusted:

```text
GET /bell        200
GET /            404
assets           /bell/_next/static/chunks/*.js
```

No `assetPrefix` needed — the Next docs explicitly recommend against it for
sub-path hosting. Both routes prerender as static (`○`), which is what the
no-SSR requirement wants.

**The same verification caught a real bug** — the headers were reaching the
assets and missing every page. Written up under Bugs found; it is the most
useful thing in this change.

`vercel.json` is deleted. It only ever existed because there was no framework
to hang `headers()` on.

**CI grows to six jobs:** Lint, Typecheck, Next build, Unit tests, E2E and npm
audit. Branch protection still requires only the original five and needs the
two new names added by hand — logged as a gap.

Verified locally, everything:

```text
npm run lint        0 problems
npm run lint:md     0 problems
npm run typecheck   0 errors
npm run build       ✓ 2 static routes
npm test            153 passed
npm run e2e         37 passed  (and again under TZ=UTC)
curl -I /bell       5 of 5 security headers, no X-Powered-By
```

**What is owed next.** Phase 1: the engine moves from `src/lib/*.js` to
TypeScript with a branded `ValidSchedule`. That is the change that finally
breaks the plain build, because a browser cannot load a `.ts` module directly —
so its E2E suite retires in the same PR that replaces what it tested.

### 2026-08-26 17:20 — branch protection catches up to the six-job CI

`Typecheck` and `Next build` arrived with the scaffold and ran on PR #12, but a
required-check list is a GitHub setting rather than a file, so they were green
without being blocking. Added via
`gh api -X PATCH .../branches/main/protection/required_status_checks` and read
back to confirm. The required list is now:

```text
Lint  Typecheck  Next build  Unit tests  E2E (reflow gate)  npm audit
Analyze JavaScript
```

This gap is worth noting as a **recurring** one rather than a one-off: every
future CI job will land green-but-not-blocking until someone edits a settings
page. There is no version of this repo where adding a job also enforces it, so
the two steps have to stay linked by habit.

### 2026-08-27 10:52 — Phase 1: the schedule engine, in TypeScript

Branch `feat/phase-1-engine`. The port the last three entries kept pointing at.
Four pure modules move from `.js` to `.ts`, the plain HTML/CSS/JS build is
retired because it can no longer load them, and the E2E suite is repointed at
the Next app.

**The engine is unchanged arithmetic with a type system bolted to its front
door.** Not a rewrite: `stateAt`, `daySummaryAt`, `periodStatusAt`,
`blockPositionAt`, the parser and every formatter carry over line for line. What
is new is that none of them will accept anything the boundary has not seen.

| | Before | After |
| --- | --- | --- |
| Schedule going into the engine | any object | `ValidSchedule`, branded |
| Parser result | `{ok, value}` / `{ok, errors}` | the same, as a discriminated union |
| `stateAt` return | one shape, nullable fields | a five-member union keyed on `phase` |
| Weekday map | `Array` of length 7 by convention | a seven-entry tuple the compiler knows |

The three interesting ones are in **Decisions**; the short version is that the
brand's symbol is unexported so `parseSchedule` is the only place that can
honestly mint one, and the `DayState` union is what lets `formatTabTitle` read
`state.current.name` with no null check and no lie.

**The tests went with it, and got slightly stricter on the way.** 118 unit tests
across three files, all passing, no fake timers anywhere — the engine still
takes the time as an argument. Two changes worth naming:

- Engine fixtures now go through `parseSchedule` instead of being object
  literals. Casting would have let a fixture that violates the engine's own
  invariants into the tests, which is the exact class of bug the brand exists to
  stop.
- A new property test walks the whole day at 13-second steps and asserts the
  runtime shape agrees with the phase the union promises. A `during` with a null
  `current` type-checks at every call site and crashes at one.

The count fell from 153 because `src/app.test.js` — 743 lines of jsdom wiring
tests for the retired app — went with the app it tested.

**The plain build is gone.** `src/index.html`, `src/app.js`, `src/store.js`,
`src/ui/` and `scripts/serve.js` are deleted, along with `npm run serve`. This
was called on 2026-08-26 17:05 and is not a new decision; what is new is that
`src/styles.css` did **not** go with them. It moved to `src/app/globals.css` and
is imported by the root layout — 1446 lines of implemented design system whose
tokens, focus ring and `overflow-wrap` hardening are useful the moment there is
a page, and whose component rules cost nothing until Phase 3 writes markup for
them.

**The E2E suite is ported rather than retired**, which is the other half of the
change and the part with the most judgement in it. Every spec drove UI that no
longer exists. Rather than delete them:

- The harness moved to the Next app: Playwright now builds and serves the real
  thing, `basePath` is handled on the paths rather than in `baseURL`, and the
  whole suite is TypeScript so `npm run typecheck` compiles it.
- The reflow gate stays live at all five widths, plus a reduced version of the
  60-character-period-name test that drives the CSS rule directly rather than
  through the editor.
- A new live test enumerates the page's live regions by id.
- Everything else is `test.fixme`, with each block naming the phase that revives
  it. 37 parked, 11 live. Playwright prints the skipped count on every run, so
  the debt is visible rather than absent.

That narrowing is a real loss and is recorded under **Deviations** with what is
owed to reconcile it.

**Four things broke or surprised, all written up under Bugs found.** In rough
order of how much they matter later: Next injects an `aria-live="assertive"`
route announcer into every page and it arrives only after hydration; the ported
announcer test contained a `?.` / `!== null` bug that made a missing element
report as a live-region violation; `next build` silently rewrites and reformats
`tsconfig.json`; and the first version of the new reflow test asserted a
guarantee `globals.css` had already documented itself as not making.

Verified locally, everything:

```text
npm run lint        0 problems
npm run lint:md     0 problems
npm run typecheck   0 errors
npm run build       ✓ 2 static routes
npm test            118 passed
npm run e2e         11 passed, 37 skipped (parked)
```

**What is owed next.** Phase 2: one clock, one subscriber, recomputed from
`Date.now()` on every tick and forced on `visibilitychange` and `focus`. It is
the first change that gives `src/lib/` a consumer — until then the engine is
tree-shaken out of the bundle entirely, and the unit suite is the only thing
that has ever run it.

### 2026-08-27 11:20 — code review of the Phase 1 port

A `/code-review high` pass over the staged working tree against `ff64e4c`,
written up in full as `Docs/archive/code-review-2026-08-27.md`. Three findings, all
open; each has a row in **Open gaps** above, and the closed-gap row the review
contradicts is marked superseded rather than deleted.

The port itself came out clean — `engine.js → engine.ts` and
`parse.js → parse.ts` are logic-identical branch for branch, `parseCalendar`
picked up a `typeof id === "string"` guard on the way, and every gate passes on
the tree. All three findings share a different shape: **something whose enforcer
was deleted in this diff, without the enforcement moving with it.** The
`#day-remaining-units` caption went with the retired markup and
`formatDayCaption` reintroduced the ambiguity it had closed the day before; the
plain-JS ESLint block was narrowed to `*.config.js` and took `eqeqeq` and
error-level `no-unused-vars` off the app with it; `src/store.js` was the only
caller of `SCHEDULE_LIMITS.schedules`.

Finding 2 is the one worth naming, because it is invisible by construction: no
line of the diff says "loose equality is now unchecked in `src/`", and the
narrowing is justified in the file's own comment on grounds that are true for
`no-undef` and not for `eqeqeq`. It was found by probing rather than by reading
— a temporary `src/lib/__lintprobe.ts` with `a == 1`, an unused `const` and a
stale disable directive, which ESLint answered with two warnings, no `eqeqeq`
report, and exit 0.

The review also cleared four things so they are not re-litigated: the
adjacent-pair overlap check in `parseSchedule` is *sufficient* rather than
partial (sorted starts plus `start[i] >= end[i-1]` forces strictly increasing
ends), `stateAt`'s `periods[i - 1]` cannot underflow and its gap divisor cannot
be zero, a fresh checkout typechecks without the gitignored `next-env.d.ts`
(verified by moving it aside and running `tsc`), and the
`div#__next-route-announcer__` selector works because Playwright's CSS engine
pierces open shadow roots.

**No code changed.** The findings are recorded, not fixed.

### 2026-08-27 13:06 — the open gaps that did not need a UI

Branch `fix/open-gaps-2026-08-27`. The review of the Phase 1 port left three
findings recorded and unfixed, plus a list of open gaps of mixed feasibility.
This change works the ones that can be finished **without markup that does not
exist yet** — which is all three review findings and the fonts — and deliberately
leaves the rest.

**Finding 2 first, because everything else was written under it.**
`eslint.config.js` gains a fourth block, scoped to `src/**/*.{ts,tsx}` and
`e2e/**/*.ts`, re-asserting `eqeqeq`, `@typescript-eslint/no-unused-vars` at
`error`, and `reportUnusedDisableDirectives`. It sits *after* the Next configs on
purpose: `eslint-config-next` reports unused variables at `warn`, and a later
block is how a flat config wins rather than merges. `package.json` gained
`--max-warnings 0`, which is the other half — the rule severity and the runner's
warning ceiling are two separate ways for the same problem to pass.

Re-ran the review's probe rather than trusting the diff, since that is how the
gap was found in the first place. A throwaway `src/lib/__lintprobe.ts` with
`a == 1`, an unused `const` and a stale `eslint-disable-next-line no-console`
now answers with three errors across two runs and **exit 1**, where before it
was two warnings and exit 0.

**Finding 1: the Day caption.** `formatDayCaption` was rebuilt on
`formatRemaining` instead of on `splitCountdown`'s bare `major`/`minor`. The
alternative — a units slot in Phase 3's markup — recreates the exact dependency
that broke: the caption would be correct only as long as some future component
remembers to render a second element beside it. Spelling the units into the
string makes it correct wherever it lands. `format.test.ts` had been *pinning*
the bug (it asserted `"3 of 7 · 1:00 until first bell"` for one hour as
correct); it now asserts `1h 00m`, and a new test asserts one minute and one
hour cannot render alike.

**Finding 3: the cap with no enforcer.** `parseScheduleCollection` in
`parse.ts`, seven tests. It refuses over the cap rather than truncating —
`src/store.js` used to `slice()` silently, and a link that quietly arrives five
schedules short is one nobody ever finds out about. It refuses the whole
collection when any entry is bad, for the same reason. The review suggested an
Open-gaps row now and the function in Phase 4; the function is pure, takes no
clock and needs no UI, so there was no reason to wait.

**Fonts.** `next/font/google` in `layout.tsx` for Fredoka, Manrope and Space
Mono, wired with `variable` rather than `className` so the three tokens in
`globals.css` keep their fallback stacks. Verified against the built output, not
by inspection: fifteen `.woff2` files under `/bell/_next/static/media/`, four
preloaded, metric-compatible `@font-face … Fallback` rules generated for all
three, and `grep -c "gstatic\|googleapis" .next/server/app/index.html` → `0`.
Runtime stays network-free; the *build* no longer is, which is a new Open-gaps
row rather than a footnote.

**Not attempted, and why.** WebKit and Firefox E2E coverage is still owed, but
the behaviour it exists to catch — `<dialog>`, `:modal`, `inert` — is in the 37
parked tests, so adding the projects today buys two more engines running the same
eleven shell assertions at the price of two browser downloads in every CI run.
It is worth doing when Phase 3 revives the dialog block, not before. The overlap
error-attribution gap needs edit state threaded into a pure function and is a
Phase 3 decision. TypeScript 7 is blocked upstream. The Vercel header
verification needs a deploy.

Every gate green on the tree: `eslint . --max-warnings 0`, `markdownlint`,
`tsc --noEmit`, `vitest run` (126, up from 118), `next build`, and
`playwright test` (11 passed / 37 parked).

### 2026-08-27 13:50 — Phase 2: the countdown

Branch `feat/phase-2-countdown`. The engine gets a face. This is the first
change since the port that a user could tell had happened.

**The one clock.** `src/app/_lib/useNow.ts` holds the only `setInterval` in the
repo. It re-reads `new Date()` every second and returns a `LocalNow` — a second
of the day, an ISO date and a weekday, as integers. Nothing anywhere holds a
remaining-time number and reduces it; every value on screen is
`deadline − now` recomputed from that reading, which is the repo's first
invariant and the reason the whole design works in a throttled tab. It also
listens for `visibilitychange` and `focus`, because a hidden tab is woken about
once a minute and a frozen one not at all, so the number a user sees when they
come back has to be right on the *first* repaint rather than a minute later.
The effect returns a cleanup that clears the interval and removes both
listeners, which closes a gap carried since 2026-08-26.

**`src/lib/clock.ts`, the only file that touches `Date`.** And it takes one as
an argument, so it is as testable as the rest of `src/lib/`. Two details are
load-bearing and both are about DST: seconds-since-midnight is computed from
`getHours/getMinutes/getSeconds` rather than by subtracting epoch milliseconds
(a 23- or 25-hour local day would put every afternoon period an hour out), and
the ISO date is hand-formatted from local getters rather than
`toISOString().slice(0, 10)` (which names tomorrow for every local evening east
of Greenwich). The unit suite is now pinned to `TZ=America/New_York` so those
two tests can actually fail; on a UTC runner they were asserting nothing.

**`src/app/_lib/today.ts`, the seam.** Parses `DEFAULT_SCHEDULES` through
`parseScheduleCollection` at module load — seed data gets no exemption from the
boundary — resolves the day through `resolveScheduleId` against
`DEFAULT_CALENDAR`, and calls `stateAt`. Returns a three-way union rather than a
shape with nullable fields, because "no school today" and "no schedules at all"
are different screens with different copy. Reading the calendar is a phase early
and is recorded under **Deviations**; the alternative was shipping four of the
five empty states.

**The screen.** `_components/NowView.tsx` is the single client component with
state; `page.tsx` stays a Server Component and owns the `<main class="screen">`
card. Existing CSS covered the markup almost exactly — `.countdown`,
`.countdown__time`, `.countdown__units`, `.progress`, `.bounds` and the header
bar all came over from the retired build and rendered correctly on first try,
which is the first evidence any of it works. Two rules changed: a
`.countdown__period--message` size for the empty-state headlines, which at
1.5rem in an otherwise blank card read as a page that had failed to load rather
than as a designed screen; and `.bounds__edge` dropped `font-weight: 500`, which
Space Mono was never going to honour.

**The announcer** is back, as `_components/PeriodAnnouncer.tsx`. It adjusts state
during render rather than in an effect, keyed on `boundaryKey(state)` — which is
built from the period's *times*, never its name. That is the 2026-08-26
keystroke bug made structurally impossible rather than merely fixed, and
`format.test.ts` asserts it directly: renaming a running period produces the
same key.

**The tab title** is a rendered `<title>`, not a `document.title` write, for a
reason that took a `MutationObserver` to find. See **Bugs found**.

**Tests.** 155 unit (up from 126 — `clock.test.ts`, `today.test.ts`, and
`announcementFor`/`boundaryKey` cases in `format.test.ts`) and 49 live E2E (up
from 11), with 33 still parked. The new `e2e/countdown.spec.ts` is where the
Phase 2 gate lives: it moves the clock *without firing a timer*
(`clock.setSystemTime`), asserts the display is stale, and then asserts that
`visibilitychange` or `focus` alone corrects it — including across two period
boundaries the tab slept through, and across Friday night into Saturday. A
decrementing counter fails every one of those. The reflow gate now runs all four
Now-view states at all five widths instead of one state at five widths, and four
of the announcer's parked tests are live again.

**Screenshotted, not assumed:** all four states at 1100px and 320px, light and
dark. The 320px column holds, the "Next:" line drops to its own row as the
stylesheet intended, and dark mode's butterscotch fill reads correctly on the
dark card.

**Not done.** Safari. The roadmap's gate names it specifically, and WebKit is
still not in the Playwright projects — recorded as an open gap rather than
quietly counted as met. The two empty states the design system wants a link on
have copy and no link, because there is nowhere to link until Phase 3.

Every gate green: `eslint . --max-warnings 0`, `tsc --noEmit`, `next build`
(still two static routes), `vitest run` (155), `playwright test` (49 passed / 33
parked), `markdownlint`.

### 2026-08-27 14:46 — Phase 3: the schedule editor

Branch `feat/phase-3-editor`. The schedule stops being the seed data's and
becomes the user's.

**The safety argument, first, because everything else follows from it.** The
editor holds a **draft**: rows whose times are strings, because that is what an
`<input>` gives you and because a half-typed `09:` has to be representable — a
form that cannot hold an invalid value cannot be typed into. Every mutation goes
through one function, `apply`, which runs the draft through `parseSchedule` and
commits **only** on `ok`. There is no other path from the component to the
store. So Phase 3's gate — "no input sequence can produce an invalid schedule" —
is a property of the types rather than of the UI's diligence: the only thing
that can mint a `ValidSchedule` is the parser, and the only thing the store
accepts is one.

The countdown keeps running on the last valid version throughout, which is why
there is no Save button and no dirty state. Valid edits are already persisted;
invalid ones were never anything to lose. Leaving the editor mid-error is
therefore harmless rather than a confirmation prompt.

**Length, not end time.** The fourth column is a duration. "Period 2 is 55
minutes" is how a schedule is actually described, and it makes `start >= end`
unreachable by typing — the one invalid shape two time inputs can express
between them. The engine still stores `endMin`; `draft.ts` does the arithmetic
in both directions and `draft.test.ts` round-trips it through every minute of
the day.

**Reorder had to be redefined.** Periods are stored sorted by start, so dragging
a row up a list would be undone by the next parse. The two move buttons swap a
period with its neighbour and give each the other's slot, keeping its own
length — which provably cannot overlap, because the pair's new span ends no
later than the later period already did. Any gap between them ends up after the
pair. Six tests, including "is its own inverse" and a loop asserting that every
move of every row in both directions still parses.

**`localStorage` is an external store, not component state**, and the repo's own
lint rule is what said so. See **Bugs found** — the short version is that
`useSyncExternalStore` was the right API, hydration is safe by construction
rather than by deferring a read into an effect, and two tabs on the same origin
now stay in sync for free.

**Accessibility is most of the work here.** Native controls throughout, so the
keyboard behaviour, the mobile pickers and the focus rings are the browser's.
Every parser error is bound to the field that caused it with `aria-describedby`
and marked with `aria-invalid`, and the overlap message names the period
collided with rather than saying "invalid". Focus follows the view swap in both
directions — to the settings heading on open, back to the toggle on close.
Exactly one live region was added, `#schedule-error`, for the one error with no
control to point at; it is always rendered and hidden with `.visually-hidden`
rather than `hidden`, because a region has to be in the accessibility tree
*before* its text changes.

**Restructure.** `App.tsx` now owns the clock, the store and which screen is up;
`NowView` became presentational. `today.ts`'s library went from a module
constant to a parameter, which is also what finally made "a library with no
schedules" testable — a state the frozen seed data could never reach.

**Three real bugs, all in Bugs found.** A lint rule that was right about a
design problem rather than a false positive. A Chrome time input that clips its
own value silently at 8rem, found by looking at a screenshot rather than by any
assertion. And `#schedule-name` overflowing at three widths the moment the
reflow gate was finally able to type into it — a gap that had been open, and
correctly worded, for a day.

Also worth recording: one of my own test expectations was wrong, and the app was
right. Lengthening Period 2 to 70 minutes was supposed to move the countdown to
45; it moved nothing, because 70 minutes runs into the Passing period at 10:05
and the editor refused to commit it. The test now shortens instead, and the
overlap case is asserted deliberately a few blocks down.

**Tests.** 213 unit (up from 155: `draft.test.ts` 36, `library.test.ts` 14, plus
`today.test.ts` grown for the library parameter) and 83 live E2E (up from 49),
with 22 parked. `e2e/editor.spec.ts` includes a keyboard-only pass that adds a
period, names it, types a time into the native control, steps the length with
arrow keys, moves it earlier and leaves with Escape — no `click()` anywhere in
it. The confirm-dialog suite is **re-parked from Phase 3 to Phase 4**: it guards
deleting a whole schedule, which is Phase 4's, and its note now says which of
its assertions will need adjusting when it is revived.

**Not done.** Safari, still — carried from Phase 2 and now covering a form as
well as a clock. No automated axe scan, which `Docs/research/accessibility-
responsive-qa.md` recommends and which the editor is the surface that would pay
for it; it is a new dependency and outside the roadmap's Phase 3 list, so it is
an open gap and a proposal rather than a quiet addition. No undo. The
onboarding empty state is still a dead end until Phase 4 can create a schedule
from nothing.

Every gate green: `eslint . --max-warnings 0`, `tsc --noEmit`, `next build`
(still two static routes), `vitest run` (213), `playwright test` (83 passed / 22
parked), `markdownlint`.

### 2026-08-27 14:58 — the research library

Branch `docs/research-library`. Nineteen research documents dropped into
`Docs/research/`, plus an index that says what they are.

**What they are.** One of them — `background-timers-and-schedule-modeling.md` —
was already here and is BellTab's own evidence base; `AGENTS.md`'s domain
invariants cite it directly. Everything added in this change was written for a
sibling project: the Puzzle Lab app, or the Biscuit Lab hub's multi-zone
migration. They were copied here because their conclusions travel.

**Why an index was worth writing.** Their *numbers* do not travel, and one of
them is an active trap. `eslint10-ts7-upgrade-blockers.md` explains why ESLint
10 and TypeScript 7 were deferred — a conclusion that matches this repo's own
open gap exactly, and for the same upstream reason (`typescript-eslint`'s
`typescript` peer range, and `jsx-a11y` supporting no ESLint above 9). But it
cites `typescript ^5`, a Tailwind dependency, Node 20 in CI and Dependabot
PR #5, none of which describe BellTab: this repo is on TypeScript 6.0.3, has no
Tailwind, and has its own Dependabot history. Read six weeks from now with no
provenance, that document is a confident, sourced, wrong account of our own
dependency state.

So `Docs/research/index.md` splits the directory three ways: BellTab's own
evidence, inherited references that apply here as written, and inherited
references that are *about other repos*, each with the specific caveat. The
Phase 7 cutover documents are in the third group and are the closest precedent
we have for it — with the note that BellTab has no auth, which is what made
Puzzle Lab's version of that migration hard.

**One that changes nothing yet but should be read before Phase 4.**
`accessibility-responsive-qa.md` recommends `@axe-core/playwright` on every
journey with zero critical/serious violations to release. Phase 3 left that as
an open gap rather than adding the dependency unasked; the editor is the surface
that would pay for it, and the same document is explicit that the checks this
repo does run — `jsx-a11y`, the reflow gate, a keyboard pass — cover roughly a
third of WCAG success criteria between them.

No code changed. `markdownlint` passes over all twenty documents, which is the
only gate that applies to them.

### 2026-08-27 15:17 — code review of `3f709dc`, and the eight fixes

Reviewed the research-library commit at effort `high` and wrote it up as
`Docs/archive/code-review-2026-08-27-research-index.md`. Seven findings, plus an eighth
found while fixing. All eight fixed in this session; nothing left open from the
review itself.

**The review target had to be `HEAD~1`.** Both `git diff origin/main...HEAD` and
`git diff HEAD` were empty — `main` was clean and pushed — so there was no
working-tree diff to review. Worth recording because it will recur: reviewing
straight after a merge means reviewing the last commit, not the tree.

**What the review found was one defect, eight times.** `Docs/research/index.md`
exists to say which repo each document is about, and its third table does that
precisely. Its second table promised **"general, and safe to apply here"** and
then listed five documents whose own H1s say *Puzzle App* or *Puzzle Lab* — four
of them with no caveat at all. The worst was
`ai-assisted-nextjs-security-reference.md`, filed as safe, whose staged plan is
better-auth, rate limiting on Upstash, Neon RLS and passkey recovery: every one
of them a decided non-goal in `Docs/belltab-plan.md` §2. That is precisely the
`eslint10-ts7-upgrade-blockers.md` trap the index was written to flag, at larger
scale and unflagged.

**The eighth finding is the one that would actually get acted on.**
`web-best-practices.md` and `enterprise-architecture.md` were un-caveated
because they are genuinely repo-agnostic — no Puzzle Lab in the title, no Neon,
no better-auth. But both recommend feature-folder/domain architecture, and
`AGENTS.md` bans exactly that by name as an AI pitfall: *"Do NOT introduce a
`src/features/` domain architecture."* A repo-agnostic document, filed as
generally applicable, recommending the one refactor the repo rules forbid, is a
worse trap than a document with "Puzzle App" in its title — because nothing
about it looks foreign.

**The fix is a third column, not a reorganization.** The second table's heading
is now "general advice", its preamble says five of the eleven were written *for*
the puzzle app, and every row has a **Watch out for** cell. Filling all eleven —
including the four that just say "Repo-agnostic" plus a narrowing — is the
point: with caveats on only some rows, a blank cell cannot be distinguished from
an unread one.

The two Puzzle-Lab-titled advice documents stayed in the second table
deliberately. The third table is for documents *about* another repo; these are
advice *addressed to* another repo. Merging the two senses would cost the third
table the precision that makes it worth reading.

**Four dead links, and the discovery that they were never fabricated.**
`multi-zone-migration-safety-review.md:46` pointed at `../../src/lib/rate-limit.md`
— from `Docs/research/` that resolves to this repo's root, where it does not and
cannot exist. `multi-zone-cost-and-alternatives.md` had three more, at lines 5,
52 and 97, and they are the two sources that document leans on hardest: the
commissioned research that corrected three of its own earlier claims, and the
cron outage that prompted the decision. All three target files turned out to be
real, in `Puzzle-Generator/`. The paths broke when the documents moved, not when
they were written.

They are now plain filenames with the owning repo named alongside, and the index
has a closing section recording that convention so nobody re-adds the links. The
prose was not otherwise touched — see the Decisions row on why editing borrowed
research to fit this repo destroys what makes it worth keeping.

**The build-log entry for `3f709dc` broke the build-log rule.** It recorded the
*what* and skipped the *why*: no **Decisions** row on a change that was almost
entirely a why, and no **Open gaps** row for four dead links that were knowingly
imported. Four Decisions rows and one Open gaps row were added with this session.
The gap survives the fix — de-linking removes the broken pointer, not the fact
that three pieces of cited evidence live one repo away, including a claim marked
**VERIFIED** with numbers.

Verified after the change: every link in `index.md` resolves, every document is
indexed and every indexed document exists (checked both directions), and the
enumeration of non-`http` links across all research documents is now empty where
it previously returned exactly four. `markdownlint` passes. No code changed;
`lint`, `typecheck`, `vitest` (213/213) and `playwright` (83 passed, 22 parked)
were run anyway and pass.

### 2026-09-01 11:35 — Phase 4: day types, the calendar, and multiple schedules

`feat/phase-4-day-types`. Phase 2 already READ the weekday map and the date
overrides, because the "no schedule today" empty state cannot exist without them,
and Phase 3 persisted them. This is the UI that edits them, and the second
schedule for them to point at.

**Identity, at the boundary.** The calendar points at schedules by id, and until
now `Schedule.id` was nullable everywhere — so a schedule that arrived without
one was a schedule no day could ever run, and "duplicate" had no way to say which
of two identical objects the calendar meant. `parseScheduleCollection` now
assigns ids: a two-pass walk that lets the FIRST claimant of an id keep it and
mints `s1`, `s2`, … around the rest, returning `IdentifiedSchedule[]`.

The narrowing is a type predicate (`isIdentified`) rather than a second cast.
`parseSchedule`'s double assertion is still the only one in `src/`.

Duplicate exploits the two-pass rule rather than working around it: it hands the
boundary a copy carrying the source's own id, and because the original comes
first in the list, the original keeps it and the copy is minted a new one. One
place decides what an id is.

**Six pure mutators**, in `_lib/library.ts`, all functions from a library to a
library: `createSchedule`, `duplicateSchedule`, `deleteSchedule`, `setWeekday`,
`setOverride`, `removeOverride`. Every structural change goes through a private
`rebuild` that re-parses the whole collection and re-points the calendar at the
ids that survive, so ids are minted, the schedule cap is enforced, and a weekday
aiming at a deleted schedule degrades to "no school" — one code path, three
guarantees, none of them the caller's job to remember.

Delete is the one that needed a product decision rather than a rebuild.
`parseCalendar` turns a dangling override id into `scheduleId: null`, which is an
explicit closure, so deleting "Assembly" would have quietly rewritten "assembly
on the 14th" into "the school is shut on the 14th". Those overrides are dropped
first. Weekdays are left to degrade, because there null already means no school.

**Three components.** `SchedulesPanel` — the chip picker, New / Duplicate /
Delete, and the Phase 3 editor underneath. `CalendarPanel` — what today resolves
to, a "use this schedule today" control, the seven weekday defaults, and the
dated exceptions, in the order the resolver reads them. `ConfirmDialog` — a
native modal, feature-detected, with `window.confirm` behind it.

`SettingsView` finally grew the tab strip `globals.css` has been carrying since
the retired build. Pressed-state buttons rather than an ARIA tablist: two
destinations that each replace the panel below owe none of the tablist contract,
and claiming the role without the behaviour is worse than not claiming it.

**The Escape guard Phase 3 left a comment about is now code.** `App.tsx` bails
while `dialog[open]` matches, because a modal's Escape keydown bubbles to the
document and the dialog's own close is only the default action of that same
event — so the document listener runs first and would close settings out from
under an open confirmation. That is a regression this repo has shipped once;
`e2e/confirm-dialog.spec.ts` is its contract and is live again, all six tests.

**Two empty states stopped being dead ends.** "No school today" offers *Pick a
schedule for today*; "No schedule yet" offers *Set up a schedule*. Both link into
the editor rather than creating something the user did not ask for.

**Tests: 244 unit (up from 213) and 108 live E2E (up from 83).** The new unit
work is the identity guarantee in `parse.test.ts` and the six mutators in
`library.test.ts` — including the one that proves deleting a schedule drops the
overrides pointing at it rather than inventing a snow day. `e2e/calendar.spec.ts`
is the phase gate: a late-start Wednesday, a one-off assembly that beats the
weekday under it, a dated closure that beats a school day, the weekend, deleting
the schedule a day points at, duplicate-and-tweak, and building a schedule from
an empty library. Every one runs on a paused clock and none waits for a tick —
the countdown recomputes when the library changes, and a test that had to wait a
second would be documenting a bug.

The suite's growth also broke it, in a way that had nothing to do with Phase 4:
at eight workers a 108-test run crashes the browser on this machine, and raising
the boot timeout made it worse rather than better. Local workers are capped at
four, with the measurement recorded in `playwright.config.ts`. See **Bugs
found**.

Three parked suites came back: the delete confirmation in full, the announcer's
"says nothing when the calendar is repointed", and the confirm dialog's reflow
block. The reflow suite gained a calendar test with a hostile name in the
library, which found two real overflow bugs — see **Bugs found**, including the
one that shows this gate had been measuring min-content and never max-content.

`npm run lint`, `npm run typecheck`, `npx vitest run` (244/244), `npx playwright
test` (108 passed, 10 parked) and `npx markdownlint-cli` all pass.

### 2026-09-01 12:20 — code review of the Phase 4 tree, and the three fixes

`Docs/archive/code-review-2026-09-01.md`, effort `high`, on the uncommitted Phase 4 work.
Three findings, all three fixed in the same session.

The phase's load-bearing parts cleared: `withUniqueIds`' two-pass claim-then-mint,
the calendar re-pointing on delete, the Escape guard, index clamping and the
editor's draft round trip were all checked and are recorded in the review's
**Checked and cleared** section so the ground is not re-covered.

All three findings were in one place — the dated-exception form, the single
surface in this phase where an untrusted string and a boundary cap meet a control
that reported neither. Two of them made a user action silently do nothing. See
**Bugs found** for what they were and why the cap gate managed to be wrong in
both directions at once.

Fixing the second turned up a fourth defect that predates the phase: the
`aria-invalid` border style had never painted, in the editor or anywhere, having
lost on specificity to the control skin's `border` shorthand since Phase 3. Every
test asserted the attribute, which was always right. Both suites now measure the
computed colour. See **Bugs found**.

Both reproductions were written as assertions before anything was fixed, so the
regression tests are the same code that demonstrated the bugs. Unit tests went 36
to 44 in `library.test.ts` — including a calendar built up to the cap through
`setOverride` itself, so the fixture is reachable by the route a user would take.
E2E went 8 to 11 in `calendar.spec.ts`: Chrome really will hold `20260-09-14` in
a date input, which is what makes the typo case testable in a browser rather than
only argued about.

`npm run lint`, `npm run typecheck`, `npx vitest run` (252/252), `npx playwright
test` (111 passed, 10 parked) and `npx markdownlint-cli` all pass.

### 2026-09-01 14:05 — the gates: three engines, an axe scan, and two tabs

`fix/open-gaps`. Twenty-two gaps were open after Phase 4; this branch takes the
cluster `AGENTS.md` and the research documents actually call blocking, plus one
decision that had been deferred twice.

**Three engines — spiked, and split back out.** WebKit and Firefox went in as
Playwright projects, took the suite to 396 tests, and earned their keep
immediately: a `<select>` whose text WebKit paints outside the control and
scrolls the page with, and the discovery that a WebKit build may implement
neither `type="time"` nor `type="date"`. Both in **Bugs found**, along with the
several fixes tried and rejected on measurement.

**The fixes merged; the projects did not.** See the 14:55 entry below for why.

**An axe scan**, `e2e/a11y.spec.ts`, over ten journeys: four countdown states,
the onboarding screen, both settings panels, both panels mid-error, and the open
modal. `@axe-core/playwright` 4.13.0 from `dequelabs`, dev-only, and `axe-core`
deduped against the copy `eslint-plugin-jsx-a11y` already pulls in — one package
added, not two, and `npm audit` stays clean.

It found a genuine WCAG 1.4.3 failure on its first run: **every error message in
the app was 3.54:1**. Also in **Bugs found**, including the note about which
existing gates could never have caught it.

One implementation detail worth keeping: axe hangs forever against this repo's
paused test clock, because it schedules its own work through `setTimeout` and
`requestAnimationFrame`. `page.clock.resume()` before the scan restarts time
without moving it, so the fixture's day and hour still stand.

**Cross-tab sync, demonstrated rather than claimed.** Two pages on one context:
edit in the editor, assert the countdown, the schedule name and the tab title in
the other page. No reload and no tick, so the `storage` event is the only thing
that can have carried it. It has been true since Phase 3 and untested since
Phase 3.

**The Day view's parked assertions are deleted.** Every other parked block names
the phase that revives it; this one named none, because no phase was ever going
to. Its formatters and CSS are still in the tree and are now their own gap —
deleting a tested pure function is a different decision and should be made on
purpose rather than swept up here.

**Two infrastructure notes,** both of which stayed on the spike branch. Local
workers had to go 4 to 2 there, in two steps and with one wrong answer in
between: three engines put the axe scan under WebKit — the heaviest thing in the
suite — over the same line the last two worker changes were about. Four failed
outright; three looked clean over three runs and then produced a single failure,
then four, always the boot wait and never the same test twice. An intermittently
red suite is worse than a slow one, because the first thing it costs is the
habit of believing it. Back on one engine the number is 4 again. And the E2E job's NAME turns out to be an interface: branch
protection requires "E2E (reflow gate)" by exact string, so renaming it to match
what it now does would have silently removed the gate rather than failing
loudly. The name stays, with a comment saying why.

`npm run lint`, `npm run typecheck`, `npx vitest run` (252/252), `npx
markdownlint-cli`, `npm run build` and `npx playwright test` (366 passed, 30
parked, three engines) all pass.

### 2026-09-01 14:40 — CI contradicted the WebKit finding within the hour

The first push of `fix/open-gaps` went red on one test: the keyboard-only editor
test, on WebKit, on the Linux runner. The failure carried
`<input type="time" value="14:30">`.

Which made the entry written an hour earlier wrong. "Playwright's WebKit does not
implement `type="time"`" was measured on the development machine's build and
stated about the engine; the runner's build implements it and had simply refused
the `0300PM` keystrokes on their own terms.

Two fixes, and the second is the interesting one:

- The keystrokes now depend on the ELEMENT (`element.type === "time"`), which
  they already did, plus a `locale: "en-GB"` pin in the shared `use` block. That
  makes the control 24-hour everywhere, so the keystrokes are `1500` and no
  meridiem segment exists to disagree about. Safe because the app formats every
  time it displays by integer arithmetic — `format.ts` has no `Intl` and no
  `toLocaleString`, and neither does anything else in `src/`.
- `AGENTS.md`'s rule gained a second half in the Decisions table: a
  browser-behaviour claim names the PLATFORM it was measured on. The existing
  rule asked for a citation or a test, and a test is exactly what produced the
  wrong claim here — one platform, generalised to an engine, contradicted by the
  next CI run.

The **Bugs found** entry is rewritten rather than deleted, because the wrong
version is the point: the original table of measurements is still there, now
labelled with the build it came from, next to the CI evidence that contradicts
the conclusion drawn from it.

Everything else on the branch stands. `npx playwright test` is 366 passed / 30
parked across three engines, and the rest of the gates are unchanged.

### 2026-09-01 14:55 — the three-engine work is split back out

`fix/open-gaps` was four gaps in one branch. Three of them — the axe scan,
the cross-tab test and the Day view deletion — were verified, independent, and
done. The fourth, cross-engine coverage, was one assertion away from done and
had already cost three CI round trips on a build that cannot be run locally.

**What went wrong is worth writing down, because it is a planning error rather
than a technical one.** Adding WebKit to a suite whose editor is built on
`<input type="time">` means adopting every engine's opinion about typing into a
segmented control — and that opinion turned out to vary by platform for the same
Playwright version. The development machine's WebKit renders no time control at
all; the Linux runner's does and rejected two different sets of keystrokes. Each
answer cost a full CI cycle.

The judgement error was not noticing after the FIRST failure that the assertion
was measuring a browser's per-segment keystroke handling rather than anything
about BellTab. The arrow-key version should have been the response to that
failure, not to the second one.

**What merges here:** the axe sweep and the contrast fix it found, the cross-tab
test, the Day view deletion, and both of the WebKit spike's FIXES — the
container clip and the date/time placeholders — because those are correct in
every engine and Chrome's reflow gate covers the first.

**What does not:** the WebKit and Firefox projects, the `locale` pin they
needed, the worker reduction they forced, and the CI browser install. All of it
is on `test/three-engines`, at the tip that was passing locally, along with
these findings. What that branch owes is one green CI run on the arrow-key test.

The gap "WebKit and Firefox are not covered" is therefore **reopened** rather
than closed, and now says what the spike learned and what is left.

### 2026-09-01 15:30 — the three engines, second attempt

`test/three-engines`, recreated from `main` rather than rebased. The first
attempt carried the engine work and four gaps' worth of fixes in one branch and
was split; everything except the projects themselves merged as `2de966e`, so
what is left here is genuinely small: two projects, a worker count, and one line
of CI.

That is the whole point of the split. The two defects WebKit found are already
fixed and already covered in Chrome, so this branch no longer risks anything —
it either goes green and closes a gap open since 2026-08-26, or it tells us
something new about the Linux runner's WebKit and costs one CI cycle.

**The one open question it answered:** whether `ArrowUp` steps a segmented time
control on the runner's build. **It does not.** Typed digits did not either,
twice — `0300PM` under a 12-hour locale, `1500` under an `en-GB` pin that
removes the meridiem segment. Three interaction styles, all inert on that build,
while Chrome and Firefox accept all three.

That is now measured rather than guessed, and it settles the question the wrong
way round: the assertion cannot be made to work there, because the control does
not respond to synthetic keyboard input at all.

**So the assertion was split along the line it should have been split on after
the FIRST failure.** Reachability is BellTab's — the field must be tabbable, in
order, with a label, and that is asserted unconditionally. Whether a native time
control answers a synthetic keystroke is the BROWSER's, and that assertion now
runs where the control responds and is ANNOTATED where it does not.

Annotated rather than dropped, faked or branched on a project name. A test that
quietly asserts nothing is worse than one that says in its report which build
refused to play. And nothing much is lost: this app's timing is a start plus a
LENGTH, and the length field is an `<input type="number">` whose arrows work
everywhere, asserted unconditionally two lines further down.

**The cost of learning this was three CI cycles**, and it did not have to be.
The first failure already contained the whole answer — an assertion about a
control's per-segment keystroke handling is an assertion about a browser — and
the right response then was the split, not a second set of keystrokes and then a
third. Recorded because the branch is otherwise a success story and the process
was not.

Local: 366 passed, 30 parked, three engines, at two workers.

### 2026-09-01 15:57 — Phase 5, part 1: the share pipeline

`feat/phase-5-sharing`. The half of Phase 5 that is pure and therefore fully
testable: `src/lib/share.ts`, its fixture file, and 27 tests. No UI yet.

`JSON.stringify` → `CompressionStream('deflate-raw')` → base64url, exactly as
`Docs/belltab-plan.md` specifies, and the plan's own claim checked rather than
repeated: the eleven-period seeded day encodes to **260 characters**. The test
pins it under 600 so a future change that bloats the payload has to argue for
itself.

**The format is `<version>.<base64url>`, version first.** A decoder knows what it
is holding before it interprets a byte. `DECODERS` is a table keyed on that
version with one entry today, and the rule written above it: a new meaning for
the bytes is a new entry beside the old one, never a change to it.

**The id is deliberately not shared.** An id is an identity within one person's
library; carrying it across would either collide with something the recipient
has or quietly claim a name like `regular` that means a different day to them.
`parseScheduleCollection` mints a fresh one on import, which is what that
boundary is for.

**Decompression is treated as the boundary `AGENTS.md` says it is.** Two caps:
8192 characters of base64url, checked before anything is decoded, and 64 KiB of
JSON, checked WHILE the stream is being read. The second one is the interesting
one - `inflate` reads chunk by chunk and cancels rather than calling
`arrayBuffer()` and measuring afterwards, because measuring afterwards is a
check that runs after the damage.

That cap has a test, and the test had a bug worth recording: the first version
compressed twenty megabytes of zeroes, which came to 27,183 base64 characters -
refused by the LENGTH cap, so the test passed while proving nothing about the
decoded one. It now uses a mebibyte, lands at about 1,400 characters, and
asserts it is under the length cap so that mistake cannot come back.

**The fixture file is the point of the phase.** Five real payloads - the Regular
day, the Half day, a one-minute schedule, an empty one, and one carrying
accents, an em dash, CJK and an emoji - each with the schedule it must still
decode to, written out in full. Deriving the expectations from
`DEFAULT_SCHEDULES` was considered and rejected: an edit to the seed data would
then silently rewrite what these payloads are supposed to mean, and the suite
would stay green while the guarantee stopped being checked.

The decoder distinguishes an unknown version from a damaged link, because the
remedies differ: one is "update BellTab", the other is "ask for the link again".

Unit tests: 252 to 279. `npm run lint`, `npm run typecheck` and `npx vitest run`
pass.

### 2026-09-01 17:05 — Phase 5, part 2: the share UI and JSON backup

The half of Phase 5 that touches a page. `_lib/shareLink.ts` for the two ends of
the pipeline, `ShareOffer.tsx` for what a recipient sees, `BackupPanel.tsx` for
export and import, and a third settings tab to put it in.

**A link out.** Copy share link sits with Duplicate and Delete, because it acts
on the selected schedule. The URL is built from `location` at call time, so it
carries whatever origin and `basePath` the app is being served from — a
hard-coded host would break in development and keep working just well enough
that nobody noticed. Measured in a browser: **284 characters** for the
eleven-period seeded day, whole URL included.

The link is shown in a read-only input whether or not the clipboard took it. The
Clipboard API needs a secure context and can be refused by policy, so `copyText`
returns a boolean instead of throwing — the user's goal is the link, not the
clipboard.

**A link in.** An arriving schedule is OFFERED, never added. A link that wrote to
somebody's library on arrival would make every URL in a group chat a change to
their app; requiring a press is what keeps `AGENTS.md`'s "a malicious link
produces, at worst, a silly schedule" true. The name is rendered as text, and
`addSchedule` strips the id before minting a new one — so a hand-crafted link
claiming `regular` cannot take over the recipient's Monday-to-Friday, which is
its own unit test.

Either answer clears the fragment with `replaceState`: a refresh must not
re-offer a declined schedule, and the URL must stop carrying somebody else's
schedule into this browser's history.

**The bug the browser found.** The first version read `location.hash` on mount
only. Pasting a link into a tab already showing BellTab changes just the
fragment, which is a same-document navigation — nothing reloads, React never
remounts, and the app did nothing at all. It now listens for `hashchange` too,
and the comment that used to claim a listener was unnecessary was simply wrong.
No loop, because `replaceState` does not fire `hashchange`.

**A file both ways.** Export writes the same plain JSON `localStorage` holds,
dated from the device clock. Import replaces everything, so it goes through the
delete dialog — and it parses BEFORE it confirms, because asking "replace
everything?" and then discovering the file was unreadable is the wrong order to
find that out in.

That needed `parseLibrary`, which is `loadLibrary` with the opposite attitude to
failure: storage degrades silently because refusing to open is worse than
opening on the seeds, while a file the user chose must never be swallowed. One
parser, two callers, and a test that pins they still agree on what they refuse.

**Tests: 288 to 305 unit, and `e2e/share.spec.ts` adds ten.** The E2E covers a
link out and back in, adding, dismissing, the paste-into-an-open-tab case, a
damaged link, a link from a future version, and the export/import round trip
including a cancelled import and a file that is not a backup. It reads the link
from the read-only input rather than the system clipboard, because
`grantPermissions(["clipboard-write"])` is Chromium-only and the test should mean
the same thing on all three engines.

396 Playwright tests across three engines, 30 parked. `npm run lint`,
`npm run typecheck`, `npx vitest run`, `npx markdownlint-cli` and
`npm run build` all pass.

### 2026-09-02 11:41 — Phase 6, part 1: preferences, the theme and the bell offset

`feat/phase-6-preferences`. The half of Phase 6 with real invariants to respect,
split from the half — wake lock, chime, notification, PWA manifest — that is
permission-gated and mostly assertable only through its refused branches.

**A fourth settings panel, and its first job is to not be part of a schedule.**
The theme and the bell offset go in `belltab.prefs.v1`, beside `belltab.v1`
rather than inside it, and that split is the whole design rather than
housekeeping. A bell offset measures one building's bell controller against one
device's clock; carried in the library it would ride along in the JSON backup
and — silently — in every share link, so somebody who measured their bells at
twelve seconds fast would hand that skew to everyone they sent a timetable to.

**The offset shifts the clock reading, not the schedule.** `shiftNow` in
`clock.ts` adds the seconds to `secOfDay` and hands the result to
`viewForNow`, once, at the same seam where `stateAt` already converts minutes
to seconds. The obvious implementation — walk the periods and move every
`startMin`/`endMin` — is the one that leaks, for exactly the reason above. It
also would have needed the countdown, the title, the bar and the announcer to
agree about a mutation; applied to the reading, all four correct together
because all four are derived views of it.

Two things `shiftNow` deliberately does not do, both tested: it never touches
`isoDate` or `weekday` — those choose WHICH schedule runs, and a bell controller
being fast is not evidence about what day it is — and it clamps at 0 and 86399
rather than wrapping. Wrapping would pair tomorrow's second-of-day with today's
date, which is a reading no caller could interpret. Clamping freezes it for at
most five minutes at the ends of a day when no bell rings.

**The flash of the wrong theme is fixed, and the CSP is not.** `globals.css` has
carried `[data-theme]` since the retired build and needed nothing; what was
missing was anything to set it. `THEME_SCRIPT` runs inline as the first child of
`<body>`, before `<main>` is parsed, and a React effect keeps it in step
afterwards — including across tabs, which the store gives for free.

**That reverses the plan this session started with, and the reversal is
measured.** The intent was an inline script plus its sha256 in a real
`script-src`. Next emits two inline scripts of its own into every page — a
43-byte bootstrap and about 5 KB of flight data carrying the build's chunk
hashes — and `headers()` in `next.config.ts` is evaluated with no knowledge of
the rendered HTML, so neither can be hashed there. A hash-based `script-src`
would block the framework's own hydration. The supported fix is a per-request
nonce from middleware, and `AGENTS.md` bans `middleware.ts` over CVE-2025-29927.
So: inline, unhashed, CSP unchanged at `frame-ancestors 'none'`, and the gap
narrowed to say precisely that rather than closed.

An external file in `public/` was the other candidate and would at least have
been `'self'`-compatible for a future policy. It was rejected because it buys
nothing today and costs a fetch, and a fetch — even a cached one — is a window
in which the page can paint the wrong palette. Inline is the only version with
no window at all.

**`color-scheme` follows the theme now, in CSS.** The `<meta>` tag is written on
the server, which cannot know the user forced light while their OS is dark, so
it stays `light dark` and two `[data-theme]` rules narrow it. Without them a
forced-light page keeps dark scrollbars and dark number spinners, which is the
exact mismatch the meta tag exists to prevent.

**`libraryStore.ts` became a factory.** Phase 6 needed a second key, and the
choice was a second hand-written copy of that file or one parameterised copy.
`createLocalStore` won because the rules in it are subtle — a module-level memo
against the raw string, because `getSnapshot` must return a referentially stable
value or React re-renders forever, and a `storageWorks` latch, because
re-reading after `localStorage` throws silently reverts every edit the user
makes. Two copies is two places to get that subtly wrong. `useLibrary` and
`saveLibrary` keep their names, so nothing else in the app changed.

**Preferences degrade field by field, which the library deliberately does not.**
`loadLibrary` is all-or-nothing because a library is one interlocking thing —
half a calendar pointing at half a set of schedules is broken rather than
smaller. Preferences are independent scalars, so a theme name that no longer
exists must not take a measured offset down with it. Both rules have tests.

**The number field keeps a draft.** Binding a controlled input straight to the
stored integer makes it uneditable: clearing the box to retype produces `""`,
`Number("")` is `0`, and committing that wipes the offset the instant somebody
selects the field. So the string on screen is local and commits only when it
parses, an empty box is an edit rather than an error, and blur throws the draft
away so a refused value cannot sit in the box looking committed while the
countdown runs on something else.

**Found while wiring the panel:** the invalid-field rule at the bottom of
`globals.css` enumerates `.editor` and `.addoverride` by name, so a new panel's
`aria-invalid` control gets the attribute and no red border — the same failure
that shipped unnoticed through Phase 3 and Phase 4. `.offset` added to the
selector list in the same change. The comment above that rule now has a third
reason to be read before adding a form anywhere.

**One WebKit failure, pre-existing.** `e2e/editor.spec.ts`'s keyboard walk
cannot reach `#add-period` within 120 Tab presses on the development machine's
WebKit, because macOS leaves buttons out of the Tab order unless full keyboard
access is on. Verified against `main` by stashing this session's work and
re-running, so it is not this change; it passes on the Linux CI runner's build
and on Chrome and Firefox everywhere. Recorded as a third entry under "WebKit is
not one browser".

Unit tests: 305 to 340 — 29 for the preferences boundary and the theme script,
6 for `shiftNow`. Playwright: 426 to 486 across three engines, of which 471 run
and 15 are parked; `e2e/preferences.spec.ts` adds 18 per engine and the axe
sweep adds 2, and the parked preferences reflow block is live. Only Big mode is
still parked.

`npm run lint`, `npm run typecheck`, `npm run build`, `npx vitest run`,
`npx markdownlint-cli "**/*.md"` and `npx playwright test` all pass, with the
one macOS-WebKit exception above.

### 2026-09-02 12:37 — the review pass on Phase 6 part 1

A `high`-effort review of the branch before it had a commit on it, following the
convention Phase 4 set. Four defects, all four in the new form, all four fixed in
the same session — the details and the lessons are under **Bugs found**, and the
rows are in **Closed**.

Worth recording as a pattern rather than four incidents: **the newest form is
where the defects are, three phases running.** Phase 4's review found three, all
in the dated-exception form. This one found four, all in the preferences form,
and two of them were failures to apply a rule this codebase had already written
down at length — the live-region-must-pre-exist comment in `ScheduleEditor.tsx`,
and the "a comment describing behaviour is not evidence of it" lesson from the
`aria-invalid` border. Writing a new form is apparently not a state in which
past comments get read.

The a11y consequence is the one to carry forward: **the axe sweep passed on the
broken version.** A conditionally-mounted error node is valid markup; it is only
wrong across time, and a scan of one moment cannot see that. `e2e/a11y.spec.ts`
is a floor, and this is the second time this log has had to say so.

Three new E2E tests came out of the fixes rather than the features: the error
node exists and is silent before it speaks, the panel owns exactly one live
region while it is open (the counterpart to the invariants in
`announcer.spec.ts` and `editor.spec.ts`), and a two-page cross-tab test that
fails on the pre-fix code.

One fix is reasoned rather than measured and is carried as an open gap:
`inputMode="text"` rests on iOS preferring `inputmode` over the input's type,
which is documented and has not been checked on real hardware from this repo.

### 2026-09-02 12:59 — Phase 6, part 2a: Big mode

`feat/phase-6-big-mode`. The projector view, and the last parked test in the
repo.

**It is a mode, not a view.** `body.is-big` and a dozen rules that have shipped
in `globals.css` since the plain build was retired, doing nothing, now scale the
Now view up and take the authoring chrome away. There is one countdown in this
codebase and Big mode wears it — which is why `e2e/big-mode.spec.ts` asserts
SAMENESS: same ids, same digits, same tab title, same recompute-on-return
behaviour, and one bounding box bigger than the other. A second component
rendering the same numbers larger would pass a screenshot review and drift the
first time one of the two was fixed.

**One button in, one button out.** `.viewswitch` came from the retired build,
where it toggled Now against a Day view that no longer exists; a switcher whose
second state is "normal" is a control that mostly says nothing. So `#view-big`
is an action and the mode supplies its own way back — `#big-exit`, a quiet pill
at the bottom, plus Escape, which takes precedence over the settings Escape
because Big mode is the harder one to leave by pointing.

**Two inherited CSS decisions turned out to be wrong, and both were reversed
rather than ported.**

The first: the rule hid `.bounds`, on the stated grounds that the period strip
said the same thing better. The strip belonged to the plain build and has never
been rebuilt, so what actually shipped would have hidden the only line reading
"Next: Passing at 10:05" in favour of an element that is not on the page. Kept
and scaled instead.

The second is subtler and is the one worth remembering. `.is-big
.screen__schedule` was written when `.screen__schedule` WAS the schedule name.
In the current markup it is the `<h1>` reading "BellTab", and the schedule name
lives in `#schedule-name` — so the selector kept matching, kept hiding
something, and stopped meaning what its comment said. **A selector that still
matches after a rename is not a selector that still works.** The current
behaviour is the better one, so the comment was corrected to the code rather
than the other way round.

Both were found by looking at the rendered page rather than by reading the CSS,
which is the argument for having looked.

**Opening settings force-exits the mode**, because the "No school today" call to
action is a `.minibutton` — scaled by Big mode, not hidden by it — so a
projector showing an empty day has a live route into the editor. Without the
guard the settings panel renders inside a full-bleed projector layout.

**Focus follows the mode in both directions, and not on first paint.** The
effect runs once on mount with the mode off, and without a guard that would put
focus on the Big mode button before the user has touched anything. There is a
test for the guard as well as for the behaviour, because "does not steal focus"
is the kind of thing that only fails silently.

**No new live region, asserted.** Big mode is a class and some CSS; it must not
arrive with an announcement, and `e2e/big-mode.spec.ts` enumerates the page's
regions the way `announcer.spec.ts` and `editor.spec.ts` already do for their
own screens.

Playwright: 486 to 522 across three engines, **none parked** — the first time
that has been true in this project. `e2e/big-mode.spec.ts` adds 11 per engine,
the axe sweep adds 1, and the reflow gate's Big mode block is live at all five
widths. Unit tests are unchanged at 340; nothing in this slice is pure logic,
which is itself the reason it is a separate PR from the preferences half.

`npm run lint`, `npm run typecheck`, `npm run build`, `npx vitest run`,
`npx markdownlint-cli "**/*.md"` and `npx playwright test` all pass, with the
known macOS-WebKit exception in `editor.spec.ts`.

### 2026-09-02 13:10 — the documentation audit that found three holes

Prompted by a direct question — "everything documented?" — and answered by
checking the sections `AGENTS.md` requires rather than by saying yes. Three
things were missing, and all three were in the same blind spot: the parts of the
log that are not the session narrative.

**The plan never contained Big mode.** Recorded under **Deviations**, and
`Docs/belltab-plan.md` now names it. The lesson is in that entry and it is
about this repo's own conventions: "every parked block names the phase that
revives it" is half a rule, and the phase has to name the block back.

**The two wrong Big mode CSS rules had no Bugs found entry.** They were written
up under **Decisions** and in the session log, which is where the reasoning
goes — but `AGENTS.md` asks for the lesson under **Bugs found**, and the lesson
here (a selector that still matches after a rename is not a selector that still
works) is one this log has now learned in three forms: an `aria-invalid` border
that never painted, a JSDoc that claimed a case it did not handle, and two CSS
rules that hid the wrong things. Filed properly.

**Three Big mode open gaps were missing:** the projector still sleeps, the mode
does not survive a reload, and it does not request fullscreen. The first is the
one that matters, and it is the argument for doing the wake lock next.

The README also gained Big mode and the theme, and its bell-offset bullet now
says the correction stays on the device — which is the whole reason preferences
got their own storage key and was not stated anywhere a user would read it.

**Worth recording as a pattern:** the session log gets written while the work is
fresh, exactly as the rules ask, and the *tables* get written from whatever the
narrative happened to mention. Decisions and Bugs found both got entries this
session; Deviations did not, and Deviations is the one that needed a change to
another document. Checking the four required sections one at a time is a
different act from writing up the session, and this is the second time this
month it has turned up something.

### 2026-09-02 14:45 — the Screen Wake Lock (Phase 6 part 2b, first slice)

The gap the last session opened, closed in the next one: a projector in Big mode
went to sleep, and now it does not have to.

**One hook, one lock, mounted in `App.tsx`.** `useWakeLock(enabled)` sits beside
the clock and the theme for the same reason both of those do — it has to outlive
whichever screen is up. Owning the lock inside the preferences panel would have
released it the moment the user pressed Back to watch the countdown, which is the
only moment it was ever wanted. The status travels back down to the panel as a
prop, so there is one lock and one account of what it is doing.

**The browser behaviour that shaped all of it:** the lock is taken back by the
user agent whenever the document stops being visible, and a request made from a
hidden document is rejected rather than queued. So holding a lock is not
something done once — it is done again on every `visibilitychange` back to
visible, for as long as the preference is on. That is the countdown's own lesson
in a second domain: nothing here may be treated as state that stays true while
the tab is away.

The guard that follows from it is small and load-bearing. `acquire()` returns
early unless `document.visibilityState === "visible"`, because asking anyway
would report `refused` — the one status that means something is wrong — every
time the user switched app. There is a test for exactly that: two
`visibilitychange` events while still hidden must produce one request, not three.

**Five statuses, not a boolean**, and the Decisions table has the argument. The
short version is that "the toggle is on" and "the screen is actually being kept
awake" are different facts, and a boolean has to be silent about one of them.

**The readout is not a live region, and that took some deciding.** Its text flips
between "held" and "waiting" every time the tab is hidden and shown, which is
normal and frequent — a live region there would be precisely the per-tick chatter
`AGENTS.md` bans on the countdown. But a refusal is silent otherwise: the box
stays ticked, the screen dims anyway, and nothing tells somebody who cannot see
the readout. So the refusal gets its own always-rendered, always-hidden polite
region carrying text only when `status === "refused"` — the same shape
`ScheduleEditor.tsx` and the bell offset both use, for the same reason. The
enumeration test in `preferences.spec.ts` went from one region to two and caught
the new one on the first run, which is what it is for.

**The API is stubbed in the E2E suite**, at the boundary and nowhere else.
Whether a real lock is granted depends on the OS, the battery and whether the
runner has a screen, so asserting against the real thing would have produced a
suite that passes here and fails in CI. What the stub buys is the three branches
no browser in the matrix produces on demand — an absent API, a refusal, and the
tab leaving and coming back — and those are exactly the branches this repo
carries an open gap about for the clipboard. What it does not buy is evidence
that a real projector stays lit, which is now its own open gap.

**Big mode deliberately does not turn it on.** The last session's gap entry
guessed that "acquiring the lock on entering the mode is the obvious default to
argue about", and the argument came out the other way: a demand on somebody's
power management that they never made, with no control anywhere saying why the
laptop stopped sleeping, is worse than one tick in Preferences that persists
forever. Recorded in Decisions, and the missing signpost between the two features
is recorded as a gap.

**One test bug, in the test.** Written up under **Bugs found** — `addInitScript`
re-runs on every navigation, so the `preferences: null` fixture wiped the value
during the reload the test was using to prove it persisted.

**Tests:** unit 340 → 353. Thirteen new: five on the preferences boundary now
that it carries a third field (including that a wake lock stored as a string or a
number degrades to *off* rather than to the truthy reading of it — an unreadable
value is not consent to hold a lock on somebody's laptop), and eight on
`describeWakeLock`, which pin that every status says something, that no two of
them share a sentence, that the two meaning "something is wrong" name a cause the
user could go and change, and that the ordinary hidden tab is not worded as a
failure.

Playwright 522 → 552 across three engines: ten new per engine in
`e2e/wake-lock.spec.ts`, plus the two existing preferences tests that had pinned
the serialised preferences string byte for byte and now pin the third field too.

`npm run lint`, `npm run typecheck`, `npx vitest run`,
`npx markdownlint-cli "**/*.md"` and `npx playwright test` all pass, with the
known macOS-WebKit exception in `editor.spec.ts`.

**Still owed in Phase 6 part 2b:** the opt-in chime and notification, and the PWA
manifest.

### 2026-09-02 15:55 — the chime and the notification (Phase 6 part 2b, second slice)

The two ways a bell reaches somebody who is not looking at the page, built on
the one piece of boundary machinery the app already had.

**One definition of "the bell".** `useBells` keys on `boundaryKey` and speaks
`announcementFor` — the exact pair `PeriodAnnouncer` has used since Phase 2 — so
the chime, the notification and the screen-reader announcement cannot disagree
about what counts as a period change. A boundary the announcer would say nothing
about (first paint, midnight rolling into "before") rings nothing. The
notification's text IS the announcement: "Passing has started.", tagged so each
toast replaces the last instead of piling up.

**Both are foreground features, and the panel says so in the user's language:**
a tab in the background can ring up to a minute late, and a closed tab never
rings. That sentence is the research doc's conclusion — Notification Triggers is
dead, there is no Web Alarms API, a service worker will not self-wake without a
push server — folded into a hint instead of promised away.

**The chime is synthesised** — two sine partials, exponential decay, ~1.2
seconds, on the page's one `AudioContext` — so nothing is fetched, shipped or
licensed. The autoplay policy shapes the plumbing: a context created without a
gesture starts suspended, so ticking the box (a gesture) unlocks in the change
handler, a Test button unlocks-then-rings in the right async order, and a
restored preference arms a first-touch-anywhere listener so yesterday's setup
works this morning without finding the panel again.

**The notification asks on tick and stores only a grant.** A stored `true`
therefore means "granted once", and the status logic leans on that: `unasked`
is only reachable by the site settings resetting a permission behind a saved
preference. `blocked` outranks `off` — a denied permission cannot even raise
the prompt again, so the box is disabled and the sentence points at the
browser's site settings, the only lever left. Suppressed while the tab is
visible: a toast about the screen you are watching is noise.

**A slept-through stretch rings once.** Jumping the clock across two bells
produces one chime, for the state being woken into — the recompute rule made
audible. Replaying missed bells would be deriving events from elapsed time,
which is the decrement mistake this repo exists to refuse.

**Two test-design lessons, one recorded under Bugs found:** the chime's
`locked` state cannot be inspected by any test that interacts its way to the
inspection point, because the observation is the unlocking gesture; and
Playwright's `check()` fails on a box that deliberately refuses to tick until a
permission resolves — the deny path needs `click()`.

**Tests:** unit 353 → 377. The preferences boundary's boolean tests were
generalised to `it.each` over the three boolean fields — this file broke on
both of the last two fields added, each time on assertions that were not about
the new field, so the full-object assertions now spread `DEFAULT_PREFERENCES`.
Fourteen of the new tests are `bells.test.ts`, pinning the wording: every
status a full sentence, no two alike, the blocked one pointing at site
settings, the ready one carrying "in the background".

Playwright 552 → 588: twelve new per engine in `e2e/bells.spec.ts`, all driven
through real clock boundaries against stubbed `AudioContext` and `Notification`
(the wake lock's stub-at-the-boundary argument, inherited). The default case
asserts more than silence: no context is constructed and no permission asked —
a user who wants none of this carries none of it. The live-region enumeration
went two → three and caught `notify-alert` on its first run.

`npm run lint`, `npm run typecheck`, `npm run build`, `npx vitest run`,
`npx markdownlint-cli "**/*.md"` and `npx playwright test` all pass, with the
known macOS-WebKit exception in `editor.spec.ts`.

**Still owed in Phase 6:** the PWA manifest, which is also where the Android
notification gap (page-created notifications throw there; a service worker's
`showNotification` is the fix) naturally reopens.

### 2026-09-02 16:12 — the manifest, and with it the end of Phase 6

The last item in the comfort phase, and the smallest: BellTab is installable.

**A manifest and deliberately nothing else.** The decision that shaped the
slice is the service worker that is NOT in it, and the Decisions table has the
argument in full. The short version: installation stopped requiring one when
Chrome dropped its offline-capability check, offline caching is a stated
non-goal for an app with no server to be offline from, and a SW's update
lifecycle is a well-known way to serve stale HTML after a deploy. The one real
thing a SW would buy — Android notifications, where page-created ones throw —
keeps its open-gap row with the price now written on it.

**One glyph, five renders.** `src/app/icon.svg` is a butterscotch bell with the
design system's chunky ink outline, and it is the only drawing in the repo.
`scripts/render-icons.mjs` screenshots it at five sizes through the Playwright
already in devDependencies — 192 and 512 plain, 192 and 512 maskable (bell at
56%, inside the launcher-crop safe zone), and the 180px `apple-icon.png` that
Next's file convention turns into the `apple-touch-icon` link. The PNGs are
committed rather than built; a build step that needs a browser binary to
regenerate identical bytes would tax every CI run for a file that changes
roughly never.

**The `/bell` prefix is spelled out by hand in every manifest URL.** `basePath`
scopes where the manifest FILE is served and rewrites nothing inside it. The
spec would resolve relative URLs against the manifest's own location, but an
explicit prefix is one less subtlety to be wrong about — and a wrong one here
fails only at install time, silently, which is why `e2e/pwa.spec.ts` fetches
every URL the manifest names and asserts each serves at the type it claims.

**The colours are pinned to the page.** The suite reads the computed `--paper`
token off the real page and asserts `background_color` and `theme_color` match,
so a palette change cannot leave the splash screen behind. One colour, the
light paper: the manifest takes a single value, and a dark-mode install
therefore gets a cream splash for one moment — recorded as an open gap with the
web-platform limitation named.

**Verified against a real server before the tests were written:** the manifest
serves at `/bell/manifest.webmanifest`, Next emits the manifest link, the SVG
favicon link and the apple-touch-icon link on its own, and all six image URLs
return 200 at the right content type.

**Tests:** unit unchanged at 377 — nothing in this slice is pure logic.
Playwright 588 → 600: four new per engine in `e2e/pwa.spec.ts`, asserting the
contract a browser's install machinery reads. What no test claims is that the
install prompt appears or what the installed window looks like — browser UI,
out of reach, in Open gaps beside the projector and the chime.

`npm run lint`, `npm run typecheck`, `npm run build`, `npx vitest run`,
`npx markdownlint-cli "**/*.md"` and `npx playwright test` all pass, with the
known macOS-WebKit exception in `editor.spec.ts`.

**Phase 6 is complete.** Theme, bell offset, Big mode, wake lock, chime,
notification, manifest — the comfort phase closed in four PRs across two days.
What remains is Phase 7: the cutover to `biscuitlab.net/bell`.
