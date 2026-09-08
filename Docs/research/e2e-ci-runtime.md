# Shortening the E2E job: the research, and what the repo says back

**Provenance.** Written outside this repo on 2026-09-08 from public sources and
a read of the README, and copied here verbatim below the caveat block - the same
way every inherited document in this directory arrived. It could **not** read
`playwright.config.ts`, `.github/workflows/ci.yml` or `e2e/`, and says so in
its first section; every conclusion that depended on them was flagged
unverified. This block resolves each one against the files.

**Why it is here.** `AGENTS.md`: when a decision needs research, the research
lands in `Docs/research/`, gets folded into the plan docs, and the build resumes
from the plan. The decision was audit finding S8 in
`../code-review-2026-09-04-full-audit.md`, and the owner's ask was "instead of
guessing, let's use this research".

## What the repo actually has (resolving the document's unverified items)

| The document could not verify | Measured in this repo, 2026-09-08 |
| --- | --- |
| Chromium-only (its README read) or three engines? | **Three engines on `main`.** `playwright.config.ts` lists `chrome`, `webkit`, `firefox`; the README it quoted was stale, ours names all three. The "unresolved fork" in its Caveats resolves to its Option E. |
| `workers` in CI | `process.env.CI ? undefined : 2` - CI takes Playwright's default of half the cores, so **2** on the 4-vCPU public runner. Not the `1` its arithmetic feared, but half of what the machine has. |
| `fullyParallel` | Already `true`. |
| Test independence (`describe.serial`, `storageState`) | **None in `e2e/`.** Every spec plants its own storage through `openApp`. Safe to raise workers; sharding would be safe too. |
| Is `next build` rebuilt in the E2E job? | **Yes, twice per run**: once in the `Next build` job, and again inside Playwright's `webServer` (`npm run build && npx next start`). |
| Tests per file / per engine | 274 per engine, 822 runs; the E2E job took **7m53s** on the last `main` run, against 20-28s for each of the other six jobs. |
| Required status checks | All seven job names, including `E2E (reflow gate)`. Its "reuse the required check's exact name" advice is the one this repo already follows - and the reason the CI plan below changes no job names. |
| Caching | `setup-node` caches npm in every job. No browser cache, and none needed: `channel: "chrome"` drives the runner's own Chrome. |

**One measured caveat of our own** that the document could not know:
`playwright.config.ts` records that on a local machine eight workers crashed,
four and three were intermittently red on the boot wait, and two was clean -
with the note that "an intermittently red suite is worse than a slow one". CI
keeps the default on purpose. So its Stage 1 ("set workers to 100%") is the
right experiment and the wrong assumption: it is tried on a PR, measured, and
kept only if the suite stays green across repeated runs.

**What was adopted, and what was not.** Its Option E (Chromium-only on PRs,
all three engines on merge to `main` and nightly, workers raised, build
reused) is the plan, staged and measured. Its Option F - the high / medium /
low priority tiers the owner first proposed - is **not**, for the reason it
gives: coverage cut along "which feature is low-risk" is not legible and does
not self-correct, while coverage cut along the engine axis is both. The one
slice of F it endorses survives as a local convenience, never as the PR gate.

---

## Shortening the BellTab E2E Job: An Evidence-Based Plan

## ⚠️ Repo-access caveat (read first)

The repository **github.com/zfert99/belltab is PUBLIC** (verified: the repo page carries `meta-octolytics-dimension-repository_public: true` and the header reads "belltab Public"). I could read the repository root and README verbatim, but I could **not** retrieve the contents of `playwright.config.ts`, `.github/workflows/ci.yml`, `package.json`, `next.config.ts`, or the `e2e/` directory. My fetch tooling only accepts URLs surfaced as search-engine results, and this repo (0 stars, unindexed) does not surface its file URLs; a dedicated retrieval subagent hit the same wall. So the single highest-priority items you asked me to verify — the literal `workers` / `fullyParallel` / `projects` values, the CI job YAML, and the per-spec test counts — remain **UNVERIFIED**. Every conclusion below that depends on those is flagged. **Before acting, paste those three files (`playwright.config.ts`, `ci.yml`, `package.json`) and I'll finalize the exact numbers and YAML.**

