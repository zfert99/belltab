/**
 * Inline SVG rather than glyphs.
 *
 * `⚙`, `×`, `↑` and `↓` render at wildly different weights and baselines
 * across platforms and some fall back to a box, which is why the retired build
 * replaced them with these. `currentColor` means an icon inherits whatever the
 * button already decided, in both themes.
 *
 * Every one is `aria-hidden`: the button around it carries the accessible name,
 * and an icon that also announced would say it twice.
 */

const shared = {
  className: "icon",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function GearIcon() {
  return (
    <svg {...shared}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg {...shared}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export function UpIcon() {
  return (
    <svg {...shared}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export function DownIcon() {
  return (
    <svg {...shared}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...shared}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
