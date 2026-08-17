/// <reference path="../.pb_data/types.d.ts" />

/**
 * The one field account erasure needs (T18, plan §6.5).
 *
 * **Deletion here is anonymise-and-retain, not a hard delete** — owner decision
 * (Rachid, 2026-08-17, in chat). Rider-identifying fields are wiped and the
 * account is made unusable; `audit_log`, `guardian_consents` and any `reports`
 * naming the rider stay, with the identity reduced to a stable pseudonym. That
 * honours erasure while keeping the child-safety trail the OSA position in §6.1
 * depends on: a service that can be made to forget who was reported, on request
 * by the person who was reported, has no moderation record at all.
 *
 * Why a field and not a reuse of `suspended`: the two states look identical
 * from a rule's point of view and mean opposite things to a human. `suspended`
 * is a moderation decision about a rider who is still there; `anonymised_at` is
 * a rider who asked to be gone and whose row survives only as a hook for the
 * records that had to. Staff reading a report against a suspended account are
 * looking at somebody; staff reading one against an anonymised account are
 * looking at a pseudonym. Conflating them would hide which of those they are in.
 *
 * **The pseudonym is the handle**, not a fifth field. `users.handle` is already
 * unique case-insensitively, already indexed, and already the identity every
 * retained record labels a rider by (`audit_log.actor_label`), so erasure
 * overwrites it with `exrider_<8 hex>` derived from the account id and rewrites
 * the retained labels to match. One identifier, one place (plan §3).
 *
 * **Additive.** One nullable field on `users`. Every existing row reads empty,
 * which is the "not erased" state, and nothing reads it as anything else.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    users.fields.add(
      new DateField({
        type: 'date',
        name: 'anonymised_at',
        required: false,
      }),
    );

    app.save(users);
  },

  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('anonymised_at');
    app.save(users);
  },
);
