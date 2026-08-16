import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * `collections.ts` is generated from `pocketbase/migrations/`. If a later
 * session adds a field and forgets to regenerate, every consumer typechecks
 * against a schema the database no longer has — and nothing else would say so.
 *
 * This runs the generator against a throwaway PocketBase and compares. It
 * cannot skip: no binary, no network, a migration that throws — all of those
 * are failures here, not quiet passes (LESSONS §5).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, '..', '..', 'scripts', 'generate-types.mjs');

describe('generated collection types', () => {
  it('match what the migrations actually produce', () => {
    const result = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });

    expect(
      `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() || '(no output)',
    ).toContain('up to date');
    expect(result.status).toBe(0);
  }, 120_000);
});
