"use client";

import { createLocalStore } from "@/app/_lib/localStore";
import {
  DEFAULT_LIBRARY,
  STORAGE_KEY,
  loadLibrary,
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
 */
const store = createLocalStore<Library>({
  key: STORAGE_KEY,
  fallback: DEFAULT_LIBRARY,
  load: loadLibrary,
  serialize: serializeLibrary,
});

export const saveLibrary = store.save;

export function useLibrary(): Library {
  return store.useValue();
}
