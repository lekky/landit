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

## Not done yet (infra track, implementation-plan.md §7)

- [ ] Cloudflare account + R2 bucket — needed for Litestream backups before any hosted
      PocketBase holds real data (end of Wave 2), and later for Land It clips.
- [ ] Litestream on the box replicating each product's PocketBase SQLite file to R2,
      plus one rehearsed restore onto a scratch directory/box.
- [ ] Land It domain — buy, point at the box, then create the Land It Coolify project
      (Next.js app + PocketBase + preview deploys).
- [ ] Uptime Kuma monitors for each deployed site as they appear (plus one for
      https://box1.hellowebdesign.co.uk).
