import type { Sticker } from '../types';

/**
 * Sticker records, transcribed from `design-handoff/design/landit-data.js`.
 *
 * Deliberately data only: the condition each sticker tests lives in code
 * (`../rules/stickers.ts`), while the editable parts — name, colour, icon,
 * condition copy, the threshold `n` and whether it is live — live here and in
 * the `stickers` collection so staff can tune them without a deploy (plan §3).
 *
 * `sport: null` means the sticker is judged against the rider's combined
 * stats; a sport-scoped sticker is judged against that sport alone.
 *
 * **The naming rule, earned in T10 (issue #82).** Names survive when they are
 * literal, dry, or use words riders actually say. They fail when they are
 * adult-invented puns ("Flat Tracked", "Ollie Up"), hierarchy words
 * (club / master / pro), or a word whose first reading is something else
 * entirely ("Coping Time"). Two more constraints that are not style:
 *
 * - **No number and no unit in a name.** `StickerBadge` renders the name and
 *   `stickerCondition` renders `n` beside the condition, so a name carrying
 *   either goes stale the moment staff retune the record — which is how
 *   "7 Day Streak" survived the streak becoming weekly (issue #10).
 * - **Thirteen characters at the outside.** The name is set on a 30.5-radius
 *   arc in `StickerBadge`, and the font-size ramp only steps once. The longest
 *   shipped name is "Ollie Dialled".
 */
