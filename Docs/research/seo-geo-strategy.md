# SEO & GEO for Puzzle Lab: How Search Works and How to Implement It (2026)

## TL;DR

- **Ship server-rendered HTML, index a small curated set of high-value "hub" pages, and keep your thousands of generated puzzle instances OUT of the index** — this is both the correct technical architecture for Next.js and the way to stay on the right side of Google's March 2024 "scaled content abuse" policy. Individual auto-generated puzzles should be `noindex` or canonicalized; index technique guides, difficulty landing pages, a daily-puzzle hub, and your learning course.
- **Search is now a zero-click, AI-mediated environment**: 58.5% of US Google searches (and 59.7% in the EU) ended without a click per the SparkToro/Datos 2024 Zero-Click study, and SparkToro's follow-up found this rose to 68.01% in early 2026; Ahrefs' December 2025 study (300,000 keywords) found AI Overviews cut position-one CTR by 58%. The winning move is the same for classic SEO and AI/GEO: genuinely useful, well-structured, server-rendered content with strong internal linking and entity/brand signals. `llms.txt` is near-zero-cost to add but not yet respected by any major AI engine.
- **Your stack (Next.js App Router on Vercel) is excellent for SEO** if you use `generateMetadata`, `sitemap.ts`/`generateSitemaps` (50,000-URL split), `robots.ts`, JSON-LD, `next/image` and `next/font`. The subdomain (`puzzles.biscuitlab.net`) is not a fatal disadvantage but starts with no inherited authority — plan for a 6–12 month ramp on a new domain.

## Key Findings

1. **Google's pipeline is crawl → render → index → rank/serve**, with a rendering step that queues JS-heavy pages separately. Server-side rendering (SSR/SSG/ISR) puts content in the first HTML response so it doesn't wait in the render queue — critical for both Google and AI crawlers, most of which render JavaScript far less reliably than Googlebot.
2. **Scaled content abuse is the single biggest risk for a procedural puzzle site.** Google's policy targets "many pages generated for the primary purpose of manipulating search rankings and not helping users" and explicitly instructs owners to "exclude it from Search." The August 2025 spam update strengthened SpamBrain against near-duplicate sets.
3. **The documented winning pattern for puzzle/game sites is hub-and-spoke curated indexing**: index difficulty/category landing pages, technique/how-to guides, and a daily-puzzle archive; `noindex` thin/duplicate instances; canonicalize near-duplicates; use clean slugs not `?id=` parameters.
4. **AI search has structurally changed traffic expectations.** Even non-AI-Overview queries lost clicks; the top organic result still gets ~39.8% CTR when no AI Overview is present. Getting cited in AI answers requires answer-first content, structure, schema, freshness, and third-party mentions.
5. **Several rich-result types are gone.** FAQ rich results were fully deprecated (stopped appearing May 7, 2026); HowTo rich results were removed in September 2023. Keep the markup only for parsing value; do not expect SERP features.
6. **Core Web Vitals thresholds (2026, unchanged):** LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 at the 75th percentile of real users. INP replaced FID in March 2024. CWV is a confirmed but tie-breaker-level ranking factor.
7. **IndexNow gives you fast Bing/Yandex indexing; Google does not consume it.** For Google, rely on sitemaps, internal links, and Search Console.

## Detailed Sections

### 1. How search engines actually work (2026)

**The pipeline.** Google describes three official stages — crawling, indexing, serving/ranking — with rendering as a critical intermediate step. Googlebot starts from known URLs (previous crawls, sitemaps, Search Console), follows `<a href>` links, and queues JavaScript-heavy pages into a separate rendering queue where a recent Chromium engine executes JS. After rendering, Google processes text, `<title>`, alt attributes, structured data, and runs duplicate/canonical clustering before storing in the index. The vast majority of crawled URLs are never indexed — Google filters aggressively for duplicates, low value, and quality. Ranking is a layered stack (RankBrain, neural matching, BERT, MUM, learning-to-rank), not a single algorithm.

**Rendering models and indexing implications.**

