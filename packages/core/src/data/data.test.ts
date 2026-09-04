import { describe, expect, it } from 'vitest';

import { AVATARS, AVATAR_GROUPS } from './avatars';
import { CATEGORY_IDS, CATS, TIERS_LABEL, categoryLabel } from './categories';
import { CHALLENGES } from './challenges';
import { EVENTS } from './events';
import { PLAN, PLANS } from './plans';
import { DEFAULT_PRIVACY, GOALS, LEVELS, PRIVACY, STANCES } from './profile';
import { SPORTS, SPORT_IDS } from './sports';
import { SPOTS, SPOT_TYPES, type SpotType } from './spots';
import { SPOT_COUNTRY_BY_CODE } from '../rules/spots';
import { STAGES } from './stages';
import { AWARDS } from './awards';
import { STICKERS } from './stickers';
import { TRICKS, TRICK_PREREQS } from './tricks';
import { STICKER_RULES, resolveStickerRule } from '../rules/stickers';
import { challengesOverlap } from '../rules/challenges';
import { isTrickFree } from '../rules/tricks';
import type { Plan, Spot, Sticker } from '../types';

/**
 * The canonical arrays are `as const`, so an optional field is absent from the
 * literal type of the records that do not carry one. Widening to the record
 * type is what lets a test ask whether an optional field is set.
 */
const allStickers: readonly Sticker[] = STICKERS;
const allPlans: readonly Plan[] = PLANS;
const allSpots: readonly Spot[] = SPOTS;

/**
 * The canonical data is the single source for both the database seeds (T4) and
 * every fixture the rules are tested against. If it drifts from the design pack
 * or from the plan, both of those go wrong quietly — so it is checked here
 * rather than trusted.
 */

const ids = <T extends { id: string }>(records: readonly T[]): string[] => records.map((r) => r.id);

