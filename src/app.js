import { els } from "./ui/dom.js";
import { store, applyTheme } from "./store.js";
import {
  tick,
  rebuildViews,
  setView,
  enterBig,
  leaveBig,
  activeView,
  togglePastPeriods,
} from "./ui/views.js";
import {
  SETTINGS_PANELS,
  settingsOpen,
  setSettingsOpen,
  setSettingsPanel,
  initPreferences,
  selectSchedule,
  setDraftName,
  addPeriod,
  shiftAll,
  duplicateSchedule,
  deleteSchedule,
  newSchedule,
  addOverride,
} from "./ui/editor.js";

/**
 * The entry point. Wiring and startup, and nothing else.
 *
 * Every function called here lives in the module that owns the state it
 * touches, so this file has no logic to get wrong - if something breaks, it
 * breaks somewhere with a name.
 */

/* ---------- Startup ---------- */

// The inline script in <head> already set light/dark before first paint. This
// runs anyway so "system" clears any attribute left over from a previous
// choice, and so there is one function that owns the rule.
applyTheme(store.prefs.theme);

rebuildViews();
initPreferences();
setSettingsPanel("preferences");
selectSchedule(store.schedule.id ?? store.schedules[0]?.id ?? null);

/* ---------- Settings ---------- */

els.settingsToggle.addEventListener("click", () => setSettingsOpen(!settingsOpen));

for (const name of SETTINGS_PANELS) {
  els.settingsTabs[name].addEventListener("click", () => setSettingsPanel(name));
}

/* ---------- The schedule editor ---------- */

els.scheduleNameInput.addEventListener("input", () => setDraftName(els.scheduleNameInput.value));
els.periodAdd.addEventListener("click", addPeriod);
els.shiftApply.addEventListener("click", shiftAll);
els.scheduleDuplicate.addEventListener("click", duplicateSchedule);
els.scheduleDelete.addEventListener("click", deleteSchedule);
els.scheduleNew.addEventListener("click", newSchedule);
els.overrideAdd.addEventListener("click", addOverride);

/* ---------- Views ---------- */

els.viewNow.addEventListener("click", () => setView("now"));
els.viewDay.addEventListener("click", () => setView("day"));
els.viewBig.addEventListener("click", enterBig);
els.bigExit.addEventListener("click", leaveBig);
els.pastToggle.addEventListener("click", togglePastPeriods);

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
// OS - must drop big mode too, or the page is left stretched with no
// fullscreen and no obvious explanation.
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && activeView === "big") {
    setView("now");
    els.viewBig.focus();
  }
});

/* ---------- The clock ---------- */

// One clock, one subscriber. Every view is derived from this tick, so nothing
// else in the app is allowed its own setInterval.
setInterval(tick, 1000);

// A throttled or frozen tab can miss minutes of ticks. These two events fire
// the moment it comes back, so the first thing the user sees is already right
// rather than catching up a second later.
document.addEventListener("visibilitychange", tick);
window.addEventListener("focus", tick);

setView(activeView);
