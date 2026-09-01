# BellTab — Roadmap

The build plan for `biscuitlab.net/bell`, sliced into phases with gates. This is
the living tracker; the authoritative scope is `Docs/belltab-plan.md`, and the
evidence behind the technical decisions is
`Docs/research/background-timers-and-schedule-modeling.md`.

**Status legend:** ✅ Done · 🚧 In progress · 📋 Planned · ⛔ Blocked (prereq)
**Tracks:** 🏗️ Setup · ⚙️ Engine · 🎨 UI · 🔀 Infra · 🔗 Integration

**Status (2026-09-01, after Phase 4):** the app is now the user's end to end.
One clock drives the digits, the progress bar, the tab title and the boundary
announcer, all recomputed from `Date.now()`. The editor adds, renames, retimes,
reorders and deletes periods, blocks overlap at input time, and persists to
`localStorage`. The library holds as many named schedules as you like — created,
duplicated and deleted — and the calendar panel points days at them: a weekday
default map, dated exceptions that beat it, and a control that repoints today
alone. Nothing on screen is seed data any more; the seeds are just what a fresh
install starts with.

What is left is sharing (Phase 5), comfort features (Phase 6) and the cutover
(Phase 7). None of those changes what the app *is*.

> **Superseded 2026-09-01.** The paragraph below described `main` after Phase 3
> and is kept because the Phase 4 plan was written against it.
>
> The countdown is live and the schedule is the user's. What is still seeded is
> the *set* of schedules and the calendar pointing at them, which is Phase 4.

An older note, kept for the same reason:

> **Superseded 2026-08-27 13:50.** The paragraph below described `main` between
> Phase 1 and Phase 2 and is kept because the Phase 2 plan was written against
> it.
>
> The plain HTML/CSS/JS build that ran ahead of the roadmap is **retired**.
> Phase 1 ported its engine to TypeScript, which a browser cannot load directly,
> so the app it powered went with it. What is on `main` is the Next.js scaffold
> plus a fully typed, fully tested `src/lib/` — and a page that renders no time
> yet. The UI is rebuilt on the engine phase by phase from here, starting with
> the countdown.

**Testing:** 252 Vitest tests over the pure engine, the parser, the formatters,
the clock reader, the day resolver, the editor's draft model, the storage
boundary and the six library mutators, plus **396 Playwright tests across three
engines** — Chrome, WebKit and Firefox — of which 366 run and 30 are parked.

The reflow gate that Phase 0 calls for runs the four Now-view states, the
editor, the calendar panel and the confirm dialog at 320/375/768/1024/1440, with
a 60-character unbroken name typed into a period, the schedule name, a picker
chip, a `<select>` option and an exception row. `e2e/a11y.spec.ts` adds an
`@axe-core/playwright` sweep over ten journeys, including both error states and
the open modal, failing on any critical or serious violation.

Every parked block names the phase that revives it; the Day view's, which named
none, was deleted on 2026-09-01 rather than left. See **Open gaps** in
`Docs/build-log.md`.

The repo is at `github.com/zfert99/belltab`, with `main` protected by GitHub
Flow (one PR per change, squash-merged).

**The phase table below and the code now describe the same track.** The
plain-JS detour is over; Phases 2–4 rebuild in React what the retired build
already proved out, against an engine that no longer has to be re-derived.

**Phase 0 update (2026-08-26 15:47, `feat/phase-0-scaffold`):** the phase splits
cleanly into a Next.js scaffold and the gates that scaffold would be checked by,
and the gates landed first, against the plain-JS build. GitHub Actions now runs
ESLint, markdownlint, Vitest, Playwright and `npm audit` on every push and pull
request; CodeQL and Dependabot are configured; the baseline security headers
ship in `vercel.json` rather than `next.config.ts`, since the app is static
files and the headers belong to the deploy rather than to the framework.

