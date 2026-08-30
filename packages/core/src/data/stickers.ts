import type { Sticker } from '../types';

import { AWARDS } from './awards';

/**
 * Sticker records: the T24 award set plus the retired legacy stickers.
 *
 * **The award era (T24, owner-directed 2026-08-30).** The original 25 drawn
 * stickers were replaced by the printed award set in `./awards.ts` — one badge
 * per trick plus the platform awards. Fifteen legacy stickers whose conditions
 * matched a new award exactly (`first-land`, `ten-deep`→`rolling-deep`,
 * `week-one`→`hot-streak`, `month-on`→`all-season`, `challenger`→
 * `first-challenge`, `crew-up`→`crewed-up`, `every-time`→`on-lock`,
 * `first-clip`, `whip-club`→`tailwhip`, `hop-master`→`bunny-hop`,
 * `flip-club`→`sk-kickflip`, `flat-out`, `coping-time`→`sk-axle-stall`,
 * `tre-deep`→`sk-tre-flip`, `ollie-up`→`sk-ollie`) are not duplicated here:
 * the award-system migration renames those records' slugs in place, so a
 * rider's earned rows carry straight over to the new badge. The ten below had
 * no honest equivalent and retire instead — records kept, `isLive: false`,
 * because the seed upserts and never deletes (see `upside`).
 *
 * `sport: null` means the sticker is judged against the rider's combined
 * stats; a sport-scoped sticker is judged against that sport alone.
 *
 * **The naming rule, earned in T10 (issue #82), scoped by T24.** For records
 * *without* `img`, `StickerBadge` sets the name on a 30.5-radius arc, so those
 * names hold to thirteen characters. Award records render their printed art
 * and are exempt from the length limit — but every name still avoids numbers
 * and units, because a threshold in a name goes stale the moment staff retune
 * the record (issue #10, "7 Day Streak").
 */
const LEGACY_RETIRED = [
  {
    id: 'five-deep',
    // Retired by T24: the award-era count ladder starts at ten
    // (`rolling-deep`), and a five-rung under it earned nothing the ten-rung
    // does not say better. Earned rows survive in `rider_stickers`.
    name: 'Five Deep',
    sport: null,
    hue: '#10A06A',
    ico: 'coins',
    cond: 'tricks landed',
    n: 5,
    isLive: false,
  },
  {
    id: 'gnarly',
    // Retired by T24. Its successor `dialled` rewards taking a Pro trick to
    // "every time" — consistency — where this rewarded the first landing.
    // Landing-once as the celebrated moment is the escalation shape issue #77
    // retired `upside` for; mastery is the version that cannot function as a
    // dare.
    name: 'Gnarly',
    sport: null,
    hue: '#16140F',
    ico: 'skull',
    cond: 'difficulty 5 tricks landed',
    n: 1,
    isLive: false,
  },
  {
    id: 'both-feet',
    // Retired by T24 rather than mapped: its rule is "two or more sports" and
    // the successor `triple-threat` asks for all three. Updating the record in
    // place would have relabelled two-sport riders' earned rows with an award
    // whose condition they do not meet.
    name: 'Crossover',
    sport: null,
    hue: '#2EC4B6',
    ico: 'grid',
    cond: 'Land tricks on two different sports',
    isLive: false,
  },
  {
    id: 'street-cred',
    // Retired by T24; `street-king` is the award-era street count, judged on
    // any one sport rather than scooter alone and set at the full-category
    // rung rather than three.
    name: 'Street Cred',
    sport: 'scooter',
    hue: '#FF5A1F',
    ico: 'map',
    cond: 'Street scooter tricks landed',
    n: 3,
    isLive: false,
  },
  {
    id: 'park-rat',
    // Retired by T24 — see `street-cred`; `park-master` is the successor.
    name: 'Park Rat',
    sport: 'scooter',
    hue: '#3AC0FF',
    ico: 'home',
    cond: 'Park scooter tricks landed',
    n: 3,
    isLive: false,
  },
  {
    id: 'grind-time',
    // Retired by T24: every grind now carries its own trick award, so "any
    // scooter grind" is four badges' worth of recognition already.
    name: 'Grind Time',
    sport: 'scooter',
    hue: '#9CE05B',
    ico: 'rail',
    cond: 'Land any scooter grind',
    isLive: false,
  },
  {
    id: 'upside',
    // **Retired, deliberately (issue #77) — before T24, and staying retired.**
    // It was the only sticker whose condition named difficulty-5 inversions,
    // in a product for 8–16 year olds whose own coaching copy says "learn it
    // into a foam pit or a resi ramp first" (`backflip`). A badge on the wall
    // is a reason for a child to skip that rung. The award-era `backflip`
    // trick award is a different thing: it celebrates the trick the library
    // itself teaches, on the library's own coached path, not a nameless dare.
    //
    // The record stays rather than being deleted, because the seed upserts and
    // never removes — deleting it here would leave a live, unearnable sticker
    // on the wall of every database already seeded. `isLive: false` retires it
    // everywhere on the next seed run, and its rule is `() => false` so it
    // cannot award even if staff switch it back on.
    name: 'Upside Down',
    sport: 'scooter',
    hue: '#FF3D78',
    ico: 'rotate',
    cond: 'Retired — see plan §7, T10',
    isLive: false,
  },
  {
    id: 'flat-track',
    // Retired by T24; `flat-out` (now any-sport) is the successor at the same
    // seven-trick rung.
    name: 'Flatground',
    sport: 'skate',
    hue: '#2EC4B6',
    ico: 'grid',
    cond: 'Flat skate tricks landed',
    n: 10,
    isLive: false,
  },
  {
    id: 'ledge-rat',
    // Retired by T24. Its careful shape — counting the seven named ledge and
    // rail tricks rather than the `street` category, so the app never badges
    // stair counts (issue #79) — is preserved by the award era differently:
    // `street-king` counts a category that skate's library keeps honest, and
    // `sk-gap` has a single trick award, not a ladder.
    name: 'Ledge Rat',
    sport: 'skate',
    hue: '#FF5A1F',
    ico: 'rail',
    cond: 'ledge and rail tricks landed',
    n: 4,
    isLive: false,
  },
  {
    id: 'bowl-rider',
    // Retired by T24 — see `street-cred`; `park-master` is the successor.
    name: 'Ramp Rider',
    sport: 'skate',
    hue: '#3AC0FF',
    ico: 'home',
    cond: 'Park skate tricks landed',
    n: 2,
    isLive: false,
  },
] as const satisfies readonly Sticker[];

export const STICKERS = [...AWARDS, ...LEGACY_RETIRED] as const satisfies readonly Sticker[];

/** Every sticker id, as a union. Keeps the rule map exhaustive. */
export type StickerId = (typeof STICKERS)[number]['id'];
