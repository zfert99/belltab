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

Next.js (App Router) · TypeScript · Tailwind · Playwright · Vercel. Deployed as
its own zone and proxied to `biscuitlab.net/bell` by the Biscuit Lab hub, the
same way Puzzle Lab is served at `/puzzles`.

## Local development

```bash
npm install
npm run dev
```

The app is served under the `/bell` base path, so local dev lives at
`http://localhost:3000/bell`.

Before calling any change done:

```bash
npm run lint && npm run typecheck && npm run test:e2e
```

## Docs

| Document | What it covers |
| --- | --- |
| `Docs/belltab-plan.md` | Authoritative scope, non-goals, data model, phases |
| `Docs/roadmap.md` | What is being built now, next, and later |
| `Docs/design/design-system.md` | Visual language, inherited from the hub |
| `Docs/research/background-timers-and-schedule-modeling.md` | The research this whole design rests on |
| `AGENTS.md` | Rules for AI agents working in this repo |
