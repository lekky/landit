/**
 * The 36 built-in avatars, transcribed from
 * `design-handoff/design/landit-avatars.js`.
 *
 * The PNGs themselves live in this package under `assets/avatars/`, copied out
 * of the design pack so nothing in the app deep-links into `design-handoff/`,
 * which is reference material. `apps/web` copies them to its `public/` folder
 * at build time (see `apps/web/scripts/sync-avatars.mjs`), which is why the
 * default base path is a URL and not a file path.
 *
 * The illustrated set has rules — circular, flat pastel background, black ink
 * side profile, all facing the same way — documented in
 * `design-handoff/design/Land It - Avatars.html`.
 */

export type AvatarGroupId = 'Lids' | 'Heads' | 'Kit';

export type Avatar = {
  /** Stable id. Also the PNG filename, minus the extension. */
  readonly id: string;
  /** Display name shown under the picker. */
  readonly name: string;
  readonly group: AvatarGroupId;
  /** Flat background colour behind the illustration. */
  readonly hue: string;
};

export const AVATARS = [
  /* ---- lids: helmets, caps, beanies ---- */
  { id: 'cap-green', name: 'Flat Cap', group: 'Lids', hue: '#AECF9A' },
  { id: 'helmet-white', name: 'White Lid', group: 'Lids', hue: '#F3B84E' },
  { id: 'beanie-purple', name: 'Beanie', group: 'Lids', hue: '#C4B5E8' },
  { id: 'snapback-pink', name: 'Snapback', group: 'Lids', hue: '#F5B8C8' },
  { id: 'helmet-land', name: 'Land The Trick Lid', group: 'Lids', hue: '#C9C6BE' },
  { id: 'bucket-tan', name: 'Bucket Hat', group: 'Lids', hue: '#CFC2AC' },
  { id: 'goggles', name: 'Shades + Lid', group: 'Lids', hue: '#F3B84E' },
  { id: 'helmet-ld', name: 'LD Lid', group: 'Lids', hue: '#F5B8C8' },
  { id: 'helmet-black', name: 'Black Lid', group: 'Lids', hue: '#F5B8C8' },
  { id: 'helmet-ponytail', name: 'Lid + Ponytail', group: 'Lids', hue: '#AECF9A' },
  { id: 'snapback-braids', name: 'Cap + Braids', group: 'Lids', hue: '#F3B84E' },
  { id: 'helmet-hijab', name: 'Lid + Hijab', group: 'Lids', hue: '#F5B8C8' },
  { id: 'bucket-wavy', name: 'Bucket + Waves', group: 'Lids', hue: '#AECF9A' },
  { id: 'cap-shades', name: 'Cap + Shades', group: 'Lids', hue: '#C4B5E8' },
  { id: 'beanie-long', name: 'Beanie + Long', group: 'Lids', hue: '#9FC7E8' },

  /* ---- heads: no lid ---- */
  { id: 'hair-blue', name: 'Bed Head', group: 'Heads', hue: '#9FC7E8' },
  { id: 'headphones', name: 'Headphones', group: 'Heads', hue: '#9FC7E8' },
  { id: 'hood-cap', name: 'Hood + Cap', group: 'Heads', hue: '#AECF9A' },
  { id: 'ponytail', name: 'Ponytail', group: 'Heads', hue: '#C4B5E8' },
  { id: 'curls', name: 'Curls', group: 'Heads', hue: '#C4B5E8' },
  { id: 'cap-flat', name: 'Cap, Peak Up', group: 'Heads', hue: '#AECF9A' },
  { id: 'masked', name: 'Masked Up', group: 'Heads', hue: '#F5B8C8' },
  { id: 'fringe', name: 'Fringe', group: 'Heads', hue: '#9FC7E8' },
  { id: 'hoodie-up', name: 'Hood Up', group: 'Heads', hue: '#CFC2AC' },
  { id: 'glasses', name: 'Glasses', group: 'Heads', hue: '#F3B84E' },
  { id: 'bandana-bun', name: 'Bandana + Bun', group: 'Heads', hue: '#C4B5E8' },
  { id: 'afro-curls', name: 'Afro', group: 'Heads', hue: '#F5B8C8' },
  { id: 'headphones-bob', name: 'Bob + Cans', group: 'Heads', hue: '#CFC2AC' },
  { id: 'space-buns', name: 'Space Buns', group: 'Heads', hue: '#9FC7E8' },
  { id: 'hood-fringe', name: 'Hood + Fringe', group: 'Heads', hue: '#F3B84E' },
  { id: 'mask-pixie', name: 'Masked Pixie', group: 'Heads', hue: '#CFC2AC' },

  /* ---- kit: objects and glyphs ---- */
  { id: 'scooter-green', name: 'The Scoot', group: 'Kit', hue: '#AECF9A' },
  { id: 'scooter-blue', name: 'Deck Up', group: 'Kit', hue: '#9FC7E8' },
  { id: 'flag', name: 'Chequered Flag', group: 'Kit', hue: '#CFC2AC' },
  { id: 'crown', name: 'Crown', group: 'Kit', hue: '#C4B5E8' },
  { id: 'bolt', name: 'Send Bolt', group: 'Kit', hue: '#9FC7E8' },
] as const satisfies readonly Avatar[];

/** Union of the built-in avatar ids. */
export type AvatarId = (typeof AVATARS)[number]['id'];

export const AVATAR_GROUPS = [
  { id: 'Lids', blurb: 'Helmets, caps and beanies. How most riders show up' },
  { id: 'Heads', blurb: 'No lid, just hair. Pick the one closest to you' },
  { id: 'Kit', blurb: "Gear and glyphs, for anyone who'd rather not be a face" },
] as const satisfies readonly { id: AvatarGroupId; blurb: string }[];

/** Where `apps/web` serves the copied PNGs from. */
export const AVATAR_BASE_PATH = '/avatars';

export function avatarById(id: string | null | undefined): Avatar | undefined {
  return id ? AVATARS.find((a) => a.id === id) : undefined;
}

export function avatarsInGroup(group: AvatarGroupId): readonly Avatar[] {
  return AVATARS.filter((a) => a.group === group);
}

/** URL of an avatar PNG. Pass `base` if the app serves them somewhere else. */
export function avatarSrc(id: string, base: string = AVATAR_BASE_PATH): string {
  return `${base}/${id}.png`;
}
