import { beforeAll, describe, expect, it } from 'vitest';

import { baseFixtures, call, makeRider, superuser, type Rider } from './helpers';

/**
 * Plan §3, **guarantee 2 — the link half** (T15b).
 *
 * Riders paste a YouTube link and Land The Trick embeds it. The guarantee has three
 * properties and every one of them is asserted here as **observed API
 * behaviour** rather than as rule text (LESSONS §5):
 *
 * 1. **A signed-out visitor never sees a rider's video.** Not "unless", not "by
 *    default". There is no `public` visibility for an anonymous request to
 *    match, so the rule has no arm that can return one.
 * 2. **Profile privacy is a ceiling, not a default.** A video may be more
 *    private than its owner's profile and never more public — so a `members`
 *    video on a `private` profile is invisible to everyone but its owner, and
 *    the full matrix below is run against **both** profile settings.
 * 3. **What is stored is a parsed id, never a URL.** Enforced at the model
 *    layer, so it holds against a superuser token too — which is the only way to
 *    tell a hook that sits in the write path from one that sits in the request
 *    path.
 *
 * Plus the entitlement: the cap is read off the `plans` record, `0` means none,
 * unlimited is expressible, a missing plan fails closed, and none of it can be
 * exceeded by a caller holding a superuser client.
 *
 * **On fixtures.** Nothing here shrinks a shared `plans` row to make a cap
 * reachable — that is the trap LESSONS §5 records, and it is how two test files
 * come to depend on which one ran first. The cap is read off the record and the
 * *rider* is filled up to it.
 *
 * ---
 *
 * **Which door each test is standing in** (LESSONS §5: a passing test tells you
 * an outcome held, never why). Every guard here was removed in turn and the
 * failures counted, so the map below is observed rather than assumed:
 *
 * | Guard removed | Red |
 * | --- | --- |
 * | The `visibility = 'members'` conjunction in the view rule (plus the signed-out arm restored, i.e. written as plain `privacyRule`) | **9** — every signed-out test, every "and not the private one" test, and the three add/change tests |
 * | The `user.privacy` conjunction — a rule that honours the video's setting and ignores the profile | **1**, "THE CEILING", and nothing else |
 * | `parseYouTubeVideoId` in the hook (field stored raw) | **4**, all in the parsed-id block |
 * | The row count in the cap check (`held = 0`) | **3** — the fill/refuse tests |
 * | The whole cap block | **5** — the three above plus both zero-allowance tests |
 *
 * Two of those rows are the interesting ones and they are why the table is here.
 * **"THE CEILING" is the only test that fails when the profile half of the rule
 * goes**, and it is *green* against a rule that has lost the video half — so it
 * is not a test of the visibility rule in general, it is a test of one clause.
 * And **"gives a Rookie rider none" survives `held = 0`**, because `0 < 0` is
 * false either way: it stands in the `cap === 0` door, not the counting door.
 * A session tightening or loosening either mechanism should read this table
 * before assuming a green run covered it.
 */

const VIDEO = 'dQw4w9WgXcQ';
const VIDEO_TWO = 'oHg5SJYRHA0';

interface ClipRow {
  id: string;
  user: string;
  trick: string;
  video_id: string;
  visibility: string;
  at: string;
}

interface ListBody {
  items: ClipRow[];
}

/**
 * POST a link as a rider, the way the app does: **the raw paste, not an id.**
 *
 * `user` is in the body because the `clips` create rule is evaluated against the
 * submitted data (`user = @request.auth.id`), the same as `event_attendance` and
 * `trick_notes`. The hook overwrites it from the token regardless, which is what
 * the "somebody else's profile" test below exercises by lying about it.
 */
function addLink(
  rider: Rider,
  body: Record<string, unknown>,
): Promise<{ status: number; body: ClipRow }> {
  return call<ClipRow>('POST', '/api/collections/clips/records', {
    token: rider.token,
    body: { user: rider.id, ...body },
  });
}

