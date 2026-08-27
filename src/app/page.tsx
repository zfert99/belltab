/**
 * A shell, not the app.
 *
 * Phase 1 landed the schedule engine - `src/lib/` is typed, parsed at the
 * boundary and covered by the unit suite - and retired the plain HTML/CSS/JS
 * build that used to render it, because a browser cannot load a `.ts` module.
 * The countdown itself arrives in Phase 2.
 *
 * Nothing here reads the clock. A time-dependent value rendered on the server
 * hydrate-mismatches by definition, so the countdown arrives as a client
 * component rather than being retrofitted onto this file.
 */
export default function Page() {
  return (
    <main className="screen">
      <h1>BellTab</h1>
      <p>
        The schedule engine has landed. The countdown, the day view and the
        editor are rebuilt on top of it in the phases after this one.
      </p>
    </main>
  );
}
