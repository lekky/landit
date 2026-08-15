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
 */
import { spawn } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { unzipSync } from 'fflate';

const here = path.dirname(fileURLToPath(import.meta.url));
const pbRoot = path.join(here, '..');

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

  const repoFlags = [
    `--dir=${path.join(pbRoot, '.pb_data')}`,
    `--migrationsDir=${path.join(pbRoot, 'migrations')}`,
    `--hooksDir=${path.join(pbRoot, 'hooks')}`,
  ];

  if (args[0] === 'serve' && !args.some((a) => a.startsWith('--http'))) {
    repoFlags.push(`--http=${process.env.POCKETBASE_ADDR ?? DEFAULT_ADDR}`);
  }

  return [args[0], ...repoFlags, ...args.slice(1)];
}

const binary = await ensureBinary();
const args = argsFor(process.argv.slice(2));

const child = spawn(binary, args, { stdio: 'inherit' });
child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
