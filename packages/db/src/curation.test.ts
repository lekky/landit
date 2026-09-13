import { isTrickFree, TRICKS, type Trick } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { curationRows, curationWorksheetCsv, youtubeSearchUrl } from './curation';

/** A trick with only the fields the worksheet reads. */
function trick(over: Partial<Trick> & Pick<Trick, 'id' | 'name' | 'sport' | 'diff'>): Trick {
  return {
    cat: 'flat',
    pre: [],
    about: '',
    tips: '',
    fact: '',
    ...over,
  } as Trick;
}

describe('the running order', () => {
  it('covers the whole library once, and numbers it from 1', () => {
    const rows = curationRows();

    expect(rows).toHaveLength(TRICKS.length);
    expect(rows.map((row) => row.order)).toEqual(TRICKS.map((_, index) => index + 1));
    expect(new Set(rows.map((row) => row.slug)).size).toBe(TRICKS.length);
  });

  it('puts every free trick before every paid one', () => {
    // The only ordering rule the owner gave (#462): the 60 free tricks are the
    // pages a signed-out visitor and a search engine land on, and the panel
    // renders signed out, so they are worth the most per hour spent.
    const rows = curationRows();
    const lastFree = rows.findLastIndex((row) => row.tier === 'free');
    const firstPaid = rows.findIndex((row) => row.tier === 'paid');

    expect(lastFree).toBeLessThan(firstPaid);
    expect(rows.filter((row) => row.tier === 'free')).toHaveLength(
      TRICKS.filter(isTrickFree).length,
    );
  });

  it('reads the tier from the rule rather than from difficulty', () => {
    // `free` overrides `diff <= FREE_MAX_DIFF` either way, so a hard trick
    // pulled into the free tier has to sort into the free block with it.
    const rows = curationRows([
      trick({ id: 'gift', name: 'Gift', sport: 'skate', diff: 5, free: true }),
      trick({ id: 'held-back', name: 'Held Back', sport: 'skate', diff: 1, free: false }),
    ]);

    expect(rows.map((row) => [row.slug, row.tier])).toEqual([
      ['gift', 'free'],
      ['held-back', 'paid'],
    ]);
  });

  it('groups by sport and then climbs difficulty, so the sheet is stable across runs', () => {
    const rows = curationRows([
      trick({ id: 'b', name: 'B', sport: 'bmx', diff: 1 }),
      trick({ id: 'sk2', name: 'Zebra', sport: 'skate', diff: 1 }),
      trick({ id: 'sc', name: 'C', sport: 'scooter', diff: 2 }),
      trick({ id: 'sk1', name: 'Alpha', sport: 'skate', diff: 1 }),
      trick({ id: 'sk3', name: 'Aardvark', sport: 'skate', diff: 2 }),
    ]);

    // Canonical sport order (scooter, skate, BMX), then difficulty, then name.
    expect(rows.map((row) => row.slug)).toEqual(['sc', 'sk1', 'sk2', 'sk3', 'b']);
  });

  it('flags scooter as the low-yield sport and the other two as high', () => {
    // From T34's sample: skate 7 of 7, BMX 5 of 6, scooter 2 of 7 clean. The
    // hint is there so a curator knows when to stop looking (#464).
    const rows = curationRows();
    const outlook = (sport: string) =>
      new Set(rows.filter((row) => row.sport === sport).map((row) => row.outlook));

    expect(outlook('scooter')).toEqual(new Set(['low']));
    expect(outlook('skate')).toEqual(new Set(['high']));
    expect(outlook('bmx')).toEqual(new Set(['high']));
  });
});

describe('the searches', () => {
  it('names the sport, because our word is not always the riders word', () => {
    const [row] = curationRows([
      trick({ id: 'pole-tap', name: 'Pole Tap', sport: 'scooter', diff: 3 }),
    ]);
    expect(row).toBeDefined();

    expect(row?.search).toBe(youtubeSearchUrl('Pole Tap pro scooter tutorial'));
    expect(row?.searchChannels).toBe(
      youtubeSearchUrl('Pole Tap pro scooter tutorial Scooter Hut OR Alli Sports'),
    );
  });

  it('is a search page, never a video link', () => {
    // Load-bearing. Nothing in this repo may hand back a video a person has not
    // watched, so the worksheet can only ever point at a list of candidates.
    for (const row of curationRows()) {
      expect(row.search.startsWith('https://www.youtube.com/results?search_query=')).toBe(true);
      expect(row.searchChannels.startsWith('https://www.youtube.com/results?search_query=')).toBe(
        true,
      );
    }
  });

  it('escapes the query rather than pasting it into a URL', () => {
    // Spaces and `&` have to go; `encodeURIComponent` leaves an apostrophe
    // alone, which is correct and is why "Rock 'n' Roll" reads normally.
    expect(youtubeSearchUrl("Rock 'n' Roll skateboard tutorial")).toBe(
      "https://www.youtube.com/results?search_query=Rock%20'n'%20Roll%20skateboard%20tutorial",
    );
    expect(youtubeSearchUrl('Nose Manual & Out')).toBe(
      'https://www.youtube.com/results?search_query=Nose%20Manual%20%26%20Out',
    );
  });
});

describe('the CSV', () => {
  it('has a header and one line per trick, and ends with a newline', () => {
    const csv = curationWorksheetCsv();
    const lines = csv.trimEnd().split('\n');

    expect(csv.endsWith('\n')).toBe(true);
    expect(lines).toHaveLength(TRICKS.length + 1);
    expect(lines[0]).toBe(
      'order,done,tier,sport,difficulty,category,trick,slug,outlook,search,search_channels,tutorial_link,tutorial_title,tutorial_channel,notes',
    );
  });

  it('leaves the four columns a curator fills in empty', () => {
    // `tutorial_link`, `tutorial_title` and `tutorial_channel` are named for the
    // three fields in the staff portal. Nothing may pre-fill them.
    const [, first] = curationWorksheetCsv().trimEnd().split('\n');
    expect(first).toBeDefined();

    expect(first?.split(',').slice(-4)).toEqual(['', '', '', '']);
  });

  it('quotes a field that holds a comma or a quote, and doubles the quote', () => {
    const csv = curationWorksheetCsv([
      {
        order: 1,
        tier: 'free',
        sport: 'skate',
        difficulty: 1,
        category: 'Flat',
        trick: 'Heel, Toe',
        slug: 'heel-toe',
        outlook: 'high',
        search: 'https://example.test/?q=a"b',
        searchChannels: 'https://example.test/?q=plain',
      },
    ]);

    const [, row] = csv.trimEnd().split('\n');
    expect(row).toContain('"Heel, Toe"');
    expect(row).toContain('"https://example.test/?q=a""b"');
    expect(row).toContain('https://example.test/?q=plain');
  });

  it('does not quote an apostrophe, which every other trick name has', () => {
    const rock = curationRows().find((row) => row.trick.includes("'"));
    expect(rock).toBeDefined();

    const csv = curationWorksheetCsv(rock ? [rock] : []);
    expect(csv).toContain(`,${rock?.trick},`);
  });
});
