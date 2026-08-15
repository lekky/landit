# Land It — implementation plan

Written against `design-handoff/README.md`. That document is the design contract; this one records
what we decided, how the code is arranged, and what order it gets built in.

---

## 1. Decisions (handoff Step 0)

| Decision | Chosen | Notes |
| --- | --- | --- |
| Platform | **Web first (Next.js), native later** | One repo, shared logic. See §2. |
| Offline level | **Read-only cache** on web; full local-first deferred to the native app | Departs from the handoff's recommendation — see §2.3. |
| Backend | **PocketBase** (self-hosted on the VPS, one instance per product) | SQLite + auth + file storage + API rules in one binary. Replaced Supabase 2026-08-15 — see §2.6 for why and what it demands. |
| Hosting | **VPS (hostmedia.uk, Coventry) + Coolify** | 4GB/2vCPU, £16.80/mo flat for all products. Coolify does deploys, SSL, subdomains and PR previews. Replaced Railway 2026-08-15. |
| Backups | **Litestream → Cloudflare R2**, continuous | Non-negotiable for self-hosting children's data. Restore rehearsed before launch. See §2.6. |
| Auth and consent | **Age captured at sign-up for everyone; parental consent flow for under-threshold riders** | Threshold and consent mechanics still need legal advice. See §6. |
| Clip storage | **Cloudflare R2 via PocketBase's S3 backend, 2GB cap per rider (5GB Legend)** | Zero egress fees; VPS disk never holds video. See §6. |
| Maps provider | **Mapbox** (provisional) | Store plain `lat`/`lng` so it stays swappable. |
| Payments | **Stripe on web**; entitlements modelled independently of Stripe; **single-rider plans only — Crew Pass dropped** (2026-08-15) | See §2.4 — entitlement independence is the decision that protects the native option. |
| Staff portal placement | **Route group in the web app**, hard role gate, full audit log | Handoff prefers a separate app; see §6. |
| Error reporting | **Sentry** | Already connected; PII scrubbed. See §2.5. |
| Analytics | **PostHog EU (free tier) + Cloudflare Web Analytics** | PostHog for product events (onboarding funnel, upgrades), Cloudflare beacon for traffic. Both cookie-less, no ad identifiers. |
| Transactional email | **Resend** | Confirmed 2026-08-15. PocketBase sends auth, reset and guardian-consent email through Resend's SMTP on the product domain. |
| Pricing | **Rookie free; Shredder £3.99/mo · £39.99/yr; Legend £6.99/mo · £69.99/yr** | Confirmed 2026-08-15. Yearly ≈ 2 months free. Crew Pass dropped, replaced by the single-rider Legend tier — see §2.4. |

---

## 2. Architecture: what "one codebase" should mean here

You asked for one codebase now, with native iOS/Android possible after launch. There are two
different things that phrase can mean, and they carry very different risk.

**Sharing the logic** — types, the trick graph, stage rules, sticker evaluation, stats, streaks,
challenge state, and the data access layer. This is unambiguously worth doing, and it is where the
real cost of a second platform lives.

**Sharing the UI** — one set of screen components rendering on web and native, via Expo +
react-native-web. This is the version most people mean, and for Land It specifically it is the
wrong trade.

### 2.1 Why not share the UI

The visual language in the handoff is authored in CSS and depends on things React Native either
lacks or renders differently per platform:

- Hard offset shadows (`5px 5px 0 var(--ink)`, never blurred) — RN has iOS `shadow*` and Android
  `elevation`, which do not produce identical hard offsets, and the whole design is built on them.
- The page background dot pattern (`radial-gradient` at `14px 14px`) — needs an SVG or image layer in RN.
- Diagonal hatch fills on locked trick cards and skill-tree nodes — same problem.
- `text-shadow` on the Anton headlines ("Proven." in yellow with a `4px 4px 0` ink shadow) — no RN equivalent.
- `clamp(42px,7.6vw,80px)` fluid type, `letter-spacing` on the `.lab`/`.eyebrow` scale — partial or
  divergent support.

Web is the launch platform. Sharing UI would mean fighting the framework to approximate a design
that CSS renders natively, and taking that quality hit on the platform that ships first.

