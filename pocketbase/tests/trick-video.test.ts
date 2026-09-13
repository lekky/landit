import { describe, expect, it } from 'vitest';

import { call, ensureRecord, superuser } from './helpers';

/**
 * `tricks.video_id`, `video_title` and `video_channel` exist, round-trip to a
 * signed-out reader, and are held to their rules on every write path (T35).
 *
 * Three things this proves that nothing else can.
 *
 * **The columns are real**, asserted over HTTP against the migrations, for the
 * reason `trick-supervise` gives: the rules layer is handed live rows, so a
 * field with no column reads as *no video* on every trick in the product and
 * the panel would simply never appear.
 *
 * **The stored value is always an id.** `youtubeEmbedUrl` throws on anything
 * that is not eleven characters, and the id goes into an `<iframe src>` on a
 * page built for children — so the guarantee that matters is that a pasted URL
 * comes back out of the database as an id, from a **superuser** token, which is
 * the write path the staff editor's own check cannot cover.
 *
 * **The word limits agree with `@landit/core`.** They are repeated in
 * `pocketbase/hooks/lib/landit.js`, which cannot import the package; if
 * `TRICK_VIDEO_LIMITS` and the constants in the hook drift apart, this is the
 * file that says so.
 */

const FIXTURE = {
  slug: 'fixture-video',
  name: 'Fixture Video',
  sport: 'bmx',
  cat: 'park',
  diff: 3,
  is_live: true,
};

const ID = 'dQw4w9WgXcQ';
const TITLE = 'How to Abubaca the easy way';

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

const fixture = () => ensureRecord('tricks', `slug = '${FIXTURE.slug}'`, FIXTURE);

describe('the staff-picked trick video', () => {
  it('is three text fields on the collection', async () => {
    const token = await superuser();
    const result = await call<{ fields: { name: string; type: string }[] }>(
      'GET',
      '/api/collections/tricks',
      { token },
    );

    expect(result.status).toBe(200);
    for (const name of ['video_id', 'video_title', 'video_channel']) {
      const field = result.body.fields.find((f) => f.name === name);
      expect(field, `tricks has no \`${name}\` field`).toBeDefined();
      expect(field?.type).toBe('text');
    }
  });

  it('stores the eleven-character id, whatever shape of link was pasted', async () => {
    const token = await superuser();
    const record = await fixture();

    for (const link of [
      `https://www.youtube.com/watch?v=${ID}&t=42s`,
      `https://youtu.be/${ID}?si=abcdef`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://m.youtube.com/watch?v=${ID}`,
      ID,
    ]) {
      const saved = await call<{ video_id: string }>(
        'PATCH',
        `/api/collections/tricks/records/${record.id}`,
        { token, body: { video_id: link, video_title: TITLE } },
      );
      expect(saved.status, `${link}: ${JSON.stringify(saved.body)}`).toBe(200);
      // Not "contains the id" — *is* the id. Nothing before it and nothing
      // after it: no query string, no tracking parameter, no second URL.
      expect(saved.body.video_id, link).toBe(ID);
    }
  });

  it('reaches a signed-out reader, because the panel is public', async () => {
    const token = await superuser();
    const record = await fixture();
    const saved = await call('PATCH', `/api/collections/tricks/records/${record.id}`, {
      token,
      body: { video_id: ID, video_title: TITLE, video_channel: 'Ride BMX' },
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);

    // No token at all. A visitor who arrived from a search for "how to abubaca"
    // gets the tutorial (owner, 2026-09-12, in chat), so it has to be readable
    // through the same public list rule the rest of the trick page uses.
    const rows = await call<{
      items: { video_id: string; video_title: string; video_channel: string }[];
    }>('GET', '/api/collections/tricks/records', {
      query: { filter: `slug = "${FIXTURE.slug}"`, perPage: '1' },
    });
    expect(rows.status).toBe(200);
    expect(rows.body.items[0]?.video_id).toBe(ID);
    expect(rows.body.items[0]?.video_title).toBe(TITLE);
    expect(rows.body.items[0]?.video_channel).toBe('Ride BMX');
  });

  it('accepts a trick with no video, which is most of them', async () => {
    const token = await superuser();
    const record = await fixture();
    const cleared = await call('PATCH', `/api/collections/tricks/records/${record.id}`, {
      token,
      body: { video_id: '', video_title: '', video_channel: '' },
    });
    expect(cleared.status, JSON.stringify(cleared.body)).toBe(200);
  });

  it('refuses each rule, even from a superuser', async () => {
    const token = await superuser();
    const record = await fixture();
    const patch = (body: Record<string, unknown>) =>
      call<{ message?: string }>('PATCH', `/api/collections/tricks/records/${record.id}`, {
        token,
        body,
      });

    // Start from no video, so each case below is the only thing wrong.
    await patch({ video_id: '', video_title: '', video_channel: '' });

    const cases: [string, Record<string, unknown>][] = [
      ['another host', { video_id: 'https://vimeo.com/12345', video_title: TITLE }],
      ['a javascript URL', { video_id: 'javascript:alert(1)', video_title: TITLE }],
      ['an id of the wrong length', { video_id: 'abc', video_title: TITLE }],
      ['a link with no title', { video_id: ID, video_title: '' }],
      ['a title with no link', { video_id: '', video_title: TITLE }],
      ['a channel with no link', { video_id: '', video_title: '', video_channel: 'Ride BMX' }],
      ['a title over 16 words', { video_id: ID, video_title: words(17) }],
      ['a channel over 6 words', { video_id: ID, video_title: TITLE, video_channel: words(7) }],
    ];

    for (const [label, body] of cases) {
      const result = await patch(body);
      expect(result.status, label).toBe(400);
    }

    // The edges are accepted, so the refusals above are the rule and not an
    // off-by-one against `TRICK_VIDEO_LIMITS`.
    const edge = await patch({
      video_id: ID,
      video_title: words(16),
      video_channel: words(6),
    });
    expect(edge.status, JSON.stringify(edge.body)).toBe(200);
  });
});
