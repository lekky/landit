import { HEARD_ABOUT_IDS } from '@landit/core';

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
  /** Matched against name and handle, and against email when `matchEmail`. */
  readonly query?: string;
  /** A plan slug, or nothing for every plan. */
  readonly plan?: string;
  /**
   * Also match `query` against the sign-up email.
   *
   * **Off by default, and the default is the point.** Every other caller of
   * this filter searches the thing staff can already see on the row; matching
   * email widens that to a field the table deliberately does not show, so it is
   * opted into by the one screen that means it rather than inherited by
   * anything that happens to pass a query. See `apps/web`'s riders page for why
   * it means it: a support mail arrives from an address, and finding the rider
   * it belongs to was otherwise a database query.
   */
  readonly matchEmail?: boolean;
}

function riderFilter(filter: AdminRiderFilter): ListOptions {
  const clauses: string[] = [];
  const params: Record<string, string> = {};

  const query = filter.query?.trim();
  if (query) {
    clauses.push(
      filter.matchEmail
        ? '(name ~ {:q} || handle ~ {:q} || email ~ {:q})'
        : '(name ~ {:q} || handle ~ {:q})',
    );
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

  // Both halves are parameterised `or` chains, never ids concatenated into the
  // filter string — see `orChain`.
  const users = orChain('user', userIds, 'u');
  const landed = orChain('stage', stages, 's');

  const rows = await records(client, 'trick_progress').list({
    filter: `${users.clause} && ${landed.clause}`,
    params: { ...users.params, ...landed.params },
    fields: 'user',
  });

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.user] = (counts[row.user] ?? 0) + 1;
  return counts;
}

/**
 * A parameterised `field = {:x} || field = {:x}` chain over a list of ids.
 *
 * Extracted from `landedCountsFor`, which needs two of them. It exists to make
 * one thing hard to get wrong: the ids are **bound**, never concatenated into
 * the filter string. The privacy rules are written in this same filter language
 * (see `collections.ts`), so a read that interpolated an id would be the
 * PocketBase spelling of SQL injection against them.
 *
 * The prefix keeps two chains in one filter from sharing parameter names.
 */
function orChain(
  field: string,
  values: readonly string[],
  prefix: string,
): { readonly clause: string; readonly params: Record<string, string> } {
  const params: Record<string, string> = {};
  const clause = values
    .map((value, i) => {
      params[`${prefix}${i}`] = value;
      return `${field} = {:${prefix}${i}}`;
    })
    .join(' || ');
  return { clause: `(${clause})`, params };
}

/**
 * How many rows of `collection` point at each of these ids, in one request.
 *
 * The shape `landedCountsFor` established, generalised for the content tabs:
 * every one of them shows a count per row — riders going to an event, log
 * entries against a challenge week, dismissals of an announcement — and every
 * one of them was reading the **whole** join collection with `getFullList` to
 * work it out. Those collections are riders x items, so they outgrow the table
 * they decorate by the size of the rider base.
 *
 * Scoping the read to the ids actually on screen is what makes a paged table
 * worth having: page the rows and this read shrinks with them, instead of the
 * page getting cheaper to render and no cheaper to build.
 *
 * `fields` narrows the response to the one column being tallied, so the wire
 * carries ids rather than whole records. Ids with no rows are absent from the
 * result — callers read a missing key as zero.
 */
