# Staff accounts

How somebody gets into `/admin`, and why it is deliberately awkward.

## The short version

Staff are a **role on an ordinary rider account** (plan §5). There is no staff login, no staff
password, no second app. Somebody who works on Land It signs in the way every rider does, and
`users.role = 'staff'` is what makes `/admin` exist for them.

The role can only be granted from the **PocketBase superuser dashboard**. There is no API path,
no CLI, no environment variable and no admin screen that grants it — including the admin screens
themselves. That is not an oversight to be tidied up later; it is the reason the whole portal can
trust one boolean.

## Granting it

1. Ask the person to sign up at `/signup` like anybody else, and note their handle.
2. Open the PocketBase dashboard for the environment (`/_/`) and sign in as superuser. The
   superuser account is the owner's; it is not a rider login and it is not shared with staff.
3. **Collections → users**, find the record by handle, set `role` to `staff`, save.
4. They now see `/admin` on their next request. Nothing else changes about their account: they
   keep their own tricks, their own plan and their own privacy setting.

Removing it is the same steps with `rider`. It takes effect immediately — `requireStaff` re-reads
the record on every request rather than trusting the session token, so there is no sign-out to
chase.

## Why no script

A one-command "make this person staff" is the obvious convenience, and it is the thing worth not
having. Anything that can grant the role is a thing that can be run by mistake, committed with a
default in it, or found on a box by somebody who should not have it. The dashboard route needs
the superuser credentials, which live in one place and belong to one person, and it leaves the
grant visible in `audit_log` like any other change to the four protected fields.

## What the role does and does not buy

**Does:** `/admin` renders instead of a 404. That is the entire difference.

**Does not:** any extra power over the API. A staff member's own token is an ordinary rider token
and is refused by exactly the same rules — they cannot patch another rider's plan, cannot suspend
anybody, cannot promote anybody, and cannot read `audit_log`. Every write the portal makes goes
through a server-held superuser client that the browser never sees, inside a server action that
re-checks the role. This is proven over HTTP in `pocketbase/tests/staff-role.test.ts`, not
asserted here.

The consequence worth stating plainly: **taking a staff member's session does not give an attacker
staff powers over the data.** It gives them the ability to *ask the server* to make staff changes,
each of which is logged against that staff member's name. Losing the superuser credentials is the
serious event; losing a staff session is a containable one.

## The local development instance

`pnpm pb:dev` serves a scratch database from `pocketbase/.pb_data`, which starts with no superuser
at all. To get a working portal locally:

```bash
pnpm pb -- superuser upsert you@example.invalid a-long-local-password
```

Then sign up in the app, set your own `role` to `staff` in the dashboard, and set
`POCKETBASE_SUPERUSER_EMAIL` and `POCKETBASE_SUPERUSER_PASSWORD` in `apps/web/.env.local` to the
pair you just created — the portal's reads and writes need them, and without them `/admin`
throws `SuperuserUnavailable` rather than rendering.

On the deployed box those two variables are Coolify environment variables and are the owner's to
set; see issue #62, which is the same requirement arriving from the "I rode today" path.
