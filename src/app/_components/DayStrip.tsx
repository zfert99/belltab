"use client";

import { useState } from "react";
import { blockPositionAt, daySummaryAt, periodStatusAt } from "@/lib/engine";
import { formatDayCaption, formatPeriodLabel, percentOf } from "@/lib/format";
import { PERIOD_KINDS, type Period, type ValidSchedule } from "@/lib/schedule";

/**
 * The day as a row of blocks under the countdown: one square per real block,
 * a thin link per passing period, each filling as its time passes.
 *
 * It stands IN PLACE of the period progress bar, edge to edge, and each block
 * is as wide as it is long: the strip is the day's timeline with the running
 * block filling in. The retired build drew equal squares instead, arguing that
 * a proportional strip made every passing period an unreadable sliver -
 * which is true, and is why a passing period is drawn as a dash between the
 * blocks it joins rather than as a cell of its own.
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
   * positioning code, no new tab stops. MOUSE-only, and honestly so: a touch
   * pointer is transient - enter, up and leave arrive in one tap - so on a
   * phone the caption would flash and revert before it could be read. The
   * cells are not focusable either. The Day view carries the same labels for
   * everyone who is not pointing with a mouse.
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
          const percent = status === "past" ? 100 : status === "future" ? 0 : percentOf(elapsed / length);

          return (
            <span
              key={`${period.startMin}-${period.endMin}`}
              className={`strip__cell strip__cell--${isLink ? "link" : "block"} strip__cell--${status}`}
              // Blocks grow in proportion to their length, so the strip reads
              // as the day's timeline; a dash is a dash whatever it joins.
              style={isLink ? undefined : { flexGrow: period.endMin - period.startMin }}
              onPointerEnter={isLink ? undefined : () => setHovered(period)}
              onPointerLeave={isLink ? undefined : () => setHovered(null)}
            >
              <span className="strip__fill" style={{ width: `${percent}%` }} />
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
