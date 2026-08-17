import { describe, expect, it } from 'vitest';

import {
  CONSENT_LIMITED_ALLOWS,
  CONSENT_LIMITED_DENIES,
  EEA_LOWERED_CONSENT_AGES,
  advanceBand,
  ageOn,
  approvalExpired,
  bandForAge,
  birthdayOn,
  canWhileConsentLimited,
  canWithConsent,
  consentAge,
  consentLapsesOn,
  consentRequired,
  countryOf,
  declareAge,
  initialConsentState,
  isConsentLimited,
  refreshConsent,
  signupOutcome,
  type RiderCapability,
} from './consent';

describe('the threshold table (plan §6.3)', () => {
  it('is 13 in the UK', () => {
    expect(consentAge('GB')).toBe(13);
    expect(consentAge('GB-ENG')).toBe(13);
  });

  it('is 16 across the EEA', () => {
    expect(consentAge('DE')).toBe(16);
    expect(consentAge('FR')).toBe(16);
    expect(consentAge('IE')).toBe(16);
    expect(consentAge('NO')).toBe(16);
    expect(consentAge('IS')).toBe(16);
  });

  it('is 13 everywhere else', () => {
    expect(consentAge('US')).toBe(13);
    expect(consentAge('AU')).toBe(13);
    expect(consentAge('BR')).toBe(13);
  });

  it('falls safe on a country it does not know', () => {
    // Not an exemption: an unknown, empty or malformed country gets the default
    // rather than no threshold at all.
    expect(consentAge('')).toBe(13);
    expect(consentAge('ZZ')).toBe(13);
    expect(consentAge(undefined as unknown as string)).toBe(13);
  });

  it('ships the lowered-country table empty, pending counsel', () => {
    // §6.3 admits an entry only with a cited source, and that question is open.
    // Empty means every EEA rider under 16 is asked — the fail-safe direction.
    expect(Object.keys(EEA_LOWERED_CONSENT_AGES)).toHaveLength(0);
  });

  it('honours an entry that lowers, and clamps one that raises', () => {
    // The table "only ever lowers, never raises" (§6.3). A lowered entry works;
    // an entry above the default is a data error and is clamped, not honoured.
    expect(consentAge('AT', { AT: 14 })).toBe(14);
    expect(consentAge('DE', { DE: 18 })).toBe(16);
    // A bad entry lands on the most protective value the table admits, never on
    // a threshold nobody wrote down.
    expect(consentAge('DE', { DE: 99 })).toBe(16);
  });

  it('reads a country code out of an ISO-3166-2 value', () => {
    expect(countryOf('gb-sct')).toBe('GB');
    expect(countryOf('  us  ')).toBe('US');
    expect(countryOf('')).toBe('');
  });
});

describe('age, from a date of birth the server never sees', () => {
  it('counts whole years', () => {
    expect(ageOn('2013-08-16', '2026-08-16')).toBe(13);
    expect(ageOn('2013-08-17', '2026-08-16')).toBe(12);
    expect(ageOn('2013-08-15', '2026-08-16')).toBe(13);
  });

  it('puts a 29 February birthday on 1 March in a common year', () => {
    expect(birthdayOn('2012-02-29', 13)).toBe('2025-03-01');
    expect(birthdayOn('2012-02-29', 16)).toBe('2028-02-29');
  });

  it('bands an age', () => {
    expect(bandForAge(0)).toBe('under_13');
    expect(bandForAge(12)).toBe('under_13');
    expect(bandForAge(13)).toBe('13_15');
    expect(bandForAge(15)).toBe('13_15');
    expect(bandForAge(16)).toBe('16_17');
    expect(bandForAge(17)).toBe('16_17');
    expect(bandForAge(18)).toBe('adult');
    expect(bandForAge(44)).toBe('adult');
  });

  it('declares a band and the day it changes', () => {
    expect(declareAge('2015-04-02', '2026-08-16')).toEqual({
      band: 'under_13',
      bandNextChangeOn: '2028-04-02',
    });
    expect(declareAge('2011-01-09', '2026-08-16')).toEqual({
      band: '13_15',
      bandNextChangeOn: '2027-01-09',
    });
    expect(declareAge('1981-06-30', '2026-08-16')).toEqual({
      band: 'adult',
      bandNextChangeOn: null,
    });
  });
});

