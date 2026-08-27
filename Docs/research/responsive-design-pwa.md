# Responsive Design & PWA Reference for a Next.js Puzzle App (2026)

## TL;DR

- **Design mobile-first for a 360–430px CSS viewport band** (the widths 414×896, 360×800, 390×844 and 375×812 together dominate global mobile traffic), test at 320/360/390/414 + 768/1024/1440, and lean on modern, now-Baseline CSS: **fluid `clamp()` typography, `dvh/svh` viewport units, `env()` safe-area insets, container queries, and `aspect-ratio: 1` for the square puzzle boards**, with **44–48px touch targets**.
- **Ship the PWA with Serwist** (the actively maintained successor to next-pwa) plus a Next.js App Router `manifest.ts`, a `192×192` + `512×512` + `512×512 maskable` icon set, and iOS `apple-touch-icon` / `apple-mobile-web-app-capable` meta tags. Expect a **first-class installable experience on Android/Chrome (`beforeinstallprompt`)** but a **degraded, manual, capability-limited one on iOS Safari** (no install prompt, ~50MB cache, storage eviction, EU standalone-mode removal).
- **The biggest UX wins come from avoiding the classic mobile traps**: the `100vh` jump when browser chrome shows/hides, hover-only interactions on touch, tiny tap targets, desktop-width modals, and fixed elements colliding with notches/home indicators.

## Key Findings

1. Mobile is now the majority of web traffic — StatCounter's "Desktop vs Mobile Market Share Worldwide — May 2026" reports **Mobile 51.04% / Desktop 48.96%**. The global mobile browser market is a two-engine reality: **Chrome 67.97% and Safari 24.07%** (StatCounter, June 2026), with Samsung Internet a distant third (2.46%). In the US, Safari *leads* mobile (~55%).
2. Real-world CSS viewport widths cluster tightly in a 360–430px band; you design against CSS pixels, not raw hardware resolutions (iPhones run DPR 3, so a 1179×2556 panel = 393×852 CSS px).
3. Container queries and the new viewport units (dvh/svh/lvh) are both Baseline/widely available in 2026 — usable in production with a `vh` fallback.
4. iOS PWA support remains materially weaker than Android and is entirely Apple-controlled; the practical stance is "PWA as a fast front door," not a heavy offline app — especially for EU users.
5. Use `aspect-ratio: 1` + CSS Grid so the Sudoku/Kakuro/KenKen boards stay square and as large as possible within available space, with zero JavaScript.

## Details

### 1. Device & Browser Landscape (2026)

**Mobile vs desktop.** Per StatCounter Global Stats ("Desktop vs Mobile Market Share Worldwide — May 2026"), the worldwide two-way split is **Mobile 51.04% / Desktop 48.96%**. Mobile has been the majority for years and continues to inch up — the reason mobile-first design and Google's mobile-first indexing matter for both UX and SEO.

**Mobile browsers (StatCounter, worldwide, June 2026):**

- Chrome — 67.97%
- Safari — 24.07%
- Samsung Internet — 2.46%
- Opera — 1.69%
- UC Browser — 1.17%
- Firefox — 0.7%

Critically, **every browser on iOS uses Apple's WebKit engine** (Apple mandate), so "Chrome on iPhone" is WebKit under the hood. Roughly 78% of global mobile sessions run on Chromium's Blink; WebKit ~18%; Gecko ~3%. Practical rule: **build for Blink, test on WebKit (Safari), verify on Gecko (Firefox)**. In the US the ranking inverts — Safari ~55% vs Chrome ~38% on mobile — because of iPhone penetration, so a US-focused puzzle audience makes Safari your primary target.

**Mobile screen resolutions (StatCounter, worldwide, June 2026):**

- 414×896 — 12.09%
- 360×800 — 9.21%
- 390×844 — 6.31%
- 375×812 — 5.99%
- 393×873 — 4.48%
- 384×832 — 3.93%

