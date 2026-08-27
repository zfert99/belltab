# Performance & Speed Optimization Guide for a Next.js Puzzle App

## TL;DR

- **Pass Core Web Vitals at the 75th percentile of real users** — LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 — and treat **INP as your hardest, highest-priority metric** because it is the one interactive apps most often fail; your 9×9+ clickable puzzle grid is exactly the kind of UI that generates long main-thread tasks and large DOMs that hurt INP.
- **Your biggest, cheapest wins are architectural, not cosmetic:** keep the `'use client'` boundary as deep and narrow as possible (Server Components ship zero JS), use `next/image` (AVIF/WebP) and `next/font` (self-hosted, `display: swap`, `adjustFontFallback`), cache daily puzzles and leaderboards in the Upstash/Vercel KV you already run, and use the correct Neon connection method for Vercel. You can keep the rich "Puzzle Lab" aesthetic — thick shadows, textures, animations — as long as you animate only `transform`/`opacity` and render textures as optimized images/CSS rather than heavy DOM.
- **Measure with both field and lab data:** Vercel Speed Insights + `web-vitals` for real-user (RUM) field data, and Lighthouse/PageSpeed Insights/`@next/bundle-analyzer` in CI with performance budgets to catch regressions before they ship. Roll out in stages: instrument first, fix the metric in the "poor" band first, then optimize.

## Key Findings

1. **Core Web Vitals thresholds are stable for 2026** and are field-measured: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1, each judged at the 75th percentile of real Chrome users over a 28-day rolling window (CrUX). INP officially replaced FID on March 12, 2024. A perfect Lighthouse (lab) score does not guarantee passing — only real-user (field) data counts for Google ranking.
2. **INP is the metric interactive apps most often fail, and your grid app is directly exposed.** Per the HTTP Archive 2025 Web Almanac (CrUX, July 2025), 77% of mobile pages achieve a "good" INP (up from 55% in 2022) — so roughly a quarter still fail — and only about 53% of the top 1,000 most-visited sites pass INP. Long tasks (any main-thread task > 50ms) are the primary cause, and large/deeply nested DOMs raise the "presentation delay" portion of every interaction — a direct risk for an 81-cell grid plus achievement/leaderboard lists.
3. **Server Components are the single highest-leverage optimization in Next.js.** Everything above a `'use client'` boundary ships zero JavaScript; misplaced boundaries that pull the whole tree client-side are the most common App Router performance bug. Vercel benchmark examples show correct usage reducing client JavaScript by up to ~70%, and a Frigade experiment reported a 62% bundle reduction and near-3× faster render with RSC versus a traditional React SPA.
4. **Partial Prerendering (PPR) became stable in Next.js 16, released October 21, 2025** via Cache Components (`cacheComponents: true`); the old `experimental.ppr` flag was removed. It serves a static shell instantly from the edge while streaming dynamic holes (user streaks, personalized shop state) in the same response.
5. **Use the right Neon connection method for Vercel.** On Vercel Fluid compute, the current recommendation is standard TCP `pg` (node-postgres) against the **pooled** (`-pooler`, PgBouncer) endpoint with `attachDatabasePool` from `@vercel/functions`; the `@neondatabase/serverless` HTTP/WebSocket driver is for Edge runtime or fully-isolated serverless where TCP is unavailable.
6. **You already run Upstash/Vercel KV for rate limiting — reuse it as a cache.** Redis is explicitly recommended for caching, session storage, and real-time leaderboards. Daily puzzles (identical for all users for 24h) and leaderboard snapshots are ideal cache targets.
7. **A layered monitoring setup is the professional standard:** RUM (Vercel Speed Insights / `web-vitals`) for field data + Lighthouse CI with `budget.json` performance budgets in GitHub Actions to fail builds on regressions, plus `@next/bundle-analyzer` to catch bundle bloat.

## Details

### 1. Core Web Vitals & metrics (2026)

**The three metrics and thresholds** (unchanged for 2026, all at p75 of field data):

- **LCP (Largest Contentful Paint)** — loading; good ≤ 2.5s, needs-improvement ≤ 4.0s, poor > 4.0s.
- **INP (Interaction to Next Paint)** — responsiveness; good ≤ 200ms, needs-improvement ≤ 500ms, poor > 500ms. It replaced FID on March 12, 2024 and measures the full lifecycle of interactions across the whole visit, not just the first input.
- **CLS (Cumulative Layout Shift)** — visual stability; good ≤ 0.1.

