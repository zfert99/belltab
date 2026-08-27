# QA and Code Review for a Solo Developer Working with Heavy AI Assistance — A Playbook for Puzzle Lab

*(Commissioned research artifact. Also saved to the owner's Google Drive as "Puzzle Lab QA and
Code Review Playbook":
<https://docs.google.com/document/d/1EjW9Ukb4HzHJ9B8htzYaVbSYGmypUQ5EmfTzSZ69agk/edit>. Imported
into the repo 2026-07-31 to inform the pre-merge process; see `AGENTS.md` → "Pre-Merge / Pre-PR
Checklist" and the roadmap's "Solo-dev QA hardening" backlog entry.)*

## TL;DR

- **The keep/drop split is largely correct.** Keeping mechanical enforcement (tests, CI, static
  analysis, security scanning, branch protection, AI review) while dropping human-ceremony
  artifacts (master plans, formal gate docs, external plan reviews, GREEN/RED verdicts) matches
  the evidence: code review's *documented* defect-finding is weaker than its reputation
  (Bacchelli & Bird, ICSE 2013, found reviews "are less about defects than expected"), while
  automated gates catch bug classes deterministically. The one place it is under-investing is
  **server-side validation as an enforced, testable gate** — exactly where AI code fails most
  (Veracode 2025: models chose the insecure option 45% of the time).
- **The single highest-leverage change is making the pre-merge gate physical, not documentary:**
  a PR template with mandatory checkboxes plus branch protection requiring green CI and an AI
  review pass. Keep reviews small (SmartBear/Cisco: defect detection drops sharply above 400 LOC
  and past 60–90 minutes) — which vertical slicing naturally enables.
- **The "next-day self-review" convention is a reasonable extrapolation, not established
  science.** The incubation literature (Sio & Ormerod 2009, mean d≈0.29) and
  proofreading-familiarity research support "fresh eyes," but there is *zero* controlled evidence
  on code specifically, and a 2023 study failed to replicate the "can't-see-your-own-errors"
  effect. Treat it as cheap insurance, not a proven method, and lean on the AI reviewer and tests
  for mechanical defect-finding.

## Key Findings

**1. Code review's real value is not defect-finding — which reshapes what self-review should aim
for.** Bacchelli & Bird's Microsoft study (*Expectations, Outcomes, and Challenges of Modern Code
Review*, ICSE 2013; 570 comments across 200 threads, 165 managers + 873 developers surveyed) found
that although finding defects is the #1 stated *motivation* (primary for 44% of developers), only
**~14% (78/570) of actual review comments were about defects** — "one-eighth of the total...
mostly address 'micro' level and superficial concerns." Code improvements were the largest category
(29%). The paper's blunt conclusion: "Relying on code review in this way for quality assurance may
be fraught," and reviews "are less about defects than expected and instead provide additional
benefits such as knowledge transfer, increased team awareness, and creation of alternative solutions
to problems." [strong] Those benefits are mostly unavailable to a solo dev. **Implication: human
self-review should be treated primarily as a design/readability/maintainability check;
defect-catching should be pushed onto tests, types, and the AI reviewer.**

**2. Review size and speed thresholds are the most actionable numbers in the literature.** The
SmartBear/Cisco study (2,500 reviews, 3.2M LOC, 50 developers, 10 months) found: review **200–400
LOC max** (ideally 100–300); defect detection drops sharply past 400 LOC; inspection **below
300–500 LOC/hour** finds the most defects; keep sessions **under 60–90 minutes**; and author
"preparation" (annotating the change before review) sharply reduces defects. A properly conducted
200–400 LOC review yields a reported 70–90% defect discovery. [strong] Fagan's original 1976
inspection data found 38 defects/KLOC via inspection vs 8/KLOC via unit tests, catching 82% of total
defects [strong] — but that was heavyweight formal inspection, not applicable at solo scale.

