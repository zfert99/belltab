import type { LocalNow } from "@/lib/clock";
import { stateAt, type DayState } from "@/lib/engine";
import { formatTabTitle } from "@/lib/format";
import { resolveScheduleId } from "@/lib/parse";
import type { IsoDate, ValidSchedule } from "@/lib/schedule";
import type { Library } from "@/app/_lib/library";

/**
 * Which schedule is running, and what it is doing right now.
 *
 * The seam between the pure engine and the view. Everything here is still pure
 * - both the library and the clock reading are arguments - but unlike
 * `src/lib/` this file knows what shape the app keeps its data in, so it lives
 * beside the route that uses it rather than in the engine.
 *
 * **Changed in Phase 3:** the library was a module constant frozen at
 * `DEFAULT_SCHEDULES`, matching the roadmap's "schedule is hard-coded". Now
 * that the editor can change it and `localStorage` can persist it, it is a
 * parameter - which also means these functions can be tested against a library
 * that has no schedules at all, a state the seeded one can never reach.
 */

export type TodayView =
  | { kind: "scheduled"; scheduleName: string; schedule: ValidSchedule; state: DayState }
  | { kind: "no-school" }
  | { kind: "no-schedules" };

/**
 * Resolves the day and asks the engine what is true at this second.
 *
 * @param library - the schedules that exist and the calendar pointing at them
 * @param now - one reading of the device clock, already reduced to integers
 */
export function viewForNow(library: Library, now: LocalNow): TodayView {
  if (library.schedules.length === 0) return { kind: "no-schedules" };

  const id = resolveScheduleId(library.calendar, now.isoDate, now.weekday);
  const schedule = library.schedules.find((candidate) => candidate.id === id);

  // A weekday the calendar points at nothing, an explicit closure, or an id
  // that no longer resolves - all three are the same screen to the user.
  if (id === null || schedule === undefined) return { kind: "no-school" };

  // The schedule rides along for the Day view and the strip, which need
  // every period rather than the state's running one - so they read it here
  // instead of resolving the calendar a second time and agreeing by luck.
  return {
    kind: "scheduled",
    scheduleName: schedule.name,
    schedule,
    state: stateAt(schedule, now.secOfDay),
  };
}

/**
 * The tab title for the whole view, not just for a running period.
 *
 * `formatTabTitle` only knows about `DayState`, which cannot express "the
 * calendar says there is no school". Number first is preserved where there is a
 * number; where there is not, the string still has to say something useful in
 * the ~12 characters a tab shows.
 */
/**
 * The schedule today resolves to, or `null` - the same resolution
 * `viewForNow` performs, for the one caller that wants the schedule itself
 * rather than its state: the bell-offset calibration, which needs every
 * period's bells.
 */
export function scheduleForToday(library: Library, now: LocalNow): ValidSchedule | null {
  const id = resolveScheduleId(library.calendar, now.isoDate, now.weekday);
  return library.schedules.find((candidate) => candidate.id === id) ?? null;
}

export function tabTitleFor(view: TodayView): string {
  if (view.kind === "scheduled") return formatTabTitle(view.state);
  return view.kind === "no-school" ? "No school · BellTab" : "BellTab";
}

/**
 * The schedule the picker opens on, as an INDEX into the library.
 *
 * Today's, if today has one; otherwise the first in the library. A weekend is
 * the ordinary case for the fallback - somebody setting up their timetable on a
 * Sunday should not be shown an empty editor and told to come back Monday.
 *
 * An index rather than the schedule itself, because Phase 4's picker holds a
 * selection and the editor replaces schedules positionally. `null` is an empty
 * library, which is the onboarding state rather than an error.
 */
export function scheduleIndexToEdit(library: Library, now: LocalNow | null): number | null {
  if (library.schedules.length === 0) return null;
  if (now === null) return 0;

  const id = resolveScheduleId(library.calendar, now.isoDate, now.weekday);
  const index = library.schedules.findIndex((candidate) => candidate.id === id);

  return index === -1 ? 0 : index;
}

/**
 * What a given day resolves to, by name.
 *
 * The calendar panel's whole job is to make the resolver legible, and a user
 * cannot check a priority order they cannot see. `null` is no school - either
 * because the weekday points at nothing, or because an override closed the day.
 *
 * The weekday is passed in rather than derived from the date, for the same
 * reason `resolveScheduleId` does it: this stays pure and the caller owns the
 * clock.
 */
export function scheduleNameOn(
  library: Library,
  isoDate: IsoDate,
  weekday: number,
): string | null {
  const id = resolveScheduleId(library.calendar, isoDate, weekday);
  return library.schedules.find((candidate) => candidate.id === id)?.name ?? null;
}
