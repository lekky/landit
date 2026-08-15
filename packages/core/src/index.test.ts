import { describe, expect, it } from 'vitest';

import { CORE_PACKAGE } from './index';

describe('@landit/core scaffold', () => {
  it('is importable and reports its own name', () => {
    expect(CORE_PACKAGE).toBe('@landit/core');
  });
});
