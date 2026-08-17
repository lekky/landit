import { beforeAll, describe, expect, it } from 'vitest';

import {
  baseFixtures,
  baseUrl,
  call,
  makeRider,
  superuser,
  uploadClip,
  type Rider,
} from './helpers';

/**
 * Plan §3, guarantee 2 — clips are never public.
 *
 * Two locks, and the test proves both: the collection's rules never let another
 * rider see the record, and the file field is `protected`, so the bytes only
 * come out against a short-lived token minted for the owner. The privacy policy
 * in the handoff makes this promise to parents; it has to be true of the API.
 */
async function fileToken(token: string): Promise<string> {
  const result = await call<{ token: string }>('POST', '/api/files/token', { token });
  return result.body.token;
}

describe('guarantee 2 — a clip never becomes public', () => {
  let owner: Rider;
  let stranger: Rider;
  let clipId: string;
  let clipFile: string;

  beforeAll(async () => {
    const fixtures = await baseFixtures();
    owner = await makeRider({}, { plan: 'shredder', consent_state: 'not_required' });
    stranger = await makeRider({ privacy: 'public' }, { consent_state: 'not_required' });

    const created = await uploadClip(owner, fixtures.freeTrick, 1024);
    expect(created.status).toBe(200);
    clipId = created.body.id!;
    clipFile = created.body.file!;
  });

  it('hides the clip record from a signed-out visitor', async () => {
    const result = await call('GET', `/api/collections/clips/records/${clipId}`);
    expect(result.status).toBe(404);
  });

  it('hides the clip record from every other rider', async () => {
    const result = await call('GET', `/api/collections/clips/records/${clipId}`, {
      token: stranger.token,
    });
    expect(result.status).toBe(404);

    const listed = await call<{ items: unknown[] }>('GET', '/api/collections/clips/records', {
      token: stranger.token,
      query: { perPage: '200' },
    });
    expect(listed.body.items).toHaveLength(0);
  });

  it('refuses the file bytes with no token at all', async () => {
    const response = await fetch(new URL(`/api/files/clips/${clipId}/${clipFile}`, baseUrl()));
    expect(response.ok).toBe(false);
    expect([400, 403, 404]).toContain(response.status);
  });

  it('refuses the file bytes to a token minted for a different rider', async () => {
    const theirToken = await fileToken(stranger.token);
    const response = await fetch(
      new URL(`/api/files/clips/${clipId}/${clipFile}?token=${theirToken}`, baseUrl()),
    );
    expect(response.ok).toBe(false);
    expect([400, 403, 404]).toContain(response.status);
  });

  it('refuses the file bytes to a forged token', async () => {
    const response = await fetch(
      new URL(`/api/files/clips/${clipId}/${clipFile}?token=not-a-real-token`, baseUrl()),
    );
    expect(response.ok).toBe(false);
  });

  it('serves the file bytes to the owner’s own short-lived token', async () => {
    const ownToken = await fileToken(owner.token);
    const response = await fetch(
      new URL(`/api/files/clips/${clipId}/${clipFile}?token=${ownToken}`, baseUrl()),
    );
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(1024);
  });

  it('refuses to save a clip at all on the free plan', async () => {
    const fixtures = await baseFixtures();
    const rookie = await makeRider({}, { plan: 'rookie', consent_state: 'not_required' });
    const attempt = await uploadClip(rookie, fixtures.freeTrick, 512);
    expect(attempt.status).toBe(403);
  });

  it('holds a paid rider to the cap on their plan record', async () => {
    const fixtures = await baseFixtures();

    // Shrink a cap rather than uploading gigabytes: the point being proven is
    // that the number is read off the `plans` record at write time, so staff can
    // tune it without a deploy (plan §6.6). `legend` is used by no other test —
    // this file holds that lever, and the whole suite shares one instance, so a
    // second file shrinking it would race this one. `clip-vault.test.ts` fills a
    // rider's vault instead of moving a plan, for exactly that reason
    // (LESSONS §5).
    const token = await superuser();
    const plans = await call<{ items: { id: string }[] }>('GET', '/api/collections/plans/records', {
      token,
      query: { filter: "slug = 'legend'" },
    });
    await call('PATCH', `/api/collections/plans/records/${plans.body.items[0]!.id}`, {
      token,
      body: { clip_cap_bytes: 2048 },
    });

    const capped = await makeRider({}, { plan: 'legend', consent_state: 'not_required' });

    const first = await uploadClip(capped, fixtures.freeTrick, 1500);
    expect(first.status).toBe(200);

    const second = await uploadClip(capped, fixtures.freeTrickSkate, 1500);
    expect(second.status).toBe(403);
  });
});
