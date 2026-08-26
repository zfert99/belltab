import { schedule, PERIOD_KINDS } from "./schedule.js";

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

/**
 * The whole day as one bar: first bell to last bell, gaps included.
 *
 * Kept separate from stateAt rather than bolted onto its return value, because
 * the two answer different questions and the day view needs this without
 * caring which period is running.
 */
export function daySummaryAt(schedule, nowSec) {
  const periods = schedule.periods;

  if (periods.length === 0) return { phase: "empty", remainingSec: 0, progress: 0 };

  const dayStartSec = periods[0].startMin * 60;
  const dayEndSec = periods[periods.length - 1].endMin * 60;

  if (nowSec < dayStartSec) {
    return { phase: "before", remainingSec: dayStartSec - nowSec, progress: 0 };
  }
  if (nowSec >= dayEndSec) {
    return { phase: "after", remainingSec: 0, progress: 1 };
  }
  return {
    phase: "during",
    remainingSec: dayEndSec - nowSec,
    progress: (nowSec - dayStartSec) / (dayEndSec - dayStartSec),
  };
}

/**
 * One period's status. Uses the same half-open rule as stateAt, so a period
 * cannot read as "current" in the list while the countdown has moved on.
 */
export function periodStatusAt(period, nowSec) {
  if (nowSec >= period.endMin * 60) return "past";
  if (nowSec < period.startMin * 60) return "future";
  return "current";
}

/**
 * "3 of 7" - which countable block of the day this is.
 *
 * Passing periods are excluded because they are the seams, not the units. A
 * student counting down their day counts classes and lunch, not the ninety
 * seconds of hallway between them.
 *
 * Counts blocks that have STARTED, so mid-passing the number holds at the
 * block just finished rather than jumping ahead to one that has not begun.
 */
export function blockPositionAt(schedule, nowSec) {
  const blocks = schedule.periods.filter((p) => p.kind !== PERIOD_KINDS.PASSING);
  const started = blocks.filter((p) => nowSec >= p.startMin * 60).length;
  return { index: started, total: blocks.length };
}

/** Minutes since midnight to a wall-clock label: 545 -> "9:05". */
export function formatClock(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")}`;
}

