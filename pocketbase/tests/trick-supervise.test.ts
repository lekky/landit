import { describe, expect, it } from 'vitest';

import { call, ensureRecord, superuser } from './helpers';

/**
 * `tricks.supervise` exists in the database and survives a round trip
 * (issue #304, `feat-supervise-list`).
 *
 * The rule this feeds — `supervisedTricks()` in `@landit/core` — is unit-tested
 * where it lives. What cannot be unit-tested is the thing that made the issue a
 * safety problem rather than a plumbing one: the rules layer is deliberately
 * handed **live PocketBase rows** so a staff edit takes effect without a deploy,
 * and a field with no column reads `undefined` on every row it is asked about.
 * For this particular field that failure is silent and it points one way — the
 * coach view would tell every guardian that nothing their child is doing needs
 * supervising. So the column is asserted here, over HTTP, against the real
 * migrations, rather than inferred from the fact that a migration file exists.
 *
 * Both values are written and read back, because the mapping in
 * `packages/db/src/queries.ts` treats *absent* and *false* differently on
 * purpose and a test that only ever wrote `true` would not notice if `false`
 * came back as nothing.
 */
describe('tricks.supervise', () => {
  it('is a field on the collection', async () => {
    const token = await superuser();
    const result = await call<{ fields: { name: string; type: string }[] }>(
      'GET',
      '/api/collections/tricks',
      { token },
    );

    expect(result.status).toBe(200);
    const field = result.body.fields.find((f) => f.name === 'supervise');
    expect(field, 'tricks has no `supervise` field').toBeDefined();
    expect(field?.type).toBe('bool');
  });

  it('round-trips both answers to a public reader', async () => {
    // A marked trick well below the old difficulty line, and an unmarked one
    // above it: exactly the pair the flag exists to tell apart.
    await ensureRecord('tricks', "slug = 'fixture-supervise-yes'", {
      slug: 'fixture-supervise-yes',
      name: 'Fixture Supervise Yes',
      sport: 'skate',
      cat: 'street',
      diff: 2,
      supervise: true,
      is_live: true,
    });
    await ensureRecord('tricks', "slug = 'fixture-supervise-no'", {
      slug: 'fixture-supervise-no',
      name: 'Fixture Supervise No',
      sport: 'skate',
      cat: 'flat',
      diff: 5,
      supervise: false,
      is_live: true,
    });

    // No token: the coach view reads the library through the same public list
    // rule any visitor gets, so that is the read asserted.
    const rows = await call<{ items: { slug: string; supervise: boolean }[] }>(
      'GET',
      '/api/collections/tricks/records',
      { query: { filter: 'slug ~ "fixture-supervise-"', perPage: '10' } },
    );

    expect(rows.status).toBe(200);
    const bySlug = new Map(rows.body.items.map((item) => [item.slug, item]));

    const yes = bySlug.get('fixture-supervise-yes');
    expect(yes, 'marked fixture not readable').toBeDefined();
    expect(Object.hasOwn(yes!, 'supervise'), 'supervise missing from the response').toBe(true);
    expect(yes?.supervise).toBe(true);

    const no = bySlug.get('fixture-supervise-no');
    expect(no, 'unmarked fixture not readable').toBeDefined();
    expect(Object.hasOwn(no!, 'supervise'), 'supervise missing from the response').toBe(true);
    expect(no?.supervise).toBe(false);
  });
});