export async function relationCountsFor<N extends CollectionName>(
  client: Client,
  collection: N,
  field: string & keyof CollectionRecords[N],
  ids: readonly string[],
): Promise<Readonly<Record<string, number>>> {
  if (ids.length === 0) return {};

  const { clause, params } = orChain(field, ids, 'r');
  const rows = await records(client, collection).list({
    filter: clause,
    params,
    fields: field,
  });

  const counts: Record<string, number> = {};
  for (const row of rows) {
    // A relation column is a string id. Anything else means `field` named a
    // column that is not one, which is a caller's mistake rather than a row to
    // tally — skipped rather than counted under an empty key.
    const key: unknown = row[field];
    if (typeof key === 'string' && key) counts[key] = (counts[key] ?? 0) + 1;
  }
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
  /**
   * Riders per `heard_about` id, keyed by the ids in `HEARD_ABOUT_IDS`.
   *
   * Only riders who answered are in here at all; `heardAboutAnswered` is the
   * total and is the denominator the Overview draws the bars against. Counting
   * them against every rider instead would draw nine slivers beside one huge
   * unanswered bar — an artefact of the question having been added on
   * 2026-09-06, when every account older than that had already been through
   * onboarding and will never be asked.
   */
  readonly byHeardAbout: Readonly<Record<string, number>>;
  /**
   * Of those, the ones on a plan that unlocks paid tricks.
   *
   * Empty unless the caller passed `paidPlanSlugs` — this package holds no
   * opinion about which plan is paid, because that is a staff-editable fact on
   * the plan record (plan §2.4) and comparing a slug in code is what §2.4
   * forbids.
   */
  readonly paidByHeardAbout: Readonly<Record<string, number>>;
  /** How many riders have answered "where did you find us?" at all. */
  readonly heardAboutAnswered: number;
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
  /**
   * Which plan slugs count as paid, for the `heard_about` split. Optional so
   * the signature stays what it was for every existing caller; omitted means
   * `paidByHeardAbout` comes back empty rather than guessed at.
   */
  paidPlanSlugs: readonly string[] = [],
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
    // Three columns now, still one request. `heard_about` is a select and the
    // paid split is a cross-tab of two fields, so neither can be grouped by the
    // API any more than the sports could — and tallying them in the loop that
    // already walks these rows costs nothing beyond two more columns on the
    // wire, where eighteen more filtered counts would have cost eighteen
    // round trips.
    records(client, 'users').list({ fields: 'sports,heard_about,plan' }),
  ]);

  const byPlan: Record<string, number> = {};
  planSlugs.forEach((slug, i) => {
    byPlan[slug] = planCounts[i] ?? 0;
  });

  const bySport: Record<string, number> = {};
  for (const id of sportIds) bySport[id] = 0;
  const byHeardAbout: Record<string, number> = {};
  const paidByHeardAbout: Record<string, number> = {};
  for (const id of HEARD_ABOUT_IDS) {
    byHeardAbout[id] = 0;
    paidByHeardAbout[id] = 0;
  }
  const paid = new Set(paidPlanSlugs);
  let multiSport = 0;
  let heardAboutAnswered = 0;
  for (const row of sportRows) {
    const sports = row.sports ?? [];
    if (sports.length > 1) multiSport += 1;
    for (const sport of sports) {
      // Only the sports asked for. A row carrying a value the caller did not
      // list is skipped rather than added, so an id retired from `SPORT_IDS`
      // cannot reappear in the chart as an unlabelled bar.
      if (sport in bySport) bySport[sport] = (bySport[sport] ?? 0) + 1;
    }

    // Same rule, same reason: an id retired from `HEARD_ABOUT` is not counted
    // into a bar nobody drew. An unanswered row is simply not an answer, so it
    // is absent from both tallies rather than counted as a tenth option.
    const heard = row.heard_about;
    if (heard && heard in byHeardAbout) {
      byHeardAbout[heard] = (byHeardAbout[heard] ?? 0) + 1;
      heardAboutAnswered += 1;
      if (paid.has(row.plan)) paidByHeardAbout[heard] = (paidByHeardAbout[heard] ?? 0) + 1;
    }
  }

  return {
    total,
    activeToday,
    suspended,
    pendingConsent,
    byPlan,
    bySport,
    multiSport,
    byHeardAbout,
    paidByHeardAbout,
    heardAboutAnswered,
  };
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

/**
 * Delete a rider's account row outright, and log what was destroyed.
 *
 * **This is not what a rider's own erasure does, and the difference matters.**
 * `POST /api/landit/account/delete` is anonymise-and-retain (owner decision,
 * Rachid, 2026-08-17; the reasoning is in `pocketbase/hooks/lib/erasure.js`),
 * because a cascade delete turns a pseudonymous moderation trail into an
 * unreadable one and takes the guardian consent record with it. Nothing a rider
 * can reach calls this. It is the operator's tool for the case
 * `1787702400_users_no_self_delete.js` names in as many words — "test accounts,
 * a bad import" — where the row is not evidence about a person and leaving it
 * costs more than removing it.
 *
 * **The audit row is written before the delete, which is the opposite of
 * `applyStaffChange`.** That function logs second on purpose: a log written
 * first invents changes that did not happen, and for an update that is the
 * worse failure. A delete inverts the arithmetic. `users` is not in the audit
 * hook's `AUDITED` list, so unlike a spot or a trick there is no row written
 * inside the transaction underneath this one — this row is the *only* trace
 * that the account existed. Logging second means a process dying between the
 * delete and the write leaves an account gone with nothing anywhere saying so,
 * and no record left to reconstruct it from. Logging first can at worst leave a
 * row describing a deletion that failed, and that is a row you can disprove by
 * observing the account is still there. An overstated log beats a vanished one.
 *
 * `before` is the whole record rather than a narrowed patch, because after this
 * call there is nowhere else to find any of it.
 *
 * Who may call this is not decided here — `packages/db` holds no rules (see the
 * head of this file). The gate is `requireOwner` in `apps/web/src/lib/staff.ts`.
 */
