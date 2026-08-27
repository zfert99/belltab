import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BellTab",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
