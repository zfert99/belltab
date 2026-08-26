import { schedule } from "./schedule.js";

/* ============================================================
   PART 1 - THE PURE HALF
   No DOM, no Date, no side effects. "What time is it" is always an
   ARGUMENT, never something these functions go and look up. That is what
   makes them testable later without faking a clock: you call stateAt with
   second 32700 and assert on what comes back.

   This half moves to its own file the moment we add tests. It is here for
   now so you can read the whole clock in one sitting.
   ============================================================ */

/**
 * Where the school day stands at a given moment.
 *
 * @param {object} schedule - a schedule, periods sorted and non-overlapping
 * @param {number} nowSec - seconds since local midnight
 * @returns {{phase: string, current: object|null, next: object|null,
 *            remainingSec: number, progress: number}}
 */
export function stateAt(schedule, nowSec) {
  const periods = schedule.periods;

  if (periods.length === 0) {
    return { phase: "empty", current: null, next: null, remainingSec: 0, progress: 0 };
  }

  // Schedules store minutes; the countdown needs seconds. One multiply at the
  // boundary keeps the stored format integer-clean.
  const dayStartSec = periods[0].startMin * 60;
  const dayEndSec = periods[periods.length - 1].endMin * 60;

  if (nowSec < dayStartSec) {
    return {
      phase: "before",
      current: null,
      next: periods[0],
      remainingSec: dayStartSec - nowSec,
      progress: 0,
    };
  }

  if (nowSec >= dayEndSec) {
    return { phase: "after", current: null, next: null, remainingSec: 0, progress: 1 };
  }

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const startSec = period.startMin * 60;
    const endSec = period.endMin * 60;

    // A period is half-open: [start, end). At exactly its end second you are
    // already out of it. Without this, back-to-back periods would both claim
    // the same instant and the display would flicker between them.
    if (nowSec >= startSec && nowSec < endSec) {
      return {
        phase: "during",
        current: period,
        next: periods[i + 1] ?? null,
        remainingSec: endSec - nowSec,
        progress: (nowSec - startSec) / (endSec - startSec),
      };
    }

    // Past the day start, before this period, and not inside any earlier one:
    // we are in a gap. Gaps are legal - a schedule need not tile the day.
    if (nowSec < startSec) {
      const gapStartSec = periods[i - 1].endMin * 60;
      return {
        phase: "gap",
        current: null,
        next: period,
        remainingSec: startSec - nowSec,
        progress: (nowSec - gapStartSec) / (startSec - gapStartSec),
      };
    }
  }

  // Unreachable: the dayEndSec check above already caught everything past the
  // last period. Returned rather than thrown so a clock never dies mid-day.
  return { phase: "after", current: null, next: null, remainingSec: 0, progress: 1 };
}

/** Minutes since midnight to a wall-clock label: 545 -> "9:05". */
export function formatClock(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Splits a duration into the two numbers the display shows.
 *
 * Under an hour that is minutes and seconds ("43:12"). Over an hour it
 * becomes hours and minutes ("3:38"), because "218:12" is unreadable.
 *
 * KNOWN GAP: the two modes look identical, so "3:38" is ambiguous on its own.
 * It needs a unit label next to it - revisit when the markup gains a slot.
 */
export function splitCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));

  if (safeSeconds >= 3600) {
    return {
      major: String(Math.floor(safeSeconds / 3600)),
      minor: String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, "0"),
    };
  }

  return {
    major: String(Math.floor(safeSeconds / 60)),
    minor: String(safeSeconds % 60).padStart(2, "0"),
  };
}

/** The tab title: number first, so it survives truncation to a few characters. */
export function formatTabTitle(state) {
  if (state.phase === "after") return "Done - BellTab";
  if (state.phase === "empty") return "BellTab";

  const label = state.phase === "during" ? state.current.name : state.next.name;
  const minutes = Math.ceil(state.remainingSec / 60);
  return `${minutes}m - ${label}`;
}

/* ============================================================
   PART 2 - THE IMPURE HALF
   Reads the real clock, writes to the real DOM.
   ============================================================ */

const els = {
  scheduleName: document.getElementById("schedule-name"),
  wallClock: document.getElementById("wall-clock"),
  periodName: document.getElementById("period-name"),
  minutes: document.getElementById("countdown-minutes"),
  seconds: document.getElementById("countdown-seconds"),
  nextName: document.getElementById("next-name"),
  progressFill: document.getElementById("progress-fill"),
  periodStart: document.getElementById("period-start"),
  periodEnd: document.getElementById("period-end"),
  nextUp: document.getElementById("next-up"),
};

/** Copy for the states where no period is running. */
const EMPTY_STATE_COPY = {
  before: { period: "Before school", until: null },
  gap: { period: "Passing", until: null },
  after: { period: "School is out", until: "tomorrow" },
  empty: { period: "No schedule", until: "you add one" },
};

function paint(state, nowMinutes) {
  els.wallClock.textContent = formatClock(nowMinutes);

  const { major, minor } = splitCountdown(state.remainingSec);
  els.minutes.textContent = major;
  els.seconds.textContent = minor;

  if (state.phase === "during") {
    els.periodName.textContent = state.current.name;
    // No next period means the last bell of the day is what we are counting to.
    els.nextName.textContent = state.next ? state.next.name : "dismissal";
    els.periodStart.textContent = formatClock(state.current.startMin);
    els.periodEnd.textContent = formatClock(state.current.endMin);
  } else {
    const copy = EMPTY_STATE_COPY[state.phase];
    els.periodName.textContent = copy.period;
    els.nextName.textContent = copy.until ?? state.next.name;
    els.periodStart.textContent = "--:--";
    els.periodEnd.textContent = "--:--";
  }

  els.nextUp.textContent = state.next
    ? `Next: ${state.next.name} at ${formatClock(state.next.startMin)}`
    : "No more periods today";

  els.progressFill.style.width = `${(state.progress * 100).toFixed(2)}%`;
}

/**
 * One tick. Every value on screen is derived fresh from the system clock -
 * nothing is carried over from the previous tick and decremented.
 *
 * That is the whole ballgame. Browsers throttle a hidden tab to roughly one
 * wakeup per minute and freeze it outright on mobile, so a counter that
 * subtracts one per tick silently loses however long the tab was asleep. A
 * counter that re-reads the clock is correct the instant it repaints, no
 * matter how many ticks were skipped.
 */
function tick() {
  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const state = stateAt(schedule, nowSec);

  paint(state, Math.floor(nowSec / 60));

  // Minute resolution: the tab title only needs to change 60x less often than
  // the display, and rewriting it every second is wasted work.
  const title = formatTabTitle(state);
  if (document.title !== title) document.title = title;
}

// Period names are user input and will eventually arrive from a share link, so
// every write above is textContent. innerHTML anywhere here would be an XSS
// hole reachable by sending someone a URL.
els.scheduleName.textContent = schedule.name;

// One clock, one subscriber. Every other view is derived from this tick, so
// nothing else in the app is allowed its own setInterval.
setInterval(tick, 1000);

// A throttled or frozen tab can miss minutes of ticks. These two events fire
// the moment it comes back, so the first thing the user sees is already right
// rather than catching up a second later.
document.addEventListener("visibilitychange", tick);
window.addEventListener("focus", tick);

tick();
