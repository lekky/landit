/// <reference path="../.pb_data/types.d.ts" />

/**
 * Real crews (T11): what the server decides about them, and the activity feed.
 *
 * `60_ownership.pb.js` already owns the two facts that make a crew a crew — the
 * creator is the owner, and creating one puts you in it. This file adds what
 * only becomes reachable once there is a client creating crews and invites, and
 * every line of it is one of three things:
 *
 *  1. **The invite code is minted here, always.** `60_ownership.pb.js` says
 *     "with a server-set code" and mints one *when the body left it empty* — so
 *     until T11 there was no client to send one, and from T11 there is. A code
 *     the client picks is a code a rider can make guessable, and an invite code
 *     is the only thing between a stranger and a crew of children (plan §6.1).
 *     Registering later than `60_` means this write is the one that survives;
 *     the two hooks agree on intent and this one makes it true.
 *  2. **Ceilings.** Crews owned per rider, uses per invite, and how long an
 *     invite lives. All three are anti-spam rather than product limits: crew
 *     creation mints codes, and an account that can mint unlimited codes can
 *     paper the internet with them.
 *  3. **`GET /api/landit/crew-feed/{crew}`.** The third server-shaped payload,
 *     beside the crew board and the join route in `80_routes.pb.js`. See its
 *     own comment for why the feed is *not* the crew board and cannot borrow
 *     the board's exception to profile privacy.
 *
 * The JSVM has no `Intl` and no timezone database (LESSONS §5), so nothing here
 * does date arithmetic in a rider's local day. Everything is UTC instants,
 * compared as ISO strings and formatted by the client.
 */

/**
 * Every constant below is declared **inside** the handler that uses it.
 *
 * Not a style choice: each hook callback is serialised and run in its own
 * isolated VM, so nothing declared at the top level of this file is visible
 * inside one. A module-level `const` reads as `undefined` at run time and the
 * request fails with a generic 400 that names nothing. The same rule governs
 * `pocketbase/migrations/`, where it is written down at the top of the initial
 * migration. The numbers here mirror `packages/core/src/rules/crew.ts`.
 */

/* ------------------------------------------------------------------ crews -- */

onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth() || !e.auth) {
    e.next();
    return;
  }

  const MAX_OWNED_CREWS = 5;
  const lib = require(`${__hooks}/lib/landit.js`);

  const name = String(e.record.getString('name') || '').trim();
  if (name.length < 2) throw new BadRequestError('Give the crew a name.');
  if (name.length > 40) throw new BadRequestError('Keep the crew name to 40 characters.');
  // A name carrying a line break can pretend to be two rows on a board, and
  // one carrying a control character can lie about its own length — neither is
  // caught by the field's `max`. Scanned by character code rather than matched
  // by a regular expression, because `crewNameProblem` in `packages/core` runs
  // the same test in a different engine and the two must not disagree.
  for (let i = 0; i < name.length; i += 1) {
    const code = name.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      throw new BadRequestError('Crew names cannot contain line breaks.');
    }
  }
  e.record.set('name', name);

  const owned = lib.findAll(e.app, 'crews', 'owner = {:owner}', { owner: e.auth.id });
  if (owned.length >= MAX_OWNED_CREWS) {
    throw new BadRequestError(`You can only run ${MAX_OWNED_CREWS} crews at once.`);
  }

  // The slug is the server's, not the body's: it is uniquely indexed, so a
  // client that could choose one could squat every readable name on the service.
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  const suffix = $security.randomStringByRegex('[a-z0-9]{6}');
  e.record.set('slug', (base ? `${base}-${suffix}` : `crew-${suffix}`).slice(0, 40));

  e.next();
}, 'crews');

/* ---------------------------------------------------------------- invites -- */

onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) {
    e.next();
    return;
  }

  /** Mirrors `INVITE_CODE_ALPHABET` and `INVITE_CODE_LENGTH` in `packages/core`. */
  const INVITE_CODE_REGEX = '[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}';
  const INVITE_MAX_USES = 25;
  const INVITE_EXPIRY_DAYS = 14;

  // Unconditional, unlike the `if (!code)` in `60_ownership.pb.js`: whatever
  // the body said, the stored code is this one. See the note at the top.
  e.record.set('code', $security.randomStringByRegex(INVITE_CODE_REGEX));
  e.record.set('uses', 0);

  const asked = e.record.getInt('max_uses');
  e.record.set('max_uses', asked > 0 && asked < INVITE_MAX_USES ? asked : INVITE_MAX_USES);

  // An invite that never expires is a code that outlives the reason it was
  // sent, so the expiry is the server's too. Written the way `consent.js`
  // writes one — a plain `Date`, formatted as PocketBase stores it — because
  // the JSVM's `DateTime` has no day arithmetic to borrow.
  const expires = new Date(Date.now() + INVITE_EXPIRY_DAYS * 86400000);
  e.record.set('expires', expires.toISOString().replace('T', ' '));

  e.next();
}, 'crew_invites');

