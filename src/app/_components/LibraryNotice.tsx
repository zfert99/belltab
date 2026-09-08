"use client";

import { dismissLibraryProblem, useLibraryProblem } from "@/app/_lib/libraryStore";
import type { LocalNow } from "@/lib/clock";

/**
 * "BellTab couldn't read what was saved here." Said once, above everything.
 *
 * Until 2026-09-05 this situation was silent: an unreadable `belltab.v1` put
 * the seeded defaults on screen with no explanation, the user's own library
 * stayed in storage, and the first edit wrote the defaults over it. The
 * degrade is right - `loadLibrary` argues why a tab that will not open is
 * worse - so this does not change it. It adds the three things that were
 * missing: the sentence, the reason, and a way to get the bytes back.
 *
 * The same shape as `ShareOffer` and in the same slot, because it is the same
 * kind of thing: something about THIS load that the user did not ask for and
 * should hear before the countdown. Not a live region, for the reason the
 * editor's error documents - a region that arrives together with its message
 * is one screen readers routinely miss - and it is first in the card, so it is
 * the first thing read anyway.
 *
 * `raw` is a string from storage and is never rendered as markup; it goes into
 * a file and nowhere else.
 */
export function LibraryNotice({ now }: { now: LocalNow | null }) {
  const problem = useLibraryProblem();
  if (problem === null) return null;

  /**
   * The same mechanism as Export: an object URL behind a link that is clicked
   * and revoked. The file is the bytes exactly as they were, not a re-encoding
   * - a future BellTab, or a person with a text editor, may be able to read
   * what this one could not.
   */
  const download = () => {
    const blob = new Blob([problem.raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = now === null ? "belltab-unreadable.json" : `belltab-unreadable-${now.isoDate}.json`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <aside className="offer offer--error" id="library-notice" aria-labelledby="library-notice-text">
      <p className="offer__text" id="library-notice-text">
        BellTab couldn&rsquo;t read the schedules saved in this browser, so it started with the
        standard ones. {problem.message} Nothing has been thrown away: download what was there,
        or it&rsquo;s kept aside the first time you save a change.
      </p>
      <div className="offer__actions">
        <button type="button" className="minibutton" id="library-notice-download" onClick={download}>
          Download what was there
        </button>
        <button
          type="button"
          className="minibutton"
          id="library-notice-dismiss"
          onClick={dismissLibraryProblem}
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}
