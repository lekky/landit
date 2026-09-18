import type { RiderStickersRecord, StickersRecord } from '@landit/db';
import { describe, expect, it } from 'vitest';

import { buildShelves } from './libraryShelf';

/**
 * The library's sticker shelf, which is three numbers and three badges built on
 * the server (`shelf.ts`).
 *
 * Worth a unit test rather than only an e2e: the scoping rule it reuses — a
 * shared sticker on every wall, a sport's own only on its own — is the rule
 * that has already gone wrong once on Home ("1 · Newest: First skate trick",
 * then an empty scooter wall), and a count the wall contradicts is the whole
 * defect. The e2e proves the control renders; this proves it says the truth.
 */

/* Only the fields the shelf reads; the rest of the record is not its business. */
const sticker = (id: string, sport: string, extra: Partial<StickersRecord> = {}): StickersRecord =>
  ({
    id,
    slug: id,
    name: id,
    sport,
    hue: '#ff3d78',
    img: `${id}.png`,
    ...extra,
  }) as StickersRecord;

const earned = (stickerId: string, earnedAt: string): RiderStickersRecord =>
  ({ id: `row-${stickerId}`, sticker: stickerId, earned_at: earnedAt }) as RiderStickersRecord;

const CATALOGUE = [
  sticker('scoot-one', 'scooter'),
  sticker('scoot-two', 'scooter'),
  sticker('scoot-three', 'scooter'),
  sticker('scoot-four', 'scooter'),
  sticker('skate-one', 'skate'),
  sticker('shared-one', ''),
];

describe('buildShelves', () => {
  it('counts this sport’s wall: its own plus the shared ones', () => {
    const shelves = buildShelves({
      stickers: CATALOGUE,
      earned: [
        earned('scoot-one', '2026-09-10'),
        earned('skate-one', '2026-09-11'),
        earned('shared-one', '2026-09-12'),
      ],
      seenAt: '2026-09-18',
      sports: ['scooter', 'skate'],
    });

    expect(shelves.scooter?.total).toBe(2);
    expect(shelves.skate?.total).toBe(2);
  });

  it('shows the three newest earned, newest first', () => {
    const shelves = buildShelves({
      stickers: CATALOGUE,
      earned: [
        earned('scoot-one', '2026-09-01'),
        earned('scoot-four', '2026-09-17'),
        earned('scoot-two', '2026-09-09'),
        earned('scoot-three', '2026-09-14'),
      ],
      seenAt: '2026-09-18',
      sports: ['scooter'],
    });

    expect(shelves.scooter?.arts.map((art) => art.name)).toEqual([
      'scoot-four',
      'scoot-three',
      'scoot-two',
    ]);
    expect(shelves.scooter?.earned).toBe(true);
  });

  it('offers the catalogue to a rider whose wall is empty', () => {
    // The control is drawn either way: the wall shows what is still to come,
    // so there is something real behind the tap. `earned: false` is what turns
    // the copy into "see what's up for grabs".
    const shelves = buildShelves({
      stickers: CATALOGUE,
      earned: [],
      seenAt: '',
      sports: ['scooter'],
    });

    expect(shelves.scooter?.earned).toBe(false);
    expect(shelves.scooter?.total).toBe(0);
    expect(shelves.scooter?.arts).toHaveLength(3);
    expect(shelves.scooter?.fresh).toBe(0);
  });

  it('counts only what landed after the last wall visit, per sport', () => {
    const shelves = buildShelves({
      stickers: CATALOGUE,
      earned: [
        earned('scoot-one', '2026-09-01'),
        earned('scoot-two', '2026-09-17'),
        earned('shared-one', '2026-09-17'),
        earned('skate-one', '2026-09-17'),
      ],
      seenAt: '2026-09-16',
      sports: ['scooter', 'skate'],
    });

    // Scooter's own new one, plus the shared one that hangs on every wall.
    expect(shelves.scooter?.fresh).toBe(2);
    expect(shelves.skate?.fresh).toBe(2);
    expect(shelves.scooter?.total).toBe(3);
  });

  it('treats a rider who has never opened the wall as having seen nothing', () => {
    const shelves = buildShelves({
      stickers: CATALOGUE,
      earned: [earned('scoot-one', '2026-09-01'), earned('scoot-two', '2026-09-02')],
      seenAt: '',
      sports: ['scooter'],
    });

    expect(shelves.scooter?.fresh).toBe(2);
  });

  it('drops an award whose sticker staff have retired', () => {
    // The wall cannot show it, so a count that includes it is a count the wall
    // contradicts — the same reading `lib/stickers.ts` gives a missing record.
    const shelves = buildShelves({
      stickers: CATALOGUE,
      earned: [earned('scoot-one', '2026-09-10'), earned('gone-from-catalogue', '2026-09-17')],
      seenAt: '2026-09-01',
      sports: ['scooter'],
    });

    expect(shelves.scooter?.total).toBe(1);
    expect(shelves.scooter?.fresh).toBe(1);
  });

  it('carries the hue for a record with no printed art', () => {
    const shelves = buildShelves({
      stickers: [sticker('legacy', 'scooter', { img: '', hue: '#10a06a' })],
      earned: [earned('legacy', '2026-09-10')],
      seenAt: '2026-09-18',
      sports: ['scooter'],
    });

    expect(shelves.scooter?.arts[0]).toEqual({ img: null, hue: '#10a06a', name: 'legacy' });
  });

  it('draws no shelf for a sport with nothing on offer at all', () => {
    // A link to a wall with nothing on it and nothing to come is furniture.
    const shelves = buildShelves({
      stickers: [sticker('scoot-one', 'scooter')],
      earned: [],
      seenAt: '',
      sports: ['scooter', 'bmx'],
    });

    expect(shelves.scooter).toBeDefined();
    expect(shelves.bmx).toBeUndefined();
  });
});
