import { expect, type Page } from "@playwright/test";
import { BASE_PATH } from "../playwright.config";

/**
 * Shared setup for the E2E suites.
 *
 * Everything here exists to make "what time is it" a decision rather than an
 * accident. The app resolves which schedule runs from the weekday and paints
 * from the wall clock, so against a real clock these tests would pass on a
 * Wednesday morning and fail on a Saturday night.
 */

/**
 * The UTC offset on these fixtures is load-bearing, not decoration.
 *
 * `new Date("2026-09-02T09:30:00")` - no offset - parses in the timezone of
 * the NODE PROCESS, while the browser is pinned to America/New_York by
 * playwright.config.ts. On a machine in New York the two agree and the suite is
 * green; on a UTC CI runner they are four hours apart, so every test here ran
 * against 05:30 while every comment in the file said 09:30. Three tests failed
 * for what looked like three unrelated reasons.
 *
 * Both fixtures are EDT (UTC-4). A fixture landing between November and March
 * needs -05:00 - which is the whole reason the app itself stores wall-clock
 * minutes and never a `Date`.
 */

/**
 * Wednesday 2 September 2026, 09:30 - inside Period 2 of the Regular day
 * (09:05-10:05), on a weekday the default calendar points at "regular".
 */
export const MID_PERIOD = "2026-09-02T09:30:00-04:00";

/** The same Wednesday at 07:00, before the 08:00 first bell. */
export const BEFORE_SCHOOL = "2026-09-02T07:00:00-04:00";

/** The same Wednesday at 15:00, after the 14:30 last bell. */
export const AFTER_SCHOOL = "2026-09-02T15:00:00-04:00";

/**
 * Saturday 5 September 2026, 09:30 - the same hour of the school day, on a day
 * the default calendar points at nothing. The pair is what separates "no school
 * today" from "the day is over".
 */
export const WEEKEND = "2026-09-05T09:30:00-04:00";

/**
 * Loads the app with the clock frozen at `at`.
 *
 * clock.install must happen BEFORE goto. Phase 1's page reads no clock at all,
 * but Phase 2's countdown is a client component that reads one on mount, and a
 * clock installed after navigation would arrive too late to decide the first
 * paint. Installing it first now means the countdown lands in a harness that
 * already controls time rather than one that has to be retrofitted.
 */
export interface OpenOptions {
  /**
   * A raw value to plant under BellTab's storage key before the app loads.
   *
   * Written with `addInitScript` rather than `page.evaluate` after `goto`,
   * because the store reads storage on its first client render - a value
   * written afterwards would arrive too late to affect the first paint, which
   * is the moment worth testing. `null` clears the key.
   */
  storage?: string | null;
  /**
   * The same, for the preferences key.
   *
   * A second option rather than a second call, because the theme is applied by
   * a script that runs before the page has painted - a preference written after
   * `goto` would miss the only moment the pre-paint path can be observed at all.
   */
  preferences?: string | null;
}

export const STORAGE_KEY = "belltab.v1";

/** Kept in step with `PREFERENCES_KEY` in src/app/_lib/preferences.ts. */
export const PREFERENCES_STORAGE_KEY = "belltab.prefs.v1";

