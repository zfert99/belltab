# Code review — 2026-08-26, commit `437ef54`

Review of `437ef54` *"fix: close eight of the thirteen known gaps (#3)"*, the
squash-merge of PR #3. Scope was `git diff HEAD~1 HEAD`: the working tree was
clean and `origin/main` was level with `HEAD`, so the last commit *is* the
change under review.

Every interactive claim below was verified against the real app in Chrome
(static server on `localhost:3111`) rather than reasoned about, because three of
the five findings are lifecycle behaviour that no unit test in this repo can
see. Observed values are quoted verbatim.

**Status: all five findings are fixed** as of 2026-08-26 15:10, on branch
`fix/code-review-437ef54`. Every row has moved from **Open gaps** to **Closed**
in `Docs/build-log.md`. The write-up below is left in its original tense as the
durable record of what was wrong and how it was measured; see **What was
changed** at the end for the resolution of each.

---

## Summary

| # | Where | Severity | Finding |
| --- | --- | --- | --- |
| 1 | `src/app.js:80` | High | Escape on the confirm dialog tears down the settings view |
| 2 | `src/ui/views.js:454` | High | The `aria-live` region fires per keystroke, not per period boundary |
| 3 | `src/ui/editor.js:509` | High | The `showModal` fallback deletes with no confirmation at all |
| 4 | `src/app.test.js:164` | Medium | "is the only live region on the page" asserts a falsehood |
| 5 | `src/ui/views.js:263` | Medium | The Day view kept the units ambiguity the Now view just fixed |

Findings 1–3 are all consequences of the same trade: the commit swapped two
browser-level primitives (`window.confirm`, a glyph) for page-level ones
(`<dialog>`, an `aria-live` region) without accounting for what the browser had
been doing for free.

---

## 1. Escape on the confirm dialog tears down the settings view

**Where:** `src/app.js:80`, with `src/ui/editor.js:521`.

The commit replaced `window.confirm` with `dialog.showModal()`. The app already
has a document-level Escape handler:

```js
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (settingsOpen) {
    setSettingsOpen(false);
    els.settingsToggle.focus();
  } else if (activeView === "big") {
    leaveBig();
  }
});
```

A modal `<dialog>` is part of the page, so its Escape keydown bubbles to
`document` and runs that handler. The dialog's own close is the *default
action* of the same key event, so the app's listener goes first. `window.confirm`
never had this problem: it is a browser-level modal and dispatches no keydown to
the page at all.

**Reproduced in Chrome.** Settings → Schedules → Delete (modal opens, Cancel
focused, as designed), then one Escape:

```text
{ dialogOpen: true, settingsHidden: true, bodyIsSettings: false, focusViewHidden: false }
```

`settingsOpen` was true, so `setSettingsOpen(false)` ran: the settings view is
hidden, `is-settings` is off the body, the countdown is painted underneath, and
focus was pushed to the header toggle. The user pressed Escape to dismiss a
confirmation and lost the entire editor instead — with a live
"Delete this schedule?" modal still floating over the countdown, its Delete
button still wired to `applyDelete`.

`setSettingsOpen(false)` never calls `dialog.close()`, so leaving settings by any
route strands the dialog open.

**Fix:** bail out of the handler while the dialog is open — check
`els.confirmDialog.open`, or `event.target.closest("dialog")` — and close the
dialog from `setSettingsOpen(false)`.

**Doc correction owed:** the build-log entry for this change says `showModal()`
supplies "Escape-to-close" for free. As wired, it does not.

## 2. The `aria-live` region fires per keystroke, not per period boundary

**Where:** `src/ui/views.js:454` (the `announce(state)` call), with
`src/ui/views.js:50`.

`announce()` sits outside the `paused` branch of `tick()` on purpose, so the bell
still announces while settings is open. But `tick()` is not only the clock — the
editor calls it after every edit:

```text
row.name "input" → validateDraft() → refreshResolved() → tick() → announce(state)
```

`announce()` compares `state.current.name` against `lastAnnounced`, and a
half-typed name is a different string on every keystroke.

**Reproduced in Chrome**, during a period, typing `Chem` into the running
period's name field. Successive values of `#period-announcer`:

```text
["C has started.", "Ch has started.", "Che has started.", "Chem has started."]
```

A screen reader reads all four. Reproduced again in jsdom from the Calendar
panel: pointing the weekdays at "No school" wrote `"No schedule."` to the
announcer, and applying a shift wrote `"Period 1 has started."`

