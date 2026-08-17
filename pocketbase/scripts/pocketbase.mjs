#!/usr/bin/env node
/**
 * Run PocketBase locally against this repo's migrations and hooks.
 *
 *   pnpm pb:dev            # serve on http://127.0.0.1:8090
 *   pnpm pb -- superuser upsert you@example.com yourpassword
 *   pnpm pb -- --help
 *
 * The binary is downloaded once into `pocketbase/.bin/<version>/` (git-ignored)
 * and pinned by `pocketbase/pocketbase.version`, so every machine and every CI
 * run uses the same PocketBase. No Docker.
 *
 * Data lives in `pocketbase/.pb_data/` and is also git-ignored — it is a local
 * scratch database. The schema lives in `pocketbase/migrations/`, which is
 * committed; that is the source of truth.
 *
 * Before `serve`, the superuser from `POCKETBASE_SUPERUSER_EMAIL` /
 * `_PASSWORD` (or `apps/web/.env.local`) is upserted into the data directory —
 * see `ensureSuperuser`. Without that, a data directory with no superuser makes
 * PocketBase open its installer page in your browser, every time, and there is
 * no flag to turn that off.
 */
import { spawn, spawnSync } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { unzipSync } from 'fflate';

const here = path.dirname(fileURLToPath(import.meta.url));
const pbRoot = path.join(here, '..');
const repoRoot = path.join(pbRoot, '..');

const DEFAULT_ADDR = '127.0.0.1:8090';

/** @returns {Promise<string>} the pinned version, e.g. `0.39.11` */
async function readPinnedVersion() {
  const raw = await readFile(path.join(pbRoot, 'pocketbase.version'), 'utf8');
  const version = raw.trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`pocketbase/pocketbase.version is not a version: ${JSON.stringify(raw)}`);
  }
  return version;
}

/** Maps this machine onto the names PocketBase publishes its release assets under. */
function assetNameFor(version) {
  const os = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform];
  const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch];

  if (!os || !arch) {
    throw new Error(
      `No PocketBase release for ${process.platform}/${process.arch}. ` +
        `Download it by hand from https://github.com/pocketbase/pocketbase/releases/tag/v${version}` +
        ` and unzip it into pocketbase/.bin/${version}/.`,
    );
  }
  return `pocketbase_${version}_${os}_${arch}.zip`;
}

