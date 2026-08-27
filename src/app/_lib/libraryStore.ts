"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_LIBRARY,
  STORAGE_KEY,
  loadLibrary,
  serializeLibrary,
  type Library,
} from "@/app/_lib/library";

/**
 * `localStorage`, as a React external store.
 *
 * The obvious shape - `useState(DEFAULT_LIBRARY)` plus a `useEffect` that reads
 * storage and calls `setLibrary` - is wrong twice over, and the repo's own lint
 * rule says so (`react-hooks/set-state-in-effect`). It causes a cascading
 * render on every mount, and it models a genuinely external, genuinely shared
 * thing as component state.
 *
 * `useSyncExternalStore` is the API for exactly this. It takes a server
 * snapshot, which is what makes hydration safe - the server has no
 * `localStorage`, so both sides render `DEFAULT_LIBRARY` on the first pass and
 * the stored value arrives with the first client snapshot.
 *
 * It also buys cross-tab sync for nothing: the `storage` event fires in every
 * OTHER tab on the origin, so editing a schedule in one tab updates the
 * countdown in the tab left open on the projector. That falls out of using the
 * right API rather than being a feature that had to be built.
 *
 * The module-level cache below is not a shortcut. `getSnapshot` must return a
 * referentially stable value or React re-renders forever, and `loadLibrary`
 * builds a fresh object every call - so the parsed result is memoised against
 * the raw string it came from.
 */

let cachedRaw: string | null = null;
let cached: Library = DEFAULT_LIBRARY;
let everRead = false;

/**
 * Whether storage can be used at all.
 *
 * Private mode, a full quota, or a browser configured to block site data make
 * `localStorage` throw on ACCESS, not just on write. Once that happens the
 * cache becomes the source of truth: re-reading would return the old value and
 * silently revert every edit the user makes, which is far worse than not
 * persisting them.
 */
let storageWorks = true;

const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    storageWorks = false;
    return null;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function onStorageEvent(event: StorageEvent) {
  // Fired only in other tabs, and for every key on the origin. `null` means
  // storage was cleared wholesale, which is also our business.
  if (event.key === null || event.key === STORAGE_KEY) emit();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (listeners.size === 1) window.addEventListener("storage", onStorageEvent);

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) window.removeEventListener("storage", onStorageEvent);
  };
}

function getSnapshot(): Library {
  if (!storageWorks) return cached;

  const raw = readRaw();
  if (!everRead || raw !== cachedRaw) {
    everRead = true;
    cachedRaw = raw;
    cached = loadLibrary(raw);
  }

  return cached;
}

/** The server has no storage, so it renders what a fresh install would. */
function getServerSnapshot(): Library {
  return DEFAULT_LIBRARY;
}

/**
 * Writes through, then tells React.
 *
 * The cache is updated BEFORE the write, so an edit lands on screen even when
 * storage throws. `AGENTS.md`: localStorage holds convenience, not truth -
 * losing a persisted edit is a disappointment, an editor that discards your
 * typing is a bug.
 */
export function saveLibrary(next: Library): void {
  const serialized = serializeLibrary(next);

  cached = next;
  cachedRaw = serialized;
  everRead = true;

  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    storageWorks = false;
  }

  emit();
}

export function useLibrary(): Library {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
