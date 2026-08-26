import type { NextConfig } from "next";

/**
 * The baseline security headers, moved here from `vercel.json`.
 *
 * They lived in `vercel.json` only because there was no framework to hang them
 * on; AGENTS.md names `next.config.ts` `headers()` as their home. The list is
 * unchanged - see Docs/build-log.md for why each one reads the way it does.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },

  // Deliberately partial: a policy carrying only `frame-ancestors` places no
  // restriction on scripts. A real `script-src` is owed once there is an inline
  // script to hash - see Open gaps.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },

  { key: "Referrer-Policy", value: "no-referrer" },

  // `screen-wake-lock` and `autoplay` are allowed on purpose: Phase 6 needs
  // both, and a blanket deny fails at the call site with the cause nowhere near
  // the code.
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), autoplay=(self), screen-wake-lock=(self)",
  },
];

const nextConfig: NextConfig = {
  /**
   * BellTab is served at `biscuitlab.net/bell` via a rewrite from the hub, so
   * every route and every `/_next/*` asset has to carry the prefix.
   *
   * This is inlined into the client bundle at build time, which has two
   * consequences worth stating: changing it requires a redeploy, and local dev
   * lives at `localhost:3000/bell` rather than `localhost:3000`. No
   * `assetPrefix` is needed - the Next docs explicitly recommend against it for
   * sub-path hosting, because `basePath` already scopes the asset URLs.
   */
  basePath: "/bell",

  // Next advertises itself in a response header by default. It is not a
  // vulnerability, but naming your framework and letting an attacker skip
  // straight to its known CVEs is free information they should have to work for.
  poweredByHeader: false,

  /**
   * TWO sources, and the bare one is not redundant.
   *
   * `source` is matched with `basePath` already applied, so `/(.*)` becomes
   * `/bell/(.*)` - which requires the slash and everything after it, and
   * therefore never matches a request for `/bell` itself. Measured, not
   * assumed: with only the wildcard entry, `curl -I /bell` came back with none
   * of these headers while `/bell/_next/static/...` had all five. The page - the
   * only thing an attacker frames or sniffs - was the one response left bare.
   *
   * AGENTS.md documents this exact trap for the hub's rewrites ("the bare path
   * does not always match `:path*`"). It applies to `headers()` for the same
   * reason.
   */
  async headers() {
    return [
      { source: "/", headers: securityHeaders },
      { source: "/(.*)", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
