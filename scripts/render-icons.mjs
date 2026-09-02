/**
 * Rasterises src/app/icon.svg into the PNG set the manifest needs.
 *
 * Run from the repo root: `node scripts/render-icons.mjs`
 *
 * Playwright does the rendering because it is already in devDependencies -
 * adding an image library to rasterise one glyph five times would fail the
 * "treat any proposed addition as suspect" rule for no gain. The PNGs are
 * committed, not built: they change only when the glyph does, and a build step
 * that needs a browser binary would slow every CI run for a file that changes
 * roughly never.
 */
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const svg = await readFile("src/app/icon.svg", "utf8");

// [output path, canvas size, glyph fraction of the canvas]
//
// Maskable icons keep the glyph inside the central safe zone - the platform
// crops an arbitrary shape out of the full-bleed square, and everything
// outside the inscribed 80% circle must be expendable background - so the bell
// sits at 56% there and at 72% where nothing will be cropped.
const OUTPUTS = [
  ["public/icon-192.png", 192, 0.72],
  ["public/icon-512.png", 512, 0.72],
  ["public/icon-maskable-192.png", 192, 0.56],
  ["public/icon-maskable-512.png", 512, 0.56],
  // Apple ignores the manifest and reads apple-touch-icon; 180px is the
  // largest size current devices ask for, and Next's app/apple-icon.png
  // convention emits the <link> for it.
  ["src/app/apple-icon.png", 180, 0.72],
];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const [out, size, fraction] of OUTPUTS) {
  const glyph = Math.round(size * fraction);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html>
    <style>
      html, body { margin: 0; width: ${size}px; height: ${size}px; }
      body { background: #fbf3e3; display: grid; place-items: center; }
      svg { width: ${glyph}px; height: ${glyph}px; }
    </style>
    <body>${svg}</body>`);
  await page.screenshot({ path: out });
  console.log(`${out} (${size}px, glyph ${glyph}px)`);
}

await browser.close();
