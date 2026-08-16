# The Next.js app, as Coolify deploys it.
#
# Built from the **repository root**, not from `apps/web` — this is a pnpm
# workspace and the app imports three sibling packages as source
# (`transpilePackages` in `next.config.ts`), so a build context narrower than
# the root cannot see them. Coolify's "Base Directory" therefore stays `/` and
# the Dockerfile path is `apps/web/Dockerfile`.
#
# Three stages so the image that runs is not the image that built: `deps` holds
# the whole `node_modules` tree, `builder` produces `.next`, and `runner` keeps
# only Next's standalone output. The result carries no pnpm store, no source and
# no dev dependencies.

# Pinned rather than `lts`: the same Node the workspace declares in `engines`
# and CI runs, so a build that passes there passes here.
ARG NODE_VERSION=22.12.0

# ------------------------------------------------------------------ base --
FROM node:${NODE_VERSION}-alpine AS base

# Corepack reads `packageManager` from the root package.json, so pnpm's version
# comes from the repo rather than from whatever the base image happens to ship.
#
# **Corepack is upgraded first, and that is not tidiness.** The copy bundled
# with Node 22.12.0 carries signing keys that no longer match npm's, so the
# first `pnpm` invocation dies with `Error: Cannot find matching keyid` while
# trying to verify the download — which reads like a network fault and is not
# one. Installing a current corepack fixes the keys while leaving
# `packageManager` as the single source of truth for the version.
RUN npm install --global corepack@latest && corepack enable

# ----------------------------------------------------------------- deps --
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
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Not root. The container has no business writing to its own filesystem.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# `output: 'standalone'` traces exactly the files the server needs and copies
# the workspace packages in with it, which is why this is three directories and
# not a `node_modules`. `outputFileTracingRoot` in `next.config.ts` is what
# makes the paths come out repo-relative.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

# The standalone server, at the path the trace put it.
CMD ["node", "apps/web/server.js"]
