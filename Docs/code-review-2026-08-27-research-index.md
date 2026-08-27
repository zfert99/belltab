# Code review — 2026-08-27, commit `3f709dc` (the research library)

Review of `3f709dc` *"docs: add the research library and an index that says what
it is"* against `13e2473`. Both `git diff origin/main...HEAD` and `git diff HEAD`
were empty at review time — `main` was clean and already pushed — so the review
target was `HEAD~1`.

The commit is docs-only: 19 research documents copied from the Puzzle Lab and
Biscuit Lab hub repos, plus `Docs/research/index.md`, plus a build-log entry.
No code changed, so every finding is a documentation-correctness issue rather
than a runtime bug — but the failure mode is the same one the index was written
to prevent, which is what makes them worth a document instead of a shrug.

Effort: `high`. Seven findings, one more found while fixing. **All eight fixed
the same day.**

---

## Summary

| # | Where | Severity | Finding | State |
| --- | --- | --- | --- | --- |
| 1 | `Docs/research/index.md:29` | High | `ai-assisted-nextjs-security-reference.md` filed as "safe to apply here" with no caveat; its own H1 says "Puzzle App" and its plan is auth, rate limiting and a database | Fixed |
| 2 | `Docs/research/index.md:30` | High | `solo-dev-ai-qa-code-review-playbook.md` is subtitled "A Playbook for Puzzle Lab" and prescribes a Drizzle/Postgres CI gate; no caveat | Fixed |
| 3 | `Docs/research/multi-zone-migration-safety-review.md:46` | Medium | Dead link `../../src/lib/rate-limit.md` — the sourcing for a claim the doc marks VERIFIED | Fixed |
| 4 | `Docs/research/multi-zone-cost-and-alternatives.md:5,52,97` | Medium | Three dead links to two documents that were never copied — the doc's two hardest-leaning sources | Fixed |
| 5 | `Docs/build-log.md:2731` | Medium | Session log entry added, but no **Decisions** row and no **Open gaps** row, on a change that was almost entirely a *why* | Fixed |
| 6 | `Docs/research/index.md:27` | Low | `nextjs-performance.md` says "Written for the puzzle app" under a heading that says "safe to apply here"; its TL;DR recommends Upstash/Vercel KV and a Neon connection method | Fixed |
| 7 | `Docs/research/index.md:24` | Low | `testing-mobile-responsiveness-locally.md` un-caveated, but its central HTTPS-tunnel recommendation exists only because better-auth passkeys need a secure context | Fixed |
| 8 | `Docs/research/index.md:25-26` | Low | Found while fixing: `web-best-practices.md` and `enterprise-architecture.md` both recommend feature-folder architecture, which `AGENTS.md` bans | Fixed |

---

## The through-line

The index's stated purpose is to preserve provenance — *"which repo each
document is actually about"* — and for the third table it does that well. Each
row there names the specific thing that does not travel, and the
`eslint10-ts7-upgrade-blockers.md` row is a model of it: the conclusion
transfers, the figures do not, and it says which figures.

The second table did the opposite. Its heading promised **"general, and safe to
apply here"**, and then listed five documents whose own H1s say *Puzzle App* or
*Puzzle Lab*, four of them with no caveat at all. That is worse than an
un-indexed directory: an index that vouches for a document is read as having
checked it. The largest of the five,
`ai-assisted-nextjs-security-reference.md`, is exactly the eslint10 trap at
larger scale — a confident, sourced, well-written security plan for a stack
BellTab deliberately does not have.

None of the eight findings is a claim that a document is wrong. They are all the
same shape: a document that is right about its own repo, filed here in a way
that does not say so.

---

## 1. `ai-assisted-nextjs-security-reference.md` is filed as safe with no caveat

**Where:** `Docs/research/index.md:29`, describing
`Docs/research/ai-assisted-nextjs-security-reference.md:1`.

The row read, in full:

> | ai-assisted-nextjs-security-reference.md | Security for an AI-assisted Next.js app. |

The document's own first line is:

> `# Web Application Security Reference Guide for an AI-Assisted Next.js Puzzle App`

Its TL;DR names better-auth, Drizzle, Neon, Upstash, passkey account recovery
and Server Action validation, and its staged hardening plan is: lock down auth
and access control, add rate limiting, add anti-cheat and economy integrity.
`Docs/belltab-plan.md` §2 rules out **a backend of any kind**, **accounts, auth,
database** as decided non-goals — reopening one requires a research doc.

The risk is not that someone builds auth by accident. It is that a future
session reads a sourced, current, OWASP-citing security reference filed under
"safe to apply here" and concludes the repo's security posture is unfinished
because it has no access control — when having nothing to control access to is
the design.

