"use client";

import { useState, type RefObject } from "react";
import {
  BELL_OFFSET_LIMIT_SEC,
  parseBellOffset,
  type Preferences,
} from "@/app/_lib/preferences";
import { THEMES, type Theme } from "@/app/_lib/theme";
import { describeWakeLock, type WakeLockStatus } from "@/app/_lib/wakeLock";

/**
 * The settings that belong to the device rather than to the school day.
 *
 * Three controls, and the reason they sit together is that none of them is part
 * of a schedule: a theme is a choice about a screen, a wake lock is a demand on
 * one device's power management, and a bell offset is a measurement of one
 * building's clock. Putting any of them in the library would carry it into every
 * backup and every share link - see the note at the top of `preferences.ts` for
 * why that is the wrong answer.
 *
 * Ordered screen-outwards: what the page looks like, what the device does with
 * it, and only then the one setting that changes the numbers. The offset is last
 * because it is the only one that could be mistaken for editing a schedule, and
 * the distance from the other two is part of saying so.
 *
 * Ordinary native controls, exactly as the editor uses: a radio group the
 * browser gives arrow-key navigation to for free, a checkbox that needs no ARIA
 * at all, and a number input whose spinners work on every engine (unlike
 * `type="time"`, which one WebKit build refuses synthetic keystrokes on entirely
 * - see Docs/build-log.md).
 */

