# Technical SEO Decision Brief: Sitemap Architecture & Page Selection for Biscuit Lab (Next.js Multi-Zone)

## TL;DR / VERDICT

**Fork 1 — Choose Option B (two independent sitemaps, both advertised in robots.txt).** For a site with well under 100 URLs split across two independently-deployed Next.js zones, a hand-rolled sitemap index buys you nothing that two `Sitemap:` lines in robots.txt don't already deliver. Google's own robots.txt spec is explicit: "You can specify multiple sitemap fields, with no limit to the number of sitemaps you can include." Option B keeps the hub's existing framework-generated `app/sitemap.ts` untouched (less code to break), avoids the documented Next.js failure mode of hand-rolling `app/sitemap.xml/route.ts` alongside the special file, and is fully protocol-valid. The single strongest reason: **the index file solves a problem you do not have (50,000-URL fan-out) while adding a hand-maintained root file that can silently drift out of sync with its children.**

**Fork 2 — Sitemap IN: `/puzzles/`, `/puzzles/daily`, `/puzzles/leaderboard`, `/puzzles/archive`, `/puzzles/play`, `/puzzles/generate`.** All six curated landing surfaces belong in the sitemap. The two contested pages (`/play`, `/generate`) are your marquee tool and a link-magnet utility that map directly to high-volume transactional intent ("play sudoku online", "printable sudoku PDF") — the search-demand upside outweighs thin-content risk **provided each renders real server-side content**. Add `robots: { index: false }` to `/puzzles/signin` and `/puzzles/account`, and keep both out of the sitemap. The single strongest reason: **omitting a page from the sitemap does not deindex it, and including one does not guarantee indexing — so the sitemap should reflect your canonical set of "pages I want in search," and the real indexation levers are internal linking, render quality, and noindex hygiene.**

---

## EVIDENCE FOR FORK 1 — SITEMAP ARCHITECTURE

### 1. Do Google and Bing honor multiple `Sitemap:` directives in one robots.txt?

**Yes, unambiguously, per primary documentation.** Google's robots.txt specification states: "You can specify multiple sitemap fields, with no limit to the number of sitemaps you can include. The sitemap field isn't tied to any specific user agent and may be followed by all crawlers." Google's own example shows three `sitemap:` lines including one on a different host. Google's "Build and Submit a Sitemap" doc reiterates: "You can specify multiple sitemap lines, and there's no limit to the number of sitemaps you can include in your robots.txt file."

The sitemaps.org protocol (the canonical spec jointly supported by Google, Yahoo, and Microsoft since November 2006) confirms: "You can specify more than one Sitemap file per robots.txt file." Bing uses the standard sitemaps.org protocol and honors the same `Sitemap:` directive; Bing additionally recommends referencing your sitemap in robots.txt for auto-discovery.

**RFC 9309** (the IETF Robots Exclusion Protocol standard, authored by M. Koster, G. Illyes, H. Zeller, and L. Sassman, September 2022) does not itself define the `Sitemap` field — it is technically out of scope of the formal grammar. RFC 9309 says: "Crawlers MAY interpret other records that are not part of the robots.txt protocol — for example, 'Sitemaps'… Parsing of other records MUST NOT interfere with the parsing of explicitly defined records… a 'Sitemaps' record MUST NOT terminate a group." So the `Sitemap:` line is a well-supported extension, not part of the ratified core grammar — but all major engines honor it.

**Is there any documented discovery/crawling disadvantage vs. a sitemap index? No.** No primary source documents any crawl or discovery penalty for using multiple robots.txt `Sitemap:` lines instead of an index file. Both are first-class discovery mechanisms.

### 2. At what scale does a sitemap index become necessary or beneficial?

The index file exists to solve a **file-size/URL-count** problem, not a multi-file organizational one. The sitemaps.org protocol sets the hard limits: "Sitemaps should be no larger than 50MB (52,428,800 bytes) and can contain a maximum of 50,000 URLs." When you exceed those, you split into multiple sitemaps and list them in an index. Google's large-sitemaps doc frames the index purely as the mechanism for managing that split: "When a sitemap exceeds size limits, split it into smaller sitemaps. Use a sitemap index file to manage and submit multiple sitemaps simultaneously."

**There is no evidence of any benefit at small scale (<100 URLs).** At Biscuit Lab's scale, both zones fit comfortably in a single `<urlset>` each, and the whole site fits in one file. The index adds structure with zero crawl-efficiency payoff.

