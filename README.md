# Land It

A trick tracker for scooter, skateboard and BMX riders: log tricks through five honesty-based stages,
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

## Running it locally

Node 22.12+ and pnpm (the version is pinned in `package.json`; `corepack enable` gets you it).

```bash
pnpm install
```

```bash
pnpm dev
```

That serves the web app on `http://localhost:3000`. The backend is a separate process —
first run downloads the pinned PocketBase binary, then serves it with this repo's
migrations and hooks on `http://127.0.0.1:8090` (details in
[pocketbase/README.md](pocketbase/README.md)):

```bash
pnpm pb:dev
```

Environment files are templates only — copy `apps/web/.env.example` to
`apps/web/.env.local` and fill it in locally. Nothing filled in is ever committed.

### The gates

Every session runs these three before committing, and CI runs the same three on every push
and pull request. They are judged on exit codes.

```bash
pnpm build && pnpm test && pnpm lint
```

`pnpm build` typechecks every workspace and builds the app; `pnpm test` runs Vitest across
`packages/*`; `pnpm lint` runs ESLint and checks Prettier formatting (`pnpm format` fixes
it). Browser tests are separate and run in their own CI job:

```bash
pnpm e2e
```

### Layout

| Path | What lives there |
| --- | --- |
| `apps/web` | The Next.js App Router app — rider app, marketing, legal, and later the `/admin` route group. |
| `packages/core` | Pure TypeScript game rules. Never imports React, Next, or anything DOM — ESLint enforces it. |
| `packages/db` | PocketBase clients, collection types, typed queries. |
| `packages/ui-web` | The design system: tokens, primitives, icons. |
| `pocketbase/` | Migrations, server-side hooks, seeds, and the local-dev runner. |
| `e2e/` | Playwright specs. |

## Stack (settled — see plan §1 before proposing changes)

Next.js (pnpm monorepo) · PocketBase (self-hosted, one instance per product) · Coolify on a
shared VPS · Cloudflare R2 (backups + clips) · Stripe · MailerSend · Mapbox · PostHog EU +
Cloudflare Analytics · Sentry.
