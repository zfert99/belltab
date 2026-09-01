import { parseSchedule, type ParseResult } from "./parse";
import type { Schedule, ValidSchedule } from "./schedule";

/**
 * A schedule to a link, and back.
 *
 * `JSON.stringify` → `CompressionStream('deflate-raw')` → base64url, which lands
 * in `location.hash`. The fragment is never sent to a server, so the request-line
 * limits that govern query strings do not apply here and a full eleven-period
 * schedule fits in a few hundred characters.
 *
 * Everything in this file is pure in the sense that matters: no DOM, no React,
 * no clock. It is not SYNCHRONOUS, because the compression APIs are streams -
 * which is why this lives beside the engine rather than inside it.
 *
 * **A shared link is a format you support forever.** That is the whole reason
 * for the version marker, the dispatch table, and the fixture file beside this
 * one. Adding a version is cheap; discovering you cannot read a link somebody
 * sent last September is not.
 */

/**
 * The current payload version.
 *
 * **Never repurpose a number.** A change to what the bytes mean is a new
 * version, added to `DECODERS` beside the old one, and the old one keeps
 * working. A change that is merely a bug fix in this file is not a new version
 * and must not become one.
 */
export const SHARE_VERSION = "1";

/**
 * Caps applied BEFORE anything is decompressed.
 *
 * A share link arrives from a stranger, and `AGENTS.md` is explicit that
 * decompression is a boundary: a few hundred bytes of hand-crafted deflate can
 * expand to gigabytes and wedge the tab. The decoded size is checked while the
 * stream is being read, not after, so the expansion is stopped rather than
 * measured.
 *
 * Both numbers are far above anything the app can produce. A schedule at every
 * limit `SCHEDULE_LIMITS` allows - 60 periods, 60-character names - is a few
 * kilobytes of JSON and compresses to well under one.
 */
export const SHARE_LIMITS = {
  /** Characters of base64url, excluding the version prefix. */
  encodedChars: 8192,
  /** Bytes of JSON after decompression. */
  decodedBytes: 64 * 1024,
} as const;

const shareError = (message: string): ParseResult<ValidSchedule> => ({
  ok: false,
  errors: [{ index: null, field: "share", message }],
});

/* -------------------------------------------------------------- base64url */

/**
 * Bytes to base64url: the URL-safe alphabet, and no padding.
 *
 * `+` and `/` are not safe in a fragment and `=` is noise a messaging app will
 * happily eat. Chunked through `String.fromCharCode` because spreading a large
 * array into a call blows the argument limit - not a concern at these sizes, and
 * a trap the day somebody raises the caps.
 */
function toBase64Url(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";

  for (let at = 0; at < bytes.length; at += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(at, at + CHUNK));
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** base64url to bytes, or null for anything that is not base64url. */
function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;

  const base64 = text.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);

  try {
    const binary = atob(base64 + padding);
    const bytes = new Uint8Array(binary.length);
    for (let at = 0; at < binary.length; at++) bytes[at] = binary.charCodeAt(at);
    return bytes;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ compression */

async function deflate(text: string): Promise<Uint8Array> {
  const compressed = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

/**
 * Bytes to text, refusing to buffer more than `limit`.
 *
 * Read chunk by chunk rather than through `Response.arrayBuffer()`, because the
 * whole point is to stop a decompression bomb PART WAY. Reading it all and then
 * checking the length is a check that runs after the damage.
 *
 * Returns null for anything that is not valid deflate-raw, which is the same
 * answer as "too big" as far as the caller is concerned: the link does not
 * decode.
 */
async function inflate(bytes: Uint8Array, limit: number): Promise<string | null> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();

  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }

      chunks.push(value);
    }
  } catch {
    return null;
  }

  const joined = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    joined.set(chunk, at);
    at += chunk.byteLength;
  }

  return new TextDecoder().decode(joined);
}

/* ---------------------------------------------------------------- version 1 */

/**
 * What actually goes in the link.
 *
 * The `id` is deliberately NOT shared. An id is an identity within one person's
 * library, and carrying it across would either collide with something the
 * recipient already has or quietly claim a name like "regular" that means
 * something else to them. `parseScheduleCollection` mints a fresh one on import,
 * which is exactly the behaviour that boundary exists for.
 */
interface SharedScheduleV1 {
  name: string;
  periods: readonly { name: string; kind: string; startMin: number; endMin: number }[];
}

const toSharedV1 = (schedule: Schedule): SharedScheduleV1 => ({
  name: schedule.name,
  periods: schedule.periods.map(({ name, kind, startMin, endMin }) => ({
    name,
    kind,
    startMin,
    endMin,
  })),
});

/**
 * The dispatch table. One entry per version, ever.
 *
 * A decoder takes the JSON text that came out of the payload and hands back
 * something `parseSchedule` can judge - it does NOT validate. That keeps every
 * version's job small: describe the shape it was written in, and let the one
 * boundary in the codebase decide whether the result is a schedule.
 */
const DECODERS: Record<string, (json: string) => unknown> = {
  "1": (json) => JSON.parse(json) as unknown,
};

/* -------------------------------------------------------------------- API */

/**
 * A schedule to the string that goes after `#`.
 *
 * The shape is `<version>.<base64url>` - version first, so a decoder knows what
 * it is holding before it has to interpret a single byte of it.
 */
export async function encodeSchedule(schedule: Schedule): Promise<string> {
  const json = JSON.stringify(toSharedV1(schedule));
  return `${SHARE_VERSION}.${toBase64Url(await deflate(json))}`;
}

/**
 * A fragment back to a schedule, or a structured reason it is not one.
 *
 * Every failure is the same to a user - "this link does not work" - but they are
 * not the same to whoever has to debug one, so they are reported separately: a
 * missing version, an unknown version, a bad alphabet, a payload that is not
 * deflate, one that expands past the cap, JSON that does not parse, and a
 * schedule the parser refuses.
 *
 * A leading `#` is accepted and stripped, because that is how the value arrives
 * from `location.hash` and making every caller remember is how one of them
 * forgets.
 */
export async function decodeShare(fragment: string): Promise<ParseResult<ValidSchedule>> {
  const text = fragment.startsWith("#") ? fragment.slice(1) : fragment;

  const separator = text.indexOf(".");
  if (separator < 1) return shareError("This link is missing its version marker.");

  const version = text.slice(0, separator);
  const payload = text.slice(separator + 1);

  const decoder = DECODERS[version];
  if (decoder === undefined) {
    return shareError(
      `This link was made by a newer version of BellTab (format ${version}) than this one can read.`,
    );
  }

  // Length is checked before the alphabet, and both before anything is
  // decompressed: refusing early is the entire job of a cap.
  if (payload.length > SHARE_LIMITS.encodedChars) {
    return shareError("This link is too long to be a schedule.");
  }

  const bytes = fromBase64Url(payload);
  if (bytes === null) return shareError("This link is damaged - it may have been cut short.");

  const json = await inflate(bytes, SHARE_LIMITS.decodedBytes);
  if (json === null) return shareError("This link is damaged - it may have been cut short.");

  let decoded: unknown;
  try {
    decoded = decoder(json);
  } catch {
    return shareError("This link is damaged - it may have been cut short.");
  }

  return parseSchedule(decoded);
}