/* ------------------------------------------------------------ the feed API -- */

/**
 * `GET /api/landit/crew-feed/{crew}` — what has happened in a crew you were
 * invited to, newest first.
 *
 * **Why this is a route and not a collection read.** The rows it is built from
 * (`trick_log`, `rider_stickers`) are privacy-gated per rider, so a client
 * cannot assemble this itself without being handed a way past those rules.
 *
 * **Why it is not the crew board.** Plan §3 guarantee 1 carves out exactly one
 * exception to profile privacy: a private rider still appears *on the board*,
 * by name and score. That exception is narrow on purpose and it does not
 * stretch to here — what a rider landed this week is more than a name and a
 * score, and `trick_progress` and `rider_stickers` are named in the guarantee
 * as privacy-gated. So the feed applies the same three-way test the API rules
 * apply: your own activity always, a `public` or `members` crewmate's activity
 * to a signed-in crewmate, and a `private` rider not at all. A crew of private
 * riders has an empty feed, and the screen says so rather than pretending.
 *
 * **Why there is no ranking.** Plan §6.1: no algorithmic feed. The order is the
 * timestamp and the tie-break is the id.
 */
routerAdd(
  'GET',
  '/api/landit/crew-feed/{crew}',
  (e) => {
    const lib = require(`${__hooks}/lib/landit.js`);

    /** How many things the feed carries. Chronological, so this is "most recent". */
    const FEED_LIMIT = 25;

    const crewId = e.request.pathValue('crew');
    const viewer = e.auth;

    if (lib.isConsentLimited(viewer)) {
      throw new ForbiddenError('This account is waiting on a guardian’s approval.');
    }

    const mine = lib.findAll(e.app, 'crew_members', 'crew = {:crew} && user = {:user}', {
      crew: crewId,
      user: viewer.id,
    });
    if (!mine.length) throw new ForbiddenError('You are not in that crew.');

    const trickCache = {};
    const trickOf = (id) => {
      if (!(id in trickCache)) {
        try {
          const t = e.app.findRecordById('tricks', id);
          trickCache[id] = { name: t.getString('name'), sport: t.getString('sport') };
        } catch {
          trickCache[id] = null;
        }
      }
      return trickCache[id];
    };

    const stickerCache = {};
    const stickerOf = (id) => {
      if (!(id in stickerCache)) {
        try {
          const s = e.app.findRecordById('stickers', id);
          stickerCache[id] = { name: s.getString('name'), hue: s.getString('hue') };
        } catch {
          stickerCache[id] = null;
        }
      }
      return stickerCache[id];
    };

    const items = [];

    for (const membership of lib.findAll(e.app, 'crew_members', 'crew = {:crew}', {
      crew: crewId,
    })) {
      const riderId = membership.getString('user');
      const rider = e.app.findRecordById('users', riderId);
      const isSelf = riderId === viewer.id;

      // The privacy test, spelled out rather than borrowed. `private` is not on
      // this list, and neither is a rider held behind the consent gate
      // (guarantee 4) or a suspended one.
      if (!isSelf) {
        if (lib.isConsentLimited(rider) || rider.getBool('suspended')) continue;
        const privacy = rider.getString('privacy');
        if (privacy !== 'public' && privacy !== 'members') continue;
      }

      const who = {
        id: rider.id,
        name: rider.getString('name'),
        handle: rider.getString('handle'),
        avatar_key: rider.getString('avatar_key'),
        flair: lib.planIncludesFlair(e.app, rider),
      };

      for (const row of e.app.findRecordsByFilter(
        'trick_log',
        'user = {:user}',
        '-at',
        FEED_LIMIT,
        0,
        { user: riderId },
      )) {
        const trick = trickOf(row.getString('trick'));
        if (!trick) continue;
        items.push({
          id: row.id,
          kind: 'stage',
          at: row.getDateTime('at').string(),
          rider: who,
          stage: row.getString('stage'),
          trick: trick.name,
          sport: trick.sport,
        });
      }

      for (const row of e.app.findRecordsByFilter(
        'rider_stickers',
        'user = {:user}',
        '-earned_at',
        FEED_LIMIT,
        0,
        { user: riderId },
      )) {
        const sticker = stickerOf(row.getString('sticker'));
        if (!sticker) continue;
        items.push({
          id: row.id,
          kind: 'sticker',
          at: row.getDateTime('earned_at').string(),
          rider: who,
          sticker: sticker.name,
          hue: sticker.hue,
        });
      }
    }

    items.sort((a, b) => (a.at === b.at ? (a.id < b.id ? -1 : 1) : a.at < b.at ? 1 : -1));

    return e.json(200, { crew: crewId, items: items.slice(0, FEED_LIMIT) });
  },
  $apis.requireAuth('users'),
);
