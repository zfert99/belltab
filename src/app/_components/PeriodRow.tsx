"use client";

import { PERIOD_KINDS, type PeriodKind } from "@/lib/schedule";
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
 * **Length, not end time.** The fourth field is a duration, because "Period 2
 * is 55 minutes" is how a schedule is actually described - and because it makes
 * `start >= end` unreachable by typing. The engine still stores `endMin`;
 * `draft.ts` does the arithmetic.
 *
 * **Reorder is two buttons, not a drag.** `AGENTS.md` requires keyboard-
 * operable reordering, and a pair of buttons is keyboard-operable by
 * construction rather than by adding a keyboard fallback to a pointer gesture.
 */

const KIND_LABELS: Record<PeriodKind, string> = {
  [PERIOD_KINDS.CLASS]: "Class",
  [PERIOD_KINDS.LUNCH]: "Lunch",
  [PERIOD_KINDS.PASSING]: "Passing",
};

/**
 * The parser names its fields after the SCHEDULE, the form after its inputs.
 *
 * `endMin` is reported against the length box because that is the control a
 * user would change to fix it - the parser has no idea the form took the end
 * time apart into a start and a duration.
 */
const FIELD_TO_INPUT: Record<string, "name" | "kind" | "start" | "length"> = {
  name: "name",
  kind: "kind",
  startMin: "start",
  endMin: "length",
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
  const invalid = new Set(errors.map((error) => FIELD_TO_INPUT[error.field]).filter(Boolean));

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
          <select
            data-field="kind"
            value={row.kind}
            aria-invalid={invalid.has("kind") || undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(row.rowId, { kind: event.target.value as PeriodKind })}
          >
            {Object.values(PERIOD_KINDS).map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>

        <label className="editrow__field">
          <span className="editrow__labeltext visually-hidden">Start</span>
          <input
            type="time"
            data-field="start"
            value={row.start}
            aria-invalid={invalid.has("start") || undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(row.rowId, { start: event.target.value })}
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
