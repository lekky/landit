import { randomBytes } from 'node:crypto';
import { inject } from 'vitest';

import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD } from './instance';

export const baseUrl = (): string => inject('pocketbaseUrl');

export interface Response<T = Record<string, unknown>> {
  status: number;
  body: T;
}

export interface RequestOptions {
  token?: string | null;
  body?: unknown;
  query?: Record<string, string>;
}

/**
 * Everything below talks to PocketBase over HTTP, exactly as a browser would.
 *
 * That is the point of this suite: plan §3 asks for the guarantees to be proven
 * "as observed API behaviour, not by reading the rule text". A test that asserts
 * on a `listRule` string proves only that somebody typed a string.
 */
export async function call<T = Record<string, unknown>>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<Response<T>> {
  const url = new URL(path, baseUrl());
  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = options.token;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  return { status: response.status, body: body as T };
}

const uniq = () => randomBytes(5).toString('hex');

// ------------------------------------------------------------------ auth --

let superuserToken: string | null = null;

export async function superuser(): Promise<string> {
  if (superuserToken) return superuserToken;
  const result = await call<{ token: string }>(
    'POST',
    '/api/collections/_superusers/auth-with-password',
    { body: { identity: SUPERUSER_EMAIL, password: SUPERUSER_PASSWORD } },
  );
  if (result.status !== 200) throw new Error(`superuser auth failed: ${JSON.stringify(result)}`);
  superuserToken = result.body.token;
  return superuserToken;
}

export interface Rider {
  id: string;
  handle: string;
  email: string;
  password: string;
  token: string;
}

/**
 * A rider created the way a rider is created — through the public sign-up
 * endpoint — and then, where the test needs it, moved into a state only the
 * server can put them in (a plan, a consent state) with a superuser call.
 * Nothing here quietly hands a client a power the product would not.
 *
 * Every sign-up declares a country and an age band (plan §6.2), and since T6 the
 * server refuses one that does not — so the default here is an adult in the UK,
 * which is the "no consent question to answer" case most tests want. Override
 * either to put a rider on the other side of the gate.
 */
export async function makeRider(
  overrides: Record<string, unknown> = {},
  serverSide: Record<string, unknown> = {},
): Promise<Rider> {
  const suffix = uniq();
  const email = `rider-${suffix}@landit.invalid`;
  const password = 'a-long-local-test-password';
  // The guard lower-cases handles, so the caller is told what was stored, not
  // what was asked for.
  const handle = String(overrides.handle ?? `rider${suffix}`).toLowerCase();

  const created = await call<{ id: string }>('POST', '/api/collections/users/records', {
    body: {
      email,
      password,
      passwordConfirm: password,
      name: `Rider ${suffix}`,
      country: 'GB',
      age_band: 'adult',
      ...overrides,
      handle,
    },
  });
  if (created.status !== 200) throw new Error(`sign-up failed: ${JSON.stringify(created)}`);

  if (Object.keys(serverSide).length) {
    const patched = await call('PATCH', `/api/collections/users/records/${created.body.id}`, {
      token: await superuser(),
      body: serverSide,
    });
    if (patched.status !== 200)
      throw new Error(`server-side setup failed: ${JSON.stringify(patched)}`);
  }

  const auth = await call<{ token: string }>('POST', '/api/collections/users/auth-with-password', {
    body: { identity: email, password },
  });
  if (auth.status !== 200) throw new Error(`sign-in failed: ${JSON.stringify(auth)}`);

  return { id: created.body.id, handle, email, password, token: auth.body.token };
}

// -------------------------------------------------------------- fixtures --

/**
 * Find-or-create, so parallel test files can share the handful of global
 * records (plans, tricks) without racing each other. Real seeds are T4's job —
 * these are the smallest set the rules need to be exercised at all.
 */