**Phase 0 complete (2026-08-26 17:05, `feat/next-scaffold`):** the scaffold
half landed too. Next.js 16.3.3, React 19.2.8, TypeScript 6.0.3 and an empty
page at `/bell`; the security headers moved out of `vercel.json` into
`next.config.ts` `headers()`; `eslint-plugin-jsx-a11y` runs at full
`recommended`; and `npm run typecheck` exists. CI is six jobs.

Two version pins are deliberate and go against "latest": **TypeScript 6, not 7**
(`typescript-eslint` throws on 7, taking the whole Next lint config down with
it) and **ESLint 9, not 10** (`jsx-a11y` supports no ESLint above 9). Both trade
a newer major for a lint gate `AGENTS.md` calls blocking. See the Decisions
table in `Docs/build-log.md`.

The plain HTML/CSS/JS build is **untouched** and still passes its 153 unit and
37 E2E tests. Phases 1–4 replace it module by module; Phase 1 is the one that
retires it, since a browser cannot load a `.ts` module directly.

> **Superseded 2026-08-27.** Phase 1 did exactly that. The paragraph above
> describes the state on 2026-08-26 and is kept because it is what the Phase 0
> decision was made against; the current state is the Status block at the top.

## At a glance

| Phase | What | Track | Status |
| :---: | --- | :---: | :---: |
| **D** | Docs & planning — plan, agent rules, design system, research | 🏗️ | ✅ Done |
| **0** | Scaffold — Next.js, `basePath`, CI, test harness, a11y gate | 🏗️ | ✅ Done |
| **1** | The schedule engine — pure, typed, fully tested | ⚙️ | ✅ Done |
| **2** | The countdown — one clock, the display, the tab title | 🎨 | ✅ Done |
| **3** | The editor — build and edit a schedule, overlap blocking | 🎨 | ✅ Done |
| **4** | Day types — the **editing UI** for schedules and the calendar | 🎨 | ✅ Done |
| **5** | Sharing — versioned hash encoding, export/import | ⚙️ | 🚧 Next |
| **6** | Comfort — bell offset, wake lock, chime, PWA, theme | 🎨 | 📋 Planned |
| **7** | Cutover — hub rewrite, origin host, project card, sitemap | 🔀 | 📋 Planned |

---

## Phase 0 — Scaffold 🏗️

Next.js App Router + TypeScript + Tailwind, `src/` from the first commit.

Done, against the plain-JS build:

- ✅ Vitest (global environment `node`) and Playwright.
- ✅ The reflow gate: `scrollWidth <= clientWidth + 1` at 320 / 375 / 768 /
  1024 / 1440.
- ✅ ESLint, blocking — flat config, four global scopes. Without `jsx-a11y`;
  see below.
- ✅ GitHub Actions running lint, markdownlint, unit and E2E, plus `npm audit`.
  Dependabot and CodeQL configured.
- ✅ GitHub Actions, now six jobs — Lint, Typecheck, Next build, Unit tests,
  E2E (reflow gate), npm audit. Dependabot and CodeQL configured.
- ✅ Branch protection — required status checks, linear history, approvals off,
  force pushes and deletions off. Admin enforcement is deliberately off; the
  exact settings are recorded in `Docs/build-log.md`.
- ✅ Next.js 16.3.3 + React 19.2.8 + TypeScript 6.0.3, `src/` App Router, one
  empty page.
- ✅ `basePath: '/bell'` in `next.config.ts`. Verified against a running server:
  `/bell` serves, `/` 404s, assets land at `/bell/_next/static/*`. No
  `assetPrefix` — the Next docs recommend against it for sub-path hosting.
  Local dev is `localhost:3000/bell`, which is briefly confusing exactly as
  predicted.
- ✅ Baseline security headers, in `next.config.ts` `headers()`. `vercel.json`
  is deleted; it only existed because there was no framework to hang them on.
  **Two `source` entries, not one** — with `basePath`, `/(.*)` never matches
  the bare `/bell`, and the first version shipped headers to the assets and not
  the page. See Bugs found.
- ✅ `eslint-plugin-jsx-a11y` at full `recommended`, blocking. Note that
  `eslint-config-next` enables only 6 of its 32 rules, so the rest are spread
  explicitly.