This is the assistive-technology spam that `AGENTS.md` forbids, in the one region
the rule exists to protect, and it is the exact opposite of what the same
commit's build log claims ("fires only at period boundaries").

**Fix:** key the guard off the period's identity on the clock — its
`startMin`/`endMin` — rather than off the rendered name string, and/or skip
announcing while `paused`.

## 3. The `showModal` fallback deletes with no confirmation at all

**Where:** `src/ui/editor.js:509`.

```js
if (typeof dialog.showModal !== "function") {
  onConfirm();
  return;
}
```

Where `<dialog>` is unsupported, the destructive action simply happens. The JSDoc
frames this as not "silently refusing the delete the user asked for", but the
user has not yet asked — they clicked a button whose entire contract is that it
asks first.

**Verified:** jsdom 30, this repo's own test environment, does *not* implement
`showModal` — `typeof dialog.showModal === "function"` is `false`. So in every
test run, clicking `#schedule-delete` runs `applyDelete()` straight through:
`store.schedules` is filtered, `saveSchedules()` persists it, and `store.calendar`
is re-parsed, wiping every weekday and override that pointed at the deleted
schedule. The same holds in Safari before 15.4.

Two consequences:

- An irreversible action loses its only guard on exactly the platforms least able
  to recover from it.
- The delete flow is now untestable in this suite — any test that clicks Delete
  takes the silent branch. That is why deletion still has no test at all.

**Fix:** fall back to `window.confirm`, which this commit removed and which works
everywhere, rather than to unconditional deletion.

## 4. "is the only live region on the page" asserts a falsehood

**Where:** `src/app.test.js:164`.

```js
expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
```

`#schedule-error` (`src/index.html:252`) and `#override-error`
(`src/index.html:291`) both carry `role="alert"`, whose implicit `aria-live` is
`assertive`. Neither has a literal `aria-live` attribute, so the selector misses
both and the assertion is green.

The page therefore has three live regions, two of them assertive — and the
invariant the test is named for is already broken. `clearErrors()` blanks
`#schedule-error`'s `textContent` and `showErrors()` refills it on every
`validateDraft()`, i.e. on every keystroke in the editor, so an *assertive*
region is churned per character.

The test also provides none of the protection it was written for: adding a
`role="status"` or `role="alert"` node later would not fail it.

**Fix:** assert over `[aria-live], [role="alert"], [role="status"], [role="log"]`,
and decide deliberately what the two error regions should be. `role="alert"` on a
field that revalidates per keystroke is very likely the wrong role.

## 5. The Day view kept the units ambiguity the Now view just fixed

**Where:** `src/ui/views.js:263`, and `src/ui/views.js:292`.

`splitCountdown` now returns `unit` precisely so a reader can tell `3:38`
(hours:minutes) from `3:38` (minutes:seconds). `paintFocus` uses it. `paintDay`
destructures only `{ major, minor }` and drops it, and `#day-view` has no unit
label anywhere.

**Observed live:**

- `#day-remaining` read `"6:24"` beside the label `"until dismissal"` — six hours
  and twenty-four minutes, rendered identically to how six minutes and
  twenty-four seconds would render fifteen minutes before the last bell.
- The current row's aside read `"49:16"` while its siblings read `"10m"`, `"1h"`,
  `"55m"` (those come from `formatDuration`). So a 90-minute period with 80
  minutes left renders `"1:20"` directly beneath a row reading `"1h"`, with
  nothing to say it does not mean one minute twenty.

The Day view's number is the larger and more prominent of the two, so the gap
that was closed for the Now view is still open where it reads worst.

**Fix:** carry `unit` through `paintDay`, and give the Day view the same caption
slot the Now view got.

---

## Checked and cleared

Worth recording, so the same ground is not re-covered:

- **The SVG icon swap genuinely works.** `styles.css:342` carries
  `[hidden] { display: none !important }`, which outranks `.icon { display: block }`
  and matches the attribute on an `SVGElement`. Measured: settings closed →
  `{ gear: "block", back: "none" }`; open → `{ gear: "none", back: "block" }`. The
  build-log bug entry about `hidden` being an `HTMLElement` property is correct
  and the fix is sound.
- **Reflow holds at 320 CSS px**, including with the new dialog open:
  `documentElement.scrollWidth === clientWidth === 320` on the Now view, the Day
  view, and over the modal. The dialog measured 288px wide inside a 320px
  viewport.
