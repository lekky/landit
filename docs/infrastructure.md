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

## Not done yet (infra track, implementation-plan.md §7)

- [ ] Land It domain — buy, point at the box, then create the Land It Coolify project
      (Next.js app + PocketBase + preview deploys) and add its DB to litestream.yml.
- [ ] MailerSend account + sending-domain DNS — required before T6 (auth and guardian-consent
      email) can be tested against the hosted instance. Three things in order, and none of them
      needs the Land It domain:
      1. **The dashboard is `accounts.mailersend.com`, not `dashboard.mailerlite.com`.** They are
         sibling products; MailerLite is the newsletter one and has no SMTP relay.
      2. **Get out of the trial phase.** A new MailerSend account can only send *100/day to 5
         recipients* until it is approved — fine for testing against your own inbox, and a hard
         stop the first time a real parent is on the other end. Clear it early, not on launch day.
      3. **Verify a domain and take the SMTP credentials** into PocketBase's mail settings
         (`pocketbase/.env.example` lists the five values). The free tier allows **one** domain, so
         `hellowebdesign.co.uk` can carry the pre-launch testing and gets swapped for the Land It
         domain when that is bought — testing on it is fine, launching on it is not, because a
         child-safety email from an unrelated agency domain reads as phishing to a parent.
      Also set `LANDIT_APP_URL` on the hosted instance, or the guardian's approval and revocation
      links point at `http://localhost:3000`.
- [ ] Uptime Kuma monitors for each deployed site as they appear (plus one for
      https://box1.hellowebdesign.co.uk).
- [ ] R2 lifecycle rule + clips bucket when T14 (clips) approaches.
