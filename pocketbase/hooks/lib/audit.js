/// <reference path="../../.pb_data/types.d.ts" />

/**
 * What the audit hook watches, kept in a module because every handler runs in
 * its own isolated VM and cannot see its own file's top-level constants.
 */

/** Staff-owned collections: any API write to one leaves a row. */
const AUDITED = [
  'tricks',
  'trick_prereqs',
  'stickers',
  'plans',
  'spots',
  'events',
  'challenges',
  'announcements',
  'reports',
];

/** Rider profile edits are noise; the four fields that decide access are not. */
const AUDITED_USER_FIELDS = ['role', 'plan', 'suspended', 'consent_state'];

function snapshot(record, fields) {
  const out = {};
  for (const field of fields) out[field] = record.get(field);
  return out;
}

module.exports = { AUDITED, AUDITED_USER_FIELDS, snapshot };
