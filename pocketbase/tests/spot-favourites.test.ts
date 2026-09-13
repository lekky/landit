// Imported rather than read as text, unlike the constants check at the bottom:
// this is plain TypeScript data, and the assertion that uses it is about what
// the running server says, not about the source of either file.
import { SPOT_FAVOURITE_REFUSALS } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { call, makeRider, superuser } from './helpers';

/**
 * Favourite spots, as observed HTTP behaviour.
 *
 * Four promises live on the server and only on the server:
 *
 * - **A rider's faves are the rider's own.** Every rule on `spot_favourites` is
 *   `OWN`, so a rider cannot list, read or delete anybody else's — which is
 *   what stops this collection becoming a public tally of which children are at
 *   which park (plan §6.1).
 * - **A favourite can only be written for yourself.** The `createRule` reads
 *   `user` as submitted, so a body naming another rider is refused outright —
 *   there is no path by which one rider writes into another's faves.
 * - **A favourite points at a spot the rider could have seen**, and never at a
 *   stranger's pending submission — `64_spot_favourites.pb.js`.
 * - **A rider waiting on a guardian may still fave a spot**, which is the one
 *   deliberate difference from `event_attendance`. The consent gate exists to
 *   stop a child reaching *other riders*, and a favourite reaches nobody
 *   (migration `1789344000_spot_favourites.js`).
 *
 * Everything below goes over the API with a rider's own token, because that is
 * the only thing that proves a browser cannot do it either.
 *
 * **Each refusal was watched fail with the hook removed before it was
 * believed** (LESSONS §5), and the result is worth writing down because it is
 * not what it looks like. With `64_spot_favourites.pb.js` deleted, exactly
 * three turn red: the stranger's-pending-submission test and the two constants
 * checks. Everything about ownership and privacy stays green, because that is
 * the API rules' work and not the hook's — and so do the two "refuses a bad
 * spot id" tests, because a missing `spot` is caught by `required: true` and a
 * dangling one by PocketBase's own relation validation. The hook earns its
 * place for one thing: **the difference between a spot that is hidden and one
 * that was never there**, which nothing else in the stack draws.
 */

const somewhere = { lat: 53.4695, lng: -2.9877 };

/** A live spot, written the only way a live spot can be: with a superuser. */
async function liveSpot(name: string): Promise<string> {
  const created = await call<{ id: string }>('POST', '/api/collections/spots/records', {
    token: await superuser(),
    body: { name, town: 'Liverpool', type: 'Concrete', ...somewhere, status: 'live' },
  });
  if (created.status !== 200) throw new Error(`spot failed: ${JSON.stringify(created)}`);
  return created.body.id;
}

/** A rider's own submission, which arrives `pending` however it is asked for. */
async function pendingSpot(token: string, name: string): Promise<string> {
  const created = await call<{ id: string }>('POST', '/api/collections/spots/records', {
    token,
    body: { name, town: 'Liverpool', type: 'Concrete', ...somewhere },
  });
  if (created.status !== 200) throw new Error(`spot failed: ${JSON.stringify(created)}`);
  return created.body.id;
}

/**
 * A fave written the way the app writes one: `user` is sent, because the
 * `createRule` compares the submitted value against the token. `packages/db`'s
 * `favouriteSpot` does exactly this.
 */
const fave = async (token: string, userId: string, spot: string) =>
  call<{ id: string; user: string; spot: string; message: string }>(
    'POST',
    '/api/collections/spot_favourites/records',
    { token, body: { user: userId, spot } },
  );

/** A fave written with whatever body the caller likes — for the refusals. */
const faveRaw = async (token: string, body: Record<string, unknown>) =>
  call<{ id: string; user: string; spot: string; message: string }>(
    'POST',
    '/api/collections/spot_favourites/records',
    { token, body },
  );

const myFaves = async (token: string) =>
  call<{ items: { id: string; spot: string }[] }>(
    'GET',
    '/api/collections/spot_favourites/records',
    { token },
  );

