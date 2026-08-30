import { STICKERS, type StickerId } from '../data/stickers';
import type { AwardKind, RiderStats, SportId, SportStats, Sticker, StickerRule } from '../types';
import { isLandedStage } from './tricks';

/**
 * The threshold a rule tests against, read from the sticker **record** so staff
 * can retune it from the admin portal without a deploy (plan §2.2).
 *
 * `fallback` is the kind's shipped bar (`KIND_DEFAULT_N`): a record that ships
 * without `n` means "the coded default", exactly as the legacy hook rules'
 * `(n || 5)` always has. Kinds with no sensible unit default fall back to
 * `Infinity`, so clearing `n` on one of those locks the sticker rather than
 * awarding a milestone nobody reached — failing closed, the only safe
 * direction for the one thing in this product that must always be earned.
 */
function threshold(sticker: Sticker, fallback = Number.POSITIVE_INFINITY): number {
  return sticker.n ?? fallback;
}

/**
 * The launch-window cutoff for the `day-one` founder award: one month after
 * the site went live on 2026-08-17. A constant, deliberately — the window is
 * historical fact, not a tunable.
 */
export const FOUNDER_JOINED_BY = '2026-09-17';

const count = (value: number | undefined): number => value ?? 0;

/**
 * Shipped bars for kinds whose record may ship without `n` — the "first one"
 * awards, where a `1` on the record would render as "1 Land your first trick"
 * in the condition copy. Mirrored by the PocketBase hook.
 */
export const KIND_DEFAULT_N: Partial<Record<AwardKind, number>> = {
  'landed-count': 1,
  'mastered-count': 1,
  'hard-mastered': 1,
  challenges: 1,
  clips: 1,
  'spots-approved': 1,
  'events-going': 1,
  'account-age': 365,
};

/**
 * The award-era rules (T24), one per `kind` — the shape is code, the
 * parameters (`n`, `trick`, `cat`) are the record's. Every kind is monotonic
 * in the rider's own riding (issue #78). Kinds that read a stat only the
 * server computes (`spotsApproved`, `planPaid`, …) see `undefined` on the
 * client and read it as zero/false: the client under-promises, never
 * over-promises, and the wall is drawn from `rider_stickers` regardless.
 *
 * `comeback` is transition-based — "rode again after a two-month gap" is a
 * fact about two writes, not about current stats — so its generic rule is
 * never-true and the award hook grants it at the moment of the ride.
 */
export const KIND_RULES: Record<AwardKind, StickerRule> = {
  trick: (s, x) => Boolean(x.trick) && isLandedStage(s.byId[x.trick as string]),
  'landed-count': (s, x) => s.landed >= threshold(x, KIND_DEFAULT_N['landed-count']),
  'sport-landed-count': (s, x) => count(s.maxSportLanded) >= threshold(x),
  'mastered-count': (s, x) => s.mastered >= threshold(x, KIND_DEFAULT_N['mastered-count']),
  'hard-mastered': (s, x) => count(s.hardMastered) >= threshold(x, KIND_DEFAULT_N['hard-mastered']),
  'sport-cat-count': (s, x) =>
    Boolean(x.cat) &&
    count(s.maxSportCatCount?.[x.cat as NonNullable<Sticker['cat']>]) >= threshold(x),
  streak: (s, x) => s.streak >= threshold(x),
  challenges: (s, x) => s.challenges >= threshold(x, KIND_DEFAULT_N.challenges),
  clips: (s, x) => s.clips >= threshold(x, KIND_DEFAULT_N.clips),
  'spots-approved': (s, x) =>
    count(s.spotsApproved) >= threshold(x, KIND_DEFAULT_N['spots-approved']),
  'events-going': (s, x) => count(s.eventsGoing) >= threshold(x, KIND_DEFAULT_N['events-going']),
  crew: (s) => s.crew,
  'crew-owned': (s, x) => count(s.crewOwnedSize) >= threshold(x),
  'sports-landed': (s, x) => count(s.sportsLanded) >= threshold(x),
  'sport-cats-landed': (s, x) => count(s.maxSportCatsLanded) >= threshold(x),
  'profile-complete': (s) => s.profileComplete === true,
  'account-age': (s, x) => count(s.accountAgeDays) >= threshold(x, KIND_DEFAULT_N['account-age']),
  founder: (s) => s.isFounder === true,
  'stage-drop': (s) => s.stageDropped === true,
  comeback: () => false,
  supporter: (s) => s.planPaid === true,
};

/**
 * The retired legacy stickers' conditions, as code — kept although every one
 * of them is `isLive: false`, because a rule that exists and a record that is
 * retired are two independent locks (the third being the hook, which never
 * evaluates a retired record). `upside` is never-true on top of that: switching
 * the record back on from the admin portal still cannot badge a backflip
 * (issue #77).
 *
 * The fifteen legacy stickers whose conditions matched an award exactly are
 * not here: the migration renamed their records onto the award slugs, and the
 * `kind` on those records is what judges them now.
 */
export const STICKER_RULES = {
  'five-deep': (s, x) => s.landed >= threshold(x),
  gnarly: (s, x) => s.hardLanded >= threshold(x),
  'both-feet': (s) => s.bothSports,
  'street-cred': (s, x) => s.catCount.street >= threshold(x),
  'park-rat': (s, x) => s.catCount.park >= threshold(x),
  'grind-time': (s) =>
    ['50-50', 'feeble', 'smith', 'icepick'].some((id) => isLandedStage(s.byId[id])),
  upside: () => false,
  'flat-track': (s, x) => s.catCount.flat >= threshold(x),
  'ledge-rat': (s, x) =>
    [
      'sk-50-50',
      'sk-boardslide',
      'sk-noseslide',
      'sk-5-0',
      'sk-nosegrind',
      'sk-crooked',
      'sk-tailslide',
    ].filter((id) => isLandedStage(s.byId[id])).length >= threshold(x),
  'bowl-rider': (s, x) => s.catCount.park >= threshold(x),
} satisfies Partial<Record<StickerId, StickerRule>>;

/** Look up the slug-keyed legacy rule for a sticker, if one exists. */
export function stickerRule(id: string): StickerRule | undefined {
  const rules: Readonly<Record<string, StickerRule>> = STICKER_RULES;
  return rules[id];
}

/**
 * Resolve the rule that judges a sticker: the record's `kind` when it carries
 * one, else the slug-keyed legacy map. Kind first, deliberately — it is what
 * lets a migrated record (`flat-out`) change meaning by data alone, and it is
 * the same precedence the PocketBase hook applies.
 */
export function resolveStickerRule(sticker: Sticker): StickerRule | undefined {
  if (sticker.kind) {
    const rules: Readonly<Partial<Record<string, StickerRule>>> = KIND_RULES;
    return rules[sticker.kind];
  }
  return stickerRule(sticker.id);
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
 * A sticker that resolves no rule is never earned — staff can add a record
 * from the admin portal, but it stays locked until a rule ships.
 */
export function evaluateSticker(stats: RiderStats, sticker: Sticker): boolean {
  const rule = resolveStickerRule(sticker);
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
