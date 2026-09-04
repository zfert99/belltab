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
  /** Notifications shown, newest last, and by which route. */
  shown: { title: string; tag: string | undefined; via: "page" | "worker" }[];
  /** Service worker registrations - zero until notifications are granted. */
  workers: number;
  /** `unregister()` calls - one when notifications are switched off. */
  unregistered: number;
  /** Keeps the next registration's worker from activating until `activate()`. */
  hold(): void;
  activate(): void;
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
  workers: () => page.evaluate(() => (window as never as { __bells: BellsProbe }).__bells.workers),
  unregistered: () =>
    page.evaluate(() => (window as never as { __bells: BellsProbe }).__bells.unregistered),
  hold: () => page.evaluate(() => (window as never as { __bells: BellsProbe }).__bells.hold()),
  activate: () =>
    page.evaluate(() => (window as never as { __bells: BellsProbe }).__bells.activate()),
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
        shown: { title: string; tag: string | undefined; via: "page" | "worker" }[];
        workers: number;
        unregistered: number;
        held: boolean;
        asks: number;
        setVisibility(next: string): void;
        hold(): void;
        activate(): void;
      } = {
        strikes: 0,
        contexts: 0,
        shown: [],
        workers: 0,
        unregistered: 0,
        held: false,
        asks: 0,
        hold() {
          state.held = true;
        },
        activate() {
          activateWorker();
        },
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
          state.shown.push({ title, tag: options?.tag, via: "page" });
        }
      }

      // The service worker route, which is Android's only one. A real
      // registration would fetch /bell/sw.js and install it for real (one
      // Chrome-only test below does exactly that); what is under test here is
      // the page's side of the lifecycle, so the registration is a fake that
      // models the one thing that bit in review: `register()` resolves BEFORE
      // the worker is active, and `showNotification` throws until it is.
      const listeners: (() => void)[] = [];
      const worker = {
        state: "installing",
        addEventListener(_type: string, listener: () => void) {
          listeners.push(listener);
        },
        removeEventListener(_type: string, listener: () => void) {
          const at = listeners.indexOf(listener);
          if (at !== -1) listeners.splice(at, 1);
        },
      };
      const fakeRegistration = {
        active: null as typeof worker | null,
        waiting: null,
        installing: worker,
        showNotification(title: string, options?: { tag?: string }) {
          if (fakeRegistration.active === null) {
            return Promise.reject(new TypeError("No active registration available"));
          }
          state.shown.push({ title, tag: options?.tag, via: "worker" });
          return Promise.resolve();
        },
        unregister() {
          state.unregistered += 1;
          return Promise.resolve(true);
        },
      };
      const activateWorker = () => {
        if (fakeRegistration.active !== null) return;
        fakeRegistration.active = worker;
        worker.state = "activated";
        for (const listener of [...listeners]) listener();
      };
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          register() {
            state.workers += 1;
            // A microtask, not a timeout: the suite runs under Playwright's paused
            // clock, where a setTimeout never fires until a test advances time,
            // and a worker that activates only when the clock moves would leave
            // every test that does not move it stuck before activation.
            if (!state.held) void Promise.resolve().then(activateWorker);
            return Promise.resolve(fakeRegistration);
          },
        },
      });

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
    await expect(chimeStatus(page)).toHaveText("This browser can’t play sound.");
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
      "You’ll get a notification when a period starts or ends while this tab is in the background.",
    );

    await probe(page).setVisibility("hidden");
    await crossBoundary(page, PASSING_STARTS);

    // The words are the announcer's words - one definition of the bell - and
    // the tag is what makes each toast replace the last instead of piling up.
    await expect
      .poll(() => probe(page).shown())
      .toEqual([{ title: "Passing has started.", tag: "belltab-bell", via: "worker" }]);
  });

  test("registers a worker on grant, and never before - Android's only route", async ({ page }) => {
    await stubBells(page, { permission: "default", onAsk: "granted" });
    await openApp(page, MID_PERIOD);
    await openSettings(page, "preferences");

    // A user who has not asked for notifications carries no worker.
    expect(await probe(page).workers()).toBe(0);

    await notify(page).check();
    await expect(notify(page)).toBeChecked();
    await expect.poll(() => probe(page).workers()).toBe(1);
  });

  test("a restored preference with a standing grant registers the worker at load", async ({
    page,
  }) => {
    // Stubbed with the grant already given, since the stub's init script
    // re-runs on every navigation and cannot carry a grant across a reload.
    await stubBells(page, { permission: "granted" });
    await openApp(page, MID_PERIOD, { preferences: prefs({ notifyOnBell: true }) });

    await expect.poll(() => probe(page).workers()).toBe(1);
  });

  test("does not use the worker until it is active, and falls back to the page meanwhile", async ({
    page,
  }) => {
    // Measured in review on real Chrome: register() resolves in ~50ms with
    // no active worker, and showNotification on that throws. A bell in that
    // window used to be swallowed. Held here so the window can be observed.
    await stubBells(page, { permission: "granted" });
    await page.addInitScript(() => {
      (window as never as { __bells: { held: boolean } }).__bells.held = true;
    });
    await openApp(page, MID_PERIOD, { preferences: prefs({ notifyOnBell: true }) });
    await expect.poll(() => probe(page).workers()).toBe(1);

    await probe(page).setVisibility("hidden");
    await crossBoundary(page, PASSING_STARTS);
    await expect
      .poll(() => probe(page).shown())
      .toEqual([{ title: "Passing has started.", tag: "belltab-bell", via: "page" }]);

    // Once the worker activates, the next bell goes through it.
    await probe(page).activate();
    await crossBoundary(page, PERIOD_3_STARTS);
    await expect.poll(() => probe(page).shown().then((shown) => shown[1]?.via)).toBe("worker");
  });

  test("switching notifications off takes the worker with it", async ({ page }) => {
    await stubBells(page, { permission: "granted" });
    await openApp(page, MID_PERIOD, { preferences: prefs({ notifyOnBell: true }) });
    await openSettings(page, "preferences");
    await expect.poll(() => probe(page).workers()).toBe(1);

    await notify(page).uncheck();
    await expect.poll(() => probe(page).unregistered()).toBe(1);
  });

  test("registers the REAL worker at /bell/ with an active worker", async ({ page, context }, testInfo) => {
    // Chrome only: the other engines' Playwright builds do not grant the
    // Notification permission from a test, and without a grant the page never
    // registers. No stubs at all here - this is the file itself, fetched from
    // the app, installed by the browser, and asserted active. The fake above
    // models the lifecycle; this is the one test that proves the model.
    test.skip(testInfo.project.name !== "chrome", "Notification permission grant is Chromium-only");
    await context.grantPermissions(["notifications"]);
    await openApp(page, MID_PERIOD, { preferences: prefs({ notifyOnBell: true }) });

    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const registrations = await navigator.serviceWorker.getRegistrations();
            const ours = registrations.find((r) => new URL(r.scope).pathname === "/bell/");
            return ours ? (ours.active !== null ? "active" : "installing") : "none";
          }),
        { timeout: 15_000 },
      )
      .toBe("active");
  });

  test("falls back to a page notification where there is no service worker", async ({ page }) => {
    await stubBells(page, { permission: "granted" });
    // Both the stub's own property AND the prototype accessor beneath it -
    // deleting only the former re-exposes the real API, which registers a real
    // worker on localhost and takes the bell through it.
    await page.addInitScript(() => {
      Reflect.deleteProperty(navigator, "serviceWorker");
      Reflect.deleteProperty(Navigator.prototype, "serviceWorker");
    });
    await openApp(page, MID_PERIOD, { preferences: prefs({ notifyOnBell: true }) });

    await probe(page).setVisibility("hidden");
    await crossBoundary(page, PASSING_STARTS);

    await expect
      .poll(() => probe(page).shown())
      .toEqual([{ title: "Passing has started.", tag: "belltab-bell", via: "page" }]);
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
      .toEqual([{ title: "Period 3 has started.", tag: "belltab-bell", via: "worker" }]);
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
      "Notifications are blocked for this site. To turn them on, allow them in your browser’s site settings.",
    );
    await expect(page.locator("#notify-alert")).toHaveText(/blocked for this site/);
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
      "Your browser needs to ask permission again. Turn this off and on to get the prompt.",
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
    await expect(notifyStatus(page)).toHaveText("This browser can’t show notifications.");
  });
});
