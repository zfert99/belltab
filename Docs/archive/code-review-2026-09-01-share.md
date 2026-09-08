# Code review — 2026-09-01, `feat/phase-5-sharing`

Review of `main...HEAD` at `5eeb4e4` — the share encode/decode pipeline, its
fixture file, its test suite, and the build-log entry. The working tree was
clean, so the range diff is the whole scope.

Effort: `high`. Three findings, **all three fixed** in the same session — see
**What was changed** at the bottom. The findings below are recorded as they were
written, before the fixes.

Behaviour was checked with a throwaway probe rather than by reading the source,
which is what turned findings 1 and 2 from "possible" into "confirmed, with the
exact strings". Gates on the reviewed tree: `npm run lint`, `npm run typecheck`,
`npx vitest run` (279 passed) and `npx markdownlint-cli` all pass.

The pipeline is in good shape, and the two invariants that matter most hold up
under probing. The decoded-bytes cap really is enforced mid-stream rather than
after the fact. The fixtures genuinely round-trip, including the non-ASCII
entry. Forged `kind` values, overlapping periods, non-canonical base64 lengths
and empty payloads are all refused.

Both code findings are in the same three lines: **the version lookup**, which is
the one place the decoder trusts a string from a stranger before it has decided
what that string is.

---

## Summary

| # | Where | Severity | Finding |
| --- | --- | --- | --- |
| 1 | `src/lib/share.ts:222` | Medium | `DECODERS[version]` walks the prototype chain, so `constructor` is a valid version |
| 2 | `src/lib/share.ts:219` | Low | The version segment is never length-capped, and lands verbatim in a user-facing message |
| 3 | `Docs/build-log.md:3490` | Low | No Decisions rows and no Open gaps rows for a change that had both |

---

## 1. `DECODERS[version]` walks the prototype chain

**Where:** `src/lib/share.ts:222`.

```ts
const DECODERS: Record<string, (json: string) => unknown> = {
  "1": (json) => JSON.parse(json) as unknown,
};

const decoder = DECODERS[version];
if (decoder === undefined) { /* unknown version */ }
```

An object literal inherits from `Object.prototype`, so the lookup succeeds for
every key that prototype carries. `DECODERS["constructor"]` is the `Object`
constructor — a function, therefore not `undefined`, therefore treated as a
decoder and **called with the payload**.

Confirmed by running it. Each of these is a fragment whose version is a
prototype key and whose payload is a perfectly good v1 schedule:

| Version segment | What the user is told |
| --- | --- |
| `constructor` | `Give the schedule a name.` |
| `toString` | `That is not a schedule.` |
| `__proto__` | `This link is damaged - it may have been cut short.` |
| `valueOf` | `This link is damaged - it may have been cut short.` |
| `99` *(correct behaviour)* | `This link was made by a newer version of BellTab (format 99)…` |

`Object(json)` returns a `String` object, which `asRecord` accepts as an object,
whose `.name` is `undefined` — hence the first row. `Function.prototype.toString`
called with the JSON returns a primitive string, which `asRecord` rejects — hence
the second. The last two are objects rather than functions, so the call throws
and is caught as damage.

**Severity is medium, not high, and the reason is worth stating.** Nothing
unsafe happens: no prototype is polluted, nothing is written, and the parser
still refuses everything at the end. The damage is entirely to the diagnosis —
`Give the schedule a name.` for a link whose version marker is nonsense sends
whoever is debugging it to look at the schedule, which is the one part of that
link that was fine. It also means the dispatch table's guarantee — *one entry per
version, ever* — is not what the code enforces.

**Fix:** a `Map`, which has no prototype keys to inherit. `Object.hasOwn` or
`Object.create(null)` would also work; a `Map` says "this is a lookup table"
rather than "this is an object I promise to be careful with".

---

## 2. The version segment is never length-capped

**Where:** `src/lib/share.ts:219`, with the cap at `:230`.

```ts
const separator = text.indexOf(".");
const version = text.slice(0, separator);
const payload = text.slice(separator + 1);
// ...
if (payload.length > SHARE_LIMITS.encodedChars) { /* too long */ }
```

`SHARE_LIMITS.encodedChars` is documented as bounding what arrives from a
stranger, and it bounds only the half after the dot. The version is sliced from
whatever precedes the first `.`, at any length, and then interpolated verbatim
into the message:

```ts
`This link was made by a newer version of BellTab (format ${version}) than this one can read.`
```

Confirmed: a fragment of 200,000 digits followed by `.` and a valid payload
produces a **200,082-character** error message.

Low severity — a fragment is not a network input, the string is rendered as text
and never as markup, and the tab survives it. But it is a cap that does not do
what its own doc comment says, and an unbounded attacker-controlled string
reaching a user-facing string is the shape that becomes a real problem the first
time somebody logs it, puts it in a `<title>`, or sends it anywhere.

