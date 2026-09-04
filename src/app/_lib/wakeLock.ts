"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { listenForGesture } from "@/app/_lib/gesture";

/**
 * The Screen Wake Lock, held while the preference asks for it.
 *
 * **Why this exists.** The countdown's whole job is to be looked at from across
 * a room, and a laptop driving a projector dims after however many minutes the
 * OS decided - mid-period, with a class watching. Big mode made that failure
 * obvious rather than theoretical; see Open gaps in Docs/build-log.md.
 *
 * **Why it is a preference and not automatic.** A wake lock stops a machine
 * sleeping, which is a real cost to somebody who left the tab open on a phone
 * in their bag. `Docs/research/background-timers-and-schedule-modeling.md` asks
 * for "an explicit toggle, with feature detection" for exactly that reason, and
 * the toggle is where a user can see what they agreed to.
 *
 * **The one browser behaviour that shapes all the code below:** the lock is
 * released BY THE BROWSER whenever the document stops being visible, and a
 * request made while the document is hidden is rejected rather than queued. So
 * holding a lock is not a thing you do once - it is a thing you re-do on every
 * `visibilitychange` back to visible, for as long as the preference is on. That
 * is the same lesson as the countdown's: nothing here may be treated as state
 * that stays true while the tab is away.
 */

/**
 * What the app can honestly say about the screen right now.
 *
 * Five values rather than a boolean, because "the toggle is on" and "the screen
 * is actually being held awake" are different facts and the gap between them is
 * where every real failure lives - an unsupported engine, a refusal from an OS
 * in battery-saver mode, and the ordinary hidden tab that will fix itself.
 */
export type WakeLockStatus =
  /** No `navigator.wakeLock` at all. The toggle cannot do anything. */
  | "unsupported"
  /** Supported, and the preference is off. */
  | "off"
  /** Asked for, granted, and the screen is being kept awake. */
  | "held"
  /**
   * Asked for, and not held right now through no fault of the user - the tab is
   * hidden, or the first request has not come back yet. Re-acquired on return.
   */
  | "waiting"
  /**
   * Asked for while visible, and REFUSED. Battery saver and a
   * `Permissions-Policy` that does not allow `screen-wake-lock` both land here,
   * and neither announces itself any other way.
   */
  | "refused";

/** Whether the toggle can do anything at all in this browser. */
function readSupport(): boolean {
  return "wakeLock" in navigator;
}

/**
 * Support never changes within a page's life, so nothing has to subscribe.
 *
 * `useSyncExternalStore` rather than an effect-plus-`setState` for the reason
 * `localStore.ts` documents at length: it takes a SERVER snapshot, which is
 * what makes this hydration-safe by construction. The server has no
 * `navigator`, both sides render `false` on the first pass, and the real answer
 * arrives with the first client snapshot - no mismatch, and no synchronous
 * `setState` in an effect for the repo's `react-hooks/set-state-in-effect` rule
 * to object to.
 */
const subscribeToNothing = () => () => {};
const noSupportOnServer = () => false;

/**
 * Holds a screen wake lock while `enabled`, and reports what actually happened.
 *
 * One subscriber, mounted once in `App.tsx` - the same rule the clock follows.
 * Two components each asking for their own lock would work, because the browser
 * reference-counts them, but they would also each report a different story
 * about the same screen.
 */