### 3. Operational/reporting differences in Google Search Console

This is the one genuine, documented distinction — and it modestly **favors Option B** for a two-zone site. Per the GSC Sitemaps report documentation: when you submit a sitemap **index**, the URL count shown "is the count of all URLs in all child sitemaps" — i.e., aggregated. GSC does surface child sitemaps of a submitted index in the Sitemaps report, and you can open per-sitemap coverage. However, the Page Indexing report's **sitemap filter** lets you segment by "Specific sitemap URL." Submitting the two sitemaps **separately** gives you two clean, independently-selectable filter buckets in the Page Indexing report from the moment you submit — you don't have to wait for Google to crawl and expand the index's children first. Google's own Search Central community explicitly addresses "whether there's a benefit or a disadvantage to submitting multiple sitemaps, clarifying how Google handles them for discovery versus how you can leverage separate submissions for better diagnostics." The takeaway from Google's guidance: submitting individual sitemaps is a legitimate diagnostics lever, and there's no harm in it.

### 4. CRITICAL — Cross-submission and path-scope rules

**(a) Can a root index legitimately reference a child at `/puzzles/sitemap.xml`? Yes.** Google's large-sitemaps doc: "Sitemaps that are referenced in the sitemap index file must be in the same directory as the sitemap index file, or lower in the site hierarchy. For example, if the sitemap index file is at `https://example.com/public/sitemap_index.xml`, it can only contain sitemaps that are in the same or deeper directory." A root index at `biscuitlab.net/sitemap.xml` referencing `biscuitlab.net/sitemap-pages.xml` (same dir) and `biscuitlab.net/puzzles/sitemap.xml` (deeper) is valid on both counts. Option A is protocol-valid.

