import { describe, expect, it } from 'vitest';

import {
  editSessionHref,
  isRecordId,
  newSessionHref,
  readNewSessionPrefill,
  sessionHref,
  sessionsHref,
} from './sessionRoutes';

const SESSION = 'abc123def456ghi';
const SPOT = 'spot00000000001';
const EVENT = 'event0000000001';
const TRICK = 'trick0000000001';

describe('session routes', () => {
  it('builds the list, detail and edit paths', () => {
    expect(sessionsHref()).toBe('/progress/sessions');
    expect(sessionHref(SESSION)).toBe(`/progress/sessions/${SESSION}`);
    expect(editSessionHref(SESSION)).toBe(`/progress/sessions/${SESSION}/edit`);
  });

  it('builds the new-session path, with the prefill in a fixed order', () => {
    expect(newSessionHref()).toBe('/progress/sessions/new');
    expect(newSessionHref({ quick: true, trick: TRICK, event: EVENT, spot: SPOT })).toBe(
      `/progress/sessions/new?spot=${SPOT}&event=${EVENT}&trick=${TRICK}&quick=1`,
    );
    expect(newSessionHref({ spot: SPOT })).toBe(`/progress/sessions/new?spot=${SPOT}`);
    expect(newSessionHref({ quick: false })).toBe('/progress/sessions/new');
  });

  it('refuses to put anything but a record id in a URL', () => {
    for (const bad of [
      'Tennis court kerb',
      'tailwhip',
      '../admin',
      'ABC123DEF456GHI',
      '',
      'a'.repeat(16),
    ]) {
      expect(() => sessionHref(bad), bad).toThrow();
      expect(() => editSessionHref(bad), bad).toThrow();
    }
    expect(() => newSessionHref({ spot: 'Adrenaline Alley' })).toThrow();
    expect(() => newSessionHref({ trick: 'sk-kickflip' })).toThrow();
    expect(isRecordId(SESSION)).toBe(true);
    expect(isRecordId(null)).toBe(false);
  });
});

describe('readNewSessionPrefill', () => {
  it('reads ids and quick back out', () => {
    expect(readNewSessionPrefill({ spot: SPOT, event: EVENT, trick: TRICK, quick: '1' })).toEqual({
      spot: SPOT,
      event: EVENT,
      trick: TRICK,
      quick: true,
    });
  });

  it('drops anything that is not an id, and takes the first of a repeated param', () => {
    expect(
      readNewSessionPrefill({
        spot: 'Tennis court kerb',
        event: [EVENT, 'other'],
        trick: '<script>',
        quick: 'yes',
      }),
    ).toEqual({ event: EVENT });
    expect(readNewSessionPrefill({})).toEqual({});
  });

  it('round-trips what newSessionHref wrote', () => {
    const href = newSessionHref({ spot: SPOT, quick: true });
    const params = Object.fromEntries(new URL(href, 'https://landthetrick.com').searchParams);
    expect(readNewSessionPrefill(params)).toEqual({ spot: SPOT, quick: true });
  });
});
