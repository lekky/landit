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
};

export default nextConfig;
