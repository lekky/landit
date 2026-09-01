import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The workspace packages ship TypeScript source rather than a build step, so
  // Next compiles them alongside the app. Adding a package to the workspace
  // means adding it here too.
  transpilePackages: ['@landit/core', '@landit/db', '@landit/ui-web'],

  // Without this Next guesses the trace root from the nearest lockfile and warns
  // in a monorepo.
  outputFileTracingRoot: path.join(here, '..', '..'),

  typedRoutes: true,

  /**
   * The service worker is bundled from `src/sw/service-worker.ts`, so the
   * browser fetches it from `/_next/static/…` — and a worker is only allowed to
   * control the directory it was served from and below. Without this header a
   * worker asking for `scope: '/'` is refused outright, and the offline cache
   * silently never installs (T19).
   *
   * It is scoped to the bundler's own output, which is content-hashed and
   * same-origin. The alternative — shipping the worker as a static
   * `public/sw.js` — would mean it could not import the cache policy from
   * `@landit/core` and would carry a second copy of the allowlist instead.
   */
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Service-Worker-Allowed', value: '/' }],
      },

      /**
       * The award badges, cached for a day (owner, 2026-09-01, in chat).
       *
       * Next serves everything in `public/` as `Cache-Control: public,
       * max-age=0`, so a rider returning to the sticker wall re-validated all
       * ~65 badges on it one by one — 65 round trips to be told nothing had
       * changed. A day of freshness turns the second visit into no requests at
       * all.
       *
       * A day rather than a year of `immutable`, which is what a hashed asset
       * would get: these names are not content-addressed. `stickers.img` holds
       * the file name in the database, so re-drawing a badge keeps its URL, and
       * `immutable` would strand riders on the old art until they cleared their
       * cache. A day is the window a re-drawn badge can be stale for.
       */
      {
        source: '/stickers/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
    ];
  },
};

export default nextConfig;
