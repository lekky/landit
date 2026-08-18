# Infrastructure — box1

The shared VPS that hosts Land The Trick and other products (see implementation-plan.md §2.6).
Set up 2026-08-15. This file records what exists and how to reach it — no secrets live here.

## The box

| | |
| --- | --- |
| Provider | hostmedia.uk — "2+4096 VPS Series" (2 vCPU, 4GB RAM, 40GB SSD), Coventry UK |
| IPv4 | `188.119.155.124` |
| IPv6 | `2a0f:8f00::c:0:0:2` |
| Hostname | `box1.hellowebdesign.co.uk` (A record → the IPv4) |
| OS | Ubuntu 24.04 LTS, 2GB swapfile |
| Cost | £16.80/mo |

## Access

- **SSH**: key-only (`PasswordAuthentication no`), root login by key.
  Key lives on Rachid's machine at `C:\Users\rotsm\.ssh\box1_hellowebdesign`.
  `ssh -i ~/.ssh/box1_hellowebdesign root@188.119.155.124`
- **Coolify dashboard**: https://box1.hellowebdesign.co.uk (admin account: Rachid).
- **Coolify API**: only from the box itself — the token is on the box at `/root/.coolify_token`
  (never in this repo). Pattern:
  `ssh ... 'curl -H "Authorization: Bearer $(cat /root/.coolify_token)" http://localhost:8000/api/v1/...'`
  Port 8000 is not reachable from the internet; don't "fix" that.
- **Uptime Kuma**: https://status.hellowebdesign.co.uk (admin account: Rachid).
- **Coolify secrets backup**: `/data/coolify/source/.env` — copy kept in Rachid's password manager.

## Security posture (don't regress this)

- ufw: only OpenSSH, 80, 443 allowed in. fail2ban active. unattended-upgrades on.
- **Docker bypasses ufw**, so Docker-published admin ports are blocked in the `DOCKER-USER`
  iptables chain via `/etc/ufw/after.rules` (ports 8000 and 8080 dropped from `eth0`).
  Any future service that publishes a port on `0.0.0.0` instead of routing through the
  Coolify proxy must either be un-published or added to that block list.
- Ports 6001–6002 stay open: Coolify's authenticated websocket, used by the dashboard from
  the browser.
- Coolify MCP server: disabled. API allowlist: empty, mitigated by port 8000 being firewalled.

## Layout in Coolify

- Project **infra** — shared box services. Currently: `uptime-kuma`
  (service uuid `5cxwcyvdozkz70erdus5ck0z`).
- One Coolify **project per product** — app + PocketBase instance + PR previews. Products are
  isolated; nothing product-specific goes in `infra`.
- Server uuid (for API calls): `lvkalcforx2tdkygp0odsk2a`.
- Project **landit** (uuid `fx6khydt9jclkaut4dftmrup`, environment `production`
  `bkdfnev1unlcw0z1fxwr16od`), deployed 2026-08-16:

