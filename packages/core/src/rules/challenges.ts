import { CHALLENGES } from '../data/challenges';
import { STICKERS } from '../data/stickers';
import type { Challenge, ChallengeState, SportId, Sticker } from '../types';
import { riderToday, type RiderClock } from './streak';
import { compareDayKeys, isDayWithin } from './time';

/**
 * Weekly challenges.
 *
 * A challenge's state is **never stored** (plan §2.2): it is read off `starts`
 * and `ends` every time it is asked for. A stored state is a state that goes
 * stale at midnight in some timezone and needs a cron job to fix.
 *
 * Both dates are inclusive calendar days, and the comparison happens on the
 * rider's calendar day — a challenge that ends on Sunday ends when *their*
 * Sunday ends.
 */

/** `upcoming` before it starts, `live` between the dates, `past` after. */
export function challengeState(challenge: Challenge, clock: RiderClock = {}): ChallengeState {
  const today = riderToday(clock);
  if (today < challenge.starts) return 'upcoming';
  if (today > challenge.ends) return 'past';
  return 'live';
}

/** Is the log button allowed to do anything? Only inside the live window. */
export function canLogChallenge(challenge: Challenge, clock: RiderClock = {}): boolean {
  return challenge.isLive && challengeState(challenge, clock) === 'live';
}

/** Every live challenge for a sport, oldest week first. */
export function challengesFor(
  sport: SportId,
  challenges: readonly Challenge[] = CHALLENGES,
): Challenge[] {
  return challenges
    .filter((c) => c.isLive && c.sport === sport)
    .sort((a, b) => compareDayKeys(a.starts, b.starts));
}

/**
 * The challenge to put in front of a rider: the one running now, else the next
 * one scheduled, else the most recent finished one. Null only when the sport
 * has no challenges at all.
 */
export function liveChallenge(
  sport: SportId,
  clock: RiderClock = {},
  challenges: readonly Challenge[] = CHALLENGES,
): Challenge | null {
  const mine = challengesFor(sport, challenges);
  return (
    mine.find((c) => challengeState(c, clock) === 'live') ??
    mine.find((c) => challengeState(c, clock) === 'upcoming') ??
    mine[mine.length - 1] ??
    null
  );
}

/** Where a rider is against one challenge. */
export interface ChallengeProgress {
  readonly logged: number;
  readonly goal: number;
  /** 0–100, capped. */
  readonly pct: number;
  readonly complete: boolean;
}

/** A rider's progress against a challenge, from their log count. */
export function challengeProgress(challenge: Challenge, logged: number): ChallengeProgress {
  const capped = Math.max(0, Math.min(challenge.goal, logged));
  return {
    logged: capped,
    goal: challenge.goal,
    pct: challenge.goal > 0 ? Math.round((capped / challenge.goal) * 100) : 0,
    complete: logged >= challenge.goal,
  };
}

/**
 * Do two challenges for the same sport cover any of the same days?
 *
 * "One live challenge per sport" is a constraint SQLite cannot express, so the
 * challenge create/update hook is the constraint (plan §3) and this is the test
 * it applies. Different sports never collide.
 */
export function challengesOverlap(a: Challenge, b: Challenge): boolean {
  if (a.id === b.id || a.sport !== b.sport) return false;
  return a.starts <= b.ends && b.starts <= a.ends;
}

/**
 * The already-scheduled challenges a candidate would collide with. Empty means
 * the hook may accept the write.
 */
export function overlappingChallenges(
  candidate: Challenge,
  existing: readonly Challenge[] = CHALLENGES,
): Challenge[] {
  return existing.filter((c) => challengesOverlap(candidate, c));
}

/**
 * The date range as the card shows it: "10 to 16 Aug", or "28 Jul to 3 Aug"
 * when the week straddles two months.
 */
export function challengeRangeLabel(challenge: Challenge): string {
  const day = (key: string): number => Number(key.slice(8, 10));
  const month = (key: string): string =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });

  const sameMonth = challenge.starts.slice(0, 7) === challenge.ends.slice(0, 7);
  const from = sameMonth
    ? `${day(challenge.starts)}`
    : `${day(challenge.starts)} ${month(challenge.starts)}`;
  return `${from} to ${day(challenge.ends)} ${month(challenge.ends)}`;
}

/** Is a day inside this challenge's window? Exposed for the hook's date checks. */
export function isDayInChallenge(challenge: Challenge, day: string): boolean {
  return isDayWithin(day, challenge.starts, challenge.ends);
}

/**
 * The sticker a challenge's `reward` names, or `null` when it names none.
 *
 * Issue #76: every shipped challenge promised a sticker by name and not one of
 * those names was a sticker record, so the screen wrote a cheque the award flow
 * could not cash. The rewards now name `challenger`, and this is the function
 * that has to keep agreeing with that — it is called by the challenge screen,
 * which only prints a reward it can resolve, and by the test that asserts every
 * challenge in `CHALLENGES` resolves. Rename a sticker and the test goes red,
 * which is the whole point (LESSONS §4: when a name changes, sweep what quotes
 * it).
 *
 * The match is on the sticker's **name**, because that is what the reward copy
 * carries — with a trailing "sticker" allowed, since "Challenger sticker" is
 * how a rider reads it and "Challenger" is what the record is called.
 */
export function challengeRewardSticker(
  challenge: Pick<Challenge, 'reward'>,
  stickers: readonly Sticker[] = STICKERS,
): Sticker | null {
  const wanted = challenge.reward
    .trim()
    .replace(/\s+sticker$/i, '')
    .toLowerCase();
  if (!wanted) return null;
  return stickers.find((s) => s.name.toLowerCase() === wanted) ?? null;
}
