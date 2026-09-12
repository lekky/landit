import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLAN, TRICKS, isTrickFree, type Trick } from '@landit/core';
import { describe, expect, it } from 'vitest';

const migration = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
  '1789171200_free_tier_twenty.js',
);

/**
 * The migration that moves the free tier on a running box duplicates two things
 * from `@landit/core`: which tricks carry a `free_override`, and the copy on the
 * Rookie and Shredder cards. It has to — migrations run in PocketBase's JSVM,
 * which cannot resolve the workspace — and a duplicate nobody checks is a
 * divergence waiting to happen on the one value that decides what a child can
 * open.
 *
 * So this reads the migration as text and holds it to the canonical data. It is
 * the same shape as `dockerfile-version.test.ts`: two files that must agree,
 * with nothing but a test between them and a silent production mismatch.
 *
 * It pins the `up` list only. `OVERRIDES_TEN` and `COPY_TEN` are the rollback
 * path — a snapshot of the 2026-09-04 tier, which is history and is *supposed*
 * to stop matching `@landit/core` the moment the tier moved.
 */
describe('the free-tier-twenty migration', () => {
  // Read through `Trick`: the canonical data is `as const`, so a trick with no
  // override has no `free` key in its inferred type at all.
  const library: readonly Trick[] = TRICKS;
  const read = async () => readFile(migration, 'utf8');

  const listBetween = async (name: string) => {
    const source = await read();
    const start = source.indexOf(`const ${name} = [`);
    expect(start, `${name} is not in the migration`).toBeGreaterThan(-1);
    const end = source.indexOf('\n];', start);
    return source.slice(start, end);
  };

  it('carries exactly the overrides `@landit/core` carries', async () => {
    const block = await listBetween('OVERRIDES_TWENTY');

    const inMigration = new Map<string, string>();
    for (const [, id, value] of block.matchAll(/\['([a-z0-9-]+)', '(free|paid)'\]/g)) {
      inMigration.set(id as string, value as string);
    }

    const canonical = new Map<string, string>();
    for (const trick of library) {
      if (trick.free === undefined) continue;
      canonical.set(trick.id, trick.free ? 'free' : 'paid');
    }

    // Compared as sorted pairs so a failure names the trick that drifted rather
    // than reporting two maps of different sizes.
    const pairs = (m: Map<string, string>) =>
      [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, v]) => `${id}=${v}`);

    expect(pairs(inMigration)).toEqual(pairs(canonical));
  });

  it('leaves every other trick inheriting from difficulty', async () => {
    /*
     * A trick with no override in `@landit/core` must be absent from the `up`
     * map, and `isTrickFree` must already give the answer the empty value
     * would. Otherwise the migration would be writing an entitlement the
     * library does not claim.
     */
    const block = await listBetween('OVERRIDES_TWENTY');
    const listed = new Set([...block.matchAll(/\['([a-z0-9-]+)',/g)].map(([, id]) => id as string));

    for (const trick of library) {
      if (trick.free !== undefined) continue;
      expect(listed.has(trick.id), `${trick.id} has no override but the migration sets one`).toBe(
        false,
      );
      expect(isTrickFree(trick), trick.id).toBe(trick.diff <= 2);
    }
  });

  it('never writes a row outside the two tiers, so a staff-added trick is untouched', async () => {
    /*
     * The guard that keeps a staff-created trick's paywall where staff put it.
     * Clearing `free_override` across the whole collection would silently free
     * any row the maps do not name, and a trick added in the portal is exactly
     * such a row — it is not in `@landit/core`, so nothing here could know what
     * it should be.
     *
     * Asserted against the source because there is no way to reach the write
     * path from a test: migrations run once, inside PocketBase, at startup.
     */
    const source = await read();

    // The write is gated on membership of `touched`, and `touched` is built
    // from both tiers' keys and nothing else.
    expect(source).toContain('if (!touched.has(slug)) continue;');
    expect(source).toMatch(
      /const touched = new Set\(\[\.\.\.wanted\.keys\(\), \.\.\.OVERRIDES_TEN\.map\(\(\[id\]\) => id\)\]\);/,
    );

    // And nothing sweeps the collection unguarded.
    const loop = source.slice(source.indexOf('for (const trick of tricks)'));
    expect(loop.indexOf('touched.has(slug)')).toBeLessThan(
      loop.indexOf("trick.set('free_override'"),
    );
  });

  it('writes the plan copy the cards actually ship', async () => {
    const source = await read();
    const block = source.slice(source.indexOf('const COPY_TWENTY = ['));

    for (const plan of [PLAN.rookie, PLAN.shredder] as const) {
      for (const line of [plan.pitch, ...plan.perks, ...plan.missing]) {
        // Prettier may wrap a long line, so compare on collapsed whitespace and
        // on the escaping a JS string literal uses for an apostrophe.
        const needle = line.replace(/\s+/g, ' ').trim();
        const haystack = block.replace(/\\'/g, "'").replace(/\s+/g, ' ');
        expect(haystack, `${plan.id}: "${needle}"`).toContain(needle);
      }
    }
  });
});
