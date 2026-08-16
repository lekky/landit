import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Traces the exact files the server needs into `.next/standalone`, so the
  // deployed image carries no pnpm store, no sources and no dev dependencies —
  // see `Dockerfile`. It needs `outputFileTracingRoot` below to be right, or the
  // workspace packages are traced from the wrong place and go missing at run
  // time rather than at build time.
  output: 'standalone',

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
