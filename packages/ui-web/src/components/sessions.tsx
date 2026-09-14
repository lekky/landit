'use client';

import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';

import { foregroundFor } from '../contrast';
import { cx } from '../cx';
import { FEEL_ART, SessionArt, WEATHER_ART } from '../session-art';

/**
 * The small primitives every session screen uses (T36), so T37–T40 consume one
 * set instead of each deriving its own: the hard-shadow card, the metadata
 * chip, the two-part trick pill, the feel faces and swatch, the weather icons,
 * the segmented picker, the stage pill, the visibility label, and the platform
 * badge with its clip poster.
 *
 * Values are the session-tracking handoff's
 * (`landit-research/session-tracking-2026-09-13/README.md`, "Design tokens"):
 * radius 0, hard offset shadows, the repo's hover lift. Classes live in
 * `../styles/sessions.css`.
 *
 * **The feel faces and the weather icons were original to that design**, and
 * the handoff says to keep its paths or commission replacements — never to swap
 * in unrelated glyphs. They are still transcribed verbatim below, path for
 * path, but `FeelFace` and `WeatherIcon` now draw **commissioned sticker art**
 * instead (owner, 2026-09-14, in chat; see `../session-art.tsx` and the plan's
 * sixth divergence). The paths stay exported for anywhere the art cannot go.
 *
 * As everywhere in this package, nothing here imports `@landit/core`. Screens
 * pass labels and colours from core's tables (`SESSION_FEELS`,
 * `SESSION_VISIBILITIES`, `CLIP_PLATFORMS`, `STAGES`); the maps here are keyed
 * by the same ids and hold only drawing.
 */

/* ------------------------------------------------------------ the card --- */

/** The hard offset sizes the design uses: 2 small buttons … 8 modals. */
export type HardShadow = 2 | 3 | 4 | 5 | 7 | 8;

export type HardCardProps = {
  children: ReactNode;
  /** Offset in px. 4 for cards (default), 3 for phone cards, 5 for feature cards, 7–8 for modals. */
  shadow?: HardShadow;
  /** The repo's hover lift: up-left 1px with the shadow grown 2px; pressed, down 2px. */
  lift?: boolean;
  /** A fill other than paper — `#ffc23f` for today's rail, `#12100b` for the month card. */
  background?: string;
  as?: 'div' | 'article' | 'section' | 'li';
  className?: string;
  style?: CSSProperties;
};

