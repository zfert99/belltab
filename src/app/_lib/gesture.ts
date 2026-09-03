"use client";

/**
 * "The next time the user touches the page" - one definition, two callers.
 *
 * The chime waits for a gesture to lift the autoplay lock; the wake lock waits
 * for one to retry a refusal. Both are the same idea - a browser or an OS said
 * no, the reason will clear without any event the tab can hear, and the honest
 * moment to ask again is the next thing the user does. Defining "a touch" in
 * one place means a correction (an engine that fires no `pointerdown`, a
 * passive-listener need) reaches both at once instead of one.
 *
 * Key auto-repeat is filtered: a held Backspace in the editor is one gesture,
 * not thirty a second, and the callers do real work per call.
 */
export function listenForGesture(handler: () => void): () => void {
  const onPointer = () => handler();
  const onKey = (event: KeyboardEvent) => {
    if (!event.repeat) handler();
  };

  window.addEventListener("pointerdown", onPointer);
  window.addEventListener("keydown", onKey);

  return () => {
    window.removeEventListener("pointerdown", onPointer);
    window.removeEventListener("keydown", onKey);
  };
}