## TL;DR

- **The dominant lever is parallelism + engine-scoping, not priority-tiering.** On a public-repo `ubuntu-latest` runner (4 vCPU / 16 GiB, free and unlimited), the most likely single cause of a 7m53s E2E job is `workers` pinned low (Playwright's own CI docs literally tell you to set `workers: 1`) and/or all three engines running on every PR. Raising workers to 4 and running **Chromium-only on PRs with the full three-engine suite on merge + nightly** should cut PR wall-clock to roughly 1.5–3.5 minutes with no meaningful loss of protection.
- **Your high/medium/low priority-tier idea (Option F) is the weakest option and I recommend against it as the primary strategy.** It drops coverage on the least legible axis ("which feature is low-risk"), needs constant manual re-labeling, and rots silently because deferred tiers lack a fixed cadence. Engine-splitting + parallelism dominates it on wall-clock, coverage clarity, and maintenance.
- **A README discrepancy must be resolved first.** The README on `main` states verbatim: "WebKit and Firefox are not covered yet" and that `npm run e2e` drives "the Chrome already installed on the machine." That directly conflicts with your reported "~275 tests × 3 engines = ~825 runs." Either the 3-engine suite lives on an unmerged branch, or the README is stale — and the right plan differs materially between those two worlds.

## Key Findings

### Verified repo facts

- **Public repo.** GitHub Actions is free and unlimited on standard runners for public repos, and standard `ubuntu-latest` runners for public repos are **4-vCPU / 16 GiB RAM**. Per GitHub's blog ("GitHub-hosted runners: Double the power for open source"): "From December 1, 2023, we started upgrading our fleet of Linux and Windows Action runners to newer 4-vCPU based virtual machines… we now provide machines that are double their previous specification, with 4-vCPUs, 16 GiB of memory," delivering "real-world improvements of around 25%." This is decisive: **billed minutes are a non-issue for you**, so the usual objection to sharding (it multiplies billed minutes) does not apply. Wall-clock and maintenance are your only costs.
- **Stack:** Next.js App Router + React + TypeScript, deployed on Vercel, `basePath: '/bell'` in `next.config.ts`.
- **Scripts (names verified from README):** `dev`, `lint`, `typecheck`, `test` (Vitest), `e2e` (Playwright), `lint:md`.
- **E2E design (verified verbatim from README):** `npm run e2e` "builds the app and starts its own server," runs "against a production build rather than `next dev`, because the reflow gate measures the CSS that actually ships," and "drives the Chrome already installed on the machine, so it needs no browser download." The suite is described as "the reflow gate." Crucially: **"WebKit and Firefox are not covered yet; see Open gaps in `Docs/build-log.md`."**
- **5 open PRs** exist (repo header). I could not read individual PR titles, so I could not independently confirm PR #57's contents or the "quality branch."

### Could NOT verify (blocking items)

`workers`, `fullyParallel`, `projects`, `retries`, `timeout`, `webServer`, `reporter`, `trace`/`video`/`screenshot`, `testMatch`/`testIgnore`/`grep`, `testDir`; the full CI job list and each `runs-on`; whether `setup-node` cache / `~/.cache/ms-playwright` / `.next/cache` are cached; whether the build is reused as an artifact or rebuilt in E2E; the number of spec files and tests per file; and whether tests use `describe.serial` / shared `storageState`.

### External best-practice findings

- **Three layers of concurrency compose multiplicatively.** *Workers* are parallel OS processes on one machine — Playwright's official docs (`TestConfig.workers`) state the default is "half of the number of logical CPU cores" (Microsoft Learn confirms "@playwright/test limits the number of workers to 1/2 of the number of CPU cores"), i.e., **2 on a 4-vCPU runner**. *`fullyParallel: true`* changes the scheduling unit from file to individual test, so tests within a file spread across workers. *Shards* (`--shard=i/n`) slice the test list across machines. As Firm86's parallelism guide puts it: "The two compose, so four shards of four workers is sixteen tests in flight. Raise workers while the machine is idle; add shards once it is pinned and the run is still long."
- **Playwright's own CI docs recommend `workers: 1` in CI.** Verbatim from playwright.dev/docs/ci: "We recommend setting workers to \"1\" in CI environments to prioritize stability and reproducibility. Running tests sequentially ensures each test gets the full system resources, avoiding potential conflicts." **This is the single most common reason a CI E2E job runs far slower than it needs to.** If BellTab's config pins CI to 1 worker, moving to 4 is up to a ~4× test-execution speedup for zero coverage loss (subject to test independence).
- **Sharding mechanics:** set `reporter: process.env.CI ? 'blob' : 'html'`, run each shard with `--shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}`, upload each `blob-report` as an artifact, then a `needs:`-dependent merge job runs `npx playwright merge-reports --reporter html ./all-blob-reports`. This is the exact pattern in Playwright's official sharding docs.
- **The required-status-check trap is real and documented.** Converting a single required job into a matrix means the old required check name never reports and **PRs hang forever.** Verbatim from GitHub `actions/runner` issue #952: "Jobs with a build matrix configuration can be skipped from the top level, before expanding the matrix. This is problematic when the inner-matrix jobs are set as required status checks for a branch protection rule, resulting in the Pull Request hanging forever." The standard fix (community discussions #26822, #60792) is a single **aggregate "gate" job** with `needs: [matrix-job]`, `if: always()`, that inspects `needs.<job>.result` and exits non-zero unless it's `success`. Because branch-protection matching is exact-string (not workflow-file-based), a matrix-renamed job "will never receive a report again" — so the durable fix is to **require a single aggregating 'all checks passed' job** rather than many individually-named matrix jobs.
- **Tiering consensus (PR → merge → nightly):** run a focused critical subset on PR targeting **under 5 minutes**; run the full suite on merge to main as the quality gate; run extended/cross-browser on a nightly schedule. This is a well-established, widely-recommended pattern across multiple independent CI guides.
- **Chromium-on-PR / three-engines-on-merge is explicitly endorsed by vendor docs.** Verbatim from Cypress's cross-browser testing guide: "For projects that exhibit consistently stable behavior across browsers, it may be better to run tests against additional browsers only before merging changes in the production deployment branch." So running one engine on PR and more on merge/nightly is a normal, sanctioned pattern — not an exotic hack.
- **WebKit-only bugs are real but concentrated.** WebKit/JavaScriptCore genuinely diverges from Blink on layout/reflow, fonts, date parsing, `<dialog>`, storage/ITP, and PWA/notification surfaces — exactly the surfaces you flagged. But Playwright's WebKit is an engine approximation, not real Safari, so it already doesn't catch device-specific iOS bugs. The evidence supports: **keep three-engine coverage on the risky surfaces, but you don't need it on every PR for pure application-logic tests.**
- **Caching savings (quantified):** caching `~/.cache/ms-playwright` typically saves **30–60s per run** (one measured case went from 1m43s to ~45s + 17s cache overhead = ~40s net saved). BUT you drive system Chrome with no browser download, so this is nearly irrelevant to you — and Playwright's own docs note browser-binary caching is *not* recommended by default because restore can cost as much as the download.
- **Next.js E2E:** running against a **production build** (`next build && next start`) rather than `next dev` is the recommended CI practice — and BellTab already does this. Treat the build as a **prerequisite, not part of the test budget**: build once in a dedicated job, then reuse across test jobs.
- **Test-impact analysis (TIA) is over-engineering at your scale.** Sources note TIA's benefit is "limited in small codebases — when test suites are already fast, the setup cost may not justify the gain," and it introduces false-negative risk (Google's mature TIA still falls back to full runs when unsure). For a ~275-test solo project, skip it.

