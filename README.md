# BellTab

A school bell schedule countdown that lives in your browser tab.

Build your schedule once, leave the tab open, and the tab title becomes the
clock:

```text
43m · Period 2
```

Served at **biscuitlab.net/bell**. No accounts, no database, no server — the
schedule lives in your browser and in a shareable link.

## What it does

- **Countdown in the tab title** — minutes remaining and the current period
  name, with the number first so it survives tab truncation.
- **Fully custom schedules** — as many periods as you want, each with its own
  name and start/end time. Twenty periods is fine.
- **Named day types** — "Regular", "Late Start", "Assembly", "Half Day" — with a
  default weekday mapping and a manual override for today.
- **Honest empty states** — before first bell, after last bell, and days with no
  schedule are first-class screens, not blanks.
- **Bell offset** — real bells never match the published schedule. Nudge every
  time by ±N seconds so the countdown matches the bell you actually hear.
- **Share by link** — the whole schedule compresses into the URL fragment. Send
  it to a colleague; nothing is uploaded anywhere.

## What it deliberately does not do

The open web cannot do these things reliably without a backend, so BellTab
does not pretend to. See
`Docs/research/background-timers-and-schedule-modeling.md` for the evidence.

- **No alerts while the tab is buried or closed.** Scheduled local
  notifications without a push server are not available on the web —
  Notification Triggers was cancelled by Chrome and shipped nowhere else. The
  chime and notification are opt-in and fire only while the tab is open.
- **No seconds ticking in the tab title while backgrounded.** Browsers clamp
  hidden-tab timers to roughly once per minute. BellTab shows minutes in the
  title for exactly this reason.
- **No timezones.** The schedule is wall-clock and reads your device clock. A
  shared link shows in the recipient's local time, which is right for "when does
  *my* bell ring" and wrong for pinning a schedule to a distant school.
- **No accounts, sync, or server.** Ever.

## Accuracy, honestly

The countdown is always recomputed from the clock, never decremented. That
means the value you see is correct the instant it renders, no matter how hard
the browser throttled the timer that rendered it.

| Where you are | How often it repaints | Is the number right? |
| --- | --- | --- |
| Tab visible | Body every second, title every minute | Yes, to the second |
| Backgrounded < 5 min | About once a second | Yes |
| Backgrounded > 5 min | About once a minute, unaligned | Yes when it paints; the paint itself can be up to ~60s late |
| Phone locked, tab frozen | Not at all | Yes, within a frame of you coming back |
| Tab closed | Not at all | There is no countdown |

## Stack

**Today: plain HTML, CSS, and ES modules. No build step, no framework, no
runtime dependencies.** That is a deliberate detour — the app was built without
a framework first so the wiring is visible, and the schedule engine is pure and
framework-free precisely so the port is mechanical. `Docs/build-log.md` records
the reasoning.

**The destination:** Next.js (App Router) · TypeScript · Tailwind · Vercel,
deployed as its own zone and proxied to `biscuitlab.net/bell` by the Biscuit Lab
hub, the same way Puzzle Lab is served at `/puzzles`. Vitest and Playwright are
already here and carry over unchanged.

## Local development

```bash
npm install
npm run serve     # http://localhost:3000
```

A server is **required** even though there is no backend: `app.js` is an ES
module, and browsers refuse to load modules over `file://`. `npm run serve` is
forty lines of Node in `scripts/serve.js`, not a dependency.

There is no `/bell` base path yet — that arrives with `next.config.ts` at the
port, and local dev becomes `localhost:3000/bell` then.

Before calling any change done:

```bash
npm test          # vitest - the engine, the parser, the formatters, the wiring
npm run e2e       # playwright - reflow, the dialog, the announcer
npm run lint:md   # markdownlint
```

`npm run e2e` starts its own server and drives the Chrome already installed on
the machine, so it needs no browser download. WebKit and Firefox are not covered
yet; see **Open gaps** in `Docs/build-log.md`.

## Docs

| Document | What it covers |
| --- | --- |
| `Docs/belltab-plan.md` | Authoritative scope, non-goals, data model, phases |
| `Docs/roadmap.md` | What is being built now, next, and later |
| `Docs/build-log.md` | What was actually built, what was decided and why, what broke, and what is still owed |
| `Docs/design/design-system.md` | Visual language, inherited from the hub |
| `Docs/research/background-timers-and-schedule-modeling.md` | The research this whole design rests on |
| `Docs/code-review-2026-08-26.md` | A full review of `437ef54`, its five findings, and how each was fixed and verified |
| `AGENTS.md` | Rules for AI agents working in this repo |

The plan and the roadmap describe the destination; the build log describes the
app that exists. Where the two disagree, the build log's **Deviations** section
says so explicitly and what is owed to reconcile them.