The list is highly fragmented (top 6 ≈ 42%; the top 5 cover only ~35% of usage, with the rest spread across hundreds of variants). **CSS pixels, not physical pixels, drive layout.** DeviceAtlas's May 2026 traffic sample confirms 360, 384, and 412px each take about a sixth of Android traffic; iPhone traffic clusters in the 390–414 band (DPR 3 on ~82% of iPhone traffic).

**CSS viewport widths by device (design targets):**

- iPhone 15/16 base, Pixel 9 → ~390–393 px (DPR 3; iPhone 15 = 393×852, physical 1179×2556)
- iPhone Pro Max / large models → up to ~430 px
- iPhone SE / older LCD (XR, 11) → 375 px (DPR 2)
- Samsung Galaxy S base → 360 px; Galaxy A-series and Ultra → 384 px
- Large Android flagships / foldables (unfolded) → 412–430 px; foldables can be ~280 px folded and ~600–900 px unfolded
- iPad (classic) → 768 px; iPad Air/Pro → 820/834/1024 px

**Most popular phone models (Counterpoint Research, Global Handset Model Sales Tracker, full-year 2025, published Jan 28 2026).** The **iPhone 16 was the world's best-selling smartphone in 2025**. Per Counterpoint analyst Harshit Rastogi, "Apple and Samsung devices dominated the top 10 list for the fourth consecutive year, accounting for 19% of overall smartphone sales" — with **Apple taking 7 of the top 10 spots and Samsung 3**. Counterpoint notes that **"Samsung's Galaxy A16 5G became the best-selling Android smartphone of 2025"** (~$184 mid-ranger), ranked fifth overall, with the Galaxy S25 Ultra the only Android flagship in the top 10 (ranked 9th). Counterpoint also reported that "the iPhone 17 series achieved 16 percent higher sales than the predecessor series during its first full quarter in the market, driven by strong initial demand in… the US, China, and Western Europe." This confirms the design targets above: a handful of iPhone widths (375/390/393/430) plus Samsung 360/384 cover the overwhelming majority of premium and mid-range devices. (Counterpoint publishes the ranked list largely as an image and does not disclose unit numbers; ordinal detail is corroborated via MacRumors/NotebookCheck citing Counterpoint.)

**Industry-standard breakpoints (2026 consensus).** Breakpoints should be *content-driven* — resize until the layout breaks, then add a breakpoint — but the converged ranges are:

- **Small phone:** 320–480 px (single column, bottom-bar/hamburger nav, larger tap targets)
- **Large phone / small tablet:** 481–768 px
- **Tablet:** 769–1024 px (the 1024 mark is the touch→cursor transition; sidebars appear)
- **Small desktop:** 1025–1200 px
- **Large desktop:** 1201 px+

Most sites need only **3–5 breakpoints**; a common minimal set is 320+, 768+, 1024+. Prefer **min-width (mobile-first)** queries. Consider **rem-based breakpoints** so they respect the user's base font size (an accessibility win). Tailwind's defaults (sm 640, md 768, lg 1024, xl 1280, 2xl 1536) are a reasonable out-of-the-box match.

### 2. Responsive CSS Techniques

**Fluid typography with `clamp()`.** Replace stacks of font-size media queries with one line: `font-size: clamp(MIN, PREFERRED, MAX)`. Always mix a viewport unit **with a rem term** in the preferred value — e.g. `clamp(1rem, 0.9rem + 0.5vw, 1.25rem)` — because pure `vw` breaks browser zoom and fails WCAG 1.4.4 (Resize Text). `clamp()` has shipped in every evergreen browser since 2020 (~98% support). Cap the maximum so text doesn't balloon on 4K, and include a plain `font-size` fallback line before the clamp. Common pitfalls: min > max (silently resolves to min), and a fixed-px preferred value (no scaling). For a puzzle app, use `clamp()` for headings, hero/marketing text, and spacing — but keep body copy and grid-cell numbers on a controlled scale for consistency.