**Field vs lab.** Google grades you on the Chrome User Experience Report (CrUX) — real Chrome users, 75th percentile, 28-day rolling window, at the page (URL) level, falling back to origin level when URL data is sparse. Lab tools (Lighthouse) run on a single controlled machine and are useful for catching obvious problems and for CI gating, but they do not feed ranking. Because CrUX is a 28-day rolling window, allow several weeks after a deploy before judging whether a field fix worked; RUM tools like Vercel Speed Insights show the change within roughly a day.

**INP sub-parts** (the model to reason about your grid): input delay (from user action to event callbacks starting) → processing duration (event callbacks running) → presentation delay (browser painting the next frame). At the median, presentation delay is typically the largest sub-part because every interaction needs at least one rendering pass, and a large/nested DOM inflates it; at the 90th percentile, input delay dominates because long tasks delay event processing. Research points to ~100ms as the threshold where an interaction feels instant, but 200ms was chosen as the achievable "good" bar.

**Why it matters.** Beyond SEO, responsiveness and stability drive engagement; a one-second load delay is associated with meaningful conversion loss, and one 2026 analysis (Digital Applied) found that passing all three CWV correlates with 24% lower bounce rates. For a daily-puzzle app, snappy grid interaction and instant daily-puzzle load are core retention levers.

**Monitoring recommendation:** alert at 80% of thresholds (INP > 160ms, LCP > 2.0s, CLS > 0.08) so you catch creep before it crosses into failing territory.

### 2. Next.js-specific optimization

**Rendering strategy — Server vs Client Components.** In the App Router everything is a Server Component by default; `'use client'` marks a one-way boundary where React ships and hydrates JavaScript. Everything imported into a client file joins the client bundle. Rules:

- Keep marketing/static pages, the daily-puzzle shell, achievement lists, and leaderboard tables as Server Components (data fetched server-side, zero client JS).
- Push `'use client'` as deep as possible — e.g., make only the interactive grid, the cell keypad, timer, and shop "buy" button client components, not their containers.
- Use the composition pattern: pass Server Components as `children` into a Client wrapper so server-rendered content isn't pulled into the client graph.
- Auditing the tree for unnecessary `'use client'` markers is the highest-leverage optimization available.

**Static vs dynamic, streaming/Suspense, PPR.** Static rendering (build-time/revalidated) is fastest; any use of `cookies()`, `headers()`, or `searchParams` in a non-PPR route opts the whole route into dynamic rendering. Use `<Suspense>` to stream slow dynamic sections (leaderboard, personalized streak) while the static shell paints immediately. **PPR (stable in Next.js 16 via `cacheComponents: true`)** formalizes this: a cached static shell from the edge with dynamic holes streamed in one HTTP response. In Next.js 16 code is dynamic by default and you opt sections into caching via the `use cache` directive. If still on 14/15, PPR is `experimental.ppr` and not recommended for production.

**Caching (fetch, route config, ISR, `use cache`).** In the pre-16 model, `fetch` is uncached by default; opt in with `cache: 'force-cache'`, tag requests with `next: { tags: [...] }`, and use `unstable_cache` to wrap non-fetch DB queries (Drizzle) with `{ revalidate, tags }`. Invalidate with `revalidateTag`/`revalidatePath` from a Server Action. ISR: a page revalidates after N seconds, serving stale instantly while regenerating in the background — ideal for a daily puzzle page (`revalidate` set to seconds-until-midnight or a fixed window) and for leaderboards (`revalidate: 60`). In Next.js 16 the recommended path is `use cache` + `cacheLife`/`cacheTag`; `unstable_cache` is marked legacy but still works and does not require Cache Components. There are four cache layers (Request Memoization, Data Cache, Full Route Cache, Router Cache) — most revalidation bugs come from invalidating the wrong one.

**Image optimization (`next/image`).** Configure AVIF + WebP: `images: { formats: ['image/avif', 'image/webp'] }`. AVIF delivers up to ~50% better compression than JPEG (~25–35% for WebP). Images are typically 50–70% of page weight, so next-gen formats can cut payload 40–60%. Use `priority` on the above-the-fold hero/LCP image, correct `sizes`/`fill` for responsive delivery, and always set width/height (or `fill` with a sized container) to prevent CLS. `next/image` auto-serves the best format per browser and caches the result.