| | App uuid | Domain | Port | Storage |
| --- | --- | --- | --- | --- |
| `landit-web` | `mzphl8yn5yw2i2rd6gx9n1g8` | landthetrick.com + www | 3000 | none |
| `landit-pocketbase` | `qqsqc1knvhellrcwgebu2enw` | api.landthetrick.com | 8090 | `/pb_data` |

  Both build from this repo's Dockerfiles on every deploy. `landit-web` carries
  `NEXT_PUBLIC_POCKETBASE_URL` as a **build** variable (Next inlines it) and
  `landit-pocketbase` carries `LANDIT_APP_URL` at run time.

  **Deploys are manual, and that is a decision** (Rachid, 2026-08-17, in chat). Auto-deploy on
  merge to `main` was considered and declined. It matters more than it looks: the owner does not
  review PRs and sessions squash-merge their own (`CLAUDE.md`), so **merging is not shipping** —
  a human clicking Redeploy is the only thing between an agent's merge and a live site used by
  children. Two facts make that separation worth keeping: `main` has been red after roughly one
  merge in three lately (issue #165), and the site is now public. A merged `main` and a deployed
  box are therefore routinely *different commits*; check the box rather than the log when asking
  what is live.

## Backups (done 2026-08-15)

- **R2 bucket `box1-backups`** on Rachid's Cloudflare account, **EU jurisdiction** — note the
  endpoint is therefore `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com` (the `.eu.` matters;
  the plain endpoint 403s). Free tier 10GB; usage alert configured in Cloudflare Notifications.
- **Litestream** (systemd service `litestream`, config `/etc/litestream.yml`, credentials via
  `EnvironmentFile=/root/.litestream-r2.env`). Replicates continuously, 7-day retention.
- A **canary database** (`/var/lib/litestream-canary/canary.db`) replicates at all times so the
  pipeline proves itself even before/between real databases.
- **Land The Trick's PocketBase is replicated — added 2026-08-17** (issue #167), to bucket path
  `landit`. Its database is the Docker volume, **not** the `<product>/pb_data/data.db` shape the
  config's own template comment suggests:
  `/var/lib/docker/volumes/qqsqc1knvhellrcwgebu2enw-pb-data/_data/data.db`. Find it on any box with
  `docker inspect <container> --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'`
  — the container is named for the app uuid, so grepping for "pocketbase" finds nothing.
  **`data.db` only: `auxiliary.db` beside it is PocketBase's log database and is deliberately not
  replicated.** Riders, `guardian_consents` and `audit_log` are all in `data.db`.
- **Restore rehearsals passed 2026-08-15** (canary: replicate → delete local → `litestream restore`
  → content verified) **and 2026-08-17** (the PocketBase database, restored from the replica to a
  scratch path and verified there by the owner). Re-rehearse after adding each real database — and
  restore to `/tmp`, never over the live file.
- **When a PocketBase instance is deployed**: add its `data.db` path as a new entry in
  `/etc/litestream.yml` (template comment inside) and `systemctl restart litestream`. A PocketBase
  whose database is not in that file is NOT backed up.
- **Checking a backup by hand fails with `NoCredentialProviders` and that is not a fault.**
  `/root/.litestream-r2.env` is loaded by systemd's `EnvironmentFile`, so an interactive shell has
  none of it and `${R2_ACCESS_KEY_ID}` expands to nothing — `litestream generations` and
  `litestream restore` then report no valid credentials while the *service* is replicating
  perfectly. Either read the service's own view (`journalctl -u litestream -n 40`, which needs no
  credentials and is the better check anyway), or load the file first:
  `set -a && . /root/.litestream-r2.env && set +a && litestream …`.

## Bringing `landthetrick.com` up (runbook)

The product domain, chosen and registered 2026-08-16 (Rachid, at Namecheap). Step 1 is done; the
checklist in the next section is the live progress.

**Order matters.** Certificates need DNS and Coolify needs certificates. Steps 5 and 6 both touch
the same SPF record, and that is where the one mistake in this list gets made.

The brand is **Land The Trick** and the domain matches it. It did not always: the brand was **Land
It** until 2026-08-17, when the owner renamed it to close the gap this section used to record as
"fine and deliberate". The reason the gap existed is still the reason the rule exists — `landit.app`
was written into published copy before anyone owned it, it belongs to someone else and its
registration has expired: **never publish an address on a domain that is not yet registered to us.**

### 1. DNS at Namecheap — **done 2026-08-16**

The domain is registered at **Namecheap**, and its DNS stays there on **Namecheap BasicDNS**. Two
alternatives were considered and rejected: Cloudflare (R2 and Cloudflare Web Analytics both work
wherever DNS lives, and its free Email Routing is redundant once cPanel provides mailboxes), and
hostmedia's own nameservers.

Namecheap wins on one thing that matters more than either: **cPanel's DNS zone is then never
authoritative**, so creating the mail account in step 5 cannot move the website off the box. With
hostmedia's nameservers it could, and silently.

The cost is that cPanel's generated mail records live in a zone nobody queries, so two of them get
copied across by hand — see step 5. That is a one-off; a website disappearing is not.

Records, in **Domain List → Manage → Advanced DNS → Host Records**. `Host` is a label, so type
`api`, not `api.landthetrick.com`:

| Type | Host | Value |
| --- | --- | --- |
| A Record | `@` | `188.119.155.124` |
| AAAA Record | `@` | `2a0f:8f00::c:0:0:2` |
| A Record | `www` | `188.119.155.124` |
| A Record | `api` | `188.119.155.124` |
| A Record | `*` | `188.119.155.124` |

Three things about this screen:

- **Delete the two records Namecheap ships with**: a URL Redirect on `@` to a parking page and a
  CNAME `www` → `parkingpage.namecheap.com`. Both fight the records above.
