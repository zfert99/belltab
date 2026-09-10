# BellTab — Build Log

The running record of what we built, what we decided and why, what broke, and
what we still owe. Updated **every time something changes** — not summarized at
the end of a phase.

- **Scope** lives in `Docs/belltab-plan.md`. **Phases** live in `Docs/roadmap.md`.
  This file is the narrative between them.
- **All timestamps are local time, `America/New_York`** (UTC−4 as of this
  writing). Absolute dates only — never "yesterday".
- **Append, don't rewrite.** When a decision is reversed, add a new entry that
  supersedes the old one and mark the old one. The wrong turns are the part
  worth keeping.

## How to update this file

1. Add a dated entry under **Session log** describing what changed.
2. If a *why* was involved, add a row to **Decisions**.
3. If something is broken, unfinished, or knowingly wrong, add it to **Open
   gaps** — and move it to **Closed** when fixed, with the date.
4. When a phase is complete and its entries have stopped being consulted,
   move its **Session log** entries - and only those - to a dated file in
   `archive/`, and add it to the pointer at the top of Session log. The
   tables stay here, whole.

---

## Current state

**Working:** the countdown, the editor and the calendar. Phase 3 made the
schedule the user's rather than the seed data's; Phase 4 made the *set* of
schedules and the days pointing at them the user's too.

- `src/lib/` is pure, typed and fully tested — the parser mints a branded
  `ValidSchedule` and the engine accepts nothing else.
- One clock (`_lib/useNow.ts`) drives everything: the digits, the progress bar,
  the tab title and the boundary announcer are all derived views of one reading
  per second, recomputed from `Date.now()` and forced to recompute on
  `visibilitychange` and `focus`.
- All five empty states render, reachable from the seeded calendar alone.
- The schedule editor: add, rename, retime, reorder and delete periods, with
  overlap blocked at input time and every message bound to the field that
  caused it. Persisted to `localStorage`, which is read through
  `useSyncExternalStore` and therefore syncs across tabs.
- Multiple named schedules: a picker, New schedule, Duplicate, and Delete
  behind a real modal confirmation. Every schedule in the library carries a
  unique id, minted at the parse boundary, because the calendar points at them
  by id.
- The calendar panel: what today resolves to, a "use this schedule today"
  control that writes a dated override, the seven weekday defaults, and a list
  of dated exceptions. The resolver's priority order is the order the panel
  reads in.
- The stylesheet's three font tokens resolve to real self-hosted faces.

**Retired:** the plain HTML/CSS/JS build. Phase 1 replaced the modules it
imported with `.ts`, which a browser cannot load, so `src/index.html`,
`src/app.js`, `src/store.js`, `src/ui/` and `scripts/serve.js` are gone. Their
behaviour — three views, the editor, the calendar, preferences — is owed back by
Phases 2–4 and its tests are parked, not deleted. See **Open gaps**.

- Sharing: a link per schedule. Opening one SHOWS that schedule running at
  once; "Keep it" writes it and makes it today's, "No thanks" puts the regular
  day back. JSON export/import is the durable backup.
- Preferences, in their own storage key so none of them travels in a share link
  or a backup: a three-way theme applied before the first paint, a bell offset
  that shifts the clock reading rather than the schedule, a Screen Wake Lock
  toggle that keeps a projector lit and says out loud when the device refuses,
  and two opt-in bells — a synthesised chime and a background-tab notification —
  that ring on the same boundaries the announcer speaks.
- Big mode, the projector view — the same countdown, scaled, with the authoring
  chrome taken away.

- Installable: a web app manifest with the bell icon at every size the
  platforms ask for, `standalone` display, and everything scoped inside
  `/bell`. One service worker with no fetch handler, for Android's
  notifications only — see Decisions.
- The Day view (Phase 8): the whole schedule as a list under a one-line
  summary, finished periods folded away, the running row with its own
  countdown and track. And, as a preference, the day as blocks in the progress
  bar's place — proportional, a dash wherever the kind changes.
- The bell offset can be MEASURED: "The bell just rang", pressed as it rings.
- Settings copy in plain second person, in the user's own words.

**Live at `biscuitlab.net/bell` since 2026-09-02.** Every phase, D through 8,
is done. **The closing review is `Docs/code-review-2026-09-10-full-audit.md`**:
five passes, seven defects (one Medium: focus lands on the gear on every
load), none of them touching the five invariants, and every one recorded in
Open gaps with a file and line rather than fixed. Known limits holds the
facts. The last session log entry has the day's state.

### Files

Imports flow strictly one way, top to bottom. Nothing below imports anything
above it, so the graph is a DAG and no module is half-initialised when another
reads it.

Organised by **layer, not by feature** — `AGENTS.md` calls a `src/features/`
domain split premature fragmentation at this size, and names `src/lib/` as the
home for the pure engine.

```text
src/
  app/          routing and entry points only, per AGENTS.md
    layout.tsx  page.tsx  globals.css
    _lib/         app-layer glue: knows about React and about the stored shape
      library.ts  libraryStore.ts  draft.ts  shareLink.ts
      today.ts  useNow.ts                        + colocated tests
    _components/  the client tree
      App.tsx  NowView.tsx  PeriodAnnouncer.tsx  ShareOffer.tsx
      SettingsView.tsx  SchedulesPanel.tsx  CalendarPanel.tsx  BackupPanel.tsx
      ScheduleEditor.tsx  PeriodRow.tsx  ConfirmDialog.tsx  icons.tsx
  lib/          pure: no DOM, no React; `Date` only as an argument
    schedule.ts  engine.ts  parse.ts  format.ts  clock.ts   + colocated tests
    share.ts  share.fixtures.ts                             + colocated tests
e2e/            Playwright, top-level by rule, not colocated
  helpers.ts  reflow.spec.ts  confirm-dialog.spec.ts  announcer.spec.ts
  countdown.spec.ts  editor.spec.ts  calendar.spec.ts  share.spec.ts
  a11y.spec.ts
```

`_lib/` and `_components/` are Next.js **private folders** — the leading
underscore keeps them out of routing. `AGENTS.md` names them as the colocation
mechanism and bans a `src/features/` split at this size.

`e2e/` is top-level because `AGENTS.md` exempts E2E from colocation: it tests
the assembled app in a browser, not any one module. It covers the two things
jsdom structurally cannot — real layout, for the WCAG reflow gate, and real
`<dialog>` lifecycle, which jsdom does not implement at all.

| File | What it is | Imports |
| --- | --- | --- |
| `src/app/globals.css` | Design tokens (palette → semantic layer), light + dark, 17 sections. Carried over from the retired build's `styles.css`. | — |
| `src/app/layout.tsx` | The root layout. Imports `globals.css`; sets the viewport and `color-scheme`. | — |
| `src/app/page.tsx` | A shell. A Server Component that reads no clock. | — |
| `src/lib/schedule.ts` | What a schedule *is* — the types, including the `ValidSchedule` brand — plus the seed data. No logic. | nothing |
| `src/lib/engine.ts` | What is true at a given moment. Pure; time is always an argument; takes only a `ValidSchedule`. | schedule |
| `src/lib/parse.ts` | The boundary. Untrusted input → a branded `ValidSchedule` or structured errors. Pure. | schedule |
| `src/lib/format.ts` | Every user-visible string derived from a number, plus the announcer's copy and its boundary key. Pure. | **types only** |
| `src/lib/clock.ts` | The only file that reads a `Date` — and it takes one as an argument. Wall-clock fields to integers. Pure. | **types only** |
| `src/app/_lib/library.ts` | What the app stores — schedules plus calendar — and the parsing either side of `localStorage`. Pure; takes the raw string. | parse, schedule |
| `src/app/_lib/libraryStore.ts` | `localStorage` as a React external store. The only code that touches it. | library |
| `src/app/_lib/draft.ts` | What the editor holds while it is being typed into, and the operations on it. Pure. | parse, schedule |
| `src/app/_lib/today.ts` | Which schedule is running and what it is doing, and which one the editor opens on. Pure; the library is a parameter. | clock, engine, format, parse, library |
| `src/app/_lib/useNow.ts` | The one clock. The single `setInterval` in the repo, plus the two lifecycle listeners. | clock |
| `src/app/_components/App.tsx` | The shell: one clock, one store, and which of the two screens is up. | today, useNow, libraryStore, format, icons |
| `src/app/_components/NowView.tsx` | The countdown screen. Presentational since Phase 3. | format, engine, today |
| `src/app/_components/PeriodAnnouncer.tsx` | The `aria-live` region that fires only at bells. | format, engine |
| `src/app/_components/SettingsView.tsx` | The settings screen. One panel, so no tab strip yet. | library, schedule, ScheduleEditor |
| `src/app/_components/ScheduleEditor.tsx` | The form. Holds the draft; commits only what the parser accepts. | draft, library, parse, PeriodRow |
| `src/app/_components/PeriodRow.tsx` | One period, as native controls. | draft, parse, schedule, icons |
| `src/app/_components/icons.tsx` | Five inline SVGs. No logic. | — |

Unit tests are colocated with what they validate: `lib/engine.test.ts`,
`lib/parse.test.ts`, `lib/format.test.ts`, `lib/clock.test.ts`,
`app/_lib/today.test.ts`, `app/_lib/draft.test.ts`, `app/_lib/library.test.ts`.

`_components/` still has no unit tests, and Phase 3 was the phase that was
supposed to change that. It did not, and the reason is worth stating rather than
leaving as an omission: the editor's logic is `draft.ts`, which is pure and has
36 tests of its own, and what is left in the components is a real `<input
type="time">`, a real focus move, a real `localStorage` and a real live region —
none of which jsdom models faithfully enough to be evidence. `e2e/editor.spec.ts`
drives all of it in a browser instead, including a keyboard-only pass. Testing
Library would add a dependency to re-assert, less honestly, what the E2E suite
already asserts.

### Running it

```bash
npm run lint      # eslint - the whole repo, jsx-a11y at full `recommended`
npm run typecheck # tsc --noEmit, strict
npm run build     # next build - 2 static routes, still fully static
npm run lint:md   # markdownlint
npm test          # vitest run - 213 unit tests
npm run watch     # vitest in watch mode
npm run e2e       # playwright - 83 live, 22 parked; builds and serves the app
npm run e2e:ui    # playwright in UI mode
npm run dev       # http://localhost:3000/bell
```

The first five are what CI runs, in that order, plus `npm audit`.

The `/bell` suffix on the dev URL is not a typo: `basePath` is applied in
development too, so the bare origin is a 404 exactly as it is in production.

---

## Decisions

| Date | Decision | Why |
| --- | --- | --- |
| 2026-08-26 | Build in plain HTML/CSS/JS first, port to Next.js + TypeScript after | Deliberate detour from roadmap Phase 0. Goal is to see the wiring before a framework hides it. The engine is framework-free by design, so the port is mechanical. |
| 2026-08-26 | `src/` from the first file, even without a build step | Matches `AGENTS.md`. Moving later is pure churn. |
| 2026-08-26 | ES modules + a local server, not `<script>` globals over `file://` | Globals would work with zero setup but teach a pattern we would throw away at the port. |
| 2026-08-26 | Installed Node 24.19.0 / npm 11.17.0 via winget | Machine had neither Node nor a real Python (`python.exe` on PATH was the Microsoft Store stub). Node is required by Phase 0 anyway — Next, Vitest, Playwright, markdownlint. |
| 2026-08-26 | Times stored as minutes-since-midnight integers | Repo invariant. A bell schedule is wall-clock, so integers are DST-safe and comparable. `Date` is read in exactly one place, `app.js:193`. |
| 2026-08-26 | `hm(9, 5)` helper in `schedule.js` instead of literal `545` | Runs once at load, produces the same integer, and eleven hand-written minute counts is how you get a typo nobody notices for weeks. |
| 2026-08-26 | Periods are half-open intervals `[start, end)` | With `<=` on both ends, back-to-back periods both claim the boundary second and the display flickers between them once a second. |
| 2026-08-26 | CSS uses two token layers: raw palette, then semantic names | Dark mode becomes ~10 lines of re-pointing instead of hunting hex codes through 40 rules. |
| 2026-08-26 | Countdown number uses `--fg`, **not** butterscotch | **Deviates from `Docs/design/design-system.md`.** See Deviations below. |
| 2026-08-26 | Dark mode declared twice — media query *and* `[data-theme]` | `:root:not([data-theme="light"])` inside the media query lets a future toggle override the OS in both directions. |
| 2026-08-26 | Tab title uses `Math.ceil` on remaining minutes | `floor` shows `0m` for the last 59 seconds of a period, which reads as "it is over" when it is not. |
| 2026-08-26 | Every DOM write is `textContent`; `innerHTML` banned in this codebase | Period names will arrive from share links, i.e. from strangers. `innerHTML` here is an XSS hole triggered by sending someone a URL. |
| 2026-09-02 | Big mode is a MODE laid over the Now view, not a second view | There is one countdown in this codebase and `body.is-big` scales it. A second component rendering the same numbers bigger would look identical in a screenshot and drift the first time one of them was fixed — which is the failure the whole "one clock, one subscriber" rule exists to prevent, one layer up. The E2E asserts sameness (same ids, same values, same title) rather than appearance for that reason. |
| 2026-09-02 | One button in, one button out — not a two-state view switcher | `globals.css` carries `.viewswitch` from the retired build, where it toggled between the Now view and a Day view that no longer exists. A switcher whose second state is "normal" is a control that mostly says nothing. So `#view-big` is an action, and the mode supplies its own way back through `#big-exit` — one quiet pill at the bottom of the projector, plus Escape. |
| 2026-09-02 | The bounds footer STAYS in Big mode, reversing the inherited rule | It was hidden because the period strip said the same thing better — and the strip belonged to the retired plain build and has never been rebuilt. Hiding the only line that reads "Next: Passing at 10:05" in favour of an element that is not on the page is a decision that survives a port because nobody re-reads the reason. Scaled up instead. |
| 2026-09-02 | Big mode keeps the schedule name and drops the app's name, which is the opposite of what the rule said | `.is-big .screen__schedule` was written when `.screen__schedule` WAS the schedule name; in the current markup it is the `<h1>` reading "BellTab" and the name lives in `#schedule-name`. The selector kept working and stopped meaning what its comment said. The current behaviour is the better one — "Regular" versus "Half day" is what a teacher glancing up wants confirmed, and nobody in the room needs told the app's name — so the comment was corrected to the code rather than the other way round. |
| 2026-09-02 | Opening settings force-exits Big mode | The "No school today" call to action is a `.minibutton`, which Big mode scales but does not hide, so a projector showing an empty day has a live route into the editor. Without the guard the settings panel renders inside the full-bleed projector layout, which is a screen nobody designed. Covered by a test rather than a comment. |
| 2026-09-02 | Preferences live under their own `localStorage` key, not inside the library | A bell offset measures ONE building's bell controller against ONE device's clock. Folding it into the library would carry it into the JSON backup and into every share link — so a teacher who measured their bells at twelve seconds fast would silently hand that skew to everyone they sent a schedule to, inside what looks like a timetable. The theme is the same shape of thing: a choice about a screen, not about a school day. `belltab.prefs.v1`, separate from `belltab.v1`. |
| 2026-09-02 | The bell offset shifts the CLOCK READING, never the stored schedule | Same argument, one layer down. Shifting `startMin`/`endMin` is the obvious implementation and it is the one that leaks: the schedule is the thing that gets exported, imported and shared. `shiftNow` applies it once at the engine's front door, beside the seconds conversion `stateAt` already documents, so the digits, the progress bar, the tab title and the announcer all correct together and the stored schedule is untouched. |
| 2026-09-02 | The offset moves `secOfDay` only — never the date or the weekday, and it clamps at both ends of the day | The date and weekday select WHICH schedule runs, and a correction to a bell controller is not evidence about which day it is; letting the offset move them would let a schedule change at 23:59 because the bells run fast. Wrapping past midnight would pair tomorrow's second-of-day with today's date, a reading no caller could interpret, so it clamps instead — freezing for at most five minutes at the ends of a day where no bell rings. |
| 2026-09-02 | The pre-paint theme script is inline and **unhashed**, reversing the plan for this session | A hash is only worth having next to a real `script-src`, and this app cannot ship one — see the row below. Given that, an external file in `public/` buys nothing and costs a fetch, and a fetch is a window in which the page can paint the wrong palette. Inline is the only version with no window at all. |
| 2026-09-02 | A real `script-src` is **unavailable** to this app, measured rather than assumed | Next emits two inline scripts of its own into every page: a 43-byte bootstrap and ~5 KB of flight data whose bytes change with every build (they carry the chunk hashes). `headers()` in `next.config.ts` runs without any knowledge of the rendered HTML, so neither can be hashed there, and a hash-based `script-src` would block the framework's own hydration. The supported answer is a per-request nonce from middleware, and this repo ships no `middleware.ts` on purpose — see the CVE-2025-29927 rule in `AGENTS.md`. The CSP therefore stays `frame-ancestors 'none'`. |
| 2026-09-02 | `localStorage` plumbing became a factory, `createLocalStore` | Phase 6 needs a second key and the choice was two copies of `libraryStore.ts` or one parameterised copy. The caching rules in it are subtle enough — a module-level memo against the raw string, because `getSnapshot` must be referentially stable, plus a `storageWorks` latch because re-reading after a throw silently reverts every edit — that a second hand-written copy is a second place to get them subtly wrong. `useLibrary`/`saveLibrary` keep their names, so nothing else changed. |
| 2026-09-02 | Preferences degrade **field by field**, unlike the library which is all-or-nothing | A library is one interlocking thing — a calendar pointing at schedules — so half of one is broken rather than smaller. Preferences are independent scalars: a theme name that no longer exists says nothing about whether a measured offset is still usable, and discarding the offset because the theme was renamed is a worse answer than either field can justify. |
| 2026-09-02 | The theme is three radio buttons, not a two-state toggle | "System" is a real choice and the default one: it follows `prefers-color-scheme` and keeps following it when the OS flips at sunset. A two-state toggle has to pick a starting side, which silently converts every user into someone who has overridden their OS. A native radio group also brings arrow-key navigation, one tab stop for the group, and "Theme, Light, radio button 2 of 3" for free. |
| 2026-09-01 | Every schedule in a **library** carries a non-null unique id, minted at the parse boundary | The calendar points at schedules by id, so a library schedule without one is a schedule no weekday and no override could ever select. A *single* schedule may still have none — one typed into the editor, one decoded from a share link — so this is a collection guarantee, expressed as `IdentifiedSchedule` and produced by `parseScheduleCollection`. |
| 2026-09-01 | The narrowing to `IdentifiedSchedule` is a **type predicate**, not a second cast | `parseSchedule`'s double assertion is the only one in `src/`, and this log says a second would read as a lie in a diff. `isIdentified` narrows without asserting, because the intersection is assignable to the parameter type. |
| 2026-09-01 | Duplicating a schedule hands the boundary the **source's own id** and lets it renumber the copy | The original comes first in the list, so it keeps the id and the copy is minted a fresh one. One place in the codebase decides what an id is, and the duplicate path exercises it rather than working around it. |
| 2026-09-01 | Deleting a schedule **drops** the overrides pointing at it, rather than letting them degrade | `parseCalendar` turns a dangling id into `scheduleId: null`, which is an explicit closure — so rebuilding without the filter would quietly turn "assembly on the 14th" into "the school is shut on the 14th". Falling back to the weekday default is the honest answer. Weekdays are different: there, null already *means* no school. |
| 2026-09-01 | A duplicate's name is truncated to fit `SCHEDULE_LIMITS.nameChars` before " (copy)" is appended | Not tidiness. Appending to a name already at the cap makes the whole duplicate fail to parse, and the button then does nothing at all with no message. |
| 2026-09-01 | Schedule selection is an **index**, not an id | The picker is a positional row of chips and the editor already replaces schedules positionally. An index survives a rename, which is the edit that runs on every keystroke. The editor's `key` is index *and* id, because either alone remounts at the wrong times. |
| 2026-09-01 | A new schedule is created **empty**, not pre-filled with a period | "This schedule has no periods" is a state the countdown already renders honestly, and a period nobody asked for is one they have to notice and delete. |
| 2026-09-01 | Settings navigation is `aria-pressed` buttons, not an ARIA tablist | A real `tablist` owes arrow-key roving focus and a `tabpanel` relationship. Two destinations that each replace the panel below need neither, and claiming the role without the behaviour is worse than not claiming it. |
| 2026-09-01 | The "use this schedule today" control writes a dated **override**, never a weekday default | A make-up day is one Saturday, not every Saturday. The control sits under a line saying what today currently resolves to, so the effect is visible before and after. |
| 2026-09-01 | The Today control's options are namespaced sentinels (`weekday`, `closed`, `id:*`); the weekday and exception selects use `""` for "no school" | A select's value is always a string, so `null` has to be encoded. `""` is safe as that encoding because every schedule id is now non-empty. The Today control needs a *third* state — "follow the weekday default" — so it cannot use the same two-value scheme, and an `id:` prefix is what stops a schedule called `closed` from colliding with the sentinel. |
| 2026-09-01 | Dated exceptions render the ISO date, in mono, rather than a friendly one | It is what the user typed, what storage holds and what the Phase 5 export will write, and it is unambiguous in every locale. Formatting it would need a weekday computed from a date string without constructing a `Date` — which parses "2026-09-14" as UTC midnight and names the previous day west of Greenwich. |
| 2026-09-01 | `body` gets `grid-template-columns: minmax(0, 1fr)` | The structural half of the reflow gate. An `auto` track sizes to its content's max-content, so anything inside the card that wants to be wide grows the track past the viewport — the card's own `max-width` never gets a say. See Bugs found. |
| 2026-09-01 | The settings layout goes two-column at 60rem, not 40rem | Measured, not chosen: the editor stacks its six columns at 45rem and the nav takes up to 13rem, so a two-column settings layout narrower than about 59rem hands the editor less room than it thinks it has. |
| 2026-09-01 | `<select>` overflow is clipped at the CONTAINER, with padding and a negative margin | WebKit paints an over-long option outside the control and ignores the control's own `overflow`; only an ancestor clips it. Clipping each `<label>` would clip the focus ring the select draws outside itself, and WebKit has no `overflow-clip-margin` to spare it. The padding buys the ring 5px inside the clip box and the negative margin returns them to the layout. |
| 2026-09-01 | Native date and time inputs carry a `placeholder` | Chrome and Firefox render segmented controls and ignore it; WebKit renders a bare text box where it is the only thing saying what shape the field wants. Progressive enhancement in the honest direction — the parser already refused bad input, this stops the user having to discover the format by failing. |
| 2026-09-01 | A browser-behaviour claim names the PLATFORM it was measured on, not just the engine | `AGENTS.md` already required a citation or a test. This branch produced a test, generalised it from one build to "WebKit", and was contradicted by CI within the hour. The rule needed a second half. |
| 2026-09-01 | The keyboard test steps the time field with an ARROW, and asks the element what it is | Typing into a segmented time control means typing into its segments, and what that costs varies by build and by locale — two CI round trips went into discovering that the assertion was measuring a browser rather than BellTab. ArrowUp is the specified part. The element check (`element.type === "time"`) covers builds that render no time control at all. |
| 2026-09-01 | Cross-engine coverage was SPLIT OUT rather than merged with the rest | The axe scan, the cross-tab test and the Day view deletion were verified and independent; three-engine coverage was one unverified assertion away from done and had already cost three CI cycles on a build that cannot be run locally. Banking the finished work beats holding it hostage. The spike lives on `test/three-engines` with everything it found. |
| 2026-09-01 | The axe gate fails on critical and serious, and reports the rest | The bar `Docs/research/accessibility-responsive-qa.md` sets. Failing on `minor` makes a gate people route around; reporting them in the failure message keeps them visible when something else breaks. |
| 2026-09-01 | The E2E job's NAME is treated as an interface | Branch protection requires "E2E (reflow gate)" by exact string, so renaming the job silently removes the gate rather than failing loudly. It now runs three engines and an axe sweep under a name that undersells it, and the workflow says why. |
| 2026-09-01 | A shared schedule is never added without a press | A link that wrote to somebody's library on arrival would make every URL in a group chat a change to their app. Requiring acceptance is what keeps `AGENTS.md`'s "a malicious link produces, at worst, a silly schedule" true — the worst it can do is show its own name and be dismissed. |
| 2026-09-01 | The fragment is cleared with `replaceState` once the offer is resolved, either way | A refresh must not re-offer a declined schedule, and the URL must stop carrying somebody else's schedule into this browser's history and history sync. `replaceState` rather than assigning `location.hash`, which leaves a bare `#` and pushes an entry, so Back would walk through every link ever dismissed. |
| 2026-09-01 | The incoming fragment is read on `hashchange` as well as on mount | Pasting a link into a tab already on BellTab is a SAME-DOCUMENT navigation: nothing reloads and React never remounts. The mount-only first version did nothing at all in that case, which the browser test caught. No loop, because `replaceState` deliberately does not fire `hashchange`. |
| 2026-09-01 | The share link is built from `location` at call time, never from a constant | It then carries whatever origin and `basePath` the app is actually served from. A hard-coded `biscuitlab.net/bell` would produce links that do not work in development and would keep working just well enough that nobody noticed. |
| 2026-09-01 | The copied link is shown in a read-only input whether or not the clipboard accepted it | The Clipboard API needs a secure context and can be refused by policy, so `copyText` returns a boolean rather than throwing: the user's goal is the link, not the clipboard. Showing it always also gives somebody who was told "copied" a way to check. |
| 2026-09-01 | A backup is uncompressed JSON, while a link is compressed | Different jobs. A link has to fit in a URL; a file does not, and a file people can read is worth more than a file that is small. Both are the same shape, so devtools and the export show the same thing. |
| 2026-09-01 | Import parses BEFORE it confirms | Asking "replace everything?" and then discovering the file was unreadable is the wrong order to find that out in. |
| 2026-09-01 | `parseLibrary` reports, `loadLibrary` degrades, and they share one parser | A corrupt `localStorage` value must not stop the app opening. A file the user deliberately CHOSE must not be swallowed — silently replacing their library with seed data is the worst answer available. Same parse, opposite attitude to failure. |
| 2026-09-01 | A share payload carries no `id` | An id is an identity within ONE library. Carrying it across would either collide with something the recipient has or quietly claim a name like `regular` that means a different day to them. `parseScheduleCollection` mints a fresh one on import, which is what that boundary is for. |
| 2026-09-01 | The share fixtures' expectations are written out in full, never derived from `DEFAULT_SCHEDULES` | Deriving them would let an edit to the seed data silently rewrite what a historical payload is supposed to MEAN, and the suite would stay green while the forever-compatibility guarantee stopped being checked. Verbosity in a fixture file is the price of it being evidence. |
| 2026-09-01 | The decoded-size cap is enforced WHILE the stream is read, not after `arrayBuffer()` | A check that runs after the buffer is full is a check that runs after the damage. `inflate` reads chunk by chunk and cancels, which is the only version that stops a decompression bomb rather than measuring one. |
| 2026-09-01 | The version dispatch table is a `Map`, not an object literal | An object inherits `Object.prototype`, so `table["constructor"]` returned the `Object` constructor - a function, so not `undefined`, so called with the payload. A link with a nonsense version came back "Give the schedule a name." Review finding 1. |
| 2026-09-01 | The whole fragment is capped before it is split, and the version segment again after | The old cap bounded only the payload, and only after the version had been sliced out - so an unbounded attacker-controlled string reached a user-facing message. Review finding 2. |
| 2026-09-01 | The invalid-field style lives in its own section at the END of `globals.css`, with the element named in each selector | It has to beat every rule that sets a `border` shorthand on a control, and shorthand rules are (0,2,1). Naming the element matches that; being last wins the tie. The previous (0,2,0) selector had never painted anything. |
| 2026-09-01 | E2E asserts the COMPUTED colour of an invalid field, not its `aria-invalid` attribute | The attribute was correct for two phases while the style it keys off was dead. A test that checks the attribute a style depends on is not a test of the style. |
| 2026-09-01 | `setOverride` measures the cap against the list WITHOUT the date being written | The question is not "is the calendar full" but "would this grow the calendar". Replacing an exception cannot, so it stays legal at the cap; only a new date is refused. The old gate got both halves backwards at once — see Bugs found. |
| 2026-09-01 | A refusing mutator returns the library BY IDENTITY | `toBe(library)` is what lets a test tell a refusal from a successful write that happened to change nothing, and it is what a caller would need to show an error. |
| 2026-09-01 | Untrusted input is parsed at the control as well as at the mutator | Not duplication of the boundary: the mutator's refusal protects the data, the control's parse is what tells the user. A boundary that silently discards is indistinguishable, from the user's side, from one that lost their input. |
| 2026-09-01 | Playwright runs four workers locally, not the default half-the-cores | Measured: at eight, a 108-test run intermittently crashes the browser, and a crashed renderer is indistinguishable from an app that will not hydrate. Four is clean and no slower. CI keeps the default, where the runner already gets fewer. |
| 2026-09-01 | The empty states link *into* the editor rather than creating a schedule on the user's behalf | "Set up a schedule" opens the panel, which says what to press next. A button that silently creates and names something is a state change the user did not ask for, from a screen whose whole point is that nothing has been set up. |
| 2026-08-26 | ~~Pure engine kept inside `app.js` for now, clearly sectioned~~ | ~~Readable in one sitting while learning.~~ **Superseded 2026-08-26 14:00** — split into eight modules once the file hit 1,710 lines and the pure half had been hand-copied five times. |
| 2026-08-26 | Shared mutable state lives on one exported `store` object, not exported `let` bindings | An ES module import is a read-only live binding, so the editor cannot assign to an imported `let`. The values genuinely get replaced, so they have to be fields on something; one object beat four setter functions. |
| 2026-08-26 | `tick` lives in `views.js` rather than the entry point | The editor requests a repaint after every edit. With `tick` in `app.js` that is a cycle — legal in ES modules, and a reliable source of temporal-dead-zone bugs at module init. |
| 2026-08-26 | This log is maintained per-change, and the rule lives in `AGENTS.md` | A convention that exists only in conversation dies with the session. Encoded as a checked-in rule so it survives context loss and applies to anyone working the repo. |
| 2026-08-26 | **Overlapping periods stay blocked.** The `AGENTS.md` invariant is upheld; the editor mockup's warn-and-allow banner is not built | Allowing overlap means answering "which of two simultaneous periods does the big number count down" — a product question with no obvious answer, for a capability the plan explicitly disclaims. Cost accepted: BellTab cannot represent concurrent lunches. |
| 2026-08-26 | The header gear becomes a back arrow inside settings, and its accessible name changes with it | An icon-only button whose glyph says "back" while its label still says "Settings" is precisely the mismatch that makes icon buttons hostile to anyone not looking at the screen. |
| 2026-08-26 | "The period changed" means a different **block of the day**, keyed on `startMin`/`endMin` — never the rendered name | A half-typed name is a new string on every keystroke, and two periods in one day may legitimately share a name, in which case a name-keyed guard is silent at exactly the boundary the live region exists for. Start/end are unique because periods may not overlap, so they are the only stable identity a period has. |
| 2026-08-26 | Edits are silenced at `refreshResolved`, not by checking `paused` | The bell is *most* useful to a screen-reader user who has settings open and cannot see the countdown — that is why `announce()` sits outside `tick()`'s paused branch. `refreshResolved` is the one entry point every edit funnels through, so the flag suppresses *edits* rather than *settings*. |
| 2026-08-26 | The `showModal` fallback is `window.confirm`, not an unconditional delete | The button's entire contract is that it asks first. Falling through to the action means an irreversible operation loses its only guard on exactly the platforms least able to recover from it — and it made the whole delete flow untestable, since jsdom takes that branch. |
| 2026-08-26 | `#schedule-error` is `role="status"`; `#override-error` stays `role="alert"` | The distinction is *what writes to it*, not what it says. The schedule slot is refilled by `validateDraft` on every keystroke, and an assertive region churned per character interrupts the user mid-word. The override slot is written once, in answer to pressing Add — which is what assertive is for. |
| 2026-08-26 | Error slots are written only when the message actually changes | A no-op write mutates nothing, so a live region announces nothing. This is what makes a polite region survive per-keystroke revalidation: a sentence that stays true across ten keystrokes is announced once. |
| 2026-08-26 | The Day view's running row spells its countdown out — `50m 00s`, not `50:00` | It renders directly beneath siblings `formatDuration` writes as `55m` and `1h`. A units caption fixes the *summary* number, where there is room for one; in a table row the only form that survives the neighbourhood is the one carrying its own units. |
| 2026-08-26 | The DOM wiring test may freeze the clock; the pure engine still must not need to | `tick()` reads the system clock directly — it has to, that is recompute-never-decrement — so a test that asserts a rendered number has to decide what time it is. Only `Date` is faked, never `setInterval`. The engine's own suite keeps taking the time as an argument. |
| 2026-08-26 | Playwright drives the **installed** Chrome via `channel: "chrome"` rather than a downloaded Chromium | Zero browser binaries, and it is the same engine the code review measured in, so the E2E results are directly comparable to the numbers already in this log. The cost is that WebKit — the engine most likely to differ on `<dialog>` — is still uncovered, which is now an open gap rather than an unstated assumption. |
| 2026-08-26 | The dev server is forty lines of Node in `scripts/serve.js`, not a package | A server is required only because browsers refuse ES modules over `file://`. `AGENTS.md` wants this app at 1.0 with approximately zero dependencies and treats every proposed addition as suspect; a static file server is small enough to own. It also fixes `npm run serve`, which pointed at a `serve` package that was never installed. |
| 2026-08-26 | The E2E browser timezone is pinned to `America/New_York` in `playwright.config.js` | A fixed instant has to mean the same wall-clock time on every machine, or a suite that pins the clock to 09:30 tests a different period depending on who runs it. This is a property of the harness, not the app — BellTab deliberately has no timezone plumbing and reads local wall-clock minutes, which is exactly what pinning makes reproducible. |
| 2026-08-26 | ESLint ships now; `eslint-plugin-jsx-a11y` does not | `AGENTS.md` requires the a11y plugin as a blocking check, but it lints JSX and there is no JSX in this build — enabling it would gate on zero files while reading as covered. What ESLint is actually here for is `no-undef`: this build has no compiler, so nothing catches a name that does not exist until a browser reaches it. The a11y half is owed at the port, as a gap rather than a silent omission. |
| 2026-08-26 | `npm audit` gates at `high`, not `moderate` | Every dependency in this repo is a devDependency; nothing here is shipped to a browser. A moderate advisory in a test runner blocking a schedule bugfix trains people to merge past a red check, which is worse than the advisory. |
| 2026-08-26 | Security headers ship in `vercel.json`, not `next.config.ts` | `AGENTS.md` names `next.config.ts` `headers()` because it assumes the Next scaffold. The headers are a property of the **deploy**, not of the framework, and the app is static files today. The file moves at the port; the header list does not. |
| 2026-08-26 | CSP ships with `frame-ancestors 'none'` and nothing else | A CSP carrying only `frame-ancestors` places no restriction on scripts, so it ships the modern half of the clickjacking defence without breaking `index.html`'s inline theme script — the one that has to run before first paint to avoid a flash. A real `script-src` still needs that script's hash, which stays an open gap. |
| 2026-08-26 | `Permissions-Policy` allows `screen-wake-lock=(self)` and `autoplay=(self)` | A blanket deny is the tempting default and would break Phase 6 twice over — the wake lock toggle and the opt-in chime — in the way that is hardest to debug: feature detection succeeds, the call rejects, and the header is nowhere near the code. Denying what the app will never use is free; denying what it has already planned to use is a trap set for a future session. |
| 2026-08-26 | `Referrer-Policy: no-referrer` rather than the browser default | Browsers already strip the fragment from `Referer`, so this changes nothing about the shared schedule today. It costs nothing, and this app is one `fetch` away from leaking a URL designed to carry the user's whole schedule. |
| 2026-08-26 | The Node version lives in `.nvmrc`, read by CI via `node-version-file` | A version pinned inside a workflow is invisible to anyone running commands locally, and drifts from the machine that actually wrote the code. One file, both readers. |
| 2026-08-26 | E2E clock fixtures carry an explicit UTC offset; CI does **not** pin `TZ` | Pinning `TZ=America/New_York` on the runner would also have made CI green, and would have been the wrong fix: it hides the defect instead of removing it, and the next machine that runs the suite — a contributor's laptop, a container, a phone-tethered runner — reintroduces it. An offset on the literal makes the fixture mean one instant everywhere. Leaving the runner on UTC keeps proving that. |
| 2026-08-26 | `openApp` asserts the browser's wall clock matches the fixture | A timezone skew is silent by construction: the suite still boots, renders and asserts, just against a different hour. One assertion at the boundary converts that into a single failure that names the cause, instead of three failures that each look like a separate bug. |
| 2026-08-26 | Period names get `overflow-wrap: anywhere`, not `break-word` | `break-word` wraps a long word but does **not** shrink the element's min-content contribution, so an intrinsically-sized ancestor — here a `1fr` grid column, then `main`, then the body grid track — keeps reserving the unbroken word's full width. `anywhere` is the only value that shrinks min-content too. The global `break-word` on `<body>` stays: it is right for prose, and wrong only where untrusted input meets an intrinsic size. |
| 2026-08-26 | The reflow gate now runs in two clock states, not one | The 60-character-name test passed for a day while the bug it was written to catch was live, because it only ever looked at 09:30. A gate that sees one hour of the school day measures that hour, not the app. |
| 2026-08-26 | **TypeScript is pinned to 6.0.3, not 7.0.2** | `typescript-eslint` throws outright on TS 7 — not a warning, a `throw new Error` at import time — and `eslint-config-next` depends on it, so the entire Next lint config fails to load. The choice was the fast Go-based compiler or the lint stack that carries the accessibility gate AGENTS.md calls blocking. The gate wins: a type checker that is 10x faster is a convenience, and an a11y rule set that never runs is a false claim. Revisit at typescript-eslint#10940. |
| 2026-08-26 | **ESLint is pinned to 9, not 10** | `eslint-plugin-jsx-a11y` has no ESLint 10 support at any published version — its peer range stops at `^9`. Same reasoning: ESLint 10 was chosen arbitrarily a day earlier and nothing depends on it, while the a11y plugin is a stated requirement. |
| 2026-08-26 | `jsx-a11y` **recommended** is spread on top of `eslint-config-next`, which is not redundant | The Next config bundles the plugin and then enables 6 of its 32 recommended rules. The 26 it omits include `label-has-associated-control`, `click-events-have-key-events`, `interactive-supports-focus` and `no-static-element-interactions` — precisely the rules the schedule editor's requirements depend on. Trusting the bundled config would have produced a passing a11y check covering under a fifth of the rule set. |
| 2026-08-26 | `strict: true` in `tsconfig.json`, overriding the `false` Next generated | The engine's core rule is parse-don't-validate: untrusted input narrows once into a branded `ValidSchedule` and nothing downstream re-checks it. That guarantee lives entirely in the type system, and non-strict turns off both halves holding it up — null checks and no-implicit-any. A non-strict build would let an unvalidated schedule reach the countdown and still compile. |
| 2026-08-26 | `headers()` declares **two** sources, `/` and `/(.*)` | With `basePath`, `source` is matched with the prefix applied, so `/(.*)` becomes `/bell/(.*)` and never matches the bare `/bell`. Measured, not reasoned: the page came back with zero of five headers while its assets had all five. See Bugs found. |
| 2026-08-26 | `poweredByHeader: false` | Naming the framework in a response header is not a vulnerability, but it lets an attacker skip straight to that framework's known CVEs. It costs one line. |
| 2026-08-26 | The Next scaffold ships as an **empty page**, with the plain build left running beside it | The roadmap's own Phase 0 gate is "CI green on an empty page". Porting the app in the same change would mean one branch containing a framework migration and four phases of feature work, reviewable by nobody. The plain app keeps its 153 unit and 37 E2E tests green throughout, so the scaffold is provably additive. |
| 2026-08-26 | Dependabot groups **major** action bumps, but only minor/patch for npm | The asymmetry is the point. A first-party GitHub action pinned by major tag has a blast radius of one red CI run — visible immediately, reverted with one commit — so batching majors costs nothing and saves three CI runs answering one question. An npm major can change runtime behaviour in ways a green suite does not catch, so those stay ungrouped and individually revertible. |
| 2026-08-26 | Branch protection leaves **admin enforcement off** | Checked, the rules would apply to the owner too, and there would be no way to unwedge a broken `main` without first going back into settings to switch it off - which is the same bypass, with extra steps and worse timing. Unchecked, the status checks still gate the merge button on every PR; what stays possible is a deliberate direct push by the one person in the repo. The protection that matters here is against a bad merge, not against the author. |
| 2026-08-26 | "Require branches to be up to date" is **off** | It forces a rebase and a full CI re-run every time `main` moves under an open PR. That is correct insurance in a repo with concurrent authors and semantic conflicts; with one author and one PR at a time it buys nothing and spends a browser install per merge. Revisit the moment a second person opens a PR here. |
| 2026-08-26 | The required check list names the four CI jobs plus `Analyze JavaScript`, not the aggregate `CodeQL` check | A required check that does not report on some PR blocks that PR forever. The five named are job names from workflow files in this repo, so they report on every pull request by construction. The aggregate `CodeQL` run is produced by the action rather than by a job we declare, so it is the one most likely to change shape and wedge a merge. |
| 2026-08-26 | CI pairs the `github` reporter with `html` | `github` annotates the failing line in the PR diff but writes nothing to disk, so the workflow's `upload-artifact` step found nothing on the one run where a trace would have saved a round trip. |
| 2026-08-26 | CI is four parallel jobs, not one sequential script | `npm ci` runs four times instead of once, which is the cost. The gain is that a failure names itself in the checks list — "E2E (reflow gate)" is a different conversation from "Lint" — and a slow browser install never delays the answer to "did the unit tests pass". |

