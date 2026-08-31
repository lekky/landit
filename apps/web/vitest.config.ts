import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * `apps/web`'s unit tests — deliberately a very short list.
 *
 * The root config used to say this package was "deliberately absent: screens
 * are covered by Playwright, not by unit tests", and that still holds for
 * screens. T15 added the one thing Playwright cannot reach: the Stripe webhook
 * signature check. Proving it needs a payload signed the way Stripe signs one
 * and a second, tampered payload that must be refused — an assertion about a
 * digest, made without a browser and without a Stripe account.
 *
 * `include` is narrow on purpose. This is not an invitation to unit-test
 * components; a screen tested here is a screen tested twice, and the copy
 * decisions that matter are asserted against the rendered page in `e2e/`
 * (LESSONS §3a).
 *
 * The `@/` alias is resolved here so a test under `src/lib/` can reach a pure
 * module that happens to live elsewhere in the tree — `components/shell/nav.ts`
 * is arrays and one predicate, with no JSX in it. That is not a widening of the
 * rule above: the rule is about screens, and the `include` glob that enforces
 * it is untouched.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    name: '@landit/web',
    include: ['src/lib/**/*.test.ts'],
    environment: 'node',
  },
});