export function useWakeLock(enabled: boolean): WakeLockStatus {
  const supported = useSyncExternalStore(subscribeToNothing, readSupport, noSupportOnServer);

  // Only ever the answer to "what came of asking", which is why every write to
  // it below happens in a promise callback or an event handler rather than in
  // the effect body. `waiting` is the honest starting value: the request is in
  // flight, or about to be.
  const [outcome, setOutcome] = useState<"held" | "waiting" | "refused">("waiting");

  /**
   * Turning the toggle off and on again forgets the last refusal.
   *
   * Adjusting state during render, the same pattern `PreferencesPanel.tsx` uses
   * to drop a stale draft - React re-runs this hook before anything is painted,
   * so no stale value is drawn. Without it, a user who hit a refusal, switched
   * the toggle off, plugged the laptop in and switched it back on would be told
   * "refused" for the frame before the new request came back, which is a
   * sentence about a request that is no longer the current one.
   */
  const [lastEnabled, setLastEnabled] = useState(enabled);
  if (lastEnabled !== enabled) {
    setLastEnabled(enabled);
    setOutcome("waiting");
  }

  /**
   * The current effect's `acquire`, for the retry listener below to call.
   *
   * The listener has to live in its OWN effect - keyed on the outcome, so it is
   * attached only while refused - and that effect cannot see a function
   * closured inside this one. A ref is the bridge; it is cleared on cleanup so
   * a gesture after the toggle is switched off asks for nothing.
   */
  const acquireRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!supported || !enabled) return;

    // The async work outlives the effect in two ways worth guarding: Strict
    // Mode double-mounts in development, and a request made just before the
    // toggle is switched off resolves just after. Same flag, same reason, as
    // the share-fragment effect in App.tsx.
    let live = true;
    let sentinel: WakeLockSentinel | null = null;
    // A request in flight. Without this the guard below sees `sentinel ===
    // null` for the tens of milliseconds a real request takes over IPC, and a
    // gesture in that window - clicking the tab to bring it forward fires
    // `visibilitychange` AND `pointerdown` - issues a second request. Two
    // grants land, one is stored, the other is never released. Found in
    // review before it shipped; see Bugs found, 2026-09-03.
    let inFlight = false;

    const onRelease = () => {
      // Fired by the BROWSER when the tab hides, not only by our own release().
      // This is the normal path, not an error - `visibilitychange` below asks
      // again the moment the tab comes back.
      if (live) setOutcome("waiting");
    };

    const acquire = () => {
      // A request from a hidden document is rejected by the spec, so asking
      // anyway would report "refused" for what is really just a backgrounded
      // tab - turning the one status that means "something is wrong" into the
      // one that fires every time the user switches app.
      if (document.visibilityState !== "visible") return;
      if (inFlight) return;
      if (sentinel !== null && !sentinel.released) return;

      inFlight = true;
      navigator.wakeLock.request("screen").then(
        (granted) => {
          inFlight = false;

          // Belt and braces for the one-sentinel invariant: if a live lock is
          // somehow already held by the time this resolves, the newer grant is
          // the redundant one and is let go rather than orphaning the older.
          if (!live || (sentinel !== null && !sentinel.released)) {
            void granted.release();
            return;
          }

          sentinel?.removeEventListener("release", onRelease);
          sentinel = granted;
          granted.addEventListener("release", onRelease);
          setOutcome("held");
        },
        () => {
          inFlight = false;
          if (live) setOutcome("refused");
        },
      );
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquireRef.current = acquire;
    acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      live = false;
      acquireRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);

      if (sentinel !== null) {
        sentinel.removeEventListener("release", onRelease);
        // Releasing an already-released sentinel resolves rather than throwing,
        // and the tab may well have released this one for us on the way out.
        void sentinel.release().catch(() => {});
      }
    };
  }, [supported, enabled]);

  /**
   * A refusal is retried on the next touch of the page - and the listener
   * exists only WHILE refused, which is the part that matters.
   *
   * The reason for a refusal - battery saver, mostly - goes away without an
   * event: the laptop is plugged in and nothing tells the tab. Re-asking on
   * `visibilitychange` covers the user who switches away and back; this covers
   * the one who stays. It is the chime's autoplay recovery, through the same
   * `listenForGesture` and with the same lifecycle: attached when there is
   * something to retry, gone the moment there is not. Attached for the life of
   * the preference instead, every keystroke in the editor under a permanent
   * denial would be a rejected wake-lock IPC for an answer already known - the
   * review found exactly that.
   */
  useEffect(() => {
    if (!enabled || outcome !== "refused") return;
    return listenForGesture(() => acquireRef.current?.());
  }, [enabled, outcome]);

  if (!supported) return "unsupported";
  if (!enabled) return "off";

  return outcome;
}

/**
 * Whether the Now screen should point at the wake lock.
 *
 * `off` is the obvious case. `refused` is the one that matters more: the box is
 * ticked, nothing is held, and the projector is the most likely of anyone's to
 * go dark - so the signpost stays, and the panel it opens says why. `held` and
 * `waiting` have nothing to point at; `unsupported` has nothing to point WITH.
 * A predicate rather than an equality in the component, so a sixth status has
 * to be given an answer here instead of silently hiding the sign.
 */
export function wantsSignpost(status: WakeLockStatus): boolean {
  switch (status) {
    case "off":
    case "refused":
      return true;
    case "unsupported":
    case "held":
    case "waiting":
      return false;
  }
}

/**
 * The status as a sentence, because "refused" is not an answer to "is my screen
 * going to stay on".
 *
 * Pure, and separate from the hook, so the wording is testable without a
 * browser - the branches that matter most here are the ones that are hardest to
 * reach in one.
 */
export function describeWakeLock(status: WakeLockStatus): string {
  switch (status) {
    case "unsupported":
      return "This browser can\u2019t keep the screen awake.";
    case "off":
      return "The screen will dim and lock as usual.";
    case "held":
      return "The screen is staying awake.";
    case "waiting":
      return "The screen will stay awake whenever this tab is visible.";
    case "refused":
      return "Your device refused to keep the screen awake. Battery saver is the usual reason \u2014 once it\u2019s off, tap or press any key and BellTab asks again.";
  }
}
