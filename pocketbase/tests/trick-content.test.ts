import { describe, expect, it } from 'vitest';

import { call, ensureRecord, superuser } from './helpers';

/**
 * `tricks.mistakes` and `tricks.hard` exist, round-trip, and are held to the
 * content limits on every write path (T28).
 *
 * Two things this proves that nothing else can. The columns are asserted
 * over HTTP against the real migrations, for the reason `trick-supervise`
 * gives: the rules layer is handed live rows, and a field with no column
 * reads as nothing on every trick in the product. And the limits are
 * asserted as refusals from a **superuser** token, because the hook is a
 * model hook and the staff editor's own check is a courtesy — if the numbers
 * in `pocketbase/hooks/lib/landit.js` drift from `TRICK_CONTENT_LIMITS` in
 * `@landit/core`, this is the file that says so.
 */

const FIXTURE = {
  slug: 'fixture-content',
  name: 'Fixture Content',
  sport: 'skate',
  cat: 'flat',
  diff: 2,
  is_live: true,
};

const good = [
  { what: 'Leaning back on take-off.', fix: 'Keep your shoulders over the board as you pop.' },
  { what: 'Looking at your feet.', fix: 'Pick a spot ahead of you and keep your eyes on it.' },
  { what: 'Stiff landing.', fix: 'Bend your knees as the wheels touch down.' },
];

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

describe('tricks.mistakes and tricks.hard', () => {
  it('are fields on the collection', async () => {
    const token = await superuser();
    const result = await call<{ fields: { name: string; type: string }[] }>(
      'GET',
      '/api/collections/tricks',
      { token },
    );

    expect(result.status).toBe(200);
    const mistakes = result.body.fields.find((f) => f.name === 'mistakes');
    expect(mistakes, 'tricks has no `mistakes` field').toBeDefined();
    expect(mistakes?.type).toBe('json');
    const hard = result.body.fields.find((f) => f.name === 'hard');
    expect(hard, 'tricks has no `hard` field').toBeDefined();
    expect(hard?.type).toBe('text');
  });

  it('round-trip to a public reader as the shape the seed writes', async () => {
    const token = await superuser();
    const record = await ensureRecord('tricks', `slug = '${FIXTURE.slug}'`, FIXTURE);
    const saved = await call('PATCH', `/api/collections/tricks/records/${record.id}`, {
      token,
      body: { mistakes: good, hard: 'Easy because nothing leaves the ground.' },
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);

    // No token: the trick page reads the library through the public list rule.
    const rows = await call<{ items: { slug: string; mistakes: unknown; hard: string }[] }>(
      'GET',
      '/api/collections/tricks/records',
      { query: { filter: `slug = "${FIXTURE.slug}"`, perPage: '1' } },
    );
    expect(rows.status).toBe(200);
    expect(rows.body.items[0]?.mistakes).toEqual(good);
    expect(rows.body.items[0]?.hard).toBe('Easy because nothing leaves the ground.');
  });

  it('accepts a trick with neither written yet', async () => {
    const token = await superuser();
    const record = await ensureRecord('tricks', `slug = '${FIXTURE.slug}'`, FIXTURE);
    const cleared = await call('PATCH', `/api/collections/tricks/records/${record.id}`, {
      token,
      body: { mistakes: [], hard: '' },
    });
    expect(cleared.status, JSON.stringify(cleared.body)).toBe(200);
  });

  it('refuses each limit, even from a superuser', async () => {
    const token = await superuser();
    const record = await ensureRecord('tricks', `slug = '${FIXTURE.slug}'`, FIXTURE);
    const patch = (body: Record<string, unknown>) =>
      call<{ message?: string }>('PATCH', `/api/collections/tricks/records/${record.id}`, {
        token,
        body,
      });

    const cases: [string, Record<string, unknown>][] = [
      ['one mistake', { mistakes: good.slice(0, 1) }],
      ['two mistakes', { mistakes: good.slice(0, 2) }],
      ['five mistakes', { mistakes: [...good, good[0], good[1]] }],
      [
        'a what over 8 words',
        { mistakes: [...good.slice(0, 2), { what: `${words(9)}.`, fix: 'Fix.' }] },
      ],
      [
        'a what with no full stop',
        { mistakes: [...good.slice(0, 2), { what: 'No stop', fix: 'Fix.' }] },
      ],
      [
        'a fix over 20 words',
        { mistakes: [...good.slice(0, 2), { what: 'Short.', fix: words(21) }] },
      ],
      ['a mistake with no fix', { mistakes: [...good.slice(0, 2), { what: 'Short.', fix: '' }] }],
      ['a hard over 35 words', { hard: words(36) }],
      ['mistakes that are not a list', { mistakes: { what: 'Short.', fix: 'Fix.' } }],
    ];

    for (const [label, body] of cases) {
      const result = await patch(body);
      expect(result.status, label).toBe(400);
    }

    // And the edges of each limit are accepted, so the refusals above are the
    // rule and not an off-by-one.
    const edge = await patch({
      mistakes: [
        { what: `${words(7)}.`, fix: words(20) },
        { what: 'Two.', fix: 'Fix.' },
        { what: 'Three.', fix: 'Fix.' },
        { what: 'Four.', fix: 'Fix.' },
      ],
      hard: words(35),
    });
    expect(edge.status, JSON.stringify(edge.body)).toBe(200);
  });
});
