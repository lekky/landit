import type { SportId, StageId, Trick } from '../types';

/**
 * Crews: names, invite codes and the words the activity feed uses.
 *
 * Everything here is *definition*. The enforcement lives in
 * `pocketbase/hooks/85_crews.pb.js` and in the API rules (plan §3): a crew is
 * created by a hook that owns the slug and the owner, an invite code is minted
 * by that hook and never by a client, and `POST /api/landit/crews/join` is the
 * only path into a crew. Nothing in this file is a security boundary.
 *
 * Two facts from plan §6.1 shape the whole module, and they are decisions
 * rather than preferences:
 *
 * - **Crews are invite-only with no discovery.** There is no search, no
 *   directory and no "crews near you", so nothing here ranks or matches crews.
 * - **There is no rider-to-rider messaging.** The activity feed is a fixed set
 *   of sentences *we* write about things that happened, listed below. A rider
 *   cannot put a word of their own into it, which is what stops it becoming a
 *   channel by increments.
 */

/* ------------------------------------------------------------------ names -- */

export const CREW_NAME_MIN_LENGTH = 2;

/** Matches the `crews.name` field's `max` in the initial migration. */
export const CREW_NAME_MAX_LENGTH = 40;

/**
 * How many crews one rider may own.
 *
 * Not a product ceiling on belonging — a rider may be *in* more crews than
 * this. It is the anti-spam number: crew creation mints invite codes, and an
 * account that can mint unlimited codes is an account that can paper the
 * internet with them.
 */
export const MAX_OWNED_CREWS = 5;

/**
 * Is every character of this name printable?
 *
 * Written as a scan rather than a regular expression on purpose. The same test
 * has to run in the PocketBase JSVM (`hooks/85_crews.pb.js`), whose regex
 * engine is not V8's, and a rule the server spells differently from the client
 * is a rule with two answers. Character codes are the same everywhere.
 */