async function planCap(slug: string): Promise<{ cap: number; unlimited: boolean }> {
  const token = await superuser();
  const result = await call<{
    items: { video_link_cap: number; video_links_unlimited: boolean }[];
  }>('GET', '/api/collections/plans/records', { token, query: { filter: `slug='${slug}'` } });
  const record = result.body.items[0];
  if (!record) throw new Error(`no ${slug} plan record`);
  return { cap: record.video_link_cap, unlimited: record.video_links_unlimited };
}

describe('guarantee 2 — a video link is never more visible than the rider', () => {
  let trick: string;

  /** Paid-plan riders, one per profile-privacy setting, each with two videos. */
  let publicRider: Rider;
  let membersRider: Rider;
  let privateRider: Rider;

  /** Who is looking. */
  let stranger: Rider;
  let crewmate: Rider;
  let consentLimited: Rider;

  const videos: Record<string, { members: string; private: string }> = {};

  beforeAll(async () => {
    const fixtures = await baseFixtures();
    trick = fixtures.freeTrick;

    // Legend, so the cap is never what refuses a visibility test.
    const paid = { plan: 'legend', consent_state: 'not_required' };

    publicRider = await makeRider({ privacy: 'public' }, paid);
    membersRider = await makeRider({ privacy: 'members' }, paid);
    privateRider = await makeRider({ privacy: 'private' }, paid);

    stranger = await makeRider({ privacy: 'public' }, { consent_state: 'not_required' });
    crewmate = await makeRider({ privacy: 'public' }, { consent_state: 'not_required' });
    consentLimited = await makeRider({ privacy: 'public' }, { consent_state: 'pending' });

    for (const rider of [publicRider, membersRider, privateRider]) {
      const openOne = await addLink(rider, {
        video_id: `https://www.youtube.com/watch?v=${VIDEO}`,
        trick,
        visibility: 'members',
      });
      const shutOne = await addLink(rider, {
        video_id: `https://youtu.be/${VIDEO_TWO}`,
        trick,
        visibility: 'private',
      });
      expect(openOne.status, JSON.stringify(openOne.body)).toBe(200);
      expect(shutOne.status, JSON.stringify(shutOne.body)).toBe(200);
      videos[rider.id] = { members: openOne.body.id, private: shutOne.body.id };
    }

    // A crew both of them are in. §6.1: the only way in is a code, so the crew
    // is made and joined the way the product makes and joins one.
    const crew = await call<{ id: string }>('POST', '/api/collections/crews/records', {
      token: membersRider.token,
      body: { name: `Video Crew ${Date.now()}` },
    });
    expect(crew.status).toBe(200);
    const invite = await call<{ code: string }>('POST', '/api/collections/crew_invites/records', {
      token: membersRider.token,
      body: { crew: crew.body.id, max_uses: 5 },
    });
    expect(invite.status).toBe(200);
    const joined = await call('POST', '/api/landit/crews/join', {
      token: crewmate.token,
      body: { code: invite.body.code },
    });
    expect(joined.status).toBe(200);
  });

  // ------------------------------------------------------------ signed out --

  it('shows a signed-out visitor nothing, on a public profile, with a members video', async () => {
    // The strongest case for the absent rule arm: the most open profile there
    // is, and a video its owner deliberately opened. Still nothing, because
    // `public` is not a state a video can be in.
    const listed = await call<ListBody>('GET', '/api/collections/clips/records', {
      query: { perPage: '200' },
    });
    expect(listed.status).toBe(200);
    expect(listed.body.items).toHaveLength(0);
  });

  it('404s a members video to a signed-out visitor asked for by id', async () => {
    // A list that comes back empty could be an empty collection. This one names
    // the row, so it cannot.
    const direct = await call(
      'GET',
      `/api/collections/clips/records/${videos[publicRider.id]!.members}`,
    );
    expect(direct.status).toBe(404);
  });

  // ---------------------------------------------------------------- owner ---

  it('shows a rider both of their own videos, whatever their profile says', async () => {
    for (const rider of [publicRider, membersRider, privateRider]) {
      const own = await call<ListBody>('GET', '/api/collections/clips/records', {
        token: rider.token,
        query: { perPage: '200', filter: `user='${rider.id}'` },
      });
      expect(own.status).toBe(200);
      expect(own.body.items.map((row) => row.id).sort()).toEqual(
        [videos[rider.id]!.members, videos[rider.id]!.private].sort(),
      );
    }
  });

  it('refuses a consent-limited rider a video link at all', async () => {
    // Guarantee 4. A video link is a way of being *seen*, so it belongs on the
    // list of things an account waiting on a guardian may not do — beside crews,
    // spots, attendance and subscriptions. The refusal is the `clips` create
    // rule's (`OWN_AND_CONSENTED`), which is why the status is a 400 from the
    // rule rather than a 403 from a hook, the same as the other rule-level
    // refusals in `guarantee-4-consent.test.ts`.
    const added = await addLink(consentLimited, {
      video_id: VIDEO,
      trick,
      visibility: 'members',
    });
    expect(added.status).toBe(400);

    // What they keep is what guarantee 4 says they keep: their own data stays
    // theirs. A rider who added a video and *then* fell behind the gate can
    // still read it — asserted in "hides a members video belonging to a
    // consent-limited rider" below, from the other side.
  });

  // ------------------------------------------- signed in, public profile ----

  it('shows a signed-in rider the members video on a public profile — and not the private one', async () => {
    const seen = await call<ListBody>('GET', '/api/collections/clips/records', {
      token: stranger.token,
      query: { perPage: '200', filter: `user='${publicRider.id}'` },
    });
    expect(seen.status).toBe(200);
    expect(seen.body.items.map((row) => row.id)).toEqual([videos[publicRider.id]!.members]);
  });

  it('404s the private video on a public profile to another rider', async () => {
    const direct = await call(
      'GET',
      `/api/collections/clips/records/${videos[publicRider.id]!.private}`,
      { token: stranger.token },
    );
    expect(direct.status).toBe(404);
  });

  // ------------------------------------------ signed in, members profile ----

  it('shows the members video on a members profile to a signed-in stranger', async () => {
    const seen = await call<ListBody>('GET', '/api/collections/clips/records', {
      token: stranger.token,
      query: { perPage: '200', filter: `user='${membersRider.id}'` },
    });
    expect(seen.body.items.map((row) => row.id)).toEqual([videos[membersRider.id]!.members]);
  });

  it('shows a crewmate exactly what any other signed-in rider sees, and no more', async () => {
    // Being crewed with somebody is not a key. Guarantee 1 gives a crew board a
    // narrow server-shaped payload precisely so that membership never widens a
    // collection rule, and video links inherit that: a crewmate is a signed-in
    // rider and nothing else.
    const asCrewmate = await call<ListBody>('GET', '/api/collections/clips/records', {
      token: crewmate.token,
      query: { perPage: '200', filter: `user='${membersRider.id}'` },
    });
    const asStranger = await call<ListBody>('GET', '/api/collections/clips/records', {
      token: stranger.token,
      query: { perPage: '200', filter: `user='${membersRider.id}'` },
    });
    expect(asCrewmate.body.items.map((row) => row.id)).toEqual(
      asStranger.body.items.map((row) => row.id),
    );
    expect(asCrewmate.body.items.map((row) => row.id)).not.toContain(
      videos[membersRider.id]!.private,
    );
  });

  // ------------------------------------------ signed in, private profile ----

  it('THE CEILING: hides a members video on a private profile from every other rider', async () => {
    // The property the whole guarantee turns on. The rider opened the video and
    // the profile is shut, and the profile wins — a per-video setting can only
    // ever make a video *more* private than the profile it hangs off.
    for (const viewer of [stranger, crewmate]) {
      const listed = await call<ListBody>('GET', '/api/collections/clips/records', {
        token: viewer.token,
        query: { perPage: '200', filter: `user='${privateRider.id}'` },
      });
      expect(listed.status).toBe(200);
      expect(listed.body.items).toHaveLength(0);

      const direct = await call(
        'GET',
        `/api/collections/clips/records/${videos[privateRider.id]!.members}`,
        { token: viewer.token },
      );
      expect(direct.status).toBe(404);
    }

    // …and its owner still sees it, so the row is genuinely there to be hidden.
    const owner = await call(
      'GET',
      `/api/collections/clips/records/${videos[privateRider.id]!.members}`,
      { token: privateRider.token },
    );
    expect(owner.status).toBe(200);
  });

  it('hides a members video belonging to a consent-limited rider', async () => {
    // Guarantee 4 the other way round: a rider waiting on a guardian reads as
    // private whatever they chose, so nothing of theirs surfaces to anyone.
    const held = await makeRider(
      { privacy: 'public' },
      { plan: 'legend', consent_state: 'not_required' },
    );
    const added = await addLink(held, { video_id: VIDEO, trick, visibility: 'members' });
    expect(added.status).toBe(200);

    // Visible first, so the assertion below is about the state change and not
    // about a row that was never readable.
    const before = await call('GET', `/api/collections/clips/records/${added.body.id}`, {
      token: stranger.token,
    });
    expect(before.status).toBe(200);

    await call('PATCH', `/api/collections/users/records/${held.id}`, {
      token: await superuser(),
      body: { consent_state: 'pending' },
    });

    const after = await call('GET', `/api/collections/clips/records/${added.body.id}`, {
      token: stranger.token,
    });
    expect(after.status).toBe(404);
  });

  it('hides a members video belonging to a suspended rider', async () => {
    const held = await makeRider(
      { privacy: 'public' },
      { plan: 'legend', consent_state: 'not_required' },
    );
    const added = await addLink(held, { video_id: VIDEO, trick, visibility: 'members' });
    expect(added.status).toBe(200);

    await call('PATCH', `/api/collections/users/records/${held.id}`, {
      token: await superuser(),
      body: { suspended: true },
    });

    const after = await call('GET', `/api/collections/clips/records/${added.body.id}`, {
      token: stranger.token,
    });
    expect(after.status).toBe(404);
  });

  // ------------------------------------------------------- what a rider does --

  it('defaults a video to private when the request names no visibility', async () => {
    // Children's code standard 7 (plan §6.4): the *value* private, not merely
    // "not public", and decided on the server rather than by whatever an omitted
    // field happens to mean.
    const rider = await makeRider(
      { privacy: 'public' },
      { plan: 'legend', consent_state: 'not_required' },
    );
    const added = await addLink(rider, { video_id: VIDEO, trick });
    expect(added.status).toBe(200);
    expect(added.body.visibility).toBe('private');

    const seen = await call('GET', `/api/collections/clips/records/${added.body.id}`, {
      token: stranger.token,
    });
    expect(seen.status).toBe(404);
  });

  it('turns a request for `public` into `private`, because there is no such state', async () => {
    // Not a 400, and the observed behaviour is the better one: the hook
    // normalises anything that is not exactly `members` before the write
    // commits, so a client that still believes in the three-way model — an old
    // build, a hand-rolled request — gets the *most private* state rather than an
    // error, and certainly rather than a public video. Fail-closed beats
    // fail-loud on a visibility field.
    const rider = await makeRider(
      { privacy: 'public' },
      { plan: 'legend', consent_state: 'not_required' },
    );
    const added = await addLink(rider, { video_id: VIDEO, trick, visibility: 'public' });
    expect(added.status).toBe(200);
    expect(added.body.visibility).toBe('private');

    // And the consequence, which is the part that matters.
    expect((await call('GET', `/api/collections/clips/records/${added.body.id}`)).status).toBe(404);
    expect(
      (
        await call('GET', `/api/collections/clips/records/${added.body.id}`, {
          token: stranger.token,
        })
      ).status,
    ).toBe(404);
  });

  it('lets a rider change one of their videos from private to members, and back', async () => {
    const rider = await makeRider(
      { privacy: 'public' },
      { plan: 'legend', consent_state: 'not_required' },
    );
    const added = await addLink(rider, { video_id: VIDEO, trick });
    expect(added.body.visibility).toBe('private');

    const opened = await call<ClipRow>('PATCH', `/api/collections/clips/records/${added.body.id}`, {
      token: rider.token,
      body: { visibility: 'members' },
    });
    expect(opened.status).toBe(200);
    expect(opened.body.visibility).toBe('members');
    expect(
      (
        await call('GET', `/api/collections/clips/records/${added.body.id}`, {
          token: stranger.token,
        })
      ).status,
    ).toBe(200);

    const shut = await call<ClipRow>('PATCH', `/api/collections/clips/records/${added.body.id}`, {
      token: rider.token,
      body: { visibility: 'private' },
    });
    expect(shut.status).toBe(200);
    expect(
      (
        await call('GET', `/api/collections/clips/records/${added.body.id}`, {
          token: stranger.token,
        })
      ).status,
    ).toBe(404);
  });

  it('lets a rider remove their own video and nobody else remove it', async () => {
    const rider = await makeRider(
      { privacy: 'public' },
      { plan: 'legend', consent_state: 'not_required' },
    );
    const added = await addLink(rider, { video_id: VIDEO, trick, visibility: 'members' });

    const byStranger = await call('DELETE', `/api/collections/clips/records/${added.body.id}`, {
      token: stranger.token,
    });
    expect(byStranger.status).toBe(404);

    const byOwner = await call('DELETE', `/api/collections/clips/records/${added.body.id}`, {
      token: rider.token,
    });
    expect(byOwner.status).toBe(204);
  });

  it('will not let a rider add a video to somebody else’s profile', async () => {
    const added = await addLink(stranger, {
      video_id: VIDEO,
      trick,
      user: publicRider.id,
      visibility: 'members',
    });
    // The request hook overwrites `user` from the token, so either the write is
    // refused or it lands on the caller. What must never happen is a row
    // belonging to the rider named in the body.
    if (added.status === 200) expect(added.body.user).toBe(stranger.id);
    else expect([400, 403]).toContain(added.status);
  });

  it('will not let a rider swap the video behind an existing row', async () => {
    const rider = await makeRider(
      { privacy: 'public' },
      { plan: 'legend', consent_state: 'not_required' },
    );
    const added = await addLink(rider, { video_id: VIDEO, trick, visibility: 'members' });

    const swapped = await call('PATCH', `/api/collections/clips/records/${added.body.id}`, {
      token: rider.token,
      body: { video_id: VIDEO_TWO },
    });
    expect(swapped.status).toBe(403);

    const unchanged = await call<ClipRow>(
      'GET',
      `/api/collections/clips/records/${added.body.id}`,
      { token: rider.token },
    );
    expect(unchanged.body.video_id).toBe(VIDEO);
  });
});

