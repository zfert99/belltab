"use client";

import type { RefObject } from "react";
import type { Library } from "@/app/_lib/library";
import type { ValidSchedule } from "@/lib/schedule";
import { ScheduleEditor } from "@/app/_components/ScheduleEditor";

/**
 * The settings screen.
 *
 * One panel in Phase 3, so there is no tab strip: a tablist with a single tab
 * is a control that cannot do anything, which is worse than no control. The
 * nav arrives with Phase 4's calendar panel, and `globals.css` already carries
 * `.settings__layout` and `.settings__tab` for it.
 *
 * The heading takes `tabIndex={-1}` so focus can be moved here when the view
 * opens. That is not decoration - without it, opening settings leaves focus on
 * a button that is no longer on screen and a screen-reader user is told
 * nothing about what just happened.
 */
export interface SettingsViewProps {
  schedule: ValidSchedule | null;
  library: Library;
  save: (next: Library) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

export function SettingsView({ schedule, library, save, headingRef }: SettingsViewProps) {
  return (
    <section className="settings" id="settings-view" aria-labelledby="settings-title">
      <div className="panel" id="panel-schedules">
        <h2 className="panel__title" id="settings-title" tabIndex={-1} ref={headingRef}>
          Schedule
        </h2>
        <p className="panel__note">
          Periods are kept in start order and cannot overlap. Every valid change is saved to this
          browser as you type; the countdown keeps running on the last version that made sense.
        </p>

        {schedule === null ? (
          <p className="panel__note">There is no schedule to edit.</p>
        ) : (
          <ScheduleEditor
            key={schedule.id ?? "unnamed"}
            schedule={schedule}
            library={library}
            save={save}
          />
        )}
      </div>
    </section>
  );
}
