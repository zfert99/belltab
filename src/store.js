import { DEFAULT_SCHEDULES, DEFAULT_CALENDAR } from "./lib/schedule.js";
import { parseSchedule, parseCalendar, resolveScheduleId, SCHEDULE_LIMITS } from "./lib/parse.js";

/**
 * All mutable application state, and everything that persists it.
 *
 * State lives on one exported OBJECT rather than as exported `let` bindings.
 * That is not a style choice: an ES module import is a read-only live binding,
 * so `import { schedules }` gives a view that other modules can read but
 * cannot assign to. Since the editor genuinely replaces these values, they
 * have to be fields on something. One object beats four setter functions.
 *
 * Everything read back out of localStorage is untrusted input - including data
 * this app wrote itself, which may have been hand-edited, half-written by a
 * crashed tab, or left by an older version with a different shape. It all goes
 * back through parse.js.
 */

const THEME_KEY = "belltab:theme";
const CLOCK_KEY = "belltab:clock";
const SCHEDULES_KEY = "belltab:schedules";
const CALENDAR_KEY = "belltab:calendar";
const THEMES = ["system", "light", "dark"];

export { THEME_KEY, CLOCK_KEY };

/** What a day with no schedule attached looks like. Renders as an empty state. */
const NO_SCHOOL = { id: null, name: "No school today", periods: [] };

/**
 * Reads one stored preference and validates it in the same breath.
 *
 * The value that comes back is always one of `allowed`, so nothing downstream
 * re-checks it - parse, don't validate, in miniature. The try/catch is
 * required rather than defensive: localStorage throws outright when a browser
 * is set to block site data.
 */
function readStoredChoice(key, allowed, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return allowed.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredChoice(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not being able to remember a preference is not a reason to refuse it.
  }
}

/**
 * The seed data goes through the same parser as anything a user types.
 *
 * That is deliberate: a typo in schedule.js is caught by the validator rather
 * than shipping as a subtly broken default, and it keeps the parser honest by
 * making the happy path exercise it on every load.
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

/** Local calendar date as "YYYY-MM-DD". Local, because a school day is local. */
export function isoDateOf(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const loadedSchedules = loadSchedules();

export const store = {
  prefs: {
    theme: readStoredChoice(THEME_KEY, THEMES, "system"),
    hour12: readStoredChoice(CLOCK_KEY, ["12", "24"], "12") === "12",
  },
  schedules: loadedSchedules,
  calendar: loadCalendar(loadedSchedules.map((entry) => entry.id)),
  schedule: NO_SCHOOL,
  currentDateKey: null,
};

/** Which schedule applies on a given date, or the empty-state schedule. */
export function scheduleFor(date) {
  const id = resolveScheduleId(store.calendar, isoDateOf(date), date.getDay());
  return store.schedules.find((entry) => entry.id === id) ?? NO_SCHOOL;
}

store.schedule = scheduleFor(new Date());
store.currentDateKey = isoDateOf(new Date());

export function saveSchedules() {
  try {
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(store.schedules));
  } catch {
    // Out of quota or site data blocked. The edit still applies for this
    // session; refusing it would be worse than forgetting it.
  }
}

export function saveCalendar() {
  try {
    localStorage.setItem(CALENDAR_KEY, JSON.stringify(store.calendar));
  } catch {
    /* see saveSchedules */
  }
}

/**
 * "system" means *remove* the attribute rather than write one, so the
 * stylesheet falls through to its prefers-color-scheme block and keeps
 * following the OS live - including when the user flips it with the tab open.
 */
export function applyTheme(theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}