- ✅ `npm run typecheck` — `tsc --noEmit`, with `strict: true`.

**Gate: met.** `npm run lint`, `npm run typecheck`, `npm run build`,
`npx vitest run`, `npx playwright test` and `npx markdownlint-cli "**/*.md"` all
pass, in CI and locally.

Carried forward as open gaps rather than done: TypeScript is a major behind on
purpose, `Typecheck` and `Next build` are not yet required checks in branch
protection, and the headers remain unverified on a real Vercel deploy until
Phase 7.

## Phase 1 — The schedule engine ⚙️

Pure functions in `src/lib/`. No React, no `Date.now()` — the current time is
always an argument.

- ✅ `Period` and `Schedule` types; times as minutes-since-midnight integers.
- ✅ The boundary parser: untrusted input → branded `ValidSchedule` or a
  structured error. Sorted, non-overlapping, `startMin < endMin`; gaps
  permitted. The brand's symbol is unexported, so `parseSchedule` is the only
  thing that can mint one.
- ✅ `stateAt(schedule, nowSec)` → current period, remaining, next period,
  progress fraction, and which empty state applies. Returned as a discriminated
  union keyed on `phase`, so a `during` with no current period is
  unrepresentable rather than merely unlikely.

  **Corrected from `stateAt(schedule, minute)`:** the argument is *seconds*
  since local midnight. Storage stays minute integers — that invariant is
  untouched — but the countdown displays a seconds place, which a
  minute-resolution engine cannot produce. The multiply happens once, at the
  engine's front door.
- ✅ Unit tests at every boundary: exact start minute, exact end minute,
  back-to-back periods with zero gap, the minute before the first bell, the
  minute after the last, an empty schedule, a one-period schedule, midnight
  rollover. 118 in total, with fixtures built through the real parser rather
  than cast into place.
- ✅ The plain HTML/CSS/JS build retired, its stylesheet carried into
  `src/app/globals.css`, and its E2E suite repointed at the Next app — 11 live,
  37 parked against the phases that revive them.

**Gate: met.** The engine is fully tested with no UI and no fake timers, and
`npm run lint`, `npm run typecheck`, `npm run build`, `npx vitest run`,
`npx playwright test` and `npx markdownlint-cli "**/*.md"` all pass.

Carried forward as open gaps rather than done: `src/lib/` has no consumer until
Phase 2, most of `globals.css` targets markup that does not exist yet, and the
E2E suite is 11 live tests where it was 37.

## Phase 2 — The countdown 🎨

The first genuinely useful build. Schedule is hard-coded.

- ✅ One clock, one subscriber — `src/app/_lib/useNow.ts`, the only
  `setInterval` in the repo. Recomputes from `new Date()` on every tick and on
  `visibilitychange` and `focus`. Nothing holds a remaining-time number.
- ✅ The countdown display, progress bar, period bounds and "next up" line, on
  the CSS carried over from the retired build — most of which had never been
  rendered before this phase.
- ✅ The tab title at **minute** resolution, number first: `35m · Period 2`.
  Rendered as a `<title>` rather than assigned to `document.title`, which the
  App Router's metadata pass overwrites a frame later. See **Bugs found**.
- ✅ All five empty states, reachable from the seeded calendar alone. Two of
  them read the weekday map, which is a phase early — see **Deviations**.
- ✅ Client-only rendering of every time-dependent value. `useNow` returns
  `null` until mount and the components render a stable placeholder for it.
- ✅ The period announcer, keyed on the period's times so a rename cannot
  trigger it. Four of its parked E2E tests are live again.

**Gate: met in Chrome, WebKit and Firefox; not on a real Safari.**
`e2e/countdown.spec.ts` moves the clock without firing a timer, asserts the
display is stale, and asserts that `visibilitychange` or `focus` alone corrects
it — across ten minutes, across two period boundaries, and across Friday night
into Saturday. Since 2026-09-01 it runs on all three engines.

