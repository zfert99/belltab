"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { announcementFor, boundaryKey } from "@/lib/format";
import type { DayState } from "@/lib/engine";
import type { Preferences } from "@/app/_lib/preferences";
import { listenForGesture } from "@/app/_lib/gesture";

/**
 * The audible bell and the notification - the two ways a period change reaches
 * somebody who is not looking at the page.
 *
 * Both are FOREGROUND features, and everything about this file follows from
 * accepting that. `Docs/research/background-timers-and-schedule-modeling.md`
 * closes every path to a reliable background alert on the open web: Notification
 * Triggers is dead, there is no Web Alarms API, and a service worker will not
 * wake itself without a push server this app must never have. What is honestly
 * available is: a visible tab rings on time, a hidden desktop tab rings up to a
 * minute late (its interval is throttled to one wakeup a minute), a frozen
 * mobile tab rings when it thaws, and a closed tab never rings. The preferences
 * panel says exactly that, in the user's language.
 *
 * **One definition of "the bell".** The chime, the notification and the
 * screen-reader announcement all key on `boundaryKey` and speak
 * `announcementFor` - the same two functions `PeriodAnnouncer` has used since
 * Phase 2. A boundary the announcer would not announce (first paint, midnight
 * rollover into "before") rings nothing here either, so the three surfaces
 * cannot drift into disagreeing about what counts as a bell.
 */

/**
 * What the chime can honestly say for itself.
 *
 * `locked` is the one that earns the type: the Web Audio autoplay policy
 * suspends an `AudioContext` created without a user gesture, so a stored-on
 * preference restored at page load produces a chime that exists and cannot
 * sound until the user touches the page once. Ticking the box IS a gesture, so
 * the common path never sees this - it exists for the reload after.
 */
export type ChimeStatus = "unsupported" | "off" | "locked" | "ready";

/**
 * What the notification toggle can honestly say.
 *
 * `unasked` covers a permission that has been RESET behind a saved preference -
 * the toggle only stores true after a grant (see `PreferencesPanel`), so this
 * state cannot be reached by ticking the box, only by the browser's site
 * settings changing underneath it.
 */
export type NotifyStatus = "unsupported" | "off" | "blocked" | "unasked" | "ready";

/* ------------------------------------------------------------------ */
/* The audio context, as a module-level external store                 */
/* ------------------------------------------------------------------ */

/**
 * One `AudioContext` for the page's life, created on first need.
 *
 * A singleton rather than per-hook state because the browser caps live contexts
 * (six, in Chrome) and because its `state` is genuinely external, shared,
 * mutable browser state - the same shape `localStorage` has, and it gets the
 * same treatment: a subscribe/snapshot pair for `useSyncExternalStore`, so no
 * effect ever has to copy it into React state by hand.
 */
let sharedContext: AudioContext | null = null;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function audioSupported(): boolean {
  return typeof AudioContext !== "undefined";
}

function ensureAudioContext(): AudioContext | null {
  if (!audioSupported()) return null;

  if (sharedContext === null) {
    sharedContext = new AudioContext();
    sharedContext.addEventListener("statechange", emit);
    emit();
  }

  return sharedContext;
}

function subscribeToAudio(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** `null` means "no context yet" - distinct from suspended. */
function audioSnapshot(): AudioContextState | null {
  return sharedContext?.state ?? null;
}

function audioServerSnapshot(): null {
  return null;
}

/**
 * Creates the context and starts it, inside a user gesture.
 *
 * The panel calls this from the toggle's own change handler and from the Test
 * button - both real gestures, which is what `resume()` needs to succeed under
 * the autoplay policy. Called anywhere else it still cannot break anything: a
 * resume without a gesture is refused and the context stays suspended, which
 * the status reports as `locked` rather than hiding.
 */
export function unlockChime(): void {
  const context = ensureAudioContext();
  if (context !== null && context.state === "suspended") void context.resume();
}

/**
 * One strike of a bell, synthesised - no audio file, no dependency, nothing
 * fetched. Two sine partials a fifth-and-a-bit apart with an exponential decay
 * reads as "bell" to an ear without pretending to be a real school Klaxon,
 * and at ~1.2 seconds it is over before it becomes an alarm.
 */
export function ringChime(): void {
  const context = ensureAudioContext();
  if (context === null || context.state !== "running") return;

  const start = context.currentTime;

  for (const [frequency, peak] of [
    [880, 0.1],
    [1245, 0.04],
  ] as const) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    // `exponentialRampToValueAtTime` cannot reach zero, so the tail lands on a
    // value below hearing and the oscillator is stopped there.
    envelope.gain.setValueAtTime(peak, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);

    oscillator.connect(envelope).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 1.2);
  }
}