- **The rebuilt delete buttons keep their accessible name** — the inline SVG is
  `aria-hidden`, and the visually-hidden span still resolves to
  `"Delete period 1"`.
- **The `els` snapshot claim holds.** No `replaceWith`, `remove()`, or
  `innerHTML` touches any node cached in `dom.js`; every rebuild is
  `replaceChildren()` on a container. Closing that gap by documenting the
  invariant rather than changing code was the right call.
- **All 120 tests pass**, and no temporary files were left behind.

---

## Recommended order

1. Finding 3 — smallest change, removes a silent data-loss path.
2. Finding 1 — one condition in the Escape handler plus a `close()` call.
3. Finding 2 — needs a real decision about what "the period changed" means.
4. Finding 4 — widen the selector, then decide the error-region roles.
5. Finding 5 — mechanical once someone picks where the caption sits.

---

## What was changed

Fixed in that order, on `fix/code-review-437ef54`. Unit tests 120 → 153, plus a
new 32-test Playwright suite in `e2e/`.

| # | Resolution |
| --- | --- |
| 1 | `app.js` bails out of the Escape handler while `document.querySelector("dialog[open]")` matches, so the key belongs to whatever is topmost. `setSettingsOpen` closes the dialog with an explicit `"cancel"`, so no route out of settings can strand it. |
| 2 | The announcer is keyed on the running period's `startMin`/`endMin` rather than on its rendered name, and `refreshResolved` raises a one-shot flag that makes the next tick resynchronise silently. |
| 3 | The unsupported-`showModal` path falls back to `window.confirm` instead of deleting unasked. |
| 4 | `#schedule-error` is `role="status"` (polite) and is written only when its message actually changes; `#override-error` keeps `role="alert"`. The test enumerates all three regions by id over a selector that includes the implicit roles. |
| 5 | `paintDay` carries `unit` into a `#day-remaining-units` caption matching the Now view's, and the running row's countdown is `formatRemaining` — `50m 00s`, `1h 20m` — so it reads correctly beside `formatDuration`'s `55m` and `1h`. |

### The decision behind finding 2

"The period changed" now means **the period under the clock is a different
block of the day**, not "the string on screen is different". Two things follow
that the name-keyed guard got wrong in opposite directions: a half-typed name
is not a new period, and two consecutive periods both called "Study Hall" are.
The second half was a live bug of its own that the review did not reach — a
name-keyed guard is silent at exactly the boundary the region exists for, and
both spellings render identically, so nothing in the suite could see it.

Suppressing announcements while `paused` was considered and rejected. The bell
is *most* useful to a screen-reader user who has settings open and cannot see
the countdown, which is why `announce()` sits outside the paused branch in the
first place. The flag is raised in `refreshResolved` instead — the one entry
point every edit funnels through — so what is suppressed is *edits*, not
*settings*.

### Verified in Chrome

The three lifecycle findings were originally measured in a real browser, so the
fixes were too — `e2e/` now runs 32 Playwright tests in the installed Chrome,
alongside the 153 unit tests. At 320 CSS px the reflow gate holds in every state
including over the open dialog (`scrollWidth === clientWidth === 320`, dialog
288 px wide), typing `Chem` into the running period's name now writes `[]` to
the announcer where the review measured four announcements, and removing the
Escape bail-out reproduces the original failure exactly.

Two claims in this document did not survive the browser and are corrected in the
build log under **Bugs found**:

- **"Leaving settings by any route strands the dialog"** was one route. A modal
  `<dialog>` makes the page behind it inert, so no click can reach the settings
  toggle; the Escape collision was the only way there. The `close("cancel")` in
  `setSettingsOpen` stays as defence for a non-modal `show()`, but it is not
  what fixes this.
- **Focus trapping is not `dialog.contains(activeElement)`.** Chrome's modal tab
  cycle parks focus on `<body>` at its wrap point — Cancel, Delete, body,
  Cancel. Nothing behind the dialog takes focus, so the trap is intact, but the
  obvious assertion is wrong about it.

### What is still owed

WebKit and Firefox are uncovered — one Playwright project, `chrome`, against the
browser already on the machine, with no engine binaries downloaded. `<dialog>`,
`:modal` and inertness are exactly where engines differ, so this is the gap that
matters most. Nothing runs the suite in CI yet either. Both are tracked in
**Open gaps**.
