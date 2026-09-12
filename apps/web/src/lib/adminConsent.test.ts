import { describe, expect, it } from 'vitest';

import { guardianStanding, riderStatus } from '@/app/(app)/admin/view';

/**
 * The consent half of the staff riders screen.
 *
 * Tested here rather than through the screen for the reason
 * `adminHeardAbout.test.ts` gives: `view.ts` is a pure module and the `@/`
 * alias reaches it from `src/lib/`. Nothing below renders anything.
 *
 * Both functions exist because the versions inlined in the screen got this
 * wrong in the same direction — they answered "is this account open?" with a
 * single equality test, and anything the test did not name came back looking
 * fine. The cases below are the ones that used to read as an ordinary account.
 */

describe('riderStatus', () => {
  it('gives a withdrawn consent its own tag rather than calling it ok', () => {
    // The bug this whole change exists for. A rider whose guardian said no is
    // as shut out of crews, invites, events and a subscription as one still
    // waiting, and showed the green `ok` tag.
    expect(riderStatus({ consent_state: 'revoked' })).toBe('revoked');
  });

  it('still tags an account waiting on a first answer', () => {
    expect(riderStatus({ consent_state: 'pending' })).toBe('pending');
  });

  it('leaves an account the gate never applied to alone', () => {
    expect(riderStatus({ consent_state: 'not_required' })).toBe('ok');
    expect(riderStatus({ consent_state: 'granted' })).toBe('ok');
    expect(riderStatus({})).toBe('ok');
  });

  it('lets suspension win over either consent state', () => {
    // A suspended account is shut whatever a guardian thinks, and the tag staff
    // act on is the one naming the thing staff can undo.
    expect(riderStatus({ suspended: true, consent_state: 'pending' })).toBe('suspended');
    expect(riderStatus({ suspended: true, consent_state: 'revoked' })).toBe('suspended');
  });
});

describe('guardianStanding', () => {
  const now = new Date('2026-09-12T00:00:00Z');
  const live = '2026-09-30T00:00:00Z';

  it('reads a withdrawal over the grant it undoes', () => {
    // Both stamps sit on one row: revoking does not erase the grant, and the
    // revocation link never expires, so a guardian can approve in September and
    // withdraw in October. Grant-first, this row would say "Approved" forever.
    const both = { granted: '2026-09-01T00:00:00Z', revoked: '2026-10-01T00:00:00Z' };
    expect(guardianStanding(both, now).standing).toBe('Withdrawn');
  });

  it('reports an approval', () => {
    expect(guardianStanding({ granted: '2026-09-01T00:00:00Z' }, now).standing).toBe('Approved');
  });

  it('separates a live request from one whose link has run out', () => {
    expect(guardianStanding({ approval_expires: live }, now).standing).toBe('Waiting on a reply');
    expect(guardianStanding({ approval_expires: '2026-09-01T00:00:00Z' }, now).standing).toBe(
      'Link expired',
    );
  });

  it('does not call an answered request expired', () => {
    // Expiry is a fact about a link nobody used. An approval that landed before
    // its window closed is not "expired" afterwards.
    const answered = { granted: '2026-09-02T00:00:00Z', approval_expires: '2026-09-03T00:00:00Z' };
    expect(guardianStanding(answered, now).standing).toBe('Approved');
  });

  it('gives the two live states colours that are not each other', () => {
    const withdrawn = guardianStanding({ revoked: '2026-09-01T00:00:00Z' }, now);
    const approved = guardianStanding({ granted: '2026-09-01T00:00:00Z' }, now);
    expect(withdrawn.standingColor).not.toBe(approved.standingColor);
  });
});