What that still does *not* cover is a real Safari tab on a real device,
backgrounded for real minutes: its throttling thresholds are the thinnest
evidence in the research, and Playwright's WebKit is demonstrably not Safari —
it implements neither `<input type="time">` nor `type="date"`, which real Safari
has shipped since 14.1. Carried
forward as an open gap.

Carried forward as open gaps rather than done: Safari, the two empty states that
want a link into an editor that does not exist yet, the unreachable
`no-schedules` screen, and the design system's 150ms period-change crossfade.

## Phase 3 — The editor 🎨

- ✅ Add, rename, retime, reorder and delete periods. The fourth field is a
  **length**, not an end time — which is how a schedule is described, and which
  makes `start >= end` unreachable by typing.
- ✅ Overlap blocking at input time, naming the colliding period:
  *"Period 2 overlaps Period 1. Two periods cannot run at the same time."*
- ✅ Field-level errors bound with `aria-describedby` and marked `aria-invalid`.
  One live region, `#schedule-error`, for the one error with no control to
  point at.
- ✅ Keyboard-operable reordering — two buttons that move the **times**, since
  periods are stored sorted and a list reorder would be undone by the next
  parse. See **Deviations**.
- ✅ Persist to `localStorage` through `useSyncExternalStore`, which makes
  hydration safe by construction and syncs across tabs. Every failure path —
  absent, unparseable, wrong shape, a schedule that no longer validates —
  degrades to the seeded library.

**Gate: met.** `e2e/editor.spec.ts` builds with the keyboard alone — no
`click()` anywhere in that block — and the invalid half is argued structurally:
every mutation runs the draft through `parseSchedule` and commits only on `ok`,
so there is no path from the editor to the store that skips the parser. The E2E
suite proves the wiring: a half-typed overlap reaches the screen as a message
and not as a saved schedule, and the countdown behind it keeps running on the
last version that made sense.

Carried forward as open gaps rather than done: Safari (still), no automated axe
scan, no undo, a seventy-two-stop tab chain through the form, untested cross-tab
sync, and an onboarding empty state that is still a dead end until Phase 4 can
create a schedule from nothing.

## Phase 4 — Day types 🎨

Phase 2 already **reads** the weekday map and the date overrides, because the
"no schedule today" empty state cannot exist without them, and Phase 3 persists
them. What this phase adds is the UI that edits them, and multiple schedules to
point at.

It is also where the parked `confirm-dialog.spec.ts` comes back: deleting a
whole named schedule is the first genuinely destructive action in the app, and
that suite is the contract its dialog has to meet. Phase 3 ships no confirmation
because deleting a period is four fields with the result visible immediately
behind the editor.

- ✅ Multiple named schedules; duplicate-and-tweak as the primary authoring
  move. Every schedule in the library carries a unique id, minted at the parse
  boundary — the calendar points at schedules by id, so one without an id is a
  schedule no day could ever run. Duplicate hands the boundary the source's own
  id and lets the two-pass minting renumber the copy, so one place in the
  codebase decides what an id is.
- ✅ The weekday default map, editable. Seven selects, `auto-fit` so 320px gets
  however many fit rather than seven 30px columns.
- ✅ Explicit date overrides, as a small editable list. Adding a date that
  already has one REPLACES it, so the resolver never has two entries for one day
  to arbitrate between.
- ✅ A "use this schedule today" control, which writes a dated override and
  never a weekday default — a make-up day is one Saturday, not every Saturday.
  It sits under a line saying what today currently resolves to.
- ✅ The resolver, in priority order, and the panel is laid out in that order so
  the priority is legible rather than documented. Room is reserved for a cycle
  layer: a rotating day type would be a third section between the two, beating
  the weekday and losing to an override, and nothing built here forecloses it.
- ✅ The delete confirmation, and its six parked E2E tests, live again. A native
  `<dialog>` with `showModal()`, feature-detected with `window.confirm` behind
  it, and `App.tsx`'s Escape handler now bails while a modal is open — the
  guard Phase 3 left a comment about.
- ✅ Both dead-end empty states link into the editor.

