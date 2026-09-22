# What a date control reports for an impossible typed date, per engine

**Why this exists.** `AGENTS.md`: when implementation hits a roadblock — "a
measurement contradicts an assumption" — the answer is a research document, not
an improvised workaround. The measurement below contradicts one this repo
already acted on, and the contradiction cost sixteen consecutive red nightly
runs on `main`.

**Written 2026-09-22 (America/New_York), from a probe run on the CI runner**,
not from a development machine and not from memory. `AGENTS.md` again:
"Browser-behaviour claims need a citation or a test."

## The roadblock

`e2e/calendar.spec.ts` › "an impossible typed date" has failed on the `webkit`
project on every three-engine run since it merged in `36db33a` on 2026-09-08 —
run 122 (the merge push) through run 157 (the 2026-09-22 nightly). 873 of 874
tests pass; this one fails, deterministically, on the first attempt and on the
retry.

```text
[webkit] › e2e/calendar.spec.ts:461:3 › an impossible typed date ›
  is named as one, with the field marked invalid, until a real date replaces it

  Locator: locator('#override-date-error')
  Expected substring: "date that exists"
  Error: element(s) not found
```

**`element(s) not found`, not a text mismatch.** That is the informative part.
`CalendarPanel` renders the error element when

```ts
const dateIsUnusable = dateBadInput || (newDate !== "" && parsedNewDate === null);
```

so an absent element means *both* disjuncts were false: the control reported no
`badInput`, and whatever was in `value` either was empty or parsed clean. One of
the two messages would have rendered otherwise — the fix has a fallback branch
("That is not a date BellTab can store…") that did not fire either.

## What was assumed, and where the assumption came from

`Docs/code-review-2026-09-04-full-audit.md`, closing B7:

> Playwright's `keyboard.type` drives the date control through real key events,
> and on **Chrome, Firefox and WebKit alike** a typed February 30th leaves
> `value === ""` with `validity.badInput === true`.

The build log's Closed row for 2026-09-08 repeats it. Both are wrong about
WebKit, and this repo had already written down the reason they could be —
`Docs/build-log.md`, Decisions, 2026-09-01:

> "WebKit" is not one browser, and none of them is Safari — the development
> machine's WebKit build reports `type === "text"` for both `<input
> type="time">` and `type="date"` and renders bare text boxes; the Linux CI
> runner's build implements them. Real Safari has shipped `type="time"` since
> 14.1 and is a third thing again. […] any sentence of the form "X works in
> WebKit" now has to say which WebKit, and none of them is evidence about a Mac.

The B7 measurement was taken on the development machine's build. The failing
project runs the other one. The entry that would have caught this was written
seven days earlier, in this repository, by this project.

## Why CI did not catch it before it merged

`ci.yml` scopes the E2E job by engine:

```yaml
PW_ENGINES: ${{ github.event_name == 'pull_request' && 'chrome' || 'all' }}
```

Chrome alone on a pull request; all three engines on a push to `main` and on the
nightly schedule. That is a deliberate, documented trade (`e2e-ci-runtime.md`,
adopted 2026-09-08 — the same day), and its stated justification is that it is
"self-correcting, because the full three-engine run happens on every merge to
`main` and every night, on a fixed cadence".

The mechanism worked exactly as designed: the required `E2E (reflow gate)` check
on #60 was green on Chrome, and the WebKit run happened for the first time on
the merge commit, where it went red immediately. What did not work is the half
that is not in `ci.yml`: **nobody was watching the cadence.** Sixteen red runs
produced no Open gaps row, no Bugs found entry, and no change to the Closed row
that still describes the fix as verified on three engines.

That is the finding with the longest reach here, and it is not about WebKit.

## The measurement

`e2e/date-input-probe.spec.ts`, run on `ubuntu-latest` against Playwright
1.62.1's own WebKit and Firefox builds and the runner's Google Chrome — the same
three the nightly drives. It types `02302026` one `keydown`/`keyup` at a time
into `#override-date`, reading `value`, `type`, `validity.badInput` and
`validity.valid` after each keystroke, then after `Tab`, then after a
programmatic `fill("2026-02-30")`.

Run 3 of the probe workflow, 2026-09-22 20:08 UTC, all three green. Chrome
154.0.8037.57, Playwright's Firefox 153.0 and WebKit build v2336, on
`ubuntu-latest`.

| Reading | chrome | firefox | webkit |
| --- | --- | --- | --- |
| `input.type` | `date` | `date` | `date` |
| `badInput` after `0` | false | false | false |
| `badInput` after `2` | **true** | **true** | **false** |
| `badInput` after all eight digits | **true** | **true** | **false** |
| `value` after all eight digits | `""` | `""` | `""` |
| `badInput` after `Tab` | true | true | false |
| `document.activeElement` after `Tab` | `override-date` | `override-date` | **`override-schedule`** |
| `#override-date-error` count | 1 | 1 | **0** |
| Error text | "That isn't a date that exists…" | same | none |
| Add button disabled | true | true | true |
| `element.value = "2026-02-30"` (programmatic) | `""`, `badInput` false | same | same |

Four things fall out of that table, and only the first was expected.

**1. WebKit never sets `badInput` at all.** Not on any keystroke, not after
blur. `value` stays `""` and `validity.valid` stays `true` throughout. On this
engine there is **no DOM-observable difference between "the user typed February
30th" and "the box is empty"** — which is precisely the distinction B7 existed
to draw. The fix is not mis-wired on WebKit; the signal it is wired to does not
exist there.