describe('guarantee 2 — only a parsed YouTube id is ever stored', () => {
  let trick: string;
  let rider: Rider;

  beforeAll(async () => {
    trick = (await baseFixtures()).freeTrick;
    rider = await makeRider(
      { privacy: 'public' },
      { plan: 'legend', consent_state: 'not_required' },
    );
  });

  it('puts a rider’s video links in their data export', async () => {
    // T18 shipped `POST /api/landit/account/export` naming each collection's
    // fields explicitly, so that a field added later is a decision rather than an
    // accident. This is that decision being made: a download that omitted the
    // videos a rider linked would not be "everything we hold about you", which is
    // what the privacy policy promises. Asserted here rather than in
    // `account-erasure.test.ts` because the row is this feature's, not that one's.
    const owner = await makeRider(
      { privacy: 'public' },
      { plan: 'legend', consent_state: 'not_required' },
    );
    const added = await addLink(owner, { video_id: VIDEO, trick, visibility: 'members' });
    expect(added.status).toBe(200);

    const exported = await call<{ clips?: { video_id?: string; visibility?: string }[] }>(
      'POST',
      '/api/landit/account/export',
      { token: owner.token, body: {} },
    );
    expect(exported.status).toBe(200);
    const rows = exported.body.clips ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.video_id).toBe(VIDEO);
    expect(rows[0]!.visibility).toBe('members');
  });

  it('stores eleven characters, whatever shape the link arrived in', async () => {
    const shapes = [
      `https://www.youtube.com/watch?v=${VIDEO}&t=42s&list=PLnope`,
      `https://youtu.be/${VIDEO}?si=tracking_value`,
      `https://www.youtube.com/shorts/${VIDEO}`,
      `youtube.com/watch?v=${VIDEO}`,
      VIDEO,
    ];
    for (const link of shapes) {
      const added = await addLink(rider, { video_id: link, trick, visibility: 'private' });
      expect(added.status).toBe(200);
      expect(added.body.video_id).toBe(VIDEO);
      await call('DELETE', `/api/collections/clips/records/${added.body.id}`, {
        token: rider.token,
      });
    }
  });

  it('refuses everything that is not a YouTube link', async () => {
    const refused = [
      'https://vimeo.com/123456789',
      'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com@evil.example/watch?v=dQw4w9WgXcQ',
      'javascript:alert(1)',
      'https://www.youtube.com/watch?v=tooshort',
      '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
      '',
    ];
    for (const link of refused) {
      const added = await addLink(rider, { video_id: link, trick, visibility: 'private' });
      expect(added.status, `should have refused ${JSON.stringify(link)}`).toBe(400);
    }
  });

  it('refuses a hostile link handed in with a SUPERUSER token', async () => {
    // The property that separates a model-layer hook from a request-layer one.
    // Admin writes go through server actions holding this client (plan §3), so a
    // check that stepped aside for it would leave the parser optional on our own
    // most privileged path.
    const added = await call<ClipRow>('POST', '/api/collections/clips/records', {
      token: await superuser(),
      body: {
        user: rider.id,
        trick,
        video_id: 'https://evil.example/steal?next=https://youtu.be/dQw4w9WgXcQ',
        visibility: 'private',
      },
    });
    expect(added.status).toBe(400);
  });

  it('normalises a good link handed in with a superuser token, rather than trusting it', async () => {
    const added = await call<ClipRow>('POST', '/api/collections/clips/records', {
      token: await superuser(),
      body: {
        user: rider.id,
        trick,
        video_id: `https://www.youtube.com/watch?v=${VIDEO}&utm_source=whatever`,
        visibility: 'private',
      },
    });
    expect(added.status).toBe(200);
    expect(added.body.video_id).toBe(VIDEO);
    await call('DELETE', `/api/collections/clips/records/${added.body.id}`, {
      token: await superuser(),
    });
  });
});