### 2.2 Structure

```
landit/
  apps/
    web/                 Next.js App Router — rider app, marketing, legal, /admin route group
    mobile/              Expo — Phase 7, not now
  packages/
    core/                types, trick graph, stage + sticker + stats + streak logic. Pure TS.
    db/                  PocketBase client wrappers, generated collection types, query functions
    ui-web/              design system: tokens, primitives, icons, StickerBadge
  pocketbase/
    migrations/          JS migrations defining collections, rules and indexes
    hooks/               pb_hooks — server-side rule enforcement (paywall, stickers, audit)
    seed/                61 tricks, stickers, plans, spots, events, challenges
  design-handoff/        the received design pack (reference, not compiled)
```

**The rule that keeps native cheap:** `packages/core` never imports React, `next/*`, `react-native`,
or anything touching the DOM. Every behaviour the handoff describes as a rule lives there as a pure,
unit-tested function:

- a trick is landed at `some`, `most` or `every`
- a trick is free when `free` is set, otherwise when `diff <= FREE_MAX_DIFF` (currently 2)
- a trick is unlocked when every entry in `pre` is landed
- sticker rules as `(stats, sticker) => boolean`, with `n` read from the sticker record so staff can
  edit thresholds
- sport-scoped stats vs combined stats (`sport: null` stickers judge against combined)
- challenge state (`upcoming` / `live` / `past`) derived from `starts`/`ends`, never stored
- streak and "rode today" date logic

When the Expo app arrives it imports `core` and `db` unchanged and only rewrites views. That is the
80% of a second platform that normally hurts, already paid for.

### 2.3 Offline — an honest note

The handoff recommends full local-first from day one and warns that retrofitting is painful. That
recommendation assumed a native app. Choosing web changes the calculus: full local-first in a
browser against a server database means a local store, a sync engine and conflict resolution, and
it is a large amount of work to put in front of a launch.

The plan is therefore a service-worker read-only cache on web (library and the rider's tracked list
readable at the park, logging needs signal), with full local-first arriving in the native app where
the tooling actually supports it.

This is a real cost of web-first, not a free choice. It is worth confirming that "you can read your
tricks but not log them offline" is acceptable for launch. If it is not, that argues for bringing
the native app forward rather than for building a sync engine in the browser.

### 2.4 Payments — model entitlements yourself

Web-only can use Stripe directly, which is cheapest. But native apps must use in-app purchase for
digital subscriptions, so the moment a native app ships there are three sources of truth for "has
this rider paid": Stripe, Apple, Google.

Do not treat the Stripe subscription as the entitlement. Keep a `subscriptions` collection with a
`source` field (`stripe` | `apple` | `google`) and resolve plan access from our own database. This
costs almost nothing now and is expensive to unpick later.

**The Crew Pass is dropped** (2026-08-15), not deferred by accident: it was the fiddliest part of
payments (a seat model, seat invites/claims, seat management, cancel-mid-cycle edge cases), and its
other job — being the parental-consent mechanism — is better served by consent living in the
sign-up flow itself (§6). In its place the third tier is **Legend** — still a single-rider
subscription, so billing stays one rider / one subscription throughout. (Not "Pro": that already
names the top difficulty tier, and a Shredder-plan rider working on Pro-difficulty tricks would
make the word mean two things at once.) Launch plans, plan ids `rookie | shredder | legend`:

- **Rookie** — free. Tricks up to the free cut-off, no clips.
- **Shredder** — £3.99/mo · £39.99/yr. Everything unlocked, 2GB clip vault.
- **Legend** — £6.99/mo · £69.99/yr. Everything in Shredder plus a **5GB clip
  vault**, **Legend flair** (profile/crew-board tag, exclusive avatar drops) and **progress
  insights** (per-category trends, personal records, next-trick suggestions derived from the
  skill tree).

One principle governs what Legend may ever contain: **achievements are never for sale**. Stickers and
stages are earned-only on every plan; paid tiers sell capacity, cosmetics and insight. Crews the
*social* feature are unaffected by any of this. If a family tier earns its way back, it returns as
an additive seat collection resolved through the same entitlements logic — nothing being built now
closes that door.

