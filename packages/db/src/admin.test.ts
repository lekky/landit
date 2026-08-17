import { describe, expect, it } from 'vitest';

import {
  applyStaffChange,
  deleteStaffRecord,
  landedCountsFor,
  setRiderPlan,
  setRiderSuspended,
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
 * Only the four methods this module uses. Anything else throws rather than
 * silently returning `undefined`, so a future signature change surfaces here
 * instead of producing an empty audit row nobody notices.
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
        async getList() {
          throw new Error('getList is not stubbed');
        },
        async getFirstListItem() {
          throw new Error('getFirstListItem is not stubbed');
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