function isPrintable(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

/**
 * Why this crew name will be refused, or `null` when it is fine.
 *
 * The message is the one a rider reads, so it says what to do rather than what
 * failed. The same limits are the field's in the migration; this copy exists so
 * the form can say so before the request leaves.
 */
export function crewNameProblem(name: string | null | undefined): string | null {
  const trimmed = String(name ?? '').trim();
  if (trimmed.length < CREW_NAME_MIN_LENGTH) return 'Give the crew a name';
  if (trimmed.length > CREW_NAME_MAX_LENGTH) {
    return `Keep it to ${CREW_NAME_MAX_LENGTH} characters`;
  }
  // A name that can carry a line break is a name that can pretend to be two
  // rows on a board, and a name carrying a control character can lie about its
  // own length. Neither is caught by the field's `max`.
  if (!isPrintable(trimmed)) return 'Letters, numbers and spaces, please';
  return null;
}

/**
 * A crew name as a URL-safe slug. `suffix` is the disambiguator the server
 * appends, because two crews may legitimately want the same name and the slug
 * is uniquely indexed.
 */
export function crewSlug(name: string, suffix: string): string {
  const base = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  const tail = String(suffix ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return (base ? `${base}-${tail}` : `crew-${tail}`).slice(0, 40);
}

/* ------------------------------------------------------------ invite codes -- */

/**
 * The alphabet an invite code is drawn from: upper-case letters and digits with
 * `I`, `L`, `O`, `0` and `1` removed.
 *
 * Two jobs at once. A code gets read off a screenshot and typed by a child, so
 * the pairs people confuse are out. And a code is the *only* thing standing
 * between a stranger and a crew of children (plan §6.1), so it is drawn from 31
 * symbols over 10 places — about 8×10^14 codes — rather than from a rider's
 * name, which is what the prototype did and what would make a crew guessable.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const INVITE_CODE_LENGTH = 10;

/** Where the hyphen goes when a code is shown to a human. */
export const INVITE_CODE_GROUP = 5;

/** How long a fresh invite lasts. */
export const INVITE_EXPIRY_DAYS = 14;

/** How many riders one invite may bring in before it stops working. */
export const INVITE_MAX_USES = 25;

/**
 * Whatever the rider pasted, as the server stores it: upper-cased, with the
 * hyphen, spaces and any character outside the alphabet removed.
 *
 * Deliberately forgiving on input and strict on output — a code copied out of a
 * chat app arrives with all sorts around it, and refusing it would teach a
 * child that the code is broken.
 */
export function normaliseInviteCode(raw: string | null | undefined): string {
  const upper = String(raw ?? '').toUpperCase();
  let out = '';
  for (const ch of upper) if (INVITE_CODE_ALPHABET.includes(ch)) out += ch;
  return out;
}

export function isValidInviteCode(raw: string | null | undefined): boolean {
  return normaliseInviteCode(raw).length === INVITE_CODE_LENGTH;
}

/** A stored code as it is shown and shared: `ABCDE-FGHJK`. */
export function formatInviteCode(raw: string | null | undefined): string {
  const code = normaliseInviteCode(raw);
  if (code.length <= INVITE_CODE_GROUP) return code;
  return `${code.slice(0, INVITE_CODE_GROUP)}-${code.slice(INVITE_CODE_GROUP)}`;
}

/* ---------------------------------------------------------- activity feed -- */

export type CrewActivityKind = 'stage' | 'sticker';

export interface CrewActivityItem {
  readonly id: string;
  readonly kind: CrewActivityKind;
  readonly riderId: string;
  readonly riderName: string;
  readonly handle: string;
  readonly avatarKey?: string;
  /** ISO instant. The feed is chronological and nothing else (plan §6.1). */
  readonly at: string;
  readonly trickName?: string;
  readonly sport?: SportId;
  readonly stage?: StageId;
  readonly stickerName?: string;
}

/**
 * What the feed says about one thing that happened.
 *
 * The whole vocabulary of the feed is these five sentences. That is the point:
 * a feed made of sentences the product wrote cannot become a place riders talk
 * to each other, and "no rider-to-rider messaging, ever" (plan §6.1) has to be
 * true of the shapes as well as of the intent.
 */
export function crewActivityLine(item: CrewActivityItem): string {
  if (item.kind === 'sticker') {
    return `earned the ${item.stickerName ?? 'a'} sticker`;
  }
  const trick = item.trickName ?? 'a trick';
  switch (item.stage) {
    case 'want':
      return `added ${trick} to their list`;
    case 'trying':
      return `started learning ${trick}`;
    case 'every':
      return `landed ${trick} every time`;
    default:
      return `landed ${trick}`;
  }
}

/**
 * The feed, newest first, and nothing more clever than that.
 *
 * Sorting is by time and the id breaks a tie, so the same input always produces
 * the same order. Plan §6.1: "no algorithmic feed" — a stable sort by `at` is
 * the whole ranking, and there is nowhere here for engagement to get a vote.
 */
export function sortCrewActivity(items: readonly CrewActivityItem[]): CrewActivityItem[] {
  return [...items].sort((a, b) =>
    a.at === b.at ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.at < b.at ? 1 : -1,
  );
}

/* ------------------------------------------------------------- coach view -- */

/**
 * The difficulty the supervise list falls back to when a trick carries no
 * `supervise` flag at all.
 *
 * It was the whole rule until 2026-09-04. It is now the **fallback**, and only
 * that: see `needsSupervision()` for why it still exists and when it fires.
 * Kept exported because it is part of that fallback and because other code may
 * read the number.
 */
export const SUPERVISED_MIN_DIFF = 5;

/**
 * Should the coach view tell a guardian about this trick?
 *
 * **The flag, not the difficulty** (Rachid, 2026-09-04, in chat). Difficulty 5
 * means complexity and mastery, not only physical danger — a Truckdriver is a
 * 360 with a barspin, hard but no more dangerous than the 360 graded 4 — so
 * difficulty stopped being an answer to the question this list asks. `supervise`
 * is set per trick on the line T27 drew: the rider goes upside down, commits to
 * a drop they cannot step out of, or the trick's own tips send them to a foam
 * pit or a resi ramp first. That is why a drop-in at difficulty 2 is on this
 * list and several difficulty-5 flatground tricks are not.
 *
 * **The fallback is deliberate, and it fails in one direction on purpose.**
 * These rules are handed *live database rows* rather than the canonical list,
 * so a staff edit takes effect without a deploy (`rules/tricks.ts`). That means
 * a trick can reach here from a database whose `tricks` collection predates the
 * `supervise` column — an old row, a server running code newer than its
 * schema — and read `undefined`. Answering "no" there would tell every guardian
 * that nothing their child is doing needs supervising, which is the worst
 * possible failure of a safety list. So `undefined` falls back to the rule this
 * replaced. A guardian shown a slightly-too-long list has been over-warned; a
 * guardian shown an empty one has been told there is nothing to worry about.
 *
 * `false` is an answer and is respected: once the column exists, a difficulty-5
 * trick nobody marked is off the list.
 */
export function needsSupervision(trick: Trick): boolean {
  if (trick.supervise === undefined) return trick.diff >= SUPERVISED_MIN_DIFF;
  return trick.supervise;
}

/** The tricks on this list a parent should know about. */
export function supervisedTricks(tricks: readonly Trick[]): Trick[] {
  return tricks.filter(needsSupervision);
}
