/**
 * The Phase 0 gate: an empty page that CI can go green on.
 *
 * Deliberately not the app. The working BellTab is still the plain HTML/CSS/JS
 * build served from `src/index.html` by `npm run serve`, and it stays that way
 * until the engine is ported in Phase 1. This file exists to prove the scaffold
 * builds, type-checks, lints and reflows - nothing more.
 *
 * Nothing here reads the clock. A time-dependent value rendered on the server
 * hydrate-mismatches by definition, so the countdown arrives as a client
 * component in Phase 2.
 */
export default function Page() {
  return (
    <main>
      <h1>BellTab</h1>
      <p>
        The Next.js scaffold is up. The working app is still the plain build —
        run <code>npm run serve</code> for it.
      </p>
    </main>
  );
}
