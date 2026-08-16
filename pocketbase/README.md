# pocketbase/

The backend, as files. PocketBase is one binary; everything that makes it *Land It's*
backend lives here and is committed.

| Directory | Holds |
| --- | --- |
| `migrations/` | JS migrations defining every collection, its fields, its API rules and its indexes. The schema's source of truth — T2. |
| `hooks/` | `pb_hooks` JavaScript: the rules a client must never be trusted with — paywall check on `trick_progress` writes, sticker awards, same-sport prerequisite check, challenge-overlap rejection, clip cap, audit-log writer — T2. |
| `seed/` | Scripts loading the canonical data (61 tricks and their prerequisite edges, stickers, plans, spots, events, challenges) into a PocketBase instance — T4. |
| `scripts/` | The local-dev runner. |
| `tests/` | HTTP tests that start a throwaway PocketBase against the files above and prove the four security guarantees in plan §3 — T2. |

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

## The tests

```bash
pnpm --filter @landit/pocketbase test
```

They start the pinned binary on a scratch database in the system temp directory, apply
`migrations/`, load `hooks/`, and then talk to it over HTTP exactly as a browser would.
Plan §3 asks for the four guarantees to be proven "as observed API behaviour, not by
reading the rule text", so there is no assertion anywhere on a rule *string*: every claim
is a request and a status code. The instance is deleted when the run ends.

`pnpm test` at the repo root includes them, and so does CI.

## Two things about the JSVM that will bite you

Both are PocketBase's embedded JS engine, not our code, and both fail in ways that look
like something else:

1. **Every handler runs in its own isolated VM.** A hook handler, a route handler and a
   `migrate()` callback cannot see anything declared at their own file's top level. Shared
   code goes in `hooks/lib/*.js` and is `require()`d *inside* the handler, off the
   `__hooks` global. A file-scope constant used inside a handler throws
   `ReferenceError: X is not defined` at request time, not at load time.

2. **Collection fields must be plain objects in a migration, not `new TextField(...)`.**
   With Field class instances, `new Collection({...})` saves, but the collection's
   `createRule` and `deleteRule` can no longer resolve its own fields — you get
   `invalid left operand "user" - unknown field "user"` from `app.save()`. The one place
   that genuinely needs an instance is `collection.fields.add()` when extending an
   existing collection, and the migration converts there and only there.

Also worth knowing: `pocketbase migrate up` **exits 0 even when a migration throws**. The
test harness therefore treats an `Error:` line in its output as a failure, and one of the
tests then asserts that every collection §3 names actually exists — otherwise a silent
schema failure would make every rule test pass against an empty database.

## Upgrading PocketBase

Edit `pocketbase.version`, delete `pocketbase/.bin/`, run `pnpm pb:dev`, and check the
migrations still apply cleanly. Do it in its own `chore-` PR, never inside a feature task.

## What this is not

This is a local instance. **The production box is never touched from a build session** —
see `docs/infrastructure.md`, which is reference only. No SSH, no server credentials, no
deploy scripts in this directory.
