# BellTab — Build Log, Phases 7 and 8 (2026-09-02 to 2026-09-05)

**This is the session log for Phases 7 and 8 (2026-09-02 to 2026-09-05), moved here from `../build-log.md` on
2026-09-09.** It runs from the cutover plan through the Day view's return and ends with the tidy-up that said nothing was in flight - the entry before the 2026-09-04 audit, where the live log now begins. Every entry is verbatim; only same-directory links gained
a `../`. The live log's Decisions, Deviations, Known limits, Open gaps, Closed
and Bugs found sections were NOT moved - those tables are most useful whole,
and the lessons are the part that gets read - so a date below may be discussed
there as well. Append-only still applies: nothing here is edited, and new
entries go in the live log.

---

## Session log

### 2026-09-02 16:35 — Phase 7 planned, and the BellTab side of it built

The planning pass ran against the hub repo's own evidence:
`Biscuit-Website/Docs/multi-zone-migration-runbook.md` (validated) and
`multi-zone-cutover-log.md` (what actually went wrong doing Puzzle Lab). Three
lessons inherited directly: the rewrite target must be a dedicated custom
origin host with Deployment Protection ON — the `*.vercel.app` alias is
protection-locked, which is the log's issue #3; both rewrite entries are
needed because bare `/bell` does not always match `:path*`; and the project
card must be a hard-nav `<a>` via the `crossZone` flag the hub already has.
BellTab is the easy version — no auth, no rpID, no legacy subdomain, no 301
track.

Both open questions resolved with the user: **the path is `/bell`**, and **the
card lands after the flip is verified**, in its own hub PR, in the order Puzzle
Lab used.

What this slice adds to THIS repo is the crawler's half of the cutover:

- **`metadataBase` + a canonical of `https://biscuitlab.net/bell`.** The origin
  host the proxy reaches is publicly resolvable, so without a canonical the
  same page would exist at two addresses and a crawler would have to guess
  which one is real. The one page names its one address. `basePath` does not
  rewrite metadata URLs, so the `/bell` is spelled out — the same discipline as
  `manifest.ts`, verified the same way, against a running `next start`.
- **A one-URL `sitemap.ts`**, because the hub's cutover step is a
  `<sitemapindex>` naming each zone's sitemap, and a zone without one is
  invisible to it. `/puzzles/sitemap.xml` returning 200 today is what unblocks
  the hub finally building that index — the runbook deferred it and BellTab's
  card PR is where it lands.

**Tests:** Playwright 600 → 603 — one new assertion block in `e2e/pwa.spec.ts`
pinning the canonical and the sitemap's `<loc>` to the same address. Unit
unchanged at 377.

**What remains is outside this repo:** the hub's dormant rewrite, the Vercel
project and origin host (driven by CLI with the user's approval, pausing before
each outward action), one grey-cloud CNAME at Cloudflare that only the user can
add, the flip, the gate — and then the card. The deploy is also where a year of
"unverifiable from this machine" gap rows finally meet a real device.

### 2026-09-02 17:05 — the cutover: biscuitlab.net/bell is live

Phase 7, executed in an afternoon because two repos' worth of groundwork meant
it was mostly turning keys. The sequence, as run:

1. **PR #34 (this repo)** — canonical + sitemap — merged; the git-connected
   Vercel project `belltab` deployed it to production automatically.
2. **Biscuit-Website PR #50** — the dormant `BELL_ORIGIN` rewrite — merged; a
   no-op by design until the env var existed.
3. **Vercel, by CLI:** project created and linked, GitHub connected,
   `origin-bell.biscuitlab.net` attached. **Cloudflare, by the user:** one
   grey-cloud A record (`origin-bell → 76.76.21.21`); verified within minutes.
4. **The flip:** `BELL_ORIGIN=https://origin-bell.biscuitlab.net` on the hub's
   production env, hub redeployed (rewrites are read at build time — the
   redeploy IS the switch). Forty seconds later `biscuitlab.net/bell` served.
5. **Biscuit-Website PR #51** — the card, only after the gate passed.

**The gate, measured:** the page serves with BellTab's title and markup; a
`/bell/_next/*` stylesheet resolves 200 through the proxy; the canonical,
manifest and sitemap all serve through the hub; `/puzzles` is untouched;
per-deployment `*.vercel.app` URLs 302 behind protection.