describe('the video-link entitlement is a plan record, not a plan id', () => {
  let trick: string;

  beforeAll(async () => {
    trick = (await baseFixtures()).freeTrick;
  });

  it('gives a Rookie rider none — and 0 means none, not "unset"', async () => {
    const rookie = await makeRider(
      { privacy: 'public' },
      { plan: 'rookie', consent_state: 'not_required' },
    );
    expect((await planCap('rookie')).cap).toBe(0);

    const refused = await addLink(rookie, { video_id: VIDEO, trick });
    expect(refused.status).toBe(403);
    expect(String((refused.body as unknown as { message: string }).message)).toMatch(/paid plans/i);
  });

  it('lets a Shredder rider fill the cap on the record, and refuses the one after', async () => {
    // The cap is **read off the record** and the *rider* is filled up to it —
    // never the shared `plans` row shrunk to make the wall reachable, which is
    // the fixture trap LESSONS §5 records.
    const { cap, unlimited } = await planCap('shredder');
    expect(unlimited).toBe(false);
    expect(cap).toBeGreaterThan(0);

    const rider = await makeRider(
      { privacy: 'public' },
      { plan: 'shredder', consent_state: 'not_required' },
    );

    for (let index = 0; index < cap; index += 1) {
      const added = await addLink(rider, { video_id: VIDEO, trick });
      expect(added.status, `link ${index + 1} of ${cap} should have been allowed`).toBe(200);
    }

    const overCap = await addLink(rider, { video_id: VIDEO, trick });
    expect(overCap.status).toBe(403);
    expect(String((overCap.body as unknown as { message: string }).message)).toMatch(
      new RegExp(`all ${cap} of your video links`, 'i'),
    );
  });

  it('cannot be exceeded by a caller holding a superuser client', async () => {
    // The property T14's byte cap had and this one keeps. Every admin write in
    // the product goes through a server action holding this token; if the cap
    // stepped aside for it the cap would be advisory.
    const { cap } = await planCap('shredder');
    const rider = await makeRider(
      { privacy: 'public' },
      { plan: 'shredder', consent_state: 'not_required' },
    );
    for (let index = 0; index < cap; index += 1) {
      expect((await addLink(rider, { video_id: VIDEO, trick })).status).toBe(200);
    }

    const asSuperuser = await call('POST', '/api/collections/clips/records', {
      token: await superuser(),
      body: { user: rider.id, trick, video_id: VIDEO, visibility: 'private' },
    });
    expect(asSuperuser.status).toBe(403);
  });

  it('lets a rider come back under the cap by removing one', async () => {
    const { cap } = await planCap('shredder');
    const rider = await makeRider(
      { privacy: 'public' },
      { plan: 'shredder', consent_state: 'not_required' },
    );
    const ids: string[] = [];
    for (let index = 0; index < cap; index += 1) {
      const added = await addLink(rider, { video_id: VIDEO, trick });
      ids.push(added.body.id);
    }
    expect((await addLink(rider, { video_id: VIDEO, trick })).status).toBe(403);

    const removed = await call('DELETE', `/api/collections/clips/records/${ids[0]}`, {
      token: rider.token,
    });
    expect(removed.status).toBe(204);
    expect((await addLink(rider, { video_id: VIDEO, trick })).status).toBe(200);
  });

  it('never stops a Legend rider, past the number that stops a Shredder', async () => {
    const { cap } = await planCap('shredder');
    expect((await planCap('legend')).unlimited).toBe(true);

    const rider = await makeRider(
      { privacy: 'public' },
      { plan: 'legend', consent_state: 'not_required' },
    );
    for (let index = 0; index < cap + 2; index += 1) {
      const added = await addLink(rider, { video_id: VIDEO, trick });
      expect(added.status, `legend link ${index + 1} should have been allowed`).toBe(200);
    }
  });

  it('fails closed on an entitlement nobody has written', async () => {
    // The fail-closed *direction*, observed. A rider on the plan whose two
    // allowance fields read `0`/`false` is refused, which is exactly the state a
    // database has after `1787356800` runs and before anything seeds it. That is
    // why unlimited is a boolean and not a large-integer sentinel: the unset
    // value has to be the refusing one.
    const rookie = await makeRider(
      { privacy: 'public' },
      { plan: 'rookie', consent_state: 'not_required' },
    );
    const cap = await planCap('rookie');
    expect(cap).toEqual({ cap: 0, unlimited: false });
    expect((await addLink(rookie, { video_id: VIDEO, trick })).status).toBe(403);
  });

  /**
   * **The missing-plan-record case is proven in `@landit/core`, not here, and
   * that is a decision rather than a gap.**
   *
   * `planVideoLinkAllowance` fails closed on `planFor` returning `null` — an
   * unknown slug or an unseeded `plans` collection grants nothing — and
   * `video.test.ts` asserts it directly against the pure function. Proving it
   * over HTTP would mean deleting a `plans` row while the suite is running, and
   * `plans` is a **global mutable fixture shared by every file in this
   * directory** (LESSONS §5): the paywall and subscription suites resolve
   * entitlements off the same three rows, in parallel, so a row that vanishes
   * for even a moment turns their green into an intermittent red that reads
   * exactly like a product bug. `users.plan` is a select of the three launch
   * slugs, so there is no fourth slug to point a rider at instead.
   *
   * What is asserted over HTTP is the property that has an observable
   * consequence — an unwritten entitlement refuses (above) — and the `null` arm
   * is left to the unit test, where taking the record away costs nobody
   * anything.
   */
});