- **CSR (client-side rendering):** near-empty HTML shell; content depends on JS execution in a deferred second wave that can take hours to weeks and sometimes fails. An SEO/AI-visibility liability for public content.
- **SSR:** full HTML per request — immediate, reliable indexing; best for dynamic/personalized content.
- **SSG:** pre-built HTML at build — fastest and most cacheable; ideal for stable content.
- **ISR (Incremental Static Regeneration):** SSG speed with periodic revalidation — the sweet spot for daily puzzles, leaderboards that update on a cadence, and archive pages.
- **Rule of thumb:** SSR or SSG/ISR for anything that must rank or be cited; CSR only for private areas (user dashboards, game-play state, account pages) that don't need indexing. On March 4, 2026 Google removed the old "design for accessibility / works without JS" note from its JavaScript SEO docs as outdated — but SSR/SSG remains the de-facto 2026 best practice because AI crawlers render JS poorly.

**Crawl budget.** The finite attention Google spends on a site, prioritized by link signals, freshness, and demonstrated value. It matters for sites with large numbers of generated/archive pages — exactly Puzzle Lab's situation. Thousands of thin, near-identical puzzle URLs waste crawl budget and can suppress crawling of your genuinely valuable pages. Fewer, stronger indexed pages beat a large index diluted with thin content (John Mueller: quality algorithms "look at everything that's indexed").

**Ranking systems.** The Helpful Content System stopped being a standalone classifier and merged into core ranking on March 5, 2024 — helpfulness assessment is now continuous and dispersed across systems. E-E-A-T (Experience, Expertise, Authoritativeness, Trust) is the conceptual framework used by human Quality Raters (the Quality Rater Guidelines were ~182 pages as of the September 11, 2025 version) to calibrate the algorithm; raters don't directly rank pages. Core updates (e.g., December 11, 2025; March and May 2026) reshuffle signal weights rather than introduce new rules. Spam policies (scaled content abuse, site reputation abuse, expired domain abuse) are enforced by SpamBrain.

**Other engines.** Bing powers ChatGPT Search and has the most mature IndexNow implementation. DuckDuckGo is primarily a Bing-syndicated index with a privacy layer — optimizing for Bing largely covers it. AI engines (Perplexity, Gemini, Claude) each have distinct sourcing logic (see §2).

### 2. AI Search / GEO

**How AI answers surface and cite content.** Google AI Overviews and Gemini pull from Google's index and lean toward already-ranking pages, established publishers, and structured data — so classic SEO investment transfers. Perplexity runs its own crawler, does real-time retrieval, and favors recent, structured, specific content, frequently citing pages Google ranks lower because it values extractability over domain authority. ChatGPT Search (Bing-powered) mixes training data with live browsing. Claude cites the least by design. Profound's/Averi's analysis of 680 million citations (100,000 identical prompts) found only 11.0% of domains cited by both ChatGPT and Perplexity; 37.4% of domains were cited exclusively by ChatGPT and 51.6% exclusively by Perplexity, with ChatGPT drawing 47.9% of its top-10 source share from Wikipedia versus Perplexity's 46.7% from Reddit. Superlines' 2026 study of 34,234 AI responses found a 46x gap in brand citation rates: ChatGPT 0.59%, Perplexity 13.05%, and Grok 27.01%. Platforms diverge sharply — you cannot win all of them with one asset.

**What improves citation likelihood:** answer-first blocks of ~40–60 words directly under question-style H2s; clear structure and lists; attributed statistics and named sources in copy; schema markup; freshness (Perplexity heavily weights content updated within the last year); and third-party consensus (mentions on Reddit, forums, review sites). Google published its AI Optimization Guide on May 15, 2026, stating that for Google Search "optimizing for generative AI is still SEO" and explicitly dismissing llms.txt, AI-specific Schema.org, content chunking, and inauthentic mentions.

**Zero-click and CTR data (flag: figures vary by source and methodology).** In 2025, 58.5% of US Google searches (and 59.7% in the EU) produced no click per the SparkToro/Datos study; SparkToro's follow-up on Similarweb clickstream data found this rose to 68.01% in the first four months of 2026. Ahrefs' December 2025 study (300,000 keywords, aggregated GSC data, by Ryan Law and data scientist Xibeijia Guan) found AI Overviews reduced position-one CTR by 58%, up from a 34.5% drop in April 2025 — "for every 100 clicks that would have gone to the first-ranking page in the past, only 42 clicks remain." Pew Research Center's July 2025 study (n=68,879 searches) found users clicked a traditional result only 8% of the time with an AI Overview present vs 15% without — a 47% relative CTR drop (Google disputes the methodology, saying the period overlapped algorithm testing). Interpretation: informational/top-funnel content is most exposed; the top organic result still earns ~39.8% CTR when no AI Overview appears. For a puzzle site, "how to solve X" content is exactly the exposed category — so pair it with the game itself (which requires a click to play) and with brand/entity building.

