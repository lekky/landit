import { beforeAll, describe, expect, it } from 'vitest';

import {
  baseFixtures,
  call,
  makeRider,
  superuser,
  uploadClip,
  type Fixtures,
  type Rider,
} from './helpers';

/**
 * The clip vault (plan §6.6), as observed API behaviour.
 *
 * `guarantee-2-clips.test.ts` proves the bytes never become public. This file
 * proves the other half of the same decision: how much a rider may store, who
 * decides it, and what happens at the cap.
 *
 * **How the vault is filled without moving gigabytes.** A superuser can create
 * a `clips` row that declares a `size` and carries no file — the request hook
 * only takes the size *from* an uploaded file when there is one. That plants a
 * near-full vault in one request, and it is also the sharpest form of the
 * question the cap has to answer: the row still goes through
 * `enforceClipCap` at the **model** layer, so a caller holding a superuser
 * token is held to the same number as a browser (plan §3, §6.6). Nothing here
 * touches a `plans` record, so this file cannot race the cap that
 * `guarantee-2-clips.test.ts` shrinks.
 */

const GB = 1073741824;

/** Plants a clip row of a declared size against a rider, as staff tooling would. */
async function plantClip(rider: Rider, trickId: string, size: number) {
  return call<{ id: string; message: string }>('POST', '/api/collections/clips/records', {
    token: await superuser(),
    body: { user: rider.id, trick: trickId, kind: 'video', size },
  });
}

describe('the clip vault holds the cap on its plan record', () => {
  let fixtures: Fixtures;
  let rider: Rider;
  let plantedId: string;

  beforeAll(async () => {
    fixtures = await baseFixtures();
    // Shredder's fixture cap is the real 2GB from plan §2.4.
    rider = await makeRider({}, { plan: 'shredder', consent_state: 'not_required' });

    const planted = await plantClip(rider, fixtures.freeTrick, 2 * GB - 4096);
    expect(planted.status).toBe(200);
    plantedId = planted.body.id;
  });

  it('accepts a clip that still fits under the cap', async () => {
    const result = await uploadClip(rider, fixtures.freeTrick, 1024);
    expect(result.status).toBe(200);
  });

  it('refuses the clip that would cross it, and says why in a sentence', async () => {
    const result = await uploadClip(rider, fixtures.freeTrickSkate, 8192);
    expect(result.status).toBe(403);
    expect(result.body.message).toMatch(/2GB clip vault/);
  });

  it('refuses a caller holding a superuser token exactly the same way', async () => {
    // The point of the model layer: a server action with the superuser client
    // is not a way past the cap (plan §3, "including with a superuser token").
    const result = await plantClip(rider, fixtures.freeTrick, 8192);
    expect(result.status).toBe(403);
  });

  it('gives the space back when a clip is deleted', async () => {
    const blocked = await uploadClip(rider, fixtures.freeTrick, 8192);
    expect(blocked.status).toBe(403);

    const deleted = await call('DELETE', `/api/collections/clips/records/${plantedId}`, {
      token: rider.token,
    });
    expect(deleted.status).toBe(204);

    const afterwards = await uploadClip(rider, fixtures.freeTrick, 8192);
    expect(afterwards.status).toBe(200);
  });
});

