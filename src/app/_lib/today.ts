import type { LocalNow } from "@/lib/clock";
import { stateAt, type DayState } from "@/lib/engine";
import { formatTabTitle } from "@/lib/format";
import { resolveScheduleId } from "@/lib/parse";
import type { ValidSchedule } from "@/lib/schedule";
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
  | { kind: "scheduled"; scheduleName: string; state: DayState }
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

  return { kind: "scheduled", scheduleName: schedule.name, state: stateAt(schedule, now.secOfDay) };
}

/**
 * The tab title for the whole view, not just for a running period.
 *
 * `formatTabTitle` only knows about `DayState`, which cannot express "the
 * calendar says there is no school". Number first is preserved where there is a
 * number; where there is not, the string still has to say something useful in
 * the ~12 characters a tab shows.
 */
export function tabTitleFor(view: TodayView): string {
  if (view.kind === "scheduled") return formatTabTitle(view.state);
  return view.kind === "no-school" ? "No school · BellTab" : "BellTab";
}

/**
 * The schedule the editor opens on.
 *
 * Today's, if today has one; otherwise the first in the library. A weekend is
 * the ordinary case for the fallback - somebody setting up their timetable on a
 * Sunday should not be shown an empty editor and told to come back Monday.
 *
 * Phase 4 replaces this with a picker. Until there is more than one schedule a
 * user can choose between, "the one that matters today" is the only sensible
 * answer, and it is computed rather than remembered so it cannot go stale.
 */
export function scheduleToEdit(library: Library, now: LocalNow | null): ValidSchedule | null {
  if (library.schedules.length === 0) return null;
  if (now === null) return library.schedules[0];

  const id = resolveScheduleId(library.calendar, now.isoDate, now.weekday);
  return library.schedules.find((candidate) => candidate.id === id) ?? library.schedules[0];
}