**llms.txt — honest assessment.** A community-proposed Markdown file (a summary plus curated links) with no standards-body backing. Adoption data is fragmented: SE Ranking's 300k-domain study found ~10.13% adoption; another study put it at ~2.13% of sites with 39.6% being plugin stubs. As of Q1 2026, no major AI company (OpenAI, Google, Anthropic, Meta, Mistral) has publicly committed to consuming it in production. OtterlyAI's 90-day server-log experiment found just 84 of 62,100+ AI-bot visits (0.1%) targeted `/llms.txt` — "three times worse than a normal page" (the average content page got ~265 bot visits) — and they removed it from their GEO audit checklist; this is corroborated by Limy.AI (408 hits of 515M bot events) and SE Ranking's XGBoost model on 300,000 domains (no measurable citation effect). Its real, documented value today is as a routing layer for AI coding agents (Cursor, Claude Code, Copilot). Verdict for Puzzle Lab: it costs about an hour, is a cheap forward-investment, and cannot hurt — implement a simple one but do not treat it as a priority or expect ranking/citation benefit.

**robots.txt for AI crawlers.** The lever that actually works today is `robots.txt` with per-user-agent rules. Major AI crawlers publish and respect their UA strings: GPTBot, ClaudeBot, CCBot, and Google-Extended (training), vs ChatGPT-User, Claude-User, and PerplexityBot (on-demand fetches for citation). Tradeoff: blocking training crawlers protects content from being absorbed into models but does little for you commercially; blocking citation/live-fetch bots (PerplexityBot, ChatGPT-User) removes you from AI answers entirely. For a small indie site trying to build visibility, **allow the citation/live-fetch bots**; blocking `GPTBot`/`CCBot` training crawlers is a values choice with minimal SEO cost. Note `Google-Extended` controls Gemini/Vertex training but does NOT affect AI Overviews or normal Search indexing.

### 3. On-page SEO implementation

- **Title tags:** unique per page, front-load the primary keyword, keep to roughly 50–60 characters (Google truncates around ~600 pixels). Use Next.js title templates for consistent branding.
- **Meta descriptions:** ~150–160 characters; not a ranking factor but drives CTR; Google frequently rewrites them. Write them anyway for your key pages.
- **Heading hierarchy:** one `<h1>` per page describing the page; logical `<h2>/<h3>` nesting; phrase headings as the questions users ask (helps both featured snippets and AI extraction).
- **Semantic HTML:** real `<a href>` links (not click handlers) so Googlebot discovers routes in wave one; `<nav>`, `<main>`, `<article>`, `<time>` for machine clarity.
- **URL structure:** short, lowercase, hyphenated, human-readable slugs (`/killer-sudoku/expert` not `/game?id=123`). Reflect your information architecture.
- **Internal linking:** distributes authority (PageRank). Link hubs → guides → play pages and back up; add contextual links from strategy articles to the relevant game modes. This is one of your highest-leverage, fully-controllable levers.
- **Canonical / pagination / duplicates:** critical here. Use `rel=canonical` to point near-identical puzzle variants at a canonical experience; `noindex` thin instances; avoid faceted-parameter URL explosions. Each indexed page must have a distinct reason to exist.
- **Images / alt text / CWV:** descriptive alt text; explicit width/height on every image to prevent CLS; lazy-load below-the-fold only (never the LCP element). **Core Web Vitals 2026:** LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 at the 75th percentile of real Chrome users (28-day CrUX window), measured separately for mobile and desktop. INP is the most-failed metric (interactive puzzle grids make this especially relevant — break long JS tasks, yield to the main thread). CWV is a confirmed ranking factor but functions as a tie-breaker, estimated at a modest share of signals.
- **Mobile-first indexing:** Googlebot crawls as a mobile device; the mobile version must contain the same content, links, and structured data as desktop. Mobile is where zero-click and CWV pressure are highest.

### 4. Structured data / Schema.org

**Relevant types for Puzzle Lab:**

