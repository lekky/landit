import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import PocketBase from 'pocketbase';
import { beforeAll, describe, expect, it } from 'vitest';

// @ts-expect-error — a plain .mjs harness, deliberately not part of the build.
import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD, withInstance } from '../scripts/pb-instance.mjs';

/**
 * The seed as **the documented command**, not as an imported function.
 *
 * `seed.integration.test.ts` already proves the writes land, but it does it by
 * importing `seed()` — so it runs under Vitest's resolver, which infers the file
 * extensions this workspace's source omits. `pnpm --filter @landit/db seed`
 * runs under plain Node, which does not. For a while both were true at once:
 * every test passed and the command in `pocketbase/README.md` could not start
 * (issue #155, `ERR_MODULE_NOT_FOUND` on `./types`).
 *
 * So this test spawns the real thing. The argv is **read out of
 * `package.json`** rather than written here twice: a fix that changes how the
 * script is invoked is then covered by this test automatically, and the test
 * cannot drift into proving a command nobody runs.
 *
 * What it does not cover: `pnpm` itself. It executes the script's argv
 * directly, so a broken `scripts` *key* — a rename, say — is still only caught
 * by a human running the documented line. Spawning pnpm inside Vitest costs a
 * second process tree and a lockfile check for no extra signal about the thing
 * that actually broke, which was module resolution.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const dbRoot = path.join(here, '..');

interface CommandRun {
  code: number | null;
  stdout: string;
  stderr: string;
  counts: Record<string, number>;
}

let run: CommandRun;

beforeAll(async () => {
  const manifest = JSON.parse(await readFile(path.join(dbRoot, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  // Both guards are about the failure being readable. If the script is renamed
  // or emptied, this test should say so in one line rather than surfacing as an
  // unexplained spawn error.
  const script = manifest.scripts.seed;
  if (!script) throw new Error('packages/db has no `seed` script for this test to run');

  const [command, ...args] = script.split(' ');
  if (!command) throw new Error(`no command to run in seed script: "${script}"`);

  run = (await withInstance(async (url: string) => {
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolve, reject) => {
        const child = spawn(command, args, {
          cwd: dbRoot,
          env: {
            ...process.env,
            POCKETBASE_URL: url,
            NEXT_PUBLIC_POCKETBASE_URL: url,
            POCKETBASE_SUPERUSER_EMAIL: SUPERUSER_EMAIL,
            POCKETBASE_SUPERUSER_PASSWORD: SUPERUSER_PASSWORD,
          },
          // `node` resolves off PATH; no shell, so nothing here is interpreted.
          shell: false,
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => (stdout += String(chunk)));
        child.stderr.on('data', (chunk) => (stderr += String(chunk)));
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stdout, stderr }));
      },
    );

    const client = new PocketBase(url);
    client.autoCancellation(false);
    await client.collection('_superusers').authWithPassword(SUPERUSER_EMAIL, SUPERUSER_PASSWORD);

    const counts: Record<string, number> = {};
    for (const name of ['plans', 'tricks'] as const) {
      counts[name] = (await client.collection(name).getList(1, 1)).totalItems;
    }

    return { ...result, counts };
  })) as CommandRun;
}, 120_000);

describe('the documented seed command', () => {
  it('exits 0', () => {
    // The stderr and stdout go in the message because a resolution failure is
    // unreadable from an exit code alone — which is how #155 presented.
    expect(run.code, `stdout:\n${run.stdout}\nstderr:\n${run.stderr}`).toBe(0);
  });

  it('writes the plans the Stripe webhook looks up by slug', () => {
    // Not an arbitrary smoke check: `POST /api/stripe/webhook` resolves a plan
    // by slug from this collection and 500s when it cannot, so an unseeded box
    // turns every payment into a retry loop (issue #120).
    expect(run.counts.plans).toBeGreaterThan(0);
  });

  it('writes the trick library', () => {
    expect(run.counts.tricks).toBeGreaterThan(0);
  });
});
