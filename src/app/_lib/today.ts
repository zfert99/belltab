import type { LocalNow } from "@/lib/clock";
import { stateAt, type DayState } from "@/lib/engine";
import { formatTabTitle } from "@/lib/format";
import { parseCalendar, parseScheduleCollection, resolveScheduleId } from "@/lib/parse";
import {
  DEFAULT_CALENDAR,
  DEFAULT_SCHEDULES,
  type Calendar,
  type ScheduleId,
  type ValidSchedule,
} from "@/lib/schedule";

/**
 * Which schedule is running, and what it is doing right now.
 *
 * The seam between the pure engine and the view. Everything here is still pure
 * - `now` is an argument - but unlike `src/lib/` this file knows about the
 * app's own hard-coded library, so it lives beside the route that uses it
 * rather than in the engine.
 *
 * PHASE 2 SCOPE. The library below is `DEFAULT_SCHEDULES`, frozen at module
 * load, exactly as the roadmap's "schedule is hard-coded" says. What is pulled
 * forward from Phase 4 is only the READ side of the calendar: the weekday map
 * already exists in `src/lib/schedule.ts` and `resolveScheduleId` already
 * exists in `src/lib/parse.ts`, and without them the design system's "no
 * schedule today" empty state has nothing that can produce it. Phase 4 adds the
 * UI that edits any of this; nothing here is editable.
 */

/**
 * The library, parsed once.
 *
 * Seed data gets no exemption from the boundary - `AGENTS.md`'s "parse, don't
 * validate" applies to our own constants too, and `parseSchedule` is the only
 * thing that can mint a `ValidSchedule`. A failure here degrades to an empty
 * library, which renders the no-schedules onboarding state rather than
 * throwing; `parse.test.ts` already asserts all four defaults survive the trip,
 * so this branch is a floor, not an expectation.
 */
const parsed = parseScheduleCollection(DEFAULT_SCHEDULES);
const SCHEDULES: readonly ValidSchedule[] = parsed.ok ? parsed.value : [];

const knownIds: readonly ScheduleId[] = SCHEDULES.map((schedule) => schedule.id).filter(
  (id): id is ScheduleId => id !== null,
);

const CALENDAR: Calendar = parseCalendar(DEFAULT_CALENDAR, knownIds);

/**
 * What the Now view is looking at.
 *
 * Three kinds rather than one shape with nullable fields, for the same reason
 * `DayState` is a union: "no school today" and "no schedules at all" are
 * different screens with different copy, and a renderer that has to tell them
 * apart from two nulls will eventually get it wrong.
 */
export type TodayView =
  | { kind: "scheduled"; scheduleName: string; state: DayState }
  | { kind: "no-school" }
  | { kind: "no-schedules" };

/**
 * Resolves the day and asks the engine what is true at this second.
 *
 * @param now - one reading of the device clock, already reduced to integers
 */
export function viewForNow(now: LocalNow): TodayView {
  if (SCHEDULES.length === 0) return { kind: "no-schedules" };

  const id = resolveScheduleId(CALENDAR, now.isoDate, now.weekday);
  const schedule = SCHEDULES.find((candidate) => candidate.id === id);

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
