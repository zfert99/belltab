"use client";

import { useState } from "react";
import { blockPositionAt, daySummaryAt, periodStatusAt } from "@/lib/engine";
import { formatDayCaption, formatPeriodLabel } from "@/lib/format";
import { PERIOD_KINDS, type Period, type ValidSchedule } from "@/lib/schedule";

/**
 * The day as a row of blocks under the countdown: one square per real block,
 * a thin link per passing period, each filling as its time passes.
 *
 * Equal squares deliberately misrepresent duration. A five-minute passing and
 * a fifty-five-minute class are not the same size in reality, but the strip
 * answers "how many left", not "how long left" - the big number above it
 * already answers that - and proportional cells would be an accurate timeline
 * in which every passing period is an unreadable sliver.
 *
 * `aria-hidden`, because it is a redundant visual rendering: the caption
 * beneath states the same position in words ("2 of 7"), and the Day view is
 * the readable, navigable version of this data. Fifteen unlabelled cells
 * announced one by one would be noise, not information.
 *
 * A partly filled cell is a STATE, not a tick. If the tab was frozen and the
 * fill jumps 20% on return that reads as normal; the same gap in a seconds
 * counter reads as broken. Recomputing makes both correct - the shape is what
 * makes one of them also look correct.
 */
export function DayStrip({ schedule, nowSec }: { schedule: ValidSchedule; nowSec: number }) {
  /**
   * Hovering a square borrows the caption instead of opening a tooltip: no
   * positioning code, no new tab stops, and it works on a touch tap. Pointer-
   * only by design - the cells are not focusable, and the Day view carries
   * the same labels for everyone else.
   */
  const [hovered, setHovered] = useState<Period | null>(null);

  const caption = hovered
    ? formatPeriodLabel(hovered)
    : formatDayCaption(daySummaryAt(schedule, nowSec), blockPositionAt(schedule, nowSec));

  return (
    <div className="strip-block">
      <div className="strip" id="strip" aria-hidden="true">
        {schedule.periods.map((period) => {
          const status = periodStatusAt(period, nowSec);
          const isLink = period.kind === PERIOD_KINDS.PASSING;
          const elapsed = nowSec - period.startMin * 60;
          const length = (period.endMin - period.startMin) * 60;
          const percent = status === "past" ? 100 : status === "future" ? 0 : (elapsed / length) * 100;

          return (
            <span
              key={`${period.startMin}-${period.endMin}`}
              className={`strip__cell strip__cell--${isLink ? "link" : "block"} strip__cell--${status}`}
              onPointerEnter={isLink ? undefined : () => setHovered(period)}
              onPointerLeave={isLink ? undefined : () => setHovered(null)}
            >
              <span className="strip__fill" style={{ width: `${percent.toFixed(2)}%` }} />
            </span>
          );
        })}
      </div>
      <p className="strip__caption" id="strip-caption">
        {caption}
      </p>
    </div>
  );
}
