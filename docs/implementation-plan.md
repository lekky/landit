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
| Rider video | **Land It does not host video. Riders paste a YouTube link and the app embeds it** | **Reversed 2026-08-17 (Rachid, in chat).** Was "Cloudflare R2 via PocketBase's S3 backend, 2GB cap per rider (5GB Legend)", decided 2026-08-15 and built as T14. Hosting other people's children's video is the single heaviest thing this product could take on — moderation duty, storage cost, takedown obligations and a private-bucket promise to keep — and the rider benefit is a video they have usually already uploaded to YouTube. Per-video visibility follows the same three-way `public \| members \| private` model as profile privacy, defaulting to private. T14 is reverted (see §7); the link feature is **`t15b-video-links`** and is not built yet. See §6.6. |
| Maps provider | **Mapbox** (provisional) | Store plain `lat`/`lng` so it stays swappable. |
| Payments | **Stripe on web**; entitlements modelled independently of Stripe; **single-rider plans only — Crew Pass dropped** (2026-08-15) | See §2.4 — entitlement independence is the decision that protects the native option. |
| Streak shape | **A weekly target, not a consecutive-day count** (2026-08-16). A rider keeps the streak by riding **at least 2 times in a week**; the streak counts consecutive weeks that met the target, and missing a week breaks it. "I rode today" stays a plain button — no spot attached, no location captured | The audience is children who realistically ride at weekends: a daily streak punishes a school week, and is the engagement mechanic §6.4 Standard 13 warns about. Weeks are Monday-to-Sunday — the boundary the weekly challenges already use, so a rider never has two different "this week"s. **Two numbers here are tunable defaults, not deliberated decisions: the target of 2** (a weekend alone reaches it; 3 would force a weekday ride) **and no grace week** (the weekly target is itself the forgiveness — a grace week on top would make the streak nearly unbreakable). Both are constants in `packages/core` (`WEEKLY_RIDE_TARGET`, `WEEKLY_STREAK_GRACE_WEEKS`) and options on every function, so moving either is a one-line change plus this row. This supersedes the daily-streak and grace-period framing throughout: the daily functions in `core` stay exported but deprecated, and T8 wires the weekly ones. Stored shape in §3; that spots never record where a rider has been is §6.4 Standard 10 and T13. |
| Staff portal placement | **Route group in the web app**, hard role gate, full audit log | Handoff prefers a separate app; see §6.10. |
| Error reporting | **Sentry** | Already connected; PII scrubbed. See §2.5. |
| Analytics | **PostHog EU (free tier) + Cloudflare Web Analytics** | PostHog for product events (onboarding funnel, upgrades), Cloudflare beacon for traffic. Both cookie-less, no ad identifiers. |
| Transactional email | **MailerSend** | **Changed 2026-08-16 (Rachid); was Resend, confirmed 2026-08-15.** Resend is already in use on another product and its free tier carries one sending domain, so Land It would have meant paying before launch for a service sending dozens of emails a month. MailerSend's free tier (500/month, one domain) covers launch volume many times over, and it is EU-based — the same reason PostHog EU and R2 EU were chosen (§6.5). **Nothing in the codebase names a provider:** PocketBase sends over plain SMTP, so this is five environment values and no code change, and switching again costs the same. Rolling our own on box1 was considered and rejected — a cold shared IP that also carries the other products, and the guardian-consent email is the one that must not land in spam. |
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
    seed/                tricks (97: scooter, skate and BMX), stickers, plans, spots, events, challenges
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

- **Rookie** — free. Tricks up to the free cut-off.
- **Shredder** — £3.99/mo · £39.99/yr. Everything unlocked.
- **Legend** — £6.99/mo · £69.99/yr. Everything in Shredder plus **Legend flair**
  (profile/crew-board tag, exclusive avatar drops) and **progress insights** (per-category
  trends, personal records, next-trick suggestions derived from the skill tree).

**Both paid cards lost a perk on 2026-08-17 and nothing has replaced it.** The clip vault — 2GB on
Shredder, 5GB on Legend — was the headline on both, and Legend's whole pitch was "a bigger vault".
Clip hosting was reversed that day (§1, §6.6) and the vault lines were removed from the plan cards,
the plans page, the guardian upgrade email and the legal documents, because leaving copy that sells
a feature the product does not have is the one outcome worse than a thin card. **Nothing was
invented in their place**: what a paid tier is worth is a pricing decision, reserved for the owner,
and it is filed as an issue. As it stands Shredder sells "everything unlocked" and Legend sells
flair, insights and printable sheets — accurate, and arguably not £3 a month apart. Whether the
video-link feature (`t15b-video-links`) is a paid perk at all, or free on every tier, is part of the
same unmade decision. `plans.clip_cap_bytes` and `Plan.clipCapBytes` survive as dormant data — see
§6.6 for why they were not deleted.

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
    ├── landit PB      PocketBase instance (api.landthetrick.com)
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
| `clips` | **No file field since 2026-08-17** (§6.6). `user`, `trick`, `at` only, and `createRule: null` — server code can write it, riders cannot. The row-per-video skeleton `t15b-video-links` extends with `url` and `visibility` |
| `stickers` | Name, hue, icon, condition copy, editable threshold `n`, `is_live`. Rules stay in code |
| `rider_stickers` | `earned_at` plus `seen_at`, so a sticker is never re-announced |
| `plans`, `subscriptions` | See §2.4. No seat collection — Crew Pass dropped. `plans` still carries `clip_cap_bytes`, dormant since 2026-08-17 and kept only because `listPlans` orders the plan cards by it (§6.6) |
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
code. T11 builds its UI on both. `plans` carries `unlocks_paid_tricks` alongside the dormant clip cap, so
the paywall is staff-tunable from the same record and fails closed when a plan is missing.

### Access rules (the RLS role, in PocketBase terms)

Collection API rules plus hooks carry what row-level security carried in the Supabase design.
Four guarantees matter more than the rest, and T2's tests must prove each one over the HTTP API,
not by reading the rule text:

1. **Profile privacy.** `public` / `members` / `private` maps onto the view rules for `users`,
   `trick_progress` and `rider_stickers`. A private rider still appears on the crew board by name
   and score, so the crew board reads a narrow server-shaped payload (a hook route or filtered
   fields), never the full record.
2. **Land It stores no rider video.** **Rewritten 2026-08-17; authorised by the owner (Rachid,
   2026-08-17, in chat).** This guarantee used to read: *"Clips are never public. The `clips` file
   field is protected: delivery only via short-lived file tokens minted for the owner, no rule path
   that exposes a clip to another rider, R2 bucket private."* That was true of what T14 built, and
   it is not a rule that has been dropped — the thing it protected has been removed, so the
   guarantee now states the stronger fact in its place: **there is no upload anywhere in the
   product, and no rider video on our servers.** It is enforced by the schema, not by the UI —
   `pocketbase/migrations/1787270400_clips_no_hosting.js` removes the `file`, `size` and `kind`
   fields from `clips` and sets its `createRule` to `null`, so there is no field for bytes to land
   in and no rider write path to the collection at all. A session that wants to add a file field to
   any collection is reversing a guarantee and must stop and flag it.

   **This guarantee does not yet cover the replacement, and must not be read as if it does.** The
   incoming feature (`t15b-video-links`) has riders paste a **YouTube link**, and a link carries a
   different risk: not "can a stranger fetch these bytes" but "who can see that this rider posted
   this". That needs its own guarantee, about **per-video visibility defaults and the
   profile-privacy ceiling** — visibility is `public | members | private` on the same model as §6.4,
   it **defaults to private**, and a video must never be visible more widely than the profile it
   hangs off, enforced in rules rather than computed in a component. **That guarantee is
   `t15b-video-links`' to write, with tests, and is deliberately not written here** — this session
   reverted a feature and does not get to specify the next one. Until it lands, there are four
   guarantees and this is the one with a gap in it.
3. **The paywall is a data-layer rule, not a UI rule.** The `trick_progress` create hook rejects a
   paid trick for a rookie-plan rider, whatever the client sends. If the paywall only lives in the
   client it is a suggestion.
4. **The consent gate is server-side** (added 2026-08-16). A rider whose `consent_state` is
   `pending` or `revoked` may read and write only their own data — tricks, stages, notes,
   streaks, progress. Every collection that makes a rider visible, reachable or billable rejects
   them at the rule or hook layer: `crews`, `crew_members`, `crew_invites`, `spots` create,
   `event_attendance`, `subscriptions`, and any view rule that would surface their
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
| Clips (`createObjectURL`, die on refresh) | ~~Upload, R2 storage, token-gated delivery~~ — **no longer a gap.** Land It hosts no video (§6.6, reversed 2026-08-17). The prototype's clips panel has no counterpart in the product; embedded YouTube links are `t15b-video-links` | 4 |
| The map (one embed at a time) | Mapbox with every spot plotted | 4 |
| Payments (instant and free) | Stripe + entitlements | 5 |
| Admin rider list (mock data) | Real riders | 6 |
| Moderation (queue for spots only) | Reporting for profiles (and for video links once `t15b` lands) | 6 |
| Offline | Service worker cache, then native | 7 |
| Two sports (scooter, skate) | Three — BMX joined at launch (§1), built by T21 | — (§7) |

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
an event, or hold a subscription. Enforced in rules and hooks as the fourth
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
- **Processor list, Article 28 contracts and a ROPA** for MailerSend, PostHog, Sentry, Cloudflare
  and Mapbox. PostHog EU and R2 EU already keep transfers simple — that call was right, and
  MailerSend (Lithuania) was picked partly to keep it that way, so check its DPA carries the
  Article 28 terms rather than assuming an EU address settles it. The processor here handles a
  **guardian's email address**, which is a third party's personal data collected from a child, so
  it is the entry on this list to get right first.
