import { parseSchedule, parseCalendar, parseIsoDate, SCHEDULE_LIMITS } from "../lib/parse.js";
import { PERIOD_KINDS } from "../lib/schedule.js";
import { els } from "./dom.js";
import {
  store,
  scheduleFor,
  isoDateOf,
  applyTheme,
  writeStoredChoice,
  saveSchedules,
  saveCalendar,
  THEME_KEY,
  CLOCK_KEY,
} from "../store.js";
import {
  refreshResolved,
  paintStaticTimes,
  tick,
  setView,
  activeView,
  setViewsPaused,
} from "./views.js";

/**
 * The settings screens: the schedule editor, the calendar, and the preference
 * radios - plus the settings mode itself, because opening settings is what
 * puts these panels on screen.
 *
 * All of this is presentation over parse.js. Nothing here decides whether a
 * schedule is valid; it asks, and paints the answer.
 */

export const SETTINGS_PANELS = ["schedules", "calendar", "preferences"];

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
  closed: { label: "Settings", showBack: false },
  open: { label: "Back", showBack: true },
};

export let settingsOpen = false;

export function setSettingsPanel(panel) {
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

export function setSettingsOpen(open) {
  settingsOpen = open;

  // views.js owns the painting and cannot see this module's state, so it keeps
  // its own "is anything of mine on screen" flag and we drive it from here.
  // Reaching the other way would make these two modules import each other.
  setViewsPaused(open);

  document.body.classList.toggle("is-settings", open);
  els.settingsView.hidden = !open;

  // Both icons live in the markup; only their visibility changes. Swapping
  // innerHTML would work too, but innerHTML is banned in this codebase and an
  // exception "just for an icon" is how that rule stops being a rule.
  //
  // toggleAttribute, NOT `.hidden = `. The hidden IDL property is defined on
  // HTMLElement and these are SVGElements, so assigning to it sets a useless
  // expando and no attribute - the icons would simply never swap. The CSS
  // `[hidden]` rule matches the attribute, so this works for both.
  const toggle = open ? TOGGLE_STATES.open : TOGGLE_STATES.closed;
  els.iconGear.toggleAttribute("hidden", toggle.showBack);
  els.iconBack.toggleAttribute("hidden", !toggle.showBack);
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
export function initPreferences() {
  for (const input of document.querySelectorAll('input[name="theme"]')) {
    input.checked = input.value === store.prefs.theme;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      store.prefs.theme = input.value;
      applyTheme(store.prefs.theme);
      writeStoredChoice(THEME_KEY, store.prefs.theme);
    });
  }

  for (const input of document.querySelectorAll('input[name="clock"]')) {
    const isTwelve = input.value === "12";
    input.checked = isTwelve === store.prefs.hour12;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      store.prefs.hour12 = isTwelve;
      writeStoredChoice(CLOCK_KEY, input.value);
      // Fixed times do not repaint on their own; the ticking ones need the
      // new format immediately rather than up to a second later.
      paintStaticTimes();
      tick();
    });
  }
}

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
  while (store.schedules.some((entry) => entry.id === candidate)) candidate = `${base}-${suffix++}`;
  return candidate;
}

