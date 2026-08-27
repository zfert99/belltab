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

---

## Current state

**Working:** the countdown and the editor. Phase 3 made the schedule the user's
rather than the seed data's.

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
- The stylesheet's three font tokens resolve to real self-hosted faces.

**Retired:** the plain HTML/CSS/JS build. Phase 1 replaced the modules it
imported with `.ts`, which a browser cannot load, so `src/index.html`,
`src/app.js`, `src/store.js`, `src/ui/` and `scripts/serve.js` are gone. Their
behaviour — three views, the editor, the calendar, preferences — is owed back by
Phases 2–4 and its tests are parked, not deleted. See **Open gaps**.

**Not started:** multiple schedules and the calendar UI (the calendar is *read*
but not editable), sharing, bell offset, wake lock, chime, PWA.

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
      library.ts  libraryStore.ts  draft.ts
      today.ts  useNow.ts                        + colocated tests
    _components/  the client tree
      App.tsx  NowView.tsx  PeriodAnnouncer.tsx
      SettingsView.tsx  ScheduleEditor.tsx  PeriodRow.tsx  icons.tsx
  lib/          pure: no DOM, no React; `Date` only as an argument
    schedule.ts  engine.ts  parse.ts  format.ts  clock.ts   + colocated tests
e2e/            Playwright, top-level by rule, not colocated
  helpers.ts  reflow.spec.ts  confirm-dialog.spec.ts  announcer.spec.ts
  countdown.spec.ts  editor.spec.ts
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

### The calendar is read a phase early — 2026-08-27

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

## Open gaps