describe('the trick library', () => {
  it('holds all 97 tricks: 30 scooter, 31 skate and 36 BMX', () => {
    expect(TRICKS).toHaveLength(97);
    expect(TRICKS.filter((t) => t.sport === 'scooter')).toHaveLength(30);
    expect(TRICKS.filter((t) => t.sport === 'skate')).toHaveLength(31);
    expect(TRICKS.filter((t) => t.sport === 'bmx')).toHaveLength(36);
  });

  it('gives every sport a library, so none is a tab with nothing behind it', () => {
    // The count above is a fact about today. This is the invariant: a sport in
    // `SPORT_IDS` with no tricks would render an empty library, and T21 is the
    // task that would have shipped one.
    for (const sport of SPORT_IDS) {
      expect(TRICKS.filter((t) => t.sport === sport).length, sport).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    expect(new Set(ids(TRICKS)).size).toBe(TRICKS.length);
  });

  it('only uses known sports, categories and difficulties', () => {
    for (const trick of TRICKS) {
      expect(SPORT_IDS).toContain(trick.sport);
      expect(CATEGORY_IDS).toContain(trick.cat);
      expect(trick.diff).toBeGreaterThanOrEqual(1);
      expect(trick.diff).toBeLessThanOrEqual(TIERS_LABEL.length);
    }
  });

  it('gives every trick the lowdown, tips and a fact', () => {
    for (const trick of TRICKS) {
      expect(trick.about.length).toBeGreaterThan(20);
      expect(trick.tips.length).toBeGreaterThan(20);
      expect(trick.fact.length).toBeGreaterThan(20);
    }
  });

  it('points every prerequisite at a trick that exists', () => {
    const known = new Set(ids(TRICKS));
    for (const trick of TRICKS) {
      for (const prereq of trick.pre) expect(known).toContain(prereq);
    }
  });

  it('never crosses sports in a prerequisite', () => {
    const sportOf = new Map(TRICKS.map((t) => [t.id, t.sport]));
    for (const trick of TRICKS) {
      for (const prereq of trick.pre) expect(sportOf.get(prereq)).toBe(trick.sport);
    }
  });

  it('has no cycles, so every trick is reachable from a no-prerequisite start', () => {
    const byId = new Map(TRICKS.map((t) => [t.id, t]));
    const resolved = new Set<string>();
    // Repeatedly admit tricks whose prerequisites are all already admitted. A
    // cycle leaves at least one trick that can never be admitted.
    let grew = true;
    while (grew) {
      grew = false;
      for (const trick of TRICKS) {
        if (resolved.has(trick.id)) continue;
        if (trick.pre.every((p) => resolved.has(p))) {
          resolved.add(trick.id);
          grew = true;
        }
      }
    }
    expect([...byId.keys()].filter((id) => !resolved.has(id))).toEqual([]);
  });

  it('exports the prerequisite graph as seedable edges', () => {
    const expected = TRICKS.reduce((n, t) => n + t.pre.length, 0);
    expect(TRICK_PREREQS).toHaveLength(expected);
    for (const edge of TRICK_PREREQS) {
      expect(edge.trick).not.toBe(edge.prereq);
    }
  });

  it('ships every trick live', () => {
    expect(TRICKS.every((t) => t.isLive)).toBe(true);
  });
});

describe('sports, categories and stages', () => {
  it('names the three launch sports with their design colours', () => {
    expect(SPORT_IDS).toEqual(['scooter', 'skate', 'bmx']);
    expect(SPORTS.scooter.color).toBe('#FF5A1F');
    expect(SPORTS.skate.color).toBe('#246BFF');
    // `--pink`, confirmed by the owner on 2026-08-16 (plan §7, T21).
    expect(SPORTS.bmx.color).toBe('#FF3D78');
  });

  it('shows BMX riders "Flatground", where the other two sports say "Flat"', () => {
    // The id is shared and stays shared — only the word on the chip moves.
    expect(categoryLabel('flat')).toBe('Flat');
    expect(categoryLabel('flat', 'scooter')).toBe('Flat');
    expect(categoryLabel('flat', 'skate')).toBe('Flat');
    expect(categoryLabel('flat', 'bmx')).toBe('Flatground');

    // Not "Flatland": that is a separate BMX discipline on a different bike,
    // and this category does not hold it. The label avoids the word on purpose,
    // so a well-meaning "correction" back to it should fail here.
    expect(categoryLabel('flat', 'bmx')).not.toBe('Flatland');

    // Every other category reads the same to everyone.
    for (const sport of SPORT_IDS) {
      for (const cat of CATEGORY_IDS.filter((c) => c !== 'flat')) {
        expect(categoryLabel(cat, sport), `${cat}/${sport}`).toBe(CATS[cat].label);
      }
    }
  });

  it('has five categories and five named difficulty tiers', () => {
    expect(CATEGORY_IDS).toHaveLength(5);
    expect(TIERS_LABEL).toEqual(['Rookie', 'Easy', 'Spicy', 'Gnarly', 'Pro']);
  });

  it('has the five stages in order, want to every', () => {
    expect(ids(STAGES)).toEqual(['want', 'trying', 'some', 'most', 'every']);
    expect(STAGES.map((s) => s.pct)).toEqual([0, 25, 55, 80, 100]);
  });
});

describe('stickers', () => {
  it('holds the award set plus the retired legacy stickers, with unique ids', () => {
    // T24: 97 trick awards, 37 platform awards (one of them — `promoter` —
    // dormant), `supporter`, and the ten legacy stickers that retired rather
    // than mapping onto an award. Records retire, they are never removed: the
    // seed upserts and cannot delete (see `upside`).
    expect(AWARDS).toHaveLength(135);
    expect(STICKERS).toHaveLength(145);
    expect(new Set(ids(STICKERS)).size).toBe(STICKERS.length);
  });

  it('gives every live sticker a rule, so none can be permanently unearnable', () => {
    // `promoter` is the deliberate exception: dormant record, no rule, until
    // rider event submissions exist.
    for (const sticker of STICKERS) {
      if (!sticker.isLive) continue;
      expect(resolveStickerRule(sticker), sticker.id).toBeTypeOf('function');
    }
  });

  it('has no slug-keyed rule without a sticker record behind it', () => {
    const known = new Set(ids(STICKERS));
    for (const id of Object.keys(STICKER_RULES)) expect(known).toContain(id);
  });

  it('names a committed art file on every award, and on no legacy sticker', () => {
    for (const sticker of allStickers) {
      const isAward = AWARDS.some((a) => a.id === sticker.id);
      if (isAward) {
        // The web package asserts the file itself exists; here the name only.
        expect(sticker.img, sticker.id).toMatch(/^[a-z0-9-]+\.png$/);
        expect(sticker.img, sticker.id).toBe(`${sticker.id}.png`);
      } else {
        expect(sticker.img, sticker.id).toBeUndefined();
      }
    }
  });

  it('gives every trick in the library its own award, and points each at a real trick', () => {
    /*
     * The trick page draws this award where the design pack put a photo
     * placeholder, so a trick without one is a trick whose page has a hole in
     * it. T24 seeded exactly one per trick and this is the stop for the next
     * person who adds a trick to `tricks.ts` without adding its badge.
     *
     * Both directions: a trick with no award leaves a gap on screen, and an
     * award naming a trick that does not exist is a badge nothing can earn.
     */
    // Widened to `Sticker`, like the stars-and-rarity test below: the literal
    // union of 135 records has no common `kind` or `trick` to read.
    const allAwards: readonly Sticker[] = AWARDS;
    const trickAwards = allAwards.filter((a) => a.kind === 'trick');
    const trickIds = new Set(TRICKS.map((t) => t.id));

    const awarded = new Map<string, number>();
    for (const award of trickAwards) {
      expect(trickIds, award.id).toContain(award.trick);
      const slug = award.trick ?? '';
      awarded.set(slug, (awarded.get(slug) ?? 0) + 1);
    }
    for (const trick of TRICKS) expect(awarded.get(trick.id), trick.id).toBe(1);
  });

  it('keeps stars and rarity inside their scales', () => {
    const allAwards: readonly Sticker[] = AWARDS;
    for (const award of allAwards) {
      expect(award.stars, award.id).toBeGreaterThanOrEqual(0);
      expect(award.stars, award.id).toBeLessThanOrEqual(3);
      expect(['common', 'uncommon', 'rare', 'legendary'], award.id).toContain(award.rarity);
    }
  });

  it('scopes each sticker to a real sport, or to everything', () => {
    for (const sticker of STICKERS) {
      if (sticker.sport !== null) expect(SPORT_IDS).toContain(sticker.sport);
    }
    expect(STICKERS.filter((s) => s.sport === null).length).toBeGreaterThan(0);
  });

  it('keeps every threshold on the record, never in the rule', () => {
    // The rules read `n` off the sticker; a sticker that quotes a number in its
    // copy but has no `n` would be uneditable by staff.
    for (const sticker of allStickers) {
      if (sticker.n !== undefined) expect(sticker.n).toBeGreaterThan(0);
    }
  });
});

describe('plans (implementation plan §2.4)', () => {
  it('has exactly rookie, shredder and legend — the Crew Pass is gone', () => {
    expect(ids(PLANS)).toEqual(['rookie', 'shredder', 'legend']);
    expect(ids(PLANS)).not.toContain('crew');
  });

  it('prices Rookie free, Shredder £3.99/£39.99 and Legend £6.99/£69.99', () => {
    expect(PLAN.rookie.priceMonthlyPence).toBe(0);
    expect(PLAN.rookie.priceYearlyPence).toBe(0);
    expect(PLAN.shredder.priceMonthlyPence).toBe(399);
    expect(PLAN.shredder.priceYearlyPence).toBe(3999);
    expect(PLAN.legend.priceMonthlyPence).toBe(699);
    expect(PLAN.legend.priceYearlyPence).toBe(6999);
  });

  // `clipCapBytes` stopped being an entitlement on 2026-08-17 (plan §1, §6.6).
  // What is asserted now is not a vault size — it is that the three values stay
  // strictly ascending, because `listPlans` orders every plan-card surface by
  // this column and equal values would make the card order arbitrary. If a rank
  // column ever replaces it, delete this test with the field.
  it('keeps the dormant clipCapBytes values ascending, which is what orders the plan cards', () => {
    expect(PLAN.rookie.clipCapBytes).toBeLessThan(PLAN.shredder.clipCapBytes);
    expect(PLAN.shredder.clipCapBytes).toBeLessThan(PLAN.legend.clipCapBytes);
  });

  it('advertises no clip vault on any plan, and no video at all', () => {
    for (const plan of allPlans) {
      for (const line of [...plan.perks, ...plan.missing, plan.pitch]) {
        expect(line).not.toMatch(/vault|clip|\bGB\b/i);
      }
    }
  });

  it('unlocks the paid tiers on both paid plans and neither on Rookie', () => {
    expect(PLAN.rookie.unlocksPaidTricks).toBe(false);
    expect(PLAN.shredder.unlocksPaidTricks).toBe(true);
    expect(PLAN.legend.unlocksPaidTricks).toBe(true);
  });

  it('raises Shredder as the "Most riders" card, and only Shredder', () => {
    expect(allPlans.filter((p) => p.popular)).toHaveLength(1);
    expect(PLAN.shredder.popular).toBe(true);
  });

  it('never sells an achievement', () => {
    // Plan §2.4: stickers and stages are earned-only on every plan. Paid tiers
    // sell capacity, cosmetics and insight — never a milestone.
    const forbidden = /\bsticker(s)?\b|\bstage(s)?\b|\bachievement/i;
    for (const plan of PLANS) {
      if (plan.id === 'rookie') continue; // The free plan may mention the wall.
      for (const perk of plan.perks) expect(perk).not.toMatch(forbidden);
    }
  });

  /*
   * The four tests below pin the 2026-09-04 card rewrite (issue #286). They are
   * here for the reason `e2e/legal.spec.ts` pins the legal rewrite: none of
   * these sentences fails a build on its own, and every one of them was false
   * on a live paid page for months before anybody checked it against the
   * library (LESSONS §3a, "copy decisions get tests, or they get quietly
   * reverted").
   */

  const everyLine = (plan: Plan): readonly string[] => [...plan.perks, ...plan.missing, plan.pitch];

  it('describes the paywall as a spread, never as a tier line (issue #286)', () => {
    // The free tier is a hand-picked ten per sport, not "everything up to
    // Easy": four BMX difficulty-2 tricks are paid, and every sport has free
    // tricks above Easy. So a card that names a tier as the boundary is false
    // in one direction or the other, whichever side it is written from.
    //
    // Named phrasings rather than a clever regex, because the tier labels
    // collide with words the cards legitimately use — `Rookie` is also a plan
    // name ("Everything in Rookie"), `Easy` and `Pro` are also ordinary
    // adjectives. A pattern loose enough to catch the untruth catches those
    // too, and a test that has to be argued with gets deleted.
    const tierLine = TIERS_LABEL.join('|');
    const retired: readonly [string, RegExp][] = [
      [
        'a tier named as the boundary',
        new RegExp(`\\b(${tierLine})\\b[^.]{0,20}\\btiers?\\b`, 'i'),
      ],
      [
        'a tier named as the boundary',
        new RegExp(`\\btiers?\\b[^.]{0,20}\\b(${tierLine})\\b`, 'i'),
      ],
      ['"up to the … tier"', /\bup to the\b/i],
      ['"every Rookie and Easy trick"', new RegExp(`every (${tierLine}) and (${tierLine})`, 'i')],
      [
        'the paid tiers enumerated',
        new RegExp(`(${tierLine}), (${tierLine}) and (${tierLine})`, 'i'),
      ],
    ];
    for (const plan of allPlans) {
      for (const line of everyLine(plan)) {
        for (const [why, pattern] of retired) {
          expect(line, `${plan.id}: ${why}`).not.toMatch(pattern);
        }
      }
    }
  });

  it('never names a proper subset of the sports (issue #286)', () => {
    // "Scooter and skateboard libraries" and "Every trick, both sports" were
    // live on /plans for the whole of BMX's life. A card may name all three
    // sports or none; naming some of them tells a BMX rider the product is not
    // for them. Counted off SPORT_IDS so a fourth sport fails this too.
    for (const plan of allPlans) {
      for (const line of everyLine(plan)) {
        const named = SPORT_IDS.filter((id) =>
          new RegExp(`\\b${SPORTS[id].label}\\b`, 'i').test(line),
        );
        expect(named.length === 0 || named.length === SPORT_IDS.length).toBe(true);
        expect(line).not.toMatch(/\bboth (sports|libraries)\b/i);
      }
    }
  });

  it('promises exactly the number of free tricks the library actually holds', () => {
    // The one number the cards are allowed to quote, and this is what makes it
    // allowed (issue #10): it is per-sport, deliberate and asserted, so it
    // cannot drift the way a library count would. If `tricks.ts` moves off ten
    // in any sport, the copy is what needs rewriting — not this test.
    const FREE_PER_SPORT = 10;
    for (const id of SPORT_IDS) {
      const free = TRICKS.filter((t) => t.sport === id && isTrickFree(t));
      expect(free, `free tricks in ${id}`).toHaveLength(FREE_PER_SPORT);
    }

    const claim = PLAN.rookie.perks.filter((p) => /\bten\b/i.test(p));
    expect(claim).toHaveLength(1);
    expect(PLAN.rookie.pitch).toMatch(/\bten\b/i);
  });

  it('sells no avatar, because no avatar is gated on a plan', () => {
    // "Exclusive avatar drops" was a Legend perk until 2026-09-04 and nothing
    // in the product ever implemented it: AVATARS carries no plan field and no
    // caller filters by one, so every rider sees all of them. If exclusive
    // avatars are ever built, this test is the thing that says the copy may
    // come back.
    for (const avatar of AVATARS) expect(avatar).not.toHaveProperty('plan');
    for (const plan of allPlans) {
      for (const line of everyLine(plan)) expect(line).not.toMatch(/avatar/i);
    }
  });
});

describe('challenges', () => {
  // Counted off `SPORT_IDS`, not a literal pair: the two-sport version of this
  // was green for as long as BMX had no challenges at all (issue #80).
  //
  // The count itself is no longer a literal either. It was six because the
  // design pack transcribed six, and asserting six is asserting the schedule
  // never grows — which is how a schedule quietly acquires an expiry date. What
  // matters is that no sport is short of the others, so that is what is
  // asserted: same number of weeks everywhere, and at least the original six.
  it('holds the same number of challenges for every sport, with unique ids', () => {
    const perSport = SPORT_IDS.map((sport) => CHALLENGES.filter((c) => c.sport === sport).length);
    for (const [i, count] of perSport.entries()) {
      expect(count, SPORT_IDS[i]).toBe(perSport[0]);
      expect(count, SPORT_IDS[i]).toBeGreaterThanOrEqual(6);
    }
    expect(CHALLENGES).toHaveLength(SPORT_IDS.length * (perSport[0] ?? 0));
    expect(new Set(ids(CHALLENGES)).size).toBe(CHALLENGES.length);
  });

  it('runs each one over a sane, inclusive date range', () => {
    for (const challenge of CHALLENGES) {
      expect(challenge.starts).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(challenge.ends).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(challenge.starts <= challenge.ends).toBe(true);
      expect(challenge.goal).toBeGreaterThan(0);
    }
  });

  it('never schedules two overlapping weeks for the same sport', () => {
    // "One live challenge per sport" is a hook-enforced constraint (plan §3).
    // The seed data must not be the first thing to break it.
    for (const a of CHALLENGES) {
      for (const b of CHALLENGES) {
        expect(challengesOverlap(a, b)).toBe(false);
      }
    }
  });
});

describe('spots, events and profile options', () => {
  /*
   * The spots are researched real places (2026-08-18), so what is worth
   * asserting changed shape: a count proves nothing about a list that grows,
   * and the failures that matter now are a spot nobody can reach and a spot
   * that quietly replaces another.
   */
  it('seeds live spots that a rider could actually be sent to', () => {
    expect(SPOTS.length).toBeGreaterThanOrEqual(30);
    for (const spot of allSpots) {
      expect(spot.status).toBe('live');
      expect(spot.name.length).toBeGreaterThan(0);
      expect(spot.name.length).toBeLessThanOrEqual(80);
      expect(spot.town.length).toBeLessThanOrEqual(60);
      expect(SPOT_TYPES).toContain(spot.type as SpotType);

      /*
       * Tags may be empty, and that is a ruling rather than an oversight: a
       * good few councils publish no obstacle list at all, and a real park with
       * a verified coordinate belongs on the map more than a tidy field does.
       * The alternative was inventing features, which is the one thing this
       * data may not do. What is checked is that a tag, where present, is a
       * usable label.
       */
      expect(spot.tags.length).toBeLessThanOrEqual(4);
      for (const tag of spot.tags) {
        expect(tag.trim()).toBe(tag);
        expect(tag.length).toBeGreaterThan(0);
      }

      expect(Math.abs(spot.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(spot.lng)).toBeLessThanOrEqual(180);
      // Null island is what an unparsed coordinate looks like, and it is in the
      // Gulf of Guinea. No skatepark is at 0,0.
      expect(Math.abs(spot.lat) + Math.abs(spot.lng)).toBeGreaterThan(0);

      expect(spot.sports.length).toBeGreaterThan(0);
      for (const sport of spot.sports) expect(SPORT_IDS).toContain(sport);
    }
  });

  /*
   * `name` + `town` is the seed's natural key (`packages/db/src/seed.ts`), so
   * two spots sharing one is not a cosmetic duplicate: the second row
   * overwrites the first on every seed, and the park that loses is silently
   * absent from the map with nothing in any log to say so.
   */
  it('keeps every spot distinct by the key the seed matches on', () => {
    const keys = allSpots.map((spot) => `${spot.name}|${spot.town}`.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  /*
   * Three sports at launch (plan §1) — and a sport with no spots is a screen
   * that tells a rider there is nowhere to ride. The prototype's seven spots
   * had no BMX at all, which is exactly the hole this catches.
   */
  it('has somewhere to ride for every sport the product ships', () => {
    for (const sport of SPORT_IDS) {
      expect(allSpots.some((spot) => spot.sports.includes(sport))).toBe(true);
    }
  });

  /*
   * The contact fields are optional by design — a street spot has neither and a
   * council park rarely has a phone — but where one is present it has to fit
   * the column the migration made for it, or the seed fails at the database
   * with a message about a field width rather than about the spot.
   */
  /*
   * A country in the data with no code pointing at it is a rider whose own
   * parks never lead their list — the failure is silent on screen, so it is
   * caught here instead. See `SPOT_COUNTRY_BY_CODE`.
   */
  it('can route every country in the data back from a region code', () => {
    const reachable = new Set(Object.values(SPOT_COUNTRY_BY_CODE));
    for (const spot of allSpots) {
      if (spot.country !== undefined) expect(reachable).toContain(spot.country);
    }
  });

  it('keeps addresses and phone numbers inside their fields', () => {
    for (const spot of allSpots) {
      if (spot.address !== undefined) {
        expect(spot.address.length).toBeGreaterThan(0);
        expect(spot.address.length).toBeLessThanOrEqual(200);
      }
      if (spot.phone !== undefined) {
        expect(spot.phone.length).toBeLessThanOrEqual(40);
        // A number a rider can ring: digits, and the international prefix.
        expect(spot.phone).toMatch(/\d/);
      }
      if (spot.country !== undefined) expect(spot.country.length).toBeLessThanOrEqual(60);
    }
  });

  it('seeds a worldwide calendar, each event on a calendar day with a unique id', () => {
    // Not a fixed count. This list is researched and goes stale by existing, so
    // pinning it to a number would mean a failing test every time a staff member
    // adds a comp. What must hold is that it is not empty, that ids are unique
    // (they are the seed's natural key — a duplicate silently overwrites an
    // event) and that every date is a day the rules can compare.
    expect(EVENTS.length).toBeGreaterThan(0);
    expect(new Set(EVENTS.map((event) => event.id)).size).toBe(EVENTS.length);
    for (const event of EVENTS) {
      expect(event.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(event.id.length).toBeLessThanOrEqual(40);
      expect(event.sports.length).toBeGreaterThan(0);
    }
  });

  it('offers three stances, three privacy levels and four riding levels', () => {
    expect(ids(STANCES)).toEqual(['regular', 'goofy', 'switch']);
    expect(ids(PRIVACY)).toEqual(['public', 'members', 'private']);
    expect(LEVELS).toHaveLength(4);
  });

  it('starts a new account private (Children’s code standard 7, plan §6.4)', () => {
    // Not "anything but public": `members` opens a child's profile to every
    // signed-in stranger, and the privacy policy T5 shipped says in writing
    // that new accounts start private. Owner-authorised change from `members`
    // (Rachid, 2026-08-16) — changing it back is a decision, not a tidy-up.
    expect(DEFAULT_PRIVACY).toBe('private');
  });

  it('never advertises a privacy setting as the default in its own copy', () => {
    // LESSONS §4: the `members` blurb called itself the sensible default and
    // silently became wrong when the default moved. The copy describes what a
    // setting does; `DEFAULT_PRIVACY` is the only place that says which is default.
    for (const level of PRIVACY) {
      expect(level.blurb).not.toMatch(/default/i);
      expect(level.other).not.toMatch(/default/i);
    }
  });

  it('offers goals for both sports plus shared ones', () => {
    expect(GOALS.filter((g) => g.sport === null).length).toBeGreaterThan(0);
    expect(GOALS.filter((g) => g.sport === 'scooter').length).toBeGreaterThan(0);
    expect(GOALS.filter((g) => g.sport === 'skate').length).toBeGreaterThan(0);
  });
});

describe('avatars', () => {
  it('registers all 36 built-in avatars across three groups', () => {
    expect(AVATARS).toHaveLength(36);
    expect(new Set(ids(AVATARS)).size).toBe(AVATARS.length);
    expect(AVATAR_GROUPS.map((g) => g.id)).toEqual(['Lids', 'Heads', 'Kit']);
  });

  it('puts every avatar in a registered group', () => {
    const groups = new Set(AVATAR_GROUPS.map((g) => g.id));
    for (const avatar of AVATARS) expect(groups).toContain(avatar.group);
  });

  it('stores a bare PNG filename, not a path', () => {
    // `packages/core` must not know where the assets resolve to (plan §2.2).
    for (const avatar of AVATARS) {
      expect(avatar.file).toMatch(/^[a-z0-9-]+\.png$/);
      expect(avatar.file).not.toContain('/');
    }
  });
});
