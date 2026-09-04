import type { ValidSchedule } from "./schedule";

/**
 * The bell offset, measured instead of guessed.
 *
 * The offset asks for a number of seconds and, until 2026-09-04, gave no way
 * to discover which number - the workflow was "stand in a corridor, hear the
 * bell, read the phone, subtract". This is the subtraction. The user presses
 * a button AS the bell rings; the nearest scheduled boundary is when the bell
 * was supposed to ring; the difference is the correction, with the sign the
 * offset already uses: seconds ADDED to the device clock so the countdown
 * reaches zero when the real bell sounds.
 *
 * Every period's start and end is a bell, so a gap's edges count too. `null`
 * when nothing is within the offset's own cap - pressing the button at 09:30
 * with the nearest bell at 10:05 is a mistake, not a measurement, and the
 * caller says so rather than storing five minutes of "correction".
 *
 * Pure: the schedule, the device's seconds-of-day and the cap come in, a
 * number comes out. No clock is read here, and the cap is an argument rather
 * than an import so this file stays in the engine's layer - `src/lib/` does
 * not reach into `src/app/`.
 */
export function calibrateOffset(
  schedule: ValidSchedule,
  nowSec: number,
  limitSec: number,
): number | null {
  let best: number | null = null;

  for (const period of schedule.periods) {
    for (const bellSec of [period.startMin * 60, period.endMin * 60]) {
      const candidate = bellSec - nowSec;
      if (best === null || Math.abs(candidate) < Math.abs(best)) best = candidate;
    }
  }

  if (best === null || Math.abs(best) > limitSec) return null;

  // -0 would survive to storage as a distinct value; see parseBellOffset.
  return best === 0 ? 0 : best;
}
