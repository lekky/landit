import type { Challenge } from '../types';

/**
 * One live challenge per sport at a time, running from 2026-07-20 to
 * 2027-01-03 — the design pack's six weeks
 * (`design-handoff/design/landit-data.js`) for scooter and skate, and
 * everything else authored here: the BMX half of those six, and the nine
 * fortnightly slots that carry all three sports to the new year.
 *
 * **The cadence is not uniform, and that is deliberate.** Weeks 30-35 ran
 * weekly because the pack transcribed them that way; everything after
 * 2026-08-31 runs fortnightly (see the section comment below). Nothing derives
 * a cadence — `challengeState` reads the dates it is given — so the two halves
 * coexist without a migration.
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
 *   could never grant. `challenger` ("Finish a challenge") is the one
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

  /* ------------------------------------- the rest of 2026, fortnightly slots --
   * The design pack stopped at week 35 (2026-08-30), which gave the shipped
   * schedule an expiry date eleven days after the site went live: past that
   * Sunday every sport's screen falls back to "the most recent finished one"
   * and shows a dead card, permanently, to real riders.
   *
   * **The cadence changes here, from weekly to fortnightly** (Rachid, in chat,
   * 2026-08-19). Nine slots of fourteen days carry all three sports to
   * 2027-01-03. Two things follow, and both are done in this file's PR rather
   * than left to be noticed later:
   *
   * - **The screen no longer says "weekly".** The eyebrow, the footer link and
   *   the `challenger` sticker's condition all said it, and all now say
   *   "challenge" instead — copy that stays true whatever the cadence becomes
   *   next, which is the point. `challengeRewardSticker` matches on the
   *   sticker's *name*, never its condition, so the reward still resolves.
   * - **`week` carries a range**, "Weeks 36-37", because the field is the
   *   card's label and a slot is no longer one week. The ISO numbering runs on
   *   unbroken from the shipped six.
   *
   * Rules the set keeps, all of them load-bearing:
   *
   * - **Contiguous slots, no overlaps and no gaps.** "One live challenge per
   *   sport" is a hook (`enforceNoChallengeOverlap`), not a column, so the seed
   *   has to be the first thing that respects it — and a *gap* passes that hook
   *   happily while still showing a rider a dead card, which is why
   *   `challenges.test.ts` now asserts the slots run back to back.
   * - **Every sport runs the same dates**, so no rider is between slots while
   *   another sport has one live.
   * - **Every slot names tricks that are in the shipped library** (./tricks.ts).
   * - **`riders` is empty**, for the reason the BMX weeks above give: the
   *   screen does not render it, and invented participation is a lie told to
   *   children.
   * - **Nothing dares anyone into anything.** The shipped copy says "three is
   *   not braver than one"; this half says "you'd be happy for someone to
   *   watch" and "taking the full two weeks to get it is the point".
   * - **No seasonal framing.** The product is global (the events list already
   *   reaches Perth, Sydney and Montevideo), so a slot that assumes dark
   *   October evenings is wrong for half the riders reading it. The last slot
   *   leans on the school holidays, which is as close to universal as this
   *   window gets — there is no riding observance in it at all, Go Skateboarding
   *   Day and Go Scoot Day both falling in June.
   */
  {
    id: 'sc-36',
    sport: 'scooter',
    week: 'Weeks 36-37',
    title: 'Hops Only',
    blurb:
      'Back to the first thing you ever learned. Three bunny hops that got both wheels properly off the floor.',
    starts: '2026-08-31',
    ends: '2026-09-13',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#246BFF',
    riders: '',
    verb: 'Log a bunny hop',
    isLive: true,
  },
  {
    id: 'sk-36',
    sport: 'skate',
    week: 'Weeks 36-37',
    title: 'Ollies Only',
    blurb: "The one everything else is built on. Three ollies you'd be happy for someone to watch.",
    starts: '2026-08-31',
    ends: '2026-09-13',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#246BFF',
    riders: '',
    verb: 'Log an ollie',
    isLive: true,
  },
  {
    id: 'bx-36',
    sport: 'bmx',
    week: 'Weeks 36-37',
    title: 'Hops Only',
    blurb: 'Both wheels up, no ramp and no kerb to help. Three bunny hops that cleared something.',
    starts: '2026-08-31',
    ends: '2026-09-13',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#246BFF',
    riders: '',
    verb: 'Log a bunny hop',
    isLive: true,
  },
  {
    id: 'sc-38',
    sport: 'scooter',
    week: 'Weeks 38-39',
    title: 'Half Turn',
    blurb:
      'Anything with a 180 in it. Off a kicker, off a kerb, or flat on the floor. Three of them.',
    starts: '2026-09-14',
    ends: '2026-09-27',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#FF9F1C',
    riders: '',
    verb: 'Log a 180',
    isLive: true,
  },
  {
    id: 'sk-38',
    sport: 'skate',
    week: 'Weeks 38-39',
    title: 'Half Turn',
    blurb:
      'Frontside, backside, fakie. Whichever way your shoulders already want to go, three of them.',
    starts: '2026-09-14',
    ends: '2026-09-27',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#FF9F1C',
    riders: '',
    verb: 'Log a 180',
    isLive: true,
  },
  {
    id: 'bx-38',
    sport: 'bmx',
    week: 'Weeks 38-39',
    title: 'Half Turn',
    blurb: 'Hop 180s, a 180 off a bank, a 180 out of a grind. Three you rolled away from.',
    starts: '2026-09-14',
    ends: '2026-09-27',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#FF9F1C',
    riders: '',
    verb: 'Log a 180',
    isLive: true,
  },
  {
    id: 'sc-40',
    sport: 'scooter',
    week: 'Weeks 40-41',
    title: 'Two In A Row',
    blurb: 'Two tricks, one run, no put down in between. Three lines like that over the fortnight.',
    starts: '2026-09-28',
    ends: '2026-10-11',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#9CE05B',
    riders: '',
    verb: 'Log a line',
    isLive: true,
  },
  {
    id: 'sk-40',
    sport: 'skate',
    week: 'Weeks 40-41',
    title: 'Two In A Row',
    blurb:
      "Any two tricks back to back without stopping. Three lines, and they don't have to be your hardest.",
    starts: '2026-09-28',
    ends: '2026-10-11',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#9CE05B',
    riders: '',
    verb: 'Log a line',
    isLive: true,
  },
  {
    id: 'bx-40',
    sport: 'bmx',
    week: 'Weeks 40-41',
    title: 'Two In A Row',
    blurb: 'Two tricks in one run, feet staying on the pedals. Three lines like that.',
    starts: '2026-09-28',
    ends: '2026-10-11',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#9CE05B',
    riders: '',
    verb: 'Log a line',
    isLive: true,
  },
  {
    id: 'sc-42',
    sport: 'scooter',
    week: 'Weeks 42-43',
    title: 'On The Kerb',
    blurb: 'Everything a kerb can be: a drop, a gap, a ledge, a 50-50. Three tricks on one.',
    starts: '2026-10-12',
    ends: '2026-10-25',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#8A3BE0',
    riders: '',
    verb: 'Log a kerb trick',
    isLive: true,
  },
  {
    id: 'sk-42',
    sport: 'skate',
    week: 'Weeks 42-43',
    title: 'On The Kerb',
    blurb: 'The cheapest obstacle there is. Boardslide it, ollie it, 50-50 it. Three.',
    starts: '2026-10-12',
    ends: '2026-10-25',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#8A3BE0',
    riders: '',
    verb: 'Log a kerb trick',
    isLive: true,
  },
  {
    id: 'bx-42',
    sport: 'bmx',
    week: 'Weeks 42-43',
    title: 'On The Kerb',
    blurb: 'Curb drops, hops up onto it, a double peg along the top. Three tricks on a kerb.',
    starts: '2026-10-12',
    ends: '2026-10-25',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#8A3BE0',
    riders: '',
    verb: 'Log a kerb trick',
    isLive: true,
  },
  {
    id: 'sc-44',
    sport: 'scooter',
    week: 'Weeks 44-45',
    title: 'Ride Together',
    blurb:
      'Four sessions where somebody else was there too. A mate, a sibling, whoever was at the park.',
    starts: '2026-10-26',
    ends: '2026-11-08',
    goal: 4,
    reward: 'Challenger sticker',
    hue: '#3AC0FF',
    riders: '',
    verb: 'Log a session',
    isLive: true,
  },
  {
    id: 'sk-44',
    sport: 'skate',
    week: 'Weeks 44-45',
    title: 'Ride Together',
    blurb:
      'Four sessions with company. Filming each other, pushing each other, or just sitting on the ledge talking.',
    starts: '2026-10-26',
    ends: '2026-11-08',
    goal: 4,
    reward: 'Challenger sticker',
    hue: '#3AC0FF',
    riders: '',
    verb: 'Log a session',
    isLive: true,
  },
  {
    id: 'bx-44',
    sport: 'bmx',
    week: 'Weeks 44-45',
    title: 'Ride Together',
    blurb: "Four sessions where you weren't on your own. Riding to the park with someone counts.",
    starts: '2026-10-26',
    ends: '2026-11-08',
    goal: 4,
    reward: 'Challenger sticker',
    hue: '#3AC0FF',
    riders: '',
    verb: 'Log a session',
    isLive: true,
  },
  {
    id: 'sc-46',
    sport: 'scooter',
    week: 'Weeks 46-47',
    title: 'Full Turn',
    blurb: 'All the way round, once. Off a kicker, off a bank, or flat. One is the whole thing.',
    starts: '2026-11-09',
    ends: '2026-11-22',
    goal: 1,
    reward: 'Challenger sticker',
    hue: '#FF5A1F',
    riders: '',
    verb: 'Log a 360',
    isLive: true,
  },
  {
    id: 'sk-46',
    sport: 'skate',
    week: 'Weeks 46-47',
    title: 'Full Turn',
    blurb:
      'Three-sixty anything: a 360 shuvit, a tre flip, a frontside 360 off a bank. Once is enough.',
    starts: '2026-11-09',
    ends: '2026-11-22',
    goal: 1,
    reward: 'Challenger sticker',
    hue: '#FF5A1F',
    riders: '',
    verb: 'Log a 360',
    isLive: true,
  },
  {
    id: 'bx-46',
    sport: 'bmx',
    week: 'Weeks 46-47',
    title: 'Full Turn',
    blurb:
      'A bunny hop 360 or a 360 off a ramp. One, and taking the full two weeks to get it is the point.',
    starts: '2026-11-09',
    ends: '2026-11-22',
    goal: 1,
    reward: 'Challenger sticker',
    hue: '#FF5A1F',
    riders: '',
    verb: 'Log a 360',
    isLive: true,
  },
  {
    id: 'sc-48',
    sport: 'scooter',
    week: 'Weeks 48-49',
    title: 'New Ground',
    blurb: "Take three tricks you already have and land them at a spot you don't usually ride.",
    starts: '2026-11-23',
    ends: '2026-12-06',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#10A06A',
    riders: '',
    verb: 'Log a trick somewhere new',
    isLive: true,
  },
  {
    id: 'sk-48',
    sport: 'skate',
    week: 'Weeks 48-49',
    title: 'New Ground',
    blurb:
      "Three tricks you already have, done somewhere you've never done them. A different park, a different ledge.",
    starts: '2026-11-23',
    ends: '2026-12-06',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#10A06A',
    riders: '',
    verb: 'Log a trick somewhere new',
    isLive: true,
  },
  {
    id: 'bx-48',
    sport: 'bmx',
    week: 'Weeks 48-49',
    title: 'New Ground',
    blurb: "Three tricks from your list, landed at a spot that isn't your usual one.",
    starts: '2026-11-23',
    ends: '2026-12-06',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#10A06A',
    riders: '',
    verb: 'Log a trick somewhere new',
    isLive: true,
  },
  {
    id: 'sc-50',
    sport: 'scooter',
    week: 'Weeks 50-51',
    title: 'The One You Keep Skipping',
    blurb:
      "There's a trick sitting on Learning in your list that has been there a while. Three sessions on that one, and nothing else.",
    starts: '2026-12-07',
    ends: '2026-12-20',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#E0392B',
    riders: '',
    verb: 'Log an attempt',
    isLive: true,
  },
  {
    id: 'sk-50',
    sport: 'skate',
    week: 'Weeks 50-51',
    title: 'The One You Keep Skipping',
    blurb:
      "Find the trick that has been on Learning the longest. Three sessions on it, and no new tricks until it's done.",
    starts: '2026-12-07',
    ends: '2026-12-20',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#E0392B',
    riders: '',
    verb: 'Log an attempt',
    isLive: true,
  },
  {
    id: 'bx-50',
    sport: 'bmx',
    week: 'Weeks 50-51',
    title: 'The One You Keep Skipping',
    blurb: "The one you've been putting off. Three sessions on it, however they go.",
    starts: '2026-12-07',
    ends: '2026-12-20',
    goal: 3,
    reward: 'Challenger sticker',
    hue: '#E0392B',
    riders: '',
    verb: 'Log an attempt',
    isLive: true,
  },
  {
    id: 'sc-52',
    sport: 'scooter',
    week: 'Weeks 52-53',
    title: 'Time Off',
    blurb:
      'Most of you are off over these two weeks. Five sessions, any length, any trick. Turning up is the whole challenge.',
    starts: '2026-12-21',
    ends: '2027-01-03',
    goal: 5,
    reward: 'Challenger sticker',
    hue: '#246BFF',
    riders: '',
    verb: 'Log a session',
    isLive: true,
  },
  {
    id: 'sk-52',
    sport: 'skate',
    week: 'Weeks 52-53',
    title: 'Time Off',
    blurb:
      'Five sessions across the holidays. They can be twenty minutes each. Getting out is the point.',
    starts: '2026-12-21',
    ends: '2027-01-03',
    goal: 5,
    reward: 'Challenger sticker',
    hue: '#246BFF',
    riders: '',
    verb: 'Log a session',
    isLive: true,
  },
  {
    id: 'bx-52',
    sport: 'bmx',
    week: 'Weeks 52-53',
    title: 'Time Off',
    blurb:
      'Five sessions over the fortnight, any length. No trick requirement, just ride five times.',
    starts: '2026-12-21',
    ends: '2027-01-03',
    goal: 5,
    reward: 'Challenger sticker',
    hue: '#246BFF',
    riders: '',
    verb: 'Log a session',
    isLive: true,
  },
] as const satisfies readonly Challenge[];

/** Every seeded challenge id, as a union. */
export type ChallengeId = (typeof CHALLENGES)[number]['id'];
