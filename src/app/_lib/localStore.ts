"use client";

import { useSyncExternalStore } from "react";

/**
 * `localStorage`, as a React external store. One factory, one key each.
 *
 * The obvious shape - `useState(DEFAULT)` plus a `useEffect` that reads storage
 * and calls `setState` - is wrong twice over, and the repo's own lint rule says
 * so (`react-hooks/set-state-in-effect`). It causes a cascading render on every
 * mount, and it models a genuinely external, genuinely shared thing as component
 * state.
 *
 * `useSyncExternalStore` is the API for exactly this. It takes a server
 * snapshot, which is what makes hydration safe - the server has no
 * `localStorage`, so both sides render the default on the first pass and the
 * stored value arrives with the first client snapshot.
 *
 * It also buys cross-tab sync for nothing: the `storage` event fires in every
 * OTHER tab on the origin, so editing a schedule in one tab updates the
 * countdown in the tab left open on the projector. That falls out of using the
 * right API rather than being a feature that had to be built.
 *
 * **Why a factory, when Phase 3 wrote this once by hand for the library:**
 * Phase 6 adds a second key - preferences, which deliberately do NOT travel with
 * a schedule and therefore cannot share the library's key. The choice was two
 * copies of the file below or one parameterised copy, and the caching rules here
 * are subtle enough (see `getSnapshot`) that a second hand-written copy is a
 * second place for them to be got subtly wrong.
 */

export interface LocalStore<T> {
  /**
   * Named `use…` so `react-hooks/rules-of-hooks` recognises it. It is a real
   * hook and obeys every rule of one; callers re-export it under a domain name.
   */
  useValue(): T;
  save(next: T): void;
}

export interface LocalStoreOptions<T> {
  /** The `localStorage` key. Version it; never repurpose a version. */
  key: string;
  /** What a fresh install - and every server render - starts with. */
  fallback: T;
  /** The stored string to a value. Must not throw; every failure degrades. */
  load: (raw: string | null) => T;
  serialize: (value: T) => string;
}

export function createLocalStore<T>({
  key,
  fallback,
  load,
  serialize,
}: LocalStoreOptions<T>): LocalStore<T> {
  /**
   * The cache below is not a shortcut. `getSnapshot` must return a
   * referentially stable value or React re-renders forever, and `load` builds a
   * fresh object every call - so the parsed result is memoised against the raw
   * string it came from.
   */
  let cachedRaw: string | null = null;
  let cached: T = fallback;
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
      return window.localStorage.getItem(key);
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
    if (event.key === null || event.key === key) emit();
  }

  function subscribe(onChange: () => void): () => void {
    listeners.add(onChange);
    if (listeners.size === 1) window.addEventListener("storage", onStorageEvent);

    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) window.removeEventListener("storage", onStorageEvent);
    };
  }

  function getSnapshot(): T {
    if (!storageWorks) return cached;

    const raw = readRaw();
    if (!everRead || raw !== cachedRaw) {
      everRead = true;
      cachedRaw = raw;
      cached = load(raw);
    }

    return cached;
  }

  /** The server has no storage, so it renders what a fresh install would. */
  function getServerSnapshot(): T {
    return fallback;
  }

  /**
   * Writes through, then tells React.
   *
   * The cache is updated BEFORE the write, so an edit lands on screen even when
   * storage throws. `AGENTS.md`: localStorage holds convenience, not truth -
   * losing a persisted edit is a disappointment, an editor that discards your
   * typing is a bug.
   */
  function save(next: T): void {
    const serialized = serialize(next);

    cached = next;
    cachedRaw = serialized;
    everRead = true;

    try {
      window.localStorage.setItem(key, serialized);
    } catch {
      storageWorks = false;
    }

    emit();
  }

  function useValue(): T {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  }

  return { useValue, save };
}