**3. AI-generated code is measurably less secure, and the problem is not improving.** Veracode's
2025 GenAI Code Security Report (100+ LLMs, 80 tasks) found that "when given a choice between a
secure and insecure method to write code, GenAI models chose the insecure option 45 percent of the
time," introducing OWASP Top 10 vulnerabilities. Java was riskiest at a **72% security failure
rate**, and "Cross-Site Scripting (CWE-80): AI tools failed to defend against it in 86% of relevant
code samples." Their Spring 2026 update found the trend flat: "while syntax pass rates... have
climbed steadily from about 50% to 95% since 2023, security pass rates have remained essentially
flat, hovering between 45% and 55% regardless of model generation" — "Models have become excellent
at writing code that compiles. They've failed at writing code that's safe." Model size barely
matters. [strong] The Stanford study (Perry et al., *Do Users Write More Insecure Code with AI
Assistants?*, CCS 2023, 47 participants) found developers with an AI assistant "wrote significantly
less secure code" AND "were more likely to believe they wrote secure code" — overconfidence is the
compounding risk. [strong]

**4. Industry trust and code-quality signals corroborate the security data.** Stack Overflow's 2025
Developer Survey (49,009 responses, 166 countries) found trust in AI accuracy **fell to 29% (from
40% in 2024)**, and "More developers actively distrust the accuracy of AI tools (46%) than trust it
(33%)," with only 3% reporting they "highly trust" the output — experienced developers most skeptical
(2.6% "highly trust"). Adoption meanwhile rose to 84% use-or-plan-to-use. [strong] GitClear's
analysis (211M+ lines) found copy/paste exceeded refactored ("moved") code for the first time in
2024, churn roughly doubling from a ~3.3% pre-AI baseline to ~7.1% in 2025, and duplicated code
blocks rising ~8-fold in 2024. [moderate — single vendor, large-n, transparent method] DORA 2024
associated a 25% increase in AI adoption with a **7.2% decrease in delivery stability** (and 1.5%
throughput decrease); DORA 2025 found throughput turned positive but **instability persisted**.
[strong]

**5. AI code review tools work but the evidence is thin and vendor-contaminated.** Benchmarks span a
wide band: Greptile's own July-2025 benchmark (50 bugs) claimed 82% catch for Greptile, ~58%
Bugbot, mid-50s Copilot, 44% CodeRabbit, 6% Graphite — but Martian's independent leaderboard scored
Greptile far lower, and a 3-week parallel run (146 PRs, 679 findings) found different tools lead on
different axes (Sentry Seer best on critical severity; Greptile highest precision; CodeRabbit
highest volume). High-recall tools carry a reported 30–50% triage burden. [thin] The honest summary:
AI reviewers catch "70–80% of low-hanging fruit" (Osmani) but miss business logic, architecture, and
context-dependent decisions — the exact things that matter most. [moderate]

**6. Property-based testing is the single best-fit technique for a puzzle generator.** Puzzle Lab's
correctness properties (unique solution, valid grid, deterministic seeding, difficulty stability)
are *invariants*, not examples — precisely what property-based testing (fast-check in TS) targets.
PBT generates hundreds of inputs and, on failure, *shrinks* to a minimal counterexample.
QuickCheck's inventor John Hughes famously used PBT to find deep bugs example tests missed. [strong
for the technique; moderate for specific defect-rate claims]

**7. Server Actions and route handlers are public endpoints — the leaderboard/economy hot spot.**
Next.js's own documentation states every Server Action is reachable by direct POST; the framework
handles CSRF and closure encryption but does *nothing* about authentication, authorization, input
validation, rate limiting, or return-value hygiene. TypeScript types are erased at the wire. The
correct order is authorize → validate (Zod) → mutate, with validation necessary but not sufficient (a
well-formed object can still target a row you don't own). [strong]

**8. Slopsquatting is a real, AI-specific supply-chain vector.** Spracklen et al., *We Have a
Package for You!* (USENIX Security 2025; UT San Antonio / Oklahoma / Virginia Tech; 2.23M code
samples, 16 models) found **19.7% of recommended packages did not exist** (205,474 unique
hallucinated names), ranging from 5.2% for commercial models to 21.7% for open-source. Critically,
**43% of hallucinated names reappeared across all ten re-runs of the same prompt** and 58% recurred
across more than one run — "a pool large enough to fuel sustained slopsquatting," predictable enough
to pre-register maliciously. [strong]

## Details

### A. Code review without a second reviewer

**What the evidence actually says about self-review and delay.** The "review your own PR the next
day with fresh eyes" idea rests on two well-evidenced but *adjacent* literatures and one honest gap:

- **Incubation** (Sio & Ormerod, *Psychological Bulletin* 2009, meta-analysis of ~117 studies)
  shows a positive but modest effect (mean d≈0.29), stronger after longer prior effort and when the
  break is filled with low-demand activity (sleep qualifies). [strong] But this is about *solving*
  problems, not *detecting defects in work you already produced*.
- **Proofreading familiarity**: Daneman & Stainton (1993, *Reading and Writing*) found people detect
  *fewer* errors in self-generated text — and a two-week delay did *not* remove the disadvantage,
  because it stems from extreme familiarity. [strong] But Burgoyne et al. (2023, *Psychological
  Research*, eye-tracking replication) *failed to replicate* this and found a slight advantage for
  proofreading one's own fresh text (≈5.3% more errors detected, p=.059). [strong — an important
  caveat]
