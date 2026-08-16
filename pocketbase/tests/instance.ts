import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pbRoot = path.join(here, '..');

export const SUPERUSER_EMAIL = 'test-superuser@landit.invalid';
export const SUPERUSER_PASSWORD = 'a-long-local-test-password';

/**
 * A throwaway PocketBase, started against this repo's real migrations and real
 * hooks, on a scratch database that is deleted afterwards.
 *
 * The tests that matter here are about what the HTTP API actually does, so
 * there is no mock and no in-process shortcut: the binary that runs in
 * production is the binary under test, running the files that ship.
 */
export interface Instance {
  url: string;
  dataDir: string;
  stop(): Promise<void>;
}

async function pinnedVersion(): Promise<string> {
  return (await readFile(path.join(pbRoot, 'pocketbase.version'), 'utf8')).trim();
}

function binaryPath(version: string): string {
  const name = process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase';
  return path.join(pbRoot, '.bin', version, name);
}

/**
 * The download lives in `scripts/pocketbase.mjs` and is pinned by
 * `pocketbase.version`; asking it for `--version` is the cheapest way to make it
 * fetch the binary without duplicating that logic here.
 */
async function ensureBinary(): Promise<string> {
  const version = await pinnedVersion();
  const binary = binaryPath(version);
  if (existsSync(binary)) return binary;

  const result = spawnSync(
    process.execPath,
    [path.join(pbRoot, 'scripts', 'pocketbase.mjs'), '--version'],
    { stdio: 'inherit' },
  );
  if (result.status !== 0 || !existsSync(binary)) {
    throw new Error(
      `Could not obtain PocketBase ${version}. Run \`pnpm pb -- --version\` and check the network.`,
    );
  }
  return binary;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'string' || address === null) {
        server.close(() => reject(new Error('could not pick a port')));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

function run(binary: string, args: string[], dataDir: string): void {
  const result = spawnSync(
    binary,
    [
      args[0]!,
      `--dir=${dataDir}`,
      `--migrationsDir=${path.join(pbRoot, 'migrations')}`,
      ...args.slice(1),
    ],
    { encoding: 'utf8' },
  );
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  // `migrate` exits 0 even when a migration throws, so the output is the only
  // honest signal. A silent schema failure would make every rule test below
  // pass against an empty database.
  if (result.status !== 0 || /^Error:/m.test(output)) {
    throw new Error(`pocketbase ${args.join(' ')} failed:\n${output}`);
  }
}

async function waitForHealth(url: string, child: ChildProcess, log: () => string): Promise<void> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (child.exitCode !== null) {
      throw new Error(`PocketBase exited early (${child.exitCode}):\n${log()}`);
    }
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`PocketBase never became healthy:\n${log()}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export async function startPocketBase(): Promise<Instance> {
  const binary = await ensureBinary();
  const dataDir = await mkdtemp(path.join(tmpdir(), 'landit-pb-'));

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
      `--hooksDir=${path.join(pbRoot, 'hooks')}`,
      `--http=127.0.0.1:${port}`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let output = '';
  child.stdout?.on('data', (chunk) => (output += String(chunk)));
  child.stderr?.on('data', (chunk) => (output += String(chunk)));

  try {
    await waitForHealth(url, child, () => output);
  } catch (error) {
    child.kill();
    await rm(dataDir, { recursive: true, force: true });
    throw error;
  }

  return {
    url,
    dataDir,
    async stop() {
      await new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once('exit', () => resolve());
        child.kill();
        setTimeout(() => resolve(), 5_000);
      });
      await rm(dataDir, { recursive: true, force: true }).catch(() => {});
    },
  };
}
