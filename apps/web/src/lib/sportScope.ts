import { SPORTS, SPORT_IDS, type SportId } from '@landit/core';

/**
 * The arithmetic behind `SportScopeSelect` (rethink §3.3, O1), as pure
 * functions.
 *
 * Here rather than in the component for the reason `apps/web/vitest.config.ts`
 * gives and `lib/sportFilter.ts` gave before it: screens are proven in `e2e/`
 * and a component is not unit-tested here, but the arithmetic can be pinned
 * without a browser. What is worth pinning is the part that is easy to get
 * quietly wrong — that a stored choice naming a sport this build no longer has
 * falls back to the screen's default rather than filtering to nothing, that
 * "your sport" and "that same sport chosen by name" produce the same list, and
 * that the analytics property is one of three fixed words and never a sport id.
 *
 * **It replaces the multi-select** (`SportFilter`, `lib/sportFilter.ts`), which
 * O1 retired on 2026-09-16: a scope is one answer, not a set, so there is no
 * "scooter and BMX" any more and nothing here has to make a set canonical.
 */

/**
 * What a list is scoped to, as the `<select>`'s value.
 *
 * `'chip'` is "whatever the top bar's sport chip says", which is why it is a
 * word and not a sport id: the choice has to keep tracking the chip, so
 * switching the chip switches the list (§3.3). `'all'` is every sport. Anything
 * else is a sport chosen by name, for a rider looking at a sport they do not
 * ride today.
 */
export type SportScope = 'chip' | 'all' | SportId;

/** Which screen a scope belongs to. One key per screen, per device. */
export type ScopeScreen = 'spots' | 'events';

/** Where a screen's choice is kept — `localStorage`, per device (§3.3). */
export function scopeStorageKey(screen: string): string {
  return `landit.scope.${screen}`;
}

/**
 * A stored string, reduced to a scope this build knows.
 *
 * Anything else — a sport that has been retired, a value from an older build,
 * junk somebody typed into their own storage — is the screen's default and not
 * an empty list. A list that silently matches nothing is the failure mode worth
 * designing out: the rider sees a screen with no spots on it and no way to tell
 * that a stale preference is why.
 */
export function readScope(raw: string | null, fallback: SportScope): SportScope {
  if (raw === 'chip' || raw === 'all') return raw;
  const sport = SPORT_IDS.find((id) => id === raw);
  return sport ?? fallback;
}

/**
 * The sports a scope narrows to, in the shape both screens already filter with:
 * a list, empty for "every sport".
 *
 * Empty rather than `SPORT_IDS` for "all", because that is the value the query
 * builders treat as unfiltered — `spotListFilter` adds no clause at all, and
 * `filterSpots` skips the sport rule — so "every sport" costs no `:each` scan
 * of a JSON column to arrive back where it started.
 */
export function scopeSports(scope: SportScope, chip: SportId): readonly SportId[] {
  if (scope === 'all') return [];
  return [scope === 'chip' ? chip : scope];
}

/**
 * The `scope` property on `sport_scope_set` — `'chip'`, `'all'` or `'other'`.
 *
 * **Never which other sport**, which is what the catalogue entry says and why
 * this function exists rather than the component sending its own value. "The
 * sport this rider chose that is not the one they ride" is a fact about the
 * rider; the three words here are three fixed strings written in this
 * repository.
 */
export function scopeProperty(scope: SportScope): 'chip' | 'all' | 'other' {
  return scope === 'chip' || scope === 'all' ? scope : 'other';
}

export interface ScopeOption {
  readonly value: SportScope;
  readonly label: string;
}

/**
 * The options, in O1's order: the rider's own sport, every sport, then one
 * entry per other sport.
 *
 * `everyLabel` is the screen's words for "all" — "Every spot" on Spots, "All
 * sports" on Events — because the two screens count different things and a
 * calendar that offered "Every spot" would be describing the wrong noun.
 *
 * The chip's sport is named in the first option ("Your sport (Scooter)") rather
 * than left as a bare "Your sport": the row is one line under a header, so the
 * rider should not have to look at the top bar to find out what the list is
 * showing them.
 */
export function scopeOptions(chip: SportId, everyLabel: string): readonly ScopeOption[] {
  return [
    { value: 'chip', label: `Your sport (${SPORTS[chip].short})` },
    { value: 'all', label: everyLabel },
    ...SPORT_IDS.filter((id) => id !== chip).map((id) => ({
      value: id as SportScope,
      label: SPORTS[id].short,
    })),
  ];
}