async function download(version) {
  const asset = assetNameFor(version);
  const url = `https://github.com/pocketbase/pocketbase/releases/download/v${version}/${asset}`;
  const dir = path.join(pbRoot, '.bin', version);

  process.stderr.write(`Downloading PocketBase ${version} (${asset})…\n`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText} for ${url}`);
  }

  const zip = new Uint8Array(await response.arrayBuffer());
  const files = unzipSync(zip);

  await mkdir(dir, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) {
    // The archive holds the binary plus LICENSE.md and CHANGELOG.md, all flat.
    if (name.endsWith('/')) continue;
    const target = path.join(dir, path.basename(name));
    await writeFile(target, bytes);
  }

  const binary = binaryPath(version);
  if (process.platform !== 'win32') await chmod(binary, 0o755);
  return binary;
}

function binaryPath(version) {
  const name = process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase';
  return path.join(pbRoot, '.bin', version, name);
}

async function ensureBinary() {
  const version = await readPinnedVersion();
  const binary = binaryPath(version);
  if (existsSync(binary)) return binary;
  return download(version);
}

/**
 * PocketBase reads hooks and migrations from directories next to its data dir
 * by default. We keep them in the repo instead, so both are passed explicitly —
 * otherwise a hook would silently not run.
 */
function argsFor(userArgs) {
  const args = [...userArgs];
  if (args.length === 0) args.push('serve');

  // `POCKETBASE_DATA_DIR` lets a second instance — the e2e run's, on its own
  // port — keep its own database instead of writing test riders into the one
  // you are developing against. Relative paths are resolved against
  // `pocketbase/`, so `.pb_e2e` means what it looks like.
  const dataDir = process.env.POCKETBASE_DATA_DIR
    ? path.resolve(pbRoot, process.env.POCKETBASE_DATA_DIR)
    : path.join(pbRoot, '.pb_data');

  const repoFlags = [
    `--dir=${dataDir}`,
    `--migrationsDir=${path.join(pbRoot, 'migrations')}`,
    `--hooksDir=${path.join(pbRoot, 'hooks')}`,
  ];

  if (args[0] === 'serve' && !args.some((a) => a.startsWith('--http'))) {
    repoFlags.push(`--http=${process.env.POCKETBASE_ADDR ?? DEFAULT_ADDR}`);
  }

  return [args[0], ...repoFlags, ...args.slice(1)];
}

/**
 * The two variables the superuser is read from, in precedence order: the real
 * environment first, then `apps/web/.env.local`.
 *
 * `.env.local` is read because that is where the pair already lives for anybody
 * who has followed `docs/staff-accounts.md` — the web app needs it for the
 * superuser client — and because this script is not run by Next, so nothing
 * else loads it. Parsed rather than `dotenv`-ed to keep this script
 * dependency-free; it wants two keys, not a spec-compliant parser.
 */
async function readSuperuserCredentials() {
  const fromEnv = {
    email: process.env.POCKETBASE_SUPERUSER_EMAIL,
    password: process.env.POCKETBASE_SUPERUSER_PASSWORD,
  };
  if (fromEnv.email && fromEnv.password) return fromEnv;

  const envFile = path.join(repoRoot, 'apps', 'web', '.env.local');
  if (!existsSync(envFile)) return fromEnv;

  const found = {};
  const raw = await readFile(envFile, 'utf8').catch(() => '');
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*(POCKETBASE_SUPERUSER_(?:EMAIL|PASSWORD))\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    // Strip matching surrounding quotes; leave anything else alone.
    found[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }

  return {
    email: fromEnv.email || found.POCKETBASE_SUPERUSER_EMAIL,
    password: fromEnv.password || found.POCKETBASE_SUPERUSER_PASSWORD,
  };
}

/**
 * Make sure the data directory has a superuser **before** the server starts.
 *
 * PocketBase opens its installer page in whatever browser is to hand whenever it
 * starts against a data directory with no superuser in it, and there is no flag
 * to stop it (`serve --help` has `--http`, `--https`, `--origins` and nothing
 * else). The only lever is to give it one first, so that is what this does.
 *
 * It matters more than a one-off annoyance suggests, because a *fresh* data
 * directory is not rare: `POCKETBASE_DATA_DIR` exists precisely so a second
 * instance can have its own database, and every one of those is a first run.
 * LESSONS §5 records this hijacking the owner's browser mid-wave from a sibling
 * session's instance; it did it twice more in one evening from two throwaway
 * directories before this was written.
 *
 * `upsert` rather than `create`, so this is idempotent and the password stays
 * whatever the environment says — for a git-ignored scratch database that is
 * the right source of truth. A failure here is printed and then ignored: the
 * server should still start, and the worst case is the behaviour we had before.
 */
async function ensureSuperuser(binary, dataDir) {
  const { email, password } = await readSuperuserCredentials();

  if (!email || !password) {
    process.stderr.write(
      'PocketBase: no POCKETBASE_SUPERUSER_EMAIL/PASSWORD found, so a new data directory\n' +
        '            will open its installer page in your browser. To stop that, set both in\n' +
        '            apps/web/.env.local (the web app needs them anyway — docs/staff-accounts.md)\n' +
        '            or run: pnpm pb -- superuser upsert you@example.invalid a-long-password\n',
    );
    return;
  }

  const result = spawnSync(binary, ['superuser', 'upsert', email, password, `--dir=${dataDir}`], {
    stdio: ['ignore', 'ignore', 'pipe'],
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    process.stderr.write(
      `PocketBase: could not ensure the superuser (${email}); starting anyway.\n` +
        `            ${(result.stderr || '').trim() || `exit ${result.status}`}\n`,
    );
  }
}

const binary = await ensureBinary();
const args = argsFor(process.argv.slice(2));

// Only for `serve`: `superuser upsert` and friends must not recurse into this,
// and no other subcommand opens a browser.
if (args[0] === 'serve') {
  const dirFlag = args.find((a) => a.startsWith('--dir='));
  if (dirFlag) await ensureSuperuser(binary, dirFlag.slice('--dir='.length));
}

const child = spawn(binary, args, { stdio: 'inherit' });
child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
