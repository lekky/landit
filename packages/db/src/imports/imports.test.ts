import { SPOT_SOURCES, importedSpotSports, type SportId } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { buildSeed } from '../seed';

/**
 * Every imported spot follows the import sports rule: the "for any import"
 * half of the owner's ruling (Rachid, 2026-09-11, in chat).
 *
 * An importer's source is silent about who may ride, and the rule for a silent
 * source is `importedSpotSports` in `@landit/core`. This test is what makes that
 * a rule rather than a convention. It reads every spot row the seed would write,
 * keeps the ones an importer produced (anything not hand-researched and not a
 * rider's), and fails on a row whose sports the rule could not have produced.
 * That is what an importer hard-coding `['skate']` looks like, and it is what
 * the France import looked like until this test existed.
 *
 * **A documented ban is not a failure, but it has to be written down here**, by
 * `name|town`, with the page that says so. The friction is deliberate: a ban
 * hides a park from one sport's riders, and the place to decide that is a
 * reviewed line in a test, not a quiet branch inside an importer.
 */

/** Sources that are not imports: the hand-researched table and rider submissions. */
const NOT_IMPORTED = new Set<string>([SPOT_SOURCES.researched.id, SPOT_SOURCES.rider.id]);

/** Documented restrictions in imported data. Empty: the French census records none. */
const DOCUMENTED_BANS: Readonly<Record<string, { banned: readonly SportId[]; source: string }>> =
  {};

/** Everything the rule can say about a place with no documented ban. */
const EVIDENCE = [{}, { bmx: true }, { bmx: true, bmxTrackOnly: true }];

const sportsKey = (sports: readonly unknown[]): string => sports.map(String).join(',');

describe('every imported spot', () => {
  const rows = buildSeed()
    .tables.filter((table) => table.collection === 'spots')
    .flatMap((table) => table.rows as Record<string, unknown>[])
    .filter((row) => !NOT_IMPORTED.has(String(row.source)));

  it('has rows to check, so the rule is never passing on nothing', () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it('lists the sports the import rule gives it', () => {
    for (const row of rows) {
      const key = `${String(row.name)}|${String(row.town)}`;
      const ban = DOCUMENTED_BANS[key];
      const allowed = EVIDENCE.map((evidence) =>
        sportsKey(importedSpotSports(ban ? { ...evidence, banned: ban.banned } : evidence)),
      );
      expect(allowed, `${key} (${String(row.source)})`).toContain(
        sportsKey(row.sports as unknown[]),
      );
    }
  });

  it('never lists no sport at all', () => {
    for (const row of rows) expect((row.sports as unknown[]).length).toBeGreaterThan(0);
  });
});
