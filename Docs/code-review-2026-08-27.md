# Code review — 2026-08-27, working tree on `feat/phase-1-engine`

Review of the staged Phase 1 change — the port of the plain HTML/CSS/JS build
to the Next app, `src/lib/` in TypeScript, and the E2E suite rewritten around
the new shell — against `ff64e4c` *"docs: require Typecheck and Next build in
branch protection (#13)"*. Nothing was committed at review time, so the scope
was `git diff HEAD` over a fully staged tree.

Effort: `high`. Three findings, all open. **No code changed.**

The port itself is clean — the two files that carry the domain invariants,
`engine.ts` and `parse.ts`, came across logic-identical, and every gate on the
tree passes. All three findings are the same species instead: something that
used to be enforced somewhere else, and whose enforcer was deleted in this diff
without the enforcement moving with it. A caption lost the label that
disambiguated it, `src/` lost the lint rules that covered it, and a boundary cap
lost its only caller.

---

## Summary

| # | Where | Severity | Finding |
| --- | --- | --- | --- |
| 1 | `src/lib/format.ts:104` | High | `formatDayCaption` drops `unit`, and the caption that compensated is gone |
| 2 | `eslint.config.js:46` | High | `eqeqeq`, error-level `no-unused-vars` and the disable-directive check no longer reach `src/` or `e2e/` |
| 3 | `src/lib/parse.ts:34` | Medium | `SCHEDULE_LIMITS.schedules` has no enforcer left |

---

## 1. `formatDayCaption` drops `unit`, and the caption that compensated is gone

**Where:** `src/lib/format.ts:104`, with `src/lib/format.ts:80` and
`src/lib/format.test.ts:144`.

```ts
const { major, minor } = splitCountdown(day.remainingSec);
const target = day.phase === "before" ? "until first bell" : "until dismissal";
return `${position.index} of ${position.total} · ${major}:${minor} ${target}`;
```

`splitCountdown` returns a third field, `unit`, and its own JSDoc says why:

> The `unit` is not decoration. The two modes render identically, so "3:38"
> alone could be three hours or three minutes — a countdown that is ambiguous
> about its own units is worse than one that is merely ugly.

`formatDayCaption` destructures the two numbers and throws the unit away, so the
string it builds is exactly the ambiguity the field exists to prevent:

| `remainingSec` | Real duration | Rendered |
| --- | --- | --- |
| `60` | one minute | `3 of 7 · 1:00 until first bell` |
| `3600` | one hour | `3 of 7 · 1:00 until first bell` |
| `90` | ninety seconds | `3 of 7 · 1:30 until first bell` |
| `5400` | ninety minutes | `3 of 7 · 1:30 until first bell` |

This is the same defect as code-review finding 5 of 2026-08-26, which was closed
on 2026-08-26 by carrying `unit` into a `#day-remaining-units` caption beside the
number. **That caption is deleted in this diff** along with the rest of the
retired markup, and `formatDayCaption` — which is new here — reintroduces the
bare `major:minor` string with nothing beside it. The closed-gap row therefore
describes a fix that no longer exists.

`format.test.ts:144` asserts the ambiguous string as correct
(`formatDayCaption(day("before", 3600, 0), position)` → `"3 of 7 · 1:00 until
first bell"`), so the suite is currently pinning the bug rather than catching it.

Note the contrast with `formatRemaining`, added in the same file, which spells
its units into the string (`"49m 06s"`, `"1h 05m"`) precisely because it renders
next to `formatDuration`'s `"55m"`. The Day caption is the one place that
regressed.

**Fix:** either carry `unit` into the caption (a units slot in the Phase 3
markup, matching what the retired build had), or — simpler, and self-contained
in `lib/` — build the caption from `formatRemaining` so the string is
unambiguous on its own. Then correct the test.

## 2. The plain-JS lint block no longer reaches `src/` or `e2e/`

**Where:** `eslint.config.js:46`, with `package.json:9` and
`.github/workflows/ci.yml:39`.

The retired config applied `js.configs.recommended` plus a small house rule set
to the whole repo. This diff narrows both blocks to `files: ["*.config.js"]`:

```js
{ files: ["*.config.js"], ...js.configs.recommended },
{
  files: ["*.config.js"],
  linterOptions: { reportUnusedDisableDirectives: "error" },
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    eqeqeq: ["error", "always", { null: "ignore" }],
    ...
  },
},
```

The header comment explains the narrowing in terms of `no-undef` — "`tsc` rather
than `no-undef` is what catches a name that does not exist" — which is true, and
is a good reason to stop applying `js.configs.recommended` to TypeScript. But
the second block went with it, and `eqeqeq` and `reportUnusedDisableDirectives`
are not things `tsc` does. `eslint-config-next` supplies neither. The only file
in the repo those rules now govern is `vitest.config.js`.

**Probed**, with a temporary `src/lib/__lintprobe.ts` containing `a == 1`, an
unused `const`, and a stale `eslint-disable-next-line no-console`:

```text
2:9  warning  'unusedBinding' is assigned a value but never used   @typescript-eslint/no-unused-vars
3:3  warning  Unused eslint-disable directive (no problems were reported from 'no-console')

✖ 2 problems (0 errors, 2 warnings)
exit=0
```

Three things in that output:

- `a == 1` is **not reported at all**. Loose equality is unflagged everywhere in
  `src/` and `e2e/`.
- The unused binding is a **warning**, from the Next config, not the error the
  house rule set specified.
- `"lint": "eslint ."` carries no `--max-warnings`, so ESLint exits 0 and the CI
  **Lint** job goes green on both.

For a repo whose central invariant is arithmetic correctness, silent `==` is the
wrong rule to lose, and losing it invisibly — no diff line says "eqeqeq is off
for the app now" — is worse than losing it on purpose.

**Fix:** keep the narrowed `js.configs.recommended` block, and add a second
block scoped to `src/**` and `e2e/**` re-asserting `eqeqeq`,
`@typescript-eslint/no-unused-vars` at `error`, and
`reportUnusedDisableDirectives: "error"`. Separately, add `--max-warnings 0` to
the `lint` script so a warning cannot pass CI regardless of which rule emits it.

## 3. `SCHEDULE_LIMITS.schedules` has no enforcer left

**Where:** `src/lib/parse.ts:34`.

```ts
export const SCHEDULE_LIMITS = {
  schedules: 50,
  periods: 60,
  nameChars: 60,
  overrides: 400,
} as const;
```

The JSDoc above it describes these as caps "applied before anything is parsed"
so that "a hand-crafted payload claiming fifty thousand periods must be refused
at the boundary". Three of the four are enforced inside `parse.ts`
(`nameChars` at lines 146 and 170, `periods` at 154, `overrides` at 261).
`schedules` never was — its only enforcer was the collection loader in
`src/store.js:89`:

```js
for (const entry of stored.slice(0, SCHEDULE_LIMITS.schedules)) {
```

`src/store.js` is deleted in this diff. Nothing in TypeScript references
`SCHEDULE_LIMITS.schedules`; `grep` finds the definition and no consumer. That
is defensible for Phase 1 — there is no store and no share-link decoder yet, so
there is nothing to cap — but the constant now reads as an enforced boundary
when it is a note-to-self, and it is **not recorded in the build log's Open
gaps**, so nothing will surface it when the decoder lands. A decompression
boundary with a documented cap that silently isn't applied is exactly the shape
`AGENTS.md` warns about.

**Fix:** cheapest is an Open-gaps row plus a comment on the field naming the
phase that owes the enforcement. Better, when the collection parser arrives in
Phase 4: a `parseScheduleCollection` in `parse.ts` that applies the cap at the
boundary, so it never depends on a caller remembering to slice.

---

## Checked and cleared

Recorded so the same ground is not re-covered:

- **The `engine.js → engine.ts` and `parse.js → parse.ts` ports are
  logic-identical.** Compared branch for branch. `parseCalendar` additionally
  gained a `typeof id === "string"` guard, which is an improvement, not a
  behaviour change.
- **The adjacent-pair overlap check in `parseSchedule` is sufficient, not
  partial.** Sorting by start and requiring `start[i] >= end[i-1]` forces
  strictly increasing ends, so no non-adjacent pair can overlap without an
  adjacent pair overlapping first. Only the error *reporting* is one-at-a-time,
  which is already an open gap.
- **`stateAt`'s `periods[i - 1]` in the gap branch cannot underflow**, and its
  gap-progress divisor cannot be zero — the `dayStartSec` guard above them
  excludes both.
- **`next-env.d.ts` being gitignored while `tsconfig.json` includes it is not a
  break.** Confirmed by moving it and `.next` aside and running `tsc` on the
  result: exit 0. A fresh CI checkout typechecks.
- **The `div#__next-route-announcer__` assertion in `announcer.spec.ts` is
  correct for this Next version.** The element lives in an open shadow root, and
  Playwright's CSS engine pierces open roots.
- **Every gate passes on the working tree:** `tsc --noEmit`, `vitest run`
  (118/118), `eslint .`, `markdownlint-cli`, and `playwright test`
  (11 passed / 37 parked).

---

## Recommended order

1. Finding 2 — config-only, and until it lands every later fix is being written
   under weaker lint than the repo thinks it has.
2. Finding 1 — needs a decision about where the units live now that the markup
   that held them is gone; the test changes with it.
3. Finding 3 — an Open-gaps row today, a `parseScheduleCollection` in Phase 4.
