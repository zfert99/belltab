// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";

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

/**
 * Every way an element can be a live region, not just the literal attribute.
 *
 * role="alert" and role="status" have an implicit aria-live and no aria-live
 * attribute, so a selector of "[aria-live]" silently misses them - which is
 * exactly how this suite once asserted "one live region" on a page that had
 * three.
 */
const LIVE_REGION_SELECTOR = '[aria-live], [role="alert"], [role="status"], [role="log"]';

/** Types a value into a field the way the editor listens for it. */
function type(input, value) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Freezes the wall clock at a time TODAY.
 *
 * tick() reads the system clock directly - it has to, that is the whole
 * recompute-never-decrement rule - so deciding what time it is is the only way
 * to assert what the views actually render. Suites that assert a number call
 * this first; the boot and wiring suites deliberately assert shape only,
 * because they run against the real clock and cannot know what it says.
 *
 * Only Date is faked. app.js's setInterval is already running by the time any
 * of this executes, and replacing it would prove nothing about the countdown.
 * The date is kept as today's so tick()'s midnight-rollover check does not
 * fire and re-resolve the schedule out from under the test.
 */
function freezeAt(hours, minutes, seconds = 0) {
  const today = new Date();
  vi.setSystemTime(
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, seconds),
  );
}

/**
 * Puts a known schedule on screen, whatever today's calendar resolves to.
 *
 * Without this the Day view tests pass Monday to Friday and fail at the
 * weekend, when the calendar correctly says there is no school and there are
 * no rows to assert about.
 */
async function showSchedule(schedule) {
  const { store } = await import("./store.js");
  const { rebuildViews, tick } = await import("./ui/views.js");

  store.schedule = schedule;
  rebuildViews();
  tick();
}

const repaint = async () => (await import("./ui/views.js")).tick();

/**
 * The Regular day's bookends: its real first and last periods, and nothing
 * between them. Same day bounds - 8:00 to 14:30 - with two rows to reason
 * about instead of eleven, so an assertion names the row it means.
 */
const BOOKENDS = {
  id: "bookends",
  name: "Bookends",
  periods: [
    { name: "Period 1", kind: "class", startMin: 8 * 60, endMin: 8 * 60 + 55 },
    { name: "Period 6", kind: "class", startMin: 13 * 60 + 35, endMin: 14 * 60 + 30 },
  ],
};

