"use client";

import { useEffect, useState } from "react";
import { localNow, type LocalNow } from "@/lib/clock";

/**
 * The one clock.
 *
 * `AGENTS.md`: one ticking source drives the app, and the title, the body and
 * the favicon are derived views of it. Nothing else in this codebase may call
 * `setInterval` - if a second component needs the time, it takes it as a prop.
 *
 * THE RULE THIS HOOK EXISTS TO ENFORCE: recompute, never decrement. Every tick
 * re-reads `new Date()` and hands back a fresh reading; there is no variable
 * anywhere holding a remaining-time number that is reduced over time. Browsers
 * throttle a hidden tab to roughly one wakeup per minute and freeze it outright
 * on mobile, so a decrementing counter silently drifts and skips while a
 * recomputed one is correct the instant it renders. See
 * `Docs/research/background-timers-and-schedule-modeling.md`.
 *
 * Returns `null` until the first effect runs. That is not a defensive default:
 * the server has no device clock and a different timezone, so any time-derived
 * value rendered during SSR is a hydration mismatch by construction. Callers
 * render a stable placeholder for `null` and fill it in on mount.
 */
export function useNow(): LocalNow | null {
  const [now, setNow] = useState<LocalNow | null>(null);

  useEffect(() => {
    const read = () => {
      const next = localNow(new Date());

      // Second-resolution equality, so a `focus` or `visibilitychange` landing
      // mid-second is a no-op re-render rather than a repaint of identical
      // digits. The tick itself always changes the second, so this costs
      // nothing in the common path.
      setNow((previous) =>
        previous !== null && previous.secOfDay === next.secOfDay && previous.isoDate === next.isoDate
          ? previous
          : next,
      );
    };

    read();

    // A fixed interval rather than a self-rescheduling timeout aimed at the
    // next wall-clock second. The interval slides by a few milliseconds against
    // the device clock, which is invisible; a setTimeout chain is not, because
    // Playwright's `clock.fastForward` walks a chain tick by tick and would
    // render five hours of the school day one second at a time.
    const ticker = window.setInterval(read, 1000);

    // The two events that mean "you have been lied to". A hidden tab is
    // throttled to about one wakeup a minute and a frozen one gets none at all,
    // so the value on screen when a tab comes back is up to a minute stale -
    // and the first thing a user does is look at it. Recomputing here is what
    // makes the Phase 2 gate ("background it for ten minutes, come back, the
    // number is right") pass on the first repaint rather than a minute later.
    document.addEventListener("visibilitychange", read);
    window.addEventListener("focus", read);

    // Without this cleanup every remount leaks a timer, and in development
    // React's Strict Mode mounts twice on purpose to find exactly that.
    return () => {
      window.clearInterval(ticker);
      document.removeEventListener("visibilitychange", read);
      window.removeEventListener("focus", read);
    };
  }, []);

  return now;
}
