"use client";

import { useSyncExternalStore } from "react";
import { createLocalStore } from "@/app/_lib/localStore";
import {
  DEFAULT_LIBRARY,
  STORAGE_KEY,
  loadLibraryReport,
  serializeLibrary,
  type Library,
} from "@/app/_lib/library";

/**
 * The schedules and the calendar, persisted.
 *
 * Phase 3 wrote the `useSyncExternalStore` plumbing here by hand; Phase 6 moved
 * it into `localStore.ts` unchanged so preferences could have their own key
 * without a second copy of it. The reasoning that used to live in this file -
 * why an external store rather than state, why the module-level cache is
 * load-bearing, why a throwing `localStorage` must not fall back to re-reading -
 * moved with the code and is still worth reading before touching either.
 *
 * **Since 2026-09-05 this file also owns what happens when the stored value
 * cannot be read.** The store degrades to the seeded defaults, as it always
 * did and as `loadLibrary` argues it must. What it did NOT do was say so, and
 * the first save then wrote the defaults over whatever was there. Found in
 * review by planting one bad period: four user schedules on disk, four seeded
 * ones on screen, no message, and one keystroke from losing the four on disk.
 * Three things fix that, all here: the problem is REPORTED (`useLibraryProblem`),
 * the unreadable bytes are QUARANTINED under their own key the first time
 * anything is saved (`saveLibrary`), and the banner that reads the report can
 * hand the bytes back as a file. Nothing is destroyed; nothing blocks.
 */

/**
 * Where the unreadable value goes the moment a save would otherwise overwrite
 * it. One slot, not a history: a second unreadable value replaces the first,
 * which is the right trade for something that happens roughly never and costs
 * hundreds of bytes when it does.
 */
export const UNREADABLE_KEY = `${STORAGE_KEY}.unreadable`;

export interface LibraryProblem {
  /** Storage-voiced, from `loadLibraryReport`. */
  message: string;
  /** The exact string that could not be read. What Download hands back. */
  raw: string;
}

/**
 * Set inside `load` - which runs inside `getSnapshot`, which runs during
 * render. That is the same discipline `localStore.ts` already uses for its own
 * cache: assign, never emit, so no subscriber is poked mid-render. The hook
 * below re-reads this on every render, and the library store's own emit is
 * what re-renders `App` when the stored value changes, so the two stay in step
 * without a second notification.
 */
let problem: LibraryProblem | null = null;

/**
 * Survives `dismissLibraryProblem` on purpose. Dismissing the banner is "stop
 * telling me", not "throw it away" - the quarantine still happens on the first
 * save. Cleared only once the bytes are safely under `UNREADABLE_KEY`.
 */
let awaitingQuarantine: string | null = null;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

const store = createLocalStore<Library>({
  key: STORAGE_KEY,
  fallback: DEFAULT_LIBRARY,
  load: (raw) => {
    const report = loadLibraryReport(raw);

    // `raw === null` is a fresh install, not a problem, and `loadLibraryReport`
    // already answers `null` for it; the check is here so the narrowing is
    // visible where `raw` is captured.
    if (report.problem === null || raw === null) {
      problem = null;
    } else {
      problem = { message: report.problem, raw };
      awaitingQuarantine = raw;
    }

    return report.library;
  },
  serialize: serializeLibrary,
});

/**
 * Writes through - but FIRST moves an unreadable value out of the way.
 *
 * Order is the whole point: quarantine, then overwrite. Reversed, the first
 * edit after a bad load would destroy the only copy of what the user had. A
 * `setItem` that throws (quota, private mode) is swallowed exactly as the
 * store's own writes are, and the banner's Download button remains the other
 * route to the same bytes.
 */
export function saveLibrary(next: Library): void {
  if (awaitingQuarantine !== null) {
    try {
      window.localStorage.setItem(UNREADABLE_KEY, awaitingQuarantine);
    } catch {
      // Not persisted; the download path still holds the bytes in memory.
    }
    awaitingQuarantine = null;
  }

  store.save(next);
}

export function useLibrary(): Library {
  return store.useValue();
}

const problemServerSnapshot = (): null => null;

/** `null` unless something WAS saved and could not be read. */
export function useLibraryProblem(): LibraryProblem | null {
  return useSyncExternalStore(subscribe, () => problem, problemServerSnapshot);
}

/** Hides the banner for this load. The quarantine is unaffected - see above. */
export function dismissLibraryProblem(): void {
  if (problem === null) return;
  problem = null;
  emit();
}
