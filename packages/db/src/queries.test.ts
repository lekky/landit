import { isTrickFree, isTrickLocked, trickById } from '@landit/core';
import { describe, expect, it } from 'vitest';

import type { TrickPrereqsRecord, TricksRecord } from './generated/collections';
import { tricksFromRecords } from './queries';

/**
 * The `tricks` row → `Trick` mapping.
 *
 * Two of these assertions are about the paywall rather than about a mapping.
 * `free_override` is a three-state select and the rule shape is a nullable
 * boolean, so the empty value has to arrive as `undefined`: read as `false` it
 * would put every difficulty-1 trick behind the paywall, and the failure would
 * look like a plan bug rather than a translation bug.
 */

const row = (over: Partial<TricksRecord> & Pick<TricksRecord, 'id' | 'slug'>): TricksRecord => ({
  collectionId: 'c',
  collectionName: 'tricks',
  name: over.slug,
  sport: 'scooter',
  cat: 'flat',
  diff: 1,
  about: '',
  tips: '',
  fact: '',
  free_override: '' as TricksRecord['free_override'],
  is_live: true,
  created: '',
  updated: '',
  ...over,
});

const edge = (trick: string, prereq: string): TrickPrereqsRecord => ({
  collectionId: 'e',
  collectionName: 'trick_prereqs',
  id: `${trick}-${prereq}`,
  trick,
  prereq,
  created: '',
});

describe('tricksFromRecords', () => {
  it('keys tricks by slug, not by database id', () => {
    const tricks = tricksFromRecords([row({ id: 'rec1', slug: 'bunny-hop', name: 'Bunny hop' })]);
    expect(tricks[0]?.id).toBe('bunny-hop');
    expect(trickById('bunny-hop', tricks)?.name).toBe('Bunny hop');
  });

  it('resolves prerequisite edges from record ids to slugs', () => {
    const tricks = tricksFromRecords(
      [row({ id: 'rec1', slug: 'bunny-hop' }), row({ id: 'rec2', slug: 'tailwhip', diff: 3 })],
      [edge('rec2', 'rec1')],
    );
    expect(trickById('tailwhip', tricks)?.pre).toEqual(['bunny-hop']);
    expect(trickById('bunny-hop', tricks)?.pre).toEqual([]);
  });

  it('drops an edge naming a trick that is not in the list', () => {
    const tricks = tricksFromRecords(
      [row({ id: 'rec1', slug: 'bunny-hop' })],
      [edge('rec9', 'rec1')],
    );
    expect(tricks[0]?.pre).toEqual([]);
  });

  it('reads an empty free_override as "inherit from difficulty", never as paid', () => {
    const tricks = tricksFromRecords([
      row({ id: 'rec1', slug: 'easy', diff: 1 }),
      row({ id: 'rec2', slug: 'hard', diff: 4 }),
    ]);
    expect(tricks[0]?.free).toBeUndefined();
    expect(isTrickFree(tricks[0]!)).toBe(true);
    expect(isTrickLocked(tricks[0]!, 'rookie')).toBe(false);
    expect(isTrickLocked(tricks[1]!, 'rookie')).toBe(true);
  });

  it('honours a staff override in both directions', () => {
    const tricks = tricksFromRecords([
      row({ id: 'rec1', slug: 'free-but-hard', diff: 5, free_override: 'free' }),
      row({ id: 'rec2', slug: 'paid-but-easy', diff: 1, free_override: 'paid' }),
    ]);
    expect(isTrickLocked(tricks[0]!, 'rookie')).toBe(false);
    expect(isTrickLocked(tricks[1]!, 'rookie')).toBe(true);
  });

  it('carries the hidden flag through, so the library can drop it', () => {
    const tricks = tricksFromRecords([row({ id: 'rec1', slug: 'pulled', is_live: false })]);
    expect(tricks[0]?.isLive).toBe(false);
  });
});
