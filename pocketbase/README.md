# pocketbase/

The backend, as files. PocketBase is one binary; everything that makes it *Land It's*
backend lives here and is committed.

| Directory | Holds |
| --- | --- |
| `migrations/` | JS migrations defining every collection, its fields, its API rules and its indexes. The schema's source of truth — T2. |
| `hooks/` | `pb_hooks` JavaScript: the rules a client must never be trusted with — paywall check on `trick_progress` writes, sticker awards, same-sport prerequisite check, challenge-overlap rejection, clip cap, audit-log writer — T2. |
| `seed/` | Scripts loading the canonical data (61 tricks and their prerequisite edges, stickers, plans, spots, events, challenges) into a PocketBase instance — T4. |
| `scripts/` | The local-dev runner. |

`.bin/` (the downloaded binary) and `.pb_data/` (your local database) are git-ignored.
`.pb_data` is scratch: delete it and re-run to get a clean database from the migrations.

## Running it

```bash
pnpm pb:dev
```

First run downloads the pinned PocketBase — version in `pocketbase.version`, nothing
else may pin it — into `pocketbase/.bin/<version>/`, then serves on
`http://127.0.0.1:8090` with this repo's `migrations/` and `hooks/` wired in. No Docker.

Anything else PocketBase's CLI can do goes through the same script:

```bash
pnpm pb -- superuser upsert you@example.com a-long-local-password
```

```bash
pnpm pb -- --help
```

The superuser dashboard is at `http://127.0.0.1:8090/_/`. Create your local superuser with
the command above — it is a local account on a scratch database and has nothing to do with
the production box.

## Upgrading PocketBase

Edit `pocketbase.version`, delete `pocketbase/.bin/`, run `pnpm pb:dev`, and check the
migrations still apply cleanly. Do it in its own `chore-` PR, never inside a feature task.

## What this is not

This is a local instance. **The production box is never touched from a build session** —
see `docs/infrastructure.md`, which is reference only. No SSH, no server credentials, no
deploy scripts in this directory.
