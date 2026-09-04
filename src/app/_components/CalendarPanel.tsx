"use client";

import { useState, type RefObject } from "react";
import { weekdayOf } from "@/lib/dates";
import type { LocalNow } from "@/lib/clock";
import { SCHEDULE_LIMITS, parseIsoDate } from "@/lib/parse";
import type { IsoDate, ScheduleId } from "@/lib/schedule";
import {
  pastOverrides,
  removeOverride,
  removePastOverrides,
  setOverride,
  setWeekday,
  type Library,
} from "@/app/_lib/library";
import { scheduleNameOn } from "@/app/_lib/today";

/**
 * The resolver, made editable and made legible.
 *
 * Three sections in the order the resolver reads them, which is not an accident:
 * an explicit date override beats the weekday default, and the weekday default
 * beats nothing at all. A user who cannot see that order cannot debug a Tuesday
 * that is running the wrong bells.
 *
 * The "Today" line at the top is the answer the rest of the panel is arguing
 * about. It is the only part that needs the clock, which is why `now` is
 * nullable here exactly as it is everywhere else: the server has no device
 * clock, so a time-derived value rendered before mount is a hydration mismatch
 * by construction.
 *
 * **Room reserved for a cycle layer.** Rotating day types (A/B, 6-day) are
 * deferred in `Docs/roadmap.md`, and the shape that would hold them is a third
 * section between the two below - a cycle assignment that beats the weekday and
 * loses to an override. Nothing here forecloses it.
 */

/** Indexed to match `Calendar.weekdays`, which is indexed to match `Date.getDay()`. */
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * The wire form of "no school" in a `<select>`.
 *
 * A select's value is always a string, so `null` has to be encoded. The empty
 * string is safe as that encoding because `parseScheduleCollection` guarantees
 * every schedule id is non-empty - so no schedule can ever answer to it.
 */
const NO_SCHOOL = "";

/** Sentinels for the Today control, namespaced so no schedule id can collide. */
const FOLLOW_WEEKDAY = "weekday";
const CLOSED_TODAY = "closed";
const idChoice = (id: ScheduleId) => `id:${id}`;

