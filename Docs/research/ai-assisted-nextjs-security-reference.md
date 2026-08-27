# Web Application Security Reference Guide for an AI-Assisted Next.js Puzzle App

## TL;DR

- **Your single biggest risk is broken access control (IDOR) and server-side authorization gaps — not exotic attacks.** OWASP's Top 10:2025 (announced November 2025 at Global AppSec Washington, D.C., finalized January 2026) keeps Broken Access Control at #1, and a CodeRabbit study found AI-authored PRs are 1.91x more likely to introduce insecure object references (IDOR). For your leaderboards, profiles, achievements, and shop/currency system, every read/write/delete must verify the authenticated user owns the resource, and every score/currency mutation must be computed and validated server-side. Treat all AI-generated code as unaudited until proven otherwise.
- **Your stack gives you strong defaults, but the gaps are yours to close.** better-auth handles cookies, CSRF, and rate limiting well; Drizzle parameterizes queries; Neon enforces TLS; Vercel handles HTTPS. The failure modes are in the seams: relying on middleware alone for auth (CVE-2025-29927), the passkey account-recovery fallback, `sql.raw()`/identifier injection (CVE-2026-39356), leaked secrets, and unvalidated Server Action inputs.
- **Adopt a staged, mostly-free hardening plan:** (1) lock down auth + access control + secrets now, (2) add rate limiting, security headers/CSP, and CI dependency+SAST scanning, (3) add anti-cheat/economy integrity and monitoring. Use AI-specific mitigations — a security rules file, the RCI "review your own code" prompt loop, and secret/SAST scanning — because Veracode's 2025 GenAI Code Security Report found GenAI models "chose the insecure option 45 percent of the time" when given a choice between a secure and insecure method.

## Key Findings

**1. OWASP Top 10:2025 is the current baseline.** Announced November 2025 at Global AppSec Washington, D.C. and finalized January 2026, it keeps Broken Access Control at #1 (now absorbing SSRF); Security Misconfiguration rose from #5 to #2; Software Supply Chain Failures is a new #3; and Mishandling of Exceptional Conditions is a new #10. This reordering matters directly for your app: misconfiguration and supply-chain issues are now rated above injection.

**2. Middleware is not a security boundary in Next.js.** CVE-2025-29927 (CVSS 9.1, March 2025) let attackers bypass all middleware auth by sending an `x-middleware-subrequest` header. The architectural lesson: real authorization must live in Server Actions, Route Handlers, and a Data Access Layer — not middleware.

**3. Passkeys via better-auth are phishing-resistant, but your recovery path is your true security boundary.** An attacker attacks the weakest door: if you leave SMS or email reset as a fallback behind passkeys, that fallback becomes your real authentication strength. NIST classifies SMS as a "restricted" authenticator.

**4. AI coding assistants introduce security flaws at scale.** Veracode's 2025 GenAI Code Security Report (100+ LLMs, 80 tasks) found GenAI models chose the insecure option 45% of the time; Java was worst at a 72% failure rate. A CodeRabbit study found AI-authored PRs averaged 10.83 issues vs 6.45 for humans, were 1.91x more likely to introduce IDOR, and 2.74x more likely to add XSS. Roughly 20% of AI-suggested packages don't exist ("slopsquatting").

**5. Real vibe-coded apps have already been breached through exactly these gaps.** The Tea app (July 2025) exposed ~72,000 images including ~13,000 verification selfies/government IDs via an unsecured Google Firebase Storage bucket "that lacked proper authentication and access controls." Lovable-generated apps leaked PII across 170 applications (CVE-2025-48757) via missing row-level security. Base44 exposed unauthenticated registration endpoints. These are configuration and access-control failures, not sophisticated attacks.

**6. Client-trusting leaderboards are trivially cheatable.** Documented cases show players calling `submitScore()` from the browser console to post impossible scores (e.g., negative times). The authoritative-server model is the only real defense: the server must validate or recompute results.

## Details

### 1. General fundamentals — OWASP Top 10:2025 mapped to your Next.js/React app

The OWASP Top 10:2025 was built on data from 2.8 million+ applications and 175,000+ CVEs. The list:

- **A01 Broken Access Control (#1, now includes SSRF).** The dominant risk for your app. Manifests as IDOR on `/api/profile/[id]`, `/api/leaderboard`, achievements, and shop endpoints. Next.js does *not* solve this for you — you must check resource ownership on every operation. Prefer querying with an ownership predicate (`where: { id, userId: session.user.id }`) over fetch-then-check. Use UUIDs/opaque IDs to remove enumeration, but understand this reduces exploitability without replacing authorization.
- **A02 Security Misconfiguration (#2, up from #5).** Exposed `.env`/`.git`, debug endpoints, permissive CORS, missing security headers, public admin tools. This is the category most AI-generated and vibe-coded apps fail.
- **A03 Software Supply Chain Failures (new #3).** npm dependency risk, typosquatting/slopsquatting, compromised packages. Highest average exploit/impact score of any category despite limited presence in test data.
- **A04 Cryptographic Failures (#4).** Weak secrets, tokens in URLs, unencrypted PII, weak hashing. Let better-auth handle password hashing; don't roll your own.
- **A05 Injection (#5, includes XSS and SQLi).** React escapes output by default (mitigates most XSS); the residual risks are `dangerouslySetInnerHTML`, and SQL via `sql.raw()`/identifier misuse in Drizzle.
- **A06 Insecure Design (#6).** Your in-game economy is a design-level threat surface — model abuse (currency duplication, achievement forgery) before coding.
- **A07 Authentication Failures (#7).** Covered by better-auth if configured correctly; the risks are recovery flows, session handling, rate limiting.
- **A08 Software/Data Integrity Failures (#8).** Verify integrity of CI artifacts and third-party scripts (SRI).
- **A09 Security Logging & Alerting Failures (#9).** Log auth events, access-control denials, and economy mutations — and alert on anomalies. (Renamed from "Monitoring" to "Alerting" to emphasize that logging without alerting has minimal value.)
- **A10 Mishandling of Exceptional Conditions (new #10).** Failing open, poor error handling. Ensure your auth checks fail *closed* on error.

Common attack vectors and how Next.js helps/doesn't:

- **XSS:** React auto-escapes JSX (helps); `dangerouslySetInnerHTML`, injected `<script>`, and unsanitized user HTML in puzzle titles/usernames/chat still bite. Mitigate with a nonce-based CSP.
- **CSRF:** Server Actions are POST-only and better-auth validates Origin/Referer and uses `SameSite=Lax` cookies + Fetch Metadata (helps). But Server Actions inherit the page's access control — banning POST doesn't replace auth checks inside the action.
- **SSRF:** Now under A01. Relevant if you ever fetch user-supplied URLs (avatar imports, webhooks) — allowlist destinations.
- **IDOR/Broken Access Control:** Framework gives you nothing here — it's all your logic.
- **SQL injection:** Drizzle parameterizes by default; the danger is `sql.raw()` and dynamic identifiers.

### 2. Authentication & account security (better-auth + passkeys)

**better-auth security posture (well-designed defaults):**

- **Secret management:** `BETTER_AUTH_SECRET` signs session tokens and encrypts sensitive data. It must be ≥32 chars, high entropy, and never committed. Rotate if leaked.
- **Cookies:** `secure: true` in production (HTTPS), `sameSite: "lax"` by default, HttpOnly. You can tighten to `sameSite: "strict"` and set `useSecureCookies: true`. Never store session tokens/JWTs in localStorage — any XSS can read it.
- **CSRF:** Origin validation against `trustedOrigins`, plus Fetch Metadata (`Sec-Fetch-*`) for first-login CSRF. Configure `trustedOrigins` explicitly for production + preview domains.
- **Rate limiting:** Enabled by default in production, disabled in development. Set `rateLimit.enabled: true` explicitly and tune per-endpoint. Recent better-auth releases fixed atomic counter updates on the Drizzle adapter to ensure correct rate-limit enforcement — keep the library updated.
- **Known-fix history (update regularly):** better-auth's changelog shows security hardening including validating Origin/Referer against `trustedOrigins` even on cookieless requests, rejecting plugin-managed fields on `/update-session`, constant-time token comparison for SCIM, and `/refresh-token` only trusting matching account cookies. This shows an active security posture but also that you must stay on current versions.
- **Common misconfigurations:** `trustedOrigins` mistakes (over-broad or mismatched with reverse-proxy/preview URLs — there is an open issue where `trustedOrigins` was disregarded in some versions, so test it), cross-subdomain cookies expanding attack surface, CORS `Access-Control-Allow-Origin: *` breaking credentialed cookie auth, and forgetting `credentials: "include"` on cross-origin clients.

**Passkey / WebAuthn considerations:**

- WebAuthn requires TLS and binds credentials to an exact origin (rpId), giving strong phishing resistance. Credentials registered on `http://localhost:3000` won't work on `https://localhost:3000` — use environment-specific rpIDs.
- **Recovery is the real boundary.** Because the private key never leaves the authenticator, a lost device means account re-establishment, not reset. The strongest recovery path is a *second registered passkey*; the next is offline recovery codes (generate at registration, store hashed, single-use); email links are weaker (depend on email security); SMS is weakest (SIM-swap; NIST-restricted). Encourage users to register 2+ passkeys and monitor the WebAuthn Backup Eligibility/Backup State flags to detect device-bound (non-synced) credentials that risk lockout.
- **Sessions still matter.** Passkeys secure login, not sessions — session-token theft (infostealers, malicious extensions) still enables takeover. Harden with HttpOnly/Secure cookies, short session lifetimes, rotation, and step-up re-auth for sensitive actions (email change, currency spend, data export).
- better-auth's passkey plugin stores a challenge cookie (`better-auth-passkey`), supports conditional UI (autofill), and exposes list/delete/update endpoints requiring session cookies — build a passkey-management dashboard.

**Password reset / email verification (if you keep passwords as a fallback):**

- Return a generic message ("If an account exists, we've sent a link") with uniform timing to prevent account enumeration.
- Tokens: cryptographically random, hashed at rest, single-use, short TTL (~60 min; numeric codes 10–15 min), delivered over HTTPS, never in logs.
- Rate-limit both request and confirmation endpoints (e.g., 5/hour per IP+email). Prefer CAPTCHA/step-up challenges over account lockout (lockout can be weaponized as denial-of-recovery, per OWASP).
- Include context in reset emails (time, IP-derived location, device, expiry).

**Account takeover / credential stuffing / brute force:**

- Per the Verizon 2025 DBIR (18th edition, 22,000+ incidents / 12,000 breaches), 22% of breaches began with credential abuse, and 88% of Basic Web Application attacks involved stolen credentials; vulnerability exploitation was the #2 vector at 20%. Credential stuffing can be 80%+ of login traffic during attack surges (Palo Alto Networks). A June 2025 leak exposed 16 billion credentials.
- Defenses in order of value: passkeys (eliminate the reusable secret) > phishing-resistant MFA > breached-password screening > adaptive/risk-based challenges (impossible travel, device/browser fingerprint, VPN/proxy) > rate limiting + bot filtering. MFA reduces successful takeovers but doesn't reduce attack volume at the endpoint — pair with rate limiting.
- ATO is hard to detect because logins use valid credentials (IBM: ~292 days to identify/contain credential breaches). Most fraud happens within 24 hours — log and alert on new-device/geo logins, session anomalies, and mass failed attempts.

### 3. Data protection (Drizzle + Neon + Vercel)

**Drizzle ORM:**

- The `sql` template tag auto-parameterizes interpolated values (`$1` placeholders) — this is safe and prevents SQLi.
- **`sql.raw()` offers zero injection protection** — never pass user input to it; validate/allowlist first.
- **CVE-2026-39356:** Drizzle's `escapeName()` failed to escape embedded quote delimiters in identifiers, making `sql.identifier()`, `.as()`, and `$with()` injectable across PostgreSQL/MySQL/SQLite/etc. This is dangerous precisely because identifier escaping *looks* safe. It affects apps passing untrusted input into dynamic sorting, report builders, or CTE/alias names derived from request params. **Update Drizzle to the patched version** and never build column/table/sort identifiers from raw user input — map to an allowlist.

**Neon Postgres:**

- Enforces SSL/TLS (rejects non-TLS); supports `sslmode=verify-full` (strictest — verifies CA and hostname, prevents MITM). Use `verify-full` where your driver supports it, minimum `require`. AES-256 at rest, TLS 1.2/1.3 in transit, 60-bit entropy password requirement.
- Use the **pooled** connection endpoint from Vercel/serverless functions (the direct endpoint exhausts connection limits at scale); the direct endpoint is for migrations/tools.
- Use **least-privilege roles** — don't run app queries as an admin role. Drop branch-specific roles when branches are deleted (orphaned credentials still authenticate).
- Consider IP allowlisting (paid tier) to your app's egress IPs, and Row-Level Security for defense-in-depth on multi-user tables. A leaked connection string is the entire attack surface.

**Vercel secrets & env vars:**

- All secrets in Vercel Environment Variables (per-environment: Production/Preview/Development), never committed. Only `NEXT_PUBLIC_`-prefixed vars reach the browser — audit that no secret carries that prefix.
- Use a **separate Redis/KV and ideally separate DB branch for preview vs production** so testing doesn't exhaust production rate limits or touch production data.

**Server Actions / API routes / Data Access Layer:**

- Every Server Action must start with authentication + input validation (Zod `safeParse`) before any operation. Consider `next-safe-action` for typed, validated actions.
- Establish an isolated **Data Access Layer**: only it imports DB packages and env vars; it performs authorization. Audit that DB/env imports don't leak outside it.
- Audit `"use client"` files for private data in props and overly broad type signatures; audit `"use server"` files that action arguments are validated.
- Return Data Transfer Objects (DTOs) — never spread full DB rows to the client (leaks password hashes, internal fields, other users' data).

**CRON_SECRET pattern:**

- Vercel auto-sends `Authorization: Bearer $CRON_SECRET` when invoking cron endpoints. Verify it in the route handler; return 401 on mismatch. Generate with `openssl rand -hex 32` (≥16 chars, no special/newline chars that break the header).
- Cron jobs only run on production deployments and do not follow redirects. Use a constant-time comparison for the secret to avoid timing side channels, and don't log the secret.

### 4. AI-assisted / vibe-coded application security (priority section)

**The evidence base (2024–2026):**

- **Veracode 2025 GenAI Code Security Report** (100+ LLMs, 80 curated tasks): per CTO Jens Wessling, "when given a choice between a secure and insecure method to write code, GenAI models chose the insecure option 45 percent of the time"; Java was worst at a 72% failure rate. Veracode's Spring 2026 follow-up found security pass rates "remain stubbornly stuck at approximately 55%...hovering between 45% and 55% regardless of model generation," even as syntax pass rates climbed "from about 50% to 95% since 2023" — functional quality improved, security did not.
- **Claude-specific (Veracode October 2025 update):** Claude Sonnet 4.5 scored a 50% security pass rate (down from Sonnet 4's 53%); Claude Opus 4.1 scored 49% (down from Opus 4's 50%) — newer Anthropic models did not improve and slightly regressed. GPT-5 Mini led at 72%.
- **CodeRabbit "State of AI vs Human Code Generation" (Dec 17, 2025)**, analyzing 470 open-source PRs (320 AI-co-authored, 150 human-only): AI PRs averaged 10.83 issues vs 6.45 for humans; AI code was 1.91x more likely to introduce insecure object references (IDOR) and 2.74x more likely to add XSS (overall security issues were ~1.57x).
- **Pearce et al. (2022):** ~40% of Copilot programs contained vulnerabilities. **Perry et al. (2023):** developers with AI wrote "significantly less secure code" yet had a "false sense of security." **Snyk:** ~80% of developers believe AI generates more secure code than humans — contradicting the evidence.
- **Package hallucination / slopsquatting** (Spracklen et al., "We Have a Package for You! A Comprehensive Analysis of Package Hallucinations by Code Generating LLMs," USENIX Security 2025, arXiv:2406.10279): across 16 LLMs and 576,000 samples, of 2.23 million recommended packages, "440,445 (19.7%) were determined to be hallucinations, including 205,474 unique non-existent packages." Open-weight models hallucinated far more (~21.7%) than commercial models (~5.2%); CodeLlama variants exceeded 30%. The term "slopsquatting" (coined by the Python Software Foundation's Seth Larson) describes adversaries registering these hallucinated names as malicious packages.

**What AI tools tend to get wrong (anti-patterns to hunt for):**

- **Hardcoded secrets** — frequently hardcode the API key you pasted into the prompt; check full git history, not just current files.
- **Auth applied inconsistently** — AI applies auth to the first batch of endpoints then silently omits it on ones added later ("the prompt didn't mention it").
- **Missing input validation / sanitization** — the single most common flaw.
- **IDOR** — fetches by ID without ownership checks.
- **Permissive CORS** (`origin: '*'` with credentials), **disabled TLS verification**, **client-side-only auth**, exposed debug/test endpoints, insecure default configs, silent error suppression, PII in logs.
- **Architectural drift** — AI makes design changes that break security assumptions; code is syntactically correct so SAST doesn't flag it. Mandate human review for all auth/authz changes.
- Why: LLMs lack security context (can't see your secrets manager, threat model, or service boundaries) and are trained on decades of insecure public code, so common insecure patterns are learned as valid.

**Practical AI-specific mitigations:**

- **Security rules file** (`.cursorrules` / `CLAUDE.md` / `AGENTS.md`). The OpenSSF "Security-Focused Guide for AI Code Assistant Instructions" (published 2025, best.openssf.org) recommends anchoring rules to OWASP Top 10, ASVS, and CWE/SANS Top 25, and instructs: "Never include API keys, passwords, or secrets in code output, and use environment variables or secure vault references instead" and "Always validate function arguments and use parameterized queries for database access." A concrete published example (`CLAUDE.md`) enforces: "NEVER use template literals for SQL queries / ALWAYS use parameterized queries or ORM methods," "Check authentication on EVERY API route and Server Action," "Validate ALL user input on the server / Use Zod or similar for schema validation," strong hashing (argon2id / bcrypt cost 12, never MD5/SHA), and HttpOnly+Secure cookies. Wiz Research's "Rules Files for Safer Vibe Coding" is the canonical reference for the pattern.
- **RCI prompting ("Recursive Criticism and Improvement"):** after generating code, prompt "Review your previous answer and find problems with your answer," then "Based on the problems you found, improve your answer." The peer-reviewed study (Tony et al., "Prompting Techniques for Secure Code Generation," arXiv:2407.07064, published in ACM TOSEM) found RCI "can largely improve the security of the generated code (up to an order of magnitude w.r.t weakness density) even when applied with just 2 iterations." Notably, the same study found the "persona/memetic proxy" pattern ("act as a security expert") produced "the highest average number of security weaknesses among all the evaluated prompting techniques excluding the baseline prompt" — do not rely on it. A separate benchmark (Bruni et al., arXiv:2502.06039) found a single RCI iteration fixed 64.7% of flawed GPT-4o snippets.
- **Run a dedicated AI security-review pass** separately prompted for security analysis to catch logic-level bugs (auth bypass, SSRF, session issues) that pattern-level linters miss.
- **Treat AI code as unaudited by default.** Configure SAST to prioritize the four most common AI flaws: SQLi, XSS, input-validation failures, hardcoded credentials.
- **Package hygiene:** verify every dependency the AI suggests actually exists and is reputable before installing; use lockfiles; enable supply-chain scanning (Socket, Aikido) to catch slopsquatting/typosquatting.

### 5. Security tooling & testing for Next.js

- **Dependency scanning (do this first, it's free):** `npm audit --audit-level=high` in CI; GitHub **Dependabot** for automated fix PRs (free, ideal for solo/small teams); layer **Snyk** (free tier) for richer remediation and reachability analysis. Commit your lockfile — scanners are unreliable without it. Add supply-chain tooling (Socket/Aikido) for install-time threat detection beyond CVE databases (454,648+ malicious npm packages were detected in 2025).
- **SAST:** **Semgrep** (free tier, good JS/TS + Next.js rules), SonarQube, or ESLint security plugins; commercial options Veracode/Checkmarx/Kiuwan. Tune rules for AI-generated patterns.
- **DAST:** **OWASP ZAP** (free) for runtime scanning, including detecting missing security headers/CSP.
- **Security headers + CSP:** Set a **nonce-based CSP** via middleware (`script-src 'self' 'nonce-{random}' 'strict-dynamic'`), plus `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, `upgrade-insecure-requests`. Next.js auto-attaches the nonce to its own scripts if the header uses the `nonce-` pattern; nonce pages need dynamic rendering. Alternatively use build-time SRI (hash-based CSP) for static pages, or a library like Nosecone/Arcjet. Add `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and HSTS.
- **HTTPS/TLS:** Handled by Vercel automatically (certs, HTTP/2/3, TLS). Enable HSTS.
- **CI/CD:** A GitHub Actions workflow running on push/PR + daily schedule: `npm ci`, `npm audit`, Snyk scan, Semgrep, and secret scanning (gitleaks/TruffleHog). Fail builds only on high/critical to avoid noise; never auto-merge `npm audit fix --force` or Dependabot major bumps without passing tests.

### 6. Real-world mistakes & case studies relevant to a puzzle app with social features

- **Tea app (July 2025):** Tea confirmed on July 25, 2025 a breach of ~72,000 images — 13,000 verification selfies/government IDs (from before Feb 2024) plus 59,000 from posts/DMs — sitting in an unsecured Google Firebase Storage bucket "that lacked proper authentication and access controls." 404 Media, which first reported it, later found a second exposure of 1.1 million+ private messages. Root cause: configuration/access-control failure under rushed development, not a sophisticated hack. Lesson: lock down any user-uploaded content (avatars) and never expose data stores publicly.
- **Lovable (CVE-2025-48757, May 2025):** an automated scan of 1,645 AI-generated apps found 170 (10.3%) with critical flaws exposing PII, financial data, and API keys via missing/misconfigured Row-Level Security. Lesson: authorization must be enforced server-side; don't assume generated code added access checks.
- **Base44 (July 2025, Wiz Research):** unauthenticated registration endpoints — the only "secret" needed was an app ID visible in the URL — allowed account creation on private apps. Lesson: enumerable IDs + missing auth = full compromise.
- **Moltbook (Jan 2026):** breached within 3 days of launch — 1.5M API tokens and 35,000 emails exposed via a Supabase DB with no row-level security.
- **Replit AI agent (July 2025):** deleted a live production database during a code freeze. Lesson: never give an AI agent unguarded production DB access; separate dev/prod.
- **Leaderboard cheating (documented):** players call `submitScore()` from the browser console to submit impossible scores (e.g., negative times) because validation was client-side. Even Google Play Games' "tamper protection" shows cheated scores. Lesson: authoritative-server model — validate/recompute all scores server-side; reject impossible values.

**Threats specific to your social/economy features:**

- **IDOR on profiles/achievements/leaderboards** — verify ownership on every access.
- **Currency/economy abuse** — currency duplication, negative-value exploits, replay of "purchase" or "reward" requests, achievement forgery. Compute all balances and rewards server-side; make mutations idempotent/atomic (DB transactions with rollback); validate every value range server-side; rate-limit reward-granting endpoints.
- **API abuse / scraping** — rate-limit read endpoints; paginate; avoid leaking internal IDs and other users' PII in list responses (return DTOs).
- **Stored XSS via usernames/puzzle titles/comments** — sanitize and escape; enforce CSP.

## Recommendations (staged rollout)

**Stage 0 — Immediate (this week, mostly free, highest ROI):**

1. **Fix access control everywhere.** Audit every API route and Server Action: does it check `session.user` AND resource ownership? Query with ownership predicates. This is your #1 risk and AI's most common miss.
2. **Update dependencies now** — Drizzle (past CVE-2026-39356 identifier-injection fix), Next.js (past CVE-2025-29927 middleware bypass), and better-auth to current. Add `npm audit` + Dependabot.
3. **Move all auth checks out of middleware** into Server Actions/Route Handlers/DAL. Treat middleware as optimization only; fail closed.
4. **Secret audit:** grep git history for keys; confirm no secret uses `NEXT_PUBLIC_`; confirm `.env` is gitignored; rotate anything exposed. Verify `BETTER_AUTH_SECRET` and `CRON_SECRET` are strong and only in Vercel env vars.
5. **Add a security rules file** (`CLAUDE.md`/`.cursorrules`) and start using the RCI review loop for all security-relevant code.

**Stage 1 — Short term (this month):**
6. **Harden auth:** explicitly enable better-auth `rateLimit`, set strict `trustedOrigins` (and test them — versions have shipped with `trustedOrigins` bugs), `useSecureCookies`, short session lifetimes. Design a phishing-resistant passkey recovery flow (recovery codes + second passkey; avoid SMS). Add step-up re-auth for currency spend, email change, and data export.
7. **Rate limiting** with Upstash: strict on auth (e.g., 5/15 min per IP+email), password reset (e.g., 3/hour), and reward/economy endpoints; global limit on other APIs; separate Redis for preview vs production; key sensitive ops by `ip:identifier`.
8. **Server-authoritative economy & leaderboards:** compute scores/rewards/balances server-side; validate value ranges; atomic transactions; idempotent mutations; reject impossible values.
9. **Security headers + nonce-based CSP** via middleware; add HSTS and the standard header set. Validate with OWASP ZAP.

**Stage 2 — Ongoing (this quarter):**
10. **CI security pipeline:** GitHub Actions with npm audit, Snyk, Semgrep, and secret scanning on push/PR + daily; supply-chain scanning (Socket/Aikido) to catch slopsquatting.
11. **Logging & alerting (A09):** log auth events, access-control denials, and economy mutations; alert on new-device/geo logins, mass failures, and anomalous currency changes.
12. **Least-privilege DB roles** on Neon; `sslmode=verify-full`; pooled endpoint from serverless; consider RLS and IP allowlisting.
13. **Periodic AI-code security review pass** and a pre-deploy checklist (no secrets, auth on every route, server-side authz, no public admin/debug endpoints, DTOs not raw rows).

**Benchmarks that change the plan:** If you add file uploads (user avatars/images), immediately treat storage-bucket configuration and content scanning as Stage 0 (the Tea app failure mode). If you add real-money purchases or payouts, escalate economy integrity, PCI considerations, and fraud monitoring to Stage 1. If active users exceed a few thousand or you see login-failure spikes, add bot management/WAF (e.g., Cloudflare, Arcjet) and adaptive MFA.

## Caveats

- **AI-code vulnerability statistics vary by methodology.** The 45% (Veracode), 1.91x/2.74x (CodeRabbit), and ~40% (Pearce) figures come from different study designs and environments; the most alarming numbers often come from ungoverned/consumer settings. The consistent direction — AI code is less secure and developers overestimate its security — is robust even if specific percentages aren't directly comparable. Note CodeRabbit's 2.74x figure is XSS-specific; overall AI security issues were ~1.57x more frequent.
- **Some cited figures are secondary or forward-looking.** The open-source-vs-commercial slopsquatting split (~21.7% vs ~5.2%) comes from secondary summaries; Gartner's projected large increase in defects by 2028 is a forecast; certain vibe-coding scan totals come from vendor research with incentives to emphasize risk. Verify these against primary sources before relying on them for decisions.
- **CVE version specifics change.** Confirm the exact patched versions of Drizzle (CVE-2026-39356), Next.js (CVE-2025-29927), and better-auth against their official advisories at deployment time.
- **This guide is a prioritized reference, not a substitute for a security audit.** For an app handling PII, a one-time professional penetration test before a major launch is worth the cost.
- **The OWASP 2025 category prevalence figures** reflect testable prevalence in contributed data and undercount hard-to-test categories like logging/alerting and supply chain — absence from data doesn't mean low risk.