/**
 * The Test button: unlock if needed, then ring once.
 *
 * A separate function because the order is load-bearing and asynchronous.
 * `resume()` must be CALLED inside the click (that is what the autoplay policy
 * checks) but only RESOLVES a moment later, and `ringChime` refuses a context
 * that is not yet running - so ringing on the same line as unlocking would
 * silently skip the first press, the one made to find out whether it works.
 */
export async function previewChime(): Promise<void> {
  const context = ensureAudioContext();
  if (context === null) return;

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      // Refused outside a gesture; the status stays `locked` and says so.
    }
  }

  ringChime();
}

/* ------------------------------------------------------------------ */
/* Notification permission, the same way                               */
/* ------------------------------------------------------------------ */

function notificationsSupported(): boolean {
  return typeof Notification !== "undefined";
}

function subscribeToPermission(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/**
 * Snapshot of `Notification.permission`.
 *
 * Only our own `askForNotifications` emits a change, so a revocation made in
 * the browser's site settings is not pushed - but the hook below lives in a
 * component that re-renders every second with the clock, and
 * `useSyncExternalStore` re-reads its snapshot on every render, so the panel
 * catches up within a tick. A `navigator.permissions` watcher would push it
 * instead; not worth a second subscription for a one-second lag.
 */
function permissionSnapshot(): NotificationPermission | null {
  return notificationsSupported() ? Notification.permission : null;
}

function permissionServerSnapshot(): null {
  return null;
}

/**
 * The service worker registration, once notifications are granted.
 *
 * Android Chrome refuses `new Notification()` from a page and requires
 * `registration.showNotification()`; every other engine accepts either. So a
 * worker is registered the moment permission is granted - never before, since
 * a user who has not asked for notifications should not carry a worker - and
 * the bell goes through it wherever it exists. The worker itself (public/sw.js)
 * has no fetch handler: this is notifications on Android, not caching, and the
 * 2026-09-02 decision against a caching worker stands.
 *
 * `null` until registered, and also on engines without service workers, where
 * `new Notification` is the only path and still works.
 */
let registration: ServiceWorkerRegistration | null = null;

function serviceWorkersSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

async function registerBellWorker(): Promise<void> {
  if (!serviceWorkersSupported() || registration !== null) return;

  try {
    // Scoped to the app's own path. `basePath` serves public/ under /bell, so
    // the script and its scope both carry the prefix, spelled out by hand as
    // every other URL in this repo is.
    registration = await navigator.serviceWorker.register("/bell/sw.js", { scope: "/bell/" });
  } catch {
    // A registration that fails (an insecure context, a policy) leaves the
    // page path in place, which is what would have happened anyway.
  }
}

/**
 * Asks, and reports back. Must be called from a user gesture - browsers now
 * quietly auto-deny prompts that arrive from nowhere, which would burn the only
 * ask this origin gets.
 */
export async function askForNotifications(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";

  const result = await Notification.requestPermission();
  emit();
  return result;
}

/* ------------------------------------------------------------------ */
/* The hook                                                            */
/* ------------------------------------------------------------------ */

export interface BellStatuses {
  chime: ChimeStatus;
  notify: NotifyStatus;
}

/**
 * Rings the enabled bells at each period boundary, and reports what both
 * features can honestly do right now.
 *
 * Mounted once, in `App.tsx`, above both screens - the same argument as the
 * wake lock's: a bell that rings while the editor is open is still a bell, and
 * the settings panel unmounting must not silence it.
 */
export function useBells(state: DayState | null, preferences: Preferences): BellStatuses {
  const audioState = useSyncExternalStore(subscribeToAudio, audioSnapshot, audioServerSnapshot);
  const permission = useSyncExternalStore(
    subscribeToPermission,
    permissionSnapshot,
    permissionServerSnapshot,
  );

  /**
   * A restored preference wants a context to exist so its status is `locked`
   * rather than a hole; creating one outside a gesture is allowed, it just
   * starts suspended. Skipped entirely while the toggle is off so that a user
   * who never asked for sound never has an `AudioContext` at all.
   */
  useEffect(() => {
    if (preferences.chimeOnBell) ensureAudioContext();
  }, [preferences.chimeOnBell]);

  /**
   * While the chime is wanted and locked, the first touch anywhere unlocks it.
   *
   * The alternative - staying locked until the user finds the panel again and
   * re-ticks a box that already looks on - punishes exactly the user who set
   * the chime up yesterday and opened the tab this morning. `resume()` inside
   * a genuine first gesture succeeds; the effect then sees `running` through
   * the store and removes itself.
   */
  useEffect(() => {
    if (!preferences.chimeOnBell || audioState !== "suspended") return;

    return listenForGesture(unlockChime);
  }, [preferences.chimeOnBell, audioState]);

  /**
   * The worker is registered when notifications are on AND granted - a
   * restored preference at load, or the grant that just came back from the
   * prompt. Idempotent; the registration is a module singleton.
   */
  useEffect(() => {
    if (preferences.notifyOnBell && permission === "granted") void registerBellWorker();
  }, [preferences.notifyOnBell, permission]);

  const key = state === null ? null : boundaryKey(state);
  const message = state === null ? "" : announcementFor(state);

  /**
   * `undefined` means "no boundary ever observed", which is what makes the
   * first one silent - the announcer's rule 2, enforced with the same shape.
   * `state` going null (a day with no schedule) keeps the last key rather than
   * clearing it, so a schedule reappearing unchanged does not re-ring.
   */
  const lastKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (key === null) return;

    const previous = lastKey.current;
    lastKey.current = key;

    if (previous === undefined || previous === key) return;
    // A boundary the announcer would say nothing about - "before", "empty" -
    // rings nothing. This is what keeps midnight silent: "after" changing to
    // "before" is a new day, not a bell.
    if (message === "") return;

    if (preferences.chimeOnBell) ringChime();

    if (
      preferences.notifyOnBell &&
      permission === "granted" &&
      // A toast about the screen the user is looking at is noise; the
      // notification exists for the tab that is open but behind something.
      document.visibilityState !== "visible"
    ) {
      // `tag` makes each bell REPLACE the previous toast rather than pile up
      // - by the time Period 3 starts, "Period 2 has started" is not news.
      const options = { tag: "belltab-bell" };

      if (registration !== null) {
        // The worker's way - the only way on Android, and fine everywhere.
        void registration.showNotification(message, options).catch(() => {});
      } else {
        try {
          new Notification(message, options);
        } catch {
          // Android Chrome throws here when the worker has not registered yet
          // (or could not). Catching it keeps the bell from taking the clock
          // down; the panel's copy already calls this feature best-effort.
        }
      }
    }
    // The preference and permission values are read at ring time and belong in
    // the dependency list; extra runs they cause are harmless because a run
    // with an unchanged key rings nothing.
  }, [key, message, preferences.chimeOnBell, preferences.notifyOnBell, permission]);

  const chime: ChimeStatus = !audioSupported()
    ? "unsupported"
    : !preferences.chimeOnBell
      ? "off"
      : audioState === "running"
        ? "ready"
        : "locked";

  // `blocked` outranks `off`: a denied permission makes the toggle inert no
  // matter what is stored, and a user who pressed Deny last month deserves the
  // explanation BEFORE ticking a box that cannot work, not after.
  const notify: NotifyStatus = !notificationsSupported()
    ? "unsupported"
    : permission === "denied"
      ? "blocked"
      : !preferences.notifyOnBell
        ? "off"
        : permission === "granted"
          ? "ready"
          : "unasked";

  return { chime, notify };
}

/* ------------------------------------------------------------------ */
/* The wording                                                         */
/* ------------------------------------------------------------------ */

/** The chime's status as a sentence, pure and testable without a browser. */
export function describeChime(status: ChimeStatus): string {
  switch (status) {
    case "unsupported":
      return "This browser can\u2019t play sound.";
    case "off":
      return "Period changes will be silent.";
    case "locked":
      return "The chime will be ready after your first tap or key press.";
    case "ready":
      return "The chime will ring when a period starts or ends.";
  }
}

/** The notification's status as a sentence. */
export function describeNotify(status: NotifyStatus): string {
  switch (status) {
    case "unsupported":
      return "This browser can\u2019t show notifications.";
    case "off":
      return "You won\u2019t get a notification when a period changes.";
    case "blocked":
      return "Notifications are blocked for this site. To turn them on, allow them in your browser\u2019s site settings.";
    case "unasked":
      return "Your browser needs to ask permission again. Turn this off and on to get the prompt.";
    case "ready":
      return "You\u2019ll get a notification when a period starts or ends while this tab is in the background.";
  }
}
