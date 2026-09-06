import { createSuperuserClient, type Client, type StaffActor, type UsersRecord } from '@landit/db';
import { notFound, redirect } from 'next/navigation';

import { ROUTES, signInHref } from '@/lib/routes';
import { currentRider } from '@/lib/session';

/**
 * The staff gate (plan §5, §7 T16).
 *
 * Staff are a role, not an app: there is no staff login, no staff passcode and
 * no second account. Somebody on staff signs in the way every rider does, and
 * `users.role` decides whether `/admin` exists for them. The prototype's
 * email-plus-shared-passcode form (`miles@landit.app` / `ramp`) is deliberately
 * not recreated — a shared secret in a repo is a shared secret, and the plan
 * settled this before the build started.
 *
 * **Nothing grants `role` over the API.** `guardUserWrite` in
 * `pocketbase/hooks/lib/landit.js` refuses it on create and on update from
 * every request-authenticated caller, so the only way an account becomes staff
 * is the PocketBase superuser dashboard — see `docs/staff-accounts.md`. That is
 * the reason this file can treat the field as trustworthy.
 */

export interface StaffSession {
  /** The signed-in staff rider. */
  readonly rider: UsersRecord;
  /** Their own token's client. Reads as them; subject to every rule. */
  readonly client: Client;
  /**
   * The product's own client, already authenticated. Subject to no rule at all.
   *
   * Held for the length of one request and never returned to the browser. It is
   * what the portal reads and writes through, because a staff rider's own token
   * sees the rider base through the privacy rule and `audit_log` not at all.
   */
  readonly superuser: Client;
  /** Who to record against anything this request changes. */
  readonly actor: StaffActor;
}

/** Is this rider staff? The single place that spells the comparison out. */
export function isStaff(rider: Pick<UsersRecord, 'role'> | null | undefined): boolean {
  return rider?.role === 'staff';
}

/**
 * The staff session, or no page at all.
 *
 * Three outcomes, and the difference between the last two is on purpose:
 *
 * - **Signed out** → sign in, and come back here afterwards. A staff member
 *   whose session expired mid-task should not have to find the portal again.
 * - **Signed in, not staff** → `notFound()`. A 404, not a 403: a rider who
 *   guesses `/admin` learns nothing about whether a staff portal exists, which
 *   is the same answer `users` gives about a private profile (plan §3
 *   guarantee 1). "Forbidden" confirms the door.
 * - **Signed in, staff** → the session, with the superuser client attached.
 *
 * `redirect` and `notFound` work by throwing, so nothing here may be wrapped in
 * a `try` that swallows them.
 */
export async function requireStaff(returnTo: string = ROUTES.admin): Promise<StaffSession> {
  const session = await currentRider();
  if (!session) redirect(signInHref(returnTo));
  if (!isStaff(session.rider)) notFound();

  const superuser = await createSuperuserClient();

  return {
    rider: session.rider,
    client: session.client,
    superuser,
    actor: { id: session.rider.id, label: session.rider.handle || session.rider.email || 'staff' },
  };
}

/**
 * The owner's own account id, from the deploy environment. Empty when unset.
 *
 * **An id, not an email address** (owner decision, Rachid, 2026-09-06, in
 * chat). A PocketBase record id is immutable and meaningless outside the
 * database; an email address is neither. `users.email` can be changed — by the
 * account itself through the confirmation flow, and by anybody holding the
 * superuser dashboard — so an email gate is a gate whose key can be recut,
 * and the recutting would not look like a privilege change to anyone reading
 * the audit log. It would also put a personal address in the repository, which
 * is the one thing `.env` files exist to avoid.
 *
 * Read through a function rather than captured at module scope so a test can
 * set it per case, and so the value is never baked into a build: this is a
 * server file, but `process.env` reads that Next can see at build time are
 * inlined, and a gate that inlines is a gate that needs a rebuild to rotate.
 */
function ownerId(): string {
  return (process.env.LANDIT_OWNER_ID ?? '').trim();
}

/**
 * Is this the owner — the only account that may delete another?
 *
 * **Unset fails closed, and that is the important half.** A box with no
 * `LANDIT_OWNER_ID` answers `false` for everybody, so a deploy that has never
 * been configured has the destructive action switched off rather than open to
 * whoever asks first. The alternative — treating "no owner configured" as "any
 * staff member will do" — turns a missing environment variable into a silent
 * privilege grant on a live box, which is the failure you find out about
 * afterwards.
 *
 * Deliberately narrower than `isStaff`. Staff is a role several people can
 * hold and is granted from the superuser dashboard; this is one account, named
 * on the deploy, and holding it is not something the product can hand out.
 */
export function isOwner(rider: Pick<UsersRecord, 'id'> | null | undefined): boolean {
  const owner = ownerId();
  return owner.length > 0 && !!rider && rider.id === owner;
}
