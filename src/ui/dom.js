/**
 * Every element the app writes to, looked up once.
 *
 * One shared map rather than per-module queries: two modules touching the same
 * header clock should be reading the same reference, and getElementById
 * scattered across four files is four places to forget when an id changes.
 *
 * This is a snapshot, which is only safe because of one invariant the whole
 * codebase keeps: **nothing here is ever replaced, only its children are.**
 * Every rebuild in the app goes through `replaceChildren()` on a container
 * listed below, so these references stay live forever.
 *
 * Break that - a `replaceWith`, a `remove()`, an `innerHTML` on one of these -
 * and the reference silently points at a detached node. Paints then go
 * nowhere, with no error: the worst kind of failure for a clock. If you ever
 * need to replace one of these elements, re-query it here rather than
 * assuming.
 */

export const els = {
  scheduleName: document.getElementById("schedule-name"),
  wallClock: document.getElementById("wall-clock"),

  focusView: document.getElementById("focus-view"),
  periodName: document.getElementById("period-name"),
  minutes: document.getElementById("countdown-minutes"),
  seconds: document.getElementById("countdown-seconds"),
  countdownUnits: document.getElementById("countdown-units"),
  announcer: document.getElementById("period-announcer"),
  strip: document.getElementById("strip"),
  stripTemplate: document.getElementById("strip-cell"),
  dayStart: document.getElementById("day-start"),
  dayEnd: document.getElementById("day-end"),
  dayCaption: document.getElementById("day-caption"),

  dayView: document.getElementById("day-view"),
  dayRemaining: document.getElementById("day-remaining"),
  dayRemainingUnits: document.getElementById("day-remaining-units"),
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
  iconGear: document.getElementById("icon-gear"),
  iconBack: document.getElementById("icon-back"),
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
  confirmDialog: document.getElementById("confirm-dialog"),
  confirmBody: document.getElementById("confirm-body"),
  confirmOk: document.getElementById("confirm-ok"),

  calendarToday: document.getElementById("calendar-today"),
  weekdayMap: document.getElementById("weekday-map"),
  overrideDate: document.getElementById("override-date"),
  overrideSchedule: document.getElementById("override-schedule"),
  overrideAdd: document.getElementById("override-add"),
  overrideError: document.getElementById("override-error"),
  overrideList: document.getElementById("override-list"),
  overrideEmpty: document.getElementById("override-empty"),
};
