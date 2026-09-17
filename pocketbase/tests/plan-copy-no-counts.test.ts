import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLANS } from '@landit/core';
import { describe, expect, it } from 'vitest';

const migration = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
  '1789948800_plan_copy_no_counts.js',
);

/**
 * `1789948800_plan_copy_no_counts.js` writes all three plan cards' copy onto a
 * running box with the count of free tricks taken out of it (Rachid,
 * 2026-09-17), and it duplicates that copy from `@landit/core` because a
 * migration runs in PocketBase's JSVM and cannot resolve the workspace.
 *
 * This is the guard that makes the duplication honest, the same shape as
 * `plan-copy-refresh.test.ts` before it and `free-tier-twenty.test.ts` before
 * that. It reads the migration as text rather than importing it, because the
 * file calls `migrate()`, a global only PocketBase provides.
 *
 * **This is now the file that pins plan copy**, and only one file ever may be.
 * `plan-copy-refresh.test.ts` stopped pinning core when this landed, for the
 * reason it gave when it took the job from `free-tier-twenty.test.ts`: keeping
 * both pinned would mean plan copy could never change again without editing a
 * migration production has already run — which PocketBase will not re-run, so
 * the edit would never reach a card.
 */
describe('the plan-copy-no-counts migration', () => {
  const read = async () => readFile(migration, 'utf8');

  /** A named `const … = [` block, with a JS string literal's escaping undone. */
  const block = async (name: string) => {
    const source = await read();
    const start = source.indexOf(`const ${name} = [`);
    expect(start, `${name} is not in the migration`).toBeGreaterThan(-1);
    const end = source.indexOf('\n];', start);
    expect(end, `${name} is not terminated`).toBeGreaterThan(start);
    // Prettier may wrap a long line, so compare on collapsed whitespace.
    return source.slice(start, end).replace(/\\'/g, "'").replace(/\s+/g, ' ');
  };

  it('carries every line of all three cards, Legend included', async () => {
    const copy = await block('COPY');

    for (const plan of PLANS) {
      for (const line of [plan.pitch, ...plan.perks, ...plan.missing]) {
        const needle = line.replace(/\s+/g, ' ').trim();
        expect(copy, `${plan.id}: "${needle}"`).toContain(needle);
      }
    }
  });

  it('names all three slugs', async () => {
    const copy = await block('COPY');
    for (const plan of PLANS) {
      expect(copy, `no row for ${plan.id}`).toContain(`slug: '${plan.id}'`);
    }
  });

  it('states no count of tricks in anything it writes', async () => {
    /*
     * The whole point of the file, asserted on the migration rather than only on
     * core — because this is the copy a *live* card shows, and the two are
     * separate files that a paste can pull apart. Video allowances are a
     * different number and a different owner decision ("10 video links"), so the
     * pattern is anchored on the word this is about.
     */
    const copy = await block('COPY');
    expect(copy).not.toMatch(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|\d+)\s+(free\s+|hand-picked\s+)*tricks?\b/i,
    );
    expect(copy).not.toMatch(/\bthe twenty\b|\bthe ten\b/i);
  });

  it('keeps the rollback wording, and does not pin it to core', async () => {
    /*
     * `COPY_WITH_COUNTS` is what the cards said between 2026-09-12 and
     * 2026-09-17 — a snapshot, and history from here. A box rolled back past
     * this migration should hold three accurate 2026-09-12 cards rather than a
     * mixture, which is why the down direction writes rather than no-ops.
     *
     * It is deliberately NOT compared against `@landit/core`: core has moved on,
     * and a test that pinned both would make the next copy change impossible.
     */
    const source = await read();
    expect(source).toContain('COPY_WITH_COUNTS');
    expect(source).toMatch(/Twenty hand-picked tricks in every sport/);
    expect(source).toMatch(/not just the twenty we picked for you/);
  });

  it('writes copy and nothing else — no price, no entitlement', async () => {
    /*
     * The blast radius, asserted rather than trusted. Prices have Stripe behind
     * them and are staff-retunable (issue #123); the entitlement columns decide
     * what a rider may open, and the free allowance this migration is *about*
     * lives in one of them. A later edit that widened this silently would be
     * exactly the kind of change nobody notices in review.
     */
    const source = await read();
    const written = [...source.matchAll(/record\.set\('([a-z_]+)'/g)].map(([, field]) => field);
    expect([...new Set(written)].sort()).toEqual(['missing', 'perks', 'pitch']);
  });

  it('creates no plan row, so it can never invent an entitlement', async () => {
    const source = await read();
    expect(source).not.toMatch(/new Record\(|app\.save\(new /);
    expect(source).toContain('continue;');
  });

  it('is a no-op on a second run, in both directions', async () => {
    // One `writeCopy` serves `up` and `down`, so the skip-when-equal check
    // cannot drift between them — which is the failure a second copy of this
    // loop would eventually produce.
    const source = await read();
    expect(source).toMatch(/if \(\s*record\.getString\('pitch'\) === card\.pitch/);
    expect(source).toMatch(/migrate\(\s*\(app\) => \{\s*writeCopy\(app, COPY\);/);
    expect(source).toMatch(/\(app\) => \{\s*writeCopy\(app, COPY_WITH_COUNTS\);/);
  });
});
