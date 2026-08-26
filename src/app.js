import { DEFAULT_SCHEDULES, DEFAULT_CALENDAR, PERIOD_KINDS } from "./schedule.js";

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

/* ---------- Parsing the untrusted world ---------- */

/**
 * Caps applied before anything is parsed.
 *
 * These exist because schedules will eventually arrive from a link someone was
 * sent. A hand-crafted payload claiming fifty thousand periods must be refused
 * at the boundary, not discovered halfway through building fifty thousand DOM
 * nodes.
 */
export const SCHEDULE_LIMITS = {
  schedules: 50,
  periods: 60,
  nameChars: 60,
  overrides: 400,
};

const KIND_VALUES = Object.values(PERIOD_KINDS);
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

function daysInMonth(year, month) {
  return month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
}

/** A minute-of-day, or null. Midnight-as-end (1440) is legal; as start it is not. */
function toMinuteOfDay(value) {
  return Number.isInteger(value) && value >= 0 && value <= 1440 ? value : null;
}

/**
 * "YYYY-MM-DD" or null.
 *
 * Checks the shape AND that the date exists - 2026-02-30 matches the pattern
 * and is not a day. Done arithmetically rather than by round-tripping through
 * Date, which silently rolls 2026-02-30 forward to March 2nd instead of
 * rejecting it.
 */
export function parseIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  return value;
}

/**
 * Untrusted input in, a validated schedule or structured errors out.
 *
 * Returns `{ ok: true, value }` or `{ ok: false, errors }` - never a boolean.
 * The point is that code holding the `value` cannot be holding something
 * unvalidated, so nothing downstream re-checks ordering or overlap.
 *
 * Each error carries the index of the row it belongs to and the field within
 * it, so the editor can bind the message to that input with aria-describedby
 * rather than colouring a border red and leaving a screen reader with nothing.
 *
 * Periods come out SORTED. That is a normalisation, not a rejection - the
 * order a user typed rows in is not the order the day runs in.
 */
export function parseSchedule(input) {
  const errors = [];
  const fail = (index, field, message) => errors.push({ index, field, message });

  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: [{ index: null, field: "schedule", message: "That is not a schedule." }] };
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) fail(null, "name", "Give the schedule a name.");
  else if (name.length > SCHEDULE_LIMITS.nameChars) {
    fail(null, "name", `Keep the name under ${SCHEDULE_LIMITS.nameChars} characters.`);
  }

  if (!Array.isArray(input.periods)) {
    fail(null, "periods", "This schedule has no periods.");
    return { ok: false, errors };
  }
  if (input.periods.length > SCHEDULE_LIMITS.periods) {
    fail(null, "periods", `A schedule cannot have more than ${SCHEDULE_LIMITS.periods} periods.`);
    return { ok: false, errors };
  }

  const parsed = [];

  input.periods.forEach((raw, index) => {
    if (typeof raw !== "object" || raw === null) {
      fail(index, "period", "That is not a period.");
      return;
    }

    const periodName = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!periodName) fail(index, "name", "Give the period a name.");
    else if (periodName.length > SCHEDULE_LIMITS.nameChars) {
      fail(index, "name", `Keep the name under ${SCHEDULE_LIMITS.nameChars} characters.`);
    }

    const kind = KIND_VALUES.includes(raw.kind) ? raw.kind : null;
    if (!kind) fail(index, "kind", "Pick what this period is.");

    const startMin = toMinuteOfDay(raw.startMin);
    const endMin = toMinuteOfDay(raw.endMin);
    if (startMin === null) fail(index, "startMin", "That is not a time of day.");
    if (endMin === null) fail(index, "endMin", "That is not a length.");
    if (startMin !== null && endMin !== null && startMin >= endMin) {
      fail(index, "endMin", "A period has to end after it starts.");
    }

    if (periodName && kind && startMin !== null && endMin !== null && startMin < endMin) {
      parsed.push({ index, name: periodName, kind, startMin, endMin });
    }
  });

  // Overlap is checked on a sorted copy so the message can name the period
  // actually collided with, rather than just "invalid". Each row keeps its
  // original index so the error lands on the row the user is looking at.
  const sorted = [...parsed].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (current.startMin < previous.endMin) {
      fail(
        current.index,
        "startMin",
        `${current.name} overlaps ${previous.name}. Two periods cannot run at the same time.`,
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      id: typeof input.id === "string" && input.id ? input.id : null,
      name,
      periods: sorted.map(({ name, kind, startMin, endMin }) => ({ name, kind, startMin, endMin })),
    },
  };
}

