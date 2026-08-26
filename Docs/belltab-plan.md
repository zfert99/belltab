# BellTab — Plan

The authoritative scope document. `AGENTS.md` enforces the rules; this explains
them. The evidence behind every technical choice is in
`Docs/research/background-timers-and-schedule-modeling.md`.

## 1. What this is

A client-side school bell schedule countdown. You build a schedule once, leave
the tab open, and the tab title tells you how long is left in the current
period:

```text
43m · Period 2
```

That is the whole product. Everything else — the editor, the day types, the
sharing — exists to make that one line correct.

Served at `biscuitlab.net/bell`, deployed as its own Vercel zone.

## 2. Non-goals

These are decided, not open. Reopening one requires a research doc.

| Non-goal | Why |
| --- | --- |
| A backend of any kind | The whole tool fits in a URL fragment. A server buys nothing and costs everything. |
| Accounts, auth, database | No user data leaves the device; there is nothing to authenticate. |
| Background/scheduled notifications | Not possible on the open web without a push server. Notification Triggers was cancelled by Chrome and shipped nowhere else. |
| Seconds ticking in the tab title while backgrounded | Requires a Web Worker to dodge throttling. Deferred — see §11. |
| IANA timezone handling | The schedule is wall-clock and reads the device clock. Adding zones adds bugs for a benefit nobody asked for. |
| Overlapping periods | Deliberate. See §4. |
| Multi-school directory, prebuilt schedules | Scope creep; the native apps already do this. |
| A shared design-system package | Inherit the hub's tokens by copy, not by dependency. |

## 3. The invariants

Restated from `AGENTS.md` because they drive everything below:

1. **Recompute, never decrement.** `remaining = deadline − now`, computed fresh
   every time, including on `visibilitychange` and `focus`.
2. **Minutes-since-midnight integers** for all schedule times.
3. **No overlapping periods** within a schedule. Gaps are legal.
4. **Parse, don't validate** — untrusted input becomes a branded valid type at
   the boundary, or a structured error.
5. **No backend, no runtime network.**

The first one is the one that will get broken by accident. A decrementing
counter looks perfect in a foreground tab and quietly lies in a backgrounded
one, which is the exact situation this tool exists for.

## 4. Data model

A **period** is a labelled half-open interval of wall-clock minutes:

```text
Period  = { id, label, startMin, endMin, kind }
kind    = "class" | "passing" | "lunch" | "break" | "other"
```

`startMin` and `endMin` are integers in `[0, 1440]`, and `startMin < endMin`.
The interval is half-open: at exactly `endMin` you are in the *next* thing, not
this one. That removes the off-by-one ambiguity at every bell.

A **schedule** is a named, sorted, non-overlapping list of periods:

```text
Schedule = { id, name, periods: Period[] }
```

### Why no overlaps

Real US secondary schools genuinely do run concurrent lunches — "A lunch" and
"B lunch" against different class blocks — and the research is right that a
*general* tool must allow classified overlaps. BellTab is not a general tool. It
is one person's schedule on one screen, and the ability to represent two
simultaneous periods buys nothing while making "which period am I in?" a
question with more than one answer.

So the invariant is enforced at the boundary and the editor blocks the input.
If concurrency is ever needed, the change is confined to the validator and the
"current period" resolver — the storage format already permits it, so this is a
one-way door we can walk back through.

### Why not durations

The obvious alternative — one start time plus a chain of durations — makes
overlaps unrepresentable, which is elegant. It was rejected because cascading
edits are a UX trap: changing period 1's length silently moves every later bell,
which is wrong roughly as often as it is right, and gaps in the day become
awkward to express. Absolute times plus a validator gets the same guarantee with
a better editor.

### Why integers, not `Date`

"Period 2 starts at 9:05" means 9:05 local, on both sides of a DST transition.
Storing an instant would *introduce* a DST bug that integers do not have.
Integers also compare, sort, and serialize for free. `Date` appears in exactly
one place: reading *now* and converting it to local wall-clock minutes.