**What does transfer, and is now named in the row:** the OWASP Top 10:2025
reordering, the security-headers baseline, the middleware-is-not-an-auth-boundary
warning (CVE-2025-29927, which `AGENTS.md` already cites), and "treat
AI-generated code as unaudited until proven otherwise".

**Fixed by** adding a *Watch out for* column to the second table and filling this
row with the non-goal list and the transferable four.

---

## 2. `solo-dev-ai-qa-code-review-playbook.md` is Puzzle Lab's playbook

**Where:** `Docs/research/index.md:30`, describing
`Docs/research/solo-dev-ai-qa-code-review-playbook.md:1`.

Its H1 ends *"— A Playbook for Puzzle Lab"*, and its own preamble records that
it was imported into **that** repo on 2026-07-31 to inform **that** repo's
pre-merge checklist. Line 182 specifies the CI gate as
*"Next.js + TS + Drizzle + Postgres"*; line 210 requires `drizzle-kit generate`
over `push`; line 290 names migration review *"a mandatory manual step"*. BellTab has no ORM, no
database and no migrations, so a third of the prescribed gate is unbuildable
here — and the third that is missing is the third that would look like
negligence to anyone auditing against the playbook.

**Fixed by** the same caveat column, naming the Drizzle-specific parts and
recording that the process half — squash-merge PRs even solo, mechanical gates
over ceremony, AI review — is what this repo actually adopted.

---

## 3. A VERIFIED claim whose evidence is a dead link

**Where:** `Docs/research/multi-zone-migration-safety-review.md:46`.

```markdown
Full method and numbers in [`rate-limit.md`](../../src/lib/rate-limit.md).
```

From `Docs/research/`, `../../src/lib/rate-limit.md` resolves to
`src/lib/rate-limit.md` at this repo's root. That file does not exist here and
cannot: BellTab has no `/api`, no rate limiter and no server to limit. The file
is real — it is in the Puzzle Lab repo — but the link was written relative to a
tree this document no longer lives in.

The sentence it terminates is the sourcing for finding (e), which the document
marks **✅ VERIFIED 2026-08-05** with specific numbers: 12 sequential requests
giving `200`×10 then `429`, 12 concurrent giving exactly 10 successes. A
verified claim whose method is one click away is evidence. The same claim whose
method 404s is an assertion with a checkmark next to it.

**Fixed by** replacing the link with the plain sentence "Full method and
numbers in Puzzle Lab's `src/lib/rate-limit.md`, which was not copied into this
repo" — and by saying so in the index row, so the
limit of the evidence is visible before the document is opened.

---

## 4. Three more dead links, in the doc that leans hardest on them

**Where:** `Docs/research/multi-zone-cost-and-alternatives.md:5`, `:52`, `:97`.

- Line 5 — the document's **Status** block — cites
  `puzzle-lab-hub-merge-research.md` as the commissioned research that
  *"corrected three things this doc originally got wrong"*.
- Lines 52 and 97 cite `vercel-cron-deployment-protection-outage.md`, the outage
  that prompted the whole decision and that its published write-up leads with.

Neither file was copied. This is the worst-placed instance of the four: the two
citations are the document's authority for reversing its own earlier position,
and they sit in the first paragraph a reader sees.

**Fixed by** the same de-linking treatment, and by naming both files in the index
row for that document.

---

## 5. The build-log entry recorded the *what* and not the *why*

**Where:** `Docs/build-log.md:2731` — the Session log entry — against
`AGENTS.md` → **The Build Log**.

The rule is four-part: a Session log entry, a **Decisions** row *"if a why was
involved"*, an **Open gaps** entry for anything knowingly unfinished, and a
**Bugs found** entry for anything that broke. The commit added the first only.
`## Decisions` still ended at line 237, on a change that was almost entirely a
*why* — the decision to copy nineteen documents in whole rather than cherry-pick
passages, and the decision to solve the resulting provenance problem with an
index rather than by editing the documents.

And four inherited dead links (findings 3 and 4) shipped in that commit as a
knowingly-imported defect with no **Open gaps** row.

**Fixed by** three Decisions rows and one Open gaps row, added with this session.
The gap is genuine even after findings 3 and 4 are fixed: de-linking removes the
broken link, not the fact that three pieces of cited evidence live in another
repo.

---

## 6. `nextjs-performance.md` — a caveat in the wrong column

**Where:** `Docs/research/index.md:27`.

The row said *"Written for the puzzle app"* — a caveat, in a table whose heading
said the opposite. Its TL;DR (line 6) recommends caching *"daily puzzles and
leaderboards in the Upstash/Vercel KV you already run"* and *"the correct Neon
connection method for Vercel"*; line 92 is Postgres index tuning. None of that
exists here.

