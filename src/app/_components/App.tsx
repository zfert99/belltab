"use client";

import { useEffect, useRef, useState } from "react";
import { useNow } from "@/app/_lib/useNow";
import { saveLibrary, useLibrary } from "@/app/_lib/libraryStore";
import { scheduleToEdit, tabTitleFor, viewForNow } from "@/app/_lib/today";
import { formatClock } from "@/lib/format";
import type { LocalNow } from "@/lib/clock";
import { NowView } from "@/app/_components/NowView";
import { SettingsView } from "@/app/_components/SettingsView";
import { PeriodAnnouncer } from "@/app/_components/PeriodAnnouncer";
import { BackIcon, GearIcon } from "@/app/_components/icons";

/**
 * The app shell: one clock, one library, and which of the two screens is up.
 *
 * Phase 2 put all of this in `NowView`. Phase 3 split it, because there are now
 * two screens sharing one clock and one store, and `AGENTS.md`'s "one clock,
 * one subscriber" means the subscriber has to sit above both of them rather
 * than each screen growing its own.
 *
 * Still the only stateful client component. `page.tsx` remains a Server
 * Component and owns the card around this.
 */

const PENDING = "--";

export function App() {
  const now = useNow();
  const library = useLibrary();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const view = now === null ? null : viewForNow(library, now);

  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // Focus follows the view swap in both directions. Opening moves it to the
  // settings heading; closing returns it to the button that was pressed, which
  // is where a keyboard user expects to be left. Without this, opening the
  // editor strands focus on a control that is no longer rendered and the next
  // Tab starts from the top of the document.
  useEffect(() => {
    if (settingsOpen) headingRef.current?.focus();
    else toggleRef.current?.focus();
  }, [settingsOpen]);

  // Escape leaves settings, matching every other panel on the web.
  //
  // PHASE 4 WILL HAVE TO GUARD THIS. A modal `<dialog>`'s Escape keydown
  // bubbles to the document, and the dialog's own close is only the default
  // action of that same event - so this listener runs FIRST and would close
  // settings out from under an open confirmation. That is a regression this
  // repo has already shipped once; see Bugs found in Docs/build-log.md.
  useEffect(() => {
    if (!settingsOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen]);

  return (
    <>
      {/*
        The tab title, RENDERED rather than assigned.

        React 19 hoists a `<title>` from anywhere in the tree into `<head>`, and
        that is the only version of this that survives: writing
        `document.title` from an effect works for one frame and is then
        overwritten by the App Router's metadata pass. Measured, not assumed -
        see the build log. This is also why `metadata` in layout.tsx sets no
        title: two owners is what caused the fight.

        The countdown's title stands while settings is open. The clock has not
        stopped just because it is not on screen.
      */}
      <title>{view === null ? "BellTab" : tabTitleFor(view)}</title>

      <header className="screen__bar">
        <h1 className="screen__schedule">BellTab</h1>
        <div className="screen__meta">
          <p id="schedule-name" className="screen__clock">
            {view?.kind === "scheduled" ? view.scheduleName : PENDING}
          </p>
          <WallClock now={now} />
          <button
            type="button"
            className="icon-button"
            id="settings-toggle"
            ref={toggleRef}
            aria-expanded={settingsOpen}
            aria-controls="settings-view"
            aria-label={settingsOpen ? "Back to the countdown" : "Edit the schedule"}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            {settingsOpen ? <BackIcon /> : <GearIcon />}
          </button>
        </div>
      </header>

      {settingsOpen ? (
        <SettingsView
          schedule={scheduleToEdit(library, now)}
          library={library}
          save={saveLibrary}
          headingRef={headingRef}
        />
      ) : (
        <NowView view={view} />
      )}

      {/*
        Mounted for BOTH screens, not inside the countdown.

        A bell that rings while the editor is open is still a bell, and an
        announcer that unmounts with the view would miss it and then come back
        silent - its "say nothing on first paint" rule would swallow the
        boundary it slept through. Keeping it here also means the page's live
        regions are the same set on both screens, which is what makes the
        enumeration tests worth running.
      */}
      <PeriodAnnouncer state={view?.kind === "scheduled" ? view.state : null} />
    </>
  );
}

/**
 * The device's own clock, shown so the countdown can be checked against
 * something. A tab that has been asleep and come back wrong is the failure this
 * app exists to avoid, and a wall clock beside the number is how a user notices.
 */
function WallClock({ now }: { now: LocalNow | null }) {
  if (now === null) {
    return (
      <p className="screen__clock" id="wall-clock">
        {PENDING}:{PENDING}
      </p>
    );
  }

  const minutes = Math.floor(now.secOfDay / 60);

  // The machine-readable value is 24-hour; the visible one follows the
  // mockups. `<time>` wants an unambiguous string, the reader wants "9:30".
  return (
    <time className="screen__clock" id="wall-clock" dateTime={formatClock(minutes, { hour12: false })}>
      {formatClock(minutes)}
    </time>
  );
}
