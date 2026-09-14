import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PLAN } from '../../packages/core/src/data/plans';
import {
  CLIP_PLATFORMS,
  SESSION_DURATIONS,
  SESSION_DURATION_MINUTES,
  SESSION_FEELS,
  SESSION_FEEL_IDS,
  SESSION_LIMITS,
  SESSION_VISIBILITIES,
  SESSION_VISIBILITY_IDS,
  SESSION_WEATHER,
  SESSION_WEATHER_IDS,
} from '../../packages/core/src/data/sessions';
import { CLIP_LINK_CASES } from '../../packages/core/src/rules/clip-links.cases';
import {
  clipLinkProblem as coreProblem,
  parseClipLink as coreParse,
} from '../../packages/core/src/rules/clip-links';
import {
  MAX_UTC_OFFSET_HOURS,
  SESSION_FUTURE_TOLERANCE_MINUTES,
  SESSION_REFUSALS,
  canAddSessionClip as coreCanAddClip,
  landedStageAfter as coreLandedAfter,
  normaliseSessionVisibility as coreNormalise,
  plausibleMonthKeys as corePlausible,
  sessionAllowance,
  sessionClipAllowance,
  sessionCreateDecision as coreDecision,
  sessionQuotaStatus,
  sessionStagePromotion as corePromotion,
  stagesAbove as coreStagesAbove,
  isStageMoveUp as coreIsStageMoveUp,
} from '../../packages/core/src/rules/sessions';
import type { ClipLink, StageId } from '../../packages/core/src/types';

/**
 * **The session rules, hook copy against core copy, run side by side** (T36).
 *
 * The arrangement `video-link-parser.test.ts` set up: plan §3 defines a rule in
 * `packages/core` and enforces it in `pocketbase/hooks`, goja cannot load
 * TypeScript, so the rule exists twice — and this file compares what the two
 * copies *do*, over the shared case table and a deterministic fuzz, rather than
 * comparing their text.
 *
 * `lib/session_rules.js`, `lib/video.js` and `lib/labels.js` are loaded by
 * wrapping their source in a CommonJS function with nothing but
 * `module`/`exports` in scope. A copy that reached for `require`, `$app` or a
 * PocketBase global would throw here, which is the intended alarm.
 *
 * The bottom half holds the **numbers and vocabularies** in step across core,
 * the migration, the hook, the export labels and the test fixture, by regex
 * where they are integers and select lists, as `spot-submission.test.ts` does.
 */

function load<T>(relative: string): T {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const run = new Function('module', 'exports', source) as (
    module: { exports: unknown },
    exports: unknown,
  ) => void;
  const container: { exports: unknown } = { exports: {} };
  run(container, container.exports);
  return container.exports as T;
}

type YouTubeParser = (raw: unknown) => string | null;
interface Allowance {
  cap: number;
  unlimited: boolean;
}

interface HookSessionRules {
  CLIP_PLATFORM_IDS: string[];
  SESSION_DURATION_MINUTES: number[];
  SESSION_FEEL_IDS: string[];
  SESSION_FUTURE_TOLERANCE_MINUTES: number;
  SESSION_LIMITS: Record<string, number>;
  SESSION_REFUSALS: Record<string, string>;
  SESSION_VISIBILITY_IDS: string[];
  SESSION_WEATHER_IDS: string[];
  MAX_UTC_OFFSET_HOURS: { behind: number; ahead: number };
  canAddSessionClip: (allowance: Allowance, held: number) => boolean;
  clipLinkProblem: (raw: unknown, yt: YouTubeParser) => string | null;
  landedStageAfter: (current: unknown) => string | null;
  normaliseSessionVisibility: (raw: unknown) => string;
  parseClipLink: (raw: unknown, yt: YouTubeParser) => ClipLink | null;
  plausibleMonthKeys: (nowMs: number) => string[];
  sessionCreateDecision: (
    allowance: Allowance,
    used: number,
    graceUsed: boolean,
    wantsGrace: boolean,
  ) => string;
  sessionStagePromotion: (input: {
    landed: boolean;
    alreadyPromoted: boolean;
    current: unknown;
    stagePick?: unknown;
  }) => { stageFrom: string | null; stageTo: string } | null;
  stagesAbove: (current: unknown) => string[];
  isStageMoveUp: (current: unknown, target: unknown) => boolean;
  SESSIONS_PREVIEW_REFUSAL: string;
  sessionsPreviewAllows: (userId: unknown, previewId: unknown) => boolean;
}

const hook = load<HookSessionRules>('../hooks/lib/session_rules.js');
const video = load<{ parseYouTubeVideoId: YouTubeParser }>('../hooks/lib/video.js');
const labels = load<Record<string, Record<string, string>>>('../hooks/lib/labels.js');
const hookParse = (raw: unknown) => hook.parseClipLink(raw, video.parseYouTubeVideoId);

