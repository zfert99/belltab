# Building a Client-Side School Bell Schedule Countdown: An Implementation-Grade Research Report

> **Status: source research, not the final plan.** This document is the evidence
> base BellTab is built on, and is kept as written. Two of its recommendations
> were deliberately overruled in `Docs/belltab-plan.md`: BellTab **forbids
> overlapping periods** (rejecting the classified-overlap model, because it
> targets one person's schedule rather than a general tool), and **rotating
> cycle day types are deferred** out of v1. Where this document and the plan
> disagree, the plan wins — but read the reasoning here first.

Prepared for Zack (biscuitlab.net · Next.js App Router + TypeScript + Tailwind on Vercel). Research/decision phase — no implementation code. Evidence markers: **[strong]** = primary source (spec, MDN/WHATWG/Chromium docs, browser bug tracker, reproducible test); **[moderate]** = practitioner consensus / multiple corroborating sources; **[thin]** = single blog, vendor marketing, or my own inference.

---

## TL;DR — the five findings that actually change the design

1. **Minute-resolution in the tab title survives backgrounding; seconds-resolution does not — but only if you recompute from the clock, never decrement.** Chrome's "intensive throttling" clamps hidden-tab timers to **once per minute** after 5 minutes hidden (chained timers ≥5, silent ≥30s, no WebRTC) **[strong]**. A once-per-minute wakeup with alignment jitter means a *displayed* minute counter can lag the true minute boundary by up to ~60s. The fix is architectural, not a workaround: store an absolute deadline and compute `remaining = deadline − Date.now()` on every tick and on every `visibilitychange`/`focus`. The countdown value is then always correct the instant the user looks, regardless of how badly the tick was throttled. This is the single most important decision.

2. **The "silver bullet" background APIs are mostly dead ends for this tool.** Notification Triggers (`showTrigger`/`TimestampTrigger`) — the one API that could have fired local period-change alerts on a schedule without a push server — **had its development formally ended by the Chrome team** and never shipped stable or to any other browser **[strong]**. There is **no Web Alarms API** for plain pages. Service Workers cannot reliably wake themselves on a timer without a push server. So "reliable alert exactly at the bell while the tab is buried" is not achievable on the open web in 2026 for a backendless tool. Accept this and design around at-a-glance polling instead.

3. **A Web Worker genuinely escapes main-thread throttling and is the right tool if you want the seconds ticking in the tab title while backgrounded** — but it is not free and, given finding #1, is often unnecessary. Worker timers are not subject to the main-thread 1Hz/1-per-minute clamp **[strong/moderate]**, so a worker `setInterval(1000)` posting messages will keep `document.title` fresh. But on mobile and when the page is *frozen/discarded* (Page Lifecycle), even workers stop. For desktop-classroom use it's a reasonable enhancement; for a portfolio-scale solo build, plain `Date.now()` recomputation gets you 95% of the value at 5% of the complexity.

4. **Use absolute wall-clock times (minutes-since-midnight integers), not durations, and not `Date` objects — and you do not need IANA timezones at all.** A bell schedule is inherently wall-clock ("Period 2 starts at 9:05"), not instants. Integers of minutes-since-midnight are DST-safe, trivially comparable, trivially serializable, and dodge every `Date` footgun. Critically, the **concurrent-lunch pattern (two lunches overlapping different class blocks) is real and common in US secondary schools and breaks the "ordered list of durations" model outright** — so Option A is disqualified for the general case. Temporal's `PlainTime` is the "correct" type and shipped in Chrome 144 / Firefox 139 but **not yet in stable Safari** (2026), so it still needs a ~20–44KB polyfill — not worth it here; plain integers win.

5. **State-in-URL-hash is the right sharing model and is very safe on length.** The fragment is never sent to the server **[strong]**, so server/CDN limits (~8KB) are irrelevant; the real ceiling is the browser, comfortably tens of thousands of characters. A compact JSON → `CompressionStream('deflate-raw')` → base64url pipeline (all natively supported across browsers since May 2023, Safari 16.4 included) will keep even a full week-of-day-types schedule to a few hundred characters. **Version-prefix the payload from day one** — the first shared link is a format you support forever.

---

## Key Findings

- **Chrome throttling is precisely documented and tiered** (Jake Archibald / Chrome team): minimal (4ms floor for chains ≥5), throttling (1/sec), intensive (1/min after 5 min hidden). Exemptions: page visible, audible in last 30s (silent track doesn't count), WebRTC active, chain count <5 **[strong]**.
- **Firefox uses budget-based throttling** documented in Bugzilla and MDN: per-window budget, regenerates at 10ms/sec, throttled after ~30s hidden; audio-playing tabs exempt **[strong]**.
- **Safari/WebKit throttling is essentially undocumented publicly** — behavior is only known empirically; MDN notes budget throttling "operates in a similar way across modern browsers" but WebKit publishes no design doc **[moderate → thin]**.
- **Notification Triggers is dead; iOS Web Push requires PWA install** (iOS 16.4+, add-to-home-screen) **[strong]**. This kills silent scheduled notifications as a general solution.
- **Ed-Fi already models exactly this domain** ("Bell Schedule Domain": BellSchedule + ClassPeriod + Date), confirming the professional data model is *named schedules mapped to dates*, not durations **[strong]**. OneRoster does not model bell times; iCalendar RRULE cannot cleanly express "day 3 of a 6-day rotation."
- **Prior art is a crowded field of native apps and small student web apps**; "bell.me" could not be confirmed, but **bell.plus** (open source, LAHS students, with a domain-migration history countdown.zone → bell.lahs.club → bell.plus) is the strongest candidate for what you remember.
- **Dynamic favicon + tab title are both viable channels**; mutating `document.title` does **not** trigger screen-reader announcements (a subtle a11y trap, but here it works in your favor).
- **Wake Lock is now supported in all three engines** (incl. Safari 16.4+), making the classroom-projector case well-supported **[strong]**.

---

## Details (by research question)

### 1. Background tab timer throttling — the central constraint

**Chrome / Chromium [strong].** The authoritative source is Jake Archibald's Chrome team post "Heavy throttling of chained JS timers beginning in Chrome 88." Three tiers:

- **Minimal throttling** (page visible, OR made sound in last 30s): no throttle except the classic rule — chains of ≥5 with timeout <4ms are clamped to 4ms. A *silent* audio track explicitly does **not** count as "making noise."
- **Throttling** (chain <5, OR hidden <5 min, OR WebRTC with open data channel / live track): timers checked **once per second**, batched.
- **Intensive throttling** (ALL of: hidden >5 min; chain ≥5; silent ≥30s; no WebRTC): timers checked **once per minute**, batched. Verbatim from Archibald: *"Intensive throttling happens... [when] The page has been hidden for more than 5 minutes. The chain count is 5 or greater. The page has been silent for at least 30 seconds. WebRTC is not in use. In this case, the browser will check timers in this group once per minute."*

The "chain count" detail matters: a `setInterval` or self-rescheduling `setTimeout` increments the chain, so a countdown *is* a chain ≥5 within seconds and is fully eligible for intensive throttling. The `IntensiveWakeUpThrottling` feature is also documented in Microsoft's Edge policy docs ("running no more than once per minute after a page has been backgrounded for 5 minutes or more") **[strong]**. The Chromium blink-dev "Intent to Ship: Quick intensive timer throttling of loaded background pages" (chromestatus 5580139453743104) shows Google experimenting with **reducing the 5-minute grace period to as little as 10 seconds if the page is loaded when hidden** — though API owners LGTM'd only the 1-minute variant and raised "additional concerns" about the 10-second version **[strong]**. Net: assume the 5-minute grace may be shorter on some configurations.

**Firefox [strong].** MDN's Page Visibility API page and Bugzilla 1362322 ("Implement budget based background timeout throttling") document budget-based throttling: each background window has a time budget (ms), throttled after ~30s hidden, budget regenerates at 10ms/sec, timers only run while budget is non-negative; audio-playing tabs are exempt (Bugzilla 1336484, 1181073). Qualitatively similar to Chrome but expressed as a regenerating budget rather than fixed tiers.

**Safari / WebKit [moderate → thin].** There is no public WebKit design doc equivalent to Archibald's post. MDN states budget throttling "operates in a similar way across modern browsers." Practitioner consensus is that Safari throttles background timers to roughly 1Hz and aggressively suspends/purges background tabs, but the specific tier thresholds are **empirical, not specified**. This is a genuine documentation gap — do not present any specific Safari number as authoritative.

**Occluded-but-not-hidden windows [strong].** Per Archibald, "browsers may consider a page hidden whenever its content is totally not-visible," and the Page Lifecycle spec/WICG explainer distinguishes ACTIVE vs PASSIVE (occluded) states, both of which can be FROZEN. In practice a fully occluded window is generally treated as hidden by the visibility model. Whether a *partially* occluded window throttles is implementation-defined; treat occlusion as "probably hidden."

**Mobile & locked phone [strong].** Beyond throttling, mobile backgrounds trigger the **Page Lifecycle API**: backgrounded pages can be **frozen** (`freeze` event; all timers stop) and later **discarded** (tab dropped from memory; `document.wasDiscarded` on reload). iOS Safari aggressively discards background tabs; a locked phone freezes the page. **When frozen/discarded, neither main-thread nor worker timers run at all** — recomputation-on-resume is the only thing that saves you. bfcache freezing is functionally the same. Note the Chrome team's own remark that title/favicon-update-from-service-worker was proposed precisely because frozen pages can't update their own tab title.

**Is `document.title` repaint throttled separately? [moderate]** The tab strip repaints when the timer fires and sets `document.title`; there is no separate documented coalescing of the tab-strip paint beyond the timer throttle itself. If the timer is clamped to 1/min, the title updates 1/min. I found no primary source describing an *additional* title-specific throttle, so the effective cadence == the timer cadence (absence-of-evidence, not proof).

**Verdict on "seconds stall, minutes survive" [strong, with an important correction].** Half-true. Seconds-resolution in a background tab *will* visibly stall — confirmed by the throttling tiers. But minute-resolution is **not automatically reliable if you decrement**: intensive throttling fires ~1/min with no guarantee of alignment to your minute boundary, so a decrement-based minute counter can be off by up to ~60s and can skip. The correct claim is: **minute-resolution is reliable only if you recompute `remaining = deadline − Date.now()` on each (throttled) tick and on `visibilitychange`.** Under that design, even if the tick is late, the number shown is correct to the second the moment it renders. This reframes the whole problem: the enemy is decrement-drift, not throttling per se.

### 2. Alternatives and workarounds, evaluated honestly

- **Web Workers [strong/moderate].** Main-thread throttling does not apply to worker timers; this is the documented basis for `worker-timers` (chrisguttandin, actively maintained, npm 8.x). A worker `setInterval(1000)` → `postMessage` → main thread sets `document.title` keeps seconds ticking while backgrounded on desktop. Caveats: (a) workers are still frozen/discarded on mobile and lock; (b) it adds a build/bundle wrinkle; (c) given the `Date.now()` recomputation pattern, you rarely *need* the extra ticks. **Recommendation: optional enhancement for the desktop seconds-in-title case, not a foundation.**
- **Recompute from `Date.now()` / `performance.now()` [strong].** The drift-free core pattern. Use the Page Visibility API (`visibilitychange`, `document.hidden`) and `window.focus` to force an immediate recompute-and-repaint the instant the tab is foregrounded. `Date.now()` (wall clock) is correct here because the schedule is wall-clock; `performance.now()` is for measuring elapsed intervals, not for "what time is it." **This is the recommended foundation.**
- **Silent audio to dodge throttling [moderate, discouraged].** Playing audible sound exempts a tab (Chrome minimal-throttling; Firefox audio exemption), but Archibald explicitly says a *silent* track does **not** count in Chrome — so truly-silent audio won't reliably exempt you, and audible audio is user-hostile. It also shows a speaker icon on the tab, and the autoplay policy requires a user gesture / muted content anyway. **Reject as a dark pattern with unreliable payoff.**
- **Service Worker + Notifications for period-change alerts [strong].** A SW does not stay alive on a timer without push; there is no reliable self-wake. **Notification Triggers (`showTrigger`/`TimestampTrigger`) development was formally ended by the Chrome team** ("It wasn't clear that we could provide consistent and reliable experiences across platforms") and it never shipped to stable or to other browsers. So scheduled local notifications without a push server are not available. iOS adds that **Web Push requires the site be installed to the home screen as a PWA** (iOS/iPadOS 16.4+, permission prompt must follow a user gesture inside the installed app). **Recommendation: notifications only as a foreground nicety (fire a `new Notification` while the tab is open), explicitly not as a backgrounded guarantee.**
- **Web Alarms / Chrome Alarms [strong].** `chrome.alarms` is **extension-only**; there is no Web Alarms API for a plain page. Not available to you.
- **Badging API (`setAppBadge`) [strong/moderate].** Can put a number on an installed PWA icon, no permission prompt, callable from page or SW. But: installed-PWA-only; not exposed in regular tabs; **Chrome on Android does not support it**; Safari support is tied to home-screen install + notification permission. It's a nice "minutes remaining on the dock icon" flourish for installed desktop users, but coverage is too partial to be a primary surface. **Optional.**
- **Screen Wake Lock [strong].** `navigator.wakeLock.request('screen')` is now supported cross-engine: Chrome/Edge since 84 (July 2020), Firefox 126 (May 2024), and Safari 16.4 (March 2023) on macOS/iOS — though an iOS bug broke it in *installed PWAs* until Apple fixed it in iOS 18.4 (March 2025). Directly relevant to the projector/phone-left-open case. The lock auto-releases on tab hide, so re-acquire on `visibilitychange`. **Recommendation: implement, behind an explicit "keep screen awake" toggle, with feature detection.**
- **Honest bottom line for fidelity in 2026:** The best achievable for a backendless tool is: **perfectly accurate the instant the tab is viewed** (via recomputation), **seconds-fresh in a foreground/visible tab**, **seconds-fresh in a backgrounded desktop tab only if you add a Web Worker**, and **as-of-last-freeze then instantly-correct-on-resume on mobile/locked**. Reliable *proactive* alerts at the bell while buried are not achievable without a push server. For a solo portfolio-adjacent tool, do recomputation + Wake Lock + foreground notifications; treat Worker and Badging as optional polish.

### 3. Prior art

**"bell.me" — not confirmed [thin].** I could not verify a tool at the domain `bell.me` (Wayback programmatic access was blocked during research). The strongest candidate for what you remember is **bell.plus** — an open-source (MIT, github.com/nicolaschan/bell) student-built countdown from Los Altos High School with a **domain-migration history (countdown.zone → bell.lahs.club → bell.plus)**, which is exactly the kind of trail that leaves a half-memory of a short-domain "bell.[x]" tool that "no longer exists" at its old address. Notably, nicolaschan/bell explicitly does **client/server clock synchronization** ("Accurately synchronizes, even if client computer time is incorrect") — a design choice worth studying if you care about students whose device clocks are wrong. Other live analogues: **bell.ninja** (student-run, Riviera Prep), **periods.io** ("Period Countdown"), **clock.school**, and the commercial **bellschedule.app** (native iOS/Android + Chromebook/signage, second-by-second countdown, schools onboarded by admin request).

**Native apps [moderate].** The App Store / Play Store space is mature: "School Bell Schedule" (id1526240520; widgets, Siri shortcuts, remote notifications, up to 15 periods, 50+ prebuilt schools), "Bell Schedule (For School)" (MY DJ LLC; countdown + tweak-countdown slider to sync to the real bell), "Bell+" (bell-delay offset setting, clubs/sports). Common themes worth stealing: a **bell-delay/offset control** (real bells never match the published schedule exactly), day-type awareness, and widget/at-a-glance framing.

**Open-source web implementations to read [moderate].** `hman124/bell-countdown` (React + Vite, custom schedules, "exact seconds until bell") and its fork `ABUCKY0/bell-countdown`; `nicolaschan/bell` (more mature, with time-sync). The subagent could not fetch raw source to quote the exact timer code, so I'm flagging as **inferred**: these small React apps almost certainly use a `useEffect` + `setInterval(1000)` that **recomputes from `new Date()`** each tick (the standard React countdown idiom) and set `document.title` in an effect; there is no evidence any of them use Web Workers.

**Pomodoro / countdown genre (same throttling problem) [moderate].** The documented dominant techniques are exactly the two this report recommends: (1) run the ticking timer in a **Web Worker holding a wall-clock deadline**, and (2) **recompute remaining time from `Date.now()`** rather than decrement. At least one Pomodoro tool documents the worker-deadline approach explicitly ("The countdown runs in a Web Worker holding a wall-clock deadline, so background-tab throttling can't make it drift... refresh or reopen and it resumes exactly where it was"). pomofocus.io appears to keep a per-second background timer alive (inferred from a reported background-CPU bug), but its exact mechanism was not directly readable.

### 4. The schedule data model

**Principle [strong].** "Make illegal states unrepresentable" (Yaron Minsky, Effective ML, 2010) and its dynamic complement "Parse, don't validate" (Alexis King, 2019): parse untrusted input once at the boundary into a type whose very structure guarantees validity, so downstream code never re-checks. Richard Feldman's "Making Impossible States Impossible" (Elm) popularized it for front-end models. The relevant tension: **Option A (durations from one start time) pushes the invariant into the type** — overlaps/out-of-order become literally unrepresentable — which is the ideal *when the invariant is actually true of the domain*.

**But the domain invariant is false.** Real US secondary schools routinely run **concurrent lunches**: e.g., "A lunch" and "B lunch" run at the same wall-clock time while different cohorts are in a class block — two periods genuinely overlap. Ed-Fi's Bell Schedule Domain models this by making a BellSchedule a set of ClassPeriods with their own times, explicitly allowing "multiple bell schedules on the same calendar time period (e.g., for different grades)" and stating "a class period does not have to meet every day" **[strong]**. Real schedules also have **gaps** (before school, after dismissal), **zero-length passing** treated as instantaneous transitions, and **non-contiguous** days. **Therefore Option A (ordered durations) is disqualified as the general model** — it cannot represent concurrent lunches at all, and cascading edits are a UX liability.

**Recommendation:** **Option B — absolute start/end per period + a parse-at-boundary validator** — but store times as **minutes-since-midnight integers**, and follow "parse, don't validate": the validator's *output* is a branded `ValidSchedule` type, not a boolean, so the rest of the app can't accidentally operate on an unvalidated one. Represent a period as `{ startMin, endMin, label, kind }`. Allow overlaps but *classify* them: a validator can distinguish intentional concurrency (two `lunch`/`class` periods flagged concurrent) from accidental overlap (two `class` periods for the same cohort). Contiguity is **not** an invariant to enforce — gaps are legal.

**Time representation [strong].** Your instinct is correct: **minutes-since-midnight integers**, not `Date`, not durations.

- A bell schedule is **wall-clock, not instant.** "Period 2 at 9:05" means 9:05 local regardless of DST. Integers are inherently wall-clock.
- **DST:** A schedule almost never needs to care. The only edge is the ~twice-a-year 1–2 AM transition, which no school day spans; 09:05 is 09:05 on both sides. Storing instants (`Date`/epoch) would *introduce* a DST bug that integers avoid.
- **IANA timezones: not needed** for a purely local tool. The device clock is already in the user's zone; you compare `Date.now()`'s local wall-clock minutes to your integers. (If two people in different zones share a link, each sees the schedule in their own local time — which is exactly right for "when does *my* bell ring," and only wrong if a schedule is meant to be pinned to a specific school's zone; note this as a known, acceptable limitation.)
- **Temporal [strong]:** `Temporal.PlainTime`/`PlainDate` are the semantically correct types and reached TC39 Stage 4 on **March 11, 2026** (part of ES2026); shipped in **Chrome 144 (Jan 13, 2026)** and **Firefox 139 (May 2025)**, but **not stable Safari** (Technology Preview only, behind a flag, in 2026), so cross-browser use still needs a polyfill — the official `@js-temporal/polyfill` (~44KB gzip) or the lighter `temporal-polyfill` (~20KB gzip). For arithmetic as trivial as minute comparison, that's not worth it. **Use integers; optionally adopt Temporal internally later if Safari ships and you want calendar math for day-type dates.**

### 5. Day types / multi-schedule modeling

**Real-world patterns [strong/moderate].** Confirmed patterns from the domain: A/B day rotation; **6-day cycles** (Day 1–Day 6, common in Catholic/Northeast US districts); early-release; **late-start / 2-hour delay** (weather); assembly/pep-rally schedules; half days; exam/finals week; homeroom/advisory days; block schedules (4×4, A/B block, hybrid). Ed-Fi confirms schools "may have multiple bell schedules" and select one per date, including one "special for a specific day, such as for a testing day or a late-start day."

**The cycle-advancement problem [moderate].** In N-day rotating cycles, the cycle day is **decoupled from the weekday**: a snow day or holiday *shifts the entire remaining cycle* (if today was Day 3 and school is cancelled, tomorrow is Day 3, not Day 4). This cannot be expressed as "weekday → schedule." It requires either (a) an explicit ordered list of instructional dates with the cycle counter advancing only on those dates, or (b) a base cycle-start date plus a set of skip-dates, computing cycle-day by counting instructional days since start. **Manual advancement/override must be a first-class feature** — a "bump the cycle" control for unplanned closures.

**Interchange standards [strong].** **Ed-Fi's Bell Schedule Domain is the only mainstream standard that directly models this** (BellSchedule/ClassPeriod/Date). **OneRoster (1EdTech) does not model bell times** (it's rostering). **iCalendar RRULE (RFC 5545) cannot cleanly express "Day 3 of a 6-day rotation"** — RRULE has no rotating-cycle primitive; you'd need per-occurrence RDATEs, which is just an explicit date list by another name. SIF/CEDS similarly don't give you a countdown-ready period model. **Conclusion: no drop-in interchange format; roll your own, but mirror Ed-Fi's shape (named schedules + date→schedule map) so your model is conceptually standard.**

**Recommended model.** Two layers:

1. **Named schedule templates:** `{ id, name, periods: Period[] }` (e.g., "Regular", "Late Start", "Assembly", "Half Day", "Day 1"…"Day 6").
2. **A date→schedule resolver**, in priority order: (a) explicit **date override** (`2026-09-14 → "Assembly"`); else (b) **cycle position** if the school uses a rotation (computed from cycle-start + skip-dates, with manual bump); else (c) **default weekly pattern** (`Mon→"Regular"`, etc.); else (d) **"no schedule today"** (weekend/holiday/summer) with a graceful empty state.

**Authoring UX (so it doesn't become a monster):** start users on the weekly-pattern path (covers most schools with zero cycle complexity); reveal rotation and date-overrides progressively; let a template be duplicated-and-tweaked (most day types are "Regular minus 10 minutes everywhere"); provide an offset/shift helper for delays. Keep overrides as a small explicit list the user can see and edit.

### 6. State persistence and sharing

**URL length reality [strong].** The fragment (`#...`) is **never sent to the server**, so Apache/Nginx/CDN request-line limits (~4–8KB) and the endlessly-cited IE "2083" number are **irrelevant** to a hash-based design. The real limit is the browser: Chrome handles very large URLs programmatically (well beyond need), Firefox/Safari tolerate tens of thousands of characters (Firefox's location bar stops *displaying* the full URL around 65,536 chars, but the value still works). For a schedule that compresses to a few hundred characters you have enormous headroom. Do keep it reasonable for messaging-app/link-preview robustness.

**Encoding pipeline [strong].** Recommended: `JSON.stringify(state)` → `CompressionStream('deflate-raw')` → base64url. `CompressionStream`/`DecompressionStream` (gzip/deflate/deflate-raw) have been **Baseline "widely available" since May 2023** — Chromium since 80 (Feb 2020), Safari since 16.4 (March 27, 2023), Firefox since 113 (May 2023); Safari 18.4 even added brotli. `deflate-raw` avoids gzip/zlib header overhead — best for tiny payloads. This beats hand-rolling; **LZ-string (`compressToEncodedURIComponent`)** remains a fine zero-dependency fallback and is what many state-in-URL tools historically used, but native CompressionStream is now the better default. This is the same family of technique Excalidraw uses (it compresses+encrypts scene data and puts the key/id in the hash specifically because the fragment isn't sent to the server) **[strong]**.

**Versioning/migration [strong-principle].** Once a link is shared, that encoded format is permanent. **Prefix the payload with a version marker** (e.g., a leading `v1`/single byte before the compressed blob). On load, branch on version and run migrations forward. Never repurpose a version number. This is cheap insurance that costs one byte.

**Right combination [moderate].**

- **URL hash** = the *shareable* schedule (teacher configures once, shares one link).
- **localStorage** = the *"my schedule" convenience* (last-used schedule auto-loads; also the natural home for personal prefs like theme, seconds-vs-minutes, wake-lock toggle, bell-offset).
- **Plain JSON export/import** = the durable backup/portability fallback (and a debugging aid).
- IndexedDB and File System Access API are overkill for data this small — **reject** both for v1.
- **Privacy note [moderate]:** schedule data is low-stakes, but real leak vectors exist: the full URL (incl. fragment on the client) appears in **browser history and history sync**, and **messaging apps unfurl/preview links** (they fetch the URL — though the fragment usually isn't sent to their preview fetcher, the path is). Don't put anything sensitive (student names, room numbers tied to a person) in the schedule. Referer headers strip the fragment, so that vector is minimal.

### 7. The tab title as a UI surface

- **Visible characters [thin].** There's no authoritative spec; empirically a tab shows roughly 15–25 characters before truncation and shrinks as tab count grows (down to just the favicon when many tabs are open). Put the **most important token first**: `43m · Period 2` beats `Period 2 — 43m left` because the number survives truncation. No primary source pins an exact count; treat as design guidance, not a measured constant.
- **Dynamic favicon [moderate].** Rendering a number or progress ring to a `<canvas>` and swapping the favicon `href` is a real complementary channel (libraries **tinycon** and **favico.js** exist, though maintenance is spotty — consider a small hand-rolled canvas). Constraints: favicon updates ride the same timer throttling; keep to minute cadence in background; render at device-appropriate size for retina. Good for an at-a-glance progress ring; **optional polish.**
- **Accessibility [strong].** Mutating `document.title` does **not** trigger a screen-reader announcement on client-side updates (confirmed: screen readers announce the title on page load and on tab focus, but not on in-place title changes — Hidde de Vries; W3C PF-list testing with NVDA/Orca/JAWS shows the changed title is spoken only when the tab is focused, not as it changes). For a live-updating countdown this is *desirable*: your once-per-minute title churn won't spam AT users. This preserves your 0-axe-violations posture; **don't** wrap the title in an `aria-live` region (that would create the spam). Provide the countdown in the page body as the accessible source of truth; if you want AT users to get period-change alerts, use a *deliberate, polite* `aria-live` region that fires only on period boundaries, not every tick.
- **Title format convention [moderate].** Pomodoro apps converge on `MM:SS — Task` or `⏱ 12:34`. For minute-resolution: `43m · Period 2`. Consider a leading glyph only if it survives truncation cleanly.

### 8. Adjacent features — recommendations

- **Audible bell/chime [moderate]:** Fine **only** as a foreground, user-initiated feature. Autoplay policy blocks unprompted audio; you need a prior user gesture, and it won't fire reliably in a throttled/frozen background tab. **Include as an opt-in "play chime at period change (while tab is open)"; don't promise background chimes.**
- **Notifications at period change [strong]:** Foreground-only nicety (see §2). **Include with honest UX copy** ("works while this tab is open").
- **"What's next" display [moderate]:** High value, trivial. **Include.**
- **Progress bar for current period [moderate]:** High value, trivial, and degrades gracefully (it's just `(now−start)/(end−start)`). **Include.**
- **Before first / after last period [strong-inference]:** Explicit states — "School starts in 1h 12m" and "School's out — see you tomorrow." **Include; they're where naive tools look broken.**
- **Weekend/holiday/no-match [strong-inference]:** A first-class "no schedule today" empty state driven by the resolver (§5). **Include.**
- **Multi-timezone [strong]:** **Reject.** A local tool reads the device clock; adding IANA handling adds bugs for a benefit essentially nobody needs. Note the one caveat (a schedule pinned to a specific school's zone viewed from another zone) as a documented non-goal.
- **Offline / PWA installability [moderate]:** **Include** — it's cheap on Next.js, unlocks the Badging API and Wake Lock ergonomics, and suits the "leave it open on the projector" and "add to phone home screen" cases. Make it installable; don't over-invest in offline sync (there's no server anyway).

---

## Decisions (each fork, with recommendation, reasoning, and the strongest counterargument)

**Throttling strategy → Recompute-from-clock as foundation; Web Worker as optional desktop enhancement.**

- *Reasoning:* Correctness-on-view is the actual product requirement, and `deadline − Date.now()` on tick + `visibilitychange` delivers it under every throttle tier. Workers add live background ticks but don't help mobile freeze.
- *Strongest counterargument:* If the core use case is genuinely "glance at a buried desktop tab and see seconds ticking without clicking it," only a Worker delivers that, and you're leaving the flagship feel on the table by deferring it. *Rebuttal:* You can add the Worker later without changing the data model; recomputation is the safe floor.

**Schedule model → Option B (absolute start/end, minutes-since-midnight ints) with a parse-don't-validate boundary that outputs a branded valid type; overlaps allowed-but-classified; contiguity not enforced.**

- *Reasoning:* Concurrent lunches make Option A unrepresentable-in-the-wrong-direction (it forbids a legal state). Ed-Fi's professional model is Option B–shaped.
- *Strongest counterargument:* Option A's "illegal states unrepresentable" is genuinely more elegant and needs no validator, and *many* schools never have concurrent periods. *Rebuttal:* You can't ship a general tool that silently can't represent a common real schedule; the validator is small and the branded type recovers most of Option A's safety.

**Time representation → minutes-since-midnight integers; no IANA TZ; skip Temporal for now.**

- *Reasoning:* Wall-clock domain, DST-safe, trivially serializable/comparable, zero deps.
- *Strongest counterargument:* Temporal is "the right way" and now ships in 2 of 3 engines. *Rebuttal:* Not stable in Safari in 2026 → 20–44KB polyfill for arithmetic that's a subtraction of two integers. Revisit when Safari ships.

**Day-type model → named schedule templates + priority resolver (date override → cycle position → weekly default → none), with manual cycle-bump for closures.**

- *Reasoning:* Mirrors Ed-Fi; handles A/B, N-day cycles, delays, and one-offs; the resolver localizes all complexity.
- *Strongest counterargument:* This is more machinery than a single-school tool needs. *Rebuttal:* Progressive disclosure keeps the simple case one-screen; the resolver is invisible until used.

**State encoding → version-prefixed JSON → `deflate-raw` → base64url in the URL hash; localStorage for "my schedule"; JSON export/import as backup.**

- *Reasoning:* No backend, no length problem (fragment not sent to server), native compression everywhere, forward-migratable.
- *Strongest counterargument:* LZ-string is simpler and battle-tested for this exact job. *Rebuttal:* It's a fine fallback, but native CompressionStream is now Baseline and dependency-free; either is defensible.

**Thresholds that would change these:** If Safari ships Temporal in stable → adopt `PlainTime`/`PlainDate` internally. If a reliable cross-browser scheduled-local-notification API ships (a revived Notification Triggers) → promote notifications from foreground-nicety to a real feature. If usage shows most schedules exceed a few KB compressed → move the shareable blob behind an optional short-link/paste service (reintroducing a tiny backend), keeping hash as default.

---

## Where the evidence is thin (explicit)

- **Safari/WebKit throttling thresholds:** no public design doc; all specific numbers are empirical/practitioner-sourced. Treat as **thin**; verify by testing on real Safari before relying on any tier.
- **Exact tab-title character budget:** no authoritative source; ~15–25 chars is design folklore, not measurement. **Thin.**
- **"bell.me":** unconfirmed; bell.plus (with its domain migration) is my best-supported guess, not a verified identification. **Thin.**
- **Open-source bell-countdown timer internals:** the specific timer/`document.title`/Worker code in hman124/ABUCKY0/nicolaschan repos was **not directly read**; the "setInterval + recompute-from-Date" description is inferred from stack + genre convention. **Inference — verify by reading the source.**
- **pomofocus.io mechanism:** inferred from a background-CPU bug report, not from reading its source. The Worker-deadline pattern is well-documented for the *genre*, not proven for that specific app. **Thin for the specific app.**
- **`document.title` repaint having no separate throttle:** absence-of-evidence; I found no primary source describing an extra title-specific coalescing, but can't prove none exists. **Moderate.**
- **Recommendations for adjacent features and authoring UX** are my engineering extrapolation, not findings.

---

## Curated links worth reading directly

- **Chrome timer throttling (primary):** developer.chrome.com/blog/timer-throttling-in-chrome-88 (Jake Archibald)
- **Quick intensive throttling intent-to-ship:** chromestatus.com/feature/5580139453743104; blink-dev "Intent to Ship: Quick intensive timer throttling of loaded background pages"
- **Edge policy (throttling described precisely):** learn.microsoft.com IntensiveWakeUpThrottlingEnabled
- **Firefox budget throttling:** bugzilla.mozilla.org/show_bug.cgi?id=1362322 (impl), 1336484 & 1181073 (audio exemptions); MDN Page Visibility API
- **Page Lifecycle:** developer.chrome.com/docs/web-platform/page-lifecycle-api; wicg.github.io/page-lifecycle; github.com/WICG/page-lifecycle
- **Notification Triggers (development ended):** developer.chrome.com/docs/web-platform/notification-triggers; github.com/beverloo/notification-triggers
- **iOS Web Push requires PWA install:** WebKit/Apple docs + practitioner guides (OneSignal, Pushly)
- **worker-timers:** github.com/chrisguttandin/worker-timers
- **CompressionStream (Baseline):** developer.mozilla.org/en-US/docs/Web/API/CompressionStream; web.dev/blog/compressionstreams
- **Excalidraw share-link/hash design:** plus.excalidraw.com/blog/end-to-end-encryption; DeepWiki "Backend Integration and Share Links"
- **Temporal status:** MDN Temporal; TC39 Stage 4 (ES2026, March 11 2026); @js-temporal/polyfill and temporal-polyfill
- **Parse, don't validate:** lexi-lambda.github.io "Parse, Don't Validate" (Alexis King, 2019); Minsky "Effective ML" (2010); Feldman "Making Impossible States Impossible"
- **Ed-Fi Bell Schedule Domain:** docs.ed-fi.org bell-schedule-domain overview & model diagrams
- **Wake Lock (all engines):** web.dev/blog/screen-wake-lock-supported-in-all-browsers; MDN Screen Wake Lock API
- **Badging API:** developer.chrome.com/docs/capabilities/web-apis/badging-api; MDN Badging API
- **Title-change a11y:** hidde.blog/accessible-page-titles-in-a-single-page-app; romaricpascal.is title-element-aria-live
- **Prior art to read:** github.com/nicolaschan/bell (bell.plus, with clock sync); github.com/hman124/bell-countdown; github.com/ABUCKY0/bell-countdown; bellschedule.app