- `WebSite` with `SearchAction` (sitelinks search box) and `Organization` on the homepage — establishes your entity.
- `VideoGame` or `Game` co-typed with `WebApplication`/`SoftwareApplication` for the game modes. Google does not show a rich result for a Software App that only has `VideoGame` type — co-type it (e.g., `["VideoGame","WebApplication"]`) and include `aggregateRating`/`offers` where truthful.
- `BreadcrumbList` on all pages (still produces breadcrumb rich results — supported).
- `HowTo` and `FAQPage` — keep for parsing/AI value only; **no visible rich results** (HowTo removed September 2023; FAQ stopped appearing May 7, 2026, with Search Console/Rich Results Test support removed June 2026 and API support August 2026). Do not add fake FAQ blocks for SERP real estate.
- `Course`/`LearningResource` for your Sudoku strategy course (note: Google retired "Course Info" as a *rich result* in June 2025, but the schema still carries semantic/AI value).
- `Article` for strategy guides, with a real, verifiable author entity (E-E-A-T).

**Still producing rich results (2026):** Product, Review/AggregateRating, Article, Recipe, Video, Organization, LocalBusiness, Breadcrumb, and roughly two dozen documented types.

**Implementation:** JSON-LD in a `<script type="application/ld+json">`, rendered server-side via a reusable server component so it's in the first HTML. **Validate** with Google's Rich Results Test and the Schema.org validator; monitor the Enhancements reports in Search Console.

### 5. Next.js App Router specific implementation

**Metadata API.** Use static `export const metadata` in layouts for site-wide defaults and `generateMetadata` in dynamic routes for per-page titles/descriptions/canonicals/OG. Set `metadataBase: new URL('https://puzzles.biscuitlab.net')` in the root layout so relative OG/canonical URLs resolve correctly. Use `title.template` (e.g., `%s · Puzzle Lab`) with a `title.default`. Metadata is Server-Components only — do not try to set it from `'use client'` components (a common pitfall that reintroduces the old race condition where Google indexes before tags inject).

```ts
// app/layout.tsx
import type { Metadata } from 'next'
export const metadata: Metadata = {
  metadataBase: new URL('https://puzzles.biscuitlab.net'),
  title: { default: 'Puzzle Lab — Daily Killer Sudoku, KenKen & Sudoku', template: '%s · Puzzle Lab' },
  description: 'Play daily Killer Sudoku, KenKen/Calcudoku and Classic Sudoku with streaks, leaderboards and achievements.',
  alternates: { canonical: '/' },
}
```

```ts
// app/killer-sudoku/[difficulty]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const { difficulty } = await params
  return {
    title: `Killer Sudoku — ${difficulty}`,
    description: `Play ${difficulty} Killer Sudoku puzzles with hints, notes and leaderboards.`,
    alternates: { canonical: `/killer-sudoku/${difficulty}` },
  }
}
```

**Dynamic OG images with `next/og`.** Add an `opengraph-image.tsx` in a route segment and use `ImageResponse` (JSX/HTML/CSS → PNG) to render per-puzzle or per-difficulty social cards at the edge — great for shares of daily puzzles and streaks.

```tsx
// app/killer-sudoku/[difficulty]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export default async function Image({ params }) {
  const { difficulty } = await params
  return new ImageResponse(
    (<div style={{ display: 'flex', /* ... */ }}>Killer Sudoku · {difficulty}</div>),
    { ...size }
  )
}
```

