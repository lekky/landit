import { SPORT_IDS, type SportId } from '@landit/core';

/**
 * The two rules behind the sport filter on `/events` and `/spots`
 * (`components/filters/SportFilter.tsx`), as pure functions.
 *
 * They live here rather than in the component for the reason
 * `apps/web/vitest.config.ts` gives: screens are proven in `e2e/`, and a
 * component is not unit-tested here. What *can* be pinned without a browser is
 * the arithmetic — that pressing a pill twice returns the list you started
 * with, that the order pills were pressed in never reaches an analytics
 * property, and that "nothing chosen" and "everything chosen" are the same
 * screen. Both screens call these, so neither can drift from the other.
 */

/**
 * The chosen sports after pressing one pill.
 *
 * Rebuilt in `SPORT_IDS` order rather than appended to, so the value is a set
 * and not a history: two riders who chose the same two sports produce the same
 * list whichever they pressed first. That is what makes it safe to compare (the
 * spots screen keys its fetch cache on it) and to count.
 */
export function toggleSport(chosen: readonly SportId[], id: SportId): readonly SportId[] {
  const next = chosen.includes(id) ? chosen.filter((sport) => sport !== id) : [...chosen, id];
  return SPORT_IDS.filter((sport) => next.includes(sport));
}

/**
 * The `sports` property on `sport_filter_set` — `'all'`, or the ids joined
 * with `+`.
 *
 * Every sport chosen is reported as `'all'` and not as `'scooter+skate+bmx'`:
 * the two are the same list on screen, and two values for one state is a funnel
 * that has to be added up before it can be read. Catalogue facts only — these
 * are three fixed strings written in this repository (see `ANALYTICS_EVENTS`).
 */
export function sportFilterProperty(chosen: readonly SportId[]): string {
  if (chosen.length === 0 || chosen.length === SPORT_IDS.length) return 'all';
  return chosen.join('+');
}
