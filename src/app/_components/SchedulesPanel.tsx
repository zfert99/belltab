"use client";

import { useState, type KeyboardEvent, type RefObject } from "react";
import { SCHEDULE_LIMITS } from "@/lib/parse";
import { copyText, shareUrlFor } from "@/app/_lib/shareLink";
import {
  createSchedule,
  deleteSchedule,
  duplicateSchedule,
  type Library,
} from "@/app/_lib/library";
import { scheduleIndexToEdit, scheduleNameOn } from "@/app/_lib/today";
import type { LocalNow } from "@/lib/clock";
import { ScheduleEditor } from "@/app/_components/ScheduleEditor";
import { ConfirmDialog, supportsModalDialog } from "@/app/_components/ConfirmDialog";

/**
 * The schedules the library holds, and which one the editor is pointed at.
 *
 * Selection is an INDEX, not an id, which is the decision the editor already
 * made when it replaces a schedule positionally. The picker is a positional row
 * of chips, and an index survives a rename - the edit that happens most.
 *
 * The index is CLAMPED rather than corrected on delete. A selection pointing
 * past the end of a now-shorter library is the ordinary consequence of deleting
 * the last chip, and clamping renders the neighbour instead of an empty panel.
 */

export interface SchedulesPanelProps {
  library: Library;
  save: (next: Library) => void;
  selected: number;
  onSelect: (index: number) => void;
  /** For one sentence: whether the schedule being deleted is today's. */
  now: LocalNow | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

export function SchedulesPanel({
  library,
  save,
  selected,
  onSelect,
  now,
  headingRef,
}: SchedulesPanelProps) {
  const [confirming, setConfirming] = useState(false);

  /**
   * The share link, and what happened to it.
   *
   * `null` is "nobody has asked". A string is the link, shown either as
   * confirmation that it was copied or as something to copy by hand where the
   * clipboard was refused - which is a real state, not a theoretical one: the
   * Clipboard API needs a secure context and can be denied by policy.
   */
  const [link, setLink] = useState<{ url: string; copied: boolean } | null>(null);

  const count = library.schedules.length;
  const index = count === 0 ? null : Math.min(Math.max(selected, 0), count - 1);
  const schedule = index === null ? null : library.schedules[index];

  // Whether the selected schedule is the one the countdown is running RIGHT
  // NOW. `scheduleIndexToEdit` falls back to index 0 when today resolves to
  // nothing, so it is only "today's" when today actually resolves to it.
  const runningToday =
    index !== null &&
    now !== null &&
    scheduleNameOn(library, now.isoDate, now.weekday) !== null &&
    scheduleIndexToEdit(library, now) === index;

  /**
   * Arrow keys walk the chips, and selection follows focus.
   *
   * The chips were a `role="group"` of ordinary buttons - correct, and five
   * Tabs to reach the fifth schedule, above an editor that is already
   * seventy-seven stops deep. Roving `tabIndex` makes the group one stop and
   * the arrows do the rest, which is what an ARIA tablist would have brought
   * without the rest of that contract. Home and End go to the ends; the arrows
   * stop at them rather than wrapping, so "where am I" stays answerable.
   */
  const onChipKeyDown = (event: KeyboardEvent<HTMLButtonElement>, at: number) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity }[event.key];
    if (step === undefined) return;

    event.preventDefault();
    const next = Math.min(Math.max(at + step, 0), count - 1);
    if (next === at) return;

    onSelect(next);
    (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  };
  const atScheduleLimit = count >= SCHEDULE_LIMITS.schedules;

  const applyDelete = () => {
    setConfirming(false);
    if (index !== null) save(deleteSchedule(library, index));
  };

  /**
   * Interrupts, or asks the browser to, depending on what the browser has.
   *
   * The `window.confirm` branch is not a nicety: without it, a browser missing
   * `showModal` renders a dialog that never becomes visible, and the delete
   * either never happens or - in the version this repo actually shipped -
   * happens without asking. See Bugs found, 2026-08-26.
   */
  const requestDelete = () => {
    if (schedule === null) return;

    if (!supportsModalDialog()) {
      if (window.confirm(`Delete “${schedule.name}”? This can’t be undone.`)) applyDelete();
      return;
    }

    setConfirming(true);
  };

