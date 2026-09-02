import { test, expect, type Page } from "@playwright/test";
import { openApp, openSettings, MID_PERIOD } from "./helpers";

/**
 * The chime and the notification, driven through real period boundaries.
 *
 * Both browser APIs are STUBBED, on the argument `wake-lock.spec.ts` made and
 * this suite inherits: whether sound actually plays depends on an autoplay
 * policy fed by real gestures, and whether a notification appears depends on a
 * permission prompt no test can click. The stubs replace `AudioContext` and
 * `Notification` at the boundary before the page loads; everything above them -
 * the boundary detection, the gesture plumbing, the suppression rules, the
 * statuses - is the shipping code.
 *
 * The clock, by contrast, is driven for real: every bell in this file happens
 * because `setSystemTime` moved the wall clock across a period boundary and a
 * tick recomputed, exactly as a sleeping tab wakes. No test calls anything on
 * the hook directly.
 *
 * The seeded Regular day around the fixtures: Period 2 runs 09:05-10:05,
 * Passing 10:05-10:10 (back-to-back), Period 3 from 10:10. MID_PERIOD is 09:30.
 */

/** Counters the stubs keep, read back by the tests. */
interface BellsProbe {
  /** Oscillator starts. One chime is TWO - the strike and its overtone. */
  strikes: number;
  /** `AudioContext` constructions - zero until somebody wants sound. */
  contexts: number;
  /** Notifications constructed, newest last. */
  shown: { title: string; tag: string | undefined }[];
  /** `requestPermission` calls. */
  asks: number;
  setVisibility(next: "visible" | "hidden"): void;
}

interface StubOptions {
  /** What `Notification.permission` starts as. */
  permission?: NotificationPermission;
  /** What `requestPermission` resolves to. */
  onAsk?: NotificationPermission;
}

const probe = (page: Page) => ({
  strikes: () => page.evaluate(() => (window as never as { __bells: BellsProbe }).__bells.strikes),
  contexts: () =>
    page.evaluate(() => (window as never as { __bells: BellsProbe }).__bells.contexts),
  shown: () => page.evaluate(() => (window as never as { __bells: BellsProbe }).__bells.shown),
  asks: () => page.evaluate(() => (window as never as { __bells: BellsProbe }).__bells.asks),
  setVisibility: (next: "visible" | "hidden") =>
    page.evaluate(
      (value) => (window as never as { __bells: BellsProbe }).__bells.setVisibility(value),
      next,
    ),
});

const chime = (page: Page) => page.locator("#chime");
const chimeStatus = (page: Page) => page.locator("#chime-status");
const notify = (page: Page) => page.locator("#notify");
const notifyStatus = (page: Page) => page.locator("#notify-status");

async function stubBells(page: Page, options: StubOptions = {}): Promise<void> {
  await page.addInitScript(
    ({ permission, onAsk }) => {
      const state: {
        strikes: number;
        contexts: number;
        shown: { title: string; tag: string | undefined }[];
        asks: number;
        setVisibility(next: string): void;
      } = {
        strikes: 0,
        contexts: 0,
        shown: [],
        asks: 0,
        setVisibility(next: string) {
          visibility = next;
          document.dispatchEvent(new Event("visibilitychange"));
        },
      };

      let visibility = "visible";
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => visibility,
      });

      class FakeAudioContext extends EventTarget {
        private stubState = "suspended";
        readonly destination = {};

        constructor() {
          super();
          state.contexts += 1;
        }

        get state(): string {
          return this.stubState;
        }

        get currentTime(): number {
          return 0;
        }

        resume(): Promise<void> {
          // The stub always unlocks. The refusal path (no gesture) is a browser
          // judgement no stub can honestly reproduce; what is asserted instead
          // is that the app never RINGS a context that is not running.
          this.stubState = "running";
          this.dispatchEvent(new Event("statechange"));
          return Promise.resolve();
        }

        createOscillator() {
          return {
            type: "sine",
            frequency: { value: 0 },
            connect: (node: unknown) => node,
            start: () => {
              state.strikes += 1;
            },
            stop: () => {},
          };
        }

        createGain() {
          return {
            gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
            connect: (node: unknown) => node,
          };
        }
      }

      class FakeNotification {
        static permission: string = permission;

        static requestPermission(): Promise<string> {
          state.asks += 1;
          FakeNotification.permission = onAsk;
          return Promise.resolve(onAsk);
        }

        constructor(title: string, options?: { tag?: string }) {
          state.shown.push({ title, tag: options?.tag });
        }
      }

      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        value: FakeAudioContext,
      });
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: FakeNotification,
      });
      Object.defineProperty(window, "__bells", { configurable: true, value: state });
    },
    { permission: options.permission ?? "default", onAsk: options.onAsk ?? "default" },
  );
}

