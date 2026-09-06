import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { call, makeRider, superuser } from './helpers';

/**
 * "Where did you find us?" — `users.heard_about` (owner, 2026-09-06, in chat).
 *
 * The field is the smallest thing in the product that is still a fact about a
 * child, so the three properties worth proving are proven over HTTP with a
 * rider's own token, the way plan §3 asks:
 *
 *  1. **Only the nine.** It is a select, not a text field, so there is no write
 *     — however shaped — that can put a rider's own words in the column. That
 *     is the whole reason it was safe to keep at all, and a later migration
 *     that quietly widened it to `text` would pass every other test in the repo.
 *  2. **Write-once.** Onboarding fills an empty one; nothing rewrites an
 *     answer. A field that could be rewritten is no longer a record of how a
 *     rider arrived.
 *  3. **It leaves with them.** The export writes it out in words, and closing
 *     an account clears it — the two things every other rider fact has to do.
 */

const password = 'a-long-local-test-password';

const patch = (rider: { id: string; token: string }, body: Record<string, unknown>) =>
  call(`PATCH`, `/api/collections/users/records/${rider.id}`, { token: rider.token, body });

describe('answering it', () => {
  it('takes one of the nine, from the rider’s own token', async () => {
    const rider = await makeRider();

    const saved = await patch(rider, { heard_about: 'skatepark' });

    expect(saved.status).toBe(200);
    expect(saved.body.heard_about).toBe('skatepark');
  });

  it('refuses anything that is not on the list, including free text', async () => {
    const rider = await makeRider();

    // The point of the select. `'my mate Ollie from school'` is exactly the
    // shape of thing this column must never be able to hold.
    const invented = await patch(rider, { heard_about: 'my mate Ollie from school' });
    expect(invented.status).toBe(400);

    const stored = await call<{ heard_about: string }>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      { token: rider.token },
    );
    expect(stored.body.heard_about).toBe('');
  });

  it('is allowed to stay unanswered, because skipping the question is a choice', async () => {
    const rider = await makeRider();

    // Onboarding sends every other profile field whether or not this one was
    // tapped, so "finish without answering" has to be an ordinary write.
    const finished = await patch(rider, { level: 'some', onboarded: true });

    expect(finished.status).toBe(200);
    expect(finished.body.heard_about).toBe('');
  });
});

describe('answering it twice', () => {
  it('is refused once there is an answer', async () => {
    const rider = await makeRider();
    expect((await patch(rider, { heard_about: 'youtube' })).status).toBe(200);

    const again = await patch(rider, { heard_about: 'tiktok' });

    expect(again.status).toBe(403);

    const stored = await call<{ heard_about: string }>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      { token: rider.token },
    );
    expect(stored.body.heard_about).toBe('youtube');
  });

  it('does not stand in the way of an ordinary profile edit', async () => {
    const rider = await makeRider();
    await patch(rider, { heard_about: 'friend' });

    // The guard compares against what is stored, so a form that posts the whole
    // profile back — including the answer it already has — is not a rewrite.
    const edit = await patch(rider, { heard_about: 'friend', town: 'Bristol' });

    expect(edit.status).toBe(200);
    expect(edit.body.town).toBe('Bristol');
  });
});

describe('it leaves with the rider', () => {
  it('is in the data export, written as words', async () => {
    const rider = await makeRider();
    await patch(rider, { heard_about: 'coach' });

    const exported = await call<{ account: Record<string, unknown> }>(
      'POST',
      '/api/landit/account/export',
      { token: rider.token, body: {} },
    );

    expect(exported.status).toBe(200);
    expect(exported.body.account.heard_about).toBe('A coach, club or lesson');
  });

  it('is cleared when the account is closed', async () => {
    const rider = await makeRider();
    await patch(rider, { heard_about: 'instagram' });

    const closed = await call('POST', '/api/landit/account/delete', {
      token: rider.token,
      body: { password, confirm: 'DELETE' },
    });
    expect(closed.status).toBe(200);

    // Read as a superuser: an anonymised row is private and suspended, so the
    // rider's own token cannot fetch it any more and neither can a stranger.
    const after = await call<{ heard_about: string }>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      { token: await superuser() },
    );
    // The row survives (deletion is anonymise-and-retain), so the answer has to
    // be gone from it rather than gone with it.
    expect(after.body.heard_about ?? '').toBe('');
  });
});

describe('the nine, in the three places they are written', () => {
  it('says the same thing in core, in the migration and in the export labels', () => {
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
    const migration = read('../migrations/1788307200_users_heard_about.js');
    const core = read('../../packages/core/src/data/profile.ts');
    const labels = read('../hooks/lib/labels.js');

    for (const id of [
      'friend',
      'skatepark',
      'youtube',
      'tiktok',
      'instagram',
      'coach',
      'family',
      'search',
      'elsewhere',
    ]) {
      expect(migration).toContain(`'${id}'`);
      expect(core).toContain(`id: '${id}'`);
      expect(labels).toContain(`${id}:`);
    }
  });
});
