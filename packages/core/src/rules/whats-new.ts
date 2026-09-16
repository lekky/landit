import type { DayKey, Instant } from '../types';
import { addDays, compareDayKeys, isDayKey, weekStart, weekdayName } from './time';
import {
  currentWeeklyStreak,
  riderToday,
  weeklyRideCount,
  WEEKLY_RIDE_TARGET,
  type WeeklyStreakOptions,
  type WeeklyStreakState,
} from './streak';

/**
 * What's new — the rider's own news, derived rather than stored (rethink §3.6).
 *
 * This is the whole vocabulary of the **You** tab, and it is written the same
 * way `crewActivityLine` is written next door and for the same reason (plan
 * §6.1): every sentence here is one *the product* wrote from catalogue facts —
 * a sticker's name, an event's name, a challenge's title, a crew's name, a
 * rider's display name. Nothing a rider typed reaches this file, so there is no
 * shape in which What's new could become a place riders talk to each other.
 *
 * Three things follow from "derived, not stored", and each one is a decision:
 *
 * - **Nothing is written per item.** There is no notifications collection and no
 *   read flag per line. The only state is one date on the rider —
 *   `users.whats_new_seen_at` — and the unseen count is "lines newer than that"
 *   (`unseenWhatsNew`). A rider cannot accumulate a backlog of rows nobody will
 *   ever read, and there is nothing here for an engagement metric to grow into.
 * - **The order is time and nothing else.** `sortWhatsNew` is a stable sort by
 *   `at` with the id breaking ties, exactly as `sortCrewActivity` is. Plan §6.1:
 *   no algorithmic feed. There is nowhere in this file for a score to get a vote.
 * - **Every line is windowed.** Stickers and crew joins look back
 *   `WHATS_NEW_LOOKBACK_DAYS`; an event appears `WHATS_NEW_EVENT_DAYS` before it
 *   happens and a challenge deadline `WHATS_NEW_CHALLENGE_DAYS` before it closes.
 *   A screen called "What's new" that lists a sticker earned in March is a
 *   history page with the wrong title.
 *
 * **Two tenses, and `ahead` is which.** A sticker, a banked week and a crew join
 * are things that *happened*, and their `at` is when. An event and a challenge
 * deadline are things that are *coming*, and they have no "when it happened" to
 * carry — so they are dated to **the moment the line started being true**: the
 * event's date minus seven days, the challenge's end minus three. That is what
 * makes the unseen count coherent across both kinds: a forthcoming line arrives
 * once, counts as unseen once, and stops counting when the rider has read it.
 * The caller reads `ahead` to decide what the row's `.lab` says, because "6 days
 * ago" beside "Corby Jam is Saturday" would be a true timestamp describing the
 * wrong thing.
 */

/* ------------------------------------------------------------------ windows -- */

/**
 * How far back a thing that happened may be and still be news.
 *
 * A tunable default rather than a deliberated number: the spec names a window
 * for events and for the challenge deadline and is silent on stickers and crew
 * joins, so this is the smallest choice that is still useful. Thirty days means
 * a rider who opens the app once a month still meets the stickers they earned;
 * it is short enough that the list is what has happened lately rather than a
 * second copy of the stickers screen.
 */
export const WHATS_NEW_LOOKBACK_DAYS = 30;

/** How far ahead an event the rider said yes to appears (rethink §3.6). */
export const WHATS_NEW_EVENT_DAYS = 7;

/** How close a live challenge's deadline has to be before it is news (§3.6). */
export const WHATS_NEW_CHALLENGE_DAYS = 3;

/**
 * The most lines the derived feed will ever produce.
 *
 * Not a product rule — a floor under the page. Every source is already windowed
 * and a rider cannot create most of these rows at will, so reaching fifty means
 * something upstream is wrong, and a page that renders four thousand rows is a
 * worse way to find out than a list that stops.
 */
export const WHATS_NEW_MAX_LINES = 50;

/* -------------------------------------------------------------------- lines -- */