describe('bands change on their own (plan §6.2)', () => {
  it('leaves a rider alone before the boundary', () => {
    const declared = { band: 'under_13', bandNextChangeOn: '2027-01-09' } as const;
    expect(advanceBand(declared, '2026-08-16')).toEqual(declared);
  });

  it('moves them on the day the boundary arrives, with no job scanning anything', () => {
    expect(advanceBand({ band: 'under_13', bandNextChangeOn: '2026-08-16' }, '2026-08-16')).toEqual(
      {
        band: '13_15',
        bandNextChangeOn: '2029-08-16',
      },
    );
  });

  it('catches up an account that was away for years, one boundary at a time', () => {
    // 13 in 2019, 16 in 2022, 18 in 2024 — three boundaries, no birth date, and
    // no cron job.
    expect(advanceBand({ band: 'under_13', bandNextChangeOn: '2019-03-04' }, '2023-01-01')).toEqual(
      {
        band: '16_17',
        bandNextChangeOn: '2024-03-04',
      },
    );
    expect(advanceBand({ band: 'under_13', bandNextChangeOn: '2019-03-04' }, '2026-08-16')).toEqual(
      {
        band: 'adult',
        bandNextChangeOn: null,
      },
    );
  });

  it('stops at adult', () => {
    expect(advanceBand({ band: '16_17', bandNextChangeOn: '2001-05-05' }, '2026-08-16')).toEqual({
      band: 'adult',
      bandNextChangeOn: null,
    });
    expect(advanceBand({ band: 'adult', bandNextChangeOn: null }, '2026-08-16')).toEqual({
      band: 'adult',
      bandNextChangeOn: null,
    });
  });
});

describe('who needs a guardian', () => {
  it('asks in the UK below 13 and not at 13', () => {
    expect(consentRequired('GB', 'under_13')).toBe(true);
    expect(consentRequired('GB', '13_15')).toBe(false);
    expect(consentRequired('GB', '16_17')).toBe(false);
    expect(consentRequired('GB', 'adult')).toBe(false);
  });

  it('asks across the EEA below 16', () => {
    expect(consentRequired('DE', 'under_13')).toBe(true);
    expect(consentRequired('DE', '13_15')).toBe(true);
    expect(consentRequired('DE', '16_17')).toBe(false);
    expect(consentRequired('DE', 'adult')).toBe(false);
  });

  it('never asks an adult, anywhere', () => {
    for (const country of ['GB', 'DE', 'US', 'AU', 'ZZ']) {
      expect(consentRequired(country, 'adult')).toBe(false);
    }
  });

  it('starts a fresh account in the right state, and never at granted', () => {
    expect(initialConsentState('GB', 'adult')).toBe('not_required');
    expect(initialConsentState('GB', 'under_13')).toBe('pending');
    expect(initialConsentState('DE', '13_15')).toBe('pending');
  });
});

describe('the sign-up decision', () => {
  it('opens an ordinary account above the threshold', () => {
    expect(signupOutcome('GB', '13_15')).toBe('open');
    expect(signupOutcome('AU', 'adult')).toBe('open');
  });

  it('routes a younger rider into the consent flow', () => {
    expect(signupOutcome('GB', 'under_13')).toBe('consent_required');
    expect(signupOutcome('DE', '13_15')).toBe('consent_required');
  });

  it('declines a US under-13 rather than consenting them (COPPA, §6.3)', () => {
    expect(signupOutcome('US', 'under_13')).toBe('declined');
    // The refusal is that one case only — a 13 year old in the US signs up
    // normally, and an under-13 anywhere else gets the consent flow.
    expect(signupOutcome('US', '13_15')).toBe('open');
    expect(signupOutcome('CA', 'under_13')).toBe('consent_required');
  });
});

describe('when consent lapses', () => {
  it('lapses on the 13th birthday where the threshold is 13', () => {
    expect(consentLapsesOn('GB', { band: 'under_13', bandNextChangeOn: '2028-04-02' })).toBe(
      '2028-04-02',
    );
  });

  it('lapses on the 16th birthday where the threshold is 16', () => {
    // An under-13 in the EEA leaves the band at 13 and the gate at 16.
    expect(consentLapsesOn('DE', { band: 'under_13', bandNextChangeOn: '2028-04-02' })).toBe(
      '2031-04-02',
    );
    // Once they are in 13_15, the band boundary *is* the lapse.
    expect(consentLapsesOn('DE', { band: '13_15', bandNextChangeOn: '2031-04-02' })).toBe(
      '2031-04-02',
    );
  });

  it('has no lapse date for a rider who never needed consent', () => {
    expect(consentLapsesOn('GB', { band: '13_15', bandNextChangeOn: '2029-01-01' })).toBeNull();
    expect(consentLapsesOn('DE', { band: 'adult', bandNextChangeOn: null })).toBeNull();
  });
});