/**
 * The calendar, validated against the schedules that actually exist.
 *
 * A weekday or override pointing at a deleted schedule is not an error worth
 * refusing the whole calendar over - it degrades to "no school", which is
 * already a state the app renders properly.
 */
export function parseCalendar(input, knownIds) {
  const known = new Set(knownIds);
  const source = typeof input === "object" && input !== null ? input : {};

  const rawWeekdays = Array.isArray(source.weekdays) ? source.weekdays : [];
  const weekdays = Array.from({ length: 7 }, (_, day) => {
    const id = rawWeekdays[day];
    return known.has(id) ? id : null;
  });

  const rawOverrides = Array.isArray(source.overrides) ? source.overrides : [];
  const seen = new Set();
  const overrides = [];

  for (const entry of rawOverrides.slice(0, SCHEDULE_LIMITS.overrides)) {
    if (typeof entry !== "object" || entry === null) continue;

    const date = parseIsoDate(entry.date);
    if (!date || seen.has(date)) continue;
    seen.add(date);

    // null is meaningful here and NOT the same as a missing entry: it is an
    // explicit closure - a snow day - which has to beat the weekday map.
    overrides.push({ date, scheduleId: known.has(entry.scheduleId) ? entry.scheduleId : null });
  }

  overrides.sort((a, b) => a.date.localeCompare(b.date));
  return { weekdays, overrides };
}

/**
 * Which schedule applies, in priority order: an explicit date override first,
 * then the weekday default, then nothing.
 *
 * `weekday` is passed IN rather than derived from the date string, so this
 * stays pure - the caller reads the clock, this function only compares.
 * Returns a schedule id, or null for no school.
 */
