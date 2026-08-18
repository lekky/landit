import { categoryLabel } from '../data/categories';
import { STAGE_IDS } from '../data/stages';
import { TRICKS } from '../data/tricks';
import type { CategoryId, SportId, StageId, Trick } from '../types';
import { isLandedStage, tricksFor } from './tricks';

/**
 * The library screen's filtering, searching and sorting, as pure functions.
 *
 * The prototype did all of this inline in `Library()` (`landit-screens-a.jsx`),
 * which is fine for one screen in one runtime. It is a rule about the product
 * all the same — what "landed" means in a status filter, what a search term is
 * matched against — so it lives here with the rest of them, gets unit tests, and
 * the native app gets it for free.
 *
 * Nothing here knows about the paywall. A locked trick is still a trick and is
 * still listed: "locked tricks stay visible throughout, never hidden" (handoff,
 * Interactions). The lock is drawn by the card, not filtered out by the query.
 */

/** The "my status" filter, in the order the screen offers it. */
export type TrickStatusFilter = 'all' | 'none' | 'want' | 'trying' | 'landed' | 'tracked';

/** The sort order. */
export type TrickSort = 'easiest' | 'hardest' | 'az';

/** Status options with their copy, so the screen does not invent labels. */
export const TRICK_STATUS_FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'none', label: 'Not tracked' },
  { id: 'want', label: 'Want to learn' },
  { id: 'trying', label: 'Learning' },
  { id: 'landed', label: 'Landed' },
] as const satisfies readonly { id: TrickStatusFilter; label: string }[];

export const TRICK_SORTS = [
  { id: 'easiest', label: 'Easiest first' },
  { id: 'hardest', label: 'Hardest first' },
  { id: 'az', label: 'A–Z' },
] as const satisfies readonly { id: TrickSort; label: string }[];

/**
 * What the library is being asked for. Every field is optional and every
 * omission means "do not narrow on this", so an empty query is the whole
 * library.
 */
export interface LibraryQuery {
  /** Free text. Matched against the name, the lowdown and the category label. */
  readonly search?: string;
  /** One sport, or `null`/absent for every sport. */
  readonly sport?: SportId | null;
  /** One category, or absent for all of them. */
  readonly category?: CategoryId | null;
  /** 1–5, or absent/0 for any difficulty. */
  readonly difficulty?: number | null;
  /** Narrowed against the rider's own progress. Needs `byId`. */
  readonly status?: TrickStatusFilter;
  readonly sort?: TrickSort;
  /** The rider's stage map. An empty one makes every trick "not tracked". */
  readonly byId?: Readonly<Record<string, StageId>>;
}

/**
 * Does this trick match the search term?
 *
 * Name, lowdown and category label, which is what the prototype matched — a
 * rider searching "grind" should find the tricks whose description says grind,
 * not only the ones with it in the name. The category label is resolved *for
 * the trick's own sport*, so a BMX rider searching "flatground" finds their
 * flatground tricks (plan §3, `categoryLabel`).
 */
export function trickMatchesSearch(trick: Trick, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  const haystack =
    `${trick.name} ${trick.about} ${categoryLabel(trick.cat, trick.sport)}`.toLowerCase();
  return haystack.includes(needle);
}

/** Does this stage satisfy the "my status" filter? `undefined` means untracked. */
export function trickMatchesStatus(
  stage: StageId | undefined | null,
  status: TrickStatusFilter,
): boolean {
  switch (status) {
    case 'all':
      return true;
    case 'none':
      return !stage;
    case 'tracked':
      return !!stage;
    case 'landed':
      return isLandedStage(stage);
    default:
      return stage === status;
  }
}

/**
 * Compare two names without `localeCompare`.
 *
 * Deliberate: this list renders on the server and again in the browser, and
 * anything locale-derived can disagree between the two — Node and Chromium ship
 * different ICU data, and a mismatch does not merely warn, it throws the tree
 * away (LESSONS §3a). Trick names are plain ASCII, so a codepoint comparison on
 * the lowercased name is both stable and the same everywhere.
 */
