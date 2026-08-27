# Accessibility & Responsive‑Layout QA for the Puzzle App: A Practical Reference (2026)

*New sections to append to the existing Mobile Responsiveness & PWA guide. Scope: WCAG 2.1/2.2 success criteria beyond touch‑target size, accessible grid/game patterns, responsive‑layout bug detection, and an automated a11y testing workflow for a Next.js app (Killer Sudoku, Kakuro/KenKen, Classic Sudoku, plus forms, profile, achievements, shop).*

## TL;DR

- **Design and test to WCAG 2.2 Level AA.** The criteria that most affect this app beyond touch targets are 1.4.10 Reflow (usable at 320 CSS px / 400% zoom with no 2‑D scrolling), 1.4.4 Resize Text (200%), 1.3.4 Orientation (no lock), 1.4.11 Non‑text Contrast (3:1 for grid lines, cell borders, focus rings), 1.4.1 Use of Color (difficulty/streak/rarity must not rely on color alone), 1.4.13 Content on Hover/Focus, 2.4.7/2.4.11 focus visible & not obscured, and 2.3.3 / `prefers-reduced-motion` for animation. The puzzle grids themselves are an explicit Reflow exception (games/data grids need 2‑D layout), but everything around them must reflow.
- **Build the puzzle boards on the WAI‑ARIA grid pattern** with roving `tabindex` (one `tabindex="0"` cell, all others `-1`), arrow‑key navigation, and an `aria-live="polite"` region that announces cell state changes (value entered/cleared, conflict, puzzle solved) since focus does not move when a digit is typed. Manage focus into/out of mobile modals and never disable pinch‑zoom in the viewport meta tag.
- **Automate the checks in CI.** Combine static linting (`eslint-plugin-jsx-a11y`, already bundled in Next.js), component/DOM scans (`jest-axe` + `@axe-core/playwright`), a Playwright loop that asserts `documentElement.scrollWidth <= clientWidth + 1` across breakpoints, `toHaveScreenshot()` visual regression, and a PerformanceObserver CLS check. Automated tools cannot find everything — axe‑core's own project states it detects "on average 57% of WCAG issues automatically" by issue volume (and only ~30–40% measured by success‑criteria count) — so add manual keyboard‑only and screen‑reader passes (NVDA, VoiceOver, TalkBack).

---

## Key Findings

1. **The grids are exempt from Reflow, but nothing else is.** WCAG 1.4.10 explicitly lists "games" and "data tables (not individual cells)" among content that may require two‑dimensional layout. A Sudoku/Kakuro board can therefore keep its 2‑D shape at 400% zoom, but the page chrome, forms, profile, achievements list, and shop must reflow to a single column at 320 CSS px wide without horizontal scrolling.
2. **Most responsive failures are a handful of recurring CSS causes** — fixed pixel widths, `100vw` ignoring the scrollbar, images/media without `max-width:100%`, unwrapped long strings, absolutely‑positioned/off‑screen elements, and negative margins. These are cheap to detect programmatically.
3. **Color‑coded game semantics are the highest‑risk 1.4.1 area.** Difficulty tiers, streak "flames," and achievement rarity tiers commonly rely on color alone. The fix is redundant encoding: icons/shapes, text labels, patterns, or numeric values in addition to color. This matters because low‑contrast text and color‑only cues remain endemic on the web — the WebAIM Million 2026 report found low‑contrast text (SC 1.4.3) on 83.9% of the top million home pages, the single most common WCAG failure for seven consecutive years.
4. **Automated + manual testing is not optional.** Deque's automated‑coverage research (13,000+ pages) found axe‑core detected 57.38% of accessibility issues *by volume*, but coverage measured *by WCAG success criteria* is closer to 30% (the UK GDS benchmark found the best single tool caught 40% of known barriers). Keyboard and screen‑reader testing remain mandatory. Context for framework choice: WebAIM Million 2025 data (as analyzed by beAccessible) showed Next.js pages averaged 38.6 detectable errors, about 24.2% below the site‑wide average — a good baseline, not a pass.

---

## Details

### 1. WCAG 2.1/2.2 success criteria for responsive design

All target **Level AA** unless noted. AA is the level referenced by the ADA (as courts interpret it), Section 508, EN 301 549, and the European Accessibility Act.