export function resolveScheduleId(calendar, isoDate, weekday) {
  const override = calendar.overrides.find((entry) => entry.date === isoDate);

  // Deliberately checks for the entry, not its value: an override to null is a
  // closure that must win over a weekday that says school is on.
  if (override) return override.scheduleId;

  return calendar.weekdays[weekday] ?? null;
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

/**
 * Minutes since midnight to a wall-clock label: 545 -> "9:05" or "09:05".
 *
 * The 12/24 choice is a PARAMETER, not a module-level setting read from
 * inside. A preference consulted internally would make this function's output
 * depend on hidden state, which is exactly what makes a formatter untestable.
 *
 * 24-hour pads the hour ("09:05"), 12-hour does not ("9:05") - that is the
 * convention in each, not an inconsistency.
 */
export function formatClock(totalMinutes, { hour12 = true } = {}) {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = String(totalMinutes % 60).padStart(2, "0");

  if (!hour12) return `${String(hours24).padStart(2, "0")}:${minutes}`;

  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes}`;
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
export function formatPeriodLabel(period, options) {
  return `${period.name} · ${formatClock(period.startMin, options)}–${formatClock(period.endMin, options)}`;
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
  viewBig: document.getElementById("view-big"),
  bigExit: document.getElementById("big-exit"),

  settingsToggle: document.getElementById("settings-toggle"),
  settingsView: document.getElementById("settings-view"),
  settingsTabs: {
    schedules: document.getElementById("tab-schedules"),
    calendar: document.getElementById("tab-calendar"),
    preferences: document.getElementById("tab-preferences"),
  },
  settingsPanels: {
    schedules: document.getElementById("panel-schedules"),
    calendar: document.getElementById("panel-calendar"),
    preferences: document.getElementById("panel-preferences"),
  },

  scheduleList: document.getElementById("schedule-list"),
  scheduleNew: document.getElementById("schedule-new"),
  editor: document.getElementById("editor"),
  scheduleNameInput: document.getElementById("schedule-name-input"),
  scheduleDuplicate: document.getElementById("schedule-duplicate"),
  scheduleDelete: document.getElementById("schedule-delete"),
  shiftMinutes: document.getElementById("shift-minutes"),
  shiftApply: document.getElementById("shift-apply"),
  periodEditor: document.getElementById("period-editor"),
  periodAdd: document.getElementById("period-add"),
  scheduleError: document.getElementById("schedule-error"),
  editRowTemplate: document.getElementById("period-edit-row"),

  calendarToday: document.getElementById("calendar-today"),
  weekdayMap: document.getElementById("weekday-map"),
  overrideDate: document.getElementById("override-date"),
  overrideSchedule: document.getElementById("override-schedule"),
  overrideAdd: document.getElementById("override-add"),
  overrideError: document.getElementById("override-error"),
  overrideList: document.getElementById("override-list"),
  overrideEmpty: document.getElementById("override-empty"),
};

/* ---------- Preferences ---------- */

const THEME_KEY = "belltab:theme";
const CLOCK_KEY = "belltab:clock";
const THEMES = ["system", "light", "dark"];

/**
 * Reads one stored preference, and validates it in the same breath.
 *
 * The value that comes back is always one of `allowed`, so nothing downstream
 * ever re-checks it - parse, don't validate, in miniature. The try/catch is
 * required, not defensive: localStorage throws outright when a browser is set
 * to block site data.
 */
function readStoredChoice(key, allowed, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return allowed.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredChoice(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not being able to remember a preference is not a reason to refuse it.
  }
}

const prefs = {
  theme: readStoredChoice(THEME_KEY, THEMES, "system"),
  hour12: readStoredChoice(CLOCK_KEY, ["12", "24"], "12") === "12",
};

/**
 * "system" means *remove* the attribute rather than write one, so the
 * stylesheet falls through to its prefers-color-scheme block and keeps
 * following the OS live - including when the user flips it with the tab open.
 */
function applyTheme(theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

/* ---------- The store ---------- */

const SCHEDULES_KEY = "belltab:schedules";
const CALENDAR_KEY = "belltab:calendar";

/** What a day with no schedule attached looks like. Renders as an empty state. */
const NO_SCHOOL = { id: null, name: "No school today", periods: [] };

/**
 * The seed data goes through the same parser as anything a user types.
 *
 * That is deliberate: it means a typo in schedule.js is caught by the
 * validator rather than shipping as a subtly broken default, and it keeps the
 * parser honest by making the happy path exercise it on every load.
 */
function seedSchedules() {
  const seeded = [];

  for (const raw of DEFAULT_SCHEDULES) {
    const result = parseSchedule(raw);
    if (result.ok) seeded.push({ ...result.value, id: raw.id });
    // Invalid seed data is our bug, not the user's. Loud in the console,
    // silent on screen - one bad default should not blank the app.
    else console.error(`Seed schedule "${raw.name}" is invalid:`, result.errors);
  }

  return seeded;
}

/**
 * Everything in localStorage is untrusted input, including data this app wrote
 * itself - it may have been hand-edited, half-written by a crashed tab, or
 * left behind by an older version with a different shape.
 *
 * Anything that fails to parse is dropped rather than repaired, and an empty
 * result falls back to the seed. A corrupt value degrades to a clean state.
 */
function loadSchedules() {
  try {
    const raw = localStorage.getItem(SCHEDULES_KEY);
    if (!raw) return seedSchedules();

    const stored = JSON.parse(raw);
    if (!Array.isArray(stored)) return seedSchedules();

    const loaded = [];
    for (const entry of stored.slice(0, SCHEDULE_LIMITS.schedules)) {
      const result = parseSchedule(entry);
      if (result.ok && result.value.id) loaded.push(result.value);
    }

    return loaded.length > 0 ? loaded : seedSchedules();
  } catch {
    // JSON.parse throws on garbage; localStorage throws when site data is
    // blocked. Neither is a reason to show the user a broken app.
    return seedSchedules();
  }
}

function loadCalendar(knownIds) {
  try {
    const raw = localStorage.getItem(CALENDAR_KEY);
    return parseCalendar(raw ? JSON.parse(raw) : DEFAULT_CALENDAR, knownIds);
  } catch {
    return parseCalendar(DEFAULT_CALENDAR, knownIds);
  }
}

let schedules = loadSchedules();
let calendar = loadCalendar(schedules.map((entry) => entry.id));

/** Local calendar date as "YYYY-MM-DD". Local, because a school day is local. */
function isoDateOf(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function scheduleFor(date) {
  const id = resolveScheduleId(calendar, isoDateOf(date), date.getDay());
  return schedules.find((entry) => entry.id === id) ?? NO_SCHOOL;
}

let schedule = scheduleFor(new Date());
let currentDateKey = isoDateOf(new Date());

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
function rebuildViews() {
  els.strip.replaceChildren();
  els.periodList.replaceChildren();

  // The old period objects are gone; a stale hover would caption a period that
  // no longer exists in this schedule.
  hoveredPeriod = null;

  stripCells = buildStripCells();
  periodRows = buildPeriodRows();

  els.scheduleName.textContent = schedule.name;
  paintStaticTimes();
}

/**
 * Every time on screen that is fixed by the schedule rather than by the clock.
 *
 * These would be wasted work in the per-second tick, but they are not truly
 * write-once either: switching to 24-hour has to rewrite all of them. Called
 * at startup and whenever that preference changes.
 */
function paintStaticTimes() {
  for (const { period, fields } of periodRows) {
    fields.start.textContent = formatClock(period.startMin, prefs);
  }

  if (schedule.periods.length > 0) {
    const last = schedule.periods[schedule.periods.length - 1];
    els.dayStart.textContent = formatClock(schedule.periods[0].startMin, prefs);
    els.dayEnd.textContent = formatClock(last.endMin, prefs);
  }
}

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
    ? formatPeriodLabel(hoveredPeriod, prefs)
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
const VIEWS = ["now", "day", "big"];
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
function setView(view) {
  activeView = VIEWS.includes(view) ? view : "now";

  const showDay = activeView === "day";
  const showBig = activeView === "big";

  els.focusView.hidden = showDay;
  els.dayView.hidden = !showDay;
  document.body.classList.toggle("is-big", showBig);
  els.bigExit.hidden = !showBig;

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

/* ---------- Fullscreen (best effort) ---------- */

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

function enterBig() {
  setView("big");
  requestFullscreen();
  // The switcher is display:none in big mode, so the button that was focused
  // has just vanished and focus would fall back to <body>. Hand it to the one
  // control that is still there.
  els.bigExit.focus();
}

function leaveBig() {
  exitFullscreen();
  setView("now");
  els.viewBig.focus();
}

/* ---------- Settings ---------- */

const SETTINGS_PANELS = ["schedules", "calendar", "preferences"];

/**
 * The header button is one control with two jobs: open settings, then go back.
 *
 * The glyph and the accessible name change together - a back arrow that still
 * announces itself as "Settings" is exactly the mismatch that makes an
 * icon-only button hostile to anyone not looking at it. `aria-expanded` stays
 * on top of both, because the settings region genuinely is a disclosure.
 *
 * Both glyphs are stand-ins for real inline SVG, as noted in the build log.
 */
const TOGGLE_STATES = {
  closed: { glyph: "⚙", label: "Settings" },
  open: { glyph: "←", label: "Back" },
};

let settingsOpen = false;

function setSettingsPanel(panel) {
  const active = SETTINGS_PANELS.includes(panel) ? panel : "preferences";

  for (const name of SETTINGS_PANELS) {
    els.settingsTabs[name].setAttribute("aria-pressed", String(name === active));
    els.settingsPanels[name].hidden = name !== active;
  }

  // Rebuilt on entry rather than on every schedule edit: the selects list
  // schedule names, so a rename in the Schedules panel has to show up here -
  // but re-rendering them per keystroke would blow away an open dropdown.
  if (active === "calendar") renderCalendar();
}

function setSettingsOpen(open) {
  settingsOpen = open;

  document.body.classList.toggle("is-settings", open);
  els.settingsView.hidden = !open;

  const toggle = open ? TOGGLE_STATES.open : TOGGLE_STATES.closed;
  els.settingsToggle.textContent = toggle.glyph;
  els.settingsToggle.setAttribute("aria-label", toggle.label);
  els.settingsToggle.setAttribute("aria-expanded", String(open));

  if (open) {
    // Both live views stand down; setView restores whichever was showing.
    els.focusView.hidden = true;
    els.dayView.hidden = true;
    tick();
  } else {
    setView(activeView);
  }
}

/**
 * Points the radios at the stored preferences and keeps them pointed there.
 *
 * The `change` event, not `click`: change fires for keyboard selection and
 * programmatic setting too, and a radio group is meant to be driven with the
 * arrow keys.
 */
function initPreferences() {
  for (const input of document.querySelectorAll('input[name="theme"]')) {
    input.checked = input.value === prefs.theme;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      prefs.theme = input.value;
      applyTheme(prefs.theme);
      writeStoredChoice(THEME_KEY, prefs.theme);
    });
  }

  for (const input of document.querySelectorAll('input[name="clock"]')) {
    const isTwelve = input.value === "12";
    input.checked = isTwelve === prefs.hour12;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      prefs.hour12 = isTwelve;
      writeStoredChoice(CLOCK_KEY, input.value);
      // Fixed times do not repaint on their own; the ticking ones need the
      // new format immediately rather than up to a second later.
      paintStaticTimes();
      tick();
    });
  }
}

/* ---------- The schedule editor ---------- */

/**
 * The editor works on a DRAFT, not on the live schedule.
 *
 * A draft period holds `lengthMin` where a real one holds `endMin`, because
 * that is what the form asks for and what a bell schedule is actually written
 * as ("Period 2, 9:05, 60 minutes"). Keeping the two independent means an
 * unparseable start time does not also destroy the length the user typed.
 */
let editingId = null;
let draft = null;
let draftRows = [];

const scheduleToDraft = (entry) => ({
  id: entry.id,
  name: entry.name,
  periods: entry.periods.map((period) => ({
    name: period.name,
    kind: period.kind,
    startMin: period.startMin,
    lengthMin: period.endMin - period.startMin,
  })),
});

const draftToSchedule = (working) => ({
  id: working.id,
  name: working.name,
  periods: working.periods.map((period) => ({
    name: period.name,
    kind: period.kind,
    startMin: period.startMin,
    endMin:
      Number.isInteger(period.startMin) && Number.isInteger(period.lengthMin)
        ? period.startMin + period.lengthMin
        : null,
  })),
});

/** Minutes to the "HH:MM" 24-hour string <input type="time"> requires. */
function minutesToTimeValue(minutes) {
  if (!Number.isInteger(minutes)) return "";
  const hours = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
  return `${hours}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * The reverse. Note this is NOT the same as formatClock: the time input always
 * speaks 24-hour "HH:MM" regardless of what it shows the user, so the 12/24
 * preference has no business here.
 */
function timeValueToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function uniqueScheduleId(name) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "schedule";

  let candidate = base;
  let suffix = 2;
  while (schedules.some((entry) => entry.id === candidate)) candidate = `${base}-${suffix++}`;
  return candidate;
}

