/**
 * The settings panels, as data, in one place both the app and the suite read.
 *
 * It lived in `SettingsView.tsx` and was correct there. It moved here because
 * the E2E suite needs the same list and could not have it: `reflow.spec.ts` and
 * `a11y.spec.ts` each carried their own hand-written
 * `["schedules", "calendar", "preferences"]`, which had drifted from the four
 * panels the app actually renders. Backup was the panel neither loop opened,
 * and Backup was the panel that failed the 320px reflow gate - a WCAG 2.2
 * SC 1.4.10 failure that shipped because the check enumerated three of four.
 * See Bugs found, 2026-09-05.
 *
 * So the fix is not "add Backup to two arrays" - that is the same mistake with
 * a longer list. The list is exported once, both specs loop over THIS, and a
 * fifth panel is covered by the reflow and axe gates the moment it is added
 * here, without anyone remembering to go and say so twice.
 *
 * No React and no DOM, deliberately: a spec runs in Node, and a module that
 * pulled in `SettingsView` would drag four panel components and their `"use
 * client"` boundary along with it.
 */

export type PanelId = "schedules" | "calendar" | "backup" | "preferences";

/**
 * Ordered by how much of the app each one changes: the schedules, then the days
 * pointing at them, then the whole library at once, then the two settings that
 * change nothing about the school day at all.
 */
export const PANELS: readonly { id: PanelId; label: string }[] = [
  { id: "schedules", label: "Schedules" },
  { id: "calendar", label: "Calendar" },
  { id: "backup", label: "Backup" },
  { id: "preferences", label: "Preferences" },
];

/** Just the ids, for the suites that open every panel in turn. */
export const PANEL_IDS: readonly PanelId[] = PANELS.map((panel) => panel.id);
