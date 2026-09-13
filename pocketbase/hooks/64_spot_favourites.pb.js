/// <reference path="../.pb_data/types.d.ts" />

/**
 * What a rider may keep as a favourite spot, and how fast (plan §7, T13).
 *
 * The ownership half is the collection's own `createRule`, which requires the
 * submitted `user` to be the caller's: a body naming somebody else is refused
 * before any hook runs. (`60_ownership.pb.js` also stamps `user` from the token
 * for this collection, alongside `event_attendance` and the rest — belt and
 * braces behind a rule that has already done the work.) This file is the other
 * half — the two refusals that stop the collection being a place to write
 * junk:
 *
 *  1. **A favourite has to point at a spot that exists and is readable.** The
 *     `createRule` proves the row belongs to the caller; it does not prove the
 *     `spot` relation points at anything a rider could have seen. A relation to
 *     a deleted id, or to somebody else's pending submission, is a row the
 *     faves list would carry forever and never be able to render.
 *  2. **A rider cannot flood it.** 200 held, 60 an hour. Nothing here is read
 *     by a person — unlike the spot queue, which is rate-limited because staff
 *     read it by hand — so these are much looser, and they exist against a
 *     script rather than against a rider. A rider marking every park in their
 *     town in one sitting does not reach either.
 *
 * Request-layer and stepping aside for a superuser, like `62_spots.pb.js`: the
 * seed and any future staff tooling hold a superuser token, and neither should
 * be bounded by a rider's ceiling.
 *
 * **There is no plan check here and there is not going to be one.** Favourites
 * are free on every plan (owner decision, 2026-09-13, in chat). Plan §3's third
 * guarantee — the paywall enforced server-side, never only in the client —
 * is about trick *content*; a spot is a public place and `/spots` is readable
 * signed out, so there is nothing here to sell and nothing to enforce.
 *
 * **The numbers and the sentences are mirrored in
 * `packages/core/src/rules/spots.ts`**, so the screen can grey a control out
 * before the server refuses and can show a refusal in words written for a
 * rider. `core` is the definition; this is the enforcement (plan §3). If one
 * moves the other moves with it — `pocketbase/tests/spot-favourites.test.ts`
 * says so.
 */

onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) {
    e.next();
    return;
  }

  // Every constant this handler uses is declared **inside** it. The handler is
  // serialised and re-executed in an isolated VM, so it arrives with no closure
  // over the file it was written in: a `const` at file scope reads as
  // `undefined` here, and the TypeError that follows surfaces as a bare 400
  // with nothing naming the cause. Same rule as `62_spots.pb.js`.
  const FAVOURITE_MAX_HELD = 200;
  const FAVOURITE_WINDOW_MINUTES = 60;
  const FAVOURITE_MAX_PER_WINDOW = 60;

  const limits = require(`${__hooks}/lib/ratelimit.js`);
  const rider = e.auth;

  // `createRule` already requires a signed-in rider. Belt and braces, because
  // the rest of this hook is written as if `rider` exists.
  if (!rider) throw new ForbiddenError('Sign in to save a spot.');

  const spotId = e.record.getString('spot');
  if (!spotId) throw new BadRequestError('That spot is not on the map.');

  /*
   * The spot has to exist, and it has to be one this rider could have seen.
   *
   * `live` is the ordinary case. A rider's **own** submission is allowed too,
   * even while it is pending: they can see it on `/spots` under "Waiting on
   * us", so being unable to fave the park at the end of their road purely
   * because a human has not read the queue yet would be a rule with no reason
   * behind it. Somebody else's pending row is invisible to them (plan §6.1),
   * and stays unfavouritable here — otherwise this collection becomes a way to
   * test whether a given id exists.
   *
   * `findRecordById` throws when there is no such row, which is the same answer
   * as "not readable" and gets the same sentence: a favourite create must never
   * tell a caller the difference between a spot that is hidden and a spot that
   * was never there.
   */
  let spot;
  try {
    spot = e.app.findRecordById('spots', spotId);
  } catch {
    throw new BadRequestError('That spot is not on the map.');
  }
  const mine = spot.getString('submitted_by') === rider.id;
  if (spot.getString('status') !== 'live' && !mine) {
    throw new BadRequestError('That spot is not on the map.');
  }

  limits.assertUnderOutstandingLimit(e.app, {
    collection: 'spot_favourites',
    filter: 'user = {:user}',
    params: { user: rider.id },
    max: FAVOURITE_MAX_HELD,
    message: `You can keep ${FAVOURITE_MAX_HELD} faves. Remove one to add another.`,
  });

  limits.assertUnderRateLimit(e.app, {
    collection: 'spot_favourites',
    filter: 'user = {:user}',
    params: { user: rider.id },
    windowMinutes: FAVOURITE_WINDOW_MINUTES,
    max: FAVOURITE_MAX_PER_WINDOW,
    message: 'That is a lot of faves at once. Try again in a little while.',
  });

  e.next();
}, 'spot_favourites');