- **Without the wildcard there are no preview deploys.** Coolify gives each PR its own subdomain;
  `*` is what makes them resolve.
- **The AAAA is the first suspect if certificates fail in step 2.** Let's Encrypt prefers IPv6 when
  a hostname has an AAAA, and Docker does not publish ports on IPv6 unless the daemon is configured
  for it. Boulder does fall back to IPv4, so this usually just works — but if the root domain will
  not issue while `api` and the previews do, that difference is why. `curl -6 -I http://[2a0f:8f00::c:0:0:2]`
  from an IPv6-capable machine settles it in one command.

### 2. Coolify project

**Done 2026-08-16 — both services are live on HTTPS** (their uuids and domains are in Layout above).
This section stays as the runbook: it is what was done, and what a rebuild or a second environment
would repeat. Both deploy **from this repository's Dockerfiles** — Nixpacks cannot be trusted with a pnpm workspace whose app compiles
three sibling packages from source, and PocketBase has no image that would carry *our* migrations
and hooks. Both are built on every PR by CI's `docker images` job, so what Coolify builds here is
what was already proven green.

**Both services use Base Directory `/`** — the repository root. A narrower context cannot see
`packages/`, and the build fails at the point where it tries to.

| | Web app | PocketBase |
| --- | --- | --- |
| Build pack | Dockerfile | Dockerfile |
| Dockerfile | `apps/web/Dockerfile` | `pocketbase/Dockerfile` |
| Base directory | `/` | `/` |
| Domain | `https://landthetrick.com` | `https://api.landthetrick.com` |
| Port | `3000` | `8090` |
| Persistent storage | none | **`/pb_data`** |

Two settings that are not obvious and cost a rebuild each:

- **The web app needs `NEXT_PUBLIC_POCKETBASE_URL=https://api.landthetrick.com` as a *build*
  argument, not a runtime variable.** Next inlines `NEXT_PUBLIC_*` into the browser bundle at build
  time, so setting it at runtime does nothing at all and the deployed app's API calls go nowhere.
  In Coolify it must be marked "Build Variable". It is now the *only* `NEXT_PUBLIC_*` variable
  this app takes — the Mapbox token that used to share this warning is gone with the move to
  MapLibre (step 2c).
- **PocketBase's `/pb_data` must be a persistent volume before the first deploy.** Without it the
  database — riders, consent records, everything — lives in the container's writable layer and is
  destroyed by the next deploy. Its `data.db` inside that volume is also the path step 3 adds to
  Litestream.

Deploy PocketBase first, visit `https://api.landthetrick.com/_/` and create the superuser, then
deploy the web app. Confirm **both** serve HTTPS before going on.

**The web app also takes two runtime variables that decide whether the public sees the product at
all.** Unlike `NEXT_PUBLIC_POCKETBASE_URL` above, which is inlined into the browser bundle while the
image is built, these are read on the server per request — which is what makes them changeable
without a rebuild:

| Variable | Value while building | Value at launch |
| --- | --- | --- |
| `LANDIT_SITE_LIVE` | leave unset, or `false` | `true` — **set 2026-08-17, the site is live** |
| `LANDIT_PREVIEW_KEY` | a long random string | keep it, or clear it |

`LANDIT_SITE_LIVE` decides whether every URL serves the app or the holding page. It is read by
`apps/web/src/proxy.ts` on each request, so **going live is this variable plus a restart — there is
no rebuild.**

**In Coolify, the setting that matters is Runtime → "Available in the container".** That is the one
the gate reads. Marking it available at build time as well is harmless — `apps/web/Dockerfile`
declares no `ARG LANDIT_SITE_LIVE`, so Docker ignores a build argument by that name, and the two
routes that read the flag (`app/robots.ts` and the holding page) are both `force-dynamic`, so
nothing about it can be baked into the build. Setting it build-time *instead of* runtime is the
failure to avoid: the app then sees nothing at request time, the site holds shut for good, and
Coolify's variable list shows it as set the whole time — which is a miserable thing to debug.

`LANDIT_PREVIEW_KEY` has one Coolify-specific trap of its own: leave **Interpolation** on and a
value containing `$` is expanded before it reaches the container, so the key arrives altered and the
preview link simply shows the holding page with nothing to say why. Keep the key alphanumeric — hex
is ideal — or turn interpolation off. Being a secret, it also has no business being available at
build time.

