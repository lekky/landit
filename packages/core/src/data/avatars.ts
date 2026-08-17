import type { Avatar, AvatarGroup } from '../types';

/**
 * The 36 built-in avatars, transcribed from
 * `design-handoff/design/landit-avatars.js`.
 *
 * `file` is the bare PNG filename, not a path: the images ship as assets of
 * `@landit/ui-web`, and only that package should know where they resolve to.
 * `packages/core` stays free of anything platform-shaped (plan §2.2).
 */
export const AVATARS = [
  {
    id: 'cap-green',
    name: 'Flat Cap',
    group: 'Lids',
    hue: '#AECF9A',
    file: 'cap-green.png',
  },
  {
    id: 'helmet-white',
    name: 'White Lid',
    group: 'Lids',
    hue: '#F3B84E',
    file: 'helmet-white.png',
  },
  {
    id: 'beanie-purple',
    name: 'Beanie',
    group: 'Lids',
    hue: '#C4B5E8',
    file: 'beanie-purple.png',
  },
  {
    id: 'snapback-pink',
    name: 'Snapback',
    group: 'Lids',
    hue: '#F5B8C8',
    file: 'snapback-pink.png',
  },
  {
    id: 'helmet-land',
    name: 'Land The Trick Lid',
    group: 'Lids',
    hue: '#C9C6BE',
    file: 'helmet-land.png',
  },
  {
    id: 'bucket-tan',
    name: 'Bucket Hat',
    group: 'Lids',
    hue: '#CFC2AC',
    file: 'bucket-tan.png',
  },
  {
    id: 'goggles',
    name: 'Shades + Lid',
    group: 'Lids',
    hue: '#F3B84E',
    file: 'goggles.png',
  },
  {
    id: 'helmet-ld',
    name: 'LD Lid',
    group: 'Lids',
    hue: '#F5B8C8',
    file: 'helmet-ld.png',
  },
  {
    id: 'helmet-black',
    name: 'Black Lid',
    group: 'Lids',
    hue: '#F5B8C8',
    file: 'helmet-black.png',
  },
  {
    id: 'helmet-ponytail',
    name: 'Lid + Ponytail',
    group: 'Lids',
    hue: '#AECF9A',
    file: 'helmet-ponytail.png',
  },
  {
    id: 'snapback-braids',
    name: 'Cap + Braids',
    group: 'Lids',
    hue: '#F3B84E',
    file: 'snapback-braids.png',
  },
  {
    id: 'helmet-hijab',
    name: 'Lid + Hijab',
    group: 'Lids',
    hue: '#F5B8C8',
    file: 'helmet-hijab.png',
  },
  {
    id: 'bucket-wavy',
    name: 'Bucket + Waves',
    group: 'Lids',
    hue: '#AECF9A',
    file: 'bucket-wavy.png',
  },
  {
    id: 'cap-shades',
    name: 'Cap + Shades',
    group: 'Lids',
    hue: '#C4B5E8',
    file: 'cap-shades.png',
  },
  {
    id: 'beanie-long',
    name: 'Beanie + Long',
    group: 'Lids',
    hue: '#9FC7E8',
    file: 'beanie-long.png',
  },
  {
    id: 'hair-blue',
    name: 'Bed Head',
    group: 'Heads',
    hue: '#9FC7E8',
    file: 'hair-blue.png',
  },
  {
    id: 'headphones',
    name: 'Headphones',
    group: 'Heads',
    hue: '#9FC7E8',
    file: 'headphones.png',
  },
  {
    id: 'hood-cap',
    name: 'Hood + Cap',
    group: 'Heads',
    hue: '#AECF9A',
    file: 'hood-cap.png',
  },
  {
    id: 'ponytail',
    name: 'Ponytail',
    group: 'Heads',
    hue: '#C4B5E8',
    file: 'ponytail.png',
  },
  {
    id: 'curls',
    name: 'Curls',
    group: 'Heads',
    hue: '#C4B5E8',
    file: 'curls.png',
  },
  {
    id: 'cap-flat',
    name: 'Cap, Peak Up',
    group: 'Heads',
    hue: '#AECF9A',
    file: 'cap-flat.png',
  },
  {
    id: 'masked',
    name: 'Masked Up',
    group: 'Heads',
    hue: '#F5B8C8',
    file: 'masked.png',
  },
  {
    id: 'fringe',
    name: 'Fringe',
    group: 'Heads',
    hue: '#9FC7E8',
    file: 'fringe.png',
  },
  {
    id: 'hoodie-up',
    name: 'Hood Up',
    group: 'Heads',
    hue: '#CFC2AC',
    file: 'hoodie-up.png',
  },
  {
    id: 'glasses',
    name: 'Glasses',
    group: 'Heads',
    hue: '#F3B84E',
    file: 'glasses.png',
  },
  {
    id: 'bandana-bun',
    name: 'Bandana + Bun',
    group: 'Heads',
    hue: '#C4B5E8',
    file: 'bandana-bun.png',
  },
  {
    id: 'afro-curls',
    name: 'Afro',
    group: 'Heads',
    hue: '#F5B8C8',
    file: 'afro-curls.png',
  },
  {
    id: 'headphones-bob',
    name: 'Bob + Cans',
    group: 'Heads',
    hue: '#CFC2AC',
    file: 'headphones-bob.png',
  },
  {
    id: 'space-buns',
    name: 'Space Buns',
    group: 'Heads',
    hue: '#9FC7E8',
    file: 'space-buns.png',
  },
  {
    id: 'hood-fringe',
    name: 'Hood + Fringe',
    group: 'Heads',
    hue: '#F3B84E',
    file: 'hood-fringe.png',
  },
  {
    id: 'mask-pixie',
    name: 'Masked Pixie',
    group: 'Heads',
    hue: '#CFC2AC',
    file: 'mask-pixie.png',
  },
  {
    id: 'scooter-green',
    name: 'The Scoot',
    group: 'Kit',
    hue: '#AECF9A',
    file: 'scooter-green.png',
  },
  {
    id: 'scooter-blue',
    name: 'Deck Up',
    group: 'Kit',
    hue: '#9FC7E8',
    file: 'scooter-blue.png',
  },
  {
    id: 'flag',
    name: 'Chequered Flag',
    group: 'Kit',
    hue: '#CFC2AC',
    file: 'flag.png',
  },
  {
    id: 'crown',
    name: 'Crown',
    group: 'Kit',
    hue: '#C4B5E8',
    file: 'crown.png',
  },
  {
    id: 'bolt',
    name: 'Send Bolt',
    group: 'Kit',
    hue: '#9FC7E8',
    file: 'bolt.png',
  },
] as const satisfies readonly Avatar[];

/** Every built-in avatar id, as a union. */
export type AvatarId = (typeof AVATARS)[number]['id'];

/** Picker groupings, in the order the avatar picker shows them. */
export const AVATAR_GROUPS = [
  { id: 'Lids', blurb: 'Helmets, caps and beanies. How most riders show up' },
  { id: 'Heads', blurb: 'No lid, just hair. Pick the one closest to you' },
  { id: 'Kit', blurb: "Gear and glyphs, for anyone who'd rather not be a face" },
] as const satisfies readonly AvatarGroup[];
