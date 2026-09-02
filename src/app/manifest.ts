import type { MetadataRoute } from "next";

/**
 * The web app manifest - what makes BellTab installable.
 *
 * Installability is the whole ask (`Docs/belltab-plan.md`, Phase 6): "leave it
 * open on the projector" and "add it to the phone's home screen" both work
 * better as an installed app with its own window and icon. What is
 * deliberately NOT here is a service worker: Chrome has not required one for
 * installation since it dropped the offline-capability check, offline caching
 * is a stated non-goal ("don't over-invest in offline sync - there's no server
 * anyway", the research doc), and a SW's update lifecycle is a famous way to
 * serve stale HTML after a deploy. The one thing a SW would genuinely buy -
 * notifications on Android, where page-created ones throw - is recorded as an
 * open gap with the SW named as its price.
 *
 * Every URL is written out with the `/bell` prefix. `basePath` scopes where
 * this FILE is served (/bell/manifest.webmanifest) but does not rewrite the
 * strings inside it, and while the spec would resolve relative URLs against
 * the manifest's own location, an explicit prefix is one less spec subtlety to
 * be wrong about - and the E2E fetches every one of these to prove they serve.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/bell",
    name: "BellTab",
    short_name: "BellTab",
    description: "A school bell schedule countdown that lives in your browser tab.",
    start_url: "/bell",
    scope: "/bell",
    display: "standalone",
    // The light palette's paper, for the splash screen and the installed
    // window's chrome. The manifest predates dark mode and takes one colour;
    // the page itself re-themes the moment it paints, so the wrong-theme
    // window dressing lasts one splash. Recorded in Decisions.
    background_color: "#fbf3e3",
    theme_color: "#fbf3e3",
    icons: [
      { src: "/bell/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/bell/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/bell/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/bell/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
