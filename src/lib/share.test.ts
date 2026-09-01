import { describe, expect, it } from "vitest";
import { SCHEDULE_LIMITS } from "./parse";
import { DEFAULT_SCHEDULES, type Schedule } from "./schedule";
import { SHARE_FIXTURES } from "./share.fixtures";
import { SHARE_LIMITS, SHARE_VERSION, decodeShare, encodeSchedule } from "./share";

/**
 * The share pipeline, which is the one part of this app that makes a promise to
 * the future.
 *
 * Two kinds of test here, and the second matters more than the first.
 *
 * **Round-trip** proves the encoder and decoder agree with each other today. It
 * would keep passing if both were rewritten tomorrow in a mutually consistent
 * but incompatible way, which is exactly the failure that matters.
 *
 * **The fixtures** are what actually holds the line: real strings, produced by
 * the encoder that shipped, that must decode to the same schedule forever. They
 * are the reason a link somebody sent last September still opens.
 *
 * `CompressionStream` is a Web API and these are async, but nothing here needs a
 * DOM - Node has had both streams since 18, so the suite runs in the default
 * `node` environment like everything else.
 */

const schedule = (name: string, periods: Schedule["periods"]): Schedule => ({
  id: null,
  name,
  periods,
});

describe("round trip", () => {
  it.each(DEFAULT_SCHEDULES.map((seed) => [seed.name, seed] as const))(
    "%s survives encode and decode",
    async (_name, seed) => {
      const result = await decodeShare(await encodeSchedule(seed));
      if (!result.ok) throw new Error(`a seeded schedule failed to decode: ${result.errors[0].message}`);

      expect(result.value.name).toBe(seed.name);
      expect(result.value.periods).toEqual(seed.periods);
    },
  );

  it("accepts the fragment with its leading hash, as location.hash reports it", async () => {
    const encoded = await encodeSchedule(DEFAULT_SCHEDULES[0]);

    const bare = await decodeShare(encoded);
    const hashed = await decodeShare(`#${encoded}`);

    expect(hashed.ok).toBe(true);
    expect(hashed).toEqual(bare);
  });

  it("drops the id, so a shared schedule cannot claim one in the recipient's library", async () => {
    // An id is an identity within ONE library. Carrying it across would either
    // collide with something the recipient has or quietly claim a name like
    // "regular" that means a different day to them.
    const result = await decodeShare(await encodeSchedule(DEFAULT_SCHEDULES[0]));
    if (!result.ok) throw new Error("expected the seeded schedule to decode");

    expect(DEFAULT_SCHEDULES[0].id).toBe("regular");
    expect(result.value.id).toBeNull();
  });

  it("survives a schedule at every limit the parser allows", async () => {
    const name = "x".repeat(SCHEDULE_LIMITS.nameChars);
    const periods = Array.from({ length: SCHEDULE_LIMITS.periods }, (_, at) => ({
      name: `${at}`.padEnd(SCHEDULE_LIMITS.nameChars, "y"),
      kind: "class" as const,
      startMin: at * 2,
      endMin: at * 2 + 1,
    }));

    const encoded = await encodeSchedule(schedule(name, periods));
    expect(encoded.length).toBeLessThan(SHARE_LIMITS.encodedChars);

    const result = await decodeShare(encoded);
    if (!result.ok) throw new Error("a schedule at the caps should still encode and decode");
    expect(result.value.periods).toHaveLength(SCHEDULE_LIMITS.periods);
  });

  it("keeps a real schedule inside a few hundred characters", async () => {
    // The plan's claim, checked rather than assumed: "a full schedule is a few
    // hundred characters". The eleven-period seeded day is the realistic worst
    // case anyone will actually share.
    const encoded = await encodeSchedule(DEFAULT_SCHEDULES[0]);
    expect(encoded.length).toBeLessThan(600);
  });

  it("puts the version first, before anything that needs interpreting", async () => {
    const encoded = await encodeSchedule(DEFAULT_SCHEDULES[0]);
    expect(encoded.startsWith(`${SHARE_VERSION}.`)).toBe(true);
  });

  it("uses only characters that survive a URL fragment", async () => {
    const encoded = await encodeSchedule(DEFAULT_SCHEDULES[0]);
    // base64url plus the one dot that separates the version. No `+`, `/` or
    // `=`, which a fragment or a messaging app would mangle.
    expect(encoded).toMatch(/^[A-Za-z0-9_.-]+$/);
  });
});

