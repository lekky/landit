import { describe, expect, it } from 'vitest';

import type { Challenge, RiderSnapshot, StageId, Trick } from '../types';
import { computeSportStats, computeStats, sportsOf } from './stats';

const snapshot = (over: Partial<RiderSnapshot> = {}): RiderSnapshot => ({
  byId: {},
  sports: ['scooter', 'skate'],
  ...over,
});

const byId = (entries: Record<string, StageId>): Record<string, StageId> => entries;

describe('which sports a rider tracks', () => {
  it('falls back to scooter when the list is missing or empty', () => {
    expect(sportsOf({})).toEqual(['scooter']);
    expect(sportsOf({ sports: [] })).toEqual(['scooter']);
  });

  it('drops anything that is not a real sport', () => {
    // `bmx` used to be the fake value here. It is a real sport since T21, so
    // the test needs one that is genuinely not — otherwise it silently stops
    // testing anything (LESSONS §4).
    expect(sportsOf({ sports: ['skate', 'unicycle' as 'skate'] })).toEqual(['skate']);
  });

  it('keeps every real sport, BMX included', () => {
    expect(sportsOf({ sports: ['scooter', 'skate', 'bmx'] })).toEqual(['scooter', 'skate', 'bmx']);
  });
});

describe('stats for one sport', () => {
  it('counts each stage into its own bucket', () => {
    const stats = computeSportStats(
      snapshot({
        byId: byId({
          'bunny-hop': 'every',
          manual: 'most',
          'tic-tac': 'some',
          'x-up': 'trying',
          tailwhip: 'want',
        }),
      }),
      'scooter',
    );

    expect(stats.tracked).toBe(5);
    expect(stats.landed).toBe(3); // every + most + some
    expect(stats.mastered).toBe(1); // every
    expect(stats.working).toBe(1); // trying
    expect(stats.wanted).toBe(1); // want
  });

  it('ignores tricks from the other sport', () => {
    const state = snapshot({ byId: byId({ 'bunny-hop': 'every', 'sk-ollie': 'every' }) });
    expect(computeSportStats(state, 'scooter').landed).toBe(1);
    expect(computeSportStats(state, 'skate').landed).toBe(1);
    expect(computeSportStats(state, null).landed).toBe(2);
  });

  it('ignores ids that are not tricks at all', () => {
    const stats = computeSportStats(snapshot({ byId: byId({ 'not-a-trick': 'every' }) }), null);
    expect(stats.tracked).toBe(0);
    expect(stats.landed).toBe(0);
  });

  it('counts the library totals per sport', () => {
    expect(computeSportStats(snapshot(), 'scooter').total).toBe(30);
    expect(computeSportStats(snapshot(), 'skate').total).toBe(31);
    expect(computeSportStats(snapshot(), 'bmx').total).toBe(36);
    expect(computeSportStats(snapshot(), null).total).toBe(97);
  });

  it('reports landed as a rounded percentage of the tricks in scope', () => {
    const stats = computeSportStats(
      snapshot({ byId: byId({ 'bunny-hop': 'some', 'tic-tac': 'some', 'x-up': 'some' }) }),
      'scooter',
    );
    expect(stats.pct).toBe(10); // 3 of 30
  });

  it('counts landed difficulty-5 tricks separately', () => {
    const stats = computeSportStats(
      snapshot({ byId: byId({ backflip: 'some', 'bunny-hop': 'every' }) }),
      'scooter',
    );
    expect(stats.hardLanded).toBe(1);
  });

  it('tracks each category and marks one done only when it is complete', () => {
    const scooterFlat = ['bunny-hop', 'tic-tac', 'manual', 'fingerwhip', 'hippie-jump', 'x-up'];
    const partial = computeSportStats(
      snapshot({ byId: Object.fromEntries(scooterFlat.map((id) => [id, 'some' as StageId])) }),
      'scooter',
    );
    expect(partial.catTotal.flat).toBe(7);
    expect(partial.catCount.flat).toBe(6);
    expect(partial.catDone.flat).toBe(false);

    const complete = computeSportStats(
      snapshot({
        byId: Object.fromEntries(
          [...scooterFlat, 'nose-manual'].map((id) => [id, 'some' as StageId]),
        ),
      }),
      'scooter',
    );
    expect(complete.catDone.flat).toBe(true);
  });

  it('never calls an empty category done', () => {
    const library: Trick[] = [
      {
        id: 'only-flat',
        name: 'Only Flat',
        sport: 'scooter',
        cat: 'flat',
        diff: 1,
        pre: [],
        about: '',
        tips: '',
        fact: '',
        isLive: true,
      },
    ];
    const stats = computeSportStats(snapshot({ byId: byId({ 'only-flat': 'every' }) }), 'scooter', {
      tricks: library,
    });
    expect(stats.catDone.flat).toBe(true);
    expect(stats.catTotal.air).toBe(0);
    expect(stats.catDone.air).toBe(false);
  });

  it('reports both sports only once something is landed on each', () => {
    expect(
      computeSportStats(snapshot({ byId: byId({ 'bunny-hop': 'every' }) }), null).bothSports,
    ).toBe(false);
    expect(
      computeSportStats(
        snapshot({ byId: byId({ 'bunny-hop': 'every', 'sk-ollie': 'some' }) }),
        null,
      ).bothSports,
    ).toBe(true);
  });

  it('does not count "learning it on the other sport" as riding both', () => {
    const stats = computeSportStats(
      snapshot({ byId: byId({ 'bunny-hop': 'every', 'sk-ollie': 'trying' }) }),
      null,
    );
    expect(stats.bothSports).toBe(false);
  });

  it('leaves hidden tricks out of the total and out of the count', () => {
    const library: Trick[] = [
      {
        id: 'live-one',
        name: 'Live',
        sport: 'scooter',
        cat: 'flat',
        diff: 1,
        pre: [],
        about: '',
        tips: '',
        fact: '',
        isLive: true,
      },
      {
        id: 'pulled',
        name: 'Pulled',
        sport: 'scooter',
        cat: 'flat',
        diff: 1,
        pre: [],
        about: '',
        tips: '',
        fact: '',
        isLive: false,
      },
    ];
    const stats = computeSportStats(
      snapshot({ byId: byId({ 'live-one': 'some', pulled: 'every' }) }),
      'scooter',
      { tricks: library },
    );
    expect(stats.total).toBe(1);
    expect(stats.landed).toBe(1);
    expect(stats.pct).toBe(100);
  });

  it('counts finished challenges, scoped to the sport when asked', () => {
    const challenges: Challenge[] = [
      {
        id: 'sc-a',
        sport: 'scooter',
        week: 'Week 1',
        title: '',
        blurb: '',
        starts: '2026-01-01',
        ends: '2026-01-07',
        goal: 3,
        reward: '',
        hue: '#000',
        riders: '',
        verb: '',
        isLive: true,
      },
      {
        id: 'sk-a',
        sport: 'skate',
        week: 'Week 1',
        title: '',
        blurb: '',
        starts: '2026-01-01',
        ends: '2026-01-07',
        goal: 3,
        reward: '',
        hue: '#000',
        riders: '',
        verb: '',
        isLive: true,
      },
    ];
    const state = snapshot({ challengeLogged: { 'sc-a': 3, 'sk-a': 1 } });
    expect(computeSportStats(state, 'scooter', { challenges }).challenges).toBe(1);
    expect(computeSportStats(state, 'skate', { challenges }).challenges).toBe(0);
    expect(computeSportStats(state, null, { challenges }).challenges).toBe(1);
  });

  it('passes streak, clips and crew straight through', () => {
    const stats = computeSportStats(snapshot({ streak: 9, clips: 4, crew: true }), null);
    expect(stats.streak).toBe(9);
    expect(stats.clips).toBe(4);
    expect(stats.crew).toBe(true);
  });
});

describe('the full stats shape', () => {
  const state = snapshot({
    byId: byId({ 'bunny-hop': 'every', tailwhip: 'some', 'sk-ollie': 'most' }),
  });

  it('puts the selected sport at the top level', () => {
    const stats = computeStats(state, 'scooter');
    expect(stats.sport).toBe('scooter');
    expect(stats.landed).toBe(2);
  });

  it('always exposes each sport on its own', () => {
    const stats = computeStats(state, 'scooter');
    expect(stats.bySport.scooter.landed).toBe(2);
    expect(stats.bySport.skate.landed).toBe(1);
  });

  it('always exposes the combined totals, whichever sport is selected', () => {
    expect(computeStats(state, 'scooter').global.landed).toBe(3);
    expect(computeStats(state, 'skate').global.landed).toBe(3);
    expect(computeStats(state).global.landed).toBe(3);
  });

  it('makes global the same scope as the top level when no sport is selected', () => {
    const stats = computeStats(state);
    expect(stats.sport).toBeNull();
    expect(stats.global.landed).toBe(stats.landed);
  });

  it('carries the rider’s sports for sticker scoping', () => {
    expect(computeStats(snapshot({ sports: ['skate'] })).sports).toEqual(['skate']);
  });
});
