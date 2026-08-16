/// <reference path="../.pb_data/types.d.ts" />

/**
 * The audit log. "The handoff flags its absence explicitly" (plan §3).
 *
 * T16's admin server actions write their own richer `audit_log` rows in the
 * same transaction as the mutation. This hook is the floor underneath that: any
 * write to a staff-owned collection that reaches the API — from any client,
 * including the superuser dashboard — leaves a row whether the caller
 * remembered to write one or not.
 *
 * Note the shape: `AUDITED` is read at file scope because it is a *registration*
 * argument, and re-`require`d inside each handler because a handler runs in its
 * own isolated VM and cannot see this file's scope.
 */
const { AUDITED } = require(`${__hooks}/lib/audit.js`);

onRecordCreateRequest(
  (e) => {
    const lib = require(`${__hooks}/lib/landit.js`);
    e.next();
    lib.writeAudit(
      e.app,
      Object.assign(lib.actorOf(e), {
        action: 'create',
        entity: e.record.collection().name,
        entityId: e.record.id,
        before: null,
        after: e.record.publicExport(),
      }),
    );
  },
  ...AUDITED,
);

onRecordUpdateRequest(
  (e) => {
    const lib = require(`${__hooks}/lib/landit.js`);
    const before = e.record.original().publicExport();
    e.next();
    lib.writeAudit(
      e.app,
      Object.assign(lib.actorOf(e), {
        action: 'update',
        entity: e.record.collection().name,
        entityId: e.record.id,
        before: before,
        after: e.record.publicExport(),
      }),
    );
  },
  ...AUDITED,
);

onRecordDeleteRequest(
  (e) => {
    const lib = require(`${__hooks}/lib/landit.js`);
    const before = e.record.publicExport();
    const id = e.record.id;
    const entity = e.record.collection().name;
    e.next();
    lib.writeAudit(
      e.app,
      Object.assign(lib.actorOf(e), {
        action: 'delete',
        entity: entity,
        entityId: id,
        before: before,
        after: null,
      }),
    );
  },
  ...AUDITED,
);

/** On `users`, only the four fields that decide access are worth a row. */
onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/lib/landit.js`);
  const audit = require(`${__hooks}/lib/audit.js`);

  const before = audit.snapshot(e.record.original(), audit.AUDITED_USER_FIELDS);
  e.next();
  const after = audit.snapshot(e.record, audit.AUDITED_USER_FIELDS);

  let changed = false;
  for (const field of audit.AUDITED_USER_FIELDS) {
    if (String(before[field]) !== String(after[field])) changed = true;
  }
  if (!changed) return;

  lib.writeAudit(
    e.app,
    Object.assign(lib.actorOf(e), {
      action: 'update',
      entity: 'users',
      entityId: e.record.id,
      before: before,
      after: after,
    }),
  );
}, 'users');
