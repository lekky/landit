/**
 * What a report is, and what makes one usable (T18; plan §6.1, §6.5).
 *
 * The OSA's Protection of Children Codes ask for an **easy** reporting route.
 * "Easy" is mostly a copy problem, and this file is where the copy that decides
 * it lives: seven reasons a fourteen year old can pick from without a glossary,
 * in the order somebody in trouble would look for them — the frightening ones
 * first, spam last.
 *
 * **Defined here, enforced in `pocketbase/hooks/95_reports.pb.js`.** Same
 * arrangement as every other rule in this package (plan §3): the form warns
 * before the server refuses, and the server refuses whatever the form did. The
 * numbers below are mirrored in that hook and there is a test that fails if the
 * two drift.
 *
 * Nothing here knows what a form is.
 */

/** What a report can be *about*. Matches the `reports.subject_type` select. */
export const REPORT_SUBJECTS = [
  {
    id: 'profile',
    label: 'A rider',
    blurb: 'Something on somebody’s profile, or the way they are using Land It.',
  },
  {
    id: 'spot',
    label: 'A spot',
    blurb: 'A skatepark or street spot that is wrong, gone, or not safe to ride.',
  },
  {
    // Kept because `reports.subject_type` has the value and a form that offered
    // fewer options than the schema accepts is a report nobody can file. There
    // is **no video surface at all** today — the clip vault was removed on
    // 2026-08-17 and the YouTube-link replacement is not built — so a screen
    // shows this one unavailable and says so, rather than hiding it and quietly
    // deciding video is unreportable.
    id: 'clip',
    label: 'A video',
    blurb: 'There is no video on Land It yet. When there is, this is where you report one.',
  },
  {
    id: 'other',
    label: 'Something else',
    blurb: 'Anything about Land It itself, or something that does not fit above.',
  },
] as const;

export type ReportSubjectId = (typeof REPORT_SUBJECTS)[number]['id'];

/**
 * Why. The wording is the point: `self_harm` is stored, "Somebody might hurt
 * themselves" is shown, and the two are not the same sentence.
 */
export const REPORT_REASONS = [
  { id: 'unsafe', label: 'Somebody could get hurt' },
  { id: 'self_harm', label: 'Somebody might hurt themselves' },
  { id: 'sexual', label: 'Something sexual' },
  { id: 'harassment', label: 'Bullying or picking on somebody' },
  { id: 'illegal', label: 'Something against the law' },
  { id: 'spam', label: 'Spam or an advert' },
  { id: 'other', label: 'Something else' },
] as const;

export type ReportReasonId = (typeof REPORT_REASONS)[number]['id'];

export const REPORT_DETAIL_MAX = 2000;

/**
 * The server's limits, mirrored so the screen can say what will happen before
 * it happens rather than turning a 429 into "something went wrong".
 */
export const REPORT_WINDOW_MINUTES = 60;
export const REPORT_MAX_PER_WINDOW = 5;
export const REPORT_MAX_OPEN = 20;

export const REPORT_SUBJECT_IDS: readonly ReportSubjectId[] = REPORT_SUBJECTS.map((s) => s.id);
export const REPORT_REASON_IDS: readonly ReportReasonId[] = REPORT_REASONS.map((r) => r.id);

export function isReportSubject(value: string | null | undefined): value is ReportSubjectId {
  return REPORT_SUBJECT_IDS.includes(String(value ?? '') as ReportSubjectId);
}

export function isReportReason(value: string | null | undefined): value is ReportReasonId {
  return REPORT_REASON_IDS.includes(String(value ?? '') as ReportReasonId);
}

export interface ReportDraft {
  readonly subjectType: string | null | undefined;
  readonly reason: string | null | undefined;
  readonly detail: string | null | undefined;
  /** The address to reply to. Required when nobody is signed in. */
  readonly reporterEmail?: string | null | undefined;
  readonly signedIn: boolean;
}

/**
 * What is wrong with this report, in the order a form should say it.
 *
 * Empty means the server will accept it. **It is not a permission** — the hook
 * checks all of this again and adds the rate limit, which this cannot know
 * about. A form that trusted this would be a form that decides who may report.
 */
export function reportProblems(draft: ReportDraft): string[] {
  const problems: string[] = [];

  if (!isReportSubject(draft.subjectType)) problems.push('Say what this is about.');
  if (!isReportReason(draft.reason)) problems.push('Pick the closest reason.');

  const detail = String(draft.detail ?? '').trim();
  if (!detail) problems.push('Tell us what happened, in your own words.');
  else if (detail.length > REPORT_DETAIL_MAX) {
    problems.push(`Keep it under ${REPORT_DETAIL_MAX} characters.`);
  }

  // A signed-out reporter has to leave an address, because the safeguarding
  // page promises a reply within one working day and there is otherwise nowhere
  // to send it. A signed-in one already has one on their account.
  if (!draft.signedIn && !isEmailish(draft.reporterEmail)) {
    problems.push('Leave an email address so we can tell you what we did about this.');
  }

  return problems;
}

/**
 * Deliberately loose. The only address that matters is one somebody can
 * actually read, and no regular expression knows which those are — this rejects
 * the typo and lets the post office decide the rest. It is the same shape the
 * consent route uses on a guardian's address.
 */
export function isEmailish(value: string | null | undefined): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value ?? '').trim());
}

export function reportReasonLabel(id: string): string {
  return REPORT_REASONS.find((r) => r.id === id)?.label ?? 'Something else';
}

export function reportSubjectLabel(id: string): string {
  return REPORT_SUBJECTS.find((s) => s.id === id)?.label ?? 'Something else';
}
