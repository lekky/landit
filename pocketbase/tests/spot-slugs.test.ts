import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { call, makeRider, superuser } from './helpers';

/**
 * Every spot gets a URL segment on the way in, and the segment is ours.
 *
 * `/spots/[slug]` is a public, crawlable page built from a record whose name is
 * typed by a child on the submission form. Two things therefore have to be true
 * on the **server**, where a browser cannot argue with them:
 *
 *  - **A spot cannot exist without a slug.** No slug, no page — and a row that
 *    slipped through with an empty one would be invisible to the sitemap and
 *    unreachable by URL, with nothing to say so.
 *  - **The slug is built from an allowlist**, so no combination of dots,
 *    slashes, percent-escapes, zero-width characters or right-to-left overrides
 *    in a name can make the URL mean something other than a spot.
 *
 * `pocketbase/hooks/63_spot_slugs.pb.js` is what does it. Each assertion below
 * was watched fail with that file removed before it was believed (LESSONS §5):
 * without it every spot stores `slug: ''` and all of these turn red.
 *
 * The `status = 'live'` gate that decides whether a slug becomes a *page* is
 * not here, because it is not in PocketBase — it is `getSpotBySlug` in
 * `@landit/db`, which is where the page reads from. What this file proves is
 * that an unreviewed submission has a slug and nothing more.
 */

const somewhere = () => ({
  // Nudged per call so two rows in one test are not the same point; the value
  // is irrelevant to slugging, it only has to be on Earth.
  lat: 53.4 + Math.random() * 0.1,
  lng: -2.9 - Math.random() * 0.1,
});

/** A shape every slug must have: lowercase ASCII words, single hyphens, no ends. */
const SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const submit = async (token: string, body: Record<string, unknown> = {}) =>
  call<{ id: string; slug: string; message: string }>('POST', '/api/collections/spots/records', {
    token,
    body: {
      name: `Test Spot ${randomBytes(4).toString('hex')}`,
      town: 'Liverpool',
      type: 'Concrete',
      ...somewhere(),
      sports: ['scooter'],
      ...body,
    },
  });

describe('a spot gets a slug on the way in', () => {
  it('reads as the spot does, name then town', async () => {
    const rider = await makeRider();
    const created = await submit(rider.token, { name: 'Esplanade Ledges', town: 'Ventnor' });

    expect(created.status).toBe(200);
    expect(created.body.slug).toBe('esplanade-ledges-ventnor');
  });

  it('does not repeat a town the name already carries', async () => {
    const rider = await makeRider();
    const created = await submit(rider.token, { name: 'Ventnor Skatepark', town: 'Ventnor' });

    expect(created.body.slug).toBe('ventnor-skatepark');
  });

  it('gives a superuser-written spot one too, so the seed cannot skip it', async () => {
    const token = await superuser();
    const created = await call<{ slug: string }>('POST', '/api/collections/spots/records', {
      token,
      body: {
        name: 'Staff Written Bowl',
        town: 'Newport',
        type: 'Concrete',
        ...somewhere(),
        status: 'live',
      },
    });

    expect(created.status).toBe(200);
    expect(created.body.slug).toBe('staff-written-bowl-newport');
  });

  it('counts up rather than colliding when two spots share a name and a town', async () => {
    const rider = await makeRider();
    const town = `Sametown${randomBytes(3).toString('hex')}`;

    const first = await submit(rider.token, { name: 'Skatepark', town });
    const second = await submit(rider.token, { name: 'Skatepark', town });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.slug).not.toBe(first.body.slug);
    expect(second.body.slug).toBe(`${first.body.slug}-2`);
  });
});

