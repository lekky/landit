/**
 * Registers `./ts-resolve-hooks.mjs` so a plain `node` run can import this
 * workspace's TypeScript source (issue #155). Passed with `--import`, which
 * runs before the entry module is loaded — the hooks have to be in place before
 * the first `import` is resolved, so `--require`-style late registration would
 * be too late.
 *
 * Two files rather than one because `module.register()` takes a *path* to the
 * hooks module and runs it on its own thread. `module.registerHooks()` would
 * collapse this into a single file, but it landed in Node 22.15 and this repo's
 * `engines` floor is 22.13 — so it would break the stated minimum for a
 * cosmetic saving.
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./ts-resolve-hooks.mjs', pathToFileURL(import.meta.filename)));
