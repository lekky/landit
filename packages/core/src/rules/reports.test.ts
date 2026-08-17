import { describe, expect, it } from 'vitest';

import {
  REPORT_DETAIL_MAX,
  REPORT_REASONS,
  REPORT_SUBJECTS,
  isReportReason,
  isReportSubject,
  reportProblems,
  reportReasonLabel,
} from './reports';

describe('what a report has to say', () => {
  const good = {
    subjectType: 'profile',
    reason: 'harassment',
    detail: 'They keep saying things about my mate on the crew board.',
    signedIn: true,
  };

  it('accepts a complete one from a signed-in rider', () => {
    expect(reportProblems(good)).toEqual([]);
  });

  it('asks a signed-out reporter for an address, because we promise a reply', () => {
    expect(reportProblems({ ...good, signedIn: false })).toContain(
      'Leave an email address so we can tell you what we did about this.',
    );
    expect(
      reportProblems({ ...good, signedIn: false, reporterEmail: 'someone@example.com' }),
    ).toEqual([]);
    expect(
      reportProblems({ ...good, signedIn: false, reporterEmail: 'not an address' }),
    ).toHaveLength(1);
  });

  it('refuses one that says nothing', () => {
    expect(reportProblems({ ...good, detail: '   ' })).toHaveLength(1);
    expect(reportProblems({ ...good, detail: 'x'.repeat(REPORT_DETAIL_MAX + 1) })).toHaveLength(1);
  });

  it('refuses a subject or a reason that is not one of ours', () => {
    expect(reportProblems({ ...good, subjectType: 'inbox' })).toHaveLength(1);
    expect(reportProblems({ ...good, reason: 'vibes' })).toHaveLength(1);
    expect(isReportSubject('clip')).toBe(true);
    expect(isReportSubject('crew')).toBe(false);
    expect(isReportReason('self_harm')).toBe(true);
    expect(isReportReason('')).toBe(false);
  });

  it('names every problem at once, so a form does not play twenty questions', () => {
    expect(
      reportProblems({ subjectType: '', reason: '', detail: '', signedIn: true }),
    ).toHaveLength(3);
  });
});

describe('the stored values and the words on screen are not the same thing', () => {
  it('reads a reason back as something a rider would say', () => {
    expect(reportReasonLabel('self_harm')).toBe('Somebody might hurt themselves');
    expect(reportReasonLabel('nonsense')).toBe('Something else');
  });

  it('covers every value the collection allows', () => {
    // These lists are the `reports.subject_type` and `reports.reason` selects in
    // `pocketbase/migrations/1786838400_init_collections.js`. A value in the
    // schema with no label here is a radio button nobody can pick.
    expect(REPORT_SUBJECTS.map((s) => s.id)).toEqual(['profile', 'spot', 'clip', 'other']);
    expect(REPORT_REASONS.map((r) => r.id).sort()).toEqual(
      ['harassment', 'illegal', 'self_harm', 'sexual', 'spam', 'unsafe'].concat('other').sort(),
    );
  });
});
