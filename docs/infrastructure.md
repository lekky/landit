# Infrastructure — box1

The shared VPS that hosts Land It and other products (see implementation-plan.md §2.6).
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
- One Coolify **project per product** (Land It's gets created when there is something to
  deploy — app + PocketBase instance + PR previews). Products are isolated; nothing
  product-specific goes in `infra`.
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

## Backups (done 2026-08-15)

- **R2 bucket `box1-backups`** on Rachid's Cloudflare account, **EU jurisdiction** — note the
  endpoint is therefore `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com` (the `.eu.` matters;
  the plain endpoint 403s). Free tier 10GB; usage alert configured in Cloudflare Notifications.
- **Litestream** (systemd service `litestream`, config `/etc/litestream.yml`, credentials via
  `EnvironmentFile=/root/.litestream-r2.env`). Replicates continuously, 7-day retention.
- A **canary database** (`/var/lib/litestream-canary/canary.db`) replicates at all times so the
  pipeline proves itself even before/between real databases.
- **Restore rehearsal passed 2026-08-15**: replicate → delete local → `litestream restore` →
  content verified. Re-rehearse after adding each real database.
- **When a PocketBase instance is deployed**: add its `pb_data/data.db` path as a new entry in
  `/etc/litestream.yml` (template comment inside) and `systemctl restart litestream`. A PocketBase
  whose database is not in that file is NOT backed up.

## Bringing `landthetrick.com` up (runbook)

The product domain, chosen and registered 2026-08-16 (Rachid, at Namecheap). Step 1 is done; the
checklist in the next section is the live progress.

**Order matters.** Certificates need DNS and Coolify needs certificates. Steps 5 and 6 both touch
the same SPF record, and that is where the one mistake in this list gets made.

The brand is **Land It** and the domain does not match it. That is fine and deliberate. `landit.app`
was written into published copy before anyone owned it — it belongs to someone else and its
registration has expired — which is where the rule came from: **never publish an address on a domain
that is not yet registered to us.**

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

The project exists (Rachid, 2026-08-16); the two services inside it do not. Both deploy **from this
repository's Dockerfiles** — Nixpacks cannot be trusted with a pnpm workspace whose app compiles
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
  In Coolify it must be marked "Build Variable".
- **PocketBase's `/pb_data` must be a persistent volume before the first deploy.** Without it the
  database — riders, consent records, everything — lives in the container's writable layer and is
  destroyed by the next deploy. Its `data.db` inside that volume is also the path step 3 adds to
  Litestream.

Deploy PocketBase first, visit `https://api.landthetrick.com/_/` and create the superuser, then
deploy the web app. Confirm **both** serve HTTPS before going on.

**The web app also takes two runtime variables that decide whether the public sees the product at
all.** Unlike `NEXT_PUBLIC_POCKETBASE_URL` above, these are ordinary runtime variables — *not*
build variables — and that difference is the whole point of how they were built:

| Variable | Value while building | Value at launch |
| --- | --- | --- |
| `LANDIT_SITE_LIVE` | leave unset, or `false` | `true` |
| `LANDIT_PREVIEW_KEY` | a long random string | keep it, or clear it |

`LANDIT_SITE_LIVE` decides whether every URL serves the app or the holding page. It is read by
`apps/web/src/proxy.ts` on each request, so **going live is this variable plus a restart — there is
no rebuild.** Coolify must therefore *not* mark it "Build Variable"; doing so is the same trap that
`NEXT_PUBLIC_POCKETBASE_URL` sprang once already, in reverse.

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
waves could be reviewed on real URLs; Wave 3 has merged without them, so this is the part that is
actually late. They need the wildcard DNS record from step 1, which is already there.

### 3. Litestream

Add the new PocketBase `pb_data/data.db` to `/etc/litestream.yml` and
`systemctl restart litestream`. **A PocketBase whose database is not in that file is not backed
up** — see Backups above — and re-run the restore rehearsal afterwards.

### 4. `LANDIT_APP_URL`

Set `LANDIT_APP_URL=https://landthetrick.com` on the PocketBase instance. It defaults to
`http://localhost:3000`, so getting this wrong sends a parent an approval link pointing at their own
machine — which fails silently and reads as "the email is broken".

### 5. Mailboxes in cPanel

**Its own cPanel account, not an addon domain on the agency's** (2026-08-16). The hostmedia plan
allows several, and a separate account keeps Land It's mail isolated from HelloWebDesign's:
separate SPF and DKIM, separate sending reputation, separate suspension risk, and a safeguarding
inbox that can be handed to whoever is answering it without also handing over the agency's email.

Create `safeguarding@`, `privacy@`, `hello@` and `events@` there. Real mailboxes or forwards to an
inbox somebody reads — either is fine; what is not fine is an MX pointing at something that accepts
and discards.

