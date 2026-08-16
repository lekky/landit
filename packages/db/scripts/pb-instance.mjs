/**
 * A throwaway PocketBase, started on the pinned binary with this repo's real
 * migrations applied.
 *
 * Used by the type generator and by the seed's integration test — both need a
 * database that matches `pocketbase/migrations/` exactly, and neither may touch
 * a developer's `.pb_data`.
 *
 * **This is a second copy of `pocketbase/tests/instance.ts`.** They are kept
 * apart because `@landit/pocketbase` has no dependency on `@landit/core` or the
 * JS SDK and should not grow one just to host a test, and because `@landit/db`
 * should not import another package's test helper through a relative path out
 * of its own tree. Converging them is tracked as an issue; if you change the
 * boot sequence here, change it there too.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const pbRoot = path.join(here, '..', '..', '..', 'pocketbase');

export const SUPERUSER_EMAIL = 'harness@landit.invalid';
export const SUPERUSER_PASSWORD = 'a-long-local-harness-password';

function binaryPath(version) {
  const name = process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase';
  return path.join(pbRoot, '.bin', version, name);
}

/**
 * The download lives in `pocketbase/scripts/pocketbase.mjs` and is pinned by
 * `pocketbase.version`; asking it for `--version` is the cheapest way to make
 * it fetch the binary without duplicating that logic.
 */
async function ensureBinary() {
  const version = (await readFile(path.join(pbRoot, 'pocketbase.version'), 'utf8')).trim();
  const binary = binaryPath(version);
  if (existsSync(binary)) return binary;

  const result = spawnSync(
    process.execPath,
    [path.join(pbRoot, 'scripts', 'pocketbase.mjs'), '--version'],
    { stdio: 'inherit' },
  );
  if (result.status !== 0 || !existsSync(binary)) {
    throw new Error(`Could not obtain PocketBase ${version}. Run \`pnpm pb -- --version\`.`);
  }
  return binary;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function run(binary, args, dataDir) {
  const result = spawnSync(
    binary,
    [
      args[0],
      `--dir=${dataDir}`,
      `--migrationsDir=${path.join(pbRoot, 'migrations')}`,
      ...args.slice(1),
    ],
    { encoding: 'utf8' },
  );
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  // `migrate up` exits 0 even when a migration throws, so the output is the
  // only honest signal — otherwise everything downstream would run against an
  // empty database and pass.
  if (result.status !== 0 || /^Error:/m.test(output)) {
    throw new Error(`pocketbase ${args.join(' ')} failed:\n${output}`);
  }
}

/**
 * Start an instance, hand its URL to `fn`, and tear it down afterwards.
 *
 * @param {(url: string) => Promise<T>} fn
 * @param {{ hooks?: boolean }} [options] load `pocketbase/hooks/` too. Off for
 *   the type generator (which only reads the schema); on where the test is
 *   about behaviour the hooks own.
 * @returns {Promise<T>}
 * @template T
 */
export async function withInstance(fn, options = {}) {
  const binary = await ensureBinary();
  const dataDir = await mkdtemp(path.join(tmpdir(), 'landit-db-'));

  run(binary, ['migrate', 'up'], dataDir);
  run(binary, ['superuser', 'upsert', SUPERUSER_EMAIL, SUPERUSER_PASSWORD], dataDir);

  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;

  const child = spawn(
    binary,
    [
      'serve',
      `--dir=${dataDir}`,
      `--migrationsDir=${path.join(pbRoot, 'migrations')}`,
      ...(options.hooks ? [`--hooksDir=${path.join(pbRoot, 'hooks')}`] : []),
      `--http=127.0.0.1:${port}`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let log = '';
  child.stdout?.on('data', (c) => (log += String(c)));
  child.stderr?.on('data', (c) => (log += String(c)));

  try {
    const deadline = Date.now() + 30_000;
    for (;;) {
      if (child.exitCode !== null) throw new Error(`PocketBase exited early:\n${log}`);
      try {
        if ((await fetch(`${url}/api/health`)).ok) break;
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) throw new Error(`PocketBase never became healthy:\n${log}`);
      await new Promise((r) => setTimeout(r, 100));
    }
    return await fn(url);
  } finally {
    child.kill();
    await rm(dataDir, { recursive: true, force: true }).catch(() => {});
  }
}
