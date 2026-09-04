# BellTab — Roadmap

The build plan for `biscuitlab.net/bell`, sliced into phases with gates. This is
the living tracker; the authoritative scope is `Docs/belltab-plan.md`, and the
evidence behind the technical decisions is
`Docs/research/background-timers-and-schedule-modeling.md`.

**Status legend:** ✅ Done · 🚧 In progress · 📋 Planned · ⛔ Blocked (prereq)
**Tracks:** 🏗️ Setup · ⚙️ Engine · 🎨 UI · 🔀 Infra · 🔗 Integration

**Status (2026-09-02, Phase 7 complete): BellTab is live at
`biscuitlab.net/bell`.** The cutover ran the hub runbook's recipe minus
everything auth-shaped: canonical and sitemap first, a dormant `BELL_ORIGIN`
rewrite in the hub, the Vercel project with `origin-bell.biscuitlab.net`
attached and one grey-cloud A record, then the flip — the env var set and the
hub redeployed. The gate is measured and met; two findings (the hub's headers
winning the proxied hop, and the origin host being public by design) are gap
rows and a Deviations entry in `Docs/build-log.md`. Every phase in the table
below is done. What the deploy unlocks is verification: the accumulated
"unverifiable from this machine" gaps now have a URL.

> **Superseded 2026-09-02, hours later.** The paragraph below described `main`
> when Phase 6 closed and is kept because Phase 7 was planned against it.

**Status (2026-09-02, Phase 6 complete):** BellTab is installable. A web app
manifest — bell icon at every size the platforms ask for, `standalone` display,
everything scoped inside `/bell` — closes the comfort phase, deliberately
without a service worker (Chrome no longer requires one to install, offline is
a non-goal, and the Decisions table in `Docs/build-log.md` has the rest). The
icons are five Playwright renders of one committed SVG glyph, and the E2E
fetches everything the manifest names the way a browser's install machinery
would.

All of Phase 6 is done: theme, bell offset, Big mode, wake lock, chime,
notification, manifest. What remains is Phase 7, the cutover.

> **Superseded 2026-09-02.** The paragraph below described `main` after the
> bells and is kept because the manifest was planned against it.