export type WhatsNewKind = 'sticker' | 'event' | 'challenge' | 'week' | 'join';

export interface WhatsNewLine {
  /** Stable across renders, so React and the unseen count agree about a line. */
  readonly id: string;
  readonly kind: WhatsNewKind;
  /** ISO instant. The list is chronological and nothing else. */
  readonly at: string;
  /** The sentence, written here. Never text a rider typed (plan §6.1). */
  readonly line: string;
  /**
   * True for a line about something that has not happened yet, whose `at` is
   * when the line started being true rather than when anything occurred.
   */
  readonly ahead: boolean;
  /** Set on a crew join, for the row's avatar. The crew board already shows both. */
  readonly riderName?: string;
  readonly avatarKey?: string;
  /** A sticker's colour, for the row's disc. A catalogue fact. */
  readonly hue?: string;
}

/* ------------------------------------------------------------------- inputs -- */

export interface WhatsNewSticker {
  readonly id: string;
  /** The sticker's catalogue name — "First Fifty", not anything a rider chose. */
  readonly name: string;
  readonly hue?: string;
  readonly earnedAt: Instant;
}

export interface WhatsNewEvent {
  readonly id: string;
  /** The event's catalogue name, as staff entered it. */
  readonly name: string;
  readonly date: DayKey;
}

export interface WhatsNewChallenge {
  readonly id: string;
  readonly title: string;
  readonly ends: DayKey;
  readonly goal: number;
  /** How many the rider has logged against it. */
  readonly logged: number;
}

export interface WhatsNewJoin {
  readonly id: string;
  /** The crew's name, as its owner set it — already on the rider's own screen. */
  readonly crewName: string;
  /** The joiner's display name, from the crew board (plan §3 guarantee 1). */
  readonly riderName: string;
  readonly avatarKey?: string;
  readonly joinedAt: Instant;
}

export interface WhatsNewInputs {
  readonly stickers?: readonly WhatsNewSticker[];
  /** Every event the rider said yes to. Windowed here, not by the caller. */
  readonly events?: readonly WhatsNewEvent[];
  /** Every challenge the rider could be counted against. Windowed here. */
  readonly challenges?: readonly WhatsNewChallenge[];
  readonly joins?: readonly WhatsNewJoin[];
  /** The rider's weekly-streak tuple, for the banked-week line. */
  readonly streak?: WeeklyStreakState | null;
}

/* ------------------------------------------------------------------ helpers -- */

/**
 * An instant as an ISO string, whatever the caller held.
 *
 * A day key stays a day and becomes midnight UTC of it, which is the honest
 * reading of a value that never carried a clock. PocketBase's own stamps arrive
 * as `2026-09-17 10:11:12.345Z`, which `Date` accepts.
 */
function instantIso(value: Instant): string | null {
  if (isDayKey(value)) return `${value}T00:00:00.000Z`;
  const at = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  return at.toISOString();
}

/** Midnight UTC on a day, for a line dated to the day it started being true. */
function dayIso(day: DayKey): string {
  return `${day}T00:00:00.000Z`;
}

/** "today", "tomorrow", or the weekday — how a near date is said out loud. */
function nearDayWords(day: DayKey, today: DayKey): string {
  if (day === today) return 'today';
  if (day === addDays(today, 1)) return 'tomorrow';
  return weekdayName(day);
}

/* ------------------------------------------------------------------ sorting -- */

/**
 * Newest first, with the id breaking a tie, so the same input always produces
 * the same order. The whole of the ranking (plan §6.1).
 */
export function sortWhatsNew(lines: readonly WhatsNewLine[]): WhatsNewLine[] {
  return [...lines].sort((a, b) =>
    a.at === b.at ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.at < b.at ? 1 : -1,
  );
}

/* ---------------------------------------------------------------- sentences -- */

/** "You earned the First Fifty sticker." */
export function stickerEarnedLine(name: string): string {
  const trimmed = String(name ?? '').trim();
  return trimmed ? `You earned the ${trimmed} sticker.` : 'You earned a sticker.';
}

