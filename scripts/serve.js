import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

/**
 * The dev server: static files out of `src/`, and nothing else.
 *
 * A server is REQUIRED even though this app has no backend - `src/app.js` is an
 * ES module, and browsers refuse to load modules over `file://` because there
 * is no content type without HTTP. This exists so that requirement costs the
 * repo no dependency: BellTab is meant to reach 1.0 with approximately zero of
 * them, and a forty-line file beats a package for something this small.
 *
 * It is a development tool. The deployed app is static files behind Vercel.
 */

const ROOT = resolve(process.cwd(), "src");

const PORT = Number(process.argv[2] ?? process.env.PORT ?? 3000);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/**
 * Resolves a request path to a file inside ROOT, or null.
 *
 * Normalising and then re-checking the prefix is what stops `../../` from
 * walking out of `src/`. Only ever run on a developer's own machine, but a
 * traversal bug in a file server is the kind of thing that gets copied
 * somewhere it matters.
 */
function resolveWithinRoot(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  // Leading separators are stripped without a regex on purpose: normalize()
  // returns platform separators, and a character class holding both is one
  // escaping mistake away from a regex that silently matches nothing.
  let relative = normalize(decoded);
  while (relative.startsWith("/") || relative.startsWith(sep)) relative = relative.slice(1);
  const target = resolve(join(ROOT, relative));

  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;
  return target;
}

const server = createServer(async (request, response) => {
  const target = resolveWithinRoot(request.url ?? "/");

  if (target === null) {
    response.writeHead(403, { "Content-Type": "text/plain" }).end("Forbidden");
    return;
  }

  let file = target;

  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
    return;
  }

  try {
    await stat(file);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
    // The countdown is the whole app; a cached stylesheet during a CSS edit is
    // a bug report waiting to happen.
    "Cache-Control": "no-store",
  });

  createReadStream(file).pipe(response);
});

server.listen(PORT, () => {
  console.log(`BellTab on http://localhost:${PORT}`);
});