**Status (2026-09-02, after Phase 6 part 2b's second slice):** the app can now
be heard. Two opt-in bells ring at period boundaries — a synthesised chime and a
system notification for the backgrounded tab — keyed on the same
`boundaryKey`/`announcementFor` pair the screen-reader announcer has used since
Phase 2, so the three surfaces share one definition of "the bell". Both are
honest foreground features: the panel says in plain words that a background tab
can ring up to a minute late and a closed one never rings, which is the research
doc's conclusion folded into copy instead of promised away.

What is left of Phase 6 is the PWA manifest. Then Phase 7, the cutover.

> **Superseded 2026-09-02.** The paragraph below described `main` after the wake
> lock and is kept because the bells were planned against it.

**Status (2026-09-02, after Phase 6 part 2b's first slice):** the app can now
hold the screen open. A "Keep the screen awake" preference takes a Screen Wake
Lock while the tab is visible and re-takes it on every return, which is what a
countdown projected at a room needs and what Big mode made obviously worth
having. It is off by default and reports what actually happened rather than what
was asked for: an engine without the API disables the control, a device that
refuses says so out loud, and an ordinary hidden tab is not called a failure.

What is left of Phase 6 is the opt-in chime and notification, and the PWA
manifest. Then Phase 7, the cutover.

> **Superseded 2026-09-02.** The paragraph below described `main` after Phase 6
> part 1 and is kept because the wake lock was planned against it.

**Status (2026-09-02, after Phase 6 part 1):** the app now has settings of its
own, kept deliberately apart from the user's data. A Preferences panel holds a
three-way theme — System, Light, Dark, with System the default and a real
choice rather than the absence of one — applied to `<html>` before the first
paint, and a bell offset that nudges the countdown to match a building's real
bells. The offset moves the CLOCK READING and never the stored schedule, so a
share link and a backup carry one school's timetable and not one device's clock
skew.

What is left of Phase 6 is Big mode, the wake lock, the chime and notification,
and the PWA manifest. Then Phase 7, the cutover.

> **Superseded 2026-09-02.** The paragraph below described `main` after Phase 5
> and is kept because the Phase 6 plan was written against it.

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

**Testing:** 412 Vitest tests over the pure engine, the parser, the formatters,
the clock reader, the day resolver, the editor's draft model, the storage
boundary, the library mutators, the share codec, the preferences boundary and
the wake lock's and the bells' wording, plus **654 Playwright tests across
three engines** —
Chrome, WebKit and Firefox — **none of them parked**, which is true for the first
time in the project. The last parked block was Big mode's, and Phase 6 built it.

The reflow gate that Phase 0 calls for runs the four Now-view states, Big mode,
the editor, the calendar panel, the preferences panel and the confirm dialog at 320/375/768/1024/1440, with
a 60-character unbroken name typed into a period, the schedule name, a picker
chip, a `<select>` option and an exception row. `e2e/a11y.spec.ts` adds an
`@axe-core/playwright` sweep over ten journeys, including both error states and
the open modal, failing on any critical or serious violation.

Every parked block named the phase that revived it, and every one of them has
now been revived. The Day view's, which named none, was deleted on 2026-09-01
rather than left. See **Open gaps** in `Docs/build-log.md`.

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
| **5** | Sharing — versioned hash encoding, export/import | ⚙️ | ✅ Done |
| **6** | Comfort — theme, bell offset, Big mode, wake lock, bells, PWA | 🎨 | ✅ Done |
| **7** | Cutover — hub rewrite, origin host, project card, sitemap | 🔀 | ✅ Done |

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
one build implements neither `<input type="time">` nor `type="date"`, which real
Safari has shipped since 14.1. Carried
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

- ✅ `JSON.stringify` → `CompressionStream('deflate-raw')` → base64url → hash.
  Measured: **284 characters** for the whole URL of the eleven-period seeded
  day, and a test pins the payload under 600 so a change that bloats it has to
  argue for itself.
- ✅ Version prefix, and a dispatch table keyed on it. The table is a `Map`
  rather than an object literal, because an object's prototype made
  `constructor` a working version marker — see the code review.
- ✅ Caps before parsing: the whole fragment, the version segment, the encoded
  payload, and the decoded bytes. The last is checked WHILE the stream is read
  rather than after `arrayBuffer()`, because a check that runs after the buffer
  is full runs after the damage.
- ✅ Share-link UI and JSON export/import. A link is offered, never added
  silently; the fragment is cleared once resolved; import parses before it
  confirms and replaces everything behind the delete dialog.
- ✅ The round-trip fixture suite. Five real payloads with what each must still
  decode to, written out in full rather than derived from `DEFAULT_SCHEDULES` —
  deriving them would let a seed edit silently rewrite what a historical payload
  MEANS while the suite stayed green.

**Gate: met in a browser, not yet through a messaging app.**
`e2e/share.spec.ts` copies a link out of one page, opens it in another, and adds
the schedule — plus the paste-into-an-open-tab case, a damaged link, a link from
a future version, and the export/import round trip. base64url was chosen so
nothing needs escaping and the alphabet is asserted.

What is still owed is the literal gate: a real messaging app, which may wrap,
truncate or link-ify a 284-character URL in ways no unit test can see. Carried
forward as an open gap.

Carried forward as open gaps rather than done: an import cannot be undone. (The
clipboard-refused branch, carried here until 2026-09-03, is now asserted —
`stubClipboard` in `e2e/helpers.ts`.)

## Phase 6 — Comfort 🎨

Split into two, on the line between logic that can be tested without a browser
and behaviour that is permission-gated and can mostly only be tested through its
refused branches. Part 1 is done.

### Part 1 — the Preferences panel, the theme and the bell offset ✅

- ✅ A fourth settings panel, and the first thing in the app that is
  deliberately NOT part of a schedule. Both settings live in
  `belltab.prefs.v1`, beside the library rather than inside it, so neither
  travels in a share link or a JSON backup. A bell offset measures one
  building's bell controller against one device's clock; a theme is a choice
  about a screen.
- ✅ **Bell offset**, ±300 seconds, applied to the CLOCK READING and never to
  the stored schedule. `shiftNow` moves `secOfDay` only — never the date or the
  weekday, which choose which schedule runs — and clamps at both ends of the day
  rather than wrapping into a reading no caller could interpret.
- ✅ **Theme**, three ways: System, Light, Dark. System is the default and a
  real choice, not the absence of one — it follows `prefers-color-scheme` and
  keeps following it when the OS flips at sunset. Applied to `<html>` by an
  inline script before the first paint, which closes the flash-of-wrong-theme
  gap open since the plain build was retired.
- ✅ `color-scheme` narrowed in CSS under `[data-theme]`, so the browser's own
  scrollbars and number spinners follow an explicit choice the server-rendered
  `<meta>` tag cannot know about.

**Not done, and the reason is measured:** the theme script is inline and
**unhashed**, and the CSP still carries no `script-src`. Next emits two inline
scripts of its own per page whose bytes change with every build, `headers()`
cannot see the rendered HTML to hash them, and the supported nonce path needs
middleware `AGENTS.md` bans. See the Decisions table in `Docs/build-log.md`.

### Part 2a — Big mode ✅

- ✅ The projector view, as a MODE laid over the Now view rather than a second
  view: `body.is-big` scales the one countdown and takes the authoring chrome
  away, so the two cannot drift apart. The CSS had shipped unrendered since the
  plain build was retired.
- ✅ One button in (`#view-big`), one button out (`#big-exit`, plus Escape).
  Not a two-state switcher — its second state would have been "normal".
- ✅ Two inherited CSS decisions reversed rather than ported: the bounds footer
  stays (it was hidden in favour of a period strip that was never rebuilt), and
  the mode keeps the schedule name while dropping the app's name (the rule was
  written when those were the same element). See **Decisions** in
  `Docs/build-log.md`.
- ✅ Opening settings force-exits the mode, so an empty state's call to action
  cannot render the editor inside a full-bleed projector layout.

**Gate: met.** `e2e/big-mode.spec.ts` asserts sameness rather than appearance —
same ids, same digits, same tab title, and the recompute-on-return behaviour
still correct through the mode — plus focus in both directions, the first-paint
focus guard, and that the mode adds no live region. The reflow gate runs it at
all five widths, which revives the last parked block in the repo.

### Part 2b — the Screen Wake Lock ✅

- ✅ **A "Keep the screen awake" preference**, off by default and feature-detected.
  Off is a decision: a wake lock is right for a projector and wrong for a tab
  left open in somebody's bag, so the default has to be the state nobody is
  surprised by. An engine without the API gets a disabled control and a sentence
  saying why, rather than a control that quietly vanishes.
- ✅ **Re-acquired on every `visibilitychange` back to visible**, because the
  user agent takes the lock back whenever the document stops being visible. The
  same lesson as the countdown's, in a second domain: nothing may be treated as
  state that stays true while the tab is away.
- ✅ **A request is never made from a hidden document**, which the spec rejects.
  Without that guard an ordinary backgrounded tab would report a refusal — the
  one status that is supposed to mean something is wrong.
- ✅ **Five statuses rather than a boolean**, because "the toggle is on" and "the
  screen is being held awake" are different facts and every real failure lives in
  the gap between them.
- ✅ **One lock, mounted in `App.tsx`**, above both screens. Owning it in the
  preferences panel would release it the moment the user went back to the
  countdown.
- ✅ Big mode deliberately does **not** turn it on. See **Decisions** in
  `Docs/build-log.md`.

**Gate: met against a stub, not against a projector.**
`e2e/wake-lock.spec.ts` replaces `navigator.wakeLock` before the page loads and
drives the three branches no browser in the matrix produces on demand — an
absent API, a refusal, and the tab leaving and coming back — plus the release on
unticking, which is the version of this bug that keeps a laptop awake all night
and reports nothing. Whether a real machine driving a real projector stays lit
for a real period is carried as an open gap.

### Part 2b — the chime and the notification ✅

- ✅ **Opt-in, off by default, and one definition of "the bell":** both key on
  `boundaryKey` and speak `announcementFor`, the announcer's own pair, so the
  chime, the toast and the screen-reader announcement cannot drift into
  disagreeing about what counts as a period change.
- ✅ **The chime is synthesised** on the page's one `AudioContext` — nothing
  fetched, shipped or licensed. The toggle's own tick is the autoplay-unlocking
  gesture; a restored preference arms a first-touch-anywhere listener; a Test
  button rings without committing anything.
- ✅ **The notification asks on tick and stores only a grant**, is suppressed
  while the tab is visible (a toast about the screen you are watching is
  noise), and retires the control with an honest sentence once permission is
  denied — the prompt cannot be raised again, so the sentence points at the
  browser's site settings instead.
- ✅ **The copy the plan demanded:** both work only while a tab is open, a
  background tab can be up to a minute late, a closed tab never rings.
- ✅ **A slept-through stretch rings once**, for the state being woken into —
  the recompute rule made audible, asserted as exactly two oscillator starts
  across a two-bell jump.

**Gate: met against stubs, on the wake lock's argument.** `e2e/bells.spec.ts`
replaces `AudioContext` and `Notification` before load and drives every bell
through real clock boundaries — including the default case, which asserts a
user who wants none of this carries none of it: no context constructed, no
permission asked. Whether the chime is audible and pleasant over a real
classroom is carried as an open gap; the Test button exists so judging it costs
one press.

### Part 2b — the manifest ✅

- ✅ Installable: `src/app/manifest.ts`, `standalone`, id/start_url/scope all
  `/bell`, every URL spelled out with the prefix by hand (`basePath` rewrites
  nothing inside the file).
- ✅ One SVG glyph — the butterscotch bell — rendered to five committed PNGs by
  `scripts/render-icons.mjs` through the Playwright already in devDependencies:
  plain and maskable at 192/512, plus the 180px apple-touch-icon.
- ✅ **No service worker, on purpose.** Installation no longer needs one,
  offline is a non-goal, and the update-lifecycle risk buys nothing here. The
  Android notification gap keeps its row, with the SW named as its price.
- ✅ Colours pinned to the page: the E2E reads the live `--paper` token and
  asserts the manifest matches, so a palette change cannot strand the splash.

**Gate: met as a contract, not as an install.** `e2e/pwa.spec.ts` fetches what
a browser's install machinery would fetch — the manifest, all four icons, the
favicon, the apple-touch-icon — and asserts each serves at the type it claims
from inside `/bell`. Whether the prompt appears on a real device is carried in
Open gaps beside the projector and the chime.

**Gate for part 1: met.** `e2e/preferences.spec.ts` drives the offset through
the digits, the tab title and storage, proves an out-of-range value leaves the
running one alone, proves an emptied box is an edit rather than a reset, and
proves the theme is on `<html>` before anything is drawn and absent for System.
Two more assert the split: preferences stay out of the library's key, and
survive an import that replaces every schedule and the whole calendar.

A `high`-effort code review of the finished tree found four defects, all in the
new form and all fixed in the same session: an `inputMode` that made a negative
offset untypeable on iOS, an error node mounted only when it had something to
say (so it never announced), an `aria-describedby` that dropped the range hint
at the moment it was needed, and a draft that ignored a change made in another
tab. See **Bugs found** in `Docs/build-log.md`.

**Gate for part 2b, kept throughout:** nothing in it promises background
behaviour the web cannot deliver.

## Phase 7 — Cutover 🔀

Planned 2026-09-02 against the hub's `multi-zone-migration-runbook.md` and the
Puzzle Lab cutover log — the validated sequence, minus everything auth-shaped.
In order: canonical + sitemap in this repo ✅, a dormant `BELL_ORIGIN` rewrite
in the hub, the Vercel project + origin host + one grey-cloud CNAME, the flip
(set `BELL_ORIGIN`, redeploy the hub), the gate, and only then the card and the
hub's sitemap index (which also closes that runbook's own deferred item, now
that `/puzzles/sitemap.xml` exists).

