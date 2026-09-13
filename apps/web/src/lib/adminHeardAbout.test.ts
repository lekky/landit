import { HEARD_ABOUT, HEARD_ABOUT_IDS } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { PAID_SHARE_FLOOR, heardAboutLabel, heardAboutPanel } from '@/app/(app)/admin/view';

/**
 * The "How riders found us" panel (issue #323).
 *
 * Tested here rather than through the screen for the reason the app's
 * `vitest.config.ts` names: `view.ts` is a pure module, and the `@/` alias is
 * resolved so a test under `src/lib/` can reach one that lives elsewhere in the
 * tree. This is not a component test — nothing below renders anything.
 *
 * Two of the three properties asserted are privacy decisions rather than
 * presentation, which is why they are worth a test at all. A staff screen that
 * quietly started printing a paid split for an option one child picked would
 * look exactly like this one.
 */

/** Nobody answered anything, as a starting point to vary one option from. */
const empty = {
  total: 0,
  answered: 0,
  byOption: Object.fromEntries(HEARD_ABOUT_IDS.map((id) => [id, 0])),
  paidByOption: Object.fromEntries(HEARD_ABOUT_IDS.map((id) => [id, 0])),
};

describe('the bars', () => {
  it('draws every option, including the ones nobody picked', () => {
    // "Nothing came from TikTok" is a finding. A chart that dropped the empty
    // bars would read as though the option had never been offered.
    const panel = heardAboutPanel({ ...empty, total: 10, answered: 1, byOption: { friend: 1 } });

    expect(panel.bars).toHaveLength(HEARD_ABOUT.length);
    expect(panel.bars.map((bar) => bar.label)).toEqual(HEARD_ABOUT.map((o) => o.label));
    expect(panel.bars.find((bar) => bar.label === HEARD_ABOUT[0]!.label)?.count).toBe(1);
  });

  it('is drawn against the riders who answered, not against every rider', () => {
    // The question is asked once, at the end of onboarding, so every account
    // older than it will never be asked. Dividing by everyone would draw nine
    // slivers beside a giant unanswered bar and report the rollout rather than
    // the channels.
    const panel = heardAboutPanel({ ...empty, total: 900, answered: 3, byOption: { friend: 3 } });

    expect(panel.of).toBe(3);
  });
});

describe('the paid split, and when it is withheld', () => {
  it('is shown once an option has enough riders in it', () => {
    const panel = heardAboutPanel({
      ...empty,
      total: PAID_SHARE_FLOOR,
      answered: PAID_SHARE_FLOOR,
      byOption: { friend: PAID_SHARE_FLOOR },
      paidByOption: { friend: 4 },
    });

    expect(panel.bars.find((bar) => bar.label === HEARD_ABOUT[0]!.label)?.sub).toBe(
      '4 on a paid plan',
    );
  });

  it('is absent below the floor, rather than printed as a zero', () => {
    // The distinction the whole floor rests on. "0 on a paid plan" would report
    // a suppression as a finding, and on a young product every option sits
    // below the floor for weeks.
    const panel = heardAboutPanel({
      ...empty,
      total: PAID_SHARE_FLOOR - 1,
      answered: PAID_SHARE_FLOOR - 1,
      byOption: { friend: PAID_SHARE_FLOOR - 1 },
      paidByOption: { friend: PAID_SHARE_FLOOR - 1 },
    });

    const bar = panel.bars.find((b) => b.label === HEARD_ABOUT[0]!.label);
    expect(bar?.count).toBe(PAID_SHARE_FLOOR - 1);
    expect(bar?.sub).toBeUndefined();
  });

  it('withholds the split from the single rider who could be identified by it', () => {
    // The case the owner set the floor for: one rider, on a paid plan, from one
    // channel — two facts about one child, beside a Riders tab that lists them.
    const panel = heardAboutPanel({
      ...empty,
      total: 40,
      answered: 1,
      byOption: { tiktok: 1 },
      paidByOption: { tiktok: 1 },
    });

    for (const bar of panel.bars) expect(bar.sub).toBeUndefined();
  });
});

describe('the note under the panel', () => {
  it('says plainly that nobody has answered, before anybody has', () => {
    const panel = heardAboutPanel(empty);

    expect(panel.note).toMatch(/Nobody has answered yet/);
    // The reason matters more than the number: staff reading an empty chart
    // should not conclude the feature is broken.
    expect(panel.note).toMatch(/only accounts made since then/);
  });

  it('says what the shares are of, and that older accounts were never asked', () => {
    const panel = heardAboutPanel({ ...empty, total: 100, answered: 20, byOption: { friend: 20 } });

    expect(panel.note).toMatch(/Shares are of the 20 riders who have answered/);
    expect(panel.note).toMatch(/80 riders have not/);
    expect(panel.note).toContain(`at least ${PAID_SHARE_FLOOR} riders`);
  });

  it('counts one rider in words, not as "1 riders"', () => {
    const one = heardAboutPanel({ ...empty, total: 2, answered: 1, byOption: { friend: 1 } });

    expect(one.note).toMatch(/1 rider who has answered/);
    expect(one.note).toMatch(/1 rider has not/);
  });
});

/**
 * The same answer for one rider, on the staff sheet (`riders/RiderSheet.tsx`).
 *
 * The panel above reports channels; this reports the account in front of you.
 * Worth its own tests for one reason: every case below is a value the sheet must
 * not print raw. A staff screen that rendered `tiktok`, or `undefined`, beside a
 * child's email address would look exactly like a working one.
 */
describe('one rider\u2019s answer on the sheet', () => {
  it('resolves an id to the label the rider picked from, not the stored word', () => {
    // `friend` is a storage word; the rider chose a sentence. Staff should read
    // the sentence, so the two of them are looking at the same wording.
    for (const option of HEARD_ABOUT) {
      expect(heardAboutLabel(option.id)).toBe(option.label);
    }
  });

  it('never leaks a raw id', () => {
    // The property that matters more than any single mapping above: whatever
    // this returns, it came from the catalogue.
    const labels = HEARD_ABOUT.map((o) => o.label);
    for (const id of HEARD_ABOUT_IDS) expect(labels).toContain(heardAboutLabel(id));
  });

  it('gives an em dash for a rider with no answer held', () => {
    // Three different causes, one meaning: skipped, an account older than the
    // question, or a closed account whose field `erasure.js` cleared. None of
    // them is worth a separate wording on a staff screen.
    expect(heardAboutLabel('')).toBe('\u2014');
    expect(heardAboutLabel(null)).toBe('\u2014');
    expect(heardAboutLabel(undefined)).toBe('\u2014');
  });

  it('gives an em dash for an id it does not recognise, rather than printing it', () => {
    // Same contract as `bandLabel`. If an option were ever removed from the
    // catalogue while rows still carried it, the sheet says "nothing held" —
    // it does not print a bare `myspace` next to a child's email address.
    expect(heardAboutLabel('myspace')).toBe('\u2014');
    expect(heardAboutLabel('FRIEND')).toBe('\u2014');
  });
});