function saveSchedules() {
  try {
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules));
  } catch {
    // Out of quota or site data blocked. The edit still applies for this
    // session; refusing it would be worse than forgetting it.
  }
}

function saveCalendar() {
  try {
    localStorage.setItem(CALENDAR_KEY, JSON.stringify(calendar));
  } catch {
    /* see saveSchedules */
  }
}

/** Re-resolves today's schedule and repaints, after any edit that could change it. */
function refreshResolved() {
  schedule = scheduleFor(new Date());
  rebuildViews();
  tick();
}

/* --- Rendering --- */

function renderScheduleChips() {
  els.scheduleList.replaceChildren();

  for (const entry of schedules) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "schedchip";
    // textContent, not innerHTML: a schedule name is user input and will one
    // day arrive from a shared link.
    chip.textContent = entry.name;
    chip.setAttribute("aria-pressed", String(entry.id === editingId));
    chip.addEventListener("click", () => selectSchedule(entry.id));
    els.scheduleList.append(chip);
  }
}

/**
 * Names every control in a row with its position.
 *
 * "Name" on its own is useless to someone tabbing through sixty inputs. The
 * visible column headers cannot do this job - a header in a sibling element is
 * not programmatically tied to a control inside a list item.
 */
function labelRow(row, index) {
  const position = index + 1;
  row.labels.name.textContent = `Name of period ${position}`;
  row.labels.kind.textContent = `Kind of period ${position}`;
  row.labels.start.textContent = `Start time of period ${position}`;
  row.labels.length.textContent = `Length of period ${position} in minutes`;
  row.labels.delete.textContent = `Delete period ${position}`;
  row.error.id = `period-error-${index}`;
}

