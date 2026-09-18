import { newAwardCount, type SportId } from '@landit/core';
import type { RiderStickersRecord, StickersRecord } from '@landit/db';

/**
 * The sticker shelf beside the library's heading (Rachid, 2026-09-18, in chat).
 *
 * Drawn by `app/(app)/library/StickerShelf.tsx`; built here.
 *
 * **Why the shelf is here and not in the top bar.** The first four sketches put
 * a stickers control in the shell beside the bell; the owner's answer was the
 * page, next to the count, because the tricks page is where a rider works out
 * what to learn next and that is the moment their own shelf is worth showing.
 * Nothing in `components/shell` changed.
 *
 * It lives in `lib/` rather than beside the screen because that is where this
 * app's unit tests reach (`vitest.config.ts` includes `src/lib/**`), and the
 * scoping rule below is the part worth testing without a browser — the same
 * place `lib/stickers.ts` and `lib/landingSeason.ts` sit for the same reason.
 *
 * **Built on the server, like Home's `view.ts` and the wall's.** `LibraryBrowser`
 * is a client component — the search box, the tabs and the sport scope are
 * client state — so everything it renders renders twice. Strings and counts are
 * decided here and the browser only picks which sport's shelf to draw, which is
 * what keeps Node and Chromium from disagreeing on one (LESSONS §3a).
 */

/** One badge on the shelf, drawn at 38px. */
export interface ShelfArtView {
  /** The printed art's file name under `/stickers/`, or null on a legacy record. */
  readonly img: string | null;
  readonly hue: string;
  /** The sticker's name, for the alt text of a badge with nothing else to say. */
  readonly name: string;
}

/** One sport's shelf — what the control says when the chip is on that sport. */
export interface ShelfView {
  /** Stickers earned on this wall: this sport's own, plus the shared ones. */
  readonly total: number;
  /**
   * Of those, how many landed since the rider last opened the wall
   * (`users.stickers_seen_at`). The flag is drawn only above zero.
   */
  readonly fresh: number;
  /**
   * Up to three badges. The newest three earned, or — for a rider with none on
   * this wall yet — three from the catalogue, so the control shows what is up
   * for grabs rather than an empty box.
   */
  readonly arts: readonly ShelfArtView[];
  /** False when this wall is still empty, which changes the copy, not the art. */
  readonly earned: boolean;
}

/** The shelf per sport, so switching the chip is a re-render rather than a fetch. */
export type ShelfBySport = Partial<Record<SportId, ShelfView>>;

/**
 * Newest first, by `earned_at`.
 *
 * Asked of the date rather than trusted from the read's order, exactly as
 * Home's Stickers card does it: the award rows come back in whatever order the
 * collection gives. An empty string is PocketBase's "never" and sorts to the
 * bottom, which is where a row with no date belongs.
 */
function newestFirst(rows: readonly RiderStickersRecord[]): RiderStickersRecord[] {
  return [...rows].sort((a, b) =>
    a.earned_at < b.earned_at ? 1 : a.earned_at > b.earned_at ? -1 : 0,
  );
}

const artOf = (record: StickersRecord): ShelfArtView => ({
  img: record.img || null,
  hue: record.hue,
  name: record.name,
});

/**
 * Does this sticker hang on this sport's wall?
 *
 * The wall's own scope, reused rather than re-derived (`app/(app)/stickers`,
 * "<sport> and shared"): a shared sticker sits on every wall, a sport's own
 * only on its own. Home's card scopes the same way, so the library shelf, the
 * Home card and the wall can never disagree about a number.
 */
const onWall = (record: StickersRecord, sport: SportId): boolean =>
  !record.sport || record.sport === sport;

/**
 * Build one shelf per sport the rider tracks.
 *
 * `seenAt` is `users.stickers_seen_at` — empty for a rider who has never opened
 * the wall, which `newAwardCount` reads as "has seen nothing" rather than as a
 * date (`packages/core/src/rules/stickers.ts`).
 *
 * A sport with no live catalogue stickers at all gets no shelf, and the browser
 * then draws no control: a link to a wall with nothing on it and nothing to
 * come is furniture.
 */
export function buildShelves(input: {
  readonly stickers: readonly StickersRecord[];
  readonly earned: readonly RiderStickersRecord[];
  readonly seenAt: string | null | undefined;
  readonly sports: readonly SportId[];
}): ShelfBySport {
  const { stickers, earned, seenAt, sports } = input;
  const byId = new Map(stickers.map((record) => [record.id, record]));

  /*
   * The rows joined to their catalogue record once, newest first, and reused
   * for every sport. A row whose sticker staff have retired mid-flight has no
   * live record and is dropped — the same reading `lib/stickers.ts` gives it,
   * for the same reason: a count that includes a sticker nobody can look up is
   * a count the wall will contradict.
   */
  const rows = newestFirst(earned).flatMap((row) => {
    const record = byId.get(row.sticker);
    return record ? [{ row, record }] : [];
  });

  const held = rows.map(({ record }) => record);
  /* What `newAwardCount` needs: when it landed, and which wall it hangs on. */
  const awards = rows.map(({ row, record }) => ({
    earnedAt: row.earned_at,
    sport: (record.sport || null) as SportId | null,
  }));

  const shelves: ShelfBySport = {};

  for (const sport of sports) {
    const mine = held.filter((record) => onWall(record, sport));
    const offer = stickers.filter((record) => onWall(record, sport));
    if (!mine.length && !offer.length) continue;

    shelves[sport] = {
      total: mine.length,
      fresh: newAwardCount(awards, seenAt, sport),
      arts: (mine.length ? mine : offer).slice(0, 3).map(artOf),
      earned: mine.length > 0,
    };
  }

  return shelves;
}
