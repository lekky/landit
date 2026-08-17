import { describe, expect, it } from 'vitest';

import {
  applyStaffChange,
  deleteStaffRecord,
  landedCountsFor,
  listAdminAnnouncements,
  listAdminEvents,
  listAdminPlans,
  listAdminSpots,
  listAdminStickers,
  listReports,
  reportCounts,
  setReportTriage,
  setRiderPlan,
  setRiderSuspended,
  setSpotStatus,
  type StaffActor,
} from './admin';
import type { Client } from './clients';

/**
 * The audit plumbing, tested where it can be tested without a server: the shape
 * of what gets written, and that it gets written at all.
 *
 * The *guarantee* — that a staff role buys no direct write and no read of the
 * log — is not here. It is proven over HTTP against a real PocketBase in
 * `pocketbase/tests/staff-role.test.ts`, because a rule tested against a stub
 * is a test of the stub (plan §3, LESSONS §5). What these cover is the thing a
 * stub can genuinely answer: that `applyStaffChange` cannot mutate without
 * logging, and that the row it writes names the human rather than the
 * superuser.
 */

interface Call {
  collection: string;
  method: string;
  args: unknown[];
}

/**
 * A PocketBase double, recording what was asked of it.
 *
 * Only the methods this module uses, and each one records what it was asked so
 * a test can assert on the filter rather than on the answer — which is the
 * point for T17's reads, where the *absence* of a filter is the behaviour.
 */
function fakeClient(records: Record<string, Record<string, unknown>> = {}) {
  const calls: Call[] = [];
  let nextId = 1;

  const client = {
    filter: (expression: string) => expression,
    collection(name: string) {
      return {
        async getOne(id: string) {
          calls.push({ collection: name, method: 'getOne', args: [id] });
          const found = records[`${name}:${id}`];
          if (!found) throw Object.assign(new Error('not found'), { status: 404 });
          return found;
        },
        async update(id: string, data: Record<string, unknown>) {
          calls.push({ collection: name, method: 'update', args: [id, data] });
          const merged = { ...(records[`${name}:${id}`] ?? {}), ...data, id };
          records[`${name}:${id}`] = merged;
          return merged;
        },
        async create(data: Record<string, unknown>) {
          const id = `rec${nextId++}`;
          calls.push({ collection: name, method: 'create', args: [data] });
          const created = { ...data, id };
          records[`${name}:${id}`] = created;
          return created;
        },
        async delete(id: string) {
          calls.push({ collection: name, method: 'delete', args: [id] });
          delete records[`${name}:${id}`];
        },
        async getFullList(options: Record<string, unknown>) {
          calls.push({ collection: name, method: 'getFullList', args: [options] });
          return records[`${name}:list`] ?? [];
        },
        // Paged reads answer from the same `:list` bucket as `getFullList`, so a
        // test seeds one collection one way whichever read it is exercising.
        // `totalItems` is what the counters read, so it is the length rather
        // than a fixed number.
        async getList(page: number, perPage: number, options: Record<string, unknown>) {
          calls.push({ collection: name, method: 'getList', args: [page, perPage, options] });
          const items = (records[`${name}:list`] ?? []) as unknown as Record<string, unknown>[];
          return { items, page, perPage, totalItems: items.length, totalPages: 1 };
        },
        async getFirstListItem(filter: string, options: Record<string, unknown>) {
          calls.push({ collection: name, method: 'getFirstListItem', args: [filter, options] });
          const items = (records[`${name}:list`] ?? []) as unknown as Record<string, unknown>[];
          if (!items.length) throw Object.assign(new Error('not found'), { status: 404 });
          return items[0];
        },
      };
    },
  };

  return { client: client as unknown as Client, calls, records };
}

const actor: StaffActor = { id: 'staff1', label: 'miles' };

const auditRows = (calls: readonly Call[]) =>
  calls
    .filter((c) => c.collection === 'audit_log' && c.method === 'create')
    .map((c) => c.args[0] as Record<string, unknown>);

