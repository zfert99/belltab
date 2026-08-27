# Upgrade blockers: ESLint 10 & TypeScript 7 (and @types/node)

Record of why the major dev-dependency bumps in Dependabot PR #5 were **not**
applied, so it isn't re-litigated each time Dependabot re-proposes them. Written
2026-07-29.

## What we planned

Take the major dev-dependency updates Dependabot grouped into one PR:
`eslint ^9 → ^10`, `typescript ^5 → ^7`, `@types/node ^20 → ^26` (plus a
`tailwindcss` 4.3.0 → 4.3.3 patch).

## What we observed

The grouped PR failed at `npm ci` (strict peer resolution), and investigating
each piece showed the ecosystem isn't ready:

- **ESLint 10 — blocked upstream.** `eslint-plugin-jsx-a11y@6.10.2` (its latest
  release) declares `peerDependencies.eslint: "^3 || ^4 || … || ^9"` — it does
  not support ESLint 10. This plugin is not just our direct devDependency; it is
  also a dependency of `eslint-config-next` (`eslint-plugin-jsx-a11y ^6.10.0`).
  So ESLint 10 cannot resolve without `--force` / `--legacy-peer-deps`.
- **TypeScript 7 — blocked upstream.** `typescript-eslint@8.60.0` (pulled in by
  `eslint-config-next@16.2.12`) declares `peerDependencies.typescript:
  ">=4.8.4 <6.1.0"`. TypeScript 7.x is outside that range, so `npm ci` rejects
  it. (`eslint-config-next`'s own `typescript >=3.3.1` peer would allow it; the
  cap comes from `typescript-eslint`.)
- **@types/node 26 — not a peer conflict, but incorrect.** `@types/node` should
  track the Node **runtime**, which is Node 20 in CI (`actions/setup-node`
  `node-version: 20`). Bumping the types to 26 would type Node-26 APIs that don't
  exist at runtime. It should stay on `^20` until the runtime moves.

## Why forcing it is the wrong move

Both blockers are transitive peers of the Next.js ESLint toolchain. Forcing them
with `--legacy-peer-deps` / `overrides` would:

- Run `eslint-plugin-jsx-a11y` against an ESLint major it has never been tested
  on — silently weakening the accessibility lint gate, which is a **blocking
  check** in this repo.
- Run `typescript-eslint` against a TypeScript major outside its supported range
  — unsupported parsing behaviour, not just a warning.

That trades a green `npm audit` for an unreliable lint/type toolchain. Not worth
it, and against the AGENTS.md roadblock rule (don't improvise a workaround).

## Decision

- **Defer** ESLint 10 and TypeScript 7. Stay on `eslint ^9` and `typescript ^5`.
- **Do not** bump `@types/node` ahead of the Node runtime; keep `^20`.
- Closed Dependabot PR #5.
- Hardened `.github/dependabot.yml` so the dev-dependencies group covers only
  `minor`/`patch` — majors now arrive as individual PRs that are easy to assess
  and close, instead of one uninstallable grouped PR.

## Revisit when

- `eslint-plugin-jsx-a11y` ships a release whose `eslint` peer includes `^10`
  (watch its releases / the `eslint-config-next` dependency), **and**
- a `typescript-eslint` release raises its `typescript` peer to include `7.x`
  (it already lists `eslint ^10` in its peers, so it's partway there).

Then bump ESLint and TypeScript together in a dedicated PR and run the full gate
(build, typecheck, lint, e2e). Move `@types/node` only alongside a deliberate
Node runtime bump.
