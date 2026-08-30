import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { GOALS, LEVELS, PRIVACY, STANCES } from '../../packages/core/src/data/profile';
import { SPORTS } from '../../packages/core/src/data/sports';
import { STAGES } from '../../packages/core/src/data/stages';

/**
 * **The words the data export is written in, against the words the app shows.**
 *
 * `pocketbase/hooks/lib/labels.js` exists because a rider's download has to be
 * readable and goja cannot load TypeScript, so the labels genuinely exist twice
 * — once in `packages/core/src/data`, once in the hook. This file is what stops
 * the copies drifting, in the manner `video-link-parser.test.ts` established:
 * by loading the hook and comparing behaviour, not by reading two files as text.
 *
 * A label renamed in core and not here would otherwise show up nowhere — the
 * app would say "Learning" and the export would say something else, and no
 * screen and no other test would notice, because the only reader of the export
 * is a rider who has already left.
 *
 * `labels.js` is loadable here for the same reason `video.js` is: it touches
 * nothing outside the language. If a later session gives it a PocketBase
 * dependency the load below throws, and that failure is the intended alarm.
 */

interface HookLabels {
  AGE_BAND_LABELS: Record<string, string>;
  CONSENT_LABELS: Record<string, string>;
  GOAL_LABELS: Record<string, string>;
  LEVEL_LABELS: Record<string, string>;
  PRIVACY_LABELS: Record<string, string>;
  SPORT_LABELS: Record<string, string>;
  STAGE_LABELS: Record<string, string>;
  STANCE_LABELS: Record<string, string>;
  labelFor: (map: Record<string, string>, value: unknown) => string;
  readableDate: (raw: unknown) => string;
}

const hook: HookLabels = (() => {
  const source = readFileSync(new URL('../hooks/lib/labels.js', import.meta.url), 'utf8');
  const load = new Function('module', 'exports', source) as (
    module: { exports: unknown },
    exports: unknown,
  ) => void;
  const container: { exports: unknown } = { exports: {} };
  load(container, container.exports);
  return container.exports as HookLabels;
})();

const mirrors = [
  { what: 'stages', core: STAGES, map: hook.STAGE_LABELS },
  { what: 'sports', core: Object.values(SPORTS), map: hook.SPORT_LABELS },
  { what: 'stances', core: STANCES, map: hook.STANCE_LABELS },
  { what: 'levels', core: LEVELS, map: hook.LEVEL_LABELS },
  { what: 'goals', core: GOALS, map: hook.GOAL_LABELS },
  { what: 'privacy settings', core: PRIVACY, map: hook.PRIVACY_LABELS },
] as const satisfies readonly {
  what: string;
  core: readonly { id: string; label: string }[];
  map: Record<string, string>;
}[];

describe('the export speaks the same words as the app', () => {
  for (const { what, core, map } of mirrors) {
    it(`covers every one of the ${what}, with the label core gives it`, () => {
      // Both directions. Only checking core's ids would pass a hook map that had
      // kept a stage the product retired; only checking the hook's keys would
      // pass one that had never learnt about a new sport.
      expect(Object.keys(map).sort()).toEqual(core.map((entry) => entry.id).sort());
      for (const entry of core) expect(map[entry.id]).toBe(entry.label);
    });
  }
});

describe('a code with no word for it', () => {
  it('comes back as it was stored rather than as nothing', () => {
    // The one thing this file must never do to an export is lose a fact. A
    // select option added in a later migration has no entry in the hook map,
    // and the rider still has to receive it.
    expect(hook.labelFor(hook.STAGE_LABELS, 'a_stage_added_later')).toBe('a_stage_added_later');
    expect(hook.labelFor(hook.SPORT_LABELS, 'bmx')).toBe('BMX');
  });

  it('leaves an unset value empty', () => {
    for (const empty of ['', null, undefined]) {
      expect(hook.labelFor(hook.LEVEL_LABELS, empty)).toBe('');
    }
  });

  it('does not answer with something inherited from Object.prototype', () => {
    // `map[key]` alone would call `constructor` a label and hand a rider a
    // function's source where their riding level should be.
    expect(hook.labelFor(hook.LEVEL_LABELS, 'constructor')).toBe('constructor');
    expect(hook.labelFor(hook.LEVEL_LABELS, 'toString')).toBe('toString');
  });
});

describe('timestamps a person can read', () => {
  it('spells out the format PocketBase stores', () => {
    expect(hook.readableDate('2026-08-18 16:31:37.983Z')).toBe('18 Aug 2026, 16:31 UTC');
    expect(hook.readableDate('2026-01-01 00:00:00.000Z')).toBe('1 Jan 2026, 00:00 UTC');
    expect(hook.readableDate('2026-12-31 23:59:59.000Z')).toBe('31 Dec 2026, 23:59 UTC');
  });

  it('reads an ISO-8601 T as well as PocketBase’s space', () => {
    expect(hook.readableDate('2026-08-18T16:31:37Z')).toBe('18 Aug 2026, 16:31 UTC');
  });

  it('leaves an unset date empty, which is what it already was', () => {
    for (const empty of ['', null, undefined, 'not a date', '2026-13-01 00:00:00.000Z']) {
      expect(hook.readableDate(empty)).toBe('');
    }
  });
});
