import type { MetadataRoute } from "next";

/**
 * One page, one URL. This exists so the HUB's sitemap index has something to
 * point at - `Biscuit-Website` serves a `<sitemapindex>` naming each zone's
 * sitemap, and a zone without one is invisible to it. Served at
 * `/bell/sitemap.xml`; like every URL in `manifest.ts`, the `/bell` is written
 * out because `basePath` does not rewrite metadata-route CONTENT, only where
 * the file is served.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://biscuitlab.net/bell", lastModified: new Date() }];
}
