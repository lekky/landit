import { describe, expect, it } from 'vitest';

import { ANGLES, angleForDate, pickCandidate, sportForDate } from './angles.mjs';
import { altFor, captionFor, composedAngles, tiktokTitleFor } from './caption.mjs';
import { spreadEvents, weekendOf } from './candidates.mjs';
import { cardHtml, drawnAngles } from './card.mjs';
import { PLATES } from './config.mjs';
import { confirm, daysSince, takenDates } from './queue.mjs';

/**
 * One fixture per angle, shaped exactly as `candidates.mjs` builds them. The
 * coverage tests below walk this map, so adding an angle without a caption, a
 * layout or a fixture fails here rather than on a live account.
 */
const FIXTURES = {
  'challenge-new': {
    angle: 'challenge-new',
    key: 'challenge:2026-09-14',
    subject: 'challenge',
    plate: 'challenge-new',
    data: {
      title: 'Half Turn',
      verb: 'Log a 180',
      goal: '3',
      starts: '2026-09-14',
      ends: '2026-09-27',
    },
  },
  'challenge-last-week': {
    angle: 'challenge-last-week',
    key: 'challenge-ending:2026-09-27',
    subject: 'challenge',
    plate: 'challenge-last-week',
    data: {
      title: 'Half Turn',
      verb: 'Log a 180',
      goal: '3',
      starts: '2026-09-14',
      ends: '2026-09-27',
    },
  },
  'trick-of-the-week': {
    angle: 'trick-of-the-week',
    key: 'trick:bunny-hop',
    subject: 'trick:bunny-hop',
    plate: 'trick-scooter',
    data: {
      name: 'Bunny Hop',
      slug: 'bunny-hop',
      sport: 'scooter',
      cat: 'flat',
      diff: '1',
      tips: 'Practice popping over a crack on flat ground first.',
    },
  },
  'spot-of-the-week': {
    angle: 'spot-of-the-week',
    key: 'spot:rampworx-liverpool',
    subject: 'town:UK/Liverpool',
    plate: 'spot-of-the-week',
    data: {
      name: 'Rampworx',
      slug: 'rampworx-liverpool',
      town: 'Liverpool',
      country: 'UK',
      type: 'Indoor park',
      tags: ['Foam pit', 'Bowl', 'Vert'],
      sports: ['scooter', 'skate', 'bmx'],
    },
  },
  'events-weekend': {
    angle: 'events-weekend',
    key: 'events:2026-09-11',
    subject: 'events',
    plate: 'events-weekend',
    data: {
      events: [
        {
          name: 'Graystone Clash',
          slug: 'graystone-clash',
          date: '2026-09-12',
          kind: 'Comp',
          town: 'Salford',
          country: 'UK',
          sports: ['scooter'],
        },
      ],
    },
  },
  'sticker-drop': {
    angle: 'sticker-drop',
    key: 'sticker:180',
    subject: 'trick:180',
    plate: 'sticker-drop',
    data: {
      name: '180',
      slug: '180',
      sport: 'bmx',
      stickerDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    },
  },
  feature: {
    angle: 'feature',
    key: 'feature:spots',
    subject: 'feature:spots',
    plate: 'did-you-know',
    data: {
      headline: 'Find a spot',
      line: 'Skateparks worldwide, on one map.',
      countLabel: '36,391 spots on the map',
    },
  },
};

describe('coverage', () => {
  it('every angle has a caption, a layout and a fixture', () => {
    expect([...composedAngles].sort()).toEqual([...ANGLES].sort());
    expect([...drawnAngles].sort()).toEqual([...ANGLES].sort());
    expect(Object.keys(FIXTURES).sort()).toEqual([...ANGLES].sort());
  });

  it('every fixture names a plate that exists', () => {
    for (const candidate of Object.values(FIXTURES)) {
      expect(PLATES[candidate.plate], candidate.angle).toBeDefined();
    }
  });
});

describe('angleForDate', () => {
  // 2026-09-14 is a Monday, 15th a Tuesday, and so on through the 20th.
  it('runs the week the owner asked for', () => {
    expect(angleForDate('2026-09-15')).toBe('trick-of-the-week');
    expect(angleForDate('2026-09-16')).toBe('spot-of-the-week');
    expect(angleForDate('2026-09-17')).toBe('events-weekend');
    expect(angleForDate('2026-09-18')).toBe('sticker-drop');
    expect(angleForDate('2026-09-19')).toBe('feature');
    expect(angleForDate('2026-09-20')).toBe('feature');
  });

  it('opens a fortnight on the Monday one starts', () => {
    const starting = [{ ends: '2026-09-27 00:00:00.000Z' }];
    expect(angleForDate('2026-09-14', { starting })).toBe('challenge-new');
  });

  it('says last week on the Monday in between', () => {
    const running = [{ ends: '2026-09-27 00:00:00.000Z' }];
    expect(angleForDate('2026-09-21', { running })).toBe('challenge-last-week');
  });

  it('falls back rather than posting an empty challenge', () => {
    expect(angleForDate('2026-09-14', { starting: [], running: [] })).toBe('feature');
  });
});

describe('sportForDate', () => {
  it('gives every sport a turn, and holds one for a whole week', () => {
    const week = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'].map(sportForDate);
    expect(new Set(week).size).toBe(1);
    const runs = ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'].map(sportForDate);
    expect(new Set(runs)).toEqual(new Set(['scooter', 'skate', 'bmx']));
  });
});

