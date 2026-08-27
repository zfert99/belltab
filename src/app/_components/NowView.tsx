"use client";

import type { DayState } from "@/lib/engine";
import { formatClock, splitCountdown } from "@/lib/format";
import type { LocalNow } from "@/lib/clock";
import { tabTitleFor, viewForNow, type TodayView } from "@/app/_lib/today";
import { useNow } from "@/app/_lib/useNow";
import { PeriodAnnouncer } from "@/app/_components/PeriodAnnouncer";

/**
 * The countdown screen: one clock, one subscriber, every other value derived.
 *
 * This is the app's single client component with state. It reads the clock once
 * per second through `useNow` and hands the result down as props - the tab
 * title, the digits, the progress bar and the announcer are all views of that
 * one reading, so they cannot disagree with each other.
 *
 * The title is minute-resolution and the digits are second-resolution from the
 * same reading, which is not a contradiction: `formatTabTitle` ceils to whole
 * minutes, so 59 of every 60 renders produce an identical string and React
 * touches nothing.
 *
 * Nothing below holds a remaining-time number across renders. Every value on
 * screen is recomputed from the reading, which is the repo's first invariant.
 */

/**
 * What the digits read before the clock has been read.
 *
 * Two characters wide in a tabular-figures face, so the placeholder occupies
 * exactly the space the real number will. The server has no device clock and a
 * different timezone, so this is what SSR emits and what the first hydration
 * render matches; the effect fills it in a frame later.
 */
const PENDING = "--";

export function NowView() {
  const now = useNow();
  const view = now === null ? null : viewForNow(now);

  return (
    <>
      {/*
        The tab title, RENDERED rather than assigned.

        React 19 hoists a `<title>` from anywhere in the tree into `<head>`, and
        that is the only version of this that survives: writing
        `document.title` from an effect works for one frame and is then
        overwritten by the App Router's own metadata pass, which runs after
        hydration. Measured, not assumed - a probe watching `<head>` recorded
        "35m · Period 2" followed immediately by "BellTab". See the build log.

        This is why `metadata` in layout.tsx no longer sets a title: two owners
        is what caused the fight. SSR still emits one, because this component
        renders "BellTab" until the clock has been read.

        Never announced, and deliberately so. Changing the title is silent to a
        screen reader; a per-minute announcement would be noise, and the page
        body plus the boundary announcer are the accessible surfaces.
      */}
      <title>{view === null ? "BellTab" : tabTitleFor(view)}</title>
      <header className="screen__bar">
        <h1 className="screen__schedule">BellTab</h1>
        <div className="screen__meta">
          <p id="schedule-name" className="screen__clock">
            {view?.kind === "scheduled" ? view.scheduleName : PENDING}
          </p>
          <WallClock now={now} />
        </div>
      </header>

      <section className="focus">
        <Focus view={view} />
      </section>

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

function Focus({ view }: { view: TodayView | null }) {
  if (view === null) return <PendingFocus />;

  if (view.kind === "no-schedules") {
    return (
      <Message
        headline="No schedule yet"
        detail="Nothing has been set up to count down. The editor arrives in the next phase."
      />
    );
  }

  if (view.kind === "no-school") {
    return (
      <Message
        headline="No school today"
        detail="The calendar has nothing scheduled for today. Enjoy it."
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
        <p className="countdown__period" id="period-name">
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
function Message({ headline, detail }: { headline: string; detail: string }) {
  return (
    <>
      <div className="countdown">
        <p className="countdown__period countdown__period--message" id="period-name">
          {headline}
        </p>
      </div>
      <div className="bounds">
        <p className="bounds__next">{detail}</p>
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
