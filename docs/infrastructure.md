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

The product domain, chosen 2026-08-16 (Rachid) and ordered the same day. Nothing below has been
done yet; tick the checklist in the next section as it is.

**Order matters.** Certificates need DNS and Coolify needs certificates. Steps 5 and 6 both touch
the same SPF record, and that is where the one mistake in this list gets made.

The brand is **Land It** and the domain does not match it. That is fine and deliberate. `landit.app`
was written into published copy before anyone owned it — it belongs to someone else and its
registration has expired — which is where the rule came from: **never publish an address on a domain
that is not yet registered to us.**

### 1. DNS at hostmedia

**DNS stays with hostmedia** (2026-08-16), alongside the cPanel that will hold the mailboxes in
step 5. Cloudflare was considered and is not needed: R2 and Cloudflare Web Analytics both work
regardless of where DNS lives, and its free Email Routing — the one real draw — is redundant when
cPanel already provides mailboxes. One account, and an SPF record with one include rather than two.

Records, all to the box (`188.119.155.124`, `2a0f:8f00::c:0:0:2`):

| Type | Name | Points at |
| --- | --- | --- |
| A + AAAA | `@` | the box |
| A + AAAA | `www` | the box |
| A + AAAA | `api` | the box — PocketBase |
| A + AAAA | `*` | the box — **wildcard, where Coolify's PR previews land** |

Two traps:

- **Web and mail live on different servers.** The A records point at the VPS
  (`188.119.155.124`); the MX will point at the cPanel host (`5.101.173.45`). That split is normal
  and intended — but **adding an addon domain in cPanel usually rewrites the A record to the shared
  host**, which silently moves the website off the box. After step 5, come back and check `@`,
  `www`, `api` and `*` still resolve to `188.119.155.124`. This is the most likely thing in this
  runbook to go wrong.
- **Without the wildcard there are no preview deploys.** Coolify gives each PR its own subdomain;
  `*` is what makes them resolve.

### 2. Coolify project

Create the Land It project (Next.js app + PocketBase + preview deploys), add `landthetrick.com` and
`api.landthetrick.com`, and let it issue certificates. Confirm **both** serve HTTPS before going on.

Plan §7 wanted preview deploys by the end of Wave 2 so later waves could be reviewed on real URLs.
Wave 3 has already merged without them, so this is the item that is actually late.

### 3. Litestream

Add the new PocketBase `pb_data/data.db` to `/etc/litestream.yml` and
`systemctl restart litestream`. **A PocketBase whose database is not in that file is not backed
up** — see Backups above — and re-run the restore rehearsal afterwards.

### 4. `LANDIT_APP_URL`

Set `LANDIT_APP_URL=https://landthetrick.com` on the PocketBase instance. It defaults to
`http://localhost:3000`, so getting this wrong sends a parent an approval link pointing at their own
machine — which fails silently and reads as "the email is broken".

### 5. Mailboxes in cPanel

Add `landthetrick.com` to the hostmedia cPanel and create `safeguarding@`, `privacy@`, `hello@` and
`events@`. Point the MX at that host. Real mailboxes or forwards to an inbox somebody reads — either
is fine; what is not fine is an MX pointing at something that accepts and discards.

All four are published in the terms, the privacy policy, the safeguarding page and the
guardian-consent email, and `safeguarding@` carries a **one-working-day response promise** the owner
made deliberately (plan §7, T5). Until this is done they all bounce.

**Then re-check the A records** — see the trap in step 1. Adding the domain here is exactly when
they get pointed at the wrong server.

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

⚠️ **The SPF trap.** cPanel writes an SPF record of its own the moment a domain is added in step 5 —
`hellowebdesign.co.uk` carries the same one, `v=spf1 +a +mx +ip4:… include:relay.mailchannels.net
~all`. MailerSend will then ask for an SPF record too. **A domain may have only one `v=spf1`
record**: a second is not "two senders allowed", it is a permanent error that fails both, and one of
the two is a guardian-consent email. Append MailerSend's include to the record cPanel made rather
than adding another:

```
v=spf1 +a +mx +ip4:5.101.173.45 include:relay.mailchannels.net include:_spf.mailersend.net ~all
```

Use the values the two panels actually show; the shape is the point.

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

- [ ] The four DNS records at hostmedia, all pointing at the box (runbook 1)
- [ ] Land It Coolify project, both hostnames on HTTPS (runbook 2) — **the late one**
- [ ] The new PocketBase database in `litestream.yml`, restore rehearsed (runbook 3)
- [ ] `LANDIT_APP_URL` set on the hosted instance (runbook 4)
- [ ] The four published mailboxes in cPanel, MX pointed at it, A records re-checked (runbook 5)
- [ ] MailerSend out of trial, domain verified, SPF merged (runbook 6)
- [ ] DMARC (runbook 7)
- [ ] Uptime Kuma monitors, then the email paths by hand — issue #31 (runbook 8)
- [ ] R2 lifecycle rule + clips bucket when T14 (clips) approaches.
