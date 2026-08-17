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
    ];
  },
};

export default nextConfig;
