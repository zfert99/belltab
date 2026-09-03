"use client";

import type { DayState } from "@/lib/engine";
import { boundaryKey, formatClock, splitCountdown } from "@/lib/format";
import type { TodayView } from "@/app/_lib/today";
import type { PanelId } from "@/app/_components/SettingsView";

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
  view: TodayView | null;
  /** The way out of the two empty states that are otherwise dead ends. */
  onOpenSettings: (panel: PanelId) => void;
}

export function NowView({ view, onOpenSettings }: NowViewProps) {
  return (
    <section className="focus">
      <Focus view={view} onOpenSettings={onOpenSettings} />
    </section>
  );
}

function Focus({ view, onOpenSettings }: NowViewProps) {
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
      />
    );
  }

  return <ScheduleFocus state={view.state} />;
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

function ScheduleFocus({ state }: { state: DayState }) {
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
        <p className="countdown__period" id="period-name" key={boundaryKey(state)}>
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
      <div className="progress" aria-hidden="true">
        <div className="progress__fill" style={{ width: `${percentOf(state.progress)}%` }} />
      </div>

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
}: {
  headline: string;
  detail: string;
  action?: { label: string; onClick: () => void };
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

/**
 * A fraction to a bar width, rounded to a whole percent.
 *
 * Rounding is not cosmetic: an unrounded value writes a new inline style string
 * every second and animates a 300ms width transition into a permanent crawl.
 * A whole percent changes at most once every few seconds, which is what the
 * transition was designed for.
 */
function percentOf(progress: number): number {
  return Math.round(Math.min(1, Math.max(0, progress)) * 100);
}
