/**
 * Every element the app writes to, looked up once.
 *
 * One shared map rather than per-module queries: two modules touching the same
 * header clock should be reading the same reference, and getElementById
 * scattered across four files is four places to forget when an id changes.
 *
 * This is a snapshot. Anything that replaces these nodes wholesale has to
 * refresh what it holds - see rebuildViews in views.js.
 */

export const els = {
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
