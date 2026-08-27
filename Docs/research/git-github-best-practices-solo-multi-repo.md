# Git & GitHub Best Practices: A Structured Reference for a Solo Multi-Repo Web Developer

## TL;DR

- For a solo developer running several performance-isolated Next.js/TypeScript repos, adopt **GitHub Flow with light branch protection, Conventional Commits, squash-merge PRs (even self-reviewed), SemVer + Keep a Changelog, and GitHub Actions CI gating** as your default across every repo — this yields a clean, auditable history and real automation without team overhead.
- **Keep the repos separate (polyrepo) but standardize the workflow across all of them**; only consider a Turborepo/Nx monorepo if you find yourself editing shared code in lockstep across projects. To share a UI component library, prefer a published private package over git submodules/subtrees.
- **Never commit `.env` files** (modern `create-next-app` ignores all `.env*` by default, and Prisma's docs state verbatim: *"Do not commit your .env files into version control!"*); enable Dependabot + secret scanning + push protection; and adopt underused recovery/parallelism tools — `git worktree`, `git bisect`, `git reflog`, and `--force-with-lease` — which are disproportionately valuable when one person context-switches across many repos.

## Key Findings

1. **PRs are worth it even solo** — they provide a diff-based self-review surface, a CI gate, and a documentation trail. Squash-and-merge keeps `main` as one-commit-per-feature, making `git bisect`, `git revert`, and changelog generation clean.
2. **GitHub Flow beats GitFlow for your case.** GitFlow's own author, Vincent Driessen, appended a March 2020 "note of reflection" to his original post stating: *"Web apps are typically continuously delivered, not rolled back, and you don't have to support multiple versions of the software running in the wild… If your team is doing continuous delivery of software, I would suggest to adopt a much simpler workflow (like GitHub flow) instead of trying to shoehorn git-flow into your team."* Trunk-based is a later option once CI discipline is strong.
3. **Conventional Commits are the connective tissue** linking commit hygiene → automated SemVer bumps → changelog generation. `feat:` → MINOR, `fix:` → PATCH, `BREAKING CHANGE:` → MAJOR.
4. **Branch protection works solo** but has a specific gotcha: GitHub blocks approving your own PR, so leave "Require approvals" off and instead require *status checks* (CI) and linear history.
5. **Rebase vs merge is genuinely contested** — the consensus is "rebase locally to clean up, merge/squash to integrate." Never rebase shared history; as a solo dev the risk is lower but still applies across your own multiple machines.
6. **Polyrepo is a legitimate, defensible choice.** Monorepo tooling (Turborepo/Nx) adds value mainly for cross-package atomic changes and shared caching; for one developer with independent deploy cadences, the tooling overhead usually exceeds the benefit.

## Details

### 1. Git Fundamentals & Daily Workflow (Solo)

**Atomic commits.** Each commit should represent a single logical change — one fix, one feature increment, one refactor. This makes reverts surgical and `git bisect` effective. Break work into small batches for easier rollback and fewer integration conflicts.

**Conventional Commits** (spec v1.0.0, conventionalcommits.org). Format: `<type>(<optional scope>): <description>`, optional body, optional footer. Core types: `feat` (→ MINOR), `fix` (→ PATCH), plus `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. A commit with `BREAKING CHANGE:` in the footer (or `!` after type/scope) → MAJOR bump regardless of type. Benefits: automatic changelog generation, automatic SemVer determination, machine-readable history, and CI triggering. **Solo adaptation:** use the `scope` to tag which domain/subsystem changed (e.g. `feat(generator): add backtracking solver`, `fix(three): correct camera frustum`) — a lightweight way to navigate history in a domain-driven layout. If a commit doesn't meet the spec before push, fix it with `git rebase -i` and `reword`, or `git commit --amend` for the last one.

**Rebase vs merge (contested — present both).**

- **Merge** is non-destructive; preserves full history and context; creates a merge commit; can clutter history with "extraneous merge commits."
- **Rebase** rewrites history to a clean linear sequence; eliminates merge commits; makes `git log`, `git bisect`, `gitk` easier; but is "potentially catastrophic" if you rebase already-pushed/shared commits (the "Golden Rule of Rebasing"). Rebase presents conflicts one commit at a time; merge presents them all at once.
- **Common hybrid (widely endorsed):** rebase *downstream* (update your feature branch onto `main` to stay current) and merge/squash *upstream* (integrate the finished feature). "Rebasing makes the most sense for an individual project since it's useful for streamlining a complex history."

**Interactive rebase** (`git rebase -i`) before pushing to clean history: `pick`, `reword`, `squash`/`fixup` (fold a commit into the previous one), reorder, or drop commits. This is where you turn a messy working session ("WIP", "fix typo", "actually works now") into a coherent narrative.

**Stashing** (`git stash`) shelves uncommitted work to switch context quickly — but note stashing can cause dependency issues and requires remembering what you were doing; a `git worktree` is often better for mid-task interruptions (see §9).

**Cherry-picking** (`git cherry-pick <sha>`) copies a specific commit onto the current branch — useful for backporting a fix to a release branch, or pulling one commit out of an experimental branch. With squash-merged history, each PR is a single commit, so backporting is one `git cherry-pick` instead of many.

### 2. Branching Strategies for Solo Multi-Repo

**Comparison:**

- **GitFlow** — long-lived `develop`, `release`, `hotfix`, `feature` branches. Built for versioned software supporting multiple releases in the wild. Heavy ceremony, slower cadence, larger PRs. The GitFlow author himself (see Key Finding 2) recommends a simpler flow for continuously-delivered web apps that don't support multiple field versions; git-flow "may still be as good of a fit" only if you're explicitly versioned or supporting multiple versions in the wild.
- **GitHub Flow** — single `main` always deployable; short-lived feature branches; open PR; CI runs; merge and deploy. Relies on strong automated testing. Best fit for small teams / solo devs shipping web apps continuously.
- **Trunk-Based Development (TBD)** — everyone commits small increments to trunk (or via very short-lived branches merged within a day); requires excellent CI + feature flags; maximum throughput. A required practice for true CI.
- **Feature-branch workflow** — generic isolation per feature; the common substrate of GitHub Flow.

**Recommendation for you:** **GitHub Flow as the default across all repos.** It matches Vercel's continuous-deploy model for Next.js, keeps `main` production-ready, and gives you a PR gate. You can drift toward trunk-based for the most stable repos as CI matures.

**Per-repo philosophy may differ:**

- **Puzzle-generator math engine / retro console (systems-level, algorithmically complex):** longer-lived feature branches are legitimate here — a backtracking solver or FSM rewrite is a large, coherent unit of work that shouldn't hit `main` half-done. Guard `main` with CI. Use `git worktree` to keep an experimental algorithm branch alongside `main`.
- **3D portfolio (Three.js/R3F) / DDD solitaire app (UI-heavy, continuously deployed):** short-lived branches, frequent merges, lean on Vercel preview deploys per PR.

**Branch naming conventions.** Use a consistent prefix scheme: `feat/`, `fix/`, `chore/`, `refactor/`, `docs/`, plus a short kebab-case description (e.g. `feat/add-search`, `fix/pdf-export`). If you use GitHub Issues, include the issue number (`feat/42-graph-coloring`). Consistency matters more than the exact scheme.

**Long-running vs short-lived.** Prefer short-lived branches (merge within days) to minimize divergence and merge conflicts. When a branch must be long-running (a big algorithm rewrite), rebase it onto `main` regularly to stay current and surface conflicts early in small batches.

### 3. Pull Requests as a Solo Developer

**Why still use PRs solo (strongly evidenced):**

- **Self-review surface.** The PR "diff" view shows exactly what will merge; reviewing it with "fresh, critical eyes" catches accidental commits, stray debug code, partial changes, and lazy naming. "There's something about working on a solo project… that automatically lowers my quality standards."
- **CI gate.** PRs hook into CI so lint/type-check/test/build run before merge.
- **Documentation trail.** Each PR (ideally linked to an issue) documents *why* a change was made — invaluable when you return to a repo after months.
- **Foundation for future collaboration** — a solo project with an issue→PR→review→merge flow converts trivially to a team project.

**Recommended solo PR loop:** create issue → branch → commit freely → push → open PR (CI runs) → self-review the diff (jump straight to editor to fix, no inline comments needed) → squash-and-merge → delete branch.

**Squash vs merge commit (contested — present the tradeoff):**

- **Squash-and-merge** (recommended default): collapses a branch's WIP commits into one clean commit on `main`. Each `main` commit = one reviewed, CI-passed, revertable PR. Makes `git bisect`/`git revert` clean, and (with Conventional Commit PR titles) auto-generates changelogs. Cost: loses individual-commit granularity (still accessible via the PR link).
- **Merge commit**: preserves full branch topology; matters for long-running integration; clutters history.
- **Rebase-and-merge**: linear history without a merge commit; needs per-commit discipline.

**PR templates** (`.github/pull_request_template.md`): a checklist ("updated CHANGELOG?", "added tests?", "type-checks pass?") enforces your own definition of done.

**Draft PRs** stage work-in-progress and run CI without signaling "ready to merge" — useful for picking up unfinished work on another machine. (Note: solo devs have hit friction creating draft PRs / self-review on repos with strict protection — see §4.)

**PRs to stage deploys:** Vercel builds a preview deployment per PR automatically; you can gate merges on that preview succeeding and run E2E (Playwright) against the real preview environment rather than a mocked local server.

### 4. Pushing & Remote Management

**Force-push safety.** Never use plain `git push --force` on anything that might be shared (including across your own multiple machines). Use **`git push --force-with-lease`**, which only overwrites if the remote hasn't changed since your last fetch — it fails safely instead of clobbering unseen commits. Stronger still: **`--force-if-includes`** (Git 2.30+) additionally requires that you've actually incorporated the remote tip. **Caveat (important nuance):** `--force-with-lease` compares your *locally cached* remote-tracking ref, so running `git fetch` immediately before it defeats the protection (it becomes equivalent to `--force`); prefer `git pull --rebase` to sync. Alias it to `git please` to build the habit.

**Multiple remotes.** Standard for backups/mirrors (e.g. GitHub + a private mirror). `git remote add <name> <url>`, then `git push <name> <branch>`.

**Tagging for releases.** Use annotated tags: `git tag -a v1.2.3 -m "Release 1.2.3"` then `git push --tags`. Note SemVer's rule: `v1.2.3` is a *tag name*; the semantic version is `1.2.3`. Prefixing with `v` is a common convention.

**Protecting `main` as a solo dev.** Branch protection rules (Settings → Branches, or the newer Rulesets) let you: require status checks to pass before merge, require branches be up to date, require linear history, require conversation resolution, and disable force-push/deletion (both off by default under a rule). **Solo gotchas:**

- **Don't** enable "Require approvals" — GitHub prevents approving your own PR, which blocks you entirely. Skip it; rely on required status checks instead.
- The required-status-check dropdown only shows checks that have run **on the protected branch within the last 7 days** and only from the Checks API (GitHub Actions or Checks-API apps). Per GitHub Docs, "to be required, status checks must have completed successfully within the chosen repository during the past seven days." Trigger the workflow on `push: [main]` at least once so the check name appears.
- Job names must be unique across workflows or check results become ambiguous.

### 5. Versioning

**Semantic Versioning (SemVer 2.0.0, semver.org).** `MAJOR.MINOR.PATCH`: MAJOR = incompatible API change; MINOR = backward-compatible feature; PATCH = backward-compatible bug fix. Rules: you MUST declare a public API; released versions are immutable; `0.y.z` is for initial development (anything may change); `1.0.0` defines the public API. Reset lower numbers when bumping higher (`1.4.7`→`2.0.0`). Pre-release: `1.0.0-alpha.1`; build metadata: `1.0.0+001` (ignored in precedence). Don't skip or go backward.

**Changelogs (Keep a Changelog 1.1.0).** File named `CHANGELOG.md` at repo root. Group under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. Maintain an `Unreleased` section at top; on release, rename it to the version with an ISO-8601 date (`## [1.2.0] - 2026-03-15`). Use ISO dates (unambiguous across locales). "Don't let your friends dump git logs into changelogs" — changelogs are for humans; write entries as you ship, not after (make it a PR-template checkbox). Note breaking changes, deprecations, removals prominently; mark pulled releases `[YANKED]`.

**Automated tooling (tradeoff):**

- **semantic-release** — fully automated; parses Conventional Commits since last tag, bumps version, generates CHANGELOG, creates GitHub release, publishes. Zero human intervention. Version is *tightly coupled to commit messages*. No native monorepo support.
- **changesets** — PR-based; you write intent in `.changeset/*.md` files decoupled from commits; a bot opens a "Version Packages" PR. Best-in-class monorepo/multi-package support; explicit versioning avoids accidental bumps.
- **release-please** — Google's PR-based tool that maintains a release PR.
- For your polyrepo of single-package apps, **semantic-release** is the natural fit per repo (commit-driven, zero-touch). If you ever consolidate related packages into one repo, **changesets** becomes the better choice.

**Coordinating versioning across related repos.** In a polyrepo, each repo versions independently (its own tags, its own CHANGELOG). This is a feature, not a bug: your performance-isolated repos have independent deploy cadences, so independent SemVer lines are honest. The cost is that a cross-cutting change touching two repos is two PRs, two version bumps.

**Monorepo vs polyrepo versioning (arguments both ways):**

- *For consolidating:* atomic cross-package commits; one version/lockfile; shared build cache (Turborepo/Nx) can cut CI time substantially; immediate propagation of shared-lib changes via workspace protocol.
- *Against (your current choice):* performance isolation (your stated reason) is real — a heavy Three.js build won't slow the puzzle engine's CI; independent deploys; simpler mental model; no monorepo orchestration tooling to maintain; smaller, faster PRs. Monorepo PR cycle times are often longer because PRs are larger. For one developer, "the tooling overhead of a monorepo exceeds the benefit at small scale."

### 6. Documentation Practices

**README** (first contact with the repo). Answer *what / why / how*. Recommended structure: title; badges row; short description (language, what it does, why useful); demo (GIF/screenshot — especially valuable for the 3D portfolio); features; tech stack; installation; usage/quick-start; links to deeper docs; license. Keep it an *entry point*, not an exhaustive manual — a very long README with no TOC hurts navigation. Beware badge overload.

**Badges** (Shields.io / Badgen). Only include meaningful, accurate, auto-updating badges (CI status, latest release, license, coverage). Place at top; keep consistent style. Organize with a markdown table if you have many.

**CONTRIBUTING.md even solo.** Documents your own setup steps, branch/commit conventions, and release process — future-you and any future collaborator benefit. Pair with an `ARCHITECTURE.md` that maps your domain-driven directory structure, calls out design decisions and invariants, and includes diagrams (esp. valuable for the algorithmic repos: procedural generation pipeline, FSM states, graph model).

**Architecture Decision Records (ADRs).** Short (~1 page) markdown docs, one decision each, stored in `docs/adr/` (or `docs/decisions/`) in the repo. Michael Nygard's format (2011): Context, Decision, Consequences, Status (Proposed/Accepted/Deprecated/Superseded). Append-only: don't edit an accepted ADR; write a new one that supersedes it and link them. The most valuable section long-term is "Alternatives Considered" — it stops you re-litigating settled choices (e.g. "why backtracking over constraint propagation," "why R3F over raw Three.js," "why Prisma over Drizzle"). Write it during the decision, not weeks later. (Martin Fowler and the adr.github.io org endorse this; some teams prefer a "living document" mutable variant.)

**Inline TypeScript/React docs.** Use **TSDoc** (tsdoc.org, Microsoft) — the standardized doc-comment syntax for TypeScript, designed so tools parse comments consistently (unlike loosely-specified JSDoc). Tags: `@param`, `@returns`, `@remarks`, `@example`, `@deprecated`, `@link`. TypeScript also natively understands a subset of JSDoc tags for editor IntelliSense. `eslint-plugin-tsdoc` lints comment syntax.

**Auto-generated docs.** **TypeDoc** consumes TSDoc + the TS type system to generate an HTML API site (or JSON for custom sites); publish to GitHub Pages via `gh-pages`. Microsoft's API-Extractor/API-Documenter (Rushstack) is a heavier alternative that can also flag public-API changes in CI. Most valuable for your reusable UI component library and the math-engine's public API.

### 7. GitHub-Specific Features & Automation

**GitHub Actions CI/CD for Next.js.** Canonical pipeline: on `pull_request` (and `push: [main]`) run install → lint → type-check (`tsc --noEmit`) → test → build. Then gate merges on these checks. Example jobs: `actions/checkout@v4`, `actions/setup-node@v4` with `cache: "npm"`, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

- **Next.js-specific gotchas:** run `next typegen` (or a build) before `tsc --noEmit` so `next-env.d.ts` exists; type-check jobs may need env vars provided as GitHub Secrets. Split fast checks (lint/unit/type on `pull_request`) from slow E2E (Playwright on Vercel's `deployment_status` preview) to keep feedback fast.
- **Vercel deploys automatically from GitHub** — you usually don't deploy from Actions; instead use Actions for gating and notify Vercel of check results (Vercel deployment checks). For non-Vercel hosts or Prisma migrations, add a deploy workflow on `push: [main]` (e.g. `npx prisma migrate deploy` with `DATABASE_URL` from Secrets).

**Issues & Projects for solo task tracking.** Use the issue tracker liberally — describe bugs, features, and questions; keep a public backlog. Issue templates (`.github/ISSUE_TEMPLATE/`) standardize bug/feature entries. GitHub Projects gives a kanban/backlog board across repos. Link PRs to issues (`Closes #42`).

**GitHub Releases.** Turn annotated tags into rich release notes; can auto-generate from merged PRs or pull annotated-tag messages. Note releases are non-portable (GitHub-only), so keep the canonical `CHANGELOG.md` in the repo too.

**Dependabot & security.** Enable (Settings → Code security & analysis): **Dependabot alerts** (flags vulnerable deps), **Dependabot security updates** (auto-PRs the fix), **secret scanning** + **push protection** (blocks commits containing detected secrets — public repos get scanning automatically). **Gotcha:** Dependabot PRs use a *separate* secrets store (Settings → Secrets → Dependabot), not Actions secrets — if your CI needs env vars, Dependabot PRs will fail required checks until you add them there. Use a `dependabot.yml` to schedule ecosystem updates; consider a Dependency Review action on PRs.

**.gitignore / .gitattributes.** See §8 for the exact Next.js template. `.gitattributes` normalizes line endings (`* text=auto`), marks binaries, and can mark generated files for cleaner diffs.

**Repo discoverability.** Set a clear description, add **topics** (e.g. `nextjs`, `threejs`, `procedural-generation`, `typescript`), and a homepage link. This helps you (and others) navigate a portfolio of many repos.

### 8. Repository Hygiene & Organization

**The exact default `create-next-app` .gitignore** (Next.js 14.1+, current). Note the Feb-2024 change (PR #61920 by leerob) to ignore *all* env files by default:

```gitignore
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env files (can opt-in for committing if needed)
.env*

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
```

The older template used `.env*.local` + `.env` instead of `.env*`.

**Secrets / environment variables.** Prisma's docs warn verbatim: **"Do not commit your .env files into version control!"** and `prisma init` adds `.env` to `.gitignore` (with the comment "# Keep environment variables out of version control"). Modern Next.js docs now agree, stating in the Environment Variables guide: **"Warning: The default `create-next-app` template ensures all `.env` files are added to your `.gitignore`. You almost never want to commit these files to your repository."** (Older Next.js docs said the opposite — "`.env`, `.env.development`, and `.env.production` files should be included in your repository as they define defaults. `.env*.local` should be added to `.gitignore`" — this guidance was superseded by PR #61920; be aware of the conflict if you follow older tutorials.) Store production secrets in Vercel env settings and CI secrets in GitHub Secrets; never hardcode. Commit a `.env.example` with dummy values to document required variables.

**Monorepo tooling (comparison point, though you prefer polyrepo).**

- **Turborepo** (Vercel, Rust) — minimal config (`turbo.json`), task orchestration + caching, low learning curve, free remote cache on Vercel; "stays out of your way" but provides no architecture enforcement, generators, or graph visualization. Best default for JS/TS workspaces under ~20 packages.
- **Nx** — full build *platform*: project graph, affected commands, generators, module-boundary enforcement, distributed task execution, `nx release`. More power, more opinion, more migration cost. Better past a real scale ceiling or for polyglot repos.
- **Bazel** — hermetic, polyglot, for very large orgs; overkill here.
- **Verdict for you:** stay polyrepo. If you consolidate, Turborepo + pnpm workspaces is the low-friction starting point.

**Git hooks (Husky + lint-staged).** Enforce quality *before* commit locally. `husky` manages hooks; `lint-staged` runs commands only on staged files. Typical `.husky/pre-commit` runs `npx lint-staged`; config runs `eslint --fix` then `prettier --write` on `*.{ts,tsx}`. **Important limitation:** `lint-staged` type-checking is unreliable because `tsc` on individual files ignores `tsconfig.json` and misses cross-file breakage (e.g. changing an export breaks importers you didn't stage) — run full `tsc -b`/`tsc --noEmit` in the pre-commit or rely on CI. Some prefer native Git hooks over Husky for a lean setup. **Hooks are local safety; CI is the real gate** — keep both.

### 9. Advanced / Underused Git Features (High Value Solo)

**`git worktree`** — check out multiple branches into separate directories sharing one `.git`. This is the standout tool for your multi-repo, multi-branch reality: when a "fire in production" interrupts deep work, instead of a risky stash or a premature commit, `git worktree add ../hotfix hotfix` gives you a clean parallel checkout; work, commit, push, then `git worktree remove`. Also lets you run builds/tests concurrently across branches. (Note: a branch checked out in one worktree can't be checked out in another; open the right folder in your editor.)

**`git bisect`** — binary search for the commit that introduced a regression: `git bisect start`, mark a known-`bad` and known-`good` commit, and Git checks out midpoints (O(log n)). Can be automated with `git bisect run <test-command>`. Works best when commits are atomic and `main` is always green — which squash-merge + CI gating gives you. Extremely valuable for the algorithmic repos where a subtle regression in a generator or FSM may surface far from its cause.

**`git reflog`** — records every move of HEAD and branch tips (kept ~90 days), even after `reset`, `rebase`, or `amend`. Your safety net: recover "lost" commits with `git reflog` → find the SHA → `git reset --hard <sha>` or `git checkout`. This is why history-rewriting (rebase, force-with-lease) is safe in practice.

**`.gitignore` vs `.gitattributes` vs sparse-checkout.** `.gitignore` = which untracked files to ignore. `.gitattributes` = per-path behavior (line-ending normalization, diff/merge drivers, marking generated/binary files, `linguist` language overrides). Sparse-checkout = materialize only part of a repo's tree in your working directory — useful in a large monorepo, less so in your small polyrepos.

**Submodules vs subtrees (relevant for sharing your UI component library across repos).**

- **Submodule** = a pointer to a specific commit of an external repo, stored as a link (`.gitmodules`). Precise version pinning; each consuming repo chooses when to update. Costs: extra commands, easy-to-break CI, a learning-curve tax; contributors "always forget."
- **Subtree** = the external repo's code (and optionally history) copied into a subdirectory; no metadata file; invisible to anyone who just clones/pulls; you can edit in place and push back upstream. Costs: a new merge strategy to learn, more complex upstream contribution, larger repo.
- **The advice most Git articles bury:** for Node.js/TypeScript projects, **a published (private) npm package is usually the better answer** than either — publish your shared UI library to a registry (or GitHub Packages) and version it with SemVer. Reach for a **subtree** if you want a self-contained copy with local edits and infrequent updates; reach for a **submodule** only if you need strict per-repo version pinning of independently-developed shared code.

## Recommendations

**Stage 1 — Standardize a baseline across every repo (do this now):**

1. Adopt **GitHub Flow**: `main` always deployable, short-lived `feat/…`, `fix/…` branches, PR per change.
2. Add a **CI workflow** (`.github/workflows/ci.yml`) running lint + `tsc --noEmit` (after `next typegen`) + test + build on PR and on `push: [main]`.
3. Turn on **branch protection** on `main`: require status checks + linear history; **leave "require approvals" OFF**; disable force-push.
4. Adopt **Conventional Commits** and **squash-and-merge** (set squash as the only merge button; default the squash message to the PR title).
5. Enable **Dependabot alerts + security updates**, **secret scanning + push protection**.
6. Verify `.env*` is gitignored; commit a `.env.example`.

**Stage 2 — Layer in automation & docs (next):**
7. Add **Husky + lint-staged** pre-commit (eslint + prettier); run full type-check in CI (not per-file).
8. Add **semantic-release** per repo (commit-driven SemVer + GitHub releases) *or* maintain a manual `CHANGELOG.md` in Keep a Changelog format with an `Unreleased` section.
9. Write a **README + ARCHITECTURE.md** per repo documenting the domain-driven layout; start a `docs/adr/` log for significant algorithmic/tooling decisions.
10. Add **TSDoc** comments to public APIs; wire **TypeDoc → GitHub Pages** for the shared UI library and math engine.

**Stage 3 — Adopt advanced habits & revisit structure:**
11. Make `git worktree` your default for interruptions and parallel algorithm experiments; alias `git push --force-with-lease` to `git please`.
12. Extract the shared UI components into a **versioned private npm package** rather than duplicating.

**Thresholds that would change the advice:**

- **Consolidate into a Turborepo monorepo** *if* you find yourself making the same change across ≥2 repos in lockstep repeatedly, or shared-library version drift becomes painful. Below that, stay polyrepo.
- **Move to trunk-based development** once CI is fast and trustworthy and you want higher throughput on the stable UI repos.
- **Switch semantic-release → changesets** if any repo grows into a multi-package workspace.
- **Add "require approvals"** only if/when you add a second contributor (and enable "require approval from someone other than last pusher").

## Caveats

- **Rebase vs merge and squash vs merge are genuinely contested**; the recommendations above (rebase locally, squash to integrate) are a defensible default, not dogma. Some experienced devs deliberately merge everything and skip self-review on solo repos — that's a valid, lower-ceremony choice.
- **`--force-with-lease` is safer but not foolproof**: a `git fetch` right before it silently weakens the guarantee. Use `git pull --rebase` to sync.
- **Next.js's own env-file guidance changed** (Feb 2024) and older tutorials still show the pre-change advice to commit `.env`/`.env.development`/`.env.production`. Follow the current default: ignore all `.env*`.
- **lint-staged type-checking is unreliable** for cross-file type breakage; treat CI as the authoritative type gate.
- **Branch protection self-approval friction** on GitHub is real and has frustrated many solo devs; the workaround is to require status checks rather than approvals.
- Several supporting sources are engineering blogs/Medium posts rather than primary docs; the load-bearing claims (SemVer, Keep a Changelog, Conventional Commits, TSDoc, GitHub Docs, Git docs, Next.js/Prisma docs, Driessen's GitFlow note) are cited to authoritative primary sources.
- The frequently-repeated "63% of companies with 50+ developers use monorepos" figure appears across 2025–2026 guides but has **no clearly identified primary survey** — treat as widely-repeated, not authoritative.