describe('pickCandidate', () => {
  const candidates = [
    { key: 'a', subject: 'a' },
    { key: 'b', subject: 'b' },
    { key: 'c', subject: 'c' },
  ];
  const empty = { posts: [] };

  it('is deterministic for a date', () => {
    const once = pickCandidate(candidates, { history: empty, date: '2026-09-14' });
    const twice = pickCandidate(candidates, { history: empty, date: '2026-09-14' });
    expect(once).toBe(twice);
  });

  it('will not repeat a key inside its cooldown', () => {
    const chosen = pickCandidate(candidates, { history: empty, date: '2026-09-14' });
    const history = { posts: [{ date: '2026-09-01', key: chosen.key, subject: chosen.subject }] };
    const next = pickCandidate(candidates, { history, date: '2026-09-14' });
    expect(next.key).not.toBe(chosen.key);
  });

  it('still posts when everything is on cooldown', () => {
    const history = {
      posts: candidates.map((candidate) => ({
        date: '2026-09-13',
        key: candidate.key,
        subject: candidate.subject,
      })),
    };
    expect(pickCandidate(candidates, { history, date: '2026-09-14' })).not.toBeNull();
  });

  it('returns null with nothing to choose from', () => {
    expect(pickCandidate([], { history: empty, date: '2026-09-14' })).toBeNull();
  });
});

describe('the weekend', () => {
  it('runs Friday to Sunday of that week', () => {
    expect(weekendOf('2026-09-17')).toEqual({ from: '2026-09-18', to: '2026-09-20' });
  });

  it('spreads events across countries before filling up', () => {
    const events = [
      { name: 'a', country: 'UK' },
      { name: 'b', country: 'UK' },
      { name: 'c', country: 'Brazil' },
      { name: 'd', country: 'Japan' },
    ];
    expect(spreadEvents(events, 3).map((event) => event.country)).toEqual([
      'UK',
      'Brazil',
      'Japan',
    ]);
  });

  it('fills from what is left when there are not enough countries', () => {
    const events = [
      { name: 'a', country: 'UK' },
      { name: 'b', country: 'UK' },
    ];
    expect(spreadEvents(events, 2).map((event) => event.name)).toEqual(['a', 'b']);
  });
});

describe('captions', () => {
  it('tags Facebook links and leaves the others clean', () => {
    const candidate = FIXTURES['trick-of-the-week'];
    expect(captionFor(candidate, 'facebook')).toContain('utm_source=facebook');
    expect(captionFor(candidate, 'instagram')).not.toContain('utm_');
    expect(captionFor(candidate, 'tiktok')).not.toContain('utm_');
  });

  it('keeps the TikTok title inside its limit', () => {
    for (const candidate of Object.values(FIXTURES)) {
      expect(tiktokTitleFor(candidate).length, candidate.angle).toBeLessThanOrEqual(90);
    }
  });

  it('writes alt text for every angle', () => {
    for (const candidate of Object.values(FIXTURES)) {
      expect(altFor(candidate).length, candidate.angle).toBeGreaterThan(20);
    }
  });

  it('links to the real page for the thing it is about', () => {
    expect(captionFor(FIXTURES['trick-of-the-week'], 'instagram')).toContain('/library/bunny-hop');
    expect(captionFor(FIXTURES['spot-of-the-week'], 'instagram')).toContain(
      '/spots/rampworx-liverpool',
    );
    expect(captionFor(FIXTURES['events-weekend'], 'instagram')).toContain('/events');
  });
});

describe('the card', () => {
  it('draws every angle onto its plate', () => {
    for (const candidate of Object.values(FIXTURES)) {
      const html = cardHtml(candidate, { plateUrl: 'file:///plate.jpg' });
      expect(html, candidate.angle).toContain('file:///plate.jpg');
      expect(html, candidate.angle).toContain('1080px');
    }
  });

  it('escapes what it prints, so a name with an ampersand cannot break the page', () => {
    const candidate = {
      ...FIXTURES['spot-of-the-week'],
      data: { ...FIXTURES['spot-of-the-week'].data, name: 'Ramps & <Rails>' },
    };
    const html = cardHtml(candidate, { plateUrl: 'file:///plate.jpg' });
    expect(html).toContain('Ramps &amp; &lt;Rails&gt;');
    expect(html).not.toContain('<Rails>');
  });

  it('keeps the text inside the plate’s clear band', () => {
    const html = cardHtml(FIXTURES['challenge-new'], { plateUrl: 'file:///plate.jpg' });
    const [top, bottom] = PLATES['challenge-new'].band;
    expect(html).toContain(`top:${top + 6}px`);
    expect(html).toContain(`height:${bottom - top - 12}px`);
  });
});

describe('the queue', () => {
  it('counts a date as taken whether it is queued or already sent', () => {
    const taken = takenDates(
      { posts: [{ date: '2026-09-14' }] },
      { posts: [{ date: '2026-09-13' }] },
    );
    expect([...taken].sort()).toEqual(['2026-09-13', '2026-09-14']);
  });

  it('measures a cooldown in days, and forever when never used', () => {
    const history = { posts: [{ date: '2026-09-04', key: 'trick:180' }] };
    expect(daysSince(history, 'key', 'trick:180', '2026-09-14')).toBe(10);
    expect(daysSince(history, 'key', 'trick:tailwhip', '2026-09-14')).toBe(Infinity);
  });

  it('confirms only the dates that landed, and leaves the rest queued', () => {
    const queue = {
      posts: [
        { date: '2026-09-14', angle: 'feature', key: 'a', subject: 'a' },
        { date: '2026-09-15', angle: 'feature', key: 'b', subject: 'b' },
      ],
    };
    const result = confirm(queue, { posts: [] }, ['2026-09-14']);
    expect(result.queue.posts.map((post) => post.date)).toEqual(['2026-09-15']);
    expect(result.history.posts).toEqual([
      { date: '2026-09-14', angle: 'feature', key: 'a', subject: 'a' },
    ]);
  });
});
