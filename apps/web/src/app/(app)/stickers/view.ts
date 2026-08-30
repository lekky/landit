import type { SportId } from '@landit/core';

/**
 * What the server hands the sticker wall.
 *
 * Same contract as Home's `view.ts` and for the same reason: the wall is a
 * client component because the sport tabs and the detail modal are client
 * state, so everything it renders renders twice. Anything derived from the
 * runtime — a date from ICU, an ordering from `localeCompare` — can differ
 * between Node and Chromium, and a hydration mismatch does not merely warn
 * (LESSONS §3a). So the strings are built here and the client only picks which
 * ones to show.
 */

/** One sticker on the wall. */
export interface StickerView {
  /** The canonical slug — stable across a reseed, and what the URL hash uses. */
  readonly slug: string;
  readonly name: string;
  readonly hue: string;
  readonly icon?: string;
  /** Printed award art under `/stickers/` (T24); absent on legacy records. */
  readonly img?: string;
  /** 0–3, baked into the art; carried for the detail modal and analytics. */
  readonly stars?: number;
  readonly rarity?: string;
  /** `null` for a shared sticker, which is judged against combined stats. */
  readonly sport: SportId | null;
  /** "Scooter", or nothing when the sticker is shared. */
  readonly sportLabel: string | null;
  /** The colour of the sport chip in the detail modal. */
  readonly sportColor: string | null;
  /** The sport's icon — not the sticker's. */
  readonly sportIcon: string | null;
  /** "4 weeks in a row" — the threshold already folded in. */
  readonly condition: string;
  readonly earned: boolean;
  /** "Earned 12 Aug 2026", or null while it is locked. */
  readonly earnedLabel: string | null;
  /**
   * Earned and never announced. The badge plays the `just` pop, and the screen
   * acknowledges it so it never pops again (plan §3, `rider_stickers.seen_at`).
   */
  readonly unannounced: boolean;
  /** The `rider_stickers` row id, present once earned. */
  readonly riderStickerId: string | null;
  /** The caption the share card copies. Built on the server; see `view.ts` above. */
  readonly caption: string;
  /** "Earned Gnarly" — the share card's headline. */
  readonly shareHeadline: string;
}

/** One tab of the wall. */
export interface WallTabView {
  readonly sport: SportId;
  readonly label: string;
  readonly color: string;
  readonly icon: string;
  /** "3 earned" — counted over the stickers this tab shows. */
  readonly earnedLabel: string;
}

export interface StickerWallView {
  readonly tabs: readonly WallTabView[];
  /** Stickers per sport tab, in canonical order. Shared ones appear on every tab. */
  readonly bySport: Readonly<Record<string, readonly StickerView[]>>;
  /** "Sticker wall · Scooter and shared" per tab. */
  readonly eyebrowBySport: Readonly<Record<string, string>>;
  /** The rider's name and totals, for the share card's meta line. */
  readonly shareMeta: string;
  /** "16 Aug", formatted from a table rather than from ICU. */
  readonly dateLabel: string;
}