function renderScheduleChips() {
  els.scheduleList.replaceChildren();

  for (const entry of store.schedules) {
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

export function selectSchedule(id) {
  const found = store.schedules.find((entry) => entry.id === id) ?? store.schedules[0] ?? null;
  editingId = found ? found.id : null;
  draft = found ? scheduleToDraft(found) : null;

  renderScheduleChips();
  renderEditor();
}

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
  const index = store.schedules.findIndex((entry) => entry.id === value.id);
  if (index === -1) store.schedules.push(value);
  else store.schedules[index] = value;

  saveSchedules();
  renderScheduleChips();
  refreshResolved();
  return true;
}

export function addPeriod() {
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

export function shiftAll() {
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

export function duplicateSchedule() {
  if (!draft) return;

  const result = parseSchedule(draftToSchedule(draft));
  if (!result.ok) {
    els.scheduleError.textContent = "Fix the errors below before duplicating.";
    els.scheduleError.hidden = false;
    return;
  }

  const name = `${draft.name} copy`.slice(0, SCHEDULE_LIMITS.nameChars);
  const id = uniqueScheduleId(name);

  store.schedules.push({ ...result.value, id, name });
  saveSchedules();
  selectSchedule(id);
  els.scheduleNameInput.focus();
  els.scheduleNameInput.select();
}

export function newSchedule() {
  const name = "New schedule";
  const id = uniqueScheduleId(name);

  store.schedules.push({
    id,
    name,
    periods: [{ name: "Period 1", kind: PERIOD_KINDS.CLASS, startMin: 8 * 60, endMin: 8 * 60 + 45 }],
  });

  saveSchedules();
  selectSchedule(id);
  els.scheduleNameInput.focus();
  els.scheduleNameInput.select();
}

/**
 * Asks before destroying something, using a real <dialog>.
 *
 * showModal() supplies focus trapping, Escape-to-close, an inert background,
 * and dialog semantics - every part a hand-rolled overlay gets wrong. Where it
 * is unsupported (or in a jsdom test), the fall-through returns true rather
 * than silently refusing the delete the user asked for.
 */
function confirmDelete(name, onConfirm) {
  const dialog = els.confirmDialog;
  els.confirmBody.textContent = `"${name}" will be removed, along with any days that use it. This cannot be undone.`;

  if (typeof dialog.showModal !== "function") {
    onConfirm();
    return;
  }

  const handleClose = () => {
    dialog.removeEventListener("close", handleClose);
    if (dialog.returnValue === "confirm") onConfirm();
  };

  dialog.addEventListener("close", handleClose);
  dialog.returnValue = "cancel";
  dialog.showModal();

  // Cancel takes focus, not Delete. The dangerous button should never be the
  // one a stray Enter lands on.
  dialog.querySelector('button[value="cancel"]')?.focus();
}

export function deleteSchedule() {
  if (!draft) return;
  confirmDelete(draft.name, applyDelete);
}

function applyDelete() {
  store.schedules = store.schedules.filter((entry) => entry.id !== draft.id);
  saveSchedules();

  // Any weekday or override pointing at the deleted schedule has to stop
  // pointing at it. Re-parsing against the surviving ids does exactly that,
  // turning dangling references into "no school".
  store.calendar = parseCalendar(store.calendar, store.schedules.map((entry) => entry.id));
  saveCalendar();

  selectSchedule(store.schedules[0]?.id ?? null);
  refreshResolved();
}

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

  for (const entry of store.schedules) {
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
    fillScheduleOptions(select, store.calendar.weekdays[day]);

    if (store.calendar.weekdays[day] === null) wrapper.classList.add("weekday--closed");

    select.addEventListener("change", () => {
      store.calendar.weekdays[day] = select.value || null;
      saveCalendar();
      wrapper.classList.toggle("weekday--closed", store.calendar.weekdays[day] === null);
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
  els.overrideEmpty.hidden = store.calendar.overrides.length > 0;

  for (const entry of store.calendar.overrides) {
    const item = document.createElement("li");
    item.className = "override";

    const date = document.createElement("span");
    date.className = "override__date";
    date.textContent = entry.date;

    const name = document.createElement("span");
    name.className = "override__schedule";
    const found = store.schedules.find((candidate) => candidate.id === entry.scheduleId);
    name.textContent = found ? found.name : NO_SCHOOL_LABEL;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "override__remove";
    remove.textContent = "Remove";
    // Icon-free and explicitly named: "Remove" alone, repeated down a list, is
    // the classic screen-reader dead end.
    remove.setAttribute("aria-label", `Remove exception on ${entry.date}`);
    remove.addEventListener("click", () => {
      store.calendar.overrides = store.calendar.overrides.filter((other) => other.date !== entry.date);
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

export function addOverride() {
  els.overrideError.hidden = true;

  const date = parseIsoDate(els.overrideDate.value);
  if (!date) {
    els.overrideError.textContent = "Pick a date first.";
    els.overrideError.hidden = false;
    els.overrideDate.focus();
    return;
  }

  if (store.calendar.overrides.length >= SCHEDULE_LIMITS.overrides) {
    els.overrideError.textContent = `You can have at most ${SCHEDULE_LIMITS.overrides} exceptions.`;
    els.overrideError.hidden = false;
    return;
  }

  // Adding a date that already has an exception replaces it rather than
  // creating a duplicate the resolver would have to arbitrate between.
  store.calendar.overrides = store.calendar.overrides.filter((entry) => entry.date !== date);
  store.calendar.overrides.push({ date, scheduleId: els.overrideSchedule.value || null });
  store.calendar.overrides.sort((a, b) => a.date.localeCompare(b.date));

  saveCalendar();
  renderOverrides();
  refreshResolved();
  renderCalendarToday();

  els.overrideDate.value = "";
}

export function renderCalendar() {
  renderWeekdayMap();
  fillScheduleOptions(els.overrideSchedule, store.schedules[0]?.id ?? null);
  renderOverrides();
  renderCalendarToday();
}

/** Wired from app.js so the name field does not have to reach into the draft. */
export function setDraftName(value) {
  if (!draft) return;
  draft.name = value;
  validateDraft();
}