**Gate: met.** `e2e/calendar.spec.ts` drives a late-start Wednesday through the
weekday map (which turns 09:30 from "inside Period 2" into "school starts in",
a different *kind* of answer), a one-off assembly that beats the weekday under
it, a dated closure that shuts a school day, and the weekend — including the way
out of it. Deleting a schedule takes the days pointing at it with it: weekdays
degrade to "no school", overrides are dropped rather than becoming snow days.

A `high`-effort code review of the finished tree found three defects, all in
the dated-exception form and all fixed in the same session:
`setOverride` discarded the entry being added once the calendar hit its
400-override cap, the date input's value reached the mutator unparsed, and the
inactive tab's `aria-controls` named an id that was not in the DOM. See
`Docs/code-review-2026-09-01.md`.

Carried forward as open gaps rather than done: Safari (still), no automated axe
scan, no month view for dated exceptions and no weekday name beside them,
nothing prunes exceptions that are in the past, the chip picker has no
arrow-key path, and the confirmation does not say when the schedule being
deleted is the one running today.

## Phase 5 — Sharing ⚙️

- `JSON.stringify` → `CompressionStream('deflate-raw')` → base64url → hash.
- Version prefix from the first encoded link; a version dispatch table at parse
  time.
- Size and period-count caps before parsing, so a hostile link cannot wedge the
  tab.
- Share-link UI and JSON export/import.
- The round-trip fixture suite: every historical payload in the fixture file must
  still parse, forever. Entries are added, never removed.

**Gate:** a link survives a round trip through a messaging app and still decodes.

## Phase 6 — Comfort 🎨

- **Bell offset** — nudge every time by ±N seconds to match the real bell.
- **Screen Wake Lock** behind an explicit toggle, feature-detected, re-acquired
  on `visibilitychange` (the lock auto-releases when the tab hides).
- **Opt-in foreground chime and notification**, with copy that says plainly that
  they work only while the tab is open. Audio needs a prior user gesture.
- PWA manifest and installability. Dark mode.

**Gate:** nothing in this phase promises background behaviour the web cannot
deliver.

## Phase 7 — Cutover 🔀

**This repo:** its own Vercel project, Deployment Protection on, a dedicated
custom origin host (e.g. `origin-bell.biscuitlab.net`) so the hub's proxy can
reach it while the `*.vercel.app` alias stays locked.

**Hub repo (`Biscuit-Website`):** add `BELL_ORIGIN`, add both rewrites (bare
`/bell` and `/bell/:path*` — the bare path does not always match `:path*`),
redeploy the hub (rewrites are read at build time), add the project card, and
add BellTab to the sitemap index.

No rpID/passkey complication here — BellTab has no auth — so this is the easy
version of what `Biscuit-Website/Docs/multi-zone-migration-runbook.md` describes.

**Gate:** `biscuitlab.net/bell` serves with assets intact and the origin host
still locked to direct traffic.

---

## Deferred — decided, not forgotten

| Item | Why it's deferred | What would change the call |
| --- | --- | --- |
| Web Worker for background seconds | Minutes are the requirement; workers don't help a frozen mobile tab | Wanting live seconds in a buried desktop tab |
| Rotating cycle day types (A/B, 6-day) | As much work as the rest of the app; needs skip-dates and a manual bump | Actually using a rotating schedule |
| Dynamic favicon progress ring | Cheap polish, not load-bearing | Boredom |
| Badging API | Installed-PWA only, unsupported on Chrome Android | Broader support |
| Clock-skew correction | Requires a server, which is a stated non-goal | Evidence that device clocks are wrong often enough to matter |
| Temporal (`PlainTime`) | Not stable in Safari; a 20–44KB polyfill for a subtraction | Safari shipping it |

## Open questions

- ~~**Repo name and remote.**~~ Resolved: `github.com/zfert99/belltab`.
- **Does the hub's project index need a card before Phase 7**, or does BellTab
  stay unlisted until cutover?
- **Is `/bell` final**, or does it become `/belltab` to match the repo name?
