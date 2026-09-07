import { describe, expect, it } from 'vitest';

import type { Client } from './clients';
import { addTrickNote, deleteTrickNote, saveTrickNote, updateTrickNote } from './mutations';
import { getTrickNote, listTrickNotes } from './queries';

/**
 * The notes log's reads and writes (T30), tested where a stub can answer.
 *
 * What a stub can genuinely say: which filter and sort were asked for, what
 * shape was written, and that the pre-T30 `saveTrickNote` still lands on the
 * newest row rather than a fresh one. What it cannot say — that the cap holds,
 * that a stranger sees nothing, that the stage vocabulary is enforced — is
 * proven over HTTP against the real binary in `pocketbase/tests/trick-notes.test.ts`
 * (LESSONS §5: a rule tested against a stub is a test of the stub).
 */

interface Call {
  method: string;
  args: unknown[];
}

function fakeClient(list: Record<string, unknown>[] = []) {
  const calls: Call[] = [];
  let nextId = 1;
  const client = {
    filter: (expression: string) => expression,
    collection() {
      return {
        async getFullList(options: Record<string, unknown>) {
          calls.push({ method: 'getFullList', args: [options] });
          return list;
        },
        async getFirstListItem(filter: string, options: Record<string, unknown>) {
          calls.push({ method: 'getFirstListItem', args: [filter, options] });
          if (!list.length) throw Object.assign(new Error('not found'), { status: 404 });
          return list[0];
        },
        async create(data: Record<string, unknown>) {
          calls.push({ method: 'create', args: [data] });
          return { ...data, id: `rec${nextId++}` };
        },
        async update(id: string, data: Record<string, unknown>) {
          calls.push({ method: 'update', args: [id, data] });
          return { id, ...data };
        },
        async delete(id: string) {
          calls.push({ method: 'delete', args: [id] });
        },
      };
    },
  };
  return { client: client as unknown as Client, calls };
}

describe('listTrickNotes', () => {
  it('asks for one rider on one trick, newest first', async () => {
    const { client, calls } = fakeClient();
    await listTrickNotes(client, 'u1', 't1');
    expect(calls[0]?.method).toBe('getFullList');
    expect(calls[0]?.args[0]).toMatchObject({
      filter: 'user = {:user} && trick = {:trick}',
      sort: '-created',
    });
  });
});

describe('getTrickNote', () => {
  it('returns the newest note, not whichever row came first', async () => {
    const { client, calls } = fakeClient([{ id: 'newest', body: 'latest' }]);
    const note = await getTrickNote(client, 'u1', 't1');
    expect(note?.id).toBe('newest');
    expect(calls[0]?.args[1]).toMatchObject({ sort: '-created' });
  });

  it('is null when the log is empty', async () => {
    const { client } = fakeClient();
    expect(await getTrickNote(client, 'u1', 't1')).toBeNull();
  });
});

describe('addTrickNote', () => {
  it('writes the rider, the trick, the body and the stage snapshot', async () => {
    const { client, calls } = fakeClient();
    await addTrickNote(client, {
      userId: 'u1',
      trickId: 't1',
      body: 'heel, not toe',
      stage: 'trying',
    });
    expect(calls[0]?.args[0]).toEqual({
      user: 'u1',
      trick: 't1',
      body: 'heel, not toe',
      stage: 'trying',
    });
  });

  it('omits the stage entirely for an untracked trick, so the select stays empty', async () => {
    const { client, calls } = fakeClient();
    await addTrickNote(client, { userId: 'u1', trickId: 't1', body: 'x', stage: null });
    expect(calls[0]?.args[0]).toEqual({ user: 'u1', trick: 't1', body: 'x' });
    expect(calls[0]?.args[0]).not.toHaveProperty('stage');
  });
});

describe('updateTrickNote', () => {
  it('rewords one row and touches nothing else on it', async () => {
    const { client, calls } = fakeClient();
    await updateTrickNote(client, 'n1', 'second draft');
    expect(calls[0]).toEqual({ method: 'update', args: ['n1', { body: 'second draft' }] });
  });
});

describe('deleteTrickNote', () => {
  it('removes the row by id', async () => {
    const { client, calls } = fakeClient();
    await deleteTrickNote(client, 'n1');
    expect(calls[0]).toEqual({ method: 'delete', args: ['n1'] });
  });
});

describe('saveTrickNote (pre-T30 signature)', () => {
  it('rewords the newest note when the log has one', async () => {
    const { client, calls } = fakeClient([{ id: 'newest', body: 'old' }, { id: 'older' }]);
    await saveTrickNote(client, { userId: 'u1', trickId: 't1', body: 'new words' });
    expect(calls[0]?.method).toBe('getFirstListItem');
    expect(calls[0]?.args[1]).toMatchObject({ sort: '-created' });
    expect(calls[1]).toEqual({ method: 'update', args: ['newest', { body: 'new words' }] });
  });

  it('starts the log when there is none, and writes no stage', async () => {
    const { client, calls } = fakeClient();
    await saveTrickNote(client, { userId: 'u1', trickId: 't1', body: 'first' });
    expect(calls[1]).toEqual({
      method: 'create',
      args: [{ user: 'u1', trick: 't1', body: 'first' }],
    });
  });
});
