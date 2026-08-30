import type { Challenge } from '../types';

/**
 * One challenge per sport per week, transcribed from
 * `design-handoff/design/landit-data.js`, with the BMX weeks authored here.
 *
 * State (`upcoming` / `live` / `past`) is never stored — it is derived from
 * `starts`/`ends` in the rider's timezone by `../rules/challenges.ts`
 * (plan §2.2). `starts` and `ends` are inclusive calendar days, `YYYY-MM-DD`.
 *
 * Two deliberate divergences from the design pack's data, both T12, both
 * recorded in plan §7:
 *
 * - **`reward` names the `challenger` sticker, not one of ten that never
 *   existed** (issue #76). The pack gave each week a bespoke reward — "Long
 *   Roller", "Waxed In", "Down The Set" — and not one of those ten names is a
 *   sticker record, so the challenge screen promised a reward the award flow
 *   could never grant. `challenger` ("Finish a weekly challenge") is the one
 *   that exists, has a rule, and is already awarded server-side on the
 *   `challenge_log` write. `challengeRewardSticker` in `../rules/challenges.ts`
 *   resolves the string and a test holds the two together, so a rename cannot
 *   quietly re-open the hole.
 * - **`riders` is empty on the BMX weeks.** The shipped copy ("1,102 riders
 *   in") is invented participation, and the challenge screen no longer renders
 *   it — inventing more of it for a third sport would be inventing a lie in a
 *   product aimed at children. The field stays because the column does.
 *
 * **Three sports, not two** (plan §1, issue #80). BMX runs the same six weeks
 * as the other two, so `challengesFor('bmx')` is not an empty list and the
 * `challenger` sticker is reachable for a BMX-only rider. Every BMX week names
 * tricks that are actually in the shipped BMX library.
 */