/**
 * The forever test.
 *
 * If one of these fails, the FORMAT broke - not the fixture. Fixing it by
 * re-encoding the payload is the one repair that must never be made, because it
 * converts a real regression into a green run and abandons every link already in
 * the world.
 */
describe("historical payloads", () => {
  it("has at least one fixture for the current version", () => {
    expect(SHARE_FIXTURES.some((fixture) => fixture.version === SHARE_VERSION)).toBe(true);
  });

  it.each(SHARE_FIXTURES.map((fixture) => [fixture.label, fixture] as const))(
    "still decodes: %s",
    async (_label, fixture) => {
      const result = await decodeShare(fixture.encoded);
      if (!result.ok) {
        throw new Error(
          `a historical payload stopped decoding - the format broke, not the fixture: ${result.errors[0].message}`,
        );
      }

      expect(result.value.name).toBe(fixture.expected.name);
      expect(result.value.periods).toEqual(fixture.expected.periods);
    },
  );
});

describe("refusing a link", () => {
  const reason = async (fragment: string) => {
    const result = await decodeShare(fragment);
    if (result.ok) throw new Error(`expected "${fragment.slice(0, 40)}" to be refused`);
    return result.errors[0];
  };

  it.each([
    ["an empty fragment", ""],
    ["no separator at all", "notaschedule"],
    ["a separator with no version in front of it", ".abc"],
  ])("refuses %s for want of a version marker", async (_label, fragment) => {
    expect((await reason(fragment)).message).toContain("version marker");
  });

  it("refuses a version it has never heard of, and says so in those terms", async () => {
    // The message a user gets for a link from a FUTURE BellTab has to be
    // different from the one for a damaged link, because the remedy is
    // different: one is "update", the other is "ask for it again".
    const message = (await reason("99.q1bKS8xNVbJSclTSUSpILcrMTylWsoquBQA")).message;

    expect(message).toContain("newer version");
    expect(message).toContain("99");
  });

  it.each([
    ["characters outside the alphabet", "1.not base64!"],
    ["base64url that is not deflate data", "1.aGVsbG8gd29ybGQ"],
    ["a truncated payload", "1.ldA9C4MwEIDhv1JuzpBUL4lu3VsoXUuHoMGG"],
  ])("refuses %s as damaged", async (_label, fragment) => {
    expect((await reason(fragment)).message).toContain("damaged");
  });

  it("refuses a payload longer than the cap without decompressing it", async () => {
    const oversized = `1.${"a".repeat(SHARE_LIMITS.encodedChars + 1)}`;
    expect((await reason(oversized)).message).toContain("too long");
  });

  /**
   * The version segment is attacker-controlled and gets quoted back to the user,
   * so it needs a bound of its own.
   *
   * Before the review it had none - only the payload was capped, and only after
   * the version had been sliced out. A fragment of 200,000 digits produced a
   * 200,082-character error message. Measured, not theorised.
   */
  it("refuses an oversized version marker rather than quoting it back", async () => {
    const error = await reason(`${"9".repeat(200_000)}.abc`);

    expect(error.message.length).toBeLessThan(120);
    expect(error.message).not.toContain("999999");
  });

  it("caps a version marker that is merely too long, not absurd", async () => {
    const error = await reason(`${"9".repeat(SHARE_LIMITS.versionChars + 1)}.abc`);
    expect(error.message).toContain("version marker");
  });

  /**
   * The prototype chain, which made `constructor` a working version marker.
   *
   * `DECODERS` was an object literal, so `DECODERS["constructor"]` returned the
   * `Object` constructor - a function, so not `undefined`, so CALLED with the
   * payload. `Object(json)` is a String object, which `asRecord` accepts and
   * whose `.name` is undefined, so a link with a nonsense version came back
   * "Give the schedule a name." and pointed the reader at the one part of it
   * that was fine.
   *
   * Every one of these has a perfectly valid v1 payload attached, so nothing
   * about the schedule can be what refuses them.
   */
  it.each([["constructor"], ["toString"], ["__proto__"], ["valueOf"], ["hasOwnProperty"]])(
    "refuses the prototype key %s rather than decoding it",
    async (key) => {
      const payload = (await encodeSchedule(schedule("X", []))).slice(2);
      const result = await decodeShare(`${key}.${payload}`);

      expect(result.ok).toBe(false);
    },
  );

  /**
   * The two prototype keys short enough to reach the lookup are what actually
   * pin the Map.
   *
   * The longer ones above are refused by the version-length cap, which is a
   * correct refusal by the wrong guard - if `DECODERS` went back to being an
   * object literal they would still fail, and the test would still pass. These
   * two are 7 and 8 characters, inside `versionChars`, so the only thing left
   * that can refuse them is the lookup itself.
   */
  it.each([["toString"], ["valueOf"]])(
    "reports the prototype key %s as an unknown version, having reached the lookup",
    async (key) => {
      const payload = (await encodeSchedule(schedule("X", []))).slice(2);

      expect(key.length).toBeLessThanOrEqual(SHARE_LIMITS.versionChars);
      expect((await reason(`${key}.${payload}`)).message).toContain("newer version");
    },
  );

  /**
   * The decompression bomb, which is the reason the decoded cap exists at all.
   *
   * A mebibyte of zeroes deflates to about a kilobyte - deflate's ceiling is
   * roughly 1032:1 - so the payload lands well under the encoded-character cap
   * and the length check cannot touch it. Sixteen times the decoded cap comes
   * back out.
   *
   * The size is chosen for exactly that: twenty megabytes was the first
   * attempt and compressed to 27,183 characters, which the LENGTH cap refuses,
   * so the test passed while proving nothing about the decoded one. The
   * assertion below that the payload is under the encoded cap is what keeps
   * that mistake from coming back.
   *
   * Only reading the decompressed stream WITH a limit catches this, which is
   * why `inflate` reads chunk by chunk rather than calling `arrayBuffer()` and
   * measuring after the damage.
   */
  it("refuses a payload that expands past the decoded cap", async () => {
    const bomb = new Blob([new Uint8Array(1024 * 1024)])
      .stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    const compressed = new Uint8Array(await new Response(bomb).arrayBuffer());

    let binary = "";
    for (const byte of compressed) binary += String.fromCharCode(byte);
    const payload = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

    // Under the length cap, so the only thing that can refuse it is the
    // decoded cap. Without this the test would prove the wrong guard works.
    expect(payload.length).toBeLessThan(SHARE_LIMITS.encodedChars);
    expect(1024 * 1024).toBeGreaterThan(SHARE_LIMITS.decodedBytes);

    expect((await reason(`1.${payload}`)).message).toContain("damaged");
  });

  it("hands a decoded non-schedule to the parser rather than judging it itself", async () => {
    // "Parse, don't validate": this file's job ends at producing something the
    // one boundary can rule on, and the error the user sees comes from there.
    const notASchedule = await encodeSchedule({
      id: null,
      name: "",
      periods: [],
    } as unknown as Schedule);

    const result = await decodeShare(notASchedule);
    if (result.ok) throw new Error("a schedule with no name should not parse");

    expect(result.errors[0]).toEqual({
      index: null,
      field: "name",
      message: "Give the schedule a name.",
    });
  });

  it("refuses overlapping periods that were legal to encode", async () => {
    // Nothing stops a hostile link carrying overlap - the encoder is not a
    // boundary and does not pretend to be. The decoder's parser is.
    const overlapping = await encodeSchedule(
      schedule("Hostile", [
        { name: "A", kind: "class", startMin: 0, endMin: 60 },
        { name: "B", kind: "class", startMin: 30, endMin: 90 },
      ]),
    );

    const result = await decodeShare(overlapping);
    expect(result.ok).toBe(false);
  });
});