`Temporal.PlainTime` is the semantically correct type and is now in Chrome and
Firefox, but not stable Safari, so it still needs a 20–44KB polyfill. Not worth
it for a subtraction. Revisit if Safari ships it.

## 5. Day types and the resolver

Two layers, mirroring how Ed-Fi models this professionally (named bell schedules
mapped to dates):

1. **Named schedule templates** — "Regular", "Late Start", "Assembly",
   "Half Day". Duplicating and tweaking a template is the primary authoring
   move, since most day types are "Regular, minus ten minutes everywhere."
2. **A date → schedule resolver**, in strict priority order:
   1. An explicit **date override** (`2026-09-14 → "Assembly"`).
   2. The **weekday default map** (`Mon → "Regular"`, `Fri → "Assembly"`).
   3. **No schedule today** — a real, designed empty state, not a blank screen.

### What is deliberately deferred

Rotating cycles — A/B days, and especially N-day rotations where a snow day
shifts the whole remaining cycle — are real and are **not in v1**. They cannot
be expressed as "weekday → schedule"; they need an instructional-date list or a
cycle-start plus skip-dates, *plus* a manual "bump the cycle" control for
unplanned closures. That is easily as much work as the rest of the app.

The resolver's priority order above is designed so a cycle layer can be inserted
between (i) and (ii) later without touching anything else.

## 6. Runtime model

One clock. One subscriber. Everything else is a derived view.

- A single tick source recomputes app state from `Date.now()` and hands down a
  snapshot: current period, remaining minutes, next period, progress fraction.
- Recompute is forced on `visibilitychange` and `focus`, so foregrounding the
  tab repaints a correct value before the user finishes looking at it.
- The tab title is set from that snapshot at **minute** resolution. The page
  body renders **seconds**, because a visible tab is not throttled and seconds
  in the body look alive.
- The pure engine (`src/lib/`) takes the current time as an **argument** and
  contains no `Date.now()`. That is what makes it testable at exact boundaries
  without faking timers.

### The fidelity we are promising

| Context | Repaint cadence | Value correct when painted |
| --- | --- | --- |
| Tab visible | Body 1s, title 1min | Yes |
| Backgrounded < 5 min | ~1s (browser-batched) | Yes |
| Backgrounded > 5 min | ~1min, not aligned to our minute | Yes — but the paint itself can lag up to ~60s |
| Frozen / discarded (mobile, locked) | None | Correct within a frame of resume |
| Tab closed | None | There is no countdown |

The last two rows are why "recompute, never decrement" is the whole ballgame.
Under decrementing, rows 3–5 produce a confidently wrong number.

## 7. The tab title

- **Number first:** `43m · Period 2`, not `Period 2 — 43m left`. Tabs truncate
  from the right and shrink as tab count grows, so the token that must survive
  goes first. (The commonly-cited "15–25 visible characters" is folklore, not a
  measured constant — design for graceful truncation rather than a budget.)
- **Minute resolution**, always. See §2.
- **Never `aria-live` it.** Title mutations are not announced by screen readers,
  which is exactly what we want for a per-minute update. The body is the
  accessible source of truth.
- A dynamic favicon (progress ring drawn to canvas) is possible and rides the
  same throttle. Optional polish, not v1.

## 8. State, sharing, persistence

- **URL fragment = the shareable schedule.**
  `JSON.stringify` → `CompressionStream('deflate-raw')` → base64url. The
  fragment is never sent to a server, so length limits are a non-issue; a full
  schedule is a few hundred characters. Native compression is baseline across
  browsers since May 2023, so this needs no dependency.
- **Version-prefix the payload from the first commit.** The first link shared is
  a format supported forever.
- **`localStorage` = convenience.** Last-used schedule, theme, bell offset,
  wake-lock toggle. Must degrade to a clean empty state if absent or corrupt.
- **JSON export/import = backup.** Plain and readable.
- Not IndexedDB. Not the File System Access API. The data is hundreds of bytes.

## 9. Deployment — the `/bell` zone

Same pattern as Puzzle Lab at `/puzzles`.

