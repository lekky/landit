import { describe, expect, it } from 'vitest';

import {
  describeVideoCheckRun,
  videoCheckLogEntry,
  videoCheckRunRow,
  type VideoCheckLogEntry,
} from './video-check-log';

const entry = (over: Partial<VideoCheckLogEntry> = {}): VideoCheckLogEntry => ({
  slug: 'sk-ollie',
  name: 'Ollie',
  videoId: 'XLVraCnI5Kc',
  action: 'off',
  reason: 'deleted or private',
  ...over,
});

describe('one line of history', () => {
  it('records a switch-off with the reason', () => {
    const line = videoCheckLogEntry(
      { slug: 'sk-ollie', hidden: true, offReason: 'deleted or private' },
      { name: 'Ollie', videoId: 'XLVraCnI5Kc' },
    );

    expect(line).toEqual({
      slug: 'sk-ollie',
      name: 'Ollie',
      videoId: 'XLVraCnI5Kc',
      action: 'off',
      reason: 'deleted or private',
    });
  });

  it('drops the reason for a tutorial put back', () => {
    // A video that plays again needs no account of itself, and carrying the
    // stale "deleted or private" forward would read as a fresh switch-off.
    const line = videoCheckLogEntry(
      { slug: 'sk-ollie', hidden: false, offReason: 'deleted or private' },
      { name: 'Ollie', videoId: 'XLVraCnI5Kc' },
    );

    expect(line.action).toBe('back');
    expect(line.reason).toBe('');
  });
});

describe('the row a run writes', () => {
  it('counts each direction separately', () => {
    const row = videoCheckRunRow({
      checked: 167,
      changes: [entry(), entry({ slug: 'bmx-decade' }), entry({ action: 'back', reason: '' })],
    });

    expect(row.checked).toBe(167);
    expect(row.hidden).toBe(2);
    expect(row.restored).toBe(1);
    expect(row.changes).toHaveLength(3);
    expect(row.note).toBe('');
  });

  it('writes a row on a night that changed nothing', () => {
    // The whole reason this is a row per run: a silent history cannot tell
    // "all healthy" from "the job stopped running".
    const row = videoCheckRunRow({ checked: 167, changes: [] });

    expect(row.checked).toBe(167);
    expect(row.hidden).toBe(0);
    expect(row.restored).toBe(0);
    expect(row.changes).toEqual([]);
  });

  it('carries a note when the run had something to say', () => {
    expect(videoCheckRunRow({ checked: 0, changes: [], note: 'quota refused' }).note).toBe(
      'quota refused',
    );
  });
});

describe('the summary line', () => {
  it('says what changed, in both directions', () => {
    expect(describeVideoCheckRun({ hidden: 2, restored: 0 })).toBe('2 switched off');
    expect(describeVideoCheckRun({ hidden: 0, restored: 3 })).toBe('3 back on');
    expect(describeVideoCheckRun({ hidden: 2, restored: 3 })).toBe('2 switched off, 3 back on');
  });

  it('says so out loud when nothing changed', () => {
    expect(describeVideoCheckRun({ hidden: 0, restored: 0 })).toBe('No changes');
  });
});
