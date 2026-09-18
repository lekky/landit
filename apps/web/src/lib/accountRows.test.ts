import type { UsersRecord } from '@landit/db';
import { describe, expect, it } from 'vitest';

import { settingsRowsFor } from '@/app/(app)/account/rows';

/**
 * Which rows a rider's account list has, and what each one says it holds.
 *
 * Under `src/lib/` with the `@/` alias, for the reason `nav.test.ts` gives and
 * on the same terms: `rows.ts` is a function of a record and a boolean that
 * returns an array of strings, with no JSX, no state and nothing to render. It
 * is not a screen tested twice — the screens are in `e2e/account.spec.ts`.
 *
 * Two of the eight rows are conditional, and **neither condition is reachable
 * from the browser suite**: the e2e server runs with `LANDIT_SESSIONS_OPEN=1`,
 * so every rider there is inside the sessions preview, and a rider's consent
 * state is set at sign-up from a date of birth. So the four combinations are
 * asserted here, where a record is just an object.
 *
 * The other thing this file pins is the rule the list is written to: **every
 * sub-line is a catalogue fact**. A settings list is the screen most often read
 * over a child's shoulder, and the one value on it that a rider could have
 * typed — the written goal — is deliberately not on any row.
 */

/**
 * The smallest record the rows read. `as` because a real one has fifty fields.
 *
 * The overrides are a loose map rather than `Partial<UsersRecord>`, because two
 * of the states worth testing are ones the generated union cannot express: an
 * unset stance and an unset level are both stored as the empty string, which is
 * what the field holds for every rider who skipped the question at onboarding
 * (issue #134, and the same gap `saveProfileAction` asserts past).
 */
function rider(over: Record<string, unknown> = {}): UsersRecord {
  return {
    id: 'r1',
    name: 'Nia Okafor',
    handle: 'nia',
    sports: ['scooter'],
    level: 'solid',
    stance: 'regular',
    goal: 'custom',
    goal_custom: 'Land a bri flip before the summer holidays',
    privacy: 'private',
    plan: 'rookie',
    consent_state: 'not_required',
    ...over,
  } as unknown as UsersRecord;
}

const idsOf = (over: Record<string, unknown> = {}, sessionsEnabled = false) =>
  settingsRowsFor(rider(over), { sessionsEnabled }).map((row) => row.id);

describe('the account list', () => {
  it('is six rows for the ordinary rider — no sessions preview, no consent gate', () => {
    expect(idsOf()).toEqual(['profile', 'sports', 'privacy', 'plans', 'coach', 'data']);
  });

  it('adds "Who sees new sessions" only inside the preview', () => {
    expect(idsOf({}, true)).toContain('sessions');
    expect(idsOf({}, false)).not.toContain('sessions');
  });

  it('adds "Your guardian" only while the gate applies, and says which way', () => {
    const value = (state: string) =>
      settingsRowsFor(rider({ consent_state: state }), {
        sessionsEnabled: false,
      }).find((row) => row.id === 'guardian')?.value;

    expect(value('pending')).toBe('Waiting on a grown-up');
    expect(value('revoked')).toBe('Approval withdrawn');
    // Nothing to ask and nothing to withdraw: the panel behind the row is
    // written to a rider waiting or told no, and has nothing to say to these.
    expect(value('granted')).toBeUndefined();
    expect(value('not_required')).toBeUndefined();
  });

  it('puts the gate first, where the panel it replaces used to be', () => {
    // A rider waiting on a grown-up has one thing to do on this screen, and the
    // old `/account` led with it. Fifth in the list put it below the fold on a
    // 390px phone, behind the bottom bar.
    expect(idsOf({ consent_state: 'pending' }, true)).toEqual([
      'guardian',
      'profile',
      'sports',
      'privacy',
      'sessions',
      'plans',
      'coach',
      'data',
    ]);
  });
});

describe('every sub-line is a catalogue fact', () => {
  it('never prints the goal a rider wrote', () => {
    const written = 'Land a bri flip before the summer holidays';
    for (const row of settingsRowsFor(rider(), { sessionsEnabled: true })) {
      expect(row.value).not.toContain(written);
    }
  });

  it('never prints the rider’s name or handle', () => {
    for (const row of settingsRowsFor(rider(), { sessionsEnabled: true })) {
      expect(row.value).not.toContain('Nia');
      expect(row.value).not.toContain('nia');
    }
  });

  it('says what each setting is currently on, in the catalogue’s own words', () => {
    const rows = settingsRowsFor(
      rider({
        sports: ['scooter', 'bmx'],
        level: 'solid',
        stance: 'goofy',
        privacy: 'members',
        session_visibility_default: 'members',
        plan: 'shredder',
      }),
      { sessionsEnabled: true },
    );
    const value = (id: string) => rows.find((row) => row.id === id)?.value;

    expect(value('sports')).toBe('Scooter · BMX');
    expect(value('profile')).toBe('Park regular · Goofy');
    expect(value('privacy')).toBe('Riders only');
    expect(value('sessions')).toBe('Crew');
    expect(value('plans')).toBe('Shredder');

    // Short enough to finish inside a 340px rail rather than be clipped.
    for (const row of rows) expect(row.value.length).toBeLessThanOrEqual(38);
  });

  it('falls back to what the screen holds rather than to a blank line', () => {
    expect(
      settingsRowsFor(rider({ level: '', stance: '' }), {
        sessionsEnabled: false,
      }).find((row) => row.id === 'profile')?.value,
    ).toBe('Your picture, goal, stance and level');
  });
});
