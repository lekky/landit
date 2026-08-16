# The Next.js app, as Coolify deploys it.
#
# Built from the **repository root**, not from `apps/web` — this is a pnpm
# workspace and the app imports three sibling packages as source
# (`transpilePackages` in `next.config.ts`), so a build context narrower than
# the root cannot see them. Coolify's "Base Directory" therefore stays `/` and
# the Dockerfile path is `apps/web/Dockerfile`.
#
# **This image ships the real `node_modules` and runs `next start`.** The obvious
# alternative — Next's `output: 'standalone'`, which traces the handful of files
# the server needs into a much smaller image — was tried first and abandoned
# after three failed deploys. Its file tracer cannot follow pnpm's symlinked
# store reliably: `@swc/helpers` came out missing, the image built perfectly and
# then crash-looped on `Cannot find module`. Worse, pnpm names that store
# differently on Windows than on Linux, so the traced tree on a developer's
# machine is not the tree in the image and the fault cannot be reproduced
# locally at all.
#
# Every documented escape (`node-linker=hoisted` in `.npmrc`, `nodeLinker` in
# `pnpm-workspace.yaml`, `--config.nodeLinker`, `pnpm config set`) is silently
# ignored by pnpm 11.22.0 — all four were tested. So the trade here is
# deliberate: a larger image that resolves modules the ordinary way, on a box
# with 40GB of disk and one app on it. **If you are tempted to reintroduce
# standalone to save space, that is the history you are re-running.**

# 24, matching CI's `node-version: 24`, so a build that passes there passes here.
# It cannot be the `engines` floor: that says >=22.13.0, and pnpm 11.22.0 refuses
# to start on anything lower.
ARG NODE_VERSION=24

# ------------------------------------------------------------------ base --
FROM node:${NODE_VERSION}-alpine AS base

# Corepack reads `packageManager` from the root package.json, so pnpm's version
# comes from the repo rather than from whatever the base image happens to ship.
#
# **Corepack is upgraded first, and that is not tidiness.** The copy bundled with
# Node's images carries signing keys that no longer match npm's, so the first
# `pnpm` invocation dies with `Error: Cannot find matching keyid` while verifying
# its own download — which reads like a network fault and is not one.
RUN npm install --global corepack@latest && corepack enable

# ------------------------------------------------------------------ deps --
FROM base AS deps
WORKDIR /repo

# Only the manifests first: this layer is what Docker caches, and it should not
# be invalidated by a change to a component.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/ui-web/package.json packages/ui-web/
COPY pocketbase/package.json pocketbase/

# `--frozen-lockfile` is the point: a deploy must never quietly resolve a
# different dependency tree from the one CI tested.
RUN pnpm install --frozen-lockfile

# --------------------------------------------------------------- builder --
FROM base AS builder
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages ./packages
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# `NEXT_PUBLIC_*` is inlined at build time, not read at runtime, so the browser
# bundle's PocketBase URL is baked in here. Coolify passes it as a build
# argument; getting it wrong means a deployed app whose API calls go nowhere,
# and no amount of restarting fixes it.
ARG NEXT_PUBLIC_POCKETBASE_URL
ENV NEXT_PUBLIC_POCKETBASE_URL=${NEXT_PUBLIC_POCKETBASE_URL}

RUN pnpm --filter @landit/web build

# ---------------------------------------------------------------- runner --
FROM base AS runner
WORKDIR /repo

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Not root. The container has no business writing outside `.next/cache`.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# The whole built workspace, symlinks and all — which is the point: pnpm's layout
# is preserved exactly as it was installed, so module resolution at run time is
# the same resolution that worked at build time.
COPY --from=builder --chown=nextjs:nodejs /repo ./

USER nextjs
EXPOSE 3000

# `next start`, through the script the repo already defines, so the port and the
# flags live in one place (`apps/web/package.json`).
CMD ["pnpm", "--filter", "@landit/web", "start"]