/**
 * Moves the wall clock past a boundary the way a sleeping tab experiences it:
 * the time jumps with no ticks, then one tick fires and recomputes.
 */
async function crossBoundary(page: Page, to: string): Promise<void> {
  await page.clock.setSystemTime(new Date(to));
  await page.clock.fastForward("00:01");
}

const PASSING_STARTS = "2026-09-02T10:06:00-04:00";
const PERIOD_3_STARTS = "2026-09-02T10:11:00-04:00";

const prefs = (fields: Record<string, unknown>) =>
  JSON.stringify({ theme: "system", bellOffsetSec: 0, ...fields });

test.describe("by default", () => {
  test("a period boundary is silent and costs nothing", async ({ page }) => {
    await stubBells(page);
    await openApp(page, MID_PERIOD);

    await crossBoundary(page, PASSING_STARTS);
    await expect(page).toHaveTitle(/Passing/);

    // Not merely "no sound": no AudioContext exists at all, and the permission
    // was never asked for. A user who wants none of this carries none of it.
    expect(await probe(page).contexts()).toBe(0);
    expect(await probe(page).strikes()).toBe(0);
    expect(await probe(page).shown()).toEqual([]);
    expect(await probe(page).asks()).toBe(0);
  });
});

test.describe("the chime", () => {
  test("rings at a boundary once ticked on, and not before", async ({ page }) => {
    await stubBells(page);
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");

    await chime(page).check();
    await expect(chimeStatus(page)).toHaveText("The chime will ring when a period starts or ends.");

    // Ticking the box is not a bell. Mid-period, nothing has happened yet.
    expect(await probe(page).strikes()).toBe(0);

    // The bell rings with the SETTINGS PANEL STILL OPEN - the hook lives above
    // both screens, exactly like the announcer, because a bell that only rings
    // while you are looking at the countdown is not a bell.
    await crossBoundary(page, PASSING_STARTS);

    // One chime is two oscillator starts: the strike and its overtone.
    await expect.poll(() => probe(page).strikes()).toBe(2);
  });

  test("a stored preference wakes locked, and the first touch unlocks it", async ({ page }) => {
    await stubBells(page);
    await openApp(page, MID_PERIOD, { preferences: prefs({ chimeOnBell: true }) });

    // No settings navigation here, and that is the test. The panel's `locked`
    // sentence is all but unobservable through the UI - REACHING the panel
    // takes a click or a keypress, and either one IS the unlocking gesture -
    // so what is asserted is the behaviour underneath: a context exists (the
    // preference asked for one), it cannot ring (no gesture has blessed it),
    // and a boundary while locked stays silent instead of crashing.
    await crossBoundary(page, PASSING_STARTS);
    await expect(page).toHaveTitle(/Passing/);

    expect(await probe(page).contexts()).toBe(1);
    expect(await probe(page).strikes()).toBe(0);

    // The first touch of anything - here, the page heading - is the unlock;
    // nobody has to find the preferences panel and tick a box that already
    // looks on.
    await page.locator("h1").click();

    await crossBoundary(page, PERIOD_3_STARTS);
    await expect.poll(() => probe(page).strikes()).toBe(2);

    // And the panel, once reached, reports ready - the locked state was
    // resolved by the very journey that would have displayed it.
    await openSettings(page, "preferences");
    await expect(chime(page)).toBeChecked();
    await expect(chimeStatus(page)).toHaveText("The chime will ring when a period starts or ends.");
  });

  test("a slept-through stretch rings once, for where you are now", async ({ page }) => {
    await stubBells(page);
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");
    await chime(page).check();

    // 09:30 straight to 10:11 crosses TWO bells - Passing started and ended -
    // but a frozen tab was not present for either. One chime for the state
    // being woken into is the recompute rule made audible; replaying missed
    // bells would be the decrement mistake in a party hat.
    await crossBoundary(page, PERIOD_3_STARTS);

    await expect.poll(() => probe(page).strikes()).toBe(2);
  });

  test("the Test button rings without committing anything", async ({ page }) => {
    await stubBells(page);
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");

    await page.locator("#chime-test").click();

    await expect.poll(() => probe(page).strikes()).toBe(2);
    // The toggle is still off and stays off: hearing the sound is not choosing
    // it, and nothing was written behind the user's back.
    await expect(chime(page)).not.toBeChecked();
    await expect(chimeStatus(page)).toHaveText("Period changes will be silent.");

    await crossBoundary(page, PASSING_STARTS);
    expect(await probe(page).strikes()).toBe(2);
  });

  test("is disabled, and honest, without the API", async ({ page }) => {
    await page.addInitScript(() => {
      Reflect.deleteProperty(window, "AudioContext");
    });

    await openApp(page, MID_PERIOD, { preferences: prefs({ chimeOnBell: true }) });
    await openSettings(page, "preferences");

    await expect(chime(page)).toBeDisabled();
    await expect(chime(page)).not.toBeChecked();
    await expect(page.locator("#chime-test")).toBeDisabled();
    await expect(chimeStatus(page)).toHaveText("This browser cannot play sound.");
  });
});

