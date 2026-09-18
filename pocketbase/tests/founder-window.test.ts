import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { FOUNDER_JOINED_BY } from '../../packages/core/src/rules/stickers';

/**
 * **The founder window, against the copy of it the server actually enforces.**
 *
 * `day-one` is the one award whose rule is a date rather than a count, and that
 * date genuinely exists twice: `FOUNDER_JOINED_BY` in `@landit/core`, which is
 * what the client under-promises with, and a literal inside `riderScope()` in
 * `pocketbase/hooks/lib/stickers.js`, because goja cannot load TypeScript and
 * the hook is what grants the badge (plan §3 — the server decides).
 *
 * Widening one and not the other is silent in both directions: the app would
 * show a rider a badge the hook refuses, or the hook would grant one the wall
 * never advertised. Nothing else would notice — every other sticker test
 * asserts on stats the record carries, and this window is on no record at all.
 *
 * Unlike `export-labels.test.ts`, this reads the hook as text rather than
 * loading it: the literal sits inside a function that wants a live PocketBase
 * `app` and a real user record, so there is no behaviour to call here. The
 * pattern is `consent-mail-body.test.ts`'s — match the line, extract what it
 * enforces, and compare that, so restructuring the line fails the test rather
 * than slipping past a substring search.
 */
describe('the founder window', () => {
  const source = readFileSync(new URL('../hooks/lib/stickers.js', import.meta.url), 'utf8');

  it('is the same date in the hook as in @landit/core', () => {
    const match = source.match(/isFounder:.*?<=\s*'(\d{4}-\d{2}-\d{2})'/);
    expect(match, 'no isFounder date comparison found in hooks/lib/stickers.js').not.toBeNull();
    expect(match?.[1]).toBe(FOUNDER_JOINED_BY);
  });

  it('is a plain ISO date, so a string comparison orders it correctly', () => {
    // `created.slice(0, 10) <= FOUNDER_JOINED_BY` is a string compare on both
    // sides of the wire. That only orders dates while the cutoff is a
    // zero-padded `YYYY-MM-DD`; `2026-9-17` would sort after `2026-12-31`.
    expect(FOUNDER_JOINED_BY).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${FOUNDER_JOINED_BY}T00:00:00Z`).toISOString().slice(0, 10)).toBe(
      FOUNDER_JOINED_BY,
    );
  });
});
