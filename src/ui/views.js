import { stateAt, daySummaryAt, periodStatusAt, blockPositionAt } from "../lib/engine.js";
import {
  formatClock,
  formatDuration,
  formatRemaining,
  splitCountdown,
  formatDayCaption,
  formatPeriodLabel,
  formatTabTitle,
} from "../lib/format.js";
import { PERIOD_KINDS } from "../lib/schedule.js";
import { els } from "./dom.js";
import { store, scheduleFor, isoDateOf } from "../store.js";

/**
 * Everything that paints, plus the single clock that drives it.
 *
 * tick() lives here rather than in app.js on purpose. The editor has to
 * request a repaint after every edit, and if tick were in the entry point that
 * would make editor.js and app.js import each other - legal in ES modules, and
 * a reliable source of temporal-dead-zone bugs at module init. Keeping tick
 * with the things it paints keeps the dependency graph one-directional.
 */

/** True while settings is covering the live views, so tick paints nothing. */
let paused = false;

export function setViewsPaused(value) {
  paused = value;
}

/**
 * Which period the announcer last spoke for, and which row the Day view last
 * scrolled to.
 *
 * Both exist so their effect fires on a CHANGE rather than on every tick. An
 * announcement repeated once a second would make a screen reader unusable, and
 * a scrollIntoView every second would fight the user for control of the page.
 */
let lastAnnouncedKey = null;
let lastScrolledTo = null;

/**
 * Set when the schedule under the clock was replaced by an EDIT rather than by
 * time passing, so the next announce() takes the new value silently.
 *
 * The editor validates on every keystroke, and every draft that parses runs
 * refreshResolved -> tick. Without this, typing a period name announces once
 * per character - precisely the assistive-technology flood the single live
 * region exists to avoid. An edit is not a bell.
 */
let announcerNeedsResync = false;

/**
 * Identifies the running period by its place on the clock, not by its name.
 *
 * A name is the wrong key twice over: a half-typed one is a different string
 * on every keystroke, and two periods in a day may legitimately share a name
 * ("Study Hall" twice), in which case the boundary between them would never
 * announce at all. Periods may not overlap, so start and end minutes are the
 * only stable identity a period has.
 */
function announcementKey(state) {
  return state.phase === "during"
    ? `during:${state.current.startMin}-${state.current.endMin}`
    : state.phase;
}

/**
 * Announces the period change, and only the period change.
 *
 * This is the app's one live region driven by the clock. The countdown itself
 * must never become one: a per-second aria-live would read the number aloud
 * sixty times a minute. The tab title is not an accessible surface either -
 * changing document.title announces nothing - so for a screen-reader user this
 * is how the bell rings.
 */
function announce(state) {
  // Consumed on every call, including the ones that change nothing, so a
  // pending resync can never leak forward onto a later real period change.
  const resync = announcerNeedsResync;
  announcerNeedsResync = false;

  const key = announcementKey(state);
  if (key === lastAnnouncedKey) return;

  const firstPaint = lastAnnouncedKey === null;
  lastAnnouncedKey = key;

  // Silent on the very first paint - describing the current period the instant
  // the page loads is noise, not news - and silent when the change came from
  // an edit rather than from the clock.
  if (firstPaint || resync) return;

  const label =
    state.phase === "during"
      ? state.current.name
      : (NO_PERIOD_NAME[state.phase] ?? "No schedule");

  els.announcer.textContent =
    state.phase === "during" ? `${label} has started.` : `${label}.`;
}

/**
 * Keeps the running period visible in the Day view.
 *
 * With eleven periods on a short viewport the current row can sit well below
 * the fold. `block: "nearest"` scrolls only if it actually needs to, so a row
 * already on screen is left where it is.
 */
