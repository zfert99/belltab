# Agent Rules

<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-context -->
## Project Context

This repo is **BellTab** — a client-side school bell schedule countdown that
renders the time remaining in the browser **tab title**. It is deployed as its
own Vercel zone and served at `biscuitlab.net/bell` via a rewrite from the
Biscuit Lab hub, exactly as Puzzle Lab is served at `/puzzles`.

The authoritative scope is `Docs/belltab-plan.md`. Read its non-goals before
adding anything. The following are **deliberately out of scope**: auth,
database, user accounts, a server of any kind, IANA timezone handling,
background notifications, a shared design-system package. Rules elsewhere that
mention sessions, auth, or a database apply only **if and when** such a feature
is deliberately added — and adding one contradicts the plan, so raise it first.

The design rests on `Docs/research/background-timers-and-schedule-modeling.md`.
That document is the evidence base for the invariants below; when a decision
here seems arbitrary, the reasoning is in there. Do not overturn one of these
invariants from memory or intuition — cite the research or write a new research
doc (see the roadblock rules).
<!-- END:project-context -->

<!-- BEGIN:domain-invariants -->
## Domain Invariants (the non-negotiables)

These five rules are the product. Breaking one produces a clock that is subtly,
unfalsifiably wrong — the worst possible failure for this tool.

- **Recompute, never decrement.** Every countdown value is
  `remaining = deadline − Date.now()`, computed fresh on every tick, on
  `visibilitychange`, and on `focus`. There must be no variable anywhere that
  holds a remaining-time number and is reduced over time. Browsers throttle
  hidden tabs to roughly one wakeup per minute and freeze them outright on
  mobile; a decrementing counter silently drifts and skips, a recomputed one is
  correct the instant it renders. **This is the single most important rule in
  the repo.** Any change that introduces drift-by-decrement is wrong even if it
  looks right in a foreground tab.
- **Times are minutes-since-midnight integers.** Not `Date`, not epoch
  milliseconds, not duration chains. A bell schedule is wall-clock ("Period 2
  starts at 9:05"), so integers are DST-safe, trivially comparable, and
  trivially serializable. `Date` is used only to read *now*, and only to convert
  it into local wall-clock minutes for comparison. Do not add
  `Intl.DateTimeFormat` timezone plumbing, and do not add a Temporal polyfill —
  the arithmetic here is subtraction of two integers.
- **Periods within a schedule may not overlap.** This is a deliberate product
  decision, not an oversight. The research documents that real schools run
  concurrent lunches and that a general tool would need to allow classified
  overlaps; BellTab is not that tool. Periods are stored sorted and
  non-overlapping, with `startMin < endMin`. **Gaps are legal** — before school,
  after dismissal, and holes in the day are normal and must not be "fixed" by
  the validator.
- **Parse, don't validate.** Untrusted input (URL hash, localStorage, imported
  JSON) is parsed **once at the boundary** into a branded `ValidSchedule` type.
  The validator returns the parsed value or a structured error — never a
  boolean. Downstream code must be unable to hold an unvalidated schedule, so
  nothing past the boundary re-checks ordering or overlap.
- **No backend, no network at runtime.** The app makes no fetches. State lives
  in the URL fragment and `localStorage`. If a feature seems to need a server,
  it is out of scope — write a research doc instead of adding one.
<!-- END:domain-invariants -->

<!-- BEGIN:state-encoding-rules -->
## State & Sharing

- **The URL fragment is the shareable schedule.** Pipeline:
  `JSON.stringify` → `CompressionStream('deflate-raw')` → base64url, written to
  `location.hash`. The fragment is never sent to the server, so request-line
  length limits do not apply; a full schedule lands in a few hundred characters.
- **Version-prefix the payload from the first commit.** A shared link is a
  format you support forever. Prefix with an explicit version marker, branch on
  it at parse time, and migrate forward. **Never repurpose a version number.**
- **`localStorage` holds convenience, not truth** — last-used schedule, theme,
  bell offset, wake-lock toggle. It is a cache of the user's own choices; a
  corrupt or absent value must degrade to a clean empty state, never a crash.
- **JSON export/import is the durable backup.** Keep it plain and readable.
- Do **not** reach for IndexedDB or the File System Access API. The data is
  measured in hundreds of bytes.
- **Do not put anything personal in a schedule.** Full URLs land in browser
  history and history sync; period labels are the wrong place for student names.
<!-- END:state-encoding-rules -->

<!-- BEGIN:documentation-standards -->
## Documentation Standards

- **Naming convention:** all documentation files use `lowercase-kebab-case.md`.
- **Organization:**
  - Root `Docs/` directory: active, living documents (the plan, the roadmap).
  - `Docs/design/`: the design system and design references.
  - `Docs/research/`: standardized, deeply-researched topic documents.
  - `Docs/archive/`: historical logs, superseded plans, phase walkthroughs.
<!-- END:documentation-standards -->

<!-- BEGIN:roadblock-research-rules -->
## Roadblock & Research Rules

