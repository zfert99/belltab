import { App } from "@/app/_components/App";

/**
 * The route, and nothing else.
 *
 * A Server Component that reads no clock and renders no time. `AGENTS.md` keeps
 * `src/app/` for routing and entry points, and is explicit that a whole route
 * must not become a Client Component because one child ticks - so the boundary
 * is drawn at `App`, which is the only thing here that needs a device clock and
 * `localStorage`.
 *
 * The `<main>` landmark and the card that is the whole app live HERE rather
 * than inside `App`, because `body` centres a single grid item: a bare `<main>`
 * wrapping a `width: 100%` card would shrink to its content first and take the
 * card's max-width with it.
 */
export default function Page() {
  return (
    <main className="screen">
      <App />
    </main>
  );
}