describe('a rider faving a spot', () => {
  it('lands it owned by them', async () => {
    const rider = await makeRider();
    const spot = await liveSpot('Fave Me');

    const created = await fave(rider.token, rider.id, spot);

    expect(created.status).toBe(200);
    expect(created.body.user).toBe(rider.id);
    expect(created.body.spot).toBe(spot);
  });

  it("refuses a body that writes into somebody else's faves", async () => {
    const rider = await makeRider();
    const stranger = await makeRider();
    const spot = await liveSpot('Not For You');

    // The `createRule` reads the submitted `user`, so this never reaches a
    // hook: there is no request a browser can send that puts a row in another
    // rider's list.
    const created = await faveRaw(rider.token, { spot, user: stranger.id });
    expect(created.status).toBe(400);

    const theirs = await myFaves(stranger.token);
    expect(theirs.body.items.map((row) => row.spot)).not.toContain(spot);
  });

  it('reads it back to them and to nobody else', async () => {
    const rider = await makeRider();
    const stranger = await makeRider();
    const spot = await liveSpot('Private Fave');
    const created = await fave(rider.token, rider.id, spot);
    expect(created.status).toBe(200);

    const mine = await myFaves(rider.token);
    expect(mine.status).toBe(200);
    expect(mine.body.items.map((row) => row.spot)).toContain(spot);

    // Not "filtered out of the list" — invisible. A stranger asking for the
    // row by its id is refused, which is the only version of this that holds
    // when somebody guesses an id.
    const theirs = await myFaves(stranger.token);
    expect(theirs.body.items.map((row) => row.spot)).not.toContain(spot);

    const byId = await call('GET', `/api/collections/spot_favourites/records/${created.body.id}`, {
      token: stranger.token,
    });
    expect(byId.status).toBe(404);
  });

  it('lets nobody but the owner remove one', async () => {
    const rider = await makeRider();
    const stranger = await makeRider();
    const spot = await liveSpot('Mine To Drop');
    const created = await fave(rider.token, rider.id, spot);

    const byStranger = await call(
      'DELETE',
      `/api/collections/spot_favourites/records/${created.body.id}`,
      { token: stranger.token },
    );
    expect(byStranger.status).toBe(404);

    const byOwner = await call(
      'DELETE',
      `/api/collections/spot_favourites/records/${created.body.id}`,
      { token: rider.token },
    );
    expect(byOwner.status).toBe(204);

    const after = await myFaves(rider.token);
    expect(after.body.items.map((row) => row.spot)).not.toContain(spot);
  });

  it('refuses a signed-out caller', async () => {
    const rider = await makeRider();
    const spot = await liveSpot('No Token');
    const created = await faveRaw('', { spot, user: rider.id });
    expect(created.status).toBe(400);
  });

  it('cannot be faved twice, so two taps are one row', async () => {
    const rider = await makeRider();
    const spot = await liveSpot('Twice');

    expect((await fave(rider.token, rider.id, spot)).status).toBe(200);
    // The unique `(user, spot)` index, not the screen remembering. Without it a
    // double tap, a second tab or a retried request holds the spot twice and
    // the faves list shows it twice.
    expect((await fave(rider.token, rider.id, spot)).status).toBe(400);

    const mine = await myFaves(rider.token);
    expect(mine.body.items.filter((row) => row.spot === spot)).toHaveLength(1);
  });

  it('has no update door at all', async () => {
    const rider = await makeRider();
    const first = await liveSpot('First');
    const second = await liveSpot('Second');
    const created = await fave(rider.token, rider.id, first);

    const moved = await call(
      'PATCH',
      `/api/collections/spot_favourites/records/${created.body.id}`,
      { token: rider.token, body: { spot: second } },
    );
    // 403 rather than the 404 a hidden record gets: `updateRule: null` closes
    // the door for everybody, so there is nothing to hide behind a "not found".
    expect(moved.status).toBe(403);
  });
});

