# BellTab — Roadmap

The build plan for `biscuitlab.net/bell`, sliced into phases with gates. This is
the living tracker; the authoritative scope is `Docs/belltab-plan.md`, and the
evidence behind the technical decisions is
`Docs/research/background-timers-and-schedule-modeling.md`.

**Status legend:** ✅ Done · 🚧 In progress · 📋 Planned · ⛔ Blocked (prereq)
**Tracks:** 🏗️ Setup · ⚙️ Engine · 🎨 UI · 🔀 Infra · 🔗 Integration

**Status (2026-08-26):** a working plain HTML/CSS/JS build exists on `main`,
deliberately ahead of Phase 0 — see `Docs/build-log.md` for the running
narrative and the reasoning behind each decision. Shipped so far: the countdown
and period strip, the day list, big/projector mode, a schedule editor with
validation, a calendar, and preferences. The schedule engine is pure and covered
by 120 Vitest tests.

The repo is at `github.com/zfert99/belltab`, with `main` protected by GitHub
Flow (one PR per change, squash-merged).

**The phase table below still describes the Next.js track**, which is the
destination rather than the current state: Phase 0's scaffold, CI, and a11y
gate are genuinely not started, and Phases 1–4 exist only in their plain-JS
form. Reconciling the two is owed once the port begins.

## At a glance

| Phase | What | Track | Status |
| :---: | --- | :---: | :---: |
| **D** | Docs & planning — plan, agent rules, design system, research | 🏗️ | ✅ Done |
| **0** | Scaffold — Next.js, `basePath`, CI, test harness, a11y gate | 🏗️ | 📋 Planned |
| **1** | The schedule engine — pure, typed, fully tested | ⚙️ | 📋 Planned |
| **2** | The countdown — one clock, the display, the tab title | 🎨 | 📋 Planned |
| **3** | The editor — build and edit a schedule, overlap blocking | 🎨 | 📋 Planned |
| **4** | Day types — named schedules, weekday map, date overrides | 🎨 | 📋 Planned |
| **5** | Sharing — versioned hash encoding, export/import | ⚙️ | 📋 Planned |
| **6** | Comfort — bell offset, wake lock, chime, PWA, theme | 🎨 | 📋 Planned |
| **7** | Cutover — hub rewrite, origin host, project card, sitemap | 🔀 | 📋 Planned |

---

## Phase 0 — Scaffold 🏗️

Next.js App Router + TypeScript + Tailwind, `src/` from the first commit.

- `basePath: '/bell'` in `next.config.ts` (local dev becomes
  `localhost:3000/bell` — expect this to be briefly confusing).
- Baseline security headers via `headers()`.
- ESLint with `eslint-plugin-jsx-a11y` at `recommended`, blocking.
- Vitest (global environment `node`) and Playwright.
- The reflow gate: `scrollWidth <= clientWidth + 1` at 320 / 375 / 768 / 1024 /
  1440.
- GitHub Actions running lint, typecheck, unit, and E2E. Dependabot, CodeQL.
- Branch protection: status checks + linear history, approvals off.

**Gate:** CI green on an empty page. `npm run lint`, `npm run typecheck`,
`npx vitest run`, `npx markdownlint-cli "**/*.md"` all pass.

## Phase 1 — The schedule engine ⚙️

Pure functions in `src/lib/`. No React, no `Date.now()` — the current time is
always an argument.

- `Period` and `Schedule` types; times as minutes-since-midnight integers.
- The boundary parser: untrusted input → branded `ValidSchedule` or a structured
  error. Sorted, non-overlapping, `startMin < endMin`; gaps permitted.
- `stateAt(schedule, minute)` → current period, remaining, next period, progress
  fraction, and which empty state applies.
- Unit tests at every boundary: exact start minute, exact end minute, back-to-back
  periods with zero gap, the minute before the first bell, the minute after the
  last, an empty schedule, a one-period schedule, midnight rollover.

**Gate:** the engine is fully tested with no UI and no fake timers.

## Phase 2 — The countdown 🎨

The first genuinely useful build. Schedule is hard-coded.

- One clock, one subscriber; recompute from `Date.now()` on every tick and force
  a recompute on `visibilitychange` and `focus`.
- The countdown display, progress bar, and "next up" line.
- `document.title` at **minute** resolution, number first: `43m · Period 2`.
- All five empty states from the design system.
- Client-only rendering of every time-dependent value — a stable placeholder,
  then fill after mount, so nothing hydrate-mismatches.

**Gate:** open it in a real browser, background the tab for ten minutes, come
back, and the number is right. Verify in Safari specifically — its throttling
thresholds are the thinnest evidence in the research.

## Phase 3 — The editor 🎨

- Add, rename, retime, reorder, and delete periods.
- Overlap blocking at input time, naming the colliding period.
- Field-level errors bound with `aria-describedby`; keyboard-operable reordering.
- Persist to `localStorage`; a corrupt or missing value degrades to the empty
  state.

**Gate:** a schedule can be built from scratch with the keyboard alone, and no
input sequence can produce an invalid schedule.

## Phase 4 — Day types 🎨

- Multiple named schedules; duplicate-and-tweak as the primary authoring move.
- The weekday default map.
- Explicit date overrides, shown as a small editable list.
- A "use this schedule today" control.
- The resolver, in priority order, with room reserved for a future cycle layer.

**Gate:** a late-start Wednesday and a one-off assembly both resolve correctly,
and the weekend shows the no-schedule state.

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

- **Repo name and remote.** The folder is `belltab`; the repo has no remote yet.
- **Does the hub's project index need a card before Phase 7**, or does BellTab
  stay unlisted until cutover?
- **Is `/bell` final**, or does it become `/belltab` to match the repo name?