describe('refreshing an account that has been away', () => {
  it('clears a pending account once it ages out, without a guardian doing anything', () => {
    const result = refreshConsent({
      country: 'GB',
      declaration: { band: 'under_13', bandNextChangeOn: '2026-08-16' },
      state: 'pending',
      today: '2026-08-16',
    });
    expect(result.declaration.band).toBe('13_15');
    expect(result.state).toBe('not_required');
  });

  it('clears a revoked account the same way — revocation is not a life sentence', () => {
    const result = refreshConsent({
      country: 'GB',
      declaration: { band: 'under_13', bandNextChangeOn: '2026-01-01' },
      state: 'revoked',
      today: '2026-08-16',
    });
    expect(result.state).toBe('not_required');
  });

  it('holds a revoked EEA rider who has only reached 13', () => {
    const result = refreshConsent({
      country: 'DE',
      declaration: { band: 'under_13', bandNextChangeOn: '2026-08-16' },
      state: 'revoked',
      today: '2026-08-16',
    });
    expect(result.declaration.band).toBe('13_15');
    expect(result.state).toBe('revoked');
  });

  it('leaves an account that has not moved exactly as it was', () => {
    const declaration = { band: 'under_13', bandNextChangeOn: '2030-02-02' } as const;
    expect(
      refreshConsent({ country: 'GB', declaration, state: 'granted', today: '2026-08-16' }),
    ).toEqual({ declaration, state: 'granted' });
  });
});

describe('what a limited account may do (plan §6.2)', () => {
  it('counts pending and revoked as limited, and nothing else', () => {
    expect(isConsentLimited('pending')).toBe(true);
    expect(isConsentLimited('revoked')).toBe(true);
    expect(isConsentLimited('granted')).toBe(false);
    expect(isConsentLimited('not_required')).toBe(false);
    expect(isConsentLimited(null)).toBe(false);
  });

  it('allows everything that touches only their own data', () => {
    for (const capability of [
      'sign_in',
      'browse_library',
      'log_trick',
      'write_notes',
      'build_streak',
      'see_own_progress',
    ] as const) {
      expect(canWhileConsentLimited(capability)).toBe(true);
    }
  });

  it('refuses everything that makes them visible, reachable or billable', () => {
    for (const capability of [
      'be_visible_to_riders',
      'appear_on_crew_board',
      'join_or_create_crew',
      'receive_crew_invite',
      'submit_spot',
      'attend_event',
      'hold_subscription',
    ] as const) {
      expect(canWhileConsentLimited(capability)).toBe(false);
    }
  });

  it('names every capability in exactly one of the two lists', () => {
    // A capability in neither list reads as "denied" by accident rather than by
    // decision, and one in both is a contradiction nobody would notice.
    const all: RiderCapability[] = [...CONSENT_LIMITED_ALLOWS, ...CONSENT_LIMITED_DENIES];
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(14);
  });

  it('lifts the whole list once consent is granted', () => {
    expect(canWithConsent('granted', 'attend_event')).toBe(true);
    expect(canWithConsent('not_required', 'join_or_create_crew')).toBe(true);
    expect(canWithConsent('pending', 'attend_event')).toBe(false);
    expect(canWithConsent('revoked', 'join_or_create_crew')).toBe(false);
    expect(canWithConsent('revoked', 'log_trick')).toBe(true);
  });
});

describe('the approval link', () => {
  const now = new Date('2026-08-16T12:00:00Z');

  it('is live before its expiry and dead after it', () => {
    expect(approvalExpired('2026-08-23T12:00:00Z', now)).toBe(false);
    expect(approvalExpired('2026-08-16T11:59:59Z', now)).toBe(true);
  });

  it('treats a missing or unreadable expiry as expired', () => {
    expect(approvalExpired('', now)).toBe(true);
    expect(approvalExpired(null, now)).toBe(true);
    expect(approvalExpired('not a date', now)).toBe(true);
  });
});