- **The gap**: there is *no controlled study on code + delay*. The next-day convention is a plausible
  extrapolation, not science. **Verdict: keep it — it is nearly free and directionally supported —
  but do not rely on it to catch defects; that is the tests' and AI reviewer's job.** Note the
  tension: Bacchelli & Bird found 91% of reviewers take longer on unfamiliar files and that
  familiarity produces *deeper* (not shallower) defect feedback, which actually cuts against the
  naive "familiarity blinds you" story for code. [strong]

**Checklists measurably help — but mostly for what you'd otherwise forget.** Generic checklists aid
inspection outcomes and reduce false positives (Oladele & Adedayo: ~50% fewer false positives with
checklist-based reading); a widely-cited claim that checklist-driven reviews raise defect detection
~66.7% vs ad-hoc is repeated by vendors without a clean primary citation — treat as indicative
[moderate]. Importantly, Braz et al. found that *explicitly telling* a reviewer to focus on security
greatly increased security-defect detection, while *adding a security checklist on top did not help
further* [strong] — the *prompt to look* matters more than the checklist's length. **Belongs on a
checklist: things easy to forget and hard to automate (authz checks, doc impact, "is this AI code
verified"). Belongs in automation, not a checklist: formatting, style, import hygiene, obvious
lint.** Static tools like PMD address only ~16% of issues found in manual review and generate false
positives [moderate], so they complement rather than replace judgment.

**AI review as the "second pair of eyes."** This is the correct substitute given no human reviewer
exists. Configure one tool (CodeRabbit is the pragmatic default: lower noise, free tier, broad
platform support; Greptile if cross-file/whole-repo dependency analysis matters and you can tolerate
triage). Expect it to catch null-handling, missing test coverage, obvious anti-patterns, and some
injection/validation gaps — and to miss architectural and business-logic errors. Treat every AI
comment as a hypothesis to verify, not a verdict.

### B. Reviewing AI-generated code specifically

**What's different.** AI failure modes cluster around *plausibility*: logic that reads correctly but
is subtly wrong, hallucinated/deprecated APIs, missing edge cases, insecure defaults, over-permissive
validation, silently removed guards, inconsistent error handling, and dependency hallucination.
Osmani's "70% problem" frames it well: AI gets you 70% (scaffolding, obvious patterns) fast, but the
last 30% — edge cases, security, production integration — "can be just as time-consuming as it ever
was," and juniors accept "house of cards code" that collapses under real-world pressure. [moderate —
practitioner, widely corroborated]

**Practical mitigations, ranked:**

1. **Server-side validation on every trust boundary** — non-negotiable given the 45% figure. Zod
   schemas at every Server Action / route handler; authorize before validate; never trust
   client-supplied scores, currency, or leaderboard values.
2. **Make the AI re-derive or explain risky logic.** Forcing "explain this back / re-derive the
   invariant" exploits the same mechanism as author-preparation annotations (which reduced defects in
   the Cisco study). [moderate]
3. **Automate the security-relevant classes** the AI reliably gets wrong (injection, XSS, crypto) via
   CodeQL + tests.
4. **Pin and verify dependencies** the AI suggests before install (slopsquatting).
5. **Marking AI vs hand-written code**: worth a lightweight signal (commit trailer or PR checkbox
   "contains AI-generated logic requiring extra scrutiny") because it routes attention — not worth
   line-level annotation ceremony. The value is triggering the *decision to look harder*, which the
   Braz et al. evidence says is what actually works. [moderate]

### C. Automated quality gates for this stack

A lean, high-value CI gate for Next.js + TS + Drizzle + Postgres:

- **Type checking at maximum strictness**: `strict: true`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`. Types are your cheapest, fastest defect gate — and they're erased at runtime,
  which is exactly why Zod is needed at boundaries.
- **Lint rules that catch bugs, not style**: `@typescript-eslint` type-aware rules
  (`no-floating-promises`, `no-misused-promises`, `await-thenable`, `no-unnecessary-condition`),
  `eslint-plugin-security` where useful. Push formatting to Prettier (auto-fix, never a gate a human
  reads).
- **Test tiering (testing trophy, not pyramid)**: For a Next.js app, integration tests give the best
  confidence-per-line (Kent C. Dodds' trophy; static analysis as the base layer). Concentrate on
  integration tests of route handlers/actions with a real test DB; unit-test the generator/solver
  heavily with property-based tests; keep e2e (Playwright) to a *thin* smoke layer over critical
  flows (auth, daily puzzle load, score submission). **e2e is worth the maintenance cost for a solo
  dev only for the 2–4 flows whose breakage is catastrophic and silent.**
- **Contract validation (Zod) at every trust boundary** — client input, cron payloads, external API
  responses.
- **Server-side validation patterns**: authorize → validate → mutate; idempotency keys on
  score/economy writes; replay protection (nonce or monotonic sequence); rate limiting keyed on user
  ID (Upstash) *inside* actions, since actions bypass API-route middleware. CVE-2025-29927 (March 2025
  middleware auth bypass via `x-middleware-subrequest`) is a reminder never to rely on middleware
  alone for authz. [strong]
- **Security tooling reality check**: CodeQL catches injection/taint-flow classes and is worth
  keeping; Dependabot/npm audit catch *known-CVE* dependencies but miss logic flaws and zero-day
  supply-chain. SAST *does* add value on this size project precisely because AI writes injection-prone
  code. Add secret scanning (gitleaks or GitHub's). For supply chain: pin exact versions,
  `--ignore-scripts` or vet postinstall scripts, and verify any AI-suggested package exists and is
  reputable before install.
- **Drizzle migration safety**: `drizzle-kit generate` (reviewable SQL), never `push` to prod.
  Drizzle generates no rollback automatically — hand-write reverse SQL for destructive changes. Follow
  expand/contract: additive-only until cutover; `CREATE INDEX CONCURRENTLY`; backfill in batches; back
  up before a destructive prod migration; test on a staging copy. **Review every generated migration
  by hand** — a place where a mechanical diff-read pays off.
- **Performance/accessibility gates**: Given the INP budget and 0-axe-violations target, wire **axe
  into CI** (cheap, deterministic, directly enforces the stated posture) and **Lighthouse CI with an
  INP/performance budget assertion**. These are worth it *because the targets are already committed
  to* — an unenforced budget in a docs file is exactly the "note in a docs file" failure mode being
  eliminated. [moderate]

### D. Test strategy for a solo dev

- **Test the generator/solver as invariants (property-based testing with fast-check).** Properties
  for Puzzle Lab: (1) every generated puzzle has *exactly one* solution (run the solver's
  solution-counter); (2) grid validity (no row/col/box/cage violations; KenKen/Killer cage arithmetic
  holds); (3) determinism — same seed ⇒ identical puzzle (round-trip / idempotence); (4)
  difficulty-rating stability — regenerating at a difficulty stays within the intended band; (5)
  solver correctness — solve(generate()) reproduces the intended solution. Use a fixed seed corpus for
  golden/snapshot tests plus randomized property runs; capture and log the failing seed so any
  counterexample is reproducible in CI. Shrinking hands you the minimal failing grid. [strong fit]
- **Metamorphic testing** complements PBT where you lack an oracle: permuting symbols (relabeling
  1–9) or rotating/reflecting a valid grid must preserve solvability and solution count; adding a
  redundant clue must not change the unique solution. [moderate]
- **Test-change discipline** (don't edit tests in the same commit as the code they cover, or require
  an explicit reason): sound practice — it prevents silently weakening a test to make a broken change
  pass, a failure mode *amplified* by AI agents that will happily "fix" a failing test by deleting the
  assertion. No large-n study, but strong practitioner consensus and a specific defense against AI
  test-tampering. [moderate] Enforce it as a PR-template checkbox, not tooling.
- **Coverage and mutation testing**: line coverage is a weak signal (100% coverage can assert
  nothing). Mutation testing (Stryker) is the honest measure but costs 10–100× runtime. **Worth it
  for a solo dev only on the generator/solver core** — run occasionally (not per-merge), target ~80%
  mutation score, treat as advisory. Skip for UI/glue code. [moderate]
- **Flaky tests**: for one person, quarantine-and-fix beats retry-forever. Seed all randomness; avoid
  real timers/network in unit and integration tests; if a test flakes, fix it that day or delete it —
  a flaky test a solo dev learns to ignore is worse than none.

### E. Research and technical decision-making

- **When to read source over searching.** The KDE KSudoku experience — reading
  `mathdokugenerator.cpp` revealed documented difficulty parameters were dead code while web search
  gave a confidently wrong picture — is the general rule: **for questions about what a specific
  implementation actually does, primary source code beats search, and beats AI, every time.** AI
  confabulates most on specifics (exact API behavior, whether a parameter is wired up). Calibration
  heuristic: trust AI for breadth/orientation and boilerplate; verify against primary sources for any
  load-bearing specific, especially security behavior, API contracts, and "does X actually do Y."
- **ADRs**: adopt the lightweight Nygard format (context → decision → consequences), one decision per
  short Markdown file in `Docs/adr/`, for *architecturally significant, expensive-to-reverse*
  decisions only (e.g., "passkeys via better-auth," "multi-zone basePath," "Neon + Drizzle"). For a
  solo dev they pay off as a memory aid for your future self — but become overhead the moment they
  turn into changelogs. ADRs *index the why*, they don't restate the what. [moderate — strong
  practitioner consensus, Thoughtworks "Adopt"]
- **Analysis paralysis / planning-as-procrastination.** The planning fallacy (Kahneman & Tversky) says
  we systematically underestimate effort — which means *more* upfront planning rarely fixes the
  estimate and often becomes avoidance. The tell that planning has become the activity: the plan is
  being refined without new information being gathered, or research produces documents rather than
  decisions. Vertical slicing is itself the antidote — a walking skeleton forces a decision to ship
  end-to-end, converting planning into feedback. [moderate]

### F. Process weight calibration — evaluating the keep/drop split

**KEEP (correct):** tests, CI, static analysis, security scanning, branch protection, AI review,
next-day self-review. Every one is *mechanical* — it runs without a human remembering to run it — and
each addresses a defect class the others don't. This is exactly right.

**DROP (mostly correct):** multi-phase master plans, formal gate documents, external plan reviews of
one's own work, GREEN/RED verdicts. These are *human-ceremony* artifacts whose value came from
*coordinating multiple people* — and there are no other people. Below a team size of ~2–3,
coordination ceremony is pure overhead. The Bacchelli & Bird finding that review's defect-finding is
weaker than believed further justifies dropping heavyweight review theater. [moderate]

**WHERE THE SPLIT IS INCOMPLETE — what's missing:**

1. **The pre-merge review gate itself must move from a "keep" *intention* to the *enforced* column.**
   Right now review is heroic/occasional; the fix is a PR template + branch protection (below).
2. **Server-side validation is not on the list at all** and it's the highest-risk gap given AI +
   economy endpoints. Make it an *enforced* item (integration tests that assert unauthorized/invalid/
   replayed requests are rejected).
3. **Dependency/supply-chain vetting** (slopsquatting) isn't explicitly kept — add "verify new
   packages exist and are reputable" to the mechanical set.
4. **Migration review** should be explicitly named a mandatory manual step, since Drizzle's generated
   SQL is where "safe in dev, catastrophic in prod" lives.

## Staged Recommendations

**Stage 1 — This week (make the gate physical):**

1. Add a **branch protection rule** requiring green CI (typecheck + lint + unit + integration) and at
   least one AI review pass before merge. This alone converts "heroic occasional review" into
   "standing per-merge review."
2. Add the **PR template** below to `.github/`.
3. Turn on one **AI reviewer** (CodeRabbit default) on the repo.
4. Add **axe-in-CI** and a **Lighthouse CI budget assertion** enforcing the existing INP and 0-axe
   targets.

**Stage 2 — Next 2 weeks (close the AI-security gap):**

5. Write **Zod schemas + authorize→validate→mutate** for every leaderboard/economy/score Server
   Action, with **idempotency keys and rate limiting inside the action**.
6. Add **integration tests** asserting each economy endpoint rejects unauthorized, malformed, and
   replayed requests — the regression proof against the 45% insecure-default risk.
7. Add **property-based tests** (fast-check) for the generator/solver invariants (unique solution,
   validity, determinism, difficulty stability), with seed logging.

**Stage 3 — Ongoing / as-needed:**

8. Run **Stryker mutation testing** on the generator/solver core occasionally; target ~80%, advisory
   only.
9. Write **ADRs** for the handful of already-made architectural decisions; index them from the docs.
10. Add **secret scanning** (gitleaks) and a **dependency-vetting habit** for AI-suggested packages.

**Benchmarks that would change these recommendations:**

- If AI-reviewer false positives exceed ~1 in 3 and you start ignoring it → tune it down or switch
  tools; a review you ignore is worse than none.
- If Playwright e2e maintenance exceeds ~15% of your testing time → cut back to a single smoke flow.
- If a migration ever causes a prod incident → add a mandatory staging-replay step before any
  destructive migration.
- If mutation testing on the core stays below ~60% → invest in assertions there before adding
  features.

### Proposed PR template (`.github/pull_request_template.md`)

```text
## What & why
<!-- One or two sentences. Link the slice. -->

