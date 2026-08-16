import type { CategoryLook, IconName, SportLook, StageLook } from '@landit/ui-web';

/**
 * Demo data for the design gallery, and nothing else.
 *
 * The canonical trick library, stages, categories and stickers live in
 * `@landit/core` (T1). These few records are copied from
 * `design-handoff/design/landit-data.js` so the gallery can render a real-
 * looking card without the design system depending on game data.
 */

export const CATEGORIES = {
  flat: { label: 'Flat', color: '#10A06A' },
  street: { label: 'Street', color: '#FF5A1F' },
  park: { label: 'Park', color: '#246BFF' },
  hybrid: { label: 'Hybrid', color: '#8A3BE0' },
  air: { label: 'Air', color: '#E0392B' },
} as const satisfies Record<string, CategoryLook>;

export const SPORTS = {
  scooter: { label: 'Scooter', color: '#FF5A1F', icon: 'scoot' },
  skate: { label: 'Skate', color: '#246BFF', icon: 'board' },
} as const satisfies Record<string, SportLook>;

/** Five stages, in order. A trick counts as landed at `some` or above. */
export const STAGES = [
  { id: 'want', label: 'Want to learn', short: 'Want', color: '#8A3BE0' },
  { id: 'trying', label: 'Learning', short: 'Learning', color: '#FF9F1C' },
  { id: 'some', label: 'Sometimes', short: 'Sometimes', color: '#3AC0FF' },
  { id: 'most', label: 'Most times', short: 'Most times', color: '#2EC4B6' },
  { id: 'every', label: 'Every time', short: 'Every time', color: '#10A06A' },
] as const satisfies readonly StageLook[];

/** Difficulty tier names, 1–5. */
export const TIERS = ['Rookie', 'Easy', 'Spicy', 'Gnarly', 'Pro'] as const;

export const COLOUR_TOKENS = [
  { name: '--ink', hex: '#12100B', use: 'Text, every border, dark surfaces' },
  { name: '--ink-2', hex: '#3A352C', use: 'Body copy on light surfaces' },
  { name: '--ink-3', hex: '#6E665A', use: 'Muted labels, meta text' },
  { name: '--paper', hex: '#FFFDF5', use: 'Card surface' },
  { name: '--paper-2', hex: '#FFF7E4', use: 'Secondary surface, table headers' },
  { name: '--wash', hex: '#F2ECDC', use: 'Page background (with dot pattern)' },
  { name: '--pink', hex: '#FF3D78', use: 'Accent, link hover, BMX' },
  { name: '--orange', hex: '#FF5A1F', use: 'Primary button, scooter, Street' },
  { name: '--yellow', hex: '#FFC23F', use: 'Brand accent, streak, highlight rows' },
  { name: '--lime', hex: '#9CE05B', use: 'Progress fill, landed state' },
  { name: '--green', hex: '#10A06A', use: 'Success, "Every time", Flat' },
  { name: '--mint', hex: '#2EC4B6', use: '"Most times" stage' },
  { name: '--sky', hex: '#3AC0FF', use: '"Sometimes" stage, info toasts' },
  { name: '--blue', hex: '#246BFF', use: 'Skate, Park' },
  { name: '--violet', hex: '#8A3BE0', use: 'Paywall, staff/admin, Hybrid' },
  { name: '--red', hex: '#E0392B', use: 'Destructive actions, errors, Air' },
] as const;

export const SAMPLE_STICKERS = [
  { name: 'First Land', hue: '#FF5A8A', icon: 'check' as IconName, earned: true },
  { name: 'Five Deep', hue: '#10A06A', icon: 'coins' as IconName, earned: true },
  { name: '7 Day Streak', hue: '#FFC23F', icon: 'flame' as IconName, earned: false },
  { name: 'Caught On Cam', hue: '#C46BFF', icon: 'cam' as IconName, earned: false },
  { name: 'Gnarly', hue: '#16140F', icon: 'skull' as IconName, earned: false },
  { name: 'Crew Up', hue: '#5BA8FF', icon: 'users' as IconName, earned: true },
];