**Responsive units.**

- `rem` for type and breakpoints (respects user prefs).
- `dvh/svh/lvh` for viewport height (see pitfalls). Rule of thumb: **`svh` for ~90% of full-height layouts** (never overflows), `lvh` for immersive backgrounds, `dvh` only where you specifically need real-time adaptation (it can cause layout jank/recalcs mid-scroll). All three reached Baseline "Widely Available" in June 2025; support is Chrome 108+/Firefox 101+/Safari 15.4+/Edge 108+/Samsung Internet 21+ (~95% of users). Always pair with a `vh` fallback; note neither reacts to the on-screen keyboard (use `interactive-widget=resizes-content` in the viewport meta or JS for that).
- `vw/vi/vb`, and `cqi/cqw/cqmin` (container units) for component-scoped fluid sizing.

**Container queries vs media queries.** Container **size** queries are Baseline since 2023 (Chrome 105+, Safari 16+, Firefox 110+) — safe in production with no polyfill. Rule: **media queries for the page skeleton, container queries for reusable components.** For this app they're ideal for cards that appear in multiple contexts — an achievement card, a shop item, or a puzzle-preview tile that sits in a sidebar on desktop and full-width on mobile should respond to *its container*, not the viewport. Container **style** queries (querying custom properties) are landing in Firefox in 2026 (Interop 2026) to complete coverage.

**Flexbox & Grid patterns.**

- Auto-responsive grids without media queries: `grid-template-columns: repeat(auto-fit, minmax(MIN, 1fr))` — great for the shop, achievements, and puzzle-selection lists.
- `flex-wrap` + `min-width: 0` on flex children to prevent overflow.
- Use `gap` for spacing rather than margins.

**The puzzle board (Sudoku/Kakuro/KenKen) — the critical interactive grid.**

- Make the board the largest square that fits: wrap the app in `display: grid; grid-template-rows: auto 1fr auto` (header / board area / footer), make the board area `position: relative`, and give the board `aspect-ratio: 1; max-width: 100%; max-height: 100%; margin: auto`. This yields the largest possible square **with no JavaScript and no hardcoded sizes**, adapting as header/footer heights change.
- Inside the board, use `grid-template-columns: repeat(9, 1fr)` (or `repeat(N, 1fr)` for KenKen/Kakuro of size N). Cells inherit squareness from the parent; give cells `min-height: 0; overflow: hidden` so content can't blow out the ratio.
- Size cell numbers and candidate/pencil-mark text with `clamp()` or container-query units (`cqmin`) so digits stay legible on a 360px phone yet scale up on tablets. `aspect-ratio` is fully supported (Chrome/Edge 88, Firefox 89, Safari 15).
- Aim for **≥44px tap targets** per cell on phones. If a full 9×9 board makes cells smaller than ~36–40px on the narrowest phones, that's acceptable for a dense game grid (WCAG 2.5.8 exempts "essential" dense layouts), but compensate with an obvious selected-cell highlight and a **separate number-input pad with 44–48px keys** below the board.

**Touch target sizing (authoritative guidelines):**

- **WCAG 2.5.8 (Level AA, WCAG 2.2):** the normative text requires that "the size of the target for pointer inputs is at least **24 by 24 CSS pixels**, except when: Spacing [24px between targets]… Equivalent… Inline… User agent control… Essential." Legally relevant — the **European Accessibility Act came into force June 28, 2025** (plus ADA and Section 508).
- **WCAG 2.5.5 (Level AAA):** 44×44 CSS px.
- **Apple HIG:** 44×44 pt minimum.
- **Material Design 3:** 48×48 dp recommended, with ≥8dp spacing.
- **Practical rule:** design primary controls at **44–48px** with ≥8px spacing; the 24px WCAG floor is a legal minimum, not a target. Use `@media (pointer: coarse)` to bump sizes on touch devices.

