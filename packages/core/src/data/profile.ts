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
      'Anyone with the link sees your tricks, stickers and streak. Your surname, email and clips are never shown.',
    other:
      "Anyone with the link can see this rider's tricks, stickers and streak. Surnames, emails and clips are never shown.",
  },
  {
    id: 'members',
    label: 'Riders only',
    short: 'Riders',
    blurb:
      'Only people signed in to Land It can open your profile. Sensible default for younger riders.',
    other: 'This rider only shows their profile to people signed in to Land It.',
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

/** The default for a new account: the safer of the two visible settings. */
export const DEFAULT_PRIVACY = 'members' as const satisfies PrivacyId;

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