**Font optimization (`next/font`).** `next/font` self-hosts Google/local fonts at build time (no request to Google, GDPR-friendly), preloads them, applies `font-display: swap`, and — critically — generates a size-adjusted fallback (`adjustFontFallback: true`, default for Google Fonts) that matches the fallback metrics to the custom font to minimize the layout shift `swap` would otherwise cause (~18% of Next.js sites using bare `display: swap` had poor CLS). Subset to `latin`, load `woff2`, and consolidate to a single font family or two to keep bytes low for the "Puzzle Lab" look.

**Code splitting & dynamic imports.** Use `next/dynamic` for anything shown conditionally or after interaction — the cosmetics shop modal, achievement detail popovers, a "live battle" panel, confetti/celebration animations, charts. `dynamic(() => import('./X'), { ssr: false })` keeps it out of the initial bundle. Rule of thumb: anything behind a `{condition && ...}` is a dynamic-import candidate. Real-world reports show 30%+ bundle reductions and 60+ kB shaved off a home page from this alone.

**Bundle analysis.** Install `@next/bundle-analyzer`, run `ANALYZE=true next build` to get a treemap of every module. Look for oversized vendor libs and full-library imports. Fixes: import only what you need (e.g., named lodash functions, or drop lodash), use `optimizePackageImports` in `next.config` for auto tree-shaking of large libraries, and replace heavy deps with lighter ones. Keep puzzle-generation/solver logic server-side or in a Web Worker so it never enters the client bundle.

**Server Actions performance.** Server Actions are great for mutations (submitting a solved puzzle, buying a cosmetic) but have notable per-invocation overhead and are effectively serialized — multiple actions do **not** run concurrently even under `Promise.all`, so they are a poor choice for parallel data fetching. Best practices: keep fetching in Server Components / Route Handlers; batch related work into a single action; parallelize independent DB queries *inside* one action with `Promise.all`; validate/sanitize inputs and protect against CSRF. Prefer Route Handlers (GET) for cacheable reads like leaderboards.

**React patterns for the interactive grid.** Re-render control is where INP is won or lost:

- Wrap cell components in `React.memo` and pass **stable** references — memoize handlers with `useCallback` and derived arrays/objects with `useMemo`, or the memo is useless. Store grid config (fixed cells, cage definitions) in memoized structures.
- Colocate state: keep per-cell selection state as low as possible so a single cell edit doesn't re-render all 81 cells. Use stable `key`s per cell; don't store derived values (e.g., conflict highlighting) in state — compute with `useMemo`.
- **Render the interaction's visual feedback first, then defer heavy work.** When a cell is filled, paint that cell's new value immediately, then yield before recomputing conflicts/validation across the whole grid.
- Use `useTransition`/`startTransition` to mark the expensive full-grid recalculation (re-highlighting conflicts across all cells) as non-urgent, keeping the clicked cell's own feedback instant and interruptible. React's docs describe transitions as keeping "the user interface updates responsive even on slow devices."
- **React Compiler (v1.0 shipped October 7, 2025; supported as stable in Next.js 16, recommend Next.js 15.3.1+ to enable)** auto-applies the equivalent of `useMemo`/`useCallback`/`React.memo`; if you adopt it, focus manual memoization only on cases it can't infer. In the React Compiler working group, Wakelet's Nick Blow reported: "our LCP improved by 10% (2.6s -> 2.4s), and our INP improved by about 15% (275ms -> 240ms)… elements that were pure React (such as Radix dropdowns), where the INP speedup was closer to 30%." Results across the ecosystem are mixed, and it does not fix bundle size or network waterfalls.
- Offload heavy computation (solver, puzzle generation, large-grid validation) to a **Web Worker** to keep the main thread free (Workers can't touch the DOM).
- Break up any unavoidable long task with **`scheduler.yield()`** (see §5).

### 3. Asset & delivery optimization

**Image formats/compression:** AVIF for detail-heavy art (best compression), WebP for broad compatibility; both via `next/image`. Never ship oversized source images; let the optimizer resize per device.

**Font loading:** Avoid render-blocking, FOIT, and FOUT with `next/font` (self-host + preload + `swap` + size-adjusted fallback). Don't use `display: block` for body text (causes FOIT/invisible text). Load from a single origin. Use `woff2` and subset.

**CSS optimization:** Ship critical CSS inline (Next.js handles much of this) and remove unused CSS. If using Tailwind, its purge/JIT keeps only used utilities, avoiding framework bloat — a good fit for "lightweight without losing functionality." Simplify selectors to speed style recalculation (which affects INP presentation delay).

**JS minification/tree-shaking:** Handled by the Next.js compiler/Turbopack (default bundler in Next.js 16) in production; your job is to enable tree-shaking by using ES modules and named imports, and to keep code out of the client graph.

**Lazy loading:** Off-screen images lazy-load by default with `next/image`; use `next/dynamic` for below-the-fold/interaction-gated components; consider `content-visibility: auto` for long off-screen lists (achievements, past puzzles).

**CDN & edge caching (Vercel):** Static assets and the PPR/ISR static shell are served from Vercel's global edge network, cutting latency worldwide. Cache API responses where safe. Vercel serves modern protocols automatically; HTTP/2/3 multiplexing reduces the cost of multiple asset requests, but you still benefit from bundling and minimizing request count.

### 4. Database & backend performance

**Neon connection method (critical on Vercel):**

- On **Vercel Fluid compute (Node serverless functions)**: use `pg` (node-postgres) against the **pooled** endpoint (`...-pooler...`, PgBouncer) and call `attachDatabasePool()` from `@vercel/functions` so the runtime manages pooled connections and reuses warm TCP connections. This is now the fastest, most robust method. Drizzle setup: `drizzle({ client: pool, schema })` with a `pg` `Pool`.
- On **Edge runtime** (no TCP sockets) or fully-isolated serverless: use `@neondatabase/serverless` — `neon()` HTTP mode for single queries (fastest, ~3–4 roundtrips vs ~8 for TCP), `Pool`/WebSocket for transactions. In Edge, create and close the Pool/Client *inside* the request handler; never reuse across requests.
- Use the pooled host under burst load or you'll exhaust connections (each invocation opens its own connection on the direct host). Note PgBouncer transaction pooling disables prepared statements — the serverless Pool driver handles this automatically; raw `pg` does not.

**Query optimization (Postgres/Neon):** Use `EXPLAIN ANALYZE` to inspect plans; a sequential scan on a large table where you expect an index scan signals a missing index. Add B-tree indexes on columns in `WHERE`, `JOIN`, and `ORDER BY` — for leaderboards, index the score/time and date columns you sort and filter on. Use partial indexes for filtered queries (e.g., "today's puzzle" rows). Find N+1 patterns with `pg_stat_statements` (high call count, ~1 row each) and collapse them into a single `JOIN` or `WHERE ... IN (...)`. Avoid `SELECT *` and `OFFSET` pagination for large lists; run `VACUUM`/`ANALYZE` to keep stats fresh. A well-placed index routinely turns multi-thousand-millisecond queries into sub-millisecond ones.

**Caching layers (Upstash/Vercel KV):** You already use `@upstash/ratelimit` with Vercel KV. Reuse the same Redis for:

- **Daily puzzles:** identical for all users for 24h — cache the generated puzzle JSON with a TTL to midnight; serve from Redis instead of regenerating/querying. Combine with ISR on the page.
- **Leaderboards:** cache computed top-N snapshots (Redis sorted sets are purpose-built for leaderboards) with a short TTL (e.g., 30–60s) or update on submission; avoids expensive `ORDER BY ... LIMIT` on every view.
- **Streaks/achievements summaries:** cache per-user rollups. Upstash is per-request priced (free tier ~500K commands/month) which suits variable puzzle-app traffic. Note Vercel KV is Upstash under the hood.

**API/Server Action response times:** parallelize independent queries with `Promise.all`; cache reads; keep payloads small (select only needed columns); prefer Route Handlers for cacheable GETs; return early and stream where possible.

### 5. General lightweight best practices

**Minimize third-party scripts.** Each third-party tag is main-thread risk. Use `next/script` with the right strategy: `beforeInteractive` only for rare must-run-first polyfills; `afterInteractive` (default) for analytics/ads; `lazyOnload` for chat widgets, social embeds, non-critical features. Field data shows `lazyOnload` for analytics yielding a median ~27ms INP improvement vs `afterInteractive`. For GA/GTM use `@next/third-parties`. Consider the experimental `worker` strategy (Partytown) to move non-UI scripts off the main thread. Since this is a game, keep third parties to a bare minimum.

**Avoid render-blocking resources & reduce DOM size.** Lighthouse warns above ~800 body nodes and errors above ~1,400 (the classic "excessive DOM size" audit, now the "Optimize DOM size" insight since Lighthouse 13); thresholds are >1,500 total nodes, depth >32, or any parent with >60 children. An 81-cell grid alone is fine, but grid + keypad + long achievement/leaderboard lists + decorative wrappers can blow past this and hurt INP (more style/layout recalc per interaction) and memory. Mitigations: flatten nesting (use fragments, CSS grid/flexbox instead of wrapper divs), **virtualize** long lists with `react-window`, paginate, use `content-visibility: auto` for off-screen content, and only create DOM on interaction where possible.

**Efficient CSS / avoid bloat.** Prefer a utility framework with purging (Tailwind) or lean CSS over heavy component libraries you barely use. Keep selectors simple.

**Rich visuals vs performance — keeping the "Puzzle Lab" aesthetic.** You can have thick shadows, textures, and animation without tanking speed:

- **Animate only `transform` and `opacity`** — these run on the GPU compositor thread and skip layout/paint, so they stay smooth (target 60fps) even when the main thread is busy. Never animate `left/top/width/height/margin` (triggers reflow) or animate `box-shadow` per frame (triggers paint). Move with `translate`, scale with `scale()`, reveal with `opacity`.
- Use `will-change` sparingly (only on an element about to animate, removed after) — applying it broadly wastes GPU memory.
- Render complex textures/paper grain as an optimized AVIF/WebP background or a single CSS gradient, not as many DOM nodes.
- For "live battles"/real-time features, prefer efficient transports (WebSocket/SSE) and update only the changed cells, not the whole grid; wrap non-urgent UI updates in `startTransition`.
- Static thick shadows/borders are cheap; the cost is only when you *animate* paint-heavy properties. Test on a mid-range Android with CPU throttling in DevTools.

**Breaking up long tasks (INP core technique).** A "long task" is any main-thread task > 50ms; per web.dev, "the browser blocks interactions from occurring while a task of any length is running," and JavaScript's run-to-completion model means a task runs to the end regardless of how long it blocks. Break big work (validating an entire large grid, computing all achievement states) into chunks and yield:

- **`scheduler.yield()`** — the modern API to yield to the main thread and resume with priority. Per Chrome for Developers, it "prioritizes the continuation of a task over starting new tasks," unlike `setTimeout`/`postTask` whose continuations run *after* already-queued tasks. Available in Chrome/Edge 129+ and Firefox 142+ (Aug 2025); **not supported in Safari**, so it is not Baseline — feature-detect (`globalThis.scheduler?.yield`) and fall back to the `scheduler-polyfill` or `setTimeout`.
- Batch iterations before yielding (setTimeout has a ~4ms nested clamp) and use a ~50ms deadline as the point to yield.

### 6. Testing & monitoring tools

- **Lighthouse / PageSpeed Insights:** lab audits for LCP proxy, TBT (a lab stand-in for INP), CLS, and diagnostics (DOM size, unused JS/CSS, render-blocking). PSI also surfaces your CrUX field data. Use for development and CI, not as the source of truth for ranking.
- **WebPageTest:** deep waterfall/filmstrip analysis, throttled devices, comparison of two builds.
- **Chrome DevTools Performance panel:** record an interaction to see whether dropped frames come from Main (JS/layout), Raster/Paint, or Compositor; enable CPU throttling to emulate a mid-range phone; use the Performance monitor to watch live DOM node count; use paint-flashing/layer borders to see repaints. The INP breakdown view shows input delay vs processing vs presentation.
- **Vercel Speed Insights + Analytics:** zero-config RUM tied to the deployment SHA, giving p75 LCP/INP/CLS/FCP/TTFB per route, segmented by device/geo. Install `@vercel/speed-insights` and `@vercel/analytics`; data appears within ~24h. This is your field-data source of truth.
- **`web-vitals` library:** tiny; log all three CWV from real visits to your own endpoint if you want custom dashboards.
- **`@next/bundle-analyzer`:** treemap of client/server bundles; run on demand and watch for growth.
- **Performance budgets in CI:** Lighthouse CI (`@lhci/cli`, current 0.15.x / Lighthouse 12.x) via GitHub Actions (`treosh/lighthouse-ci-action`), asserting a `budget.json` (e.g., total transfer, script bytes, LCP/CLS thresholds) so a PR that regresses fails the build with an explicit message. Run 3+ times per URL to reduce variance. Layer RUM on top for what actually happens in production.

## Recommendations (staged rollout)

**Stage 0 — Instrument first (day 1, do before optimizing).**

- Add `@vercel/speed-insights` + `@vercel/analytics`; capture baseline p75 LCP/INP/CLS per route (grid page, daily puzzle, leaderboard, shop).
- Run `@next/bundle-analyzer` and record current client bundle sizes.
- Run Lighthouse on the key routes; note DOM node counts on the grid and list pages.
- **Benchmark to act on:** any route in the "poor" band (LCP > 4s, INP > 500ms, CLS > 0.25) is a stage-1 emergency.

**Stage 1 — Fix whatever is in the "poor" band, then INP (week 1–2).**

- Audit `'use client'` usage; move every non-interactive component back to the server. This is the biggest single win.
- Confirm `next/image` (AVIF/WebP, `priority` on LCP image, dimensions set) and `next/font` (self-hosted, `swap`, `adjustFontFallback`) are in use everywhere.
- Instrument the grid: memoize cells, stabilize handlers, render feedback-first, wrap full-grid recompute in `startTransition`, move solver/generation to a Web Worker. Add `scheduler.yield()` (with polyfill) to any long validation loop.
- **Threshold to advance:** all routes out of "poor"; grid INP trending under 200ms in Speed Insights.

**Stage 2 — Caching & backend (week 2–3).**

- Cache daily puzzles and leaderboard snapshots in your existing Upstash/Vercel KV (sorted sets for leaderboards); add ISR (`revalidate`) to the daily puzzle and leaderboard pages.
- Verify Neon connection method (pooled `pg` + `attachDatabasePool` on Vercel Node functions; serverless driver only where TCP is unavailable).
- Run `EXPLAIN ANALYZE` on leaderboard/streak/achievement queries; add indexes; kill N+1s.
- Batch Server Actions; move cacheable reads to Route Handlers.
- **Threshold:** DB p95 query time and API TTFB within budget; no connection exhaustion under load tests.

**Stage 3 — Trim & polish (week 3–4).**

- Dynamic-import the shop modal, achievement popovers, live-battle panel, and celebration animations.
- Virtualize long lists; flatten DOM to stay under Lighthouse thresholds; add `content-visibility: auto` to off-screen sections.
- Audit third-party scripts; set `lazyOnload`/`afterInteractive` appropriately (there should be very few).
- Convert any animated paint-heavy effects to `transform`/`opacity`; render textures as optimized images.
- **Threshold:** client bundle within budget; DOM under ~1,400 nodes per page.

**Stage 4 — Lock it in (ongoing).**

- Add Lighthouse CI + `budget.json` to GitHub Actions to fail regressive PRs.
- Set Speed Insights alerts at 80% of thresholds (INP > 160ms, LCP > 2.0s, CLS > 0.08).
- Re-baseline after each major feature; treat a field regression as a bug.
- Evaluate PPR (`cacheComponents`) and the React Compiler once on Next.js 16 / React 19, verifying gains with RUM.

## Caveats

- **Field vs lab lag:** CrUX/Google ranking data moves on a 28-day rolling window, so ranking impact of a fix appears weeks later even though Speed Insights/RUM shows it within a day. Don't chase Lighthouse numbers as a ranking proxy.
- **Version-dependent APIs:** PPR/`use cache`/`cacheComponents` and the React Compiler are Next.js 16 / React 19-era features (Next.js 16 released October 21, 2025; React Compiler v1.0 released October 7, 2025); on 14/15 use `experimental.ppr` (not production-recommended) and `unstable_cache` (legacy but functional). Confirm your exact Next.js version before adopting.
- **`scheduler.yield()` is not Baseline** (no Safari as of 2026) — always feature-detect and polyfill.
- **Memoization isn't free:** over-memoizing simple components adds overhead; profile with React DevTools before adding `memo`/`useMemo`. The React Compiler's real-world gains are mixed and it doesn't fix bundles or network waterfalls.
- **Some cited figures come from vendor/agency or single-project sources** (e.g., the "~70% JS reduction," Frigade "62%," "27ms lazyOnload," "24% lower bounce rate," and "median presentation delay largest" claims). They're directionally consistent with first-party guidance (web.dev, Chrome, Next.js docs) but treat specific percentages as indicative, not precise. The INP pass-rate figures are anchored to the HTTP Archive 2025 Web Almanac; where possible other claims are anchored to first-party sources (nextjs.org, neon.com, web.dev, developer.chrome.com, react.dev, Vercel docs).
- **This report deliberately excludes** deep PWA/offline and accessibility guidance, which are covered by the companion reports; a few overlaps (font CLS, DOM size affecting the a11y tree) are noted only where they also affect performance.