**Two findings, both now gap rows:** the hub's `headers()` overwrites
BellTab's on the proxied hop (functionality intact — unlisted
Permissions-Policy features keep their `self` default, so the wake lock and
chime work at the public URL — but the stricter denial list is lost, and the
fix is hub-owned); and the origin host is publicly reachable **by design**,
which contradicted the roadmap's gate wording rather than the deploy — the
correction is under Deviations, and the canonical shipped first for exactly
this reason.

**One discovery in the hub repo:** the runbook's §3 sitemap index was
superseded months ago by `robots.ts` advertising per-zone sitemaps (with its
own research doc), so PR #51 adds `/bell/sitemap.xml` as one line in that list
and no index — and corrects the runbook addendum #50 wrote against the stale
section.

BellTab is deployed. What remains of Phase 7 is the hub card PR merging, and
the follow-up the deploy finally unlocks: the year of "unverifiable from this
machine" rows — real Safari, a real install, a real projector, a heard chime —
now have a URL to be verified against.

### 2026-09-03 09:10 — the verification pass

The user ran the five-item list the cutover unlocked, on real devices, and
reported every item good. Six gap rows close, each marked with its provenance:
five are reports from a real device — Safari's recompute-on-return, the
install, the chime, the wake lock, the iOS offset field — and one is a
measurement made here. That one is the share link: the user pasted a link
copied from the live site back through a chat client, and decoding it with the
real pipeline gave the full eleven-period Regular day, version 1, 265
characters, every boundary exact. The base64url argument — nothing to escape,
so nothing to mangle — held on its first real trip.

What stays open is what a single pass cannot close: the hub's headers winning
the proxied hop (hub-owned fix), the un-retried wake-lock refusal, the Android
notification gap, and the "WebKit is not one browser" family — a green day on
one Safari is a data point, not a matrix.

### 2026-09-03 10:40 — custom kinds, and an end box that fills the length in

The first post-roadmap feature, from a direct ask: kinds beyond the three
built-ins, and an end-time column because "doing the math is difficult".

**Kinds are free text now.** The only consumer the enum ever had was the block
counter's "is this Passing?", so nothing downstream needed a closed list. The
editor's `<select>` became a text box with a `<datalist>` of eight built-ins -
Class, Lunch, Passing, Planning, Advisory, Homeroom, Break, Assembly - and
anything else typed is kept as typed, trimmed, capped at 24 characters. The
parser normalises a built-in's lowercase form to its canonical spelling, and
that one line is the migration for every schedule stored or shared before
today: no storage key bump, no share version bump, on the widening argument
recorded in Decisions. The fixture file's expectations were edited for the
first time in its life, and its header now says exactly what changed and why
the payloads' meaning did not. A new fixture carries "Study hall".

**The end box is a view that can be typed into.** Start and length remain the
draft's truth - length is what makes `start >= end` unreachable by typing, and
what `movePeriod` trades slots by - and `updatePeriod` keeps the three in step
with one rule: a length moves the end, an end moves the length, a start moves
the end and keeps the length. An end typed before the start reaches the parser
as a negative length and comes back on `endMin`, which the row now binds to
BOTH boxes. The one case the length box could never express is the reason the
end box was worth adding.

**The layout bug, under Bugs found.** Seven columns did not fit a 684px panel
and the name column collapsed to 8px on every engine; Chrome's axe missed it
by two pixels. The fix is a container query with three tiers, and the lesson
is one this stylesheet had already written down once.

**Tests:** unit 377 → 397. The parser gains a `kinds` block (normalisation,
custom text kept, the cap); the draft model gains an `updatePeriod` block
(seven cases for the three-box rule) and an end-aware `movePeriod` case; the
"unknown kind" rejection became three rejections that still exist - blank, not
a string, too long. Playwright 603 → 615: four new editor tests per engine
(the boxes filling each other in, an end before the start on both boxes, a
custom kind surviving a reload, a legacy lowercase kind shown canonical), and
`readRows` now reads `start-end length` so every existing assertion also
checks the three fields agree on every row. The keyboard test's Tab budget rose
from 120 to 160 for the extra stop per row - the tab-chain gap row's number is
now seventy-seven, not seventy-two.

