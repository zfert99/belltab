"use client";

import { decodeShare, encodeSchedule } from "@/lib/share";
import type { ParseResult } from "@/lib/parse";
import type { Schedule, ValidSchedule } from "@/lib/schedule";

/**
 * The share pipeline's two ends, wired to the address bar.
 *
 * `src/lib/share.ts` is pure and knows nothing about a page. This is the thin
 * layer that does: it builds a whole URL to copy, reads the one the app was
 * opened with, and takes the fragment back off the address bar once it has been
 * dealt with. Nothing here parses anything - that is the boundary's job, and it
 * stays in `src/lib/`.
 */

/**
 * The link a user copies.
 *
 * Built from `location` at call time rather than from a constant, so it carries
 * whatever origin and `basePath` the app is actually being served from. A
 * hard-coded `biscuitlab.net/bell` would produce links that do not work in
 * development and would keep working just well enough that nobody noticed.
 *
 * The search string is dropped and the fragment replaced: a share link is the
 * app plus a schedule, not the app plus whatever state the sender's tab was in.
 */
export async function shareUrlFor(schedule: Schedule): Promise<string> {
  const encoded = await encodeSchedule(schedule);
  return `${window.location.origin}${window.location.pathname}#${encoded}`;
}

/**
 * Whatever schedule the current URL is carrying, if it is carrying one.
 *
 * Returns `null` for no fragment at all, which is the ordinary case and is not
 * an error - the app is usually opened without a link. A fragment that is
 * present and does not decode IS an error, and is returned as one so the user
 * can be told their link is broken rather than left staring at a normal app.
 */
export async function incomingSchedule(): Promise<ParseResult<ValidSchedule> | null> {
  const fragment = window.location.hash;
  if (fragment === "" || fragment === "#") return null;

  return decodeShare(fragment);
}

/**
 * Takes the fragment off the address bar without reloading or adding history.
 *
 * `replaceState` rather than assigning `location.hash = ""`, which leaves a bare
 * `#` behind and pushes an entry, so Back would walk the user through every
 * link they had ever dismissed.
 *
 * Called once the link has been accepted or dismissed, so that a refresh does
 * not offer the same schedule again - and, more importantly, so the URL stops
 * carrying a schedule the user may not want in their history. `AGENTS.md`:
 * full URLs land in browser history and history sync.
 */
export function clearShareFragment(): void {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

/**
 * Copies text, and says whether it managed it.
 *
 * The Clipboard API needs a secure context and a user gesture, and can be
 * refused outright by permission policy. Every one of those is a real state on
 * somebody's machine rather than a theoretical one, which is why this returns a
 * boolean instead of throwing: the caller shows the link for manual copying
 * rather than an error, because the user's goal is the link and not the
 * clipboard.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
