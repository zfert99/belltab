"use client";

import { useEffect, useRef, useState } from "react";
import { blockPositionAt, daySummaryAt, periodStatusAt } from "@/lib/engine";
import {
  formatClock,
  formatDayCaption,
  formatDuration,
  formatRemaining,
  percentOf,
} from "@/lib/format";
import type { ValidSchedule } from "@/lib/schedule";

/**
 * The whole day as a list: every period, where the day stands, what is left.
 *
 * Built in the plain build on 2026-08-26, retired with it on 2026-08-27 with a
 * note that it was owed back, never rebuilt by any phase, and deleted as
 * residue on 2026-09-03. Rebuilt on 2026-09-04 because a teacher glancing at
 * a screen asks two questions - "how long until the bell" and "what's left
 * today" - and the Now view answers only the first. See Deviations in
 * Docs/build-log.md.
 *
 * Same rules as the Now view. Everything here is recomputed from the seconds
 * of day it is handed; nothing counts down. There is no live region: the
 * announcer mounted above both screens already says when a period changes,
 * and eleven rows of per-second text would be the flood it exists to avoid.
 * The running row carries `aria-current="time"`, which is the accessible
 * equivalent of its highlight.
 */
export function DayView({ schedule, nowSec }: { schedule: ValidSchedule; nowSec: number }) {
  const day = daySummaryAt(schedule, nowSec);
  const position = blockPositionAt(schedule, nowSec);

  /**
   * Finished periods collapse so the running one sits at the top of the list.
   * Off by default, and disabled once the day is over - a finished day with
   * every row hidden behind a toggle would be a list of nothing.
   */
  const [showPast, setShowPast] = useState(false);
  const dayOver = day.phase === "after";

  const rows = schedule.periods.map((period) => ({
    period,
    status: periodStatusAt(period, nowSec),
  }));
  const pastCount = rows.filter((row) => row.status === "past").length;
  const collapsing = pastCount > 0 && !dayOver && !showPast;

  /**
   * The running row is scrolled into view when it CHANGES, not on every tick.
   * A scrollIntoView every second would fight the user for the page; keyed on
   * the running period's start minute, it fires at a bell and on entry, which
   * is when the row they want has moved. Reduced motion, from either source,
   * makes the scroll a jump.
   */
  const currentRef = useRef<HTMLLIElement | null>(null);
  const currentStart = rows.find((row) => row.status === "current")?.period.startMin ?? null;

  useEffect(() => {
    const row = currentRef.current;
    if (row === null || typeof row.scrollIntoView !== "function") return;

    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.getAttribute("data-motion") === "reduce";
    row.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [currentStart]);

  if (schedule.periods.length === 0) {
    return (
      <section className="day" id="day-view" aria-label="Today's schedule">
        <p className="panel__note">This schedule has no periods yet.</p>
      </section>
    );
  }

  return (
    <section className="day" id="day-view" aria-label="Today's schedule">
      <div className="day__summary">
        <h2 className="day__label">Day progress</h2>
        {/*
          One caption rather than the retired build's big number with its
          units beside it: the Now view already owns the big number, and this
          line carries the unit in words, so "3h 38m" cannot be read as 3:38.
        */}
        <p className="day__caption" id="day-caption">
          {formatDayCaption(day, position)}
        </p>
      </div>

      <div className="progress" aria-hidden="true">
        <div className="progress__fill" style={{ width: `${percentOf(day.progress)}%` }} />
      </div>

      {pastCount > 0 && !dayOver && (
        <button
          type="button"
          className="disclosure"
          id="past-toggle"
          aria-expanded={showPast}
          aria-controls="period-list"
          onClick={() => setShowPast((shown) => !shown)}
        >
          <span className="disclosure__marker" aria-hidden="true" />
          {pastCount} earlier {pastCount === 1 ? "period" : "periods"}
        </button>
      )}

      {/* An <ol>: a bell schedule is a sequence and should be read as one. */}
      <ol className="periods" id="period-list">
        {rows.map(({ period, status }) => {
          const hidden = status === "past" && collapsing;
          const elapsed = nowSec - period.startMin * 60;
          const length = (period.endMin - period.startMin) * 60;

          return (
            <li
              key={`${period.startMin}-${period.endMin}`}
              className={`period period--${status}`}
              hidden={hidden}
              aria-current={status === "current" ? "time" : undefined}
              ref={status === "current" ? currentRef : undefined}
            >
              <div className="period__row">
                <span className="period__time">{formatClock(period.startMin)}</span>
                <span className="period__name">{period.name}</span>
                {/*
                  Spelled out for the running row - "50m 00s" - because the
                  rows around it are formatDuration's "55m" and "1h", and a
                  bare colon form beneath "1h" reads as one minute twenty.
                */}
                <span className="period__aside">
                  {status === "current"
                    ? formatRemaining(period.endMin * 60 - nowSec)
                    : status === "past"
                      ? "done"
                      : formatDuration(period.endMin - period.startMin)}
                </span>
              </div>
              {status === "current" && (
                <div className="period__track" aria-hidden="true">
                  <div className="period__fill" style={{ width: `${percentOf(elapsed / length)}%` }} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
