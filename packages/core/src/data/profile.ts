import type { Goal, Level, Privacy, PrivacyId, Stance } from '../types';

/** Stance question at onboarding, skippable. */
export const STANCES = [
  { id: 'regular', label: 'Regular', sub: 'Left foot forward' },
  { id: 'goofy', label: 'Goofy', sub: 'Right foot forward' },
  { id: 'switch', label: 'Both', sub: 'Comfortable either way' },
] as const satisfies readonly Stance[];

/**
 * The three-way profile privacy setting. Enforced by PocketBase API rules, not
 * by the client (plan §3, guarantee 1) — this data is the copy and the ordering
 * only.
 */
export const PRIVACY = [
  {
    id: 'public',
    label: 'Public',
    short: 'Public',
    blurb:
      'Anyone with the link sees your tricks, stickers and streak. Your surname and email are never shown.',
    other:
      "Anyone with the link can see this rider's tricks, stickers and streak. Surnames and emails are never shown.",
  },
  {
    id: 'members',
    label: 'Riders only',
    short: 'Riders',
    // "Sensible default for younger riders" until 2026-08-16, which stopped
    // being true the moment the default moved to `private` (LESSONS §4: when a
    // rule changes, sweep what quotes it).
    blurb: 'Only people signed in to Land The Trick can open your profile.',
    other: 'This rider only shows their profile to people signed in to Land The Trick.',
  },
  {
    id: 'private',
    label: 'Private',
    short: 'Private',
    blurb: 'Nobody can open your profile. You still appear on your crew board by name and score.',
    other:
      'This rider has closed their profile. They still appear on the crew board by name and score.',
  },
] as const satisfies readonly Privacy[];

/**
 * The default for a new account: **private**, not merely not-public.
 *
 * Children's code standard 7 (plan §6.4) and §3 guarantee 1. This was `members`
 * until 2026-08-16 — a reading of "default to private, not public" on which
 * "riders only" also clears the bar. It does not: `members` still opens a
 * child's profile to every signed-in stranger on the service, and the point of
 * the standard is that being visible is a choice a rider makes rather than the
 * setting they are handed. The privacy policy and the safeguarding page both
 * say "new accounts start private" (T5), so this is also what the product
 * promises in writing.
 *
 * Changing it was a behaviour change to shared code — **owner-authorised
 * exception to additive-only (Rachid, 2026-08-16)**, recorded in plan §7.
 *
 * `members` remains a setting a rider can choose. It is no longer one we choose
 * for them.
 */
export const DEFAULT_PRIVACY = 'private' as const satisfies PrivacyId;

/** Riding level, onboarding step 2. */
export const LEVELS = [
  { id: 'new', label: 'Just started', sub: 'Still working on the basics', hue: '#9CE05B' },
  { id: 'some', label: 'Got a few tricks', sub: 'Hops, 180s, maybe a whip', hue: '#3AC0FF' },
  { id: 'solid', label: 'Park regular', sub: 'Whips, spins, grinding ledges', hue: '#FF9F1C' },
  { id: 'send', label: 'Sending it', sub: 'Flips and combos', hue: '#FF3D78' },
] as const satisfies readonly Level[];

/**
 * Riding goals, onboarding step 3. `sport: null` goals are offered whatever the
 * rider rides; the rest are filtered to their sports by `goalsFor`.
 *
 * The picker also offers "+ Something else", which stores the id below and a
 * 60-character free-text goal on the rider.
 */
export const GOALS = [
  { id: 'first', sport: null, label: 'Land my first trick', hue: '#FFC23F' },
  { id: 'whip', sport: 'scooter', label: 'Get a tailwhip', hue: '#246BFF' },
  { id: 'kickflip', sport: 'skate', label: 'Land a kickflip', hue: '#246BFF' },
  { id: 'street', sport: null, label: 'Ride street properly', hue: '#FF5A1F' },
  { id: 'flip', sport: 'scooter', label: 'Go upside down', hue: '#E0392B' },
  { id: 'bowl', sport: 'skate', label: 'Drop in and ride bowls', hue: '#E0392B' },
  { id: 'all', sport: null, label: 'Tick off the whole list', hue: '#8A3BE0' },
] as const satisfies readonly Goal[];

/** The id stored when a rider writes their own goal. */
export const CUSTOM_GOAL_ID = 'custom' as const;

/** How long a written goal may be. It goes on the dashboard, so keep it blunt. */
export const CUSTOM_GOAL_MAX_LENGTH = 60;

/* ---------------------------------------------------------------- handles -- */

export const HANDLE_MIN_LENGTH = 2;
export const HANDLE_MAX_LENGTH = 20;

/**
 * What a handle may look like: lowercase letters, numbers and underscores,
 * starting and ending with a letter or number.
 *
 * The same expression is in `pocketbase/hooks/lib/landit.js` and in the `users`
 * migration's field pattern. Three copies is deliberate — the migration refuses
 * the write, the hook produces the message a rider reads, and this one lets the
 * sign-up form say so before the request leaves. When one changes, all three do.
 */
export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_]{0,18}[a-z0-9]$/;

/**
 * Handles nobody may hold. They appear in URLs and on share cards, so a name
 * that could be read as Land The Trick talking to you, or as a route, is out.
 *
 * Mirrors `RESERVED_HANDLES` in `pocketbase/hooks/lib/landit.js`, which is the
 * copy that actually refuses the write. A test pins the two together.
 */
export const RESERVED_HANDLES: readonly string[] = Object.freeze([
  'about',
  'admin',
  'administrator',
  'api',
  'auth',
  'challenge',
  'challenges',
  'clip',
  'clips',
  'contact',
  'cookies',
  'crew',
  'crews',
  'event',
  'events',
  'help',
  'landit',
  'land-it',
  'land-the-trick',
  'landthetrick',
  'landtrick',
  'legal',
  'login',
  'logout',
  'me',
  'mod',
  'moderator',
  'new',
  'null',
  'official',
  'plans',
  'pocketbase',
  'privacy',
  'profile',
  'report',
  'reports',
  'root',
  'safeguarding',
  'security',
  'settings',
  'signin',
  'signup',
  'spot',
  'spots',
  'staff',
  'sticker',
  'stickers',
  'superuser',
  'support',
  'system',
  'team',
  'terms',
  'trick',
  'tricks',
  'undefined',
  'you',
]);