**Fix:** cap the whole fragment before splitting it, and cap the version segment
separately and tightly — a version is a handful of characters, and anything
longer is not one.

---

## 3. The build-log entry records no decisions and no gaps

**Where:** `Docs/build-log.md:3490`.

`AGENTS.md` is explicit that every change adds a Session log entry, **a
Decisions row if a why was involved**, and **an Open gaps entry if anything is
knowingly unfinished**. This change has a long session-log entry and neither of
the other two.

At least three choices in it were reasoned and are exactly what a Decisions row
is for:

- The payload carries no `id`, so a shared link cannot claim an identity in the
  recipient's library.
- The fixture expectations are written out in full rather than derived from
  `DEFAULT_SCHEDULES`, so a seed edit cannot silently redefine what a historical
  payload means.
- The decoded cap is enforced while the stream is read rather than after
  `arrayBuffer()`.

And the change is knowingly half a phase: the share-link UI and JSON
export/import are not built. That is a textbook Open gaps row, and its absence
is the specific failure mode the build-log rules exist to prevent — the reasoning
was in the session narrative, where it cannot be found by scanning the table
that is supposed to hold it.

---

## Checked and cleared

Recorded so the same ground is not re-covered:

- **The decoded-bytes cap is enforced mid-stream, not after.** Probed with a
  mebibyte of zeroes that compresses to ~1,400 characters — under the length cap,
  so only the decoded cap can refuse it, and it does.
- **The build log's note about the earlier version of that test is accurate**,
  and the test now asserts the payload is under the length cap so the mistake
  cannot recur.
- **Every fixture round-trips**, including the entry carrying accents, an em
  dash, CJK and an emoji. UTF-8 survives `TextDecoder`.
- **Forged input is refused at the parser, not before it.** A payload with an
  invalid `kind`, one with overlapping periods, and one with a missing name are
  all refused with the parser's own field-level errors, which is the intended
  division of labour.
- **base64url handling is correct**, including missing padding and rejection of
  characters outside the alphabet.
- **The id is genuinely dropped** on encode, and `parseSchedule` returns `null`
  for it on decode.

---

## Recommended order

1. Finding 1 — it is three characters of behaviour and it is the one that
   misdiagnoses a real link.
2. Finding 2 — same function, and the two caps should be described together.
3. Finding 3 — documentation, and the rows are already written in the session
   narrative waiting to be lifted out.

---

## What was changed

All three fixed on 2026-09-01, in the recommended order.

**Finding 1 — `src/lib/share.ts`.** `DECODERS` is a `Map`:

```ts
const DECODERS = new Map<string, (json: string) => unknown>([
  ["1", (json) => JSON.parse(json) as unknown],
]);
```

A Map has no inherited keys to find, so the dispatch table now enforces the
guarantee its comment claims — one entry per version, ever — rather than
promising it.

**Finding 2 — same function.** Two caps instead of one. The WHOLE fragment is
bounded before anything is sliced out of it, and the version segment is bounded
again afterwards by a new `SHARE_LIMITS.versionChars` of 8. A version is a
handful of characters; anything longer is not one, and is refused as a missing
version marker rather than quoted back.

**Finding 3 — `Docs/build-log.md`.** Five Decisions rows and two Open gaps rows.
The decisions were the three the review named, plus one each for the two fixes
above. The gaps are the unbuilt share UI and export/import, and a second one the
review did not raise but which writing the first made obvious: the Phase 5 gate
is *"a link survives a round trip through a messaging app"*, and every test here
round-trips through memory.

### Tests

**`src/lib/share.test.ts` — 27 to 36.** An oversized version marker, asserted by
the LENGTH of the resulting message rather than its content, because the bug was
that the message was 200,082 characters. A version one character over the cap. All
five prototype keys asserted as refused.

And then the two that actually pin the Map, separately: `toString` and `valueOf`
are 8 and 7 characters, inside `versionChars`, so they reach the lookup and
nothing else can refuse them. **The first version of that test asserted all five
expected "newer version" and three of them failed** — `constructor`,
`__proto__` and `hasOwnProperty` are all longer than 8, so the new length cap
caught them first. A correct refusal by the wrong guard: those three would still
be refused if `DECODERS` went back to being an object literal, and the test would
still have passed. Splitting it is what keeps it a test of the Map.

### Verified after the change

- `npm run lint`, `npm run typecheck`, `npx vitest run` (288/288) and
  `npx markdownlint-cli` all pass.
- Re-ran the probe that produced the review's table. `constructor`,
  `__proto__` and `hasOwnProperty` are refused as a missing version marker,
  being longer than `versionChars`; `toString` and `valueOf` reach the lookup
  and are reported as an unknown version, which is what pins the Map.
- The 200,000-character version now yields a message of **39** characters — and
  it is the whole-fragment cap that fires, not the version cap, because that
  input is over both. The version cap is exercised separately by a marker one
  character over the limit.