When implementation diverges from the plan — a measurement contradicts an
assumption, a slice hits a roadblock, or a chosen approach turns out to be
infeasible — **stop building and write a research document** rather than
improvising a workaround or silently narrowing scope.

- Put the document in `Docs/research/` (`lowercase-kebab-case.md`). Capture: what
  we planned, what we actually measured/observed (with numbers), why it doesn't
  work, the options considered, and the **open questions** to research before
  proceeding.
- Surface it to the user with a concise summary and a recommendation. Let the
  user run research (or approve a direction) before resuming — don't answer
  plan-invalidating questions by guessing.
- When the answer comes back, **fold it into the plan/roadmap docs first**, then
  resume the build. The `Docs/research/` doc stays as the durable record of *why*
  the approach changed.
- **Browser-behaviour claims need a citation or a test.** Throttling, freezing,
  and lifecycle behaviour vary by engine and change between versions. The
  existing research explicitly flags Safari's thresholds and the tab-title
  character budget as thin evidence — verify on a real browser before relying on
  a number.
<!-- END:roadblock-research-rules -->

<!-- BEGIN:markdown-linting-rules -->
## Markdown Linting Rules

Ensure all markdown files adhere to proper linting standards and formatting
(correct list indentation, explicit code block languages, proper heading
hierarchy) to avoid markdown linting errors.
<!-- END:markdown-linting-rules -->

<!-- BEGIN:architecture-rules -->
## Architecture & Structure

- **`src/` from the first commit.** Moving to it later is pure churn.
- **`basePath: '/bell'`** in `next.config.ts`. It scopes routes *and* `/_next/*`
  assets in Next 15+, so no `assetPrefix` is needed. It is build-time inlined —
  a change requires a redeploy, and local dev therefore lives at
  `localhost:3000/bell`.
- **The schedule engine is pure and framework-free.** Parsing, validation,
  resolution ("which schedule applies to this date"), and "what is the state at
  minute N" live in `src/lib/` as pure functions over plain data, with no React
  and no `Date.now()` inside them — the current time is always an **argument**.
  This is what makes the engine testable without faking clocks.
- **One clock, one subscriber.** A single ticking source drives the app; the tab
  title, the page body, and the favicon are all derived views of it. Do not
  scatter `setInterval` calls across components.
- **No feature folders yet (AI Pitfall).** Do NOT introduce a `src/features/`
  domain architecture. At this size that is premature fragmentation. Colocate
  inside a route segment with private folders (`_components/`, `_lib/`) if
  needed.
- **App Router purity (AI Pitfall):** `src/app/` is strictly for routing,
  layouts, and entry points. `page.tsx` files act as controllers — delegate
  rendering to components and logic to `lib/`.
- **`pageExtensions` trap (AI Pitfall):** Do NOT use `pageExtensions` to force a
  `.page.tsx` suffix as a colocation trick. Use private folders instead.
- **Server vs. Client Components:** Components are Server Components by default.
  This app is unavoidably client-heavy at its core — the countdown reads the
  device clock — but the shell, copy, and chrome should stay server-rendered. Do
  not reflexively mark a whole route as a Client Component because one child
  ticks.
- **The clock is client-only by definition.** Never render a time-dependent
  value on the server: it will hydrate-mismatch. Render a stable placeholder and
  fill it in after mount.
- **File naming:** Ban the `Avatar/index.ts` pattern (use `Avatar/Avatar.tsx`)
  so files stay IDE-searchable. Keep barrel files shallow if used at all.
- **Colocation & import aliases:** Files that change together are stored
  together. Use `@/` instead of deep relative imports.
<!-- END:architecture-rules -->

<!-- BEGIN:code-comments -->
## Code Comments

- **Ban syntax-restating comments** (e.g. `// set count to 0`). Code should be
  self-documenting through expressive naming.
- **Explain the "why"** — document external constraints, browser workarounds,
  and architectural trade-offs, not the mechanics of a `for` loop. In this repo
  the browser constraints *are* the interesting part: when code exists because
  of throttling, freezing, or autoplay policy, say so and point at the research
  doc.
- Add JSDoc (`/** */`) to the top of major exports for IDE tooltip hints.
<!-- END:code-comments -->

<!-- BEGIN:testing-rules -->
## Testing & Linting

- **Vitest, not Jest** for unit/integration tests. Unlike the hub, this repo has
  real logic worth covering from the start — the schedule engine. Because the
  engine takes the current time as an argument, its tests need no fake timers:
  feed it minute 0, minute 539, minute 1439, and the boundaries between periods.
- **Cover the boundaries, they are where clocks lie:** the exact minute a period
  starts and ends, back-to-back periods with zero gap, the minute before the
  first bell, the minute after the last, an empty schedule, a single-period
  schedule, and midnight rollover.
- **Round-trip the encoder:** any schedule that encodes must decode to an equal
  schedule, and every historical payload version must still parse. Keep a
  fixture file of real encoded links and never delete an entry from it.