Roughly half the document does apply, and it is the half that matters for a
static client-side app: keep the `'use client'` boundary narrow, `next/font`
self-hosted with `display: swap`, animate only `transform`/`opacity`. That split
is now what the row says.

---

## 7. `testing-mobile-responsiveness-locally.md` cites a premise we do not have

**Where:** `Docs/research/index.md:24`.

The document's central practical recommendation is to expose `next dev` through
an HTTPS tunnel (Cloudflare Tunnel or Tailscale Funnel) rather than a LAN IP.
Its stated reason, twice, is that *"your app uses better-auth passkeys
(WebAuthn), which require a secure context"*, so `http://192.168.x.x` fails.

BellTab has no auth, no service worker and no geolocation, so nothing on the
page needs a secure context. `next dev -H 0.0.0.0` plus a LAN IP in
`allowedDevOrigins` is sufficient — and materially cheaper than standing up a
tunnel. The document's *other* central claim (DevTools device mode is a viewport
spoof on Blink and can never be WebKit) applies here in full and is why the open
gap about WebKit coverage matters.

Followed as written, this one costs setup time rather than correctness — which
is why it is Low and not High.

**Fixed by** a row that names the passkey premise, says it does not hold here,
and gives the LAN-IP alternative with the `/bell` basePath reminder.

---

## 8. Found while fixing — two documents recommend an architecture `AGENTS.md` bans

**Where:** `Docs/research/index.md:25-26`, describing
`Docs/research/web-best-practices.md` and
`Docs/research/enterprise-architecture.md`.

Both were filed with no caveat because both are genuinely repo-agnostic — no
Puzzle Lab in the title, no Neon, no better-auth. But `web-best-practices.md`
argues that *"Modern architectural paradigms advocate for domain-driven
organization"*, and `enterprise-architecture.md` states that *"the feature-based
architectural pattern is universally recommended"*.

`AGENTS.md` → Architecture & Structure says the opposite, explicitly and as a
named AI pitfall: **"No feature folders yet. Do NOT introduce a `src/features/`
domain architecture. At this size that is premature fragmentation."**

This is the most dangerous kind of un-caveated row, because it is the kind an
agent acts on rather than merely cites: a repo-agnostic document, filed as
generally applicable, recommending precisely the refactor the repo rules forbid.
Both rows now name the conflict and state that `AGENTS.md` wins.

---

## The fix, in one shape

`Docs/research/index.md` grew a **Watch out for** column on its second table,
and the heading changed from *"general, and safe to apply here"* to *"general
advice"* with a preamble that says five of the eleven were written **for** the
puzzle app. Every row now carries a caveat — including the four that are
genuinely generic, where it reads *"Repo-agnostic"* plus whatever narrowing
applies.

That last part is deliberate and is the whole point: if only some rows have
caveats, a blank cell is ambiguous between "checked, nothing to say" and "not
looked at". Filling all eleven makes the column mean *we read this one*.

The two Puzzle-Lab-titled documents were **not** moved into the third table.
That table is for documents *about* another repo — a migration that happened
there, a sitemap that describes it. These are general advice *addressed to*
another repo, which is a different thing, and collapsing the distinction would
cost the third table the precision that makes it useful.

Four dead links became plain filenames with the owning repo named alongside, and
a closing section of the index records that convention and lists the three files
so nobody re-adds the links.

---

## Checked and cleared

Recorded so the same ground is not re-covered:

- **All 20 links in `index.md` resolve** to files that exist, before and after
  the change.
- **Every document in `Docs/research/` is indexed, and every indexed document
  exists** — checked both directions, no orphans either way.
- **Four dead links, not five.** Every non-`http` link in every research
  document was enumerated; the four in findings 3 and 4 were the complete set,
  and after the fix the enumeration is empty.
- **The three missing targets are real files in a real repo** —
  `Puzzle-Generator/Docs/research/puzzle-lab-hub-merge-research.md`,
  `.../vercel-cron-deployment-protection-outage.md` and
  `Puzzle-Generator/src/lib/rate-limit.md`. The citations were never fabricated;
  only the paths stopped resolving when the documents moved.
- **No credentials, connection strings or private URLs** in the copied
  documents. The one Google Docs URL, in the playbook's preamble, is the owner's
  own and was already public in the source repo.
- **The index's factual claims about BellTab hold:** TypeScript 6.0.3 per
  `package.json` and `npx tsc --version`, no Tailwind in the dependency tree.
- **`npx markdownlint-cli "Docs/**/*.md"` exits 0** before and after.
- **No code changed**, so `lint`, `typecheck`, `vitest` and `playwright` were
  unaffected — they were run anyway and pass: eslint clean, `tsc --noEmit`
  clean, 213/213 unit tests, 83 passed / 22 parked in Playwright.
