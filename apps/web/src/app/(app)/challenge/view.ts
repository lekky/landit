import {
  SPORTS,
  challengeProgress,
  challengeRangeLabel,
  challengeRewardSticker,
  challengeState,
  challengesFor,
  liveChallenge,
  type Challenge,
  type ChallengeState,
  type PlanId,
  type SportId,
  type Sticker,
} from '@landit/core';

/**
 * The weekly challenge screen, computed on the server (screenshot 17,
 * `landit-screens-b.jsx`'s `Challenge`).
 *
 * Everything the screen draws is a plain string or number by the time it
 * reaches the browser, for the same reason Progress does it (T9): the sport
 * tabs are client state, so the component renders on both sides of a hydration
 * boundary, and `challengeRangeLabel` names its months through ICU. A month
 * name produced twice by two runtimes is a mismatch that throws the tree away
 * rather than warning about it (LESSONS §3a). Producing it once, here, on the
 * server, is the fix — the client never recomputes a label it was handed.
 *
 * **State is derived, never stored** (plan §2.2). `challengeState` reads it off
 * `starts`/`ends` on the *rider's* calendar day every time it is asked, so
 * nothing here goes stale at midnight and no cron job exists to fix it.
 *
 * **Nothing here is the gate.** `canLog` decides whether to draw an enabled
 * button; the refusal lives in `pocketbase/hooks/40_challenges.pb.js` and is
 * proven over HTTP in `pocketbase/tests/challenge-log-window.test.ts`. A
 * disabled attribute is a suggestion.
 */

/** One past week's card. */
export interface PastWeekView {
  readonly id: string;
  readonly week: string;
  readonly range: string;
  readonly title: string;
  /**
   * How the week went, or `null` when the rider's plan does not keep history.
   *
   * Null rather than "present but blurred": a blur that can be lifted in dev
   * tools is not a limit, it is a costume. What the paid tiers buy is the
   * record of how past weeks went, so a free rider is not sent it.
   */
  readonly result: { readonly label: string; readonly color: string } | null;
}

/** One upcoming week's card. */
export interface UpcomingWeekView {
  readonly id: string;
  readonly week: string;
  readonly range: string;
  readonly title: string;
  readonly blurb: string;
  readonly hue: string;
}

/** The headline challenge: the one running, else the next, else the last one. */
export interface CurrentChallengeView {
  readonly id: string;
  readonly week: string;
  readonly title: string;
  readonly blurb: string;
  readonly hue: string;
  readonly range: string;
  readonly state: ChallengeState;
  readonly stateLabel: string;
  readonly goal: number;
  readonly logged: number;
  readonly pct: number;
  readonly complete: boolean;
  /** The label on the log button, whatever state it is in. */
  readonly buttonLabel: string;
  /** Is the log button live? The server-side gate is the real one. */
  readonly canLog: boolean;
  /**
   * "Challenger sticker", or `null` when the reward names nothing real.
   *
   * Issue #76: the shipped rewards named ten stickers that did not exist, so
   * the screen promised what the award flow could never grant. A reward that
   * does not resolve to a live sticker is not printed at all — silence beats a
   * promise nobody can keep.
   */
  readonly reward: string | null;
  /** Set once the rider already holds the reward, so it stops being a dangle. */
  readonly rewardHeld: boolean;
}

/** One sport's whole screen. */
export interface ChallengeSportView {
  readonly sport: SportId;
  readonly sportLabel: string;
  readonly current: CurrentChallengeView | null;
  readonly upcoming: readonly UpcomingWeekView[];
  readonly past: readonly PastWeekView[];
  /** Whether there is any history at all — the blur needs something to cover. */
  readonly hasHistory: boolean;
}

export interface ChallengeViewInput {
  readonly sports: readonly SportId[];
  readonly challenges: readonly Challenge[];
  /** Logs per challenge, keyed by the challenge's slug. */
  readonly logged: Readonly<Record<string, number>>;
  readonly plan: PlanId;
  /** Does this rider's plan keep challenge history? Read off the plan record. */
  readonly keepsHistory: boolean;
  readonly clock: { readonly timezone: string };
  /** Live sticker records, so the reward resolves against what staff shipped. */
  readonly stickers: readonly Sticker[];
  /** Sticker ids already on the rider's wall. */
  readonly earnedStickerIds: readonly string[];
}

export function buildChallengeView(input: ChallengeViewInput): ChallengeSportView[] {
  return input.sports.map((sport) => buildOne(sport, input));
}

function buildOne(sport: SportId, input: ChallengeViewInput): ChallengeSportView {
  const { clock, logged } = input;
  const weeks = challengesFor(sport, input.challenges);
  const current = liveChallenge(sport, clock, input.challenges);

  const upcoming: UpcomingWeekView[] = weeks
    .filter((c) => challengeState(c, clock) === 'upcoming' && c.id !== current?.id)
    .map((c) => ({
      id: c.id,
      week: c.week,
      range: challengeRangeLabel(c),
      title: c.title,
      blurb: c.blurb,
      hue: c.hue,
    }));

  // Newest first: the week that just finished is the one a rider looks for.
  const finished = weeks.filter((c) => challengeState(c, clock) === 'past').reverse();

  const past: PastWeekView[] = finished.map((c) => ({
    id: c.id,
    week: c.week,
    range: challengeRangeLabel(c),
    title: c.title,
    result: input.keepsHistory ? resultOf(c, logged[c.id] ?? 0) : null,
  }));

  return {
    sport,
    sportLabel: SPORTS[sport].label,
    current: current ? currentView(current, input) : null,
    upcoming,
    past,
    hasHistory: finished.length > 0,
  };
}

function resultOf(challenge: Challenge, got: number): { label: string; color: string } {
  if (got >= challenge.goal) return { label: 'Completed', color: 'var(--green)' };
  if (got > 0) return { label: `${got} of ${challenge.goal}`, color: '#FF9F1C' };
  // "Missed" is the prototype's word and it stays: a week that did not happen
  // is a fact, and the screen says it once, in the past tense, without a nudge
  // attached (plan §6.4, standard 13).
  return { label: 'Missed', color: 'var(--ink-3)' };
}

function currentView(challenge: Challenge, input: ChallengeViewInput): CurrentChallengeView {
  const state = challengeState(challenge, input.clock);
  const progress = challengeProgress(challenge, input.logged[challenge.id] ?? 0);
  const range = challengeRangeLabel(challenge);
  const sticker = challengeRewardSticker(challenge, input.stickers);
  const live = state === 'live' && challenge.isLive;

  return {
    id: challenge.id,
    week: challenge.week,
    title: challenge.title,
    blurb: challenge.blurb,
    hue: challenge.hue,
    range,
    state,
    stateLabel: state === 'live' ? 'Live now' : state === 'upcoming' ? 'Starts soon' : 'Finished',
    goal: progress.goal,
    logged: progress.logged,
    pct: progress.pct,
    complete: progress.complete,
    buttonLabel: buttonLabel(challenge, state, progress.complete, range),
    canLog: live && !progress.complete,
    reward: sticker && sticker.isLive ? `${sticker.name} sticker` : null,
    rewardHeld: sticker ? input.earnedStickerIds.includes(sticker.id) : false,
  };
}

function buttonLabel(
  challenge: Challenge,
  state: ChallengeState,
  complete: boolean,
  range: string,
): string {
  if (state === 'upcoming') return `Opens ${range.split(' to ')[0]}`;
  if (state === 'past') return 'This week is over';
  if (complete) return '✓ Done this week';
  return challenge.verb;
}
