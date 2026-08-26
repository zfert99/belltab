# BellTab — Design System

BellTab inherits the Biscuit Lab hub's visual language. This document records
what it takes, what it refuses, and the components that exist only here.

Source of truth for the shared foundation:
`Biscuit-Website/Docs/design/design-system.md`. Tokens are copied, **not** taken
as a package dependency — a shared design-system package is a stated non-goal.

## What BellTab inherits

Color tokens, the three-role type system, the radius/border/shadow tokens, the
pressable button mechanic, the accessibility floor, and the voice.

## What BellTab refuses

Everything the hub already refuses (the corkboard chaos layer, rotation on
everything, the parody ad module, puzzle-surface components), plus:

- **The hub's status stamp.** It is the hub's signature, not a shared component.
- **Ambient motion of any kind.** This is a clock people leave open on a
  projector for six hours. Nothing may loop, pulse, or breathe. The only thing
  that moves is the number, once a second, because it has to.

## 1. Color tokens

### Light mode

| Token | Hex | Usage |
| --- | --- | --- |
| `--paper` | `#FBF3E3` | Page background |
| `--paper-2` | `#F5E7C8` | Card / raised surface |
| `--ink` | `#2B1B12` | Primary text, chunky outlines |
| `--ink-soft` | `#6B5544` | Secondary / muted text |
| `--butterscotch` | `#E8A33D` | Primary accent — the current period |
| `--butterscotch-dark` | `#C97F1E` | Pressed-state shadow for butterscotch |
| `--grape` | `#5A3E96` | Secondary accent — nav, links, secondary buttons |
| `--grape-dark` | `#3E2A69` | Pressed-state shadow for grape |
| `--mint` | `#2FAE86` | Success / valid |
| `--cherry` | `#D8453F` | Danger / validation error |

### Dark mode

| Token | Hex | Usage |
| --- | --- | --- |
| `--paper` | `#1B1224` | Page background |
| `--paper-2` | `#241833` | Card background |
| `--ink` | `#F5E9CE` | Primary text |
| `--ink-soft` | `#C9B8A0` | Secondary text |
| `--butterscotch` | `#F2B65A` | Primary accent |
| `--grape` | `#9B7FD4` | Secondary accent |
| `--mint` | `#4FCBA0` | Success |
| `--cherry` | `#F06B65` | Danger |

**Dark mode ships here even though the hub treats it as optional.** A countdown
left running in a dim classroom at the front of a room is a genuine dark-mode
use case, and the tokens give it to us for free.

**Semantic mapping:** butterscotch marks *now* — the current period and its
progress. Grape marks *navigation and everything else*. Cherry appears only on
validation errors in the editor. Mint is used sparingly, if at all. Never encode
period state by color alone; the label always says what it is.

## 2. Typography

- **Display — Fredoka** (variable, rounded geometric sans). Wordmark, headings,
  and **the countdown number**.
- **Body/UI — Manrope.** Nav, buttons, labels, prose.
- **Mono — Space Mono.** Clock times, period start/end times, meta.

Self-host via `next/font`. No external font requests.

### Scale

| Role | Size | Weight | Line-height | Use |
| --- | --- | --- | --- | --- |
| Countdown | `clamp(4rem, 18vw, 11rem)` | 600 | 1 | The remaining-time number |
| Display L | 2.25rem | 600 | 1.1 | Section headers |
| Display M | 1.5rem | 600 | 1.2 | Current period name |
| Body L | 1.125rem | 500 | 1.5 | "Next up" line, intro copy |
| Body M | 1rem | 400 | 1.6 | Default body |
| Body S | 0.875rem | 500 | 1.4 | Labels, captions |
| Mono S | 0.75rem | 500 | 1 | Times, meta |

The countdown scales with the viewport because the primary display mode is
"across the room." Sentence case everywhere in UI copy.

**Use tabular figures (`font-variant-numeric: tabular-nums`) on every clock
value.** Without it, the countdown visibly jitters as digit widths change once a
second. This is the single most-missed detail in countdown UIs.

## 3. Layout, radius, shadow

- **Radius:** `--r-sm: 8px` (inputs, chips), `--r-md: 14px` (buttons),
  `--r-lg: 20px` (cards).
- **Border:** `3px solid var(--ink)` on interactive elements; `1.5px solid
  var(--ink-soft)` on passive dividers.
- **Shadow — the pressable offset:** `box-shadow: 4px 4px 0 0 var(--ink)` at
  rest; on `:active` the element translates `(4px, 4px)` and the shadow
  collapses to `0`.
- **Spacing:** the 8pt scale (`4/8/12/16/24/32/48px`).
- **The countdown view is a single centered column**, generous, uncluttered, and
  legible at a glance from a distance. The schedule list is secondary and can be
  collapsed.

## 4. Motion

| Moment | Effect | Timing |
| --- | --- | --- |
| Button press | Squash + offset-shadow collapse | 90ms `ease-out`, translate 4px |
| Period change | Single crossfade of the period name | 150ms `ease-out` |
| Progress bar | Width transition only | 300ms `linear` |

No looping animation. No confetti at the bell. All motion respects
`prefers-reduced-motion` — under it, the progress bar and period change become
instant state swaps and nothing transitions.

## 5. Components unique to BellTab

### The countdown display

The reason the app exists. Vertical stack, centered:

1. **Remaining time** — huge, tabular figures, butterscotch.
2. **Current period name** — Display M, ink. User-controlled text, so it must
   wrap and truncate gracefully; absurd labels are expected input.
3. **Period bounds** — Mono S, ink-soft, e.g. `9:05 – 9:48`.
4. **Progress bar** — the period's elapsed fraction.
5. **Next up** — Body L, ink-soft, e.g. `Next: Lunch at 11:42`.

### The progress bar

`(now − start) / (end − start)`, butterscotch fill on a `paper-2` track, chunky
ink border to match the button family. Not a semantic `<progress>` unless it
carries a real accessible name — a decorative fill with the numbers stated in
text beside it is preferable to a mislabelled meter.

### Empty states — first-class screens, not blanks

These are where naive countdown tools look broken, so they get designed:

| State | Message shape |
| --- | --- |
| Before the first bell | `School starts in 1h 12m` + first period name |
| Between periods (a gap) | `Passing — Period 3 in 4m` |
| After the last bell | `School's out — see you tomorrow` |
| No schedule today | Weekend/holiday copy + a link to pick a schedule |
| No schedule at all | The onboarding path into the editor |

### The editor

An ordinary, boring, accessible form. Real `<label>`s, native time inputs,
keyboard-operable reordering, and errors bound to their field with
`aria-describedby` — never a bare red border. Overlap is blocked at input time
with a message that says *which* period it collides with, not just "invalid."

### The tab title

`43m · Period 2` — number first, so it survives truncation. Minute resolution.
Never wrapped in an `aria-live` region.

## 6. Accessibility

Everything in the hub's accessibility section applies. The BellTab-specific
rules:

- **The page body is the accessible source of truth**, because tab-title changes
  are not announced. Any period-change announcement uses a deliberate
  `aria-live="polite"` region that fires **only at boundaries** — never on the
  ticking value.
- **Reflow to 320 CSS px** with no two-dimensional scrolling. The countdown's
  `clamp()` does most of this work; the editor is the part that will break.
- **Contrast:** butterscotch-on-paper is the pair most likely to fail quietly.
  Check every token pair with a contrast tool before committing, ≥4.5:1 for body
  and ≥3:1 for large text and UI components.
- **`overflow-wrap: break-word` globally** — period names are user input.
- **Focus:** a strong `:focus-visible` ring on the ink border, never removed.
