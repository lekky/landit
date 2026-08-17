import type { Client } from './clients';
import {
  records,
  type CollectionCreate,
  type CollectionUpdate,
  type ListOptions,
  type Page,
} from './collections';
import type {
  AnnouncementsRecord,
  AuditLogRecord,
  CollectionName,
  CollectionRecords,
  EventsRecord,
  PlansRecord,
  ReportsRecord,
  ReportsStatus,
  SpotsRecord,
  SpotsStatus,
  StickersRecord,
  UsersPlan,
  UsersRecord,
} from './generated/collections';

/**
 * The staff portal's reads and writes (plan §7, T16).
 *
 * **Everything here expects a superuser client.** Not because staff are
 * trusted with one — they never hold it, it lives on the server — but because
 * a staff *rider's* token gets exactly the same answers as any other rider's:
 * `users` is filtered by the privacy rule, so half the rider base would be
 * missing from the riders table, and `audit_log` has `listRule: null`, so the
 * activity panel would be empty rather than refused. A portal built on the
 * rider's own token would look like it worked and quietly under-report.
 *
 * The role check is not here. It is in `apps/web/src/lib/staff.ts`, which is
 * the only thing that hands a superuser client to any of this, and this package
 * deliberately holds no rules (see `index.ts`). A function here that re-checked
 * the role would be a second copy of the gate, weaker than the real one and the
 * one most likely to drift.
 */

// ------------------------------------------------------------------ audit --

/**
 * Who is making a staff change, in the terms `audit_log` stores.
 *
 * The staff rider, never the superuser. The superuser is *how* the write is
 * made and is the same account for every member of staff — recording it would
 * produce a log that says every change was made by "us".
 */
export interface StaffActor {
  /** The staff rider's `users` id. */
  readonly id: string;
  /** Their handle, denormalised so an old row survives a rename. */
  readonly label: string;
}