  return (
    <div className="panel" id="panel-schedules">
      <h2 className="panel__title" id="settings-title" tabIndex={-1} ref={headingRef}>
        Schedules
      </h2>
      <p className="panel__note">
        Periods stay in start order and can&rsquo;t overlap. Changes save automatically. The
        countdown runs on the most recent valid version of the schedule.
      </p>

      <div className="schedpicker">
        {/*
          A group of pressed-state buttons rather than a radiogroup or a tablist:
          picking a schedule swaps what the editor below is editing, and the chip
          that is on stays visible as the answer to "which one am I changing".
          `aria-pressed` is what says that to a screen reader.
        */}
        <div className="schedpicker__list" id="schedule-list" role="group" aria-label="Schedules">
          {library.schedules.map((entry, at) => (
            <button
              key={entry.id}
              type="button"
              className="schedchip"
              aria-pressed={at === index}
              tabIndex={at === index ? 0 : -1}
              onClick={() => onSelect(at)}
              onKeyDown={(event) => onChipKeyDown(event, at)}
            >
              {entry.name}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="schedpicker__new"
          id="schedule-new"
          disabled={atScheduleLimit}
          onClick={() => {
            onSelect(count);
            save(createSchedule(library));
          }}
        >
          New schedule
        </button>
      </div>

      <div className="editor__actions">
        <button
          type="button"
          className="minibutton"
          id="schedule-duplicate"
          disabled={schedule === null || atScheduleLimit}
          onClick={() => {
            if (index === null) return;
            onSelect(index + 1);
            save(duplicateSchedule(library, index));
          }}
        >
          Duplicate
        </button>
        <button
          type="button"
          className="minibutton"
          id="schedule-share"
          disabled={schedule === null}
          onClick={() => {
            if (schedule === null) return;
            void shareUrlFor(schedule).then(async (url) => {
              setLink({ url, copied: await copyText(url) });
            });
          }}
        >
          Copy share link
        </button>
        <button
          type="button"
          className="minibutton minibutton--danger"
          id="schedule-delete"
          disabled={schedule === null}
          onClick={requestDelete}
        >
          Delete schedule
        </button>
      </div>

      {link !== null && (
        <div className="sharelink" id="share-link">
          <p className="panel__note" id="share-link-status">
            {link.copied
              ? "Link copied. It carries this schedule only — not your calendar, and not your other schedules."
              : "This browser wouldn’t let BellTab use the clipboard. Copy the link by hand:"}
          </p>
          {/*
            Always rendered, not only on failure. A user who was told "copied"
            and wants to check, or who wants to see how long the thing is
            before pasting it into a message, has nowhere else to look - and a
            read-only input is the one control that reliably supports
            select-all on every platform.
          */}
          <label className="sharelink__field">
            <span className="visually-hidden">Share link</span>
            <input type="text" id="share-link-url" readOnly value={link.url} />
          </label>
        </div>
      )}

      {schedule === null || index === null ? (
        <p className="panel__note">No schedules yet. Use New schedule above to start one.</p>
      ) : (
        /*
          Keyed on position AND identity. Position alone would keep the same
          component mounted when the schedule at index 0 is deleted and its
          neighbour slides into place, leaving the editor holding a draft of a
          schedule that no longer exists. Identity alone would never remount on
          a selection change between two chips. Neither changes on a rename,
          which is what keeps the cursor in the name field.
        */
        <ScheduleEditor
          key={`${index}:${schedule.id}`}
          schedule={schedule}
          library={library}
          save={save}
        />
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this schedule?"
        body={
          `This removes “${schedule?.name ?? ""}” and its periods from this browser. Any day that used it will have no school.` +
          // The case the generic sentence hid: this is the schedule the
          // countdown is showing RIGHT NOW, and it goes blank the moment the
          // dialog closes. That information sat one panel away.
          (runningToday ? " It’s the schedule running today — the countdown will go blank." : "") +
          " This can’t be undone."
        }
        confirmLabel="Delete"
        onCancel={() => setConfirming(false)}
        onConfirm={applyDelete}
      />
    </div>
  );
}
