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

**Working:** a plain HTML/CSS/JS app, no build step.

- Three live views — **Now** (timer + period strip), **Day** (the readable
  list), **Big** (the projector).
- **Settings** with all three sections built: Schedules (a full editor),
  Calendar (weekday map + dated exceptions), Preferences (theme, 12/24-hour).
- Multiple schedules, resolved per day, persisted to `localStorage`, surviving
  midnight rollover.

**Not started:** sharing (versioned hash encoding, export/import), bell offset,
wake lock, chime, PWA, and the entire Next.js/TypeScript port.

### Files

Imports flow strictly one way, top to bottom. Nothing below imports anything
above it, so the graph is a DAG and no module is half-initialised when another
reads it.

Organised by **layer, not by feature** — `AGENTS.md` calls a `src/features/`
domain split premature fragmentation at this size, and names `src/lib/` as the
home for the pure engine.

```text
src/
  index.html  styles.css
  app.js        entry point, wiring only        + app.test.js
  store.js      mutable state and persistence
  lib/          pure: no DOM, no Date           + colocated tests
    schedule.js  engine.js  parse.js  format.js
  ui/           everything that touches the document
    dom.js  views.js  editor.js
e2e/            Playwright, top-level by rule, not colocated
  helpers.js  reflow.spec.js  confirm-dialog.spec.js  announcer.spec.js
scripts/
  serve.js      the dev server, no dependencies
```

`e2e/` is top-level because `AGENTS.md` exempts E2E from colocation: it tests
the assembled app in a browser, not any one module. It covers the two things
jsdom structurally cannot — real layout, for the WCAG reflow gate, and real
`<dialog>` lifecycle, which jsdom does not implement at all.

`store.js` sits at the root rather than in either folder: it is not pure
(localStorage, `document`) but it is not UI either, and a `state/` folder
holding one file would be worse than the ambiguity.

| File | What it is | Imports |
| --- | --- | --- |
| `src/index.html` | Markup and four `<template>`s. One inline script sets the theme before first paint. | — |
| `src/styles.css` | Design tokens (palette → semantic layer), light + dark, 17 sections. | — |
| `src/lib/schedule.js` | Seed data — four schedules, the default calendar, `PERIOD_KINDS`. No logic. | nothing |
| `src/lib/engine.js` | What is true at a given moment. Pure; time is always an argument. | schedule |
| `src/lib/parse.js` | The boundary. Untrusted input → validated data or structured errors. Pure. | schedule |
| `src/lib/format.js` | Every user-visible string derived from a number. Pure. | **nothing** |
| `src/ui/dom.js` | Every element the app writes to, looked up once. | — |
| `src/store.js` | Mutable state on one `store` object, plus persistence. | lib/schedule, lib/parse |
| `src/ui/views.js` | All painting, view switching, and the single `tick`. | lib/engine, lib/format, dom, store |
| `src/ui/editor.js` | Settings: the schedule editor, calendar, preferences. | lib/parse, dom, store, views |
| `src/app.js` | Wiring and startup. 119 lines, no logic. | dom, store, views, editor |

Unit tests are colocated with what they validate: `lib/engine.test.js`,
`lib/parse.test.js`, `lib/format.test.js`, and `src/app.test.js` (the jsdom
boot test).

### Running it

```bash
npm run lint      # eslint - the whole repo
npm run lint:md   # markdownlint
npm test          # vitest run - 153 unit tests
npm run watch     # vitest in watch mode
npm run e2e       # playwright - 37 browser tests, starts its own server
npm run e2e:ui    # playwright in UI mode
npm run serve     # http://localhost:3000
```

The first four are what CI runs, in that order, plus `npm audit`. There is no
`npm run typecheck` - it needs a type checker, which arrives with the port.

A server is **required** — the app uses ES modules, and browsers refuse to load
modules over `file://` because there is no content type without HTTP.

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

## Open gaps