| Opened | Item | Notes |
| --- | --- | --- |
| 2026-08-26 | 12-hour clock has no am/pm | Matches the mockups and is unambiguous for a school day. Revisit if a schedule ever crosses noon ambiguously. |
| 2026-08-26 | WebKit and Firefox are not covered | The E2E suite runs one project, `chrome`, against the browser already installed on the machine — no engine binaries were downloaded. `AGENTS.md` asks for real WebKit coverage, which is where `<dialog>`, `:modal` and `inert` behaviour is most likely to differ. Add the projects and `npx playwright install webkit firefox` when the download is worth it. |
| 2026-08-26 | TypeScript is a major version behind on purpose | 6.0.3 rather than 7.0.2, because `typescript-eslint` cannot load under TS 7. This is a real cost — TS 7 is the Go rewrite — and it is deliberate, not neglect. Revisit when typescript-eslint#10940 lands; the upgrade should be a one-line version bump plus a full lint run. |
| 2026-08-26 | The headers have still never been verified on Vercel | `vercel.json` is gone and the list now lives in `next.config.ts`, verified against a real `next start`. What remains unverified is the deploy itself, and the hub's rewrite in Phase 7 — a second hop that can drop headers. |
| 2026-08-27 | `next build` now needs the network | `next/font/google` fetches the three families at BUILD time. Runtime is still network-free — that invariant is untouched, and the emitted HTML was checked for Google hosts — but an offline `npm run build` now fails where it used to succeed. Next caches the downloads, so this bites a cold checkout rather than a rebuild. Self-hosting the `.woff2` files in-repo with `next/font/local` would remove it; not done, because it means committing binaries and hand-tracking upstream revisions. |
| 2026-08-27 | Next ships a live region we did not write | `div#__next-route-announcer__` is `aria-live="assertive"` `role="alert"`, injected by the App Router after hydration and not removable. It should stay silent — one route, no client navigation — but `AGENTS.md`'s "never wrap the countdown in a live region" now has a framework-owned region on the page to coexist with. The announcer spec enumerates it so a second one cannot arrive unnoticed. |
| 2026-08-27 | Theme persistence is gone, and its replacement needs a CSP hash | The retired `index.html` set `data-theme` from `localStorage` in a render-blocking inline script, to avoid a flash of the wrong theme. `globals.css` still honours `[data-theme]`, but nothing sets it. Phase 6 owes both the toggle and a way to apply it before first paint that does not need an unhashed inline `<script>`. |
| 2026-08-27 | The Day view has no phase | The retired plain build shipped one (day progress bar, eleven period rows, a Now/Day switcher) and `Docs/roadmap.md` never scheduled it back. Its parked reflow assertions and the `#day-remaining` id therefore point at nothing with a date on it. Either schedule it or delete the parked block; leaving it is how a test file starts lying. |
| 2026-08-27 | The Phase 2 gate is unverified in Safari | The roadmap's gate names Safari specifically, because its throttling thresholds are the thinnest evidence in the research. What has been verified is Chrome, with a scripted clock: `visibilitychange` and `focus` both recompute correctly across a ten-minute sleep and across two period boundaries. A real Safari tab, backgrounded for real minutes, is still owed — and WebKit is still not in the Playwright projects. |
| 2026-08-27 | Two empty states have no call to action | The design system asks the "no schedule today" screen for a link to pick a schedule and the "no schedule at all" screen for the onboarding path into the editor. Both render honest copy and no link, because there is nowhere to link to until Phase 3. |
| 2026-08-27 | The `no-schedules` empty state is unreachable | It renders only when the parsed library is empty, and the library is `DEFAULT_SCHEDULES` frozen at module load — which `parse.test.ts` proves always parses. So the screen exists, is typed, and is covered by unit tests, but no E2E can reach it until Phase 3 wires localStorage and a corrupt value can produce it. |
| 2026-08-27 | The design system's period-change crossfade is not implemented | `Docs/design/design-system.md` section 4 asks for a single 150ms crossfade of the period name at a boundary. The name swaps instantly. The global `prefers-reduced-motion` block already covers the reduced path, so adding it is additive; not doing it is the honest state today. |
| 2026-08-27 | The E2E suite is 83 live and 22 parked | Up from 49/33. What is still parked needs the calendar panel (Phase 4), preferences (Phase 6), Big mode (Phase 6) or the schedule-delete dialog (Phase 4). |
| 2026-08-27 | The editor is a long tab chain | Twelve rows of six controls is seventy-two stops between the schedule name and the bottom of the form, and the keyboard test needs a 120-press budget to cross it. Nothing is unreachable and nothing is trapped, so this is not a failure — but a skip link, or grouping each row so a screen reader can jump by row, would make it usable rather than merely operable. |
| 2026-08-27 | There is no undo | Deleting a period is immediate and unconfirmed, and the only way back is to retype it. Deliberate for a four-field row whose result is visible behind the editor, and the reason Phase 3 ships no confirm dialog. It stops being defensible once Phase 4 can delete a whole schedule. |
| 2026-08-27 | The schedule name field has no visible label | It carries a `.visually-hidden` "Schedule name", so assistive tech is fine, but sighted users see a large text box containing "Regular" and have to infer what it is. The retired build had the same shape. A visible label or a placeholder is owed. |
| 2026-08-27 | Cross-tab sync is untested | `useSyncExternalStore` plus the `storage` event means editing in one tab updates a countdown left open in another. That fell out of using the right API rather than being built, and no test opens two tabs — so it is claimed, not demonstrated. Playwright can do it with two pages on one context. |
| 2026-08-27 | The onboarding empty state is still a dead end | With no schedules the countdown says "No schedule yet" and the editor says "There is no schedule to edit". Creating one from nothing is Phase 4's "new schedule" control. Reachable today only by hand-editing `localStorage`, which is why it has an E2E test and no route. |
| 2026-08-27 | No automated accessibility scan | `Docs/research/accessibility-responsive-qa.md` recommends `@axe-core/playwright` on every journey, with zero critical/serious violations to release, and the editor is exactly the surface that pays for it. Not added: it is a new dependency and outside the roadmap's Phase 3 list. The blocking checks today are `eslint-plugin-jsx-a11y` at `recommended`, the reflow gate, the live-region enumeration and a keyboard-only E2E pass — which the same research is explicit is not the same thing. |

## Closed

| Opened | Closed | Item |
| --- | --- | --- |
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
`Docs/code-review-2026-08-26.md`. Five findings, all open; each has a row in
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

Branch `fix/code-review-437ef54`. Everything in `Docs/code-review-2026-08-26.md`
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
written up in full as `Docs/code-review-2026-08-27.md`. Three findings, all
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
