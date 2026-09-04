"use client";

import { useState } from "react";

import type { DayState } from "@/lib/engine";
import { boundaryKey, formatClock, percentOf, splitCountdown } from "@/lib/format";
import type { TodayView } from "@/app/_lib/today";
import type { PanelId } from "@/app/_components/SettingsView";
import { DayStrip } from "@/app/_components/DayStrip";
import type { ValidSchedule } from "@/lib/schedule";

/**
 * The countdown screen.
 *
 * Presentational since Phase 3: the clock, the library and the tab title moved
 * up to `App.tsx`, which is where the one subscriber now lives, and this
 * renders whatever `TodayView` it is handed. `null` is the pre-mount state -
 * the server has no device clock and a different timezone, so any time-derived
 * value rendered there is a hydration mismatch by construction.
 *
 * Nothing below holds a remaining-time number across renders. Every value on
 * screen is recomputed from one reading, which is the repo's first invariant.
 */

/**
 * What the digits read before the clock has been read.
 *
 * Two characters wide in a tabular-figures face, so the placeholder occupies
 * exactly the space the real number will.
 */
const PENDING = "--";

export interface NowViewProps {
  /**
   * The day as blocks under the countdown, when the preference asks for it.
   * The schedule comes along because the strip needs every period, not just
   * the running one the state carries.
   */
  strip?: { schedule: ValidSchedule; nowSec: number } | null;
  view: TodayView | null;
  /** The way out of the two empty states that are otherwise dead ends. */
  onOpenSettings: (panel: PanelId, focusId?: string) => void;
}

export function NowView({ view, onOpenSettings, strip = null }: NowViewProps) {
  return (
    <section className="focus">
      <Focus view={view} onOpenSettings={onOpenSettings} strip={strip} />
    </section>
  );
}

function Focus({ view, onOpenSettings, strip }: NowViewProps) {
  if (view === null) return <PendingFocus />;

  /*
    Both empty states below carry a way out, which the design system asks for
    and which nothing could satisfy until Phase 4 built somewhere to go. An
    empty state whose only advice is "set something up" and which offers no
    route to doing so is a dead end with good manners.
  */
  if (view.kind === "no-schedules") {
    return (
      <Message
        headline="No schedule yet"
        detail="Nothing has been set up to count down."
        action={{ label: "Set up a schedule", onClick: () => onOpenSettings("schedules") }}
      />
    );
  }

  if (view.kind === "no-school") {
    return (
      <Message
        headline="No school today"
        detail="The calendar has nothing scheduled for today. Enjoy it."
        action={{ label: "Pick a schedule for today", onClick: () => onOpenSettings("calendar") }}
        // The second way out, for the person whose SATURDAY genuinely runs
        // school: the primary action writes a one-off exception, and until
        // this line the weekday defaults were a section they had to find below
        // it. Opens the same panel, focus on that section's heading.
        secondary={{
          label: "Change the weekday defaults",
          onClick: () => onOpenSettings("calendar", "weekday-defaults"),
        }}
      />
    );
  }

  return <ScheduleFocus state={view.state} strip={strip ?? null} />;
}

/**
 * The first paint, before the clock has been read.
 *
 * Rendered rather than skipped so the layout does not jump when the real values
 * arrive: same elements, same sizes, honest placeholder text.
 */
function PendingFocus() {
  return (
    <>
      <div className="countdown">
        <p className="countdown__period" id="period-name">
          &nbsp;
        </p>
        <p className="countdown__time">
          <span id="countdown-minutes">{PENDING}</span>
          <span className="countdown__colon">:</span>
          <span className="countdown__seconds" id="countdown-seconds">
            {PENDING}
          </span>
        </p>
        <p className="countdown__units">min : sec</p>
      </div>
      <div className="progress" aria-hidden="true">
        <div className="progress__fill" style={{ width: "0%" }} />
      </div>
      <div className="bounds">
        <p className="bounds__next">Reading the clock…</p>
      </div>
    </>
  );
}