/** One row for the log. `before`/`after` are narrowed to the fields that moved. */
export interface StaffAuditEntry {
  readonly actor: StaffActor;
  /**
   * What was done, namespaced `admin.*` — `admin.plan_override`,
   * `admin.suspend`.
   *
   * The namespace is what tells a staff-written row from the hook-written one
   * beside it. Every audited write leaves two rows and they mean different
   * things: `pocketbase/hooks/70_audit.pb.js` fires *inside* the write
   * transaction and records `superuser` as the actor, which is the tamper-proof
   * floor that exists whether or not the caller remembered to log; the row
   * below is written straight after and is the one that knows which human did
   * it. Reading the log for "who did what" means filtering to `actor_kind =
   * 'staff'`; reading it for "what changed" means not filtering at all.
   */
  readonly action: string;
  readonly entity: CollectionName;
  readonly entityId: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

/** Write one staff-attributed row. Prefer `applyStaffChange`, which cannot forget. */
export async function writeStaffAudit(
  client: Client,
  entry: StaffAuditEntry,
): Promise<AuditLogRecord> {
  return records(client, 'audit_log').create({
    actor: entry.actor.id,
    actor_kind: 'staff',
    actor_label: entry.actor.label,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}

/** The most recent rows, newest first. Superuser-only, like the collection. */
export async function listStaffAudit(
  client: Client,
  options: { readonly limit?: number; readonly staffOnly?: boolean } = {},
): Promise<AuditLogRecord[]> {
  const { limit = 12, staffOnly = true } = options;
  const page = await records(client, 'audit_log').page({
    ...(staffOnly ? { filter: 'actor_kind = {:kind}', params: { kind: 'staff' } } : {}),
    sort: '-created',
    perPage: limit,
  });
  return [...page.items];
}

/**
 * Only the keys a patch touched, so a row records the change and not the record.
 *
 * Takes `unknown` because the generated record types are closed interfaces with
 * no index signature — reading them by a runtime key needs exactly one widening
 * cast, and this is the one place that does it.
 */
function narrow(record: unknown, keys: readonly string[]): Record<string, unknown> {
  const source = record as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = source[key];
  return out;
}

export interface StaffChange<N extends CollectionName> {
  readonly actor: StaffActor;
  readonly collection: N;
  readonly id: string;
  /** `admin.plan_override`, `admin.suspend`, … */
  readonly action: string;
  readonly patch: CollectionUpdate<N>;
}

/**
 * Change one record as staff, and log it. **The write every admin action makes.**
 *
 * The mutation and its row are two HTTP calls, not one transaction, and saying
 * so is more useful than implying otherwise: a Next.js server action talks to
 * PocketBase over the wire, and there is no transaction spanning that. What
 * makes it safe anyway is that the row this writes is the *second* record of
 * the change, not the only one — the audit hook has already written the first
 * one inside the write's own transaction. So the failure mode of this function
 * dying between the two calls is a log that names the superuser instead of the
 * person, which is a worse record rather than no record. It is not possible for
 * an admin write to leave nothing behind.
 *
 * The reverse order — log first, then mutate — was the alternative, and it is
 * worse: it invents changes that did not happen, and a log that lies about
 * writes is less useful than one that is occasionally vague about who.
 */
export async function applyStaffChange<N extends CollectionName>(
  client: Client,
  change: StaffChange<N>,
): Promise<CollectionRecords[N]> {
  const table = records(client, change.collection);
  const keys = Object.keys(change.patch as Record<string, unknown>);

  const before = await table.get(change.id);
  const after = await table.update(change.id, change.patch);

  await writeStaffAudit(client, {
    actor: change.actor,
    action: change.action,
    entity: change.collection,
    entityId: change.id,
    before: narrow(before, keys),
    after: narrow(after, keys),
  });

  return after;
}

/** Create a record as staff, and log it. For T17's content tabs. */
export async function createStaffRecord<N extends CollectionName>(
  client: Client,
  change: {
    readonly actor: StaffActor;
    readonly collection: N;
    readonly action: string;
    readonly data: CollectionCreate<N>;
  },
): Promise<CollectionRecords[N]> {
  const created = await records(client, change.collection).create(change.data);

  await writeStaffAudit(client, {
    actor: change.actor,
    action: change.action,
    entity: change.collection,
    entityId: created.id,
    before: null,
    after: change.data,
  });

  return created;
}

/**
 * Delete a record as staff, and log it.
 *
 * Reads the record first so the row carries what was destroyed — the one case
 * where a narrowed `before` would be useless, because after this call there is
 * nowhere else to find it.
 */
export async function deleteStaffRecord<N extends CollectionName>(
  client: Client,
  change: {
    readonly actor: StaffActor;
    readonly collection: N;
    readonly action: string;
    readonly id: string;
  },
): Promise<void> {
  const table = records(client, change.collection);
  const before = await table.get(change.id);
  await table.remove(change.id);

  await writeStaffAudit(client, {
    actor: change.actor,
    action: change.action,
    entity: change.collection,
    entityId: change.id,
    before,
    after: null,
  });
}

// ----------------------------------------------------------------- riders --

export interface AdminRiderFilter {
  /** Matched against name and handle. */
  readonly query?: string;
  /** A plan slug, or nothing for every plan. */
  readonly plan?: string;
}

function riderFilter(filter: AdminRiderFilter): ListOptions {
  const clauses: string[] = [];
  const params: Record<string, string> = {};

  const query = filter.query?.trim();
  if (query) {
    clauses.push('(name ~ {:q} || handle ~ {:q})');
    params.q = query;
  }
  if (filter.plan) {
    clauses.push('plan = {:plan}');
    params.plan = filter.plan;
  }

  return clauses.length ? { filter: clauses.join(' && '), params } : {};
}

/**
 * One page of riders, newest first.
 *
 * Paged rather than listed because `users` is the one collection with no upper
 * bound on it — `getFullList` follows every page, so a riders table built on it
 * gets slower with every sign-up and eventually times out on the screen staff
 * open first.
 */
export async function listAdminRiders(
  client: Client,
  filter: AdminRiderFilter = {},
  page: { readonly page?: number; readonly perPage?: number } = {},
): Promise<Page<UsersRecord>> {
  return records(client, 'users').page({
    ...riderFilter(filter),
    sort: '-created',
    page: page.page ?? 1,
    perPage: page.perPage ?? 40,
  });
}

/**
 * How many tricks each of these riders has taken to a landed stage.
 *
 * **One request for the whole page, not one per rider.** The riders table shows
 * a landed count on every row, and the obvious implementation — a progress read
 * inside the row loop — is forty round trips per page that get slower as the
 * library grows. This reads `trick_progress` once, filtered to the ids on the
 * page, and tallies in memory.
 *
 * `stages` is passed in rather than imported: which stages count as landed is a
 * rule, rules live in `@landit/core`, and this package deliberately holds none
 * (see `index.ts`). Riders with nothing tracked are absent from the result, so
 * callers should read a missing key as zero.
 */
export async function landedCountsFor(
  client: Client,
  userIds: readonly string[],
  stages: readonly string[],
): Promise<Readonly<Record<string, number>>> {
  if (userIds.length === 0 || stages.length === 0) return {};

  // Built as a parameterised `or` chain, never by concatenating ids into the
  // filter string — the privacy rules are written in this same filter language
  // (see `collections.ts`).
  const params: Record<string, string> = {};
  const users = userIds.map((id, i) => {
    params[`u${i}`] = id;
    return `user = {:u${i}}`;
  });
  const landed = stages.map((stage, i) => {
    params[`s${i}`] = stage;
    return `stage = {:s${i}}`;
  });

  const rows = await records(client, 'trick_progress').list({
    filter: `(${users.join(' || ')}) && (${landed.join(' || ')})`,
    params,
    fields: 'user',
  });

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.user] = (counts[row.user] ?? 0) + 1;
  return counts;
}

/** How many riders match, without fetching them. */
async function countRiders(client: Client, options: ListOptions = {}): Promise<number> {
  const page = await records(client, 'users').page({ ...options, perPage: 1 });
  return page.totalItems;
}

/** What the Overview's rider figures are counted from. */
export interface AdminRiderCounts {
  readonly total: number;
  /** Signed in at some point in the last 24 hours' worth of activity. */
  readonly activeToday: number;
  readonly suspended: number;
  /** Awaiting a guardian's decision — the flagged row on "Needs a human". */
  readonly pendingConsent: number;
  /** Rider count per plan slug. Keyed by slug, so a new plan needs no code. */
  readonly byPlan: Readonly<Record<string, number>>;
  /** Rider count per sport id. */
  readonly bySport: Readonly<Record<string, number>>;
  /** Riders who ride more than one sport. */
  readonly multiSport: number;
}

/**
 * The rider side of the Overview, counted on the server.
 *
 * Every figure is a `totalItems` off a filtered page rather than a length of a
 * fetched list, so the numbers cost one small request each instead of the whole
 * rider base — except the two that genuinely need to look at each row, which
 * are the sport tallies (a `select` field cannot be grouped by the API) and the
 * multi-sport count. Those read a narrowed projection: `fields` keeps the
 * payload to the one column they count.
 */
export async function adminRiderCounts(
  client: Client,
  planSlugs: readonly string[],
  sportIds: readonly string[],
  since: Date,
): Promise<AdminRiderCounts> {
  const [total, activeToday, suspended, pendingConsent, planCounts, sportRows] = await Promise.all([
    countRiders(client),
    countRiders(client, { filter: 'last_ride >= {:since}', params: { since } }),
    countRiders(client, { filter: 'suspended = true' }),
    countRiders(client, { filter: 'consent_state = {:state}', params: { state: 'pending' } }),
    Promise.all(
      planSlugs.map((slug) =>
        countRiders(client, { filter: 'plan = {:plan}', params: { plan: slug } }),
      ),
    ),
    records(client, 'users').list({ fields: 'sports' }),
  ]);

  const byPlan: Record<string, number> = {};
  planSlugs.forEach((slug, i) => {
    byPlan[slug] = planCounts[i] ?? 0;
  });

  const bySport: Record<string, number> = {};
  for (const id of sportIds) bySport[id] = 0;
  let multiSport = 0;
  for (const row of sportRows) {
    const sports = row.sports ?? [];
    if (sports.length > 1) multiSport += 1;
    for (const sport of sports) {
      // Only the sports asked for. A row carrying a value the caller did not
      // list is skipped rather than added, so an id retired from `SPORT_IDS`
      // cannot reappear in the chart as an unlabelled bar.
      if (sport in bySport) bySport[sport] = (bySport[sport] ?? 0) + 1;
    }
  }

  return { total, activeToday, suspended, pendingConsent, byPlan, bySport, multiSport };
}

/**
 * Move a rider onto another plan, and log it.
 *
 * This writes `users.plan`, which **is** the entitlement the paywall reads —
 * `planFor` in `pocketbase/hooks/lib/landit.js` resolves the `plans` record
 * from this field — so an override takes effect on the rider's next request
 * rather than at some sync boundary. It also skips billing entirely: nothing
 * here touches Stripe, so a rider moved up by staff is not charged and a rider
 * moved down is not refunded.
 */
export async function setRiderPlan(
  client: Client,
  actor: StaffActor,
  userId: string,
  plan: UsersPlan,
): Promise<UsersRecord> {
  return applyStaffChange(client, {
    actor,
    collection: 'users',
    id: userId,
    action: 'admin.plan_override',
    patch: { plan },
  });
}

/**
 * Suspend or restore an account, and log it.
 *
 * `suspended` is the field `users.authRule` tests, so suspending ends the
 * account's access at the API rather than in the UI: the rider's existing token
 * stops authenticating on its next use, which `currentRider` re-checks on every
 * request. There is no session to invalidate separately.
 */
export async function setRiderSuspended(
  client: Client,
  actor: StaffActor,
  userId: string,
  suspended: boolean,
): Promise<UsersRecord> {
  return applyStaffChange(client, {
    actor,
    collection: 'users',
    id: userId,
    action: suspended ? 'admin.suspend' : 'admin.restore',
    patch: { suspended },
  });
}

// -------------------------------------------------------------- catalogue --

/**
 * The content tabs' reads (plan §7, T17).
 *
 * Every one of these is a **staff** view of a collection the rider-facing
 * `queries.ts` already reads, and the difference is always the same one:
 * `listStickers`, `listPlans`, `listEvents` and `listAnnouncements` all filter
 * `is_live = true`, because that is what a rider may see. A staff editor that
 * inherited that filter would show a tab from which every hidden record had
 * vanished — including the ones staff hid, which are precisely the ones they
 * come here to switch back on. Hiding something would make it unreachable.
 *
 * They live here rather than beside their rider-facing twins for the reason the
 * head of this file gives: they only answer honestly to a superuser client, and
 * keeping them in one file makes that a property of the module rather than of
 * whoever remembered.
 */

/** Every sticker, hidden ones included, in the canonical order staff read them in. */
export async function listAdminStickers(client: Client): Promise<StickersRecord[]> {
  return records(client, 'stickers').list({ sort: 'sport,name' });
}

/** Every plan, including ones taken off sale. Cheapest first, as on the rider page. */
export async function listAdminPlans(client: Client): Promise<PlansRecord[]> {
  return records(client, 'plans').list({ sort: 'clip_cap_bytes' });
}

/** Every event, including ones taken off the calendar. Soonest first. */
export async function listAdminEvents(client: Client): Promise<EventsRecord[]> {
  return records(client, 'events').list({ sort: 'date' });
}

/** Every announcement ever posted, newest first — pulled ones included. */
export async function listAdminAnnouncements(client: Client): Promise<AnnouncementsRecord[]> {
  return records(client, 'announcements').list({ sort: '-created' });
}

/**
 * Spots at any status, newest first.
 *
 * The rider-facing `listSpots` cannot do this job at all: `spots` is filtered by
 * an API rule to `status = 'live'` or your own submissions, so the queue a staff
 * member reviews is invisible to every client but this one.
 */
export async function listAdminSpots(client: Client, status?: SpotsStatus): Promise<SpotsRecord[]> {
  return records(client, 'spots').list({
    filter: status ? 'status = {:status}' : undefined,
    params: status ? { status } : undefined,
    sort: '-created',
  });
}

/**
 * Move a spot through the review queue, and log it.
 *
 * The whole point of the collection's `status` field (plan §6.1): a rider
 * submission reaches nobody until a human moves it to `live`. Rejection is a
 * status too, not a delete — the row is the record that somebody looked at it.
 */
export async function setSpotStatus(
  client: Client,
  actor: StaffActor,
  spotId: string,
  status: SpotsStatus,
): Promise<SpotsRecord> {
  return applyStaffChange(client, {
    actor,
    collection: 'spots',
    id: spotId,
    action: `admin.spot_${status}`,
    patch: { status },
  });
}

// ------------------------------------------------------------- moderation --

/** How many reports sit at each status. Keyed by status, so a new one needs no code. */
export type ReportCounts = Readonly<Record<string, number>>;

/**
 * One page of reports, newest first (plan §7, T17).
 *
 * `reports` is `listRule: reporter = @request.auth.id` — a rider sees their own
 * and nothing else — so this is another read that only answers to the superuser
 * client. It is paged for the same reason the riders table is: the collection
 * anyone on the internet can write to is the one with no upper bound on it, and
 * a queue screen built on `getFullList` gets slower every time somebody reports
 * something.
 */
export async function listReports(
  client: Client,
  filter: { readonly status?: ReportsStatus } = {},
  page: { readonly page?: number; readonly perPage?: number } = {},
): Promise<Page<ReportsRecord>> {
  return records(client, 'reports').page({
    filter: filter.status ? 'status = {:status}' : undefined,
    params: filter.status ? { status: filter.status } : undefined,
    sort: '-created',
    page: page.page ?? 1,
    perPage: page.perPage ?? 25,
  });
}

/** One report by id, or `null` if it has gone. */
export async function getReport(client: Client, id: string): Promise<ReportsRecord | null> {
  return records(client, 'reports').first('id = {:id}', { id });
}

/** How many reports sit at each of the statuses asked for. One small request each. */
export async function reportCounts(
  client: Client,
  statuses: readonly ReportsStatus[],
): Promise<ReportCounts> {
  const pages = await Promise.all(
    statuses.map((status) =>
      records(client, 'reports').page({
        filter: 'status = {:status}',
        params: { status },
        perPage: 1,
      }),
    ),
  );

  const counts: Record<string, number> = {};
  statuses.forEach((status, i) => {
    counts[status] = pages[i]?.totalItems ?? 0;
  });
  return counts;
}

/**
 * Triage one report, and log it.
 *
 * `status` and `outcome` are the two fields the collection refuses to every
 * client — `updateRule: null`, and the create hook pins them — so this is the
 * only way either of them moves. The outcome is written by staff and read by
 * nobody but staff and, if they appeal, the person who filed it; it is stored
 * as typed rather than summarised, because a moderation decision that gets
 * paraphrased on its way into the record is not evidence of anything.
 */
export async function setReportTriage(
  client: Client,
  actor: StaffActor,
  reportId: string,
  triage: { readonly status: ReportsStatus; readonly outcome?: string },
): Promise<ReportsRecord> {
  return applyStaffChange(client, {
    actor,
    collection: 'reports',
    id: reportId,
    action: `admin.report_${triage.status}`,
    patch: { status: triage.status, outcome: triage.outcome ?? '' },
  });
}
