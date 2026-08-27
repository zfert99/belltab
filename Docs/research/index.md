# Research index

What is in this directory, and — more importantly — **which repo each document
is actually about**.

Most of these were written for sibling projects (Puzzle Lab, the Biscuit Lab
hub) and were copied here because their conclusions travel. Their *numbers* do
not always travel: they name package versions, CI runners and PR numbers that
belong to the repo they were written in. Read the subject column before quoting
a figure at BellTab.

## BellTab's own evidence base

| Document | What it settles |
| --- | --- |
| [background-timers-and-schedule-modeling.md](background-timers-and-schedule-modeling.md) | **The load-bearing one.** Why the countdown recomputes instead of decrementing, why times are minutes-since-midnight integers, and why periods may not overlap. `AGENTS.md`'s domain invariants cite it directly; do not overturn one from memory. |

## Inherited references — general, and safe to apply here

| Document | Subject |
| --- | --- |
| [accessibility-responsive-qa.md](accessibility-responsive-qa.md) | WCAG 2.2 AA beyond touch targets, and an automated a11y workflow. Written for the puzzle app's grids; everything outside the grid exception applies. |
| [responsive-design-pwa.md](responsive-design-pwa.md) | Responsive and PWA reference. Relevant to Phase 6. |
| [testing-mobile-responsiveness-locally.md](testing-mobile-responsiveness-locally.md) | Testing responsiveness without deploying. |
| [web-best-practices.md](web-best-practices.md) | React and Next.js architectural conventions. |
| [enterprise-architecture.md](enterprise-architecture.md) | Architecture, testing and telemetry in React and Next.js. |
| [nextjs-performance.md](nextjs-performance.md) | Next.js performance. Written for the puzzle app. |
| [web-security-mitigation.md](web-security-mitigation.md) | Web application security, generally. |
| [ai-assisted-nextjs-security-reference.md](ai-assisted-nextjs-security-reference.md) | Security for an AI-assisted Next.js app. |
| [solo-dev-ai-qa-code-review-playbook.md](solo-dev-ai-qa-code-review-playbook.md) | QA and code review for a solo developer working with heavy AI assistance. |
| [git-github-best-practices.md](git-github-best-practices.md) | Git and GitHub, at length. |
| [git-github-best-practices-solo-multi-repo.md](git-github-best-practices-solo-multi-repo.md) | The same, narrowed to a solo multi-repo developer. |

## Inherited references — about OTHER repos

Useful as precedent. Their specifics describe Puzzle Lab or the hub.

| Document | Subject | Watch out for |
| --- | --- | --- |
| [multi-zone-migration-validation.md](multi-zone-migration-validation.md) | Validating a subdomain→subfolder multi-zone migration on Vercel. | The closest precedent for **Phase 7**, but it is Puzzle Lab's migration, and BellTab has no auth to complicate it. |
| [multi-zone-migration-safety-review.md](multi-zone-migration-safety-review.md) | Safety and security review of the same migration. | As above. |
| [multi-zone-basepath-fetch-fix.md](multi-zone-basepath-fetch-fix.md) | A client `fetch()` that did not carry the basePath. | BellTab makes **no runtime fetches at all**, by rule. Read it as a warning about `basePath`, not as a bug we can have. |
| [multi-zone-cost-and-alternatives.md](multi-zone-cost-and-alternatives.md) | Whether multi-zone is worth its cost. | Decision doc for the hub. It concludes single-app is the eventual end-state, which is a live question for Phase 7. |
| [sitemap-architecture-multi-zone.md](sitemap-architecture-multi-zone.md) | Sitemap architecture for Biscuit Lab. | Phase 7 adds BellTab to the sitemap index. |
| [seo-geo-strategy.md](seo-geo-strategy.md) | SEO and GEO for Puzzle Lab. | Puzzle Lab's content strategy, not ours. |
| [solo-dev-brand-architecture.md](solo-dev-brand-architecture.md) | Information and brand architecture across the projects. | Names the `/bell` versus `/belltab` kind of question the roadmap leaves open. |
| [eslint10-ts7-upgrade-blockers.md](eslint10-ts7-upgrade-blockers.md) | Why ESLint 10 and TypeScript 7 were deferred. | **Its numbers are the hub's, not ours.** It cites `typescript ^5`, Tailwind, Node 20 and Dependabot PR #5; BellTab is on TypeScript 6.0.3, has no Tailwind, and has its own Dependabot history. The *root cause* — `typescript-eslint`'s peer range, and `jsx-a11y` having no ESLint 10 support — is the same one pinning this repo, so the conclusion transfers and the figures do not. |
