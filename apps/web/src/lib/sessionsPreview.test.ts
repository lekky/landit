import { afterEach, describe, expect, it, vi } from 'vitest';

import { sessionsEnabledFor } from './sessionsPreview';

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
