import type { CSSProperties } from 'react';

import { Icon, type IconName } from './icons';

/**
 * Painted equipment art for the three sports, replacing the line glyphs that
 * `ICONS.scoot`, `ICONS.board` and `ICONS.bmx` drew (owner, 2026-08-31, in
 * chat).
 *
 * This is a deliberate divergence from "recreate, don't reinterpret": the
 * handoff draws all three on the same 24px stroked grid, and these are die-cut
 * sticker illustrations instead. The three are the only glyphs in the set that
 * name a physical object a rider owns, and they are the ones a rider picks
 * themselves at onboarding — worth art, where a `home` or a `search` is not.
 * Nothing else in `ICONS` changes.
 *
 * The PNGs are package assets under `assets/sports/`, on the same terms as the
 * avatars and the award badges: they live once, in the design system, and
 * `apps/web` copies them into `public/` at dev and build time (see
 * `apps/web/scripts/sync-sports.mjs`). That is why the base path is a URL.
 *
 * Two things the art cannot do that the glyph could, both by nature and neither
 * a defect to fix in code:
 * - it does not take the sport's colour. A chip's keyline still does the
 *   colour-coding; the art inside it is the colour it was painted.
 * - it does not scale to nothing. Below about 14px the wheels close up and a
 *   skateboard is a dash, so the callers here ask for a little more room than
 *   the 12–13px the stroked glyph wanted.
 */

/** Where `apps/web` serves the copies from. */
export const SPORT_ART_BASE_PATH = '/sports';

/**
 * Keyed by icon name, not sport id, so that a caller holding a `SportLook` can
 * look art up from `sport.icon` without this package learning what a sport is.
 * `@landit/ui-web` takes colours and labels; the sport list stays in core.
 */
export const SPORT_ART = {
  scoot: { file: 'scoot.png', label: 'Stunt scooter' },
  board: { file: 'board.png', label: 'Skateboard' },
  bmx: { file: 'bmx.png', label: 'BMX bike' },
} as const satisfies Record<string, { file: string; label: string }>;

/** The icon names that have painted art. */
export type SportArtName = keyof typeof SPORT_ART;

export const SPORT_ART_NAMES = Object.keys(SPORT_ART) as SportArtName[];

/** Narrows an icon name to one the art map covers. */
export function hasSportArt(name: IconName | string): name is SportArtName {
  return name in SPORT_ART;
}

/** `/sports/board.png`. Pass a base path to serve them from somewhere else. */
export function sportArtSrc(name: SportArtName, base: string = SPORT_ART_BASE_PATH): string {
  return `${base}/${SPORT_ART[name].file}`;
}

export type EquipmentProps = {
  /** Any icon name. One without art falls back to the stroked glyph. */
  name: IconName;
  /** The box the art is fitted inside, in px. It keeps its own aspect ratio. */
  size?: number;
  /** Stroke width for the fallback glyph. Ignored by the art. */
  strokeWidth?: number;
  /**
   * Describe the art to a screen reader. Leave it off wherever the sport is
   * already named in text beside it, which is every caller in the app today.
   */
  title?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * The equipment for a sport: painted art where there is art, and the stroked
 * glyph for every other icon name, so a caller can pass `sport.icon` straight
 * through without checking which of the two it will get.
 */
export function Equipment({
  name,
  size = 20,
  strokeWidth = 2.2,
  title,
  className,
  style,
}: EquipmentProps) {
  if (!hasSportArt(name)) {
    return (
      <Icon
        name={name}
        size={size}
        strokeWidth={strokeWidth}
        title={title}
        className={className}
        style={style}
      />
    );
  }
  return (
    // Width and height are the *box*; `object-fit: contain` is what keeps a
    // skateboard from being stretched square inside it. `flex: none` because
    // every caller so far puts this in a flex row next to a label.
    <img
      src={sportArtSrc(name)}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{ objectFit: 'contain', flex: 'none', ...style }}
    />
  );
}
