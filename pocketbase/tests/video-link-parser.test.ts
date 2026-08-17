import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { VIDEO_ID_CASES } from '../../packages/core/src/rules/video.cases';
import {
  normaliseVideoVisibility as coreNormalise,
  parseYouTubeVideoId as coreParse,
} from '../../packages/core/src/rules/video';

/**
 * **The two copies of the YouTube parser, run side by side.**
 *
 * Plan §3's arrangement is that a rule is *defined* in `packages/core` and
 * *enforced* in `pocketbase/hooks`, and PocketBase's goja JSVM cannot load
 * TypeScript, so the parser genuinely exists twice. This file is what stops the
 * copies drifting apart, and it does it by **running both** rather than by
 * comparing two files as text.
 *
 * That distinction is the point. `spot-submission.test.ts` compares numbers by
 * regex, which is the right tool for four integers. A parser is not four
 * integers: two implementations can contain identical constants and disagree on
 * a URL with credentials in the authority, and a text comparison would call that
 * a match. Behaviour is what has to agree, so behaviour is what is compared —
 * over the shared table in `packages/core/src/rules/video.cases.ts`, which both
 * suites read so a row added in one place covers both.
 *
 * `pocketbase/hooks/lib/video.js` is loadable here for a reason recorded in its
 * own header: it deliberately touches nothing outside the language — no `$app`,
 * no PocketBase globals, no `URL`, no `Intl`. If a later session gives it a
 * PocketBase dependency the load below throws, and that failure is the intended
 * alarm: the copy would no longer be provably the same function.
 *
 * It is loaded by **wrapping the source in a CommonJS function** rather than by
 * `createRequire`. Two reasons, and the second is the better one:
 * `pocketbase/package.json` carries `"type": "module"`, so Node reads any `.js`
 * beneath it as ESM and refuses a file with `module.exports` in it — and this is
 * closer to what goja actually does with a hook module anyway. Nothing but
 * `module`/`exports` is put in scope, which is itself part of the check: a copy
 * that had started reaching for `require` or `$app` would fail here.
 *
 * No PocketBase instance is needed, but this suite is where the file belongs —
 * the thing under test is a hook.
 */

interface HookVideoLib {
  parseYouTubeVideoId: (raw: unknown) => string | null;
  normaliseVideoVisibility: (raw: unknown) => string;
}

const hook: HookVideoLib = (() => {
  const source = readFileSync(new URL('../hooks/lib/video.js', import.meta.url), 'utf8');
  const load = new Function('module', 'exports', source) as (
    module: { exports: unknown },
    exports: unknown,
  ) => void;
  const container: { exports: unknown } = { exports: {} };
  load(container, container.exports);
  return container.exports as HookVideoLib;
})();

describe('the hook parser and the core parser are the same function', () => {
  for (const { input, expected, why } of VIDEO_ID_CASES) {
    it(`agrees on ${JSON.stringify(input)} — ${why}`, () => {
      const fromHook = hook.parseYouTubeVideoId(input);
      const fromCore = coreParse(input);
      // Both against the table, and against each other. Asserting only that they
      // agree would pass on two copies that are identically wrong.
      expect(fromHook).toBe(expected);
      expect(fromCore).toBe(expected);
      expect(fromHook).toBe(fromCore);
    });
  }

  it('agrees on non-string input, which the hook can be handed by a bad body', () => {
    for (const value of [null, undefined, 0, 1, {}, [], true, false]) {
      expect(hook.parseYouTubeVideoId(value)).toBe(coreParse(value as unknown as string));
    }
  });

  it('agrees on a fuzz of ids and near-ids neither table row names', () => {
    // Generated rather than listed, to catch a disagreement in a corner nobody
    // thought to write down. Deterministic — a seeded walk over the id alphabet,
    // so a failure here is reproducible rather than a one-off nobody can chase.
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let seed = 20260817;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed;
    };
    for (let n = 0; n < 400; n += 1) {
      // Lengths either side of eleven, so most rows are refusals.
      const length = 9 + (next() % 5);
      let id = '';
      for (let i = 0; i < length; i += 1) id += alphabet[next() % alphabet.length];
      const shapes = [
        id,
        `https://youtu.be/${id}`,
        `https://www.youtube.com/watch?v=${id}`,
        `https://www.youtube.com/shorts/${id}?feature=share`,
        `https://evil.example/watch?v=${id}`,
      ];
      for (const shape of shapes) {
        expect(hook.parseYouTubeVideoId(shape), shape).toBe(coreParse(shape));
      }
    }
  });

  it('agrees on how visibility is normalised, in the same fail-closed direction', () => {
    for (const value of ['members', 'private', 'public', '', 'MEMBERS', ' members', null, 0]) {
      expect(hook.normaliseVideoVisibility(value)).toBe(coreNormalise(value as string));
    }
    // The direction itself, so a future edit cannot flip both copies at once and
    // stay green: anything unrecognised is private.
    expect(hook.normaliseVideoVisibility('public')).toBe('private');
  });
});

describe('the cap number agrees across core, the migration and the seed fixture', () => {
  // Three files carry Shredder's cap and only one of them is where it is tuned.
  // A regex comparison is the right tool here for the reason it was the wrong one
  // above: this is an integer, not a grammar. Same technique as
  // `spot-submission.test.ts`.
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

  const numberIn = (source: string, pattern: RegExp): string => {
    const found = pattern.exec(source);
    if (!found) throw new Error(`not found: ${pattern}`);
    return found[1]!;
  };

  it('is the same in the plan data, the migration and the test fixture', () => {
    const core = numberIn(
      read('../../packages/core/src/rules/video.ts'),
      /SHREDDER_VIDEO_LINK_CAP\s*=\s*(\d+)/,
    );
    const migration = numberIn(
      read('../migrations/1787356800_video_links.js'),
      /slug:\s*'shredder',\s*cap:\s*(\d+)/,
    );

    // Rookie's is 0 and Legend's is 0-with-unlimited, so the only non-zero cap
    // in the fixture is Shredder's. Matched by *value* rather than by position,
    // because a regex that depends on which plan block comes first is a test
    // that breaks when somebody reorders three lines.
    const caps = [...read('./helpers.ts').matchAll(/video_link_cap:\s*(\d+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(caps).toHaveLength(3);

    expect(migration).toBe(core);
    expect(Math.max(...caps)).toBe(Number(core));
  });

  it('has Rookie at zero and Legend unlimited in the migration', () => {
    const migration = read('../migrations/1787356800_video_links.js');
    expect(migration).toMatch(/slug:\s*'rookie',\s*cap:\s*0,\s*unlimited:\s*false/);
    expect(migration).toMatch(/slug:\s*'legend',\s*cap:\s*0,\s*unlimited:\s*true/);
  });
});
