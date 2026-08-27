"use client";

import { useState } from "react";
import { announcementFor, boundaryKey } from "@/lib/format";
import type { DayState } from "@/lib/engine";

/**
 * The bell, for a screen-reader user.
 *
 * The tab title announces nothing and the countdown must never be live, so this
 * region is the ONLY thing that conveys a period change without sight. Getting
 * it wrong in either direction is a real failure: silent and the app is
 * unusable, chatty and it reads a ticking number aloud once a second.
 *
 * Three rules, all of them load-bearing:
 *
 * 1. It fires only at boundaries. The message is recomputed when
 *    `boundaryKey` changes and at no other time, so the per-second re-render
 *    that repaints the countdown writes nothing here.
 * 2. It is silent on first paint. Describing the period you are already in, the
 *    instant the page loads, is noise rather than news.
 * 3. It is keyed on the period's TIMES, not its name. The retired build keyed
 *    on the name and announced once per keystroke while the running period was
 *    renamed in the editor. Phase 3 brings that editor back; this is what
 *    stops the bug coming back with it.
 *
 * The state is adjusted during render rather than in an effect. That is React's
 * documented pattern for deriving state from changed input, and it matters
 * here: an effect would fire on every tick and have to re-derive whether this
 * tick was a boundary, which is the shape the original bug had.
 */
export function PeriodAnnouncer({ state }: { state: DayState | null }) {
  const [announced, setAnnounced] = useState<{ key: string; text: string } | null>(null);

  if (state !== null) {
    const key = boundaryKey(state);

    if (key !== announced?.key) {
      // The first key seen is recorded with no message: that is rule 2.
      setAnnounced({ key, text: announced === null ? "" : announcementFor(state) });
    }
  }

  return (
    <p id="period-announcer" className="visually-hidden" aria-live="polite">
      {announced?.text ?? ""}
    </p>
  );
}