## Details

### The arithmetic (using your REPORTED numbers — clearly labeled estimates)

Reported baseline: E2E = 7m53s = **473s** wall clock; ~275 tests × 3 engines = **~825 runs**.

Decompose into **fixed overhead** (npm ci ≈ 20s + `next build` ≈ 40–60s + server start ≈ 10s ≈ **~75s**) and **test execution** (473 − 75 ≈ **~398s**).

- If `workers` is pinned to **1** in CI (which Playwright's docs recommend): 398s / 1 = 398s → this alone explains the runtime.
- If `workers` = **2** (Playwright default on 4 vCPU): the 398s implies ~0.96s per test-run, and going to 4 workers roughly halves execution to ~200s.

**Option arithmetic** (assumes build reused via artifact where noted; treat as ±30%):

| Option | What changes | Est. PR wall-clock | Coverage given up on PR | Billed minutes | Complexity | Reversibility |
|---|---|---|---|---|---|---|
| **A. As-is** | nothing | ~7m53s | none | free (public) | 0 | n/a |
| **B. Engine-tag only** | Chromium full; WebKit/FF only on ~engine-tagged subset | ~4m | logic tests lose WebKit/FF on PR | free | low | trivial |
| **C. Engine-tag + nightly full** | B, plus nightly full 3-engine | ~4m PR; full nightly | ~none (nightly backstops) | free | low-med | trivial |
| **D. Shard-only (keep 3 engines)** | 4 shards + gate + merge, build reused | ~2–3.5m | none | free (more minutes, irrelevant) | med | easy |
| **E. Chromium-only PR + shard; 3-engine on merge/nightly** ⭐ | PR = Chromium only (optionally 2 shards) + workers=4; merge + nightly = 3 engines | **~1.5–2.5m** | WebKit/FF on PR (caught at merge+nightly) | free | med | easy |
| **F. Priority tiers high/med/low** | PR runs "high"; med/low deferred | ~2–3m (depends on tier size) | **feature coverage on PR — and it rots** | free | med-high (ongoing) | hard (labels stick) |

### Why Option E wins and Option F loses

The bottleneck is **runs = tests × engines**, executed under a **worker count**. You attack it best by (1) maximizing workers to the real vCPU count, (2) cutting the engine multiplier on PRs where it buys least (pure logic tests), and (3) not paying the build cost twice. That's Option E. It reduces coverage along the **engine axis**, which is *legible* (you know exactly what you gave up: non-Blink rendering on PR, restored at merge and nightly) and *self-correcting* (merge/nightly runs on a fixed cadence).

Option F reduces coverage along the **feature-priority axis**, which is **not legible and not self-correcting**: "low priority" is a human judgment that drifts, labels are set once and rarely revisited, and a "low" test for a feature that later becomes central silently stops gating. The testing literature is consistent that deprioritized tiers produce coverage gaps precisely because they lack a fixed cadence. F also doesn't attack the real multiplier (engines) unless you *also* do engine work — at which point F is redundant. **Recommendation: reject F as the primary strategy.** The one defensible slice of F — a tiny hand-picked "smoke" set for the fastest possible *local* pre-push signal — is worth keeping as a convenience, not as the PR gate. (To be explicit about your ask to correct me if the evidence flipped: it did not. The research points the other way — engine-splitting + parallelism is the stronger call for a UI-logic-heavy suite whose real cross-engine risk is concentrated in a handful of rendering/API surfaces you can tag.)

### The required-status-check migration (the part that has bitten you)

Your seven job names are required checks on `main`. If you turn `E2E` into a matrix (`E2E (1)`, `E2E (2)`…), the required check named exactly `E2E` never reports → PRs hang (issue #952 above).

**The clean fix that needs NO branch-protection edit:** keep an aggregate job whose **name is exactly `E2E`** (the currently-required check), and let it `needs:` the matrix. Branch protection still sees a check called `E2E`; it now reports the aggregate result. Because the PR that introduces this change already runs the new workflow, it produces an `E2E` check and merges cleanly — no hang, no manual settings change. This is exactly the "require a single aggregating job" pattern the sources endorse.

## Recommendations

**Stage 0 — Verify (do this before anything).** Paste `playwright.config.ts`, `ci.yml`, and `package.json`. Specifically confirm: (a) is `workers` pinned to 1 in CI? (b) does `projects` actually list 3 engines, or is `main` still Chromium-only as the README says? (c) is `fullyParallel: true`? (d) is `next build` rebuilt inside the E2E job? These four answers determine which stage below is even necessary. **Benchmark that would change the plan:** if `workers` is already 4 and `fullyParallel` is on and it's still 7m53s for Chromium-only, the problem is per-test cost or the build, not concurrency — and sharding (Option D/E) becomes the primary answer rather than the worker fix.

**Stage 1 — Free wins, zero coverage change (ship first).**

1. Set `workers: process.env.CI ? '100%' : '50%'` (or an explicit `4` in CI) if it's currently 1 or 2 — pending confirmation tests are independent. This is likely the biggest single win.
2. Set `fullyParallel: true` **only after** confirming no `describe.serial` / shared `storageState` ordering dependencies.
3. Split the pipeline so `next build` runs **once** in the existing build job, uploads `.next` (and needed files) as an artifact, and the E2E job downloads it instead of rebuilding. Cache `.next/cache` and rely on `setup-node`'s npm cache.

**Stage 2 — Engine-scope the PR (Option E).** Introduce a Playwright project/tag split: PR trigger runs **Chromium only**; `push` to `main` and a nightly `schedule` run **Chromium + WebKit + Firefox**. Tag the genuinely engine-sensitive specs (`<dialog>`, native date/time inputs, Wake Lock, notifications, a11y, reflow/layout) so that even on PRs you *may* run just those on WebKit/Firefox if you want a middle ground (Option C).

**Stage 3 — Shard only if still slow.** If Chromium-only PR runs still exceed ~3–4 min, add a 2–4 shard matrix with the `E2E` aggregate gate job (YAML below). Given free minutes, sharding is cheap; the only cost is YAML complexity.

**Recommended `playwright.config.ts` shape (adapt to your ACTUAL file — this is illustrative, not verified against yours):**

```ts
import { defineConfig, devices } from '@playwright/test';
const CI = !!process.env.CI;
const ENGINES = process.env.PW_ENGINES ?? 'chromium'; // 'chromium' on PR; 'all' on merge/nightly
const all = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
];
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,            // confirm no serial/shared-state deps first
  workers: CI ? '100%' : '50%',   // 4 on a 4-vCPU public runner
  retries: CI ? 1 : 0,
  reporter: CI ? 'blob' : 'html', // blob is mergeable across shards
  use: { trace: 'on-first-retry', video: 'off', screenshot: 'only-on-failure' },
  projects: ENGINES === 'all' ? all : all.filter(p => p.name === 'chromium'),
  webServer: {
    command: 'npm run build && npm run start', // reuse prebuilt artifact in CI where possible
    url: 'http://localhost:3000/bell',
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
```

**Recommended `ci.yml` E2E section with sharding + gate (adapt to your ACTUAL file):**

```yaml
  e2e-shard:
    name: E2E shard ${{ matrix.shard }}
    needs: [build]                     # reuse the artifact from your build job
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2]                  # start at 2; raise if still slow
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc', cache: 'npm' }
      - run: npm ci
      - uses: actions/download-artifact@v4
        with: { name: next-build, path: .next }
      - run: npx playwright test --shard=${{ matrix.shard }}/2
        env: { PW_ENGINES: chromium }  # Chromium-only on PR
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with: { name: blob-${{ matrix.shard }}, path: blob-report, retention-days: 1 }

  E2E:                                 # <-- name matches the EXISTING required check
    needs: [e2e-shard]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - run: |
          if [ "${{ needs.e2e-shard.result }}" != "success" ]; then
            echo "One or more E2E shards failed"; exit 1
          fi
          echo "All E2E shards passed"
      # (optional) download blob-* artifacts and run:
      #   npx playwright merge-reports --reporter html ./all-blob-reports
```

Add a nightly full-engine run:

```yaml
on:
  schedule: [{ cron: '0 7 * * *' }]    # full 3-engine suite; set PW_ENGINES=all in that job
```

### Ordered migration checklist

1. **Merge PR #57 first** (it's green) — before restructuring CI, so it isn't re-validated against a changing pipeline and doesn't collide with the sharding PR.
2. **Land the docs archive move** (5 docs → `Docs/archive/`, which touches the build log) as its own small PR, so the build-log churn is isolated from the CI change.
3. **Rebase the quality branch** onto the new `main` once #57 and the docs move are in.
4. **Open the CI/sharding PR** using the `E2E`-named aggregate gate. Because the gate reuses the existing required-check name, **no branch-protection change is needed and PRs will not hang.** Verify on this PR that the `E2E` check reports green.
5. **Only if you introduce NEW required check names** (e.g., you rename `E2E` → `e2e-gate`): those names don't exist until the workflow runs on `main`, so add them in branch protection **after** merge, then rebase open PRs. Prefer step 4's name-reuse to avoid this entirely.
6. Add the nightly schedule last, once PR + merge tiers are proven.

### Branch-protection settings you must change manually (in the GitHub UI)

- If you follow the name-reuse pattern: **nothing changes.** Confirm `E2E` is still listed as required under Settings → Branches (or Rulesets).
- If you split lint/typecheck/etc. or rename anything: update *Require status checks to pass* to match the **new** aggregate job names, and remove obsolete names so PRs don't wait on checks that never report. Do this immediately after the first run on `main` produces the new check names.

## Caveats

- **All runtime numbers are estimates built on YOUR reported baseline**, not measured from the repo. The ±30% band is real; the fixed-overhead split (build vs test) especially so. Measure with `--reporter=list` timings before/after each stage to replace these estimates with facts.
- **The README says `main` is Chromium-only.** If true, there is no engine multiplier to cut on PR, Options B/C/E collapse toward "just fix workers + build reuse," and 7m53s for ~275 Chromium tests strongly implies `workers: 1` or a dominating build step. If instead the 3-engine suite is live (on a branch, or merged since the README was written), Option E is the recommendation. **This fork is unresolved and is the first thing to confirm.**
- **`fullyParallel: true` and sharding both require test independence.** If any specs use `test.describe.serial`, shared `storageState`, or ordering assumptions, enabling these will cause flakiness. Verify before flipping — I could not inspect the specs.
- **Playwright WebKit ≠ real Safari.** Even the three-engine suite doesn't cover iOS-device-specific behavior (memory pressure, backgrounding, real touch, ITP nuances); don't over-trust it as full Safari coverage.
- **Caching Playwright browser binaries won't help you** because you drive system Chrome with no download; don't add that complexity.
- **Some sourcing is secondary/vendor material.** The tiering and cross-browser-frequency claims lean on vendor and community guides; the load-bearing mechanics (workers default, `workers: 1` CI recommendation, sharding CLI, the matrix/required-check hang) are anchored to primary sources (Playwright docs, GitHub blog, `actions/runner` issue #952, Cypress docs).

## Open decisions for you (stated as either/or)

1. **Is `main` currently Chromium-only (per README) or three-engine (per your report)?** — determines whether the plan is "fix parallelism + build reuse" or "full Option E."
2. **PR engine policy: Chromium-only (Option E, fastest) OR Chromium-full + engine-tagged subset on WebKit/Firefox (Option C, safer)?**
3. **Sharding: yes or no?** Given free minutes, the only real question is whether the YAML complexity is worth shaving another ~1 minute once workers + engine-scoping are done.
4. **Worker count: explicit `4` OR `'100%'`?** (`'100%'` auto-adapts if you ever move to a larger runner; `4` is more predictable and matches today's 4-vCPU runner.)
5. **Keep a tiny local-only "smoke" subset for pre-push signal, or not?** (This is the only piece of your Option F worth salvaging — as a local convenience, never as the PR gate.)
