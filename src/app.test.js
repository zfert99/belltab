// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, it, expect } from "vitest";

/**
 * The wiring test.
 *
 * engine/parse/format are covered by their own suites without a DOM. This file
 * exists for the thing those cannot catch: whether the eight modules actually
 * boot together against the real index.html. A refactor that leaves a dangling
 * reference or a bad import passes every pure test and dies on load.
 *
 * It asserts shape, never specific numbers - the countdown reads the real
 * clock, so what is on screen depends on when this runs.
 */

// Resolved from the working directory, not import.meta.url: under the jsdom
// environment that URL is the http one Vite serves the module from, not a file.
const html = readFileSync(resolve(process.cwd(), "src/index.html"), "utf8");
const bodyHtml = html.slice(html.indexOf("<body>") + "<body>".length, html.indexOf("</body>"));

beforeAll(async () => {
  document.body.innerHTML = bodyHtml;
  await import("./app.js");
});

const $ = (id) => document.getElementById(id);

describe("boot", () => {
  it("builds a strip cell for every period", () => {
    const cells = $("strip").children;
    expect(cells.length).toBeGreaterThan(0);

    // Every cell is one shape or the other, never unclassified.
    for (const cell of cells) {
      const isBlock = cell.classList.contains("strip__cell--block");
      const isLink = cell.classList.contains("strip__cell--link");
      expect(isBlock !== isLink).toBe(true);
    }
  });

  it("builds a list row for every period, matching the strip", () => {
    expect($("period-list").children.length).toBe($("strip").children.length);
  });

  it("names the schedule in the header", () => {
    expect($("schedule-name").textContent.trim()).not.toBe("");
  });

  it("replaces every placeholder time", () => {
    expect($("wall-clock").textContent).not.toBe("--:--");
    expect($("countdown-minutes").textContent).not.toBe("--");
    expect($("day-start").textContent).not.toBe("--:--");
  });

  it("sets a tab title in one of the known shapes", () => {
    expect(document.title).toMatch(/^(\d+m - .+|Done - BellTab|BellTab)$/);
  });

  it("fills the editor from the selected schedule", () => {
    expect($("schedule-name-input").value).not.toBe("");
    expect($("period-editor").children.length).toBeGreaterThan(0);
  });
});

describe("view switching", () => {
  it("starts on Now", () => {
    expect($("view-now").getAttribute("aria-pressed")).toBe("true");
    expect($("focus-view").hidden).toBe(false);
    expect($("day-view").hidden).toBe(true);
  });

  it("swaps to Day and back", () => {
    $("view-day").click();
    expect($("day-view").hidden).toBe(false);
    expect($("focus-view").hidden).toBe(true);
    expect($("view-day").getAttribute("aria-pressed")).toBe("true");

    $("view-now").click();
    expect($("focus-view").hidden).toBe(false);
    expect($("view-now").getAttribute("aria-pressed")).toBe("true");
  });

  // Big mode is the Now view restyled, so focus-view must STAY visible.
  it("puts big mode on the body without hiding the Now view", () => {
    $("view-big").click();
    expect(document.body.classList.contains("is-big")).toBe(true);
    expect($("focus-view").hidden).toBe(false);
    expect($("big-exit").hidden).toBe(false);

    $("big-exit").click();
    expect(document.body.classList.contains("is-big")).toBe(false);
    expect($("big-exit").hidden).toBe(true);
  });
});

