import type { Metadata, Viewport } from "next";
import { Fredoka, Manrope, Space_Mono } from "next/font/google";
import "./globals.css";

/**
 * The three faces the design system names, self-hosted.
 *
 * `next/font/google` downloads the files at BUILD time and serves them from
 * our own origin, so this does not violate "no network at runtime" - the
 * browser never talks to Google. Until now the three families were named in
 * globals.css and loaded by nothing, so every page rendered the system
 * fallback.
 *
 * `variable` rather than `className`: globals.css already routes every rule
 * through `--font-display` / `--font-body` / `--font-mono`, and those keep
 * their fallback stacks after the generated family. A className on <html>
 * would set one family for the whole tree and leave the tokens pointing at
 * fonts that still do not exist.
 *
 * Fredoka and Manrope are variable fonts, so no `weight` is given and the whole
 * axis is available - which the scale needs, since it uses 400/500/600/700.
 * Space Mono is NOT variable and its weights have to be enumerated; it ships
 * 400 and 700 only, so the design system's 500 for Mono S will render as 400
 * rather than a synthesised weight.
 *
 * `display: "swap"` shows fallback text immediately rather than blocking on the
 * font. The metric-compatible fallback next/font generates keeps the swap from
 * shifting layout, which is the whole reason AGENTS.md asks for next/font.
 */
const fredoka = Fredoka({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fredoka",
});

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  description: "A school bell schedule countdown that lives in your browser tab.",
};

/**
 * The viewport, and the two things deliberately absent from it.
 *
 * `maximumScale` and `userScalable: false` are banned by AGENTS.md: both defeat
 * pinch-zoom, which WCAG 2.2 SC 1.4.4 requires and which the reflow gate at 320
 * CSS px exists to protect. They are the default output of most scaffolds, so
 * their absence here is a decision rather than an oversight.
 *
 * `colorScheme` carries over the `<meta name="color-scheme">` the retired plain
 * build shipped. It is what makes the browser's own chrome - form controls,
 * scrollbars, the canvas behind the page - follow the dark tokens in
 * globals.css rather than staying stubbornly white behind a dark page.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${manrope.variable} ${spaceMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
