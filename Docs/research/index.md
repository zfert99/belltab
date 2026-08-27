# Research index

What is in this directory, and — more importantly — **which repo each document
is actually about**.

Most of these were written for sibling projects (Puzzle Lab, the Biscuit Lab
hub) and were copied here because their conclusions travel. Their *numbers* do
not always travel: they name package versions, CI runners and PR numbers that
belong to the repo they were written in. Read the "watch out for" column before
quoting a figure at BellTab.

## BellTab's own evidence base

| Document | What it settles |
| --- | --- |
| [background-timers-and-schedule-modeling.md](background-timers-and-schedule-modeling.md) | **The load-bearing one.** Why the countdown recomputes instead of decrementing, why times are minutes-since-midnight integers, and why periods may not overlap. `AGENTS.md`'s domain invariants cite it directly; do not overturn one from memory. |

## Inherited references — general advice

General enough to be worth keeping, but **five of these were written *for* the
puzzle app and say so in their own H1**. Every row therefore carries a caveat,
including the genuinely generic ones, so that "no caveat" always means "we
checked" rather than "we did not look".

| Document | Subject | Watch out for |
| --- | --- | --- |
| [accessibility-responsive-qa.md](accessibility-responsive-qa.md) | WCAG 2.2 AA beyond touch targets, and an automated a11y workflow. | Titled "for the Puzzle App". Its ARIA-grid pattern and its Reflow *exception* describe a 9×9 board we do not have; everything outside that exception applies as written. Its `@axe-core/playwright` recommendation is an open gap here, not a solved problem. |
| [responsive-design-pwa.md](responsive-design-pwa.md) | Responsive and PWA reference. Relevant to Phase 6. | Written for the puzzle app. The responsive half applies directly; the PWA half assumes an installable app with a Serwist service worker, which BellTab does not have and may never have — Phase 6 decides. |
| [testing-mobile-responsiveness-locally.md](testing-mobile-responsiveness-locally.md) | Testing responsiveness without deploying. | Its "route through an HTTPS tunnel, not a LAN IP" recommendation is justified **entirely** by better-auth passkeys needing a secure context. BellTab has no auth, so `next dev -H 0.0.0.0` plus a LAN IP is enough — remember `allowedDevOrigins`, and that dev lives at `/bell`. |
| [web-best-practices.md](web-best-practices.md) | React and Next.js architectural conventions. | Repo-agnostic, but it argues **for** domain/feature-folder organization, which `AGENTS.md` bans at this size ("No feature folders yet"). Where the two disagree, `AGENTS.md` wins. |
| [enterprise-architecture.md](enterprise-architecture.md) | Architecture, testing and telemetry in React and Next.js. | Same feature-folder recommendation, same override. Its telemetry half assumes a server to send telemetry to; there isn't one. |
| [nextjs-performance.md](nextjs-performance.md) | Next.js performance. | Written for the puzzle app. Its caching advice names Upstash/Vercel KV and the right Neon connection method — BellTab has no server, no database and makes no runtime fetches. What applies is the client-side half: a narrow `'use client'` boundary, `next/font`, and animating only `transform`/`opacity`. |
| [web-security-mitigation.md](web-security-mitigation.md) | Web application security, generally. | Repo-agnostic, and mostly about surface this app does not have — password hashing, access control, a database. What reaches here is the OWASP Top 10:2025 reordering, the headers baseline, and treating all input as untrusted. |
| [ai-assisted-nextjs-security-reference.md](ai-assisted-nextjs-security-reference.md) | Security for an AI-assisted Next.js app. | **Titled "…for an AI-Assisted Next.js Puzzle App", and its action plan is largely non-goals here** — better-auth, rate limiting on Upstash, Neon RLS, passkey account recovery, Server Action validation. `Docs/belltab-plan.md` §2 rules out auth, accounts, a database and a backend. What transfers: the Top 10:2025 ordering, the security-headers baseline, the middleware-is-not-auth warning (CVE-2025-29927), and "treat AI-generated code as unaudited". |
| [solo-dev-ai-qa-code-review-playbook.md](solo-dev-ai-qa-code-review-playbook.md) | QA and code review for a solo developer working with heavy AI assistance. | **Subtitled "A Playbook for Puzzle Lab."** Its CI gate is specified as "Next.js + TS + Drizzle + Postgres" and it names Drizzle migration review a mandatory manual step; BellTab has no ORM and no migrations, so that gate is smaller here. The process half — squash-merge PRs even solo, mechanical gates over ceremony, AI review — is what this repo actually adopted. |
| [git-github-best-practices.md](git-github-best-practices.md) | Git and GitHub, at length. | Repo-agnostic. Written for teams at scale; the GitFlow/trunk-based comparison is background, not a live question here. |
| [git-github-best-practices-solo-multi-repo.md](git-github-best-practices-solo-multi-repo.md) | The same, narrowed to a solo multi-repo developer. | Repo-agnostic and the closest match to how this repo is actually run — GitHub Flow, Conventional Commits, squash-merge, light branch protection. |