describe('a rider who drops back to the free plan', () => {
  let fixtures: Fixtures;
  let rider: Rider;
  let clipId: string;

  beforeAll(async () => {
    fixtures = await baseFixtures();
    rider = await makeRider({}, { plan: 'shredder', consent_state: 'not_required' });

    const saved = await uploadClip(rider, fixtures.freeTrick, 2048);
    expect(saved.status).toBe(200);
    clipId = saved.body.id!;

    // The downgrade, done the only way it can be: from the server.
    const downgraded = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: await superuser(),
      body: { plan: 'rookie' },
    });
    expect(downgraded.status).toBe(200);
  });

  it('keeps the clips they already saved', async () => {
    // Plan §6.6's retention default: a downgrade blocks new saves, it does not
    // take away what is already there. Nothing in the read path consults a
    // plan, which is what makes this true rather than merely intended.
    const listed = await call<{ items: unknown[] }>('GET', '/api/collections/clips/records', {
      token: rider.token,
    });
    expect(listed.status).toBe(200);
    expect(listed.body.items.length).toBeGreaterThan(0);

    const one = await call('GET', `/api/collections/clips/records/${clipId}`, {
      token: rider.token,
    });
    expect(one.status).toBe(200);
  });

  it('can still delete one', async () => {
    const rider2 = await makeRider({}, { plan: 'shredder', consent_state: 'not_required' });
    const saved = await uploadClip(rider2, fixtures.freeTrick, 2048);
    await call('PATCH', `/api/collections/users/records/${rider2.id}`, {
      token: await superuser(),
      body: { plan: 'rookie' },
    });

    const deleted = await call('DELETE', `/api/collections/clips/records/${saved.body.id}`, {
      token: rider2.token,
    });
    expect(deleted.status).toBe(204);
  });

  it('cannot save a new one', async () => {
    const result = await uploadClip(rider, fixtures.freeTrickSkate, 1024);
    expect(result.status).toBe(403);
    expect(result.body.message).toMatch(/paid plans/i);
  });
});

describe('what a clip record says is the server’s answer, not the client’s', () => {
  let fixtures: Fixtures;
  let rider: Rider;

  beforeAll(async () => {
    fixtures = await baseFixtures();
    rider = await makeRider({}, { plan: 'shredder', consent_state: 'not_required' });
  });

  it('takes the size from the uploaded file, not from the body', async () => {
    // A client-set size is a client-set cap: understate it and the vault never
    // fills. The declared 1 below is ignored.
    const result = await uploadClip(rider, fixtures.freeTrick, 4096, { fields: { size: '1' } });
    expect(result.status).toBe(200);
    expect(Number(result.body.size)).toBe(4096);
  });

  it('files the clip against the caller, and refuses one filed against anybody else', async () => {
    const mine = await uploadClip(rider, fixtures.freeTrick, 1024);
    expect(mine.status).toBe(200);
    expect(mine.body.user).toBe(rider.id);

    // Spending somebody else's vault, and putting a video in a row its owner
    // never uploaded, are the same request. The collection's `createRule`
    // refuses it outright — a 400 rather than the hook's 403, because the rule
    // is reached before the hook that would have corrected the field.
    const other = await makeRider({}, { plan: 'shredder', consent_state: 'not_required' });
    const theirs = await uploadClip(rider, fixtures.freeTrick, 1024, {
      fields: { user: other.id },
    });
    expect(theirs.status).toBe(400);

    const theirVault = await call<{ items: { id: string }[] }>(
      'GET',
      '/api/collections/clips/records',
      { token: other.token },
    );
    expect(theirVault.body.items).toHaveLength(0);
  });

  it('reads photo or video off the stored file rather than the declared kind', async () => {
    const photo = await uploadClip(rider, fixtures.freeTrick, 2048, {
      as: 'photo',
      fields: { kind: 'video' },
    });
    expect(photo.status).toBe(200);
    expect(photo.body.kind).toBe('photo');

    const video = await uploadClip(rider, fixtures.freeTrick, 2048, { fields: { kind: 'photo' } });
    expect(video.status).toBe(200);
    expect(video.body.kind).toBe('video');
  });

  it('stamps the date with the server clock, not the one the client sent', async () => {
    const result = await uploadClip(rider, fixtures.freeTrick, 1024, {
      fields: { at: '1999-01-01 00:00:00.000Z' },
    });
    expect(result.status).toBe(200);
    const at = result.body.at!;
    expect(at).not.toMatch(/^1999/);
    expect(at.slice(0, 4)).toBe(String(new Date().getUTCFullYear()));
  });
});
