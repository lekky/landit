# Land It — implementation plan

Written against `design-handoff/README.md`. That document is the design contract; this one records
what we decided, how the code is arranged, and what order it gets built in.

---

## 1. Decisions (handoff Step 0)

| Decision | Chosen | Notes |
| --- | --- | --- |
| Platform | **Web first (Next.js), native later** | One repo, shared logic. See §2. |
| Sports at launch | **Three: scooter, skateboard and BMX** | Decided 2026-08-16. BMX ships at launch, not as a fast-follow. Sport is already a dimension in the code, so the engineering is small; the BMX trick library and its visual assets have no source and are the owner's to author — see the BMX track in §7. |
| Offline level | **Read-only cache** on web; full local-first deferred to the native app | Departs from the handoff's recommendation — see §2.3. |
| Backend | **PocketBase** (self-hosted on the VPS, one instance per product) | SQLite + auth + file storage + API rules in one binary. Replaced Supabase 2026-08-15 — see §2.6 for why and what it demands. |
| Hosting | **VPS (hostmedia.uk, Coventry) + Coolify** | 4GB/2vCPU, £16.80/mo flat for all products. Coolify does deploys, SSL, subdomains and PR previews. Replaced Railway 2026-08-15. |
| Backups | **Litestream → Cloudflare R2**, continuous | Non-negotiable for self-hosting children's data. Restore rehearsed before launch. See §2.6. |
| Auth and consent | **Age band captured at sign-up for everyone; guardian consent required below the rider's country threshold** | Threshold 13 in the UK, resolved per country elsewhere. Mechanics decided 2026-08-16 — see §6.2. |
| Minimum age | **None stated.** The terms do not say "13+" | Stating a minimum age creates an Ofcom duty to enforce it with highly effective age assurance, and a tick-box does not qualify. 13+ is the *audience*, not a gate — see §6.2. |
| Launch markets | **Global sign-up, UK-first product** | Anyone can sign up; the consent threshold follows the rider's country. One refusal: US under-13, which needs COPPA verifiable parental consent we are not building at launch. See §6.3. |
| Regulatory scope | **UK Online Safety Act (Part 3, user-to-user) + ICO Children's code, applied to every rider** | Added 2026-08-16 — the plan previously missed the OSA entirely. Children's code standards are the baseline for *all* users, not only declared children. See §6.1. |
| Clip storage | **Cloudflare R2 via PocketBase's S3 backend, 2GB cap per rider (5GB Legend)** | Zero egress fees; VPS disk never holds video. See §6.6. |
| Maps provider | **Mapbox** (provisional) | Store plain `lat`/`lng` so it stays swappable. |
| Payments | **Stripe on web**; entitlements modelled independently of Stripe; **single-rider plans only — Crew Pass dropped** (2026-08-15) | See §2.4 — entitlement independence is the decision that protects the native option. |
| Streak shape | **A weekly target, not a consecutive-day count** (2026-08-16). A rider keeps the streak by riding **at least 2 times in a week**; the streak counts consecutive weeks that met the target, and missing a week breaks it. "I rode today" stays a plain button — no spot attached, no location captured | The audience is children who realistically ride at weekends: a daily streak punishes a school week, and is the engagement mechanic §6.4 Standard 13 warns about. Weeks are Monday-to-Sunday — the boundary the weekly challenges already use, so a rider never has two different "this week"s. **Two numbers here are tunable defaults, not deliberated decisions: the target of 2** (a weekend alone reaches it; 3 would force a weekday ride) **and no grace week** (the weekly target is itself the forgiveness — a grace week on top would make the streak nearly unbreakable). Both are constants in `packages/core` (`WEEKLY_RIDE_TARGET`, `WEEKLY_STREAK_GRACE_WEEKS`) and options on every function, so moving either is a one-line change plus this row. This supersedes the daily-streak and grace-period framing throughout: the daily functions in `core` stay exported but deprecated, and T8 wires the weekly ones. Stored shape in §3; that spots never record where a rider has been is §6.4 Standard 10 and T13. |
| Staff portal placement | **Route group in the web app**, hard role gate, full audit log | Handoff prefers a separate app; see §6.10. |
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
    seed/                tricks (61 scooter+skate, BMX added by T21), stickers, plans, spots, events, challenges
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
sign-up flow itself (§6.2). In its place the third tier is **Legend** — still a single-rider
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
| `users` | PocketBase auth collection, extended with the profile fields: name, handle, town, stance, level, goal, avatar, privacy, `sports`, the weekly-streak fields, last_ride, timezone, role, plan-facing fields. Email stays a hidden field |
| `tricks` | 61 records for scooter and skate, plus the BMX library when it is authored (§7). `sport`, `cat`, `diff 1..5`, `about`, `tips`, `fact`, nullable `free` override, `is_live` |
| `trick_prereqs` | Edge collection (`trick`, `prereq`). Same-sport constraint enforced in a hook |
| `trick_progress` | `(user, trick) → stage`. The `byId` map |
| `trick_log` | Append-only. `(user, trick, stage, at, estimated)`. Drives every date in the app |
| `trick_notes` | Per-rider session notes |
| `clips` | File field backed by R2; protected, token-gated delivery, never public |
| `stickers` | Name, hue, icon, condition copy, editable threshold `n`, `is_live`. Rules stay in code |
| `rider_stickers` | `earned_at` plus `seen_at`, so a sticker is never re-announced |
| `plans`, `subscriptions` | See §2.4. No seat collection — Crew Pass dropped. `plans` carries the per-plan clip cap |
| `guardian_consents` | Rider, guardian email, hashed approval token + expiry, requested/granted/revoked timestamps, `method` (`email_approval` at launch). Backs the sign-up consent flow (§6.2). Revocation is a state, not a delete — the record is the evidence |
| `crews`, `crew_members`, `crew_invites` | Real crews — the prototype has one demo crew |
| `challenges`, `challenge_log` | Per sport per week. State derived from dates |
| `spots` | Includes `status` (`pending`/`live`/`rejected`) and `submitted_by` — that is the review queue |
| `events`, `event_attendance` | "I'm going" |
| `announcements`, `announcement_dismissals` | Replaces `seenNotices`. `audience` field (all / plan / sport) per the composer |
| `audit_log` | Actor, action, entity, before, after. The handoff flags its absence explicitly |
| `reports` | Reporter (nullable — the OSA wants a route for non-users too), subject (`profile` / `clip` / `spot`), reason, status, outcome, `complaint_of` self-link for appeals against our own moderation decisions. The safeguarding page promises reporting; the prototype has no flow for it — the collection goes in now so the buttons have somewhere to write |

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
- **The weekly-streak fields on `users`.** The streak is weekly (§1), and a weekly target cannot be
  reconstructed from a counter and a last ride: it has to know how far into *this* week the rider
  is. Four fields — `streak` (qualifying weeks in a row), `week_start` (the Monday the ride count
  belongs to), `week_rides` (rides logged in that week), `streak_week` (the Monday of the last week
  that met the target) — plus the existing `last_ride`, which keeps "I rode today" to one tap a
  day. Still no per-day calendar is stored. All of them are derived values the client may show but
  never the authority: `packages/core` recomputes the streak from them on read, so a stored streak
  whose last qualifying week has passed reads as zero without a cron job touching it.
