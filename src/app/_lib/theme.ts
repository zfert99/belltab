/**
 * The theme choice, and the script that applies it before the first paint.
 *
 * Both live in one file on purpose. The script below cannot import anything -
 * it runs before a single module has loaded - so it repeats the storage key and
 * the two theme names as literals. Keeping the copy NEXT TO the original is the
 * cheapest way to make the duplication visible to whoever changes one of them,
 * and `preferences.test.ts` asserts the two still agree.
 */

/**
 * `"system"` is a real choice, not the absence of one.
 *
 * It means "follow `prefers-color-scheme`", which globals.css already
 * implements: the dark tokens live behind `@media (prefers-color-scheme: dark)`
 * guarded by `:root:not([data-theme="light"])`, and are repeated under
 * `:root[data-theme="dark"]` so an explicit choice beats the OS in BOTH
 * directions. So the whole of applying a theme is: set the attribute for
 * `light`/`dark`, remove it for `system`.
 */
export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** The attribute globals.css branches on. Absent means "follow the OS". */
export const THEME_ATTRIBUTE = "data-theme";

/**
 * Puts the choice on `<html>`, where the CSS can see it.
 *
 * Removing the attribute rather than setting it to `"system"` is what makes the
 * media query win again: `:root:not([data-theme="light"])` would still match a
 * `data-theme="system"` root, but `:root[data-theme="dark"]` would not, so a
 * stray value would work by accident today and break the moment a third
 * explicit theme is added.
 */
export function applyTheme(root: HTMLElement, theme: Theme): void {
  if (theme === "light" || theme === "dark") root.setAttribute(THEME_ATTRIBUTE, theme);
  else root.removeAttribute(THEME_ATTRIBUTE);
}

/**
 * The same thing again, as a string, to run before anything else on the page.
 *
 * **Why this exists at all:** the theme lives in `localStorage`, which the
 * server cannot read, so the HTML ships with no `data-theme` and a user who has
 * forced light while their OS is dark gets a frame of the wrong palette before
 * React mounts. That flash was solved in the retired plain build by exactly this
 * script, and re-opened when the build was retired; see Open gaps in
 * Docs/build-log.md.
 *
 * **Why it is inline rather than a file in `public/`:** an external script has
 * to be fetched before it can run, and a fetch - even a cached one - is a window
 * in which the page can paint. Inline is the only version with no window at all.
 *
 * **Why it is unhashed, which was not the plan:** a hash is only worth having
 * alongside a real `script-src`, and this app cannot ship one. Next emits two
 * inline scripts of its own into every page (a 43-byte bootstrap and ~5 KB of
 * flight data whose bytes change with every build), so a hash-based
 * `script-src` would block the framework's own hydration. The supported answer
 * is a per-request nonce from middleware, and this repo ships no `middleware.ts`
 * on purpose - see the CVE-2025-29927 rule in AGENTS.md. Measured, not assumed;
 * the numbers and the decision are in Docs/build-log.md.
 *
 * Kept to one statement with a `try` around the whole of it. `localStorage`
 * throws on ACCESS in private mode and under a block-site-data setting, and a
 * theme script that throws takes the page's first script with it.
 */
export const THEME_SCRIPT = `try{var t=JSON.parse(localStorage.getItem("belltab.prefs.v1")).theme;if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

/** The attribute globals.css branches on for the in-app motion override. */
export const MOTION_ATTRIBUTE = "data-motion";

/**
 * Puts the motion choice on `<html>`, beside the theme.
 *
 * The attribute is present only when the user has asked for less; absent means
 * "follow the OS", and the `prefers-reduced-motion` media query keeps deciding.
 * No pre-paint script for this one: a frame of animation before React mounts
 * is not the flash a wrong palette is, and nothing animates on first paint
 * except the period name's 150ms fade.
 */
export function applyMotion(root: HTMLElement, reduce: boolean): void {
  if (reduce) root.setAttribute(MOTION_ATTRIBUTE, "reduce");
  else root.removeAttribute(MOTION_ATTRIBUTE);
}
