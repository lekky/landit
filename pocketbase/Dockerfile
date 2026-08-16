# PocketBase, as Coolify deploys it.
#
# There is no official PocketBase image, and a community one would not carry
# *our* migrations and hooks — which are the schema, the four security
# guarantees and the consent flow. This builds the same thing `pnpm pb:dev`
# runs locally: the pinned binary, this repo's `migrations/`, this repo's
# `hooks/`.
#
# Built from the **repository root** so the paths below match the ones in
# `scripts/pocketbase.mjs`. Coolify's Base Directory stays `/`, Dockerfile path
# is `pocketbase/Dockerfile`.

# Must match `pocketbase/pocketbase.version`. A test pins the two together
# (`tests/dockerfile-version.test.ts`) so an upgrade cannot update one and leave
# the other — which would deploy a different PocketBase from the one the
# guarantee tests ran against.
ARG POCKETBASE_VERSION=0.39.11

# ---------------------------------------------------------------- fetch --
FROM alpine:3.20 AS fetch
ARG POCKETBASE_VERSION
ARG TARGETARCH
WORKDIR /out

RUN apk add --no-cache ca-certificates unzip wget

# `TARGETARCH` is Docker's (`amd64`, `arm64`), which happens to be exactly what
# PocketBase names its release assets — the box is amd64, but a build on an
# Apple machine should not silently produce a broken image either.
RUN set -eux; \
  asset="pocketbase_${POCKETBASE_VERSION}_linux_${TARGETARCH:-amd64}.zip"; \
  wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/${asset}"; \
  unzip -q "${asset}"; \
  rm "${asset}"; \
  chmod +x pocketbase; \
  ./pocketbase --version

# ---------------------------------------------------------------- runner --
FROM alpine:3.20 AS runner
WORKDIR /pb

RUN apk add --no-cache ca-certificates tzdata \
  && addgroup -S pocketbase && adduser -S -G pocketbase pocketbase

COPY --from=fetch /out/pocketbase /usr/local/bin/pocketbase

# The schema and the rules. Copied rather than mounted: an instance whose
# migrations came from somewhere other than this commit is not the thing CI
# tested.
COPY --chown=pocketbase:pocketbase pocketbase/migrations ./migrations
COPY --chown=pocketbase:pocketbase pocketbase/hooks ./hooks

# The database and uploaded files. **This must be a persistent volume in
# Coolify**, and its `data.db` is the path that goes into `/etc/litestream.yml`
# — a PocketBase whose database is not in that file is not backed up
# (`docs/infrastructure.md`).
RUN mkdir -p /pb_data && chown pocketbase:pocketbase /pb_data
VOLUME ["/pb_data"]

USER pocketbase
EXPOSE 8090

# `--migrationsDir` and `--hooksDir` are not optional: PocketBase looks beside
# its data directory by default, so without them a hook silently does not run —
# and the hooks are where the consent gate and the paywall live.
CMD ["pocketbase", "serve", \
  "--http=0.0.0.0:8090", \
  "--dir=/pb_data", \
  "--migrationsDir=/pb/migrations", \
  "--hooksDir=/pb/hooks"]