describe('the owner-only preview (T41)', () => {
  it('lets everyone write when no preview id is set, so the suite and a released box are open', () => {
    for (const unset of ['', '   ', null, undefined]) {
      expect(hook.sessionsPreviewAllows('rider456', unset)).toBe(true);
    }
  });

  it('lets only the named rider write while the preview is on', () => {
    expect(hook.sessionsPreviewAllows('owner123', 'owner123')).toBe(true);
    expect(hook.sessionsPreviewAllows('owner123', '  owner123  ')).toBe(true);
    expect(hook.sessionsPreviewAllows('rider456', 'owner123')).toBe(false);
    expect(hook.sessionsPreviewAllows('', 'owner123')).toBe(false);
  });

  it('refuses in words a rider can read', () => {
    expect(hook.SESSIONS_PREVIEW_REFUSAL).toBe('Sessions are not open yet.');
  });
});

describe('the clip parsers are the same function', () => {
  for (const { input, expected, why } of CLIP_LINK_CASES) {
    it(`agrees on ${JSON.stringify(input)} — ${why}`, () => {
      const fromHook = hookParse(input);
      const fromCore = coreParse(input);
      // Both against the table *and* against each other: agreeing alone would
      // pass on two copies that are identically wrong.
      expect(fromHook).toEqual(expected);
      expect(fromCore).toEqual(expected);
      expect(fromHook).toEqual(fromCore);
      expect(hook.clipLinkProblem(input, video.parseYouTubeVideoId)).toBe(coreProblem(input));
    });
  }

  it('agrees on non-string input', () => {
    for (const value of [null, undefined, 0, 1, {}, [], true]) {
      expect(hookParse(value)).toEqual(coreParse(value as unknown as string));
    }
  });

  it('agrees on a deterministic fuzz of hosts, paths and ids', () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.@';
    const digits = '0123456789';
    let seed = 20260913;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed;
    };
    const word = (chars: string, min: number, spread: number) => {
      let out = '';
      const length = min + (next() % spread);
      for (let i = 0; i < length; i += 1) out += chars[next() % chars.length];
      return out;
    };
    for (let n = 0; n < 300; n += 1) {
      const code = word(alphabet, 3, 14);
      const id = word(digits, 12, 12);
      const shapes = [
        `https://www.instagram.com/p/${code}/`,
        `https://instagram.com/${code}/reel/${code}`,
        `https://www.tiktok.com/@${code}/video/${id}`,
        `https://m.tiktok.com/v/${id}.html`,
        `https://vm.tiktok.com/${code}/`,
        `https://youtu.be/${code}`,
        `https://evil.example/p/${code}`,
        `${code}.instagram.com/p/${code}`,
      ];
      for (const shape of shapes) {
        expect(hookParse(shape), shape).toEqual(coreParse(shape));
      }
    }
  });
});

describe('the rest of the enforcement copy agrees with core', () => {
  it('normalises visibility the same fail-closed way', () => {
    for (const value of ['public', 'members', 'private', '', 'PUBLIC', 'crew', null, 0, {}]) {
      expect(hook.normaliseSessionVisibility(value)).toBe(coreNormalise(value));
    }
    expect(hook.normaliseSessionVisibility('everyone')).toBe('private');
  });

  it('bounds the month key the same way, across month and year turns', () => {
    const instants = [
      '2026-09-15T12:00:00Z',
      '2026-09-30T11:59:00Z',
      '2026-09-30T12:00:00Z',
      '2026-10-01T11:59:00Z',
      '2026-12-31T23:00:00Z',
      '2027-01-01T01:00:00Z',
    ];
    for (const at of instants) {
      const ms = Date.parse(at);
      expect(hook.plausibleMonthKeys(ms), at).toEqual(corePlausible(ms));
    }
  });

  it('promotes a stage the same way, once', () => {
    const currents: (StageId | null | undefined)[] = [
      null,
      undefined,
      'want',
      'trying',
      'some',
      'most',
      'every',
    ];
    // Every pick the picker can send, plus the two it cannot: none at all, and
    // one that has gone stale because the trick moved under it.
    const picks: (StageId | null | undefined | '')[] = [
      undefined,
      null,
      '',
      'want',
      'trying',
      'some',
      'most',
      'every',
    ];
    for (const current of currents) {
      expect(hook.landedStageAfter(current)).toBe(coreLandedAfter(current));
      expect(hook.stagesAbove(current)).toEqual([...coreStagesAbove(current)]);
      for (const landed of [true, false]) {
        for (const alreadyPromoted of [true, false]) {
          for (const stagePick of picks) {
            const input = { landed, alreadyPromoted, current, stagePick };
            expect(hook.isStageMoveUp(current, stagePick)).toBe(
              coreIsStageMoveUp(current, stagePick as StageId | null | undefined),
            );
            expect(hook.sessionStagePromotion(input), JSON.stringify(input)).toEqual(
              corePromotion(input as Parameters<typeof corePromotion>[0]),
            );
          }
        }
      }
    }
  });

  it('decides a create the same way over the whole quota grid', () => {
    const allowances: Allowance[] = [
      { cap: 4, unlimited: false },
      { cap: 0, unlimited: false },
      { cap: 1, unlimited: false },
      { cap: 0, unlimited: true },
    ];
    for (const allowance of allowances) {
      for (let used = 0; used <= 6; used += 1) {
        for (const graceUsed of [true, false]) {
          for (const wantsGrace of [true, false]) {
            const core = coreDecision(
              sessionQuotaStatus(allowance, { usedThisMonth: used, graceUsed }),
              wantsGrace,
            );
            expect(
              hook.sessionCreateDecision(allowance, used, graceUsed, wantsGrace),
              JSON.stringify({ allowance, used, graceUsed, wantsGrace }),
            ).toBe(core);
          }
        }
        expect(hook.canAddSessionClip(allowance, used)).toBe(coreCanAddClip(allowance, used));
      }
    }
  });

  it('says every refusal in the same words, and keeps the same limits', () => {
    expect(hook.SESSION_REFUSALS).toEqual({ ...SESSION_REFUSALS });
    expect(hook.SESSION_LIMITS).toEqual({ ...SESSION_LIMITS });
    expect(hook.SESSION_FUTURE_TOLERANCE_MINUTES).toBe(SESSION_FUTURE_TOLERANCE_MINUTES);
    expect(hook.MAX_UTC_OFFSET_HOURS).toEqual({ ...MAX_UTC_OFFSET_HOURS });
  });

  it('knows the same vocabularies', () => {
    expect(hook.SESSION_DURATION_MINUTES).toEqual([...SESSION_DURATION_MINUTES]);
    expect(hook.SESSION_FEEL_IDS).toEqual([...SESSION_FEEL_IDS]);
    expect(hook.SESSION_WEATHER_IDS).toEqual([...SESSION_WEATHER_IDS]);
    expect(hook.SESSION_VISIBILITY_IDS).toEqual([...SESSION_VISIBILITY_IDS]);
    expect(hook.CLIP_PLATFORM_IDS).toEqual(CLIP_PLATFORMS.map((p) => p.id));
  });
});

