/// <reference path="../.pb_data/types.d.ts" />

/**
 * Fields the server decides, not the client — the small, boring half of the
 * security model that stops a request claiming to be from somebody else or to
 * have already been approved.
 *
 * These are *request* hooks and they step aside for a superuser token: staff
 * writes go through server actions holding one (plan §3), and a staff member
 * publishing a spot or filing a report on somebody's behalf is the point of
 * that path. The consent gate at the bottom of this file is the opposite — a
 * model hook, with no way past it.
 */

/** A submitted spot reaches nobody until a human approves it (plan §6.1). */
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    e.record.set('status', 'pending');
    e.record.set('submitted_by', e.auth ? e.auth.id : '');
  }
  e.next();
}, 'spots');

/**
 * Reports are the OSA reporting route, so an unauthenticated person can file
 * one (plan §6.1/§6.5). What they cannot do is decide who filed it, what state
 * it is in, or what we concluded.
 */
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    e.record.set('reporter', e.auth ? e.auth.id : '');
    e.record.set('status', 'open');
    e.record.set('outcome', '');
  }
  e.next();
}, 'reports');

/** The rider who creates a crew owns it, whatever the body said. */
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth() && e.auth) e.record.set('owner', e.auth.id);
  e.next();
}, 'crews');

/** Creating a crew puts you in it — the one membership no invite precedes. */
onRecordAfterCreateSuccess((e) => {
  e.next();
  const collection = e.app.findCollectionByNameOrId('crew_members');
  const row = new Record(collection);
  row.set('crew', e.record.id);
  row.set('user', e.record.getString('owner'));
  row.set('role', 'owner');
  row.set('joined', new DateTime().string());
  e.app.save(row);
}, 'crews');

/** Invites are minted by a member, for their own crew, with a server-set code. */
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    if (e.auth) e.record.set('created_by', e.auth.id);
    e.record.set('uses', 0);
  }
  if (!e.record.getString('code')) {
    e.record.set('code', $security.randomStringByRegex('[A-Z0-9]{8}'));
  }
  e.next();
}, 'crew_invites');

/** Attendance, dismissals and notes are always the caller's own. */
onRecordCreateRequest(
  (e) => {
    if (!e.hasSuperuserAuth() && e.auth) e.record.set('user', e.auth.id);
    e.next();
  },
  'event_attendance',
  'announcement_dismissals',
  'trick_notes',
);

/**
 * Guarantee 4, the billing half: an account held behind the guardian-consent
 * gate cannot hold a subscription. Model-level, because subscriptions are
 * written by the Stripe webhook with a superuser client (plan §2.4) — the
 * request layer is not where this can be caught.
 */
onRecordCreate((e) => {
  const lib = require(`${__hooks}/lib/landit.js`);
  const user = e.app.findRecordById('users', e.record.getString('user'));
  if (lib.isConsentLimited(user)) {
    throw new ForbiddenError(
      'This account is waiting on a guardian’s approval and cannot hold a subscription.',
    );
  }
  e.next();
}, 'subscriptions');

/**
 * Guarantee 4, the crew half. The collection rules already require a consented
 * viewer, but membership is created by server code (crew creation and the
 * invite route), so the model hook is what actually holds there.
 */
onRecordCreate((e) => {
  const lib = require(`${__hooks}/lib/landit.js`);
  const user = e.app.findRecordById('users', e.record.getString('user'));
  if (lib.isConsentLimited(user)) {
    throw new ForbiddenError(
      'This account is waiting on a guardian’s approval and cannot join a crew.',
    );
  }
  e.next();
}, 'crew_members');