export const CHALLENGES = [
  {
    id: 'sc-30',
    sport: 'scooter',
    week: 'Week 30',
    title: 'Manual Metres',
    blurb: 'Roll a manual the length of a car park. Log three that felt clean.',
    starts: '2026-07-20',
    ends: '2026-07-26',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#FF9F1C',
    riders: '1,102 riders in',
    verb: 'Log a manual',
    isLive: true,
  },
  {
    id: 'sc-31',
    sport: 'scooter',
    week: 'Week 31',
    title: 'Grind Week',
    blurb: 'Any ledge, any rail, any peg. Three grinds before Sunday.',
    starts: '2026-07-27',
    ends: '2026-08-02',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#9CE05B',
    riders: '1,340 riders in',
    verb: 'Log a grind',
    isLive: true,
  },
  {
    id: 'sc-32',
    sport: 'scooter',
    week: 'Week 32',
    title: 'Bar Spin Blitz',
    blurb: 'Bars all week. Flat, off a kicker, out of a grind. Three of them.',
    starts: '2026-08-03',
    ends: '2026-08-09',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#8A3BE0',
    riders: '1,208 riders in',
    verb: 'Log a bar spin',
    isLive: true,
  },
  {
    id: 'sc-33',
    sport: 'scooter',
    week: 'Week 33',
    title: 'Switch Week',
    blurb:
      'Everything you can already do. Do it rolling backwards. Log three switch tricks before Sunday.',
    starts: '2026-08-10',
    ends: '2026-08-16',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#3AC0FF',
    riders: '1,284 riders in',
    verb: 'Log a switch trick',
    isLive: true,
  },
  {
    id: 'sc-34',
    sport: 'scooter',
    week: 'Week 34',
    title: 'No Hander Week',
    blurb: 'Let go of something. No footers count, no handers count double.',
    starts: '2026-08-17',
    ends: '2026-08-23',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#FF5A1F',
    riders: 'Opens Monday',
    verb: 'Log a no hander',
    isLive: true,
  },
  {
    id: 'sc-35',
    sport: 'scooter',
    week: 'Week 35',
    title: 'Park Lap',
    blurb: "One clean lap of your local, no put downs. Film it or it didn't happen.",
    starts: '2026-08-24',
    ends: '2026-08-30',
    goal: 1,
    reward: 'First Challenge sticker',
    hue: '#10A06A',
    riders: 'Opens in two weeks',
    verb: 'Log a full lap',
    isLive: true,
  },
  {
    id: 'sk-30',
    sport: 'skate',
    week: 'Week 30',
    title: 'Manual Metres',
    blurb: 'Hold a manual the length of the pad. Three that you actually rode out.',
    starts: '2026-07-20',
    ends: '2026-07-26',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#FF9F1C',
    riders: '1,880 riders in',
    verb: 'Log a manual',
    isLive: true,
  },
  {
    id: 'sk-31',
    sport: 'skate',
    week: 'Week 31',
    title: 'Ledge Week',
    blurb: 'Anything on a ledge. Slides count, grinds count, hitting it and bailing does not.',
    starts: '2026-07-27',
    ends: '2026-08-02',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#9CE05B',
    riders: '2,240 riders in',
    verb: 'Log a ledge trick',
    isLive: true,
  },
  {
    id: 'sk-32',
    sport: 'skate',
    week: 'Week 32',
    title: 'Flip In Flip Out',
    blurb: 'A flip into something or out of something. Three of them, any obstacle.',
    starts: '2026-08-03',
    ends: '2026-08-09',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#8A3BE0',
    riders: '1,975 riders in',
    verb: 'Log a flip trick',
    isLive: true,
  },
  {
    id: 'sk-33',
    sport: 'skate',
    week: 'Week 33',
    title: 'Fakie Week',
    blurb:
      'Take three tricks you already have and land them rolling fakie. Nollie versions count double.',
    starts: '2026-08-10',
    ends: '2026-08-16',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#FF9F1C',
    riders: '2,067 riders in',
    verb: 'Log a fakie trick',
    isLive: true,
  },
  {
    id: 'sk-34',
    sport: 'skate',
    week: 'Week 34',
    title: 'Coping Week',
    blurb: 'Get to the top of the transition and stop there. Stalls, rocks, grinds.',
    starts: '2026-08-17',
    ends: '2026-08-23',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#246BFF',
    riders: 'Opens Monday',
    verb: 'Log a lip trick',
    isLive: true,
  },
  {
    id: 'sk-35',
    sport: 'skate',
    week: 'Week 35',
    title: 'Stair Count',
    blurb: 'One set of stairs, rolled away. Any size, and three is not braver than one.',
    starts: '2026-08-24',
    ends: '2026-08-30',
    goal: 1,
    reward: 'First Challenge sticker',
    hue: '#E0392B',
    riders: 'Opens in two weeks',
    verb: 'Log a set',
    isLive: true,
  },

  /* ------------------------------------------------------------------ BMX --
   * Authored here rather than transcribed: the design pack predates the
   * three-sport decision and contains no BMX material (plan §7, the BMX
   * track). Same six weeks as the other two sports, and the same shape — five
   * weeks asking for three logs, then a closing week that asks for one.
   *
   * Every week points at tricks that exist in the shipped BMX library
   * (`./tricks.ts`), so a rider reading "log a grind" has somewhere in the app
   * to go and find one.
   */
  {
    id: 'bx-30',
    sport: 'bmx',
    week: 'Week 30',
    title: 'Manual Metres',
    blurb: 'Front wheel up, no pedalling, keep rolling. Three that stayed up on their own.',
    starts: '2026-07-20',
    ends: '2026-07-26',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#FF9F1C',
    riders: '',
    verb: 'Log a manual',
    isLive: true,
  },
  {
    id: 'bx-31',
    sport: 'bmx',
    week: 'Week 31',
    title: 'Peg Week',
    blurb: 'Anything on the pegs. Double peg, feeble, icepick — three grinds you rode away from.',
    starts: '2026-07-27',
    ends: '2026-08-02',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#9CE05B',
    riders: '',
    verb: 'Log a grind',
    isLive: true,
  },
  {
    id: 'bx-32',
    sport: 'bmx',
    week: 'Week 32',
    title: 'Bar Week',
    blurb: 'Bars go round. Pull-up, off a hop, out of a 180. Three of them, any way you like.',
    starts: '2026-08-03',
    ends: '2026-08-09',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#8A3BE0',
    riders: '',
    verb: 'Log a barspin',
    isLive: true,
  },
  {
    id: 'bx-33',
    sport: 'bmx',
    week: 'Week 33',
    title: 'Fakie Week',
    blurb: 'Roll out backwards. Fakie off a bank, a nollie, a fakie 180. Three before Sunday.',
    starts: '2026-08-10',
    ends: '2026-08-16',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#3AC0FF',
    riders: '',
    verb: 'Log a fakie trick',
    isLive: true,
  },
  {
    id: 'bx-34',
    sport: 'bmx',
    week: 'Week 34',
    title: 'Pump Week',
    blurb: 'Get across the park without pedalling. Three lines that carried their own speed.',
    starts: '2026-08-17',
    ends: '2026-08-23',
    goal: 3,
    reward: 'First Challenge sticker',
    hue: '#FF5A1F',
    riders: '',
    verb: 'Log a pumped line',
    isLive: true,
  },
  {
    id: 'bx-35',
    sport: 'bmx',
    week: 'Week 35',
    title: 'Air Out',
    blurb: 'Both wheels above the coping, once. A quarter you already know beats one you do not.',
    starts: '2026-08-24',
    ends: '2026-08-30',
    goal: 1,
    reward: 'First Challenge sticker',
    hue: '#10A06A',
    riders: '',
    verb: 'Log an air',
    isLive: true,
  },
] as const satisfies readonly Challenge[];

/** Every seeded challenge id, as a union. */
export type ChallengeId = (typeof CHALLENGES)[number]['id'];
