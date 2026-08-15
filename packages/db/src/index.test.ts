import { describe, expect, it } from 'vitest';

import { CORE_PACKAGE } from '@landit/core';

import { DB_PACKAGE } from './index';

describe('@landit/db scaffold', () => {
  it('is importable and reports its own name', () => {
    expect(DB_PACKAGE).toBe('@landit/db');
  });

  it('can import across the workspace', () => {
    expect(CORE_PACKAGE).toBe('@landit/core');
  });
});