function buildEditRow(period, index) {
  const element = els.editRowTemplate.content.firstElementChild.cloneNode(true);

  const row = {
    element,
    name: element.querySelector('[data-field="name"]'),
    kind: element.querySelector('[data-field="kind"]'),
    start: element.querySelector('[data-field="start"]'),
    length: element.querySelector('[data-field="length"]'),
    remove: element.querySelector('[data-field="delete"]'),
    error: element.querySelector('[data-field="error"]'),
    labels: {
      name: element.querySelector('[data-field="label-name"]'),
      kind: element.querySelector('[data-field="label-kind"]'),
      start: element.querySelector('[data-field="label-start"]'),
      length: element.querySelector('[data-field="label-length"]'),
      delete: element.querySelector('[data-field="label-delete"]'),
    },
  };

  row.name.value = period.name;
  row.kind.value = period.kind;
  row.start.value = minutesToTimeValue(period.startMin);
  row.length.value = Number.isInteger(period.lengthMin) ? String(period.lengthMin) : "";
  labelRow(row, index);

  // `input` rather than `change` so validation follows typing rather than
  // waiting for the field to be left. Nothing is committed unless it parses,
  // so an in-progress value is never persisted.
  row.name.addEventListener("input", () => {
    period.name = row.name.value;
    validateDraft();
  });

  row.kind.addEventListener("change", () => {
    period.kind = row.kind.value;
    validateDraft();
  });

  row.start.addEventListener("input", () => {
    period.startMin = timeValueToMinutes(row.start.value);
    validateDraft();
  });

  row.length.addEventListener("input", () => {
    const parsed = Number(row.length.value);
    period.lengthMin = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    validateDraft();
  });

  row.remove.addEventListener("click", () => removePeriod(index));

  els.periodEditor.append(element);
  return row;
}

function renderEditorRows() {
  els.periodEditor.replaceChildren();
  draftRows = draft.periods.map((period, index) => buildEditRow(period, index));
  validateDraft();
}

