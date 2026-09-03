import { test, expect, type Page } from "@playwright/test";
import { openApp, openSettings, MID_PERIOD, PREFERENCES_STORAGE_KEY } from "./helpers";

/**
 * "Keep the screen awake", and every way it can fail to.
 *
 * The Screen Wake Lock API is the first thing in this repo whose real behaviour
 * cannot be driven from a test at all: whether a lock is granted depends on the
 * OS, the battery, and whether the machine running CI has a screen. Asserting
 * against the genuine article would produce a suite that passes on a laptop and
 * fails on a runner, which is the same class of problem the clock fixtures in
 * `helpers.ts` exist to solve.
 *
 * So the API is STUBBED, at the boundary and nowhere else - `navigator.wakeLock`
 * is replaced before the page loads, and everything above it is the shipping
 * code. `AGENTS.md`: mock only at boundaries. What that buys is the three
 * branches a real browser will not reliably produce on demand - an engine
 * without the API, a device that refuses, and the tab going away and coming
 * back - which are exactly the branches whose absence is carried as an open gap
 * for the clipboard.
 *
 * What it does NOT prove is that a real projector stays lit. That needs a real
 * machine and is carried as an open gap in Docs/build-log.md.
 */

/** The stub's control surface, exposed on `window` for the test to drive. */
interface WakeLockProbe {
  /** Every `request()` call, in order, by the lock type asked for. */
  requests: string[];
  /** How many sentinels have been released, by us or by the fake browser. */
  releases: number;
  /** Simulates the browser taking the lock back, as it does when a tab hides. */
  drop(): void;
  /** Sets `document.visibilityState` and fires `visibilitychange`. */
  setVisibility(next: "visible" | "hidden"): void;
  /** Flips what the next `request()` does - the battery saver switching off. */
  setMode(next: "grant" | "refuse"): void;
}

const probe = (page: Page) =>
  ({
    requests: () => page.evaluate(() => (window as never as { __wakeLock: WakeLockProbe }).__wakeLock.requests),
    releases: () => page.evaluate(() => (window as never as { __wakeLock: WakeLockProbe }).__wakeLock.releases),
    drop: () => page.evaluate(() => (window as never as { __wakeLock: WakeLockProbe }).__wakeLock.drop()),
    setVisibility: (next: "visible" | "hidden") =>
      page.evaluate(
        (value) => (window as never as { __wakeLock: WakeLockProbe }).__wakeLock.setVisibility(value),
        next,
      ),
    setMode: (next: "grant" | "refuse") =>
      page.evaluate(
        (value) => (window as never as { __wakeLock: WakeLockProbe }).__wakeLock.setMode(value),
        next,
      ),
  });

const toggle = (page: Page) => page.locator("#wake-lock");
const readout = (page: Page) => page.locator("#wake-lock-status");
const alert = (page: Page) => page.locator("#wake-lock-alert");

/**
 * Installs the fake in place of `navigator.wakeLock`, before anything loads.
 *
 * `addInitScript` rather than an `evaluate` after `goto`, for the reason every
 * other init script in this suite gives: the app asks for the lock in the effect
 * that runs on its first client render, so a stub installed afterwards would
 * arrive after the only call worth watching.
 */
async function stubWakeLock(page: Page, mode: "grant" | "refuse"): Promise<void> {
  await page.addInitScript((granting: boolean) => {
    const state = {
      requests: [] as string[],
      releases: 0,
      last: null as { release(): Promise<void> } | null,
      granting,
      drop() {
        void state.last?.release();
      },
      setMode(next: string) {
        state.granting = next === "grant";
      },
      setVisibility(next: string) {
        visibility = next;
        document.dispatchEvent(new Event("visibilitychange"));
      },
    };

    // `visibilityState` is a read-only accessor on Document.prototype, so it is
    // shadowed rather than assigned. The app asks for it before every request -
    // a request from a hidden document is rejected by the spec - so a test that
    // could not move it could not reach the re-acquire path at all.
    let visibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });

    const makeSentinel = () => {
      const listeners = new Set<() => void>();
      const sentinel = {
        type: "screen",
        released: false,
        release() {
          if (!sentinel.released) {
            sentinel.released = true;
            state.releases += 1;
            for (const listener of [...listeners]) listener();
          }
          return Promise.resolve();
        },
        addEventListener(_type: string, listener: () => void) {
          listeners.add(listener);
        },
        removeEventListener(_type: string, listener: () => void) {
          listeners.delete(listener);
        },
      };

      state.last = sentinel;
      return sentinel;
    };

    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request(type: string) {
          state.requests.push(type);
          return state.granting
            ? Promise.resolve(makeSentinel())
            : Promise.reject(new DOMException("denied", "NotAllowedError"));
        },
      },
    });

    Object.defineProperty(window, "__wakeLock", { configurable: true, value: state });
  }, mode === "grant");
}

/** The preferences blob, with the wake lock in whichever position a test wants. */
const storedPreferences = (keepScreenAwake: boolean) =>
  JSON.stringify({ theme: "system", bellOffsetSec: 0, keepScreenAwake });