**The general rule, since that trap is not specific to this variable: tick Coolify's "Literal"
column on anything random or secret, and leave it off for values typed by hand.** Literal is
interpolation off. A hand-typed value — `true`, an https URL — has no `$` in it to expand and never
will; a generated one might, and a secret is precisely where nobody can tell by looking that it
arrived truncated. That covers the superuser password today and `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET` and `NEXT_PUBLIC_MAPBOX_TOKEN` when they exist. None of those formats
normally contains a `$` — and a Stripe key that silently arrives wrong fails somewhere far more
expensive than a preview link does.

It fails **shut**: unset in production means the holding page. A deploy that forgets the variable
shows a coming-soon page, which costs a restart to fix — the opposite mistake publishes an
unfinished product to children and cannot be taken back.

`LANDIT_PREVIEW_KEY` is the way past the holding page while it is up: open
`https://landthetrick.com/?preview=<key>` once and a 30-day httpOnly cookie lets that browser
through to the real site. **Leaving it blank switches the bypass off entirely** rather than opening
it to everyone. It is a shared password for an unreleased site, not a per-person credential — treat
it as something to rotate rather than something to hand around.

While the gate is shut: `/legal/*` stays reachable (the privacy policy and terms are published
commitments, not product), `/robots.txt` tells crawlers to index nothing, and every other path —
including `/signup` — returns the holding page with a **200**, so the Uptime Kuma monitors below
stay green rather than paging about a launch gate.

Turn on **preview deployments** for the web app. Plan §7 wanted them by the end of Wave 2 so later
waves could be reviewed on real URLs; **every wave has now merged without them**, so no wave was
ever reviewed on a preview URL. They need the wildcard DNS record from step 1, which is already
there — the reason they are still off is the paragraph below, not the DNS.

**The Preview environment does not carry the superuser pair** (see below), so the day previews are
switched on, every PR preview serves a red `/api/health` and a "I rode today" that fails softly —
and it will look like the PR caused it. It also points at the *production* PocketBase, so a preview
deploy writes into the live database: riders, consent records, audit log. Harmless while there is no
real data in there and genuinely awkward afterwards. Both halves are one decision — what a preview
deploy is allowed to touch — and it is open: **issue #164**, the owner's.

### 2b. The superuser pair — **done 2026-08-17**