describe('the slug is built from an allowlist, because the name is typed by a child', () => {
  /*
   * One example per *kind* of character that would change what a URL means,
   * rather than a list of attacks somebody happened to think of.
   */
  const hostile: readonly [string, string][] = [
    ['a path', '../../admin'],
    ['an encoded path', '..%2f..%2fadmin'],
    ['markup', '<script>alert(1)</script>'],
    ['an attribute break', '"><img src=x onerror=alert(1)>'],
    ['a query and a fragment', '?a=1&b=2#frag'],
    ['a null byte', 'spot\u0000null'],
    ['a right-to-left override', 'spot\u202Egnp.xmb'],
    ['zero-width characters', 'spot\u200Bzero\u200Cwidth'],
    ['fullwidth Latin', '\uFF30\uFF41\uFF52\uFF4B'],
    ['a whole URL', 'https://evil.example.com/'],
    ['nothing usable at all', '\u0441\u043f\u043e\u0442'],
  ];

  for (const [what, name] of hostile) {
    it(`survives ${what} without letting it into the URL`, async () => {
      const rider = await makeRider();
      const created = await submit(rider.token, { name, town: '' });

      expect(created.status, JSON.stringify(created.body)).toBe(200);
      const slug = created.body.slug;
      expect(slug, `name: ${JSON.stringify(name)}`).toMatch(SHAPE);
      expect(slug.length).toBeLessThanOrEqual(80);
      for (const forbidden of ['/', '\\', '.', '%', '?', '#', '<', '>', ' ', '"']) {
        expect(slug).not.toContain(forbidden);
      }
    });
  }

  it('refuses to take a slug the caller supplied unfiltered', async () => {
    const rider = await makeRider();
    const created = await submit(rider.token, {
      name: 'Harmless Name',
      slug: '../../admin?x=1',
    });

    expect(created.status).toBe(200);
    expect(created.body.slug).toMatch(SHAPE);
    expect(created.body.slug).not.toContain('/');
  });

  it('caps the length however long the name is', async () => {
    const rider = await makeRider();
    const created = await submit(rider.token, {
      name: 'Extraordinarily Long Skatepark Name That Somebody Typed In Full Without Stopping',
      town: 'Liverpool',
    });

    expect(created.body.slug.length).toBeLessThanOrEqual(80);
    expect(created.body.slug).toMatch(SHAPE);
  });
});

describe('the three copies of the slug rule agree', () => {
  it('matches the definition in @landit/core', async () => {
    /*
     * `packages/core` defines the rule so the app can build a link without a
     * round trip; the hook writes the value and the migration backfilled it.
     * Three copies is what a PocketBase JSVM allows — nothing there can import
     * from the workspace — so a drift between them is a URL that changes
     * meaning depending on which one produced it. Read as text, like the
     * rate-limit check in `spot-submission.test.ts`, because the hook is a
     * module no bundler can load.
     */
    const { readFileSync } = await import('node:fs');
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
    const hook = read('../hooks/63_spot_slugs.pb.js');
    const migration = read('../migrations/1788220800_spot_slug.js');
    const rules = read('../../packages/core/src/rules/slug.ts');

    const numberIn = (source: string, name: string): string => {
      const found = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(source);
      if (!found) throw new Error(`${name} is not in that file any more.`);
      return found[1]!;
    };

    expect(numberIn(hook, 'SLUG_MAX_LENGTH')).toBe(numberIn(rules, 'SLUG_MAX_LENGTH'));
    expect(numberIn(migration, 'SLUG_MAX_LENGTH')).toBe(numberIn(rules, 'SLUG_MAX_LENGTH'));

    // The allowlist itself, which is the security-relevant half.
    for (const source of [hook, migration, rules]) {
      expect(source).toContain('/[^a-z0-9]+/g');
      expect(source).toContain("normalize('NFKD')");
    }

    // And the reserved list, so a future `/spots/new` cannot be shadowed in one
    // copy and not the others.
    for (const reserved of [
      'add',
      'all',
      'api',
      'edit',
      'index',
      'map',
      'new',
      'near',
      'report',
      'search',
    ]) {
      expect(hook, reserved).toContain(`'${reserved}'`);
      expect(migration, reserved).toContain(`'${reserved}'`);
      expect(rules, reserved).toContain(`'${reserved}'`);
    }
  });
});
