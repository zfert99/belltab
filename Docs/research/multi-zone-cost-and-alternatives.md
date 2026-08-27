# How future projects should mount: the multi-zone cost, measured

**Status:** 📋 Decision doc. **Decided: no structural change now; single-app is the end-state when a
lull appears.** Written 2026-08-07 after the cron outage, then revised the same day against
commissioned research (`puzzle-lab-hub-merge-research.md`, in the Puzzle Lab repo), which
corrected three things this doc originally got wrong.

The prompting question was simple — *"if I make four more projects, do they each need a Vercel
project and a proxy? That would get annoying."*

## The two questions, separated

They turned out to be different, and conflating them is what made the answer feel hard:

1. **Do *future* projects each need a proxy?** No — the tier rule already settles it (Finding 1).
2. **Should *Puzzle Lab itself* stay behind a proxy?** Eventually no. Single-app is the correct
   end-state, but the reasons are structural simplification, not scaling (Finding 4).

## Finding 1 — the tier rule already answers the scaling question

The hub's own `Web_Presence_Plan_v2.md` settles it:

| Tier | Lives at | Deployed as | Trigger |
|---|---|---|---|
| **Small** | `biscuitlab.net/thing` | **a route inside the hub repo** | a toy, a demo, one weekend |
| **Large** | `biscuitlab.net/thing` | own repo, own Vercel project, `basePath` + rewrite | own database, own auth, ongoing work |
| **Product** | `itsownname.com` | own everything; 301 from the Biscuit Lab path | app store, own paid audience, separable auth/legal entity, or spin-out |

**Only Large projects pay the multi-zone tax.** A Small project is a folder in the hub — no Vercel
project, no rewrite, no `basePath`, no origin host, no cron trap. "Four more projects, four more
proxies" assumes every project is Large, and that bar is demanding: *its own database, its own
auth, ongoing work.*

Puzzle Lab is the only thing that clears it today. `GridGame` is currently `Day1.md`, `Day2.md` and
a `src/` with no `package.json` — Small until it proves otherwise. **The cost scales with the number
of Large projects, not with projects**, and the honest estimate is one or two, not four.

## Finding 2 — the tax, measured rather than felt

Per Large project, in this repo today:

| Cost | Measured |
|---|---|
| Files touching `basePath`/`apiPath` | **12** |
| `src/lib/base-path.ts` — exists *only* because `fetch()` ignores `basePath` behind the proxy | **33 lines** |
| `auth.ts` lines on `baseURL`/rpID/redirect-URI gymnastics | **9** |
| Extra infrastructure | a Vercel project, a custom origin host, a hub rewrite with a **build-time** env var |
| Coupling | the hub must be redeployed when `PUZZLES_ORIGIN` changes |
| Operational | split logs, version skew across two deployments |

Plus the failures actually hit: the post-cutover `fetch()` 404s, and the
cron outage (`vercel-cron-deployment-protection-outage.md`, in the Puzzle Lab repo).

## Finding 3 — three corrections the research made to this doc

**"Cutting down the redirect" was a misconception, and it was partly mine.** `/puzzles/*` is a
**rewrite** — a server-side proxy, invisible to users and to Google, no client-visible 3xx.
Removing it saves *one internal hop*, single-digit milliseconds at portfolio traffic, not a Core Web
Vitals issue. The only real **301** is the legacy `puzzles.biscuitlab.net` subdomain, and that
**must stay forever** to preserve link equity. A merge does not remove it. Performance is not a
reason to do this.

**Multi-zones is a scaling-*down* tool, and none of its rationales apply here.** Next's own guide
frames zones as a way to reduce per-app build times, drop code only one zone needs, and let teams
pick different frameworks. At n=1, one framework, one design system, one small app, there is no
build-time problem and no team-independence problem. This doc's original "keep multi-zone" leaned
on inertia rather than on any benefit multi-zone was providing. There is also a small UX cost:
hub→puzzles is currently a **hard navigation** (full reload); merged, it becomes a soft one.