`npm run lint`, `npm run typecheck`, `npm run build`, `npx vitest run`,
`npx markdownlint-cli "**/*.md"` and `npx playwright test` all pass, with the
known macOS-WebKit exception in `editor.spec.ts`.

### 2026-09-03 11:40 — four gaps closed, one of them in the other repo

The first pass at the open-gaps table after the cutover, taking the four that
were cheap, fresh, and did not touch the editor (so nothing collides with the
kinds-and-end-time branch).

**The hub's headers (Biscuit-Website #52).** The only finding from the cutover
that was a real regression in posture. The fix is one negative lookahead on the
hub's `headers()` source so `/bell` and `/puzzles` are left to their origins -
and it was PROVEN before it shipped, not reasoned: the hub built locally with
`BELL_ORIGIN` pointed at the real origin host served `/bell` with BellTab's full
header set and `/` with its own. What remains is a curl on the live site once
the hub deploys.

**The un-retried refusal.** A refused wake lock now asks again on the next tap
or key press. There is no event for "battery saver went off", so the honest
recovery is the next thing the user does - the chime's autoplay unlock made
the same choice for the same reason. The refusal sentence names the remedy;
its unit test pins that.

**The signpost.** A sentence under the Big mode button - "On a projector? Keep
the screen awake" - that opens Preferences. A sentence with a link-styled
button in it rather than a second pill, because two pills side by side read as
a two-state switch, which Big mode was built not to be. Shown only while the
lock is supported and off.

**The clipboard-refused branch.** The gap that the wake lock's stub-at-the-
boundary argument was first written against, finally closed by that argument:
`writeText` stubbed to reject, the "copy by hand" sentence and the link both
asserted.

