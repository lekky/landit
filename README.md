# Land It

A trick tracker for scooter and skateboard riders: log tricks through five honesty-based stages,
earn stickers, follow weekly challenges, find spots and events, compare with a crew. Built for
riders of all ages — safeguarding is a feature, not a checkbox.

## Documents, in reading order

| Doc | What it is |
| --- | --- |
| [docs/implementation-plan.md](docs/implementation-plan.md) | **The authority.** Stack decisions, architecture, data model, and §7: the session-by-session build plan (T0–T20). |
| [design-handoff/README.md](design-handoff/README.md) | The design contract: tokens, screens, behaviour, data shapes. The prototype in `design-handoff/design/` is the behavioural spec; screenshots in `design-handoff/screenshots/`. |
| [docs/infrastructure.md](docs/infrastructure.md) | The live server (box1): URLs, access patterns, security posture, backups. Build sessions never need this box. |
| [CLAUDE.md](CLAUDE.md) | Standing instructions for agent sessions. |

## How this gets built

Each task in plan §7 is done by one agent session in its own worktree, ending in one PR that the
session squash-merges itself once checks are green (full protocol in [CLAUDE.md](CLAUDE.md) —
the owner does not review PRs). Tasks in the same wave run concurrently; a wave merges before
the next starts. Session prompt template:

> Read CLAUDE.md, docs/implementation-plan.md in full, then design-handoff/README.md.
> Implement task **T{n} ({name})** from §7 of the plan. Follow the session protocol in
> CLAUDE.md end to end, including the worktree, gates, and merge policy.

## Stack (settled — see plan §1 before proposing changes)

Next.js (pnpm monorepo) · PocketBase (self-hosted, one instance per product) · Coolify on a
shared VPS · Cloudflare R2 (backups + clips) · Stripe · Resend · Mapbox · PostHog EU +
Cloudflare Analytics · Sentry.