**(b) Do cross-submission rules affect either option?** Cross-submission rules concern URLs on a *different host*. Here everything is on the single host `biscuitlab.net`, so cross-submission is not triggered at all. (For completeness: the sitemaps.org protocol and Google's 2007–2008 cross-submission blog posts establish that a sitemap can list URLs for another host only if you prove ownership — via a robots.txt reference on that host, or GSC verification. Google's own words: by default you'd get a "cross submission error" for another host unless you "prove that you own" it. Not relevant to a single-host multi-zone.)

**(c) Does the path-scoping rule create a problem for Option B? No.** The scope rule is: a sitemap can only list URLs at or below its own path. sitemaps.org: "If the Sitemap is located at `http://www.example.com/myfolder/sitemap.xml`, it can't include URLs from `http://www.example.com`." In Option B:

- `biscuitlab.net/sitemap.xml` (root) lists hub URLs (root-level and `/log`, `/blog/*`) — all at or below root. ✔ Valid.
- `biscuitlab.net/puzzles/sitemap.xml` lists only `/puzzles/*` URLs — all at or below `/puzzles/`. ✔ Valid.

Both sitemaps are perfectly path-scoped by construction. **Important nuance:** Google has publicly relaxed strict enforcement of the path/host rule — Google's robots.txt spec notes the sitemap URL in robots.txt "doesn't have to be on the same host as the robots.txt file," and Google is lenient about scope when ownership is clear via Search Console. But you do not need to rely on any relaxation: **both options are strictly compliant with the original protocol.** This is a case where the strict rule and Google's relaxed behavior both bless your setup.

### 5. Next.js-specific gotchas

**The `app/sitemap.ts` special file DOES conflict with a hand-rolled `app/sitemap.xml/route.ts`.** This is documented in the Next.js repo (issue #45947): using `robots.txt` and `sitemap.xml` as route handlers in the app directory throws "TypeError: Cannot read properties of undefined" at build in some configs, and issue #78609 shows Turbopack throwing "Conflicting page and metadata at /sitemap" in similar scenarios. Both the special file (`app/sitemap.ts`) and a route handler (`app/sitemap.xml/route.ts`) resolve to the same `/sitemap.xml` path — you must pick one, never both. **Option A requires deleting the hub's working `app/sitemap.ts` and replacing it with hand-written route handlers** — precisely the fragile path these issues describe. Option B leaves the special file in place.

- `sitemap.ts` (and `sitemap.js`) is, per Next.js docs, "a special Route Handler that is cached by default unless it uses a Request-time API or dynamic config option" — so Next.js already emits the correct `Content-Type` and static output for you. Hand-rolled route handlers require you to manually set `headers.set("Content-Type", "application/xml")`, a documented manual step (Next.js discussion #50419).
- **`generateSitemaps()` cannot fan out across apps** — confirmed. Next.js docs: it produces numbered files like `/product/sitemap/1.xml` within a single application; it has no mechanism to reference a sitemap in a *different* Next.js deployment, and it does not emit a `<sitemapindex>` root automatically (Next.js discussions #61025 and #61448 both confirm the framework does not generate a sitemap-index file for you). This is exactly why Option A's index "MUST be hand-rolled" — correct analysis, and an argument *against* the added complexity.
- **Multi-zone URL resolution:** In the PG zone, `basePath: '/puzzles'` prefixes all pages, relative links, and Next.js assets automatically (Next.js multi-zones docs; `with-zones` example README: "A basePath will prefix all pages in the application with the basePath automatically, including relative links"). But the `sitemap.ts` `url` field must be an **absolute URL** ("relative paths won't validate"; "Google rejects sitemaps containing relative paths") and `basePath` is NOT auto-prepended to the string literals you build inside `sitemap.ts`. You must hard-code the full `https://biscuitlab.net/puzzles/...` URLs (or derive them from an env var) yourself. The zone serves its sitemap at `/puzzles/sitemap.xml` because `basePath` prefixes the special-file route.
- **Multi-zone rewrite interaction:** The hub app owns the domain and rewrites `/puzzles/:path*` to the PG deployment. You must ensure the rewrite covers `/puzzles/sitemap.xml` (it will, if you rewrite `/puzzles/:path+`). In Next.js 15 the extra static-asset rewrite for `assetPrefix` is "no longer necessary" (Next.js multi-zones docs); in versions <15 you also needed a `beforeFiles` rewrite for `/_next` assets.
- **robots.txt lives at the root/hub only.** Because `basePath` would push a PG `public/robots.txt` to `/puzzles/robots.txt` (documented in Next.js discussion #35562), the authoritative `robots.txt` must be generated by the hub app. The hub's `robots.ts` is where both `Sitemap:` lines belong.

### 6. What authoritative sources actually recommend for small sites

There is **rough consensus that the sitemap-index-vs-multiple-sitemaps choice is immaterial at small scale**, and that sitemaps overall are optional for small, well-linked sites:

- **Google Search Central documentation** ("Learn about sitemaps," updated 2025-12-10): "If your site's pages are properly linked, Google can usually discover most of your site." You "might not need a sitemap" if your site is "small… about 500 pages or fewer" and "comprehensively linked internally."
- **John Mueller (Google), 2011:** "With a site of that size, you don't really need a sitemap file. We'll generally be able to crawl and index everything regardless." *(Sourced via secondary SEO aggregators; the original hangout transcript could not be independently confirmed — see Caveats.)*
- **John Mueller (Google), November 10, 2020 (counter-position, from his own X/Twitter post):** "Making a sitemap file automatically seems like a minimal baseline for any serious website, imo." Barry Schwartz (Search Engine Roundtable) reconciled the two: small serious sites still qualify — have one, but don't stress about it.
- **Daniel Waisberg (Google Search Advocate):** websites don't need a sitemap if they are small and linked properly, but a sitemap helps if the site is very large, has isolated pages, or is new/changes quickly.
- **Gary Illyes (Google):** the sitemap `<priority>` tag is "essentially a bag of noise" — don't invest effort in priority/changefreq.

The practical consensus: **have a sitemap (it's cheap and Google reads it), but don't over-engineer its structure at this scale.** No authoritative source recommends a sitemap index for a sub-100-URL site.

### 7. Maintenance/robustness

- **Hand-written XML vs. framework-generated:** Option A's hand-rolled index and `sitemap-pages.xml` must be manually kept in sync with the hub's actual pages. Option B keeps the hub on framework-generated `app/sitemap.ts`, which regenerates from code. Framework generation is more robust against human error.
- **`<lastmod>` accuracy:** Google's sitemap doc states: "Google uses the `<lastmod>` value if it's consistently and verifiably (for example, by comparing to the last modification of the page) accurate." Gary Illyes (July 16, 2026, on Bluesky, per Search Engine Roundtable) said a site with unintentionally wrong dates is "probably better off without the lastmods. at least you save a few bytes," and characterized the trust as **binary**: "it's binary, or at least was last time I checked. we either trust it or not" (June 2024, LinkedIn). **Recommendation:** only emit `lastmod` where you can tie it to a real content-modification timestamp (e.g., blog post updated date, daily puzzle publish date). For static landing pages that rarely change, either set an accurate hard-coded date or omit `lastmod` entirely — do NOT use `new Date()` at build time on unchanged pages, which manufactures false freshness and can poison Google's trust in the signal site-wide.
- **Drift risk:** Option A introduces a specific failure mode — the index and its children drifting out of sync (e.g., you rename a child sitemap and forget to update the index). Option B has no index, so no drift.
- **Scaling:** If the puzzle zone later grows to thousands of URLs, the PG zone's own `app/sitemap.ts` can adopt `generateSitemaps()` internally to split into `/puzzles/sitemap/0.xml`, `/puzzles/sitemap/1.xml`, etc. — and you simply update or add the `Sitemap:` line(s) in robots.txt. Option B scales cleanly without ever needing a cross-app root index.

---

## EVIDENCE FOR FORK 2 — WHICH PUZZLE LAB PAGES BELONG IN THE SITEMAP

**Framing principle (Research Q7):** Being in a sitemap ≠ being indexed. Google's docs are explicit that a sitemap is a **hint**, not a directive: "submitting a sitemap is merely a hint: it doesn't guarantee" crawling or indexing. Conversely, omitting a page does NOT prevent indexing — Google routinely indexes URLs found via internal links (GSC's "Indexed, not submitted in sitemap" status documents exactly this). So the functional consequence of each page-set choice is modest: the sitemap is best understood as **your declared canonical set of "pages I consider important enough for search."** The heavy lifting for indexation is done by internal linking, render quality, and noindex hygiene.

### `/puzzles/` — **IN** (uncontested)

Core landing page, primary "sudoku / puzzle" intent target. Include with an accurate or omitted `lastmod`.

### `/puzzles/daily` — **IN** (uncontested)

Maps to the "daily/recurring" search intent cluster ("daily sudoku", "today's puzzle"). Fresh-cadence pages benefit from being in the sitemap. Include.

### `/puzzles/play` — **IN** (contested → include, with conditions)

**Verdict: IN.** This is the marquee interactive surface and maps to the highest-volume transactional query cluster: "play sudoku online", "sudoku online free", "free sudoku". Industry evidence shows this is exactly how successful competitors structure their sites — the interactive board doubles as the transactional landing page. Concrete competitor examples: sudokuonline.io's homepage title is verbatim "Sudoku Online | Free Sudoku Puzzles to Play Online," and sudokubliss.com's is "Sudoku Online - Solve Web Sudoku Puzzles | 100% Free." The traffic on these interactive surfaces is very large: per Similarweb (April 2026), sudoku.com draws roughly 32.4M total visits/month (Global Rank ~#2,488; #4 in Games > Puzzles in the US) at 2.86 pages/visit, while Ahrefs shows livesudoku.com at ~488K and sudokuonline.io at ~88K monthly visits. Livesudoku itself states it "was created by Hagai Izenberg in 2006 and has grown into a home for over 100,000 sudoku players worldwide." A puzzle-gaming SEO guide (Ranktracker) explicitly advises treating each game page "like a high-intent landing page" for "play now" transactional intent ("Play {Game Name} Online – Free {Puzzle Type} No Download").

**Conditions / risks to mitigate:**

- **Soft-404 / thin-content risk:** Google can flag "interactive tools… where the primary content is non-textual" as soft 404s if the crawled HTML is near-empty. **Mitigation:** ensure `/play` renders meaningful server-side content on first load — an H1, rules/how-to-play text, difficulty options, internal links — not just an empty JS canvas.
- **JS-rendered state:** the initial server response must contain crawlable content; don't gate the whole page behind client-side hydration.
- **Duplicate-with-landing risk:** if `/puzzles/` and `/puzzles/play` are near-identical, differentiate them (landing = editorial/overview + entry point; play = the tool with supporting copy) and keep self-referencing canonicals distinct.

### `/puzzles/generate` — **IN** (contested → include)

**Verdict: IN.** A PDF export/printable generator maps to a real, distinct, and commercially healthy query cluster: "printable sudoku PDF", "sudoku printable", "printable sudoku generator". Numerous competitors run dedicated, well-ranking printable/generator pages — livesudoku.com/printable-sudoku, 1sudoku.com/print-sudoku, and standalone "sudoku puzzle maker" generators (e.g., jigsawmake.com, twolimeprints.com). Livesudoku markets the printable surface as a distinct intent verbatim: "our free printable sudoku pages provide a refreshing break and offer a hands-on experience that engages both young and old minds alike" — confirming printable/offline is a separate intent from online play. Free-tool pages are classic link magnets and tend to attract backlinks, which helps the whole domain. The thin-content risk is real but manageable with the same mitigation as `/play`: real on-page copy (what it does, difficulty options, format explanation) around the tool. Given it's a genuinely distinct intent (offline/printable vs. online play), it deserves its own indexable URL.

### `/puzzles/leaderboard` — **IN** (contested → include, with privacy caveat)

**Verdict: IN, cautiously.** Comparable sites expose public rankings (livesudoku, sudoku.academy) and it maps to competitive-play intent. It is a legitimate public page. **Caveats:**

- **Thin/dynamic content:** a bare table of names and times can look thin. Add contextual copy (what the leaderboard is, how ranking works, links to play) to give it substance and avoid soft-404 classification.
- **Privacy (usernames):** UGC-style exposure of usernames is a product/privacy decision, not primarily an SEO one. If usernames are user-chosen public handles, indexing is fine; if they could be real names or PII, reconsider exposing them publicly at all. This is a convention/judgment call, not a documented SEO rule.
- If the leaderboard is highly volatile and you're worried about crawl churn, it's defensible to leave it OUT of the sitemap while keeping it indexable via internal links — but including it is the better default for a small curated set.

### `/puzzles/archive` — **IN (the hub), with a structural recommendation**

**Verdict: IN for the archive hub/index page.** Include `/puzzles/archive` itself. For **individual dated archive entries**, follow the pattern used by daily-game sites: the archive hub is the primary indexable surface; individual dated puzzle instances are generally NOT worth indexing at scale (they're near-duplicate, thin, and create index bloat — and you've already stated puzzle instances are not being indexed). This matches your stated plan (curated pages only). Note that the largest daily-game archive model is **not** an SEO-archive model to emulate: per TechCrunch (May 7, 2024), the NYT launched a Wordle archive of "more than 1,000 past Wordle puzzles… only being offered to Games and All Access subscribers. Free users will not get access to the archives" (Head of Games Jonathan Knight quoted). That archive is subscriber-gated, not built for organic search. The relevant best practice for an open site is: **index the archive index, keep the long tail of dated instances out** unless individual entries have genuinely unique, substantial content.

### `/puzzles/signin` and `/puzzles/account` — **OUT of sitemap + ADD `noindex`**

**Verdict: exclude from sitemap (both) AND add `robots: { index: false }` to both.** This is genuinely valuable hygiene, not fussing:

- **Google's own guidance (Search Off the Record podcast, John Mueller, September 2025, reported verbatim by Search Engine Journal):** generic login pages get folded together as duplicates — "we'll fold them together as duplicates and we'll focus on indexing the login page because that's kind of what you give us to index" — i.e., a bare login page can end up as the indexed representative of many URLs, which is wasteful. Google's recommendation for private endpoints: "use noindex or a login redirect instead of robots.txt."
- **`/account` is auth-gated:** Googlebot hitting it gets a 401/redirect; Google documents that auth-required pages produce "blocked to Googlebot by a request for authorization (401 response)" statuses, and auth-gated thin pages are prone to soft-404 signals. `noindex` (which requires the page be crawlable, not robots.txt-blocked) is the correct tool.
- **noindex vs. robots.txt disallow:** Use **noindex**, not `Disallow`. Google's docs are explicit that a robots.txt-disallowed URL "can still appear in Search if external links point to it" — because Googlebot can't fetch the page, it never sees a `noindex` tag. The correct pattern is: **allow crawling, apply `noindex`.** Never combine `Disallow` + `noindex` on the same URL.
- **noindex pages must NOT appear in a sitemap.** A sitemap is a list of pages you want indexed; listing a `noindex` URL sends contradictory signals and can trigger a "Submitted URL marked 'noindex'" issue in GSC. So: `noindex` these two, and keep them out of both sitemaps. (They're already excluded from the sitemap either way — this just confirms it's correct.)

### Fork 2, Research Q5 — Does sitemap inclusion actually move the needle here?

**Honestly: only marginally.** Per Google's documentation and Mueller/Waisberg statements above, a small (well under 100 URLs), well-internally-linked site "might not need a sitemap" at all — Google will discover these pages via links from the homepage and hub. The sitemap's real value for Biscuit Lab is: (1) a **new site with few external links** benefits from a sitemap for initial discovery (Google explicitly lists "new and has few external links" as a reason to have one), and (2) it gives you the **GSC per-sitemap indexing diagnostics** to monitor which curated pages actually get indexed. So keep a sitemap — it's cheap insurance and a diagnostic tool — but recognize the **higher-leverage levers are solid internal linking** (link `/play`, `/generate`, `/leaderboard`, `/archive`, `/daily` prominently from `/puzzles/` and ideally from the hub) **and noindex hygiene**, not sitemap micro-structure.

---

## IMPLEMENTATION NOTES (Recommended: Option B)

### Hub app — `app/sitemap.ts` (unchanged; keep the working special file)

```ts
// hub: app/sitemap.ts
import type { MetadataRoute } from 'next'

const BASE = 'https://biscuitlab.net'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`,    changeFrequency: 'weekly' },
    { url: `${BASE}/log`, changeFrequency: 'weekly' },
    // blog posts: derive lastModified from REAL post timestamps
    // ...posts.map(p => ({ url: `${BASE}/blog/${p.slug}`, lastModified: p.updatedAt })),
  ]
}
```

Served automatically at `https://biscuitlab.net/sitemap.xml`. Only include `lastModified` where you have a **real** modification date (Illyes: binary trust). `priority`/`changeFrequency` are largely ignored by Google (Illyes: "bag of noise") and are optional.

### Hub app — `app/robots.ts` (the array form — the key Option B move)

```ts
// hub: app/robots.ts
import type { MetadataRoute } from 'next'

const BASE = 'https://biscuitlab.net'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: [
      `${BASE}/sitemap.xml`,          // hub
      `${BASE}/puzzles/sitemap.xml`,  // puzzle zone
    ],
  }
}
```

Next.js's `MetadataRoute.Robots` `sitemap` field accepts `string | string[]`; an array emits multiple `Sitemap:` lines. This robots.txt must be served from the **hub** (the domain owner), because a `public/robots.txt` in the PG zone would be pushed to `/puzzles/robots.txt` by `basePath`.

### PG zone (Puzzle Lab) — `app/sitemap.ts` (new file)

```ts
// PG zone: app/sitemap.ts   (basePath: '/puzzles' is set in next.config.js)
import type { MetadataRoute } from 'next'

// Use ABSOLUTE URLs. basePath is NOT auto-prepended to string literals here,
// and relative URLs are rejected by validators/Google.
const BASE = 'https://biscuitlab.net/puzzles'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}`,             changeFrequency: 'weekly'  },
    { url: `${BASE}/daily`,       changeFrequency: 'daily'   },
    { url: `${BASE}/leaderboard`, changeFrequency: 'daily'   },
    { url: `${BASE}/archive`,     changeFrequency: 'daily'   },
    { url: `${BASE}/play`,        changeFrequency: 'weekly'  },
    { url: `${BASE}/generate`,    changeFrequency: 'monthly' },
    // NOT included: /signin, /account
  ]
}
```

Because the PG zone has `basePath: '/puzzles'`, this special file is served at `https://biscuitlab.net/puzzles/sitemap.xml` (via the hub's rewrite). Do **not** also add an `app/sitemap.xml/route.ts` in either app — that collides with the special file (Next.js issues #45947, #78609).

### PG zone — `noindex` on gated/thin pages

```ts
// PG zone: app/signin/page.tsx  and  app/account/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: true }, // allow crawling of links, keep page out of index
}
```

Do NOT `Disallow` these in robots.txt (that would prevent Googlebot from ever seeing the `noindex`). Keep them crawlable + `noindex`.

### next.config.js (hub) — the rewrite must cover the zone sitemap

```js
// hub: next.config.js
module.exports = {
  async rewrites() {
    return [
      { source: '/puzzles',        destination: `${process.env.PG_DOMAIN}/puzzles` },
      { source: '/puzzles/:path+', destination: `${process.env.PG_DOMAIN}/puzzles/:path+` }, // covers /puzzles/sitemap.xml
    ]
  },
}
```

Verify `https://biscuitlab.net/puzzles/sitemap.xml` returns the zone's XML through the rewrite. On Next.js 15 no extra asset-prefix rewrite is needed; on <15 add the `beforeFiles` `/_next` rewrite for `assetPrefix`.

### Google Search Console submission (Option B — ~30 seconds)

1. In the `biscuitlab.net` property, open **Sitemaps**.
2. Submit `https://biscuitlab.net/sitemap.xml`.
3. Submit `https://biscuitlab.net/puzzles/sitemap.xml`.
4. Both are also auto-discoverable via robots.txt. In the **Page Indexing** report, use the **sitemap filter** to monitor each independently.
5. (Optional but recommended) Submit both in **Bing Webmaster Tools**, and consider enabling **IndexNow** (Bing-native) for instant push of new/updated URLs — Bing recommends sitemaps + IndexNow together, and note that ChatGPT Search and DuckDuckGo draw on Bing's index.

---

## WHAT WOULD CHANGE THE VERDICT

**Switch Fork 1 to a sitemap index (Option A) when:**

- Either zone's `<urlset>` approaches the **50,000-URL or 50MB** limit — you'd split within that zone using `generateSitemaps()`. Even then, you can list multiple `Sitemap:` lines rather than a cross-app root index.
- You need a **single canonical sitemap entry point** for a third-party tool or partner that only accepts one sitemap URL (rare).
- You add **many more zones** (5+) and want one root reference — though robots.txt multi-line still scales fine.

**Revisit Fork 2 page decisions when:**

- **GSC flags `/play`, `/generate`, or `/leaderboard` as "Soft 404" or "Crawled – currently not indexed"** → the crawled HTML is too thin; add server-rendered content, or (last resort) remove from sitemap. This is the key metric to watch after launch.
- **`/leaderboard` exposes real-name PII** → reconsider public exposure entirely (product decision) and remove from index.
- **Individual dated archive entries develop unique, substantial content** (editorial notes, per-puzzle solver stats) → consider indexing them and adding to the sitemap.
- **The site accumulates strong external links and airtight internal linking** → the sitemap matters even less; keep it for diagnostics.

---

## CAVEATS / WHERE THE EVIDENCE IS THIN

- **Documented fact (strong):** Multiple `Sitemap:` lines are fully supported (Google robots.txt spec, sitemaps.org, Bing). The 50,000-URL/50MB limits (sitemaps.org, Google). The path-scope and cross-submission rules (sitemaps.org, Google docs/blog). The Next.js special-file vs. route-handler conflict (Next.js GitHub issues #45947, #78609). `generateSitemaps()` cannot fan out across apps and Next.js doesn't auto-generate an index (Next.js discussions #61025, #61448). noindex-vs-disallow mechanics and that disallowed URLs can still be indexed (Google docs). lastmod trust is binary (Illyes; Google docs).
- **Industry convention (medium confidence):** That `/play` and `/generate` interactive/tool pages should be indexed as landing pages — strongly supported by competitor behavior (sudoku.com ~32.4M visits/mo per Similarweb; livesudoku, sudokuonline.io per Ahrefs) and search-intent evidence, but there is no Google edict that says "index your interactive tool." The soft-404 risk for JS-heavy tool pages is documented, so the recommendation is conditional on real server-rendered content.
- **Opinion / judgment call (lower confidence):** Whether `/leaderboard` should be indexed at all is a genuine judgment call balancing thin-content and privacy against modest intent value; reasonable practitioners could exclude it. The privacy dimension (usernames) is a product decision, not an SEO rule.
- **The "does the sitemap even matter" question:** Google's docs and Mueller both indicate a small, well-linked site "might not need a sitemap." So the entire Fork 1 decision is **low-stakes** — either option works and the site will likely be crawled fine regardless. Don't over-invest; the higher-leverage work is internal linking and noindex hygiene.
- **Conflicting Google statements on sitemaps:** Mueller said small sites "don't really need a sitemap" (2011) but also called a sitemap "a minimal baseline for any serious website" (2020). These aren't strictly contradictory (have one, but don't stress its structure); the evolution is noted rather than cherry-picked.
- **Source-quality note:** Some supporting details (GSC reporting nuances, competitor traffic figures) come from SEO-industry secondary sources (Ahrefs, Similarweb, Search Engine Roundtable, Search Engine Journal, Conductor) rather than Google primary docs; they corroborate but are not authoritative. The 2011 Mueller quote is reproduced via secondary aggregators; the original hangout transcript could not be independently confirmed. The July 2026 Illyes lastmod remark is reported via Search Engine Roundtable citing a Bluesky reply.
