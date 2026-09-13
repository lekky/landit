import { describe, expect, it } from 'vitest';

import {
  VIDEO_CHECK_BATCH,
  videoCheckBatches,
  videoCheckChange,
  verdictsFor,
  type VideoCheckRow,
} from './video-check';

const row = (over: Partial<VideoCheckRow> = {}): VideoCheckRow => ({
  id: 'r1',
  slug: 'ollie',
  videoId: 'aaaaaaaaaaa',
  hidden: false,
  offReason: '',
  ...over,
});

describe('batching', () => {
  it('asks in calls of fifty, because that is one quota unit', () => {
    const ids = Array.from({ length: 259 }, (_, i) => `id${i}`);
    const batches = videoCheckBatches(ids);

    expect(VIDEO_CHECK_BATCH).toBe(50);
    // The whole library in six calls and six units, which is the number that
    // made taking on the API defensible at all.
    expect(batches).toHaveLength(6);
    expect(batches.flat()).toEqual(ids);
    expect(batches.every((b) => b.length <= 50)).toBe(true);
  });

  it('has nothing to ask when nothing is curated', () => {
    expect(videoCheckBatches([])).toEqual([]);
  });
});

describe('reading YouTube’s answer', () => {
  it('treats an id missing from the response as dead', () => {
    // The load-bearing line. `videos.list` returns nothing at all for a deleted
    // or private video — no error, no tombstone, just a shorter list.
    const verdicts = verdictsFor(
      ['alive', 'gone'],
      [{ id: 'alive', status: { embeddable: true } }],
    );

    expect(verdicts.get('alive')).toEqual({ ok: true });
    expect(verdicts.get('gone')).toEqual({ ok: false, reason: 'deleted or private' });
  });

  it('catches embedding being turned off, which still returns the video', () => {
    const verdicts = verdictsFor(['no-embed'], [{ id: 'no-embed', status: { embeddable: false } }]);

    expect(verdicts.get('no-embed')).toEqual({ ok: false, reason: 'embedding turned off' });
  });

  it('counts anything it cannot read as alive', () => {
    // If the response shape moves under us, the failure has to be "nothing gets
    // switched off", never "the whole catalogue goes dark at 3am".
    const verdicts = verdictsFor(
      ['a', 'b', 'c'],
      [
        { id: 'a' },
        { id: 'b', status: null },
        { id: 'c', status: { embeddable: 'no' } },
        { id: 42 } as never,
      ],
    );

    expect(verdicts.get('a')).toEqual({ ok: true });
    expect(verdicts.get('b')).toEqual({ ok: true });
    expect(verdicts.get('c')).toEqual({ ok: true });
  });
});

describe('what changes on a trick', () => {
  it('switches off a dead video and records why', () => {
    const change = videoCheckChange(row(), { ok: false, reason: 'deleted or private' });

    expect(change).toMatchObject({ hidden: true, offReason: 'deleted or private' });
    expect(change?.note).toContain('ollie');
  });

  it('leaves a healthy showing video alone', () => {
    expect(videoCheckChange(row(), { ok: true })).toBeNull();
  });

  it('does not rewrite a video it already switched off for the same reason', () => {
    const already = row({ hidden: true, offReason: 'deleted or private' });
    expect(videoCheckChange(already, { ok: false, reason: 'deleted or private' })).toBeNull();
  });

  it('updates the reason when the same video fails a different way', () => {
    const already = row({ hidden: true, offReason: 'deleted or private' });
    const change = videoCheckChange(already, { ok: false, reason: 'embedding turned off' });

    expect(change).toMatchObject({ hidden: true, offReason: 'embedding turned off' });
  });

  it('puts back a video that it hid itself and that now works', () => {
    const mine = row({ hidden: true, offReason: 'deleted or private' });
    const change = videoCheckChange(mine, { ok: true });

    expect(change).toMatchObject({ hidden: false, offReason: '' });
    expect(change?.note).toContain('back on');
  });

  it('never overturns a hide a staff member made', () => {
    // The job always writes a reason; the staff portal never does. So an empty
    // reason on a hidden row means a person decided, and a job that undid that
    // every night would be a bug that looks like a haunting.
    const theirs = row({ hidden: true, offReason: '' });

    expect(videoCheckChange(theirs, { ok: true })).toBeNull();
  });
});
