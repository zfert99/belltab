# Multi-zone cutover regression — client `fetch()` did not carry the basePath

**Date:** 2026-07-30
**Status:** ✅ Fixed and verified (dev smoke + full test suite).
**Scope:** Puzzle generation (`/play`), the daily (`/daily`), PDF export (`/generate`),
and the leaderboard/streak panels all stopped working after the multi-zone cutover.

## Symptom

After the migration that serves the app under `biscuitlab.net/puzzles`
(`Docs/multi-zone-migration-plan.md`), three user-visible features broke at once:

- **Puzzles no longer generate** on `/play`.
- **The daily** no longer loads.
- **PDFs** no longer generate on `/generate`.

The server-side generation/PDF/daily logic was never touched by the migration and was
fine in isolation — the failure was purely that the browser could no longer reach the
route handlers.

## Root cause

The cutover set `basePath: '/puzzles'` in `next.config.ts` (unconditionally — so it also
applies in local dev). Under a basePath, **every route handler moves**: `src/app/api/generate/route.ts`
is now served at `/puzzles/api/generate`, not `/api/generate`.

Next.js automatically prepends the basePath to the navigation primitives it controls —
`<Link>`, `next/image`, `router.push()`/`replace()`, and `/_next/*` assets. It does **not**
touch `fetch()`, because `fetch` is a browser primitive Next never sees. So a client call
like `fetch('/api/generate')` still targets `/api/generate`. Under the hub's multi-zone
rewrite that path resolves to the **hub (root) zone**, not the puzzles zone, and 404s.

The auth layer had already been migrated correctly — `src/features/auth/auth-client.ts`
sets `basePath: '/puzzles/api/auth'`. But the app's **own** data-fetch calls were missed
in the cutover. Nine bare `fetch('/api/...')` calls remained across five files.

### Why the migration validation missed it

The pre-cutover audit (`multi-zone-migration-validation.md` §9) focused on *absolute-URL*
correctness — OG images, sitemap `loc`, JSON-LD, canonicals, OAuth callbacks, hardcoded
`puzzles.biscuitlab.net`. Same-origin **relative** `fetch('/api/...')` calls are the
opposite failure mode (they look correct precisely because they are relative) and weren't
on that checklist. This doc adds them to it.

## The nine broken calls

| File | Call | Feature |
|---|---|---|
| `src/features/interactive-board/hooks/usePuzzle.ts` | `/api/puzzle` | Free-play generation |
| `src/features/puzzle-configuration/hooks/usePuzzleGeneration.ts` | `/api/generate` | PDF export |
| `src/features/dailies/hooks/useDaily.ts` | `/api/daily` | Daily fetch |
| `src/features/dailies/components/DailyExperience.tsx` | `/api/me/today`, `/api/solve`, `/api/daily/start` | Daily completion / submit / start |
| `src/features/leaderboards/components/LeaderboardView.tsx` | `/api/leaderboard`, `/api/me/streak`, `/api/me/bests` | Leaderboard + streak/bests |

## The fix

A single-source-of-truth helper, `src/lib/base-path.ts`:

```ts
export const BASE_PATH = '/puzzles';
export function apiPath(path: string): string {
  return `${BASE_PATH}${path}`;
}
```

Every same-origin `fetch('/api/...')` was wrapped in `apiPath(...)`. `BASE_PATH` is a
hand-maintained mirror of `next.config.ts`'s `basePath` — Next inlines `basePath` at build
time and never exposes it to client runtime, so there is no framework API to read it from.

A `NEXT_PUBLIC_BASE_PATH` env driving both `next.config.ts` and the helper was considered
and rejected: `basePath` in `next.config.ts` is intentionally a hardcoded, build-time
literal (migration plan §3), and a required build env is a fail-open footgun if ever unset.
The hardcoded constant plus an explicit three-place sync note is the pragmatic trade-off,
consistent with how `auth-client.ts` already hardcodes `/puzzles/api/auth`.

### The sync contract

`/puzzles` now lives in three places that must agree — change all three together:

1. `next.config.ts` → `basePath: '/puzzles'` (the real mount).
2. `src/lib/base-path.ts` → `BASE_PATH` (client `fetch()` prefix).
3. `src/features/auth/auth-client.ts` → `basePath: '/puzzles/api/auth'` (better-auth client).

## Verification

- **Dev smoke test** (`next dev`, the exact failing path):
  - `POST /puzzles/api/puzzle` → **HTTP 200** with a generated grid.
  - `POST /api/puzzle` (the old bare path) → **HTTP 404** — reproduces the pre-fix break.
- **Unit tests:** the two tests that asserted the old bare paths
  (`PuzzleForm.test.tsx`, `usePuzzle.test.tsx`) were updated to `/puzzles/api/...`; full
  suite **353/353 passing**.
- **Lint** clean; **markdownlint** clean on all touched docs.

## Guardrail for next time

Any new client-side `fetch('/api/...')` MUST go through `apiPath(...)`. A bare
`fetch('/api/...')` is a latent 404 under the basePath and will silently break whichever
feature it belongs to. Server-side code (route handlers, cron) is unaffected — it receives
the already-stripped path and never calls `apiPath`. See `src/lib/base-path.md`.
