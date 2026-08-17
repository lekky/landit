import { describe, expect, it } from 'vitest';

import {
  CLIP_MAX_BYTES,
  clipFits,
  clipKindOf,
  clipUploadProblem,
  clipVault,
  formatBytes,
} from './clips';
import { PLAN } from '../data/plans';

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

describe('formatBytes', () => {
  it('quotes whole gigabytes without a trailing zero', () => {
    expect(formatBytes(2 * GB)).toBe('2GB');
    expect(formatBytes(5 * GB)).toBe('5GB');
  });

  it('keeps one decimal when the number is not whole', () => {
    expect(formatBytes(1.94 * GB)).toBe('1.9GB');
  });

  it('drops to megabytes below a gigabyte, and says so honestly below one', () => {
    expect(formatBytes(512 * MB)).toBe('512MB');
    expect(formatBytes(1024)).toBe('under 1MB');
    expect(formatBytes(0)).toBe('0MB');
  });

  it('never returns a locale-derived string', () => {
    // The panel renders on the server and again in the browser; a separator
    // that differs between the two is a hydration mismatch (LESSONS §3a).
    expect(formatBytes(1500 * MB)).not.toMatch(/[,\s\u00a0\u202f]/);
  });
});

describe('clipVault', () => {
  it('is not included at all when the plan carries no cap', () => {
    const vault = clipVault({ usedBytes: 0, capBytes: PLAN.rookie.clipCapBytes });
    expect(vault.included).toBe(false);
    expect(vault.full).toBe(true);
    expect(vault.usageLabel).toBeNull();
  });

  it('describes usage against the cap it was given, not against a plan id', () => {
    const vault = clipVault({ usedBytes: 1.9 * GB, capBytes: 2 * GB });
    expect(vault.usageLabel).toBe('1.9GB of 2GB used');
    expect(vault.full).toBe(false);
  });

  it('reports a downgraded rider as over-full rather than as owed space', () => {
    // Downgrade keeps existing clips viewable and blocks new saves (plan §6.6),
    // so "used" can exceed "cap" and the remainder must not go negative.
    const vault = clipVault({ usedBytes: 4 * GB, capBytes: 2 * GB });
    expect(vault.remainingBytes).toBe(0);
    expect(vault.full).toBe(true);
  });
});

describe('clipFits', () => {
  const vault = clipVault({ usedBytes: 2 * GB, capBytes: 5 * GB });

  it('allows a file that lands exactly on the cap', () => {
    expect(clipFits(vault, 3 * GB)).toBe(true);
  });

  it('refuses the byte past it', () => {
    expect(clipFits(vault, 3 * GB + 1)).toBe(false);
  });

  it('refuses everything on a plan with no vault', () => {
    expect(clipFits(clipVault({ usedBytes: 0, capBytes: 0 }), 1)).toBe(false);
  });
});

describe('clipKindOf', () => {
  it('reads a photo from its mime type and treats everything else as video', () => {
    expect(clipKindOf('image/jpeg')).toBe('photo');
    expect(clipKindOf('image/png')).toBe('photo');
    expect(clipKindOf('video/mp4')).toBe('video');
    expect(clipKindOf('')).toBe('video');
  });
});

describe('clipUploadProblem', () => {
  const shredder = clipVault({ usedBytes: 0, capBytes: PLAN.shredder.clipCapBytes });

  it('passes an ordinary clip', () => {
    expect(clipUploadProblem({ size: 8 * MB, type: 'video/mp4' }, shredder)).toBeNull();
  });

  it('refuses a plan with no vault before it looks at the file', () => {
    const rookie = clipVault({ usedBytes: 0, capBytes: 0 });
    expect(clipUploadProblem({ size: 1, type: 'video/mp4' }, rookie)).toMatch(/paid plans/i);
  });

  it('refuses a file type the collection would refuse', () => {
    expect(clipUploadProblem({ size: 1 * MB, type: 'application/pdf' }, shredder)).toMatch(
      /MP4, MOV or WebM/,
    );
  });

  it('refuses one oversized file even when the vault is empty', () => {
    expect(clipUploadProblem({ size: CLIP_MAX_BYTES + 1, type: 'video/mp4' }, shredder)).toMatch(
      /up to 200MB/,
    );
  });

  it('offers deleting a clip when the vault is what is in the way', () => {
    const nearlyFull = clipVault({ usedBytes: 2 * GB - MB, capBytes: 2 * GB });
    expect(clipUploadProblem({ size: 8 * MB, type: 'video/mp4' }, nearlyFull)).toMatch(
      /Delete a clip to make room/,
    );
  });
});
