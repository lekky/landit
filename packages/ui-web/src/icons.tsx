import type { CSSProperties, ReactElement } from 'react';

/**
 * The icon set, transcribed path-for-path from the `I` map in
 * `design-handoff/design/landit-ui.jsx`. Drawn on a 24px grid, stroke width
 * 2.2, round caps and joins — see the handoff's Assets section.
 *
 * Paths are unchanged. Do not redraw them to "tidy" the geometry: the sticker
 * badges centre these shapes inside a 120px circle, so any change to a path
 * moves an icon on the sticker wall too.
 */
export const ICONS = {
  scoot: (
    <g>
      <circle cx="5.5" cy="18.5" r="2.6" />
      <circle cx="18.5" cy="18.5" r="2.6" />
      <path d="M5.5 18.5 L13 6 H18.5" />
      <path d="M9 6 H15" />
    </g>
  ),
  home: (
    <g>
      <path d="M3 11 L12 3 L21 11" />
      <path d="M5.5 9.5V21h13V9.5" />
    </g>
  ),
  search: (
    <g>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 L21 21" />
    </g>
  ),
  grid: (
    <g>
      <rect x="3" y="3" width="7.5" height="7.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" />
    </g>
  ),
  chart: (
    <g>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M2 20h20" />
    </g>
  ),
  star: <path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z" />,
  user: (
    <g>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21c1.2-4.2 4-6 7.5-6s6.3 1.8 7.5 6" />
    </g>
  ),
  flame: (
    <path d="M12 2.5s5.5 4.6 5.5 10a5.5 5.5 0 1 1-11 0c0-2 1-3.6 2-4.6.3 1.6 1.2 2.4 2 2.4 1.4 0 1.5-2.6 1.5-7.8z" />
  ),
  lock: (
    <g>
      <rect x="4.5" y="10.5" width="15" height="10" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </g>
  ),
  check: <path d="M4 12.5l5.5 5.5L20 6.5" />,
  plus: (
    <g>
      <path d="M12 4v16" />
      <path d="M4 12h16" />
    </g>
  ),
  play: <path d="M7 4.5l12 7.5-12 7.5z" />,
  cam: (
    <g>
      <rect x="2.5" y="6.5" width="14" height="11" />
      <path d="M16.5 11l5-3v8l-5-3z" />
    </g>
  ),
  map: (
    <g>
      <path d="M3 6.5l6-2.5 6 2.5 6-2.5v14l-6 2.5-6-2.5-6 2.5z" />
      <path d="M9 4v14M15 6.5v14" />
    </g>
  ),
  users: (
    <g>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c1-3.6 3.4-5.2 6.5-5.2s5.5 1.6 6.5 5.2" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6" />
      <path d="M18 20c-.4-2-1-3.4-2-4.4" />
    </g>
  ),
  back: (
    <g>
      <path d="M11 5l-7 7 7 7" />
      <path d="M4 12h16" />
    </g>
  ),
  bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6z" />,
  print: (
    <g>
      <path d="M7 9V3h10v6" />
      <rect x="4" y="9" width="16" height="8" />
      <path d="M7 15h10v6H7z" />
    </g>
  ),
  crown: <path d="M3 18l1.5-11 4.5 4 3-6 3 6 4.5-4L21 18z" />,
  coins: (
    <g>
      <ellipse cx="12" cy="6.5" rx="7" ry="2.8" />
      <path d="M5 6.5v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4" />
      <path d="M5 10.5v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4" />
      <path d="M5 14.5v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4" />
    </g>
  ),
  rail: (
    <g>
      <path d="M3.5 14.5h17" />
      <path d="M6.5 14.5V20M17.5 14.5V20" />
      <path d="M8.5 10.5l7-5.5" />
    </g>
  ),
  rotate: (
    <g>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 3.5v4h-4" />
    </g>
  ),
  flag: (
    <g>
      <path d="M6 21V4" />
      <path d="M6 5h13l-2.5 4L19 13H6" />
    </g>
  ),
  board: (
    <g>
      <path d="M2.5 10.5q9.5 3.2 19 0" />
      <path d="M7.5 12.4v1.6M16.5 12.4v1.6" />
      <circle cx="7.5" cy="15.8" r="1.9" />
      <circle cx="16.5" cy="15.8" r="1.9" />
    </g>
  ),
  skull: (
    <g>
      <path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.8 1.4 4.6 3 5.8V20h9v-3.7c1.6-1.2 3-3 3-5.8A7.5 7.5 0 0 0 12 3z" />
      <circle cx="9.2" cy="10.5" r="1.2" />
      <circle cx="14.8" cy="10.5" r="1.2" />
      <path d="M12 13.5v2" />
    </g>
  ),
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof ICONS;

/** Every icon name, in the order they are declared. Handy for the gallery. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export type IconProps = {
  name: IconName;
  /** Width and height in px. The grid is 24, so anything scales cleanly. */
  size?: number;
  /** Stroke width. 2.2 is the design's default. */
  strokeWidth?: number;
  /** Pass a colour to fill the shape instead of stroking it. */
  fill?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

/**
 * `Ico` in the prototype. Stroked in `currentColor` unless a fill is given.
 */
export function Icon({
  name,
  size = 20,
  strokeWidth = 2.2,
  fill = 'none',
  className,
  style,
  title,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill}
      stroke={fill === 'none' ? 'currentColor' : 'none'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {ICONS[name]}
    </svg>
  );
}
