import type { Metadata, Viewport } from "next";

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
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