- **`users.handle`**: unique case-insensitively (SQLite `COLLATE NOCASE` unique index),
  format-constrained, with a reserved-word list (admin, staff, landit, api…). Handles appear in
  URLs and share cards.
- **Age is stored as a band, never a birth date** (§6.2). Four fields on `users`:
  `age_band` (`under_13 | 13_15 | 16_17 | adult`), `band_next_change_on` (the date the rider
  leaves the band, so transitions are automatic and consent lapses on the 13th birthday without a
  job scanning birth dates), `age_declared_at`, and `country` (ISO-3166-2, chosen at sign-up —
  it selects the consent threshold). The browser collects a date of birth to compute the band and
  discards it; the date of birth is never sent to the server, never stored and never displayed.
  Data minimisation is the point (Children's code standard 8) and it is cheaper to get right at
  T6 than to unpick after riders exist.
- **`users.consent_state`** (`not_required | pending | granted | revoked`), written only by the
  consent hook, never by the client. It is the gate the fourth guarantee below tests against.
- **One live challenge per sport** is enforced in the challenge create/update hook (reject a date
  range overlapping an existing challenge for the same sport), not admin discipline. SQLite has no
  exclusion constraints, so the hook is the constraint — it must run on every write path.

`trick_log` keeps the `estimated` flag from the prototype's `est: true`. The UI says when a date is
estimated rather than pretending it is exact — keep that behaviour.

**Sport is a dimension, not a pair.** Nothing in this model changes to admit BMX (§1). `tricks`,
`challenges` and the sport-scoped stickers already key off a `sport` value; `users.sports` is
already a list; prerequisites are already same-sport constrained, so a BMX graph sits beside the
existing two without touching them; and the five categories (`flat` / `street` / `park` / `hybrid`
/ `air`) are sport-agnostic, so BMX needs no new taxonomy. The only schema work is widening the
fixed-option `sport` selects to include `bmx`, which is an ordinary additive migration. In
`packages/core` the equivalent is widening the `SportId` union and adding a `SPORTS` entry — at
which point every `Record<SportId, …>` stops compiling until it has a BMX entry, which is the point:
the type system enumerates the sites that need attention rather than leaving them to be found by
hand. Sessions must therefore never hard-code a two-sport assumption — iterate `SPORT_IDS`, never a
literal pair.

**Log semantics, reconciled.** The handoff says the log is append-only *and* that removing a stage
removes that trick's log entries. Both, precisely: the app never edits a log row, but a rider may
delete rows for their own tricks (the undo path when something was tracked by mistake). API rules:
create and delete own records only, no update. Every derived date (first landed, monthly chart)
recomputes from what remains.

**Rules execute on the server.** `packages/core` is where the rules are *defined*; the place they
are *enforced* is `pocketbase/hooks/`: on each `trick_progress` write the hook re-checks the
paywall, evaluates stickers against fresh stats, and creates `rider_stickers` records itself.
Clients cannot create `rider_stickers` at all (`createRule: null`) — otherwise stickers are
forgeable and the paywall is, as below, a suggestion. The client-side copies of the same `core`
functions exist for instant UI feedback only.

**The unlock rule is a display state, not a refusal** (decided in T2, amending "paywall and unlock
rules" above). A trick whose prerequisites are unlanded still accepts progress. Two reasons: the
wish list and "start here" both depend on a rider being able to *want* a trick they have not
unlocked, and the prerequisite graph is our opinion about learning order rather than a fact about a
rider — a 403 there would call a child a liar about something they actually landed. Unlock stays
what the prototype makes it: the skill tree's hatched-dashed node, computed in `core`. The paywall
is the only refusal on that path, and it is absolute.

**Two hook routes exist besides the collections.** `GET /api/landit/crew-board/{crew}` is the
narrow server-shaped payload guarantee 1 requires — a fixed field list built server-side, which is
how a private rider appears by name and score without their record being readable. `POST
/api/landit/crews/join` redeems an invite code, because `crew_members.createRule` is `null`: with
crews invite-only and undiscoverable (§6.1), there must be no client path into a crew that skips a
code. T11 builds its UI on both. `plans` carries `unlocks_paid_tricks` alongside the clip cap, so
the paywall is staff-tunable from the same record and fails closed when a plan is missing.

### Access rules (the RLS role, in PocketBase terms)

Collection API rules plus hooks carry what row-level security carried in the Supabase design.
Four guarantees matter more than the rest, and T2's tests must prove each one over the HTTP API,
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
4. **The consent gate is server-side** (added 2026-08-16). A rider whose `consent_state` is
   `pending` or `revoked` may read and write only their own data — tricks, stages, notes,
   streaks, progress. Every collection that makes a rider visible, reachable or billable rejects
   them at the rule or hook layer: `crews`, `crew_members`, `crew_invites`, `spots` create,
   `event_attendance`, `clips`, `subscriptions`, and any view rule that would surface their
   profile to another rider (they read as `private` regardless of their own setting, and they do
   not appear on a crew board). The same list is in §6.2 as behaviour; this is where it is
   enforced. A client-side consent gate protects nobody, and this one is a promise made to a
   parent.

---

## 4. Build order

**Phase 1 — Foundations.** Monorepo, PocketBase collections + migrations + hooks, seed the 61
tricks and their prerequisite edges, design tokens as CSS custom properties, `packages/core` ported
and unit-tested against the prototype's behaviour. No screens yet.

**Phase 2 — Signed out.** Landing, the five legal documents, sign in / sign up, four-step
onboarding. *Consent constants decided 2026-08-16 (§6.2) — build against them; the counsel review
confirms them rather than unblocking them.*

**Phase 3 — The core loop.** Home, trick library with filters, trick detail, locked trick, progress
(by category, by stage, over time, skill tree). This is the product; Phases 1–2 are scaffolding.

**Phase 4 — Social and content.** Sticker wall, crew, rider profile with the privacy gating, weekly
challenge, events, spots + map.

**Phase 5 — Money.** Plans page, Stripe, entitlement resolution.

**Phase 6 — Staff.** Admin portal (nine tabs) and the audit log.

**Phase 7 — Reach.** PWA and offline cache, then the Expo app on top of `core` and `db`.

Phase 3 is the one worth protecting. Everything before it is setup and everything after is
expansion; the trick loop is what riders actually come for.

**BMX is not a phase.** It ships at launch (§1) but it is not a stage of the build: the sport
dimension already exists (§3), so BMX is content plus one widening session, slotted late enough
that it never sits in front of the core loop. §7 places it and names what the owner has to author.

The phases are the conceptual order. The unit of execution is a **session** — one agent session,
one branch, one PR. §7 breaks the phases into sessions and says which can run concurrently.

---

## 5. What the prototype fakes

Tracked from the handoff's own list, mapped to phases:

| Faked | Real version | Phase |
| --- | --- | --- |
| `localStorage` persistence | PocketBase | 1 |
| Auth and accounts | Real sign-up, reset, guardian consent | 2 |
| Legal copy pointing under-13s at "a parent's Crew Pass" | Guardian consent inside sign-up (§6.2) — the Crew Pass no longer exists, so this copy is now wrong, not just draft | 2 |
| Streaks (a counter) | A weekly target (§1): date logic and timezones, and weeks that can break it | 3 |
| Crews (one demo crew) | Creation, invites, membership | 4 |
| Clips (`createObjectURL`, die on refresh) | Upload, R2 storage, token-gated delivery | 4 |
| The map (one embed at a time) | Mapbox with every spot plotted | 4 |
| Payments (instant and free) | Stripe + entitlements | 5 |
| Admin rider list (mock data) | Real riders | 6 |
| Moderation (queue for spots only) | Reporting for profiles and clips | 6 |
| Offline | Service worker cache, then native | 7 |
| Two sports (scooter, skate) | Three — BMX joins at launch (§1), built by T21 | — (§7) |

---

## 6. Legal position, and what is still open

Land It is a product whose core audience is 8–16 year olds, built by a team of one, in the most
active period of child-safety regulation the UK has had. This section is the position we build
against. It was rewritten 2026-08-16 after a research pass found the plan had named only two of
the four regimes that bind us.

Working positions below are taken so that no session sits blocked; the ones marked **needs
counsel** are questions framed tightly enough that an hour of a solicitor's time answers them.
Nothing here is legal advice.

### 6.1 Which regimes apply

**UK Online Safety Act 2023, Part 3 — user-to-user.** The plan missed this entirely until
2026-08-16. Land It lets riders encounter content generated by other riders: submitted spots,
profiles, crew boards, crew invites. Schedule 1's "limited functionality" exemption covers only
comments, reviews and likes on *provider* content, so it does not reach us; and "likely to be
accessed by children" is not a close call. None of the duties scale with size — a service of one
rider owes the same as a service of a million. Before launch we owe an **illegal content risk
assessment** (a new service does this before going live), a **children's access assessment**, and
a **children's risk assessment** per harm type and per age group. Then the Protection of Children
Codes measures that apply to a smaller, low-risk service: a named accountable individual, clear
terms, an easy reporting route, a complaints procedure covering our own moderation decisions, a
content moderation function with a written policy and someone resourced to run it, and an annual
review. All of it written down and kept. There is no Ofcom fee at our size — that regime starts at
£250m qualifying revenue.

**ICO Children's code (AADC).** Applies to any service likely to be accessed by under-18s, which
is us. The consequence that shapes the build: because we will never have confident ages, the ICO's
position is that the code's standards apply to **every** user as the baseline. That is simpler than
a two-tier product, not harder — high-privacy defaults everywhere, geolocation off by default with
a visible indicator when it is on, profiling off by default, no nudge techniques, a DPIA before
processing starts. §6.4 lists the ones with teeth for us.

**UK GDPR Article 8.** Below 13 in the UK, processing on a consent basis needs the consent of a
holder of parental responsibility, with "reasonable efforts… taking into consideration available
technology" to verify it. The threshold varies elsewhere — see §6.3.

**COPPA (US).** Bites only if we are directed to US children or have actual knowledge that a user
is under 13. Because we ask for age, we will have actual knowledge. The amended rule (full
compliance since 22 April 2026) wants genuinely verifiable parental consent, separate consent for
third-party disclosure, a written security programme and a retention policy — materially heavier
than an approval email. See §6.3 for how we handle it.

**EU DSA Article 28 — does not bind us yet.** Article 28 sits in Section 3, and Article 19 exempts
micro and small enterprises (<50 staff, <€10m turnover), so neither Article 28 nor the July 2025
minors guidelines apply while we are that size. Revisit if either threshold is ever in sight.

**The incoming under-16 rules — the one to watch.** The government announced (June/July 2026) a
ban on social media for under-16s, regulations to be laid by the end of 2026 and in force from
Spring 2027, plus default-off livestreaming and stranger communication, no personalised feeds or
autoplay, and an overnight curfew for 16–17s. The working scope is "user-to-user platforms whose
purpose is to enable social interaction and which allow users to post material, alongside
algorithms". There is no statutory definition yet. Land It's *purpose* is trick tracking, so we are
very likely outside the ban — but our core audience is exactly the age group it targets, so being
outside it has to be demonstrable rather than assumed. Four design properties make that argument,
and all four are free now and expensive to retrofit. **Treat them as decisions, not preferences:**

- Crews are **invite-only**. No crew discovery, no browsing riders you do not already know.
- **No rider-to-rider free-text messaging, ever.** None is planned; nothing may add one without
  reopening this section. Trick notes are personal, not a channel.
- **No algorithmic feed.** The crew board is a deterministic leaderboard and the activity feed is
  chronological, scoped to a crew you were invited to.
- Rider-submitted spots reach nobody until a human approves them (already the plan).

Together these mean there is no stranger-contact surface in Land It. That is the sentence the whole
child-safety position rests on; protect it.

### 6.2 The consent flow — decided (2026-08-16)

**No minimum age is stated anywhere.** 13+ is the audience we build for, not a gate we claim to
enforce. Ofcom's 2026 position is that a service stating a minimum age must enforce it with highly
effective age assurance, and the Ofcom/ICO joint statement (March 2026) says a self-declaration
tick-box is explicitly not effective. "13+, please tick" is therefore the *worst* option available:
it manufactures a duty we cannot discharge. Younger riders are welcome, with a guardian.

**Every sign-up picks a country and declares a date of birth in the browser.** The browser computes
an age band and sends the band; the date of birth is discarded and never leaves the device (§3).

**Riders below their country's threshold enter the consent flow:** guardian email, an approval link
valid for a limited window, `consent_state` = `pending` until granted, recorded in
`guardian_consents`. Email approval is the method at launch — Article 8 asks for reasonable efforts
proportionate to the risk of the processing, and ours is low: no ad tech, no public content, no
stranger contact, no third-party disclosure. Highly effective age assurance is reserved for
pornography and self-harm content and is not triggered here.

**What a `pending` or `revoked` account can do:** sign in, browse the library, log tricks, write
notes, build a streak, see their own progress. Everything that touches only their own data.

**What it cannot do:** be visible to any other rider (they read as `private` regardless of setting,
and do not appear on a crew board), join or create or be invited to a crew, submit a spot, attend
an event, upload a clip, or hold a subscription. Enforced in rules and hooks as the fourth
guarantee in §3 — not in the client.

**Consent can be revoked, by a guardian who has no account.** Every consent email carries a
revocation link that works forever. Revocation returns the rider to the limited state above; it
does not delete their tricks. The `guardian_consents` record is evidence and is never hard-deleted
while the account exists.

**Consent lapses on the 13th birthday** (or the local equivalent) without anyone doing anything —
that is what `band_next_change_on` is for.

**The payer must be an adult.** An under-18 cannot comfortably be our counterparty for a
subscription, and selling to a child is exactly what the AADC and the DSA minors guidelines look
hard at. The upgrade flow requires the payer to confirm they are 18 or over; for riders under 16 it
routes to a guardian by email rather than being purchasable in-app by the child. This shapes T15,
so it is decided here rather than discovered there.

### 6.3 Markets — global sign-up, resolved per country (2026-08-16)

Anyone can sign up. The consent threshold follows the rider's declared country, resolved by a
lookup in `packages/core`:

- **UK — 13.**
- **EEA — 16 by default**, lowered only by an explicit per-country entry with a cited source
  (member states may set anything from 13 to 16 and many have; the table only ever lowers, never
  raises, so an unmaintained table fails safe).
- **Everywhere else — 13**, the same fail-safe direction.
- **US under-13 is declined at sign-up**, with a plain explanation. COPPA's verifiable parental
  consent is a different and much heavier mechanism than an approval email, and we are not building
  it at launch. This is the one place "anyone can sign up" does not hold, and it is a deliberate
  refusal rather than a thing we quietly ignore. Revisit as its own project if US riders become a
  real segment.

**Needs counsel:** confirm the EEA table's values, and confirm the US refusal is the right posture
rather than building COPPA consent.

### 6.4 The Children's code standards with teeth here

Not all fifteen bite equally. These four change what gets built:

- **Standard 7, default settings.** High privacy by default for everyone. New profiles default to
  **`private`** — literally that value, not merely "anything other than `public`". `members` does
  not clear this bar: it opens a child's profile to every signed-in stranger on the service, and
  the standard is about visibility being a choice the rider makes rather than the setting they are
  handed. The prototype defaults to `members`, and so did `DEFAULT_PRIVACY` in `packages/core`
  until 2026-08-16 (issue #20) — both read this sentence as satisfied by "not public". It is not.
  `members` stays a setting a rider may choose.
- **Standard 10, geolocation.** Spots carry `lat`/`lng`. Location is off by default, there is a
  visible indicator whenever it is on, and it never persists across sessions. We store the spot's
  location, never the rider's.
- **Standard 12, profiling.** The Legend insights panel (§2.4) derives suggestions from a rider's
  own history. That is defensible and in the rider's interest, but it is profiling: off by
  default, opt-in, and it never leaves the rider's own data.
- **Standard 13, nudge techniques.** The streak is exactly the pattern regulators are looking at,
  and the June 2026 measures (curfews, autoplay off, infinite scroll under consideration) aim
  squarely at engagement mechanics pointed at children. A streak that reflects real riding is
  defensible; what is not, and what we therefore do not build: loss-framed notifications ("your
  streak dies in 2 hours"), any notification between 21:00 and 07:00 local, and a paid streak
  freeze — which would break "achievements are never for sale" anyway. The weekly target (§1) is
  the generosity, and it is written as one: a rider is shown the rides they have made this week,
  never the streak they are about to lose.

### 6.5 Compliance artefacts nobody currently owns

None of this is agent-session work, and none of it blocks a build session. All of it blocks
**launch**, and it runs beside the waves like the infra track (§7):

- **A DPIA.** Mandatory under the Children's code and under UK GDPR for children's data. It has to
  exist before processing starts, which means before the first real rider.
- **The three OSA assessments** from §6.1, written and retained.
- **ICO registration and the data protection fee** — £52/yr, £47 by direct debit, tier 1.
- **A named accountable individual** for OSA compliance, and the controller entity settled (sole
  trader or limited company). **Open — the owner has not decided.** It gates ICO registration and
  determines where liability sits, so it is the first of these to answer.
- **Processor list, Article 28 contracts and a ROPA** for Resend, PostHog, Sentry, Cloudflare and
  Mapbox. PostHog EU and R2 EU already keep transfers simple — that call was right.
- **A published complaints procedure** and a reporting route that works for people who are not
  signed-up riders. The `reports` collection covers the data; the route and the promised response
  time need a human behind them.

### 6.6 Clips

**Decided** (2026-08-15). **2GB on Shredder, 5GB on Legend**, enforced server-side at
upload in the clips hook, with the cap read from the `plans` record so staff can tune it. Clips
live on Cloudflare R2 through PocketBase's S3 storage backend — zero egress fees, so the
watch-cost concern managed hosting had is gone by construction, and the VPS disk never holds
video. Clips are the paid plans' headline upsell; free riders cannot save clips at all. At the
Shredder cap the UI shows usage and offers Legend; at the Legend cap it offers delete-to-make-room,
not an upsell. Cost at cap: ~2.5p (Shredder) to ~6p (Legend) per rider/month in R2 storage.
Retention defaults, flagged as defaults not law: account deletion hard-deletes clips with
everything else; downgrade to Rookie keeps existing clips viewable but blocks new saves. The
privacy-policy promise stands: clips are never public and delivery is always token-gated.

### 6.7 Pricing

**Confirmed** (2026-08-15): Rookie free; Shredder £3.99/mo or £39.99/yr; Legend
£6.99/mo or £69.99/yr — Legend replaces the dropped Crew Pass as a single-rider tier (§2.4).
Yearly ≈ two months free throughout. Cost sanity (checked 2026-08-15, VPS stack): fixed base is
~£18/mo flat — the VPS at £16.80 plus pennies of R2, shared across every product on the box —
so break-even is **~5 Shredders**. Per paying rider, Stripe takes ~26p of £3.99 and clip storage
is the pennies above; there is no egress bill (R2). Native apps will later take a 15% store cut,
which the yearly price should anticipate.

### 6.8 Analytics

**Decided: PostHog EU free tier + Cloudflare Web Analytics** (2026-08-15). PostHog
(EU cloud, cookie-less config) is the product-analytics source of truth — instrument onboarding
steps, trick logging, paywall hits and upgrades as those screens are built. The Cloudflare beacon
rides alongside for plain traffic counts. No consent banner needed for either; keep it that way —
no session recording without revisiting consent, given the audience.

### 6.9 Hosting

**Decided and live** (2026-08-15, replacing the earlier Railway decision). The box is
set up, hardened, monitored and backed up — see `docs/infrastructure.md` for current state.
Coventry datacentre keeps rider data in the UK. Coolify's preview deployments stand in for per-PR
environments; they get wired to the Land It repo once there is something to deploy (after Wave 2).

### 6.10 Staff portal placement — worth revisiting

The handoff recommends a separate internal app. This
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

**The compliance track runs beside them too, and it is the owner's, not a session's.** The DPIA,
the three OSA assessments, ICO registration, the named accountable individual, the processor
contracts and the complaints procedure (§6.5) are paperwork an agent cannot sign. None of it blocks
a build session and all of it blocks launch, so it cannot be left to the end. Two dependencies run
the other way and are worth watching: the controller entity gates ICO registration, and the
children's risk assessment should be drafted before Wave 5 builds crews and spots, because its
findings are cheaper as design input than as rework.

**The BMX track runs beside them as well, and it is also the owner's.** BMX ships at launch (§1),
and two of its three parts cannot be produced by an agent session:

- **The BMX trick library and its prerequisite graph — the long pole.** Scooter and skate got
  61 tricks, difficulty tiers, prerequisite edges and per-trick copy from the design pack. BMX has
  no equivalent source. An agent session cannot invent one credibly: a trick graph is a claim about
  the order children should learn things in, made to children who will follow it, and a
  plausible-looking graph written by something that does not know BMX progression is worse than no
  BMX at all. It has to be authored by a rider who knows the sport — the owner, or someone he
  commissions. The deliverable is per trick: name, one of the five existing categories, difficulty
  1–5, prerequisite trick names, and the `about` / `tips` / `fact` copy, plus a `free` override
  where the default (`diff <= 2`) is wrong. **This blocks launch and it blocks T21; it blocks no
  other session**, so it should start now and run the length of the build.
- **BMX visual assets and sport copy.** A sport icon on the 24px grid to sit beside `scoot` and
  `board`, BMX-flavoured avatars (the current 36 are scooter- and skate-flavoured in places), and
  the sport record's `label` / `short` / `color` / `kit` / `blurb`. The design pack contains no BMX
  material, so this is **new design work and a deliberate divergence from "recreate, don't
  reinterpret"** — named here so no session treats it as a fidelity failure. It has to be produced
  in the existing visual language rather than around it. The sport colour is the awkward one: every
  token already has a job (`--orange` is scooter and Street, `--blue` is skate and Park, `--violet`
  is the paywall and staff, `--lime` is landed, `--red` is destructive and Air), so BMX either takes
  `--pink` — the only token the handoff describes as a general accent — or the palette gains one.
  **That is the owner's call, not a session's.**

Also unsourced but small enough to fold into T21: BMX stickers, either as new records or by
widening existing shared ones.

**Session mechanics — worktrees, branch naming, gates, the merge policy — live in `CLAUDE.md`
(one fact, one place); follow that protocol end to end.** Plan-specific ground rules:

- Read this plan and `design-handoff/README.md` first, then the specific prototype files and
  screenshots named in the task. The prototype is the behavioural spec; this plan wins where they
  conflict.
- **Three sports, not two.** Any screen, filter, tab strip, seed or query that enumerates sports
  iterates `SPORT_IDS` and renders whatever it finds — never a hard-coded scooter/skate pair, and
  never a layout that only works for two. The prototype and the screenshots show two sports because
  they predate the decision; that is not a spec (§3, §1).
- Shared packages (`core`, `db`, `ui-web`) and `pocketbase/` are **additive-only** once their wave
  has merged: a screen session may add a new export, collection field or hook it needs, but must
  not change the signature or behaviour of an existing one. If a breaking change seems necessary,
  stop and flag it instead. Exceptions come from the owner and are recorded here naming the owner
  and the date — a session never authorises its own (`CLAUDE.md` §4).

**Exceptions granted so far.** Two, both from the owner in chat. Each names who and when, because
a grant carrying neither is not authority (LESSONS §3):

- **Rachid, 2026-08-16 — `DEFAULT_PRIVACY` moved from `members` to `private`** in
  `packages/core/src/data/profile.ts` (issue #20). A behaviour change to an export T1 shipped, not
  an addition. The constant disagreed with §6.4 and with the privacy policy T5 had already
  published; T6 is the first thing to read it, so it was settled before sign-up was built rather
  than after riders existed. The sweep that came with it: the `members` blurb no longer calls
  itself the sensible default (LESSONS §4), and two tests in `packages/core` now pin both.
- **Rachid, 2026-08-16 — T21 may reword two category blurbs.** See T21 below.

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
run against a throwaway local PocketBase over HTTP and must prove the four §3 guarantees —
privacy gating, clips never public, paywall enforced on create — as observed API behaviour. Uses a
handful of handwritten fixture records; real seeds come in T4. Inputs: §3 of this plan, handoff
data model section, PocketBase JS hooks + migrations docs.

Scope note added 2026-08-16: this is now **four** guarantees, not three. The consent gate (§3
guarantee 4) needs the `users` age/consent fields, the `guardian_consents` shape and the rules that
reject a `pending` rider from crews, spots, events, clips and subscriptions — with tests that prove
each refusal over HTTP. Profile view rules default to `private`, not `public`.

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
server-held superuser client for admin actions), generated collection types, typed query and
mutation functions for every collection, and seed scripts that load T1's canonical data into local
and hosted PocketBase. Depends on T1 + T2. Seeds iterate the canonical data rather than a fixed
sport list, so the BMX library seeds itself once T21 adds it.

**Divergence, 2026-08-16: the generator is ours, not `pocketbase-typegen`.** That package reads
the schema through `better-sqlite3`, a native module pnpm will not build unless it is added to
`allowBuilds` — and with it unbuilt *every* pnpm command in the workspace fails, CI's
`pnpm install --frozen-lockfile` included. Paying for a native toolchain on every machine to read
a database we generate ourselves was the worse trade, so `packages/db/scripts/generate-types.mjs`
boots a throwaway PocketBase on the pinned binary, applies `pocketbase/migrations/`, and emits
types from the collections API. No dependency, no native build, and the source is the migrations
rather than an exported database. `pnpm --filter @landit/db typegen --check` fails when the
committed file drifts, and a test runs it.

**Seeds live in `packages/db`, not `pocketbase/seed/`** — they need `@landit/core` and the JS SDK,
neither of which the JSVM-side package has or should grow. The `pocketbase/seed/` placeholder from
T0 is gone.

**Authorised additive-only exception (owner: lekky, 2026-08-16, in chat).** T4 folds in issues #8
and #9, which together need one behaviour change to merged shared code. #9 is additive: the three
weekly-streak fields `WeeklyStreakState` needs (`week_start`, `rides_this_week`,
`last_qualifying_week`) arrive in a new migration. #8 is not: the guard in
`pocketbase/hooks/lib/landit.js` now freezes the whole streak tuple — `streak`, `last_ride` and
those three — against every client write, where `streak` was previously writable by the account it
describes. It feeds two sticker rules, so a writable streak was a forgeable achievement in a
product whose §1 says achievements are never for sale. Consequence for later tasks: **"I rode
today" cannot be a PATCH from a screen.** It is a server route that runs `logWeeklyRide` and writes
the result, which T8 owns.

**T5 · Shell, landing, legal.** App shell and routing: top nav, sub-860px five-item bottom bar,
global sport-switch state, toast host, modal host; the landing page; the five legal documents; the
site footer. No auth yet — signed-out only. Depends on T3. Inputs: `landit-legal.jsx`,
`landit-auth.jsx` (landing), `landit-app.jsx` (shell/routing), screenshots 01–03.

The sport switch renders one control per entry in `SPORT_IDS`, which is **three** at launch (§1),
not the prototype's two — build and check it that way now rather than widening it later. The
squeeze is the sub-520px breakpoint, where the design already goes two-up; a third tab has to fit
there without wrapping into something ugly. Build the switch against three sports even while only
two have tricks.

**The legal copy is wrong, not merely draft** (found 2026-08-16). `landit-legal.jsx` still routes
under-13s to "a parent's Crew Pass" and says an adult may hold up to five rider accounts — the Crew
Pass was dropped in §2.4, so the consent mechanism the terms describe does not exist. Rewrite the
age, consent and safeguarding sections against §6.2 rather than transcribing them, and hold the
handoff's register: written to be read by a fourteen year old and their parent. Do not invent a
"13+" minimum — §6.2 says why.

**Both promises are decided (Rachid, 2026-08-16).** They were flagged before the copy was written,
and the answers are different from each other on purpose:

- **The one-working-day response on `safeguarding@` ships as written.** It is a commitment the
  owner is making, not a description of a feature, so there is nothing to build before it is true.
  It is also the kind of thing the OSA expects to see and be held to (§6.1), and softening it to
  "as soon as we can" would be worth less than the promise costs.
- **The reporting claim is softened to what exists.** The pack said "every profile and clip can be
  reported" while the buttons that would do it are T18. The safeguarding page now describes the
  email route, says the in-app buttons are on the way, and stops short of claiming them. **T18
  rewrites that paragraph when it lands the flow** — the page cannot ship at launch describing a
  button that does nothing (§7, T18), and this softening is what makes the gap survivable in the
  meantime rather than making it acceptable.

Two further divergences, deliberate and recorded here rather than discovered later:

- **The landing page's calls to action are disabled, not links.** `typedRoutes` makes a link to an
  unbuilt page a compile error, and `/signup` is T6's. So "Start tracking, free", "I've got an
  account" and the top bar's Sign in render disabled with a one-line note, behind a single
  `AUTH_ROUTES_LIVE` constant that T6 deletes. Screenshots 01 and 02 show them live; that is the
  only fidelity gap on the landing page and it closes in the next wave. The same rule governs the
  footer and the nav: a destination nobody has built renders as a label, not a link, and the task
  that lands the screen adds the href.
- **The footer's "Avatar set" link is dropped.** It pointed at `Land It - Avatars.html` in the
  design pack, and no task in this section turns that into a route, so there is nothing for it to
  link to. **Settled (Rachid, 2026-08-16): there is no public avatar showcase.** The set stays
  internal reference material, the footer keeps the shape it has, and the link does not come back
  — a session that wants to add one is proposing a new page, not restoring a missing one
  (issue #22, closed).

T5 also adds `/design/shell`, a noindexed reference page beside T3's `/design`. The shell ships a
wave before any screen does, so without it the deliverable has no surface to check and no surface
to test — that is where the three-sport switch is proved against a 375px phone before `SPORT_IDS`
has a third entry.

### Wave 3 — one session

**T6 · Auth + onboarding + consent.** PocketBase auth (email/password + reset, mail through
Resend SMTP), profile fields on `users`, handle generation, the four onboarding steps, avatar
picker, timezone capture. Sign-up captures country and an age band computed in the browser from a
date of birth that is then discarded (§3) — no minimum age is stated anywhere. Riders below their
country's threshold enter the guardian consent flow — guardian email, approval link, account
limited until granted, revocation link that never expires — writing `guardian_consents`.

The threshold table and the "limited" scope live in one pure module in `packages/core`
(`consent.ts`), unit-tested: threshold by country per §6.3 (UK 13, EEA 16 unless explicitly
lowered, elsewhere 13, US under-13 declined at sign-up with a plain explanation), band transitions
via `band_next_change_on`, and the allow/deny list for a `pending` account. The client renders the
gate; `pocketbase/hooks/` enforces it (§3 guarantee 4). **Constants are decided (§6.2), not
pending** — counsel confirms them rather than unblocking them, so this task no longer holds up the
Wave 3 merge. Depends on T4 + T5. Inputs: `landit-auth.jsx`, §6.2–6.3 of this plan,
screenshots 04–05.

Onboarding step 1 ("what you ride") offers a card per entry in `SPORT_IDS` — three at launch (§1),
where screenshot 05 shows two. The two-card grid becomes an N-card grid; multi-select and the
at-least-one rule are unchanged. Step 4's suggested tricks and step 3's goal pills already filter by
the rider's chosen sports, so they need nothing beyond not assuming a pair.

### Wave 4 — the core loop, three concurrent sessions (route-disjoint)

**T7 · Library + trick detail + locked trick.** Filters, search, rookie banner, stage picker,
notes, prerequisite/unlock pills, locked-trick page. Clips panel renders in its locked/upsell state
only (real clips are T14). Inputs: `landit-screens-a.jsx`, screenshots 08–10.

**T8 · Home + streak + announcements.** Dashboard, stat blocks, "I rode today", streak logic wired
to `core` (timezone-aware), announcement banner + dismissal, working-on/start-here, wish list,
stickers/crew teaser panels. The streak is the **weekly** one (§1): wire `logWeeklyRide`,
`currentWeeklyStreak` and `weeklyProgress`, not the deprecated daily functions, and "I rode today"
is a plain button that attaches no spot and captures no location. The prototype's seven-day strip
counts days and so no longer matches the rule — what replaces it on the card is a design call to
settle in this session. The streak obeys the §6.4 nudge rules: no loss-framed copy or
notifications, and nothing sent between 21:00 and 07:00 local. Inputs: `landit-screens-a.jsx`
(Home), screenshots 06.

**T9 · Progress + skill tree.** By category, by stage, over-time chart with the estimated-dates
note, skill tree with prerequisite/paywall lock states, printable sheets panel. Also the
Legend-gated **insights panel** (§2.4): per-category trends, personal records, next-trick
suggestions derived from the skill tree — locked state on lower plans mirrors the clips-panel
upsell pattern. The panel is profiling under the Children's code (§6.4): off by default, opt-in
even on Legend, and it never reads anything but the rider's own history. Inputs:
`landit-screens-b.jsx`, screenshots 11–13.

### Wave 5 — four concurrent sessions (clips may lag)

**T10 · Stickers.** Wall, detail modal, share card; server-side award flow end-to-end (earn a
sticker by tracking, see the toast once, never re-announced). Inputs: `landit-screens-b.jsx`,
`landit-ui.jsx` (StickerBadge, share), screenshot 14.

**T11 · Crew + rider profiles.** Real crews: create, invite (the 1080×1080 canvas share card with
`navigator.share` fallbacks), join, board, activity feed; rider profile with the three-way privacy
gating driven by the §3 access rules (the "viewing as" toggle from the prototype becomes real
signed-in/out states); coach view. Two constraints from §6.1 that the prototype does not enforce
and this task must: crews are **invite-only with no discovery** — no directory, no browsing or
searching riders you are not already crewed with — and new profiles default to **private**, not
public. There is no rider-to-rider messaging and none may be added here. Inputs:
`landit-screens-b.jsx`, `landit-screens-c.jsx`, `landit-screens-d.jsx`, screenshots 15–16, 24.

**T12 · Challenge + events.** Live/upcoming/past challenge states derived from dates, log button
gated server-side to the live window, past weeks blurred on free plan; events list, filters, detail
modal, "I'm going". Inputs: `landit-screens-b.jsx`, `landit-screens-d.jsx`, screenshots 17–18.

**T13 · Spots + map.** Mapbox with every live spot plotted, styled to the design language;
selection sync between list and map; spot submission (Maps-link or coordinate parsing) into the
`pending` queue, rate-limited. Children's code standard 10 (§6.4): browser geolocation is off by
default and opt-in per use, there is a visible indicator whenever it is live, it never persists
across sessions, and the rider's own position is never stored — only the spot's. Inputs:
`landit-screens-b.jsx`, screenshot 19.

**T14 · Clips.** Upload through PocketBase's file field backed by R2, token-gated playback,
per-plan cap read from the `plans` record (2GB Shredder / 5GB Legend) enforced in the upload hook,
the at-cap states from §6.6, delete. Slot anywhere after Wave 4. Inputs: `landit-screens-a.jsx`
(clips panel), §6.6 clip decision.

### Wave 6 — three sessions, T15 ∥ T16 then T17

**T15 · Payments.** Stripe Checkout + customer portal, webhook (Next.js route) → `subscriptions`
records via the superuser client, entitlement resolution from our own collection (§2.4), plans
page with monthly/yearly toggle and FAQ, and an end-to-end test that a rookie → shredder upgrade
actually unlocks a paid trick at the hook layer. Three plan cards as designed, but the top card is
**Legend** (single rider, §2.4), not the prototype's Crew Pass — rewrite its pitch, perks and FAQ
copy around the 5GB vault, flair and insights; Shredder stays the raised "Most riders" card.
Legend flair itself (profile/crew-board tag, exclusive avatars) is applied where those surfaces
live — coordinate the tag rendering with what T11 built. **The payer must be an adult** (§6.2):
checkout requires an 18+ confirmation, a rider whose `consent_state` is not `granted` cannot hold a
subscription at all (§3 guarantee 4), and for riders under 16 the upgrade routes to a guardian by
email rather than being purchasable in-app by the child. Test that refusal at the hook layer beside
the upgrade test. Inputs: `landit-screens-c.jsx`, §2.4, §6.2, screenshot 20.

**T16 · Admin: shell + riders + audit.** `/admin` route group behind the role gate, admin nav,
Overview, Riders (search, plan override, rider sheet, suspend), and the audit-log plumbing every
later admin write uses — every mutation lands as a server action using the superuser client that
writes `audit_log` in the same transaction. Runs concurrently with T15. Inputs: `landit-admin.jsx`,
screenshots 25–27.

**T17 · Admin: content tabs.** Trick library editing, stickers, spots queue, events, challenges,
announcements composer, plans editor — all on T16's action/audit pattern. Also the moderation view
over the `reports` collection. Depends on T16. Inputs: `landit-admin.jsx`, screenshots 28–31.

### Wave 7 — one session, alone

**T21 · BMX as a third sport.** Turns the decision in §1 into a shipped sport:

- Widen `SportId` to `'scooter' | 'skate' | 'bmx'` and add the `SPORTS` entry from the owner's sport
  copy. Every `Record<SportId, …>` in the repo then fails to compile until it has a BMX entry —
  work the compiler's list; that list *is* the scope.
- Load the owner's BMX trick library and its prerequisite edges into `packages/core`'s canonical
  data as a third block, with tests holding the same-sport prerequisite invariant and the
  free/locked rule over the new tricks.
- BMX stickers — new records, or widen shared ones — per the owner's list.
- An additive PocketBase migration adding `bmx` to every fixed-option `sport` select, and a seed run
  that loads the new tricks, edges and stickers.
- The BMX sport icon into `packages/ui-web`'s icon map beside `scoot` and `board`, and the BMX
  avatars as package assets plus registry entries.
- **Owner-authorised exception to additive-only (Rachid, 2026-08-16):** reword the two
  skate-flavoured category blurbs — `flat`'s "Balance and board control" and `hybrid`'s "Combos and
  deck flips". Categories are sport-agnostic (§3) and the copy has to be too. Copy only; no
  signature or behaviour changes.
- Sweep for the two-sport assumptions the type system cannot catch: tab strips and filter rows built
  from literals, seed scripts, and any copy that says "both sports".

**This session runs alone in its wave.** Widening `SportId` is a repo-wide edit that touches every
package at once, so nothing else can share the wave without conflicting. It depends on the BMX
content track above, not only on the wave before it, and it can move **earlier** if the library and
assets are ready sooner — the only hard constraint is that it must not sit in front of Wave 4. It is
placed here, late, because the content is the risk and this maximises the runway for it. Inputs:
§1, §3, the owner's BMX trick library and asset set, `packages/core/src/data/sports.ts`,
`packages/ui-web/src/icons.tsx`.

### Wave 8 — three concurrent sessions

**T18 · Hardening.** Reporting flows in the rider app (profile/clip report buttons), account
deletion + data export (GDPR — the privacy policy promises both), rate limits on submissions and
handle checks, Sentry verification, then run a full security review pass over the branch history.
The OSA reporting duties (§6.1) land here too: a route that works for someone who is not a
signed-up rider, and a complaints path for appealing our own moderation decisions — both writing
`reports`. This task is a launch blocker in a way the rest of Wave 8 is not; the safeguarding page
promises it in Phase 2 and cannot ship promising a button that does nothing.

T5 softened that page's reporting paragraph to the email route (owner decision, above), so **this
task also rewrites it**: `apps/web/src/content/legal.ts`, the safeguarding document's Reporting
section, plus the assertion in `e2e/legal.spec.ts` that currently holds the softened wording. The
one-working-day response stays as it is.

**T19 · PWA + offline read cache.** Service worker caching the library and the rider's tracked
list, install manifest, the "read at the park" story from §2.3.

**T20 · E2E + fidelity pass.** Playwright suite over the §2.5 smoke flows plus paywall and privacy
gating, and a screen-by-screen visual comparison against all 31 screenshots with fixes for
divergences. This session gets the *whole* app, so nothing else runs beside it.

Every three-sport surface is a **known and intended** divergence from the screenshots, which were
captured before the decision in §1: sport tabs, onboarding step 1, filter rows and any sport chip
row will show three where the capture shows two. Do not "fix" those back. BMX's own visuals — icon,
avatars, sport colour — have no screenshot to compare against at all; judge them against the design
language in `design-handoff/README.md` and flag anything that fights it rather than silently
restyling the owner's assets.

### Dependency graph

```
T0 ─┬─ T1 ─┬─ T4 ─┬─ T6 ─┬─ T7  T8  T9 ─┬─ T10 T11 T12 T13 (T14) ─┬─ T15 ──────┐
    ├─ T2 ─┘      │      │               │                        │            ├─ T21 ─┬─ T18 T19
    └─ T3 ─── T5 ─┘      └───────────────┘                        └─ T16 ─ T17 ┘       └─ T20 (last)
```

Sixteen of the twenty-one sessions run inside a concurrent wave; T21 and T20 each get a wave to
themselves. The serial spine is T0 → (wave 1) → T4 → T6 → (wave 4) → … — about eight sequential
steps end to end. The infra track (§2.6) runs alongside and needs to be live by the end of Wave 2.
T21 also depends on the BMX content track above, which is not on this graph because no session
produces it.

**What BMX at launch costs, honestly.** The engineering is one session and it is mechanical, because
sport was already a dimension (§3) — nothing is dropped or deferred to make room for T21, and no
existing wave gets longer. The cost is the content: a BMX library with the depth of the other two
(scooter and skate ship 61 tricks between them) is a real body of authoring work, and it is the
owner's, not a session's. So the launch date moves **only** if the BMX library and assets are not
finished by the time the build reaches Wave 7 — and on a build with this many sequential waves in
front of it, that is a runway measured in waves, not days. If the content slips anyway, the choice
is to hold launch or to launch on two sports and add BMX behind it; both are the owner's call, and
neither is a decision a session may take on its own.