The web app holds PocketBase superuser credentials because some writes are server-owned and may not
go through a rider's token: the weekly-streak tuple behind "I rode today", the Stripe webhook, and
every write the staff portal makes. Without them each of those fails *softly* — the rider is told to
try again in a moment, forever (issue #62).

| | |
| --- | --- |
| Superuser | `app@landthetrick.com`, created 2026-08-16 — **a second account, not the owner's own login** |
| Set on | `landit-web`, as `POCKETBASE_SUPERUSER_EMAIL` and `POCKETBASE_SUPERUSER_PASSWORD` |
| Coolify settings | Runtime → "Available in the container"; **not** a build variable; **Literal** ticked |
| Verified | `GET /api/health` returned `{"ok":true,...}` on three consecutive calls, and the streak write was confirmed by hand |

Two reasons the app gets its own superuser rather than reusing the owner's. The password sits in
Coolify's environment where anyone with dashboard access can read it; and the owner's account is
what grants `role = 'staff'` (`docs/staff-accounts.md`), so either credential must be rotatable
without locking the other out.

**Verify it after any deploy that touches these, and read the code rather than the dashboard.**
`GET /api/health` authenticates with the pair and answers **503** when it cannot, distinguishing
`missing` (unset in the container — almost always "Available in the container" left unticked) from
`rejected` (set and refused: wrong password, or the `$` interpolation trap above) from `unreachable`
(PocketBase itself). It carries the diagnosis and none of the material — no email, password or URL —
because it is reachable without authentication by design.

One thing observed while verifying, worth expecting rather than debugging: **during a Coolify
rollover the old container answers `"superuser":"rejected"` and the proxy briefly returns 502.** It
settles on its own. `rejected` while *steady* is the password; `rejected` for ninety seconds after a
deploy is the rollover.

### 2c. The map — nothing to do

**Superseded 2026-08-17, one day after it was written.** This step used to describe creating a
Mapbox account, restricting a token by URL and setting `NEXT_PUBLIC_MAPBOX_TOKEN` as a build
variable. The owner replaced Mapbox with **MapLibre GL on OpenFreeMap's tiles** (plan §1), which
needs no account, no key and no card, so there is no infrastructure step here at all: the map
draws on a fresh deploy the same way it draws on a laptop, and issue #109 closed without being
built.

The note is kept rather than deleted because the trap it warned about is still live for the
*other* `NEXT_PUBLIC_*` variable — see step 2 on `NEXT_PUBLIC_POCKETBASE_URL`, which is still a
build argument and still fails silently if set at runtime.

The one thing worth watching now is not a variable but a dependency: OpenFreeMap is a small
donation-funded service with no SLA. If it goes away, `MAP_BASE_STYLE` in
`apps/web/src/lib/map.ts` is one line pointing at a style URL, and the spots screen already treats
an unreachable basemap as a normal state rather than an error.

### 3. Litestream — **done 2026-08-17**

Add the new PocketBase `data.db` to `/etc/litestream.yml` and `systemctl restart litestream`.
**A PocketBase whose database is not in that file is not backed up** — see Backups above — and
re-run the restore rehearsal afterwards.

Done for `landit-pocketbase` on 2026-08-17, closing issue #167: the instance had been serving since
2026-08-16 with no replication at all, which plan §2.6 calls a prerequisite for any hosted
environment rather than a launch-week task. It cost nothing only because there were no riders yet.
The entry, the real volume path, the `auxiliary.db` decision and the credentials trap are all in
Backups above. **The next PocketBase on this box needs the same four steps**, and the thing to check
is not `systemctl status` but the journal line reading `replicating to … path=<product>`.

### 4. `LANDIT_APP_URL`

Set `LANDIT_APP_URL=https://landthetrick.com` on the PocketBase instance. It defaults to
`http://localhost:3000`, so getting this wrong sends a parent an approval link pointing at their own
machine — which fails silently and reads as "the email is broken".

### 5. Mailboxes in cPanel — **DNS done 2026-08-18**

**Its own cPanel account, not an addon domain on the agency's** (2026-08-16). The hostmedia plan
allows several, and a separate account keeps Land The Trick's mail isolated from HelloWebDesign's:
separate SPF and DKIM, separate sending reputation, separate suspension risk, and a safeguarding
inbox that can be handed to whoever is answering it without also handing over the agency's email.

Create `safeguarding@`, `privacy@`, `hello@` and `events@` there. Real mailboxes or forwards to an
inbox somebody reads — either is fine; what is not fine is an MX pointing at something that accepts
and discards.

All four are published in the terms, the privacy policy, the safeguarding page and the
guardian-consent email, and `safeguarding@` carries a **one-working-day response promise** the owner
made deliberately (plan §7, T5). Until this is done they all bounce.

The cPanel account for `landthetrick.com` is on **`5.101.173.45`** (`blackwell.dnshostnetwork.com`).
The mailboxes were created 2026-08-16 and the domain could still not receive a single message two
days later, because **cPanel's zone is not authoritative** (step 1) and nothing it writes takes
effect. What has to be carried to Namecheap by hand, and the two ways it goes wrong:

1. **Do not copy cPanel's MX destination.** Its Zone Editor shows `MX 0 landthetrick.com`, which is
   correct *inside cPanel's own zone*, where the apex A record is the cPanel server. In Namecheap's
   zone the apex is the **web VPS**, which runs no mail server — so copying that row literally aims
   every incoming message at a machine that will never answer, and the DNS reads as correct while it
   happens. Add an A record `mail` → the cPanel IP and point the MX at `mail.landthetrick.com.`
   instead.
2. **The wildcard swallows the mail hostnames.** `*` → the VPS (step 1, needed for PR previews)
   already answers for `mail` and `webmail`, so both resolved to the web server before the explicit
   A records existed. Only an explicit record beats a wildcard. `webmail` needs one too, or the
   mailboxes have no reachable front door.
3. **Set Mail Settings to Custom MX** at the bottom of Namecheap's Advanced DNS tab. MX rows live in
   that section, not in Host Records. Left on "Email Forwarding" or "No Email Service" the MX is
   ignored no matter how right it looks.
4. **Copy cPanel's DKIM** into Namecheap as a TXT record on `default._domainkey`. cPanel splits the
   value across two boxes because a DNS string caps at 255 characters — the record is those two
   joined with nothing between them, on one line, and Namecheap re-splits it itself. **Copy it from
   the field, never off the screen:** the key contains runs where capital `I` and lowercase `l` are
   indistinguishable in most fonts, both are valid base64, and the wrong one yields a key that
   parses perfectly and verifies nothing.
5. **Copy cPanel's SPF** the same way, merged with MailerSend's include — step 6.

Two Namecheap behaviours, each of which cost a round trip here. A row is not saved until its own
tick is clicked and it reports nothing when it is not, so reload the page and believe the list
rather than the form. And a host typed as `default_domainkey` saves happily: the record then answers
on a name no mail server will ever query, which is indistinguishable from "DKIM is broken".

The live values, verified against `dns1.registrar-servers.com` and `8.8.8.8` on 2026-08-18:

| Type | Host | Value |
| --- | --- | --- |
| A | `mail` | `5.101.173.45` |
| A | `webmail` | `5.101.173.45` |
| MX | `@` | `mail.landthetrick.com.`, priority 10 |
| TXT | `default._domainkey` | cPanel's key — 2048-bit RSA, 392 base64 characters |

An MX on `inbound` → `inbound.mailersend.net.` predates all of this and stays: it is MailerSend's
inbound routing, on a subdomain, and has nothing to do with mail addressed to the bare domain. It is
also why the zone looked like it had mail configured while all four addresses bounced.

cPanel will keep reporting the mail DNS as misconfigured, because it cannot see Namecheap's zone.
That is cosmetic. What matters is what `dig` says.

### 6. MailerSend — **DNS and account done 2026-08-18**

1. The dashboard is **`accounts.mailersend.com`**, not `dashboard.mailerlite.com` — sibling
   products, and MailerLite is the newsletter one with no SMTP relay.
2. **Get the account out of the trial phase.** Until it is approved it can only send *100/day to 5
   recipients*: fine against your own inbox, a hard stop the first time a real parent is on the
   other end. Clear it early, not on launch day. Approved 2026-08-18.
3. **Verify `landthetrick.com`** — the free tier allows one domain, so verify the real one and
   there is nothing to swap later. Done 2026-08-16: DKIM on the `ms1` and `ms2` selectors (both
   CNAMEs to `mailersend.net`), the Return-Path `mta` CNAME, and a `links` CNAME for click
   tracking. Its own DKIM is separate from cPanel's and neither disturbs the other.
4. **The SMTP credentials do not go in the environment.** `pocketbase/.env.example` lists five
   `SMTP_*` values and **nothing in the repository reads any of them** — PocketBase takes mail
   config from its settings database, entered at `https://api.landthetrick.com/_/` → Settings →
   Mail and persisted in the `/pb_data` volume. Set them in Coolify and you get a tidy variable
   list and an instance that still cannot send. The template says so now; it did not on the day
   this was done.

⚠️ **The SPF trap.** cPanel generates an SPF record when the account is created in step 5 —
`hellowebdesign.co.uk` carries the same shape, `v=spf1 +a +mx +ip4:<that server>
include:relay.mailchannels.net ~all` — and step 5 copies it into Namecheap. MailerSend will then ask
for an SPF record too. **A domain may have only one `v=spf1` record**: a second is not "two senders
allowed", it is a permanent error that fails both, and one of the two is a guardian-consent email.
Edit the record already at Namecheap rather than adding a second. What `landthetrick.com` carries,
live since 2026-08-18:

```
v=spf1 +mx +ip4:5.101.173.45 include:relay.mailchannels.net include:_spf.mailersend.net ~all
```

Two edits to cPanel's generated record, both deliberate:

- **`include:spf.efwd.registrar-servers.com` was removed.** That is Namecheap's own email-forwarding
  service, added when the zone was first set up and never used — the mailboxes are cPanel's.
- **`+a` was dropped.** In cPanel's zone `+a` resolves to the cPanel server and is a sensible
  default. Carried into Namecheap's zone it resolves to the **web VPS**, authorising a machine that
  sends no mail. `+mx +ip4:` already covers cPanel; the same mistake as the MX destination in step
  5, and the same cause — a record that means one thing in the zone that generated it and something
  else in the zone that is authoritative.

**Read the IP out of the record cPanel generated for this account** — it is that account's server,
not `hellowebdesign.co.uk`'s, and the two need not be the same machine. Same for the include: use
the values the two panels actually show. The shape is the point, not the values.

**DKIM is different — leave cPanel's alone.** A domain may hold as many DKIM keys as it has
selectors, so cPanel's `default._domainkey` and MailerSend's `ms1`/`ms2` coexist happily. Deleting
one to "tidy up" breaks whichever sender it belonged to.

**PocketBase's stock email templates point at PocketBase, not at the app.** Its default
password-reset body links to `{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}` — the admin UI's
own route. With `APP_URL` set to `https://landthetrick.com`, as it must be for the guardian links,
that resolves to `/_` on the web app and gives the rider a **404 instead of a password reset**
(observed 2026-08-18, the first time the path was ever walked). Setting `APP_URL` correctly does not
fix it; the template itself has to be edited, on the users collection (below):

| Template | Link it must carry |
| --- | --- |
| Password reset | `{APP_URL}/reset-password?token={TOKEN}` |
| Verification | only matters if verification is turned on — the stock body has the same defect |
| Email change | same shape, same defect |

The guardian-consent email is unaffected: it is built by `pocketbase/hooks/lib/consent_mail.js` and
composes its own links from `LANDIT_APP_URL`, which is why it was the one path that could not fail
this way. **Anything PocketBase templates, PocketBase aims at itself.**

These templates live in the settings database, not in this repository, so they survive deploys and
are lost with the `/pb_data` volume — which Litestream replicates (Backups above).

### 7. DMARC — **done 2026-08-18**

A `_dmarc` TXT record. Start at `p=none` for a week to confirm MailerSend is passing, then tighten
to `p=reject`. A brand-new domain has no legacy senders to break, which is the one advantage of not
getting `landit.app`.

Live since 2026-08-18:

```
v=DMARC1; p=none; rua=mailto:hello@landthetrick.com; adkim=r; aspf=r
```

`rua` points at `hello@`, which only collects anything because step 5's MX now works — a DMARC
report address on a domain that cannot receive is a record that reports to nobody. **Tighten to
`p=reject` from 2026-08-25**, once a week of reports shows both senders passing.

### 8. Uptime Kuma, then the email paths

**Monitors — done 2026-08-17.** Three, at https://status.hellowebdesign.co.uk:

| Monitor | Target | Checks |
| --- | --- | --- |
| web health | `https://landthetrick.com/api/health` | 200, and `ok` is `true` |
| PocketBase | `https://api.landthetrick.com/api/health` | PocketBase answering at all |
| site | `https://landthetrick.com` | the proxy and the certificate |

Between them a red light says *which* of the three layers broke. The health path needs no preview
key — `apps/web/src/proxy.ts` lists it in `ALWAYS_OPEN` — and the site monitor stays green behind
the holding page, which is deliberate: it watches the proxy, not the launch gate.

**Set retries to about three minutes' worth before saving a monitor.** A Coolify rollover produces a
brief 502 and a `rejected` health response from the old container; at zero retries every deploy
pages you, and a monitor that pages on every deploy is muted within a week.

Alerts go to the owner's Gmail over SMTP (`smtp.gmail.com:465`, a Google App Password, not the
account password). Deliberately **not** MailerSend — originally because it was still in trial, and
still the right call now it is not: an alert path should not share a failure domain with the
product's own email, or a broken mail stack silences its own alarm.

