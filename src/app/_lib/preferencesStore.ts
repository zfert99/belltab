"use client";

import { createLocalStore } from "@/app/_lib/localStore";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  loadPreferences,
  serializePreferences,
  type Preferences,
} from "@/app/_lib/preferences";

/**
 * The theme and the bell offset, persisted - under their own key.
 *
 * A separate key rather than a corner of the library's, because they are a
 * different KIND of thing: the library is the user's data, exported, imported
 * and shared, while these are settings for one browser on one device. Sharing a
 * key would put a measured clock skew into every share link; see the note at the
 * top of `preferences.ts`.
 *
 * Same store, same cross-tab sync: changing the theme in one tab repaints the
 * one left open on the projector, for free.
 */
const store = createLocalStore<Preferences>({
  key: PREFERENCES_KEY,
  fallback: DEFAULT_PREFERENCES,
  load: loadPreferences,
  serialize: serializePreferences,
});

export const savePreferences = store.save;

export function usePreferences(): Preferences {
  return store.useValue();
}
