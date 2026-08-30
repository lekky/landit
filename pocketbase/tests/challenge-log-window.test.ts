import { beforeAll, describe, expect, it } from 'vitest';

import { call, ensureRecord, makeRider, type Rider } from './helpers';

/**
 * T12 — the challenge log button is gated **server side** to the live window.
 *
 * Plan §7 says "log button gated server-side to the live window", and a
 * client-only gate is not a gate: the button is a `disabled` attribute, and a
 * `disabled` attribute is a suggestion to anyone with a network tab. So the
 * refusal is proven here, over HTTP, with the client removed from the picture
 * entirely — exactly as LESSONS §5 asks.
 *
 * Three things are asserted that reading the rule text would have missed:
 *
 * - **The last day counts.** Until T12 the hook compared a full timestamp
 *   against a date field, so a challenge died at midnight UTC on the morning of
 *   its final day — the day a rider is most likely to be finishing it. Nothing
 *   errored; writes were simply refused while the screen still said "Live now".
 * - **The sticker the screen promises is really awarded.** Issue #76: every
 *   challenge promised a reward and none of the promised stickers existed. The
 *   rewards now name `challenger`, so finishing one has to actually produce a
 *   `rider_stickers` row — which no client may create.
 * - **BMX can do all of it.** Issue #80: the sport had no challenges at all, so
 *   the `challenger` sticker was dead for a BMX-only rider.
 *
 * **Sports and windows are allocated, not picked.** One live challenge per
 * sport is a real constraint on the *whole instance*, and this suite shares one
 * with `schema-and-hooks.test.ts`, which already owns scooter around today.
 * These fixtures take skate and BMX for the live windows and put the scooter
 * ones weeks away — a fixture that collides fails a sibling file's test, not
 * this one, which is a confusing way to spend an afternoon.
 */

const DAY = 86400000;
const day = (offset: number): string =>
  new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

/** A challenge with an explicit window, created the only way one can be: as staff. */
async function challenge(
  slug: string,
  sport: string,
  starts: string,
  ends: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const record = await ensureRecord('challenges', `slug = '${slug}'`, {
    slug,
    sport,
    week: 'Test week',
    title: `Fixture ${slug}`,
    starts,
    ends,
    goal: 3,
    reward: 'First Challenge sticker',
    ...extra,
  });
  return record.id;
}

async function logIt(rider: Rider, challengeId: string) {
  return call<{ message: string; user: string }>('POST', '/api/collections/challenge_log/records', {
    token: rider.token,
    body: { user: rider.id, challenge: challengeId },
  });
}

describe('the challenge log window is the server’s, not the client’s', () => {
  let rider: Rider;
  let live: string;
  let lastDay: string;
  let finished: string;
  let upcoming: string;

  beforeAll(async () => {
    rider = await makeRider({}, { plan: 'rookie', consent_state: 'not_required' });
    live = await challenge('t12-live', 'skate', day(-2), day(2));
    // Ends today: the case the old instant-comparison refused all day.
    lastDay = await challenge('t12-last-day', 'bmx', day(-6), day(0), { goal: 2 });
    finished = await challenge('t12-finished', 'scooter', day(-40), day(-34));
    upcoming = await challenge('t12-upcoming', 'scooter', day(30), day(36));
  });

  it('accepts a log inside the window', async () => {
    expect((await logIt(rider, live)).status).toBe(200);
  });

  it('accepts a log on the challenge’s final day', async () => {
    expect((await logIt(rider, lastDay)).status).toBe(200);
  });

  it('refuses a log into a week that has finished', async () => {
    const result = await logIt(rider, finished);
    expect(result.status).toBe(403);
    expect(result.body.message).toMatch(/not running/i);
  });

  it('refuses a log into a week that has not started', async () => {
    expect((await logIt(rider, upcoming)).status).toBe(403);
  });

  it('refuses it even when the client sends its own timestamp', async () => {
    // The obvious way round a date check is to send the date yourself. The
    // window is read off the *challenge*, never off the request body.
    const result = await call('POST', '/api/collections/challenge_log/records', {
      token: rider.token,
      body: { user: rider.id, challenge: finished, at: new Date().toISOString() },
    });
    expect(result.status).toBe(403);
  });

  it('refuses a log filed against another rider', async () => {
    // Refused at the collection rule, before the hook is reached — which is why
    // the status is a 400 rather than the hook's 403. Either way there is no
    // path to writing progress onto somebody else's account.
    const other = await makeRider({}, { consent_state: 'not_required' });
    const result = await call('POST', '/api/collections/challenge_log/records', {
      token: rider.token,
      body: { user: other.id, challenge: live },
    });
    expect(result.status).toBe(400);
  });
});

describe('finishing a challenge awards the sticker the screen promised', () => {
  it('gives a BMX rider the First Challenge sticker off a BMX challenge', async () => {
    // Issues #76 and #80 together: the reward has to name a sticker that
    // exists, and BMX has to have a challenge to finish in the first place.
    // T24 renamed the record: `challenger` became `first-challenge`, judged
    // by its kind. The reward copy on the challenge fixture names it below.
    await ensureRecord('stickers', "slug = 'first-challenge'", {
      slug: 'first-challenge',
      name: 'First Challenge',
      hue: '#2ec4b6',
      ico: 'star',
      cond: 'Finish a weekly challenge',
      kind: 'challenges',
      is_live: true,
    });
    const bmxWeek = await challenge('t12-last-day', 'bmx', day(-6), day(0), { goal: 2 });

    const rider = await makeRider({}, { consent_state: 'not_required', sports: ['bmx'] });
    expect((await logIt(rider, bmxWeek)).status).toBe(200);

    const held = async () => {
      const result = await call<{ items: { sticker: string }[] }>(
        'GET',
        '/api/collections/rider_stickers/records',
        { token: rider.token, query: { filter: `user = '${rider.id}'` } },
      );
      return result.body.items;
    };

    // One log of two is not a finished challenge, and a sticker that arrives
    // early is a sticker nobody earned.
    expect(await held()).toHaveLength(0);

    expect((await logIt(rider, bmxWeek)).status).toBe(200);
    expect(await held()).toHaveLength(1);
  });
});