function ScheduleFocus({
  state,
  strip,
}: {
  state: DayState;
  strip: { schedule: ValidSchedule; nowSec: number } | null;
}) {
  /**
   * The crossfade runs at a BELL, not on first paint - the announcer's rule 2,
   * applied to motion. `key` remounts the element on every boundary; this
   * says whether a boundary has been seen yet, so the first mount draws the
   * name plain and every remount after it fades in. Adjusted during render,
   * the way the announcer does it.
   *
   * Two things were wrong with fading on first paint: a user opening the tab
   * mid-period got a fade that meant nothing, and under a paused test clock
   * WebKit never advanced the animation past frame one - opacity 0 - so axe
   * read a period name with no contrast at all. See Bugs found, 2026-09-03.
   */
  const key = boundaryKey(state);
  const [seen, setSeen] = useState({ key, swap: false });
  if (seen.key !== key) setSeen({ key, swap: true });
  const swap = seen.swap;

  if (state.phase === "empty") {
    return (
      <Message
        headline="This schedule has no periods"
        detail="There is nothing to count down until it has some."
      />
    );
  }

  if (state.phase === "after") {
    return <Message headline="School's out" detail="See you tomorrow." />;
  }

  const { major, minor, unit } = splitCountdown(state.remainingSec);

  return (
    <>
      <div className="countdown">
        <p
          className={`countdown__period${swap ? " countdown__period--swap" : ""}`}
          id="period-name"
          key={key}
        >
          {headlineFor(state)}
        </p>
        <p className="countdown__time">
          <span id="countdown-minutes">{major}</span>
          <span className="countdown__colon">:</span>
          <span className="countdown__seconds" id="countdown-seconds">
            {minor}
          </span>
        </p>
        {/*
          The two scales render identically, so "3:38" alone is three hours and
          three minutes at once. The caption is what disambiguates it.
        */}
        <p className="countdown__units">{unit}</p>
      </div>

      {/*
        Decorative on purpose. The design system prefers an unlabelled fill with
        the numbers stated in text beside it over a `<progress>` carrying a
        name that would be read out on every change.
      */}
      {/*
        The period's progress bar - or, with the blocks preference on, the day's
        strip in its place: the same bar broken into the day's blocks, the
        running one filling in, so the two never show at once.
      */}
      {strip !== null ? (
        <DayStrip schedule={strip.schedule} nowSec={strip.nowSec} />
      ) : (
        <div className="progress" aria-hidden="true">
          <div className="progress__fill" style={{ width: `${percentOf(state.progress)}%` }} />
        </div>
      )}

      <div className="bounds">
        {state.phase === "during" && (
          <>
            <p className="bounds__edge bounds__edge--start">{formatClock(state.current.startMin)}</p>
            <p className="bounds__edge bounds__edge--end">{formatClock(state.current.endMin)}</p>
          </>
        )}
        <p className="bounds__next">{nextLineFor(state)}</p>
      </div>
    </>
  );
}

/** An empty state is a first-class screen, not a blank one. */
function Message({
  headline,
  detail,
  action,
  secondary,
}: {
  headline: string;
  detail: string;
  action?: { label: string; onClick: () => void };
  /** A quieter second route, rendered as a link-styled button under the first. */
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <>
      <div className="countdown">
        <p className="countdown__period countdown__period--message" id="period-name">
          {headline}
        </p>
      </div>
      <div className="bounds">
        <p className="bounds__next">{detail}</p>
        {action !== undefined && (
          <button type="button" className="minibutton message__action" onClick={action.onClick}>
            {action.label}
          </button>
        )}
        {secondary !== undefined && (
          <p className="message__secondary">
            <button
              type="button"
              className="linkbutton"
              id="message-secondary"
              onClick={secondary.onClick}
            >
              {secondary.label}
            </button>
          </p>
        )}
      </div>
    </>
  );
}

/**
 * The label above the number: what is being counted down.
 *
 * A gap reads "Between periods" rather than the design document's "Passing".
 * The seeded schedules model passing as a real period with `kind: "passing"`,
 * so during passing the engine is in its `during` phase and this line shows the
 * period's own name. The `gap` phase is what is left over - a genuine hole in
 * the day, which may be four minutes or two hours - and calling a two-hour hole
 * "Passing" would be a lie the label is free to avoid.
 */
function headlineFor(state: DayState): string {
  switch (state.phase) {
    case "during":
      return state.current.name;
    case "before":
      return "School starts in";
    default:
      return "Between periods";
  }
}

function nextLineFor(state: DayState): string {
  if (state.phase === "before") {
    return `First bell: ${state.next.name} at ${formatClock(state.next.startMin)}`;
  }
  if (state.phase === "gap") {
    return `Next: ${state.next.name} at ${formatClock(state.next.startMin)}`;
  }
  if (state.phase === "during" && state.next !== null) {
    return `Next: ${state.next.name} at ${formatClock(state.next.startMin)}`;
  }
  return "Last period of the day";
}

