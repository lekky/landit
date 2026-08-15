import { STICKERS, type StickerId } from '../data/stickers';
import type { RiderStats, SportId, SportStats, Sticker, StickerRule } from '../types';
import { isLandedStage } from './tricks';

/**
 * The threshold a rule tests against, read from the sticker **record** so staff
 * can retune it from the admin portal without a deploy (plan §2.2).
 *
 * A record with no threshold cannot satisfy a rule that needs one: the sticker
 * simply stays locked. Failing closed is the only safe direction — the
 * alternative is awarding a milestone nobody reached, and stickers are the one
 * thing in this product that must always be earned.
 */
function threshold(sticker: Sticker): number {
  return sticker.n ?? Number.POSITIVE_INFINITY;
}

/** Has the rider landed any one of these tricks? */
function landedAny(scope: SportStats, ids: readonly string[]): boolean {
  return ids.some((id) => isLandedStage(scope.byId[id]));
}

/**
 * Every sticker's condition, as code.
 *
 * The split is deliberate (plan §3): the sticker *record* carries the editable
 * parts — name, colour, icon, copy, threshold, live flag — and lives in the
 * database, while the condition itself lives here where it can be reviewed and
 * tested. Staff can retune a threshold; they cannot invent a new rule, and a
 * client cannot forge one.
 *
 * The map is keyed by `StickerId`, so a sticker added to the canonical data
 * without a rule here is a type error rather than a sticker nobody can ever
 * earn.
 */
export const STICKER_RULES = {
  /* --- combined: judged against the rider's global stats --- */
  'first-land': (s) => s.landed >= 1,
  'five-deep': (s, x) => s.landed >= threshold(x),
  'ten-deep': (s, x) => s.landed >= threshold(x),
  'week-one': (s, x) => s.streak >= threshold(x),
  'month-on': (s, x) => s.streak >= threshold(x),
  'first-clip': (s) => s.clips >= 1,
  challenger: (s) => s.challenges >= 1,
  'crew-up': (s) => s.crew,
  gnarly: (s) => s.hardLanded >= 1,
  'both-feet': (s) => s.bothSports,

  /* --- scooter: judged against scooter stats alone --- */
  'hop-master': (s) => s.byId['bunny-hop'] === 'every',
  'whip-club': (s) => landedAny(s, ['tailwhip']),
  'flat-out': (s) => s.catDone.flat,
  'street-cred': (s, x) => s.catCount.street >= threshold(x),
  'park-rat': (s, x) => s.catCount.park >= threshold(x),
  'grind-time': (s) => landedAny(s, ['50-50', 'feeble', 'smith', 'icepick']),
  upside: (s) => landedAny(s, ['backflip', 'frontflip', 'flair']),

  /* --- skate: judged against skate stats alone --- */
  'ollie-up': (s) => s.byId['sk-ollie'] === 'every',
  'flip-club': (s) => landedAny(s, ['sk-kickflip']),
  'flat-track': (s) => s.catDone.flat,
  'ledge-rat': (s, x) => s.catCount.street >= threshold(x),
  'bowl-rider': (s, x) => s.catCount.park >= threshold(x),
  'coping-time': (s) => landedAny(s, ['sk-axle-stall']),
  'tre-deep': (s) => landedAny(s, ['sk-tre-flip']),
} satisfies Record<StickerId, StickerRule>;

/** Look up the rule for a sticker, if one exists. */
export function stickerRule(id: string): StickerRule | undefined {
  const rules: Readonly<Record<string, StickerRule>> = STICKER_RULES;
  return rules[id];
}

/**
 * The stickers on this rider's wall: live ones, minus the sport stickers for
 * sports they do not ride. Shared stickers (`sport: null`) always show.
 */
export function stickersFor(
  sports: readonly SportId[],
  stickers: readonly Sticker[] = STICKERS,
): Sticker[] {
  return stickers.filter((x) => x.isLive && (!x.sport || sports.includes(x.sport)));
}

/**
 * Which scope a sticker is judged against: a sport sticker sees that sport's
 * stats alone, a shared sticker sees the rider's combined stats (plan §2.2).
 */
export function stickerScope(stats: RiderStats, sticker: Sticker): SportStats {
  return sticker.sport ? stats.bySport[sticker.sport] : stats.global;
}

/**
 * Has this rider earned this sticker, right now?
 *
 * A sticker with no rule in `STICKER_RULES` is never earned — staff can add a
 * record from the admin portal, but it stays locked until a rule ships.
 */
export function evaluateSticker(stats: RiderStats, sticker: Sticker): boolean {
  const rule = stickerRule(sticker.id);
  if (!rule) return false;
  return rule(stickerScope(stats, sticker), sticker);
}

/**
 * Every sticker this rider currently qualifies for, in canonical order.
 *
 * This is the *definition*. The place it is enforced is the PocketBase hook on
 * `trick_progress` writes, which re-evaluates against fresh stats and creates
 * the `rider_stickers` records itself — clients cannot create them at all
 * (plan §3). The client calls this only so the wall updates instantly.
 */
export function earnedStickerIds(
  stats: RiderStats,
  stickers: readonly Sticker[] = STICKERS,
): string[] {
  return stickersFor(stats.sports, stickers)
    .filter((sticker) => evaluateSticker(stats, sticker))
    .map((sticker) => sticker.id);
}

/**
 * Stickers earned since the last evaluation — the ones a toast should announce.
 * Pass the ids already recorded against the rider; a sticker is never
 * re-announced (plan §3, `rider_stickers.seen_at`).
 */
export function newlyEarnedStickerIds(
  stats: RiderStats,
  alreadyEarned: readonly string[],
  stickers: readonly Sticker[] = STICKERS,
): string[] {
  return earnedStickerIds(stats, stickers).filter((id) => !alreadyEarned.includes(id));
}

/**
 * The sticker's condition as one line of copy, with the editable threshold
 * folded in: "5 tricks landed", or just "Log your first trick" when it has no
 * threshold.
 */
export function stickerCondition(sticker: Sticker): string {
  return sticker.n !== undefined ? `${sticker.n} ${sticker.cond}` : sticker.cond;
}
