import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLANS } from '@landit/core';
import { describe, expect, it } from 'vitest';

const migration = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
  '1789776000_plan_copy_refresh.js',
);

/**
 * `1789776000_plan_copy_refresh.js` writes all three plan cards' copy onto a
 * running box, and it duplicates that copy from `@landit/core` because a
 * migration runs in PocketBase's JSVM and cannot resolve the workspace.
 *
 * This is the guard that makes the duplication honest — the same shape as
 * `free-tier-twenty.test.ts` and `dockerfile-version.test.ts`: two files that
 * must agree, with nothing but a test between them and a silent production
 * mismatch. It reads the migration as text rather than importing it, because
 * the file calls `migrate()`, a global only PocketBase provides.
 *
 * **It pinned plan copy from 2026-09-14 until 2026-09-17, and no longer does.**
 * `free-tier-twenty.test.ts` held the job before it and handed it over on the
 * same reasoning, which applies again now: `1789948800_plan_copy_no_counts.js`
 * took the count of free tricks out of the cards (Rachid, 2026-09-17), so this
 * migration's `COPY` is a snapshot of what they said on 2026-09-14 and is
 * history from here — exactly as `COPY_TWENTY` and `COPY_TEN` in `1789171200`
 * already were. Keeping both pinned would mean plan copy could never change
 * again without editing a migration production has already run, which
 * PocketBase will not re-run: the edit would live in the repository and never
 * reach a card.
 *
 * `plan-copy-no-counts.test.ts` is the file that pins copy against
 * `@landit/core` now, and only one ever may be. What stays here is everything
 * that is true of this migration whatever the words are: its blast radius, the
 * slugs it names, the perks it must never reinstate, and that it creates no row.
 */
describe('the plan-copy-refresh migration', () => {
  const read = async () => readFile(migration, 'utf8');

  /** The `COPY` block, with a JS string literal's escaping undone. */
  const copyBlock = async () => {
    const source = await read();
    const start = source.indexOf('const COPY = [');
    expect(start, 'COPY is not in the migration').toBeGreaterThan(-1);
    const end = source.indexOf('\n];', start);
    expect(end, 'COPY is not terminated').toBeGreaterThan(start);
    // Prettier may wrap a long line, so compare on collapsed whitespace.
    return source.slice(start, end).replace(/\\'/g, "'").replace(/\s+/g, ' ');
  };

  it('is the 2026-09-14 snapshot, and is not compared against core any more', async () => {
    /*
     * The handover, asserted so it cannot be undone by somebody "fixing" this
     * file back to canonical: these are the three sentences `1789948800`
     * replaced, and they are *supposed* to still be here. A box that never ran
     * the newer migration is entitled to this state.
     */
    const block = await copyBlock();
    expect(block).toContain('Twenty hand-picked tricks in every sport');
    expect(block).toContain('Twenty free tricks in each sport, not just the beginner ones');
    expect(block).toContain('not just the twenty we picked for you');
  });

  it('names all three slugs, because Legend is the row nothing else has written', async () => {
    // The reason this migration exists (#381): `1789171200` writes Rookie and
    // Shredder only, so Legend's row on a running box still holds whatever the
    // seed put there — possibly "Exclusive avatar drops", a perk that was never
    // true. A refresh that quietly dropped Legend would close nothing.
    const block = await copyBlock();
    for (const plan of PLANS) {
      expect(block, `no row for ${plan.id}`).toContain(`slug: '${plan.id}'`);
    }
  });

  it('reinstates no perk `@landit/core` has removed', async () => {
    // The specific line this is about, named so it cannot come back by a paste
    // from an old seed. `data.test.ts` holds the same assertion against core.
    const block = await copyBlock();
    expect(block).not.toMatch(/avatar drops/i);
    expect(block).not.toMatch(/up to the Easy tier|Scooter and skateboard libraries/i);
    expect(block).not.toMatch(/Spicy, Gnarly and Pro tiers/i);
  });

  it('writes copy and nothing else — no price, no entitlement', async () => {
    /*
     * The blast radius, asserted rather than trusted. Prices have Stripe behind
     * them and are staff-retunable (issue #123); the entitlement columns decide
     * what a rider may open. This migration is allowed to touch three text
     * fields, and a later edit that widened it silently would be exactly the
     * kind of change nobody notices in review.
     */
    const source = await read();
    const written = [...source.matchAll(/record\.set\('([a-z_]+)'/g)].map(([, field]) => field);
    expect([...new Set(written)].sort()).toEqual(['missing', 'perks', 'pitch']);
  });

  it('creates no plan row, so it can never invent an entitlement', async () => {
    // A missing row means an unseeded database, and the seed carries this same
    // copy from `@landit/core`. Creating one here would mean a migration
    // conjuring a plan — with whatever its entitlement columns defaulted to.
    const source = await read();
    expect(source).not.toMatch(/new Record\(|app\.save\(new /);
    // The `catch` that skips a missing row, rather than falling through to a
    // `record` that is undefined.
    expect(source).toContain('continue;');
  });

  it('is a no-op on a second run', async () => {
    // Re-running a migration is not the normal path, but a row already matching
    // canonical must not produce a save — the audit trail is read by hand.
    const source = await read();
    expect(source).toMatch(/if \(\s*record\.getString\('pitch'\) === card\.pitch/);
  });
});
