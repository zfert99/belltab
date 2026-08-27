# Safety, Security & Viability Review: Puzzle Lab Multi-Zone Migration on Vercel

## TL;DR

- **GO — with one mandatory change first.** Finish the multi-zone migration; you are one auth fix from done and the marginal cost to complete now is lower than any alternative. But **before** the auth fix, re-enable Vercel Deployment Protection and reach the Puzzle Lab origin through a **dedicated custom origin host** (e.g. `origin-puzzles.biscuitlab.net`) instead of the generated `*.vercel.app` alias.
- **Disabling Deployment Protection was the WRONG call and was UNNECESSARY (CORRECTION).** Vercel's Standard Protection, on every plan, *never* covers a custom production domain — only generated `*.vercel.app` URLs and previews. A custom origin hostname attached to the Puzzle Lab project would have been reachable by the hub's `rewrites()` proxy **with protection left fully enabled.** The current state (protection off) is tolerable for a few days but must be changed before public launch.
- **The better-auth root cause is confirmed, but the developer's proposed fix is only correct under one unverified assumption** — that Next.js 16 does *not* strip its `/puzzles` basePath from the URL the route handler sees. First-hand reports on Next 15 say it *does* strip. Run the 3-line request-logging test below before applying the fix; the correct server config flips depending on the result.

## Key Findings

1. **Standard Deployment Protection does not protect custom production domains on any plan.** Vercel's docs state Standard Protection "Protects all deployments except production domains. Available on all plans," and note that on Hobby "your production domain remains publicly accessible. To protect production domains, you need a Pro or Enterprise plan." Only the "All Deployments" scope (Pro/Enterprise) gates the production custom domain. The proxy failed because it pointed at a *generated* `*.vercel.app` production URL, which **is** covered by Standard Protection.
2. **The fix that preserves protection: a dedicated custom origin host.** Attach a second custom domain (e.g. `origin-puzzles.biscuitlab.net`) to the Puzzle Lab project and point the hub's rewrite at it. Custom domains are exempt from Standard Protection, so the transparent proxy reaches it while previews and the generated URL stay locked. Disabling protection entirely was not required.
3. **Protection Bypass for Automation would also work and is available on all plans.** The `x-vercel-protection-bypass` secret can be sent as a header or `?x-vercel-protection-bypass=` query parameter. A `rewrites()` destination can carry the query param, or Next middleware can add the header — but the query param leaks the secret into logs, so the custom-origin-host approach is cleaner.
4. **better-auth internals confirmed from source (v1.4–1.6, verified July 30 2026):** the session cookie `Path` is hard-coded to `"/"` (not scoped to basePath), so it is sent on all app pages and will **not** break `getSession`; `withPath(url, path)` returns the URL unchanged when it already contains a path (default `/api/auth` is *not* appended); and the router base path is literally `new URL(ctx.baseURL).pathname`.
5. **The developer's proposed better-auth config is internally consistent only if Next.js does not strip basePath before the handler.** GitHub issue #4715's author (Next 15.4.1) reports Next *strips* the prefix, so the handler sees `/api/auth/*` not `/puzzles/api/auth/*`. This is the pivotal empirical unknown.
6. **The separate `puzzles-redirect` project is unnecessary.** Attach `puzzles.biscuitlab.net` to the hub project and add a host-conditional `redirects()` rule; Vercel issues a 308 (SEO-equivalent to 301). No throwaway project needed.
7. **Cloudflare grey-cloud (DNS-only) at Cloudflare registrar is a fully supported, trouble-free Vercel configuration.** The "avoid Cloudflare" advice was about the orange-cloud reverse proxy. Leave it as-is; no transfer required.
8. **Vercel Microfrontends does not support `basePath`** ("Next.js applications that use basePath are not supported right now") and bills $250/project/month beyond the 2 included (2 projects + 50K routed requests/month are included on Hobby and Pro; routing overage is $2 per 1M requests). It would not have avoided the problem without a re-architecture.

## Details

### 1. Deployment Protection — was disabling it right, and what does it expose?

**What Deployment Protection covers (CONFIRMED, Vercel docs):**

- **Vercel Authentication** restricts access to Vercel team members (and Shareable-Link holders). This is the mechanism that 302-redirected the proxy to `vercel.com/sso-api`.
- **Password Protection** gates access behind a shared password (a paid add-on; runs at the edge before app code).
- **Scopes (verbatim from Vercel docs):** *Standard Protection* — "Protects all deployments except production domains. Available on all plans." *All Deployments* — "Protects all URLs, including production domains. Available on Pro and Enterprise plans." A legacy "Only Preview Deployments" scope also exists.