describe('applyStaffChange', () => {
  it('writes an audit row naming the staff member, not the superuser', async () => {
    const { client, calls } = fakeClient({ 'users:u1': { id: 'u1', plan: 'rookie' } });

    await applyStaffChange(client, {
      actor,
      collection: 'users',
      id: 'u1',
      action: 'admin.plan_override',
      patch: { plan: 'shredder' },
    });

    const [row] = auditRows(calls);
    expect(row).toBeDefined();
    // The whole reason the server action writes its own row: the hook's row,
    // written inside the transaction, can only see the superuser token.
    expect(row?.actor).toBe('staff1');
    expect(row?.actor_kind).toBe('staff');
    expect(row?.actor_label).toBe('miles');
    expect(row?.action).toBe('admin.plan_override');
    expect(row?.entity).toBe('users');
    expect(row?.entity_id).toBe('u1');
  });

  it('records the fields that moved and nothing else', async () => {
    const { client, calls } = fakeClient({
      'users:u1': { id: 'u1', plan: 'rookie', email: 'kid@example.invalid', town: 'Coventry' },
    });

    await applyStaffChange(client, {
      actor,
      collection: 'users',
      id: 'u1',
      action: 'admin.plan_override',
      patch: { plan: 'legend' },
    });

    const [row] = auditRows(calls);
    expect(row?.before).toEqual({ plan: 'rookie' });
    expect(row?.after).toEqual({ plan: 'legend' });
    // A row carrying the whole record would put a child's email address into a
    // log that is kept indefinitely, for a change that was about their plan.
    expect(JSON.stringify(row)).not.toContain('kid@example.invalid');
  });

  it('reads the record before it writes, so `before` is the old value', async () => {
    const { client, calls } = fakeClient({ 'users:u1': { id: 'u1', suspended: false } });

    await applyStaffChange(client, {
      actor,
      collection: 'users',
      id: 'u1',
      action: 'admin.suspend',
      patch: { suspended: true },
    });

    const order = calls.map((c) => `${c.collection}.${c.method}`);
    expect(order).toEqual(['users.getOne', 'users.update', 'audit_log.create']);
  });

  it('does not log a change that never happened', async () => {
    const { client, calls } = fakeClient(); // no such record

    await expect(
      applyStaffChange(client, {
        actor,
        collection: 'users',
        id: 'missing',
        action: 'admin.plan_override',
        patch: { plan: 'shredder' },
      }),
    ).rejects.toThrow();

    // Logging first and mutating second would invent history. The order in the
    // test above is the whole safeguard, and this is its other half.
    expect(auditRows(calls)).toHaveLength(0);
  });
});

describe('the two rider writes', () => {
  it('names the plan override in the log', async () => {
    const { client, calls } = fakeClient({ 'users:u1': { id: 'u1', plan: 'rookie' } });
    await setRiderPlan(client, actor, 'u1', 'legend');
    expect(auditRows(calls)[0]?.action).toBe('admin.plan_override');
  });

  it('tells suspending and restoring apart in the log', async () => {
    const { client, calls } = fakeClient({ 'users:u1': { id: 'u1', suspended: false } });

    await setRiderSuspended(client, actor, 'u1', true);
    await setRiderSuspended(client, actor, 'u1', false);

    // Two rows with the same verb would make an account's history unreadable:
    // "changed" three times says nothing about whether it is open now.
    expect(auditRows(calls).map((r) => r.action)).toEqual(['admin.suspend', 'admin.restore']);
  });
});

describe('deleteStaffRecord', () => {
  it('keeps the whole record in `before`, because nothing else will have it', async () => {
    const { client, calls } = fakeClient({
      'spots:s1': { id: 's1', name: 'Memorial Park', status: 'pending' },
    });

    await deleteStaffRecord(client, {
      actor,
      collection: 'spots',
      action: 'admin.spot_reject',
      id: 's1',
    });

    const [row] = auditRows(calls);
    expect(row?.before).toMatchObject({ name: 'Memorial Park', status: 'pending' });
    expect(row?.after).toBeNull();
  });
});

describe('landedCountsFor', () => {
  it('tallies one request into a count per rider', async () => {
    const { client } = fakeClient({
      'trick_progress:list': [{ user: 'u1' }, { user: 'u1' }, { user: 'u2' }] as unknown as Record<
        string,
        unknown
      >,
    });

    const counts = await landedCountsFor(client, ['u1', 'u2', 'u3'], ['some', 'most', 'every']);

    expect(counts).toEqual({ u1: 2, u2: 1 });
    // `u3` is absent rather than zero, which is why the caller reads it as
    // `counts[id] ?? 0`.
    expect(counts.u3).toBeUndefined();
  });

  it('binds every id and stage as a parameter, never into the filter string', async () => {
    const { client, calls } = fakeClient();

    await landedCountsFor(client, ['u1', 'u2'], ['every']);

    const [call] = calls.filter((c) => c.method === 'getFullList');
    const options = call?.args[0] as { filter?: string };
    // The privacy rules are written in this same filter language, so an id
    // concatenated in is an injection into the rules themselves.
    expect(options.filter).toContain('{:u0}');
    expect(options.filter).toContain('{:u1}');
    expect(options.filter).toContain('{:s0}');
    expect(options.filter).not.toContain('u1"');
  });

  it('asks for nothing when there is nobody to ask about', async () => {
    const { client, calls } = fakeClient();
    await expect(landedCountsFor(client, [], ['every'])).resolves.toEqual({});
    // An empty `or` chain is `()`, which is a filter syntax error rather than
    // an empty result — the early return is load-bearing, not a micro-optimisation.
    expect(calls).toHaveLength(0);
  });
});