const THEME_LABELS: Record<Theme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export interface PreferencesPanelProps {
  preferences: Preferences;
  save: (next: Preferences) => void;
  /**
   * What the wake lock is actually doing, computed by the one `useWakeLock` in
   * `App.tsx` and passed down rather than read again here.
   *
   * A second call would work - the browser reference-counts locks - and would
   * be wrong anyway: this panel unmounts every time the user goes back to the
   * countdown, so a lock owned by it would be dropped at the exact moment the
   * projector needs it.
   */
  wakeLockStatus: WakeLockStatus;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

export function PreferencesPanel({
  preferences,
  save,
  wakeLockStatus,
  headingRef,
}: PreferencesPanelProps) {
  return (
    <div className="panel" id="panel-preferences">
      <h2 className="panel__title" id="settings-title" tabIndex={-1} ref={headingRef}>
        Preferences
      </h2>
      <p className="panel__note">
        These belong to this browser on this device. They are not part of a schedule, so a share
        link and a backup carry neither of them.
      </p>

      <fieldset className="field">
        <legend className="field__legend">Theme</legend>
        <p className="field__hint" id="theme-hint">
          System follows whatever your device is set to, and changes with it.
        </p>
        <div className="field__options" id="theme-options">
          {THEMES.map((theme) => (
            <label className="option" key={theme}>
              {/*
                A real radio group - one `name`, three inputs - rather than three
                toggle buttons. That is what gives arrow-key navigation, a single
                tab stop for the whole group, and "Theme, Light, radio button 2 of
                3" to a screen reader, none of which would come back for free
                after being rebuilt out of buttons.
              */}
              <input
                type="radio"
                name="theme"
                id={`theme-${theme}`}
                value={theme}
                checked={preferences.theme === theme}
                aria-describedby="theme-hint"
                onChange={() => save({ ...preferences, theme })}
              />
              {THEME_LABELS[theme]}
            </label>
          ))}
        </div>
      </fieldset>

      <WakeLockField preferences={preferences} save={save} status={wakeLockStatus} />

      <BellOffsetField preferences={preferences} save={save} />
    </div>
  );
}

/**
 * "Keep the screen awake", and an honest account of whether it worked.
 *
 * A checkbox, not a switch built out of a button: `type="checkbox"` already
 * reports "checked"/"not checked" to a screen reader, takes Space, and needs no
 * ARIA at all. The one thing added to it is the readout below, because a
 * checkbox that is ticked while the OS quietly refuses the lock is a control
 * that lies - and every reason it can be refused (battery saver, an engine
 * without the API, a permissions policy) is invisible from the tick box.
 */
function WakeLockField({
  preferences,
  save,
  status,
}: {
  preferences: Preferences;
  save: (next: Preferences) => void;
  status: WakeLockStatus;
}) {
  const unsupported = status === "unsupported";

  return (
    <fieldset className="field">
      <legend className="field__legend">Screen</legend>
      <p className="field__hint" id="wake-lock-hint">
        Stops the screen dimming or locking while BellTab is on it, which is what
        a countdown on a projector needs. It only holds while this tab is
        visible, and it uses more battery.
      </p>

      <div className="field__options">
        <label className="option">
          <input
            type="checkbox"
            id="wake-lock"
            checked={preferences.keepScreenAwake && !unsupported}
            /*
              Disabled rather than hidden when the API is missing. A control that
              vanishes on some engines leaves a user who was told about the
              feature hunting for it; one that is visibly unavailable, with the
              readout below saying why, answers the question instead.
            */
            disabled={unsupported}
            aria-describedby="wake-lock-hint wake-lock-status"
            onChange={(event) =>
              save({ ...preferences, keepScreenAwake: event.target.checked })
            }
          />
          Keep the screen awake
        </label>
      </div>

      <p className="offset__readout" id="wake-lock-status">
        {describeWakeLock(status)}
      </p>

      {/*
        A refusal is the only thing here worth interrupting anybody for, and it
        is the reason this region exists at all.

        The readout above is deliberately NOT a live region. Its text flips
        between "held" and "waiting" every time the tab is hidden and shown,
        which is a normal, correct, several-times-an-hour event that nobody
        needs read to them - and AGENTS.md's rule about live regions exists to
        stop exactly that kind of per-tick chatter. What a user does need told is
        that the box they just ticked did not take effect, which is silent
        otherwise.

        Always rendered and hidden rather than mounted with its message, for the
        reason `ScheduleEditor.tsx` and the bell offset both document: a region
        that arrives together with its text is one screen readers routinely
        miss.
      */}
      <p className="visually-hidden" id="wake-lock-alert" aria-live="polite">
        {status === "refused"
          ? "This device refused to keep the screen awake. Battery saver is the usual reason."
          : ""}
      </p>
    </fieldset>
  );
}

/**
 * The offset, as a number of seconds with its own draft state.
 *
 * The draft is why this is a component rather than a block of markup. A
 * controlled input bound straight to the stored number cannot be edited: typing
 * a minus sign, or clearing the box to type a new value, produces a string the
 * parser refuses, and committing the refusal as zero would overwrite what the
 * user was in the middle of typing. So the string on screen is local, and it is
 * committed only when it parses.
 *
 * `null` means "show the stored value" - the state after a commit, after a
 * reset, and after another tab changed the preference. Without it the box would
 * keep showing a stale draft while the countdown ran on a different number.
 */
function BellOffsetField({
  preferences,
  save,
}: {
  preferences: Preferences;
  save: (next: Preferences) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  /**
   * The draft is dropped when the stored offset changes underneath it.
   *
   * Adjusting state during render rather than in an effect - the React docs'
   * own pattern for "reset state when a prop changes", and the one this repo's
   * `react-hooks/set-state-in-effect` rule leaves available. React re-runs this
   * component immediately, before anything is painted, so no stale value is
   * ever drawn.
   *
   * The case that needs it is another TAB: `preferencesStore` syncs on the
   * `storage` event, so changing the offset on a laptop reaches the one left
   * open on a projector - and without this the projector's box would keep
   * showing the number that was typed into it while the readout beside it
   * showed the new one. The JSDoc above used to claim this was handled and it
   * was not; see Bugs found in Docs/build-log.md.
   *
   * A commit from THIS field lands here too, which is harmless: the draft and
   * the stored value agree by then, so dropping it changes nothing on screen
   * except normalising "09" to "9".
   */
  const [lastStored, setLastStored] = useState(preferences.bellOffsetSec);
  if (lastStored !== preferences.bellOffsetSec) {
    setLastStored(preferences.bellOffsetSec);
    setDraft(null);
  }

  const shown = draft ?? String(preferences.bellOffsetSec);

  // An empty box is mid-edit, not an error. Everything else that fails to parse
  // is something the user has to be told about, because the countdown is still
  // running on the last number that worked and nothing on screen would say so.
  const unusable = draft !== null && draft.trim() !== "" && parseBellOffset(Number(draft)) === null;

  // Enabled whenever pressing it would change something: a stored offset to
  // clear, or a draft in the box that is not already zero.
  const resetIsPointless = preferences.bellOffsetSec === 0 && shown === "0";

  const commit = (value: string) => {
    setDraft(value);

    const parsed = parseBellOffset(Number(value));
    // `Number("")` is 0, which would commit a reset the moment the box is
    // cleared. The guard is what keeps clearing it an edit rather than an
    // action.
    if (value.trim() !== "" && parsed !== null) save({ ...preferences, bellOffsetSec: parsed });
  };

  return (
    <fieldset className="field">
      <legend className="field__legend">Bell offset</legend>
      <p className="field__hint" id="bell-offset-hint">
        If the real bell rings before the countdown reaches zero, raise this. Seconds are added to
        this device&rsquo;s clock before the schedule is read, so the schedule itself is left
        alone. Up to {BELL_OFFSET_LIMIT_SEC} either way.
      </p>

      <div className="offset">
        <label className="offset__field">
          <span className="visually-hidden">Bell offset in seconds</span>
          <input
            type="number"
            id="bell-offset"
            /*
              `text`, not `numeric`, and the difference is a minus sign.

              iOS picks the on-screen keyboard from `inputmode` in preference to
              the input's type, and `numeric` is the digits-only keypad - which
              has no minus key. It also draws no spinner buttons for
              `type="number"`, so on an iPhone a `numeric` signed field has no
              way at all to express "the bells run LATE". `text` gives the full
              keyboard, which costs a physical-keyboard user nothing.

              Copied from `PeriodRow.tsx`, where a period's length is unsigned
              and `numeric` is the right answer. Not verified on real iOS
              hardware - carried as an open gap, like every other Safari claim in
              this repo.
            */
            inputMode="text"
            step={1}
            min={-BELL_OFFSET_LIMIT_SEC}
            max={BELL_OFFSET_LIMIT_SEC}
            value={shown}
            aria-invalid={unusable || undefined}
            // BOTH, not one or the other. The hint is the sentence that states
            // the range, which is exactly what somebody who just exceeded it
            // needs to hear - swapping it out for the error removes the answer
            // at the moment the question is asked.
            aria-describedby={
              unusable ? "bell-offset-hint bell-offset-error" : "bell-offset-hint"
            }
            onChange={(event) => commit(event.target.value)}
            // Blur throws the draft away and shows the stored value again, so a
            // number the parser refused cannot sit in the box looking committed
            // while the countdown runs on something else.
            onBlur={() => setDraft(null)}
          />
        </label>
        <span className="offset__unit" aria-hidden="true">
          seconds
        </span>
        <button
          type="button"
          className="minibutton"
          id="bell-offset-reset"
          disabled={resetIsPointless}
          onClick={() => {
            setDraft(null);
            save({ ...preferences, bellOffsetSec: 0 });
          }}
        >
          Reset
        </button>
      </div>

      {/*
        ALWAYS RENDERED, and hidden with `.visually-hidden` rather than by being
        unmounted - the same rule `ScheduleEditor.tsx` documents for its own
        error, and for the same reason: a live region has to be in the
        accessibility tree BEFORE its text changes for the change to be
        announced, so a region that appears along with its message is one screen
        readers routinely miss.

        This one has to speak rather than wait to be read through
        `aria-describedby`, because the failure is silent otherwise: an
        out-of-range value is refused, the countdown carries on running the old
        offset, and nothing about the field's own appearance says so to somebody
        who cannot see the red border.

        Polite and idempotent - React writes the same string on every re-render
        without touching the node, so it is announced once rather than per
        keystroke.
      */}
      <p
        className={unusable ? "editor__error" : "visually-hidden"}
        id="bell-offset-error"
        aria-live="polite"
      >
        {unusable
          ? `A bell offset is a whole number of seconds between \u2212${BELL_OFFSET_LIMIT_SEC} and ` +
            `${BELL_OFFSET_LIMIT_SEC}. The countdown is still running ` +
            `${describeOffset(preferences.bellOffsetSec)}.`
          : ""}
      </p>

      <p className="offset__readout" id="bell-offset-readout">
        The countdown is running {describeOffset(preferences.bellOffsetSec)}.
      </p>
    </fieldset>
  );
}

/**
 * The committed offset in words, because a signed integer is not an answer to
 * "which way does this go".
 */
function describeOffset(offsetSec: number): string {
  if (offsetSec === 0) return "in step with this device’s clock";

  const seconds = Math.abs(offsetSec);
  const unit = seconds === 1 ? "second" : "seconds";

  return `${seconds} ${unit} ${offsetSec > 0 ? "ahead of" : "behind"} this device’s clock`;
}