export const STICKERS = [
  {
    id: 'first-land',
    name: 'First Land',
    sport: null,
    hue: '#FF5A8A',
    ico: 'check',
    cond: 'Log your first trick',
    isLive: true,
  },
  {
    id: 'five-deep',
    name: 'Five Deep',
    sport: null,
    hue: '#10A06A',
    ico: 'coins',
    cond: 'tricks landed',
    n: 5,
    isLive: true,
  },
  {
    id: 'ten-deep',
    name: 'Ten Deep',
    sport: null,
    hue: '#8A3BE0',
    ico: 'coins',
    cond: 'tricks landed',
    n: 10,
    isLive: true,
  },
  {
    id: 'week-one',
    // The streak counts qualifying *weeks*, not consecutive days (plan §1,
    // issue #10). Under the old name this record silently became a seven-*week*
    // sticker the day the rule changed, which is LESSONS §4 exactly. The name
    // now carries neither a number nor a unit, so neither a staff retune of `n`
    // nor a future change to what the streak counts can make it wrong again.
    name: 'Kept It Up',
    sport: null,
    hue: '#FFC23F',
    ico: 'flame',
    cond: 'weeks in a row',
    n: 4,
    isLive: true,
  },
  {
    id: 'month-on',
    // Was "30 Day Streak". Thirty weeks is most of a year; twelve is a season,
    // and it is the long one of the pair rather than an unreachable one.
    name: 'Still Rolling',
    sport: null,
    hue: '#E0392B',
    ico: 'crown',
    cond: 'weeks in a row',
    n: 12,
    isLive: true,
  },
  {
    id: 'first-clip',
    name: 'Caught On Cam',
    sport: null,
    hue: '#C46BFF',
    ico: 'cam',
    cond: 'Upload your first clip',
    // **Off the wall, not deleted** (plan §6.6, reversed by the owner
    // 2026-08-17). Its condition is a clip upload, and there is no upload any
    // more, so it cannot be earned by anybody — and a wall that shows a rider an
    // achievement telling them to do something the app cannot do is the same
    // false promise the rest of this PR removes. It is kept rather than dropped
    // because `t15b-video-links` is the obvious place to re-arm it ("add your
    // first video"), and deleting an achievement is the owner's call, not a
    // session's. Whether it comes back, and under what condition and copy, is
    // filed as an issue.
    isLive: false,
  },
  {
    id: 'challenger',
    name: 'Challenger',
    sport: null,
    hue: '#FF6B6B',
    ico: 'bolt',
    cond: 'Finish a challenge',
    isLive: true,
  },
  {
    id: 'crew-up',
    name: 'Crew Up',
    sport: null,
    hue: '#5BA8FF',
    ico: 'users',
    cond: 'Join or start a crew',
    isLive: true,
  },
  {
    id: 'gnarly',
    name: 'Gnarly',
    sport: null,
    hue: '#16140F',
    ico: 'skull',
    cond: 'difficulty 5 tricks landed',
    // Was a literal `>= 1` in the rule, the only threshold sticker staff could
    // not retune (issue #81). One is the shipped bar, so nothing moves today.
    n: 1,
    isLive: true,
  },
  {
    id: 'every-time',
    // The consistency axis. `SportStats.mastered` was computed and read by
    // nothing (issue #81), which left the sticker set with no achievement for
    // landing a trick *reliably* — the one shape that cannot function as a
    // dare, because it rewards repeating what a rider already lands rather than
    // attempting something new. Named after the app's own stage label
    // (`STAGES.every`, "Every time") rather than an invented word.
    name: 'Every Time',
    sport: null,
    hue: '#FF3D78',
    ico: 'star',
    cond: 'tricks you land every time',
    n: 3,
    isLive: true,
  },
  {
    id: 'both-feet',
    // Was "Both Feet". The rule is "two or more" and has been since T21, but
    // "both" is a two-sport word in a three-sport product (issue #82).
    name: 'Crossover',
    sport: null,
    hue: '#2EC4B6',
    ico: 'grid',
    cond: 'Land tricks on two different sports',
    isLive: true,
  },
  {
    id: 'hop-master',
    name: 'Hop Master',
    sport: 'scooter',
    hue: '#FF9F1C',
    ico: 'scoot',
    cond: 'Every time on the Bunny Hop',
    isLive: true,
  },
  {
    id: 'whip-club',
    name: 'Whip Club',
    sport: 'scooter',
    hue: '#246BFF',
    ico: 'star',
    cond: 'Land a Tailwhip',
    isLive: true,
  },
  {
    id: 'flat-out',
    name: 'Flat Out',
    sport: 'scooter',
    hue: '#2EC4B6',
    ico: 'grid',
    // Was "all of them", which un-earned itself the moment staff added a trick
    // to the category (issue #78). Seven is the size of scooter Flat today, so
    // the bar is unchanged — but it is now a count, which only ever goes up,
    // and staff can retune it.
    cond: 'Flat scooter tricks landed',
    n: 7,
    isLive: true,
  },
  {
    id: 'street-cred',
    name: 'Street Cred',
    sport: 'scooter',
    hue: '#FF5A1F',
    ico: 'map',
    cond: 'Street scooter tricks landed',
    n: 3,
    isLive: true,
  },
  {
    id: 'park-rat',
    name: 'Park Rat',
    sport: 'scooter',
    hue: '#3AC0FF',
    ico: 'home',
    cond: 'Park scooter tricks landed',
    n: 3,
    isLive: true,
  },
  {
    id: 'grind-time',
    name: 'Grind Time',
    sport: 'scooter',
    hue: '#9CE05B',
    ico: 'rail',
    cond: 'Land any scooter grind',
    isLive: true,
  },
  {
    id: 'upside',
    // **Retired, deliberately (issue #77).** It was the only sticker whose
    // condition named difficulty-5 inversions, in a product for 8–16 year olds
    // whose own coaching copy says "learn it into a foam pit or a resi ramp
    // first" (`backflip`) and "foam pit only until it's automatic"
    // (`frontflip`). A badge on the wall is a reason for a child to skip that
    // rung. `gnarly` is the acceptable version of the same recognition: any
    // difficulty-5 trick, no target named.
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
    id: 'ollie-up',
    // Was "Ollie Up", an invented pun (issue #82). "Dialled" is what a rider
    // actually says about a trick they land every time, which is the rule.
    name: 'Ollie Dialled',
    sport: 'skate',
    hue: '#FF9F1C',
    ico: 'scoot',
    cond: 'Every time on the Ollie',
    isLive: true,
  },
  {
    id: 'flip-club',
    // Was "Flip Club" — membership framing skate culture mocks, and "club"
    // collides with the app's own crew concept (issue #82).
    name: 'Kickflip',
    sport: 'skate',
    hue: '#246BFF',
    ico: 'rotate',
    cond: 'Land a Kickflip',
    isLive: true,
  },
  {
    id: 'flat-track',
    // Was "Flat Tracked", a pun on flat track — a motorcycle discipline
    // (issue #82). "Flatground" is the word skaters use for this category.
    name: 'Flatground',
    sport: 'skate',
    hue: '#2EC4B6',
    ico: 'grid',
    // A count, not "all of them" — same reason as `flat-out` (issue #78). Ten
    // is the size of skate Flat today, so the bar is unchanged.
    cond: 'Flat skate tricks landed',
    n: 10,
    isLive: true,
  },
  {
    id: 'ledge-rat',
    name: 'Ledge Rat',
    sport: 'skate',
    hue: '#FF5A1F',
    ico: 'rail',
    // Counted the whole `street` category, which includes `sk-gap`, "Stair
    // Set" — so the app badged stair counts, the classic escalation ladder in
    // skateboarding (issue #79). It now counts the seven named ledge and rail
    // tricks. Three of those are difficulty 3, so `n: 3` would have meant "the
    // three easy ones"; four is the honest rung.
    cond: 'ledge and rail tricks landed',
    n: 4,
    isLive: true,
  },
  {
    id: 'bowl-rider',
    // Was "Bowl Rider", which was simply wrong: skate's `park` category is
    // drop-in, rock to fakie, axle stall, blunt to fakie and hip transfer —
    // three of those is a quarter pipe, not a bowl (issue #82).
    name: 'Ramp Rider',
    sport: 'skate',
    hue: '#3AC0FF',
    ico: 'home',
    cond: 'Park skate tricks landed',
    // Two, not three: skate's park category has exactly two free tricks
    // (`sk-drop-in`, `sk-rock-to-fakie`), so a threshold of three missed the
    // free tier by a single trick and put the sticker behind the paywall by
    // accident rather than by decision.
    n: 2,
    isLive: true,
  },
  {
    id: 'coping-time',
    // Was "Coping Time". To any adult, teacher or teasing classmate the first
    // reading of "coping" is emotional coping, not the metal edge of a ramp
    // (issue #82) — the worst name in the app for a children's product.
    name: 'Axle Stall',
    sport: 'skate',
    hue: '#9CE05B',
    ico: 'star',
    cond: 'Land an Axle Stall',
    isLive: true,
  },
  {
    id: 'tre-deep',
    // Was "Tre Deep", which borrowed the `five-deep`/`ten-deep` pattern where
    // "deep" means a count, so it parsed as "three deep" (issue #82).
    name: 'Tre Flip',
    sport: 'skate',
    hue: '#FF3D78',
    ico: 'bolt',
    cond: 'Land a Tre Flip',
    isLive: true,
  },
] as const satisfies readonly Sticker[];

/** Every sticker id, as a union. Keeps the rule map exhaustive. */
export type StickerId = (typeof STICKERS)[number]['id'];