/**
 * T17's content-tab reads and the two writes it adds.
 *
 * The theme of the reads is one thing and it is worth a test each: they must
 * **not** carry the `is_live = true` filter their rider-facing twins carry. A
 * staff editor that inherited it would lose every record staff had hidden —
 * including the one they had just hidden, which would then be unreachable from
 * the product and only restorable from the PocketBase dashboard. The failure is
 * silent and looks exactly like "the record was deleted", which is why the
 * absence of a filter is asserted rather than assumed.
 */
describe('the content-tab reads', () => {
  const optionsOf = (calls: readonly Call[], method: string) =>
    (calls.find((c) => c.method === method)?.args.at(-1) ?? {}) as {
      filter?: string;
      params?: Record<string, unknown>;
      sort?: string;
    };

  it('reads stickers, plans, events and announcements without the live filter', async () => {
    for (const [read, collection] of [
      [listAdminStickers, 'stickers'],
      [listAdminPlans, 'plans'],
      [listAdminEvents, 'events'],
      [listAdminAnnouncements, 'announcements'],
    ] as const) {
      const { client, calls } = fakeClient();
      await read(client);
      const options = optionsOf(calls, 'getFullList');
      expect(options.filter, `${collection} must not filter on is_live`).toBeUndefined();
    }
  });

  it('reads every spot, and binds a status filter as a parameter when given one', async () => {
    const { client: all, calls: allCalls } = fakeClient();
    await listAdminSpots(all);
    // No filter at all: the queue screen shows pending, live and rejected in
    // three sections, and the API rule that hides pending spots from riders is
    // exactly what this read exists to see past.
    expect(optionsOf(allCalls, 'getFullList').filter).toBeUndefined();

    const { client, calls } = fakeClient();
    await listAdminSpots(client, 'pending');
    // The status reaches the filter as a placeholder, never concatenated in —
    // the same rule `landedCountsFor` is held to above, and for the same reason:
    // the privacy rules are written in this filter language.
    expect(optionsOf(calls, 'getFullList').filter).toBe('status = {:status}');
  });

  it('pages reports rather than listing them', async () => {
    const { client, calls } = fakeClient();
    await listReports(client, { status: 'open' }, { page: 2, perPage: 10 });

    // `reports` has an open create rule — anyone on the internet can add a row —
    // so a screen built on `getFullList` gets slower every time somebody reports
    // something. Paging is the point, not a preference.
    const call = calls.find((c) => c.method === 'getList');
    expect(call?.args[0]).toBe(2);
    expect(call?.args[1]).toBe(10);
    expect(optionsOf(calls, 'getList').filter).toBe('status = {:status}');
  });

  it('counts one status at a time, and names them all in the result', async () => {
    const { client } = fakeClient({
      'reports:list': [{ id: 'r1' }, { id: 'r2' }] as unknown as Record<string, unknown>,
    });

    const counts = await reportCounts(client, ['open', 'reviewing', 'actioned', 'dismissed']);

    // Every status is a key, including the ones with nothing at them: a filter
    // pill that vanished when its queue emptied would read as a broken screen.
    expect(Object.keys(counts)).toEqual(['open', 'reviewing', 'actioned', 'dismissed']);
    expect(counts.open).toBe(2);
  });
});

describe('the content-tab writes', () => {
  it('tells the three spot decisions apart in the log', async () => {
    const { client, calls } = fakeClient({ 'spots:s1': { id: 's1', status: 'pending' } });

    await setSpotStatus(client, actor, 's1', 'live');
    await setSpotStatus(client, actor, 's1', 'rejected');
    await setSpotStatus(client, actor, 's1', 'pending');

    // "Changed a spot" three times would not say whether it is on the map now,
    // which is the only question the log gets asked about the queue.
    expect(auditRows(calls).map((r) => r.action)).toEqual([
      'admin.spot_live',
      'admin.spot_rejected',
      'admin.spot_pending',
    ]);
  });

  it('writes a report’s status and outcome together, and logs both', async () => {
    const { client, calls } = fakeClient({
      'reports:r1': { id: 'r1', status: 'open', outcome: '' },
    });

    await setReportTriage(client, actor, 'r1', {
      status: 'actioned',
      outcome: 'Clip removed and the account warned.',
    });

    const [row] = auditRows(calls);
    expect(row?.action).toBe('admin.report_actioned');
    expect(row?.before).toEqual({ status: 'open', outcome: '' });
    expect(row?.after).toEqual({
      status: 'actioned',
      outcome: 'Clip removed and the account warned.',
    });
  });

  it('clears the outcome rather than leaving a stale one behind', async () => {
    const { client, records } = fakeClient({
      'reports:r1': { id: 'r1', status: 'actioned', outcome: 'Removed.' },
    });

    await setReportTriage(client, actor, 'r1', { status: 'dismissed' });

    // A decision reversed with the old sentence still attached is a record that
    // says two different things about the same report.
    expect(records['reports:r1']?.outcome).toBe('');
  });
});
