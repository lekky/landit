import { CATEGORY_IDS } from '../data/categories';
import { CHALLENGES } from '../data/challenges';
import { SPORT_IDS } from '../data/sports';
import { TRICKS } from '../data/tricks';
import type {
  CategoryId,
  Challenge,
  RiderSnapshot,
  RiderStats,
  SportId,
  SportStats,
  Trick,
} from '../types';
import { isTrickLanded, trickById } from './tricks';

/**
 * The catalogue the stats are measured against. Defaults to the canonical data,
 * which is what the client has; a PocketBase hook passes the live rows so a
 * staff edit changes the numbers immediately.
 */
export interface StatsCatalogue {
  readonly tricks?: readonly Trick[];
  readonly challenges?: readonly Challenge[];
}

/** The sports a rider tracks. An empty or missing list falls back to scooter. */
export function sportsOf(snapshot: Pick<RiderSnapshot, 'sports'>): SportId[] {
  const sports = (snapshot.sports ?? []).filter((s) => SPORT_IDS.includes(s));
  return sports.length ? [...sports] : ['scooter'];
}

/**
 * Stats for one scope. `sport` narrows to that sport; `null` counts everything
 * the rider could possibly track.
 *
 * Hidden tricks (`isLive: false`) are out of scope entirely: they are neither
 * in the total nor counted as landed, so pulling a trick from the library never
 * leaves a rider at 61 of 60.
 */
export function computeSportStats(
  snapshot: RiderSnapshot,
  sport: SportId | null,
  catalogue: StatsCatalogue = {},
): SportStats {
  const tricks = catalogue.tricks ?? TRICKS;
  const challenges = catalogue.challenges ?? CHALLENGES;
  const byId = snapshot.byId ?? {};

  const pool = tricks.filter((t) => t.isLive && (!sport || t.sport === sport));
  const inScope = (id: string): boolean => {
    const t = trickById(id, tricks);
    return !!t && t.isLive && (!sport || t.sport === sport);
  };

  const tracked = Object.keys(byId).filter(inScope);
  const landedIds = tracked.filter((id) => isTrickLanded(byId, id));

  const catCount = {} as Record<CategoryId, number>;
  const catTotal = {} as Record<CategoryId, number>;
  const catDone = {} as Record<CategoryId, boolean>;
  for (const c of CATEGORY_IDS) {
    catCount[c] = 0;
    catTotal[c] = pool.filter((t) => t.cat === c).length;
  }
  for (const id of landedIds) {
    const t = trickById(id, tricks);
    if (t) catCount[t.cat] += 1;
  }
  // An empty category is not a finished category, so a sport with no Air
  // tricks never silently awards the "all of them" sticker.
  for (const c of CATEGORY_IDS) catDone[c] = catTotal[c] > 0 && catCount[c] >= catTotal[c];

  const landedInSport = (sp: SportId): boolean =>
    Object.keys(byId).some((id) => isTrickLanded(byId, id) && trickById(id, tricks)?.sport === sp);

  const logged = snapshot.challengeLogged ?? {};
  const finishedChallenges = challenges.filter(
    (c) => (!sport || c.sport === sport) && (logged[c.id] ?? 0) >= c.goal,
  ).length;

  return {
    sport,
    byId,
    total: pool.length,
    tracked: tracked.length,
    landed: landedIds.length,
    landedIds,
    working: tracked.filter((id) => byId[id] === 'trying').length,
    wanted: tracked.filter((id) => byId[id] === 'want').length,
    mastered: tracked.filter((id) => byId[id] === 'every').length,
    hardLanded: landedIds.filter((id) => trickById(id, tricks)?.diff === 5).length,
    // Award-era (T24): the `dialled` award reads consistency on a Pro trick,
    // so the count is "at `every` AND difficulty 5", not either alone.
    hardMastered: tracked.filter((id) => byId[id] === 'every' && trickById(id, tricks)?.diff === 5)
      .length,
    catCount,
    catTotal,
    catDone,
    streak: snapshot.streak ?? 0,
    clips: snapshot.clips ?? 0,
    challenges: finishedChallenges,
    crew: !!snapshot.crew,
    // "At least two", not "every" — see the field's doc comment. Adding BMX to
    // `SPORT_IDS` changes what `every` means, and `every` would have quietly
    // made an earned sticker unearned.
    bothSports: SPORT_IDS.filter(landedInSport).length >= 2,
    pct: pool.length ? Math.round((landedIds.length / pool.length) * 100) : 0,
  };
}

/**
 * A rider's stats at every scope at once.
 *
 * The top level is the selected sport (or the combined totals when `sport` is
 * null), `bySport` holds each sport on its own, and `global` always holds the
 * combined totals. Sticker evaluation depends on this shape: a sport-scoped
 * sticker is judged against `bySport[sport]` alone and a shared one against
 * `global` (plan §2.2).
 */
export function computeStats(
  snapshot: RiderSnapshot,
  sport?: SportId | null,
  catalogue: StatsCatalogue = {},
): RiderStats {
  const scoped = computeSportStats(snapshot, sport ?? null, catalogue);
  const bySport = {} as Record<SportId, SportStats>;
  for (const s of SPORT_IDS) bySport[s] = computeSportStats(snapshot, s, catalogue);

  /*
   * Award-era cross-sport maxima (T24). The single-sport award kinds
   * (`sport-cat-count`, `sport-landed-count`, `sport-cats-landed`) ask "has any
   * ONE sport reached the bar", which no single scope can answer — so the
   * maxima are computed here, over every sport, and attached to the combined
   * scopes the shared awards are judged against.
   */
  const perSport = Object.values(bySport);
  const maxSportLanded = Math.max(0, ...perSport.map((s) => s.landed));
  const maxSportCatCount = {} as Record<CategoryId, number>;
  for (const c of CATEGORY_IDS) {
    maxSportCatCount[c] = Math.max(0, ...perSport.map((s) => s.catCount[c]));
  }
  const maxSportCatsLanded = Math.max(
    0,
    ...perSport.map((s) => CATEGORY_IDS.filter((c) => s.catCount[c] > 0).length),
  );
  const sportsLanded = perSport.filter((s) => s.landed > 0).length;
  const crossSport = { sportsLanded, maxSportLanded, maxSportCatCount, maxSportCatsLanded };

  const global = sport ? computeSportStats(snapshot, null, catalogue) : scoped;

  return {
    ...scoped,
    ...crossSport,
    sports: sportsOf(snapshot),
    bySport,
    global: { ...global, ...crossSport },
  };
}
