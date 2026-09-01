import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { STICKER_ART_BASE_PATH, stickerArtSrc, stickerArtSrcSet } from './sticker-art';

const assets = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'stickers');
const masters = readdirSync(assets).filter((f) => f.endsWith('.png'));

describe('stickerArtSrc', () => {
  it('serves the master PNG from the copied folder', () => {
    expect(stickerArtSrc('180.png')).toBe('/stickers/180.png');
  });

  it('takes a base path, for an app that serves them elsewhere', () => {
    expect(stickerArtSrc('180.png', '/art')).toBe('/art/180.png');
  });
});

describe('stickerArtSrcSet', () => {
  it('offers one resized WebP per width, narrowest first', () => {
    expect(stickerArtSrcSet('180.png')).toBe(
      '/stickers/w160/180.webp 160w, /stickers/w320/180.webp 320w',
    );
  });

  it('keeps a hyphenated name whole', () => {
    expect(stickerArtSrcSet('bmx-tuck-no-hander.png')).toContain(
      '/stickers/w160/bmx-tuck-no-hander.webp 160w',
    );
  });

  /**
   * The whole reason the PNG stays the `src`. A `srcset` candidate that 404s
   * does not fall back — the browser shows a broken image — so anything the
   * sync script does not resize must get no `srcset` at all rather than a
   * guessed one.
   */
  it('offers nothing for a file the sync script does not resize', () => {
    expect(stickerArtSrcSet('180.svg')).toBeUndefined();
    expect(stickerArtSrcSet('180.webp')).toBeUndefined();
    expect(stickerArtSrcSet('.png')).toBeUndefined();
  });

  it('is case-insensitive about the extension', () => {
    expect(stickerArtSrcSet('180.PNG')).toContain('/stickers/w160/180.webp');
  });
});

/**
 * The registry and the art are two things that can drift apart silently — a
 * badge with no resized copy is a broken image on the wall, never a failing
 * build. Same guard the avatars and the sport art get.
 *
 * That the widths promised here are the widths the sync script actually writes
 * is checked in `apps/web/src/lib/award-art.test.ts`, beside the script: this
 * package may not import the app, and the app is where the script lives.
 */
describe('the art in the package', () => {
  it('is all PNG, which is what the resize step reads', () => {
    expect(readdirSync(assets).filter((f) => !f.endsWith('.png'))).toEqual([]);
    expect(masters.length).toBeGreaterThan(0);
  });

  it('names every master with a srcset the base path can serve', () => {
    const broken = masters.filter((f) => !stickerArtSrcSet(f)?.startsWith(STICKER_ART_BASE_PATH));
    expect(broken).toEqual([]);
  });
});