test.describe("the wake lock toggle", () => {
  test("is off, and holds nothing, on a fresh install", async ({ page }) => {
    await stubWakeLock(page, "grant");
    await openApp(page, MID_PERIOD, { preferences: null });
    await openSettings(page, "preferences");

    await expect(toggle(page)).not.toBeChecked();
    await expect(toggle(page)).toBeEnabled();
    await expect(readout(page)).toHaveText("The screen will dim and lock as it normally does.");

    // The whole reason the default is off: nothing is asked for until somebody
    // asks for it. A lock acquired on load would be one nobody consented to.
    expect(await probe(page).requests()).toEqual([]);
  });

  test("acquires a screen lock when it is ticked, and says so", async ({ page }) => {
    await stubWakeLock(page, "grant");
    await openApp(page, MID_PERIOD, { preferences: null });
    await openSettings(page, "preferences");

    await toggle(page).check();

    await expect(readout(page)).toHaveText("The screen is being kept awake.");
    // "screen" and not the default: `request()` takes a type, and the wrong one
    // would still resolve on some engines while locking nothing.
    expect(await probe(page).requests()).toEqual(["screen"]);
  });

  test("releases the lock when it is unticked", async ({ page }) => {
    await stubWakeLock(page, "grant");
    await openApp(page, MID_PERIOD, { preferences: storedPreferences(true) });
    await openSettings(page, "preferences");

    await expect(readout(page)).toHaveText("The screen is being kept awake.");
    expect(await probe(page).releases()).toBe(0);

    await toggle(page).uncheck();

    await expect(readout(page)).toHaveText("The screen will dim and lock as it normally does.");
    // The assertion that matters. A toggle that stops SAYING it holds a lock
    // while still holding one is the version of this bug that keeps a laptop
    // awake all night and reports nothing.
    expect(await probe(page).releases()).toBe(1);
  });

  test("re-acquires the lock after the tab has been away", async ({ page }) => {
    await stubWakeLock(page, "grant");
    await openApp(page, MID_PERIOD, { preferences: storedPreferences(true) });
    await openSettings(page, "preferences");

    await expect(readout(page)).toHaveText("The screen is being kept awake.");

    // What a real browser does on its own when the tab hides: it takes the lock
    // back and fires `release`. Nothing tells the page in advance, so a design
    // that acquired once and assumed it still held would be silently wrong from
    // here on - the same failure the countdown's recompute rule exists for.
    await probe(page).setVisibility("hidden");
    await probe(page).drop();

    await expect(readout(page)).toHaveText(
      "The screen will be kept awake when this tab is visible.",
    );

    await probe(page).setVisibility("visible");

    await expect(readout(page)).toHaveText("The screen is being kept awake.");
    expect(await probe(page).requests()).toEqual(["screen", "screen"]);
  });

  test("does not ask again while the tab is still hidden", async ({ page }) => {
    await stubWakeLock(page, "grant");
    await openApp(page, MID_PERIOD, { preferences: storedPreferences(true) });
    await openSettings(page, "preferences");

    await expect(readout(page)).toHaveText("The screen is being kept awake.");

    await probe(page).setVisibility("hidden");
    await probe(page).drop();
    // A second `visibilitychange` while still hidden - which a real browser
    // fires more often than one might like. Asking from a hidden document is
    // rejected by the spec, so an unguarded version would report a refusal for
    // what is an ordinary backgrounded tab.
    await probe(page).setVisibility("hidden");

    await expect(readout(page)).toHaveText(
      "The screen will be kept awake when this tab is visible.",
    );
    expect(await probe(page).requests()).toEqual(["screen"]);
  });

  test("reports a refusal instead of claiming the screen is held", async ({ page }) => {
    await stubWakeLock(page, "refuse");
    await openApp(page, MID_PERIOD, { preferences: null });
    await openSettings(page, "preferences");

    await toggle(page).check();

    // The box stays ticked - the user's preference is still their preference -
    // but nothing on screen claims the lock was granted.
    await expect(toggle(page)).toBeChecked();
    await expect(readout(page)).toHaveText(
      "This device refused to keep the screen awake. Battery saver is the usual reason; once that changes, a tap or a key press asks again.",
    );
  });

  test("a refusal is retried on the next touch of the page", async ({ page }) => {
    await stubWakeLock(page, "refuse");
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");

    await toggle(page).check();
    await expect(readout(page)).toHaveText(/refused/);
    expect(await probe(page).requests()).toEqual(["screen"]);

    // The battery saver goes off. Nothing tells the tab - there is no event
    // for it - so the honest recovery is the next thing the user does.
    await probe(page).setMode("grant");
    await page.locator("h1").click();

    await expect(readout(page)).toHaveText("The screen is being kept awake.");
    expect(await probe(page).requests()).toEqual(["screen", "screen"]);
  });

  test("announces only the refusal, and not the ordinary hidden tab", async ({ page }) => {
    await stubWakeLock(page, "grant");
    await openApp(page, MID_PERIOD, { preferences: storedPreferences(true) });
    await openSettings(page, "preferences");

    // Present from the first render and silent - a live region that arrives with
    // its text is one screen readers miss, and one that speaks on every tab
    // switch is one users learn to ignore.
    await expect(alert(page)).toHaveAttribute("aria-live", "polite");
    await expect(alert(page)).toHaveText("");

    await probe(page).setVisibility("hidden");
    await probe(page).drop();
    await expect(readout(page)).toHaveText(
      "The screen will be kept awake when this tab is visible.",
    );
    await expect(alert(page)).toHaveText("");
  });

  test("is disabled, and honest, on an engine without the API", async ({ page }) => {
    // The branch no real browser in this matrix can produce, and the reason the
    // stub exists at all. Deleting the prototype accessor is what actually
    // removes it - the property is not the instance's own.
    await page.addInitScript(() => {
      Reflect.deleteProperty(Navigator.prototype, "wakeLock");
      Reflect.deleteProperty(navigator, "wakeLock");
    });

    await openApp(page, MID_PERIOD, { preferences: storedPreferences(true) });
    await openSettings(page, "preferences");

    await expect(toggle(page)).toBeDisabled();
    await expect(toggle(page)).not.toBeChecked();
    await expect(readout(page)).toHaveText("This browser cannot keep the screen awake.");

    // And nothing crashed on the way: the countdown behind the panel is still
    // the app's whole job, and an absent API must not take it down.
    await page.locator("#settings-toggle").click();
    await expect(page.locator("#countdown-minutes")).toHaveText("35");
  });
});

