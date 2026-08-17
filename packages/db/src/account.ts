import type { Client } from './clients';
import { records } from './collections';
import type { ReportsReason, ReportsRecord, ReportsSubjectType } from './generated/collections';

/**
 * Reporting, and the two things a rider is owed about their own data (T18).
 *
 * A file of its own rather than more of `mutations.ts`, for the reason the
 * package header gives about layers and one this build has paid for twice: four
 * sessions editing one 600-line file is four rebase conflicts in the file every
 * screen imports (LESSONS §1).
 *
 * **This package holds no rules**, here least of all. Nothing below decides who
 * may report, what a report may say, whose data may be exported or what
 * deletion means — `pocketbase/hooks/95_reports.pb.js`, `96_account.pb.js` and
 * `lib/erasure.js` decide all four, on the server, and are proven over HTTP by
 * the suite in `pocketbase/tests`. These are the calls, with their shapes named.
 */

/* -------------------------------------------------------------- reporting -- */

export interface ReportInput {
  /** `profile` | `spot` | `clip` | `other`. The same four `@landit/core` names. */
  readonly subjectType: ReportsSubjectType;
  /** The record the report is about, where there is one. */
  readonly subjectId?: string;
  readonly reason: ReportsReason;
  readonly detail: string;
  /** Required when nobody is signed in — the address we reply to. */
  readonly reporterEmail?: string;
  /** The report being appealed, for a complaint about our own decision. */
  readonly complaintOf?: string;
}

/**
 * File a report, signed in or not.
 *
 * **The client may be anonymous**, and that is the OSA duty rather than an
 * oversight: `reports.createRule` is an empty string so somebody who is not a
 * signed-up rider can still tell us something (plan §6.1). What stops that being
 * a hole is entirely server-side — the hook pins `reporter`, `status` and
 * `outcome`, requires a return address when there is no account, and rate-limits
 * by whoever is asking.
 *
 * Everything this function returns comes back from PocketBase; nothing about the
 * report is decided here.
 */
export async function fileReport(client: Client, input: ReportInput): Promise<ReportsRecord> {
  return records(client, 'reports').create({
    subject_type: input.subjectType,
    subject_id: input.subjectId ?? '',
    reason: input.reason,
    detail: input.detail,
    reporter_email: input.reporterEmail ?? '',
    complaint_of: input.complaintOf ?? '',
  });
}

/* ------------------------------------------------------- your own records -- */

/** Whatever `lib/erasure.js#exportFor` built. Deliberately not typed field by field. */
export type AccountExport = Record<string, unknown> & { readonly exported_at: string };

/**
 * Everything Land It holds about the signed-in rider.
 *
 * **There is no account parameter, here or on the route.** The subject is
 * whoever the token belongs to, which is what makes "export somebody else" a
 * request that cannot be phrased rather than one that has to be refused.
 */
export async function exportAccountData(client: Client): Promise<AccountExport> {
  return client.send('/api/landit/account/export', { method: 'POST', body: {} });
}

export interface AccountDeletionResult {
  readonly deleted: boolean;
  /** The stable pseudonym the retained records now carry. */
  readonly pseudonym: string;
  readonly records_removed?: number;
}

/**
 * End the account.
 *
 * **Anonymise-and-retain, not a hard delete** — owner decision (Rachid,
 * 2026-08-17, in chat), reasoned in `pocketbase/hooks/lib/erasure.js`. The
 * rider's own content goes; the audit trail, the guardian consent records and
 * any report naming them stay, relabelled to the pseudonym this returns.
 *
 * The password is re-checked on the server. A session token is enough to edit a
 * profile and deliberately not enough to end an account: a borrowed phone
 * should not be able to wipe a child's ride history.
 */
export async function deleteAccount(
  client: Client,
  input: { password: string; confirm: string },
): Promise<AccountDeletionResult> {
  return client.send('/api/landit/account/delete', {
    method: 'POST',
    body: { password: input.password, confirm: input.confirm },
  });
}