**Safe-area insets (notches, Dynamic Island, home indicators).** Add `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, then pad fixed/sticky elements with `env(safe-area-inset-*)`, ideally via `max()`/`calc()`: e.g. a bottom number pad or nav bar uses `padding-bottom: max(1rem, env(safe-area-inset-bottom))` and `height: calc(56px + env(safe-area-inset-bottom))`. Once you opt into `viewport-fit=cover` you own all padding — headers, footers, and floating buttons are prime candidates to accidentally hide behind system UI. Provide a fallback value (`env(safe-area-inset-bottom, 0px)`) and wrap in `@supports` for older browsers. On a notched iPhone the top inset is ~44px and the home indicator ~34px.

### 3. Testing & Tooling

- **Browser DevTools** (Chrome/Firefox responsive mode) for first-pass breakpoint checks and CPU/network throttling — but the emulator does **not** accurately simulate mobile browser-chrome behavior (the exact thing that breaks `dvh`/`100vh`), so it is not a substitute for a real device.
- **Real-device cloud:** BrowserStack / LambdaTest / Sauce Labs give access to thousands of real devices/browsers without owning them — essential for catching WebKit/Safari and Samsung Internet rendering quirks.
- **Lighthouse mobile audits** (built into Chrome DevTools) for performance, accessibility, best-practices, SEO, and PWA installability; run the mobile emulation profile. Automate it with **playwright-lighthouse** in CI (launch Chromium with `--remote-debugging-port`, set thresholds e.g. performance ≥ 80–90, fail the build on regression).
- **Visual regression:** Playwright's built-in screenshot assertions or **Chromatic** to snapshot the UI at each breakpoint (375/768/1024/1440/1920) and catch layout breakage on every change.
- **Accessibility:** axe-core or pa11y integrated with Playwright for touch-target and contrast checks at mobile viewport sizes.
- Borrow at least one real iPhone and one real Android to test `svh`, safe areas, keyboard behavior, and PWA install — the community consensus is that there is no substitute for real hardware, and emulators mislead.

### 4. PWA / Add-to-Home-Screen in Next.js

**Recommended stack.** Use **Serwist (`@serwist/next`)** — the actively maintained, Workbox-spirit successor to the now-stale next-pwa — for the service worker, plus the App Router's native manifest support. Next.js's own docs also describe a manual App Router approach (an `app/manifest.ts`, a hand-written service worker, and push via the web-push APIs).

**Web app manifest (App Router `app/manifest.ts` or `public/manifest.json`).** Minimum viable manifest needs `name`, `short_name`, `start_url`, `display: "standalone"`, `background_color`, `theme_color`, and **icons**. Reference it with `<link rel="manifest">` (the App Router auto-injects this when you export from `manifest.ts`).

**Icons.** Chrome's installability check **requires a 192×192 and a 512×512 PNG**. Add a **512×512 (and 192) maskable** variant as a *separate file* (`purpose: "maskable"`, never combined as `"any maskable"`) with all content inside the **inner 80% safe zone** (10% padding each side; the 40%-radius safe circle) so Android adaptive-icon masks (circle/squircle/teardrop) don't clip your logo. Use non-transparent square icons (iOS/Android fill transparency with an uncontrolled color). Optional extra sizes (72–384) give pixel-perfect rendering.

**Splash screens.** Android auto-generates a splash from `name` + `theme_color` + `background_color` + icon. **iOS ignores the manifest for splash** and requires per-device `<link rel="apple-touch-startup-image">` images, and only shows them if `apple-mobile-web-app-capable` is present.

**Android/Chrome install.** Chrome fires the **`beforeinstallprompt`** event — capture it, `preventDefault()`, and show your own "Install" button (e.g., on the profile or home page), then call `prompt()`. Installability requires HTTPS (localhost is treated as secure), a valid manifest with the required icons, and a registered service worker.

**iOS-specific quirks & meta tags.** Safari has **no install prompt and no `beforeinstallprompt`** — installation is a manual Share → "Add to Home Screen," so you must **provide guided instructions** (and route users out of in-app webviews into Safari, where the option exists). Required iOS meta/link tags:

- `<meta name="apple-mobile-web-app-capable" content="yes">` (enables standalone mode + startup images)
- `<meta name="apple-mobile-web-app-title" content="AppName">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="...">`
- `<link rel="apple-touch-icon" sizes="180x180" href="...">` — **Safari ignores manifest icons for the home screen and reads this tag instead**; miss it and iOS uses a pixelated page screenshot. (This link tag also overrides manifest icons.)

**iOS limitations (be realistic).** WebKit-only; **~50MB Cache Storage quota**; **storage eviction** if the PWA is unused for ~7+ days / a few weeks; **no Background Sync**, limited background execution; no App Store listing. Push notifications arrived only with **iOS/iPadOS 16.4** and only for home-screen-installed web apps — per the WebKit team (Eidson & Simmons), "with iOS and iPadOS 16.4, we are adding support for Web Push to Home Screen web apps… A web app that has been added to the Home Screen can request permission to receive push notifications as long as that request is in response to direct user interaction — such as tapping on a 'subscribe' button." (Declarative Web Push was added in Safari 18.4.) In the **EU**, Apple stripped standalone PWA mode in the iOS 17.4 timeframe (DMA response), so home-screen PWAs may open as Safari tabs — plan for EU iOS users to get a browser-tab experience. iOS 26 defaults home-screen sites to opening as web apps. WebKit's PWA capability score sits around 86/100 vs Chrome-on-Android's ~97/100.

**Offline support.** For a puzzle app, cache the **app shell** (HTML/CSS/JS) and puzzle assets so a user can keep playing offline; use Serwist's precache + a runtime NetworkFirst strategy for dynamic data (profile, shop, achievements sync) and a `/~offline` fallback route. Keep the cache small (well under iOS's ~50MB), re-cache critical assets on launch, and assume the cache can be evicted — **never treat it as durable storage for user progress; sync to your backend.**

### 5. Common Pitfalls & Anti-Patterns

- **`100vh` jump.** On mobile, `100vh` = the *largest* viewport (chrome hidden), so a "full-screen" element overflows on load and jumps when the address bar retracts. Fix: use `svh` (won't overflow) or `dvh` where live adaptation is needed. This is the single most common mobile CSS bug.
- **Hover-dependent interactions.** Touch devices can't hover; menus/tooltips that only appear on `:hover` become unreachable. Use `@media (hover: hover)` to gate hover enhancements, ensure top-level nav items are real links, and provide tap equivalents. Handle `@media (pointer: coarse)` for touch sizing.
- **Tiny tap targets & tight spacing** cause mis-taps and "rage tapping" — the app feels unresponsive. Meet the 44–48px guideline, add spacing, and always show a pressed/focused state for feedback.
- **Fixed/sticky positioning colliding with system UI** — fixed headers hide behind the notch/Dynamic Island; bottom bars sit under the home indicator. Always add safe-area padding to fixed/sticky elements. Note that `transform` happens after layout, so animated bottom sheets can slide under the home indicator.
- **Fixed elements inside scroll/overflow containers** silently break; sticky is usually the better tool, and requires an ancestor without `overflow: hidden`.
- **Unresponsive modals/dialogs** that assume desktop width overflow small screens; full-screen dialogs must respect safe-area insets and use `svh`/`dvh` for height. Prefer bottom-sheet patterns on mobile.
- **Layout shift (CLS)** from images without dimensions or late-loading banners — reserve space with `aspect-ratio`, which also feeds Google's ranking signals.
- **Content parity** — don't hide content on mobile that's available on desktop; use progressive disclosure (accordions/tabs/drawers) instead.
- **Pure-`vw` fonts** break zoom (WCAG fail); **fixed-px fonts** ignore user prefs — use `rem`/`clamp()` with a rem term.
- **Only testing portrait** — users rotate; test landscape (limited height) and both foldable states.

## Recommendations

**Stage 1 — Foundation (do first).**

1. Add the viewport meta with `viewport-fit=cover`. Set `box-sizing: border-box`, `margin:0`, and a mobile-first base stylesheet.
2. Establish a token system: rem-based type scale with `clamp()`; a spacing scale; breakpoints at 480/768/1024/1280 (min-width). If using Tailwind, keep defaults.
3. Build the puzzle board with the `grid-rows: auto 1fr auto` + `aspect-ratio: 1` + `margin:auto` pattern so it's correct on every screen from day one. Add a separate 44–48px number-input pad for phones.
4. Apply `svh` for full-height layouts (with `vh` fallback) and `env()` safe-area padding to any fixed/sticky nav, header, or number pad.

**Stage 2 — Cross-device correctness.**

5. Convert reusable components (achievement cards, shop items, puzzle tiles) to **container queries**.
6. Gate all hover behavior behind `@media (hover: hover)`; verify every interactive element ≥44px on `pointer: coarse`.
7. Make modals bottom-sheets on mobile; verify they fit `svh` and respect safe areas.

**Stage 3 — PWA.**

8. Add `app/manifest.ts` with name/short_name/start_url/standalone/theme+background colors and the 192/512/512-maskable icon set; add iOS `apple-touch-icon` (180) + `apple-mobile-web-app-*` meta tags and per-device startup images.
9. Integrate **Serwist**: precache the app shell, NetworkFirst for dynamic data, `/~offline` fallback. Sync puzzle progress to the backend (never rely on cache durability, especially on iOS).
10. Implement a custom install button via `beforeinstallprompt` on Android, and a guided "Add to Home Screen" instruction sheet for iOS (detect iOS + not-standalone).

**Stage 4 — Testing & CI.**

11. Wire **playwright-lighthouse** into CI with the mobile profile and score thresholds; add **Playwright/Chromatic visual snapshots** at 375/768/1024/1440.
12. Run a **BrowserStack** pass on a real iPhone (Safari) + Samsung (Samsung Internet) + Pixel (Chrome) before launch; test PWA install on both platforms and offline mode.

**Thresholds that change the plan:** If analytics show a **US-heavy audience**, prioritize Safari/WebKit testing (Safari ~55% US mobile). If a **material EU iOS** share appears, treat the iOS PWA as browser-tab-only and consider a native wrapper (Capacitor) for those users. If **foldables/tablets** exceed a few percent, add explicit tests at 280px, 600–900px, and 768/1024. If Lighthouse mobile performance drops **below 80**, fix before shipping new features.

## Caveats

- **Market-share figures fluctuate monthly and vary by source.** The browser/resolution numbers here are StatCounter (June 2026) and the platform split is StatCounter (May 2026), based on its "over 3 billion monthly page views" web-traffic methodology — they reflect *traffic* share, not device sales, and secondary aggregators report meaningfully different numbers (e.g., Cloudflare Radar puts Chrome higher). Treat them as directional.
- **Phone-model rankings** are from Counterpoint Research (full-year 2025, published Jan 28 2026); Counterpoint publishes the ranked list largely as an image and does not disclose unit numbers, so the exact ordinal order is corroborated via secondary tech press (MacRumors, NotebookCheck) citing Counterpoint.
- **iOS PWA behavior is a moving target** tied to Apple's roadmap and EU/DMA regulation; verify current WebKit feature status before relying on push, storage, or standalone mode, especially for EU users.
- Browser-support percentages for CSS features are approximate and drawn from caniuse/Baseline as of early–mid 2026; keep a fallback for the small tail of older Samsung Internet/UC Browser builds.
- Some figures (e.g., iOS ~50MB cache quota, ~7-day storage eviction) come from developer testing rather than official Apple documentation and may vary by iOS version.
