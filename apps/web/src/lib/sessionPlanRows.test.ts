import {
  PLANS,
  ROOKIE_SESSIONS_PER_MONTH,
  sessionAllowance,
  sessionClipAllowance,
  sessionClipAllowanceLabel,
  sessionsPerMonthLabel,
} from '@landit/core';
import { describe, expect, it } from 'vitest';

import { sessionCardPerks, sessionPlanComparison, type SessionPlanInput } from './sessionPlanRows';

/** The three launch plans as the page resolves them from their records. */
const launch: SessionPlanInput[] = PLANS.map((plan) => ({
  slug: plan.id,
  name: plan.name,
  hue: plan.hue,
  price: plan.priceMonthlyPence ? `£${(plan.priceMonthlyPence / 100).toFixed(2)} / mo` : 'Free',
  sessions: sessionAllowance(plan),
  clips: sessionClipAllowance(plan),
}));

const row = (plans: readonly SessionPlanInput[], id: string) => {
  const found = sessionPlanComparison(plans).rows.find((r) => r.id === id);
  if (!found) throw new Error(`no ${id} row`);
  return found;
};

describe('sessionPlanComparison', () => {
  it('keeps the design’s rows, in the design’s order', () => {
    expect(sessionPlanComparison(launch).rows.map((r) => r.label)).toEqual([
      'Sessions logged',
      'Spot, event, tricks, notes',
      'Clip links',
      'History you can open',
      'Stage moves from a session',
    ]);
  });

  it('has one cell per plan in every row, in the order the plans came', () => {
    const { columns, rows } = sessionPlanComparison(launch);
    expect(columns.map((c) => c.slug)).toEqual(['rookie', 'shredder', 'legend']);
    for (const r of rows) expect(r.cells).toHaveLength(launch.length);
  });

  it('renders the monthly allowance from the plan, never a typed number', () => {
    // The launch figures, as they read today…
    expect(row(launch, 'sessions').cells.map((c) => c.text)).toEqual([
      sessionsPerMonthLabel({ cap: ROOKIE_SESSIONS_PER_MONTH, unlimited: false }),
      'Unlimited',
      'Unlimited',
    ]);
    expect(row(launch, 'sessions').cells[0]!.text).toBe('Four a month');

    // …and the proof it is rendered: retune the record and the cell follows.
    const retuned = launch.map((p) =>
      p.slug === 'rookie' ? { ...p, sessions: { cap: 6, unlimited: false } } : p,
    );
    expect(row(retuned, 'sessions').cells[0]!.text).toBe('Six a month');
  });

  it('says "None" for a plan with no clip links, and the derived label otherwise', () => {
    const cells = row(launch, 'clips').cells;
    expect(cells[0]).toEqual({ text: 'None', phoneText: 'None', tone: 'muted' });
    expect(cells[1]!.text).toBe(sessionClipAllowanceLabel(launch[1]!.clips));
    expect(cells[2]!.text).toBe('Unlimited clip links');

    const retuned = launch.map((p) =>
      p.slug === 'shredder' ? { ...p, clips: { cap: 3, unlimited: false } } : p,
    );
    expect(row(retuned, 'clips').cells[1]!.text).toBe('3 clip links');
  });

  it('fails closed: a plan whose record grants nothing reads as nothing', () => {
    const empty = { cap: 0, unlimited: false };
    const bare = [{ ...launch[0]!, sessions: empty, clips: empty }];
    expect(row(bare, 'sessions').cells[0]).toMatchObject({ text: 'None', tone: 'muted' });
    expect(row(bare, 'clips').cells[0]).toMatchObject({ text: 'None', tone: 'muted' });
  });

  it('moves a stage on every plan, because a stage is never for sale (plan §1)', () => {
    for (const cell of row(launch, 'stage_moves').cells) {
      expect(cell).toEqual({ text: 'Always', phoneText: 'Always', tone: 'always' });
    }
  });

  it('gives the detail and the history to every plan', () => {
    for (const cell of row(launch, 'detail').cells) {
      expect(cell.text).toBe('Yes');
      expect(cell.phoneText).toBe('Spot, event, tricks, aim, notes');
    }
    for (const cell of row(launch, 'history').cells) expect(cell.text).toBe('All of it');
  });

  it('sells no feature nothing builds: there is no insights row', () => {
    // The design's Legend cell ("Best days, best length, spots that move you
    // up") describes analysis no code computes. If it is ever built, this is
    // the test that says the row may come back.
    const { rows } = sessionPlanComparison(launch);
    for (const r of rows) {
      expect(r.label).not.toMatch(/insight/i);
      for (const cell of r.cells) expect(cell.text).not.toMatch(/best days|best length/i);
    }
  });
});

describe('sessionCardPerks', () => {
  const rookie = sessionAllowance(PLANS[0]!);
  const shredder = sessionAllowance(PLANS[1]!);

  it('names the number and the noun, because a card bullet is read alone', () => {
    // The comparison table can say "Four a month" under a "Sessions logged"
    // header. A card bullet has no header, so the noun has to be in the line.
    expect(sessionCardPerks(rookie)).toEqual(['Four sessions a month']);
    expect(sessionCardPerks(shredder)).toEqual(['Unlimited sessions']);
  });

  it('renders the number from the record, so a staff retune moves the card', () => {
    // The whole reason this is derived rather than written into the `plans`
    // row: a literal on a row is one retune away from advertising a cap the
    // hook does not enforce, on the page with the live checkout behind it.
    expect(sessionCardPerks({ cap: 6, unlimited: false })).toEqual(['Six sessions a month']);
    expect(sessionCardPerks({ cap: 1, unlimited: false })).toEqual(['One session a month']);
  });

  it('carries no line at all for a plan that grants no sessions', () => {
    // Fail closed. A card lists what a plan *gives*; a perk reading "None" is
    // not a perk, and a record granting nothing must advertise nothing.
    expect(sessionCardPerks({ cap: 0, unlimited: false })).toEqual([]);
  });

  it('never says "clip", "vault", "upload" or a byte figure (plan §6.6)', () => {
    // The rule `data.test.ts` and `video.test.ts` hold for the perks in
    // `@landit/core`, restated here because this is now the other place a perk
    // line can come from. We hold a link; nothing on a card may suggest we hold
    // the video. The clip allowance stays in the comparison table, under a
    // header that gives it the context a lone bullet cannot.
    const lines = [
      ...sessionCardPerks(rookie),
      ...sessionCardPerks(shredder),
      ...sessionCardPerks({ cap: 3, unlimited: false }),
      ...sessionCardPerks({ cap: 0, unlimited: true }),
    ];
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).not.toMatch(/vault|clip|\bGB\b|upload/i);
  });

  it('sells no achievement, on any allowance (plan §1)', () => {
    for (const line of [...sessionCardPerks(rookie), ...sessionCardPerks(shredder)]) {
      expect(line).not.toMatch(/\bsticker(s)?\b|\bstage(s)?\b|\bachievement/i);
    }
  });
});