**Tests:** unit 377 → 378 (the refusal sentence's remedy). Playwright +15
across three engines - a refusal-retry test, three signpost tests and the
clipboard test, one each per engine - on top of whichever total the
kinds-and-end-time branch lands first; the roadmap's number is updated after
both merge.

**Addendum, 2026-09-03 12:30 — after review.** A `high`-effort code review of
this branch found twelve things, five of them real: the double-request race,
the listener lifecycle, the copied alert sentence, `--grape-dark` never
defined for dark mode (a hovered signpost fell to ~1.4:1), and a duplicate
`id="wake-lock-hint"` that collided with the checkbox's `aria-describedby`
target. All five are fixed; the race has its own Bugs found entry. Also taken:
the signpost now shows for `refused` as well as `off` (through a predicate, so
a sixth status has to answer for itself), settings opened from the signpost
return focus to it on close — remembered by id, since the signpost is
unmounted while settings is up and re-mounted on close — the keydown half of
the retry is exercised, both hint-absent tests now wait for a client-rendered
status before asserting, the gesture listener is one shared `listenForGesture`
for the chime and the lock, `stubClipboard` lives in helpers.ts, and the
hub-headers row moved back to Open gaps until the live curl is done — as
`AGENTS.md` says it should.

### 2026-09-03 13:30 — the editor-UX gap batch

Four rows from the open-gaps table, all small, all in the editor's neighbourhood
and none in the files the previous batch touched.

**A visible label on the schedule name.** It had been `.visually-hidden` since
the retired build — right for assistive tech, and nothing at all for a sighted
user looking at a big box holding "Regular". One small-caps line above it, in
the voice the stacked editor already uses for its row labels.

**Weekdays beside dated exceptions.** "Sat 2026-09-05", because a school year is
planned around the Monday and not the 14th. Computed on the string — Sakamoto's
method on three integers — for the reason the Decisions table records: a `Date`
built from a date-only ISO string is UTC midnight and reports the wrong weekday
for every user west of Greenwich. `src/lib/dates.ts`, seventeen unit tests
including the fixtures' known weekdays and a leap day.

**Arrow keys on the picker.** Roving `tabIndex` makes the chip group one tab
stop; the arrows walk it with selection following focus, Home and End go to the
ends, and the arrows stop there rather than wrapping. This is what an ARIA
tablist would have brought without the rest of its contract, which the
SettingsView's own comment declined to take on in Phase 4.

**"Running today" in the delete confirmation.** The dialog said any day
pointing at the schedule would fall back to no school; it did not say that
TODAY was one of those days, which is the case where the countdown blanks the
moment the dialog closes. It says so now, from the same resolver the calendar
panel reads, and only when today actually resolves to the schedule — the
resolver's index-0 fallback for a day with no schedule is not "today's".

**Tests:** unit 401 → 418 (the weekday helper). Playwright 633 → 639 — a picker
keyboard test and a running-today test, one each per engine — and the existing
exception assertion now expects the weekday in front.

`npm run lint`, `npm run typecheck`, `npm run build`, `npx vitest run`,
`npx markdownlint-cli "**/*.md"` and `npx playwright test` all pass, with the
known macOS-WebKit exception in `editor.spec.ts`.

### 2026-09-03 15:10 — the comfort-gap batch

Four more rows, all in the preferences panel's and the calendar's
neighbourhood, none large.

**The crossfade the design system asked for on 2026-08-26.** A 150ms fade on
the period name, and the mechanism is one attribute: `key={boundaryKey(state)}`
on the element, so a bell remounts it and the CSS animation runs then and only
then. No JavaScript, no timer, and it collapses under both reduced-motion
paths. The E2E asserts the animation on the name and its absence on the
digits, and that crossing a bell remounts the element.

**An in-app reduce-motion toggle.** The fourth boolean preference, and the
boolean quartet's parse rule covers it for free. `applyMotion` puts
`data-motion="reduce"` on `<html>` beside the theme; globals.css repeats the
reduced-motion cut under that attribute, because a media query and an
attribute selector cannot share a rule. Absent means the OS decides, which is
why it is the default.

**"Remove past exceptions."** `pastOverrides` and `removePastOverrides` in the
library — string comparison on ISO dates, which is the format's one nice
property — and a button above the list that names the count and keeps today's
own exception, because it is still running. A decision rather than an
automatic sweep; the Decisions table says why.

**The large-offset sentence.** At sixty seconds or more the readout adds: edit
the schedule instead, this stays on this device. The cap is not lowered.

**Tests:** unit 418 → 423 (the pruning helpers). Playwright 639 → 654 — five
per engine: two for motion, one each for the warning, the pruning and the
crossfade. The preferences byte-pins gained their fifth field.

### 2026-09-03 16:20 — deciding the parked rows

Five open-gap rows were not gaps. They were decisions deferred with a note
saying "decide on purpose", and the purpose never came. Made now.

**Deleted:** the Day view's chain — `formatDayCaption`, `daySummaryAt`,
`DaySummary`, `blockPositionAt`, `BlockPosition` — with their eleven tests,
and four CSS sections nothing rendered (the day summary, the period rows, the
period strip, the disclosure) plus the three inert rules the 2026-09-02 row
enumerated. The stylesheet is 14 sections instead of 21 and every one is
live. `blockPositionAt` was the engine's only reader of `kind`, so `kind` is
now purely descriptive; the model's comment says so and says where the
semantic would come back.

**Deferred, with triggers:** am/pm, Big mode surviving a reload, Big mode
requesting fullscreen — three rows moved to the roadmap's Deferred table, each
with the condition that would reopen it, which is the difference between a
decision and a row.

**And one catch, under Bugs found:** two live `overflow-wrap` rules had been
written into the Day view's section and went with it; the reflow gate failed
six tests at 320 and 375px on the first run and they are back beside the
elements they protect.

**And a second catch, unrelated to the sweep:** WebKit's a11y run found the
crossfade from #39 starting at opacity 0 on first paint - under a paused clock
WebKit never advanced it, and the period name had no contrast. The fade now
runs only after a boundary has been seen. Its own Bugs found entry.

**Tests:** unit 423 → 412 — eleven deleted with the code they proved. No new
tests: nothing here added behaviour. Playwright unchanged at 654; the reflow
and a11y gates ran on the trimmed stylesheet - and earned their keep twice.

### 2026-09-03 17:30 — the last code-fixable rows

Three rows, and with them the open-gaps table is down to the things this
machine cannot settle: real Safari, the CSP that needs a nonce Next will not
give without middleware, TypeScript 7, Android notifications, evidence that
lives in another repo, and undo.

**"No school today" reaches the weekday defaults in one step.** A link-weight
second route under the pill, opening the calendar panel with focus on the
"Weekday defaults" heading so the next Tab is Monday's select. Focus-by-id on
open is the same mechanism the wake-lock signpost uses for focus-by-id on
close, now both directions of `openSettingsFrom`.

**The editor's rows are named groups.** `role="group"` and `aria-label` on
each row's grid, so a screen reader announces "Period 2, group" on entry. The
tab-chain row named two fixes; this is the one with something to attach to.

**Axe at 320px.** Three more journeys through the densest panels at the
reflow floor, where the editor's DOM is a different shape. The bar stays at
critical/serious, on purpose.

**Tests:** unit unchanged at 412. Playwright 654 → 666 — the link test and
three 320px sweeps, per engine.

### 2026-09-04 09:40 — the calibration aid, and two rows the checks turned actionable

Asked "anything we can do about the rest", and the answer was: check before
assuming. Two rows that read as hardware-gated were not.

**"The bell just rang."** A button beside the offset that does the
subtraction the row complained nobody did: press it as the real bell sounds,
and `calibrateOffset` takes the nearest bell in today's schedule — every
period's start and end — and stores the difference with the offset's own
sign. Beyond the cap it refuses with a sentence through the offset's existing
polite region; with no schedule today it is disabled and says why. The pure
function takes the cap as an argument, because the first draft imported it
from the app layer into `src/lib/` and that is the wrong direction.

**Option+Tab.** A probe against macOS WebKit walked plain Tab (body, body,
body) and Option+Tab (the buttons, in order). `tabTo` uses the latter on
`webkit` + `darwin`, and the editor spec passes on WebKit locally for the
first time since the three-engine matrix landed - the "known exception" in
every session log since is gone.

**`theme-color` per scheme.** `viewport.themeColor` takes a media list; the
installed window's chrome follows the OS scheme now. The splash itself
cannot, by spec, and that half stays deferred.

**Also checked and still facts:** TypeScript 7 (`typescript-eslint` peers
`<6.1.0`); the CSP `script-src` (Next 16's guide offers only a nonce from
`proxy.ts` - middleware renamed - with dynamic rendering, both banned here).

**Tests:** unit 412 → 422 (nine for `calibrateOffset`, one for
`scheduleForToday`). Playwright 666 → 675 — three per engine for the aid: a
measured press, a refused press, and a day with nothing to measure against.

### 2026-09-04 11:00 — the copy pass

Asked for: settings copy that is friendlier and simpler for a broader
audience, still useful. Done across the five panels and the two status
modules (`describeWakeLock`, `describeChime`, `describeNotify`), the delete
and import confirmations, and the share-link status.

The rule applied: same facts, fewer words, second person, contractions, no
jargon. "The OS's own reduce-motion setting is already honoured. This cuts
animation here regardless of it — for a shared machine, or a projector that
judders" became "Turns off animations here, even if your device allows them.
Handy on a shared computer, or a projector that stutters." "A dated exception
wins. Failing that, the weekday default decides. Failing that, there is no
school" became "A dated exception comes first. Otherwise the weekday default
applies. If neither says anything, there's no school that day."

One drift caught on the way: the notification alert region hardcoded a copy
of the blocked sentence — the same defect the wake lock's alert had in
review. It now renders `describeNotify` like the readout does.

**Tests:** counts unchanged (422 unit, 675 Playwright). Twenty-odd pinned
sentences updated in the specs; the unit tests on the wording pin the words
that matter ("refused", "asks again", "site settings", "background") and all
still hold.

### 2026-09-04 13:20 — Phase 8: the Day view, back

"What happened to the full day view?" The honest trail is under Deviations:
built in the plain build, retired with a note that it was owed, named by no
phase, its tests deleted for that reason and its residue deleted as dead code
the day before yesterday - by me, treating an unkept promise as a decision.
The user wanted it back. It is back, as a phase of its own.

**What it is.** The whole schedule as an `<ol>` under a one-line summary -
"2 of 7 · 5h 00m until dismissal" - and the day's progress bar. Each row
carries its start time, its name and one of three asides: "55m" for what is
coming, "done" for what is over, and for the running row its own remaining
time spelled out ("35m 00s", because a bare colon form beneath "1h" reads as
one minute twenty) with a progress track. The running row is
`aria-current="time"` and scrolls into view at a bell and on entry, never on
a tick, jumping rather than gliding under either reduced-motion path.
Finished periods collapse behind "2 earlier periods" (`aria-expanded`) so the
running row sits at the top; the collapse is off once the day is over.

**What came back from git.** `daySummaryAt`, `blockPositionAt` and
`formatDayCaption` with their tests, restored from the commit before #40 -
with `kind`'s one engine meaning ("Passing is a seam") restored alongside and
the model's comment rewritten a second time in two days. The period-row and
disclosure CSS came back too; the retired summary trio did not, because the
rebuilt summary is one caption (Decisions has the argument), and the strip
stayed deleted.

**What the gates found, again.** The first axe sweep ever to scan this list
failed it twice: past rows dimmed with `opacity: 0.55` under a comment
claiming that stayed above 4.5:1, and the running row's time painted in the
accent, which is under 3:1 as text. Both restored verbatim from the retired
build on the strength of their comments; both under Bugs found. Restored
code is new code.

**The switcher.** Now and Day are a pressed pair beside Big mode; the
2026-09-02 decision that refused a two-state switcher stands, because it
refused one whose second state was "normal", and Day is a real destination.
Big mode stays a mode over the countdown and returns to whichever screen was
up.

**Tests:** unit 422 → 436 (the restored fourteen). Playwright 675 → 702 -
eight Day view tests and one axe journey per engine, and the reflow gate now
walks Now, Day (past rows shown) and Big at every width.

### 2026-09-04 15:30 — the blocks strip, back as a preference; the copy, again

Two asks in one message. The horizontal blocks - "the full day but just
blocks, and you could see progress through them" - and plainer copy, with the
sentences supplied.

**The strip.** The plain build's period strip, restored from the commit
before #40: one square per block, a thin link per Passing, each filling as
its time passes, `aria-hidden` under a caption that says the position in
words - "2 of 7 · 5h 00m until dismissal", or the hovered period's name and
times. It lives under the countdown behind a Preferences checkbox, "Show the
day as blocks", off by default; Big mode scales it with the rest. The strip
CSS and Big mode's scaling of it came back from git; the caption class is
new. A partly filled square is a STATE, not a tick - a frozen tab that jumps
20% on return reads as normal, which is the recompute rule with a shape that
makes it also look right.

**The copy.** In the user's words, near enough: the schedules note, the
calendar note, and a bell-offset hint that says what it does instead of
asking a question. Backup stays.

**Noted, not changed:** the Day view and the strip both read the SHIFTED
clock, like the countdown, so under an offset their rows and cells agree with
the countdown rather than with the header's wall clock. The user called it "a
little weird" and "maybe okay"; it is the same decision the offset made on
day one - every derived view of the clock agrees - and it stays until it is
more than a little weird.

**Tests:** unit 436 → 441 (the sixth boolean preference joins the shared
suite). Playwright 702 → 726 - seven strip tests and one axe journey per
engine; the reflow gate now walks the Now view with the strip on at every
width, and the preferences byte-pins gained their sixth field.

### 2026-09-04 17:10 — notifications on Android, and the gaps table split in two

**The worker.** `public/sw.js`, thirty lines, no fetch handler: install,
activate, and a `notificationclick` that brings the tab forward. `bells.ts`
registers it the moment notifications are on and granted — never before, so a
user who never asked carries no worker — and shows every bell through
`registration.showNotification` where a registration exists, which is the
only route Android Chrome allows, falling back to `new Notification` where
there is no worker at all. The 2026-09-02 decision against a service worker
was about caching, and this caches nothing; the Decisions table has the
narrowing. The E2E stubs `navigator.serviceWorker` with a fake registration
that records which route a bell took, and asserts: no worker before a grant,
one after, one again after a reload with a standing grant, the worker's route
by default, the page's where no worker can exist.

**The table.** Eight open-gap rows were facts, not work — TypeScript 7, the
CSP nonce, Next's route announcer, WebKit-is-not-Safari, the Puzzle Lab
evidence, the `locked` sentence, the public origin, the network at build.
They now live under **Known limits**, dates and text intact, so Open gaps
reads as what is owed. What is owed is now one row: undo, declined for now.

**Tests:** unit unchanged at 441. Playwright 726 → 738 — four per engine: registration on grant, registration at load under a standing grant, the page fallback where no worker can exist, and the worker file's contract (served as script, no fetch handler) in the manifest suite.

**Addendum, 2026-09-04 18:40 — after review.** A `high`-effort code review
of this branch found seven things; five taken. The worker was used before it
was active and a bell in that window was lost (measured on real Chrome - its
own Bugs found entry, with the `/bell` vs `/bell/` scope trap that rules out
`serviceWorker.ready`); the click handler could focus a Puzzle Lab tab; the
worker was never unregistered on off; three fills crawled on per-tick
decimals; and the scheduled view now carries its schedule so the Day view and
the strip stop re-resolving the calendar and discharging the result with `!`.
The strip's "works on a touch tap" claim is withdrawn rather than implemented.
The stub models the activation lifecycle, and one Chrome test registers the
real worker. Playwright 738 → 747.

### 2026-09-04 19:50 — the strip as the user remembered it, and shared links that run today

**The strip, redesigned.** "It replaced the period progress bar and took up
the whole left to right, with dashes when it changed type of block." So it
does now: the strip stands in the progress bar's place under the countdown,
spans the card, and each block grows in proportion to its length - lunch
reads as half a class - with a passing period drawn as a fixed dash between
the blocks it joins. The retired build's equal capped squares, and their
reasoning, are superseded in Decisions; the objection they answered
(proportional cells make passing a sliver) is what the dash answers instead.
Big mode's scaling follows. The reflow gate walks it at every width; a test
pins the edge-to-edge width and the lunch-to-class ratio.

**Shared links run today.** Accepting a shared schedule now writes a dated
exception for today pointing at it, so the countdown swaps the moment the
button is pressed; the weekday default is untouched. The offer says "Add it
and it runs today; your other days aren't changed." Add also CLOSES settings
rather than opening the editor: a link pasted into a tab that is already on
BellTab is a same-document navigation, so an open panel stays open under the
offer, and "add" should end on the countdown. (Found the slow way - a test
that clicked the settings toggle after Add closed the panel it assumed it was
opening, and an hour of probes chased a click that was never swallowed.) The
test that used to assert the calendar was untouched now asserts the exception
and that the weekday is still the regular day.

**Tests:** unit unchanged at 441. Playwright 747 → 750 - one strip test per
engine; the share test changed shape rather than count.

### 2026-09-04 21:20 — the shared schedule shows itself; the strip, taller and seamed

"The share link still doesn't work." It did what I had built and not what
had been asked: it swapped to the shared schedule after Add, and the user
wanted to see it on opening the link. So now a pending offer IS the view -
countdown, title, Day view, strip, all from the offered schedule on the same
clock - and the buttons are "Keep it" and "No thanks". Keeping writes the
schedule and today's exception; declining restores the regular day. Nothing
is written until they choose. Found in the same change: at the fifty-schedule
cap `addSchedule` hands the library back unchanged, and my "take the last
schedule" would have pointed today at somebody else's - guarded before it
shipped.

The strip's blocks are 20px tall (30 in Big mode) so hovering does not need
aiming, and a seam now marks where two blocks of different kinds meet with
no passing between them.

**Tests:** Playwright 750 → 756 - the preview-and-revert test and the seam
test, per engine. Unit unchanged at 441.

**Addendum, 2026-09-04 22:40.** The strip's punctuation simplified on request:
a dash only where the kind changes, and no cell for a passing period at all.
The version an hour earlier drew a dash per passing AND a seam per kind
change; the rule "planning, dash, classes, dash, lunch" is one vocabulary and
the better one. Decisions has the superseding row. Test counts unchanged; the
three strip assertions changed shape (seven blocks, not eleven cells; two
dashes; one past block at 09:30, not two).

### 2026-09-05 — the tidy-up

Hub #53 merged: "A clock that never counts down", the BellTab build-log post,
with three images, an answer-first opening, question headings and the one
code snippet it was missing, plus the two research docs the hub was writing
against but did not hold - `devlog-blog-portfolio-strategy.md` and
`web-design-and-game-juice.md`, copied verbatim from Puzzle Lab with a
provenance line. The hub's dev server is stopped.

Local housekeeping in both repos: merged branches deleted, worktrees pruned,
`main` fast-forwarded. The README gained the Day view, the day-as-blocks
option, the calibration button and the share preview; the Current state block
at the top of this file caught up with two days of work.

Nothing is in flight. The next thing that happens to this project should be
a week of real use.