- **A published complaints procedure** and a reporting route that works for people who are not
  signed-up riders. The `reports` collection covers the data; the route and the promised response
  time need a human behind them.

### 6.6 Rider video — we do not host it

**Reversed 2026-08-17 (Rachid, in chat).** Land It hosts no video. There is no upload anywhere in
the product, no clip vault, no per-plan byte cap and no object storage for rider footage. Riders
will instead **paste a YouTube link** which the app embeds, with **per-video visibility on the same
three-way `public | members | private` model as profile privacy, defaulting to private**. That
feature is **`t15b-video-links`** and is not built; this section describes only the reversal.

The previous decision, for the record, was: *2GB on Shredder and 5GB on Legend, enforced
server-side in the clips hook with the cap read from the `plans` record; clips on Cloudflare R2
through PocketBase's S3 backend; clips as the paid plans' headline upsell; delete-to-make-room at
the top of the range.* It was decided 2026-08-15, built as T14 and shipped in PR #112. What it
asked of a pre-launch product aimed at children was a moderation duty over uploaded video, a
takedown process, a storage bill that scales with the thing riders are most enthusiastic about, and
a private-bucket promise printed in the privacy policy — in exchange for hosting a video most
riders have already put on YouTube. An embed keeps the feature and moves all four to somebody
else's problem.

