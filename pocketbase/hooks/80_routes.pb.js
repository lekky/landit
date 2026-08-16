/// <reference path="../.pb_data/types.d.ts" />

/**
 * The two places where a collection rule cannot express what we need.
 *
 * `GET  /api/landit/crew-board/{crew}` — plan §3 guarantee 1 ends with a
 *   requirement rules alone cannot meet: "a private rider still appears on the
 *   crew board by name and score, so the crew board reads a narrow
 *   server-shaped payload, never the full record." This is that payload. It is
 *   a fixed list of fields, built here — not a filtered view of the user record
 *   that a `?fields=` or `?expand=` could widen.
 *
 * `POST /api/landit/crews/join` — crews are invite-only with no discovery
 *   (plan §6.1), so `crew_members.createRule` is null and there is no client
 *   path into a crew that does not go through a code.
 */

routerAdd(
  'GET',
  '/api/landit/crew-board/{crew}',
  (e) => {
    const lib = require(`${__hooks}/lib/landit.js`);

    // The whole payload, listed here and nowhere else. Anything not on this
    // line cannot reach another rider through the board — no email, no town,
    // no plan, no role, no age band, no consent state.
    const BOARD_FIELDS = ['id', 'name', 'handle', 'avatar_key', 'streak', 'sports'];

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

    const rows = [];
    for (const membership of lib.findAll(e.app, 'crew_members', 'crew = {:crew}', {
      crew: crewId,
    })) {
      const rider = e.app.findRecordById('users', membership.getString('user'));

      // Guarantee 4: a rider held behind the consent gate is not visible to
      // another rider anywhere, and the crew board is not an exception.
      if (lib.isConsentLimited(rider) || rider.getBool('suspended')) continue;

      const landed = lib.findAll(
        e.app,
        'trick_progress',
        'user = {:user} && (stage = "some" || stage = "most" || stage = "every")',
        { user: rider.id },
      ).length;

      // `landed`, `role` and `flair` are computed here rather than copied off
      // the record, which is why they sit outside `BOARD_FIELDS` — the list
      // above is what may be *read across* from another rider, and none of
      // these three is.
      //
      // `flair` (added by T11) is the Legend tag from plan §2.4, resolved from
      // the plan record to a boolean on this side of the wire. It is the reason
      // the board can show flair without `plan` ever joining the field list;
      // a plan id crossing to another rider would say what somebody pays for,
      // where the boolean says only what their name is allowed to wear. It is
      // cosmetic and stays cosmetic: it moves nobody's place on this board.
      const row = {
        landed: landed,
        role: membership.getString('role'),
        flair: lib.planIncludesFlair(e.app, rider),
      };
      for (const field of BOARD_FIELDS) row[field] = rider.get(field);
      rows.push(row);
    }

    rows.sort((a, b) => b.landed - a.landed);
    return e.json(200, { crew: crewId, riders: rows });
  },
  $apis.requireAuth('users'),
);

routerAdd(
  'POST',
  '/api/landit/crews/join',
  (e) => {
    const lib = require(`${__hooks}/lib/landit.js`);
    const viewer = e.auth;

    if (lib.isConsentLimited(viewer)) {
      throw new ForbiddenError(
        'This account is waiting on a guardian’s approval and cannot join a crew.',
      );
    }

    const body = new DynamicModel({ code: '' });
    e.bindBody(body);
    const code = String(body.code || '').trim();
    if (!code) throw new BadRequestError('An invite code is required.');

    let invite;
    try {
      invite = e.app.findFirstRecordByFilter('crew_invites', 'code = {:code}', { code: code });
    } catch {
      throw new BadRequestError('That invite code is not valid.');
    }

    const expires = invite.getDateTime('expires');
    if (!expires.isZero() && expires.string() < new DateTime().string()) {
      throw new BadRequestError('That invite has expired.');
    }

    const maxUses = invite.getInt('max_uses');
    if (maxUses > 0 && invite.getInt('uses') >= maxUses) {
      throw new BadRequestError('That invite has been used up.');
    }

    const crewId = invite.getString('crew');
    const already = lib.findAll(e.app, 'crew_members', 'crew = {:crew} && user = {:user}', {
      crew: crewId,
      user: viewer.id,
    });
    if (already.length) return e.json(200, { crew: crewId, joined: false });

    const membership = new Record(e.app.findCollectionByNameOrId('crew_members'));
    membership.set('crew', crewId);
    membership.set('user', viewer.id);
    membership.set('role', 'member');
    membership.set('joined', new DateTime().string());
    e.app.save(membership);

    invite.set('uses', invite.getInt('uses') + 1);
    e.app.save(invite);

    return e.json(200, { crew: crewId, joined: true });
  },
  $apis.requireAuth('users'),
);
