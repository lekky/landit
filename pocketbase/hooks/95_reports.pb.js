/// <reference path="../.pb_data/types.d.ts" />

/**
 * The reporting route, and the appeal against what we do with it (T18; plan
 * §6.1 and §6.5).
 *
 * The OSA's Protection of Children Codes want two things this hook is the
 * server half of: **an easy reporting route**, which has to work for somebody
 * who is not a signed-up rider, and **a complaints procedure covering our own
 * moderation decisions**. `reports.createRule` is therefore deliberately open —
 * the empty string, not `null` — and everything that stops an open create rule
 * being a hole is here.
 *
 * Four things this pins, whatever the request body claimed:
 *
 *  1. **`reporter`** is the authenticated account or nothing at all. A body
 *     naming somebody else would let a stranger file reports under a child's
 *     name, which is a way of getting that child's account looked at by staff —
 *     harassment wearing the shape of a safeguarding tool.
 *  2. **`status`** is `open`. A report that arrived already `dismissed` is a
 *     report nobody will read, and the create rule lets anyone arrive.
 *  3. **`outcome`** is empty. It is what staff wrote, and until T17's triage
 *     view writes one there is nothing legitimate to put there.
 *  4. **`complaint_of`**, when set, is a report *this caller filed*. Anything
 *     else is refused with the same message a nonexistent id gets, so the field
 *     cannot be used to test whether a given report exists.
 *
 * **This is not a message channel** (plan §6.1). A report is addressed to us,
 * never to another rider: `viewRule` and `listRule` limit reads to the
 * reporter's own rows, an anonymous report has no reporter and so is readable by
 * nobody at all, and nothing anywhere renders a report's text to a second rider.
 * A report is the one place free text leaves a rider, and it leaves toward
 * staff.
 *
 * **An anonymous report has to carry a return address.** The safeguarding page
 * promises a response within one working day and the complaints procedure
 * requires a route back, neither of which exists without one. It is also the
 * only thing the rate limit below can be keyed on: a signed-out caller has no
 * account to count against.
 *
 * **What is deliberately not here: a global ceiling.** An unkeyed cap across
 * every anonymous report would let one flood close the reporting route for
 * everybody, which is exactly the duty the route exists to discharge — the
 * cheapest attack on a safeguarding service should not be one this file hands
 * out. Volume with no key to it belongs at the request layer, in PocketBase's
 * own limiter, which is a deployment setting (see `lib/ratelimit.js` on why
 * that is a different kind of thing). Filed as an issue rather than assumed.
 */