**This repo:**

- `basePath: '/bell'` in `next.config.ts`. It scopes routes *and* `/_next/*`
  assets in Next 15+, so no `assetPrefix`. Build-time inlined — changing it
  requires a redeploy, and local dev is `localhost:3000/bell`.
- Its own Vercel project, with Deployment Protection **on** and a dedicated
  custom origin host (e.g. `origin-bell.biscuitlab.net`). Custom domains are
  exempt from protection, so the hub's proxy reaches it while the generated
  `*.vercel.app` alias stays locked.

**Hub repo (`Biscuit-Website`):**

- Add a `BELL_ORIGIN` env var and two rewrites — the bare path and the wildcard,
  because `/bell` does not always match `:path*`:

```text
{ source: "/bell",        destination: `${origin}/bell` }
{ source: "/bell/:path*", destination: `${origin}/bell/:path*` }
```

- Read at **build** time, so the hub must be redeployed after `BELL_ORIGIN`
  changes; return `[]` when unset so local dev is unaffected.
- Add BellTab to the hub's project index and to the sitemap index.

There is no WebAuthn/rpID complication here — BellTab has no auth — so this is
the easy version of the migration the hub already documents in
`Docs/multi-zone-migration-runbook.md`.

## 10. Phases

Each phase is independently shippable and leaves `main` deployable.

**Phase 0 — Scaffold.** Next.js + TS + Tailwind, `basePath: '/bell'`, security
headers, ESLint with `jsx-a11y`, Vitest, Playwright with the reflow gate, CI.

**Phase 1 — The engine.** Pure `src/lib/`: types, the branded `ValidSchedule`
parser, the no-overlap validator, and `stateAt(schedule, minute)` returning
current period / remaining / next / progress. Fully unit-tested at boundaries.
No UI.

**Phase 2 — The countdown.** One clock, the display, the tab title, the
before-first / after-last / no-schedule empty states, and a progress bar.
Hard-coded schedule. **This is the first genuinely useful build.**

**Phase 3 — The editor.** Add, rename, reorder, retime, delete periods, with
overlap blocking and inline field-level errors. Persist to `localStorage`.

**Phase 4 — Day types.** Multiple named schedules, the weekday default map, date
overrides, and a "use this schedule today" control.

**Phase 5 — Sharing.** The versioned encode/decode pipeline, share-link UI, JSON
export/import, and the round-trip fixture suite.

**Phase 6 — Comfort.** Bell offset, Screen Wake Lock behind an explicit toggle,
opt-in foreground chime and notification with honest copy, PWA manifest, theme.

**Phase 7 — Cutover.** Hub rewrite, origin host, project card, sitemap.

## 11. Deferred decisions

Recorded so they are decisions, not oversights.

- **Web Worker for background seconds.** The only way to keep seconds ticking in
  a backgrounded desktop tab, since worker timers escape main-thread throttling.
  Deferred because minutes are the stated requirement and workers do nothing for
  a frozen mobile tab. The data model does not change if we add it later.
- **Rotating cycle day types.** See §5.
- **Dynamic favicon.** Nice, cheap, not load-bearing.
- **Badging API.** Installed-PWA only, unsupported on Chrome Android. Too
  partial to be a primary surface.
- **Clock skew correction.** `nicolaschan/bell` syncs against a server because
  student devices have wrong clocks. We have no server. If device-clock drift
  turns out to matter, this is the reason to reconsider — and the only one.
- **Temporal adoption.** When Safari ships it stable.

## 12. Prior art worth reading

- **`nicolaschan/bell`** (bell.plus, MIT) — the most mature open-source
  equivalent, with client/server clock sync. Almost certainly the tool
  half-remembered as "bell.me": it migrated countdown.zone → bell.lahs.club →
  bell.plus, which is why the old address is dead.
- **`hman124/bell-countdown`** and its fork `ABUCKY0/bell-countdown` — smaller
  React implementations.
- **Native apps** (School Bell Schedule, Bell+) — the source of the bell-offset
  idea, and of day-type awareness as a headline feature.