function byName(a: Trick, b: Trick): number {
  const left = a.name.toLowerCase();
  const right = b.name.toLowerCase();
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** Sort a list of tricks. Ties break by name, so the order is never arbitrary. */
export function sortTricks(tricks: readonly Trick[], sort: TrickSort = 'easiest'): Trick[] {
  const out = [...tricks];
  if (sort === 'az') return out.sort(byName);
  const direction = sort === 'hardest' ? -1 : 1;
  return out.sort((a, b) => (a.diff - b.diff) * direction || byName(a, b));
}

/**
 * The library, filtered and sorted.
 *
 * Hidden tricks (`isLive: false`) are never returned. Staff pulling a trick
 * takes it out of the library rather than leaving it findable by search — the
 * same scoping the stats use, so a rider's "12 of 30" and the grid they are
 * looking at always agree.
 */
export function filterTricks(query: LibraryQuery = {}, tricks: readonly Trick[] = TRICKS): Trick[] {
  const { search = '', category, difficulty, status = 'all', sort = 'easiest', byId = {} } = query;

  const matched = tricksFor(query.sport ?? null, tricks).filter((trick) => {
    if (!trick.isLive) return false;
    if (category && trick.cat !== category) return false;
    if (difficulty && trick.diff !== difficulty) return false;
    if (!trickMatchesStatus(byId[trick.id], status)) return false;
    return trickMatchesSearch(trick, search);
  });

  return sortTricks(matched, sort);
}

/** One stage's worth of the rider's tricks, in `STAGES` order. */
export interface TrickStageGroup {
  readonly stage: StageId;
  readonly tricks: readonly Trick[];
}

/**
 * The rider's tracked tricks, grouped by the stage they are on.
 *
 * "My tricks" asks a different question from the library, and the answer wants a
 * different shape. The library asks *what exists* and is therefore ordered by
 * difficulty: easiest first, because that is the order you would learn them in.
 * This asks *where am I*, and the useful ordering is the stage — the three you
 * are learning together, then the ones you land sometimes, then the ones that
 * are yours. Difficulty still sorts *within* a stage, so the cheapest next win
 * in each group is the one at the front.
 *
 * Groups come back in `STAGES` order and **empty groups are dropped**: a rider
 * with nothing on "Sometimes" should not read a heading that says so. That also
 * makes `groups.length` the honest answer to "how many kinds of progress am I
 * making", which is what the count beside the switch reports.
 *
 * Untracked tricks are absent by construction — no stage, no group. This
 * function does not filter by sport, search or paywall; hand it the output of
 * `filterTricks` and it groups whatever it is given, so the switch composes with
 * the sidebar rather than overriding it.
 */
export function groupTricksByStage(
  tricks: readonly Trick[],
  byId: Readonly<Record<string, StageId>> = {},
  sort: TrickSort = 'easiest',
): TrickStageGroup[] {
  const buckets = new Map<StageId, Trick[]>();
  for (const trick of tricks) {
    const stage = byId[trick.id];
    if (!stage) continue;
    const bucket = buckets.get(stage);
    if (bucket) bucket.push(trick);
    else buckets.set(stage, [trick]);
  }

  const groups: TrickStageGroup[] = [];
  for (const stage of STAGE_IDS) {
    const bucket = buckets.get(stage);
    if (bucket?.length) groups.push({ stage, tricks: sortTricks(bucket, sort) });
  }
  return groups;
}

/**
 * How many filters are narrowing the list — the number on the "Filters & sort"
 * toggle below 860px, where the panel itself is collapsed and a rider cannot
 * otherwise see that a filter is on.
 *
 * The sort is not a filter: it changes the order, never the contents, so
 * counting it would tell a rider something is hidden when nothing is.
 */
export function activeFilterCount(query: LibraryQuery = {}): number {
  let n = 0;
  if (query.category) n += 1;
  if (query.difficulty) n += 1;
  if (query.status && query.status !== 'all') n += 1;
  return n;
}

/**
 * The tricks that name this one as a prerequisite — "land this and you unlock".
 *
 * The inverse of `missingPrereqs`, and the reason it is a function rather than
 * a field: the edges are stored one way round, and the trick page needs to read
 * them both ways.
 */
export function tricksUnlockedBy(trickId: string, tricks: readonly Trick[] = TRICKS): Trick[] {
  return tricks.filter((t) => t.isLive && t.pre.includes(trickId));
}

/**
 * The prerequisites of a trick, as records, in the order they are listed.
 *
 * Unknown ids are dropped rather than throwing: a prerequisite pointing at a
 * trick staff have hidden should quietly disappear from the pills, not break
 * the page a rider is standing in front of.
 */
export function prereqTricks(trick: Trick, tricks: readonly Trick[] = TRICKS): Trick[] {
  const byId = new Map(tricks.map((t) => [t.id, t]));
  return trick.pre.map((id) => byId.get(id)).filter((t): t is Trick => !!t && t.isLive);
}