export async function deleteRider(
  client: Client,
  actor: StaffActor,
  userId: string,
): Promise<void> {
  const table = records(client, 'users');
  const before = await table.get(userId);

  await writeStaffAudit(client, {
    actor,
    action: 'admin.account_delete',
    entity: 'users',
    entityId: userId,
    before,
    after: null,
  });

  await table.remove(userId);
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

/**
 * Every plan, including ones taken off sale, in the same order the rider's plans
 * page shows them.
 *
 * The sort key is `listPlans`' and is deliberately copied rather than improved
 * on: `clip_cap_bytes` is the collection's only numeric column and it happens to
 * rise with price, so it is what every plan-card surface is ordered by. It stopped
 * meaning anything when clip hosting was reversed (PR #128) and
 * `packages/core/src/data/plans.ts` records why it was kept anyway. Sorting this
 * read differently would put the staff cards in a different order from the page
 * they describe; a real rank column is issue territory.
 */
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
 * What the paged spots read narrows by.
 *
 * `query` matches the two fields staff can actually see on a row — the name and
 * the town. Deliberately not the submitter: the queue shows a submitter as an
 * id and nothing else (see `apps/web`'s spots page), and a search that reached
 * that field would make the review screen a way to look up everything one rider
 * has ever sent in, which is a rider-browsing surface on a screen that is not
 * allowed to be one.
 */
export interface AdminSpotFilter {
  readonly status?: SpotsStatus;
  /** Matched against name and town. */
  readonly query?: string;
}

function spotFilter(filter: AdminSpotFilter): ListOptions {
  const clauses: string[] = [];
  const params: Record<string, string> = {};

  const query = filter.query?.trim();
  if (query) {
    clauses.push('(name ~ {:q} || town ~ {:q})');
    params.q = query;
  }
  if (filter.status) {
    clauses.push('status = {:status}');
    params.status = filter.status;
  }

  return clauses.length ? { filter: clauses.join(' && '), params } : {};
}

/**
 * One page of spots at any status, newest first.
 *
 * The paged twin of `listAdminSpots`, and the one the staff screen uses. Spots
 * are rider-submitted, so the collection has no more of an upper bound on it
 * than `users` does — a queue screen built on `getFullList` gets slower with
 * every submission, which is the failure mode the riders table was paged to
 * avoid and the same one waiting here.
 *
 * Newest first, which puts a fresh submission at the top of the unfiltered view
 * without needing a sort control: a spot arrives `pending`, so the queue is
 * where the newest rows already are.
 */
export async function listAdminSpotsPage(
  client: Client,
  filter: AdminSpotFilter = {},
  page: { readonly page?: number; readonly perPage?: number } = {},
): Promise<Page<SpotsRecord>> {
  return records(client, 'spots').page({
    ...spotFilter(filter),
    sort: '-created',
    page: page.page ?? 1,
    perPage: page.perPage ?? 40,
  });
}

/**
 * How many spots sit at each of these statuses, honouring the same search.
 *
 * One small request per status — `perPage: 1` returns `totalItems` and one row
 * rather than the pile. It exists because paging the table takes the three
 * section headings away, and a queue whose length you can only discover by
 * clicking into it is a queue people stop working. The counts go on the filter
 * pills, so "twelve waiting" is visible from whichever status is being read.
 *
 * The search is applied to the counts as well as the rows, so a filtered view
 * cannot show a pill promising more than the filter would give.
 */
export async function spotCounts(
  client: Client,
  statuses: readonly SpotsStatus[],
  filter: Omit<AdminSpotFilter, 'status'> = {},
): Promise<Readonly<Record<string, number>>> {
  const pages = await Promise.all(
    statuses.map((status) =>
      records(client, 'spots').page({ ...spotFilter({ ...filter, status }), perPage: 1 }),
    ),
  );

  const counts: Record<string, number> = {};
  statuses.forEach((status, i) => {
    counts[status] = pages[i]?.totalItems ?? 0;
  });
  return counts;
}

/**
 * What the paged events read narrows by.
 *
 * `live` is a tri-state on purpose: `undefined` means "both", which is what the
 * tab has always shown. An event taken off the calendar still has to be findable
 * from the screen that took it down, or "Remove" becomes a delete with extra
 * steps — see `EventsScreen` on why removal is a hide.
 */
export interface AdminEventFilter {
  /** Matched against name, venue and town. */
  readonly query?: string;
  /** `true` on the calendar, `false` taken down, omitted for both. */
  readonly live?: boolean;
}

function eventFilter(filter: AdminEventFilter): ListOptions {
  const clauses: string[] = [];
  const params: Record<string, string | boolean> = {};

  const query = filter.query?.trim();
  if (query) {
    clauses.push('(name ~ {:q} || venue ~ {:q} || town ~ {:q})');
    params.q = query;
  }
  if (filter.live !== undefined) {
    clauses.push('is_live = {:live}');
    params.live = filter.live;
  }

  return clauses.length ? { filter: clauses.join(' && '), params } : {};
}

/**
 * One page of events, soonest first.
 *
 * The paged twin of `listAdminEvents`. The calendar is the collection that only
 * ever grows: an event that has happened is not deleted — `event_attendance`
 * cascades from it, so removing a past comp would erase the "I was going" of
 * every rider who marked it — so every season adds rows and none ever leave.
 *
 * The sort is `listAdminEvents`', kept rather than improved on, so the paged
 * table reads in the same order the tab has always read in.
 */
export async function listAdminEventsPage(
  client: Client,
  filter: AdminEventFilter = {},
  page: { readonly page?: number; readonly perPage?: number } = {},
): Promise<Page<EventsRecord>> {
  return records(client, 'events').page({
    ...eventFilter(filter),
    sort: 'date',
    page: page.page ?? 1,
    perPage: page.perPage ?? 25,
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
