/**
 * The e2e instance's fixture superuser.
 *
 * Not a secret and not pretending to be one: a throwaway database on a loopback
 * port, provisioned by the seed and thrown away with the data directory. The
 * same pair `pocketbase/tests/instance.ts` and `.github/workflows/ci.yml` use.
 *
 * It lives in its own module because three places need it and none of them
 * should import the other two: `seed-library.ts` mints it, `playwright.config.ts`
 * hands it to the Next server as `POCKETBASE_SUPERUSER_*`, and a spec may want
 * to name it. `playwright.config.ts` in particular must not reach into
 * `seed-library.ts`, which pulls `@landit/db` and the PocketBase SDK in at
 * config-parse time for two string constants.
 */
export const SUPERUSER_EMAIL = 'test-superuser@landit.invalid';
export const SUPERUSER_PASSWORD = 'a-long-local-test-password';