export async function openApp(
  page: Page,
  at: string = MID_PERIOD,
  { storage, preferences }: OpenOptions = {},
): Promise<void> {
  const target = new Date(at);

  // Installed a minute EARLY, then paused at the fixture. Two things are going
  // on here and both are load-bearing.
  //
  // `install` alone does not stop the clock - it keeps ticking at real speed,
  // so the countdown would count down underneath every assertion and a test
  // expecting "35:00" would race the wall clock. `pauseAt` is what stops it.
  //
  // The minute of headroom is because `pauseAt` jumps FORWARD and refuses to go
  // back: installing at the fixture and pausing at the same instant means
  // pausing a few milliseconds in the past, which throws "Cannot fast-forward
  // to the past" on whichever test happens to be slow that run. Nothing is
  // loaded yet, so the minute being skipped fires no timers.
  //
  // Pausing is also the more honest model of what this app has to survive. A
  // hidden tab gets roughly one wakeup a minute and a frozen one gets none, so
  // "no timer fires until a test asks for one" is the normal condition, not an
  // artificial one. Time moves here only via clock.fastForward (a tick) or
  // clock.setSystemTime (a tab that slept through the interval entirely).
  await page.clock.install({ time: new Date(target.getTime() - 60_000) });
  await page.clock.pauseAt(target);

  for (const [key, value] of [
    [STORAGE_KEY, storage],
    [PREFERENCES_STORAGE_KEY, preferences],
  ] as const) {
    if (value === undefined) continue;

    await page.addInitScript(
      ([storageKey, storageValue]) => {
        if (storageValue === null) window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, storageValue);
      },
      [key, value] as const,
    );
  }

  // `basePath: '/bell'` - the origin root is a 404, so the prefix is not
  // optional here. See the note on BASE_PATH in playwright.config.ts for why
  // it is not folded into `baseURL` instead.
  await page.goto(BASE_PATH);

  await expect(page.getByRole("heading", { level: 1, name: "BellTab" })).toBeVisible();

  // Then check the browser actually believes the time the fixture names.
  //
  // A timezone skew between the Node process and the pinned browser does not
  // announce itself: the suite still runs, still renders, and still asserts -
  // just against a different hour of the school day. Comparing the wall clock
  // the page believes in against the one the fixture spells out turns that into
  // one failure with an obvious message, instead of scattered ones that each
  // look like a separate bug.
  // Characters 11-15 of an ISO local-time string are its HH:MM. The fixtures
  // are literals in this file, so the shape is guaranteed.
  const expectedWallClock = at.slice(11, 16);
  const browserWallClock = await page.evaluate(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });

  expect(
    browserWallClock,
    `clock skew: the fixture names ${expectedWallClock} in America/New_York, but the browser believes ${browserWallClock}. Check the UTC offset on the fixture.`,
  ).toBe(expectedWallClock);

  // Then wait for the app to have read that clock for itself.
  //
  // This is the boot signal, and a stronger one than "the shell rendered":
  // every time-dependent value starts as a placeholder, because the server has
  // no device clock, and `#wall-clock` is a `<p>` until it is filled in and a
  // `<time>` afterwards. Waiting for the element WITH its machine-readable
  // attribute therefore waits for mount and checks the app agrees with the
  // fixture in one assertion - the two failures it separates are "the harness
  // is in the wrong timezone" above and "the app read the clock wrong" here.
  //
  // Given a longer timeout than the 5s default because this is the one wait in
  // the suite that covers a cold start: the bundle downloading, hydrating and
  // committing its first client render. On a machine running six workers and a
  // Next build at once that has been measured taking longer than the default,
  // and it fails as a mysterious "never wraps the ticking values" rather than
  // as "the app did not boot". A broken app never satisfies this at any
  // timeout; a busy one does, a moment later.
  await expect(page.locator("time#wall-clock"), "the app never finished its first client render")
    .toHaveAttribute("datetime", expectedWallClock, { timeout: 15_000 });
}

/**
 * Every element wider than the viewport, deepest first.
 *
 * A bare scrollWidth assertion tells you the page overflows but not what did
 * it, and "something on the Day view at 320px" is not a bug report. Reported
 * in the failure message so a red run names the culprit.
 */
export async function overflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth + 1;

    return [...document.querySelectorAll("body *")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && (box.right > limit || box.left < -1);
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        const id = element.id ? `#${element.id}` : "";
        const cls =
          element.className && typeof element.className === "string"
            ? `.${element.className.trim().split(/\s+/).join(".")}`
            : "";
        return `${element.tagName.toLowerCase()}${id}${cls} [${Math.round(box.left)}..${Math.round(box.right)}]`;
      })
      .slice(0, 5);
  });
}

/**
 * The reflow gate: WCAG 2.2 SC 1.4.10 requires one column and no
 * two-dimensional scrolling down to 320 CSS px.
 */
export async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  const culprits = scrollWidth > clientWidth + 1 ? await overflowingElements(page) : [];

  expect(
    scrollWidth,
    `${label}: page scrolls horizontally (${scrollWidth} > ${clientWidth}). Widest: ${culprits.join(", ")}`,
  ).toBeLessThanOrEqual(clientWidth + 1);
}

/**
 * Opens Settings and selects one of its panels.
 *
 * Phase 3 shipped one panel and no tab strip, so this click used to be
 * conditional - a tablist with a single tab is a control that cannot do
 * anything. Phase 4 adds the calendar and with it the strip, so the tab is now
 * asked for by name. The panel assertion afterwards is what actually matters
 * either way.
 *
 * Phase 6 adds a fourth panel, "preferences", and with it the last of the
 * callers this helper was written in anticipation of.
 */
export async function openSettings(page: Page, panel = "schedules"): Promise<void> {
  await page.locator("#settings-toggle").click();
  await expect(page.locator("#settings-view")).toBeVisible();
  await page.locator(`#tab-${panel}`).click();
  await expect(page.locator(`#panel-${panel}`)).toBeVisible();
}

/**
 * Replaces the Clipboard API before the page loads, so the refused branch can
 * be reached on demand on every engine.
 *
 * The same shape as `stubWakeLock` in wake-lock.spec.ts and the stubs in
 * bells.spec.ts: a browser API mocked at the boundary and nowhere else. It
 * lives here rather than in share.spec.ts because a second clipboard test
 * (Big mode's share, a different DOMException) should find one recipe, not
 * copy an eleven-line block.
 */
export async function stubClipboard(page: Page, mode: "grant" | "refuse"): Promise<void> {
  await page.addInitScript((granting: boolean) => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          granting
            ? Promise.resolve()
            : Promise.reject(new DOMException("denied", "NotAllowedError")),
      },
    });
  }, mode === "grant");
}
