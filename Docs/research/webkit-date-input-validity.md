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

<!-- PROBE READINGS GO HERE -->

## What it means for the fix

<!-- CONCLUSION GOES HERE -->

## Open questions

<!-- OPEN QUESTIONS GO HERE -->
