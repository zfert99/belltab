"use client";

import type { ParseError } from "@/lib/parse";
import { SCHEDULE_LIMITS } from "@/lib/parse";
import type { DraftPeriod } from "@/app/_lib/draft";
import { CloseIcon, DownIcon, UpIcon } from "@/app/_components/icons";

/**
 * One period, as a row of ordinary form controls.
 *
 * The design system asks for "an ordinary, boring, accessible form", and the
 * boring part is load-bearing: every control here is native, so the browser
 * supplies the keyboard behaviour, the mobile pickers and the focus ring for
 * free. There is no custom time picker and no drag handle.
 *
 * **End time AND length, filling each other in.** Length was the only fourth
 * field until 2026-09-03, because "Period 2 is 55 minutes" is how a schedule
 * is described and it makes `start >= end` unreachable by typing. The end box
 * joined it because a schedule is READ the other way - "until 10:05" - and
 * the subtraction in between is exactly what a clock app should do for you.
 * `draft.ts` keeps the two in step; length is still what the draft believes.
 *
 * **Kind is a text box with suggestions, not a select.** A closed list of
 * three could not say "Planning" or whatever a building calls its own blocks.
 * The `<datalist>` (rendered once, in `ScheduleEditor`) offers the built-ins;
 * anything else typed is kept as typed, and the parser caps its length.
 *
 * **Reorder is two buttons, not a drag.** `AGENTS.md` requires keyboard-
 * operable reordering, and a pair of buttons is keyboard-operable by
 * construction rather than by adding a keyboard fallback to a pointer gesture.
 */

/** The id of the datalist `ScheduleEditor` renders for every row to share. */
export const KIND_LIST_ID = "period-kinds";

/**
 * The parser names its fields after the SCHEDULE, the form after its inputs.
 *
 * `endMin` lands on BOTH the end box and the length box: the parser has no
 * idea the form took the end time apart into a start, a duration and a view of
 * their sum, and either box is one a user would change to fix it.
 */
const FIELD_TO_INPUTS: Record<string, readonly ("name" | "kind" | "start" | "end" | "length")[]> = {
  name: ["name"],
  kind: ["kind"],
  startMin: ["start"],
  endMin: ["end", "length"],
};

export interface PeriodRowProps {
  row: DraftPeriod;
  position: number;
  total: number;
  errors: readonly ParseError[];
  onChange: (rowId: string, patch: Partial<DraftPeriod>) => void;
  onMove: (rowId: string, direction: -1 | 1) => void;
  onDelete: (rowId: string) => void;
}

export function PeriodRow({ row, position, total, errors, onChange, onMove, onDelete }: PeriodRowProps) {
  const errorId = `period-${row.rowId}-error`;
  const invalid = new Set(errors.flatMap((error) => FIELD_TO_INPUTS[error.field] ?? []));

  // Bound to every field the parser complained about, not to the row. A red
  // border says nothing to a screen reader; this is what says it, and it is
  // read when the offending control takes focus.
  const describedBy = errors.length > 0 ? errorId : undefined;

  // The row's name is what makes the buttons distinguishable in a list of
  // eleven. An unnamed row falls back to its position, because "Delete" eleven
  // times over is a rotor full of nothing.
  const label = row.name.trim() === "" ? `period ${position + 1}` : row.name.trim();

  return (
    <li className="editrow">
      <div className="editrow__grid">
        <label className="editrow__field">
          <span className="editrow__labeltext visually-hidden">Name</span>
          <input
            type="text"
            data-field="name"
            value={row.name}
            maxLength={SCHEDULE_LIMITS.nameChars}
            aria-invalid={invalid.has("name") || undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(row.rowId, { name: event.target.value })}
          />
        </label>

        <label className="editrow__field">
          <span className="editrow__labeltext visually-hidden">Kind</span>
          <input
            type="text"
            data-field="kind"
            list={KIND_LIST_ID}
            value={row.kind}
            maxLength={SCHEDULE_LIMITS.kindChars}
            autoComplete="off"
            aria-invalid={invalid.has("kind") || undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(row.rowId, { kind: event.target.value })}
          />
        </label>

        <label className="editrow__field">
          <span className="editrow__labeltext visually-hidden">Start</span>
          {/*
            The placeholder is for the engines that do not implement
            `type="time"`, and it is not hypothetical: Playwright's WebKit
            reports `input.type === "text"` for this element, renders a bare
            text box, and does not sanitise the value the way a real time input
            must. Measured across all three engines - see Docs/build-log.md.

            Chrome and Firefox render their own segmented control and ignore a
            placeholder entirely, so this costs them nothing. Where it IS shown,
            it is the only thing telling a user what shape the field wants; the
            parser rejects anything else and says so, but "HH:MM" up front beats
            an error message after the fact.
          */}
          <input
            type="time"
            placeholder="HH:MM"
            data-field="start"
            value={row.start}
            aria-invalid={invalid.has("start") || undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(row.rowId, { start: event.target.value })}
          />
        </label>

        <label className="editrow__field">
          <span className="editrow__labeltext visually-hidden">End</span>
          <input
            type="time"
            placeholder="HH:MM"
            data-field="end"
            value={row.end}
            aria-invalid={invalid.has("end") || undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(row.rowId, { end: event.target.value })}
          />
        </label>

        <label className="editrow__field">
          <span className="editrow__labeltext visually-hidden">Length in minutes</span>
          <input
            type="number"
            data-field="length"
            value={row.length}
            // The floor is 1 rather than 0: a zero-length period is the one
            // invalid schedule a duration field could still express.
            min={1}
            max={24 * 60}
            step={1}
            inputMode="numeric"
            aria-invalid={invalid.has("length") || undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(row.rowId, { length: event.target.value })}
          />
        </label>

        <div className="editrow__move">
          <button
            type="button"
            className="editrow__movebutton"
            data-field="up"
            disabled={position === 0}
            aria-label={`Move ${label} earlier`}
            onClick={() => onMove(row.rowId, -1)}
          >
            <UpIcon />
          </button>
          <button
            type="button"
            className="editrow__movebutton"
            data-field="down"
            disabled={position === total - 1}
            aria-label={`Move ${label} later`}
            onClick={() => onMove(row.rowId, 1)}
          >
            <DownIcon />
          </button>
        </div>

        <button
          type="button"
          className="editrow__delete"
          data-field="delete"
          aria-label={`Delete ${label}`}
          onClick={() => onDelete(row.rowId)}
        >
          <CloseIcon />
        </button>
      </div>

      {errors.length > 0 && (
        <p className="editrow__error" id={errorId}>
          {errors.map((error) => error.message).join(" ")}
        </p>
      )}
    </li>
  );
}