function renderEditor() {
  const hasDraft = draft !== null;
  els.editor.hidden = !hasDraft;
  if (!hasDraft) return;

  els.scheduleNameInput.value = draft.name;
  renderEditorRows();
}

function selectSchedule(id) {
  const found = schedules.find((entry) => entry.id === id) ?? schedules[0] ?? null;
  editingId = found ? found.id : null;
  draft = found ? scheduleToDraft(found) : null;

  renderScheduleChips();
  renderEditor();
}

/* --- Validation display --- */

function clearErrors() {
  els.scheduleError.hidden = true;
  els.scheduleError.textContent = "";
  els.scheduleNameInput.removeAttribute("aria-invalid");

  for (const row of draftRows) {
    row.error.hidden = true;
    row.error.textContent = "";
    for (const input of [row.name, row.kind, row.start, row.length]) {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
  }
}

/**
 * Paints the parser's structured errors onto the form.
 *
 * Every invalid field gets BOTH `aria-invalid` and an `aria-describedby`
 * pointing at the message. A red border alone is invisible to a screen reader
 * and ambiguous to anyone who cannot separate red from grey - the design
 * system is explicit that an error is a message, not a colour.
 */
function showErrors(errors) {
  clearErrors();

  const scheduleLevel = [];

  for (const error of errors) {
    if (error.index === null) {
      scheduleLevel.push(error.message);
      if (error.field === "name") els.scheduleNameInput.setAttribute("aria-invalid", "true");
      continue;
    }

    const row = draftRows[error.index];
    if (!row) {
      scheduleLevel.push(error.message);
      continue;
    }

    row.error.textContent = row.error.textContent
      ? `${row.error.textContent} ${error.message}`
      : error.message;
    row.error.hidden = false;

    const target = { name: row.name, kind: row.kind, startMin: row.start, endMin: row.length }[
      error.field
    ];
    if (target) {
      target.setAttribute("aria-invalid", "true");
      target.setAttribute("aria-describedby", row.error.id);
    }
  }

  if (scheduleLevel.length > 0) {
    els.scheduleError.textContent = scheduleLevel.join(" ");
    els.scheduleError.hidden = false;
  }
}

/**
 * Validates the draft and commits it if it parses.
 *
 * An invalid draft stays on screen and is simply not saved - the user keeps
 * what they typed, and localStorage never holds a schedule that would fail to
 * load. This is the whole point of the draft being separate from the store.
 */
function validateDraft() {
  if (!draft) return false;

  const result = parseSchedule(draftToSchedule(draft));
  showErrors(result.ok ? [] : result.errors);
  if (!result.ok) return false;

  const value = { ...result.value, id: draft.id };
  const index = schedules.findIndex((entry) => entry.id === value.id);
  if (index === -1) schedules.push(value);
  else schedules[index] = value;

  saveSchedules();
  renderScheduleChips();
  refreshResolved();
  return true;
}

/* --- Editing actions --- */

function addPeriod() {
  const last = draft.periods[draft.periods.length - 1];
  const startMin =
    last && Number.isInteger(last.startMin) && Number.isInteger(last.lengthMin)
      ? Math.min(last.startMin + last.lengthMin, 1439)
      : 8 * 60;

  draft.periods.push({ name: "New period", kind: PERIOD_KINDS.CLASS, startMin, lengthMin: 45 });
  renderEditorRows();

  // A new row that appears without focus makes the user hunt for it.
  const added = draftRows[draftRows.length - 1];
  added.name.focus();
  added.name.select();
}

function removePeriod(index) {
  draft.periods.splice(index, 1);
  renderEditorRows();

  // Focus would otherwise fall to <body> because the button that was focused
  // no longer exists. Land on the row that took its place, or the add button.
  const next = draftRows[index] ?? draftRows[draftRows.length - 1];
  if (next) next.name.focus();
  else els.periodAdd.focus();
}

function shiftAll() {
  const delta = Number(els.shiftMinutes.value);
  if (!Number.isFinite(delta) || delta === 0) return;

  const starts = draft.periods.map((period) => period.startMin).filter(Number.isInteger);
  if (starts.length === 0) return;

  const ends = draft.periods
    .filter((period) => Number.isInteger(period.startMin) && Number.isInteger(period.lengthMin))
    .map((period) => period.startMin + period.lengthMin);

  // Refuse the whole shift rather than clamping. Clamping would silently
  // collapse the periods at the edge into each other and call it an overlap.
  if (Math.min(...starts) + delta < 0 || Math.max(...ends, 0) + delta > 1440) {
    els.scheduleError.textContent = "That shift would push the day past midnight.";
    els.scheduleError.hidden = false;
    return;
  }

  for (const period of draft.periods) {
    if (Number.isInteger(period.startMin)) period.startMin += delta;
  }

  renderEditorRows();
}

function duplicateSchedule() {
  if (!draft) return;

  const result = parseSchedule(draftToSchedule(draft));
  if (!result.ok) {
    els.scheduleError.textContent = "Fix the errors below before duplicating.";
    els.scheduleError.hidden = false;
    return;
  }

  const name = `${draft.name} copy`.slice(0, SCHEDULE_LIMITS.nameChars);
  const id = uniqueScheduleId(name);

  schedules.push({ ...result.value, id, name });
  saveSchedules();
  selectSchedule(id);
  els.scheduleNameInput.focus();
  els.scheduleNameInput.select();
}

function newSchedule() {
  const name = "New schedule";
  const id = uniqueScheduleId(name);

  schedules.push({
    id,
    name,
    periods: [{ name: "Period 1", kind: PERIOD_KINDS.CLASS, startMin: 8 * 60, endMin: 8 * 60 + 45 }],
  });

  saveSchedules();
  selectSchedule(id);
  els.scheduleNameInput.focus();
  els.scheduleNameInput.select();
}

function deleteSchedule() {
  if (!draft) return;
  // A native confirm is blunt but honest, and it is keyboard- and
  // screen-reader-accessible for free. A custom dialog is a focus-trap problem
  // for another day - noted in the build log.
  if (!window.confirm(`Delete "${draft.name}"? This cannot be undone.`)) return;

  schedules = schedules.filter((entry) => entry.id !== draft.id);
  saveSchedules();

  // Any weekday or override pointing at the deleted schedule has to stop
  // pointing at it. Re-parsing against the surviving ids does exactly that,
  // turning dangling references into "no school".
  calendar = parseCalendar(calendar, schedules.map((entry) => entry.id));
  saveCalendar();

  selectSchedule(schedules[0]?.id ?? null);
  refreshResolved();
}

/* ---------- The calendar ---------- */

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NO_SCHOOL_LABEL = "No school";

/**
 * Fills a <select> with one option per schedule, plus "No school".
 *
 * The empty-string value is the wire form of `null` - a <select> value is
 * always a string, so the null has to be encoded and decoded rather than
 * stored directly.
 */
function fillScheduleOptions(select, selectedId) {
  select.replaceChildren();

  const none = document.createElement("option");
  none.value = "";
  none.textContent = NO_SCHOOL_LABEL;
  select.append(none);

  for (const entry of schedules) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.name;
    select.append(option);
  }

  select.value = selectedId ?? "";
}