**1.4.10 Reflow (AA).** Content must be presentable without loss of information/functionality and without two‑dimensional scrolling at a width equivalent to **320 CSS pixels** (vertical content) or a height of 256 CSS px (horizontal content). 320 px corresponds to a 1280 px desktop viewport zoomed to 400%. Responsive design with CSS media queries is the intended solution. **Exceptions:** images, maps, diagrams, video, **games, presentations, and data tables** where 2‑D layout is needed. *Implication for this app:* the puzzle boards qualify for the exception and may retain a scrollable/2‑D board, but the surrounding UI must reflow to one column. Give any board wrapper `max-width:100%` and let the board itself be the only horizontally‑scrollable region if it cannot shrink further.

**1.4.4 Resize Text (AA).** Text must scale to **200%** without loss of content/functionality and without clipping or overlap. Use relative units (`rem`/`em`/`%`) rather than `px` for font sizes, containers, and positioning. Note the common failures F69 (text/controls clipped or obscured when enlarged) and F80 (text‑based form controls that don't resize) — directly relevant to the app's forms and shop.

**1.3.4 Orientation (AA).** Content must work in both portrait and landscape; do not lock orientation unless essential. Ensure no CSS/JS forces a single orientation on mobile — locking also restricts Reflow.

**1.4.11 Non‑text Contrast (AA).** UI components and meaningful graphics need **3:1** contrast against adjacent colors. For this app this means: **Sudoku/Kakuro grid lines and cell borders**, the thicker 3×3 box separators, input‑field borders, button boundaries, checkbox/radio states, and **focus indicators** must all reach 3:1. Inactive/disabled components are exempt. Watch dark mode separately — ratios must be recalculated against the dark background. A subtle detail from Eric Eggert's analysis: the requirement is about the component being identifiable against *adjacent* colors, not that a border contrasts on both sides.

**1.4.1 Use of Color (A).** Color must not be the *only* means of conveying information. This is the criterion most likely to bite a game UI:

- **Difficulty levels:** pair color with a text label ("Easy/Medium/Hard/Expert") and/or a shape/pip count.
- **Streak flames:** don't rely on flame color alone for streak tier — add a number ("12‑day streak") and/or distinct icon.
- **Achievement rarity tiers:** use borders, symbols, star counts, or labels ("Rare," "Legendary") in addition to tier color — a pattern echoed across game‑accessibility guidance (color as reinforcement, not the sole channel).
- **In‑grid states:** "conflict/invalid" cells must not be red‑only; add an icon, underline, bold, or a text/`aria` announcement. Sudoku validation that highlights valid cells green and invalid red fails 1.4.1 without a second cue.

   Test with a colorblindness simulator (e.g., Color Oracle for deuteranopia/protanopia/tritanopia).

**1.4.13 Content on Hover or Focus (AA).** Tooltips/popovers (e.g., a hint tooltip, an achievement description, a shop item detail) triggered by hover or focus must be **dismissible** (without moving the pointer/focus, e.g., via `Esc`), **hoverable** (the user can move the pointer onto the content without it vanishing), and **persistent** (stays until dismissed, focus/hover leaves, or it's no longer valid). Never make information hover‑only — touch and keyboard users won't get it; expose it on focus and click/tap as well.

**2.4.7 Focus Visible (AA) & 2.4.11 Focus Not Obscured – Minimum (AA, new in 2.2).** Keyboard focus must be visible and, when an element receives focus, it must **not be entirely hidden** by author content such as sticky headers/footers, cookie banners, or a docked mobile keypad. Focus Visible is among the most‑failed of the interaction criteria; a frequent cause is `outline:none` with no replacement (failure F78). (For scale on how common visual‑perception failures are generally: the WebAIM Million 2026 report found 95.9% of the top million home pages had detectable WCAG 2 A/AA failures, averaging 56.1 errors per page.) Provide a robust custom focus ring (e.g., `outline: 3px solid #005fcc; outline-offset: 2px;` or a double box‑shadow ring that works on any background) and use CSS `scroll-padding-top`/`scroll-margin` so a focused cell or field isn't tucked under a sticky bar on reflow. 2.4.11 can be fully automated and must be re‑checked at each responsive breakpoint. (WCAG 2.2 also adds 2.4.13 Focus Appearance at AAA with measurable size/contrast minimums, and 2.4.12 Focus Not Obscured – Enhanced at AAA.)

**2.3.3 Animation from Interactions (AAA) + `prefers-reduced-motion`.** Although 2.3.3 is AAA, respecting the OS "reduce motion" preference is an established baseline best practice. Wrap non‑essential motion (streak/achievement celebrations, cell fill animations, page/panel transitions, parallax) in `@media (prefers-reduced-motion: reduce)` and reduce/replace movement with opacity/short fades. Also honor 2.2.2 Pause, Stop, Hide for any auto‑playing/looping motion (the media query does not cover autoplaying loops). Consider an in‑app "reduce animations" toggle that persists across sessions.

**Viewport meta — do not disable zoom.** Use `<meta name="viewport" content="width=device-width, initial-scale=1">`. Never ship `user-scalable=no` or `maximum-scale=1` (below 2) — it blocks pinch‑zoom and fails 1.4.4 (axe rule `meta-viewport`; also flagged by Lighthouse). Modern iOS Safari ignores these for accessibility, but Android browsers still honor them, so remove them. If you need to prevent accidental zoom on the board during play, scope it with CSS `touch-action` on the board element instead of globally disabling zoom.

### 2. Accessible grid / puzzle‑board patterns

**Use the WAI‑ARIA Grid pattern.** A Sudoku/Kakuro/KenKen board is an interactive tabular widget. The APG grid pattern and MDN `grid` role define the model:

- Container `role="grid"` (a native `<table role="grid">` is acceptable and brings built‑in semantics), rows `role="row"`, cells `role="gridcell"`. Provide an accessible name via `aria-label`/`aria-labelledby` (e.g., "Killer Sudoku, 9 by 9").
- **Roving tabindex:** exactly one cell has `tabindex="0"`; all others `tabindex="-1"`. Arrow keys move focus cell‑to‑cell (Right/Left = columns, Up/Down = rows); Home/End to row ends; Ctrl+Home/Ctrl+End to grid start/end. Tab moves *out* of the grid to the next widget, not through 81 cells — this is the core benefit of the pattern (Meta's "logical grid" reduces hundreds of tab stops to one).
- For a numeric puzzle, a cell typically contains an editable value. If a cell contains a single interactive control that doesn't consume arrow keys, focus may go on the control; otherwise focus the `gridcell`. Decide whether arrow focus **wraps** at row ends — APG says wrapping is expected for non‑spreadsheet grids, but for a Sudoku board most implementations do *not* wrap (matching the visual mental model).
- Expose position and state: `aria-rowindex`/`aria-colindex` help screen readers announce "Row 7, Column 2"; use `aria-readonly` on given/clue cells; convey the current value in the accessible name (e.g., "5, Row 3 Column 4" or "empty, Row 3 Column 4"). Real accessible‑Sudoku implementations announce "No number shown, Group 7, Row 7, Column 2" (VoiceOver) and offer helper keys — Accessible Sudoku uses R/C/B to read a row/column/box and V to validate.

**Announcing state changes with live regions.** When the user types or clears a digit, **focus stays on the cell**, so the screen reader will not automatically re‑announce it. Add a visually‑hidden `aria-live="polite"` region and write short messages into it on each change ("5 entered, cell now filled"; "conflict: 5 already in this row"; "cell cleared"; "puzzle complete"). Use `aria-live="assertive"` only for urgent, interrupting messages (e.g., "invalid move"), sparingly. This mirrors how accessible Wordle clones expose green/yellow/gray results as text/announcements rather than color, and how well‑built native Sudoku raises a screen‑reader announcement when a square's state changes despite focus not moving. Note live regions must exist in the DOM before they're updated.

**Managing focus in mobile modals/dialogs.** For any dialog (settings, "new game," achievement popup, purchase confirmation, win screen): use `role="dialog"` + `aria-modal="true"`, move focus to the dialog (its heading or first control) on open, **trap** Tab/Shift+Tab within it (looping first↔last), close on `Esc`, make background content `inert`, and **return focus to the triggering element** on close. On mobile, ensure the dialog and its focused controls aren't obscured by the on‑screen keyboard or a sticky bar (2.4.11).

**Color‑independent game semantics (recap of 1.4.1 in the game context):** rarity = border + symbol + label, not just tint; difficulty = label + shape; streak = number + icon; cell conflict = icon/underline + live‑region text. Use patterns/shapes for any color‑coded region (e.g., Killer Sudoku "cages" should be delineated by dashed borders/labels, not color fills alone).

### 3. Detecting common responsive/layout bugs

**Unwanted horizontal overflow — causes.** A page overflows horizontally when `document.documentElement.scrollWidth > clientWidth`. Frequent culprits: elements with fixed widths wider than the viewport; `width:100vw` (which ignores the vertical scrollbar width, so it exceeds the viewport by the scrollbar width on Windows/Linux); images/iframes/video without `max-width:100%`; long unbreakable strings (URLs, long numbers); flex items that don't wrap; and absolutely‑positioned or off‑screen elements (even `opacity:0`) extending past the viewport. Safe global defaults: `img,video,iframe{max-width:100%;height:auto;}` and `overflow-wrap:break-word` (plus `hyphens` with a correct `lang`). Prefer fixing the offending element over masking with `overflow-x:hidden`, which hides the symptom and can clip content.

**Finding overflow — DevTools & console.**

- Firefox DevTools shows a **scroll badge** next to scrolling elements and can highlight the elements causing overflow; Chrome/Edge/Safari also show scroll badges; Polypane shows a dedicated "horizontal overflow detected" indicator that highlights offenders in red.
- Outline everything to see bounds without affecting layout (outlines take no space): paste in the console — `$$('*').forEach(el => el.style.outline = '1px solid red')` — then reload to clear.
- List offenders in the console:

     ```js
     const vw = document.documentElement.clientWidth;
     [...document.querySelectorAll('body *')]
       .filter(el => el.getBoundingClientRect().right > vw + 0.5 || el.getBoundingClientRect().left < -0.5)
       .forEach(el => { el.style.outline = '2px solid #e11d48'; console.log(el); });
     ```

- The **Overflow Finder** Chrome extension adds a DevTools tab that scans and ranks culprits with a likely cause (e.g., `width:1400px`, `white-space:nowrap`, a missing image `max-width`, `table-layout:auto`, or an off‑screen `translateX`).

**Unexpected whitespace/gaps — causes.** Collapsing vertical margins (adjacent block margins merge to the larger; a child's `margin-top` can "escape" its parent) — fixing options: make the parent a flex/grid container (margins don't collapse in a BFC), add padding/border, or use `gap` instead of margins. Also: flex/grid `gap` stacking on top of item margins and `justify-content`/`align-content` spacing; unexpected `min-height` (e.g., `100vh`) leaving big blank areas; whitespace between `inline-block` elements from HTML source newlines; and overflow from absolutely‑positioned elements. Inspect computed styles in DevTools to pinpoint the source.

**Playwright — automated overflow detection across breakpoints.** Loop viewports and assert no horizontal overflow, using a `+1` px tolerance to avoid sub‑pixel false positives:

```ts
import { test, expect } from '@playwright/test';

const sizes = [
  { width: 320, height: 640 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

test('no horizontal overflow across breakpoints', async ({ page }) => {
  await page.goto('/');
  for (const size of sizes) {
    await page.setViewportSize(size);
    const hasOverflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth + 1;
    });
    expect(hasOverflow, `overflow at ${size.width}x${size.height}`).toBeFalsy();
  }
});

```

To **report the offending selectors** (rather than just pass/fail), a fuller TypeScript crawl (Steve Fenton's pattern) walks `document.querySelectorAll('*')`, builds a CSS‑selector path for any element wider than its sized ancestor, and skips elements whose ancestor is a legitimate `overflow-x:auto` scroller — important here so the intentionally scrollable puzzle board doesn't trigger a false failure. Run visual/overflow suites on at least two OSes because scrollbar widths differ (macOS vs. Linux CI), and prefer `window.innerWidth` on iOS where `clientWidth` can be unreliable.

**Playwright — responsive visual regression.** Use `toHaveScreenshot()` (built‑in, backed by pixelmatch). It auto‑retries until the page stabilizes and supports `mask`, `maxDiffPixels`, `maxDiffPixelRatio`, `threshold`, and `animations`. Recommended config:

```ts
// playwright.config.ts
export default defineConfig({
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,        // absorb anti-aliasing
      maxDiffPixelRatio: 0.01,   // ~1% tolerance
      animations: 'disabled',
      scale: 'device',
    },
  },
  use: { reducedMotion: 'reduce' },
});

```

Loop breakpoints with dynamically named snapshots (`home-${name}.png`), **mask** dynamic content (timestamps, avatars, live shop prices, streak counters, the random puzzle) to avoid false diffs, and **generate baselines in CI** (not locally) since rendering varies by OS/hardware/headless mode. Baseline PNGs encode browser+platform in the filename. Note a known bug (microsoft/playwright #30112) where `maxDiffPixelRatio` was not honored in v1.42.1 — verify against your Playwright version.

**Playwright — layout shift (CLS).** Inject a PerformanceObserver via `page.evaluate` to accumulate `layout-shift` entries and assert against Google's "good" threshold. Google's web.dev Web Vitals guidance states pages should maintain a CLS of **0.1 or less** (assessed at the 75th percentile of real page loads):

```ts
test('CLS is within budget', async ({ page }) => {
  await page.goto('/');
  const cls = await page.evaluate(() => new Promise<number>((resolve) => {
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) clsValue += entry.value;
      }
      resolve(clsValue);
    }).observe({ type: 'layout-shift', buffered: true });
    setTimeout(() => resolve(clsValue), 3000); // fallback so the promise always resolves
  }));
  expect(cls).toBeLessThan(0.1);
});

```

Essentials: `buffered:true` captures already‑observed shifts and the `!entry.hadRecentInput` filter excludes shifts within 500 ms of user input. Each `layout-shift` entry also exposes a `sources[]` array with `previousRect`/`currentRect` to pinpoint which node moved. Caveat: `layout-shift` and Core Web Vitals are **Chromium‑only** (not Firefox/WebKit), and a naive never‑resolving Promise causes timeouts — hence the `setTimeout` fallback.

### 4. Automated accessibility tooling & workflow for Next.js

**Tool roles (no single tool is complete — axe‑core's own docs cite ~57% of issues found by volume, and roughly 30–40% measured by WCAG criteria):**

- **`eslint-plugin-jsx-a11y`** — static JSX analysis; **already bundled** in Next.js via `eslint-config-next/core-web-vitals` (catches e.g. missing `alt`, bad ARIA). Turn on `recommended`/`strict`. Fast, runs on every commit/PR.
- **axe‑core** — the engine behind most dev tooling; zero‑false‑positive policy. Use via `jest-axe` (component/unit tests) and **`@axe-core/playwright`** (`AxeBuilder`) for rendered‑DOM E2E scans. Optionally `@axe-core/react` to log violations in the browser console in dev (never in production bundles).
- **Lighthouse (Lighthouse CI)** — runs a subset (~57 audits, incl. `meta-viewport`) alongside performance; good for scoring trends in CI.
- **Pa11y / Pa11y CI** — CLI for scanning URLs/sitemaps in the pipeline; good for batch/marketing pages.
- **WAVE** — WebAIM browser extension for in‑context manual visual audits (not automation).

   A pragmatic minimum: one automated engine (axe or Lighthouse) **plus** keyboard and basic screen‑reader testing.

**CI pipeline (GitHub Actions / GitLab CI / etc.).** Stages: (1) `eslint` with jsx‑a11y on every PR (blocking); (2) `jest-axe` in unit tests for key components (the board, cell, forms, modal, achievement card); (3) Playwright + `@axe-core/playwright` scanning top user journeys/pages (home, a puzzle in each mode, login/signup form, profile, achievements, shop, checkout) — inject axe after navigation and assert `expect(results.violations).toEqual([])`; (4) the overflow, visual‑regression, and CLS Playwright tests above. Run a lightweight smoke scan on each PR and a fuller WCAG scan nightly/pre‑release. Playwright integrates natively with GitHub Actions, GitLab CI, Jenkins, and CircleCI. Basic `@axe-core/playwright` usage:

```ts
import AxeBuilder from '@axe-core/playwright';
test('home page has no detectable a11y violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

```

**Manual keyboard‑only workflow.** Unplug the mouse. Verify: logical Tab order matching visual/DOM order; every interactive element reachable and operable; visible focus everywhere; no keyboard traps; modals trap and restore focus; and the **board is fully playable via arrow keys + number entry + delete/backspace**, with Tab entering/leaving the grid as a single stop. Confirm hint tooltips are reachable and `Esc`‑dismissible. Re‑run at 200% text and 400% zoom.

**Manual screen‑reader workflow.** Test the primary combinations: **NVDA + Chrome/Firefox** (Windows), **VoiceOver + Safari** (macOS/iOS), and **TalkBack** (Android) for the mobile PWA. For complex widgets ensure the screen reader is in focus/application mode so arrow keys reach the grid. Verify: the grid is announced as a grid; each cell announces position + value/empty + given/editable state; typing/clearing a digit is announced via the live region; conflicts and "solved" are announced; the announced reading order matches the visual order; and dialog open/close is announced with focus landing and returning correctly. Turn the screen off and try to complete a puzzle by audio alone.

---

## Recommendations

**Stage 1 — Guardrails (week 1, low effort, high leverage).**

- Fix the viewport meta tag (remove any `user-scalable=no`/`maximum-scale`).
- Add global CSS: `img,video,iframe{max-width:100%;height:auto}`, `overflow-wrap:break-word`, relative font units, and a strong `:focus-visible` ring.
- Enable `eslint-plugin-jsx-a11y` `recommended` (or `strict`) and make it a blocking CI check.
- Add the Playwright horizontal‑overflow test across 320/375/768/1024/1440 and wire it into CI. **Threshold to change plan:** any overflow failure blocks merge.

**Stage 2 — Grid & color semantics (weeks 2–4).**

- Refactor each board to the ARIA grid pattern (roving tabindex, arrow keys, `aria-rowindex/colindex`, `aria-readonly` clues) with a polite live region for state changes.
- Audit difficulty/streak/rarity/conflict encodings for 1.4.1; add icon/shape/label redundancy. Verify all grid lines, cell borders, and focus rings hit 3:1 (1.4.11) in both light and dark themes.
- Implement modal focus management (trap, `Esc`, restore, `inert` background).

**Stage 3 — Deep testing & regression (weeks 4–6, ongoing).**

- Add `jest-axe` component tests and `@axe-core/playwright` journey scans to CI (smoke on PR, full nightly). **Threshold:** zero critical/serious axe violations to release.
- Add `toHaveScreenshot()` responsive baselines (masked dynamic content, baselines built in CI) and the CLS budget test (**target CLS < 0.1**).
- Run the manual keyboard and NVDA/VoiceOver/TalkBack passes each release; recruit at least one colorblind and one screen‑reader user for periodic usability testing.
- Verify Reflow/Resize by manually testing every non‑game page at 320 px width, 200% text, and 400% zoom.

**Benchmarks that change the plan:** if axe journey scans stay clean for several releases, shift full scans from nightly to pre‑release; if visual‑regression false positives exceed real catches, raise `maxDiffPixelRatio` or expand masks; if manual SR testing repeatedly finds grid announcement gaps, invest in a dedicated accessible‑board component with documented keyboard/AT behavior.

---

## Caveats

- **Automated coverage is partial.** axe‑core detects roughly 57% of accessibility issues by volume (Deque research) but only ~30–40% measured by WCAG success criteria (UK GDS benchmark: best single tool = 40% of known barriers); tools cannot judge whether color meaning is adequately conveyed, whether announcements make sense, or whether the board is *playable* by AT. Manual testing is required, not optional.
- **The Reflow game exception is narrow.** It covers the board's 2‑D layout only; the surrounding app must still reflow, resize, and rotate. Don't use "it's a game" to excuse a non‑responsive shell.
- **Platform variance.** Screen readers announce differently across NVDA/JAWS/VoiceOver/TalkBack; Core Web Vitals/`layout-shift` are Chromium‑only in Playwright; scrollbar widths and font rendering differ by OS, so build visual/overflow baselines in the CI environment and test on multiple platforms.
- **2.3.3 is AAA / 2.4.11 vs 2.4.13.** Honoring `prefers-reduced-motion` is best practice but formally AAA; Focus Not Obscured is AA at "Minimum" (2.4.11) and AAA at "Enhanced" (2.4.12/2.4.13) — target AA for compliance, AAA where cheap.
- **Tooling drift.** Verify current versions before adopting snippets (e.g., the Playwright `maxDiffPixelRatio` bug #30112 in v1.42.1); ARIA grid support and browser behavior evolve.
