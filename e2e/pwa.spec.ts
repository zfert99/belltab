import { test, expect, type Page } from "@playwright/test";
import { openApp } from "./helpers";
import { BASE_PATH } from "../playwright.config";

/**
 * The manifest, as a contract rather than a file.
 *
 * A manifest fails silently in every direction: a 404'd icon, a start_url
 * outside the scope, a path that forgot the `/bell` prefix - none of them
 * breaks the page, all of them break installation, and nobody installs the app
 * in CI to notice. So this suite fetches what a browser's install machinery
 * would fetch and asserts each piece serves and agrees with the others.
 *
 * What no test here claims: that an install prompt actually appears, or what
 * the installed window looks like. Those are browser UI, unreachable from a
 * page context, and carried honestly in Open gaps until a human installs it.
 */

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface Manifest {
  id: string;
  name: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: ManifestIcon[];
}

async function fetchManifest(page: Page): Promise<Manifest> {
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href, "no <link rel=manifest> in the head").not.toBeNull();

  const response = await page.request.get(String(href));
  expect(response.status()).toBe(200);

  return (await response.json()) as Manifest;
}

test.describe("the web app manifest", () => {
  test("is linked, and everything in it is inside /bell", async ({ page }) => {
    await openApp(page);

    const manifest = await fetchManifest(page);

    expect(manifest.name).toBe("BellTab");

    // The prefix discipline: basePath scopes where the manifest FILE lives but
    // rewrites nothing inside it, so every URL below is spelled out by hand in
    // manifest.ts - and one forgotten prefix would 404 only at install time.
    expect(manifest.id).toBe(BASE_PATH);
    expect(manifest.start_url).toBe(BASE_PATH);
    expect(manifest.scope).toBe(BASE_PATH);
    for (const icon of manifest.icons) {
      expect(icon.src, `icon outside the base path: ${icon.src}`).toMatch(
        new RegExp(`^${BASE_PATH}/`),
      );
    }

    expect(manifest.display).toBe("standalone");
  });

  test("serves every icon it names, at the type it claims", async ({ page }) => {
    await openApp(page);

    const manifest = await fetchManifest(page);

    // Both purposes, both sizes: the plain pair for splash screens and install
    // dialogs, the maskable pair for launchers that crop their own shape.
    expect(manifest.icons).toHaveLength(4);
    expect(manifest.icons.filter((icon) => icon.purpose === "maskable")).toHaveLength(2);
    expect(new Set(manifest.icons.map((icon) => icon.sizes))).toEqual(
      new Set(["192x192", "512x512"]),
    );

    for (const icon of manifest.icons) {
      const response = await page.request.get(icon.src);
      expect(response.status(), `${icon.src} does not serve`).toBe(200);
      expect(response.headers()["content-type"], icon.src).toContain(icon.type);
    }
  });

  test("matches the palette the page actually paints", async ({ page }) => {
    await openApp(page);

    const manifest = await fetchManifest(page);

    // The splash screen and the installed window's chrome are painted from
    // these two fields before any CSS loads. Asserting them against the live
    // `--paper` token means a palette change cannot leave the splash behind.
    const paper = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--paper").trim(),
    );

    expect(manifest.background_color).toBe(paper);
    expect(manifest.theme_color).toBe(paper);
  });

  test("names its one public address, and its sitemap agrees", async ({ page }) => {
    await openApp(page);

    // The canonical is what tells a crawler that the origin host the hub's
    // proxy reaches is not a second site. It is an absolute production URL by
    // design, so this asserts content rather than reachability.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://biscuitlab.net/bell",
    );

    // And the sitemap - which exists for the hub's index to point at - names
    // the same address, served from inside the base path.
    const response = await page.request.get(`${BASE_PATH}/sitemap.xml`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("<loc>https://biscuitlab.net/bell</loc>");
  });

  test("serves the notification worker at /bell/sw.js, as script, with no fetch handler", async ({
    page,
  }) => {
    await openApp(page);

    // The worker's whole contract is in the file: registered under /bell/,
    // served as JavaScript, and - the promise the 2026-09-02 decision rests on
    // - no fetch handler, so it can never serve stale HTML after a deploy.
    const response = await page.request.get(`${BASE_PATH}/sw.js`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("javascript");

    const source = await response.text();
    expect(source).toContain("notificationclick");
    expect(source).not.toMatch(/addEventListener\(\s*["']fetch["']/);
  });

  test("ships a favicon and an apple-touch-icon that serve", async ({ page }) => {
    await openApp(page);

    for (const [selector, type] of [
      ['link[rel="icon"]', "image/svg+xml"],
      ['link[rel="apple-touch-icon"]', "image/png"],
    ] as const) {
      const href = await page.locator(selector).getAttribute("href");
      expect(href, `${selector} missing`).not.toBeNull();

      const response = await page.request.get(String(href));
      expect(response.status(), `${selector} -> ${href}`).toBe(200);
      expect(response.headers()["content-type"]).toContain(type);
    }
  });
});