function renderWeekdayMap() {
  els.weekdayMap.replaceChildren();

  WEEKDAY_NAMES.forEach((dayName, day) => {
    const wrapper = document.createElement("label");
    wrapper.className = "weekday";

    const caption = document.createElement("span");
    caption.className = "weekday__name";
    caption.textContent = dayName;

    const select = document.createElement("select");
    fillScheduleOptions(select, calendar.weekdays[day]);

    if (calendar.weekdays[day] === null) wrapper.classList.add("weekday--closed");

    select.addEventListener("change", () => {
      calendar.weekdays[day] = select.value || null;
      saveCalendar();
      wrapper.classList.toggle("weekday--closed", calendar.weekdays[day] === null);
      refreshResolved();
      renderCalendarToday();
    });

    // The label wraps the select, so they are associated with no id involved -
    // which matters because these are generated seven times.
    wrapper.append(caption, select);
    els.weekdayMap.append(wrapper);
  });
}

function renderOverrides() {
  els.overrideList.replaceChildren();
  els.overrideEmpty.hidden = calendar.overrides.length > 0;

  for (const entry of calendar.overrides) {
    const item = document.createElement("li");
    item.className = "override";

    const date = document.createElement("span");
    date.className = "override__date";
    date.textContent = entry.date;

    const name = document.createElement("span");
    name.className = "override__schedule";
    const found = schedules.find((candidate) => candidate.id === entry.scheduleId);
    name.textContent = found ? found.name : NO_SCHOOL_LABEL;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "override__remove";
    remove.textContent = "Remove";
    // Icon-free and explicitly named: "Remove" alone, repeated down a list, is
    // the classic screen-reader dead end.
    remove.setAttribute("aria-label", `Remove exception on ${entry.date}`);
    remove.addEventListener("click", () => {
      calendar.overrides = calendar.overrides.filter((other) => other.date !== entry.date);
      saveCalendar();
      renderOverrides();
      refreshResolved();
      renderCalendarToday();
    });

    item.append(date, name, remove);
    els.overrideList.append(item);
  }
}

