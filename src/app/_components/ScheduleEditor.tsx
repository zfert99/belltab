"use client";

import { useState } from "react";
import { SCHEDULE_LIMITS, isIdentified, type ParseError } from "@/lib/parse";
import type { IdentifiedSchedule } from "@/lib/parse";
import type { Library } from "@/app/_lib/library";
import {
  addPeriod,
  deletePeriod,
  movePeriod,
  parseDraft,
  toDraft,
  updatePeriod,
  type Draft,
  type DraftPeriod,
} from "@/app/_lib/draft";
import { BUILT_IN_KINDS } from "@/lib/schedule";
import { KIND_LIST_ID, PeriodRow } from "@/app/_components/PeriodRow";

/**
 * The editor, and the argument for why it cannot produce an invalid schedule.
 *
 * The draft is local state and may be anything - blank names, half-typed times,
 * two periods on top of each other. Every mutation goes through `apply`, which
 * runs the draft through `parseSchedule` and commits ONLY on `ok`. There is no
 * other path from this component to the store, so an invalid schedule is not
 * merely prevented, it is unreachable: the only function that can mint a
 * `ValidSchedule` is the parser, and the only thing `save` accepts is one.
 *
 * There is deliberately no Save button and no dirty state. Valid edits are
 * already persisted by the time a user looks up, and invalid ones were never
 * anything to lose - which is also why leaving the editor mid-error is
 * harmless rather than a confirmation prompt.
 *
 * The countdown keeps running on the last valid version throughout.
 */

export interface ScheduleEditorProps {
  schedule: IdentifiedSchedule;
  library: Library;
  save: (next: Library) => void;
}

export function ScheduleEditor({ schedule, library, save }: ScheduleEditorProps) {
  // Initialised once. The prop's identity changes on every save - it is the
  // object this component just wrote - and re-deriving from it would throw away
  // whatever had been typed since.
  const [draft, setDraft] = useState<Draft>(() => toDraft(schedule));

  const result = parseDraft(draft);
  const errors: readonly ParseError[] = result.ok ? [] : result.errors;

  const apply = (next: Draft) => {
    setDraft(next);

    const parsed = parseDraft(next);
    if (!parsed.ok) return;

    // The draft carries the schedule's id through `toDraft`, so this cannot
    // fail. It is here rather than as a cast because the library holds
    // IDENTIFIED schedules - the calendar points at them by id - and narrowing
    // with the parser's own predicate keeps `parseSchedule`'s double assertion
    // the only one in `src/`. Bound to a local const first, because TypeScript
    // drops a narrowing on a property access as soon as it crosses into the
    // callback below.
    const edited = parsed.value;
    if (!isIdentified(edited)) return;

    // Positional replacement rather than by id: the reference is the element
    // this editor was opened on, so its index is exact, and it stays exact
    // across a rename - which is the edit that runs on every keystroke.
    const index = library.schedules.indexOf(schedule);
    const schedules = library.schedules.map((entry, at) => (at === index ? edited : entry));

    save({ ...library, schedules });
  };

  const rowErrors = (index: number) => errors.filter((error) => error.index === index);
  const scheduleErrors = errors.filter((error) => error.index === null);
  const atPeriodLimit = draft.periods.length >= SCHEDULE_LIMITS.periods;

  return (
    <div className="editor">
      <div className="editor__toolbar">
        <label className="editor__name">
          <span className="visually-hidden">Schedule name</span>
          <input
            type="text"
            id="schedule-name-input"
            value={draft.name}
            maxLength={SCHEDULE_LIMITS.nameChars}
            aria-invalid={scheduleErrors.some((error) => error.field === "name") || undefined}
            aria-describedby={scheduleErrors.length > 0 ? "schedule-error" : undefined}
            onChange={(event) => apply({ ...draft, name: event.target.value })}
          />
        </label>

        <div className="editor__actions">
          <button
            type="button"
            className="minibutton"
            id="add-period"
            disabled={atPeriodLimit}
            onClick={() => apply(addPeriod(draft))}
          >
            Add period
          </button>
        </div>
      </div>

      {/*
        The one live region the editor owns. Row-level errors are NOT live -
        they are bound to their inputs with aria-describedby and read when the
        offending control takes focus, which is the right moment. A schedule
        with no name has no control worth focusing, so this one speaks.

        ALWAYS RENDERED, and hidden with `.visually-hidden` rather than with
        `hidden` or `display: none`. A live region has to be in the
        accessibility tree BEFORE its text changes for the change to be
        announced; a region that appears at the same moment as its message is a
        region screen readers routinely miss. `.visually-hidden` is the one way
        of hiding something that keeps it in that tree.

        Polite, and idempotent: React writes the same string on every re-render
        without touching the node, so it is announced once rather than per
        keystroke.
      */}
      <p
        className={scheduleErrors.length > 0 ? "editor__error" : "visually-hidden"}
        id="schedule-error"
        aria-live="polite"
      >
        {scheduleErrors.map((error) => error.message).join(" ")}
      </p>

      {/*
        The container the row layout is measured against. The editor has three
        shapes - a seven-column table, a two-line row, a stack - and which one
        fits depends on THIS element's width, not the viewport's: the settings
        panel is at most 684px wide beside its nav no matter how wide the
        window, which is less than the table needs. A viewport query got that
        wrong on 2026-09-03 and collapsed the name column to 8px on every
        engine; see Bugs found in Docs/build-log.md.
      */}
      <div className="editrows">
      <div className="editrow__head" aria-hidden="true">
        <span>Name</span>
        <span>Kind</span>
        <span>Start</span>
        <span>End</span>
        <span>Minutes</span>
        <span>Move</span>
        <span />
      </div>

      {/*
        One datalist for every row's kind box. Suggestions, not a menu: the
        built-ins are what most schools mean, and anything else typed is kept.
      */}
      <datalist id={KIND_LIST_ID}>
        {BUILT_IN_KINDS.map((kind) => (
          <option key={kind} value={kind} />
        ))}
      </datalist>

      <ul className="editlist" id="period-editor">
        {draft.periods.map((row, index) => (
          <PeriodRow
            key={row.rowId}
            row={row}
            position={index}
            total={draft.periods.length}
            errors={rowErrors(index)}
            onChange={(rowId: string, patch: Partial<DraftPeriod>) =>
              apply(updatePeriod(draft, rowId, patch))
            }
            onMove={(rowId, direction) => apply(movePeriod(draft, rowId, direction))}
            onDelete={(rowId) => apply(deletePeriod(draft, rowId))}
          />
        ))}
      </ul>
      </div>
    </div>
  );
}
