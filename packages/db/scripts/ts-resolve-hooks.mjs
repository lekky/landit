/**
 * A resolver hook that supplies the file extensions Node's type stripping does
 * not infer (issue #155).
 *
 * **Why this exists.** `@landit/core` and `@landit/db` ship TypeScript source
 * with no build step — their `exports` point straight at `./src/index.ts` — and
 * that source imports the way a bundler expects:
 *
 * ```ts
 * export * from './types';   // not './types.ts'
 * ```
 *
 * Next resolves those through `transpilePackages` and vitest through Vite, so
 * the app and every test are fine. `node --experimental-strip-types` is the one
 * consumer that is not: stripping types removes annotations and rewrites
 * nothing, so Node's ESM resolver is left asking for a file called `types` and
 * throwing `ERR_MODULE_NOT_FOUND`. There are ~213 such imports across the two
 * packages, so the seed could not run at all.
 *
 * **Why a hook rather than a runner.** `tsx` would also fix it, at the cost of
 * 378 packages and an `esbuild` entry in `allowBuilds` — a build script this
 * repo curates deliberately, one line at a time. Twenty lines here buys the
 * same thing with no dependency and no new install step.
 *
 * **Why it is safe to guess.** The retry only happens *after* normal resolution
 * has already failed, and it only ever appends an extension to a specifier that
 * is otherwise unresolvable. A module that resolves stays resolved by the
 * ordinary rules; a genuinely missing one still throws, because the original
 * error is rethrown once every candidate has been tried.
 */

/** Tried in order, and only on a specifier Node could not resolve as written. */
const CANDIDATE_SUFFIXES = ['.ts', '.mts', '/index.ts', '/index.mts'];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    for (const suffix of CANDIDATE_SUFFIXES) {
      try {
        return await nextResolve(specifier + suffix, context);
      } catch {
        // Try the next candidate. Swallowing here is deliberate: the only error
        // worth reporting is the original one, thrown below.
      }
    }

    throw error;
  }
}