All four are published in the terms, the privacy policy, the safeguarding page and the
guardian-consent email, and `safeguarding@` carries a **one-working-day response promise** the owner
made deliberately (plan §7, T5). Until this is done they all bounce.

**cPanel's zone is not authoritative** (step 1), so nothing it writes takes effect and three things
have to be carried over to Namecheap by hand:

1. **Set Mail Settings to Custom MX** at the bottom of Namecheap's Advanced DNS tab, then add the
   MX record pointing at the cPanel server. Left on "Email Forwarding" or "No Email Service", the
   MX record is ignored and the mailboxes are unreachable. The target is in the cPanel welcome
   email.
2. **Copy cPanel's DKIM** out of its Zone Editor into Namecheap as a TXT record — host
   `default._domainkey`, or whatever selector cPanel used.
3. **Copy cPanel's SPF** the same way. Step 6 then appends MailerSend's include to it.

cPanel will keep reporting the mail DNS as misconfigured, because it cannot see Namecheap's zone.
That is cosmetic. What matters is what `dig` says.

### 6. MailerSend

1. The dashboard is **`accounts.mailersend.com`**, not `dashboard.mailerlite.com` — sibling
   products, and MailerLite is the newsletter one with no SMTP relay.
2. **Get the account out of the trial phase.** Until it is approved it can only send *100/day to 5
   recipients*: fine against your own inbox, a hard stop the first time a real parent is on the
   other end. Clear it early, not on launch day.
3. **Verify `landthetrick.com`** — the free tier allows one domain, so verify the real one and
   there is nothing to swap later. Add the DKIM and Return-Path records it gives you, then put the
   SMTP credentials into PocketBase's mail settings (`pocketbase/.env.example` lists the five
   values).

⚠️ **The SPF trap.** cPanel generates an SPF record when the account is created in step 5 —
`hellowebdesign.co.uk` carries the same shape, `v=spf1 +a +mx +ip4:<that server>
include:relay.mailchannels.net ~all` — and step 5 copies it into Namecheap. MailerSend will then ask
for an SPF record too. **A domain may have only one `v=spf1` record**: a second is not "two senders
allowed", it is a permanent error that fails both, and one of the two is a guardian-consent email.
Edit the record already at Namecheap to append MailerSend's include rather than adding a second:

```
v=spf1 +a +mx +ip4:<the Land It cPanel server> include:relay.mailchannels.net include:_spf.mailersend.net ~all
```

**Read the IP out of the record cPanel generated for this account** — it is that account's server,
not `hellowebdesign.co.uk`'s, and the two need not be the same machine. Same for the include: use
the values the two panels actually show. The shape is the point, not the values.

**DKIM is different — leave cPanel's alone.** A domain may hold as many DKIM keys as it has
selectors, so cPanel's `default._domainkey` and MailerSend's own selector coexist happily. Deleting
one to "tidy up" breaks whichever sender it belonged to.

### 7. DMARC

A `_dmarc` TXT record. Start at `p=none` for a week to confirm MailerSend is passing, then tighten
to `p=reject`. A brand-new domain has no legacy senders to break, which is the one advantage of not
getting `landit.app`.

### 8. Uptime Kuma, then the email paths

Monitors for `https://landthetrick.com` and `https://api.landthetrick.com`.

Then walk the guardian-consent email, the password reset and the verification email by hand
(**issue #31**). Nothing that sends email has ever been observed working, and the guardian email is
the mechanism the child-safety position rests on.


## Not done yet (infra track, implementation-plan.md §7)

Steps 1–8 above are the sequence; this is the progress.

- [x] The five DNS records at Namecheap, all pointing at the box (runbook 1) — done 2026-08-16
- [x] Land It Coolify project, both hostnames on HTTPS (runbook 2) — done 2026-08-16
- [ ] The new PocketBase database in `litestream.yml`, restore rehearsed (runbook 3)
- [x] `LANDIT_APP_URL` set on the hosted instance (runbook 4) — done 2026-08-16
- [ ] Mailboxes created 2026-08-16; still to do: Custom MX at Namecheap, and cPanel’s DKIM/SPF copied there (runbook 5)
- [ ] Domain verified 2026-08-16; still to do: **out of trial phase**, and the SPF merged (runbook 6)
- [ ] DMARC (runbook 7)
- [ ] Uptime Kuma monitors, then the email paths by hand — issue #31 (runbook 8)
- [ ] R2 lifecycle rule + clips bucket when T14 (clips) approaches.
- [ ] **`LANDIT_SITE_LIVE` and `LANDIT_PREVIEW_KEY` set on the deployed web app** (runbook 2). The
      code shipped shut-by-default, so the site is already holding — but until `LANDIT_PREVIEW_KEY`
      is set on the box there is no way to see the real site on the real domain, and nobody can
      check a deploy before launch day.
- [ ] **`LANDIT_SITE_LIVE=true`, on launch day.** The last item on this list, deliberately: it is
      the one that makes everything above it visible to the public.