**Decisive correction:** The premise that "no dedicated origin host is needed" was wrong. Because the custom production domain is never covered by Standard Protection, assigning a dedicated custom hostname to the Puzzle Lab project (e.g. `origin-puzzles.biscuitlab.net`) yields a URL the hub's server-side `rewrites()` can reach **with Deployment Protection still fully enabled**. The generated `puzzle-generator-…vercel.app` alias failed precisely because generated production URLs *are* covered by Standard Protection — Vercel's Nov 2 2023 changelog states verbatim: "Migrating existing deployments to use Standard Protection will protect both preview and generated production URLs. Standard Protection restricts access to the production generated deployment URL." Disabling protection entirely was unnecessary and is the single change I'd reverse first.

**Why Trusted Sources/OIDC failed (CONFIRMED):** OIDC federation requires the *caller* to obtain and present a token. A transparent `rewrites()` proxy forwards the browser's request unchanged; it does not mint or attach an OIDC token, so the edge still challenges it. This diagnosis was correct.

**Can a `rewrites()` proxy legitimately pass Deployment Protection?** Yes, three supported ways:

- **Protection Bypass for Automation** (all plans): put `?x-vercel-protection-bypass=<secret>` on the rewrite destination, or add the `x-vercel-protection-bypass` header via `middleware`/`proxy`. Works at the edge. Downside: query-param form leaks the secret to logs and referrers (Vercel recommends the header).
- **Deployment Protection Exceptions** (for a specific domain) — makes one hostname public; effectively the same as the custom-origin-host approach.
- **A dedicated custom origin host** — the cleanest: no secret to rotate, protection stays on for everything else.

**Security assessment of the current state (protection OFF):**

- **(a) Duplicate-origin SEO — REAL risk, partially UNVERIFIABLE.** Vercel's KB confirms it sets `X-Robots-Tag: noindex` automatically on **preview** deployments and **outdated production** deployments, and that a custom production domain does **not** get the header. Whether the *current* production `*.vercel.app` alias reliably carries `noindex` on a **direct browser request** is not guaranteed: a practitioner (dandenney.com) documented that Vercel did **not** set `X-Robots-Tag` on direct browser hits to a production `*.vercel.app` URL, only on proxied requests, and could not get Vercel to confirm this as intended behavior. A separate July 2026 Vercel Community thread shows Google reporting `noindex` from an *outdated* deployment that the live domain no longer served — proving the header's presence is deployment-state-dependent and hard to reason about. **Because you cannot rely on the alias being noindexed, the exposed public alias is a genuine duplicate-content hazard**, worsened by the fact that Puzzle Lab currently emits **no** `<link rel="canonical">` tags. Mitigation: re-lock the alias (re-enable protection + custom origin host) and add per-page canonicals.
- **(b) Account/session creation directly against the origin — LIMITED risk.** better-auth performs Origin validation against `trustedOrigins` and adds Fetch-Metadata CSRF protection on sign-in/sign-up. If `trustedOrigins` lists only `https://biscuitlab.net`, requests bearing an origin of the `*.vercel.app` host are rejected. Residual risk: scripted no-Origin requests, but these hit the same rate limits and DB as the canonical host.
- **(c) Host-cookie leakage — NOT a real risk (CONFIRMED).** better-auth cookies are set with no `Domain` attribute unless `crossSubDomainCookies` is enabled, so they are host-scoped. A cookie set on `biscuitlab.net` is never sent to `*.vercel.app`. A parallel session could be *created* on the alias host, but it cannot inherit the apex session.
- **(d) Passkeys — GENUINELY protected by rpID (CONFIRMED).** With `rpID = biscuitlab.net`, the WebAuthn spec requires the rpID to be a registrable suffix of the current origin. `biscuitlab.net` is not a suffix of `puzzle-generator-….vercel.app`, so the browser throws `NotAllowedError: The relying party ID is not a registrable domain suffix…`. Passkey registration/authentication on the alias host is impossible. This is a real, spec-enforced mitigation.
- **(e) Rate-limit bypass — REAL, verify keying. ✅ VERIFIED 2026-08-05, keying is sound.** Probed against production: 12 sequential requests to `/api/generate` gave `200`×10 then `429`; **12 more with a different forged `x-forwarded-for` on each gave an identical result**, so the forged header is discarded and the key is the real client IP. 12 *concurrent* requests yielded exactly 10 successes, proving the counter is shared and atomic across instances (Upstash is live in production, not the in-memory fallback). Finally, exhausting the bucket through `biscuitlab.net` and then hitting `origin-puzzles.biscuitlab.net` directly returned `429` — **the same bucket** — which shows the hub's rewrite passes the client IP through and does *not* collapse every visitor into one bucket keyed on the hub's egress IP. Full method and numbers in [`rate-limit.md`](../../src/lib/rate-limit.md).
  - **One correction to the reasoning above:** the mechanism is not that "Vercel appends the client IP". Vercel's [request-headers docs](https://vercel.com/docs/headers/request-headers) say it **overwrites** `X-Forwarded-For` and does "not forward external IPs… to prevent IP spoofing". The conclusion (per-IP limiting works through the hub) was right; the stated mechanism was not, and the difference matters — *appending* would leave `.split(',')[0]` attacker-controlled, which is precisely the bug a later security pass suspected.
  - The second half stands: a directly-reachable origin still bypasses hub-level protections. It is **not** a rate-limit hole (same bucket, measured), and the app's own baseline security headers are set in `next.config.ts` so they are present on the origin too (3/3 verified). Re-locking the *generated* alias remains the fix for the rest — and as of 2026-08-05 that is **done**: `puzzle-generator-…vercel.app` now 302s to `vercel.com/sso-api`, i.e. Deployment Protection is re-enabled, closing mitigation (1) of the Verdict below.
