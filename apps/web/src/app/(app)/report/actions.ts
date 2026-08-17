'use server';

import {
  isReportReason,
  isReportSubject,
  reportProblems,
  type ReportReasonId,
  type ReportSubjectId,
} from '@landit/core';
import { fileReport, isRateLimited, refusalMessage } from '@landit/db';

import { anonymousClient, currentRider } from '@/lib/session';

/**
 * Filing a report, and appealing what we did about one (T18; plan §6.1, §6.5).
 *
 * **It runs signed in or signed out.** With a session it uses the rider's own
 * client, so the report is stamped with their account; without one it uses the
 * anonymous client, which is the OSA duty — a route that only worked for
 * signed-up riders would not be a reporting route for the parent who was shown
 * a screenshot.
 *
 * **Nothing here is the rule.** `reportProblems` is the same check the hook
 * makes, run early so the form can answer without a round trip; the hook checks
 * all of it again, pins `reporter`, `status` and `outcome`, and applies the rate
 * limit this action deliberately does not try to guess at
 * (`pocketbase/hooks/95_reports.pb.js`). A 429 is shown as what it is — the
 * server's own sentence — rather than flattened into "something went wrong",
 * because a limit a rider cannot see is a limit they cannot work around
 * honestly.
 */

export interface ReportFormState {
  readonly error?: string;
  /** Field-level problems, in the order `@landit/core` lists them. */
  readonly problems?: readonly string[];
  /** The reference to quote if they need to come back to us about it. */
  readonly filedAs?: string;
  readonly wasAppeal?: boolean;
}

export async function fileReportAction(
  _state: ReportFormState | undefined,
  form: FormData,
): Promise<ReportFormState> {
  const session = await currentRider();
  const signedIn = Boolean(session);

  const subjectType = String(form.get('subject_type') ?? '');
  const reason = String(form.get('reason') ?? '');
  const detail = String(form.get('detail') ?? '');
  const reporterEmail = String(form.get('reporter_email') ?? '')
    .trim()
    .toLowerCase();
  const subjectId = String(form.get('subject_id') ?? '').trim();
  const complaintOf = String(form.get('complaint_of') ?? '').trim();

  const problems = reportProblems({ subjectType, reason, detail, reporterEmail, signedIn });
  if (problems.length) return { problems };

  // Narrowing, not validation: `reportProblems` has already refused anything
  // outside the two lists. This is what turns that into a type.
  if (!isReportSubject(subjectType) || !isReportReason(reason)) {
    return { problems: ['Pick the closest reason.'] };
  }

  const client = session?.client ?? anonymousClient();

  try {
    const filed = await fileReport(client, {
      subjectType: subjectType as ReportSubjectId,
      subjectId,
      reason: reason as ReportReasonId,
      detail: detail.trim(),
      ...(signedIn ? {} : { reporterEmail }),
      ...(complaintOf ? { complaintOf } : {}),
    });
    return { filedAs: filed.id, wasAppeal: Boolean(complaintOf) };
  } catch (error) {
    if (isRateLimited(error)) {
      return { error: refusalMessage(error) ?? 'That is a lot of reports in one go.' };
    }
    return {
      error:
        refusalMessage(error) ??
        'We could not send that just now. Try again in a moment, or email us.',
    };
  }
}