/** Paper on a 3px ink keyline with a hard offset shadow. Radius 0. */
export function HardCard({
  children,
  shadow = 4,
  lift = false,
  background,
  as: Tag = 'div',
  className,
  style,
}: HardCardProps) {
  const vars = { '--hcard-sh': `${shadow}px` } as CSSProperties;
  const fill = background
    ? { background, color: foregroundFor(background) ?? 'var(--on-light)' }
    : undefined;
  return (
    <Tag className={cx('hcard', lift && 'lift', className)} style={{ ...vars, ...fill, ...style }}>
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------ the chips -- */

export type MetaChipProps = {
  children: ReactNode;
  /** A glyph before the label — `Equipment`, `WeatherIcon`, a `FeelSwatch`. */
  icon?: ReactNode;
  /** Defaults to cream (`#fff7e4`). The feel chip passes the feel's colour. */
  background?: string;
  title?: string;
  className?: string;
};

/**
 * Line 2 of a session card: `2px` ink on cream, Barlow Condensed 700 at 11.5px,
 * `.1em` tracking, uppercase. The text colour follows the fill.
 */
export function MetaChip({ children, icon, background, title, className }: MetaChipProps) {
  const style = background
    ? { background, color: foregroundFor(background) ?? 'var(--on-light)' }
    : undefined;
  return (
    <span className={cx('metachip', className)} style={style} title={title}>
      {icon}
      {children}
    </span>
  );
}

export type TrickPillProps = {
  /** The trick's name. */
  name: ReactNode;
  /**
   * The lime second half, when the session moved a stage — core's
   * `stageMoveLabel(entry)`, e.g. "→ Most times". Omit it and the pill is one
   * part.
   */
  move?: ReactNode;
  /** Makes the pill a link, to the trick. */
  href?: string;
  className?: string;
};

/** The two-part trick pill: name, then (if it moved) a `#9ce05b` stage segment. */
export function TrickPill({ name, move, href, className }: TrickPillProps) {
  const inner = (
    <>
      <span className="tp-name">{name}</span>
      {move ? <span className="tp-move">{move}</span> : null}
    </>
  );
  return href ? (
    <a href={href} className={cx('trickpill', className)}>
      {inner}
    </a>
  ) : (
    <span className={cx('trickpill', className)}>{inner}</span>
  );
}

/* ----------------------------------------------------------- the faces --- */

/**
 * The five feel faces, verbatim from the design's `FEEL` table: a 9.4 circle,
 * then the eyes path, then the mouth path, on a 24 grid at stroke 2.2.
 * Keyed by core's `SessionFeelId`.
 */
export const FEEL_FACES = {
  sent: {
    eyes: 'M6.6 11.2c.9-1.7 2.7-1.7 3.6 0M13.8 11.2c.9-1.7 2.7-1.7 3.6 0',
    mouth: 'M6.4 13.6c1.1 4 3.4 5.6 5.6 5.6s4.5-1.6 5.6-5.6',
  },
  good: { eyes: 'M9 10.2v1.8M15 10.2v1.8', mouth: 'M7.8 14.6c1 2.6 7.4 2.6 8.4 0' },
  fine: { eyes: 'M9 10.2v1.8M15 10.2v1.8', mouth: 'M8.2 16h7.6' },
  rough: { eyes: 'M9 10.2v1.8M15 10.2v1.8', mouth: 'M8 17.2c1-2.4 7-2.4 8 0' },
  hurt: {
    eyes: 'M7.2 9.2l2.6 2.6M9.8 9.2l-2.6 2.6M14.2 9.2l2.6 2.6M16.8 9.2l-2.6 2.6',
    mouth: 'M8.2 17.4c1-2.2 6.6-2.2 7.6 0',
  },
} as const satisfies Record<string, { eyes: string; mouth: string }>;

export type FeelFaceName = keyof typeof FEEL_FACES;

export const FEEL_FACE_NAMES = Object.keys(FEEL_FACES) as FeelFaceName[];

export type FeelFaceProps = {
  feel: FeelFaceName;
  /** px. 30–32 in the pickers, 17 inside a 20px swatch, 13–15 in the lists. */
  size?: number;
  /** Ignored by the art, kept so a caller that thickened the stroke still compiles. */
  strokeWidth?: number;
  /** Describe it to a screen reader. Leave off where the feel is named beside it. */
  title?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * One feel face: the painted sticker from `../session-art` (owner, 2026-09-14,
 * in chat). `FEEL_FACES` above is the stroked drawing it replaced, still
 * exported for anywhere the art cannot go.
 */
export function FeelFace({ feel, size = 24, title, className, style }: FeelFaceProps) {
  return (
    <SessionArt
      file={FEEL_ART[feel]}
      size={size}
      title={title}
      className={className}
      style={style}
    />
  );
}

export type FeelSwatchProps = {
  feel: FeelFaceName;
  /** The feel's colour — core's `sessionFeelColor(feel)`. */
  color: string;
  /** Box size in px; the sticker inside is 85% of it (20 → 17). */
  size?: number;
  title?: string;
  className?: string;
};

/**
 * The feel swatch: a `2px` ink square in the feel's colour with its face inside.
 *
 * The face takes 85% of the square where the stroked drawing took 70%. A
 * stroked circle read fine with room around it; the painted sticker is already
 * drawn with its own die-cut margin, so insetting it again spent pixels the art
 * has none of to spare at this size (20px is the smallest it is drawn anywhere).
 */
export function FeelSwatch({ feel, color, size = 20, title, className }: FeelSwatchProps) {
  return (
    <span
      className={cx('feelswatch', className)}
      style={{
        width: size,
        height: size,
        background: color,
        color: foregroundFor(color) ?? 'var(--on-light)',
      }}
    >
      <FeelFace feel={feel} size={Math.round(size * 0.85)} title={title} />
    </span>
  );
}

/* --------------------------------------------------------- the weather --- */

/** The five weather icons, verbatim from the design's `WX` table. One path each. */
export const WEATHER_ICONS = {
  sun: 'M12 7.6a4.4 4.4 0 100 8.8 4.4 4.4 0 000-8.8M12 2.6v2.4M12 19v2.4M4.4 12H2M22 12h-2.4M6.2 6.2L4.5 4.5M19.5 19.5l-1.7-1.7M17.8 6.2l1.7-1.7M4.5 19.5l1.7-1.7',
  cloud: 'M7 18h10a3.8 3.8 0 000-7.6 5.4 5.4 0 00-10.4 1.2A3.2 3.2 0 007 18z',
  rain: 'M7 15.4h10a3.8 3.8 0 000-7.6A5.4 5.4 0 006.6 9A3.2 3.2 0 007 15.4zM8.6 18.4l-1 2.6M12.6 18.4l-1 2.6M16.6 18.4l-1 2.6',
  wind: 'M3 9h9.6a3 3 0 10-3-3M3 14.4h12.6a3 3 0 11-3 3',
  cold: 'M12 3v18M4.2 7.5l15.6 9M19.8 7.5L4.2 16.5',
} as const satisfies Record<string, string>;

export type WeatherIconName = keyof typeof WEATHER_ICONS;

export const WEATHER_ICON_NAMES = Object.keys(WEATHER_ICONS) as WeatherIconName[];

export type WeatherIconProps = {
  weather: WeatherIconName;
  size?: number;
  /** Ignored by the art, as on `FeelFace`. */
  strokeWidth?: number;
  title?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * One weather icon: the painted sticker from `../session-art`. `WEATHER_ICONS`
 * above is the stroked drawing it replaced, kept on the same terms as
 * `FEEL_FACES`.
 */
export function WeatherIcon({ weather, size = 20, title, className, style }: WeatherIconProps) {
  return (
    <SessionArt
      file={WEATHER_ART[weather]}
      size={size}
      title={title}
      className={className}
      style={style}
    />
  );
}

/* ------------------------------------------------------ the visibility --- */

/**
 * The three visibility glyphs, verbatim from the design's `VIS` table: a globe
 * (Public), two riders (Crew), a padlock (Only me). Keyed by the privacy ids.
 */
export const VISIBILITY_ICONS = {
  public:
    'M12 2.6a9.4 9.4 0 100 18.8 9.4 9.4 0 000-18.8M2.8 12h18.4M12 2.6c2.4 2.6 3.6 5.8 3.6 9.4s-1.2 6.8-3.6 9.4c-2.4-2.6-3.6-5.8-3.6-9.4s1.2-6.8 3.6-9.4',
  members:
    'M5.5 8a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0M2.5 20c1-3.6 3.4-5.2 6.5-5.2s5.5 1.6 6.5 5.2M16 5.2a3.5 3.5 0 0 1 0 6.6M18 20c-.4-2-1-3.4-2-4.4',
  private: 'M4.5 10.5h15v10h-15zM8 10.5V7a4 4 0 0 1 8 0v3.5',
} as const satisfies Record<'public' | 'members' | 'private', string>;

export type VisibilityName = keyof typeof VISIBILITY_ICONS;

export type VisibilityLabelProps = {
  visibility: VisibilityName;
  /** "Public", "Crew", "Only me" — core's `sessionVisibilityLabel`. */
  label: ReactNode;
  size?: number;
  className?: string;
};

/** The right-aligned visibility label on a session card: glyph and word, muted. */
export function VisibilityLabel({ visibility, label, size = 14, className }: VisibilityLabelProps) {
  return (
    <span className={cx('vislabel', className)}>
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flex: 'none' }}
      >
        <path d={VISIBILITY_ICONS[visibility]} />
      </svg>
      {label}
    </span>
  );
}

/* --------------------------------------------------------- the picker ---- */

export type SegmentedOption<T extends string | number> = {
  id: T;
  label: ReactNode;
  /** A glyph above the label — a `FeelFace`, a `WeatherIcon`, an `Equipment`. */
  icon?: ReactNode;
  /** This option's own selected fill. The feel picker passes each feel's colour. */
  color?: string;
  disabled?: boolean;
};

export type SegmentedPickerProps<T extends string | number> = {
  options: readonly SegmentedOption<T>[];
  /** `null` when nothing is chosen yet. */
  value: T | null;
  onChange: (id: T) => void;
  /** What is being chosen, for a screen reader: "How it felt". */
  label: string;
  /** The selected fill when an option has none. Yellow; weather passes `#3ac0ff`. */
  selectedColor?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * A single-select row of equal cells — When, How long, the feel faces, the
 * weather, Who can see it. A `radiogroup`: arrow keys move the choice, and only
 * the chosen cell is in the tab order. The selected cell takes its colour as
 * its background, with the text colour following it.
 */
export function SegmentedPicker<T extends string | number>({
  options,
  value,
  onChange,
  label,
  selectedColor = '#ffc23f',
  disabled = false,
  className,
}: SegmentedPickerProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.id === value);

  const step = (from: number, delta: number) => {
    for (let n = 1; n <= options.length; n += 1) {
      const next = (from + delta * n + options.length * n) % options.length;
      const option = options[next];
      if (option && !option.disabled) {
        onChange(option.id);
        refs.current[next]?.focus();
        return;
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      step(index, 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      step(index, -1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cx('segpick', className)}
      style={{ '--seg-n': options.length } as CSSProperties}
    >
      {options.map((option, index) => {
        const on = index === selectedIndex;
        const fill = on ? (option.color ?? selectedColor) : undefined;
        const focusable = on || (selectedIndex === -1 && index === 0);
        return (
          <button
            key={String(option.id)}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={focusable ? 0 : -1}
            disabled={disabled || option.disabled}
            className={cx('seg', on && 'on')}
            style={
              fill
                ? { background: fill, color: foregroundFor(fill) ?? 'var(--on-light)' }
                : undefined
            }
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.icon}
            <span className="seg-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------- the stages --- */

export type StageLookProps = {
  /** "Most times" — core's `STAGE[id].label`. */
  label: ReactNode;
  /** The stage's colour — core's `STAGE[id].color`. */
  color: string;
};

export type StagePillProps = StageLookProps & { className?: string };

/** One stage as a pill in its own colour, with ink or paper text as the fill needs. */
export function StagePill({ label, color, className }: StagePillProps) {
  return (
    <span
      className={cx('stagepill', className)}
      style={{ background: color, color: foregroundFor(color) ?? 'var(--on-light)' }}
    >
      {label}
    </span>
  );
}

/** Read by a screen reader, drawn nowhere. This package has no `.sr-only` class. */
const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

export type StageMoveProps = {
  /** `null` for a trick that was not being tracked before the landing. */
  from: StageLookProps | null;
  to: StageLookProps;
  className?: string;
};

/** The `from → to` pair on the detail page's trick rows and the trick block. */
export function StageMove({ from, to, className }: StageMoveProps) {
  return (
    <span className={cx('stagemove', className)}>
      {from ? <StagePill {...from} /> : null}
      <span className="sm-arrow" aria-hidden="true">
        →
      </span>
      <span style={VISUALLY_HIDDEN}>to</span>
      <StagePill {...to} />
    </span>
  );
}

/* ----------------------------------------------------------- the clips --- */

/** Badge colours per platform, from the handoff: YouTube orange, Instagram pink, TikTok blue. */
export const CLIP_PLATFORM_LOOK = {
  youtube: { label: 'YouTube', color: '#ff5a1f' },
  instagram: { label: 'Instagram', color: '#ff3d78' },
  tiktok: { label: 'TikTok', color: '#3ac0ff' },
} as const satisfies Record<string, { label: string; color: string }>;

export type ClipPlatformName = keyof typeof CLIP_PLATFORM_LOOK;

export type PlatformBadgeProps = {
  platform: ClipPlatformName;
  label?: string;
  color?: string;
  className?: string;
};

/** The platform name as a coloured tab. */
export function PlatformBadge({ platform, label, color, className }: PlatformBadgeProps) {
  const look = CLIP_PLATFORM_LOOK[platform];
  const fill = color ?? look.color;
  return (
    <span
      className={cx('platbadge', className)}
      style={{ background: fill, color: foregroundFor(fill) ?? 'var(--on-light)' }}
    >
      {label ?? look.label}
    </span>
  );
}

export type ClipPosterProps = {
  platform: ClipPlatformName;
  /**
   * Where the clip lives. **Always core's `clipWatchUrl(clip)`**, never a
   * string a rider typed — that function rebuilds the URL from a parsed id.
   */
  href: string;
  /** `thumb` for the 168px card thumbnail, `player` for the detail page's 16:9 well. */
  variant?: 'thumb' | 'player';
  label?: string;
  /** Fire `session_*` analytics or similar. The link opens regardless. */
  onOpen?: () => void;
  className?: string;
  style?: CSSProperties;
};

/**
 * A locally drawn poster for a clip: a `#2a2620` 16:9 well, a play mark and the
 * platform tab. **It embeds nothing and fetches nothing** — no iframe, no
 * thumbnail from YouTube, Instagram or TikTok (plan §6.8: no third party is
 * contacted before a rider asks). Pressing it opens the clip at source in a new
 * tab, with no referrer.
 */
export function ClipPoster({
  platform,
  href,
  variant = 'thumb',
  label,
  onOpen,
  className,
  style,
}: ClipPosterProps) {
  const name = label ?? CLIP_PLATFORM_LOOK[platform].label;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      referrerPolicy="no-referrer"
      aria-label={`Watch the clip on ${name}`}
      className={cx('clipposter', variant, className)}
      style={style}
      onClick={onOpen}
    >
      <PlatformBadge platform={platform} label={name} className="cp-tab" />
      <svg className="cp-play" viewBox="0 0 72 72" aria-hidden="true">
        {variant === 'player' ? (
          <circle cx="36" cy="36" r="33" fill="none" stroke="#fffdf5" strokeWidth="4" />
        ) : null}
        <path d="M29 22.5 L51 36 L29 49.5 Z" fill="#fffdf5" />
      </svg>
    </a>
  );
}