export interface CalendarPanelProps {
  library: Library;
  save: (next: Library) => void;
  now: LocalNow | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

export function CalendarPanel({ library, save, now, headingRef }: CalendarPanelProps) {
  const [newDate, setNewDate] = useState("");
  const [newScheduleId, setNewScheduleId] = useState<string>(NO_SCHOOL);

  const { overrides } = library.calendar;
  const nameOf = (id: ScheduleId | null) =>
    library.schedules.find((schedule) => schedule.id === id)?.name ?? null;

  /*
    The three states the exception form can be in, and why each exists. All
    three come out of the Phase 4 review; before it the form had one gate that
    was wrong in both directions and no validation at all.

    `parseIsoDate` runs HERE and not only inside `setOverride`, because a mutator
    that refuses is still a control that did nothing. Chrome's date input
    happily reports a five-digit year - a typo of 20260 for 2026 - which is a
    value the control considers valid and the parser does not.

    The cap is about whether the calendar would GROW. Replacing an exception on
    a date that already has one cannot, so it stays available at the cap; only a
    genuinely new date is refused.
  */
  const parsedNewDate = parseIsoDate(newDate);
  const dateIsUnusable = newDate !== "" && parsedNewDate === null;
  const calendarIsFull = overrides.length >= SCHEDULE_LIMITS.overrides;
  const past = now === null ? [] : pastOverrides(library, now.isoDate);
  const hasOverrideOn = (date: IsoDate) => overrides.some((entry) => entry.date === date);
  const cannotAdd = calendarIsFull && parsedNewDate !== null && !hasOverrideOn(parsedNewDate);

  // The Today control writes an override too, and at the cap every option that
  // would change anything is refused. The one option left - "Follow the weekday
  // default" - is already its value in that state, so disabling it costs
  // nothing and stops a select that silently snaps back.
  const todayIsBlocked = calendarIsFull && now !== null && !hasOverrideOn(now.isoDate);

  return (
    <div className="panel" id="panel-calendar">
      <h2 className="panel__title" id="settings-title" tabIndex={-1} ref={headingRef}>
        Calendar
      </h2>
      <p className="panel__note">
        A dated exception wins. Failing that, the weekday default decides. Failing that, there is no
        school.
      </p>

      <section className="calsection">
        <h3 className="calsection__title">Today</h3>
        <TodayLine library={library} now={now} />
        {now !== null && (
          <label className="weekday calsection__control">
            <span className="weekday__name">Use this schedule today</span>
            <select
              id="today-schedule"
              value={choiceForToday(library, now)}
              disabled={todayIsBlocked}
              aria-describedby={todayIsBlocked ? "today-full" : undefined}
              onChange={(event) => {
                const choice = event.target.value;
                if (choice === FOLLOW_WEEKDAY) save(removeOverride(library, now.isoDate));
                else if (choice === CLOSED_TODAY) save(setOverride(library, now.isoDate, null));
                else save(setOverride(library, now.isoDate, choice.slice("id:".length)));
              }}
            >
              <option value={FOLLOW_WEEKDAY}>Follow the weekday default</option>
              <option value={CLOSED_TODAY}>No school</option>
              {library.schedules.map((schedule) => (
                <option key={schedule.id} value={idChoice(schedule.id)}>
                  {schedule.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {todayIsBlocked && (
          <p className="editor__error" id="today-full">
            The calendar already holds {SCHEDULE_LIMITS.overrides} dated exceptions. Remove one
            below before pointing today at a different schedule.
          </p>
        )}
      </section>

      <section className="calsection">
        {/*
          Focusable, so the countdown's "No school today" screen can land a
          keyboard user HERE rather than at the top of a panel whose first
          section writes one-off exceptions.
        */}
        <h3 className="calsection__title" id="weekday-defaults" tabIndex={-1}>
          Weekday defaults
        </h3>
        <div className="weekdays" id="weekday-map">
          {WEEKDAY_NAMES.map((dayName, day) => {
            const current = library.calendar.weekdays[day];

            return (
              <label
                key={dayName}
                className={current === null ? "weekday weekday--closed" : "weekday"}
              >
                <span className="weekday__name">{dayName}</span>
                <select
                  value={current ?? NO_SCHOOL}
                  onChange={(event) =>
                    save(setWeekday(library, day, event.target.value || null))
                  }
                >
                  <option value={NO_SCHOOL}>No school</option>
                  {library.schedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.name}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      </section>

      <section className="calsection">
        <h3 className="calsection__title">Dated exceptions</h3>

        {/*
          The cap is 400 and nothing pruned: two years in, the list is mostly
          dates that can never resolve again, with one Remove button each. One
          button for all of them, shown only when there are some - today's own
          exception is not "past", because it is still running.
        */}
        {past.length > 0 && (
          <p className="panel__note" id="past-overrides">
            {past.length === 1
              ? "One of these is in the past and can never apply again."
              : `${past.length} of these are in the past and can never apply again.`}{" "}
            <button
              type="button"
              className="minibutton"
              id="prune-overrides"
              onClick={() => now !== null && save(removePastOverrides(library, now.isoDate))}
            >
              Remove past exceptions
            </button>
          </p>
        )}

        <div className="addoverride">
          <label className="addoverride__field">
            <span className="visually-hidden">Date of the exception</span>
            {/*
              Same reason as the editor's time field: WebKit reports
              `input.type === "text"` here and hands back a plain text box, so
              the format has to be stated somewhere. Chrome and Firefox render
              a date control and ignore this.
            */}
            <input
              type="date"
              placeholder="YYYY-MM-DD"
              id="override-date"
              value={newDate}
              aria-invalid={dateIsUnusable || undefined}
              aria-describedby={dateIsUnusable ? "override-date-error" : undefined}
              onChange={(event) => setNewDate(event.target.value)}
            />
          </label>
          <label className="addoverride__field">
            <span className="visually-hidden">Schedule to run on that date</span>
            <select
              id="override-schedule"
              value={newScheduleId}
              onChange={(event) => setNewScheduleId(event.target.value)}
            >
              <option value={NO_SCHOOL}>No school</option>
              {library.schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="minibutton"
            id="override-add"
            disabled={parsedNewDate === null || cannotAdd}
            aria-describedby={cannotAdd ? "calendar-full" : undefined}
            onClick={() => {
              // Adding a date that already has an exception REPLACES it, in
              // `setOverride`, rather than leaving the resolver two entries for
              // one day to arbitrate between.
              if (parsedNewDate === null) return;
              save(setOverride(library, parsedNewDate, newScheduleId || null));
              setNewDate("");
            }}
          >
            Add exception
          </button>
        </div>

        {/*
          Bound to the control that caused it rather than announced. The date
          field has focus while it is being typed into, which is when this
          appears, and the editor's rule is that a message with a control to
          point at points at it - only the one with no control speaks.
        */}
        {dateIsUnusable && (
          <p className="editrow__error" id="override-date-error">
            That is not a date BellTab can store. Use YYYY-MM-DD, with a four-digit year.
          </p>
        )}
        {cannotAdd && (
          <p className="editor__error" id="calendar-full">
            The calendar already holds {SCHEDULE_LIMITS.overrides} dated exceptions. Remove one
            before adding another.
          </p>
        )}

        {overrides.length === 0 ? (
          <p className="panel__note">No dated exceptions yet.</p>
        ) : (
          <ul className="overrides" id="overrides">
            {overrides.map((entry) => (
              <li className="override" key={entry.date}>
                {/*
                  The date is shown as it is stored and as it will be exported -
                  mono and tabular so a column of them lines up - with its
                  weekday in front, because a school year is planned around
                  "the Monday", not around "the 14th". Computed by arithmetic on
                  the string: `new Date("2026-09-14")` is UTC midnight, which is
                  still Sunday in New York. See `weekdayOf`.
                */}
                <span className="override__date">
                  {weekdayOf(entry.date) ?? ""} {entry.date}
                </span>
                <span className="override__schedule">{nameOf(entry.scheduleId) ?? "No school"}</span>
                <button
                  type="button"
                  className="override__remove"
                  onClick={() => save(removeOverride(library, entry.date))}
                >
                  {/*
                    Individually named. A list of buttons all reading "Remove" is
                    the classic screen-reader dead end - the visible label is the
                    same for everyone, and the hidden half says which one.
                  */}
                  Remove
                  <span className="visually-hidden">
                    {" "}
                    the exception on {weekdayOf(entry.date) ?? ""} {entry.date}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * What today actually resolves to, in a sentence.
 *
 * Before the clock has been read there is nothing honest to say, and saying
 * "no school" then would be a lie that arrives a frame before the truth.
 */
function TodayLine({ library, now }: { library: Library; now: LocalNow | null }) {
  if (now === null) {
    return (
      <p className="panel__note" id="calendar-today">
        Reading the clock…
      </p>
    );
  }

  const name = scheduleNameOn(library, now.isoDate, now.weekday);
  const day = `${WEEKDAY_NAMES[now.weekday]}, ${now.isoDate}`;

  return (
    <p className="panel__note" id="calendar-today">
      {name === null
        ? `Today is ${day}, and there is no school scheduled.`
        : `Today is ${day}, and it runs ${name}.`}
    </p>
  );
}

/** Which of the Today control's options is the current answer for today. */
function choiceForToday(library: Library, now: LocalNow): string {
  const override = library.calendar.overrides.find((entry) => entry.date === now.isoDate);

  if (override === undefined) return FOLLOW_WEEKDAY;
  return override.scheduleId === null ? CLOSED_TODAY : idChoice(override.scheduleId);
}
