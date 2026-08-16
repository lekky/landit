#!/usr/bin/env node
/**
 * Load the canonical data into a PocketBase instance.
 *
 *   pnpm --filter @landit/db seed              # the local dev instance
 *   pnpm --filter @landit/db seed --url https://…   # a hosted one
 *
 * Credentials come from the environment — `POCKETBASE_SUPERUSER_EMAIL` and
 * `POCKETBASE_SUPERUSER_PASSWORD` — never from an argument, so they do not end
 * up in a shell history or a process list. See `apps/web/.env.example`.
 *
 * Seeding is idempotent, so re-running it after a data change is the normal way
 * to update the trick library on an instance that already has riders on it.
 *
 * **This is not a deploy script.** Pointing it at the production box is a
 * deliberate act with the credentials to match; build sessions do not do it
 * (`CLAUDE.md`, "never touch the production box").
 */
import process from 'node:process';

import { createSuperuserClient } from '../src/clients.ts';
import { seed } from '../src/seed.ts';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const url = flag('url');

const client = await createSuperuserClient(url ? { url } : {});
process.stderr.write(`Seeding ${client.baseURL}…\n`);

const results = await seed(client, undefined, {
  log: (message) => process.stderr.write(`  ${message}\n`),
});

const created = results.reduce((sum, r) => sum + r.created, 0);
const updated = results.reduce((sum, r) => sum + r.updated, 0);
process.stderr.write(`Done: ${created} created, ${updated} updated.\n`);
