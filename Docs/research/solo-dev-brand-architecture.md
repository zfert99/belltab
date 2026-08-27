# Structuring Multiple Web Projects as a Solo Developer: Information & Brand Architecture for Zack Fertig

## TL;DR

- **Keep two domains, but flip their weight.** zfertig.com must carry everything a hiring reviewer needs; biscuitlab.net should be treated as a low-cost sandbox/community brand, not a second front door. The biggest documented risk for a solo dev with two sites is that the second one goes stale and reads as abandonment — so keep Biscuit Lab deliberately minimal and CONFIRM it will never contain hiring-critical content.
- **CONFIRM the tier rule's spirit, SIMPLIFY its thresholds.** Small-vs-large-repo is an engineering decision; "graduate to its own domain" should be gated on real triggers (app-store presence, own paid entity/marketing, separate auth/legal need), not on ambition. Puzzle Lab at biscuitlab.net/puzzles is correct; a separate puzzle domain is only justified once it has an independent audience or a store listing.
- **CHANGE the two-genre content split into one canonical writing home.** Teaching pieces belong on zfertig.com/writing (that is the hiring evidence). Build logs can live at biscuitlab.net/log, but the risk of two thin, stale sections is real — keep the split only if the log is genuinely a different genre/audience, and make zfertig.com the canonical home for anything that doubles as a teaching artifact.

## Key Findings

