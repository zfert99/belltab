"use client";

import { useEffect, useRef } from "react";

/**
 * The one interruption in the app, and the two regressions it must not repeat.
 *
 * A native `<dialog>` opened with `showModal()` supplies focus trapping, an
 * inert background, Escape, and a real backdrop - all of which a hand-rolled
 * overlay has to fake and mostly fakes wrong. What it does NOT supply, and what
 * `window.confirm` used to give away for free, is isolation from the page's own
 * key handling:
 *
 * - **Escape bubbles.** A modal dialog is an ordinary element in an ordinary
 *   document, so its Escape keydown reaches `document`, and the dialog's own
 *   close is only the DEFAULT ACTION of that same event - a document listener
 *   runs FIRST. `App.tsx` is what guards against that, by bailing while a
 *   `dialog[open]` is on the page. See Bugs found, 2026-08-26.
 * - **`showModal` is not universal.** Where it is missing, a dialog rendered
 *   with no `open` attribute is simply invisible, so a delete flow that assumed
 *   it worked would delete without ever asking. jsdom is exactly such an
 *   environment - as of jsdom 30 it still implements neither `showModal` nor
 *   `close` - so the caller feature-detects and falls back to `window.confirm`.
 *
 * Rendered always and toggled through the effect rather than mounted on demand:
 * `showModal()` has to be called on an element that is already in the document.
 */

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Say what cannot be undone. That is the whole reason to interrupt someone. */
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Whether this browser can show a real modal, or the caller needs the fallback. */
export function supportsModalDialog(): boolean {
  return (
    typeof HTMLDialogElement === "function" &&
    typeof HTMLDialogElement.prototype.showModal === "function"
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null || typeof dialog.showModal !== "function") return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();

    // Closing on unmount is what covers leaving settings while the dialog is
    // up. The inert background makes most of those routes unreachable, but a
    // browser that fell back to a non-modal `show()` has no inertness to hide
    // behind - and a stranded modal is a page nobody can click.
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      className="confirm"
      id="confirm-dialog"
      ref={dialogRef}
      aria-labelledby="confirm-title"
      onClose={onCancel}
    >
      {/*
        `method="dialog"` closes the dialog on submit without navigating, which
        is what makes Enter behave. Cancel is FIRST in the DOM deliberately:
        showModal() focuses the first focusable descendant, and the destructive
        button must never be the one a stray Enter lands on.
      */}
      <form method="dialog" className="confirm__form">
        <h3 className="confirm__title" id="confirm-title">
          {title}
        </h3>
        <p className="confirm__body" id="confirm-body">
          {body}
        </p>
        <div className="confirm__actions">
          <button type="submit" className="minibutton" value="cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="minibutton minibutton--danger"
            id="confirm-ok"
            value="confirm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