function revealCurrentRow() {
  const current = periodRows.find(({ row }) => row.classList.contains("period--current"));
  if (!current || current.row === lastScrolledTo) return;

  lastScrolledTo = current.row;

  // Feature-detected because jsdom does not implement scrolling at all. It is
  // a convenience either way - the row is correct whether or not it is on
  // screen - so an environment without it loses nothing that matters.
  if (typeof current.row.scrollIntoView !== "function") return;

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  current.row.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
}

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
  return store.schedule.periods.map((period) => {
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
  return store.schedule.periods.map((period) => {
    const row = els.rowTemplate.content.firstElementChild.cloneNode(true);

    // Queried relative to `row`, not via getElementById, because every cloned
    // row carries the same data-field names. Ids would collide eleven ways.
    const fields = {
      start: row.querySelector('[data-field="start"]'),
      name: row.querySelector('[data-field="name"]'),
      aside: row.querySelector('[data-field="aside"]'),
      fill: row.querySelector('[data-field="fill"]'),
    };

    // The name never changes at all. The start time changes only when the
    // 12/24-hour preference does, so paintStaticTimes owns it rather than the
    // per-second tick.
    fields.name.textContent = period.name;

    els.periodList.append(row);
    return { period, row, fields };
  });
}

let stripCells = [];

let periodRows = [];

/**
 * Throws away the strip cells and list rows and builds them from the current
 * schedule.
 *
 * Called on load, when the resolved schedule changes at midnight, and when the
 * editor changes the schedule being shown. NOT called per tick - see the
 * comment on buildPeriodRows for why rebuilding a list every second is
 * destructive rather than merely wasteful.
 */
export function rebuildViews() {
  els.strip.replaceChildren();
  els.periodList.replaceChildren();

  // The old period objects are gone; a stale hover would caption a period that
  // no longer exists in this schedule.
  hoveredPeriod = null;
  lastScrolledTo = null;

  stripCells = buildStripCells();
  periodRows = buildPeriodRows();

  els.scheduleName.textContent = store.schedule.name;
  paintStaticTimes();
}

/**
 * Every time on screen that is fixed by the schedule rather than by the clock.
 *
 * These would be wasted work in the per-second tick, but they are not truly
 * write-once either: switching to 24-hour has to rewrite all of them. Called
 * at startup and whenever that preference changes.
 */
export function paintStaticTimes() {
  for (const { period, fields } of periodRows) {
    fields.start.textContent = formatClock(period.startMin, store.prefs);
  }

  if (store.schedule.periods.length > 0) {
    const last = store.schedule.periods[store.schedule.periods.length - 1];
    els.dayStart.textContent = formatClock(store.schedule.periods[0].startMin, store.prefs);
    els.dayEnd.textContent = formatClock(last.endMin, store.prefs);
  }
}

function paintFocus(state, nowSec) {
  const { major, minor, unit } = splitCountdown(state.remainingSec);
  els.minutes.textContent = major;
  els.seconds.textContent = minor;
  els.countdownUnits.textContent = unit;

  els.periodName.textContent =
    state.phase === "during" ? state.current.name : NO_PERIOD_NAME[state.phase];

  paintStrip(nowSec);

  // Hovering a square borrows the caption instead of opening a tooltip: no
  // positioning code, no new tab stops, and it works on a touch tap.
  els.dayCaption.textContent = hoveredPeriod
    ? formatPeriodLabel(hoveredPeriod, store.prefs)
    : formatDayCaption(daySummaryAt(store.schedule, nowSec), blockPositionAt(store.schedule, nowSec));
}

function paintDay(nowSec) {
  const day = daySummaryAt(store.schedule, nowSec);
  const { major, minor, unit } = splitCountdown(day.remainingSec);

  // Once the last bell has rung there is nothing left to count, and "0:00"
  // reads like a stopped clock rather than a finished day.
  const counting = day.phase === "before" || day.phase === "during";
  els.dayRemaining.textContent = counting ? `${major}:${minor}` : "--:--";

  // The same ambiguity the Now view carries a caption for, and worse here:
  // this is the largest number on the screen, and "6:24 until dismissal" is
  // six hours or six minutes depending on a scale nothing else states.
  els.dayRemainingUnits.textContent = counting ? unit : "";
  els.dayRemainingUnits.hidden = !counting;

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

      // Spelled out rather than "1:20", because the rows above and below are
      // formatDuration's "55m" and "1h" - a bare colon form directly beneath
      // "1h" reads as one minute twenty.
      fields.aside.textContent = formatRemaining(period.endMin * 60 - nowSec);

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

/** Re-resolves today's schedule and repaints, after any edit that could change it. */
export function refreshResolved() {
  store.schedule = scheduleFor(new Date());

  // Everything that reaches here is an edit: a keystroke in the period editor,
  // a weekday remapped, an exception added, a schedule deleted. The period
  // under the clock may well be different afterwards, but no bell rang - so
  // the announcer takes the new value without speaking it.
  announcerNeedsResync = true;

  rebuildViews();
  tick();
}

const VIEW_KEY = "belltab:view";

const VIEWS = ["now", "day", "big"];

export let activeView = readStoredView();

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
    const stored = localStorage.getItem(VIEW_KEY);
    return VIEWS.includes(stored) ? stored : "now";
  } catch {
    return "now";
  }
}