1. **Recruiters spend under a minute on an application, and typically well under 30 seconds on the first cut.** ResumeGo's 2024 survey of 418 US hiring professionals found 81% spend less than a minute on a CV during initial screening (47% between 30 seconds and one minute); the widely-cited "7.4 seconds" figure originates from TheLadders' 2018 eye-tracking study of just 14 participants. One design-hiring writeup (Presentum) put full resume+portfolio evaluation at ~55 seconds. Implication: zfertig.com must answer "can this person teach technical audiences?" above the fold, and every extra hop (to a second brand) risks losing a fast skimmer.
2. **Google treats subdomains and subfolders as equivalent for ranking, but the practitioner consensus favors subfolders** for consolidating authority, simpler analytics, and unified brand perception. John Mueller (Google Search Central video): "In general, we see these the same. I would personally try to keep things together as much as possible. So if it's the same site then try to put them on the same site, essentially, and use subdomains where things are really kind of slightly different." Moving puzzles.biscuitlab.net → biscuitlab.net/puzzles is aligned with best practice.
3. **The Zack Fertig → Biscuit Lab → Puzzle Lab structure is a "branded house / sub-brand" hybrid, and the literature warns the main cost of a sub-brand is the marketing/attention cost of building a second brand with no independent audience.** For a solo job-seeker, that cost is rarely worth paying unless the project brand serves users, not recruiters.
4. **Real comparable practitioners split two ways, and the split is instructive.** Content/education people (Josh Comeau, Cassidy Williams, Maggie Appleton, Nicky Case, Lee Robinson) consolidate onto ONE personal-name (or persona) domain. Prolific *product/game* makers (Zach Gage's stfj.net + per-game domains; Simon Willison's many subdomains; Simon Tatham's single puzzles path) fan out — but only once each project has its own audience or distribution need.
5. **Live demos beat descriptions, and reviewers do click well-labeled links — but every context switch causes drop-off.** This is the core tension for a second brand: sending a hiring reviewer off zfertig.com to biscuitlab.net is exactly the kind of detour that loses fast skimmers unless the link is labeled and the payoff is immediate.
6. **Entity/knowledge-graph best practice is well-established:** one "entity home" (zfertig.com), reciprocal Person/Organization schema with `sameAs`, consistent naming, and author attribution make two domains read as one person. This is cheap and worth doing.
7. **Graduating a project to its own domain reliably costs link equity and adds redirect/monitoring/renewal overhead.** The WooCommerce → Woo.com rebrand is the cautionary case: after migrating on Oct 31, 2023, daily traffic reportedly fell from ~360,000 visits/day to under 90,000 (sometimes as low as 40,000), and Woo reverted to woocommerce.com on April 9, 2024, its own blog conceding the domain change "was a contributing factor to the decline in organic traffic." For a solo dev, only graduate on a concrete trigger.

## Details

### A. Personal-name domain vs. studio/lab brand — one site or two?

The documented consensus for people whose product IS their expertise (educators, devrel, curriculum) leans strongly toward a **single personal-name domain**. Cassidy Williams explicitly *merged* her personal site and blog in May 2024 ("I merged my personal website and my blog into one beautiful baby—er, website"). Josh Comeau, Maggie Appleton, Nicky Case, and Lee Robinson all run a single canonical domain that holds writing, projects, and about/contact together. Personal-branding guidance is nearly unanimous that your name.com is "your personal brand's address — the thing you say out loud in interviews and print on your resume."

The counter-pattern — a separate studio/lab brand — pays off mainly when the brand needs to (a) serve a *different audience* than the person's professional one, (b) outlive or be separable from the individual (sale, team, company entity), or (c) host products that market themselves. Zach Gage is the cleanest example: stfj.net is the "complete works" hub, but individual games get their own domains (reallybadchess.com, flipflopsolitaire.com) *because each game is a consumer product with its own store listing and marketing surface.*

**Failure modes.** Two sites for one solo person most often fail because the second one goes stale. Portfolio guidance repeatedly flags that "broken demos immediately signal lack of maintenance" and that un-maintained sites actively harm you. A bare biscuitlab.net (its current state) or a neglected /log is worse than no second site.

**Verdict:** The two-domain plan is *defensible but only if the roles stay asymmetric.* zfertig.com is the canonical, hiring-facing entity home; biscuitlab.net is a users-and-builders brand that a recruiter never *needs* to visit. Collapsing everything onto zfertig.com/projects is also perfectly defensible and lower-maintenance — and if time is tight, it is the safer choice. The deciding question is whether Puzzle Lab (and future projects) will have real *users* who benefit from a product-flavored brand distinct from "Zack's job hunt." If yes, keep Biscuit Lab. If it's only ever a portfolio dressing, collapse it.

### B. Brand-architecture theory applied

Aaker & Joachimsthaler's Brand Relationship Spectrum (introduced in *Brand Leadership*, 2000) runs from **Branded House** (one master brand, descriptors only — e.g., Virgin) through **Sub-brands** and **Endorsed brands** to **House of Brands** (independent, disconnected brands — e.g., P&G's Tide/Gillette). The framework is diagnostic, not prescriptive; the default recommendation is "Branded House (maximum leverage)," moving right only "when you need separation — different audiences, different price points, different brand promises."

Mapping the situation:

- **Zack Fertig** = the master/person brand (the entity recruiters evaluate).
- **Biscuit Lab** = a **sub-brand or endorsed brand** ("a lab by Zack Fertig").
- **Puzzle Lab** = a **sub-brand of a sub-brand** (a descriptor-driven product inside the lab).

This is a two-layer sub-brand structure. Aaker's documented cost of sub-brands/house-of-brands is the **loss of economies of scale and leverage**: "those brands that cannot support investment themselves risk stagnation and decline." For a solo dev, "investment" is attention. Biscuit Lab has *no independent audience today*, so every hour spent building its brand equity is an hour not spent strengthening the one brand that gets him hired (Zack Fertig). That is the central strategic warning: **do not build a second brand that has to be marketed separately unless it earns its own audience.**