/** "Corby Jam is Saturday. You said you’re going." */
export function eventAheadLine(name: string, date: DayKey, today: DayKey): string {
  const trimmed = String(name ?? '').trim() || 'An event';
  return `${trimmed} is ${nearDayWords(date, today)}. You said you’re going.`;
}

/** "Switch week ends Sunday. 1 of 3 logged." */
export function challengeEndingLine(
  title: string,
  ends: DayKey,
  today: DayKey,
  logged: number,
  goal: number,
): string {
  const trimmed = String(title ?? '').trim() || 'This week’s challenge';
  const done = Math.max(0, Math.min(Math.floor(goal), Math.floor(logged)));
  return `${trimmed} ends ${nearDayWords(ends, today)}. ${done} of ${Math.floor(goal)} logged.`;
}

/** "Week 5 banked." */
export function weekBankedLine(weeks: number): string {
  return `Week ${Math.max(1, Math.floor(weeks))} banked.`;
}

/**
 * "Leo joined Ramp Rats."
 *
 * **Not "with your code"**, which is what rethink §3.6 sketches. `crew_members`
 * records who joined, which crew and when, and *not* which invite brought them
 * — so attributing a join to the reader's own code would be a guess dressed as
 * a fact, and a crew with two members minting invites would tell both of them
 * it was theirs. The join is news to every member of an invite-only crew
 * whoever's code it was, which is what this sentence says.
 */
export function crewJoinLine(riderName: string, crewName: string): string {
  const who = String(riderName ?? '').trim() || 'A rider';
  const crew = String(crewName ?? '').trim() || 'your crew';
  return `${who} joined ${crew}.`;
}

/* ------------------------------------------------------------------ the feed -- */

/**
 * The You tab, newest first.
 *
 * Every window is applied here rather than by the caller, so the loader reads
 * whatever it can read cheaply and this decides what counts as news. The one
 * thing the caller must get right is that it only passes rows the rider is
 * allowed to see — which is not a check this file could make, and is the API
 * rules' job (plan §3).
 */
export function whatsNewLines(
  inputs: WhatsNewInputs,
  options: WeeklyStreakOptions = {},
): WhatsNewLine[] {
  const today = riderToday(options);
  const lines: WhatsNewLine[] = [];

  const since = addDays(today, -WHATS_NEW_LOOKBACK_DAYS);
  const withinLookback = (iso: string): boolean => compareDayKeys(iso.slice(0, 10), since) >= 0;

  for (const sticker of inputs.stickers ?? []) {
    const at = instantIso(sticker.earnedAt);
    if (!at || !withinLookback(at)) continue;
    lines.push({
      id: `sticker:${sticker.id}`,
      kind: 'sticker',
      at,
      line: stickerEarnedLine(sticker.name),
      ahead: false,
      ...(sticker.hue ? { hue: sticker.hue } : {}),
    });
  }

  const eventHorizon = addDays(today, WHATS_NEW_EVENT_DAYS);
  for (const event of inputs.events ?? []) {
    if (!isDayKey(event.date)) continue;
    // Today counts and anything past does not: an event a rider went to
    // yesterday is not news about what is coming.
    if (compareDayKeys(event.date, today) < 0) continue;
    if (compareDayKeys(event.date, eventHorizon) > 0) continue;
    lines.push({
      id: `event:${event.id}`,
      kind: 'event',
      at: dayIso(addDays(event.date, -WHATS_NEW_EVENT_DAYS)),
      line: eventAheadLine(event.name, event.date, today),
      ahead: true,
    });
  }

  const challengeHorizon = addDays(today, WHATS_NEW_CHALLENGE_DAYS);
  for (const challenge of inputs.challenges ?? []) {
    if (!isDayKey(challenge.ends)) continue;
    if (compareDayKeys(challenge.ends, today) < 0) continue;
    if (compareDayKeys(challenge.ends, challengeHorizon) > 0) continue;
    lines.push({
      id: `challenge:${challenge.id}`,
      kind: 'challenge',
      at: dayIso(addDays(challenge.ends, -WHATS_NEW_CHALLENGE_DAYS)),
      line: challengeEndingLine(
        challenge.title,
        challenge.ends,
        today,
        challenge.logged,
        challenge.goal,
      ),
      ahead: true,
    });
  }

  const banked = bankedWeekLine(inputs.streak ?? null, options);
  if (banked) lines.push(banked);

  for (const join of inputs.joins ?? []) {
    const at = instantIso(join.joinedAt);
    if (!at || !withinLookback(at)) continue;
    lines.push({
      id: `join:${join.id}`,
      kind: 'join',
      at,
      line: crewJoinLine(join.riderName, join.crewName),
      ahead: false,
      riderName: join.riderName,
      ...(join.avatarKey ? { avatarKey: join.avatarKey } : {}),
    });
  }

  return sortWhatsNew(lines).slice(0, WHATS_NEW_MAX_LINES);
}