function renderCalendarToday() {
  const now = new Date();
  const today = isoDateOf(now);
  const resolved = scheduleFor(now);

  els.calendarToday.textContent =
    resolved.periods.length > 0
      ? `Today is ${WEEKDAY_NAMES[now.getDay()]}, ${today} — running ${resolved.name}.`
      : `Today is ${WEEKDAY_NAMES[now.getDay()]}, ${today} — no school.`;
}

function addOverride() {
  els.overrideError.hidden = true;

  const date = parseIsoDate(els.overrideDate.value);
  if (!date) {
    els.overrideError.textContent = "Pick a date first.";
    els.overrideError.hidden = false;
    els.overrideDate.focus();
    return;
  }

  if (calendar.overrides.length >= SCHEDULE_LIMITS.overrides) {
    els.overrideError.textContent = `You can have at most ${SCHEDULE_LIMITS.overrides} exceptions.`;
    els.overrideError.hidden = false;
    return;
  }

  // Adding a date that already has an exception replaces it rather than
  // creating a duplicate the resolver would have to arbitrate between.
  calendar.overrides = calendar.overrides.filter((entry) => entry.date !== date);
  calendar.overrides.push({ date, scheduleId: els.overrideSchedule.value || null });
  calendar.overrides.sort((a, b) => a.date.localeCompare(b.date));

  saveCalendar();
  renderOverrides();
  refreshResolved();
  renderCalendarToday();

  els.overrideDate.value = "";
}

function renderCalendar() {
  renderWeekdayMap();
  fillScheduleOptions(els.overrideSchedule, schedules[0]?.id ?? null);
  renderOverrides();
  renderCalendarToday();
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

  // A tab left open overnight - on a projector, say - has to notice that it is
  // a different day and pick up that day's schedule. Cheap to check, and the
  // alternative is a Monday showing Friday's bells.
  const dateKey = isoDateOf(now);
  if (dateKey !== currentDateKey) {
    currentDateKey = dateKey;
    schedule = scheduleFor(now);
    rebuildViews();
  }

  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const state = stateAt(schedule, nowSec);

  els.wallClock.textContent = formatClock(Math.floor(nowSec / 60), prefs);

  // Only the visible view is painted. The other one is behind `hidden`, so
  // writing to it would be ~50 DOM writes a second that nobody can see.
  // Big mode paints through paintFocus because it IS the Now view, restyled.
  // With settings open neither is on screen, and the header clock above plus
  // the tab title below are the only live things left.
  if (settingsOpen) {
    /* nothing to paint */
  } else if (activeView === "day") {
    paintDay(nowSec);
  } else {
    paintFocus(state, nowSec);
  }

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
// The inline script in <head> already set light/dark before first paint. This
// runs anyway so "system" clears any attribute left over from a previous
// choice, and so there is one function that owns the rule.
applyTheme(prefs.theme);
rebuildViews();
initPreferences();
setSettingsPanel("preferences");

els.settingsToggle.addEventListener("click", () => setSettingsOpen(!settingsOpen));

for (const name of SETTINGS_PANELS) {
  els.settingsTabs[name].addEventListener("click", () => setSettingsPanel(name));
}

els.scheduleNameInput.addEventListener("input", () => {
  draft.name = els.scheduleNameInput.value;
  validateDraft();
});

els.periodAdd.addEventListener("click", addPeriod);
els.shiftApply.addEventListener("click", shiftAll);
els.scheduleDuplicate.addEventListener("click", duplicateSchedule);
els.scheduleDelete.addEventListener("click", deleteSchedule);
els.scheduleNew.addEventListener("click", newSchedule);
els.overrideAdd.addEventListener("click", addOverride);

selectSchedule(schedule.id ?? schedules[0]?.id ?? null);

els.viewNow.addEventListener("click", () => setView("now"));
els.viewDay.addEventListener("click", () => setView("day"));
els.viewBig.addEventListener("click", enterBig);
els.bigExit.addEventListener("click", leaveBig);

// Escape is the expected way out of any full-screen-ish mode. Needed even
// though the browser's own Escape exits fullscreen, because a denied or
// unsupported fullscreen leaves big mode running as plain CSS with no
// browser-level exit of its own.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (settingsOpen) {
    setSettingsOpen(false);
    els.settingsToggle.focus();
  } else if (activeView === "big") {
    leaveBig();
  }
});

// Leaving fullscreen by any other route - F11, the browser's own Escape, the
// OS - must drop big mode too, or the page is left stretched with no fullscreen
// and no obvious explanation.
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && activeView === "big") {
    setView("now");
    els.viewBig.focus();
  }
});

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
