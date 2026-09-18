import { afterEach, describe, expect, it, vi } from 'vitest';

import { sessionsEnabledFor, sessionsEnabledForViewer } from './sessionsPreview';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('sessionsEnabledFor', () => {
  it('shows sessions to the owner named on the deploy', () => {
    vi.stubEnv('LANDIT_SESSIONS_OPEN', '');
    vi.stubEnv('LANDIT_OWNER_ID', 'owner123');
    expect(sessionsEnabledFor({ id: 'owner123' })).toBe(true);
  });

  it('hides them from every other rider', () => {
    vi.stubEnv('LANDIT_SESSIONS_OPEN', '');
    vi.stubEnv('LANDIT_OWNER_ID', 'owner123');
    expect(sessionsEnabledFor({ id: 'rider456' })).toBe(false);
  });

  it('hides them from everybody when no owner is configured', () => {
    vi.stubEnv('LANDIT_SESSIONS_OPEN', '');
    vi.stubEnv('LANDIT_OWNER_ID', '');
    expect(sessionsEnabledFor({ id: 'owner123' })).toBe(false);
  });

  it('hides them from a signed-out visitor', () => {
    vi.stubEnv('LANDIT_SESSIONS_OPEN', '');
    vi.stubEnv('LANDIT_OWNER_ID', 'owner123');
    expect(sessionsEnabledFor(null)).toBe(false);
  });

  it('opens them to everyone, signed out included, when LANDIT_SESSIONS_OPEN is 1', () => {
    vi.stubEnv('LANDIT_SESSIONS_OPEN', '1');
    vi.stubEnv('LANDIT_OWNER_ID', 'owner123');
    expect(sessionsEnabledFor({ id: 'rider456' })).toBe(true);
    // A visitor sees the /plans comparison and is sent to sign in by a session
    // page, as before the preview; the blocks still need a rider of their own.
    expect(sessionsEnabledFor(null)).toBe(true);
  });

  it('treats any other value of LANDIT_SESSIONS_OPEN as closed', () => {
    vi.stubEnv('LANDIT_OWNER_ID', 'owner123');
    for (const value of ['true', 'yes', '0', ' ']) {
      vi.stubEnv('LANDIT_SESSIONS_OPEN', value);
      expect(sessionsEnabledFor({ id: 'rider456' })).toBe(false);
    }
  });
});

describe('sessionsEnabledForViewer', () => {
  /*
   * The half of the question a screen forgets (T52). The case that matters is
   * the last one: with the flag set — which is how sessions are released — the
   * rider-shaped question answers `true` for nobody at all, and a screen that
   * asked it that way put a session control in front of a signed-out visitor on
   * a public page. The e2e cannot cover this, because its own server runs with
   * the flag on and every rider it makes is signed in.
   */
  it('is true for a signed-in rider the preview covers', () => {
    vi.stubEnv('LANDIT_SESSIONS_OPEN', '');
    vi.stubEnv('LANDIT_OWNER_ID', 'owner123');
    expect(sessionsEnabledForViewer({ rider: { id: 'owner123' } })).toBe(true);
  });

  it('is false for a signed-in rider it does not', () => {
    vi.stubEnv('LANDIT_SESSIONS_OPEN', '');
    vi.stubEnv('LANDIT_OWNER_ID', 'owner123');
    expect(sessionsEnabledForViewer({ rider: { id: 'rider456' } })).toBe(false);
  });

  it('is false for a visitor even when sessions are open to everyone', () => {
    vi.stubEnv('LANDIT_SESSIONS_OPEN', '1');
    vi.stubEnv('LANDIT_OWNER_ID', 'owner123');
    expect(sessionsEnabledForViewer(null)).toBe(false);
    expect(sessionsEnabledForViewer(undefined)).toBe(false);
    // …where the rider-shaped question says yes to nobody, which is the trap.
    expect(sessionsEnabledFor(null)).toBe(true);
  });
});
