"use client";

import { useState, type RefObject } from "react";
import { SCHEDULE_LIMITS } from "@/lib/parse";
import { copyText, shareUrlFor } from "@/app/_lib/shareLink";
import {
  createSchedule,
  deleteSchedule,
  duplicateSchedule,
  type Library,
} from "@/app/_lib/library";
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
  headingRef: RefObject<HTMLHeadingElement | null>;
}

export function SchedulesPanel({
  library,
  save,
  selected,
  onSelect,
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
      if (window.confirm(`Delete "${schedule.name}"? This cannot be undone.`)) applyDelete();
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
        Periods are kept in start order and cannot overlap. Every valid change is saved to this
        browser as you type; the countdown keeps running on the last version that made sense.
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
              onClick={() => onSelect(at)}
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
              ? "Link copied. It carries this schedule and nothing else — not your calendar, and not the rest of your library."
              : "This browser would not let BellTab reach the clipboard. Copy the link by hand:"}
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
        <p className="panel__note">There are no schedules. New schedule above starts one.</p>
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
        body={`"${schedule?.name ?? ""}" and its periods will be removed from this browser, and any day pointing at it falls back to no school. This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setConfirming(false)}
        onConfirm={applyDelete}
      />
    </div>
  );
}