test.describe("the signpost from Big mode", () => {
  const hint = (page: Page) => page.locator("#wake-lock-hint");

  test("points at the wake lock while it is off, and opens the panel", async ({ page }) => {
    await stubWakeLock(page, "grant");
    await openApp(page, MID_PERIOD, { preferences: null });

    // Beside the Big mode button, because the two features exist for the
    // same room: one makes the countdown readable from the back, the other
    // stops the projector going dark mid-period.
    await expect(hint(page)).toBeVisible();
    await hint(page).click();

    await expect(page.locator("#panel-preferences")).toBeVisible();
    await expect(toggle(page)).not.toBeChecked();
  });

  test("goes away once the lock is on, and where it cannot work", async ({ page }) => {
    await stubWakeLock(page, "grant");
    await openApp(page, MID_PERIOD, { preferences: storedPreferences(true) });
    await expect(hint(page)).toHaveCount(0);
    await expect(page.locator("#view-big")).toBeVisible();
  });

  test("is absent on an engine without the API", async ({ page }) => {
    await page.addInitScript(() => {
      Reflect.deleteProperty(Navigator.prototype, "wakeLock");
      Reflect.deleteProperty(navigator, "wakeLock");
    });
    await openApp(page, MID_PERIOD);
    await expect(hint(page)).toHaveCount(0);
  });
});

test.describe("the wake lock preference", () => {
  test("survives a reload, in its own key", async ({ page }) => {
    // No `preferences` option, and that is not tidiness. `openApp` plants one
    // through `addInitScript`, which re-runs on EVERY navigation - so
    // `preferences: null` would clear the key again on the reload below and
    // this test would prove the opposite of what it says. A fresh context
    // starts with empty storage anyway.
    await stubWakeLock(page, "grant");
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");

    await toggle(page).check();
    await expect(readout(page)).toHaveText("The screen is being kept awake.");

    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      PREFERENCES_STORAGE_KEY,
    );
    expect(JSON.parse(stored ?? "{}")).toMatchObject({ keepScreenAwake: true });

    await page.reload();
    await openSettings(page, "preferences");
    await expect(toggle(page)).toBeChecked();
  });

  test("does not travel in a share link", async ({ page }) => {
    // The rule the whole preferences key exists to keep: a demand on one
    // device's power management is not part of anybody's timetable. Worth
    // asserting again for a NEW field, because a third preference is exactly
    // the thing that gets added to the wrong object - `preferences.spec.ts`
    // covers the storage half for all three.
    await stubWakeLock(page, "grant");
    await openApp(page, MID_PERIOD, { preferences: storedPreferences(true) });
    await openSettings(page, "schedules");

    await page.locator("#schedule-share").click();
    const url = await page.locator("#share-link-url").inputValue();

    expect(url).not.toContain("keepScreenAwake");

    // And the payload itself, not just the visible URL - the fragment is
    // compressed, so "the string does not contain the field name" is a weaker
    // claim here than it looks. Opening the link in a second page and reading
    // back what it offers is the version that cannot pass by accident.
    const second = await page.context().newPage();
    await second.addInitScript(
      (key) => window.localStorage.removeItem(key),
      "belltab.prefs.v1",
    );
    await second.goto(url);
    await expect(second.locator("#share-offer")).toBeVisible();

    const carried = await second.evaluate(
      (key) => window.localStorage.getItem(key),
      "belltab.prefs.v1",
    );

    expect(carried).toBeNull();
    await second.close();
  });
});