/**
 * Big mode is NOT a third set of markup - it is the Now view with a class on
 * <body> that enlarges what matters and removes the rest. One painter, one
 * strip, nothing that can drift out of sync with the small version.
 */
export function setView(view) {
  activeView = VIEWS.includes(view) ? view : "now";

  const showDay = activeView === "day";
  const showBig = activeView === "big";

  els.focusView.hidden = showDay;
  els.dayView.hidden = !showDay;
  document.body.classList.toggle("is-big", showBig);
  els.bigExit.hidden = !showBig;

  // Scrolling a hidden element does nothing, so arriving at the Day view has
  // to count as a change even when the current period has not moved.
  if (showDay) lastScrolledTo = null;

  // aria-pressed is both the accessible state and the CSS hook - the stylesheet
  // selects on [aria-pressed="true"], so there is only one source of truth.
  els.viewNow.setAttribute("aria-pressed", String(activeView === "now"));
  els.viewDay.setAttribute("aria-pressed", String(showDay));
  els.viewBig.setAttribute("aria-pressed", String(showBig));

  try {
    localStorage.setItem(VIEW_KEY, activeView);
  } catch {
    // Not being able to remember the choice is not a reason to refuse it.
  }

  // The hidden view is not painted, so the one just revealed is a tick stale.
  tick();
}

/**
 * Fullscreen is an enhancement, never a requirement - big mode is pure CSS and
 * works identically without it. The request is denied outright in a
 * permissions-restricted iframe and the API is absent on iOS Safari for
 * anything but <video>, so every call here is feature-detected and every
 * promise is caught. A rejected fullscreen must not leave the mode half-on.
 */
function requestFullscreen() {
  const root = document.documentElement;
  if (typeof root.requestFullscreen !== "function") return;
  root.requestFullscreen().catch(() => {});
}

function exitFullscreen() {
  if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
    document.exitFullscreen().catch(() => {});
  }
}

export function enterBig() {
  setView("big");
  requestFullscreen();
  // The switcher is display:none in big mode, so the button that was focused
  // has just vanished and focus would fall back to <body>. Hand it to the one
  // control that is still there.
  els.bigExit.focus();
}

export function leaveBig() {
  exitFullscreen();
  setView("now");
  els.viewBig.focus();
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
export function tick() {
  const now = new Date();

  // A tab left open overnight - on a projector, say - has to notice that it is
  // a different day and pick up that day's schedule. Cheap to check, and the
  // alternative is a Monday showing Friday's bells.
  const dateKey = isoDateOf(now);
  if (dateKey !== store.currentDateKey) {
    store.currentDateKey = dateKey;
    store.schedule = scheduleFor(now);
    rebuildViews();
  }

  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const state = stateAt(store.schedule, nowSec);

  els.wallClock.textContent = formatClock(Math.floor(nowSec / 60), store.prefs);

  // Only the visible view is painted. The other one is behind `hidden`, so
  // writing to it would be ~50 DOM writes a second that nobody can see.
  // Big mode paints through paintFocus because it IS the Now view, restyled.
  // With settings open neither is on screen, and the header clock above plus
  // the tab title below are the only live things left.
  if (paused) {
    /* nothing to paint */
  } else if (activeView === "day") {
    paintDay(nowSec);
    revealCurrentRow();
  } else {
    paintFocus(state, nowSec);
  }

  // Outside the paused branch on purpose: the bell still rings while settings
  // is open, and that is exactly when a screen-reader user most needs telling.
  announce(state);

  // Minute resolution: the tab title only needs to change 60x less often than
  // the display, and rewriting it every second is wasted work. Derived from
  // stateAt in both views, so the title is right whichever one is showing.
  const title = formatTabTitle(state);
  if (document.title !== title) document.title = title;
}

/** The Day view's disclosure. Lives here because it owns `showPast`. */
export function togglePastPeriods() {
  showPast = !showPast;
  els.pastToggle.setAttribute("aria-expanded", String(showPast));
  tick();
}
