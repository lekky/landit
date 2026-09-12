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
 *
 * **Every kind is listed, including the one that belongs on More.** Four kinds
 * (`comeback`, `founder`, `stage-drop`, `supporter`) were absent and reached
 * More by falling through, which reads identically in the code to a kind
 * nobody has got to yet. `stage-drop` genuinely belongs there — "move a trick
 * down a stage" is a one-off about honesty, not a member of any family — so it
 * says so, and the `?? 'other'` below is left for what it is actually for: a
 * kind this build has never heard of.
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
  // "Ride again after two months away" is about riding rhythm, which is what
  // the streak shelf already collects.
  comeback: 'streaks',
  challenges: 'challenges',
  clips: 'out',
  'spots-approved': 'out',
  'events-going': 'out',
  crew: 'crew',
  'crew-owned': 'crew',
  'profile-complete': 'account',
  'account-age': 'account',
  // Joining date and backing the product are both facts about the account, so
  // they sit with `year-one` rather than beside anything a rider rode for.
  founder: 'account',
  supporter: 'account',
  // Deliberately More: see the note above `SHELF_OF`.
  'stage-drop': 'other',
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

/* ------------------------------------------------------------ the two tabs -- */

/**
 * Which half of the wall is showing. "All" is the shelved wall above; "Earned"
 * is the rider's own collection with nothing locked in it.
 */
export type WallView = 'earned' | 'all';

/**
 * How many badges a shelf draws under "All" before the rest go behind its
 * button (Rachid, 2026-09-12, in chat).
 *
 * Six is three rows at the wall's 118px column on a phone. Measured on the
 * option mockups, six takes the wall from about nineteen and a half phone
 * screens to seven and a half; four would save a further nine tenths of a
 * screen, which is not worth a smaller glance at each shelf. The same owner
 * decision declined shrinking a locked badge to buy the rest, so this constant
 * is the only lever there is — change it here and nowhere else.
 */
export const SHELF_CAP = 6;

/** A shelf split at the cap: what is drawn, and how many are behind the button. */
export interface CappedShelf {
  readonly shown: readonly StickerView[];
  readonly hidden: number;
}

/** Split a shelf at `cap`. A shelf at or under it keeps everything and hides none. */
export function capShelf(stickers: readonly StickerView[], cap = SHELF_CAP): CappedShelf {
  if (cap < 0 || stickers.length <= cap) return { shown: stickers, hidden: 0 };
  return { shown: stickers.slice(0, cap), hidden: stickers.length - cap };
}

/**
 * Which view a wall opens on.
 *
 * **The unannounced branch is load-bearing, not redundant.** `StickerWall`
 * acknowledges freshly earned awards on mount, across every sport, whatever
 * view is showing — so a default that could hide the Earned shelf would stamp
 * `seen_at` without the badge ever being drawn, and the once-only pop is spent
 * for good (plan §3). Today "anything earned" already implies it, because an
 * unannounced award is an earned one; the branch is here so that a later change
 * to the line below cannot quietly take the pop with it.
 */
export function defaultWallView(wall: readonly StickerView[]): WallView {
  if (wall.some((s) => s.unannounced)) return 'earned';
  return wall.some((s) => s.earned) ? 'earned' : 'all';
}
