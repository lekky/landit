import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { AWARDS, type Sticker } from '@landit/core';
import { STICKER_ART_WIDTHS, stickerArtSrcSet } from '@landit/ui-web';
import { describe, expect, it } from 'vitest';

/**
 * Every award record names its printed badge (`img`), and a name that points
 * at nothing renders a broken image on a child's sticker wall. The core
 * package checks the *shape* of the name; only this package can check the
 * file, because the art lives in `packages/ui-web/assets/stickers/`, synced
 * into `public/stickers/` at build time (`scripts/sync-stickers.mjs`).
 */
const ART_DIR = join(__dirname, '..', '..', '..', '..', 'packages', 'ui-web', 'assets', 'stickers');

/**
 * Awards whose badge has not been printed yet.
 *
 * T27 added 162 trick awards on 2026-09-04 and the art is being generated
 * separately, from these exact ids — the filename is the contract between the
 * record and the printing, which is why `img` is written before the file
 * exists. Until each PNG lands, its record is listed here.
 *
 * **This list only ever shrinks**, and shrinking it is the whole job: an award
 * that is not on it and has no file fails the test below, so the moment a
 * batch of art is committed the ids come off and the guard is back to full
 * strength. An id left on it after its file arrives costs nothing but a stale
 * line; an id added to it to silence a failure is how the guard dies.
 */
const PENDING_ART = new Set<string>([
  'fakie',
  'kickturn',
  'nose-pivot',
  'powerslide',
  'cali-slider',
  'chairman',
  'body-varial',
  'x-ride',
  'weedwacker',
  'foot-jam',
  'hang-5',
  'pogo',
  'tail-tap',
  'acid-drop',
  'pole-tap',
  'boardslide',
  'double-peg',
  'lipslide',
  'nose-grind',
  'crooked-grind',
  'wallride',
  'wall-plant',
  'rail-ride',
  'whip-out',
  'pump',
  'drop-in',
  'quarter-pipe-air',
  'bank-transfer',
  'one-hander',
  'indy-grab',
  'rock-n-roll',
  'half-cab',
  'no-hander',
  'tuck-no-hander',
  'table-top',
  'can-can',
  'airwalk',
  'candy-bar',
  'turndown',
  'cannonball',
  '720',
  'handplant',
  'flair-whip',
  'backflip-no-hander',
  'backflip-barspin',
  'krippleflip',
  'truck-driver',
  'bar-to-whip',
  'full-whip',
  'rewind',
  '360-whip',
  'whiplash',
  'buttercup',
  'front-bri',
  'sk-kickturn',
  'sk-tic-tac',
  'sk-fakie-roll',
  'sk-powerslide',
  'sk-hippie-jump',
  'sk-body-varial',
  'sk-caveman',
  'sk-boneless',
  'sk-no-comply',
  'sk-curb-drop',
  'sk-curb-ollie',
  'sk-ramp-kickturn',
  'sk-pump',
  'sk-roll-in',
  'sk-tail-stall',
  'sk-slash-grind',
  'sk-no-comply-180',
  'sk-bs-180',
  'sk-switch-ollie',
  'sk-half-cab',
  'sk-fs-pop-shuvit',
  'sk-rock-n-roll',
  'sk-nose-stall',
  'sk-feeble-stall',
  'sk-fastplant',
  'sk-melon',
  'sk-mute',
  'sk-tailgrab',
  'sk-nosegrab',
  'sk-360-shuvit',
  'sk-nollie-kickflip',
  'sk-lipslide',
  'sk-feeble',
  'sk-smith',
  'sk-wallride',
  'sk-smith-stall',
  'sk-disaster',
  'sk-nosepick',
  'sk-pivot-fakie',
  'sk-frontside-air',
  'sk-stalefish',
  'sk-method-air',
  'sk-benihana',
  'sk-varial-heelflip',
  'sk-frontside-flip',
  'sk-bigspin',
  'sk-half-cab-flip',
  'sk-bluntslide',
  'sk-noseblunt',
  'sk-airwalk',
  'sk-backside-flip',
  'sk-inward-heelflip',
  'sk-laser-flip',
  'sk-kickflip-50-50',
  'bmx-endo',
  'bmx-rollback',
  'bmx-half-cab',
  'bmx-nollie-180',
  'bmx-hop-manual',
  'bmx-manual-180',
  'bmx-full-cab',
  'bmx-backwards-manual',
  'bmx-crankflip',
  'bmx-hop-on-off',
  'bmx-double-peg-stall',
  'bmx-feeble-stall',
  'bmx-peg-stall',
  'bmx-footplant',
  'bmx-ramp-manual',
  'bmx-wall-tap',
  'bmx-hip-transfer',
  'bmx-rail-ride',
  'bmx-one-hander',
  'bmx-one-footer',
  'bmx-no-footer',
  'bmx-can-can',
  'bmx-seat-grab',
  'bmx-candybar',
  'bmx-abubaca',
  'bmx-fufanu',
  'bmx-nosepick',
  'bmx-360-fakie',
  'bmx-no-hander',
  'bmx-no-foot-can-can',
  'bmx-nac-nac',
  'bmx-superman',
  'bmx-superman-seatgrab',
  'bmx-toboggan',
  'bmx-crooked',
  'bmx-pedal-grind',
  'bmx-luc-e',
  'bmx-feeble-180',
  'bmx-double-peg-hard-180',
  'bmx-180-double-peg',
  'bmx-fakie-wallride',
  'bmx-icepick-180',
  'bmx-barspin-fakie',
  'bmx-footjam-whip',
  'bmx-footplant-whip',
  'bmx-tooth-hanger',
  'bmx-nothing',
  'bmx-handplant',
  'bmx-frontflip',
  'bmx-360-tailwhip',
  'bmx-downside-whip',
  'bmx-decade',
  'bmx-double-tailwhip',
  'bmx-triple-tailwhip',
]);

