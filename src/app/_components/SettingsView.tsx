"use client";

import { useState, type RefObject } from "react";
import type { LocalNow } from "@/lib/clock";
import type { Library } from "@/app/_lib/library";
import type { Preferences } from "@/app/_lib/preferences";
import type { WakeLockStatus } from "@/app/_lib/wakeLock";
import type { BellStatuses } from "@/app/_lib/bells";
import { scheduleForToday, scheduleIndexToEdit } from "@/app/_lib/today";
import { PANELS, type PanelId } from "@/app/_lib/panels";
import { SchedulesPanel } from "@/app/_components/SchedulesPanel";
import { CalendarPanel } from "@/app/_components/CalendarPanel";
import { BackupPanel } from "@/app/_components/BackupPanel";
import { PreferencesPanel } from "@/app/_components/PreferencesPanel";

/**
 * The settings screen, and the tab strip Phase 3 deliberately did not build.
 *
 * One panel needed no navigation - a tablist with a single tab is a control that
 * cannot do anything, which is worse than no control. Two panels do, and
 * `globals.css` has carried `.settings__layout` and `.settings__tab` since the
 * retired build in anticipation of exactly this.
 *
 * Pressed-state buttons rather than ARIA tabs. A real `tablist` owes arrow-key
 * roving focus and a `tabpanel` relationship, and buys nothing here: there are
 * two destinations, each of which simply replaces the panel below. `aria-pressed`
 * says which one is showing without promising keyboard behaviour that is not
 * implemented.
 *
 * And no `aria-controls`, for the same reason it was REMOVED after the Phase 4
 * review: only one panel is rendered at a time, so the inactive tab's IDREF
 * pointed at nothing and a dangling IDREF is an ARIA error rather than a weaker
 * hint. The panel is the next element in DOM order and `aria-pressed` already
 * carries the state, so the attribute was buying nothing to begin with.
 *
 * Selection state for the schedule picker lives HERE rather than in the panel,
 * so that switching to the calendar and back does not silently re-point the
 * editor at a different schedule.
 */

/**
 * The panel list moved to `_lib/panels.ts` so the E2E suite can loop over the
 * same one. Re-exported here because every caller already imports `PanelId`
 * from this file, and the move is not their business.
 */
export type { PanelId };

export interface SettingsViewProps {
  library: Library;
  save: (next: Library) => void;
  preferences: Preferences;
  savePreferences: (next: Preferences) => void;
  /** Held by `App.tsx`, which outlives this screen - see PreferencesPanel. */
  wakeLockStatus: WakeLockStatus;
  /** Likewise: one `useBells`, in `App.tsx`, and this is its report. */
  bellStatuses: BellStatuses;
  now: LocalNow | null;
  /** Which panel to open on - the countdown's empty states link into both. */
  initialPanel: PanelId;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

export function SettingsView({
  library,
  save,
  preferences,
  savePreferences,
  wakeLockStatus,
  bellStatuses,
  now,
  initialPanel,
  headingRef,
}: SettingsViewProps) {
  const [panel, setPanel] = useState<PanelId>(initialPanel);

  // Computed once, on open. The editor opens on the schedule that runs today,
  // which is the one a user is most likely to have come here to fix; from then
  // on it is whichever chip they pressed, and recomputing would take the
  // selection back off them at midnight.
  const [selected, setSelected] = useState(() => scheduleIndexToEdit(library, now) ?? 0);

  return (
    <section className="settings" id="settings-view" aria-labelledby="settings-title">
      <div className="settings__layout">
        <div className="settings__nav" role="group" aria-labelledby="settings-navlabel">
          <p className="settings__navlabel" id="settings-navlabel">
            Settings
          </p>
          {PANELS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className="settings__tab"
              id={`tab-${id}`}
              aria-pressed={panel === id}
              onClick={() => setPanel(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {panel === "schedules" && (
          <SchedulesPanel
            library={library}
            save={save}
            selected={selected}
            onSelect={setSelected}
            now={now}
            headingRef={headingRef}
          />
        )}
        {panel === "calendar" && (
          <CalendarPanel library={library} save={save} now={now} headingRef={headingRef} />
        )}
        {panel === "backup" && (
          <BackupPanel library={library} save={save} now={now} headingRef={headingRef} />
        )}
        {panel === "preferences" && (
          <PreferencesPanel
            preferences={preferences}
            save={savePreferences}
            wakeLockStatus={wakeLockStatus}
            bellStatuses={bellStatuses}
            now={now}
            todaySchedule={now === null ? null : scheduleForToday(library, now)}
            headingRef={headingRef}
          />
        )}
      </div>
    </section>
  );
}