## Inherited references — about OTHER repos

Useful as precedent. Their specifics describe Puzzle Lab or the hub.

| Document | Subject | Watch out for |
| --- | --- | --- |
| [multi-zone-migration-validation.md](multi-zone-migration-validation.md) | Validating a subdomain→subfolder multi-zone migration on Vercel. | The closest precedent for **Phase 7**, but it is Puzzle Lab's migration, and BellTab has no auth to complicate it. |
| [multi-zone-migration-safety-review.md](multi-zone-migration-safety-review.md) | Safety and security review of the same migration. | As above. Its rate-limit finding is marked VERIFIED against method and numbers in a `rate-limit.md` that lives in the Puzzle Lab repo and was not copied here — the claim is sourced, but not from inside this repo. |
| [multi-zone-basepath-fetch-fix.md](multi-zone-basepath-fetch-fix.md) | A client `fetch()` that did not carry the basePath. | BellTab makes **no runtime fetches at all**, by rule. Read it as a warning about `basePath`, not as a bug we can have. |
| [multi-zone-cost-and-alternatives.md](multi-zone-cost-and-alternatives.md) | Whether multi-zone is worth its cost. | Decision doc for the hub. It concludes single-app is the eventual end-state, which is a live question for Phase 7. Its two load-bearing sources — `puzzle-lab-hub-merge-research.md` and `vercel-cron-deployment-protection-outage.md` — are in the Puzzle Lab repo, not this one. |
| [sitemap-architecture-multi-zone.md](sitemap-architecture-multi-zone.md) | Sitemap architecture for Biscuit Lab. | Phase 7 adds BellTab to the sitemap index. |
| [seo-geo-strategy.md](seo-geo-strategy.md) | SEO and GEO for Puzzle Lab. | Puzzle Lab's content strategy, not ours. |
| [solo-dev-brand-architecture.md](solo-dev-brand-architecture.md) | Information and brand architecture across the projects. | Names the `/bell` versus `/belltab` kind of question the roadmap leaves open. |
| [eslint10-ts7-upgrade-blockers.md](eslint10-ts7-upgrade-blockers.md) | Why ESLint 10 and TypeScript 7 were deferred. | **Its numbers are the hub's, not ours.** It cites `typescript ^5`, Tailwind, Node 20 and Dependabot PR #5; BellTab is on TypeScript 6.0.3, has no Tailwind, and has its own Dependabot history. The *root cause* — `typescript-eslint`'s peer range, and `jsx-a11y` having no ESLint 10 support — is the same one pinning this repo, so the conclusion transfers and the figures do not. |

## A note on cross-references inside these documents

Some inherited documents cite sibling documents that were **not** copied here.
Rather than leave links that resolve to nothing, those citations are written as
plain filenames with the repo that holds them named alongside. Three such files
live in Puzzle Lab: `puzzle-lab-hub-merge-research.md`,
`vercel-cron-deployment-protection-outage.md`, and `src/lib/rate-limit.md`.
Nothing else in the prose was changed.