/** A period's length, for the list: 55 -> "55m", 90 -> "1h 30m". */
export function formatDuration(totalMinutes) {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
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

/** The line under the strip: "3 of 7 - 3:38 until dismissal". */
export function formatDayCaption(day, position) {
  if (day.phase === "empty") return "No schedule";
  if (day.phase === "after") return `${position.total} of ${position.total} · done for today`;

  const { major, minor } = splitCountdown(day.remainingSec);
  const target = day.phase === "before" ? "until first bell" : "until dismissal";
  return `${position.index} of ${position.total} · ${major}:${minor} ${target}`;
}

/** One period, spelled out: "Period 3 - 10:10 to 11:05". */
export function formatPeriodLabel(period) {
  return `${period.name} · ${formatClock(period.startMin)}–${formatClock(period.endMin)}`;
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

  focusView: document.getElementById("focus-view"),
  periodName: document.getElementById("period-name"),
  minutes: document.getElementById("countdown-minutes"),
  seconds: document.getElementById("countdown-seconds"),
  strip: document.getElementById("strip"),
  stripTemplate: document.getElementById("strip-cell"),
  dayStart: document.getElementById("day-start"),
  dayEnd: document.getElementById("day-end"),
  dayCaption: document.getElementById("day-caption"),

  dayView: document.getElementById("day-view"),
  dayRemaining: document.getElementById("day-remaining"),
  dayRemainingLabel: document.getElementById("day-remaining-label"),
  dayProgressFill: document.getElementById("day-progress-fill"),
  pastToggle: document.getElementById("past-toggle"),
  pastToggleLabel: document.getElementById("past-toggle-label"),
  periodList: document.getElementById("period-list"),
  rowTemplate: document.getElementById("period-row"),

  viewNow: document.getElementById("view-now"),
  viewDay: document.getElementById("view-day"),
};

/** The period-name line when no period is running. */
const NO_PERIOD_NAME = {
  before: "Before school",
  gap: "Passing",
  after: "School is out",
  empty: "No schedule",
};

const DAY_LABEL = {
  before: "until first bell",
  during: "until dismissal",
  after: "school is out",
  empty: "no schedule",
};

/* ---------- The period strip ---------- */

/** Which period the pointer is over, or null. Overrides the caption while set. */
let hoveredPeriod = null;

/**
 * Clones one strip cell per period: a square for the day's real blocks, a thin
 * connector for passing periods.
 *
 * Passing periods get a cell rather than being skipped, so nothing in the day
 * is unaccounted for - the connector fills while you are in the hallway.
 */
function buildStripCells() {
  return schedule.periods.map((period) => {
    const cell = els.stripTemplate.content.firstElementChild.cloneNode(true);
    const isPassing = period.kind === PERIOD_KINDS.PASSING;

    cell.classList.add(isPassing ? "strip__cell--link" : "strip__cell--block");

    // Only squares get the hover affordance. A 4px connector is not a credible
    // pointer target, and the Day view carries these labels for everyone.
    if (!isPassing) {
      cell.addEventListener("pointerenter", () => {
        hoveredPeriod = period;
        tick();
      });
      cell.addEventListener("pointerleave", () => {
        hoveredPeriod = null;
        tick();
      });
    }

    els.strip.append(cell);
    return { period, cell, fill: cell.querySelector('[data-field="fill"]') };
  });
}

function paintStrip(nowSec) {
  for (const { period, cell, fill } of stripCells) {
    const status = periodStatusAt(period, nowSec);

    cell.classList.toggle("strip__cell--past", status === "past");
    cell.classList.toggle("strip__cell--current", status === "current");
    cell.classList.toggle("strip__cell--future", status === "future");

    // A partly-filled cell is a STATE, not a tick. If the tab was frozen and
    // the fill jumps 20% on return that reads as normal; the same gap in a
    // seconds counter reads as broken. Recomputing makes both correct - the
    // shape is what makes one of them also look correct.
    const elapsed = nowSec - period.startMin * 60;
    const length = (period.endMin - period.startMin) * 60;
    const percent = status === "past" ? 100 : status === "future" ? 0 : (elapsed / length) * 100;

    fill.style.width = `${percent.toFixed(2)}%`;
  }
}

/* ---------- The period list ---------- */

/** Whether finished periods are expanded in the Day view. */
let showPast = false;

/**
 * Clones one row per period, once.
 *
 * Rows are built here and only their CONTENTS change on each tick. Rebuilding
 * eleven list items every second would throw away focus, scroll position, and
 * any in-flight CSS transition sixty times a minute.
 *
 * Rebuild this if the schedule itself ever changes - which the editor will do.
 */
function buildPeriodRows() {
  return schedule.periods.map((period) => {
    const row = els.rowTemplate.content.firstElementChild.cloneNode(true);

    // Queried relative to `row`, not via getElementById, because every cloned
    // row carries the same data-field names. Ids would collide eleven ways.
    const fields = {
      start: row.querySelector('[data-field="start"]'),
      name: row.querySelector('[data-field="name"]'),
      aside: row.querySelector('[data-field="aside"]'),
      fill: row.querySelector('[data-field="fill"]'),
    };

    // The start time and the name never change with the clock, so they are
    // written once here rather than on every tick.
    fields.start.textContent = formatClock(period.startMin);
    fields.name.textContent = period.name;

    els.periodList.append(row);
    return { period, row, fields };
  });
}

const stripCells = buildStripCells();
const periodRows = buildPeriodRows();

/* ---------- Painting ---------- */

function paintFocus(state, nowSec) {
  const { major, minor } = splitCountdown(state.remainingSec);
  els.minutes.textContent = major;
  els.seconds.textContent = minor;

  els.periodName.textContent =
    state.phase === "during" ? state.current.name : NO_PERIOD_NAME[state.phase];

  paintStrip(nowSec);

  // Hovering a square borrows the caption instead of opening a tooltip: no
  // positioning code, no new tab stops, and it works on a touch tap.
  els.dayCaption.textContent = hoveredPeriod
    ? formatPeriodLabel(hoveredPeriod)
    : formatDayCaption(daySummaryAt(schedule, nowSec), blockPositionAt(schedule, nowSec));
}

function paintDay(nowSec) {
  const day = daySummaryAt(schedule, nowSec);
  const { major, minor } = splitCountdown(day.remainingSec);

  // Once the last bell has rung there is nothing left to count, and "0:00"
  // reads like a stopped clock rather than a finished day.
  const counting = day.phase === "before" || day.phase === "during";
  els.dayRemaining.textContent = counting ? `${major}:${minor}` : "--:--";
  els.dayRemainingLabel.textContent = DAY_LABEL[day.phase];
  els.dayProgressFill.style.width = `${(day.progress * 100).toFixed(2)}%`;

  let pastCount = 0;

  for (const { period, row, fields } of periodRows) {
    const status = periodStatusAt(period, nowSec);

    // toggle() rather than assigning className, so a class added elsewhere
    // later is not silently wiped out sixty times a minute.
    row.classList.toggle("period--past", status === "past");
    row.classList.toggle("period--current", status === "current");
    row.classList.toggle("period--future", status === "future");

    // Finished periods collapse so the current one sits at the top of the list.
    if (status === "past") pastCount++;
    row.hidden = status === "past" && !showPast;

    if (status === "current") {
      // aria-current="time" is the token for "the current one among a set of
      // times" - the accessible equivalent of the butterscotch highlight.
      row.setAttribute("aria-current", "time");

      const left = splitCountdown(period.endMin * 60 - nowSec);
      fields.aside.textContent = `${left.major}:${left.minor}`;

      const elapsed = nowSec - period.startMin * 60;
      const length = (period.endMin - period.startMin) * 60;
      fields.fill.style.width = `${((elapsed / length) * 100).toFixed(2)}%`;
    } else {
      row.removeAttribute("aria-current");
      fields.aside.textContent =
        status === "past" ? "done" : formatDuration(period.endMin - period.startMin);
    }
  }

  // Nothing to collapse before the first bell.
  els.pastToggle.hidden = pastCount === 0;
  els.pastToggleLabel.textContent = `${pastCount} earlier ${pastCount === 1 ? "period" : "periods"}`;
}

/* ---------- View switching ---------- */

const VIEW_KEY = "belltab:view";
let activeView = readStoredView();

/**
 * localStorage holds convenience, never truth, so anything unrecognised
 * degrades to the default rather than being trusted or reported.
 *
 * The try/catch is not paranoia: localStorage throws outright when a browser
 * is set to block site data, and in some private-browsing modes. An unguarded
 * read would take the whole app down before the first tick.
 */
function readStoredView() {
  try {
    return localStorage.getItem(VIEW_KEY) === "day" ? "day" : "now";
  } catch {
    return "now";
  }
}

function setView(view) {
  const showDay = view === "day";
  activeView = showDay ? "day" : "now";

  els.focusView.hidden = showDay;
  els.dayView.hidden = !showDay;

  // aria-pressed is both the accessible state and the CSS hook - the stylesheet
  // selects on [aria-pressed="true"], so there is only one source of truth.
  els.viewNow.setAttribute("aria-pressed", String(!showDay));
  els.viewDay.setAttribute("aria-pressed", String(showDay));

  try {
    localStorage.setItem(VIEW_KEY, activeView);
  } catch {
    // Not being able to remember the choice is not a reason to refuse it.
  }

  // The hidden view is not painted, so the one just revealed is a tick stale.
  tick();
}

/* ---------- The clock ---------- */

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

  els.wallClock.textContent = formatClock(Math.floor(nowSec / 60));

  // Only the visible view is painted. The other one is behind `hidden`, so
  // writing to it would be ~50 DOM writes a second that nobody can see.
  if (activeView === "day") paintDay(nowSec);
  else paintFocus(state, nowSec);

  // Minute resolution: the tab title only needs to change 60x less often than
  // the display, and rewriting it every second is wasted work. Derived from
  // stateAt in both views, so the title is right whichever one is showing.
  const title = formatTabTitle(state);
  if (document.title !== title) document.title = title;
}

/* ---------- Wiring ---------- */

// Period names are user input and will eventually arrive from a share link, so
// every write above is textContent. innerHTML anywhere here would be an XSS
// hole reachable by sending someone a URL.
els.scheduleName.textContent = schedule.name;

// The day's outer bounds never move, so they are written once rather than
// rewritten sixty times a minute.
if (schedule.periods.length > 0) {
  els.dayStart.textContent = formatClock(schedule.periods[0].startMin);
  els.dayEnd.textContent = formatClock(schedule.periods[schedule.periods.length - 1].endMin);
}

els.viewNow.addEventListener("click", () => setView("now"));
els.viewDay.addEventListener("click", () => setView("day"));

els.pastToggle.addEventListener("click", () => {
  showPast = !showPast;
  els.pastToggle.setAttribute("aria-expanded", String(showPast));
  tick();
});

// One clock, one subscriber. Every other view is derived from this tick, so
// nothing else in the app is allowed its own setInterval.
setInterval(tick, 1000);

// A throttled or frozen tab can miss minutes of ticks. These two events fire
// the moment it comes back, so the first thing the user sees is already right
// rather than catching up a second later.
document.addEventListener("visibilitychange", tick);
window.addEventListener("focus", tick);

setView(activeView);