export async function ensureRecord(
  collection: string,
  filter: string,
  data: Record<string, unknown>,
): Promise<{ id: string } & Record<string, unknown>> {
  const token = await superuser();
  const found = await call<{ items: ({ id: string } & Record<string, unknown>)[] }>(
    'GET',
    `/api/collections/${collection}/records`,
    { token, query: { filter, perPage: '1' } },
  );
  if (found.status === 200 && found.body.items?.length) return found.body.items[0]!;

  const created = await call<{ id: string } & Record<string, unknown>>(
    'POST',
    `/api/collections/${collection}/records`,
    { token, body: data },
  );
  if (created.status !== 200) {
    // Lost a race with another worker — re-read.
    const again = await call<{ items: ({ id: string } & Record<string, unknown>)[] }>(
      'GET',
      `/api/collections/${collection}/records`,
      { token, query: { filter, perPage: '1' } },
    );
    if (again.body.items?.length) return again.body.items[0]!;
    throw new Error(`could not create ${collection}: ${JSON.stringify(created)}`);
  }
  return created.body;
}

/**
 * A file PocketBase will accept as `video/mp4`. Its mime allowlist sniffs the
 * bytes rather than trusting the upload's declared type, so a buffer of zeros
 * is rejected — which is the allowlist working, and worth keeping.
 */
export function fakeMp4(size: number): Buffer {
  const ftyp = Buffer.concat([
    Buffer.from([0, 0, 0, 32]),
    Buffer.from('ftyp'),
    Buffer.from('mp42'),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('mp42isomavc1iso2'),
  ]);
  return Buffer.concat([ftyp, Buffer.alloc(Math.max(0, size - ftyp.length))]);
}

/** Uploads a clip the way the app will: multipart, against the file field. */
export async function uploadClip(
  rider: Rider,
  trickId: string,
  bytes: number,
): Promise<{ status: number; body: Record<string, string> }> {
  const form = new FormData();
  form.set('user', rider.id);
  form.set('trick', trickId);
  form.set('kind', 'video');
  form.set(
    'file',
    new Blob([new Uint8Array(fakeMp4(bytes))], { type: 'video/mp4' }),
    `clip-${rider.handle}-${uniq()}.mp4`,
  );

  const response = await fetch(new URL('/api/collections/clips/records', baseUrl()), {
    method: 'POST',
    headers: { Authorization: rider.token },
    body: form,
  });
  return { status: response.status, body: (await response.json()) as Record<string, string> };
}

export interface Fixtures {
  freeTrick: string;
  paidTrick: string;
  freeTrickSkate: string;
}

let fixtures: Promise<Fixtures> | null = null;

export function baseFixtures(): Promise<Fixtures> {
  fixtures ??= (async () => {
    // Rookie is the free plan; Shredder unlocks the paid tiers. The clip cap
    // and the paid-trick entitlement are read off these records by the hooks.
    await ensureRecord('plans', "slug = 'rookie'", {
      slug: 'rookie',
      name: 'Rookie',
      price_monthly: 'Free',
      unlocks_paid_tricks: false,
      clip_cap_bytes: 0,
      is_live: true,
    });
    await ensureRecord('plans', "slug = 'shredder'", {
      slug: 'shredder',
      name: 'Shredder',
      price_monthly: '£3.99',
      unlocks_paid_tricks: true,
      clip_cap_bytes: 2147483648,
      is_live: true,
    });
    await ensureRecord('plans', "slug = 'legend'", {
      slug: 'legend',
      name: 'Legend',
      price_monthly: '£6.99',
      unlocks_paid_tricks: true,
      clip_cap_bytes: 5368709120,
      // Insights are Legend's, read off the plan record (plan §2.4). Rookie and
      // Shredder leave it unset, which is `false` — the fail-closed direction.
      includes_insights: true,
      is_live: true,
    });

    const free = await ensureRecord('tricks', "slug = 'fixture-bunny-hop'", {
      slug: 'fixture-bunny-hop',
      name: 'Fixture Bunny Hop',
      sport: 'scooter',
      cat: 'flat',
      diff: 1,
      is_live: true,
    });
    const paid = await ensureRecord('tricks', "slug = 'fixture-backflip'", {
      slug: 'fixture-backflip',
      name: 'Fixture Backflip',
      sport: 'scooter',
      cat: 'air',
      diff: 5,
      is_live: true,
    });
    const freeSkate = await ensureRecord('tricks', "slug = 'fixture-ollie'", {
      slug: 'fixture-ollie',
      name: 'Fixture Ollie',
      sport: 'skate',
      cat: 'flat',
      diff: 1,
      is_live: true,
    });

    return { freeTrick: free.id, paidTrick: paid.id, freeTrickSkate: freeSkate.id };
  })();
  return fixtures;
}