/**
 * "Week 5 banked.", **only while the tuple can say when it banked**.
 *
 * The weekly streak stores a counter and two day keys (`WeeklyStreakState`); it
 * does not store the moment a week qualified. That is knowable from the tuple in
 * exactly one state: the week containing today has qualified
 * (`lastQualifyingWeek` is this week's Monday) *and* `ridesThisWeek` is still
 * equal to the target — which means the most recent ride is the ride that banked
 * it, and `lastRide` is its date. Ride a third time and that is gone.
 *
 * The two alternatives were both worse, and this is the record of why:
 *
 * - **Date it to the week's Monday.** True but vague, and wrong in a list sorted
 *   by time: a week banked on Saturday would file itself five days earlier and,
 *   worse, land *before* a `whats_new_seen_at` set on the Wednesday — so the one
 *   line a rider most wants a badge for would never produce one.
 * - **Date it to the latest ride, always.** Then every ride after the target
 *   re-dates the banking, throws the line back to the top of the list and marks
 *   it unseen again — telling a rider the same week banked three times. A false
 *   novelty is a worse lie than a missing line.
 *
 * So the line appears when the week banks, stays until the rider rides again,
 * and is dropped rather than dated to a day it did not happen on. Recorded in
 * `docs/app-shell-rethink.md` §3.6, which asked for exactly this judgement.
 */
function bankedWeekLine(
  state: WeeklyStreakState | null,
  options: WeeklyStreakOptions,
): WhatsNewLine | null {
  if (!state || state.lastRide == null) return null;

  const thisWeek = weekStart(riderToday(options));
  if (state.lastQualifyingWeek !== thisWeek) return null;

  const target = Math.max(1, Math.floor(options.target ?? WEEKLY_RIDE_TARGET));
  if (weeklyRideCount(state, options) !== target) return null;

  const at = instantIso(state.lastRide);
  if (!at) return null;

  const weeks = currentWeeklyStreak(state, options);
  if (weeks <= 0) return null;

  return {
    id: `week:${thisWeek}`,
    kind: 'week',
    at,
    line: weekBankedLine(weeks),
    ahead: false,
  };
}

/* --------------------------------------------------------------- unseen count -- */

/**
 * How many lines are newer than the rider last looked.
 *
 * `seenAt` is `users.whats_new_seen_at`, and an empty one — a rider who has
 * never opened the panel — makes everything unseen, which is the honest answer
 * rather than a convenient zero.
 *
 * A line dated exactly `seenAt` is **seen**: "mark all read" stamps the moment
 * it ran, and a line written in the same millisecond was on the screen being
 * read. Erring the other way would leave a badge nothing could clear.
 */
export function unseenWhatsNew(
  lines: readonly WhatsNewLine[],
  seenAt: Instant | null | undefined,
): number {
  if (seenAt == null || seenAt === '') return lines.length;
  const seen = instantIso(seenAt);
  if (!seen) return lines.length;
  return lines.filter((line) => line.at > seen).length;
}