### 2.5 Tooling (decided here so build sessions don't churn on it)

- **Package manager / workspace:** pnpm workspaces. No Turborepo until build times demand it.
- **TypeScript:** strict mode everywhere, one shared `tsconfig.base.json`.
- **Unit tests:** Vitest, colocated with `packages/core` and `packages/db`. The core port is only
  done when its tests encode the prototype's behaviour (stage rules, free/locked, sticker rules,
  streaks, challenge state).
- **E2E:** Playwright against a local PocketBase instance. Smoke flows: sign up → onboard → track a
  trick → see it on home; paywall block on a locked trick; admin edit → audit row.
- **Local dev:** the PocketBase binary runs locally (a pnpm script downloads the pinned version and
  starts it with the repo's migrations and hooks) — no Docker required for day-to-day work.
- **Fonts:** Anton, Barlow Condensed and Archivo **self-hosted via `next/font`**, not the Google
  Fonts CDN. The audience is children; no third-party font pings (this also honours the cookie
  policy's no-cross-site-tracking promise, and GDPR case law has gone against Google Fonts CDN use).
- **Error reporting:** Sentry (already connected to this workspace). Wire it in from Phase 2, scrub
  PII in `beforeSend`.
- **Server-side logic:** PocketBase JS hooks (`pocketbase/hooks/`) for anything a client must not
  be trusted with (sticker awards, paywall checks, audit log), plus Next.js server actions for
  admin writes and Stripe webhooks. See §3.

### 2.6 Infrastructure (the box)

One VPS — hostmedia.uk, Coventry (UK data residency), 4GB/2vCPU, £16.80/mo — runs everything for
Land It **and** other products, managed by Coolify:

```
VPS
└── Coolify            deploys from GitHub, SSL, subdomains, PR preview environments
    ├── landit web     Next.js app
    ├── landit PB      PocketBase instance (api.<domain>)
    ├── Uptime Kuma    monitoring
    └── other products later, same pattern (own app + own PocketBase each)
```

Self-hosting the database for a product holding children's data is only defensible with the
following in place, and they are **prerequisites for any hosted environment, not launch-week
tasks**:

1. **Litestream** replicating each PocketBase SQLite file to Cloudflare R2 continuously.
2. **A rehearsed restore** — recover the database onto a fresh box once, before real riders exist.
3. Hardening: SSH keys only, firewall (80/443/SSH), unattended security upgrades, fail2ban.
4. Uptime Kuma alerting on app and PocketBase health.

The VPS setup is done by hand (Rachid + Claude over SSH), not by an agent session — see the infra
track in §7. The provider's weekly snapshots are a bonus, not the backup story. The live
infrastructure — addresses, URLs, access patterns, security posture, remaining checklist — is
recorded in `docs/infrastructure.md`; agent sessions never need SSH access to the box.

Total infrastructure cost: ~£18/month flat (VPS + pennies of R2), shared across every product on
the box.

---

## 3. Data model

Straight port of the handoff's model onto PocketBase collections. Notable shapes:

| Collection | Purpose |
| --- | --- |
| `users` | PocketBase auth collection, extended with the profile fields: name, handle, town, stance, level, goal, avatar, privacy, `sports`, streak, last_ride, timezone, role, plan-facing fields. Email stays a hidden field |
| `tricks` | 61 records. `sport`, `cat`, `diff 1..5`, `about`, `tips`, `fact`, nullable `free` override, `is_live` |
| `trick_prereqs` | Edge collection (`trick`, `prereq`). Same-sport constraint enforced in a hook |
| `trick_progress` | `(user, trick) → stage`. The `byId` map |
| `trick_log` | Append-only. `(user, trick, stage, at, estimated)`. Drives every date in the app |
| `trick_notes` | Per-rider session notes |
| `clips` | File field backed by R2; protected, token-gated delivery, never public |
| `stickers` | Name, hue, icon, condition copy, editable threshold `n`, `is_live`. Rules stay in code |
| `rider_stickers` | `earned_at` plus `seen_at`, so a sticker is never re-announced |
| `plans`, `subscriptions` | See §2.4. No seat collection — Crew Pass dropped. `plans` carries the per-plan clip cap |
| `guardian_consents` | Rider, guardian email, requested/granted/revoked timestamps, method. Backs the sign-up consent flow (§6) |
| `crews`, `crew_members`, `crew_invites` | Real crews — the prototype has one demo crew |
| `challenges`, `challenge_log` | Per sport per week. State derived from dates |
| `spots` | Includes `status` (`pending`/`live`/`rejected`) and `submitted_by` — that is the review queue |
| `events`, `event_attendance` | "I'm going" |
| `announcements`, `announcement_dismissals` | Replaces `seenNotices`. `audience` field (all / plan / sport) per the composer |
| `audit_log` | Actor, action, entity, before, after. The handoff flags its absence explicitly |
| `reports` | Reporter, subject (`profile` / `clip` / `spot`), reason, status. The safeguarding page promises reporting; the prototype has no flow for it — the collection goes in now so the buttons have somewhere to write |

Additions the handoff implies but never names:

- **Staff are a role, not an app.** `users.role` enum `rider | staff`, default `rider`, changeable
  only from the PocketBase superuser dashboard (no API rule path lets anyone grant it; the
  superuser account is ours alone and is not a rider login). The prototype's email+passcode gate
  (`miles@landit.app` / `ramp`) does **not** survive: staff sign in with their normal account and
  the `/admin` route group plus every admin-write path checks the role server-side. All admin
  writes go through Next.js server actions using a server-held superuser client, and every one
  writes `audit_log` in the same transaction — there is deliberately no client-side write path to
  admin collections.
- **`users.timezone`** (IANA string, captured at onboarding from the browser). Streaks, "rode
  today" and challenge boundaries are computed in the rider's timezone, not UTC — without this the
  streak logic in `core` has nothing to stand on.
- **`users.handle`**: unique case-insensitively (SQLite `COLLATE NOCASE` unique index),
  format-constrained, with a reserved-word list (admin, staff, landit, api…). Handles appear in
  URLs and share cards.
- **One live challenge per sport** is enforced in the challenge create/update hook (reject a date
  range overlapping an existing challenge for the same sport), not admin discipline. SQLite has no
  exclusion constraints, so the hook is the constraint — it must run on every write path.

`trick_log` keeps the `estimated` flag from the prototype's `est: true`. The UI says when a date is
estimated rather than pretending it is exact — keep that behaviour.

**Log semantics, reconciled.** The handoff says the log is append-only *and* that removing a stage
removes that trick's log entries. Both, precisely: the app never edits a log row, but a rider may
delete rows for their own tricks (the undo path when something was tracked by mistake). API rules:
create and delete own records only, no update. Every derived date (first landed, monthly chart)
recomputes from what remains.

**Rules execute on the server.** `packages/core` is where the rules are *defined*; the place they
are *enforced* is `pocketbase/hooks/`: on each `trick_progress` write the hook re-checks the
paywall and unlock rules, evaluates stickers against fresh stats, and creates `rider_stickers`
records itself. Clients cannot create `rider_stickers` at all (`createRule: null`) — otherwise
stickers are forgeable and the paywall is, as below, a suggestion. The client-side copies of the
same `core` functions exist for instant UI feedback only.

### Access rules (the RLS role, in PocketBase terms)

Collection API rules plus hooks carry what row-level security carried in the Supabase design.
Three guarantees matter more than the rest, and T2's tests must prove each one over the HTTP API,
not by reading the rule text:

1. **Profile privacy.** `public` / `members` / `private` maps onto the view rules for `users`,
   `trick_progress` and `rider_stickers`. A private rider still appears on the crew board by name
   and score, so the crew board reads a narrow server-shaped payload (a hook route or filtered
   fields), never the full record.
2. **Clips are never public.** The `clips` file field is protected: delivery only via short-lived
   file tokens minted for the owner, no rule path that exposes a clip to another rider, R2 bucket
   private. The privacy policy in the handoff promises this.
3. **The paywall is a data-layer rule, not a UI rule.** The `trick_progress` create hook rejects a
   paid trick for a rookie-plan rider, whatever the client sends. If the paywall only lives in the
   client it is a suggestion.

---

## 4. Build order

**Phase 1 — Foundations.** Monorepo, PocketBase collections + migrations + hooks, seed the 61
tricks and their prerequisite edges, design tokens as CSS custom properties, `packages/core` ported
and unit-tested against the prototype's behaviour. No screens yet.

**Phase 2 — Signed out.** Landing, the five legal documents, sign in / sign up, four-step
onboarding. *Consent constants blocked on the legal answer (§6).*

**Phase 3 — The core loop.** Home, trick library with filters, trick detail, locked trick, progress
(by category, by stage, over time, skill tree). This is the product; Phases 1–2 are scaffolding.

**Phase 4 — Social and content.** Sticker wall, crew, rider profile with the privacy gating, weekly
challenge, events, spots + map.

**Phase 5 — Money.** Plans page, Stripe, entitlement resolution.

**Phase 6 — Staff.** Admin portal (nine tabs) and the audit log.

**Phase 7 — Reach.** PWA and offline cache, then the Expo app on top of `core` and `db`.

Phase 3 is the one worth protecting. Everything before it is setup and everything after is
expansion; the trick loop is what riders actually come for.

The phases are the conceptual order. The unit of execution is a **session** — one agent session,
one branch, one PR. §7 breaks the phases into sessions and says which can run concurrently.

---

## 5. What the prototype fakes

Tracked from the handoff's own list, mapped to phases:

| Faked | Real version | Phase |
| --- | --- | --- |
| `localStorage` persistence | PocketBase | 1 |
| Auth and accounts | Real sign-up, reset, guardian consent | 2 |
| Streaks (a counter) | Date logic, timezones, grace period | 3 |
| Crews (one demo crew) | Creation, invites, membership | 4 |
| Clips (`createObjectURL`, die on refresh) | Upload, R2 storage, token-gated delivery | 4 |
| The map (one embed at a time) | Mapbox with every spot plotted | 4 |
| Payments (instant and free) | Stripe + entitlements | 5 |
| Admin rider list (mock data) | Real riders | 6 |
| Moderation (queue for spots only) | Reporting for profiles and clips | 6 |
| Offline | Service worker cache, then native | 7 |

---

## 6. Still needed from you

**Blocking Phase 2 (merge, not build) — the consent flow details.** Decided in principle
(2026-08-15): every sign-up captures age, and riders under the threshold go through a parental
consent step — guardian email, approval link, account limited until granted — recorded in
`guardian_consents`. This replaces the prototype's idea of the Crew Pass as the consent mechanism
(the pass is dropped anyway, §2.4). What still needs legal advice, framed exactly this way:
the age threshold; how strong guardian verification must be (email approval vs more); what
"limited until granted" must exclude; whether to store date of birth or just an age band (UK AADC
leans data-minimisation — prefer the band); and which regimes apply (AADC, GDPR, COPPA if US
riders). The safeguarding page makes promises the implementation has to keep.

**Clips — decided** (2026-08-15). **2GB on Shredder, 5GB on Legend**, enforced server-side at
upload in the clips hook, with the cap read from the `plans` record so staff can tune it. Clips
live on Cloudflare R2 through PocketBase's S3 storage backend — zero egress fees, so the
watch-cost concern managed hosting had is gone by construction, and the VPS disk never holds
video. Clips are the paid plans' headline upsell; free riders cannot save clips at all. At the
Shredder cap the UI shows usage and offers Legend; at the Legend cap it offers delete-to-make-room,
not an upsell. Cost at cap: ~2.5p (Shredder) to ~6p (Legend) per rider/month in R2 storage.
Retention defaults, flagged as defaults not law: account deletion hard-deletes clips with
everything else; downgrade to Rookie keeps existing clips viewable but blocks new saves. The
privacy-policy promise stands: clips are never public and delivery is always token-gated.

**Pricing — confirmed** (2026-08-15): Rookie free; Shredder £3.99/mo or £39.99/yr; Legend
£6.99/mo or £69.99/yr — Legend replaces the dropped Crew Pass as a single-rider tier (§2.4).
Yearly ≈ two months free throughout. Cost sanity (checked 2026-08-15, VPS stack): fixed base is
~£18/mo flat — the VPS at £16.80 plus pennies of R2, shared across every product on the box —
so break-even is **~5 Shredders**. Per paying rider, Stripe takes ~26p of £3.99 and clip storage
is the pennies above; there is no egress bill (R2). Native apps will later take a 15% store cut,
which the yearly price should anticipate.

**Analytics — decided: PostHog EU free tier + Cloudflare Web Analytics** (2026-08-15). PostHog
(EU cloud, cookie-less config) is the product-analytics source of truth — instrument onboarding
steps, trick logging, paywall hits and upgrades as those screens are built. The Cloudflare beacon
rides alongside for plain traffic counts. No consent banner needed for either; keep it that way —
no session recording without revisiting consent, given the audience.

**Hosting — decided: VPS + Coolify** (2026-08-15, replacing the earlier Railway decision). See
§2.6. Coventry datacentre keeps rider data in the UK. Coolify's preview deployments stand in for
Railway's per-PR environments — wire them up during the infra track so screens can be reviewed as
they land from Wave 2 onward.

**Worth revisiting — staff portal placement.** The handoff recommends a separate internal app. This
plan puts it in a route group in the web app behind a role gate, which is cheaper at current team
size and keeps one deploy. The audit log is non-negotiable either way. Revisit when non-engineering
staff need access on a different release cadence.

---

## 7. Session plan

Each task below is sized for one agent session on its own branch, ending in one reviewable PR.
Tasks in the same wave touch disjoint parts of the repo and can run **concurrently**; a wave should
be merged to `main` before the next wave starts (sessions branch from `main`, so unmerged work is
invisible to them).

**The infra track runs beside the waves, not inside them.** VPS ordering, hardening, Coolify,
Litestream → R2, the restore rehearsal and Uptime Kuma (§2.6) are done by hand over SSH, not by an
agent session. None of it blocks Waves 0–2 (all local); the hosted PocketBase instance and preview
deploys should exist by the end of Wave 2 so Wave 3 onward can be reviewed on real URLs.

**Ground rules for every session:**

- Read this plan and `design-handoff/README.md` first, then the specific prototype files and
  screenshots named in the task. The prototype is the behavioural spec; this plan wins where they
  conflict.
- Shared packages (`core`, `db`, `ui-web`) and `pocketbase/` are **additive-only** once their wave
  has merged: a screen session may add a new export, collection field or hook it needs, but must
  not change the signature or behaviour of an existing one. If a breaking change seems necessary,
  stop and flag it instead.
- Definition of done: `pnpm build`, `pnpm test`, `pnpm lint` green; new behaviour has tests where
  the task says so; screens visually checked against the named screenshots.

### Wave 0 — one session, serial

**T0 · Scaffold.** pnpm workspace, Next.js App Router app in `apps/web`, empty `packages/core`,
`packages/db`, `packages/ui-web` with build/test wiring, shared tsconfig, ESLint + Prettier,
Vitest, Playwright config, the `pocketbase/` directory with the local-dev script (download the
pinned PocketBase binary, run it with the repo's migrations and hooks), CI running build/test/lint,
`.env` templates. No product code. Small on purpose — it sets the conventions every later session
inherits.

### Wave 1 — three concurrent sessions

**T1 · Core logic + canonical data.** Port every rule in §2.2 into `packages/core` as pure
functions with unit tests, and extract the canonical data (61 tricks + prereq edges, stickers,
plans, spots, events, challenges, stances, goals, avatar registry) from
`design-handoff/design/landit-data.js` and `landit-avatars.js` into typed constants under
`packages/core/data/`. That extraction is the single source for both DB seeds (T4) and test
fixtures. Inputs: `landit-data.js`, `landit-ui.jsx` (stats, sticker evaluation, `trickLocked`,
`landedByMonth`, migrations), `landit-avatars.js`.

**T2 · Collections, rules and hooks.** PocketBase JS migrations for every collection in §3
including the additions (role, timezone, handle index + reserved words, reports, audit_log), all
collection API rules, and the hooks: paywall check on `trick_progress` writes, sticker award,
same-sport prereq check, challenge-overlap rejection, clip-cap skeleton, audit-log writer. Tests
run against a throwaway local PocketBase over HTTP and must prove the three §3 guarantees —
privacy gating, clips never public, paywall enforced on create — as observed API behaviour. Uses a
handful of handwritten fixture records; real seeds come in T4. Inputs: §3 of this plan, handoff
data model section, PocketBase JS hooks + migrations docs.

**T3 · Design system.** `packages/ui-web`: every token from `Land It.html` as CSS custom
properties, self-hosted fonts, the primitives (buttons with press/hover translate, panels, hard
shadows, folded-corner trick card, hatch fills, tabs, chips, `.lab`/`.cond`/`.eyebrow` type
classes, progress bars, difficulty bars, stage dots, toasts, modal with the specified scrim/motion,
segmented progress), the icon set from the `I` map in `landit-ui.jsx`, `StickerBadge` SVG, and the
36 avatar PNGs as package assets. Deliverable includes a `/design` gallery route in `apps/web`
rendering everything side by side for comparison against the screenshots. Inputs: `Land It.html`
(the CSS is the spec), `landit-ui.jsx`, screenshots 01–21.

### Wave 2 — two concurrent sessions

**T4 · DB package + seeds.** `packages/db`: PocketBase JS SDK clients (browser + server, plus the
server-held superuser client for admin actions), generated collection types (`pocketbase-typegen`),
typed query and mutation functions for every collection, and seed scripts that load T1's canonical
data into local and hosted PocketBase. Depends on T1 + T2.

**T5 · Shell, landing, legal.** App shell and routing: top nav, sub-860px five-item bottom bar,
global sport-switch state, toast host, modal host; the landing page; the five legal documents; the
site footer. No auth yet — signed-out only. Depends on T3. Inputs: `landit-legal.jsx`,
`landit-auth.jsx` (landing), `landit-app.jsx` (shell/routing), screenshots 01–03.

### Wave 3 — one session

**T6 · Auth + onboarding + consent.** PocketBase auth (email/password + reset, mail through
Resend SMTP), profile fields on `users`, handle generation, the four onboarding steps, avatar
picker, timezone capture. Sign-up captures age (age band, not date of birth, pending legal);
riders under the threshold enter the parental consent flow — guardian email, approval link,
account limited until granted — writing `guardian_consents`. The threshold and the "limited" scope
live in one config module, loudly flagged pending the legal answer: build the flow, confirm the
constants before merging. Depends on T4 + T5. Inputs: `landit-auth.jsx`, §6 of this plan,
screenshots 04–05.

### Wave 4 — the core loop, three concurrent sessions (route-disjoint)

**T7 · Library + trick detail + locked trick.** Filters, search, rookie banner, stage picker,
notes, prerequisite/unlock pills, locked-trick page. Clips panel renders in its locked/upsell state
only (real clips are T14). Inputs: `landit-screens-a.jsx`, screenshots 08–10.

**T8 · Home + streak + announcements.** Dashboard, stat blocks, seven-day strip, "I rode today",
streak logic wired to `core` (timezone-aware), announcement banner + dismissal, working-on/start-here,
wish list, stickers/crew teaser panels. Inputs: `landit-screens-a.jsx` (Home), screenshots 06.

**T9 · Progress + skill tree.** By category, by stage, over-time chart with the estimated-dates
note, skill tree with prerequisite/paywall lock states, printable sheets panel. Also the
Legend-gated **insights panel** (§2.4): per-category trends, personal records, next-trick
suggestions derived from the skill tree — locked state on lower plans mirrors the clips-panel
upsell pattern. Inputs: `landit-screens-b.jsx`, screenshots 11–13.

### Wave 5 — four concurrent sessions (clips may lag)

**T10 · Stickers.** Wall, detail modal, share card; server-side award flow end-to-end (earn a
sticker by tracking, see the toast once, never re-announced). Inputs: `landit-screens-b.jsx`,
`landit-ui.jsx` (StickerBadge, share), screenshot 14.

**T11 · Crew + rider profiles.** Real crews: create, invite (the 1080×1080 canvas share card with
`navigator.share` fallbacks), join, board, activity feed; rider profile with the three-way privacy
gating driven by the §3 access rules (the "viewing as" toggle from the prototype becomes real
signed-in/out states); coach view. Inputs: `landit-screens-b.jsx`, `landit-screens-c.jsx`,
`landit-screens-d.jsx`, screenshots 15–16, 24.

**T12 · Challenge + events.** Live/upcoming/past challenge states derived from dates, log button
gated server-side to the live window, past weeks blurred on free plan; events list, filters, detail
modal, "I'm going". Inputs: `landit-screens-b.jsx`, `landit-screens-d.jsx`, screenshots 17–18.

**T13 · Spots + map.** Mapbox with every live spot plotted, styled to the design language;
selection sync between list and map; spot submission (Maps-link or coordinate parsing) into the
`pending` queue, rate-limited. Inputs: `landit-screens-b.jsx`, screenshot 19.

**T14 · Clips.** Upload through PocketBase's file field backed by R2, token-gated playback,
per-plan cap read from the `plans` record (2GB Shredder / 5GB Legend) enforced in the upload hook,
the at-cap states from §6, delete. Slot anywhere after Wave 4. Inputs: `landit-screens-a.jsx`
(clips panel), §6 clip decision.

### Wave 6 — three sessions, T15 ∥ T16 then T17

**T15 · Payments.** Stripe Checkout + customer portal, webhook (Next.js route) → `subscriptions`
records via the superuser client, entitlement resolution from our own collection (§2.4), plans
page with monthly/yearly toggle and FAQ, and an end-to-end test that a rookie → shredder upgrade
actually unlocks a paid trick at the hook layer. Three plan cards as designed, but the top card is
**Legend** (single rider, §2.4), not the prototype's Crew Pass — rewrite its pitch, perks and FAQ
copy around the 5GB vault, flair and insights; Shredder stays the raised "Most riders" card.
Legend flair itself (profile/crew-board tag, exclusive avatars) is applied where those surfaces
live — coordinate the tag rendering with what T11 built. Inputs: `landit-screens-c.jsx`, §2.4,
screenshot 20.

**T16 · Admin: shell + riders + audit.** `/admin` route group behind the role gate, admin nav,
Overview, Riders (search, plan override, rider sheet, suspend), and the audit-log plumbing every
later admin write uses — every mutation lands as a server action using the superuser client that
writes `audit_log` in the same transaction. Runs concurrently with T15. Inputs: `landit-admin.jsx`,
screenshots 25–27.

**T17 · Admin: content tabs.** Trick library editing, stickers, spots queue, events, challenges,
announcements composer, plans editor — all on T16's action/audit pattern. Also the moderation view
over the `reports` collection. Depends on T16. Inputs: `landit-admin.jsx`, screenshots 28–31.

### Wave 7 — three concurrent sessions

**T18 · Hardening.** Reporting flows in the rider app (profile/clip report buttons), account
deletion + data export (GDPR — the privacy policy promises both), rate limits on submissions and
handle checks, Sentry verification, then run a full security review pass over the branch history.

**T19 · PWA + offline read cache.** Service worker caching the library and the rider's tracked
list, install manifest, the "read at the park" story from §2.3.

**T20 · E2E + fidelity pass.** Playwright suite over the §2.5 smoke flows plus paywall and privacy
gating, and a screen-by-screen visual comparison against all 31 screenshots with fixes for
divergences. This session gets the *whole* app, so nothing else runs beside it.

### Dependency graph

```
T0 ─┬─ T1 ─┬─ T4 ─┬─ T6 ─┬─ T7  T8  T9 ─┬─ T10 T11 T12 T13 (T14) ─┬─ T15 ─┐
    ├─ T2 ─┘      │      │               │                         ├─ T16 ── T17 ─┬─ T18 T19
    └─ T3 ─── T5 ─┘      └───────────────┘                         │              └─ T20 (last)
```

Sixteen of the twenty sessions run inside a concurrent wave; the serial spine is
T0 → (wave 1) → T4 → T6 → (wave 4) → … — about seven sequential steps end to end. The infra track
(§2.6) runs alongside and needs to be live by the end of Wave 2.