test.describe("the notification", () => {
  test("asks on tick, stores only a grant, and fires for a background tab", async ({ page }) => {
    await stubBells(page, { permission: "default", onAsk: "granted" });
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");

    await notify(page).check();

    await expect(notify(page)).toBeChecked();
    expect(await probe(page).asks()).toBe(1);
    await expect(notifyStatus(page)).toHaveText(
      "A notification will appear when a period starts or ends while this tab is in the background.",
    );

    await probe(page).setVisibility("hidden");
    await crossBoundary(page, PASSING_STARTS);

    // The words are the announcer's words - one definition of the bell - and
    // the tag is what makes each toast replace the last instead of piling up.
    await expect
      .poll(() => probe(page).shown())
      .toEqual([{ title: "Passing has started.", tag: "belltab-bell" }]);
  });

  test("stays quiet while the tab is visible", async ({ page }) => {
    await stubBells(page, { permission: "granted" });
    await openApp(page, MID_PERIOD, { preferences: prefs({ notifyOnBell: true }) });

    await crossBoundary(page, PASSING_STARTS);
    await expect(page).toHaveTitle(/Passing/);

    // The user is looking at the change; a toast about it is noise. This is
    // the suppression the "ready" sentence promises in the panel.
    expect(await probe(page).shown()).toEqual([]);

    await probe(page).setVisibility("hidden");
    await crossBoundary(page, PERIOD_3_STARTS);

    await expect
      .poll(() => probe(page).shown())
      .toEqual([{ title: "Period 3 has started.", tag: "belltab-bell" }]);
  });

  test("a refused prompt saves nothing and says where the lever went", async ({ page }) => {
    await stubBells(page, { permission: "default", onAsk: "denied" });
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");

    // `click()`, not `check()`: check() waits for the box to BECOME checked,
    // and this box deliberately refuses to until a grant comes back - the very
    // behaviour under test.
    await notify(page).click();

    // The tick did not take: the preference is only stored after a grant, so
    // the box un-ticks itself rather than lying, and - because a denied
    // permission cannot even raise the prompt again - the control is retired
    // with a sentence pointing at the browser's own settings.
    await expect(notify(page)).not.toBeChecked();
    await expect(notify(page)).toBeDisabled();
    await expect(notifyStatus(page)).toHaveText(
      "The browser has blocked notifications for this site. Allow them in the browser's site settings to use this.",
    );
    await expect(page.locator("#notify-alert")).toHaveText(/blocked notifications/);
  });

  test("an already-denied permission is reported before the box is ever ticked", async ({
    page,
  }) => {
    await stubBells(page, { permission: "denied" });
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");

    await expect(notify(page)).toBeDisabled();
    await expect(notifyStatus(page)).toHaveText(/site settings/);
  });

  test("a permission revoked behind a saved preference is reported, not ignored", async ({
    page,
  }) => {
    // Stored true means "granted once" - but the browser's site settings can
    // reset it to default afterwards, and the app finds out at load.
    await stubBells(page, { permission: "default" });
    await openApp(page, MID_PERIOD, { preferences: prefs({ notifyOnBell: true }) });
    await openSettings(page, "preferences");

    await expect(notifyStatus(page)).toHaveText(
      "The browser needs permission again. Turn this off and on to be asked.",
    );

    // And no notification is attempted on a permission that is not granted.
    await probe(page).setVisibility("hidden");
    await crossBoundary(page, PASSING_STARTS);
    expect(await probe(page).shown()).toEqual([]);
  });

  test("is disabled, and honest, without the API", async ({ page }) => {
    await page.addInitScript(() => {
      Reflect.deleteProperty(window, "Notification");
    });

    await openApp(page, MID_PERIOD, { preferences: prefs({ notifyOnBell: true }) });
    await openSettings(page, "preferences");

    await expect(notify(page)).toBeDisabled();
    await expect(notify(page)).not.toBeChecked();
    await expect(notifyStatus(page)).toHaveText("This browser cannot show notifications.");
  });
});