describe('the award art', () => {
  it('has a committed file behind every award record', () => {
    for (const award of AWARDS) {
      if (PENDING_ART.has(award.id)) continue;
      expect(existsSync(join(ART_DIR, award.img)), `${award.id} → ${award.img}`).toBe(true);
    }
  });

  it('is waiting on art for at most the 162 badges T27 added, and for nothing else', () => {
    // The size cap is what stops the pending list becoming a place to put a
    // missing badge. It never grows: adding a trick means adding its art.
    expect(PENDING_ART.size).toBeLessThanOrEqual(162);
    // Widened to `Sticker`: the literal union of 297 records has no common
    // `kind` to read, the same reason `packages/core`'s data test widens.
    const allAwards: readonly Sticker[] = AWARDS;
    const trickAwards = new Set(allAwards.filter((a) => a.kind === 'trick').map((a) => a.id));
    for (const id of PENDING_ART) expect(trickAwards, id).toContain(id);
  });

  it('has no stray art without a record behind it', () => {
    // A file nobody references is either a renamed award (a bug) or leftover
    // scratch (bloat that ships to every rider).
    const wanted = new Set<string>(AWARDS.map((a) => a.img));
    for (const file of readdirSync(ART_DIR)) {
      expect(wanted.has(file), file).toBe(true);
    }
  });

  it('keeps every badge small enough to ship the whole set', () => {
    // The originals were ~1.4MB each; the committed set is optimised to a
    // ~77KB average. This is the regression stop for someone re-exporting at
    // full resolution.
    for (const file of readdirSync(ART_DIR)) {
      expect(statSync(join(ART_DIR, file)).size, file).toBeLessThan(250_000);
    }
  });

  /**
   * Small enough to ship a few hundred of them is still ~83KB each, and a wall
   * draws ~65 at 118px. `sync-stickers.mjs` writes the resized WebP the wall
   * actually fetches, and `stickerArtSrcSet` in `@landit/ui-web` names them —
   * two lists of widths in two packages, and a `srcset` candidate that 404s
   * shows a broken image rather than falling back to the `src`. This is the
   * only place that can see both, because `@landit/ui-web` may not import the
   * app and the script lives here.
   */
  it('resizes to exactly the widths the badge asks for', async () => {
    const { STICKER_WIDTHS } = await import('../../scripts/sync-stickers.mjs');
    expect(STICKER_WIDTHS).toEqual([...STICKER_ART_WIDTHS]);

    for (const width of STICKER_ART_WIDTHS) {
      expect(stickerArtSrcSet('180.png')).toContain(`/w${width}/180.webp ${width}w`);
    }
  });
});
