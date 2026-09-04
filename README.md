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
  name, start and end time (or a length — type either and the other fills in),
  and a kind of your own: Class, Passing, Lunch, Planning, or whatever your
  building calls it. Twenty periods is fine.
- **Named day types** — "Regular", "Late Start", "Assembly", "Half Day" — with a
  default weekday mapping and a manual override for today.
- **Honest empty states** — before first bell, after last bell, and days with no
  schedule are first-class screens, not blanks.
- **Bell offset** — real bells never match the published schedule. Nudge every
  time by ±N seconds so the countdown matches the bell you actually hear — or
  press "The bell just rang" as it rings and BellTab measures it. The
  correction is applied to the clock, never to the schedule, so it stays on your
  device and never travels in a link you send.
- **The Day view** — the whole schedule as a list: what's done, what's running
  with its own countdown, what's left, and a one-line summary like "2 of 7 ·
  5h 00m until dismissal". Finished periods fold away so the running one sits
  at the top.
- **The day as blocks** — optionally, the period progress bar becomes a bar for
  the whole day, one block per period sized to its length, a dash wherever the
  kind of block changes, filling in as the day goes. Preferences → Countdown.
- **Big mode** — the same countdown, scaled for a projector at the front of a
  room. It is a presentation mode over the ordinary view rather than a second
  screen, so the two cannot disagree.
- **Keep the screen awake** — an optional toggle that stops the display dimming
  or locking while BellTab is on it, which is the other half of projecting a
  countdown at a room. Off unless you ask for it, and it tells you plainly when
  your device refuses rather than leaving you to notice the screen went dark.
- **Bells, if you want them** — an optional chime and an optional system
  notification when a period starts or ends. Both are honest about the web's
  limits: they work while a BellTab tab is open, a background tab can ring up to
  a minute late, and a closed tab never rings.
- **Light, dark, or whatever your device says** — applied before the page
  paints, so there is no flash of the wrong one.
- **Share by link** — the whole schedule compresses into the URL fragment. Send
  it to a colleague; nothing is uploaded anywhere. Opening a link shows that
  schedule running straight away; "Keep it" makes it today's.
- **Installable** — add it to a phone's home screen or a laptop's dock and it
  opens in its own window, bell icon and all. There is still no server behind
  it; installing changes where it lives, not what it knows.

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

**Next.js (App Router) · React · TypeScript · Vercel**, deployed as its own
zone and proxied to `biscuitlab.net/bell` by the Biscuit Lab hub, the same way
Puzzle Lab is served at `/puzzles`. Vitest and Playwright cover it.

The app was built as plain HTML, CSS and ES modules first — a deliberate detour,
so the wiring stayed visible and the schedule engine came out pure and
framework-free. Phase 1 ported that engine to TypeScript and retired the plain
build, since a browser cannot load a `.ts` module. The UI is being rebuilt on
top of the engine phase by phase; `Docs/build-log.md` records the reasoning and
`Docs/roadmap.md` tracks what is left.

## Local development

```bash
npm install
npm run dev       # http://localhost:3000/bell
```

The `/bell` suffix is not a typo. `basePath: '/bell'` in `next.config.ts` scopes
every route and every `/_next/*` asset, and it is inlined at build time — so the
bare `localhost:3000` is a 404 in development exactly as it would be in
production.

Before calling any change done:

```bash
npm run lint      # eslint, including jsx-a11y at full `recommended`
npm run typecheck # tsc --noEmit, strict
npm test          # vitest - the engine, the parser, the library and the calendar
npm run e2e       # playwright - three engines, the reflow gate and an axe sweep
npm run lint:md   # markdownlint
```

`npm run e2e` builds the app and starts its own server, then runs the suite on
**Chrome, WebKit and Firefox**, including an `@axe-core/playwright` sweep over
every journey. It runs against a production build rather than `next dev`,
because the reflow gate measures the CSS that actually ships.

Chrome is the one already installed on the machine; the other two are
Playwright's own builds and need a one-time download:

```bash
npx playwright install webkit firefox
```

Playwright's WebKit is not Safari, and is not even one thing: the build on this
machine implements neither `<input type="time">` nor `type="date"`, while the
Linux CI runner's implements both. Treat it as a strong signal about an engine
and a weak one about anybody's browser. See **Open gaps** in
`Docs/build-log.md`.

## Docs

| Document | What it covers |
| --- | --- |
| `Docs/belltab-plan.md` | Authoritative scope, non-goals, data model, phases |
| `Docs/roadmap.md` | What is being built now, next, and later |
| `Docs/build-log.md` | What was actually built, what was decided and why, what broke, and what is still owed |
| `Docs/design/design-system.md` | Visual language, inherited from the hub |
| `Docs/research/background-timers-and-schedule-modeling.md` | The research this whole design rests on |
| `Docs/code-review-*.md` | One per review, each recording its findings as written and how every one was fixed and verified |
| `AGENTS.md` | Rules for AI agents working in this repo |

The plan and the roadmap describe the destination; the build log describes the
app that exists. Where the two disagree, the build log's **Deviations** section
says so explicitly and what is owed to reconcile them.
