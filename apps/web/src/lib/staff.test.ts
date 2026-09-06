import { afterEach, describe, expect, it, vi } from 'vitest';

import { isOwner, isStaff } from './staff';

/**
 * The owner gate, tested for the thing that would be dangerous to get wrong:
 * what an unconfigured box answers.
 *
 * `requireStaff` is not here. It redirects and 404s by throwing Next's own
 * control-flow errors and needs a request context to do it, which is a test of
 * the framework rather than of us — the role rule itself is proven over HTTP in
 * `pocketbase/tests/staff-role.test.ts`. What is worth pinning down in a unit
 * test is `isOwner`, because it is pure, because it decides whether an
 * irreversible action is available, and because its failure mode is silent.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isOwner', () => {
  it('is false for everybody when LANDIT_OWNER_ID is unset', () => {
    vi.stubEnv('LANDIT_OWNER_ID', '');
    // The whole point: a deploy nobody has configured has the destructive
    // action switched off, not open to whoever asks first.
    expect(isOwner({ id: 'anybody' })).toBe(false);
    expect(isOwner({ id: '' })).toBe(false);
  });

  it('is false when the id is only whitespace, which is how a blank env var arrives', () => {
    vi.stubEnv('LANDIT_OWNER_ID', '   ');
    expect(isOwner({ id: '   ' })).toBe(false);
  });

  it('is true only for the account named on the deploy', () => {
    vi.stubEnv('LANDIT_OWNER_ID', 'owner123');
    expect(isOwner({ id: 'owner123' })).toBe(true);
    expect(isOwner({ id: 'owner124' })).toBe(false);
    expect(isOwner({ id: 'OWNER123' })).toBe(false);
  });

  it('tolerates the padding a copy-pasted environment variable arrives with', () => {
    vi.stubEnv('LANDIT_OWNER_ID', '  owner123  ');
    expect(isOwner({ id: 'owner123' })).toBe(true);
  });

  it('is false for no rider at all', () => {
    vi.stubEnv('LANDIT_OWNER_ID', 'owner123');
    expect(isOwner(null)).toBe(false);
    expect(isOwner(undefined)).toBe(false);
  });

  it('is narrower than isStaff — the role does not carry the key', () => {
    vi.stubEnv('LANDIT_OWNER_ID', 'owner123');
    const otherStaff = { id: 'staff9', role: 'staff' } as const;
    expect(isStaff(otherStaff)).toBe(true);
    expect(isOwner(otherStaff)).toBe(false);
  });
});