describe("settings", () => {
  // The icon and the accessible name have to move together. A back arrow that
  // still announces "Settings" is the exact mismatch these assertions exist to
  // prevent, so they are checked in the same breath rather than separately.
  it("opens, swaps the header icon and its label together, and closes", () => {
    const toggle = $("settings-toggle");
    const gearHidden = () => $("icon-gear").hasAttribute("hidden");
    const backHidden = () => $("icon-back").hasAttribute("hidden");

    // hasAttribute, not `.hidden`: these are SVGElements, and the hidden IDL
    // property is only defined on HTMLElement. Reading `.hidden` here returns
    // undefined, which is how the swap was broken and this caught it.
    expect(toggle.getAttribute("aria-label")).toBe("Settings");
    expect(gearHidden()).toBe(false);
    expect(backHidden()).toBe(true);

    toggle.click();
    expect($("settings-view").hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("Back");
    expect(gearHidden()).toBe(true);
    expect(backHidden()).toBe(false);

    toggle.click();
    expect($("settings-view").hidden).toBe(true);
    expect(toggle.getAttribute("aria-label")).toBe("Settings");
    expect(gearHidden()).toBe(false);
    expect(backHidden()).toBe(true);
  });

  it("shows one panel at a time", () => {
    $("settings-toggle").click();
    $("tab-calendar").click();

    expect($("panel-calendar").hidden).toBe(false);
    expect($("panel-preferences").hidden).toBe(true);
    expect($("tab-calendar").getAttribute("aria-pressed")).toBe("true");

    $("tab-schedules").click();
    expect($("panel-schedules").hidden).toBe(false);
    expect($("panel-calendar").hidden).toBe(true);
  });

  it("renders the weekday map with all seven days", () => {
    $("tab-calendar").click();
    expect($("weekday-map").children.length).toBe(7);
  });
});

describe("the countdown says what its units are", () => {
  it("labels the number, because 3:38 could be hours or minutes", () => {
    const units = $("countdown-units").textContent;
    expect(["min : sec", "hr : min"]).toContain(units);
  });
});

describe("the screen-reader announcement", () => {
  // The countdown itself must never be a live region - it would be read aloud
  // once a second. This is the only aria-live in the app, and it must be silent
  // on load rather than describing a period nobody just walked into.
  it("exists, is polite, and says nothing on first paint", () => {
    const announcer = $("period-announcer");
    expect(announcer.getAttribute("aria-live")).toBe("polite");
    expect(announcer.textContent).toBe("");
  });

  it("is the only live region on the page", () => {
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(1);
  });

  it("never wraps the countdown or the period name", () => {
    for (const id of ["countdown-minutes", "countdown-seconds", "period-name", "wall-clock"]) {
      expect($(id).closest("[aria-live]")).toBeNull();
    }
  });
});

describe("the editor rejects an overlap without saving it", () => {
  it("reports the collision on the offending row and binds it to the field", async () => {
    // Pinned to a known schedule rather than whatever today resolves to -
    // otherwise this test passes Monday to Friday and fails at the weekend,
    // when the calendar correctly resolves to no school and there are no rows.
    const { selectSchedule } = await import("./ui/editor.js");
    selectSchedule("regular");
    $("tab-schedules").click();

    const rows = $("period-editor").children;
    const secondRow = rows[1];
    const start = secondRow.querySelector('[data-field="start"]');

    // Strictly inside row 1 rather than equal to its start: on an exact tie the
    // parser's endMin tie-break sorts the shorter period first and blames the
    // other row, which is correct but makes for an ambiguous assertion.
    start.value = "08:30";
    start.dispatchEvent(new Event("input", { bubbles: true }));

    const error = secondRow.querySelector('[data-field="error"]');
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain("overlaps");

    // The message is bound to the field, not merely painted red beside it.
    expect(start.getAttribute("aria-invalid")).toBe("true");
    expect(start.getAttribute("aria-describedby")).toBe(error.id);
  });

  it("clears the error once the collision is resolved", () => {
    const secondRow = $("period-editor").children[1];
    const start = secondRow.querySelector('[data-field="start"]');

    start.value = "08:55";
    start.dispatchEvent(new Event("input", { bubbles: true }));

    const error = secondRow.querySelector('[data-field="error"]');
    expect(error.hidden).toBe(true);
    expect(start.hasAttribute("aria-invalid")).toBe(false);
  });
});