**2. The CI WebKit implements `type="date"`.** It reports `type: "date"`, not
`"text"`. That confirms the build log's 2026-09-01 entry ("the Linux CI runner's
build implements them") and makes the comment above the control in
`CalendarPanel.tsx` — "WebKit reports `input.type === "text"` here and hands
back a plain text box" — **wrong for the engine CI actually runs**. It is true
of the development machine's build. Comment drift with a measurement attached.

**3. Chrome and Firefox set `badInput` from the SECOND keystroke.** After typing
`0` it is false; after `02` — a perfectly good month, with the rest of the date
simply not typed yet — it is true and `valid` is false. The control reports
"unparseable" for *every incomplete date*, not only for an impossible one.

That is a defect in the shipped fix that the merged test never looked for: on
Chrome and Firefox today, typing any ordinary date into this field raises **"That
isn't a date that exists. Check the day and the month."** from the second
keystroke until the last one, and the field is `aria-invalid` for that whole
time. The message is not merely premature, it is false — the date being typed
exists. Nobody saw it because the only test types an impossible date, where the
right answer and the wrong one look identical.

**4. A programmatic set is blanked on every engine.** `element.value =
"2026-02-30"` leaves `value === ""` with `badInput` false on Chrome, Firefox and
WebKit alike. This is HTML's value-sanitising algorithm, not an engine quirk and
not a broken instrument: the B7 audit note that "setting the value
programmatically reported `badInput: false`" was reporting real, specified
behaviour. `keyboard.type` was the right instrument; the conclusion drawn from
it was over-generalised to an engine that was never measured.

## A second measurement, from trying the obvious fix

The first fix attempt replaced `badInput` with a signal that needs no
`validity`: **at blur, the field is unusable if the user typed into it and left
it empty.** It covers WebKit by construction and cannot fire mid-typing, so it
looked like it answered both failures at once.

Run 4 of the branch workflow — the full suite, three engines — says otherwise.
The originally-red test went green everywhere, and a *new* test went red on
WebKit: typing `09142026`, a date that plainly exists, produced the error.

That settles the open question this document had been carrying. **WebKit does
not accept typed digits into a date control at all.** A valid date typed key by
key leaves `value` at `""` exactly as an impossible one does, which is why
`badInput` never has anything to report there — there is nothing in the control
to be bad. The first probe could not see this because it only ever typed a date
that was *supposed* to end up empty.

So on WebKit there is no signal, and no signal can be synthesised: "typed into
and left empty" is true of every typed date, correct and incorrect alike. The
earlier version of this section proposed exactly that rule and was wrong; it is
left above rather than deleted because the reasoning is what the next person
will try first.

It also means the first fix's WebKit behaviour was passing its test **for the
wrong reason** — right answer, wrong cause, which is the failure mode that made
this whole entry necessary in the first place.

## What it means for the fix

`badInput` is the only thing that separates a typed impossible date from an
empty box, and it is right — but only when asked at the right moment, and only
on engines that have it.

- **Read on blur, not on every keystroke.** This fixes the Chrome and Firefox
  defect: an incomplete date is unparseable, so mid-typing the answer is always
  "unparseable" and always meaningless. Blur is the first moment the question
  has content.
- **WebKit gets no message, and that is the honest outcome.** The engine neither
  reports `badInput` nor takes typed input, so the field stays empty and Add
  stays disabled. A user on WebKit reaches this field through the picker, where
  an impossible date cannot be produced.
- **The parse branch is untouched** and still catches the five-digit year that a
  control considers valid and `parseIsoDate` does not, on all three engines.

The test contract splits to match, with both halves asserted rather than one
skipped: every engine owes silence while the field has focus and a disabled Add
button; an engine that reports `badInput` owes the message on top. The suite
detects the capability at runtime instead of matching a browser name, so an
engine that gains it is held to the stricter contract without anyone
remembering to change a list.

## What this says about the gate, which is the larger finding

The engine-scoped CI trade is sound and the nightly did its job — it went red
on the merge commit and stayed red, accurately, sixteen times. What failed is
that **a red nightly on `main` reached nobody.** No Open gaps row, no Bugs found
entry, and the Closed row still describes the fix as verified on three engines.
A cadence nobody reads is not self-correcting.

That is a process decision and belongs to the owner, so it is a recommendation
here rather than a change: either the nightly has to be able to raise its hand
(an issue opened on failure, a notification), or the engine cut has to move so
that WebKit runs before a merge rather than after it. Anything that leaves a red
`main` discoverable only by someone choosing to look will fail the same way.

## Open questions

- **ANSWERED 2026-09-22, by run 4 above: no.** WebKit ignores typed digits in a
  date control entirely — a valid date typed key by key leaves `value` empty.
  The question is left here because the answer inverted the fix: it is the
  difference between "WebKit needs a different signal" and "WebKit has nothing
  to signal about". What is still unmeasured is *how* a WebKit user enters a
  date here at all — presumably the picker, which cannot produce an impossible
  one, but that is an inference and not a reading.
- **Is real Safari a fourth answer?** Nothing here is evidence about a Mac; the
  2026-09-01 entry's warning applies to this document too. Safari has shipped
  `type="date"` since 14.1 and may well set `badInput`. Untested, and untestable
  from CI.
- **How many other places read `validity`?** `badInput` appears only in
  `CalendarPanel`, but the class of mistake — a browser-behaviour claim measured
  on one engine and written down as "on all three" — is not specific to this
  field.