**A merge is far safer for auth than assumed.** rpID and the WebAuthn origin are **host-and-scheme
only, path-independent**, so passkeys survive a mount-path change untouched. The session cookie
carries the `__Host-` prefix, which *guarantees* `Path=/`, so sessions survive with no forced
re-login. The one real hazard is that removing `basePath` stops Next's prefix-stripping, so server
and client must then agree on **one literal auth path** — mounting auth via a route group at
`/api/auth` needs zero Google Console changes. That is config hygiene, not migration danger.

## Finding 4 — the reconciled recommendation

The research recommends **option (a): one Next app, `/puzzles` as a literal route segment, `basePath`
removed** — and explicitly rejects the monorepo middle ground, because two Vercel projects in one
repo still proxy via rewrites, so you would take most of the merge's cost and keep most of
multi-zone's.

The prize is not performance and not scaling. It is that `origin-puzzles.biscuitlab.net`, its DNS
record, the Deployment Protection interplay, the hub rewrite, the build-time origin coupling, and
`apiPath()` **all disappear at once**. That is the strongest engineering argument, and it is the
same list as Finding 2.

**But not now.** The research weighs opportunity cost most heavily and it is right to: this fixes no
user-facing problem, clears no portfolio bar, and competes with job-hunt hours against a backlog
that already calls Puzzle Lab "done enough" and names planning-as-the-activity a recurring failure
mode. Estimated **8–14 hours** across five PRs, with the `basePath`/auth PR carrying roughly half
the risk.

**Do the write-up now instead.** ✅ **Done, 2026-08-07** — published as
[**Thirteen hours, no error**](https://biscuitlab.net/log/thirteen-hours-no-error), not under the
working title this doc first proposed. It leads with the cron outage (`vercel-cron-deployment-protection-outage.md`, in the Puzzle Lab repo)
rather than the architecture, because the outage is the part that earns a reader's attention, and it
carries Finding 2's measurements, Finding 3's passkey/rpID reasoning, and the triggers below. Per
the Build Log rule that publishes to the `Biscuit-Website` repo's `/log`. This captured most of the
interview value for a fraction of the 8–14 hours a merge would have cost — which is the whole point
of the paragraph above.

## The tension this creates with the tier rule

Merging Puzzle Lab contradicts the tier rule, which assigns **Large** projects their own repo and
deployment. Both can't stand unamended. The reconciliation that seems right:

> The tier rule is correct about **URLs** and about **Small** projects. Its *deployment* prescription
> for Large was written before anyone had paid the multi-zone cost twice. One Large project does not
> need its own deployment; **two might**.

Left as an open question rather than silently rewritten, because it is the hub's rule, not this
repo's.

## Triggers to revisit

1. A genuine **lull** (waiting on interview loops) → execute option (a) via the research's runbook.
2. A **second Large project** appears → at n=2 the calculus changes and a shared workspace package
   starts earning its keep.
3. The **shared account system** in `Web_Presence_Plan_v2.md` becomes a plan rather than a sentence
   → cross-zone sessions are the same class of problem that produced the better-auth `basePath` bug;
   in one app it is free.
4. Puzzle Lab becomes a **product** → single-app simplification becomes worth prioritising, and
   Vercel Hobby's non-commercial Fair Use terms would force a plan change anyway.
5. A **third** production incident from this seam. Two is a pattern forming; three is a pattern.

## Cheap hardening worth doing regardless

- The `puzzles-redirect` project is still a separate Vercel deployment, though the hub already
  absorbed that 301 into its own `redirects()` (dormant until `puzzles.biscuitlab.net` points at the
  hub project). Finishing that removes a moving part for free.
- Per-page `<link rel="canonical">` is still missing, and it is the actual mitigation for the
  duplicate-origin risk `origin-puzzles.biscuitlab.net` creates today — a risk that exists whether or
  not anything merges.

## Two rules to carry into any future merge

- **Never remove the `puzzles.biscuitlab.net` 301.**
- **Never touch cron during the merge** — verify the GitHub Action still fires against the new setup
  *before* removing anything.