describe('the numbers and select lists agree across core, the migration, the fixture and the export', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const migration = read('../migrations/1789603200_sessions.js');

  const selectValues = (name: string): string[] => {
    const found = new RegExp(`select\\('${name}',\\s*\\[([^\\]]*)\\]`).exec(migration);
    if (!found) throw new Error(`no select '${name}' in the migration`);
    return [...found[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  };

  it('has the core vocabularies as the migration’s select values', () => {
    expect(selectValues('feel')).toEqual([...SESSION_FEEL_IDS]);
    expect(selectValues('weather')).toEqual([...SESSION_WEATHER_IDS]);
    expect(selectValues('visibility')).toEqual([...SESSION_VISIBILITY_IDS]);
    expect(selectValues('clip_platform')).toEqual(CLIP_PLATFORMS.map((p) => p.id));
  });

  it('seeds the plan rows with core’s allowances', () => {
    for (const id of ['rookie', 'shredder', 'legend'] as const) {
      const row = new RegExp(
        `slug: '${id}', sessions: (\\d+), sessionsUnlimited: (true|false), clips: (\\d+), clipsUnlimited: (true|false)`,
      ).exec(migration);
      expect(row, id).not.toBeNull();
      const sessions = sessionAllowance(PLAN[id]);
      const clips = sessionClipAllowance(PLAN[id]);
      expect(Number(row![1]), `${id} sessions`).toBe(sessions.unlimited ? 0 : sessions.cap);
      expect(row![2] === 'true', `${id} sessions unlimited`).toBe(sessions.unlimited);
      expect(Number(row![3]), `${id} clips`).toBe(clips.unlimited ? 0 : clips.cap);
      expect(row![4] === 'true', `${id} clips unlimited`).toBe(clips.unlimited);
    }
  });

  it('gives the test fixture the same numbers, matched by value', () => {
    const helpers = read('./helpers.ts');
    const caps = [...helpers.matchAll(/session_month_cap:\s*(\d+)/g)].map((m) => Number(m[1]));
    const clipCaps = [...helpers.matchAll(/session_clip_cap:\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(caps).toHaveLength(3);
    expect(clipCaps).toHaveLength(3);
    expect(Math.max(...caps)).toBe(sessionAllowance(PLAN.rookie).cap);
    expect(Math.max(...clipCaps)).toBe(sessionClipAllowance(PLAN.shredder).cap);
  });

  it('writes the export in the words the app shows', () => {
    const table = <T extends { id: string }>(rows: readonly T[], label: (row: T) => string) =>
      Object.fromEntries(rows.map((row) => [row.id, label(row)]));
    expect(labels.SESSION_FEEL_LABELS).toEqual(table(SESSION_FEELS, (f) => f.label));
    expect(labels.SESSION_WEATHER_LABELS).toEqual(table(SESSION_WEATHER, (w) => w.label));
    expect(labels.SESSION_VISIBILITY_LABELS).toEqual(table(SESSION_VISIBILITIES, (v) => v.label));
    expect(labels.CLIP_PLATFORM_LABELS).toEqual(table(CLIP_PLATFORMS, (p) => p.label));
    expect(labels.SESSION_DURATION_LABELS).toEqual(
      Object.fromEntries(SESSION_DURATIONS.map((d) => [String(d.minutes), d.label])),
    );
  });
});