---
| 2026-08-27 | The engine's entry points take `ValidSchedule`, not `Schedule` | This is what makes "parse, don't validate" a compiler rule rather than a convention. `stateAt` indexes `periods[0]` and `periods[length - 1]` as the day's first and last bell without re-sorting; that is only safe because the boundary already sorted. Typing the parameter as `Schedule` would have left the guarantee as a comment. |
| 2026-08-27 | The `ValidSchedule` brand's symbol is not exported, so minting needs `as unknown as` | A `unique symbol` property does not "sufficiently overlap" an unbranded object, so TypeScript refuses the single-step cast (TS2352). The double assertion is the point: forging a `ValidSchedule` anywhere outside `parseSchedule` has to be that conspicuous. There is exactly one such line in `src/`. |
| 2026-08-27 | `DayState` is a discriminated union, not one shape with nullable fields | `formatTabTitle` reads `state.current.name` when the phase is `during` and `state.next.name` otherwise. Under `strict`, a nullable record forces a null check at every call site that the union makes unnecessary — and the union also makes a `during` with no `current` unrepresentable rather than merely unlikely. |
| 2026-08-27 | The plain build is retired in the same change that replaces it, not kept alongside | Keeping both would have meant either duplicating the engine (which drifts) or a `tsc` emit step feeding a doomed app. The build log called this in advance on 2026-08-26 17:05; this is the commit that pays it. |
| 2026-08-27 | `src/styles.css` is carried into `src/app/globals.css` rather than deleted with the rest | 1446 lines of implemented design system, most of which is tokens, dark mode, focus rings and the `overflow-wrap` hardening that are useful immediately. CSS is inert without matching markup, so the component rules cost nothing while Phases 2–3 catch up — and rebuilding markup to fit rediscovered CSS is worse than the reverse. |
| 2026-08-27 | The E2E specs that lost their UI are parked with `test.fixme`, not deleted | They encode the two regressions this repo has actually shipped — the Escape/`<dialog>` collision and the per-keystroke announcer. The assertions and the element ids are the contract Phases 2–4 have to meet. Playwright reports them as skipped, so the count is visible in every run rather than silently absent. |
| 2026-08-27 | Playwright runs against `npm run build && next start`, not `next dev` | The Next docs recommend it, and here it earns the cost twice: CSS ordering and chunking only take their final form in a production build, and the reflow gate is a measurement of the CSS that actually ships. A dev server would gate on a stylesheet no user receives. |
| 2026-08-27 | `basePath` is kept out of Playwright's `baseURL` and put on the paths instead | Playwright resolves a relative navigation with `new URL(path, baseURL)`, so a `baseURL` ending in `/bell` plus `goto("/")` resolves back to the origin root — which `basePath` makes a 404. The same applies to `webServer.url`, whose readiness probe treats a 404 as "not up yet". |
| 2026-08-27 | The E2E suite is TypeScript too | `tsconfig.json` includes `**/*.ts`, so `npm run typecheck` now compiles the suite that drives the app with the same settings as the app. A locator typo in a spec is a build failure rather than a runtime one. |
| 2026-08-27 | `allowJs` stays in `tsconfig.json` even though nothing needs it | Removing it does not stick — `next build` writes it back and reformats the whole file on the way through. Documented in the file rather than fought. |
| 2026-08-27 | The house lint rules are re-asserted in a block scoped to `src/**` and `e2e/**`, not by widening the plain-JS block back to the repo | `js.configs.recommended` genuinely should not apply to TypeScript — `tsc` subsumes `no-undef`. `eqeqeq`, error-level unused-vars and `reportUnusedDisableDirectives` are a different question and none of them come from `eslint-config-next`. Splitting them says which half of the Phase 1 narrowing was right. |
| 2026-08-27 | `npm run lint` gains `--max-warnings 0` | Half of finding 2 was severity and half was the runner: `eslint-config-next` reports unused variables at `warn`, and a script with no warning ceiling exits 0 on every one of them. Raising the rule to `error` fixes one rule; the flag fixes the class. |
| 2026-08-27 | `formatDayCaption` is built from `formatRemaining`, not from `splitCountdown`'s raw numbers | The unit used to live in a sibling element (`#day-remaining-units`) that the port deleted. Rebuilding that dependency would mean the caption is only correct if Phase 3's markup remembers to render a second element beside it; spelling the units into the string makes it correct on its own, wherever it is rendered. |
| 2026-08-27 | `parseScheduleCollection` refuses an over-cap list rather than truncating it | The retired `src/store.js` sliced to the cap, silently. A share link carrying 51 schedules is a link the sender can fix once they are told; a link that silently arrives with 50 is one nobody ever finds out about. It also matches how `periods` already behaves one level down. |
| 2026-08-27 | One bad entry refuses the whole collection instead of yielding the good ones | A caller handed three schedules back from a four-schedule import has no way to learn that. `localStorage` still degrades cleanly — a caller that wants "empty state on corruption" reads `ok: false` and starts empty, which is a decision it makes explicitly rather than one the parser makes for it. |
| 2026-08-27 | `next/font` is wired with `variable`, not `className` | `globals.css` already routes every rule through `--font-display` / `--font-body` / `--font-mono`. A `className` on `<html>` sets one family for the whole tree and leaves those three tokens still pointing at fonts nothing loads — the exact state this change exists to end. |
| 2026-08-27 | The tab title is a **rendered** `<title>`, not `document.title = …` | Next's App Router runs a metadata pass after hydration that overwrites an imperative write. Measured, not guessed: a `<head>` MutationObserver recorded `35m · Period 2` immediately followed by `BellTab`. React 19 hoists a `<title>` from any component, so the app owns the tag and `metadata` in `layout.tsx` no longer sets a title. Two owners was the bug. |
| 2026-08-27 | `setInterval(1000)` rather than a `setTimeout` chain aimed at the next wall-clock second | The chain is marginally prettier — the seconds digit would flip when the device's does — but the drift it fixes is sub-second and invisible, while `page.clock.fastForward` walks a chain tick by tick and would render five hours of school day one second at a time. Correctness here comes from recomputing, never from tick alignment. |
| 2026-08-27 | `useNow` returns `LocalNow \| null`, and `null` is what SSR renders | The server has no device clock and is in a different timezone, so any time-derived value rendered there is a hydration mismatch by construction. A placeholder filled in after mount is the only honest shape, and it is what `AGENTS.md` asks for. |
| 2026-08-27 | Phase 2 **reads** the calendar, though Phase 4 owns editing it | The design system's "no schedule today" is one of the five empty states Phase 2 must ship, and it cannot exist without weekday resolution. `resolveScheduleId` and `DEFAULT_CALENDAR` both shipped in Phase 1, so this is wiring, not new behaviour. Nothing is editable. Recorded under **Deviations**. |
| 2026-08-27 | A gap reads "Between periods", not the design document's "Passing" | The seeded schedules model passing as a real period with `kind: "passing"`, so during passing the engine is in its `during` phase and the label is the period's own name. What is left in the `gap` phase is a genuine hole in the day, which may be two hours. Recorded under **Deviations**. |
| 2026-08-27 | The announcer adjusts state **during render**, not in a `useEffect` | An effect would fire on every tick and have to re-derive whether that tick was a boundary — which is the exact shape the keystroke bug had. React documents render-phase adjustment for deriving state from changed input, and it makes "only at a bell" structural. |
| 2026-08-27 | The unit suite is pinned to `TZ=America/New_York` | Same reason `playwright.config.ts` pins the browser. `clock.ts` reads local wall-clock fields, and a UTC runner has no DST transition to assert against — the DST tests would pass by asserting nothing. A property of the harness; nothing under `src/` reads a timezone. |
| 2026-08-27 | Progress-bar width is rounded to a whole percent | An unrounded fraction rewrites the inline style every second, and a 300ms width transition restarted every second is a permanent crawl — which the design system's "nothing may loop, pulse, or breathe" rules out. |
| 2026-08-27 | No Testing Library, no component unit tests, in this phase | The branching is already pure and covered (`today.ts`, `format.ts`); what is left in the components is a real interval, a real `visibilitychange` and a real `<head>`, none of which jsdom models. Playwright with a controllable clock tests those honestly. Phase 3's form is where the dependency earns itself. |
| 2026-08-27 | The editor's fourth field is a LENGTH, not an end time | "Period 2 is 55 minutes" is how a schedule is described, and a duration makes `start >= end` unreachable by typing — the one invalid shape a pair of time inputs can express. The engine still stores `endMin`; `draft.ts` does the arithmetic. |
| 2026-08-27 | Reorder is two buttons that move the CLOCK, not a drag that moves a row | Periods are stored sorted by start, so a list reorder would be undone by the next parse. The pair keeps its own lengths and trades slots, which provably cannot overlap: the new span ends no later than the later period already did. Buttons are also keyboard-operable by construction rather than by bolting a fallback onto a pointer gesture. |
| 2026-08-27 | `localStorage` is read with `useSyncExternalStore`, not `useState` + `useEffect` | The repo's own lint rule (`react-hooks/set-state-in-effect`) refused the obvious version, and it was right twice: the effect cascades a render on every mount, and it models a shared external thing as component state. The correct API takes a *server* snapshot, which is what makes hydration safe — and it buys cross-tab sync for nothing. |
| 2026-08-27 | No Save button, no dirty state | Every mutation runs the draft through `parseSchedule` and commits only on `ok`, so valid edits are already persisted and invalid ones were never anything to lose. That is also what makes leaving the editor mid-error harmless rather than a confirmation prompt. |
| 2026-08-27 | The storage key carries the version (`belltab.v1`), not the payload | A v2 reader looks for its own key, misses, and starts clean — it never has to parse v1's bytes to discover it cannot read them. Same rule as the share payload: never repurpose a number. |
| 2026-08-27 | No tab strip in Settings until there is a second panel | A tablist with one tab is a control that cannot do anything, which is worse than no control. `globals.css` already carries `.settings__layout` and `.settings__tab` for Phase 4. |
| 2026-08-27 | The confirm dialog is re-parked from Phase 3 to Phase 4 | It guards deleting a whole named SCHEDULE, and Phase 3 edits periods within one. Deleting a period is four fields with the result visible immediately behind the editor; interrupting for it would be theatre. |
| 2026-08-27 | The announcer is mounted for both screens, not inside the countdown | A bell that rings while the editor is open is still a bell. An announcer that unmounted with the view would miss it and then come back silent, because its "say nothing on first paint" rule would swallow the boundary it slept through. |
| 2026-08-27 | `#schedule-error` is the editor's only live region; row errors are not live | A row error has a control to point at, so `aria-describedby` reads it at the right moment — when the offending input takes focus. A blank schedule name has no such control, so that one speaks. Hidden with `.visually-hidden` rather than `hidden`, because a live region has to be in the accessibility tree *before* its text changes. |
| 2026-08-27 | Overlap error attribution is left as it is, and the gap closed | Opened 2026-08-26 as a Phase 3 decision. `Array.prototype.sort` is stable, so on an exact start tie the error lands on the row that appears LATER in the editor — which is the row the user just added or just typed into. That is the right row; threading edit state into a pure function would buy nothing. |
| 2026-08-27 | The research directory was copied in WHOLE, not cherry-picked, and the provenance problem solved with an index | Extracting the paragraphs that apply would produce documents nobody could audit: a quote with its context deleted reads as authoritative and cannot be checked against its own source. Copying whole and describing accurately keeps every claim falsifiable. The cost is that the directory is mostly about other repos, which is exactly what `Docs/research/index.md` exists to say. |
| 2026-08-27 | Inherited documents keep their prose; only cross-repo links that resolve to nothing are de-linked | Editing borrowed research to "fit" this repo destroys the thing that makes it worth keeping — that it is a record of what was actually measured somewhere else. A dead link is different: it is not a claim, it is a broken pointer, and leaving it costs a future reader the discovery that the evidence exists at all. Four such links became plain filenames with the owning repo named. |
| 2026-08-27 | Every row of the index's "general advice" table carries a caveat, including the genuinely generic ones | With caveats on only some rows, a blank cell is ambiguous between "checked, nothing to say" and "never looked". Filling all eleven makes the column mean *we read this one*. This is the fix for code-review findings 1, 2, 6, 7 and 8 of 2026-08-27. |
| 2026-08-27 | The two Puzzle-Lab-titled advice documents were NOT moved into the "about OTHER repos" table | That table is for documents *about* another repo — a migration that happened there, a sitemap that describes it. `ai-assisted-nextjs-security-reference.md` and `solo-dev-ai-qa-code-review-playbook.md` are general advice *addressed to* another repo, which is a different thing. Collapsing the distinction would cost the third table the precision that makes it useful; a caveat column buys the same safety without it. |
| 2026-09-02 | The wake lock is a preference, off by default, and Big mode does not turn it on | The research asks for "an explicit toggle", and the toggle is the only place a user can see what they agreed to. Acquiring it automatically on entering Big mode was the tempting default and is wrong twice: it is a demand on somebody's power management that they never made, and it would be invisible — a laptop that stops sleeping with no control anywhere saying why is a bug report nobody can write. The preference persists, so the projector case costs one tick, once, forever. |
| 2026-09-02 | Five statuses rather than a boolean | "The toggle is on" and "the screen is actually being held awake" are different facts, and every real failure lives in the gap: an engine with no API, a device in battery saver, and the ordinary hidden tab that fixes itself. A boolean would have to pick one of those to be silent about. The five are `unsupported`, `off`, `held`, `waiting` and `refused`, and a unit test asserts no two of them produce the same sentence — collapsing the distinction where the user can see it while keeping it in the types is the version of this bug no type checker catches. |
| 2026-09-02 | The wake lock readout is NOT a live region; a separate hidden one speaks only for a refusal | The readout flips between "held" and "waiting" every time the tab is hidden and shown, which is normal, correct and several times an hour. A live region on it would be exactly the per-tick chatter `AGENTS.md` bans on the countdown, and users who are read a status they did not need learn to ignore the line that also reports real problems. What genuinely needs announcing is a box that was ticked and did not take effect, which is otherwise silent — so the polite region carries the refusal and nothing else. |
| 2026-09-02 | `navigator.wakeLock` is STUBBED in the E2E suite, at the boundary | Whether a real lock is granted depends on the OS, the battery and whether the CI runner has a screen — a suite asserting against the genuine article would pass on a laptop and fail on a runner, the same class of problem the clock fixtures exist to solve. `AGENTS.md` permits mocking at boundaries and this is one. What it buys is the three branches no browser in the matrix produces on demand: an absent API, a refusal, and the tab leaving and coming back. What it does not buy is evidence that a real projector stays lit; that is an open gap. |
| 2026-09-02 | Feature detection through `useSyncExternalStore`, not an effect | `"wakeLock" in navigator` is a fact about the environment that the server cannot know, which is the same shape as `localStorage` — and `localStore.ts` already documents why the hook for it is `useSyncExternalStore`: it takes a server snapshot, so both sides render `false` on the first pass and hydration is safe by construction. It also avoids a synchronous `setState` in an effect, which this repo's `react-hooks/set-state-in-effect` rule forbids. |
| 2026-09-02 | The chime, the notification and the announcer share one definition of "the bell" | All three key on `boundaryKey` and speak `announcementFor`, the pair the announcer has used since Phase 2. Three hand-rolled boundary detectors would eventually disagree about what counts as a bell — the first paint, midnight rolling "after" into "before", a renamed period — and a bell that rings when the announcer stays silent is a bug no one test would ever catch. One definition means the surfaces cannot drift. |
| 2026-09-02 | A notification is suppressed while the tab is visible | A toast about the screen the user is looking at is noise; the feature exists for the tab that is open but behind something. The "ready" sentence in the panel says "while this tab is in the background" so the suppression reads as the promise being kept rather than a bug. |
| 2026-09-02 | `notifyOnBell` is stored only after a permission grant | Saving on tick would persist a preference for a feature the user may be about to refuse, and a ticked box over a denied permission is a control that lies. Stored `true` therefore MEANS "granted once", which the status logic leans on: `unasked` can only be reached by the browser's site settings changing underneath a saved preference, never by the app's own flow. |
| 2026-09-02 | A slept-through stretch rings once, for the state being woken into | Jumping from 09:30 to 10:11 crosses two bells; a frozen tab was present for neither. Replaying missed bells would be the decrement mistake in audible form — deriving events from elapsed time instead of recomputing state. One chime for where you are now is the recompute rule applied to sound, and the E2E asserts exactly two oscillator starts for the jump. |
| 2026-09-02 | The chime is synthesised, not shipped | Two sine partials with an exponential decay, built on the one `AudioContext` the page ever creates. No audio file means nothing fetched at runtime (the no-network invariant), nothing to license, and no asset whose bytes need a story in a repo that intends to reach 1.0 with approximately zero runtime dependencies. |
| 2026-09-02 | A Test button beside the chime toggle | The offset shipped without a calibration aid and the gap table has carried that complaint since the day it landed; the chime was not given the same hole. A bell you cannot hear until a real period ends is unverifiable, and the button doubles as the autoplay-unlocking gesture and as a volume check — and commits nothing, which its E2E asserts. |
| 2026-09-02 | `blocked` outranks `off` in the notification status | Once permission is denied, re-ticking the box cannot even raise the prompt — the ask resolves denied with no UI — so the box is disabled and the sentence points at the browser's site settings, the only lever that still exists. Showing this before the user ticks anything spares them discovering it by the box refusing to work. |
| 2026-09-02 | The PWA ships a manifest and no service worker | Chrome stopped requiring a SW for installation when it dropped the offline-capability check, so the manifest alone buys the whole ask — an icon, a window, a home-screen entry. What a SW would add is offline caching, which the research doc explicitly says not to over-invest in (there is no server to be offline FROM), plus an update lifecycle that is a famous way to serve stale HTML after a deploy. The one real thing it would buy — Android notifications — keeps its open-gap row, now with the price written on it. |
| 2026-09-02 | One SVG glyph is the source of every icon, rasterised by a committed script | `src/app/icon.svg` is the design; `scripts/render-icons.mjs` screenshots it at five sizes through the Playwright already in devDependencies, so no image library joins the repo for a file that changes roughly never. The PNGs are committed rather than built: a build step needing a browser binary would slow every CI run to regenerate identical bytes. Maskable variants keep the bell inside the central safe zone at 56%; the plain set sits at 72%. |
| 2026-09-02 | The manifest's colours are pinned to the live `--paper` token by a test | `background_color` and `theme_color` paint the splash and the installed window's chrome before any CSS loads, and nothing else would notice them drifting from the palette. `e2e/pwa.spec.ts` reads the computed `--paper` off the real page and asserts the manifest matches, so a palette change cannot leave the splash behind. One colour, the light paper: the manifest predates dark mode and takes a single value, and the page re-themes the moment it paints. |
| 2026-09-03 | A period's kind is free text with built-in suggestions, not a closed list | The user's ask was "planning and other custom fields", and a `<select>` of three cannot say what a building calls its own blocks. The only thing the engine ever asks of a kind is "is this Passing?" (the seam that "3 of 7" does not count), so nothing downstream needs an enum. The editor's box is a text input with a `<datalist>` of eight built-ins; anything else is kept as typed, trimmed, capped at 24 characters — a category word, not a sentence. |
| 2026-09-03 | Built-in kinds are normalised to a canonical spelling at the parse boundary — and that IS the migration | Every schedule stored or shared before 2026-09-03 says `"class"`; the parser now maps a built-in's lowercase form to `"Class"`, so old data, old links and freshly typed `"CLASS"` all land on one spelling the engine and the editor agree on. No storage key bump and no share version bump: the change is strictly widening — everything the old parser accepted, the new one accepts and means the same by — which is the same precedent Phase 4 set when it added schedule ids leniently. What it costs is a pre-2026-09-03 build refusing a new link that carries a custom kind, with the wrong error; no such build is deployed. The fixture file's expectations were edited for the first time, and its header says exactly what changed and why the payloads' meaning did not. |
| 2026-09-03 | The end box is a view of `start + length` that can also be typed into; length stays what the draft believes | Three boxes, two degrees of freedom, and the rule for which one gives way is "the box you did not touch that is furthest from what you meant": a length moves the end, an end moves the length, a start moves the end and keeps the length. Length stays the truth because it is what makes `start >= end` unreachable by typing a duration, and because `movePeriod` trades slots by length. An end typed before the start reaches the parser as a negative length and comes back as "has to end after it starts", bound to BOTH boxes — the one schedule a length box could never express, and the reason the end box was worth adding: "until 10:05" is how a schedule is read off a wall, and the subtraction is the app's job. |
| 2026-09-03 | The editor stacks at 56rem, up from 45rem | Seven columns instead of six: the fixed columns now sum to 39.25rem plus gaps, and at 45rem the name field was left under 3rem. Stacking is always safe, so the threshold errs wide; the settings layout's two-column arrangement now holds a stacked editor between 45 and 56rem, which is fine — it was sized for the editor's width, not its shape. |
| 2026-09-03 | A refused wake lock is retried on the next user gesture, not on a power/online event or the next period boundary | There is no event for "battery saver went off"; `online` is about the network and a period boundary is minutes away. The next thing the user does is the honest moment to ask again, and it is the same recovery the chime already uses for its autoplay lock — now through one shared `listenForGesture`, so "a gesture" is defined once. The listener exists only WHILE refused: attached for the life of the preference, every keystroke under a permanent denial would be a rejected wake-lock IPC for an answer already known. |
| 2026-09-03 | The Big mode → wake lock signpost is a sentence with a link-styled button, not a second pill | Two pills side by side read as a two-state switch, which is exactly what Big mode was built not to be. Advice is not a control of equal weight. Shown for `off` AND `refused` — the ticked box whose projector is likeliest to go dark — through a predicate (`wantsSignpost`) rather than an equality, so a sixth status has to be given an answer instead of silently hiding the sign. |
| 2026-09-03 | In the schedule picker, selection follows focus, and the arrows stop at the ends | Selection is cheap — it repoints the editor, nothing is saved — so making the arrows select as they move costs the user nothing and saves a Space press per chip, which is the ARIA tabs convention for exactly this shape. Clamping rather than wrapping keeps "where am I" answerable from the keyboard: an arrow that does nothing at the end tells you where the end is. |
| 2026-09-03 | The weekday of an ISO date is arithmetic on the string, never a `Date` | `new Date("2026-09-14")` parses as UTC midnight, and `getDay()` answers in the device's zone, so west of Greenwich the evening before comes back — one day off for every user this app is likeliest to have. Sakamoto's method on three integers cannot see a timezone at all, and the test pins the fixtures' known weekdays plus a leap day. The same reason the app stores wall-clock minutes and never a `Date`. |
| 2026-09-03 | The crossfade is keyed to the boundary, not triggered by the tick | `NowView` puts `key={boundaryKey(state)}` on the period name, so a period change REMOUNTS the element and its CSS animation runs exactly then; the per-second repaint touches other elements and never restarts it. No JavaScript animation, no timer, and both reduced-motion paths (the OS media query and the in-app attribute) collapse it to 0.01ms with the same rule that covers everything else. |
| 2026-09-03 | The large-offset warning is a sentence, not a lower cap | A building whose bells really are ninety seconds out is still real, so ±300 stands. What was missing was the distinction, said where the number is: at a minute or more the offset has stopped being a correction and started being a schedule edit made in the one place that does not travel in a link. |
| 2026-09-03 | Past exceptions are pruned by a button, not automatically | Automatic pruning would delete data on a schedule the user never chose — a load, a midnight — and a calendar exported yesterday would differ from the one on screen today for no visible reason. A button that names the count and does one thing keeps the deletion a decision. |
| 2026-09-03 | `kind` is descriptive only — the engine no longer reads it | `blockPositionAt` was the one engine consumer ("is this Passing?" for the retired Day view's "3 of 7" counter) and it went with that view's residue. Keeping a semantic alive for a feature that does not exist would have meant keeping the function alive for the test that proved it. The comment on `PERIOD_KINDS` now says where the semantic would return if a strip or a counter is ever rebuilt. |
| 2026-09-03 | Parked rows are decided, not carried | Five rows had sat in Open gaps under "left rather than swept up, because deleting is a different decision from deleting the code that stopped using it." That was right for the sessions that made them — and wrong to leave for six weeks. The decisions: delete the Day view's dead code and CSS (history keeps it), and move the three design calls (am/pm, Big mode reload, Big mode fullscreen) to the roadmap's Deferred table, each with the condition that would reopen it. An open-gaps row with no owner and no trigger is a decision nobody made. |
| 2026-09-03 | An empty state may carry a quieter second route, as a link-weight button under the pill | "No school today" has two honest answers — a one-off exception, or a weekday that runs school — and the pill can only be one of them. A second pill would make the screen a choice; a sentence-weight link beneath it makes it an escape hatch. It opens the same panel with focus placed by id on the section that answers it, through the same `openSettingsFrom` the signpost uses. |
| 2026-09-04 | The calibration button measures against the NEAREST bell and refuses beyond the cap | Every period's start and end is a bell, so the nearest one is the only sensible reading of "the bell just rang". Beyond ±300 seconds the press is a mistake, not a measurement — 09:30 is twenty-five minutes from either bell — and storing five minutes of "correction" would be the exact confusion the large-offset sentence warns about. The refusal goes through the offset's existing polite region: one region, two reasons the thing you just did had no effect. |
| 2026-09-04 | `calibrateOffset` takes the cap as an argument | The first draft imported `BELL_OFFSET_LIMIT_SEC` from `src/app/_lib/preferences` into `src/lib/`, which is the engine reaching into the app. A parameter keeps the layer rule intact and the function testable with any cap. |
| 2026-09-04 | Settings copy speaks to a broader audience: shorter sentences, second person, contractions, plain words | The panels had been written in the build log's own voice — "honoured", "judders", "falls back to no school" — which is right for a decision record and wrong for a teacher setting up a projector. Rewritten to say the same true things more simply: every fact the sentences carried (only while the tab is open; the offset stays on this device; importing replaces everything) is still there. The status sentences keep the words the tests and the code key on — "refused", "Battery saver", "asks again", "site settings", "background" — so the wording could change without the contract changing. |
| 2026-09-04 | The Day view's summary is one caption line, not the retired build's big number | The retired build put a second large countdown at the top of the list, with its units and a label beside it. The Now view already owns the big number, and a second one a tap away is two clocks to disagree. `formatDayCaption` — "2 of 7 · 5h 00m until dismissal" — carries the unit in words so "5h 00m" cannot be read as 5:00, and says the one thing the countdown does not: how far through the day this is. |
| 2026-09-04 | Now/Day is a pressed pair; Big mode stays one button in and one out | The 2026-09-02 decision refused a two-state switcher whose second state was "normal". Day is a real second destination, so the pair earns its `aria-pressed`. Big mode is still a MODE over the countdown - entering it shows the Now view whatever the pair says, and leaving it comes back to whichever screen was up. |
| 2026-09-04 | Finished periods collapse by default, and the collapse is off once the day is over | So the running row sits at the top of the list, which is where a glance lands. The retired build did the same. A finished day with every row behind a toggle would be a list of nothing, so after the last bell every row shows and reads "done". |
| 2026-09-04 | The period strip is a PREFERENCE under the countdown, not a third screen | The user asked for it as "an alternate Now view" - the day as blocks with progress through them, horizontal. It reads the same clock as the countdown and sits under it, so a screen of its own would be a switcher position for a second reading of the same number. A checkbox in Preferences ("Show the day as blocks") puts it under the countdown for the people who liked it, off by default because the countdown is the product. The Day view stays the readable version; the strip is `aria-hidden` and its caption says the position in words. |
| 2026-09-04 | Hovering a square borrows the caption; nothing gets a tooltip or a tab stop | The plain build's own choice, kept: no positioning code, no new focus stops in a strip that is decorative by declaration, and it works on a touch tap. The Day view carries the same labels for everyone who is not pointing. |
| 2026-09-04 | Settings copy, second pass, in the user's own words | "Periods stay in start order and can't overlap. Changes save automatically. The countdown runs on the most recent valid version of the schedule." "Each weekday uses its default schedule unless a dated exception says otherwise. If neither is set, there's no school that day." The bell offset stops asking a question and says what it does. The first pass had made the sentences friendlier; the user wanted them plainer still, and supplied the shape. |
| 2026-09-04 | A service worker after all — with no fetch handler, registered only after a grant | The 2026-09-02 decision refused a service worker because of what one does to caching: serve last week's HTML after a deploy. That reasoning was about the FETCH handler, and this worker has none — it exists for the one thing with no other route, `showNotification` on Android, where `new Notification()` throws from a page. Registered only once notifications are on and granted, so a user who never asked carries no worker. Not a reversal; a narrowing, and the earlier row is left standing because its reason still holds. |
| 2026-09-04 | Open gaps holds work; Known limits holds facts | Eight rows had sat in Open gaps that no action could close — an upstream peer range, a spec limit, a platform behaviour — beside rows that were an afternoon's work. A reader could not tell which was which, and the table's job is to say what is owed. The facts moved to their own section with their original dates and text, each with what would change it. |
| 2026-09-04 | The strip is the period progress bar broken into blocks - edge to edge, proportional, dashes for passing | Superseding the retired build's equal, capped, centred squares and the "how many left, not how long left" reasoning behind them. The user's memory of the strip was a bar spanning the card left to right with dashes where the block type changed, and that is the better design: it takes the progress bar's place rather than adding a second thing under it, each block is as wide as it is long so lunch reads as half a class, and a passing period is a dash between the blocks it joins. The old objection - proportional cells make passing an unreadable sliver - was right, and the dash is what answers it. |
| 2026-09-04 | Accepting a shared schedule makes it today's, as a dated exception | The first version added it to the library and opened the editor, leaving the countdown on the regular day - so the person who clicked a link to see a schedule saw a different one. The link is about today, so today gets an exception pointing at it and the countdown swaps at once; the weekday default is untouched, so next week is still the regular day. The offer's sentence now says so. |
| 2026-09-04 | A shared schedule is SHOWN the moment its link opens; "Keep it" writes it, "No thanks" puts the regular day back | The first two versions offered it in a banner over the regular day and swapped only after Add - and the user opened a link, saw the regular day and called it confusing, twice. The link is the schedule; the page should be running it before anybody is asked anything. So while an offer is pending the countdown, the title, the Day view and the strip all compute from the offered schedule on the same clock, and nothing is written until they choose. |
| 2026-09-04 | A seam between back-to-back blocks of different kinds | Period 3 runs straight into A Lunch with no passing between them, and without a mark the two read as one long block. A seam - shorter and fainter than a passing dash, because it marks a change of kind rather than a hallway - draws the boundary. Asked for as "dashes to separate by type"; "not necessary", and cheap. |
| 2026-09-04 | The strip draws a dash only where the KIND changes; passing periods are the gaps | Superseding the same-day decision above (a dash per passing, a seam per kind change) - two vocabularies for one line. The user's rule is simpler and reads better: Planning, dash, a run of classes, dash, Lunch. A passing period is not drawn at all; the gap between two blocks is the hallway. Seven blocks for eleven periods on the seeded day, and exactly two dashes. |
| 2026-09-10 | The closing review RECORDS its findings and fixes none of them | Asked for as "one last code review … and then consider project closed". A review that also fixes is two changes under one title, and the 2026-09-04 audit's shape - findings written as found, each fix its own PR with its own negative control - is what made that audit's severity correction (B2) possible. Every finding is in Open gaps with a file and line, so closing the project on this commit leaves an honest ledger rather than a clean one. |
| 2026-09-10 | Every static finding that could be checked in a browser was, before it was written up | The static-bugs pass reads code and runs probes; it does not see a page. Three of its five findings (P1 focus on load, P3 the empty 24:00 end box, P4 the offset ringing a bell) were reproduced in the live preview before being rated, and P4 moved from "plausible" to "confirmed" because of it. A review that is about to be the last word should not rate what it has not seen. |
| 2026-09-10 | 1440 is refused at the boundary rather than taught to the rollover | Two ways to make a 24:00 end honest: refuse it, or let the first tick of a new day ring the previous day's dismissal when the last state was `during` a period ending at 1440. The second is the truer model and costs a special case in `useBellCrossings` (which currently treats `toSec <= fromSec` as a date change, never a bell), one in the announcer, and a `formatClock` that can say "24:00" - all to serve a schedule no school has. The first is one constant, one sentence, and closes the editor's empty end box and the "12:00" label in the same stroke. A link carrying 1440 now fails to parse with a sentence about midnight; none is known to exist, and "a format you support forever" is about the SHAPE of the payload, which is unchanged. |
| 2026-09-10 | The focus test asserts what IS focused, not what is not | Big mode's "does not steal focus on first paint" checked only its own button, and the gear was focused one selector away for six phases. The new test in `editor.spec.ts` asserts `document.activeElement === document.body` after `openApp`: the only assertion that fails for ANY stolen focus, not just the one somebody thought of. Negative control: with the guard commented out it goes red, naming the gear. |
| 2026-09-10 | Intensive throttling is now a measurement, not a citation | The preview tab sat hidden for the middle of the session and Chrome throttled its one-second interval to about once a minute; a synthetic `visibilitychange` brought every surface current in one repaint. This is the research's central claim, observed on a real engine for the first time in this repo, and it is recorded in the audit (§5.4) as the evidence behind the first invariant rather than as a finding against the app. |
| 2026-09-08 | Scope the E2E job by ENGINE, not by test priority: Chrome alone on pull requests, all three engines on every push to `main` and nightly; workers at 100% on CI as a measured experiment | Audit S8 wanted the 7m53s job shorter, and the owner's first idea was high/medium/low tiers. The research in `Docs/research/e2e-ci-runtime.md` argues the tiers away: a cut on "which tests are low-risk" is a judgement that drifts and nobody revisits, while a cut on the engine axis is exact - a PR knows precisely what it did not check - and self-correcting, because the full run has a fixed cadence. One job under the one required name, never a matrix: per-engine job names would never report to `E2E (reflow gate)` and every PR would hang, which this repo has met once already. Build reuse and sharding wait until the Chrome-only run is measured, in the research's own order. |

## Deviations from the plan docs

Recorded so they get folded back in rather than quietly diverging.

### The tab title separator — RESOLVED 2026-08-26 15:38, code moved to the spec

Found 2026-08-26 15:30 while making the README accurate, not by a test.

`formatTabTitle` emits `43m - Period 2`. The plan, the roadmap, the README and
the design system all specify `43m · Period 2`, and the design system is the
document that chose it:

```text
Docs/belltab-plan.md:14        43m · Period 2
Docs/belltab-plan.md:160       **Number first:** `43m · Period 2`
Docs/roadmap.md:82             number first: `43m · Period 2`
Docs/design/design-system.md:159   `43m · Period 2` — number first
README.md:9                    43m · Period 2
```

Four documents agreeing is not an ambiguous spec; the code is simply behind it.
Recorded rather than fixed here because it changes user-visible output, and this
branch is about closing code-review findings — a one-character behaviour change
riding along in that squash commit is how a diff stops being reviewable.

**Resolved 2026-08-26 15:38.** `formatTabTitle` now emits `43m · Period 2`, and
`Done · BellTab` with it — the empty-state title is not specified anywhere, but
leaving it on a hyphen would have put both separators inside one function.

The estimate of "one character plus two test strings" was wrong: there were
**four** assertions pinning the hyphen, not two. `grep` for `43m - Period 2` and
`Done - BellTab` found the two that spell the whole string; `"1m - Period 2"`
and `"10m - Period 1"` belong to the `Math.ceil` and next-period cases and only
turned up when the suite went red. A small lesson about scoping a change from a
grep for the *example* rather than for the *shape*.

Worth recording that `formatDayCaption` and `formatPeriodLabel` were already
using `·`. The tab title was the only string in `format.js` that was not, which
is what a spec violation usually looks like from the inside — locally
consistent, globally odd.

Verified in Chrome: `35m · Period 2` during a period, `60m · Period 1` before
the first bell, `Done · BellTab` after the last.

### Overlapping periods — RESOLVED 2026-08-26, invariant upheld

**Resolution (2026-08-26 12:58):** overlaps stay **blocked**. The `AGENTS.md`
invariant is upheld and the mockup's warn-and-allow banner is not built. The
editor blocks at input time and names the colliding period, per the design
system. The Schedules editor is no longer blocked by this.

What this costs: BellTab cannot represent a school with genuinely concurrent
lunches. That is the stated non-goal, accepted knowingly rather than by
oversight. Reversing it later means deciding which of two simultaneous periods
the countdown counts down and what the strip shows — the analysis below stands
as the record of that cost.

The original entry follows, superseded but kept, because deleting it would
delete the reason the current answer exists.

#### Original entry — the conflict as first raised

`AGENTS.md` states as a domain invariant:

> **Periods within a schedule may not overlap.** This is a deliberate product
> decision, not an oversight. […] real schools run concurrent lunches and […] a
> general tool would need to allow classified overlaps; **BellTab is not that
> tool.**

The editor mockup supplied on 2026-08-26 shows a **warn-and-allow** banner —
*"A Lunch overlaps Period 4 — keep if these run at the same time"* — which is
exactly the classified-overlap tool the invariant rules out.

**Why it is not a small change.** `stateAt` returns *the* current period and
stops at the first match; `periodStatusAt` assumes one answer; the strip assumes
one cell is current; and a check in the suite asserts no second of the day ever
has two current periods. Allowing overlap means deciding which of two
simultaneous periods the big number counts down, and what the strip shows.

**Status:** ~~raised with the user, not yet decided~~ — superseded by the
resolution above.

### Countdown color vs. the design system

`Docs/design/design-system.md` §5 specifies the remaining-time number as
butterscotch. On the light `--paper` background that measures roughly **1.9:1**
contrast, and `--butterscotch-dark` only reaches about **2.9:1** — both below the
**3:1** floor the same document sets for large text in §6, which explicitly
flags butterscotch-on-paper as "the pair most likely to fail quietly".

**What we shipped:** the number uses `--fg` (ink in light, cream in dark), and
butterscotch is spent on the progress fill instead. This also matches the
supplied mockups, where the number is near-white.

**Owed:** either amend the design system, or find a darker accent that clears
3:1 and keeps the biscuit character.

### Roadmap phase order

We are building a plain-JS spike of **Phase 2 (the countdown)** before
**Phase 0 (the Next.js scaffold)**. Phase 0 is not cancelled — it is deferred
until the plain version has taught us the shape.

---

### E2E coverage narrowed at the port — 2026-08-27

`Docs/roadmap.md` records 37 Playwright tests as a Phase 0 achievement, and
`AGENTS.md` calls the reflow gate blocking. Phase 1 retired the UI those tests
drove, so the suite is now **11 live and 37 parked**. The reflow gate still runs
at all five widths, but against a shell rather than against three views, three
settings panels and a modal.

**What is owed:** Phase 2 revives the announcer block and the Now/Day reflow
tests; Phase 3 revives the editor and confirm-dialog blocks; Phase 4 revives the
calendar panel. Each is a `test.fixme` to delete, not a test to rewrite.

### `stateAt` takes seconds, the roadmap says minutes — RESOLVED 2026-08-27 13:06

`Docs/roadmap.md` Phase 1 specifies `stateAt(schedule, minute)`. The
implementation is `stateAt(schedule, nowSec)`, seconds since local midnight,
carried over unchanged from the plain build.

**Why:** storage is minutes — that invariant is untouched, and periods are still
minute integers. The countdown is not: it displays `43:12`, and a minute-
resolution engine could not produce the seconds place. The multiply happens once
at the engine's front door.

**What is owed:** a one-line correction to the roadmap's Phase 1 bullet. Left as
a deviation rather than silently edited, because the roadmap's wording is what a
reader checks the code against.

**Resolved 2026-08-27 13:06:** the correction is in `Docs/roadmap.md` Phase 1,
written as an explicit *"Corrected from `stateAt(schedule, minute)`"* note
rather than a silent edit, so the reason survives next to the signature. The
code did not move; the doc did.

### The gap label — 2026-08-27

`Docs/design/design-system.md` gives the between-periods empty state as
`Passing — Period 3 in 4m`. The app renders **"Between periods"**.

The two are not describing the same thing. All four seeded schedules model
passing as a real period with `kind: "passing"`, so while passing is running the
engine is in its `during` phase and the label shows the period's own name —
"Passing" — exactly as the design document wants. The engine's `gap` phase is
what is left over: a hole a schedule simply does not cover, which the plan
explicitly permits and which can be two hours long. Calling that "Passing" is a
lie the label is free to avoid.

**Owed to reconcile:** either the design document gains a sentence separating the
two cases, or the app is given a way to tell a short gap from a long one. The
former is likely right. Not blocking.

### The calendar is read a phase early — RESOLVED 2026-09-01, the UI caught up

`Docs/roadmap.md` puts the weekday map and date overrides in Phase 4 and says
Phase 2's schedule is hard-coded. Phase 2 ships `_lib/today.ts`, which resolves
the current day through `resolveScheduleId` against `DEFAULT_CALENDAR`.

The reason is the empty states. Phase 2 owes all five, and "no schedule today"
cannot be produced by a hard-coded single schedule — every hour of every day
resolves to *something*. Weekend resolution is the only thing that makes the
screen reachable, and both pieces it needs shipped in Phase 1.

The schedule library is still frozen at `DEFAULT_SCHEDULES` and nothing in the
UI can change either it or the calendar, which is the part Phase 4 owns.

**Owed to reconcile:** Phase 4's entry in the roadmap should say "the editing UI
for the calendar", not "the calendar". Done in the same change.

**Resolved 2026-09-01.** Phase 4 built that UI, so the deviation is closed from
both ends: the roadmap said "the editing UI" and the editing UI now exists. The
reading half turned out to have been the right call in the other direction too —
`resolveScheduleId` and `parseCalendar` had been exercised by the empty states
for a week before the panel that writes to them was built, so the calendar panel
landed on a resolver that was already proven rather than on one being written
under it.

### The editor's reorder is not a list reorder — 2026-08-27

`Docs/belltab-plan.md` and `Docs/roadmap.md` both list "reorder" among the
editor's operations, alongside add, rename, retime and delete. What shipped
moves the *times*, not the rows.

There is no way to do otherwise. Periods are stored sorted by start
(`parseSchedule` normalises), so a reorder that only moved a row in the list
would be silently undone the moment the draft was re-parsed. The move therefore
swaps a period with its neighbour and gives each the other's slot, keeping its
own length.

**Owed to reconcile:** the plan's one-word "reorder" should say what it means
here. Not blocking, and the behaviour is what a user wants either way — "move
Lunch before Period 3" is a statement about the timetable, not about a list.

### Big mode was never in the plan's Phase 6 — 2026-09-02

`Docs/belltab-plan.md` listed Phase 6 as "bell offset, wake lock, chime and
notification, PWA manifest, theme". Big mode is not in that sentence and never
was. What it was in: `globals.css`, which has carried `body.is-big` and eleven
sibling rules since the plain build was retired, and `e2e/reflow.spec.ts`, whose
parked block named **Phase 6 (Big mode)** as the phase that would revive it.

So two of this repo's own artefacts asserted a scope item the authoritative
scope document did not contain, and had done since Phase 1. The roadmap's Phase
6 bullets did not mention it either — which is how a parked test came to name a
phase that had not agreed to revive it, the mirror image of the Day view problem
recorded on 2026-09-01 (a parked test naming NO phase).

It was surfaced rather than assumed: the recommendation for what to build next
flagged the discrepancy and said one of the two had to be wrong. The user's
answer was "big mode is in", so it was built.

**Owed to reconcile: done.** `Docs/belltab-plan.md` now names Big mode in Phase
6, with a dated note saying it was added late and pointing here.

**Lesson:** a parked test is a promise, and a promise needs somebody on the
other end of it. "Every parked block names the phase that revives it" was the
rule this repo adopted on 2026-09-01, and it is not sufficient on its own — the
phase has to name the block back. Checking that the plan agrees is the missing
half.

### The Phase 7 gate asked for a locked origin, and the recipe forbids one — corrected 2026-09-02

`Docs/roadmap.md` Phase 7 gated on "the origin host still locked to direct
traffic". Custom production domains are exempt from Vercel's Deployment
Protection, and that exemption is the entire mechanism by which the hub's proxy
reaches the origin — so a locked origin host and a working rewrite are mutually
exclusive, and Puzzle Lab's `origin-puzzles` has been publicly reachable all
along. The gate wording is corrected to what the recipe actually delivers:
per-deployment URLs locked, origin public, canonical carrying the duplicate
address. Owed and delivered in the same change: the canonical shipped in PR #34
before the origin ever served.

### The Day view was owed by the port and never delivered — rebuilt 2026-09-04

The 2026-08-27 retirement note said the plain build's behaviour — "three views,
the editor, the calendar, preferences" — was owed back by Phases 2–4. Two of
the three views came back; the Day view did not, because no phase in the
roadmap named it and the roadmap is what the phases were built from. On
2026-09-01 its parked tests were deleted "because no phase named them", which
turned an unkept promise into a non-decision, and on 2026-09-03 the residue
went with it as dead code. The user asked where it had gone; this is the
answer, and the view is back as Phase 8. The lesson is one the log had already
half-recorded on 2026-09-02 about Big mode: **a parked block has to name the
phase that revives it, AND the phase has to name the block back** — and when
neither does, the block is not "deferred", it is lost.

### `endMin` may be 1440, the plan said — RESOLVED 2026-09-10, the plan corrected

`Docs/belltab-plan.md` gave `startMin` and `endMin` as integers in `[0, 1440]`,
and `toMinuteOfDay` in `parse.ts` implemented exactly that, with a comment:
"Midnight-as-end (1440) is legal; as start it is not."

The closing review found 1440 was legal only there. `secOfDay` runs 0 to 86399,
so a day whose last period ends at 1440 has no second on which it is over: the
`after` phase, "School is out.", `Done · BellTab` and the dismissal bell were
all unreachable (Q1, confirmed live across midnight). `<input type="time">`
cannot hold "24:00", so the editor rendered such a period with an empty end
box and no error (P3, confirmed live). And `formatClock(1440)` read "12:00"
in 12-hour mode, so 23:00–24:00 was labelled `11:00–12:00`. One value the
parser accepted and three surfaces could not show.

**Resolved 2026-09-10:** the parser refuses 1440 with its own sentence ("A
period has to end before midnight."), the draft's `endOf` blanks an end that
lands on it, and the plan now reads `[0, 1439]` with a note pointing here. A
share link or backup carrying `endMin: 1440` - none is known to exist, and no
seeded, fixture or realistic schedule has one - now fails to parse with that
sentence rather than silently never ending. The alternative, teaching the
rollover to ring the previous day's dismissal, would have been the more
correct model and would have touched `useBellCrossings` and the announcer to
serve a schedule nobody has; recorded in Decisions.

## Known limits

Facts about the platform, the toolchain or the deploy that this repo has
checked and cannot change. They were rows in **Open gaps** until 2026-09-04,
when a pass over that table found the work and the facts had become hard to
tell apart. Each keeps its original date and text; each says what would change
it. None is a task.

| Recorded | Limit | Notes |
| --- | --- | --- |
| 2026-08-26 | TypeScript is a major version behind on purpose | 6.0.3 rather than 7.0.2, because `typescript-eslint` cannot load under TS 7. This is a real cost — TS 7 is the Go rewrite — and it is deliberate, not neglect. Revisit when typescript-eslint#10940 lands; the upgrade should be a one-line version bump plus a full lint run. |
| 2026-08-27 | `next build` now needs the network | `next/font/google` fetches the three families at BUILD time. Runtime is still network-free — that invariant is untouched, and the emitted HTML was checked for Google hosts — but an offline `npm run build` now fails where it used to succeed. Next caches the downloads, so this bites a cold checkout rather than a rebuild. Self-hosting the `.woff2` files in-repo with `next/font/local` would remove it; not done, because it means committing binaries and hand-tracking upstream revisions. |
| 2026-08-27 | Next ships a live region we did not write | `div#__next-route-announcer__` is `aria-live="assertive"` `role="alert"`, injected by the App Router after hydration and not removable. It should stay silent — one route, no client navigation — but `AGENTS.md`'s "never wrap the countdown in a live region" now has a framework-owned region on the page to coexist with. The announcer spec enumerates it so a second one cannot arrive unnoticed. |
| 2026-09-01 | "WebKit" is not one browser, and none of them is Safari | Measured, not assumed: the development machine's WebKit build reports `type === "text"` for both `<input type="time">` and `type="date"` and renders bare text boxes; the Linux CI runner's build implements them. Real Safari has shipped `type="time"` since 14.1 and is a third thing again. The app handles all of it — the parser was always doing the work — but any sentence of the form "X works in WebKit" now has to say which WebKit, and none of them is evidence about a Mac. |
| 2026-09-02 | The page ships an unhashed inline script, and the CSP still carries no `script-src` | Half of the 2026-08-27 gap this replaces. The toggle and the pre-paint application both exist now; what does not is the hardening they were supposed to arrive with. The reason is measured and is in the Decisions table: Next's own two inline scripts cannot be hashed from `next.config.ts`, and the nonce that would fix it needs middleware this repo bans. What would change the call is Next shipping a nonce path that is not middleware, or `output: "export"` growing one. Until then the CSP is `frame-ancestors 'none'` and the honest statement is that this app has no script policy at all. |
| 2026-08-27 | Three pieces of cited evidence live in the Puzzle Lab repo, not this one | `multi-zone-migration-safety-review.md` marks its rate-limit finding **VERIFIED** against method and numbers in `src/lib/rate-limit.md`; `multi-zone-cost-and-alternatives.md` reverses its own earlier position on the authority of `puzzle-lab-hub-merge-research.md` and `vercel-cron-deployment-protection-outage.md`. All three files are real and all three are one repo away. The broken links are fixed — they now name the repo — but the claims remain unauditable from inside BellTab. Copying the three in would fix it and would also import three more documents about someone else's stack; not done, and the tradeoff is the reason. |
| 2026-09-02 | The chime's `locked` sentence is all but unobservable | Reaching the panel takes a click or a keypress, and either one is the gesture that unlocks the chime — so by the time the readout is visible it says "ready". The sentence still earns its place (a refused `resume()` under an OS-level block would land there and stay), but no E2E can show it through the UI, and the suite says so where it asserts the behaviour instead. |
| 2026-09-02 | The origin host is publicly reachable, and cannot not be | `origin-bell.biscuitlab.net/bell` serves 200 to anyone, as `origin-puzzles` always has: custom production domains are EXEMPT from Deployment Protection, and that exemption is precisely why the hub's proxy can reach the origin at all. What IS locked is every per-deployment `*.vercel.app` URL (302). The roadmap's gate line "origin host still locked to direct traffic" was written before the recipe was understood and asked for something the recipe forbids; corrected 2026-09-02, and the canonical (`biscuitlab.net/bell`) is the mitigation for the duplicate address — which is the reason it shipped in the same phase. `belltab.vercel.app/bell` is public too, exactly as `puzzle-generator.vercel.app` is; same mitigation. |

## Open gaps

| Opened | Item | Notes |
| --- | --- | --- |
| 2026-08-27 | There is no undo | Deleting a *period* is still immediate and unconfirmed, and the only way back is to retype it. Deliberate for a four-field row whose result is visible behind the editor. Deleting a whole *schedule* now goes through a modal confirmation, which is the half of this gap Phase 4 closed; a real undo is still owed and would remove the need for the dialog. |
| 2026-09-01 | An import cannot be undone | It replaces every schedule and the whole calendar, behind a confirmation that says so. Exporting first is the answer the panel gives, and it puts the export above the import for that reason. A real undo would be better and is the same gap as the one open for deleting a period. |
| 2026-09-10 | Changing the bell offset can ring a bell | P4. `useBellCrossings` compares consecutive SHIFTED seconds, so typing an offset moves the clock discontinuously: at 09:04:50 typing `12` announced "Period 2 has started." from inside the Preferences panel, confirmed live. Lowering the offset after a bell rings it again. Consistent with "every derived view agrees, including the ones you hear", but the same user-facing shape as the 2026-09-09 bug. A decision is owed either way: accept and record, or reset `seen.sec` when `bellOffsetSec` changes. |
| 2026-09-10 | "Keep it" is silent at the caps | P5. At 50 schedules `addSchedule` returns the library unchanged and the shared schedule vanishes with no message; at 400 overrides it is kept but not made today's while the offer said it would be. Two sentences in the offer, gated on the counts. |
| 2026-09-10 | The tab title stays in minutes however long the wait | Q2, a design call. `480m · Period 1` from midnight to the first bell; the body already switches to `hr : min` above an hour and the title does not. `8h · Period 1` keeps "number first". |
| 2026-09-10 | The closing review's quality findings | Five optimizations, fifteen condensations, six dead-code items and eleven drifted comments, none a bug, each with file and line in the audit's summary table. The three worth doing first if any are: the e2e helper recipes (C1, ~90 lines, no app risk), `--with-deps` off the Chrome-only CI path (O1, ~39 s per PR), and the comment drift (C15) — the design record disagreeing with the code it describes. The CSS control-skin collapse (C5) reverses a recorded decision and needs its own Decisions row before it is done. |

## Closed

| Opened | Closed | Item |
| --- | --- | --- |
| 2026-09-10 | 2026-09-10 | Focus no longer lands on the gear button on every page load (audit P1, the one Medium). The settings focus-return effect has the same first-mount guard Big mode's always had, `hasOpenedSettings`; a new E2E in `editor.spec.ts` asserts `document.activeElement === document.body` after `openApp`, which is the assertion that catches ANY stolen focus. Negative control: with the guard commented out, exactly that test fails. |
| 2026-09-10 | 2026-09-10 | A period ending at 24:00 is refused at the boundary (audit Q1 + P3), with "A period has to end before midnight." bound to the end box; the draft's `endOf` blanks an end that lands on 1440; the plan reads `[0, 1439]`. Closes the unreachable `after` phase, the empty end box and the "12:00" label together. Deviations has the reasoning; Decisions has the road not taken. |
| 2026-09-10 | 2026-09-10 | `endOf` accepts integers only (audit P2): a typed `0.5` length now blanks the end box instead of emitting "08:0.5", and the parser's "That is not a length." says why. One line and one test. |
| 2026-09-05 | 2026-09-08 | A typed impossible date is told apart from an emptied box. The row said the fix wanted `validity.badInput` on a TYPED date and that automation could not measure it; Playwright's `keyboard.type` could, and on all three engines a typed February 30th leaves `value` at "" with `badInput` true. Read on change, key-up and blur - change never fires because "" to "" is no change, and Tab does not leave Chrome's segmented control - so the panel says "That isn't a date that exists", marks the field invalid, and keeps Add disabled until a real date replaces it. One test that types; negative control red with the reads disabled. |
| 2026-09-05 | 2026-09-05 | An unreadable saved library is now SAID, KEPT and RETURNABLE. The degrade to the seeded defaults is unchanged; what changed is that `loadLibraryReport` reports which of three ways the value failed, in storage's voice; `libraryStore` records it, and the first `saveLibrary` copies the unreadable bytes to `belltab.v1.unreadable` BEFORE overwriting - so one keystroke no longer destroys the only copy; and `LibraryNotice`, in the share offer's slot, says so and hands the bytes back as a file. Nothing blocks. Verified live: planted one bad period, saw the banner with the reason, renamed a schedule, and read the planted string back from the quarantine key with the live key readable again. Six unit tests, an E2E spec with a real download read back from disk, and a 320px reflow check. |
| 2026-09-05 | 2026-09-05 | The themed-load hydration mismatch is gone: `suppressHydrationWarning` on `<html>` in `layout.tsx`, the standard other half of a pre-paint theme script. **Downgraded while fixing** - the gap was opened as if users saw it, and they do not: React 19 checks attribute mismatches in development builds only, and a themed load of the production build logged zero console lines of any type. Dev-only noise, fixed because a console that always carries one error hides the next real one. Pinned by a source test in `preferences.test.ts` (negative control: removing the attribute fails it); a prod E2E test asserts a themed load logs nothing at all. |
| 2026-09-05 | 2026-09-05 | The Backup panel reflows at 320px, and the suite can no longer miss a panel. `width: 100%` + `min-width: 0` on `.backup__file` and `#backup-import` - the recipe the calendar's selects already carried - takes the page from 345px to 320px inside a 320px viewport. The panel list moved to `src/app/_lib/panels.ts`, and both `reflow.spec.ts` and `a11y.spec.ts` now loop over `PANEL_IDS` instead of a hand-written three, with a guard test asserting the tabs the app RENDERS equal the ids the suite ITERATES. Negative control run: with the CSS reverted, exactly one test fails and its message names the panel. |
| 2026-09-02 | 2026-09-04 | Notifications work on Android Chrome — a service worker with NO fetch handler (`public/sw.js`) is registered the moment notifications are granted, never before, and every bell goes through `registration.showNotification` wherever a worker exists, falling back to `new Notification` where none can. The 2026-09-02 decision against a caching worker stands; this one caches nothing. Verified against a stubbed worker on three engines; the real Android device is the user's, who asked for this. |
| 2026-09-02 | 2026-09-04 | The bell offset has a calibration aid: "The bell just rang", pressed as the real bell sounds, measures the offset from the nearest bell in today's schedule (`calibrateOffset`, pure, cap as an argument). Refuses with a sentence when nothing is within the cap; disabled with a reason when today has no schedule. Whether it has been pressed at a REAL bell is still a report to collect; the mechanism is built. |
| 2026-09-02 | 2026-09-04 | The macOS WebKit Tab quirk is handled, not annotated: Option+Tab is macOS's "tab to everything" and Playwright's WebKit honours it — measured with a probe (Tab: body, body, body; Option+Tab: the buttons in order). `tabTo` uses it on `webkit` + `darwin` only. The editor spec passes on WebKit locally for the first time. |
| 2026-09-02 | 2026-09-04 | The half of the dark-splash row that CAN close: `viewport.themeColor` takes a media list, so the installed window's chrome and the phone's status bar follow the scheme. The manifest's single `background_color` for the splash itself is the spec's limit and stays in the roadmap's Deferred table. |
| 2026-08-27 | 2026-09-03 | The editor's tab chain is grouped: each row's controls are a named `role="group"` — "Period 2, group" on entry — which is one of the two fixes the row itself named. The other, a skip link, had nothing below the rows to skip to. The chain is still seventy-seven stops; it is now seventy-seven stops that say where you are. |
| 2026-09-01 | 2026-09-03 | The axe sweep now also runs at 320px for the three densest panels — the reflowed DOM, the revealed labels, the shrunken targets. The critical/serious bar is unchanged and still deliberate. |
| 2026-09-01 | 2026-09-03 | The weekday defaults are one step from "No school today": a second, link-weight route under the primary action that opens the calendar panel with focus on that section's heading, so the next Tab is Monday's select. |
| 2026-09-01 | 2026-09-03 | The Day view's residue is deleted, on purpose this time: `formatDayCaption`, `daySummaryAt`/`DaySummary`, `blockPositionAt`/`BlockPosition` and their tests (eleven), plus four CSS sections that nothing rendered — the day summary, the period rows, the period strip, the disclosure — and Big mode's scaling of the strip. Unit 423 → 412. Git history keeps all of it; a rebuilt Day view would start from the engine, not from this. |
| 2026-09-02 | 2026-09-03 | The three inert CSS rules are gone with the rest: `.viewswitch__btn[aria-pressed]`, `body.is-settings .viewswitch`, `.is-big .strip*`. Sections renumbered; no comment referenced a number. |
| 2026-08-26 | 2026-09-03 | am/pm on the 12-hour clock — decided: not added. Moved to the roadmap's Deferred table with what would change the call (a schedule crossing noon ambiguously). |
| 2026-09-02 | 2026-09-03 | Big mode not surviving a reload — decided: it is component state on purpose. Moved to Deferred with its trigger (a room wanting a permanent display, which is a preference). |
| 2026-09-02 | 2026-09-03 | Big mode not requesting fullscreen — decided: deserves designing, not adding. Moved to Deferred with its trigger. |
| 2026-08-27 | 2026-09-03 | The design system's period-change crossfade is implemented — a 150ms fade on the period name, keyed to `boundaryKey` so it runs at a bell and never on a tick, collapsed by both reduced-motion paths. |
| 2026-09-01 | 2026-09-03 | Past exceptions can be removed at once — a "Remove past exceptions" button appears above the list when any date is strictly before today; today's own exception is kept because it is still running. |
| 2026-09-02 | 2026-09-03 | A large offset is told apart from a schedule edit — at sixty seconds or more the readout says so beside the number: edit the schedule instead; the offset stays on this device and never travels. The cap is not lowered. |
| 2026-09-02 | 2026-09-03 | The theme radios have a reduce-motion sibling — a "Reduce animation" checkbox that puts `data-motion="reduce"` on `<html>`; the OS media query keeps deciding when it is off. |
| 2026-08-27 | 2026-09-03 | The schedule name field has a visible label — "Schedule name", in the same small-caps voice as the stacked editor's row labels, above the box. |
| 2026-09-01 | 2026-09-03 | Dated exceptions carry their weekday — "Sat 2026-09-05" — computed by arithmetic on the string (`weekdayOf`, Sakamoto's method), because `new Date("2026-09-14")` is UTC midnight and still Sunday in New York. The month grid half of the row is still not built and would be its own row if wanted. |
| 2026-09-01 | 2026-09-03 | The schedule picker is one tab stop: roving `tabIndex`, arrows walk the chips with selection following focus, Home/End go to the ends, the arrows stop there rather than wrapping. |
| 2026-09-01 | 2026-09-03 | Deleting the schedule that is running today is called out in the confirmation — "This is the schedule running today - the countdown will go blank." — computed from the same resolver the calendar panel reads. |
| 2026-09-02 | 2026-09-03 | The hub's headers overwrote BellTab's on the public URL — Biscuit-Website #52 keeps the hub's `headers()` off `/bell` and `/puzzles`, and the live curl that was owed is done: `biscuitlab.net/bell` now serves BellTab's full set — `screen-wake-lock=(self)`, `autoplay=(self)`, `no-referrer`, `nosniff`, `DENY` — while `/` keeps the hub's own and `/puzzles` carries Puzzle Lab's. Measured on the deployed site, 2026-09-03 18:35. |
| 2026-09-02 | 2026-09-03 | A refused wake lock is now retried on the next tap or key press — the same recovery the chime uses for its autoplay lock, because the cause (battery saver) clears without any event the tab could hear. The refusal sentence says so. E2E: refuse, flip the stub to grant, click the heading, held. |
| 2026-09-02 | 2026-09-03 | Big mode and the wake lock are connected in the UI — a one-line signpost under the Big mode button, "On a projector? Keep the screen awake", opening the preferences panel. Shown only while the lock is supported and off; gone once it is on or where it cannot work. |
| 2026-09-01 | 2026-09-03 | The clipboard-refused path is asserted — `navigator.clipboard.writeText` stubbed to reject at the boundary, the panel's "copy the link by hand" sentence and the link in the read-only input both checked. The wake lock's stub argument, applied backwards to the gap it was first written against. |
| 2026-09-01 | 2026-09-03 | The share pipeline has now been round-tripped through a real messaging app. A link copied from the live site and pasted back through a chat client decoded with the real pipeline to the full eleven-period Regular day — version 1, 265 characters, every boundary exact. One data point, one client; the alphabet argument (base64url, nothing to escape) held. |
| 2026-09-02 | 2026-09-03 | The chime has been heard — the user pressed Test on a real device and reported it fine. Provenance: a report, not a measurement in this repo; the stub tests remain the only automated evidence. |
| 2026-09-02 | 2026-09-03 | BellTab has been installed, on a real device, by the user; icon and standalone window reported good. Same provenance note. |
| 2026-09-02 | 2026-09-03 | The wake lock has held a real screen open — reported by the user from a real device. Same provenance note; the refusal-retry row stays open. *(Superseded 2026-09-03: the retry is now built — see the row for it above.)* |
| 2026-08-27 | 2026-09-03 | The Phase 2 gate is verified in real Safari — the user backgrounded a real tab and reported the countdown correct on return. The throttling-threshold caveat in the research is now backed by one real observation rather than none. |
| 2026-09-02 | 2026-09-03 | The signed bell-offset field is typeable on real iOS — reported by the user. The `inputMode="text"` reasoning held. |
| 2026-08-26 | 2026-09-02 | The headers had never been verified on Vercel — now they have been, on the real deploy AND through the hub's rewrite, and the second hop does exactly what the gap feared: the hub's `headers()` wins. The measurement and its consequences are their own gap row above; the original question ("do the headers survive the deploy") is answered. |
| 2026-09-02 | 2026-09-02 | A projector in Big mode still goes to sleep — the Screen Wake Lock now exists, behind a preference, feature-detected and re-acquired on every `visibilitychange` back to visible. Closed with a caveat that is its own open gap above: what is proven is that the code drives the API correctly, not that a real projector stays lit. |
| 2026-09-02 | 2026-09-02 | The E2E suite has parked tests — it does not any more. 522 across three engines, **none parked**, for the first time in the project. The last block was Big mode's, parked since Phase 1 named the phase that would revive it. |
| 2026-08-27 | 2026-09-02 | Roughly half of `globals.css` is inert — closed properly this time. Big mode's dozen rules have shipped unrendered since the plain build was retired and now paint. What is left inert is three rules, enumerated in their own row above. |
| 2026-09-02 | 2026-09-02 | `inputMode="numeric"` on the signed bell-offset field made a negative offset untypeable on iOS, which draws neither a minus key nor a spinner. Review finding 1. |
| 2026-09-02 | 2026-09-02 | The bell-offset error was mounted only when it had something to say, so it never announced — the trap `ScheduleEditor.tsx` documents at length. Always rendered and polite now. Review finding 2. |
| 2026-09-02 | 2026-09-02 | `aria-describedby` swapped the range hint out for the error instead of listing both. Review finding 3. |
| 2026-09-02 | 2026-09-02 | The offset draft was not dropped when another tab changed the stored value, so the box and the readout beside it disagreed. Review finding 4. |
| 2026-08-27 | 2026-09-02 | Theme persistence is gone — a Preferences panel with a three-way System/Light/Dark radio group writes `belltab.prefs.v1`, and an inline script at the top of `<body>` puts `data-theme` on `<html>` before a pixel is drawn. Reopened narrowly as the CSP row above, which is the half that did not land and why. |
| 2026-09-01 | 2026-09-02 | The E2E suite is 122 live and 10 parked per engine — the preferences blocks are revived, leaving 5 parked per engine for Big mode. 486 tests across three engines, 471 run. |
| 2026-08-26 | 2026-09-01 | WebKit and Firefox are not covered — both are Playwright projects and the suite runs on all three engines, 366 tests. The two defects the spike found were fixed on `main` first; this closes the coverage itself. |
| 2026-08-27 | 2026-09-01 | No automated accessibility scan — `e2e/a11y.spec.ts` runs `@axe-core/playwright` over ten journeys including both error states and the open modal. It found a genuine WCAG 1.4.3 contrast failure on its first run. |
| 2026-08-27 | 2026-09-01 | Cross-tab sync is untested — `e2e/editor.spec.ts` opens two pages on one context and asserts an edit in the editor reaches a countdown, and a tab title, left open in the other. No reload, no tick. |
| 2026-08-27 | 2026-09-01 | The Day view has no phase — its parked assertions are deleted. The decision was to delete rather than schedule: no phase was ever going to revive them, and a parked test that names no phase is a test file lying slowly. Reopened narrowly as a dead-code row, because the view's formatters and CSS outlived its tests. |
| 2026-09-01 | 2026-09-01 | `setOverride` discarded the entry being added once the calendar hit the 400-override cap, and the form's gate refused replacements that could not grow the list. Review finding 1. |
| 2026-09-01 | 2026-09-01 | The dated-exception date reached `setOverride` unparsed, so a five-digit year emptied the form and changed nothing. Parsed at the control and at the mutator, with the message bound to the field. Review finding 2. |
| 2026-09-01 | 2026-09-01 | The inactive settings tab's `aria-controls` named an id that was not in the DOM. Review finding 3. |
| 2026-08-27 | 2026-09-01 | The `aria-invalid` border had never painted, in the editor or anywhere - a specificity loss to the control skin's `border` shorthand, shipped in Phase 3 and unnoticed because every test asserted the attribute. Found while fixing review finding 2. |
| 2026-09-01 | 2026-09-01 | Only `.editrow__movebutton` had a `:disabled` style, so Add exception - disabled whenever the date field is empty, which is its first render - looked clickable. |
| 2026-08-27 | 2026-09-01 | Two empty states have no call to action — "No school today" now offers *Pick a schedule for today*, which opens the calendar panel, and "No schedule yet" offers *Set up a schedule*, which opens the schedules panel. Both link into the editor rather than creating something unasked. |
| 2026-08-27 | 2026-09-01 | The `no-schedules` empty state is unreachable — deleting the last schedule reaches it through the UI, and `e2e/calendar.spec.ts` empties the library four chips at a time to prove it. |
| 2026-08-27 | 2026-09-01 | The onboarding empty state is a dead end — *Set up a schedule* → *New schedule* → name it, add a period, point today at it. Covered end to end. |
| 2026-08-27 | 2026-09-01 | The calendar is read a phase early — it is now written too. The deviation is reconciled: Phase 2 read the weekday map because the "no schedule today" screen could not exist without it, and Phase 4 has built the UI that edits it. |
| 2026-08-26 | 2026-08-27 | Overlap errors are attributed by sort order — decided rather than changed. `Array.prototype.sort` is stable, so an exact tie flags the row that appears later in the editor, which is the one just added or just typed. See the Decisions table. |
| 2026-08-26 | 2026-08-27 | `#schedule-name` was not hardened against intrinsic-width blowout — and it really did overflow, at 320, 375 and 768px, the first time the reflow gate was pointed at it. `overflow-wrap: anywhere` plus `min-width: 0` on it and on `.screen__meta`. See Bugs found. |
| 2026-08-27 | 2026-08-27 | The E2E suite is 49 live and 33 parked — now 83 and 22. The editor, the keystroke announcer test and the hostile-name reflow test are all live. |
| 2026-08-27 | 2026-08-27 | Roughly half of `globals.css` is inert — the settings shell, the editor rows, the control skin, the minibutton and the visually-hidden helper all render now. What is left targets Big mode, the view switcher, the period strip, the day view, the calendar panel and the dialog. |
| 2026-08-27 | 2026-08-27 | `src/lib/` has no consumer — `_lib/today.ts` and `_components/NowView.tsx` import the engine, the parser, the formatters and the new clock reader. It is in the bundle and on the screen. |
| 2026-08-27 | 2026-08-27 | Phase 2's clock will need a `clearInterval` — `useNow` returns a cleanup that clears the interval and removes both listeners. Strict Mode's double mount in development is what would have caught its absence. |
| 2026-08-27 | 2026-08-27 | Space Mono has no 500 weight — resolved in the design document's favour of reality: the Mono S row is now weight 400, with a note saying why, and `.bounds__edge` declares 400 rather than a 500 no browser was going to honour. |
| 2026-08-26 | 2026-08-26 | `splitCountdown` ambiguity — the countdown now carries a `min : sec` / `hr : min` label, and `splitCountdown` returns the unit alongside the numbers. |
| 2026-08-26 | 2026-08-26 | Glyph icons — `⚙`, `←` and `×` replaced with inline SVG. |
| 2026-08-26 | 2026-08-26 | `els` staleness — no longer reachable: every rebuild uses `replaceChildren()` on a container, so no reference in `dom.js` is ever replaced. The invariant is now documented in the file. |
| 2026-08-26 | 2026-08-26 | ~~No period-change announcement — added a single `aria-live="polite"` region that fires only at period boundaries and is silent on first paint.~~ **Superseded 2026-08-26 14:40:** the region exists and is silent on first paint, but it does *not* fire only at period boundaries — see the reopened gap above. |
| 2026-08-26 | 2026-08-26 | Day view scroll-into-view — the running row is revealed on entry and on each period change, `block: "nearest"`, reduced-motion aware. |
| 2026-08-26 | 2026-08-26 | ~~`window.confirm` on delete — replaced with a native `<dialog>`; `showModal()` supplies focus trapping, Escape, and an inert background.~~ **Superseded 2026-08-26 14:40:** focus trapping and the inert background hold, but Escape does not, and the unsupported-`showModal` path deletes without asking — see the two reopened gaps above. |
| 2026-08-26 | 2026-08-26 | `Docs/roadmap.md` status line — rewritten to describe reality, with the phase table explicitly flagged as describing the Next.js destination rather than the current state. |
| 2026-08-26 | 2026-08-26 | `src/belltab.code-workspace` — decided rather than fixed: editor-personal, stays ignored. |
| 2026-08-26 | 2026-08-26 | Schedule list view not built — shipped as the day view (mockup 1): day progress bar, eleven period rows, past/current/future states, per-row countdown, and a Now/Day switcher. |
| 2026-08-26 | 2026-08-26 | Settings: Schedules panel was a placeholder — now a full editor with live validation bound to `parseSchedule`. |
| 2026-08-26 | 2026-08-26 | Settings: Calendar panel was a placeholder — now the weekday map plus dated exceptions, resolving per day. |
| 2026-08-26 | 2026-08-26 | Escape closes settings out from under the confirm dialog — the handler now bails while `dialog[open]` matches, and `setSettingsOpen` closes the dialog with `"cancel"`. Review finding 1. |
| 2026-08-26 | 2026-08-26 | The announcer fires on editor keystrokes — keyed on the period's `startMin`/`endMin` instead of its name, with a one-shot resync flag raised by `refreshResolved`. Review finding 2. |
| 2026-08-26 | 2026-08-26 | The `showModal` fallback deletes without asking — falls back to `window.confirm`, which also made the delete flow testable for the first time. Review finding 3. |
| 2026-08-26 | 2026-08-26 | The "only live region" test does not test that — the selector now covers the implicit roles too, the three regions are enumerated by id, and `#schedule-error` became polite and idempotent. Review finding 4. |
| 2026-08-26 | 2026-08-26 | ~~The Day view countdown has no units — a `#day-remaining-units` caption on the summary, and `formatRemaining` on the running row. Review finding 5.~~ **Superseded 2026-08-27 11:20:** the caption was deleted with the retired markup, and `formatDayCaption` reintroduced the bare `major:minor` string — see the reopened gap above. |
| 2026-08-26 | 2026-08-26 | The `<dialog>` fixes were verified against a stub, not a browser — now covered by an `e2e/` Playwright suite running in the installed Chrome. Escape, focus trapping, inertness, Cancel, Delete and the backdrop caveat are all asserted against a real modal. |
| 2026-08-26 | 2026-08-26 | Branch protection does not require `Typecheck` or `Next build` — added, bringing the required list to seven. |
| 2026-08-26 | 2026-08-26 | `eslint-plugin-jsx-a11y` is not installed — now installed and running at full `recommended`, not the 6-rule subset `eslint-config-next` ships. |
| 2026-08-26 | 2026-08-26 | There is no `npm run typecheck` — `tsc --noEmit` on TypeScript 6.0.3, and its own CI job. |
| 2026-08-26 | 2026-08-26 | `vercel.json` is unverified — deleted. The header list moved into `next.config.ts` `headers()` where AGENTS.md wants it, and was verified against a running `next start` rather than by inspection. |
| 2026-08-26 | 2026-08-26 | Branch protection is configured by hand - now applied to `main` and recorded below, so the settings are readable without opening the GitHub UI. |
| 2026-08-26 | 2026-08-26 | The Day view scrolled sideways at 768px before the first bell with a 60-character period name — `overflow-wrap: anywhere` on the two elements that render a period name. Found by the reflow gate on its first CI run. |
| 2026-08-26 | 2026-08-26 | The E2E suite is not wired into CI — `.github/workflows/ci.yml` runs lint, markdownlint, unit and E2E on every push and PR. The reflow gate is a blocking check in practice now, not only in principle. |
| 2026-08-26 | 2026-08-26 | The 320 px reflow check had not been re-run — now a Playwright suite at 320/375/768/1024/1440 over every view, every settings panel, the open dialog, and a 60-character unbroken period name. Measured at 320: `scrollWidth === clientWidth === 320` in all four states. |
| 2026-08-26 | 2026-08-27 | Two apps share `src/` — the plain half is deleted. `src/` is `app/` and `lib/`, both TypeScript. |
| 2026-08-26 | 2026-08-27 | `npm run dev` and `npm run serve` both want port 3000 — `npm run serve` and `scripts/serve.js` are gone. |
| 2026-08-26 | 2026-08-27 | `README.md` documents the Next.js destination, not the current app — the two now agree; the Stack and Local development sections were rewritten against what actually runs. |
| 2026-08-26 | 2026-08-27 | No `clearInterval` anywhere — moot, the interval retired with the plain build. Reopened as a Phase 2 gap so the requirement is not lost with the code. |
| 2026-08-26 | 2026-08-27 | The inline theme script needs a CSP hash — the script is gone with `index.html`, so the CSP is clean. Reopened as a Phase 6 gap: the flash-of-wrong-theme problem it solved is unsolved again. |
| 2026-08-27 | 2026-08-27 | `eqeqeq`, error-level unused-vars and the disable-directive check do not reach `src/` or `e2e/` — a block scoped to `src/**/*.{ts,tsx}` and `e2e/**/*.ts` re-asserts all three, and `npm run lint` gained `--max-warnings 0`. Re-probed: `a == 1` is an error, an unused binding is an error, a stale disable directive is an error, and the run exits 1. Review finding 2. |
| 2026-08-27 | 2026-08-27 | `formatDayCaption` renders `1:00` for both one minute and one hour — the caption is now built from `formatRemaining`, so 60 s reads `1m 00s` and 3600 s reads `1h 00m`. The test that pinned the ambiguous string is corrected, and a new test asserts the two durations cannot render alike. Review finding 1. |
| 2026-08-27 | 2026-08-27 | `SCHEDULE_LIMITS.schedules` has no enforcer — `parseScheduleCollection` in `parse.ts` applies it at the boundary, refusing rather than truncating, with seven tests including exactly-at-cap and one-over. Review finding 3, closed early rather than deferred to Phase 4. |
| 2026-08-26 | 2026-08-27 | Fonts are not real — Fredoka, Manrope and Space Mono are self-hosted via `next/font/google`, injected as `--font-fredoka` / `--font-manrope` / `--font-space-mono` and consumed by the three tokens in `globals.css`. Verified against the built output: fifteen `.woff2` files under `/bell/_next/static/media/`, four preloaded, and zero references to `fonts.gstatic.com` or `fonts.googleapis.com` in the emitted HTML. |

---

## Bugs found

### 2026-09-10 — the settings focus effect had the hazard its neighbour was guarded against

Found by the closing review's static-bugs pass, confirmed in jsdom and in a
live Chrome, fixed the same day on `fix/closing-review-items` (Closed, P1).

`App.tsx` has two focus-follows-the-mode effects side by side. The Big-mode
one carries `hasBeenBig`, with a comment saying why: the effect "runs once with
`big === false` on every load, and without the guard that would steal focus to
the Big mode button before the user has touched anything." The settings one,
twenty lines below, runs once with `settingsOpen === false` on every load and
falls through to `toggleRef.current?.focus()` - the exact hazard, unguarded,
since the effect was written in Phase 3. Every load since has put focus on the
gear button before the user touched anything.

**Why nobody saw it.** Chrome's `:focus-visible` heuristic does not paint a
ring for programmatic focus with no prior keyboard interaction, so nothing
showed on screen; and the E2E test that guards first-paint focus
(`big-mode.spec.ts:76`) asserts only that `#view-big` is not focused - the
element that IS focused is one selector away. A screen-reader user hears "Edit
the schedule, button" first on every load.

**Lesson.** When a guard is written for one effect, look at its siblings: the
comment that explains a hazard is also a list of the places it applies. And a
"does not steal focus" test should assert what IS focused (the body, or
nothing), not that one particular element is not.

### 2026-09-10 — a bell offset is a moved clock, and a moved clock rings

Found by the same pass, confirmed live, not yet fixed (Open gaps, P4).

The 2026-09-09 fix made a bell "the clock crossing a boundary" rather than
"the state's key changing", so editing the running period rings nothing. The
bell offset is applied to the clock reading - `shiftNow`, once, on the way
into the engine - which is the right place for it, and it means an offset edit
IS a clock movement: typing `12` at 09:04:50 moved the shifted reading from
09:04:51 to 09:05:02, `crossedBell` saw the 09:05 boundary go by, and the
announcer said "Period 2 has started." with the Preferences panel still open.
Lowering an offset after a bell rewinds past it and rings it again.

Not a wrong rule - every derived view of the clock agrees, including the
audible ones, which is the offset's whole promise - but the same shape as the
bug it followed by a day: a preference edit, a bell. The decision is owed, not
the fix; both are in Open gaps.

### 2026-09-09 — editing the running period rang the bell on every spinner step

Reported by the owner: with the chime on, stepping the running period's start,
end or length in the editor chimed on every step. The announcer and the
notification had the same defect, because all three surfaces keyed on the
same thing - `boundaryKey(state)`, which names the running period as
`during:${startMin}-${endMin}`. That key was chosen on purpose, on
2026-08-27, so that RENAMING the running period would not re-announce; the
trade nobody noticed was that RETIMING it now did, once per keystroke or
spinner step, with the clock sitting still.

The fix is a definition. A bell is the CLOCK crossing a period's start or
end - not the state's identity changing under a clock that stayed put. So:
`crossedBell(schedule, fromSec, toSec)` in the engine, half-open like
`stateAt`, never true backwards (the same second, or midnight); a
`useBellCrossings` hook in `App.tsx` that compares each reading to the last
against the schedule in force NOW and counts crossings; and the chime, the
notification and the announcer all fire on that count and nothing else. An
edit re-renders with the same count. A tick across an edited boundary counts
exactly as it would have under the old schedule. A schedule swapped in by a
share-link preview no longer rings either, which it did before and should
not have.

Verified with the user's own gesture, not a typed value: two E2E tests step
the running period's length and end with the arrow keys and assert zero
strikes and an empty announcer. Both are red on `main`'s sources - the chime
one fails at the strike count, the announcer one at the empty text - and
green with the fix. Seven unit tests on `crossedBell`, including the
retimed-period case that is the whole reason for it.

**The lesson is one this file has recorded before, from the other side.**
The rename bug was fixed by keying on times, and the fix carried a comment
explaining exactly why - and that comment made the next bug look like a
design decision. A key that identifies a boundary by the period's PROPERTIES
will fire whenever those properties change; only a comparison of two
readings of the clock can say whether time actually crossed anything.

### 2026-09-05 — the audit called a dev-only warning a user-facing error

Not a bug in the app. A bug in the review of it, which is the kind this file
is also for.

`Docs/code-review-2026-09-04-full-audit.md` rated B2 - the hydration mismatch
on a themed load - **High**, on the sentence "puts a permanent error in the
console of every themed user". That sentence was an inference from the dev
overlay's red badge, written in the register of a measurement. When the fix
was being verified, the regression test written for it PASSED against the
production build with the fix still absent - which is not what a High-severity
defect does. Capturing every console message type on a themed production load,
listener attached before navigation, gave a count of zero. React 19 checks
attribute mismatches in development only. Users never saw anything.

The fix is unchanged and still right: `suppressHydrationWarning` on `<html>`,
one attribute, dev-only benefit, zero prod cost. What changed is the label
(Low) and the audit doc, which now carries the correction beside the original
text rather than instead of it.

**The lesson is one this repo already states about browser claims, applied to
its own review:** a severity is a claim about what users experience, and it
needs a citation or a test the same way a throttling threshold does. The tell
was available before the doc was written - the E2E suite runs the production
build, and one themed load with a console listener would have answered it in
fifteen seconds. Write the guard test *before* the severity, and let it fail
first.

### 2026-09-05 — the reflow gate enumerated three panels out of four, and the fourth was broken

Found by opening the app rather than by reading it. At 320px the Backup panel
scrolls the page sideways: `scrollWidth` 345 against a `clientWidth` of 320.
That is a WCAG 2.2 SC 1.4.10 failure, on the check `AGENTS.md` calls blocking,
on `main`, shipped.

The cause is one element. A native file input's INTRINSIC width is its button
plus its "no file chosen" text — 311.5px in Chrome — and `#backup-import`
carried only `max-width: 100%`. A percentage max-width resolves against a box
that is itself still being sized to its content, so it never binds; setting
`display: none` on that one input dropped the document from 345px to exactly
320px, which is how it was isolated.

**This stylesheet already knew the answer.** The calendar's `<select>`s carry
`width: 100%; min-width: 0; max-width: 100%` under a long comment explaining
that "`min-width` alone only permits shrinking; it does not reduce what the
control asks for". The same sentence applies verbatim to a file input. The fix
is that pair, on the input and on the label that measures it.

The part worth keeping is why it was never caught. `reflow.spec.ts` had a
hand-written test per panel and `a11y.spec.ts` looped over
`["schedules", "calendar", "preferences"]`. `SettingsView`'s `PANELS` has four
entries. **Backup was the only panel with neither a reflow test nor a 320px axe
test, and Backup was the panel that failed** — the coverage hole and the defect
were the same hole, because the thing that decides what gets tested was a
different list from the thing that decides what gets rendered.

So the fix is not "add Backup to two arrays", which is the same mistake with a
longer list. The panel list moved to `src/app/_lib/panels.ts` — no React, so a
Node spec can import it — both suites loop over `PANEL_IDS`, and a guard test
compares the tab ids the app renders against the ids the suite iterates. A
fifth panel is covered the moment it is added in one place.

Verified as a negative control rather than assumed: with the CSS reverted,
exactly one test failed, and its message was
`320px settings/backup: page scrolls horizontally (345 > 320)` with the widest
elements listed. A test that passes with and without the fix is not a test.

**The lesson is the one the 8px name column already recorded, moved up a
level:** that bug was a gate measuring the wrong thing, this one is a gate not
measuring at all. Any list that decides what gets checked should be derived
from the list that decides what exists, or the two drift and the gap is
invisible — a green run over three of four panels looks exactly like a green
run over four.

### 2026-09-03 — the name column was 8px wide on every engine, and Chrome's axe missed it by two pixels

Caught by the a11y sweep on the first full run after the end-time column
landed — on Firefox and WebKit. Chrome passed the same sweep, which is the
part worth writing down.

The end box made the editor a seven-column grid, and the stacking breakpoint
was raised from 45rem to 56rem to match. That breakpoint was a VIEWPORT query,
and the viewport was never the constraint: the settings panel sits beside a
13rem nav inside a card capped at 60rem, so it is **684px wide at every
viewport from 60rem up**, no matter how wide the window. The six fixed columns
plus gaps want 676px of that. The name column - `minmax(0, 1fr)` - got the
remaining 8px, on every engine, at every desktop size. Measured with a
Playwright script rather than assumed: Firefox and Chromium reported identical
column widths to the pixel.

Chrome's sweep passed because the name input overflowed its 8px track to 26px,
and axe's `target-size` rule wants 24. Firefox and WebKit reported the same
overflow and failed - a two-pixel difference in how an overflowing `<input>`
is measured, on either side of a threshold. **A green a11y run on one engine
is not evidence the layout is fine; it can be evidence the engine measures
overflow generously.**

The fix is a container query - `.editrows { container: editrows /
inline-size }` - with three tiers chosen by the editor's OWN width: the table
at 52rem and up, a two-line row with visible labels below that (which is what
the 684px panel gets), and the four-line stack below 34rem. The lesson is the
same one the 60rem settings breakpoint already recorded in this stylesheet and
that this change repeated anyway: **when a component lives inside a capped
container, the viewport is the wrong thing to measure.** The old note said the
settings layout "was sized for the editor's width"; it was, and then the editor
grew, and only a query on the actual width could have followed it.

### 2026-09-04 — the worker was used before it was active, and a bell in that window was swallowed

Found by a `high`-effort code review of the Android-notifications branch
before it merged, and MEASURED there: on real Chrome against the production
build, `register('/bell/sw.js', { scope: '/bell/' })` resolved in about fifty
milliseconds with `active === null` and `installing` set, and an immediate
`showNotification` threw "No active registration available". About a second
later it succeeded. The code assigned `registration` the moment `register()`
resolved, sent the next bell through it, caught the rejection, and did not
fall back - so a user who granted notifications seconds before a bell and
switched tabs got nothing, silently.

Two more from the same review, one of them a trap worth knowing: the page is
served at `/bell` - Next 308-redirects `/bell/` to it - which is OUTSIDE the
worker's `/bell/` scope, so `navigator.serviceWorker.ready` never resolves for
this page and cannot be the fix (measured). And `clients.matchAll` in the
`notificationclick` handler returns every window on the ORIGIN, not the scope;
biscuitlab.net is shared with the hub and Puzzle Lab, so a tap on the bell's
toast could have raised the puzzles tab.

The fixes: `registration` is assigned only once the worker is active, waited
for through `installing`'s `statechange`; a rejected `showNotification` falls
back to the page route; the click handler filters clients by pathname; and
switching notifications off now unregisters the worker, which the docstring
had promised and the code had not done. The stub in the E2E was the thing
that hid all of this - its `register()` resolved with a registration that
worked immediately - so it now models the lifecycle (`active: null` until
told otherwise, `showNotification` rejecting meanwhile), and one Chrome-only
test registers the REAL file and asserts an active registration at `/bell/`.

Also from the review: the Day view and the strip wrote `toFixed(2)` widths
every tick into fills with 300ms transitions - the permanent crawl
`NowView.percentOf` was written to prevent, re-implemented unrounded twice.
One `percentOf` in `src/lib/format.ts` now, used by every fill.

**The lesson:** a stub that succeeds immediately proves nothing about a
lifecycle - the same lesson as the wake lock's in-flight race, two days
later, in a different API. And "any client will do" was a claim about the
origin, made from inside one app's path.

### 2026-09-04 — the Day view's CSS carried two contrast failures under a comment that said it did not

Found by the axe sweep the moment the rebuilt Day view joined it - the first
time this list had ever been scanned, because the plain build predated the
gate.

Two rules, both restored verbatim from the retired build, both wrong: past
rows dimmed with `opacity: 0.55` under a comment reading "never below the
4.5:1 contrast floor" (0.55 of `--fg-soft` on the card is well under), and the
running row's time painted `--accent`, which is butterscotch-dark and measures
under 3:1 as text on the card - fine for the progress fill it was chosen for,
not for a number. Seven and one violations respectively, on every engine.

The fixes are token-shaped: past rows dim by colour (`--fg-soft`, 5.7:1) and
weight, not opacity; the running row's time goes bold in ink and the accent
stays on the track's fill. Both comments now say what the old ones got wrong.

**The lesson:** a comment asserting a contrast ratio is a measurement claim,
and it was never measured. The retired build's CSS was carried over on the
strength of its comments twice today - the wrap rules that turned out to be
live, and these that turned out to be wrong - and in both cases a gate, not a
reader, was what caught it. Restored code is new code.

### 2026-09-03 — the crossfade started at opacity 0 on first paint, and WebKit's axe read a period name with no contrast

Found by the a11y sweep on WebKit, on the full run of the branch that deleted
the Day view - though it had nothing to do with that deletion. The crossfade
shipped in #39 ran on EVERY mount of the period name, first paint included,
from `opacity: 0`. Chrome and Firefox advanced the animation under Playwright's
paused clock; WebKit did not, so its period name sat at frame one, invisible,
and axe reported `color-contrast` on `#period-name` in the two message
states. Nothing a real user would hit at 150ms, but the test caught a design
mistake on the way: a fade on first paint means nothing to somebody opening
the tab mid-period. The announcer's rule 2 - say nothing on first paint -
applies to motion too.

The fix: `NowView` remembers whether a boundary has been seen (adjusted during
render, the announcer's own pattern) and adds `.countdown__period--swap` only
after one. The first mount draws the name plain; every remount after a bell
fades in. The E2E now asserts `none` before the bell and `period-swap 0.15s`
after it.

**The lesson:** an animation that begins from invisible is a contrast failure
for as long as anything holds the timeline still, and "on mount" is not "at a
bell" - the two coincide only in the demo.

### 2026-09-03 — deleting the Day view's CSS took two live rules with it, and the reflow gate said so in a minute

Nothing shipped; the gate is a blocking check and it blocked.

The sweep deleted four stylesheet sections that nothing rendered. A selector
scan before the cut had listed `.countdown__period`, `.schedchip`,
`.override__schedule` and `#calendar-today` inside that range, and the scan
was read as noise from neighbouring sections. It was not. Two live rules -
`overflow-wrap: anywhere` on every element that renders a period name or a
schedule name - had been written into the Day view's section in Phase 2 and
Phase 4, because that is where the first such element lived at the time. The
rules outlived the view; the sections' headings did not say so.

Six reflow tests failed at 320 and 375px on the first run after the cut: a
60-character unbroken name scrolled the page sideways in the countdown and in
the calendar panel, which is the exact defect those rules were added for on
the gate's first CI run. The rules are back, each beside the element it
protects and with a comment that says what it survived.

**The lesson:** a stylesheet section's heading is a claim about what is inside
it, and the claim rots - rules get written where the first consumer is, and
the consumer moves. Before deleting a section, grep its selectors against the
components and treat every hit as a rule to move, not noise to explain away.
The gate exists because this mistake is easy; it took under a minute to catch.

### 2026-09-03 — the retry made a double-request race reachable, and the stub could not see it

Found by a `high`-effort code review of the gaps branch before it merged;
nothing shipped. Six of eight review angles converged on it independently,
which is what a real defect looks like from the outside.

Adding "retry on the next tap or key press" to the wake lock put a second
caller on `acquire()`, whose only guard was a SETTLED sentinel. A real
`navigator.wakeLock.request()` takes tens of milliseconds over IPC, and in that
window `sentinel` is still `null` — so the most ordinary gesture there is,
clicking the tab to bring it forward, fires `visibilitychange` (request A) and
`pointerdown` (request B) inside it. Both grant. B overwrites `sentinel`; A is
orphaned with its release listener attached. Unticking the box then releases B,
the readout says the screen will dim, and A keeps the projector awake until the
tab hides — the exact failure the E2E's own comment calls the worst version of
this bug.

**Why the suite was green:** the stub's `request()` resolved in a microtask.
There was never an in-flight window to land a gesture in, so the guard's
absence was unobservable. The fix is an `inFlight` flag, plus releasing any
grant that arrives while a live one is already held; the stub gained `hold()`
and `settle()` so a request can be kept open while gestures and a
visibilitychange are fired into the gap, and the test asserts exactly one
request and, after unticking, exactly one release.

The same review found the listener was attached for the life of the
preference rather than only while refused (fixed: its own effect, keyed on the
outcome, mirroring the chime), and that the `aria-live` alert carried a
hardcoded COPY of the refused sentence which the new remedy had not reached —
screen-reader users would have been told the old one. Also fixed: one owner.

**The lessons:** a stub that resolves synchronously proves nothing about
concurrency, and the moment a second caller reaches an async function its guard
has to model "in flight" as a state; and a sentence that lives in two places is
already wrong in one of them, it just has not diverged yet.

### 2026-09-02 — the test could not see the locked chime, because looking is a gesture

Caught on the first run of `e2e/bells.spec.ts`, and the feature was not broken —
the test's premise was.

The plan: restore a stored `chimeOnBell: true`, open the preferences panel,
assert the readout says the chime is locked (no user gesture has blessed the
`AudioContext` yet), then click somewhere and assert it unlocked. The readout
said "ready" before the first assertion ran. Of course it did: **reaching the
panel takes a click, and a click is the unlocking gesture.** The hook's
first-touch-unlocks listener — built precisely so nobody would have to find the
panel and re-tick a box that already looks on — had done its job during the
navigation the test performed to go and look. Keyboard navigation fares no
better; a keypress unlocks too.

The fix inverts the test: assert the *behaviour* with no navigation at all — a
context exists, a boundary rings nothing, the page has not been touched — then
touch the page once, ring a boundary, and only then open the panel and read
"ready". The locked sentence itself is covered by the unit suite and recorded as
all-but-unobservable in Open gaps.

**The lesson:** a state designed to dissolve on first interaction cannot be
inspected by any test that interacts its way to the inspection point. The
observation is the gesture. Asserting such a state means reading its effects
(nothing rang) rather than its label — and if a label can only be seen by a road
that destroys it, say so in the docs rather than leaving the next person to
rediscover it with a failing test.

The same session also relearned a Playwright detail worth one line:
`locator.check()` fails on a checkbox that deliberately does not become checked
— the notification toggle refuses to tick until the permission grant returns,
which is the behaviour under test — so the deny-path test must use `click()` and
assert the box stayed unticked.

### 2026-09-02 — a test that proved the opposite of what it claimed, because `addInitScript` re-runs on reload

Caught on the first run of `e2e/wake-lock.spec.ts`, which is the only reason it
is a short entry rather than a long one.

The test is "the wake lock preference survives a reload, in its own key": tick
the box, reload, assert the box is still ticked. It failed, and the feature was
fine.

`openApp` plants its `storage` and `preferences` fixtures with
`page.addInitScript`, and the helper's own JSDoc explains why — the stores read
`localStorage` on their first client render, so a value written after `goto`
arrives too late to affect the first paint. What that comment does not say, and
what nothing in the file said until now, is the consequence: **an init script
runs on every navigation, not just the first.** Passing `preferences: null`
registers "remove this key", so the reload the test performs re-ran the removal
and wiped the preference a moment before the assertion read it. A test written to
prove persistence was quietly asserting that a fixture is re-applied.

The fix is to pass no `preferences` option at all — a fresh Playwright context
starts with empty storage anyway, so the explicit clear was buying nothing and
costing the only navigation the test cares about. The reasoning is now a comment
in the test rather than a fact about Playwright somebody has to already know.

**The lesson, and it generalises past this suite:** a fixture that is *installed*
and a fixture that is *enforced on every navigation* look identical at the call
site and differ only in tests that navigate twice. This suite has had exactly one
such test until today. Any future test that reloads, follows a link, or opens a
second page inherits the same trap, and the tell is a green-looking helper call
rather than anything in the assertion.

### 2026-09-02 — two Big mode CSS rules that kept matching and stopped meaning anything

Neither ever shipped — the rules were inert from the moment the plain build was
retired until Phase 6 rendered them — so nothing broke in front of a user. Both
are recorded anyway, because the way they went wrong is the interesting part and
because the fix is only obvious once you have seen the page.

**1. The rule hid the bounds footer in favour of an element that does not
exist.** Its comment said the footer could go "because the strip already says
it", and the period strip belonged to the retired build and has never been
rebuilt. What Big mode would have shipped is a projector screen with no line
reading "Next: Passing at 10:05" — the single most useful sentence on it — for a
reason that stopped being true two phases earlier.

**2. `.is-big .screen__schedule` hid the wrong element, silently.** It was
written when `.screen__schedule` WAS the schedule name. In the current markup
that class is on the `<h1>` reading "BellTab", and the schedule name lives in
`#schedule-name`. So the selector kept matching, kept hiding *something*, never
errored, and quietly stopped doing what its own comment claimed.

**Lesson: a selector that still matches after a rename is not a selector that
still works.** This is the CSS form of the lesson the `aria-invalid` border
taught in Phase 4 and the preferences JSDoc taught earlier today — a rule or a
comment describing behaviour is not evidence of it. The difference here is that
there is no compiler and no test that can catch it: both rules were valid CSS
matching real elements, and a screenshot was the only thing that could tell.

**Both were found by rendering the page, not by reading the file.** That is the
whole finding. The CSS had been read several times across the phases that ported
it; what had never been done was look at what it drew.

### 2026-09-02 — four defects in the preferences panel, all found by review

A `high`-effort code review of the Phase 6 part 1 tree, run before the branch
had a single commit on it. Everything structural came back clean — the
`localStore` extraction is a faithful move, `shiftNow` clamps rather than wraps
and leaves `isoDate`/`weekday` alone, the offset is applied at exactly one seam,
and `THEME_SCRIPT` and `loadPreferences` agree on every malformed-storage case
the reviewer could construct. All four findings were in the new FORM, which is
the third phase running that the newest form is where the defects are.

**1. `inputMode="numeric"` made negative offsets untypeable on iOS.** iOS picks
the on-screen keyboard from `inputmode` in preference to the input type, and
`numeric` is the digits-only keypad — no minus key. iOS Safari also draws no
spinner buttons for `type="number"`, so an iPhone had no way at all to express
"the bells run late". Copied straight from `PeriodRow.tsx`, where the field is a
period's LENGTH, is unsigned, and `numeric` is correct. Now `inputMode="text"`,
which costs a physical-keyboard user nothing.

**Lesson:** an attribute copied from a similar-looking field carries that
field's assumptions with it. The two inputs are both numbers; only one of them
can be negative, and that is the whole difference.

**2. The offset error was mounted conditionally, so it never announced.**
`ScheduleEditor.tsx` documents this exact trap in a twelve-line comment — a live
region has to be in the accessibility tree BEFORE its text changes, so one that
appears along with its message is routinely missed — and the new panel was
written without it. The failure it hides is the bad one: an out-of-range value
is refused, the countdown carries on running the old offset, and nothing says so
to anyone who cannot see the red border. Now always rendered, `.visually-hidden`
when empty, `aria-live="polite"`, exactly as the editor's is.

**Lesson:** axe cannot see this. The scan passed on the broken version, because
a conditionally-mounted error is valid markup — it is only wrong across time.
Two of this repo's a11y gates ran green over it and the review caught it.

**3. `aria-describedby` swapped the hint out for the error.** So the sentence
stating the ±300 range was removed from the field at precisely the moment the
user exceeded it. Now it lists both ids.

**4. The draft was never dropped when the stored value changed underneath it.**
An edit in another tab reaches `preferencesStore` through the `storage` event,
but the number box kept showing whatever had been typed into it while the
readout beside it showed the new value. The JSDoc above the component explicitly
claimed this case was handled; it was not. Fixed with the React docs' pattern
for resetting state on a prop change — an assignment during render, guarded by
the last-seen value — and covered by a two-page cross-tab test.

**Lesson, and it is the same one as the `aria-invalid` border in Phase 4:** a
comment describing behaviour is not evidence of it. This one named three cases
the `null` state covered and the third was aspirational. If a comment enumerates
cases, each case is a test.

### 2026-08-26 — three "engine failures" that were bad test expectations

The first run of the boundary checks reported 3 of 18 failing. All three were
wrong assertions, not wrong code:

- Two expected `98%` progress one second before a bell; the real answer is
  `3299/3300 = 99.97%`, which rounds to `100`. Arithmetic error in the test.
- One expected 10:22 to fall in Period 2. In our schedule, 10:22 is inside
  Period 3 — and by coincidence with exactly 43 minutes left, which is what made
  the mistake look plausible against the mockup.

**Lesson:** a failing assertion is a claim that two things disagree, not proof
that the code is the wrong one. Both were resolved by computing the expected
value by hand rather than by editing the engine until it agreed.

### 2026-08-26 — `hidden` is an HTMLElement property, not an SVGElement one

Swapping the header gear for a back arrow was written the obvious way:

```js
els.iconGear.hidden = toggle.showBack;
```

That does nothing. The `hidden` IDL attribute is defined on **HTMLElement**,
and these are **SVGElement**s — the assignment creates a useless expando
property and sets no attribute at all, so the icons never swapped. No error, no
warning, and `node --check` has nothing to say about it.

Caught by the jsdom test asserting `$("icon-gear").hidden` was `false` and
getting `undefined`. Fixed with `toggleAttribute("hidden", …)`, which works on
any `Element`; the CSS `[hidden]` rule matches the attribute, so it hides both
kinds.

**Lesson:** the convenience IDL properties (`hidden`, `dataset`, `title`,
`accessKey`) are HTML-only. On SVG, go through attributes. The test that caught
it was written to check the icon and the accessible name moved *together* —
which is why it was looking at the icon at all.

### 2026-08-26 — a refactor script rewrote code inside string literals

Moving module state onto a shared `store` object was done with a blanket
regex — `/\bschedules\b/g → "store.schedules"` and four more like it. It also
rewrote every occurrence inside **string literals and comments**:

```js
const SETTINGS_PANELS = ["store.schedules", "store.calendar", "preferences"];
const name = "New store.schedule";
.replace(/^-+|-+$/g, "") || "store.schedule";
```

The first one broke settings outright — `els.settingsTabs["store.schedules"]`
is `undefined`. Caught by the jsdom boot test on its first run, which is
precisely the class of failure that test was written for: every pure test still
passed, because none of them touch `SETTINGS_PANELS`.

Fixed by replacing the regex with a small scanner that tracks quote and comment
state and only rewrites bare identifiers.

**Lesson:** a regex does not know what a string is. Any codemod over source has
to be at least token-aware, and the damage it does is invisible to a syntax
check — `"New store.schedule"` parses perfectly.

### 2026-08-26 — overlap errors are attributed by sort order, not edit order

Writing the jsdom test for the overlap message, an assertion failed that looked
like a bug and was not. When two periods share a `startMin`, `parseSchedule`
tie-breaks on `endMin`, so the shorter one sorts first and the error is
attributed to the *other* row — not the one just edited.

Correct as specified, and only reachable on an exact tie, but worth knowing:
the error lands on the row that sorts second, which is usually but not always
the row the cursor is in. Logged under **Open gaps** rather than changed,
because the alternative — attributing by edit recency — means threading edit
state into a pure function.

### 2026-08-26 — the test harness corrupted the file it was testing

Six strip checks failed with `·` rendered as `Â·` and `–` as `â€“`. The instinct
is to go fix the string literals in `app.js`. That would have been wrong: the
source was already correct.

The scratch harness extracts the pure half of `app.js` with PowerShell
`Get-Content`, which in Windows PowerShell 5.1 **defaults to the system ANSI
codepage for files with no BOM**. It read UTF-8 bytes as Windows-1252, and
`Set-Content -Encoding UTF8` then faithfully re-encoded the mojibake — `c2 b7`
became `c3 82 c2 b7`, double-encoded. Confirmed by hexdumping the same character
in both files: source `c2 b7`, extracted copy `c3 82 c2 b7`.

Fixed with `Get-Content -Raw -Encoding UTF8`.

**Lesson:** when a test fails on something as low-level as character encoding,
check the harness before the code. Every file this project writes is UTF-8;
anything that reads one and does not say so is a suspect. It is also the second
time in this repo that a red test meant the *test* was wrong — see the entry
below.

### 2026-08-26 — the supplied mockups are internally inconsistent

Mockup 2 shows `43:12` remaining in "Period 2" while mockup 1 lists Period 2 as
9:05–10:05 and the wall clock as 10:22. Those cannot both be true. Treated the
art as a visual reference, not a specification.

---

### 2026-08-26 — a `<dialog>` is part of the page, and `confirm()` never was

The delete confirmation was upgraded from `window.confirm` to
`dialog.showModal()` for focus trapping and Escape-to-close. Escape stopped
meaning what it used to mean:

```js
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (settingsOpen) setSettingsOpen(false);
  ...
});
```

That handler predates the dialog and was correct for years' worth of `confirm()`
calls, because a browser modal dispatches no key events to the document at all.
A modal `<dialog>` is an ordinary element in an ordinary document: its Escape
keydown bubbles to `document`, and the dialog's own close is only the *default
action*, so the page's listener runs first. One Escape now hides the settings
view, drops `is-settings`, paints the countdown underneath, and moves focus —
while the delete modal is still open on top of it.

**Lesson:** replacing a browser-level primitive with a page-level one hands you
the behaviour *and* the event stream. Grep for existing global key handlers
before adopting `<dialog>`, `popover`, or anything else that participates in
close requests. The tell is that the old code needed no `dialog`-awareness
because there was no dialog in the page to be aware of.

### 2026-08-26 — the review's "any route" was one route, and the modal closed the rest

Not a bug in the app — a bug in what the previous entry believed about it, found
by writing the browser test that was supposed to confirm it.

The review said `setSettingsOpen(false)` never calls `dialog.close()`, "so
leaving settings by any route strands the dialog open." The E2E test written to
prove that in Chrome timed out instead:

```text
attempting click action
  <dialog open class="confirm" id="confirm-dialog"> intercepts pointer events
retrying click action ... (55 times)
```

A modal `<dialog>` makes everything behind it **inert**. The settings toggle is
behind it, so no click can reach it. The Escape handler was the only route that
ever reached `setSettingsOpen(false)` with the dialog open, and that is fixed at
the source. The defensive `close("cancel")` stays — it costs one condition and
covers a non-modal `show()`, or a browser where `showModal` threw — but it is
belt-and-braces, not the fix, and the code comment now says so.

**Lesson:** a finding measured *through* a bug inherits that bug's reach. The
Escape collision was the vehicle for "any route", and once it was gone the other
routes turned out never to have existed. Worth re-deriving the blast radius of a
finding after fixing its cause, rather than fixing the symptom list as written.

### 2026-08-26 — Chrome's modal tab cycle passes through `<body>`

The focus-trap assertion started as "`#confirm-dialog` contains
`document.activeElement` after every Tab" and failed on the second press.
Measured, in Chrome, tabbing from the freshly-opened dialog:

```text
0 BUTTON  Cancel      inDialog=true
1 BUTTON  Delete      inDialog=true
2 BODY                inDialog=false
3 BUTTON  Cancel      inDialog=true
```

The wrap point of a modal's tab cycle parks focus on the document body. Nothing
*behind* the dialog ever takes focus, so the trap holds exactly as intended —
`contains()` was simply the wrong shape for the assertion. It now asserts the
set of places focus is allowed to be, and the observed cycle is recorded in the
test so the next person does not re-derive it from a red run.

**Lesson:** `AGENTS.md` requires browser-behaviour claims to carry a citation or
a test, and "focus is trapped" is a browser-behaviour claim. The intuitive
encoding of it was wrong about a real engine in a way no amount of reading the
spec summary would have caught.

### 2026-08-26 — a name is not an identity

Fixing the announcer's keystroke spam surfaced a second bug in the same three
lines, pointing the other way. The guard was:

```js
if (label === lastAnnounced) return;
```

where `label` is the period's *name*. Two consecutive periods that share a name
— a school with "Study Hall" twice in a row, or two back-to-back "Advisory"
blocks — produce the same `label` on either side of the bell, so the guard reads
"nothing changed" and says nothing at exactly the moment the region exists for.

Nothing in the suite could have caught it, and nothing in a browser would look
wrong: both spellings of the bug render identically, and the failure is silence.
It was only visible because fixing the *other* direction forced the question of
what "the period changed" actually means.

**Lesson:** a guard keyed on what is *displayed* is keyed on the wrong thing.
The display is a projection — lossy by construction, and here two distinct
periods projected onto the same string. Key on identity, and if the domain does
not obviously supply one, that is worth stopping over: this domain does, and it
is the invariant that periods may not overlap, which makes `startMin`/`endMin` a
primary key.

### 2026-08-26 — `role="alert"` is not free, and `[aria-live]` does not find it

Two bugs that only look like one. `#schedule-error` carried `role="alert"`,
whose implicit `aria-live` is `assertive`, and `clearErrors()` blanked it while
`showErrors()` refilled it on every `validateDraft()` — that is, on every
keystroke in the editor. An assertive region, churned per character.

The test written to prevent exactly this selected `[aria-live]` and asserted a
length of one. `role="alert"` and `role="status"` have no literal `aria-live`
attribute, so the selector matched neither error slot: the page had three live
regions while a green test said one.

**Lesson:** ARIA roles carry implicit properties, and attribute selectors see
only explicit ones. Any test that means "find the live regions" has to spell out
`[role="alert"], [role="status"], [role="log"]` alongside `[aria-live]`.
Enumerating them by id rather than counting them is the second half — a count of
one passes forever, whereas a list fails the moment somebody adds a fourth,
which is the whole point of writing it down.

### 2026-08-26 — the `lint:md` script had never once been run

`package.json` had shipped `"lint:md": "markdownlint-cli **/*.md"` since the
toolchain went in. It is wrong twice: the `markdownlint-cli` package installs a
binary called **`markdownlint`**, not one matching its own package name — and
the glob is unquoted, so on a shell that expands it the script lints whatever
happens to sit in the working directory rather than the tree. It also never
could have run: `markdownlint-cli` was not in `devDependencies` at all.

It went unnoticed because `AGENTS.md` tells you to run
`npx markdownlint-cli "**/*.md"`, and that works — `npx` resolves a *package*
and runs whatever single binary it declares, so the name mismatch is invisible
from the command line. Every markdown lint in this repo's history went through
`npx`. The npm script was decoration.

**Lesson:** an npm script nobody runs is not a shortcut, it is an untested
claim. This is exactly the class of thing CI catches — and it was found *by*
writing the CI job that would have to run it, before that job ever ran.

---

### 2026-08-26 — the E2E clock was four hours off, and only on other people's machines

The first CI run of the new workflow went red: three failures, apparently
unrelated. Two in `announcer.spec.js` — one live region empty when it should
have said "Period 1 has started.", one saying "Period 3 has started." when it
should have said "School is out." — and one in `reflow.spec.js`, the Day view
scrolling sideways at 768px. All three passed locally, and `--repeat-each=6`
locally passed 36 of 36.

The cause is one line in `e2e/helpers.js`:

```js
await page.clock.install({ time: new Date(at) });   // at = "2026-09-02T09:30:00"
```

An ISO string with **no offset** is parsed in the timezone of the **Node
process**. The browser is separately pinned to `America/New_York` by
`playwright.config.js`. On a machine already in New York the two agree and the
suite is green. A GitHub runner is UTC, so `09:30` became 09:30 UTC — **05:30
in the browser**. Every test in the file ran four hours earlier than every
comment in the file said it did.

That explains all three failures exactly, which is how it was confirmed rather
than guessed:

| Test | Intended | Actually ran at | Result |
| --- | --- | --- | --- |
| bell at a boundary | 07:00 → 08:10, into Period 1 | 03:00 → 04:10 | still before school, so silence |
| end of day | 09:30 → 14:40, past last bell | 05:30 → 10:40 | mid-Period 3, so "Period 3 has started." |
| 60-char name at 768px | Day view mid-period | Day view before first bell | a different layout, which overflowed |

Reproduced in one command — `TZ=UTC npx playwright test` on Windows produced the
same three failures — and fixed by putting the offset on the fixtures
(`2026-09-02T09:30:00-04:00`).

**The tempting fix was `TZ: America/New_York` in the workflow env.** It would
have turned CI green in one line and left the defect in place for the next
machine — a container, a contributor, a self-hosted runner. Fixing the fixture
removes it everywhere; leaving CI on UTC keeps proving it is gone.

`openApp` now also asserts that the browser's own wall clock matches the hour
the fixture spells out. A clock skew is invisible by construction — the suite
boots, renders and asserts perfectly well against the wrong hour — so it needed
an assertion whose whole job is to be loud about it.

**Lesson:** a test fixture that reads as a wall-clock time is not one until it
says which wall. And "passes on my machine, fails on CI" was, for once, not
flakiness or a slow runner: it was a real, deterministic, reproducible
difference between two machines, and the five minutes spent reproducing it with
`TZ=UTC` was worth more than an hour of re-running the job.

### 2026-08-26 — `overflow-wrap: break-word` does not do what the rule comment claimed

Hidden underneath the timezone bug was a real one. Once the clock was fixed the
reflow failure disappeared — which is the point at which it would have been easy
to move on. It was worth ten minutes to ask whether the *state* the broken clock
had accidentally wandered into was a state a real user can reach.

It is: **before the first bell**, at **768px**, with a 60-character period name,
the page scrolled sideways — 827px inside a 768px viewport. Measured directly
rather than reasoned about:

```text
[before school] scrollWidth=827 clientWidth=768
[mid period]    scrollWidth=768 clientWidth=768
```

Bisected in the browser by mutating the live DOM: blanking the "until first
bell" label changed nothing; shortening the 60-character name took 827 → 768.

`styles.css` sets `overflow-wrap: break-word` on `<body>`, with a comment
saying it exists so "a hostile label" cannot "force horizontal page scroll and
fail the 320px reflow gate". The comment describes an intention the property
does not implement. **`break-word` allows a long word to wrap, but it does not
reduce the element's min-content contribution.** Every intrinsically-sized
ancestor still reserves the unbroken word's full width — here the `1fr` column
of `.period__row`, then `<main>`, then `body`'s grid track, which sized itself
to 811px inside a 768px viewport:

```text
parent=BODY display=grid gridTemplateColumns=811.266px justify=center
period__row  display=grid gridTemplateColumns=4.5rem 1fr auto
period__name overflowWrap=break-word wordBreak=normal minWidth=auto
```

`overflow-wrap: anywhere` is the value that shrinks min-content as well, applied
to the two elements that render a period name. The global `break-word` stays —
it is the right default for prose, and wrong only where untrusted input meets an
intrinsic size.

**Why the gate missed it for a day:** the test only ever opened the app at
09:30. It now runs in both clock states, and the new case was watched fail
against the old CSS before the fix went back in — a test that has never been
seen red is an assumption, not a gate.

**Lesson:** two of them. A CSS property whose name sounds like the requirement
is not evidence that it implements the requirement — `break-word` vs `anywhere`
differs on exactly the axis that mattered. And when a red test turns green for
an unrelated reason, check what it was accidentally covering before deleting the
accident.

---

### 2026-08-26 — the security headers reached the assets and missed every page

`next.config.ts` declared the five baseline headers once, the obvious way:

```ts
async headers() {
  return [{ source: "/(.*)", headers: securityHeaders }]
}
```

`next build` was happy, `next start` served the page, and nothing anywhere
said otherwise. Checking with `curl` rather than trusting it:

```text
GET /bell                              0 of 5 security headers
GET /bell/                             0 of 5   (308 redirect)
GET /bell/_next/static/chunks/...js    5 of 5
```

**The headers were landing on the JavaScript and missing the HTML** — the
single response an attacker frames, sniffs or leaks a referrer from.

The cause is `basePath`. `source` is matched with the prefix already applied,
so `/(.*)` becomes `/bell/(.*)`, which requires the slash and something after
it. `/bell/_next/...` matches. `/bell` does not. Assets are always deep paths,
so they were fine; the page is the bare path, so it never matched once.

AGENTS.md documents this precise trap one section over, about the hub's
rewrites — *"add both rewrites (bare `/bell` and `/bell/:path*` — the bare path
does not always match `:path*`)"*. It was written about `rewrites` and applies
to `headers()` for exactly the same reason. Reading a rule and recognising the
shape it describes somewhere else are different skills.

Fixed with two source entries, `/` and `/(.*)`, and re-measured: 5 of 5 on the
page, 5 of 5 on the assets, and `/bell/` a 308 to a `/bell` that carries them.

**Lesson:** a security header is not configured until a request has come back
carrying it. Every step before that — the config parses, the build succeeds,
the page renders — is fully compatible with the header being absent, which is
why this class of bug ships. The check costs one `curl -I`.

---

### 2026-08-27 — a reflow test that asserted a guarantee nobody had made

The first version of the live reflow test put a plain `<p>` holding sixty `A`s
into `<main>` and expected the page not to scroll. It failed at 320 and 375 px,
and for about a minute that looked like a CSS regression introduced by moving
`styles.css` into the Next app.

It was not. `globals.css` has carried a comment since 2026-08-26 saying exactly
what happened:

> `overflow-wrap: break-word` on `<body>` is not enough… break-word lets a long
> word wrap, but it does NOT reduce the element's min-content contribution.

The global rule is `break-word`; only `.period__name` and `.countdown__period`
get `anywhere`, which is the value that shrinks min-content and therefore the
only one an intrinsically-sized ancestor — here the body grid track — actually
reads. A bare paragraph was never covered.

Fixed by giving the injected element the class the guarantee attaches to, which
is also the shape a real period name has.

**Lesson:** a red gate is a claim about the code *and* a claim about the test. The
test was asserting a stronger property than the design system ever promised, and
"fix the CSS" would have been the wrong repair — it would have quietly widened a
rule the repo had already reasoned about and deliberately scoped.

### 2026-08-27 — Next ships an `aria-live="assertive"` region into every page

A new test asserting the shell has no live regions failed against
`div#__next-route-announcer__` — `aria-live="assertive"`, `role="alert"`,
visually hidden, injected by the App Router to announce client-side route
changes. It cannot be removed, and it did not exist in the plain build.

It also does not exist immediately. A probe run straight after `goto` found
nothing; the region arrives with hydration. A test that sampled the document at
the wrong moment would have passed for the wrong reason and gone red the day the
bundle got slower, so the assertion awaits it rather than racing it.

**Why it matters here rather than being trivia.** `AGENTS.md` is emphatic that
the countdown must never sit inside a live region and that period changes get a
deliberate, boundary-only announcement. The page now has an assertive region on
it that we did not author. It should stay silent — BellTab is one route with no
client-side navigation — but that is a claim, not a guarantee, and it is worth
re-testing in Phase 2 if anything ever calls `router.push`.

The test now enumerates it by name, so a *second* unplanned live region still
fails.

**Lesson:** "the page contains only what I put there" stops being true the moment
a framework arrives. An accessibility invariant expressed as "none" has to become
"exactly this list" and name the framework's contribution explicitly.

### 2026-08-27 — a ported test that could not fail for the reason it printed

The plain build's "never wraps the ticking values" test read:

```js
return ids.filter((id) => document.getElementById(id)?.closest(selector) !== null);
```

For an id that does not exist, `getElementById` returns `null`, the optional
chain short-circuits to `undefined`, and `undefined !== null` is **true**. So a
renamed or deleted element reported itself as *wrapped in a live region* — the
one thing the test exists to forbid — and the failure message would have sent
the reader hunting for a live region that was never there.

It never fired in the plain build because every id existed. Found while porting
the file to TypeScript, where the `?.` had to be looked at to be typed.

Fixed in the parked version: missing ids and wrapped ids are collected
separately and asserted separately, so "this test is checking nothing" is its own
failure with its own message.

**Lesson:** `?.` plus a `!== null` comparison is a bug pattern, not an idiom.
The optional chain produces `undefined`, and every strict comparison against
`null` downstream of it silently means the opposite of what it reads like. A
test whose "everything is fine" and "everything is missing" states produce the
same verdict is worse than no test.

### 2026-08-27 — `next build` rewrites `tsconfig.json` behind you

`allowJs: true` was in `tsconfig.json` only so `.tsx` could import the plain
build's `.js` modules. With the plain build retired it was dropped, along with a
comment explaining the removal.

The next `npm run build` put it back — and reformatted the entire file on the
way through, expanding every inline array and stripping every blank line that
separated the comments from what they annotate. The only notice was one line in
the build output:

```text
We detected TypeScript in your project and reconfigured your tsconfig.json
file for you.
```

Restoring `allowJs` in its original place made the next two builds leave the
file completely untouched, verified by diffing it against a copy taken before
the run rather than by trusting that it looked right.

**Lesson:** `next build` is not read-only with respect to the repo. A tidy-up
that removes a setting a tool expects will be reverted by that tool, at a moment
of its choosing, in a commit where it looks like unrelated noise. The setting is
kept and documented instead — including the note not to tidy it out again.

### 2026-08-27 — the App Router overwrites `document.title` a frame after you set it

**What broke.** `useTabTitle` was a four-line hook: a `useEffect` writing
`document.title` whenever the formatted string changed. It worked in the sense
that the write happened. Six E2E tests failed anyway, all of them asserting a
title, all of them reading `BellTab`.

**How it was found.** Not by reasoning — by watching. A throwaway spec attached
a `MutationObserver` to `<head>` and recorded every change:

```text
SEEN: ["35m · Period 2","BellTab"]
```

Our write landed first and Next's metadata pass overwrote it immediately after.
`document.title` was never wrong for more than a frame, which is exactly why
this is the kind of bug a foreground eyeball misses: with a live clock the next
tick would have corrected it a second later, and only a frozen test clock holds
the wrong state still long enough to see.

**The fix.** Stop writing the title imperatively and *render* it. React 19
hoists a `<title>` from anywhere in the tree into `<head>`, so `NowView` returns
one as its first child, and `metadata` in `layout.tsx` no longer sets a title at
all. SSR still emits `<title>BellTab</title>`, because the component renders that
until the clock has been read. Verified in the built HTML and by re-running the
probe: one title element, one value, no second write.

**The lesson.** Two owners of one piece of DOM is the bug, not the ordering
between them. The framework was always going to win the race; the fix was to
stop racing. And "it works when I look at it" is not evidence when the thing you
are looking at self-corrects once a second.

### 2026-08-27 — an installed Playwright clock is not a stopped one

**What broke.** A test fast-forwarded one second, asserted the seconds place
read `59`, fast-forwarded 59 more and asserted `00`. It failed with a call log
that is the whole story:

```text
6 × locator resolved to <span id="countdown-seconds">59</span>
2 × ... 58
2 × ... 57
2 × ... 56
2 × ... 55
```

The countdown was running underneath the assertion. `page.clock.install({ time })`
sets the clock and leaves it **ticking at real speed**; it is `pauseAt` that
stops it. Phase 1's tests never noticed because nothing on the page moved.

**The second half.** Adding `await page.clock.pauseAt(new Date(at))` straight
after `install` then failed intermittently — one test per run, never the same
one — with `clock.pauseAt: Cannot fast-forward to the past`. Between the two
calls a few milliseconds of real time elapse, so pausing *at* the install time is
pausing behind the clock. Fixed by installing a minute early and pausing at the
fixture: nothing is loaded yet, so the minute being skipped fires no timers.

**The lesson.** Both halves were invisible until something on the page moved
once a second, and both would have been flaky-in-CI rather than red-locally if
the countdown had ticked slower. A test harness that controls time needs its own
assertion that time is *not* moving; here that is the staleness check in
`countdown.spec.ts`, which fails loudly if the clock ever starts running again.

### 2026-08-27 — the lint rule was right and the fix was a different API

**What broke.** Nothing, yet — this one was caught before it ran. The
`localStorage` hook was the shape everyone writes:

```tsx
const [library, setLibrary] = useState(DEFAULT_LIBRARY);
useEffect(() => { setLibrary(loadLibrary(read())); }, []);
```

`npm run lint` refused it: `react-hooks/set-state-in-effect`, "calling setState
synchronously within an effect can trigger cascading renders".

**Why it was right.** The reflex is to reach for a disable comment, because the
pattern is load-bearing — the server has no `localStorage`, so reading it during
render is a hydration mismatch and the effect is how everyone defers it. But the
rule is pointing at something real: this is not component state that happens to
start empty, it is a *shared external store* being mirrored into React. Every
mount pays a second render, and two tabs on the same origin never learn about
each other.

**The fix.** `useSyncExternalStore`, which is the API for exactly this. It takes
a separate **server** snapshot, so hydration is safe by construction rather than
by deferral, and its `subscribe` argument turns the `storage` event into a first
-class input — so editing a schedule in one tab now updates the countdown in a
tab left open on a projector. That was not a feature anyone asked for; it fell
out of using the right thing.

The cost is a module-level cache, because `getSnapshot` must return a
referentially stable value or React re-renders forever, and `loadLibrary` builds
a fresh object every call. That is documented in the file rather than hidden.

**The lesson.** A lint rule that blocks a pattern this common is usually
describing a design problem, not a false positive. The disable comment would
have compiled, passed every test, and shipped both defects.

### 2026-08-27 — Chrome's time input is wider than any test could tell you

**What broke.** The editor's start column was 8rem, sized from the design
system's spacing scale. `input[type="time"]` in Chrome renders `08:00 AM` plus a
picker icon, needs about 9.5rem for it, and when it does not have that it
**clips silently** — the value is still there, still correct, still submitted,
just unreadable. At 320px it clipped to `08:00 A`.

**How it was found.** By looking at a screenshot. Not by a test: every
assertion in `editor.spec.ts` reads the input's `value`, which was right the
whole time, and the reflow gate passed because a clipped input does not
overflow — clipping is precisely how it avoids overflowing.

**The fix.** 9.5rem at full width, and a second stacking breakpoint at 22.5rem
where even one column of a two-up row cannot hold the control, so start and
length get a row each. Both numbers were measured rather than chosen.

**The lesson.** The reflow gate measures whether the page scrolls, which is not
the same question as whether the content can be read. A control that shrinks
its own contents to fit passes every automated check this repo has. Look at it.

### 2026-08-27 — the schedule's own name was never measured

**What broke.** An open gap from 2026-08-26 said, in as many words, that
`#schedule-name` was user input that had never been rendered at a hostile width.
Phase 3 finally gave it a route — the editor's name field — so the reflow test
was extended to type sixty unbroken characters into it as well as into a period
name.

It overflowed immediately, at 320, 375 and 768px:

```text
375px editor: page scrolls horizontally (744 > 375).
Widest: main.screen [16..744], header.screen__bar [33..727],
        div.screen__meta [110..727], p#schedule-name.screen__clock [110..624]
```

**The fix.** `overflow-wrap: anywhere` on `#schedule-name` — `break-word` wraps
the text but does not reduce its min-content contribution, which is the same
trap `.period__name` fell into in Phase 0 — plus `min-width: 0` on it and on
`.screen__meta`, because a flex item refuses to shrink below min-content by
default and the wrapping alone would have bought nothing.

**The lesson.** The gap correctly predicted the bug and sat open for a day,
because nothing could type into that field yet. A known-untested surface is a
bug with a delayed fuse; the useful move is to write the assertion the moment
the route exists, which is what happened here — the test was extended in the
same change that could first satisfy it.

### 2026-08-27 — a five-second boot wait, and a failure that named the wrong thing

**What broke.** `announcer.spec.ts`'s "never wraps the ticking values" failed
once in a full-suite run and passed on its own and on the next two full runs.
The countdown was fine. What actually timed out was `openApp`'s wait for the
app's first client render, which uses the default 5s `expect` timeout — on a
machine running six Playwright workers and a Next build at once, a cold start
plus hydration can exceed it.

**Why it mattered more than a retry.** CI runs with `retries: 1`, so this would
have gone green and stayed invisible. And the failure named a test about ARIA,
which sends the reader looking for an accessibility regression that was never
there.

**The fix.** The boot assertion gets a 15s timeout and a message that says what
it is waiting for. A broken app never satisfies it at any timeout; a busy one
does, a moment later. Two consecutive clean full runs afterwards.

**The lesson.** A shared setup helper's assertions are attributed to whichever
test happened to be running, so they need the clearest messages in the suite,
not the tersest.

### 2026-09-01 — every error message in the app was the wrong red

The axe scan's first run, on the first journey it reached: `color-contrast`,
serious, on `.editrow__error` and `#override-date-error`.

`--danger` is `#d8453f`, which measures **3.54:1** on `--surface`. That clears
3:1 — the bar for non-text contrast, WCAG 1.4.11 — so it is a correct border
colour and an incorrect text colour, and it had been used for both since the
design system was written. Every validation message this app has ever shown was
below the 4.5:1 that WCAG 1.4.3 requires for body text.

Fixed by splitting the token the way `--accent` was already split for exactly
this reason: `--cherry-deep` (#b32a25, 5.24:1 on surface and 5.81:1 on paper)
backs a new `--danger-text`, and the five `color: var(--danger)` declarations
now use it. Borders keep `--danger`. Dark mode needed no change — `#f06b65`
already measures 5.58:1 there — but the token is defined in both themes so
nothing has to branch.

**What is worth noticing is which gates did not catch this.**
`eslint-plugin-jsx-a11y` runs at full `recommended` and reads source, where a
contrast ratio does not exist. The reflow gate measures geometry. The
live-region enumeration checks three ids. The design system documented the
palette and nobody had multiplied it out. A rendered-document scanner was the
only thing that was ever going to find it, which is the argument the research
document had been making since August.

### 2026-09-01 — WebKit paints a `<select>`'s text outside the `<select>`

Found by the `test/three-engines` spike. The projects are not merged; **this fix
is**, because it is correct in every engine and the reflow gate covers it in
Chrome.

First run of the WebKit project, on the development machine: the calendar panel
scrolled the page sideways at every one of the five widths, with a 60-character
schedule name in the library. 822px inside a 320px viewport. (Measured on that
build specifically — see the entry below for why that distinction is not
pedantry.)

The Chrome fix from Phase 4 — `width: 100%` on the control — was doing its job:
the `<select>` really was 122px wide. WebKit simply painted the full
60-character option text outside it. `document.documentElement.scrollWidth` was
822 while **no element's bounding box exceeded the viewport at all**, which is
why the reflow gate's culprit list came back empty and named the header instead:
the overflow was not a box, it was ink.

Found by walking every element for `scrollWidth > clientWidth` rather than for a
wide rectangle. `label.weekday` was 122px wide with a scrollWidth of 658.

**Three fixes were tried on the control and all three were ignored in WebKit** —
`overflow: hidden`, `text-overflow: ellipsis` and `contain: inline-size` — because
a form control's text lives in a UA shadow tree that the control's own overflow
does not reach. Only an ancestor clips it.

Clipping the wrapping `<label>` worked and was rejected: a select draws its 3px
focus ring 2px outside itself and fills its label exactly, so that clip takes the
ring with it, and WebKit does not support `overflow-clip-margin` to ask for a
clip that spares it. Trading a visible focus indicator for a reflow fix is not a
trade worth making.

Shortening the option text in the component was tried next and abandoned on
measurement: the cap that works at 320px is about fifteen characters, which
mangles "Delayed start" to fix a case nobody normal reaches.

The fix is `overflow: clip` on the two CONTAINERS with `padding: 5px; margin:
-5px` — the padding puts the ring's 5px inside the clip box, the negative margin
gives them back to the layout so nothing moves. Verified in WebKit: 5px clear on
every clipped edge, and the page back to 320.

### 2026-09-01 — "WebKit has no `type="time"`" was true of one build and not the engine

Also from the `test/three-engines` spike. The placeholders and the arrow-key
test it produced are merged; the projects are not.

The other WebKit failure was the keyboard-only editor test, which types
`0300PM` — hour, minute, meridiem — into a segmented time control and expects
`15:00`. It got `"0300PM"`.

Probed across all three engines on the development machine, which looked
conclusive:

| | Chrome | WebKit (Windows) | Firefox |
| --- | --- | --- | --- |
| `input.type` for `type="time"` | `time` | **`text`** | `time` |
| `input.type` for `type="date"` | `date` | **`text`** | `date` |
| typing `0300PM` | `15:00` | `0300PM` | `15:00` |
| assigning `"not a time"` | `""` | `"not a time"` | `""` |

That build implements neither control: it falls back to a text input per the
spec's missing-value default and performs none of the value sanitisation a real
time input owes.

**And then CI disagreed, which is the actual lesson.** The first push of this
branch failed one test — the same keyboard test, on WebKit, on the Linux runner
— and the failure message carried `<input type="time" value="14:30">`. The
runner's WebKit **does** implement the control. It rejected the `0300PM`
keystrokes on their own terms rather than falling back to text.

So the finding as first written was wrong in the way that matters: it named the
ENGINE when the evidence only supported a BUILD. Playwright's WebKit is not one
thing, let alone Safari - it is WebKitGTK-ish on Linux, something else on
Windows, and neither is what ships on a Mac.

`AGENTS.md` asks for a citation or a test for browser-behaviour claims. There
was a test; it was run on one platform and generalised to an engine. The rule
needs a second half: a browser-behaviour claim also names where it was measured.

The corrected statement: **on the development machine's WebKit build both
controls degrade to text inputs; on the Linux CI runner's they do not.** The app
handles both, because the parser was always the thing doing the work.

**The app degraded correctly, which is the part worth recording.** The garbage
string reached `clockToMinutes`, came back `null`, and the row went
`aria-invalid` with a message bound to it and nothing committed. "Parse, don't
validate" held on an engine that gave the form no help at all — the boundary did
the work the control was not there to do.

What was missing was any hint about the format, so both fields gained a
`placeholder` — ignored wherever a real control renders, and the only guidance
where one does not.

The test now asks the ELEMENT what it is (`element.type === "time"`) rather than
branching on the project name or the platform, which is the only version that
stays true in both places and on the day a build changes its mind.

The keystrokes themselves needed a second fix. `0300PM` is 12-hour-locale
typing, and whether a time control has a meridiem segment at all depends on the
locale the browser was launched with — so the suite now pins `locale: "en-GB"`
beside the timezone it already pinned, making the control 24-hour everywhere and
the keystrokes four digits. Safe because the app formats every time it displays
itself, by integer arithmetic; there is no `Intl` and no `toLocaleString`
anywhere in `src/`, which is a project rule rather than an accident.

### 2026-09-01 — a cap that discarded the wrong end, and a date the type system waved through

Three findings from the Phase 4 review (`Docs/archive/code-review-2026-09-01.md`), two of
which were the same species: a user action that appeared to succeed and did
nothing.

**`setOverride` at the 400-override cap threw away the entry being added.**
`parseCalendar` enforces the cap with `slice(0, 400)` — it keeps the FIRST 400 —
and `setOverride` appends the new entry LAST. So at the cap the array handed to
the parser was 401 long, the slice kept the 400 already there, and the one the
user asked for was the one dropped. The function returned a library that looked
updated and was not.

The interesting part is that the UI gate was wrong in the *opposite* direction.
`atOverrideLimit` was `overrides.length >= 400` regardless of the date typed, so
at the cap the form refused to let you CORRECT an exception you already had —
which cannot grow the list — while the ungated "use this schedule today" select
happily added a new one that was then silently discarded. Both halves backwards,
from the same off-by-one-concept: the question is not "is the calendar full", it
is "would this grow the calendar". The guard is now on the filtered list, which
answers the second question by construction.

**The date input's value reached `setOverride` unparsed.** `IsoDate` is a bare
`string` alias — deliberately, and its comment says so — so nothing in the
signature objected. Chrome's `<input type="date">` accepts years past four
digits, so a typo of `20260` for `2026` produces `"20260-09-14"`: a value the
CONTROL considers valid and `parseIsoDate` rejects. `parseCalendar` dropped it
and `setNewDate("")` cleared the field, so the click emptied the form and changed
nothing, with no error bound to anything.

**The lesson is where "parse, don't validate" was only half applied.** The
boundary held — nothing invalid was ever stored, which is the parser doing its
job. What was missing is the other half the editor already does properly: the
structured error being shown to the person who caused it. A boundary that
silently discards is indistinguishable, from the user's side, from one that
accepted their input and lost it.

Fixed in both places on purpose. The mutator parses and refuses, so the data
behaviour is unit-testable without a DOM; the panel parses too, because a mutator
that refuses is still a control that did nothing.

**And one that was only cosmetic, but real.** The settings tabs carried
`aria-controls={`panel-${id}`}`, and only one panel renders at a time — so the
inactive tab's IDREF pointed at nothing. `jsx-a11y` cannot catch that: its
`aria-proptypes` rule checks the attribute's type, not whether an id exists at
runtime. Removed rather than made conditional; these are pressed-state buttons
whose panel is the next element in DOM order, and a button announcing that it
controls the thing currently showing is close to tautology.

**And a fourth, found while fixing the second, that was older than this phase.**
Widening `globals.css`'s invalid-field rule to reach the calendar panel turned up
that the rule had never painted anything anywhere. `.editor
[aria-invalid="true"]` is specificity (0,2,0); `.editor input[type="text"]` is
(0,2,1) and sets the `border` SHORTHAND, which resets border-color with it. The
shorthand won for the whole of Phase 3 and Phase 4.

Measured in Chrome before the fix: an editor field with `aria-invalid="true"`
computed `rgb(107, 85, 68)` - the passive border - identically to a valid one.
`--danger` is `#d8453f`. Nothing was ever red.

**Every test asserted the attribute, which was always correct.**
`toHaveAttribute("aria-invalid", "true")` passed throughout, because the
attribute was never the broken half. That is the lesson worth keeping: a test
that checks the attribute a style keys off is not a test of the style. Where the
visual state IS the point, measure the pixel - both suites now read the computed
`border-top-color` and compare it against the `--danger` token.

It was survivable only because of the rule that caused the review's finding 2 in
the first place: `AGENTS.md` bans a red border as the ONLY signal, so the message
and its `aria-describedby` binding were there and doing the work. The colour was
the redundant half.

A related miss in the same area: nothing but `.editrow__movebutton` had a
`:disabled` style. That went unnoticed while the only other disabled control was
Add period at a sixty-period cap, a state nobody reaches - and Phase 4 made it
obvious, because Add exception is disabled whenever the date field is empty,
which is how the form first renders. A disabled button that looks enabled is a
button people click at.

### 2026-09-01 — a crashed browser that looked like an app that would not boot

Three tests into the Phase 4 E2E work the full suite started failing
intermittently — one test per run, never the same one, always at 768px, always
either `the app never finished its first client render` or, once,
`browserContext.newPage: Target crashed`.

The first message is a lie the harness tells honestly. `openApp` waits for
`time#wall-clock` to carry its `datetime` attribute, which is the signal that
the client has mounted, and its failure message says the app did not boot. What
had actually happened is that Chrome died: Phase 4 took the suite from 83 tests
to 108, and eight Chrome instances plus a `next start` exhaust this machine. A
dead renderer and an app that will not hydrate look identical from outside.

**The fix that made it worse is the interesting part.** The obvious read was
contention, so the boot budget went from 15s to 30s — and the failure rate
DOUBLED, from one test to two. That is the tell that it was never a timeout: a
starved worker given longer holds its slot longer, so the extra time went into
starving the next worker rather than into finishing.

Capping local workers at four fixed it — three consecutive clean runs — and cost
nothing measurable, 26.3s against 27.4s, because the run had not been CPU-bound
at eight. It had been thrashing. CI keeps Playwright's default, since its runners
have fewer cores and pinning a number here would RAISE it on a two-core box.

The lesson is a general one about flaky suites: when a timeout increase makes
failures more frequent rather than less, the resource is the problem and the
clock is not.

### 2026-09-01 — a nav beside the editor, and 128px the editor did not have

Phase 4 put a settings nav in a `grid-template-columns: minmax(9rem, 13rem) 1fr`
beside the panel. The reflow gate failed at 768px on **the Phase 3 editor test**,
which had passed for a week and which Phase 4 did not touch.

The editor stacks its six columns at `max-width: 45rem` — a media query on the
VIEWPORT. The settings layout went two-column at `max-width: 40rem`, i.e. from
640px up. So between 640 and 720 the editor believed it had the viewport and had
the viewport minus a 13rem nav minus a gap, and its six-column row overflowed by
11px.

**The lesson is about the units, not the numbers.** A media query asks about the
viewport; a component wants to know about its own box. Any container-relative
decision expressed as a viewport media query is one layout change away from being
wrong, and nothing about the editor's CSS was wrong when it was written.

Fixed by moving the settings breakpoint to 60rem, which is derived rather than
picked: 45rem for the editor plus 13rem for the nav plus the gap is about 59rem,
and the card caps at 60rem, so above the breakpoint the panel is always at least
the 45rem the editor asks for. A container query would be the better answer and
is not needed for two panels.

### 2026-09-01 — the reflow gate had been passing on text alone

With a 60-character schedule name in the library, the calendar panel scrolled the
page sideways at 320 and 375px. The reported culprits were all in the HEADER —
elements that had been fixed months earlier and had `overflow-wrap: anywhere` on
them. They were innocent: `overflowingElements` reports the first five
overflowing boxes in document order, and the header comes first in the DOM.

Two separate causes, and both are worth writing down.

**The `<select>` is sized by its widest OPTION**, and every option in the calendar
panel is a schedule name somebody typed. `min-width: 0` was not enough and reads
like it should be: it removes the automatic minimum so a box *may* shrink, but it
does not reduce what the box ASKS FOR. `width: 100%` is what fixes it — a
percentage width is ignored while an ancestor is being intrinsically sized and
honoured during layout, so the control ends up the width of the box it was given
and truncates its own option text, which is what a select is for.

**`body` was a grid with an implicit `auto` column**, which sizes to its content's
max-content. So `.screen`'s `max-width: 60rem` never got a say: the track it sat
in was already 715px wide inside a 320px viewport. `grid-template-columns:
minmax(0, 1fr)` pins the track to the space that actually exists.

That second one is the structural fix this gate had been missing since the first
reflow bug in August. The existing `overflow-wrap: anywhere` rules stop
min-content from being large; nothing stopped max-content from propagating, and
every previous failure had happened to be a min-content failure. Both halves are
now in `globals.css` with comments saying which is which.

## Session log

The entries for completed phases live in `archive/`, moved on 2026-09-09
so this file loads at the size of the current work rather than the whole
history: [`build-log-phase-0-6.md`](archive/build-log-phase-0-6.md) for the
plain build through the end of Phase 6 (2026-08-26 to 2026-09-02, 58
entries), and [`build-log-phase-7-8.md`](archive/build-log-phase-7-8.md) for
the cutover through the Day view and the tidy-up (2026-09-02 to 2026-09-05,
17 entries). The tables above were not split. This log picks up at the
2026-09-04 audit.

### 2026-09-05 — a full audit: static review, then the app in a browser

An independent pass over the whole repository, then the same app driven through
a real Chrome. Written up in `Docs/code-review-2026-09-04-full-audit.md`;
nothing was fixed, so the findings live there rather than here.

The static half found no bugs — only drift: three doc comments that a later
insertion left sitting on the wrong declaration, four comments that now
contradict their code (section 13 of `globals.css` still argues for the equal
squares the strip stopped drawing), ~45 lines of unreachable CSS, six exports
with no importer, and `DayView` hardcoding `"data-motion"` beside an unused
`MOTION_ATTRIBUTE`.

The browser half found eight defects, two of them worth fixing first.

**The Backup panel scrolls sideways at 320px** — `scrollWidth` 345 against a
320 viewport, which is the WCAG 2.2 SC 1.4.10 failure `AGENTS.md` calls
blocking. The cause is the native file input's 311.5px intrinsic width in a
container sized to its content, so `max-width: 100%` never binds: exactly the
`<select>` problem this stylesheet already documents, missing the `min-width: 0`
half of the answer. It shipped because `reflow.spec.ts` and `a11y.spec.ts` both
loop over `["schedules", "calendar", "preferences"]` while `PANELS` has four
entries — Backup is the one panel with neither test.

**Every themed load logs a hydration mismatch.** `THEME_SCRIPT` sets
`data-theme` on `<html>` before React hydrates, so React compares server HTML
without the attribute against a DOM with it. The script is right and should
stay; `<html>` needs `suppressHydrationWarning`. Verified both ways: with
`theme: "system"` the script sets nothing and the error is absent.

The rest are smaller — the Day button reporting `aria-pressed="true"` while the
Now view is rendered, "1 schedules" in the import dialog, Chrome blanking an
impossible date so Add disables with no reason, and `--` meaning both "clock not
read" and "no schedule today".

What did NOT break is worth recording. A 764:1 deflate bomb inside the
`encodedChars` cap was stopped mid-stream. `toString` and `valueOf` as version
markers came back "newer version" rather than being invoked — the `Map` dispatch
fix, confirmed against a live page for the first time. An `<img onerror>` period
name stored verbatim and rendered as text. An invalid draft never reached
storage. And replacing `window.Date` at runtime — telling nothing that time had
moved — left the countdown, the title, the fill, the strip and the announcer all
correct on the next tick, which only works if every one of them is recomputed.

One open gap is owed regardless of what gets fixed: `loadLibrary` degrades a
library it cannot parse to the seeded defaults **silently**, and the next write
overwrites the original. The degrade is right; `parseLibrary` already produces
the sentence that should be shown, and the load path throws it away.

`.claude/launch.json` gained `"autoPort": true` — port 3000 was held by another
dev server. That is the only change to the tree.

### 2026-09-05 — B1 and B5: the panel the gate never opened

The first two findings from `Docs/code-review-2026-09-04-full-audit.md`, fixed
together because they are one problem seen from two sides: the Backup panel
overflowed at 320px, and the reason nobody knew is that neither the reflow
suite nor the 320px axe sweep ever opened it.

The CSS half is two declarations, and the stylesheet had already written the
argument for them beside the calendar's `<select>`s. The suite half is the one
that mattered more: `src/app/_lib/panels.ts` now holds `PANELS` and
`PANEL_IDS`, `SettingsView` renders from it, and both specs loop over it. The
module is deliberately React-free so a Node spec can import it without dragging
four panel components and a `"use client"` boundary along.

A guard test in `reflow.spec.ts` compares the tab ids the app renders against
the ids the suite iterates, so a fifth panel that is added to the app but not
to the manifest fails loudly instead of quietly going untested. It sits outside
the width loop on purpose — the set of panels does not change with the
viewport, and inside the loop it would be forty-five copies of one answer
across five widths and three engines.

Coverage went from three panels to four in the axe sweep, and from
hand-written-per-panel to every-panel in the reflow suite. Confirmed by
negative control: reverting the CSS turns exactly one test red.

Still open from the same audit: the hydration mismatch on every themed load
(B2, a one-attribute fix that is verified but not applied), and the silent
library wipe (B3), which wants a design rather than a patch.

### 2026-09-05 — B2: the mismatch, the correction, and the pin

`suppressHydrationWarning` on `<html>` in `layout.tsx` - THEME_SCRIPT's other
half, with a comment saying so. On `fix/theme-hydration-warning`, stacked on
PR #53 because the audit's Open gaps rows live there.

The finding was downgraded from High to Low while being fixed, and the way that
happened is the entry above in Bugs found: the guard test passed before the fix
against the production build, which sent me to measure, and the measurement
was zero. Two tests came out of it. A source pin in `preferences.test.ts`
beside the existing THEME_SCRIPT pins - `layout.tsx` is read as text because it
imports `next/font/google`, which only resolves under Next's compiler - and it
goes red the moment the attribute is removed. And a production E2E test that a
themed load logs no console errors at all, written to be honest about what it
can see: not the dev warning, but every real failure production does report.

Verified in the dev preview with `theme: "light"` stored: attribute on <html>
before paint, no Issues badge, no hydration error. 442 unit tests, lint,
typecheck, markdownlint green.

### 2026-09-05 — B3: the library that could not be read now says so, and keeps its bytes

The last of the audit's three defects worth fixing before the next deploy,
and the only one that needed a decision rather than a patch. The decision:
keep the degrade, add three things it was missing - the sentence, the reason
and a way back - and never block. No server, no new dependency, hundreds of
bytes.

`loadLibraryReport` is `loadLibrary` plus the one fact it used to discard:
whether a value was there at all. `null` for a fresh install AND for a
readable value - a new browser is not a problem. `parseLibrary`'s errors now
carry a `field` (`json` / `shape` / `schedules`) so the loader can say the
same thing in storage's voice instead of reusing sentences about "that file"
and the Export button. `libraryStore` sets the problem inside `load` and never
emits there - the same assign-don't-notify discipline `localStore` already
uses for its own cache, because `load` runs during render. The quarantine
happens in `saveLibrary`, in the event handler, before `store.save`: order is
the whole fix. Dismiss hides the banner and leaves the quarantine armed.

`LibraryNotice` reuses `.offer`, so no CSS moved. Download uses Export's
object-URL pattern and writes the bytes exactly as they were - a future
BellTab, or a person with an editor, may read what this one could not.

One thing left deliberately imperfect: after the first save the banner still
offers "kept aside the first time you save a change", which has by then
happened. Clearing it at that moment would take the Download button away
mid-read; the next load clears it, and the E2E asserts that.

### 2026-09-05 — B4, B6 and B8: three small ones, and one left open on purpose

The audit's remaining small defects, on `fix/small-audit-items`, each a few
lines and none touching an invariant.

The Day/Now switcher reported what was PRESSED rather than what RENDERED, so
on a weekend a screen-reader user was told "Day, pressed" over the Now view's
"No school today". One predicate, `dayViewShown`, now drives both the render
and the two `aria-pressed` values; the `screen` intent is kept, and the list
comes back the next day it can. The weekend test had encoded the old
behaviour - that is what a test does when it is written from the code rather
than from the contract - and now encodes the new one, with two switcher tests
covering both directions.

The header's `--` meant three things. It now means one - the clock has not
been read - and the two empty states say "No school" and "No schedule" in the
words the headline beneath already uses.

"This backup holds 1 schedules" had a twin the audit missed: the
`window.confirm` fallback said "Replace all 1 schedules". One
`pluralSchedules` owner for the summary, the dialog and the fallback.

B7 - Chrome blanking an impossible typed date so Add disables with no reason -
is left open, and the gap says why: the fix wants `validity.badInput`, which
could not be measured with a programmatic set, and a guessed fix on a
Low-severity finding is worse than an honest row in this table.

### 2026-09-05 — S1 to S5: the comments say what the code does again

The audit's first five quality items, on `chore/audit-quality-s1-s5`: no
behaviour change, forty-four fewer lines.

Three doc comments had been separated from what they documented by a later
insertion and were sitting on the wrong declaration - `tabTitleFor`'s on
`scheduleForToday`, `describeOffset`'s on `LARGE_OFFSET_SEC`, `.strip__seam`'s
on `.strip__pair`. Section 13 of `globals.css` still argued for the equal
squares the strip stopped drawing on 2026-09-04, forty lines above a comment
that superseded it. Both are fixed by moving words, not code.

Dead CSS out: `.shiftall*` (no markup anywhere, including tests) and every
`.strip__cell--link` rule (the connector cells that stopped rendering when
passing periods stopped being drawn). `DayView` now reads `MOTION_ATTRIBUTE`
rather than repeating `"data-motion"` - the one duplicated literal
`theme.ts`'s own header forbids. Five symbols with no importer are no longer
exported, and two of their doc comments no longer claim a caller.

One of the audit's S5 claims was wrong, and the build did not hide it:
un-exporting `formatPeriodLabel`'s `ClockOptions` parameter broke
`format.test.ts`, which pins the 24-hour form for exactly that function. "No
caller in the app" was true; "no caller" was not. The parameter stays, with a
comment that says why, and the audit doc carries the correction beside the
original. Same lesson as the B2 downgrade: a claim about the code is checked
against the code, and the test suite is part of the code.

Then the three condensations that were safe to fold in. `today.ts` resolved
the calendar and looked the answer up in the library four separate times; it
is one `scheduleOn` now, returning `IdentifiedSchedule` because that is what
the library holds - the first draft said `ValidSchedule` and `indexOf` refused
it, which is the brand doing its job. `bells.ts` carried two byte-identical
`subscribe` functions and two `return null` server snapshots over one
listener set; one of each. And the trailing `.env*` in `.gitignore` that had
defeated `!.env.example` since the file was written is gone, checked with
`git check-ignore` in both directions.

S8 was measured instead of built. All seven CI job names are required status
checks on `main` - so "fold three jobs into one" would silently drop three
required checks, the trap this repo already fell into once with the E2E job's
name. And the timings say the folding was never worth it: the small jobs are
20-28 seconds each in parallel, the E2E job is 7m53s. The one change that
would move wall-clock - WebKit and Firefox on a tagged subset - reduces
cross-engine coverage on purpose, which is a decision for the owner, not a
cleanup for a reviewer.

S10, the half the owner asked for: `Docs/archive/` exists at last, the five
completed reviews are in it, and every path that named them - twelve, in
eight files, three of them source comments - points at the new place. The
build log stays in one piece; "just do one archive move" was the whole ask.

### 2026-09-08 — the E2E job, scoped on the engine axis, with the research that says why

Audit finding S8, resolved by research rather than by guessing: the owner
brought an outside document on shortening the E2E job, and it lives in
`Docs/research/e2e-ci-runtime.md` verbatim under a caveat block that resolves
every item it could not read - it had no access to `playwright.config.ts`,
`ci.yml` or `e2e/` - against what the repo actually has. Three of its
unknowns mattered: `main` is three-engine (its README read was stale), CI
workers were Playwright's default of 2 on a 4-vCPU runner rather than the 1
it feared, and the tests are independent (no `describe.serial`, no
`storageState`), which is what makes raising workers safe to try.

The owner's first idea was high / medium / low priority tiers, and the
research argues against it convincingly enough that the tiers are in the
roadmap's Deferred table with the reason: cutting coverage on "which tests
are low-risk" is a judgement that drifts and nobody revisits, while cutting it
on the ENGINE axis is exact - a PR knows precisely what it did not check - and
self-correcting, because the full run happens on every merge and every night.

So: `PW_ENGINES` decides the projects, Chrome alone by default and all three
for `all`; `ci.yml` sets it to `chrome` on a pull request and `all` on a push
to `main` and on a new nightly schedule at 06:00 UTC; and `workers` is `100%`
on CI. The job keeps its exact required-check name and stays one job - a
matrix would have hung every PR on a check that never reports again, which
this repo has already been bitten by once. A PR run is 283 tests on Chrome;
the full run is 849.

The worker count is an experiment with a measurement attached, and the config
says so: this file already records that too many workers made the suite
intermittently red on a laptop, and "an intermittently red suite is worse than
a slow one" still holds. The PR that carries this change is the measurement.
One boot-wait failure at 100% is the signal to drop back, and the row below
will say which way it went.

**Measured, first run (PR #58, run 34241659825):** the E2E job took **3m24s**
against 7m53s on the last three-engine run - Playwright itself 2.6 minutes
for 283 tests on Chrome, all passed, no retries, no boot-wait failure. The
other six jobs were unchanged at 19-27s. So the two changes together took
about 4½ minutes off every pull request, and the worker experiment survived
its first run. **Second sample**, the rebased re-run: **3m32s**, 288 passed
in 2.7 minutes, again no retries. Two clean runs is the bar the config
comment set; the merges to `main` and the nightly keep measuring.

Not done, on purpose: reusing the `Next build` job's output in the E2E job
(the research's Stage 1.3, worth ~40-60s) and sharding (its Stage 3) wait
until the Chrome-only run is measured, per its own ordering. The one slice of
the tiering idea it endorses - a tiny local smoke set for a pre-push signal,
never the PR gate - is an offer, not a change.

### 2026-09-08 — B7 after all: the measurement was makeable, and two events that do not fire

The one audit defect left open was open because "a typed impossible date
needs a real keystroke sequence per engine, which automation cannot make".
Playwright's `keyboard.type` drives a date control through real key events,
and a probe on all three engines settled it in half a minute: a typed February
30th leaves `value` at "" with `validity.badInput` true, on Chrome, Firefox and
WebKit alike. The programmatic set that had reported `false` was the wrong
instrument, not evidence of a missing one - the same lesson as the S5 claim
and the B2 severity, from the other direction: this time the measurement said
the fix WAS possible.

The fix is a state flag read from the control's validity, and the interesting
part is where it can be read. Not on change: the value goes from "" to "", so
React sees nothing. Not on blur alone: Chrome's segmented control swallows Tab
to move between month, day and year, so the probe's Tab left focus exactly
where it was - `activeElement` was still the field. Key-up fires per keystroke
into a segment on every engine, so the panel reads validity there, on blur for
a pointer leaving, and on change for completeness. A typed impossible date now
gets "That isn't a date that exists. Check the day and the month.", the field
is `aria-invalid`, and Add stays disabled until a real date replaces it.

One E2E test that types rather than fills - the measurement is the reason it
types - green on all three engines; with the validity reads disabled it fails
on its first assertion. The a11y sweep is unchanged: the error element is the
one that already existed, with a different sentence.

Also folded in: `BackupPanel`'s unused `fileRef`, the S5 leftover deferred
while #57 owned that file. And the number the last entry promised: the first
push to `main` under the engine-scoped CI ran all three engines at 100%
workers in 8m5s, green. The full run is not faster and was never going to
be: three engines and `next start` on four cores are CPU-bound. The ~4½
minutes came off pull requests, which is where the research said they would.

Nothing from the 2026-09-04 audit is still open.

### 2026-09-09 — a bell is the clock crossing a boundary

The owner reported that stepping the running period's times in the editor
chimed on every step. The diagnosis, the fix and the lesson are in Bugs found
above; the shape of the change is small. `crossedBell` joins the engine as a
pure function of a schedule and two seconds-of-day. `useBellCrossings` sits
in `App.tsx` beside the one clock and counts genuine crossings against the
schedule in force. `useBells` and `PeriodAnnouncer` take the count instead of
computing a key, and `boundaryKey` keeps its one remaining job - the name
crossfade in `NowView`, which is cosmetic and was never wrong.

Verified with the user's own gesture on the production build: the spinner
and the time control's segments, four saved edits, zero strikes, an empty
announcer, and then a real boundary crossing that still rings exactly once.
Negative control against `main`'s sources: both tests red at the line that
matters. 455 unit tests, lint, typecheck green; bells, announcer, countdown
and a11y specs on all three engines.

### 2026-09-09 — the completed phases' session entries move to the archive

The other half of S10, decided in conversation on 2026-09-09: option B, by
phase, with Decisions left whole. The file was 5,589 lines and 396 KB, and
two sections were 86% of it - the session log at 3,431 lines and Bugs found
at 1,402. The session log is the one that grows with every change and the
one that made this file the conflict surface on every parallel PR this week;
Bugs found is the part that gets read.

So the session entries for Phases 0 to 6 - 58 of them, the first plain-HTML
commit through the manifest that closed Phase 6 - are in
`archive/build-log-phase-0-6.md`, and the 17 for Phases 7 and 8 - the cutover
plan through the Day view's return, ending with the tidy-up that said nothing
was in flight - are in `archive/build-log-phase-7-8.md`. Verbatim, with only
same-directory links given a `../`. The live log picks up at the 2026-09-04
audit, at 2,482 lines. Decisions, Deviations, Known limits, Open gaps, Closed
and Bugs found were not moved: 190 rows is most useful whole, and the lessons
are what people come here for.

Checked, not assumed: 58 + 17 + 9 = 84 entries, the number `main` had; no
archived-era heading remains in the live file; every markdown link under
`Docs/` resolves; markdownlint is clean. "How to update this file" gains a
fourth point saying how the next phase gets archived.

### 2026-09-09 — the E2E job reuses the build, and a nine-test smoke run

The two optional halves of the E2E research, done together at the owner's
request, on `chore/e2e-reuse-and-smoke`.

**Build reuse.** The `Next build` job and the E2E job each ran `next build`
on every push - the same build, 25-30 seconds twice. The build job now
uploads `.next` (minus the incremental cache) as a one-day artifact, the E2E
job `needs` it, downloads it, and sets `PW_PREBUILT`, which makes
`playwright.config.ts` run `next start` alone. Locally nothing changes: the
variable is unset and the config builds first, as it always has. The suite
measures the same shipped CSS either way, because it is the same build
either way. What `needs` costs is the build job's own ~30 seconds before the
E2E job can start, so the saving is the difference, not the whole build;
the PR that carries this is the measurement, against 3m21s-3m32s.

**Measured (PR #62, run 34360777814):** the E2E job itself took **2m32s** -
Playwright 1.7 minutes for 291 tests, the artifact download a few seconds -
against 3m21s-3m32s before. But it could not start until the build job had
uploaded, which was +42s into the run, so the run's wall-clock went from
about 3m25s to **3m14s**: the job lost nearly a minute, the wait for it lost
about fifteen seconds. Honest arithmetic - `needs` costs what it costs, the
build job's 40s including the upload. Kept: fifteen seconds off every PR for
zero coverage change and a build that is the same build, and the E2E job's
own log now reads as tests rather than tests plus a compile.

**Smoke.** The one slice of the priority-tier idea the research endorsed: a
local pre-push signal, never the gate. Nine tests carry `@smoke`, one per
core journey - the countdown's digits, title and catch-up; the Day view; the
editor via the announcer's typing test; the chime at a boundary; a share link
round trip; a dated exception; and the unreadable-library notice - and
`npm run e2e:smoke` runs them on Chrome. Measured locally against a prebuilt
app: **nine passed in 8.6 seconds**, 9 seconds wall-clock; with the build in
front of it, under a minute. The README says what it is for and what it is
not.

Also merged today, on the owner's word: Dependabot's #51 (five patch bumps)
and #52 (vitest 4 to 5). The major was checked against its own release notes
before merging rather than trusted to a green run: Node 24 clears the new
floor of 22, the suite has no `vi.*` mocks for the new clear-by-default to
touch, nothing uses the removed `sequential`, and the one `$name` title just
loses its quotes.

### 2026-09-10 — the closing review: five passes, seven defects, nothing fixed

Asked for at 09:15 as "one last code review like we did for 2026-09-04 and
then consider project closed" - optimizations, condensations, dead code, bugs
and a web QA pass, each given real time. Written up in
`Docs/code-review-2026-09-10-full-audit.md`; this entry is the day's account.

**Baseline** at `f1d58dc`, clean tree: lint, typecheck and markdownlint green;
455 unit tests green; and `npm run e2e` on Chrome against a fresh production
build, **291 passed in 2.4 minutes**, no flakes. The one wrinkle was local:
`node_modules` still held vitest 4.1.11 and next 16.3.3 against a lockfile
that has said 5.0.0 and 16.3.4 since #52 and #51 were merged yesterday, so the
455 ran on the old majors here while CI has been on the new ones. `npm ci` at
the end of the session brought the tree up to the lockfile: **455 of 455 on
vitest 5.0.0**, zero audit findings, lint and typecheck unchanged.

**The four static passes** ran in parallel. Optimizations found the hot path
already efficient - one interval, O(periods) arithmetic per tick, 19 KB
gzipped of application code - and five items, two worth doing (a 39-second
`--with-deps` on the Chrome-only CI path; five reflow tests that duplicate the
loop beneath them). Condensations found fifteen, the largest again in `e2e/`,
where six recipes are spelled out across specs that `helpers.ts` was created
to hold, plus eleven comments that describe code that has since changed -
including one orphaned JSDoc introduced by fixing the LAST audit's S6. Dead
code found the 2026-09-04 items fully closed and six new ones, the sharpest a
`=== null` on a field typed `string` in `App.tsx`. The docs link checker
found every relative link and anchor in all 34 Markdown files resolving after
the 2026-09-09 archive move. The bugs pass was cut off once by a rate limit
before it had read anything and was relaunched; second time through it found
five defects and, more usefully, wrote down thirty-odd things it tried to
break and could not.

**The browser pass** drove the dev build through the in-app Chrome with the
DOM read directly, and replaced `window.Date` at runtime to walk the clock
through a period boundary, dismissal, the first bell, a Saturday and the
midnight rollover - every surface followed on the next tick, and a tab that
"slept" from 09:30 to 12:36 woke with exactly one announcement, as the
2026-09-09 rule promises. Share links: a hostile schedule name rendered as
text with zero elements created; nine malformed fragments each refused with
the right sentence; "Keep it" wrote the dated exception and cleared the hash;
"No thanks" wrote nothing. Imports through the real file input: garbage, an
array, a backwards period and a `__proto__` payload refused, and
`Object.prototype` untouched. Theme and strip changes crossed to a second tab
through the `storage` event. Calibration measured -7 and +7 correctly and
refused at 09:30. The production headers were `curl`ed and all five are
there.

**What the browser saw that the code review could not.** The preview pane
was hidden for most of the session, and after about five minutes Chrome
applied intensive throttling: the one-second interval fired roughly once a
minute, every snapshot between wakeups showed the same second, and a
calibration press against the stale reading measured -30 instead of -7.
Dispatching `visibilitychange` - the event `useNow` listens for - caught
everything up in one repaint, and the same press then measured -7. That is
the research's central claim, watched rather than cited, and it is the reason
the first invariant is the first invariant. Recorded in Decisions.

**Seven defects, one Medium.** Focus lands on the gear button on every load
(P1) - the settings focus effect lacks the first-mount guard its sibling has,
and the test that would have caught it asserts the wrong element. A period
ending at 24:00 is legal to the parser and unrepresentable everywhere else
(Q1 + P3): never reaches "after", never rings, the end box empty, `12:00` as
its label. Typing a bell offset can ring a bell (P4), because an offset is a
clock movement and the 2026-09-09 rule rings on clock movements - a decision
owed, not obviously a bug. "Keep it" is silent at the caps (P5). A fractional
length makes a string that is not a time (P2). The tab title stays in minutes
for an eight-hour wait (Q2). All in Open gaps with file and line; two in Bugs
found with their lessons. Nothing in `src/`, `e2e/` or the configs was
changed.

**Not reproducible from a hidden pane:** Escape closing the delete dialog and
Escape leaving settings - synthetic keys did not reach the dialog's cancel
through a hidden tab, so both were closed by clicking. Both contracts are in
`confirm-dialog.spec.ts` and `editor.spec.ts`, which passed on Chrome in this
session. Reflow at 320 px was not eyeballed for the same reason; the gate
that measures it passed.

### 2026-09-10 — the three cheap ones from the closing review, on `fix/closing-review-items`

Asked for at 12:05 as "commit as is and then sure lets get these last things
in - they don't seem like they would take long", once the review itself was
on `docs/closing-review` (#64). They did not: P1, the 1440 pair (Q1 + P3) and
P2, about forty lines including tests and comments.

**P1, the focus guard.** `App.tsx`'s settings focus-return effect gets
`hasOpenedSettings`, the same ref-shaped guard Big mode's effect has carried
since Phase 6, with a comment saying what six phases without it did. The
E2E in `editor.spec.ts` asserts `document.activeElement === document.body`
after `openApp` - the assertion that catches ANY stolen focus, which is the
lesson from Big mode's test checking only its own button. **Negative
control:** with the guard commented out, exactly that test fails, at the
`not.toBeFocused()` on the gear; with it, the editor, Big mode and a11y specs
pass 55 of 55 on Chrome. Live in the dev preview: body focused on load, the
settings heading on open, the gear on close.

**Q1 + P3, midnight as an end.** `toMinuteOfDay` caps at a named
`LAST_MINUTE_OF_DAY` of 1439, and `endMin: 1440` gets its own sentence, "A
period has to end before midnight.", so the person who typed 23:20 + 40 is not
told their length is not a length. `endOf` in the draft blanks an end that
lands exactly on 1440 (its guard was `> 1440`). The plan's `[0, 1440]` now
reads `[0, 1439]` with a note, and Deviations has the entry - a plan-level
value changed, so it is recorded as one, not as a bug fix. Live: 23:20 with a
length of 40 shows an empty end box, both boxes `aria-invalid` with the
midnight sentence, and nothing saved; 39 gives 23:59 and saves.

**P2, integers only.** `endOf` checks `Number.isInteger(minutes)` rather than
`isFinite`, so a typed `0.5` blanks the end instead of producing "08:0.5".
Live: the parser's "That is not a length." on both boxes.

Four unit tests added (459 pass on vitest 5), one E2E; lint, typecheck and
markdownlint green. Nothing else from the audit was touched - P4 is a
decision the user has not taken, and P5, Q2 and the quality findings stay in
Open gaps.
