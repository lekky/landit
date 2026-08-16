import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pbRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The deployed PocketBase is the one the guarantees were tested against.
 *
 * `pocketbase.version` pins what `pnpm pb:dev` runs and what the HTTP suite in
 * this directory starts. `Dockerfile` pins what Coolify deploys. Nothing but
 * this test connects them, and a mismatch is invisible until production behaves
 * differently from CI — on a schema whose four security guarantees are the
 * reason the suite next door exists.
 *
 * Deliberately not a build-time trick: an `ARG` cannot read a file, and the
 * alternatives (a build argument Coolify has to remember to pass, or a
 * generated Dockerfile) both move the failure to somewhere nobody is looking.
 * A red test is somewhere everybody is looking.
 */
describe('the deployed PocketBase version', () => {
  it('matches pocketbase.version', async () => {
    const pinned = (await readFile(path.join(pbRoot, 'pocketbase.version'), 'utf8')).trim();
    const dockerfile = await readFile(path.join(pbRoot, 'Dockerfile'), 'utf8');

    const declared = /^ARG POCKETBASE_VERSION=(.+)$/m.exec(dockerfile)?.[1]?.trim();

    expect(declared, 'Dockerfile has no ARG POCKETBASE_VERSION').toBeTruthy();
    expect(
      declared,
      `Dockerfile pins PocketBase ${declared}, pocketbase.version says ${pinned}. Upgrading means changing both.`,
    ).toBe(pinned);
  });

  it('runs the migrations and hooks this repo ships', async () => {
    // Without these two flags PocketBase looks beside its data directory and
    // silently finds neither — an instance with no hooks has no consent gate
    // and no paywall, and answers 200 to things it must refuse.
    const dockerfile = await readFile(path.join(pbRoot, 'Dockerfile'), 'utf8');
    expect(dockerfile).toContain('--migrationsDir=/pb/migrations');
    expect(dockerfile).toContain('--hooksDir=/pb/hooks');
    expect(dockerfile).toMatch(/COPY .*pocketbase\/migrations \.\/migrations/);
    expect(dockerfile).toMatch(/COPY .*pocketbase\/hooks \.\/hooks/);
  });
});
