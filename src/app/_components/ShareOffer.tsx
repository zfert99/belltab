"use client";

import type { ValidSchedule } from "@/lib/schedule";

/**
 * "Somebody sent you a schedule. Add it?"
 *
 * Shown above everything, on whichever screen is up, because a link is how a
 * user arrives rather than something they went looking for in settings.
 *
 * **Nothing is added until it is accepted.** A link that silently wrote to
 * somebody's library would make every URL in a group chat a change to their
 * app, and `AGENTS.md` is explicit that a malicious link must be able to
 * produce, at worst, a silly schedule. Requiring a press is what keeps that
 * true: the worst a link can do is show its own name and be dismissed.
 *
 * The name is rendered as text, never as markup. It is a string from a
 * stranger.
 */

export interface ShareOfferProps {
  /** The decoded schedule, or the reason the link did not decode. */
  offer: { kind: "schedule"; schedule: ValidSchedule } | { kind: "error"; message: string };
  onAdd: () => void;
  onDismiss: () => void;
}

export function ShareOffer({ offer, onAdd, onDismiss }: ShareOfferProps) {
  if (offer.kind === "error") {
    return (
      <aside className="offer offer--error" id="share-offer">
        <p className="offer__text" id="share-offer-text">
          {offer.message}
        </p>
        <div className="offer__actions">
          <button type="button" className="minibutton" id="share-dismiss" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </aside>
    );
  }

  const { schedule } = offer;
  const periods = schedule.periods.length;

  return (
    <aside className="offer" id="share-offer">
      <p className="offer__text" id="share-offer-text">
        Someone shared a schedule called <strong>{schedule.name}</strong>, with {periods}{" "}
        {periods === 1 ? "period" : "periods"}. It&rsquo;s showing now. Keep it and it runs
        today; your other days aren&rsquo;t changed.
      </p>
      <div className="offer__actions">
        <button type="button" className="minibutton" id="share-add" onClick={onAdd}>
          Keep it
        </button>
        <button type="button" className="minibutton" id="share-dismiss" onClick={onDismiss}>
          No thanks
        </button>
      </div>
    </aside>
  );
}