| Opened | Item | Notes |
| --- | --- | --- |
| 2026-08-26 | Fonts are not real | Fredoka / Manrope / Space Mono are named in the CSS stack but nothing loads them — "no network at runtime" rules out Google Fonts. Self-host at the Next port via `next/font`. Currently rendering system fallbacks. |
| 2026-08-26 | 12-hour clock has no am/pm | Matches the mockups and is unambiguous for a school day. Revisit if a schedule ever crosses noon ambiguously. |
| 2026-08-26 | No `clearInterval` anywhere | Harmless for a page that lives until closed. Becomes a timer leak on every remount once this is a React component — needs a `useEffect` cleanup at the port. |
| 2026-08-26 | The inline theme script needs a CSP hash at the Next port | `AGENTS.md` requires baseline security headers. An inline `<script>` is fine today with no CSP, but becomes a violation the moment one ships. |
| 2026-08-26 | Overlap errors are attributed by sort order, not edit order | On an exact `startMin` tie the error lands on the row that sorts second, which is usually but not always the row being edited. Fixing it means threading edit state into a pure function. |
| 2026-08-26 | WebKit and Firefox are not covered | The E2E suite runs one project, `chrome`, against the browser already installed on the machine — no engine binaries were downloaded. `AGENTS.md` asks for real WebKit coverage, which is where `<dialog>`, `:modal` and `inert` behaviour is most likely to differ. Add the projects and `npx playwright install webkit firefox` when the download is worth it. |
| 2026-08-26 | TypeScript is a major version behind on purpose | 6.0.3 rather than 7.0.2, because `typescript-eslint` cannot load under TS 7. This is a real cost — TS 7 is the Go rewrite — and it is deliberate, not neglect. Revisit when typescript-eslint#10940 lands; the upgrade should be a one-line version bump plus a full lint run. |
| 2026-08-26 | Two apps share `src/` | `src/app/` is the Next scaffold; `src/index.html`, `src/app.js`, `src/store.js`, `src/ui/` and `src/lib/` are still the plain build. They do not collide — Next looks for a directory named `app` and ignores the file `app.js` — but the folder reads as confusing until Phases 1–4 delete the plain half. |
| 2026-08-26 | `npm run dev` and `npm run serve` both want port 3000 | The Next dev server and the plain build's static server cannot run at once. Harmless while the Next app is an empty page; worth a different port on whichever one loses the argument first. |
| 2026-08-26 | The headers have still never been verified on Vercel | `vercel.json` is gone and the list now lives in `next.config.ts`, verified against a real `next start`. What remains unverified is the deploy itself, and the hub's rewrite in Phase 7 — a second hop that can drop headers. |
| 2026-08-26 | Only `.period__name` and `.countdown__period` are hardened against intrinsic-width blowout | Those are the two elements that render a period name today. The schedule name (`#schedule-name`) and the editor's own rows are equally user-controlled and have not been measured with a 60-character unbroken value. The reflow suite covers the editor panel, but with the seeded names, not a hostile one. |
| 2026-08-26 | `README.md` documents the Next.js destination, not the current app | It tells a reader to run `npm run dev` and visit `localhost:3000/bell`. Neither exists: this is the plain HTML/CSS/JS build, served by `npm run serve` at `localhost:3000`. Consistent with the deliberate plain-JS-first detour, but a reader has no way to know that from the README. |

## Closed

| Opened | Closed | Item |
| --- | --- | --- |
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
| 2026-08-26 | 2026-08-26 | The Day view countdown has no units — a `#day-remaining-units` caption on the summary, and `formatRemaining` on the running row. Review finding 5. |
| 2026-08-26 | 2026-08-26 | The `<dialog>` fixes were verified against a stub, not a browser — now covered by an `e2e/` Playwright suite running in the installed Chrome. Escape, focus trapping, inertness, Cancel, Delete and the backdrop caveat are all asserted against a real modal. |
| 2026-08-26 | 2026-08-26 | Branch protection does not require `Typecheck` or `Next build` — added, bringing the required list to seven. |
| 2026-08-26 | 2026-08-26 | `eslint-plugin-jsx-a11y` is not installed — now installed and running at full `recommended`, not the 6-rule subset `eslint-config-next` ships. |
| 2026-08-26 | 2026-08-26 | There is no `npm run typecheck` — `tsc --noEmit` on TypeScript 6.0.3, and its own CI job. |
| 2026-08-26 | 2026-08-26 | `vercel.json` is unverified — deleted. The header list moved into `next.config.ts` `headers()` where AGENTS.md wants it, and was verified against a running `next start` rather than by inspection. |
| 2026-08-26 | 2026-08-26 | Branch protection is configured by hand - now applied to `main` and recorded below, so the settings are readable without opening the GitHub UI. |
| 2026-08-26 | 2026-08-26 | The Day view scrolled sideways at 768px before the first bell with a 60-character period name — `overflow-wrap: anywhere` on the two elements that render a period name. Found by the reflow gate on its first CI run. |
| 2026-08-26 | 2026-08-26 | The E2E suite is not wired into CI — `.github/workflows/ci.yml` runs lint, markdownlint, unit and E2E on every push and PR. The reflow gate is a blocking check in practice now, not only in principle. |
| 2026-08-26 | 2026-08-26 | The 320 px reflow check had not been re-run — now a Playwright suite at 320/375/768/1024/1440 over every view, every settings panel, the open dialog, and a 60-character unbroken period name. Measured at 320: `scrollWidth === clientWidth === 320` in all four states. |

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
