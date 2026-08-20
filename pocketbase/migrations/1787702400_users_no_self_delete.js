/// <reference path="../.pb_data/types.d.ts" />

/**
 * Close the second door out of an account (plan §6.5; T18).
 *
 * `users.deleteRule` shipped as `id = @request.auth.id` — the PocketBase
 * default shape for a self-service collection, and correct for almost any
 * collection except this one. It meant erasure had **two** routes and only one
 * of them implemented the decision:
 *
 * - `POST /api/landit/account/delete` → `lib/erasure.js#anonymiseAccount`:
 *   anonymise-and-retain, password-confirmed, audited (owner decision, Rachid,
 *   2026-08-17, in chat).
 * - `DELETE /api/collections/users/records/<own id>` → a plain row delete, with
 *   nothing to confirm and nothing written down.
 *
 * The second is the damaging one, and not only because it skips the pseudonym.
 * `guardian_consents.user` and `subscriptions.user` are both `cascadeDelete`,
 * so the row delete takes the guardian consent record with it — the evidence
 * plan §6.2 says is kept for the life of the account, destroyed by the account
 * it is evidence about, on an unauthenticated-by-password request. And
 * `reports.reporter` and `audit_log.actor` do not cascade, so what is left
 * behind is a moderation trail pointing at a row that no longer exists: the
 * reports survive, unreadable, which is the outcome `anonymiseAccount` was
 * written specifically to avoid ("a cascade delete ... turns a pseudonymous
 * trail into an unreadable one" — `lib/erasure.js`).
 *
 * So: superuser only. A rider ends their account through the route that knows
 * what ending an account means, and there is no longer a second way to phrase
 * the request.
 *
 * **The superuser dashboard is deliberately still able to delete a `users`
 * row.** That is the path for genuine data cleanup — test accounts, a bad
 * import — and it is a path that already requires the box's own credentials
 * rather than a rider's session. Guarding a rider's token is the whole job
 * here; taking the tool away from the operator is not.
 *
 * Nothing in the product deletes a `users` record, so this closes a rule no
 * caller was using: `packages/db` and `apps/web` were checked, and account
 * closure goes through the route above in both.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.deleteRule = null;
    app.save(users);
  },

  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.deleteRule = 'id = @request.auth.id';
    app.save(users);
  },
);