- **(f) Cron endpoint — adequately protected IF `CRON_SECRET` is verified.** Vercel sends `Authorization: Bearer $CRON_SECRET`; the handler must compare and 401 otherwise. This is sufficient even with the alias public, provided the check is present. Confirm the endpoint returns 401 without the header.
- **(g) Hub security headers bypassed — TRUE by construction.** Any headers set on the hub (CSP, HSTS, etc.) are absent when hitting the origin directly. Re-locking the alias is the fix.

**Verdict:** The current state is **tolerable-with-mitigations for a short pre-launch window but MUST be changed before public launch.** Required mitigations, in order: (1) re-enable Deployment Protection; (2) point the hub rewrite at a dedicated custom origin host; (3) add per-page canonicals; (4) confirm `trustedOrigins` and `CRON_SECRET` checks.

### 2. Is multi-zone still worth it?

**Option (a) Continue multi-zone at `biscuitlab.net/puzzles`.** You are ~90% done; the remaining work is the auth fix plus SEO/redirect housekeeping. Ongoing burden: build-time origin coupling, cross-zone Server Actions origins, `next/image` under basePath, `<a>`-not-`<Link>` across the boundary, per-project `revalidatePath`, split logs, and version skew across two projects. SEO upside of a subfolder over a subdomain is real in principle but **negligible today** because `biscuitlab.net` was created 2026-06-24 and has effectively no accumulated authority to consolidate.

**Option (b) Revert to `puzzles.biscuitlab.net` subdomain.** This eliminates almost the entire friction class at once: no basePath, so the better-auth bug disappears; no cross-zone rewrite, so no Deployment Protection proxy problem; no redirect project; no assetPrefix/image/Server-Action-origin issues. Cost: the URL is a subdomain, and you lose the (currently marginal) subfolder SEO benefit. This is the lowest-operational-burden option for a solo developer.

**Option (c) Merge into one app / Turborepo single project.** Highest one-time cost (merge routing, auth, deps), but lowest steady-state complexity and no cross-zone anything. Worth it only if the two apps are truly one product.

**Option (d) Vercel Microfrontends.** The "officially supported" version of this pattern, GA since late 2025 — Vercel's GA changelog reports "nearly 1 billion microfrontends routing requests per day, and over 250 teams, including Cursor, The Weather Company, and A+E Global Media." Routing happens **in Vercel's network** (not an app-level rewrite), so it would likely have sidestepped the Deployment Protection proxy problem. **But: it does not support `basePath`** — the Quickstart states verbatim: "The withMicrofrontends function will automatically add an asset prefix… Next.js applications that use basePath are not supported right now." Adopting it means removing `basePath` and letting `withMicrofrontends` manage asset prefixing. Pricing (CONFIRMED, Vercel docs): all plans can use microfrontends; **Hobby and Pro each include 2 microfrontend projects and 50K routed requests/month**; additional projects are **$250/project/month** (Pro/Enterprise) and routing overage is **$2 per 1M requests**. For a 2-project solo setup you're within the included allotment on Hobby.