onRecordCreateRequest((e) => {
  // Every constant is declared inside the handler: it is serialised into an
  // isolated VM and arrives with no closure over this file (`lib/landit.js`
  // header, and the same note in `62_spots.pb.js`).
  const SUBJECT_TYPES = ['profile', 'clip', 'spot', 'other'];
  const REASONS = ['harassment', 'unsafe', 'illegal', 'sexual', 'self_harm', 'spam', 'other'];
  const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  const REPORT_WINDOW_MINUTES = 60;
  const REPORT_MAX_PER_WINDOW = 5;
  const REPORT_MAX_OPEN = 20;

  const DETAIL_MAX = 2000;

  if (e.hasSuperuserAuth()) {
    e.next();
    return;
  }

  const limits = require(`${__hooks}/lib/ratelimit.js`);
  const reporter = e.auth;
  const record = e.record;

  // ------------------------------------------------------------ who sent it --

  const claimedEmail = String(record.get('reporter_email') || '')
    .trim()
    .toLowerCase();

  if (reporter) {
    // The account already says who this is. Storing the address as well would
    // be a second copy of a rider's email on a row staff read by hand, for no
    // gain: `reporter` resolves to it whenever a reply is actually needed.
    record.set('reporter', reporter.id);
    record.set('reporter_email', '');
  } else {
    record.set('reporter', '');
    if (!EMAIL_PATTERN.test(claimedEmail)) {
      throw new BadRequestError(
        'Leave an email address so we can tell you what we did about this.',
      );
    }
    record.set('reporter_email', claimedEmail);
  }

  record.set('status', 'open');
  record.set('outcome', '');

  // --------------------------------------------------------- what it is about --

  const subjectType = String(record.get('subject_type') || '').trim();
  if (SUBJECT_TYPES.indexOf(subjectType) === -1) {
    throw new BadRequestError('Say what this is about.');
  }

  const reason = String(record.get('reason') || '').trim();
  if (REASONS.indexOf(reason) === -1) {
    throw new BadRequestError('Pick the closest reason.');
  }

  const detail = String(record.get('detail') || '').trim();
  if (!detail) {
    throw new BadRequestError('Tell us what happened, in your own words.');
  }
  if (detail.length > DETAIL_MAX) {
    throw new BadRequestError(`Keep it under ${DETAIL_MAX} characters.`);
  }
  record.set('detail', detail);
  record.set('subject_id', String(record.get('subject_id') || '').trim());

  // ------------------------------------------------------------- the appeal --

  const appealOf = String(record.get('complaint_of') || '').trim();
  if (appealOf) {
    let parent = null;
    try {
      parent = e.app.findRecordById('reports', appealOf);
    } catch {
      parent = null;
    }

    // One refusal for "no such report" and for "not yours", deliberately. A
    // caller who could tell the two apart could ask this endpoint whether any
    // given id is a report — which is a read of a collection whose whole point
    // is that nobody reads anybody else's.
    const ownedBySignedIn = !!(reporter && parent && parent.getString('reporter') === reporter.id);
    const ownedByEmail = !!(
      !reporter &&
      parent &&
      parent.getString('reporter_email') &&
      parent.getString('reporter_email').toLowerCase() === claimedEmail
    );
    if (!parent || (!ownedBySignedIn && !ownedByEmail)) {
      throw new BadRequestError(
        'We cannot find that report. Check the reference on the email we sent you.',
      );
    }

    // One level only. An appeal against an appeal is a loop with a person at
    // the end of it, and the complaints procedure is a step, not a ladder.
    if (parent.getString('complaint_of')) {
      throw new BadRequestError(
        'This one has already been looked at twice. Reply to the email and a person will pick it up.',
      );
    }

    // An appeal is about the same thing the original was about, so the subject
    // comes off the parent rather than out of the request. It stops an appeal
    // being a way to file a fresh report about somebody else under a reference
    // that has already been through triage.
    record.set('subject_type', parent.getString('subject_type'));
    record.set('subject_id', parent.getString('subject_id'));
  }

  // ------------------------------------------------------------ how many --

  // Keyed on whoever is asking: the account when there is one, the address when
  // there is not. Never a shared counter — see the header.
  const key = reporter
    ? { filter: 'reporter = {:who}', params: { who: reporter.id } }
    : { filter: 'reporter_email = {:who}', params: { who: claimedEmail } };

  limits.assertUnderOutstandingLimit(e.app, {
    collection: 'reports',
    filter: `(${key.filter}) && status = 'open'`,
    params: key.params,
    max: REPORT_MAX_OPEN,
    // The address is duplicated from `CONTACT` in `@landit/core`, which the
    // JSVM cannot import — the same deliberate copy `lib/consent_mail.js`
    // carries, and there is a test that keeps the two in step.
    message:
      'You have a lot of reports waiting with us already. We are working through them — email safeguarding@landthetrick.com if something needs looking at sooner.',
  });

  limits.assertUnderRateLimit(e.app, {
    collection: 'reports',
    filter: key.filter,
    params: key.params,
    windowMinutes: REPORT_WINDOW_MINUTES,
    max: REPORT_MAX_PER_WINDOW,
    message:
      'That is a lot of reports in one go. Give it a few minutes — the ones you have sent are already with us.',
  });

  e.next();
}, 'reports');

/*
 * **No audit hook here on purpose.** `reports` is already in `lib/audit.js`'s
 * `AUDITED` list, so `70_audit.pb.js` writes a row for every create with the
 * actor resolved the same way as every other collection. A second row would
 * double-count the thing an annual OSA review counts.
 */