**What this does not cover, and cannot:** Uptime Kuma runs on box1 and watches services on box1. If
the host goes, Kuma goes with it and nothing is sent — the dashboard is green because nothing is
left to say otherwise. Closing that needs one check hosted somewhere box1 does not own; tracked in
**issue #160**, and it belongs before `LANDIT_SITE_LIVE=true` rather than after.

Then walk the guardian-consent email, the password reset and the verification email by hand
(**issue #31**). The password reset was walked end-to-end on the live instance on 2026-08-18 — the
walk is what found the stock template's 404 (above) — so sending demonstrably works. The
guardian-consent and verification deliveries have not yet been observed by a human, and the
guardian email is the mechanism the child-safety position rests on, so #31 stays open until they
are.


## Not done yet (infra track, implementation-plan.md §7)

Steps 1–8 above are the sequence; this is the progress.

- [x] The five DNS records at Namecheap, all pointing at the box (runbook 1) — done 2026-08-16
- [x] Land The Trick Coolify project, both hostnames on HTTPS (runbook 2) — done 2026-08-16
- [x] The new PocketBase database in `litestream.yml`, restore rehearsed (runbook 3) — done
      2026-08-17, issue #167. Replicating continuously to bucket path `landit`; restore verified
      from the replica, not just assumed from a clean service start.
- [x] `LANDIT_APP_URL` set on the hosted instance (runbook 4) — done 2026-08-16
- [x] Mail DNS at Namecheap: MX to `mail.landthetrick.com` with its own A record, cPanel's DKIM on
      `default._domainkey`, Custom MX selected (runbook 5) — done 2026-08-18. Mailboxes were created
      2026-08-16 but **the domain could not receive at all until the MX existed**; every published
      address bounced for two days. *Receipt itself is not yet proven by a delivered message —
      issue #36 stays open until one arrives.*
- [x] MailerSend out of the trial phase, domain verified, and the SPF merged into one record
      (runbook 6) — done 2026-08-18
- [x] DMARC at `p=none` (runbook 7) — done 2026-08-18. **Tighten to `p=reject` from 2026-08-25.**
- [x] **The MailerSend SMTP credentials in PocketBase's mail settings** (runbook 6) — done
      2026-08-18, the admin UI, not the environment. Proven by the observed password-reset
      delivery the same day, not just by the settings screen.
- [x] Uptime Kuma monitors, three of them, alerting to Gmail (runbook 8) — done 2026-08-17.
      **Kuma cannot report its own host dying — issue #160.**
- [ ] The email paths walked by hand — issue #31 (runbook 8). **Partial 2026-08-18**: the password
      reset was walked end-to-end on the live instance (and caught the stock-template 404, now
      fixed); the guardian-consent and verification deliveries are still unobserved, so this stays
      open.
- [x] **The superuser pair set on `landit-web` and verified green** (runbook 2b) — done 2026-08-17,
      issue #62. Server-owned writes work: "I rode today", and later the Stripe webhook and the
      staff portal.
- ~~[ ] R2 lifecycle rule + clips bucket when T14 (clips) approaches.~~ **Dropped 2026-08-17.** The
      owner reversed clip hosting (plan §1, §6.6): Land The Trick stores no rider video, so there is no
      clips bucket to create, no PocketBase S3 settings to fill in, and no lifecycle rule to write.
      `box1-backups` above is unaffected — that is Litestream's database replication and has nothing
      to do with clips. Issue #113 closed as obsolete. **Nothing here is ever provisioned by a build
      session in any case** — this file is reference only.
- [x] **The spots map draws with no infrastructure step at all** (runbook 2c) — done
      2026-08-17. Not by provisioning anything: the owner replaced Mapbox with MapLibre on
      OpenFreeMap's tiles, which needs no account, key or card, so the variable this line used to
      ask for no longer exists. Issue #109 closed unbuilt.
- [x] **`LANDIT_PREVIEW_KEY` set on the deployed web app** (runbook 2) — done 2026-08-17. The real
      site on the real domain can now be opened behind the holding page, which is what makes a
      deploy checkable before launch day.
- [ ] **Preview deployments turned on, and what a preview may touch decided** (runbook 2) —
      **issue #164**. The Preview environment has no superuser pair and points at the production
      PocketBase. Every wave merged without previews, so this was never actually used.
- [x] **`LANDIT_SITE_LIVE=true`** — **done 2026-08-17 (Rachid, confirmed in chat).** The last item
      on this list, deliberately, because it is the one that makes everything above it visible to
      the public. `landthetrick.com` now serves the product rather than the holding page, and
      `/robots.txt` returns `Allow: /`, so the site is crawlable as well as reachable.

      **Two items above it were still open when it was set**, and this is the record of that rather
      than a reproach — both are now live-site problems rather than pre-launch ones:

      - **#31, the email paths.** At the time nothing that sends email had ever been observed
        working (the password reset has since been walked, 2026-08-18; the guardian and
        verification paths still have not). On a
        live site taking sign-ups that is not a to-do, it is the **guardian-consent gate**: a rider
        below their country's threshold lands at `pending` and stays there until a guardian
        approves by email (§6.2). If that email does not arrive, the account never opens and the
        rider has no way to say so.
      - **#160, Uptime Kuma's blind spot.** Kuma runs on the box it watches, so a host-level outage
        alerts nobody and the dashboard stays green because nothing is left to say otherwise. The
        section above this one says it "belongs before `LANDIT_SITE_LIVE=true` rather than after".
        It is now after.
