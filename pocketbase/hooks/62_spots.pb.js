/// <reference path="../.pb_data/types.d.ts" />

/**
 * What a rider may submit to the spots queue, and how often (plan §7, T13).
 *
 * The half of spot submission that already existed is in `60_ownership.pb.js`:
 * a submission arrives `pending`, stamped with whoever sent it, whatever the
 * body claimed. This file is the other half — the two refusals that stop the
 * queue being useless:
 *
 *  1. **A submission has to describe a findable place.** A name, and a
 *     coordinate pair that is on Earth. A reviewer handed "Rampworx" and
 *     nothing else has nothing to check but a stranger's typing, and a spot with
 *     no point cannot appear on a map whose whole job is plotting them.
 *  2. **A rider cannot flood it.** Three an hour, ten waiting at once. Staff
 *     read this queue by hand (T17), so an unbounded one is a denial of service
 *     against a person rather than a server.
 *
 * **The server's floor is lower than the form's, on purpose.** The submission
 * form also insists on a town and a type (`spotSubmissionProblems` in
 * `@landit/core`), because those make a good submission. This hook refuses only
 * what would make the *record* wrong — unnamed, unplottable, or a `type` that is
 * not one of the three. Pushing every nicety down here would make the API
 * stricter than the product, and would break every caller that predates T13 for
 * no gain in safety: what a missing town costs is a slightly worse queue entry,
 * which is precisely what a human reviewer is for.
 *
 * Request-layer, stepping aside for a superuser, like the rest of
 * `60_ownership.pb.js`: the seed writes live spots with a superuser token, and
 * staff publishing a spot on a rider's behalf is a path the product wants. The
 * refusal a rider could gain something by defeating — `status = 'pending'` —
 * is not in this file and is not bypassable from a browser at all.
 *
 * **The numbers are tunable defaults, not deliberated decisions**, and they are
 * mirrored in `packages/core/src/rules/spots.ts` so the form can warn before the
 * server refuses. `core` is the definition; this is the enforcement (plan §3).
 * If one moves, the other moves with it — there is a test that says so.
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
  // ("Something went wrong while processing your request") with nothing naming
  // the cause. `lib/landit.js` says the same thing about `require`; it is the
  // same rule, and it covers everything, not only imports.
  const SPOT_WINDOW_MINUTES = 60;
  const SPOT_MAX_PER_WINDOW = 3;
  const SPOT_MAX_PENDING = 10;

  const SPOT_TYPES = ['Street spot', 'Indoor park', 'Concrete'];
  const SPOT_MAX_TAGS = 8;

  const limits = require(`${__hooks}/lib/ratelimit.js`);
  const rider = e.auth;

  // `createRule` already requires a consented, signed-in rider. Belt and
  // braces, because the rest of this hook is written as if `rider` exists.
  if (!rider) throw new ForbiddenError('Sign in to add a spot.');

  const name = e.record.getString('name').trim();
  const town = e.record.getString('town').trim();
  if (!name) throw new BadRequestError('Give the spot a name.');

  // Checked only when one was given: `type` is a facet a human filters the queue
  // by, so a value outside the three is worse than no value at all.
  const type = e.record.getString('type').trim();
  if (type && SPOT_TYPES.indexOf(type) === -1) {
    throw new BadRequestError(`A spot is one of: ${SPOT_TYPES.join(', ')}.`);
  }

  const lat = e.record.getFloat('lat');
  const lng = e.record.getFloat('lng');
  // Zero on both axes is how an unset number field reads, not a place anyone
  // rides — it is six hundred miles off the coast of Ghana.
  if ((lat === 0 && lng === 0) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new BadRequestError('A spot needs a location. Paste a Maps link or a coordinate pair.');
  }

  const tags = e.record.get('tags');
  if (Array.isArray(tags) && tags.length > SPOT_MAX_TAGS) {
    throw new BadRequestError(`${SPOT_MAX_TAGS} tags at most.`);
  }

  e.record.set('name', name);
  e.record.set('town', town);

  // The backlog is checked first, and the order is deliberate: a rider sitting
  // on ten unreviewed spots is told the thing that is actually true of them and
  // that waiting an hour will not fix, rather than being sent away to try again
  // at the top of the hour and refused for a second reason.
  limits.assertUnderOutstandingLimit(e.app, {
    collection: 'spots',
    filter: "submitted_by = {:rider} && status = 'pending'",
    params: { rider: rider.id },
    max: SPOT_MAX_PENDING,
    message: `You have ${SPOT_MAX_PENDING} spots waiting to be checked. Once we have been through those you can add more.`,
  });

  limits.assertUnderRateLimit(e.app, {
    collection: 'spots',
    filter: 'submitted_by = {:rider}',
    params: { rider: rider.id },
    windowMinutes: SPOT_WINDOW_MINUTES,
    max: SPOT_MAX_PER_WINDOW,
    message: `That is ${SPOT_MAX_PER_WINDOW} spots in an hour — give it a bit and add the next one.`,
  });

  e.next();
}, 'spots');