- **Vitest hybrid environments (AI Pitfall):** Use the `// @vitest-environment
  jsdom` pragma at the top of React UI test files. Keep the global Vitest
  environment `node` to prevent `Request` polyfill collisions.
- **Playwright, not Cypress** for E2E — real WebKit coverage and free
  parallelization. E2E suites live in a top-level directory, exempt from
  colocation.
- **Colocation:** unit test files reside immediately adjacent to the source they
  validate.
- **Behavioral UI testing:** Arrange-Act-Assert; accessibility-first queries
  (`getByRole`, `getByLabelText`) to test behavior, not implementation.
- **Mock only at boundaries**, never internal modules.
- **Run before concluding:** `npm run lint`, `npm run typecheck`,
  `npx vitest run`, and `npx markdownlint-cli "**/*.md"`. All must pass.
- **The reflow/a11y gate is a blocking check**, not optional polish.
<!-- END:testing-rules -->

<!-- BEGIN:accessibility-rules -->
## Accessibility & Performance Floor

- **The tab title is not an accessible surface.** Changing `document.title` does
  not announce to screen readers, and that is *desirable* here — a per-minute
  countdown would otherwise spam assistive tech. **Never wrap the title or the
  countdown in an `aria-live` region.** The page body is the accessible source
  of truth. If period-change announcements are wanted, use a deliberate
  `aria-live="polite"` region that fires **only on period boundaries**, never on
  every tick.
- **Reflow (WCAG 2.2 SC 1.4.10):** every page must reflow to a single column and
  stay usable at **320 CSS px** (= 400% zoom on 1280px) with no two-dimensional
  scrolling. Never ship `user-scalable=no` or `maximum-scale` in the viewport
  meta.
- **CI from the first commit:** `eslint-plugin-jsx-a11y` at `recommended` as a
  blocking check, and a Playwright test asserting `documentElement.scrollWidth <=
  clientWidth + 1` at 320 / 375 / 768 / 1024 / 1440. Any overflow blocks merge.
- **The schedule editor is a form and must behave like one:** real `<label>`s,
  native time inputs where possible, keyboard-operable reordering, and errors
  associated to their field (`aria-describedby`) — not just a red border.
- Respect `prefers-reduced-motion` — the progress bar animates, so it needs a
  reduced-motion path. Strong `:focus-visible` ring; real alt text;
  `overflow-wrap: break-word` globally (period names are user input and can be
  absurd).
- Use `next/font` (self-hosted) to avoid layout shift and external requests.
  Keep pages static; nothing here needs SSR.
<!-- END:accessibility-rules -->

<!-- BEGIN:security-rules -->
## Security & Infrastructure

There is no server, no auth, and no database, so most attack surface does not
exist. Keep it that way; the cheap baseline below still applies.

- **Security headers (baseline, not optional):** ship
  `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`,
  `Referrer-Policy`, and `Permissions-Policy` via `next.config.ts` `headers()`
  for every route.
- **All schedule data is untrusted input**, including data from `localStorage`
  and from a link the user was sent. Period labels are attacker-controlled
  strings: render them as text, never as HTML, and never build markup by
  concatenation. A malicious link must be able to produce, at worst, a silly
  schedule.
- **Decompression is a boundary:** cap the decoded payload size and the period
  count before parsing, so a hand-crafted hash cannot wedge the tab.
- **Middleware is not an auth boundary (AI Pitfall):** CVE-2025-29927 let
  attackers bypass Next.js middleware-based auth via a spoofed
  `x-middleware-subrequest` header. This repo ships no `middleware.ts` — keep it
  that way.
- **CI security scanning:** GitHub CodeQL (SAST), Dependabot (SCA), and
  `npm audit`. **Gotcha:** a top-level version bump doesn't always reach a
  natively-compiled sub-dependency a framework bundles internally. After
  patching a CVE, confirm with `npm ls <pkg>` and add a `package.json`
  `overrides` entry if a vulnerable nested copy remains.
- **AI-generated code is unaudited by default:** passing tests or compiling is
  not evidence of correctness or security. Before adding a newly-suggested
  package, confirm it actually exists and is maintained — LLMs hallucinate
  plausible package names ("slopsquatting") and attackers register them. This
  app should reach 1.0 with approximately zero runtime dependencies beyond the
  framework; treat any proposed addition as suspect.
<!-- END:security-rules -->

<!-- BEGIN:git-rules -->
## Git Rules

- **GitHub Flow:** `main` always deployable; short-lived `feat/` and `fix/`
  branches; one PR per change; squash-merge with the PR title as the squash
  message. Branch protection: require status checks + linear history; leave
  "require approvals" **off**, since GitHub blocks approving your own PR.
- **Committing and pushing:** ONLY run `git commit` or `git push` when the user
  explicitly requests it (e.g. "commit", "push", "commit push"). Do NOT commit
  code automatically or unprompted.
- `.env*` gitignored; `.env.example` committed.
<!-- END:git-rules -->