## Pre-merge self-review (next-day pass)
- [ ] Correctness: I re-derived the core logic; edge cases considered
- [ ] Server-side validation: inputs validated (Zod) at the trust boundary; authorize→validate→mutate order
- [ ] No secrets committed; no secrets in Server Action closures
- [ ] Tests: added/updated; not weakened in the same commit as the code they cover
- [ ] AI-generated logic: flagged and verified (explain-back done for risky parts)
- [ ] Docs/CONTEXT impact considered
- [ ] Migration (if any): generated SQL read by hand; reverse SQL written; additive-only or cutover planned

## Size check
- [ ] Diff is < ~400 LOC (split if larger)
```

### Pre-merge review checklist for small vertical slices (the human 10 minutes)

1. **Does it actually work end-to-end?** (Run the slice; click through it.)
2. **Trust boundaries**: every new endpoint/action authorizes, then validates, then mutates.
3. **Economy/leaderboard writes**: idempotent, rate-limited, replay-safe, server-authoritative.
4. **AI-written sections**: identified, re-derived or explained back, dependencies verified to exist.
5. **Tests**: cover the new behavior; assertions real; not silently weakened.
6. **Migration**: read the generated SQL; destructive changes have reverse SQL and a backup.
7. **Doc/CONTEXT drift**: does the index still point to reality?

### What to automate vs. check by hand

- **Automate (never a human's job):** formatting, style, import order, type checking, lint bug-rules,
  known-CVE dependency scan, secret scan, injection/taint (CodeQL), axe a11y, Lighthouse/INP budget,
  unit + integration + property tests, e2e smoke.
- **Check by hand (judgment required):** authorization correctness, business/economy invariants,
  whether AI logic is actually right, generated migration safety, architectural fit, doc-index
  accuracy.

## Caveats

- **The "45%" and "72% Java" Veracode figures are from a security vendor** with a product to sell, but
  the methodology (100+ models, out-of-the-box behavior, held flat across a year of model releases) is
  transparent and the direction is corroborated by the independent Stanford study and Checkmarx. Treat
  the *direction* as strong and the *exact percentage* as indicative. [strong direction / moderate on
  the specific number]
- **GitClear is a single vendor** using its own tooling; its churn/duplication numbers are
  directionally consistent with DORA's stability finding but should not be cited as settled fact.
  [moderate]
- **AI-code-review benchmark numbers are largely vendor-published or single-blog**, with wildly
  divergent catch rates (44%–82% for the same tools) depending on who ran the test. The only safe
  conclusion is "helpful for low-hanging fruit, unreliable for logic/architecture — measure on your own
  repo." [thin]
- **The "66.7% checklist improvement" and "70–90% defect discovery for 200–400 LOC" figures** are
  widely repeated but trace to specific studies with specific populations (often students, or one
  company); treat as order-of-magnitude, not precise. [moderate]
- **The next-day self-review recommendation has no code-specific evidence** and one psychology
  replication failure against the underlying effect. It is cheap and directionally supported, not
  proven. [thin for code specifically]
- **DORA is correlational** for the stability finding (though 2025 used Bayesian causal modeling); "AI
  causes instability" is the likely but not certain reading — larger batch sizes and reduced review are
  plausible mediators.