**What the reversal removed, in behaviour terms:** the trick page's clips panel (upload, tile,
playback, delete, usage line and at-cap upsell) is gone entirely rather than reduced to a locked
state, because a locked panel advertises a feature that is not coming back in that shape. The
`clips` collection survives with `user`, `trick` and `at` as the row-per-video skeleton `t15b`
fills in; its `file`, `size` and `kind` fields are removed and its `createRule` is `null`, so
nothing but server code can write it (`pocketbase/migrations/1787270400_clips_no_hosting.js`, which
records the owner's grant because it is a breaking change to a merged collection). The `upload_clip`
guardian-consent capability is gone from `@landit/core` — `t15b` adds its own. The `first-clip`
("Caught On Cam") sticker is set `isLive: false` rather than deleted: its condition is a clip
upload, so nobody can earn it, and a wall showing an unearnable achievement is the same false
promise as vault copy on a plan card. Whether `t15b` re-arms it is an owner decision, filed as an
issue.

**`plans.clip_cap_bytes` and `Plan.clipCapBytes` are kept, dormant, and this is deliberate.**
Nothing enforces them — the hook that read them is deleted — so they grant nobody anything. They
survive for one reason: `listPlans` in `@landit/db` orders **every** plan-card surface (the plans
page, the staff plan bars, the staff plan dropdown) by `plans.clip_cap_bytes` ascending, because it
is that collection's only numeric column and happened to rise with price. `price_monthly` is text
("£3.99"), so it cannot replace it without breaking the day a plan costs £10. Zeroing the caps
would collapse the ordering; deleting the column needs an explicit rank field, which is a new field
on a merged collection and therefore somebody's deliberate decision rather than a side effect of a
reversal. It is filed as an issue, and a `@landit/core` test keeps the three values strictly
ascending so the ordering cannot silently break. **Nothing may read these numbers as a vault size
or put one on a screen.** Whether any per-plan video limit exists at all — and if so, a *count* of
links rather than bytes — is `t15b`'s to decide.

**Retention, restated for the new shape:** account deletion still removes everything we hold,
which now includes no video because there is none. Nothing survives a downgrade differently,
because there is nothing stored to survive.

### 6.7 Pricing

**Confirmed** (2026-08-15): Rookie free; Shredder £3.99/mo or £39.99/yr; Legend
£6.99/mo or £69.99/yr — Legend replaces the dropped Crew Pass as a single-rider tier (§2.4).
Yearly ≈ two months free throughout. Cost sanity (checked 2026-08-15, VPS stack): fixed base is
~£18/mo flat — the VPS at £16.80 plus pennies of R2 for **database backups** (§2.6), shared across
every product on the box — so break-even is **~5 Shredders**. Per paying rider, Stripe takes ~26p
of £3.99 and there is no storage or egress cost at all: since 2026-08-17 Land It hosts no video
(§6.6), so the per-rider marginal cost of a paid plan is Stripe's fee and nothing else. Native apps
will later take a 15% store cut, which the yearly price should anticipate.

**The prices above are confirmed; what they buy is not.** The clip vault was the headline perk on
both paid cards and it was withdrawn on 2026-08-17 without a replacement (§2.4). Legend at £6.99
now differs from Shredder at £3.99 by flair, insights and printable sheets alone. **Re-pitching the
paid tiers, and deciding whether the video-link feature is a paid perk or free on every tier, is an
open owner decision** — filed as an issue, not resolved here.

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
same-sport prereq check, challenge-overlap rejection, clip-cap skeleton (removed 2026-08-17, §6.6), audit-log writer. Tests
run against a throwaway local PocketBase over HTTP and must prove the four §3 guarantees —
privacy gating, clips never public (superseded — see §3 guarantee 2, rewritten 2026-08-17), paywall enforced on create — as observed API behaviour. Uses a
handful of handwritten fixture records; real seeds come in T4. Inputs: §3 of this plan, handoff
data model section, PocketBase JS hooks + migrations docs.

Scope note added 2026-08-16: this is now **four** guarantees, not three. The consent gate (§3
guarantee 4) needs the `users` age/consent fields, the `guardian_consents` shape and the rules that
reject a `pending` rider from crews, spots, events and subscriptions — with tests that prove
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

**A third divergence, added 2026-08-16 (issue #57): the top bar tightens between 861px and
1040px.** The prototype was drawn at one desktop width and never asked what nine nav items cost.
Measured on the built shell they cost 993px of viewport — wordmark, nine items, streak chip and
avatar — so in the band between the 860px bottom-bar breakpoint and roughly 1000px the row did not
fit, and because nothing in a flex row shrinks below its text the excess left the right-hand edge
and gave the **whole document** a horizontal scrollbar, on every signed-in screen at once. Inside
that band only, `packages/ui-web/src/styles/additions.css` drops the nav to 13px with tighter
padding and gaps and the wordmark to 19px — the same treatment this stylesheet already gives the
bar below 860px, one breakpoint up. All nine items stay visible and clickable; nothing changes
outside the band. **T20 should read this before "fixing" the band back to match a screenshot**:
the captures were taken wide, and at a 934px viewport they do not show what the built app did.
`e2e/shell.spec.ts` holds the line at six widths — it fails if the document scrolls sideways *or*
if the nav does, the second because the first passes on the safety net alone.

T5 also adds `/design/shell`, a noindexed reference page beside T3's `/design`. The shell ships a
wave before any screen does, so without it the deliverable has no surface to check and no surface
to test — that is where the three-sport switch is proved against a 375px phone before `SPORT_IDS`
has a third entry.

### Wave 3 — one session

**T6 · Auth + onboarding + consent.** PocketBase auth (email/password + reset, mail over SMTP —
§1 names the provider), profile fields on `users`, handle generation, the four onboarding steps, avatar
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

**Built 2026-08-16. Five things the entry above did not say, recorded here because they are
decisions rather than details:**

- **A sign-up with no age declaration is refused, by the server.** `consent_state` is computed from
  the declared country and band in a model-layer hook, whatever the client sent — but a sign-up that
  simply *omitted* the fields would have landed as `not_required` and walked past guarantee 4 by
  omission. So `age_band` and `country` are now required on any non-superuser `users` create.
  Consequence for later sessions: a rider created through the public endpoint needs both fields, and
  `pocketbase/tests/helpers.ts` defaults them to an adult in the UK.
- **The consent routes are PocketBase's, not Next's.** `POST /api/landit/consent/{request,preview,
  approve,revoke}` join the two routes in §3, because §1 puts guardian-consent mail on PocketBase's
  SMTP and that is where the credentials are. The approval link in the email opens a page
  that *asks*; the decision is a form POST. A link that acted on its own would be actioned by every
  mail scanner that follows links in an inbox.
- **No new field, and no `consent_lapses_on`.** The first design stored the day consent lapses.
  It is derivable exactly — consent is owed for whole bands, so it always ends on a band boundary —
  and `consentLapsesOn` derives it. Nothing in T6 changes the schema, so there is no migration.
- **The EEA table ships empty**, so every EEA rider under 16 is asked. §6.3 admits an entry only
  with a cited source, and that is still open. One consequence worth knowing before counsel fills it
  in: because the decision is made from the stored *band*, a threshold of 14 or 15 rounds up to 16.
  An entry of 13 works exactly; anything between over-protects rather than under-protects.
- **`/account` is a new screen, and a small one.** A rider has to land somewhere the moment sign-up
  exists, and a rider held at `pending` needs a place that says so and lets them send the guardian
  email. It shows the profile onboarding just saved, the guardian panel while it applies, and sign
  out. It is also the first screen to use the app shell's `rider`, which T5 left for T6. T8's Home
  supersedes most of it.

### Wave 4 — the core loop, three concurrent sessions (route-disjoint)

**T7 · Library + trick detail + locked trick.** Filters, search, rookie banner, stage picker,
notes, prerequisite/unlock pills, locked-trick page. Clips panel renders in its locked/upsell state
only (real clips are T14). Inputs: `landit-screens-a.jsx`, screenshots 08–10.
(**Superseded 2026-08-17:** the clips panel no longer exists in any state — T14 was reverted and
Land It hosts no video, §6.6. The rest of T7 stands.)

**Built 2026-08-16. Four decisions the entry above did not settle:**

- **The library and a trick page are readable signed out.** `tricks` and `trick_prereqs` are
  listable without a token by their own API rules, and `@landit/db` already described the library
  as readable signed out, so a visitor gets the grid and the lowdown, with the paid tiers drawn as
  locked and a sign-in prompt where the stage picker goes. Nothing rider-shaped is on the page for
  them: no status filters with anything in them, and no notes.
- **The tricks are read from the collection, never from `@landit/core`'s constants.** The canonical
  data seeds the collection and the collection is what staff edit (T17), so a screen reading the
  constants would make a staff edit invisible. What comes from `core` is the rules applied to those
  rows — `tricksFromRecords` in `@landit/db` is the one place that knows how a row differs from the
  rule shape, and the empty `free_override` arriving as `undefined` rather than `false` is the part
  worth not getting wrong.
- **"See plans" renders disabled, on both the rookie banner and the clips panel.** `/plans` is T15
  and `typedRoutes` makes a link to it a compile error; this is T5's established answer to that
  (§7, T5). Each carries one line saying upgrading is not switched on yet. (**Superseded:** T15 made
  `/plans` real and wired both links; the clips panel was then deleted altogether on 2026-08-17,
  §6.6. Only the rookie banner's link remains.)
- **The "Share it" button on a landed trick is not built.** Screenshot 09 shows one, and the share
  card it opens is a component T10 builds for stickers and tricks together (`landit-ui.jsx`'s
  `ShareCard` takes a `kind`). Building a second one here would be the thing to delete in Wave 5.
  The first-landed date ships without it; tracked as an issue, and it is the only fidelity gap on
  screen 09.

**T8 · Home + streak + announcements.** Dashboard, stat blocks, "I rode today", streak logic wired
to `core` (timezone-aware), announcement banner + dismissal, working-on/start-here, wish list,
stickers/crew teaser panels. The streak is the **weekly** one (§1): wire `logWeeklyRide`,
`currentWeeklyStreak` and `weeklyProgress`, not the deprecated daily functions, and "I rode today"
is a plain button that attaches no spot and captures no location. The prototype's seven-day strip
counts days and so no longer matches the rule — what replaces it on the card is a design call to
settle in this session. The streak obeys the §6.4 nudge rules: no loss-framed copy or
notifications, and nothing sent between 21:00 and 07:00 local. Inputs: `landit-screens-a.jsx`
(Home), screenshots 06.

**Built 2026-08-16. The design call is settled, and two things the entry above could not know:**

- **The seven-day strip becomes a rides-this-week strip.** The cells stay — same ink panel, same
  hard-keylined segmented row, same yellow fill, same button under it, so the card's silhouette
  against screenshot 06 is unchanged — but there is now **one cell per ride the week needs**
  (`WEEKLY_RIDE_TARGET`, two today), filled left to right as rides land, under the label "Rides this
  week" and a count reading "1 of 2". Rides past the target show as a `+N` chip rather than more
  cells, so the row never grows unbounded. The Anton headline changes unit with the rule: "5 weeks
  / Riding streak", not "5 days".

  Three reasons this and not a strip of *weeks*. The data model deliberately stores no calendar
  (§3) — one counter and two day keys — so week cells could only be drawn from the streak count,
  which is a redraw of the number above them and says nothing a rider can act on. §6.4 Standard 13
  is explicit that "a rider is shown the rides they have made this week, never the streak they are
  about to lose", and a rides-this-week strip is that sentence rendered. And it follows the tunable:
  moving `WEEKLY_RIDE_TARGET` from 2 to 3 moves the strip with it, with no second place to edit.
  `streakStrip` in `packages/core` stays exported and deprecated; nothing calls it.

- **"I rode today" is a Next.js server action holding the superuser client, not a PocketBase
  route.** The T4 note above and `hooks/lib/landit.js` both anticipated a PocketBase route running
  the rule. It cannot be one: **the PocketBase JSVM has no `Intl`**, and — worse than absent —
  `Date.prototype.toLocaleString` accepts a `timeZone` option and *silently ignores it*. Probed on
  0.39.11 by asking one instant for its local time in UTC, Europe/London, Pacific/Auckland,
  America/Los_Angeles and the nonsense zone `Not/AZone`: all five answered identically, in the
  host's zone. A weekly streak scored there would be scored in the box's timezone for every rider on
  earth, and would look right in Coventry. So the rule runs once, in `@landit/core`, in Node where
  `Intl` is real, and the result is written with the superuser client — the same privileged path
  §3 already gives the consent flow and staff actions. **The guarantee is unchanged**: `users`'
  streak tuple is still frozen against every client write by `guardUserWrite`, and
  `pocketbase/tests/streak-is-server-owned.test.ts` still proves it over HTTP. What moved is only
  which server runs the arithmetic. Consequence: `apps/web` needs `POCKETBASE_SUPERUSER_EMAIL` and
  `POCKETBASE_SUPERUSER_PASSWORD` set wherever it is deployed, or "I rode today" fails softly and
  the rider is told to try again (issue #62). Revisit if PocketBase ever gains a real timezone
  database in the JSVM.

  **That silence now has a witness (2026-08-16, issue #62).** `GET /api/health` authenticates with
  those credentials on demand and answers **503** when it cannot, distinguishing `missing` (nobody
  set them) from `rejected` (set and refused) from `unreachable` (PocketBase is not answering) —
  three states that used to arrive as one sentence to a rider. The server also warns once at
  startup when the variables are absent (`apps/web/src/instrumentation.ts`). It is reachable while
  the pre-launch gate is shut, which is deliberate: before launch is exactly when a missing
  credential is waiting to be found. **Setting the variables is still a deploy-side act and remains
  open** — the check reports the problem, it does not fix it. The same credentials are wanted by
  T15's Stripe webhook and T16's admin actions, which is why the check lives in `@landit/db` rather
  than beside the button.

**T9 · Progress + skill tree.** By category, by stage, over-time chart with the estimated-dates
note, skill tree with prerequisite/paywall lock states, printable sheets panel. Also the
Legend-gated **insights panel** (§2.4): per-category trends, personal records, next-trick
suggestions derived from the skill tree — locked state on lower plans mirrors the (since removed) clips-panel
upsell pattern. The panel is profiling under the Children's code (§6.4): off by default, opt-in
even on Legend, and it never reads anything but the rider's own history. Inputs:
`landit-screens-b.jsx`, screenshots 11–13.

**Built 2026-08-16. Four things the entry above did not say, recorded here because they are
decisions rather than details:**

- **The insights entitlement is a field on `plans`, not a plan id in the code.** `includes_insights`
  joins `unlocks_paid_tricks` on the plan record (§2.4, §6.6), with
  `Plan.includesInsights` beside it in `packages/core`. Nothing anywhere compares a plan to the
  string `legend`: staff can move the perk without a deploy, and a missing plan record fails closed
  rather than open. Additive migration `1787097609_progress_insights.js`, which also writes the
  value onto the existing Legend record so a seeded database is not left mid-way.
- **The opt-in is a stored field with a server-side guard, and off is the *server's* default.**
  `users.insights_opt_in` is forced to `false` on create whatever the sign-up sent, and switching it
  *on* is refused with a 403 unless the rider's plan record carries the entitlement — while
  switching it *off* is always accepted, because withdrawing a consent can never be gated on still
  being entitled to it. Existing riders read `false` without a backfill. `pocketbase/hooks/
  15_insights.pb.js` plus `guardInsightsOptIn`; ten HTTP tests in
  `pocketbase/tests/insights-opt-in.test.ts`, four of which were watched turn red with the guard
  removed (LESSONS §5). The insights themselves are not merely hidden when the rider has not opted
  in — **they are not computed and not sent**, so the standard-12 promise is a data-flow fact rather
  than a CSS one.
- **The printable sheets panel prints.** The prototype's button fires a toast saying a sheet went
  to the printer, because there is no sheet; this one renders the rider's own tracked list as a
  print-only A4 layout, four tricks a page with a tick box each, and opens the browser's print
  dialogue. A deliberate divergence from `landit-screens-b.jsx`: a button that says it prints
  something should print something. It rides with the paid tiers, read off the same plan record.
- **Nothing on the screen is locale-derived.** `landedByMonth` names its months with
  `toLocaleDateString`, which is safe where it is but not on a page that hydrates, so the screen
  takes month names and dates from a table in `packages/core` (`MONTH_LABELS`, `monthKeyLabel`) and
  from `toDayKey`. `landedByMonth` itself is untouched and still exports its ICU label — a session
  that reaches for it on a rendered page should reach for `monthKeyLabel` instead (LESSONS §3a,
  issue filed).

One cross-route link is deliberately unwired, per LESSONS §3a: the insights upsell states what
Legend includes without linking `/plans`, which is T15's and does not exist. Skill-tree nodes *are*
wired — T7 merged first, so `trickHref` was there by the time this rebased, and a node opens its
trick page the same way the library grid does.

### Wave 5 — four concurrent sessions

**T10 · Stickers.** Wall, detail modal, share card; server-side award flow end-to-end (earn a
sticker by tracking, see the toast once, never re-announced). Inputs: `landit-screens-b.jsx`,
`landit-ui.jsx` (StickerBadge, share), screenshot 14.

**Built 2026-08-16.** The screens are a transcription; the sticker *set* was not, and most of this
entry is about that. Eight issues from the pre-wave audit were folded in by the owner (below), six
of which change what a rider earns. Every call is written down here because the owner does not
review PRs and because the obvious "correction" to several of them is to put back what was
there — the precedent is T21's "Flatground" note.

**Authorised additive-only exception (owner: lekky, 2026-08-16, in chat).** Issues #10, #77, #78,
#79, #81 and #82 were folded into this session with the copy and threshold calls delegated to it.
Five of them are behaviour changes to already-merged shared code (`packages/core`'s sticker rules
and data, and the server-side copies in `pocketbase/hooks/lib/stickers.js`), which additive-only
would otherwise forbid. Nothing else in this session changes an existing signature: `ShareCard`,
`landedCount`, `listUnseenRiderStickers`, `markStickerSeen`, the `every-time` sticker and
`StageActionResult.earned` are all additions.

*What the wall does*

- **Earned means the server said so.** `/stickers` reads `rider_stickers`, never the client-side
  evaluation in `@landit/core`. Those functions exist for instant feedback (§3); the hook is the
  authority, and it is the only thing that can create the row. A wall drawn from the client's
  opinion would show a sticker the rider does not hold, in a product whose §1 says achievements are
  never for sale.
- **A sticker is announced exactly once, and the shape is announce-then-acknowledge.** The stage
  write returns the rows with an empty `seen_at`, the screen toasts them (or plays the `just` pop on
  the wall), and *then* a second call stamps `seen_at`. Stamping on the way out would mark a
  sticker announced to a rider whose browser dropped the response, and for an achievement that is
  the wrong way to fail. Proved end to end in `pocketbase/tests/sticker-award-flow.test.ts` (the
  award, the refused forgery, the seen-once, the idempotent re-award) and in `e2e/stickers.spec.ts`
  (a rider tracks a trick in a browser, is told once, and finds it on the wall).
- **One `ShareCard`, two kinds.** T7 shipped the trick page without its "Share it" button precisely
  so this stayed one component (§7 T7); the button is now there and issue #51 closes. The card takes
  every string already formatted — the prototype built its date with `toLocaleDateString` and wrote
  "N day streak" into the footer, and both are traps: ICU across a hydration boundary (LESSONS §3a),
  and a unit the rule changed under (LESSONS §4).
- **The "real vinyl" panel is dropped.** The prototype sells a posted die-cut pack to "Crew Pass
  riders". The Crew Pass was dropped in §2.4 and no posted pack exists, so the panel promised a
  product on a plan, neither of which is real. Whether Land It should ever post physical stickers is
  a product question and it is the owner's — filed as an issue, not answered here. An e2e test holds
  the page free of both words so the copy cannot drift back.
- **The nav link is not wired here.** `ROUTES.stickers` exists; `components/shell/nav.ts` is the
  orchestrator's `chore-wire-wave5-links` after all four Wave 5 sessions merge, as PR #65 did for
  Wave 4.

*The six sticker issues, and the calls taken*

- **#10 — the streak stickers counted days.** `users.streak` counts qualifying *weeks* (§1), so
  "7 Day Streak" and "30 Day Streak" had silently become seven-week and thirty-week stickers.
  Rethresholded to **4 weeks and 12 weeks** — a month of riding, and a season — and renamed **"Kept
  It Up"** and **"Still Rolling"**. Neither name carries a number or a unit, deliberately: the
  original failure was a name quoting a rule that then moved, and `n` is staff-editable, so a name
  that quotes it is the same bug waiting. The condition line carries both ("4 weeks in a row"). The
  ids are unchanged — a `rider_stickers` row points at the record and the hook's rule map is keyed
  by slug, so renaming an id would un-earn a sticker for everyone holding it.
- **#77 — "Upside Down" is retired.** It was the only sticker whose condition named difficulty-5
  inversions, and the trick library's own coaching copy says "learn it into a foam pit or a resi
  ramp first" (`backflip`) and "foam pit only until it's automatic" (`frontflip`). A badge on the
  wall is a reason for a child to skip that rung, and the audience is 8–16. Its copy and its rule
  also disagreed: "Land a scooter flip trick" reads as a bri-flip or a scooter flip — the deck
  rotates, the rider does not — and the rule excluded both, so the copy pointed at the safe reading
  and the badge paid out only for the dangerous one. `gnarly` is the acceptable version of the same
  recognition: any difficulty-5 trick, no target named, and six of twelve scooter and two of five
  BMX difficulty-5 tricks are non-inverting, so nobody is steered into a flip to earn it. **The
  decision is taken once for all three sports: no sticker rewards an inversion, and BMX gets no
  equivalent** (T21 had already declined to mirror it). *Retired, not deleted* — the seed upserts
  and never removes, so a deleted record would sit live and unearnable in every seeded database.
  It is `isLive: false`, its `@landit/core` rule is `() => false`, and it has no entry at all in the
  server-side rule map, so switching the record back on from the admin portal still cannot award it.
- **#78 — `catDone` stickers un-earned themselves.** "Every live trick in the category" meant staff
  adding one trick took the sticker away from every rider who had it. `flat-out` and `flat-track`
  now count: `catCount.flat >= n`, at **7** (scooter Flat) and **10** (skate Flat), which is
  identical behaviour at today's library size and cannot go backwards. **A sticker rule must be
  monotonic in the rider's own riding** — `catDone` and any percentage of the library re-base when
  the library grows, and `landed >= n`, `catCount >= n` and `landedCount(list) >= n` are the shapes
  to reach for. Recorded on `STICKER_RULES` so the next rule author reads it there.
- **#79 — "Ledge Rat" counted stair sets.** Skate's `street` category includes `sk-gap`, "Stair
  Set", so a rider could earn a *ledge* sticker without touching a ledge, and — the reason it is a
  p2 — the app counted stair sets toward an achievement, which is the classic escalation ladder in
  skateboarding and the one thing a badge in a children's product should not nudge. It now counts
  the seven named ledge and rail tricks (`LEDGE_AND_RAIL`, the category minus `sk-gap`) at **n: 4**;
  three of the seven are difficulty 3, so three would have meant "the three easy ones". The name
  stays — "skate rat" is genuine, affectionate slang.
- **#81 — `gnarly` gets `n: 1`, and `mastered` gets a sticker.** `gnarly` was the one threshold
  sticker with its bar written into the rule rather than read off the record; one is still the bar,
  so nothing moves today and staff can retune it now. `SportStats.mastered` was computed and read by
  nothing, which left the set with no achievement for landing a trick *reliably* — the only
  achievement shape that cannot function as a dare, because it rewards repeating a trick a rider
  already lands rather than attempting something new. **New shared sticker `every-time` ("Every
  Time", `mastered >= 3`)**, named after the app's own stage label. It is reachable on the free tier
  in all three sports, which a test pins.
- **#82 — seven names changed, and a naming rule came out of it.** "Flip Club" → **Kickflip**,
  "Coping Time" → **Axle Stall** (to any adult or teasing classmate the first reading of "coping" is
  emotional coping), "Tre Deep" → **Tre Flip**, "Flat Tracked" → **Flatground** (the old name punned
  on flat track, a motorcycle discipline; "flatground" is the word skaters use — and yes it is also
  BMX's category label from T21, which is fine: the sticker is skate-scoped and the word is
  ordinary), "Bowl Rider" → **Ramp Rider** (skate `park` is drop-in, rock to fakie, axle stall,
  blunt to fakie and hip transfer; three of those is a quarter pipe, not a bowl), "Ollie Up" →
  **Ollie Dialled**, "Both Feet" → **Crossover** ("both" is a two-sport word in a three-sport
  product). "Hop Master", "Ledge Rat", "Whip Club", "Grind Time" and the shared spine were reviewed
  and left alone. The rule, now in the header of `packages/core/src/data/stickers.ts` and held by a
  test: names survive when they are literal, dry, or use words riders actually say; they fail as
  adult-invented puns, hierarchy words (club / master / pro), or a word whose first reading is
  something else. No number in a name, because `n` is editable. Thirteen characters at the outside,
  because the name is set on a fixed arc in `StickerBadge` and the font-size ramp only steps once.

*Two things found while building, fixed here*

- **The server-side `bothSports` still meant "scooter and skate".** T21 changed
  `SportStats.bothSports` in `@landit/core` to "two or more" and did not sweep the copy in
  `pocketbase/hooks/lib/stickers.js`, so a rider on scooter and BMX was shown the `both-feet`
  sticker by the client and refused it by the server. LESSONS §4, one layer down. Now
  `Object.keys(landedSports).length >= 2`, with an HTTP test that was watched fail against the old
  line.
- **The hook's per-sport stats were a literal pair.** `computeStats` built
  `{ scooter: …, skate: … }`, so `stats['bmx']` was `undefined` and **every BMX-scoped sticker would
  have been skipped silently** — there are none yet (issue #25), which is the only reason this had
  not bitten. The scopes are now discovered from the library.

*Deliberately not done*

- Issue #26 (should there be an all-three-sports sticker now `bothSports` means two or more) is an
  open product question and stays open.
- The word "gnarly" appears both as a sticker name and as `TIERS_LABEL[3]`, and #82 flags it as the
  likeliest word in the product to get a kid teased. Left alone: the tier label is merged shared
  copy read by several screens, and after `upside` was retired `gnarly` is the *only* recognition
  for difficulty-5 riding, so renaming it in the same PR that changed what it awards is two changes
  at once. Raised to the owner in the closing summary.

**T11 · Crew + rider profiles.** Real crews: create, invite (the 1080×1080 canvas share card with
`navigator.share` fallbacks), join, board, activity feed; rider profile with the three-way privacy
gating driven by the §3 access rules (the "viewing as" toggle from the prototype becomes real
signed-in/out states); coach view. Two constraints from §6.1 that the prototype does not enforce
and this task must: crews are **invite-only with no discovery** — no directory, no browsing or
searching riders you are not already crewed with — and new profiles default to **private**, not
public. There is no rider-to-rider messaging and none may be added here. Inputs:
`landit-screens-b.jsx`, `landit-screens-c.jsx`, `landit-screens-d.jsx`, screenshots 15–16, 24.

**Built 2026-08-16. Six things the entry above did not settle, recorded here because they are
decisions rather than details:**

- **The activity feed respects profile privacy; the crew board does not.** Guarantee 1 carves out
  exactly one exception — a private rider still appears *on the board*, by name and score — and it
  was tempting to read the feed as more of the same. It is not. `trick_progress` and
  `rider_stickers` are named in that guarantee as privacy-gated, and what a rider landed this week
  is more than a name and a score, so `GET /api/landit/crew-feed/{crew}` applies the same three-way
  test the API rules apply: your own activity always, a `public` or `members` crewmate's to a
  signed-in crewmate, a `private` rider's never. Consequence, stated so nobody "fixes" it: because
  new accounts default to `private` (§6.4 standard 7), **a crew of riders who have not changed that
  setting has an empty feed**, and the panel says so. The feed is a route rather than a collection
  read for the same reason the board is — the rows behind it are gated per rider — but it inherits
  none of the board's exception.
- **The invite code is minted by the server on every write, and the hook that did it conditionally
  now does it unconditionally.** `60_ownership.pb.js` (T2) says "with a server-set code" and mints
  one *when the body left it empty*; before T11 there was no client sending invites, so nothing
  exercised the other branch. A code a rider can choose is a code a rider can make guessable, and
  an invite code is the only thing between a stranger and a crew of children (§6.1). T11 adds a
  later hook (`85_crews.pb.js`) that overwrites the code whatever the body said. Codes are ten
  characters from a 31-symbol alphabet with `I`, `L`, `O`, `0` and `1` removed — unguessable, and
  typable by a child off a screenshot. Invites also gain a 14-day expiry and a 25-use ceiling, and
  a rider may own at most five crews; all three are anti-spam ceilings, mirrored as constants in
  `packages/core/src/rules/crew.ts`.
- **The crew board's payload gains one field: `flair`.** Legend flair is a §2.4 perk on the
  profile *and* the crew board, so the board has to be able to show it — and the board is a fixed
  server-built field list precisely so it cannot widen by accident. `flair` is resolved from the
  `plans` record on the server and crosses as a boolean, so `plan` still never reaches another
  rider: what travels is whether a name may wear a tag, not what somebody pays. The assertion in
  `pocketbase/tests/guarantee-1-privacy.test.ts` that pins the field list was widened deliberately
  and says so. New field `plans.includes_flair` (migration `1787098411_crew_flair.js`,
  `Plan.includesFlair` beside it in `packages/core`); **nothing compares a plan id to the string
  `legend`**, exactly as with `includes_insights`, so T15 can move the perk without touching a
  screen. Flair is cosmetic and stays cosmetic — it moves nobody's place on a board.
- **The coach view is free, and the Crew Pass is why it had to be decided.** The prototype gates it
  behind the Crew Pass, which §2.4 dropped, so the gate had no plan left to hang on. It ships open
  to every rider: a parent-facing summary is part of the child-safety position (§6.1, §6.4), and a
  safeguarding surface behind a paywall is the wrong shape whatever it costs. It shows the rider's
  own data **to the rider** — no separate parent login, no share link, no token, because each of
  those would be a new way to reach a child's data from outside their account. It counts weeks, not
  days, which is the §1 streak sweep (LESSONS §4) applied to a screen that quotes the rule. **The
  owner can move this**; moving it means an entitlement on the `plans` record, never a plan id in
  code.
- **The privacy setting became settable.** T6's account screen displayed "Who can see you" and
  there was nowhere to change it, so the `private` default (§6.4 standard 7) was not a default but
  a rule nobody had chosen. `/account` now carries the three-way control from screenshot 23, with
  the copy read from `PRIVACY` in `packages/core` rather than retyped. The rest of the prototype's
  profile-settings screen (avatar picker, sports, goal, stance, level — screenshots 21–22) is still
  unbuilt and belongs to no task in this section; issue filed.
- **Sign-in returns you to where you were sent (issue #66, closed here).** An invite link is the
  case that made it unavoidable: a signed-out visitor following `/join/{code}` used to be dropped
  on `/home` with the code gone. `signInHref`/`safeReturnTo` in `apps/web/src/lib/routes.ts` carry
  the path and refuse anything that is not a same-site absolute path, so the parameter cannot be
  turned into an open redirect by whoever wrote the link.

Also worth knowing: `/join/{code}` **says nothing about the crew** — not its name, its size or who
is in it. A page holding a code has not been let into anything yet, and the name arrives on the crew
screen after the code is redeemed. That ordering is §6.1's no-discovery position applied to the one
URL a stranger is most likely to be holding.

**T12 · Challenge + events.** Live/upcoming/past challenge states derived from dates, log button
gated server-side to the live window, past weeks blurred on free plan; events list, filters, detail
modal, "I'm going". Inputs: `landit-screens-b.jsx`, `landit-screens-d.jsx`, screenshots 17–18.

**Shipped, with what it decided:**

- **BMX has six weeks, so the schedule is per sport and not per pair** (issue #80). The design pack
  predates the three-sport decision, so the BMX weeks are **authored, not transcribed** — a
  deliberate divergence from "recreate, don't reinterpret", named here so no later session reads it
  as a fidelity failure. Each names tricks that exist in the shipped BMX library. Without them
  `challengesFor('bmx')` was empty and the `challenger` sticker was unearnable for a BMX-only
  rider. `data.test.ts` and `challenges.test.ts` now count off `SPORT_IDS`; the two-sport versions
  were green for as long as BMX had nothing.
- **Every challenge's `reward` names the `challenger` sticker** (issue #76). The pack gave each week
  a bespoke reward — "Long Roller", "Waxed In", "Down The Set" — and **not one of those ten names
  was a sticker record**, so the screen promised what the award flow could never grant. Of the
  issue's three options this is the second: point them at the sticker that exists, has a rule, and
  is already awarded server-side on the `challenge_log` write. Option 1 (ten new stickers) needs
  per-challenge completion in `RiderStats` and would have shipped "Down The Set", a stair-set
  badge, while #79 asks whether this product should badge stair sets at all. `challengeRewardSticker`
  resolves the copy and a test asserts every challenge resolves to a live sticker with a rule, so a
  rename cannot quietly re-open the hole (LESSONS §4). **The screen prints no reward it cannot
  resolve**, and says "already on your wall" rather than dangling one the rider holds.
- **The fabricated participation copy is not rendered.** `riders` ("1,284 riders in") is invented
  engagement, shown to children, for a product with no riders yet. The column and the field stay —
  removing either would not be additive — but the screen does not print them, and the BMX weeks
  leave the field empty rather than inventing six more. Issue filed for what should replace it.
- **The free-plan limit on past weeks is a data limit, not a blur.** The design blurs the history
  behind an upgrade panel; a blur that lifts in dev tools is a costume. A rookie rider's past
  *results* are never computed and never sent — the cards arrive with the week, the dates and no
  outcome. The panel says in as many words that logging a challenge and the sticker for finishing
  one are the same on every plan, because "history is paid" and "achievements are for sale" are one
  careless rewrite apart and §1 forbids the second.
- **The server-side gate now admits the challenge's last day.** `challengeIsLive` compared a full
  timestamp against `ends`, which PocketBase hands back at midnight, so a challenge was unloggable
  for the whole of its final day — the day a rider is most likely to be finishing it. Nothing
  errored: writes were refused while the screen said "Live now". It compares calendar days now, with
  **a day of tolerance either side**, because the JSVM cannot compute a rider-local day (no `Intl`,
  and `toLocaleString` ignores a `timeZone` — LESSONS §5) and a day covers every offset from UTC-12
  to UTC+14. The gate's job is to refuse *last week*; the exact boundary is the client's, in the
  rider's own zone. Proven in `pocketbase/tests/challenge-log-window.test.ts`, watched red against
  the old comparison before being believed.
- **`riderSnapshot` keys `challengeLogged` by slug.** It keyed by database id, and every consumer —
  `computeSportStats`, both screens — looks up by slug, so challenge progress read zero however much
  a rider had logged and the `challenger` stats were always empty. `challengesFromRecords` and
  `eventsFromRecords` moved into `@landit/db` alongside `tricksFromRecords`; Home's local
  `toChallenge` (which invited this) is gone.
- **Standard 13 (§6.4), positively.** No countdown, no "your streak dies", no notification of any
  kind, and no purchasable anything. A finished week is reported in the past tense with nothing
  attached to it, and the copy states what a rider has done rather than what they are about to lose.
- **A past event is dimmed, not dropped** — hidden by the default filter, one pill away. A row a
  child ticked that silently disappears reads as a bug. And **nobody else's attendance is anywhere
  on the events screen**: `event_attendance` is `OWN`, and "who else is going" would be exactly the
  stranger-contact surface §6.1 rules out. Asserted in `e2e/events.spec.ts` rather than assumed.
- **The e2e schedule is seeded by the spec, around today.** The shipped challenges carry fixed 2026
  dates, so a spec asserting "Live now" against them would pass in August and fail in September —
  a test with an expiry date (`e2e/support/seed-schedule.ts`, LESSONS §1).

Two cross-route links are deliberately unwired, per LESSONS §3a: the history upsell states what the
paid tiers keep without linking `/plans` (T15's), and the nav entries for both screens are the
orchestrator's `chore-wire-wave5-links`, after every Wave 5 screen exists. `ROUTES` carries both
paths, so wiring them is one line each.

**T13 · Spots + map.** Mapbox with every live spot plotted, styled to the design language;
selection sync between list and map; spot submission (Maps-link or coordinate parsing) into the
`pending` queue, rate-limited. Children's code standard 10 (§6.4): browser geolocation is off by
default and opt-in per use, there is a visible indicator whenever it is live, it never persists
across sessions, and the rider's own position is never stored — only the spot's. Inputs:
`landit-screens-b.jsx`, screenshot 19.

Shipped, with four decisions recorded here because they diverge from the prototype or need the
owner:

- **The map's style: a quiet base, the design language on top.** The palette is loud — hard
  offset shadows, zero radius, `--sky` and `--yellow` — and no stock Mapbox style comes close.
  A matching basemap means authoring one in Mapbox Studio, which needs a Studio account and a
  designer; that is owner work, not session work. So Mapbox draws the ground (`light-v11`,
  deliberately low-contrast) and everything Land It renders on it is ours: square markers with a
  3px ink keyline and a hard offset shadow, the selected pin in `--yellow` and larger, restyled
  zoom controls, and the panel's own header and footer bars. It reads as Land It, and the road
  names stay legible under markers that are meant to shout. `MAP_BASE_STYLE` in
  `apps/web/src/lib/mapbox.ts` is one line: **if the owner later commissions a Studio style, that
  is the whole change.** Attribution and the Mapbox logo are restyled and never hidden — a
  condition of the service, not a styling choice.
- **No token in the repo, and the screen works without one.** There is no Mapbox account yet
  (`docs/infrastructure.md`), so `NEXT_PUBLIC_MAPBOX_TOKEN` is a blank line in
  `apps/web/.env.example` and every checkout, every CI run and every preview is tokenless. That
  is a first-class state, not an error: the list, the search, the sport filter, the selection and
  the submission form all work, `mapbox-gl` is never even imported, and the map panel says in one
  line that it is waiting on a key. **The map is not live until the owner supplies a token** —
  and because `NEXT_PUBLIC_*` is inlined at build time, it has to be a *build argument* on the
  Coolify application (`apps/web/Dockerfile` takes it the same way it takes the PocketBase URL),
  not a runtime variable.
- **A submitted spot must carry coordinates.** The prototype's form accepted a name and a town
  with no location; this one does not. A spot with no point cannot appear on a map whose whole
  job is plotting them, and a reviewer handed "Rampworx, Liverpool" has nothing to check but a
  stranger's typing. Enforced in `pocketbase/hooks/62_spots.pb.js`, which also refuses a `type`
  outside the three the form offers. The hook's floor is deliberately lower than the form's — the
  form also insists on a town, the server does not, because a missing town costs a slightly worse
  queue entry and not a wrong record.
- **The rate limit: three an hour, ten waiting, per rider.** Both are **tunable defaults, not
  deliberated decisions**, in the sense §1 gives `WEEKLY_RIDE_TARGET`: constants in
  `packages/core/src/rules/spots.ts` (so the form can warn) mirrored in the hook (where a
  submission is actually refused, with a 429), and a test fails if the two drift. The pending cap
  is the one that matters — an hourly window alone only spreads a flood over more days, and the
  queue is read by a human (T17). `pocketbase/hooks/lib/ratelimit.js` is deliberately generic:
  applying it to the guardian-consent request route (issue #32) is a four-line change once the
  owner has picked how often a parent may be emailed, which T13 did not get to decide.

Standard 10 is implemented as `useHereOnce`: geolocation is asked for only on a press, held in
component state, announced by a badge that carries its own "turn off", and gone on reload. It is
`getCurrentPosition` and never `watchPosition` — a watch is a live tracking session held open on a
child's device. `e2e/spots.spec.ts` replaces `navigator.geolocation` with a counter and asserts it
is called zero times on load, and that nothing containing the position reaches `localStorage`,
`sessionStorage` or a cookie.

**T14 · Clips. ~~Built 2026-08-17 (PR #112).~~ REVERTED 2026-08-17 (PR: `chore-revert-clips`).**

The task was: upload through PocketBase's file field backed by R2, token-gated playback, per-plan
cap read from the `plans` record (2GB Shredder / 5GB Legend) enforced in the upload hook, the at-cap
states from §6.6, delete. It was built, tested and merged, and then **the decision underneath it was
reversed by the owner (Rachid, 2026-08-17, in chat): Land It will not host rider video.** See the
§1 decision row and §6.6. T14 is not "unfinished" and it did not fail — the feature worked; the
product changed its mind about wanting it.

**Why it was reverted rather than left dormant.** T14's code was the only thing standing between
this product and a moderation duty over uploaded children's video, and dormant code is not a
boundary — the collection's file field would still have accepted 200MB uploads. More immediately,
the published privacy policy and terms had been written to *promise* the vault ("Clips you upload
are yours, and only you can watch them… the storage they sit in is private"), and those promises
cannot be left standing next to a feature nobody can use. The reversal removed the claims as well as
the code; the §6.6 note lists what went.

**What replaces it, and what does not.** The trick page now has **no video surface at all** — the
clips panel was deleted rather than returned to T7's locked state, because a locked panel advertises
a vault that is not coming back. The replacement is **`t15b-video-links`**: riders paste a YouTube
link, visibility per video on the `public | members | private` model, private by default. That task
is not built, and this reversal deliberately built none of it — no collection fields, no URL
parsing, no UI. §3 guarantee 2 records that the new feature needs its own guarantee about visibility
defaults and the profile-privacy ceiling, and that `t15b` writes it.

Inputs, for `t15b`: `landit-screens-a.jsx` (clips panel — as a layout reference only; its behaviour
is void), §6.6.

### Wave 6 — three sessions, T15 ∥ T16 then T17

**T15 · Payments.** Stripe Checkout + customer portal, webhook (Next.js route) → `subscriptions`
records via the superuser client, entitlement resolution from our own collection (§2.4), plans
page with monthly/yearly toggle and FAQ, and an end-to-end test that a rookie → shredder upgrade
actually unlocks a paid trick at the hook layer. Three plan cards as designed, but the top card is
**Legend** (single rider, §2.4), not the prototype's Crew Pass — rewrite its pitch, perks and FAQ
copy around the 5GB vault, flair and insights; Shredder stays the raised "Most riders" card.
(**Superseded 2026-08-17:** the vault copy was removed with the clip-hosting reversal — §2.4, §6.6.
Legend's pitch is flair and insights alone until the owner re-pitches the tiers.)
Legend flair itself (profile/crew-board tag, exclusive avatars) is applied where those surfaces
live — coordinate the tag rendering with what T11 built. **The payer must be an adult** (§6.2):
checkout requires an 18+ confirmation, a rider whose `consent_state` is not `granted` cannot hold a
subscription at all (§3 guarantee 4), and for riders under 16 the upgrade routes to a guardian by
email rather than being purchasable in-app by the child. Test that refusal at the hook layer beside
the upgrade test. Inputs: `landit-screens-c.jsx`, §2.4, §6.2, screenshot 20.

**Built 2026-08-17.** The screen is a transcription of screenshot 20; the *model* underneath it is
where the decisions are, and they are written down here because the owner does not review PRs.

*What the entitlement actually is*

- **`users.plan` is resolved, never set.** `pocketbase/hooks/55_subscriptions.pb.js` recomputes it
  from the rider's own `subscriptions` rows after every write and every delete, and nothing else
  writes it outside the superuser dashboard. The webhook files evidence; the hook decides what it
  means. That is §2.4's "resolve plan access from our own database" as a mechanism rather than an
  intention, and it is what lets Apple and Google arrive later as two more `source` values instead
  of two more places the answer lives.
- **`active` and `trialing` entitle; everything else, `past_due` included, falls back to Rookie.**
  A failed payment is a billing problem to sort out, not a reason to keep serving a paid tier to a
  child's account, and Stripe's own retries move a genuinely temporary failure back on their own.
- **A missing plan record still fails closed**, as it did before. Nothing compares a plan id to the
  string `legend` anywhere.

*A staff override beats the provider, and here is why* (decided 2026-08-17, reconciling T16)

T16 merged first and shipped `setRiderPlan`, which patches `users.plan` directly — a comp, or a fix
for a payment that went wrong. T15 then made `users.plan` a *derived* value. Both are reasonable and
together they were incoherent, in the quietest possible way: an override would have survived until
Stripe next sent any routine event about that rider, and then vanished with nothing anywhere saying
why. Somebody would have re-comped the same rider twice and called it a Stripe bug.

The rule, and it is a product decision the owner may want to revisit:

- **A staff patch that disagrees with the rider's subscriptions is recorded as a `subscriptions` row
  of its own, `source: 'staff'`** — the enum value the schema has carried unused since T2. Written by
  a `users` after-update hook in `55_subscriptions.pb.js`; **nothing about `setRiderPlan` changes**,
  which is what keeps this additive.
- **A staff row outranks every provider row, always.** Staff are a person deciding after the fact; a
  provider is a system reporting a payment. So the override survives a later cancellation, a later
  renewal, and a downgrade staff applied on top of a subscription the rider is genuinely paying for.
  Recency would have been the other candidate and it is the wrong one: it makes the override's
  lifetime depend on how chatty Stripe happens to be about that account.
- **`users.plan` therefore still has exactly one writer** — the resolution — and the reason a rider
  is on a plan is a row somebody can read rather than a field with no explanation behind it.
- **Releasing an override means deleting that row.** Setting the plan back to what Stripe says
  updates the staff row to match rather than removing it, so the rider is right but still overridden.
  Today that is a superuser-dashboard delete; a button belongs in T17's plans/riders work, filed as
  an issue.
- **The consent gate still refuses staff.** An account waiting on a guardian may not be moved onto a
  paid plan by anybody. `users.plan` moves (that is T16's write, untouched), but no subscription is
  recorded — so the §3 guarantee-4 refusal holds and the override does not become durable.
- **The two §6.2 payer refusals do not apply to a staff row**, because nobody paid. Requiring one
  would mean staff ticking an 18-plus box on a child's behalf, which is the sort of hollow
  confirmation §6.2 exists to avoid. `source` is unreachable from any client — the collection has no
  write rules and the webhook hard-codes `stripe` — so this is not a lever an attacker has.

Proved in `pocketbase/tests/subscriptions.test.ts`; without the reconciliation hook those four tests
go red, which is the only way the silent failure above would ever be noticed.

*Three fields on `subscriptions`, and why they are not billing detail* (migration
`1787184100_subscription_payer.js`, additive)

- **`payer_kind`** (`rider` | `guardian`) and **`payer_adult_confirmed`** turn §6.2's two
  safeguarding sentences into facts the server can re-read. The hook refuses a subscription without
  the 18+ confirmation, and refuses one recorded as bought by the *rider* when that rider's age band
  is under 16. A rule checked only in a form is a rule that lived in the client; both travel to
  Stripe as Checkout metadata and are checked again on the way back, so the checkout route could be
  edited away and the refusal would still hold. **No superuser bypass**, on the same reasoning as
  the paywall: there is no legitimate way for either to be false.
- **`checkout_ref`** plus a partial unique index on `external_id` make the webhook idempotent.
  Stripe retries anything that is not a 2xx and documents duplicate delivery as normal; without a
  key to match on, a redelivered `checkout.session.completed` is a second subscription.

*Deliberate divergences, recorded here rather than discovered later*

- **The third card is Legend, not screenshot 20's Crew Pass.** Decided in §2.4 on 2026-08-15; this
  is the session that makes the screenshot visibly out of date, so it is named. Layout, the raised
  "Most riders" card, the toggle and the badge are the screenshot's exactly.
- **The FAQ is a rewrite.** Two of the prototype's four answers sell Crew Pass and one promises
  die-cut vinyl "posted every season", which nobody has decided to post (issue #101 — the same
  panel T10 dropped from the sticker wall). What replaces them says the two things this product
  cannot be vague about: achievements are not for sale, and an adult is the one who pays. Pinned in
  `e2e/plans.spec.ts` against the rendered page, so a careless copy edit fails a build.
- **`/plans` reads signed out**, unlike every other screen in the `(app)` group. The site footer
  links it and a person deciding whether to sign up should not have to sign up to find out what it
  costs. `plans.listRule` is already `is_live = true`, so this needed no rule change.
- **Downgrading is cancelling, and it happens in Stripe's hosted portal.** Card details and
  invoices are the two things this product should never be in the path of. The customer id is not
  stored on our side either — it is read back off the subscription Stripe already knows about.
- **`apps/web` now has a Vitest project**, narrowed to `src/lib`. Screens stay Playwright's; the
  webhook's signature check is an assertion about a digest that no browser can make. The test signs
  payloads with `node:crypto` from Stripe's published scheme, so it and the SDK are two independent
  readings of the same specification rather than the library agreeing with itself.
- **`stripe@22.5.0` is a new dependency of `apps/web`.** Pure JS, no install script, so none of
  LESSONS §6's blast radius applies.

*Not done here, and it is the owner's*

**There is no Stripe account.** No key has ever been in this repo, every variable is a blank in
`apps/web/.env.example`, and nothing in the session touched a live Stripe endpoint. Until the owner
creates the account, its two products and its four prices, `/plans` renders in full with the real
prices from our own records and says upgrading is not switched on; the webhook answers 503 so a
misconfigured deployment reads as failing rather than as delivered. The exact variables and products
are one issue.

**T16 · Admin: shell + riders + audit.** `/admin` route group behind the role gate, admin nav,
Overview, Riders (search, plan override, rider sheet, suspend), and the audit-log plumbing every
later admin write uses — every mutation lands as a server action using the superuser client that
writes `audit_log` in the same transaction. Runs concurrently with T15. Inputs: `landit-admin.jsx`,
screenshots 25–27.

Shipped, with five things recorded here because they diverge from the task as written, from the
prototype, or need the owner:

- **There are no admin screenshots, so the prototype was the whole spec.** 25, 26 and 27 are
  byte-identical copies of `06-home.png`, and 28–30 are copies of `08-library.png` — only 31 is a
  real admin screen, and it is T17's. `landit-admin.jsx` was the only reference T16 had, and T17
  should expect the same (issue #95 widened to record it). Nothing here was checked against a
  picture, which is worth knowing before reading the fidelity as verified.
- **"In the same transaction" is not achievable from a server action, and what ships is better
  than it sounds.** A Next.js action talks to PocketBase over HTTP; no transaction spans that.
  What actually happens is two rows per audited change. `pocketbase/hooks/70_audit.pb.js` fires
  *inside* the write's own transaction and records the actor it can see — `superuser`, because
  that is the client the action holds; then `applyStaffChange` writes a second, staff-attributed
  row naming the human, narrowed to the fields that moved. So the floor is genuinely
  transactional and an admin write cannot leave nothing behind; what the second call can lose is
  *who*, not *what*. Reading the log for accountability means filtering `actor_kind = 'staff'`;
  reading it for completeness means not filtering. The alternative — logging first, mutating
  second — was rejected because it invents changes that did not happen.
- **The Monthly revenue card ships blank (owner's call, 2026-08-17).** The prototype multiplies a
  plan count by a list price, which ignores yearly billing, cancellations and the staff overrides
  counted in the card beside it. With no checkout until T15 that is a figure precise enough to be
  quoted and wrong by an unknown margin — the same objection as the invented participation copy in
  issue #89. The card keeps its place in the five-card grid showing an em dash and "Lands with
  billing", so the layout does not move when T17 sums it over `subscriptions`. The neighbouring
  card is labelled "On a paid plan", not "Paying", for the same reason.
- **A "Recent staff activity" panel on Overview, which the prototype does not have (owner's call,
  2026-08-17).** Without it the audit log is write-only until somebody opens the database, which
  makes it very hard to tell a working audit trail from a broken one. It lists the last eight
  staff-attributed rows as sentences the product writes from the row's own fields, and renders
  verbs it does not recognise rather than dropping them, so T17's new `admin.*` actions appear
  without a change here.
- **Staff may not act on their own row, which the prototype allowed.** The prototype's note —
  "changing your own row switches the app you're signed into" — is a prototype convenience; here
  it is a staff member granting themselves a paid plan in the one collection whose guard exists to
  prevent exactly that. Suspension is refused for a blunter reason: `users.authRule` is
  `suspended = false`, so suspending yourself locks you out of the portal with only the superuser
  dashboard able to undo it. Both refusals are in the server actions, not only in the disabled
  control.

How an account becomes staff is `docs/staff-accounts.md` — superuser dashboard only, deliberately
with no script.

**T17 · Admin: content tabs.** Trick library editing, stickers, spots queue, events, challenges,
announcements composer, plans editor — all on T16's action/audit pattern. Also the moderation view
over the `reports` collection. Depends on T16. Inputs: `landit-admin.jsx`, screenshots 28–31.

Shipped, with six things recorded here because they diverge from the prototype or from the task as
written:

- **Nothing in the portal deletes a record a rider's history points at, except one thing that
  must.** This is the largest departure from `landit-admin.jsx` and it comes straight out of the
  schema: `trick_progress`, `trick_log`, `rider_stickers`, `event_attendance` and
  `announcement_dismissals` all have `cascadeDelete: true` on their parent. The prototype's
  "Remove" was a `localStorage` splice and cost nothing; the same button against the database
  would destroy every rider's record of landing that trick, un-earn a sticker from everyone
  holding it, or erase who was going to a cancelled comp — silently, with no way back. Tricks,
  stickers, events and announcements therefore **hide** (`is_live = false`), which is what
  "Remove" means to the person clicking it, and restoring one returns the rider rows with it.
  Spots move between `pending`/`live`/`rejected` and are never destroyed either, because the row
  *is* the record that a human reviewed a stranger's submission.
  **Challenges are the single exception and it is forced.** `challenges` has no live column and
  must not gain one — whether a week is running is derived from its dates and never stored (§2.2,
  §3), so a stored flag could only be a second answer able to disagree. That leaves delete as the
  only way to take back a week booked in error, which staff genuinely need because the
  one-live-challenge-per-sport rule otherwise blocks that sport's calendar for the whole range.
  `challenge_log` does cascade, so the confirm asks the server how many entries that is and puts
  the number in the sentence before asking.
- **The trick tier chip has three states, not the prototype's two.** `tricks.free_override` is a
  nullable select — `free`, `paid`, or empty meaning "inherit from `diff`" — and empty is the
  state the entire seeded library ships in. A two-way toggle would have written an explicit value
  onto every trick it touched, quietly pinning tricks that were following the default and making a
  later change to `FREE_MAX_DIFF` a no-op on them. The chip cycles free → paid → inherit and shows
  what the default resolves to while it is inheriting.
- **A tenth tab, Moderation, which the prototype has no counterpart for.** `landit-admin.jsx`
  predates the `reports` collection; the queue over it is this task's own line above. It reads and
  triages reports (status, outcome, the `complaint_of` appeal link) and deliberately **does not
  act on the subject** — a report carries an id and a type, never a resolved account, and marking
  something actioned records what staff decided rather than suspending anybody. Wiring the two
  together would put a stranger's accusation one click from a child's account. Suspension stays on
  Riders and taking a spot down stays on Spots, each done by somebody who has looked.
- **Prerequisites are shown, not edited.** `trick_prereqs` is edges with a same-sport invariant
  enforced in a hook, not a field on a trick, so editing the graph is a screen of its own rather
  than a column in a table. The prototype could not edit them either. Unscheduled.
- **The plans editor writes display strings only.** Copy, the two prices and the perk lists —
  exactly what the prototype's own footnote promises. `unlocks_paid_tricks` is shown and is not
  editable, because it is the entitlement the paywall hook resolves and a screen whose job is
  wording should not be one slip from handing everybody the paid library. What is actually charged
  lives in Stripe, so an edit here can disagree with checkout — issue #123, filed by T15, still
  open and now surfaced on the screen. **`clip_cap_bytes` is not on the screen at all**: clip
  hosting was reversed the same day (PR #128) and the column survives only as `listPlans`' sort
  key, so both an editor field and a displayed number would be a quantity that no longer means
  anything — `packages/core/src/data/plans.ts` asks for exactly that. The staff cards are ordered
  by it anyway, because the rider's plans page is.
- **Screenshot 31 is not an admin screen either, so T17 also built against the prototype alone.**
  T16's note above says 25–30 are duplicates and "only 31 is a real admin screen" — 31 is in fact
  the rider-facing spots screen, nav bar and all. There is no capture of any admin content tab in
  the pack. Recorded on issue #95.

Issue #103 — a lowered sticker threshold not reaching riders who already qualify until their next
write — is **not** fixed here and was not within reach: the award runs in `pocketbase/hooks`, which
`t18-hardening` owned for the length of this session. The Stickers tab says so on the screen and in
the toast after an edit rather than leaving it to be discovered from a support ticket.

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

**Shipped 2026-08-16, with four things the plan did not anticipate and one still outstanding.**

1. **The trick library is researched, not authored, and the owner ran it that way knowingly.** The
   content track above says an agent session cannot invent a progression credibly. It did not
   invent one: 36 tricks were researched from published BMX coaching sources with every claim
   cited, and the review document dated 2026-08-16 records the sourcing, the seven places sources
   disagreed, and the nine prerequisite edges that are inference rather than citation. **No `diff`
   value came from a source that rates difficulty on a five-point scale** — those are a mapping.
   The owner accepted this on 2026-08-16 in preference to holding the sport back. `tricks.ts`
   carries the same caveat at the head of the BMX block so a later session does not mistake these
   numbers for the settled ones the other two sports have.
2. **`bothSports` had to change meaning, and doing nothing was not an option.** It was
   `SPORT_IDS.every(...)`, where "every" and "at least two" are the same sentence for two sports.
   Adding BMX split them, and `every` would have silently redefined the `both-feet` sticker as
   *all three* — un-earning it for every rider who held it, without touching the sticker. It is now
   "two or more", which preserves what riders earned, and the sticker copy no longer names the two
   sports that happened to exist when it was written. Whether a separate all-three sticker should
   exist is a product question, still open. This is LESSONS §4 repeating exactly.
3. **`maxSelect` mattered as much as the option list.** The multi-select sport fields were capped
   at 2 — the number of sports, not a product rule — so a rider who rides all three could pick
   three and save two. The migration raises the cap with the list, and an HTTP test holds it.
4. **Category labels can now vary by sport.** Ids stay shared and always will; only the displayed
   word moves, via `Sport.categoryLabels` and `categoryLabel()`. BMX shows **"Flatground"** where
   the other two show "Flat".

   The word was settled in two steps, and the reasoning is worth keeping because the obvious
   "correction" is to undo it. T21 first shipped **"Flatland"** (owner, 2026-08-16), on the finding
   that a BMX rider reads a bare "Flat" chip as Flatland. That fixed the under-specification and
   introduced the opposite fault: Flatland is a distinct BMX discipline on a different bike —
   hang-5, time machine, steamroller — which this library deliberately excludes, so the chip then
   promised tricks that are not behind it. The owner moved it to **"Flatground"** the same day.
   "Flat" under-specifies, "Flatland" over-promises, and only the longer word is honest to both
   readers. A test asserts the label is *not* "Flatland" so the round trip cannot happen by
   accident.

**The BMX sport colour is settled: `--pink` (`#FF3D78`), confirmed by the owner on 2026-08-16.**
The palette does not gain a colour. §1's warning that "every token already has a job" stands, and
BMX shares rather than takes — `--pink` is also the link-hover colour, the default avatar
background, and the hue on the `send` level and two stickers. That is the established pattern, not
a compromise: `--orange` is scooter *and* Street, `--blue` is skate *and* Park. The one difference
in kind is **link hover**, a global interaction colour rather than a category; if BMX pink ever has
to read as BMX alone, that rule is what moves, not the sport record.

**Still outstanding, and it needs the owner:**

- **BMX avatars and BMX-scoped stickers.** The 36 shipped avatars are scooter- and skate-flavoured
  in places, and no BMX ones exist — new design work, as the content track says. Stickers are
  likewise unbuilt: the shared ones apply, but there are no BMX-scoped stickers, because there is
  no owner list to build them from. Tracked as issue #25.

**This session runs alone in its wave.** Widening `SportId` is a repo-wide edit that touches every
package at once, so nothing else can share the wave without conflicting. It depends on the BMX
content track above, not only on the wave before it, and it can move **earlier** if the library and
assets are ready sooner — the only hard constraint is that it must not sit in front of Wave 4. It is
placed here, late, because the content is the risk and this maximises the runway for it. Inputs:
§1, §3, the owner's BMX trick library and asset set, `packages/core/src/data/sports.ts`,
`packages/ui-web/src/icons.tsx`.

### Wave 8 — three concurrent sessions

**T18 · Hardening.** Reporting flows in the rider app (profile report buttons — and video-link
report buttons if `t15b-video-links` has landed by then; there are no clips to report, §6.6), account
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