**Recommendation (confidence: medium-high):** **Continue with multi-zone (option a), but re-lock the origin first.** You are one fix from a working system, and the switching cost to any alternative now exceeds the cost to finish. **This recommendation flips to option (b), revert to subdomain, if** the basePath request-logging test (below) shows Next.js strips basePath *and* the OAuth-callback-URL conflict cannot be resolved without hacks — in that case the subdomain removes the whole problem class for a solo maintainer. It flips toward Microfrontends only if you add a second sub-app or need independent framework/deploy cadence, and are willing to drop `basePath`.

### 3. better-auth basePath root cause and proposed fix

**Root cause — CONFIRMED from source (July 30 2026):**

- `withPath(url, path='/api/auth')` returns `url` unchanged when it already carries a path (`if (checkHasPath(url)) return url;`), so with `BETTER_AUTH_URL = https://biscuitlab.net/puzzles` the default `/api/auth` was never appended — matching the docs: *"[basePath] will be overridden if there is a path component within `baseURL`."*
- The router base path is `const basePath = new URL(ctx.baseURL).pathname;` in `packages/better-auth/src/api/index.ts`. With the bad config this became `/puzzles`, so requests to `/puzzles/api/auth/*` never matched → 404. The developer's diagnosis is correct.

**The pivotal unknown — does Next.js strip its basePath before the handler?** The developer's fix (`BETTER_AUTH_URL = https://biscuitlab.net`, origin-only, **plus** server `basePath: '/puzzles/api/auth'`) makes the router base `/puzzles/api/auth` and the OAuth callback `https://biscuitlab.net/puzzles/api/auth/callback/google` — **correct if and only if** the route handler receives the URL *with* `/puzzles` intact. The developer asserts Next does not strip. **However, issue #4715's author on Next 15.4.1 reports the opposite:** the handler's request URL was `/api/auth/get-session` (prefix stripped), and the working combination was **server baseURL = origin + `/api/auth` (no Next basePath)** while **client baseURL = origin + Next basePath + `/api/auth`**. If Next 16 also strips, the developer's server `basePath: '/puzzles/api/auth'` will 404 again, and you hit a genuine conflict: the *internal* routing path (`/api/auth`) differs from the *public* URL needed for OAuth callbacks (`/puzzles/api/auth`), which better-auth derives from a single `baseURL`.

**Exact test to run BEFORE applying the fix (UNVERIFIABLE without it):** In `app/api/auth/[...all]/route.ts`, temporarily log on a GET to `/puzzles/api/auth/get-session`:

```ts
export async function GET(request: Request) {
  console.log('url', request.url);
  // and, if available: request.nextUrl.pathname, request.nextUrl.basePath
}
```

- **If `request.url` contains `/puzzles/api/auth/...`** (not stripped): the developer's fix is correct — `BETTER_AUTH_URL=https://biscuitlab.net`, server `basePath:'/puzzles/api/auth'`, client `basePath:'/puzzles/api/auth'`. Callbacks resolve correctly.
- **If `request.url` contains only `/api/auth/...`** (stripped): set the server so the router base is `/api/auth` (leave server `basePath` default; `BETTER_AUTH_URL=https://biscuitlab.net` → resolves to `…/api/auth`), keep client `basePath:'/puzzles/api/auth'`, and **explicitly set the Google provider `redirectURI: 'https://biscuitlab.net/puzzles/api/auth/callback/google'`** to repair the public callback URL that the stripped baseURL would otherwise generate wrong. Register that exact URI in Google Cloud Console.

Note that the community workaround in #4715 has **no maintainer-endorsed resolution**, and its author reported at least one plugin route (`organization/has-permission`) still 404'd afterward — so if you use plugins with their own endpoints, test each explicitly.

**Downstream consequences (verify after fix):**