**The "Biscuit Lab" / "Puzzle Lab" rhyme.** Cognitive-science research supports a mild *benefit*. The rhyme-as-reason effect (McGlone & Tofighbakhsh, 2000, "Birds of a Feather Flock Conjointly (?): Rhyme as Reason in Aphorisms," *Psychological Science* 11(5), 424–428) found rhyming aphorisms (e.g., "What sobriety conceals, alcohol reveals") "were judged to be more accurate than modified versions that did not preserve rhyme" — an effect "attenuated when people were cautioned to distinguish aphorisms' poetic qualities from their semantic content." The mechanism is *processing fluency*: rhyme makes phrases easier to process, which people misread as more truthful and more memorable. Advertising-slogan research (Filkuková & Klempe, 2013, *Scandinavian Journal of Psychology*) found rhyming slogans "more likeable, more original, easier to remember… more persuasive and more trustworthy." A shared "___ Lab" suffix also signals a deliberate brand family. The *risk* comes only from the brand-confusion literature: name similarity raises "brand source confusion" specifically when the two names occupy the **same/adjacent space** — which parent and child inherently do. The distinct first words (Biscuit vs. Puzzle) carry the differentiation, so confusion risk is modest; the real hazard is hierarchy ambiguity (which is parent, which is project). Make the relationship explicit in copy ("Puzzle Lab, a project from Biscuit Lab") rather than trusting the names to convey it.

### C. Subdomain vs. subfolder vs. separate domain — the fuller picture

Beyond the settled SEO point (subfolders consolidate authority; Google says both are fine but "keep things together"), the non-SEO dimensions matter more here:

- **Brand perception & memorability:** a subfolder (biscuitlab.net/puzzles) reads as "part of one thing"; a subdomain (puzzles.biscuitlab.net) reads as "a separate thing." For a hub whose whole point is to *collect* projects, subfolders reinforce the collection.
- **Analytics & Search Console overhead:** subdomains must be verified and tracked as *separate properties* — each subdomain is added to Google Search Console separately and gets its own reports, whereas subfolders feed one property's authority and analytics. Every subdomain is another dashboard. For a solo dev, this overhead compounds badly from one to ten projects.
- **Cookie/auth scope:** cookies set on biscuitlab.net flow to all paths; auth (Puzzle Lab's passkeys/accounts) is simplest when the app lives on a path or a subdomain that shares the parent domain's cookie scope. A separate *domain* means a separate auth origin — a real cost given Puzzle Lab's account system.
- **Deployment isolation:** this is the one axis favoring separation. A large app with its own repo/deploy is cleanly isolated via subdomain or basePath+rewrite — which is exactly the draft plan's "large project" tier.
- **Cost of URL changes later:** every move burns redirect maintenance and some link equity, so the guidance is to "pick a set up that you can keep for longer" (Mueller). Choosing the path structure now and sticking to it is worth more than optimizing it.
- **How it ages 1→5→10 projects:** subfolders scale gracefully (one property, one cookie scope, one deploy pipeline if desired); a proliferation of subdomains or separate domains becomes a monitoring and renewal burden that a solo maker predictably neglects.

**Verdict:** biscuitlab.net/puzzles (subfolder) is correct. Reserve subdomains/separate deploys for the *deployment* need, mounted onto the path via basePath+rewrite — which the draft already contemplates.

### D. When should a project graduate to its own domain?

Observable triggers practitioners actually use:

- **App-store / platform presence** (needs a marketing site with its own name — Gage's per-game domains; the existing "Shout!" iOS game).
- **Independent revenue / becoming a paid product** with its own marketing funnel.
- **Its own brand identity or audience** that is distinct from the maker.
- **Separate auth, data-liability, or a separate legal/company entity.**
- **Acquisition or spin-out.**

**Costs of graduating:** documented domain migrations reliably lose some traffic even when done well. The WooCommerce → Woo.com rebrand is the definitive cautionary case: after migrating woocommerce.com → woo.com on Oct 31, 2023, daily traffic reportedly collapsed from ~360,000 visits/day to under 90,000 (sometimes as low as 40,000), and the company reverted to woocommerce.com on April 9, 2024 — its official blog stating that after a March 2024 Google update "it became clear that the domain change from woocommerce.com to woo.com was a contributing factor to the decline in organic traffic." 301s pass most but not all link equity (commonly cited at 70–90% over 2–6 months), and you take on another renewal, another set of Search Console/analytics properties, redirect maintenance, and brand fragmentation. **Costs of NOT graduating:** a genuine product stuck under a hub path can feel amateur to *consumers*, can't get a clean brandable name, and shares reputation/blast-radius with everything else on the domain.

**Cases where staying put was clearly right:** Simon Tatham's Portable Puzzle Collection — 40+ puzzles, decades of use, huge downstream ports — has never left its single path (chiark.greenend.org.uk/~sgtatham/puzzles/). Simon Willison keeps most tools under his own domains/subdomains rather than spinning up product brands. The lesson: a *collection* or *portfolio of experiments* is better kept together; a *standalone consumer product* is what earns a domain.

**Verdict on the tier rule:** CONFIRM the small (route in hub repo) vs. large (own repo/deploy, mounted via basePath+rewrite) distinction — that's a sound engineering axis. CHANGE the graduation clause from "becomes a product" (vague) to a concrete checklist: *ships to an app store OR gets its own paid marketing OR needs a separable legal/auth entity OR is being spun out.* Absent one of those, keep it on a path even when it's large.

### E. Real-world patterns from comparable makers

- **Consolidators (one domain, education/content people — the closest analogues to a curriculum job-seeker):**
  - **Cassidy Williams** (cassidoo.co) — deliberately merged personal site + blog in 2024; runs writing, projects, newsletter under one persona domain. Notes her writing is scattered ("sometimes on my own domains, sometimes for companies") but the *home* is one place.
  - **Josh Comeau** (joshwcomeau.com) — everything (courses, blog with /css/, /react/ style paths) under one domain; has written extensively about building it. An educator whose brand IS his name.
  - **Maggie Appleton** (maggieappleton.com) — a single "digital garden" with typed collections (essays, notes, patterns, talks) via tags/paths, not separate domains.
  - **Nicky Case** (ncase.me) — a single persona domain with a /projects index; games are also mirrored on itch.io for distribution, but ncase.me is the hub.
  - **Lee Robinson** (leerob.com) — one personal domain; rebuilt repeatedly, kept unified.
- **Fan-out makers (many domains — prolific product/game builders):**
  - **Zach Gage** (stfj.net = "complete works" hub) + per-game domains (reallybadchess.com etc.) because each is a shipped consumer product with a store presence.
  - **Simon Willison** (simonwillison.net) + many subdomains (tools., til., niche-museums.com) — but these are content/tool collections under his control, aggregated back to his blog, not separately-marketed brands.
  - **Simon Tatham** — single path for a 40-puzzle collection; never fragmented.

**Pattern:** the more a person's value proposition is *teaching/credibility*, the more they consolidate; the more it's *shipping many consumer products*, the more they fan out — and even then, the personal hub persists. Zack's target roles (curriculum, devrel, learning engineering) put him firmly in the consolidator camp for hiring purposes, with Biscuit Lab as an optional product-flavored annex.

### F. How the hiring audience actually behaves

- **Time:** first-cut decisions happen fast. ResumeGo's 2024 survey (418 US hiring pros) found 81% spend under a minute on a CV in initial screening; the famous "7.4 seconds" comes from TheLadders' 2018 eye-tracking study (only 14 participants) and should be treated as illustrative rather than definitive; Presentum reports ~55 seconds for a combined resume+portfolio decision. Named senior hiring managers (Indeed Design's UX directors) call the portfolio "king."
- **Depth vs. breadth:** the consistent instructional-design/UX/LXD guidance is **3–5 in-depth case studies beat a long list**. "Three to five in-depth case studies showcasing relevant work will always outperform a long list of loosely explained projects." For instructional design specifically, case studies should show *process and thinking*, not just artifacts, because "the people who review your portfolio are often pressed for time."
- **Do they follow outbound links?** Yes, if the link is clearly labeled and the payoff is immediate — and **live demos beat descriptions** because they let a reviewer verify claims directly. But friction is the enemy: "adding friction kills momentum: clicking through a blocked file, requesting passwords, or waiting… creates drop-off. Real recruiters will skip profiles that force extra steps." Label links by destination ("Live demo," "Case study," "GitHub") rather than "Website."
- **Does "building in public" help hiring for devrel/curriculum?** Directionally yes for these roles specifically. DevRel/education hiring guidance explicitly values "technical writing, speaking, open-source contributions, and community engagement over traditional resumes," and advises to "ship publicly. Write about what you're learning." A build log is therefore a genuine asset *for these roles* — but as evidence it should be discoverable from the hiring-facing site, not hidden behind a second brand.

**Implication for the second brand:** a separate "projects" brand reads as impressive to *users/peers* but as a potential distraction to a *time-boxed recruiter*. The resolution: keep the hiring narrative complete on zfertig.com (case studies with embedded live-demo links that open the working Puzzle Lab), so a recruiter never has to "discover" Biscuit Lab to understand the work. Biscuit Lab is where interested users/peers go deeper.

### G. Cross-linking and entity signals

To make two domains read as one person, not two strangers:

- **Designate one entity home:** zfertig.com. "The entity home is the one page… that every other source points to and that defines every fact authoritatively." Put full Person schema there.
- **Reciprocal schema:** Person schema on zfertig.com with `sameAs` linking to GitHub, LinkedIn, biscuitlab.net, and social profiles; Organization schema on biscuitlab.net with a `founder`/`sameAs` pointing back to zfertig.com's Person. Consistent name spelling everywhere; author attribution ("by Zack Fertig") on every writing/log post, using the same Person `@id`.
- **Footer attribution:** biscuitlab.net footer "A Biscuit Lab project by Zack Fertig →" linking to zfertig.com. This is the low-key, non-ad way to link a project site back to the person.
- **Linking a case study out to a live project without losing the reader:** label the link by what it is ("Play Puzzle Lab →" / "Live demo"), open in a new tab, keep the case-study narrative self-contained so the reader has already gotten the value before they leave, and ensure the demo is zero-friction (no login wall; if auth is needed, provide a guest/demo path). Note that Google's *knowledge-graph* recognition of a person as an entity ultimately depends on corroborating multi-source signals (Wikidata, consistent mentions), not schema alone — schema is necessary but not sufficient.

### H. What content belongs where (two audiences)

The drafted split — "technical curriculum" pieces (teaching to completion, aimed at hiring managers → zfertig.com/writing) vs. "build logs" (process narrative, aimed at users/devs → biscuitlab.net/log) — is *conceptually* sound because they are genuinely different genres for different audiences. But it carries real risks:

- **Two thin, stale sections.** A solo dev often can't feed two publishing surfaces; one predictably rots, and a stale section signals abandonment.
- **Split subscription/audience.** Two RSS/newsletter endpoints fragment followers and confuse "where do I subscribe?"
- **Duplicate/near-duplicate content** if a build log and a teaching piece cover the same work.

Practitioner reality: most consolidate to **one blog with tags/categories** (Appleton's typed collections; Comeau's path-based topics; Williams merging everything). The single-blog approach almost always outperforms two thin cross-domain sections for a solo author, both for SEO (authority consolidation) and for reader/subscriber clarity.

**Cross-posting rules if you do keep both:** if the same piece appears in two places, use `rel=canonical` pointing to the zfertig.com version (the version you want ranked and credited); the canonical target's main content should match. Never duplicate without a canonical — unmanaged duplicates cannibalize your own ranking.

**Verdict:** SIMPLIFY. Make zfertig.com/writing the canonical home for anything that teaches or doubles as hiring evidence. Allow biscuitlab.net/log to exist ONLY as a genuinely different genre (short, dated, process/changelog "build in public" notes for users) — and if maintaining both proves hard, collapse the log into a tagged section of the single blog and cross-link. One subscription endpoint (on zfertig.com) is preferable.

## Staged Recommendations

**Stage 0 — Now (before more building):**

1. Finish the Next.js zfertig.com rebuild first; it is the load-bearing asset. Ensure 3–5 deep case studies, /about, resume download, and /writing are complete and fast, with hiring-relevant work answerable in the first 15 seconds. *(Well-evidenced.)*
2. Add Person schema + `sameAs` to zfertig.com now; it's cheap and compounds. *(Well-evidenced.)*
3. Keep biscuitlab.net minimal: a one-screen project index + /log stub. Do NOT invest brand-building effort here yet. *(Judgment call, well-supported by the "stale second site" risk.)*

**Stage 1 — Puzzle Lab:**
4. Move puzzles.biscuitlab.net → biscuitlab.net/puzzles with 301s. *(Well-evidenced; matches Google guidance and subfolder consensus.)*
5. Create ONE zfertig.com case study for Puzzle Lab (procedural generation, passkey auth, leaderboards) with an embedded, zero-friction "Play it live →" link. This is how a recruiter experiences the project without needing to discover Biscuit Lab. *(Well-evidenced.)*

**Stage 2 — Content:**
6. Publish teaching pieces on zfertig.com/writing. If you run a build log, keep it short and process-flavored on biscuitlab.net/log, canonicalized to zfertig.com when a post doubles as teaching. One newsletter/RSS, hosted on zfertig.com. *(Contested/judgment — the safe default is one blog with tags.)*

**Stage 3 — Future projects (apply the revised tier rule):**
7. Small project → route in hub repo at biscuitlab.net/thing. Large project → own repo/deploy at biscuitlab.net/thing via basePath+rewrite. *(Confirmed.)*
8. Graduate to its own domain ONLY when it hits a concrete trigger: ships to an app store, gets its own paid marketing/audience, needs separable auth/legal entity, or is spun out. Then 301 from the Biscuit Lab path and expect a temporary traffic dip. *(Well-evidenced.)*

**Thresholds that would change the advice:**

- If Biscuit Lab/Puzzle Lab develops a real recurring user base (accounts, returning players, revenue) → invest in the Biscuit Lab brand and consider graduating Puzzle Lab to its own domain.
- If maintaining two content sections causes either to go 3+ months stale → collapse to one blog immediately.
- If the job search ends and the goal shifts to product growth → the calculus flips toward the fan-out (Gage) model.

## Caveats / Open Questions

- **Much of the hiring-behavior evidence is practitioner/self-reported, not peer-reviewed.** The ResumeGo 2024 figure (81% under a minute) is a vendor survey; the "7.4 seconds" figure is a 14-person eye-tracking study; percentages like "73% of hiring managers" or "80% under three minutes" circulate widely on career blogs and should be read as directional, not precise. The *direction* (fast skims, friction hurts, live demos help, 3–5 deep case studies) is consistent across many sources and is safe to rely on.
- **The rhyme/brand-similarity evidence cuts both ways** and the net effect for "Biscuit Lab/Puzzle Lab" is a judgment call: mild memorability benefit, modest hierarchy-confusion risk, mitigated by explicit copy.
- **Knowledge-graph entity recognition** depends on external corroboration (Wikidata, consistent mentions) beyond schema; for a not-yet-notable individual, schema helps disambiguation but won't manufacture a knowledge panel.
- **This analysis assumes the primary goal is landing a developer-education role.** If the goal weights change (building Puzzle Lab into a business), several recommendations invert, as noted in Stage 3.
- **Not independently verified:** the exact current contents of zfertig.com and biscuitlab.net were taken from the brief, not inspected live; the WooCommerce traffic figures are from third-party SEO analyses corroborated by Woo's own blog admission.
