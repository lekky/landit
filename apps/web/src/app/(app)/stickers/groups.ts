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
 * So the wall is shelved by what an award is *for*, in the order a rider meets
 * them: the trick awards they are in the library to earn, then the milestones
 * those add up to, streaks, challenges, and the rest.
 *
 * **Earned is a tab, not a shelf** (Rachid, 2026-09-12, in chat). T33 first
 * made it a shelf pinned to the top of both views, and that was wrong twice
 * over: a badge appeared on both tabs, and because the earned shelf led the
 * locked view as well, switching tabs changed nothing a rider could see
 * without scrolling past it. The two tabs are now disjoint halves of the same
 * wall — every badge is on exactly one — and both are shelved the same way, so
 * "Trick awards" means the same thing on either side and the counts tell the
 * rider which half they are looking at.
 *
 * "Nearly there" is not a shelf, deliberately. `@landit/core`'s
 * `evaluateSticker` answers yes or no; there is no "how close" number, and the
 * rules are heterogeneous enough (thresholds, streaks, `() => false`) that
 * adding one is its own piece of work.
 */

export type WallGroup = {
  readonly id: string;
  readonly label: string;
  readonly stickers: readonly StickerView[];
};

type Shelf = { readonly id: string; readonly label: string };

/** The shelves, in display order. Both tabs use them. */
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
 * Shelve a list of badges — one tab's half of the wall.
 *
 * Preserves the canonical order within each shelf, which is the order the
 * server handed the stickers in. Empty shelves are omitted, so a rider with
 * two earned badges sees two shelves rather than eight, six of them headings
 * over nothing.
 */
export function shelveWall(stickers: readonly StickerView[]): WallGroup[] {
  const byShelf = new Map<string, StickerView[]>();
  for (const s of stickers) {
    const id = shelfFor(s.kind);
    const list = byShelf.get(id);
    if (list) list.push(s);
    else byShelf.set(id, [s]);
  }

  const out: WallGroup[] = [];
  for (const shelf of SHELVES) {
    const list = byShelf.get(shelf.id);
    if (list?.length) out.push({ ...shelf, stickers: list });
  }
  return out;
}

/* ------------------------------------------------------------ the two tabs -- */

/**
 * Which half of the wall is showing. The two are disjoint: every badge on the
 * rider's wall is in exactly one of them, and `earned` is the only thing that
 * decides which.
 */
export type WallView = 'earned' | 'unearned';

/**
 * The tab labels.
 *
 * "Not yet" rather than "Locked" on purpose. It is already the word printed
 * across an unearned badge (`sticker-mark` in `ui-web`), so the tab and the
 * art agree — and in this product **locked means the paywall** (`isTrickLocked`,
 * the hatched steps on a trick's road). A tab called Locked would have read as
 * "the ones you have to pay for", which is the one thing it must not say.
 */
export const WALL_VIEW_LABELS: Readonly<Record<WallView, string>> = {
  earned: 'Earned',
  unearned: 'Not yet',
};

/**
 * How many badges a shelf draws before the rest go behind its button (Rachid,
 * 2026-09-12, in chat).
 *
 * Six is three rows at the wall's 118px column on a phone. Measured on the
 * option mockups, six takes the wall from about nineteen and a half phone
 * screens to seven and a half; four would save a further nine tenths of a
 * screen, which is not worth a smaller glance at each shelf. The same owner
 * decision declined shrinking a locked badge to buy the rest, so this constant
 * is the only lever there is — change it here and nowhere else.
 *
 * It applies to **both** tabs. A rider who has earned eighty badges has the
 * same wall-of-scroll problem on their own side as a new rider has on the
 * other, and a cap that ran on one tab only would be a rule with an exception
 * to remember.
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
 * view is showing — so a default that could hide the earned half would stamp
 * `seen_at` without the badge ever being drawn, and the once-only pop is spent
 * for good (plan §3). Now that the tabs are disjoint this matters more than it
 * did: the other tab genuinely does not contain the new badge. Today "anything
 * earned" already implies it, because an unannounced award is an earned one;
 * the branch is here so that a later change to the line below cannot quietly
 * take the pop with it.
 */
export function defaultWallView(wall: readonly StickerView[]): WallView {
  if (wall.some((s) => s.unannounced)) return 'earned';
  return wall.some((s) => s.earned) ? 'earned' : 'unearned';
}