- **Cookie Path — CONFIRMED safe:** better-auth hard-codes `path: "/"` in `createCookieGetter` (`packages/better-auth/src/cookies/index.ts`), so the session cookie is sent on all `/puzzles/...` pages; the fix will not break routes outside `/puzzles/api/auth`. (Overridable only via `advanced.defaultCookieAttributes` / `advanced.cookies.*.attributes`.)
- **`trustedOrigins`:** set to `['https://biscuitlab.net']` (the public origin). Do not add the `*.vercel.app` host.
- **passkey `rpID`/`origin`:** keep `rpID = biscuitlab.net`, `origin = https://biscuitlab.net`. Unaffected by the baseURL change.
- **Email links / post-sign-in redirects:** verify any absolute URLs and `callbackURL` defaults resolve to `https://biscuitlab.net/puzzles/...`, not the origin root or the old subdomain.
- **`request.url` interactions:** the same strip/no-strip behavior can affect any custom route logic that inspects `request.url`; audit those after the fix.

### 4. Is the separate `puzzles-redirect` project the right way to do the 301?

**Vercel does support subdomain→subpath redirects natively (CONFIRMED, Vercel KB "Can I redirect from a subdomain to a subpath?").** You do **not** need a throwaway project. Attach `puzzles.biscuitlab.net` to the **hub** project and add a host-conditional redirect. Vercel's `redirects()`/`vercel.json` can capture the path and target another domain's subpath, preserving `/play` → `/puzzles/play`.

Minimal correct `vercel.json` (host-scoped, path-preserving, on whichever project owns `puzzles.biscuitlab.net`):

```json
{
  "redirects": [
    {
      "source": "/:path*",
      "has": [{ "type": "host", "value": "puzzles.biscuitlab.net" }],
      "destination": "https://biscuitlab.net/puzzles/:path*",
      "permanent": true
    }
  ]
}
```

Notes: the bare root (`/`) is covered by `:path*` matching empty. If you configure this inside a Next.js app that has `basePath` set, add `basePath: false` to the redirect so the rule is not prefixed. **Vercel issues 308 for `permanent: true`, not 301** — this is fine for SEO: Google's John Mueller confirmed "if you use it like a 301 we'll treat it as such," and Search Central treats 308 like 301 for link-equity transfer. The tiny-project approach works but adds a project to maintain; folding the redirect into the hub eliminates it. It can be collapsed later with zero downside.

### 5. Cloudflare grey-cloud DNS decision

**Verdict: leave it as-is. Cloudflare Registrar + Cloudflare nameservers + DNS-only (grey-cloud) records pointing at Vercel is a genuinely supported, trouble-free setup (CONFIRMED).** The earlier "avoid Cloudflare" advice was specifically about the **orange-cloud reverse proxy**, which causes redirect loops (with SSL mode "Flexible") and blocks Vercel's ACME challenge. Grey-cloud avoids both.

Residual gotchas and confirmations:

- **A record vs CNAME:** use Vercel's apex A record for `biscuitlab.net`; a CNAME/flattened record for subdomains. Keep records DNS-only.
- **TLS issuance/renewal:** Vercel issues and auto-renews certs via ACME through a grey-clouded record; confirmed working. Cloudflare Universal SSL does not interfere when the record is DNS-only (Cloudflare is not terminating TLS).
- **Do not add AAAA records** for the Vercel apex (Vercel doesn't support IPv6 for third-party-DNS custom domains; a stray AAAA can stall SSL).
- **Accidental orange-cloud flip** would break ACME renewal and double-proxy traffic (latency, possible loops) — the main operational hazard. Guard against it.
- **DNSSEC** is fine to keep enabled at Cloudflare.
- **TTL:** lower critical records to 300–600s before any cutover.
- **Search Console DNS TXT verification and IndexNow** are unaffected by grey-cloud (TXT is always DNS-only; IndexNow is an HTTP key file).
- **Transfer after the ICANN lock lifts (~Aug 23 2026):** not required. Leaving it at Cloudflare Registrar with grey-cloud DNS is fully supported.

### 6. Best practices for operating multi-zone long-term

- **Kill the build-time `PUZZLES_ORIGIN` coupling.** Pinning to a generated `*.vercel.app` alias is fragile (the alias is protected, and disabling protection to reach it is what caused this whole incident). **Use a stable custom origin host** (`origin-puzzles.biscuitlab.net`) that never changes and is exempt from Standard Protection. Keep the rewrite reading an env var, but the value is now a stable custom domain, so hub redeploys are no longer forced by origin churn. (A `vercel.json` rewrite is read per-deploy too; the real win is a stable target, not runtime vs build-time.)
- **Version skew across zones:** Vercel Skew Protection is **per-project** (Pro/Enterprise), pinning a client to the deployment that served its HTML via the `__vdpl`/`_dpl` cookie. It does **not** coordinate across two independent projects. Because the browser loads HTML from one zone and assets/actions from another, cross-zone skew is possible during overlapping deploys; deploy the origin (puzzles) **before** the hub when shipping coupled changes, and keep changes backward-compatible.
- **Preview environments:** there is no automatic cross-zone preview. Teams either (i) point a hub preview's rewrite env var at a specific puzzles preview URL (needs a bypass token since previews are always protected), or (ii) test each zone in isolation and rely on contract stability. Document the preview URL wiring.
- **Local development:** run both apps on different ports and use the hub's `rewrites()` to proxy `/puzzles` to the local puzzles port; or run a small local proxy. Expect basePath/asset quirks locally that mirror production.
- **Caching/ISR/revalidation:** `revalidatePath`/`revalidateTag` are **per-project** — the hub cannot revalidate puzzles' cache and vice versa. The proxy hop can double-count function invocations (hub + origin) for billing. Verify `x-vercel-cache` behavior end-to-end and that cache headers propagate through the rewrite.
- **Observability:** the hub's logs show the inbound request and the rewrite; the puzzles project's logs show the actual render/API. To trace across the boundary, propagate a request ID header. Alert on: origin 5xx rate, auth-endpoint 4xx spikes, cron 401s, and the redirect returning non-308.
- **Post-deploy verification checklist (`curl`), run after either zone deploys:**

```bash
curl -I https://biscuitlab.net/puzzles                       # 200 (page)
curl -I https://biscuitlab.net/puzzles/_next/static/...       # 200 (asset via assetPrefix)
curl -I https://biscuitlab.net/puzzles/api/me/today           # 401 (non-auth API alive)
curl -sI https://biscuitlab.net/puzzles/api/auth/get-session  # 200 (auth mounted, not 404)
curl -s  https://biscuitlab.net/puzzles/<page> | grep canonical   # canonical present & absolute
curl -I https://puzzles.biscuitlab.net/play                   # 308 -> https://biscuitlab.net/puzzles/play
curl -I https://biscuitlab.net/puzzles/api/cron/<job>         # 401 without Bearer
curl -I https://origin-puzzles.biscuitlab.net/puzzles         # reachable by proxy; alias .vercel.app should be 401 (protected)
```

- **Rollback:** because `basePath` is build-time-inlined, the fastest safe rollback is Vercel **Instant Rollback** to the prior deployment on each project independently (redeploy the last-good build). If a coupled change spans both zones, roll back the hub first (stops routing to the broken origin), then the origin. This is viable only while the prior deployments are retained (governed by your Deployment Retention setting) — keep at least a few days of retention.
- **Runbook hygiene (solo dev):** keep a single `MIGRATION.md` documenting: the origin host, the exact `BETTER_AUTH_URL`/basePath/client-basePath values, the Google redirect URI, the deploy-order rule, and this curl checklist. Two coupled repos + a solo maintainer is exactly where undocumented coupling causes outages months later.

### 7. What's likely to bite next

- **Per-page canonicals (already missing — highest-priority SEO gap):** `metadataBase` is set but no `<link rel="canonical">` is emitted. Add `alternates: { canonical: './' }` in the root layout (or per-page), which Next resolves against `metadataBase`. Set `metadataBase = new URL('https://biscuitlab.net/puzzles')`. Without this, the public `*.vercel.app` alias and any trailing-slash/query variants risk duplicate indexing.
- **Server Actions across zones:** set `experimental.serverActions.allowedOrigins` on the **puzzles** project to include `biscuitlab.net` (the user-facing origin). Without it you get "`x-forwarded-host` … does not match `origin`" and the action aborts. This is the single most common multi-zone-through-a-proxy break.
- **`next/image` under basePath and through the proxy:** the optimizer lives at `/puzzles/_next/image`; ensure the rewrite forwards `/_next/image` and that `remotePatterns` (required in Next 16) allow your image sources — otherwise 400s. Note Next 16 also requires an explicit `qualities` allowlist; a quality not in the list returns 400.
- **RSC/streaming payloads through an external rewrite:** RSC navigations and streamed responses must survive the hop; verify soft-navigation within the puzzles zone works and that RSC requests aren't buffered/broken by the proxy.
- **`next/link` prefetch across the boundary:** use plain `<a>` for links from the hub into `/puzzles` (and back), not `<Link>` — Next will try to prefetch/soft-navigate relative paths that don't exist in the current zone (this is explicit in the Next.js multi-zones guide).
- **Sitemap/robots across zones:** the hand-rolled sitemap index must list the puzzles URLs under `biscuitlab.net/puzzles/...` (canonical host), and robots must not accidentally expose or block the origin host.
- **OAuth redirect URI drift:** any change to basePath or origin re-derives the callback; keep Google Cloud Console's authorized redirect URI in lockstep with the resolved callback.
- **Transactional email / absolute URLs:** audit for any links still pointing at `puzzles.biscuitlab.net`; they should resolve via the 308 but update them to `biscuitlab.net/puzzles`.
- **WebSockets/long-polling:** if any are added later, confirm they traverse the rewrite (Vercel rewrites are HTTP; persistent connections may need a direct host).
- **Extra-hop latency/regions:** the hub→origin hop adds latency and can double function invocations; pin both projects to the same region and watch cold-start/latency and billing.

## Staged Recommendations

**Stage 0 — Before touching auth (do these first):**

1. Create custom origin host `origin-puzzles.biscuitlab.net`, attach it to the Puzzle Lab project (grey-cloud DNS at Cloudflare), and **re-enable Deployment Protection** on Puzzle Lab.
2. Repoint the hub's rewrite env var to `https://origin-puzzles.biscuitlab.net`; redeploy the hub. Confirm the generated `*.vercel.app` alias now returns 401 while `biscuitlab.net/puzzles` still serves 200.
3. Fold the `puzzles.biscuitlab.net` → `biscuitlab.net/puzzles` 308 redirect into the hub (host-conditional rule); decommission the throwaway `puzzles-redirect` project.
4. Add per-page canonical tags and set `metadataBase` to the `/puzzles` subpath.

**Stage 1 — Fix auth:**
5. Run the request-logging test to determine whether Next 16 strips basePath from the handler URL.
6. Apply the matching config (developer's fix if not stripped; the `/api/auth` router base + explicit Google `redirectURI` if stripped). Set `trustedOrigins=['https://biscuitlab.net']`. Update Google Cloud Console redirect URI to the exact resolved callback.
7. Browser-verify all three flows (passkey, email/password, Google OAuth) on `biscuitlab.net/puzzles`, plus `get-session` on a normal page (cookie `Path=/` should make this work).

**Stage 2 — Harden & finish:**
8. Set `serverActions.allowedOrigins=['biscuitlab.net']` on the puzzles project; verify `next/image` `remotePatterns`/`qualities`; confirm CRON_SECRET 401 behavior.
9. Flip the hub card link to `/puzzles` with a cross-zone `<a>`.
10. Wire the sitemap index, robots, Search Console (DNS TXT), Bing/IndexNow, analytics.
11. Run the full curl checklist; save it and the config values into `MIGRATION.md`.

**Thresholds that change the plan:** If Stage 1 step 5 shows basePath is stripped **and** the callback-URL conflict needs hacks, revert to the `puzzles.biscuitlab.net` subdomain (removes basePath, the proxy, the redirect, and Server-Action origins in one move). If you later add a second sub-app or need independent framework/cadence, revisit Microfrontends (after dropping `basePath`).

## Caveats / Open Questions

- **UNVERIFIABLE without testing:** whether Next.js 16 strips `/puzzles` from the route-handler URL (determines the correct better-auth server config); whether the production `*.vercel.app` alias reliably carries `X-Robots-Tag: noindex` on direct browser requests (documented as inconsistent); exact `x-vercel-cache` and double-invocation billing behavior through your specific rewrite; how your Upstash/KV limiter keys IPs.
- **Plan-dependence:** "All Deployments" protection scope and Skew Protection are Pro/Enterprise; Protection Bypass for Automation and Microfrontends (2 projects + 50K routing requests) are available on all plans including Hobby. Confirm your plan before relying on any of these.
- **Fast-moving surfaces:** Vercel Deployment Protection scopes, Microfrontends pricing/basePath support, and better-auth's URL/cookie internals all changed within the last year; re-check against current docs at implementation time.
- **better-auth #4715 has no maintainer-endorsed fix** — the working config is a community workaround, and at least one plugin route (`organization/has-permission`) reportedly still 404'd for that reporter. If you use plugins with their own endpoints, test each explicitly.
