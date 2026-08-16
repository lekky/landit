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
  //
  // **This is why `@swc/helpers` is a dependency of this app.** Nothing here
  // imports it; Next's compiled output does, and under pnpm's symlinked layout
  // the tracer does not find it on its own. Without the explicit dependency the
  // image builds perfectly and then crash-loops on
  // `Cannot find module '.../@swc/helpers/esm/_interop_require_default.js'`.
  // It looks like an unused dependency and is not one — do not prune it.
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
