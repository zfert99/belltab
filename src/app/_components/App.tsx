"use client";

import { useEffect, useRef, useState } from "react";
import { useNow } from "@/app/_lib/useNow";
import { saveLibrary, useLibrary } from "@/app/_lib/libraryStore";
import { savePreferences, usePreferences } from "@/app/_lib/preferencesStore";
import { applyMotion, applyTheme } from "@/app/_lib/theme";
import { useWakeLock, wantsSignpost } from "@/app/_lib/wakeLock";
import { useBells } from "@/app/_lib/bells";
import { addSchedule, setOverride } from "@/app/_lib/library";
import { clearShareFragment, incomingSchedule } from "@/app/_lib/shareLink";
import type { ValidSchedule } from "@/lib/schedule";
import { tabTitleFor, viewForNow } from "@/app/_lib/today";
import { formatClock } from "@/lib/format";
import { shiftNow, type LocalNow } from "@/lib/clock";
import { NowView } from "@/app/_components/NowView";
import { DayView } from "@/app/_components/DayView";
import { SettingsView, type PanelId } from "@/app/_components/SettingsView";
import { PeriodAnnouncer } from "@/app/_components/PeriodAnnouncer";
import { ShareOffer } from "@/app/_components/ShareOffer";
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
  const preferences = usePreferences();

  /**
   * The theme, kept on `<html>` after the first paint.
   *
   * `THEME_SCRIPT` in layout.tsx has already done this before a pixel was
   * drawn; what this effect adds is everything after that - pressing a radio,
   * and the `storage` event that carries the change into every other tab on the
   * origin. Both write the same attribute from the same stored value, so the
   * two never disagree about what the page should look like.
   *
   * An effect rather than a render-time write because it touches a node outside
   * this tree. `document.documentElement` is not React's to render.
   */
  useEffect(() => {
    applyTheme(document.documentElement, preferences.theme);
  }, [preferences.theme]);

  // The in-app motion override, the same way: an attribute on <html> that
  // globals.css branches on, kept in step with the preference.
  useEffect(() => {
    applyMotion(document.documentElement, preferences.reduceMotion);
  }, [preferences.reduceMotion]);

  /**
   * The screen wake lock, held from HERE and nowhere else.
   *
   * Mounted above both screens for the same reason the clock is: the lock has to
   * outlive whichever view is up. Owning it inside the preferences panel would
   * release it the moment the user pressed Back to watch the countdown - which is
   * the only moment it was ever wanted.
   *
   * The status travels back down to the panel as a prop rather than being read
   * again there, so there is one lock and one account of what it is doing.
   */
  const wakeLockStatus = useWakeLock(preferences.keepScreenAwake);

  // Which panel, or none. A boolean plus a separate panel id would let the two
  // disagree; this way "settings is open on the calendar" is one value, which is
  // what the countdown's empty states hand back when they link in.
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null);
  const settingsOpen = openPanel !== null;

  /**
   * Big mode: the projector.
   *
   * A MODE laid over the Now view, not a second view. `globals.css` scales the
   * same elements up and takes the authoring chrome away, so there is exactly
   * one countdown in this codebase and no way for two of them to drift apart.
   * That is why this is a boolean here rather than a third value in a view
   * union - there is nothing to render differently, only bigger.
   */
  const [big, setBig] = useState(false);

  /**
   * The mode is a class on `<body>`, because the two rules that matter -
   * zeroing the body's padding and letting the card go full-bleed - are about
   * the page rather than about anything in this tree. `document.body` is not
   * React's to render, so this is an effect, exactly like the theme.
   *
   * The cleanup is not decoration: without it a remount leaves the class behind
   * and the ordinary view renders inside a projector layout. Strict Mode's
   * double mount in development is what would find that.
   */
  useEffect(() => {
    document.body.classList.toggle("is-big", big);
    return () => document.body.classList.remove("is-big");
  }, [big]);

  /**
   * The bell offset, applied ONCE, here, on the way into the engine.
   *
   * Everything downstream - the digits, the progress bar, the tab title, the
   * boundary announcer - is a derived view of this one value, so correcting the
   * clock in one place corrects all four. The alternative, shifting the
   * schedule's stored minutes, would put one building's clock skew into every
   * backup and every share link; see `shiftNow` for the full argument.
   *
   * The wall clock below deliberately does NOT get the shifted reading. It is
   * there so a user can check the countdown against something, and a clock that
   * moves with the correction is not something to check against.
   */
  const shifted = now === null ? null : shiftNow(now, preferences.bellOffsetSec);
  const view = shifted === null ? null : viewForNow(library, shifted);

  /**
   * Which screen is up: the countdown, or the whole day as a list.
   *
   * Component state, like Big mode, and for the same reason - a screen you
   * re-enter beats one you cannot see the way out of. Big mode is a MODE over
   * the countdown, not a third screen, so entering it shows the Now view
   * whatever this says, and leaving it comes back here.
   */
  const [screen, setScreen] = useState<"now" | "day">("now");

  /**
   * The audible bell and the notification, keyed on the SHIFTED state - the
   * same one the announcer and the digits watch - so an offset that moves the
   * countdown moves the chime with it. That is the whole promise of the offset:
   * every derived view of the clock agrees, including the ones you hear.
   *
   * Mounted here beside the wake lock for the same reason it is: a bell that
   * rings while the editor is open is still a bell.
   */
  const bellStatuses = useBells(view?.kind === "scheduled" ? view.state : null, preferences);

  /**
   * A schedule somebody sent, waiting to be accepted or dismissed.
   *
   * Read on mount AND on `hashchange`, and the second one is not belt and
   * braces. Pasting a link into a tab that is already on BellTab changes only
   * the fragment, which is a SAME-DOCUMENT navigation: nothing reloads, React
   * never remounts, and a mount-only read would leave the user staring at their
   * own schedule wondering where the shared one went. Measured, not assumed -
   * the first version of this was mount-only and the browser test caught it.
   *
   * No loop: `replaceState`, which is how the fragment is cleared afterwards,
   * deliberately does not fire `hashchange`.
   *
   * Client-only by necessity rather than by preference: there is no
   * `window.location` on the server, and a fragment is never sent to one anyway.
   * That is the property the whole sharing design rests on.
   */
  const [offer, setOffer] = useState<
    { kind: "schedule"; schedule: ValidSchedule } | { kind: "error"; message: string } | null
  >(null);

  useEffect(() => {
    // The decode is asynchronous - it runs a decompression stream - so Strict
    // Mode's double mount can land two of them, and a fast paste can land a
    // second before the first resolves. The flag drops anything that comes back
    // after this effect is done with.
    let live = true;

    const readFragment = () => {
      void incomingSchedule().then((result) => {
        if (!live || result === null) return;

        setOffer(
          result.ok
            ? { kind: "schedule", schedule: result.value }
            : { kind: "error", message: result.errors[0].message },
        );
      });
    };

    readFragment();
    window.addEventListener("hashchange", readFragment);

    return () => {
      live = false;
      window.removeEventListener("hashchange", readFragment);
    };
  }, []);

  const resolveOffer = (accept: boolean) => {
    if (accept && offer?.kind === "schedule") {
      // Added, AND made today's. The first version added it to the library and
      // opened the editor, which left the countdown running the regular day -
      // so the person who clicked a link to see a schedule saw a different
      // one, which the user called confusing on 2026-09-04. A dated exception
      // for today, never a weekday default: the link is about today.
      const withSchedule = addSchedule(library, offer.schedule);
      const added = withSchedule.schedules[withSchedule.schedules.length - 1];
      saveLibrary(
        shifted === null || added.id === null
          ? withSchedule
          : setOverride(withSchedule, shifted.isoDate, added.id),
      );
      // And show it running. A link can arrive over an open settings panel -
      // pasting it into a tab that is already on BellTab is a same-document
      // navigation, so whatever was open stays open - and "add" should end on
      // the countdown, not in the editor.
      setOpenPanel(null);
    }

    setOffer(null);
    // Off the address bar either way. A refresh should not re-offer it, and
    // more importantly the URL should stop carrying somebody's schedule into
    // this browser's history - AGENTS.md, on full URLs and history sync.
    clearShareFragment();
  };

  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const bigEnterRef = useRef<HTMLButtonElement | null>(null);
  const bigExitRef = useRef<HTMLButtonElement | null>(null);

  /**
   * Focus follows the mode, in both directions - and not on first paint.
   *
   * Entering Big mode unmounts the button that was just pressed, so without
   * this the next Tab starts from the top of the document; leaving it puts
   * focus back on the control that was used to enter, which is where a keyboard
   * user expects to be left.
   *
   * The `hasBeenBig` guard is what keeps the mount pass quiet. This effect runs
   * once with `big === false` on every load, and without the guard that would
   * steal focus to the Big mode button before the user has touched anything.
   */
  const hasBeenBig = useRef(false);

  useEffect(() => {
    if (big) {
      hasBeenBig.current = true;
      bigExitRef.current?.focus();
    } else if (hasBeenBig.current) {
      bigEnterRef.current?.focus();
    }
  }, [big]);

  /**
   * Focus follows the view swap in both directions. Opening moves it to the
   * settings heading; closing returns it to the control that OPENED settings,
   * which is where a keyboard user expects to be left. Without this, opening
   * the editor strands focus on a control that is no longer rendered and the
   * next Tab starts from the top of the document.
   *
   * There is more than one opener now - the gear, the empty states' links and
   * the wake-lock signpost - so the one that was used is remembered BY ID, not
   * as an element: the Now view is unmounted while settings is up and mounted
   * again on close, so the element that was pressed is gone by the time focus
   * has to return and its replacement has to be looked up fresh. The gear is
   * the fallback for an opener that does not come back (the signpost goes away
   * once the lock is on, which is the likely outcome of using it).
   */
  const openerIdRef = useRef<string | null>(null);
  /** Where focus lands on OPEN, when a link asked for somewhere below the heading. */
  const openFocusIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (settingsOpen) {
      const target =
        openFocusIdRef.current === null ? null : document.getElementById(openFocusIdRef.current);
      (target ?? headingRef.current)?.focus();
      return;
    }

    const opener = openerIdRef.current === null ? null : document.getElementById(openerIdRef.current);
    (opener ?? toggleRef.current)?.focus();
  }, [settingsOpen]);

  // Escape leaves settings, matching every other panel on the web - UNLESS a
  // modal is up.
  //
  // That guard is the whole reason this listener is worth a comment. A modal
  // `<dialog>`'s Escape keydown bubbles to the document, and the dialog's own
  // close is only the DEFAULT ACTION of that same event, so this listener runs
  // FIRST. Without the bail, one Escape would close settings out from under an
  // open delete confirmation and leave the modal standing on the countdown.
  // That is a regression this repo has already shipped once; see Bugs found in
  // Docs/build-log.md, and `e2e/confirm-dialog.spec.ts` for the contract.
  //
  // Big mode is on the same key and takes precedence, because it is the mode
  // that is hardest to get out of by pointing: its exit is one quiet pill at
  // the bottom of a projector screen, and the header's own controls are hidden.
  // The two are mutually exclusive in practice - see `openSettingsFrom` - so
  // the ordering below is a floor rather than a decision the user can observe.
  useEffect(() => {
    if (!settingsOpen && !big) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector("dialog[open]") !== null) return;
      if (big) setBig(false);
      else setOpenPanel(null);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen, big]);

  /**
   * Opening settings leaves Big mode first.
   *
   * Not hypothetical: the "No school today" screen's call to action is a
   * `.minibutton`, which Big mode scales but does not hide, so a projector
   * showing an empty day has a live route into the editor. Without this the
   * settings panel would render inside the full-bleed projector layout, which
   * is a screen nobody designed.
   */
  const openSettingsFrom = (
    panel: PanelId,
    openerId: string | null = null,
    focusId: string | null = null,
  ) => {
    openerIdRef.current = openerId;
    openFocusIdRef.current = focusId;
    setBig(false);
    setOpenPanel(panel);
  };

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

      {offer !== null && (
        <ShareOffer
          offer={offer}
          onAdd={() => resolveOffer(true)}
          onDismiss={() => resolveOffer(false)}
        />
      )}

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
            onClick={() => {
              openerIdRef.current = null;
              setOpenPanel((panel) => (panel === null ? "schedules" : null));
            }}
          >
            {settingsOpen ? <BackIcon /> : <GearIcon />}
          </button>
        </div>
      </header>

      {openPanel !== null ? (
        <SettingsView
          library={library}
          save={saveLibrary}
          preferences={preferences}
          savePreferences={savePreferences}
          wakeLockStatus={wakeLockStatus}
          bellStatuses={bellStatuses}
          now={now}
          initialPanel={openPanel}
          headingRef={headingRef}
        />
      ) : (
        <>
          {screen === "day" && !big && view?.kind === "scheduled" && shifted !== null ? (
            <DayView schedule={view.schedule} nowSec={shifted.secOfDay} />
          ) : (
            <NowView
              view={view}
              onOpenSettings={(panel, focusId) => openSettingsFrom(panel, null, focusId ?? null)}
              strip={
                preferences.showStrip && shifted !== null && view?.kind === "scheduled"
                  ? { schedule: view.schedule, nowSec: shifted.secOfDay }
                  : null
              }
            />
          )}

          {/*
            Two screens and a mode. Now and Day are a pressed pair - two real
            destinations, which is what the 2026-09-02 decision said a switcher
            needs before it earns one. Big mode stays one button in and one out:
            it is a mode over the countdown, and its second state would be
            "normal".
          */}
          {big ? (
            <button
              type="button"
              className="bigexit"
              id="big-exit"
              ref={bigExitRef}
              onClick={() => setBig(false)}
            >
              Exit big mode
            </button>
          ) : (
            <div className="viewswitch">
              <div className="viewswitch__row">
                <button
                  type="button"
                  className="viewswitch__btn"
                  id="view-now"
                  aria-pressed={screen === "now"}
                  onClick={() => setScreen("now")}
                >
                  Now
                </button>
                <button
                  type="button"
                  className="viewswitch__btn"
                  id="view-day"
                  aria-pressed={screen === "day"}
                  onClick={() => setScreen("day")}
                >
                  Day
                </button>
                <button
                  type="button"
                  className="viewswitch__btn"
                  id="view-big"
                  ref={bigEnterRef}
                  onClick={() => setBig(true)}
                >
                  Big mode
                </button>
              </div>
              {/*
                The signpost between the two features built for the same room.
                Big mode scales the countdown for a projector; the wake lock
                keeps the projector from going dark mid-period; and until this
                line nothing connected them - a user who found one was given no
                hint the other was three taps away in Preferences. Which
                statuses want the sign is `wantsSignpost`'s call: off, and
                refused - the ticked box whose projector is likeliest to go
                dark. Held and waiting have nothing to point at.
              */}
              {wantsSignpost(wakeLockStatus) && (
                <p className="viewswitch__hint">
                  On a projector?{" "}
                  <button
                    type="button"
                    className="linkbutton"
                    id="wake-lock-signpost"
                    onClick={() => openSettingsFrom("preferences", "wake-lock-signpost")}
                  >
                    Keep the screen awake
                  </button>
                </p>
              )}
            </div>
          )}
        </>
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
