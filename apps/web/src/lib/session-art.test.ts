import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { SESSION_FEEL_IDS, SESSION_WEATHER_IDS } from '@landit/core';
import {
  FEEL_ART,
  SESSION_ART_FILES,
  SESSION_ART_WIDTHS,
  WEATHER_ART,
  sessionArtSrcSet,
} from '@landit/ui-web';
import { describe, expect, it } from 'vitest';

/**
 * The commissioned sticker art behind every feel and every weather option
 * (owner, 2026-09-14, in chat), checked against the two things
 * `@landit/ui-web` cannot see for itself: core's real vocabularies, and the
 * files on disk.
 *
 * The art lives in `packages/ui-web/assets/session-icons/` and is synced into
 * `public/session-icons/` at build time (`scripts/sync-session-icons.mjs`).
 * Only this package can hold all three together, because `@landit/ui-web` may
 * not import `@landit/core` and the script lives here.
 */
const ART_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'ui-web',
  'assets',
  'session-icons',
);

describe('the session sticker art', () => {
  it('has art for every feel and every weather option core offers', () => {
    // A feel added to core with no art here is a broken image on the log form.
    expect(Object.keys(FEEL_ART).sort()).toEqual([...SESSION_FEEL_IDS].sort());
    expect(Object.keys(WEATHER_ART).sort()).toEqual([...SESSION_WEATHER_IDS].sort());
  });

  it('has a committed file behind every name', () => {
    for (const file of SESSION_ART_FILES) {
      expect(existsSync(join(ART_DIR, file)), file).toBe(true);
    }
  });

  it('has no stray art without an id behind it', () => {
    // A file nobody references is either a rename (a bug) or leftover scratch
    // (bytes that ship to every rider).
    const wanted = new Set(SESSION_ART_FILES);
    for (const file of readdirSync(ART_DIR)) {
      expect(wanted.has(file), file).toBe(true);
    }
  });

  it('keeps every master small enough to ship all ten', () => {
    // The originals were ~1.1 MB each at 1254px; the committed set is 512px and
    // ~65 KB average, in line with the award badges. This is the regression
    // stop for someone re-exporting at full resolution — and box1 has no disk
    // to spare for it (issue #452).
    for (const file of readdirSync(ART_DIR)) {
      expect(statSync(join(ART_DIR, file)).size, file).toBeLessThan(250_000);
    }
  });

  /**
   * Two lists of widths in two packages, and a `srcset` candidate that 404s
   * shows a broken image rather than falling back to the `src`.
   */
  it('resizes to exactly the widths the art asks for', async () => {
    const { SESSION_ICON_WIDTHS } = await import('../../scripts/sync-session-icons.mjs');
    expect(SESSION_ICON_WIDTHS).toEqual([...SESSION_ART_WIDTHS]);

    for (const width of SESSION_ART_WIDTHS) {
      expect(sessionArtSrcSet(FEEL_ART.sent)).toContain(`/w${width}/feel-sent.webp ${width}w`);
    }
  });
});
