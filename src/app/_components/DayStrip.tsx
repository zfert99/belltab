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
 * block filling in. Passing periods are not drawn - the gap between two
 * blocks is the hallway - and a dash marks only a CHANGE OF KIND, so a run of
 * classes reads as one run and lunch reads as a boundary. The retired build
 * drew equal squares with a connector per passing, arguing that a
 * proportional strip made passing an unreadable sliver; not drawing passing
 * at all is what answers that.
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

  /** The day's real units. Passing periods are the gaps between them. */
  const blocks = schedule.periods.filter((period) => period.kind !== PERIOD_KINDS.PASSING);

  const caption = hovered
    ? formatPeriodLabel(hovered)
    : formatDayCaption(daySummaryAt(schedule, nowSec), blockPositionAt(schedule, nowSec));

  return (
    <div className="strip-block">
      <div className="strip" id="strip" aria-hidden="true">
        {blocks.map((period, index) => {
          const status = periodStatusAt(period, nowSec);
          const elapsed = nowSec - period.startMin * 60;
          const length = (period.endMin - period.startMin) * 60;
          const percent = status === "past" ? 100 : status === "future" ? 0 : percentOf(elapsed / length);

          // A dash only where the KIND changes: Planning, dash, three classes
          // running together, dash, Lunch. Passing periods are not drawn at all
          // - the gap between blocks is the hallway - so consecutive classes
          // read as one run and a change of kind reads as a boundary. Asked
          // for on 2026-09-04; the version before drew every passing as a
          // dash and every kind change as a seam, which was two vocabularies.
          const seam = index > 0 && blocks[index - 1].kind !== period.kind;

          return (
            <span
              key={`${period.startMin}-${period.endMin}`}
              className="strip__pair"
              // Blocks grow in proportion to their length, so the strip reads
              // as the day's timeline. The grow sits on the PAIR (block plus
              // any dash before it), which is the flex item the strip lays out.
              style={{ flexGrow: period.endMin - period.startMin }}
            >
              {seam && <span className="strip__seam" />}
              <span
                className={`strip__cell strip__cell--block strip__cell--${status}`}
                onPointerEnter={() => setHovered(period)}
                onPointerLeave={() => setHovered(null)}
              >
                <span className="strip__fill" style={{ width: `${percent}%` }} />
              </span>
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
