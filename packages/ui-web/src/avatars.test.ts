import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { AVATARS, AVATAR_GROUPS, avatarById, avatarSrc } from './avatars';

/**
 * The registry and the PNGs are two things that can drift apart silently: a
 * missing file shows up as a broken picture on the profile screen, never as a
 * failing build. This test is what stops that.
 */
const assets = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'avatars');
const files = readdirSync(assets).filter((f) => f.endsWith('.png'));

describe('avatar registry', () => {
  it('has the 36 avatars the handoff describes', () => {
    expect(AVATARS).toHaveLength(36);
    expect(files).toHaveLength(36);
  });

  it('has a PNG in the package for every registered avatar', () => {
    const missing = AVATARS.filter((a) => !files.includes(`${a.id}.png`)).map((a) => a.id);
    expect(missing).toEqual([]);
  });

  it('registers every PNG in the package', () => {
    const ids = new Set<string>(AVATARS.map((a) => a.id));
    const orphans = files.filter((f) => !ids.has(path.basename(f, '.png')));
    expect(orphans).toEqual([]);
  });

  it('uses unique ids and a known group for each', () => {
    const groups = new Set(AVATAR_GROUPS.map((g) => g.id));
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(AVATARS.length);
    expect(AVATARS.every((a) => groups.has(a.group))).toBe(true);
  });

  it('looks an avatar up and builds its URL', () => {
    expect(avatarById('crown')?.name).toBe('Crown');
    expect(avatarById('not-a-lid')).toBeUndefined();
    expect(avatarById(null)).toBeUndefined();
    expect(avatarSrc('crown')).toBe('/avatars/crown.png');
    expect(avatarSrc('crown', '/static/av')).toBe('/static/av/crown.png');
  });
});
