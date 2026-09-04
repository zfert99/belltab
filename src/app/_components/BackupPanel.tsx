"use client";

import { useRef, useState, type RefObject } from "react";
import type { LocalNow } from "@/lib/clock";
import {
  parseLibrary,
  replaceLibrary,
  serializeLibrary,
  type Library,
} from "@/app/_lib/library";
import { ConfirmDialog, supportsModalDialog } from "@/app/_components/ConfirmDialog";

/**
 * Export and import, which the plan calls the durable backup.
 *
 * Plain readable JSON, the same shape `localStorage` holds, so a user who opens
 * either sees the same file. No compression: that is the share link's job, where
 * the bytes have to fit in a URL. A backup is a file, and a file people can read
 * is worth more than a file that is small.
 *
 * Import is the one genuinely destructive action in the app - it discards every
 * schedule and the whole calendar at once - so it goes through the same
 * confirmation the schedule delete does, and the parse happens BEFORE the
 * confirmation. Asking "replace everything?" and then discovering the file was
 * unreadable would be the wrong order to find that out in.
 */

export interface BackupPanelProps {
  library: Library;
  save: (next: Library) => void;
  now: LocalNow | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

export function BackupPanel({ library, save, now, headingRef }: BackupPanelProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scheduleCount = library.schedules.length;
  const exceptionCount = library.calendar.overrides.length;

  /**
   * Writes the file the way a page has to: an object URL behind a link that is
   * clicked and thrown away.
   *
   * The URL is revoked immediately afterwards. It is a handle into this
   * document's memory, and one left behind for every export is a leak that
   * lasts as long as the tab does.
   */
  const exportLibrary = () => {
    const blob = new Blob([serializeLibrary(library)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    // Dated, because the whole point of a backup is having more than one.
    link.download = now === null ? "belltab-backup.json" : `belltab-${now.isoDate}.json`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const chooseFile = async (file: File) => {
    setError(null);
    setPending(null);

    const parsed = parseLibrary(await file.text());
    if (!parsed.ok) {
      setError(parsed.errors[0].message);
      return;
    }

    if (!supportsModalDialog()) {
      if (window.confirm(`Replace all ${scheduleCount} schedules and the calendar? This can’t be undone.`)) {
        save(replaceLibrary(library, parsed.value));
      }
      return;
    }

    setPending(parsed.value);
  };

  const applyImport = () => {
    if (pending !== null) save(replaceLibrary(library, pending));
    setPending(null);
  };

  return (
    <div className="panel" id="panel-backup">
      <h2 className="panel__title" id="settings-title" tabIndex={-1} ref={headingRef}>
        Backup
      </h2>
      <p className="panel__note">
        Everything BellTab knows lives in this browser. Export it to a file you keep, and import
        that file to bring it back &mdash; here, or on another device.
      </p>

      <section className="calsection">
        <h3 className="calsection__title">Export</h3>
        <p className="panel__note" id="backup-summary">
          {scheduleCount} {scheduleCount === 1 ? "schedule" : "schedules"} and {exceptionCount}{" "}
          dated {exceptionCount === 1 ? "exception" : "exceptions"}, as plain JSON you can read.
        </p>
        <div className="editor__actions">
          <button type="button" className="minibutton" id="backup-export" onClick={exportLibrary}>
            Export a backup
          </button>
        </div>
      </section>

      <section className="calsection">
        <h3 className="calsection__title">Import</h3>
        <p className="panel__note">
          Importing <strong>replaces everything</strong> &mdash; every schedule and the whole
          calendar. Export first if you want to keep what&rsquo;s here.
        </p>

        {/*
          A VISIBLE label, not a hidden one. There is no column header here to
          name this control the way the editor's rows have, and "Choose File"
          is the browser's word for the button, not a description of what the
          file is meant to be.
        */}
        <label className="backup__file">
          <span className="weekday__name">Choose a backup file</span>
          <input
            type="file"
            id="backup-import"
            ref={fileRef}
            accept="application/json,.json"
            aria-describedby={error === null ? undefined : "backup-error"}
            aria-invalid={error === null ? undefined : true}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Cleared so choosing the SAME file twice fires a change event
              // again - a user who fixes a bad file and re-picks it otherwise
              // gets silence.
              event.target.value = "";
              if (file !== undefined) void chooseFile(file);
            }}
          />
        </label>

        {error !== null && (
          <p className="editor__error" id="backup-error">
            {error}
          </p>
        )}
      </section>

      <ConfirmDialog
        open={pending !== null}
        title="Replace everything?"
        body={`This backup holds ${pending?.schedules.length ?? 0} schedules. Importing it replaces the ${scheduleCount} in this browser, and the whole calendar with them. This can’t be undone.`}
        confirmLabel="Import"
        onCancel={() => setPending(null)}
        onConfirm={applyImport}
      />
    </div>
  );
}