describe('what a favourite may point at', () => {
  // Held by PocketBase's own relation validation rather than by the hook —
  // asserted anyway, because "a favourite always points at a real spot" is the
  // promise, and which layer keeps it is an implementation detail that may move.
  it('refuses a spot id that does not exist', async () => {
    const rider = await makeRider();
    const created = await fave(rider.token, rider.id, 'abcdefghijklmno');
    expect(created.status).toBe(400);
  });

  // Held by `required: true` on the field, for the same reason.
  it('refuses a favourite with no spot at all', async () => {
    const rider = await makeRider();
    const created = await faveRaw(rider.token, { user: rider.id });
    expect(created.status).toBe(400);
  });

  it("refuses somebody else's pending submission, in the words of a missing one", async () => {
    const author = await makeRider();
    const stranger = await makeRider();
    const hidden = await pendingSpot(author.token, 'Not Yours');

    const created = await fave(stranger.token, stranger.id, hidden);
    expect(created.status).toBe(400);
    /*
     * The same sentence a spot that was never there gets. A different one
     * would make this endpoint an oracle: fave an id, read the wording, and
     * learn whether some other rider has a submission waiting.
     */
    expect(created.body.message).toBe('That spot is not on the map.');
  });

  it("takes the rider's own pending submission, which they can already see", async () => {
    const rider = await makeRider();
    const mine = await pendingSpot(rider.token, 'Mine, Waiting');

    const created = await fave(rider.token, rider.id, mine);
    expect(created.status).toBe(200);
  });
});

describe('the guardian-consent gate', () => {
  /*
   * The deliberate divergence from `event_attendance`, which is
   * `OWN_AND_CONSENTED`. Going to an event is a child saying they will be at a
   * place at a time; bookmarking a park is a note to self that reaches nobody
   * (plan §3, guarantee 4). If somebody later "fixes" this collection to match
   * its neighbour, this is the test that asks them to read the migration first.
   */
  it('does not hold a rider waiting on a guardian back from faving a spot', async () => {
    const child = await makeRider({ age_band: 'under_13' }, { consent_state: 'pending' });
    const spot = await liveSpot('Local Park');

    const created = await fave(child.token, child.id, spot);
    expect(created.status).toBe(200);
  });
});

describe('the numbers the screen quotes are the numbers the server keeps', () => {
  it('matches the constants in @landit/core', async () => {
    // `packages/core` defines the limits so the screen can grey a control out
    // before the server refuses; this hook enforces them. Two copies is the
    // plan's arrangement (§3) — a drift between them is a screen that lies,
    // so it fails here.
    //
    // Both files are read as text rather than imported: the hook is a
    // PocketBase JSVM module that no bundler can load, and matching it against
    // the rule package's own source keeps the check symmetrical.
    const { readFileSync } = await import('node:fs');
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
    const hook = read('../hooks/64_spot_favourites.pb.js');
    const rules = read('../../packages/core/src/rules/spots.ts');

    const numberIn = (source: string, name: string): string => {
      const found = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(source);
      if (!found) throw new Error(`${name} is not in that file any more.`);
      return found[1]!;
    };

    expect(numberIn(hook, 'FAVOURITE_MAX_HELD')).toBe(numberIn(rules, 'SPOT_FAVOURITE_MAX_HELD'));
    expect(numberIn(hook, 'FAVOURITE_WINDOW_MINUTES')).toBe(
      numberIn(rules, 'SPOT_FAVOURITE_WINDOW_MINUTES'),
    );
    expect(numberIn(hook, 'FAVOURITE_MAX_PER_WINDOW')).toBe(
      numberIn(rules, 'SPOT_FAVOURITE_MAX_PER_WINDOW'),
    );
  });

  it('refuses in sentences the web app knows it may show', async () => {
    /*
     * `SPOT_FAVOURITE_REFUSALS` is the list the fave action checks a 400 or a
     * 429 against before showing it to a rider; anything not on it becomes
     * "try again". So the refusals reachable without filling a database are
     * provoked here for real, and a sentence reworded in the hook but not in
     * `core` fails this rather than quietly turning into the apology.
     *
     * The two ceiling sentences are not provoked: reaching them means writing
     * two hundred rows, which is a slow test for a branch `ratelimit.js` is
     * already tested on. They are held to the list by the constants check
     * above and by `spotFavouriteRefusal` in `packages/core`.
     */
    const rider = await makeRider();
    const missing = await fave(rider.token, rider.id, 'abcdefghijklmno');
    expect(missing.status).toBe(400);
    expect(SPOT_FAVOURITE_REFUSALS).toContain(missing.body.message);
  });
});
