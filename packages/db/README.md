# @landit/db

How the app talks to PocketBase: clients, generated types, the typed reads and writes, and
the seed.

**This package holds no rules.** Nothing here decides whether a trick is free, whether a
sticker is earned or whether a profile is visible. Those live in `@landit/core` (defined) and
`pocketbase/` (enforced). A check written here would be a third copy, weaker than both, and
the first to drift — see plan §3.

## Which client you hold decides which rules apply

| | Carries | Subject to the API rules |
| --- | --- | --- |
| `createBrowserClient()` | the rider's token | yes |
| `createServerClient({ token })` | one request's rider | yes |
| `createSuperuserClient()` | ours | **no** |

The superuser client is server-only and throws if it is ever constructed where `window`
exists. Reach for it only where the product acts as itself rather than as a rider: seeds, the
consent flow, sticker awards, staff actions. The model-layer hooks (the paywall, the sticker
award) deliberately do **not** exempt it, so it is not a way round those.

There is no module-level singleton on purpose. A shared server client is a shared auth store,
and a shared auth store is one request answering with another rider's data.

## Reading and writing

Named functions first — `listTricks`, `riderSnapshot`, `setTrickStage` — and
`records(client, 'tricks')` for anything they do not cover. Everything is typed off the
generated collection types, and **filters are always parameterised**:

```ts
records(client, 'tricks').first('slug = {:slug}', { slug });
```

Never build a filter by concatenation. The privacy rules are written in this same filter
language, so a rider who can inject into a filter can read past them.

Two things are deliberately absent from `mutations.ts`, both because they are not a rider's
to write: **sticker awards** (`rider_stickers` has `createRule: null`; the hook creates them)
and **the weekly streak** (server-owned — issue #8 — so "I rode today" is a server route that
runs `logWeeklyRide`, not a PATCH from a screen).

## Generated types

`src/generated/collections.ts` is generated from `pocketbase/migrations/` and committed.

```bash
pnpm --filter @landit/db typegen          # rewrite it
pnpm --filter @landit/db typegen --check  # fail if it is stale
```

The generator boots a throwaway PocketBase on the pinned binary, applies the real migrations
and reads the collections API, so the types cannot describe a schema the migrations do not
produce. `collections.drift.test.ts` runs the check, so a stale copy cannot reach `main`.

It is **not** `pocketbase-typegen`, which plan §7 originally named — that reads SQLite through
`better-sqlite3`, a native module pnpm will not build unless `allowBuilds` grows, and with it
unbuilt every pnpm command in the workspace fails. The divergence is recorded in plan §7.

The file is in `.prettierignore`: the drift check compares bytes, so a formatter rewriting it
would fail a check on a file nobody edited.

## Seeding

```bash
pnpm --filter @landit/db seed                    # local
pnpm --filter @landit/db seed --url https://…    # a hosted instance
```

Credentials come from `POCKETBASE_SUPERUSER_EMAIL` / `POCKETBASE_SUPERUSER_PASSWORD` in the
environment, never from an argument, so they stay out of shell history and process lists.

The data is `@landit/core`'s canonical data — the same source as the rules' test fixtures, so
there is no second transcription of the trick library. **Nothing enumerates sports:** the seed
writes whatever sports the data has, so the BMX library seeds itself once T21 adds it. What
T21 must still do is widen the `select` values in the migrations; `assertSportsAccepted` turns
that into a clear failure rather than a bare 400.

Seeding is idempotent — every record is matched on its natural key and updated in place — so
running it against a database riders already use is safe: trick records keep their ids, and
`trick_progress` keeps pointing at them.

## Tests

`pnpm --filter @landit/db test` covers the seed mapping as a unit, and then runs the seed and
the type generator against a **real** PocketBase. Both integration tests need the pinned
binary; neither can skip if it is missing (LESSONS §5).

`scripts/pb-instance.mjs` is a second copy of `pocketbase/tests/instance.ts` — the two are
apart because neither package should depend on the other's tree to host a test. If you change
the boot sequence in one, change it in the other.
