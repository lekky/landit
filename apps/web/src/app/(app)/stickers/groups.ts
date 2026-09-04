import type { StickerView } from './view';

/**
 * The wall's shelves.
 *
 * T24 took the wall from 25 stickers to 135 awards, and T27 to 297 — well over
 * a hundred per sport tab, in one flat grid with earned and locked mixed
 * together (#245). The one
 * question a rider brings to the screen — "what have I got, and what's near"
 * — had no answer a glance could give.
 *
 * So the wall is shelved. **Earned first**, all kinds together, because a
 * fresh one lands there and the pop should be at the top of the screen. Then
 * the locked ones by what they are *for*, in the order a rider meets them: the
 * trick awards they are in the library to earn, then the milestones those add
 * up to, streaks, challenges, and the rest.
 *
 * "Nearly there" is not a shelf, deliberately. `@landit/core`'s
 * `evaluateSticker` answers yes or no; there is no "how close" number, and the
 * rules are heterogeneous enough (thresholds, streaks, `() => false`) that
 * adding one is its own piece of work. When it exists it goes between Earned
 * and the first locked shelf.
 */

export type WallGroup = {
  readonly id: string;
  readonly label: string;
  readonly stickers: readonly StickerView[];
};

type Shelf = { readonly id: string; readonly label: string };

const EARNED: Shelf = { id: 'earned', label: 'Earned' };

/** Shelves for locked awards, in display order. */
const SHELVES: readonly Shelf[] = [
  { id: 'tricks', label: 'Trick awards' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'streaks', label: 'Streaks' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'out', label: 'Out and about' },
  { id: 'crew', label: 'Crew' },
  { id: 'account', label: 'Account' },
  { id: 'other', label: 'More' },
];

/**
 * `AwardKind` → shelf. Kinds not listed, and the '' a legacy record carries,
 * land on "More" rather than vanishing — a badge a rider holds must always be
 * somewhere on the wall (#246 is the same rule, seen from the other side).
 */
const SHELF_OF: Readonly<Record<string, string>> = {
  trick: 'tricks',
  'landed-count': 'milestones',
  'sport-landed-count': 'milestones',
  'mastered-count': 'milestones',
  'hard-mastered': 'milestones',
  'sport-cat-count': 'milestones',
  'sports-landed': 'milestones',
  'sport-cats-landed': 'milestones',
  streak: 'streaks',
  challenges: 'challenges',
  clips: 'out',
  'spots-approved': 'out',
  'events-going': 'out',
  crew: 'crew',
  'crew-owned': 'crew',
  'profile-complete': 'account',
  'account-age': 'account',
};

/** Which shelf a locked award sits on. Exported so the test can name a kind. */
export function shelfFor(kind: string): string {
  return SHELF_OF[kind] ?? 'other';
}

/**
 * Shelve a wall. Preserves the canonical order within each shelf, which is the
 * order the server handed the stickers in. Empty shelves are omitted, so a
 * rider who has earned everything sees one shelf and a brand-new one sees no
 * "Earned" heading over nothing.
 */
export function groupWall(wall: readonly StickerView[]): WallGroup[] {
  const earned = wall.filter((s) => s.earned);
  const byShelf = new Map<string, StickerView[]>();
  for (const s of wall) {
    if (s.earned) continue;
    const id = shelfFor(s.kind);
    const list = byShelf.get(id);
    if (list) list.push(s);
    else byShelf.set(id, [s]);
  }

  const out: WallGroup[] = [];
  if (earned.length) out.push({ ...EARNED, stickers: earned });
  for (const shelf of SHELVES) {
    const stickers = byShelf.get(shelf.id);
    if (stickers?.length) out.push({ ...shelf, stickers });
  }
  return out;
}