**`sitemap.ts` and `robots.ts`.** Generate the sitemap dynamically from Neon/Drizzle. Google's sitemap limits are **50,000 URLs / 50MB uncompressed** per file — split with `generateSitemaps`, which produces `/sitemap/0.xml`, `/sitemap/1.xml`, etc.

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next'
const BASE = 'https://puzzles.biscuitlab.net'
const PER = 50000
export async function generateSitemaps() {
  const total = await getIndexablePuzzleCount() // only pages you actually index
  return Array.from({ length: Math.ceil(total / PER) }, (_, id) => ({ id }))
}
export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const rows = await getPuzzlesSlice(id * PER, PER) // Drizzle query
  return rows.map(r => ({ url: `${BASE}/${r.slug}`, lastModified: r.updatedAt }))
}
```

Note: Next.js does not auto-generate a top-level `sitemap-index.xml` linking the split files in all versions — for a large dynamic set you can instead define your own index via a `route.ts` handler, or list each `/sitemap/N.xml` in Search Console/robots. Only list pages you actually want indexed (exclude `noindex` puzzle instances). Google ignores `<priority>` and `<changefreq>`; `<lastmod>` is the field that matters.

```ts
// app/robots.ts
import type { MetadataRoute } from 'next'
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/account/', '/play/state/'] },
      { userAgent: 'PerplexityBot', allow: '/' },
    ],
    sitemap: 'https://puzzles.biscuitlab.net/sitemap.xml',
    host: 'https://puzzles.biscuitlab.net',
  }
}
```

**Dynamic routes, `generateStaticParams`, ISR.** Pre-render your indexable hubs and daily puzzle with `generateStaticParams`; use ISR (`export const revalidate = 3600` or on-demand `revalidatePath`) so daily puzzles and leaderboards refresh without a full rebuild. Trigger daily generation and on-demand revalidation from Vercel Cron. Keep interactive game state client-side but render the page shell, title, description, and instructional content server-side.

**`next/image` and `next/font`.** `next/image` gives automatic sizing, lazy-loading, and modern formats — add `priority` to the LCP image, always pass width/height (prevents CLS). `next/font` self-hosts fonts with zero layout shift and no render-blocking external requests (use `display: 'swap'`).

**Common Next.js SEO pitfalls:** metadata in client components; title set in `useEffect`; lazy-loading the LCP element; navigation via buttons/router events instead of `<a href>`; forgetting `metadataBase` (breaks absolute OG URLs); shipping a static `public/sitemap.xml` that goes stale; hydration failures that blank server-rendered content.

### 6. Indexing strategy for procedurally generated content (critical)

**Google's line.** Scaled content abuse = "many pages generated for the primary purpose of manipulating search rankings and not helping users." Google explicitly says: if you host such content, "exclude it from Search." AI-generated or programmatic content is *not* inherently banned — the test is intent and per-page value. The March 2024 spam update (enforced from May 2024) reportedly cut unoriginal results ~40%; August 2025 strengthened detection of near-duplicate sets.

**Documented winning pattern for puzzle/game sites (hub-and-spoke curated indexing).** Ranktracker's puzzle-site SEO playbook (Felix Rose-Collins, August 13, 2025) prescribes exactly this: a "Puzzle Games" hub with sub-hubs per family (Sudoku, Killer Sudoku, KenKen), each linking down to game pages and up to the hub; "one URL per game/version/difficulty set… no `/game?id=123` patterns"; and under technical SEO, "Noindex thin or duplicate variants" and "Consolidate duplicate… variants; keep one canonical per unique experience." This matches broad programmatic-SEO consensus: "a smaller, high-quality indexed inventory consistently outperforms a large index with thin content mixed in" (Digital Applied), and "not every generated page deserves indexing — use noindex for thin pages and canonical tags for near-duplicates" (EcomSEO), which notes March 2024 "deindexed entire sites that relied on auto-generated pages with minimal value."

**What Puzzle Lab should index vs noindex:**

- **INDEX (curated hubs, genuine value):** homepage; per-mode landing pages (Killer Sudoku, KenKen/Calcudoku, Classic Sudoku); per-difficulty pages with editorial intros; the daily-puzzle page and a daily archive hub (each daily puzzle has a date, an editorial note, and permalink — legitimately unique); technique/how-to-play guides; glossary/strategy pages; the learning course.
- **NOINDEX (thin/near-duplicate/utility):** individual generated puzzle instances that differ only by grid data; play-state URLs; filtered/paginated variants; internal search results.
- **CANONICAL:** near-duplicate variants (e.g., language/region or trivial parameter variants) → their canonical experience.
- **User-generated pages (leaderboards/profiles):** default to `noindex`. Public profiles/leaderboards are thin, near-duplicate, and raise privacy questions (Lichess's founder Thibault Duplessis, in a forum reply, offered only an *opt-in* per-user `noindex` toggle rather than a blanket policy — but for a new small site, noindexing them by default is safer for site-quality signals and privacy). If you later want a flagship leaderboard indexed, make one canonical, content-rich version.

**Adding genuine value to templated pages** (so the hubs you DO index are not thin): unique editorial intro per difficulty/mode; embedded strategy tips relevant to that variant; solve-rate/average-time stats (proprietary data is a strong quality signal); a worked example; FAQ text (as prose, since FAQ rich results are gone); internal links to relevant guides.

**Phased publishing.** Real programmatic case data (theStacc: 512 pages over 18 months) shows glossary pages indexed at 94% but thin combo pages only 73%, many stuck in "Crawled – currently not indexed," and that "bulk publishing 100+ pages at once tanks indexing rates" — so publish/expose indexable hubs gradually, not all at once.

**Comparable sites (observed patterns, some inferred):** Web Sudoku advertises "billions of free puzzles" but serves individual puzzles via query-string URLs (`?level=…`), consistent with indexing difficulty landing pages rather than every instance. NYT keeps puzzles inside a paywalled Games product with a single archive rather than thousands of indexed public pages — third-party sites fill the "answers/archive" SERP gap. Lichess (Domain Rating ~82, ~2.7M organic visits per Ahrefs) historically indexed meaningful pages and considered only opt-in noindex for user pages. (Caveat: we could not verify the literal current `robots.txt` of Lichess or NYT.)

### 7. Technical SEO operations

- **Google Search Console:** verify the `puzzles.biscuitlab.net` property (DNS TXT is cleanest for a subdomain, or a Vercel-served HTML file/meta tag). Submit your sitemap(s). Key reports: Page Indexing (watch "Crawled – currently not indexed" and "Discovered – currently not indexed" for your generated pages — that's Google telling you they're thin), Performance (queries/CTR/position), Core Web Vitals, and Enhancements (structured data). Use URL Inspection to see rendered HTML Googlebot gets and to request indexing of new hubs.
- **Bing Webmaster Tools + IndexNow:** verify in BWT (you can import from GSC). Implement IndexNow (host a `{key}.txt` file at the domain root; POST changed URLs to `api.indexnow.org`, up to 10,000/call). It gives near-instant discovery on Bing, Yandex, Seznam, Naver — and Bing powers ChatGPT Search, so this helps AI visibility. **Google does not consume IndexNow.** Only submit genuinely new/changed indexable URLs, not every generated puzzle.
- **Log file analysis:** on Vercel, use runtime logs / a log drain to see which URLs Googlebot and AI bots actually fetch, spot crawl waste on noindexed instances, and confirm bots aren't stuck. Screaming Frog can spoof GPTBot to compare what an AI crawler sees vs Googlebot.
- **Common issues:** soft 404s (empty/failed puzzle pages returning 200 — return proper 404/410); redirect chains (keep to one hop); HTTPS everywhere (automatic on Vercel); pick one canonical host and 301 the rest; `hreflang` only if you add real localized versions.
- **Subdomain vs subfolder.** Google says it treats both equally (John Mueller and, earlier, Matt Cutts have said so repeatedly), but real-world consensus (Ahrefs, Backlinko) is that subdomains are treated as somewhat separate entities that must build authority more independently, so a subfolder on the apex domain (`biscuitlab.net/puzzles`) would typically consolidate authority faster. **Practical verdict for Puzzle Lab:** the subdomain is a mild disadvantage, not disqualifying. If `biscuitlab.net` is an established brand with authority, moving to a subfolder would help most; if the app must stay on its own subdomain for architectural reasons, mitigate by tightly interlinking with the main site, verifying the subdomain separately in GSC, and being consistent (don't migrate URL structure later — that resets the clock).

### 8. Content and off-page SEO

**Keyword research (free-first workflow).** Start with Google Search Console (find queries where you already rank on page 2–3 and push them up), Google autocomplete + "People Also Ask", and Google Keyword Planner (free inside Google Ads). Add a low-cost tool for difficulty scoring — Mangools/KWFinder is the most beginner-friendly for finding low-competition long-tail terms a new site can actually rank for; LowFruits specifically flags SERPs weak enough for a new domain to beat. Classify intent: informational ("how to solve killer sudoku"), navigational ("puzzle lab"), transactional/experiential ("play killer sudoku online"). For a new site, target long-tail (3–5+ words) with clear intent — that's where a zero-authority domain can win first.

**Content that actually ranks for puzzle sites:** how-to-play pages per mode; strategy/technique guides ("killer sudoku cage combinations", "KenKen strategies"); difficulty explainers; a glossary of terms; solved-example walkthroughs; and the daily puzzle. These map to the hubs you index. Interactive "play now" pages satisfy experiential intent and require a click (insulating them from zero-click erosion).

**The Sudoku strategy learning course.** Structure it as an indexable, hub-and-spoke content asset: a course landing page (with `Course`/`LearningResource` schema and a clear outline), one indexable lesson page per technique (naked singles, hidden pairs, cage sums, X-wing, etc.), each with an answer-first summary, a worked interactive example, and internal links to the relevant game mode. This is your strongest E-E-A-T and GEO play — technique lessons are highly citable in AI answers and target long-tail informational queries. Keep interactive drills client-side but render lesson text and headings server-side.

**Link building (2026, realistic for a small indie site):** what works legitimately — digital PR (a genuinely novel angle, e.g., publish original data on average solve times or a "hardest generated puzzle" analysis), being listed in puzzle/game directories and "best free sudoku sites" roundups, community engagement (Reddit r/sudoku, puzzle forums — which also feeds Perplexity/ChatGPT citations), guest posts on puzzle/education blogs, and creating genuinely link-worthy free tools (a solver, a technique trainer). Avoid: paid link schemes, PBNs, mass directory spam, exact-match anchor manipulation. Realistic expectation: a handful of quality links in year one matters more than volume; links compound slowly.

**Brand/entity building.** Increasingly decisive — E-E-A-T and AI citation both reward recognizable entities. Establish a consistent brand name, an `Organization` schema, an author entity for your guides (a real person with verifiable presence), consistent NAP/social profiles, and ideally a Wikidata/knowledge-graph presence over time. Branded search demand itself is a strong quality signal.

### 9. Measurement

**Key metrics and interpretation:** impressions and average position (GSC) show visibility trend before clicks arrive; CTR by query shows title/description effectiveness; indexed-page count vs submitted (are your hubs getting in, are instances staying out?); Core Web Vitals field data; and engagement (return visits, streak retention) which correlates with the "information gain"/helpfulness signals Google now emphasizes.

**Analytics options (privacy-friendly).** For a Vercel + indie setup: **Vercel Analytics** is zero-config, cookie-free, includes Web Vitals broken down by route, and needs no consent banner — the path of least resistance. **Plausible** (cloud from ~$9/mo or self-host) is a polished, ~1KB, cookie-free GA alternative with GSC integration and goals/funnels. **Umami** (MIT, self-host free on your Neon Postgres + Vercel) gives full data ownership. All three avoid GA4's complexity, cookie banners, and ~45KB script. **Recommendation:** Vercel Analytics for Web Vitals + Plausible or Umami for product/traffic analytics; skip GA4 unless you specifically need its ad-network integrations.

**Tracking AI referrals:** watch referrer traffic from `chatgpt.com`, `perplexity.ai`, `gemini.google.com`, and `copilot.microsoft.com` in your analytics; note AI Overview clicks are largely invisible (they appear as normal Google organic). GEO-specific trackers exist but aren't essential for a small site — manual prompt-testing on your target queries is a reasonable substitute.

**Realistic timelines.** New domains face a de-facto "sandbox"/trust-building period. Google publicly denies a formal sandbox but advises expecting **4 months to a year** before SEO shows results. Realistic phasing: indexing within days–weeks of sitemap submission; first movement on low-competition long-tail terms around months 3–6; meaningful traffic months 6–12; competitive terms 9–12+ months. A subdomain with no inherited authority sits at the longer end. IndexNow/Bing and AI engines (Perplexity can cite within days) may surface you faster than Google.

## Staged Recommendations

**Stage 0 — Foundations (week 1, do first).**

1. Decide indexing policy: index curated hubs, `noindex` all individual generated puzzle instances and user/leaderboard pages by default. Implement via per-route `robots` metadata.
2. Root-layout `metadata` with `metadataBase`, title template, and default description; `generateMetadata` on every indexable dynamic route with a self-referencing canonical.
3. `robots.ts` (allow crawl of public hubs; disallow `/api/`, account, play-state; allow PerplexityBot/ChatGPT-User) and dynamic `sitemap.ts` listing ONLY indexable pages, split with `generateSitemaps` at 50k.
4. Verify GSC (DNS) and Bing Webmaster Tools; submit sitemaps.
5. Ensure hubs are SSR/SSG/ISR with real `<a href>` navigation; keep game interactivity client-side.

**Stage 1 — Quick wins (weeks 2–4).**
6. JSON-LD: `WebSite`+`SearchAction`, `Organization` (home); `VideoGame`+`WebApplication` (game modes); `BreadcrumbList` (all). Validate in Rich Results Test.
7. Core Web Vitals: `priority` + explicit dimensions on LCP image, `next/font` with swap, break long JS tasks in the puzzle engine for INP. Confirm in GSC CWV + Vercel Analytics.
8. Write 3–5 cornerstone guides (how-to-play per mode, one strategy guide) with answer-first sections, real author, internal links to play pages.
9. Add dynamic `opengraph-image.tsx` for daily puzzles/difficulty pages (social shares → early links/traffic).
10. Implement IndexNow; add a minimal `llms.txt` (cheap, optional).
11. Install Vercel Analytics + Plausible/Umami.

**Stage 2 — Content & authority (months 2–6).**
12. Build the Sudoku strategy course as indexable lesson hubs with `Course`/`LearningResource` schema — your flagship E-E-A-T/GEO asset.
13. Add proprietary data to difficulty/daily pages (solve rates, average times) — genuine value + citation bait.
14. Long-tail keyword program: one guide per validated low-competition term (Mangools/LowFruits + GSC page-2 opportunities). Publish steadily, not in bulk.
15. Community/digital-PR: engage r/sudoku and puzzle forums, pursue directory listings and "best free sudoku" roundups, pitch one original-data story.

**Stage 3 — Scale & refine (months 6–12+).**
16. Monitor "Crawled/Discovered – currently not indexed" — if hubs stay out, deepen their content; if instances leak in, tighten noindex/canonical.
17. Log-file/crawl audit; fix soft 404s and redirect chains.
18. Reassess whether a subdomain→subfolder move is worth it if `biscuitlab.net` has authority.
19. Track AI referrals and prompt-test target queries; expand the most-cited formats.

**Benchmarks that change the plan:** if a page type sits in "Crawled – currently not indexed" >8 weeks, it's too thin — merge or enrich it. If INP >200ms in field data, prioritize JS refactoring before more content. If, after 6 months, zero long-tail rankings appear, audit indexation and internal linking before assuming a sandbox. If AI referrals are material, double down on answer-first structure and freshness.

**Common indie-developer traps:** setting metadata in client components; indexing everything ("more pages = more traffic" — false and dangerous post-March-2024); adding fake FAQ schema for dead rich results; chasing `llms.txt` while ignoring server rendering; buying links; expecting results in weeks; letting the sitemap go stale; blocking JS/CSS that Googlebot needs to render.

## Caveats / Open Questions

- **CTR/zero-click figures vary widely by source and methodology** (Ahrefs, Seer, Pew, Similarweb, SparkToro differ, and Google disputes Pew's methodology); treat specific percentages as directional, not precise. The consistent, reliable finding is a large downward pressure on informational CTR from AI Overviews.
- **`llms.txt` and AI-crawler behavior are fast-moving and unstandardized;** no major engine confirms consuming llms.txt in production as of mid-2026, and Google's May 15, 2026 AI Optimization Guide explicitly says it is not needed. Revisit in 6–12 months.
- **We could not verify the literal current `robots.txt` of Lichess, NYT, or Web Sudoku;** comparable-site patterns are partly inferred from observable URL structures plus one founder forum statement.
- **Google's exact "safe" threshold for programmatic content is undocumented** — the "≥60% unique content / 3+ sources" figures circulating in industry blogs are heuristics, not Google policy. The only official test is intent + genuine per-page value.
- **Core update volatility:** ranking weights shift with each core update (Dec 2025, March/May 2026); expect fluctuation and annotate updates in GSC.
- **Some cited statistics come from SEO vendor blogs rather than primary research;** primary/authoritative anchors here are Google Search Central, Next.js docs, web.dev CWV thresholds, schema.org, the IndexNow spec, and Search Engine Land/Journal reporting.

---
*Note: The task requested saving this artifact as a markdown file to /mnt/user-data/outputs/. No file-writing tool was available in this environment, so the complete report is delivered inline above; copy it into `puzzle-lab-seo-research.md` to save it locally.*