const asideOf = (index) =>
  $("period-list").children[index].querySelector('[data-field="aside"]').textContent;

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

  // The predecessor of this test selected "[aria-live]" and asserted a count of
  // one. role="alert" and role="status" carry an IMPLICIT aria-live and no
  // literal attribute, so the selector missed both error slots: the page had
  // three live regions while a green test said one. Enumerating them by id
  // also makes the test fail when one is ADDED, which counting never did.
  it("has exactly the three live regions it means to have", () => {
    const ids = [...document.querySelectorAll(LIVE_REGION_SELECTOR)]
      .map((element) => element.id)
      .sort();

    expect(ids).toEqual(["override-error", "period-announcer", "schedule-error"]);
  });

  // Assertive interrupts whatever is being read mid-word. That is right for a
  // one-shot answer to pressing a button and wrong for a slot the editor
  // refills on every keystroke.
  it("keeps the per-keystroke slot polite and the one-shot slot assertive", () => {
    expect($("period-announcer").getAttribute("aria-live")).toBe("polite");
    expect($("schedule-error").getAttribute("role")).toBe("status");
    expect($("override-error").getAttribute("role")).toBe("alert");
  });

  it("never wraps the countdown or the period name", () => {
    for (const id of ["countdown-minutes", "countdown-seconds", "period-name", "wall-clock"]) {
      expect($(id).closest(LIVE_REGION_SELECTOR)).toBeNull();
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

describe("the announcer is the bell, not an echo of the editor", () => {
  /**
   * The regression this exists for: `announce()` deliberately sits outside
   * tick()'s paused branch so the bell still rings while settings is open -
   * but the editor calls tick() after every keystroke, and the guard compared
   * the RENDERED NAME. Typing "Chem" announced "C has started.", "Ch has
   * started.", "Che has started.", "Chem has started."
   */
  let restoreCalendar = () => {};

  beforeAll(async () => {
    const { store, isoDateOf } = await import("./store.js");
    const { selectSchedule } = await import("./ui/editor.js");

    // 8:30 is inside Period 1 of the Regular day, so there is a running period
    // for an edit to be mistaken for a bell. Against the real clock these
    // tests are vacuous after 14:30, which is most of the day.
    vi.useFakeTimers({ toFake: ["Date"] });
    freezeAt(8, 30);

    // Pinning store.schedule directly would not survive the first keystroke:
    // every edit runs refreshResolved, which re-resolves from the calendar.
    // Today has to genuinely BE a Regular day for the duration - and be handed
    // back afterwards, because the store outlives this describe.
    const today = new Date();
    const weekday = today.getDay();
    const previousWeekday = store.calendar.weekdays[weekday];
    const previousOverrides = store.calendar.overrides;

    store.calendar.weekdays[weekday] = "regular";
    store.calendar.overrides = previousOverrides.filter(
      (entry) => entry.date !== isoDateOf(today),
    );

    restoreCalendar = () => {
      store.calendar.weekdays[weekday] = previousWeekday;
      store.calendar.overrides = previousOverrides;
    };

    selectSchedule("regular");
    $("tab-schedules").click();
  });

  afterAll(async () => {
    restoreCalendar();
    vi.useRealTimers();
    (await import("./ui/views.js")).refreshResolved();
  });

  const announcer = () => $("period-announcer").textContent;

  it("says nothing while a period name is typed one character at a time", () => {
    $("period-announcer").textContent = "";
    const name = $("period-editor").children[0].querySelector('[data-field="name"]');
    const original = name.value;

    for (const value of ["C", "Ch", "Che", "Chem"]) type(name, value);
    expect(announcer()).toBe("");

    type(name, original);
    expect(announcer()).toBe("");
  });

  // Moving a period DOES change its identity on the clock - dragging Period 1
  // back to 7:15 leaves 8:30 in the gap before Passing - so keying off
  // start/end is not on its own enough. An edit still has to be silent.
  it("says nothing when an edit moves the running period out from under us", () => {
    $("period-announcer").textContent = "";
    const start = $("period-editor").children[0].querySelector('[data-field="start"]');
    const original = start.value;

    type(start, "07:15");
    expect(announcer()).toBe("");

    type(start, original);
    expect(announcer()).toBe("");
  });

  // Remapping the whole week is the most violent edit there is - every weekday
  // pointed at "No school" changes the resolved schedule out from under the
  // clock - and it is still an edit, not a bell.
  it("says nothing when the calendar is repointed", () => {
    $("period-announcer").textContent = "";
    $("tab-calendar").click();

    const selects = [...$("weekday-map").querySelectorAll("select")];
    const originals = selects.map((select) => select.value);

    for (const select of selects) {
      select.value = "";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    expect(announcer()).toBe("");

    selects.forEach((select, index) => {
      select.value = originals[index];
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(announcer()).toBe("");

    $("tab-schedules").click();
  });
});

describe("the schedule error slot is written once per message", () => {
  /**
   * It is a live region and validateDraft runs per keystroke, so blanking it
   * and refilling it with the same sentence per character would announce that
   * sentence per character. Counting DOM mutations is the only way to see the
   * difference - the rendered text is identical either way.
   */
  it("does not re-announce a message that is still true", async () => {
    const { selectSchedule } = await import("./ui/editor.js");
    selectSchedule("regular");
    $("tab-schedules").click();

    const input = $("schedule-name-input");
    const original = input.value;
    const slot = $("schedule-error");

    const observer = new MutationObserver(() => {});
    observer.observe(slot, { childList: true, characterData: true, subtree: true });

    // Three keystrokes, one message: "Keep the name under 60 characters."
    type(input, "a".repeat(61));
    type(input, "a".repeat(62));
    type(input, "a".repeat(63));

    expect(slot.textContent).toContain("60 characters");
    expect(observer.takeRecords()).toHaveLength(1);

    observer.disconnect();
    type(input, original);
    expect(slot.hidden).toBe(true);
  });

  // AGENTS.md: an error is a message bound to its field, not a red border.
  // The schedule-level slot was setting aria-invalid without ever pointing at
  // the text that explains it.
  it("binds the schedule-level message to the name field", () => {
    const input = $("schedule-name-input");
    const original = input.value;

    type(input, "");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("schedule-error");
    expect($("schedule-error").textContent).not.toBe("");

    type(input, original);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("Escape belongs to the topmost thing on screen", () => {
  const escape = () =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  it("closes settings when nothing is on top of it", () => {
    if ($("settings-view").hidden) $("settings-toggle").click();
    expect($("settings-view").hidden).toBe(false);

    escape();
    expect($("settings-view").hidden).toBe(true);
  });

  /**
   * The regression: a modal <dialog> is an ordinary element in an ordinary
   * document, so its Escape keydown bubbles to the app's handler, and the
   * dialog's own close is only the DEFAULT ACTION of that same event - the
   * page's listener runs first. window.confirm never did this, because a
   * browser-level modal dispatches no key events to the page at all. One
   * Escape used to hide settings and leave a live Delete modal over the
   * countdown.
   */
  it("leaves settings alone while a dialog is open", () => {
    $("settings-toggle").click();
    expect($("settings-view").hidden).toBe(false);

    $("confirm-dialog").setAttribute("open", "");
    escape();
    expect($("settings-view").hidden).toBe(false);

    $("confirm-dialog").removeAttribute("open");
    escape();
    expect($("settings-view").hidden).toBe(true);
  });
});

describe("the Day view says what its numbers mean", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    if (!$("settings-view").hidden) $("settings-toggle").click();
    $("view-day").click();
  });

  afterAll(async () => {
    vi.useRealTimers();
    $("view-now").click();
    (await import("./ui/views.js")).refreshResolved();
  });

  /**
   * "6:25 until dismissal" is six hours or six minutes, and this is the
   * largest number on the screen. splitCountdown started returning `unit`
   * precisely so a reader could tell the two apart; the Now view used it and
   * paintDay dropped it on the floor.
   */
  it("labels the day countdown, and the label follows the scale", async () => {
    freezeAt(8, 5);
    await showSchedule(BOOKENDS);

    expect($("day-remaining").textContent).toBe("6:25");
    expect($("day-remaining-units").hidden).toBe(false);
    expect($("day-remaining-units").textContent).toBe("hr : min");

    freezeAt(13, 45);
    await repaint();

    expect($("day-remaining").textContent).toBe("45:00");
    expect($("day-remaining-units").textContent).toBe("min : sec");
  });

  it("drops the label once there is nothing left to count", async () => {
    freezeAt(15, 0);
    await repaint();

    expect($("day-remaining").textContent).toBe("--:--");
    expect($("day-remaining-units").hidden).toBe(true);
    expect($("day-remaining-units").textContent).toBe("");
  });

  /**
   * The running row's countdown sits directly beneath siblings formatDuration
   * renders as "55m", so "50:00" there reads as fifty seconds past the minute
   * rather than fifty minutes. Spelling the units into the string is the only
   * form that survives the neighbourhood it is rendered in.
   */
  it("spells the running period's countdown rather than punctuating it", async () => {
    freezeAt(13, 40);
    await repaint();

    expect($("period-list").children[1].classList.contains("period--current")).toBe(true);
    expect(asideOf(1)).toBe("50m 00s");
    expect(asideOf(0)).toBe("done");
  });

  it("spells hours too, so a long block never reads as minutes", async () => {
    freezeAt(9, 10);
    await showSchedule({
      id: "block",
      name: "Block",
      periods: [{ name: "Block A", kind: "class", startMin: 9 * 60, endMin: 10 * 60 + 30 }],
    });

    expect(asideOf(0)).toBe("1h 20m");
  });

  it("never renders a bare colon countdown in any row", async () => {
    freezeAt(13, 40);
    await showSchedule(BOOKENDS);

    for (const row of $("period-list").children) {
      expect(row.querySelector('[data-field="aside"]').textContent).not.toMatch(/^\d+:\d{2}$/);
    }
  });
});

describe("the bell rings when the clock crosses a boundary", () => {
  const announcer = () => $("period-announcer").textContent;

  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterAll(async () => {
    vi.useRealTimers();
    (await import("./ui/views.js")).refreshResolved();
  });

  /**
   * The counterpart to the editor tests above: those prove the announcer stays
   * quiet, and this proves silence is not the only thing it knows how to do.
   *
   * The two periods share a name deliberately. The guard used to compare the
   * rendered NAME, so a school with "Study Hall" twice in a row got no
   * announcement at the one moment the region exists for - and nothing in the
   * suite could see it, because both spellings of the bug render identically.
   */
  it("announces a crossing between two periods that share a name", async () => {
    freezeAt(9, 30);
    await showSchedule({
      id: "twins",
      name: "Twins",
      periods: [
        { name: "Study Hall", kind: "class", startMin: 9 * 60, endMin: 10 * 60 },
        { name: "Study Hall", kind: "class", startMin: 10 * 60, endMin: 11 * 60 },
      ],
    });

    $("period-announcer").textContent = "";
    freezeAt(10, 0);
    await repaint();

    expect(announcer()).toBe("Study Hall has started.");
  });

  it("announces the end of the day, and then stops", async () => {
    $("period-announcer").textContent = "";
    freezeAt(11, 0);
    await repaint();
    expect(announcer()).toBe("School is out.");

    $("period-announcer").textContent = "";
    freezeAt(11, 30);
    await repaint();
    expect(announcer()).toBe("");
  });
});

/**
 * jsdom implements <dialog>'s `open` attribute but neither showModal nor
 * close, so the app takes its unsupported-browser path here. These stubs are a
 * mock at a boundary - the platform - and are what let the supported path be
 * tested at all.
 */
function stubDialogSupport(dialog) {
  dialog.showModal = () => dialog.setAttribute("open", "");
  dialog.close = (value) => {
    if (value !== undefined) dialog.returnValue = value;
    dialog.removeAttribute("open");
    dialog.dispatchEvent(new Event("close"));
  };
}

describe("deleting a schedule asks first", () => {
  const originalConfirm = window.confirm;
  const chipCount = () => $("schedule-list").children.length;

  beforeAll(async () => {
    const { newSchedule } = await import("./ui/editor.js");
    $("settings-toggle").click();
    $("tab-schedules").click();
    newSchedule();
  });

  afterAll(() => {
    window.confirm = originalConfirm;
  });

  /**
   * The regression: where showModal is missing the code called onConfirm()
   * outright, so the destructive action simply happened. jsdom is one such
   * environment, which meant every test run took the silent branch - the whole
   * delete flow was untestable, which is why it had no test.
   */
  it("falls back to window.confirm where <dialog> is unsupported, and obeys a No", () => {
    expect(typeof $("confirm-dialog").showModal).not.toBe("function");

    let asked = false;
    window.confirm = () => {
      asked = true;
      return false;
    };

    const before = chipCount();
    $("schedule-delete").click();

    expect(asked).toBe(true);
    expect(chipCount()).toBe(before);
  });

  it("deletes on a Yes", () => {
    window.confirm = () => true;

    const before = chipCount();
    $("schedule-delete").click();
    expect(chipCount()).toBe(before - 1);
  });

  describe("where <dialog> is supported", () => {
    const dialog = () => $("confirm-dialog");

    beforeAll(async () => {
      const { newSchedule } = await import("./ui/editor.js");
      newSchedule();
      stubDialogSupport(dialog());
    });

    afterAll(() => {
      delete dialog().showModal;
      delete dialog().close;
      dialog().removeAttribute("open");
    });

    it("opens the modal with Cancel focused rather than Delete", () => {
      $("schedule-delete").click();

      expect(dialog().open).toBe(true);
      expect(document.activeElement).toBe(dialog().querySelector('button[value="cancel"]'));
      expect($("confirm-body").textContent).toContain("cannot be undone");
    });

    it("does nothing when the dialog closes as anything but a confirmation", () => {
      const before = chipCount();
      dialog().close("cancel");

      expect(dialog().open).toBe(false);
      expect(chipCount()).toBe(before);
    });

    // Leaving settings by ANY route has to take the modal with it. The dialog
    // is a sibling of the settings view, not a child, so hiding settings left
    // it floating over the countdown with its Delete button still wired.
    it("does not strand an open modal when settings closes underneath it", () => {
      const before = chipCount();
      $("schedule-delete").click();
      expect(dialog().open).toBe(true);

      $("settings-toggle").click();

      expect($("settings-view").hidden).toBe(true);
      expect(dialog().open).toBe(false);
      expect(chipCount()).toBe(before);
    });

    it("deletes when the dialog closes as a confirmation", () => {
      $("settings-toggle").click();
      $("tab-schedules").click();

      const before = chipCount();
      $("schedule-delete").click();
      dialog().close("confirm");

      expect(chipCount()).toBe(before - 1);
    });
  });
});