**This repo:** its own Vercel project, Deployment Protection on, a dedicated
custom origin host (`origin-bell.biscuitlab.net`) so the hub's proxy can
reach it while the `*.vercel.app` alias stays locked. Done in code 2026-09-02:
`metadataBase` + a canonical naming `biscuitlab.net/bell` (what tells a crawler
the origin host is not a second site), and a one-URL sitemap for the hub's
index to point at.

**Hub repo (`Biscuit-Website`):** add `BELL_ORIGIN`, add both rewrites (bare
`/bell` and `/bell/:path*` — the bare path does not always match `:path*`),
redeploy the hub (rewrites are read at build time), add the project card, and
add BellTab to the sitemap index.

No rpID/passkey complication here — BellTab has no auth — so this is the easy
version of what `Biscuit-Website/Docs/multi-zone-migration-runbook.md` describes.

**Gate (corrected 2026-09-02, and met the same day):** `biscuitlab.net/bell`
serves with assets, headers, canonical, manifest and sitemap intact, and every
per-deployment `*.vercel.app` URL stays locked behind Deployment Protection.
The original wording asked for the ORIGIN host to be locked too, which the
recipe forbids: custom production domains are exempt from protection, and that
exemption is the entire mechanism by which the hub's proxy reaches the origin.
`origin-bell.biscuitlab.net` is public exactly as `origin-puzzles` always has
been; the canonical naming `biscuitlab.net/bell` is the mitigation, and it
shipped before the origin ever served. See Deviations in `Docs/build-log.md`.

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
| am/pm on the 12-hour clock | Matches the mockups; a school day is unambiguous without it, and the `<time>` element carries the 24-hour value for machines | A schedule that crosses noon ambiguously — an evening programme, say |
| Big mode surviving a reload | It is component state on purpose: a mode you cannot see the way out of is worse than one you re-enter, and a projector is set up once per session by somebody at the machine | A room wanting a permanent display — which would be a preference, not a change to this state |
| Big mode requesting fullscreen | It fills the viewport; the Fullscreen API would take the browser chrome too, but adds an exit path the app does not control (the browser's own Escape races the mode's) and deserves designing rather than adding | Somebody asking for it after using Big mode on a real projector |

## Open questions

- ~~**Repo name and remote.**~~ Resolved: `github.com/zfert99/belltab`.
- ~~**Does the hub's project index need a card before Phase 7?**~~ Resolved
  2026-09-02: the card lands AFTER the flip is verified, in its own hub PR —
  the order Puzzle Lab used. A card pointing at a 404 is worse than no card.
- ~~**Is `/bell` final?**~~ Resolved 2026-09-02: `/bell`. It is what the plan
  says throughout and what `basePath` has shipped as since Phase 0; a repo
  keeping a longer name than its URL is normal, and the rename would buy
  nothing for the cost of touching every doc and the manifest.
