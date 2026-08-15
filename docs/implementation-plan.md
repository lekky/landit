# Land It — implementation plan

Written against `design-handoff/README.md`. That document is the design contract; this one records
what we decided, how the code is arranged, and what order it gets built in.

---

## 1. Decisions (handoff Step 0)

| Decision | Chosen | Notes |
| --- | --- | --- |
| Platform | **Web first (Next.js), native later** | One repo, shared logic. See §2. |
| Offline level | **Read-only cache** on web; full local-first deferred to the native app | Departs from the handoff's recommendation — see §2.3. |
| Backend | **Supabase** | Postgres, RLS, auth, storage. |
| Auth and minimum age | **Open — blocked on legal advice** | Blocks Phase 2. See §6. |
| Clip storage | **Supabase Storage, private bucket** (provisional) | Revisit transcoding at volume. See §6. |
| Maps provider | **Mapbox** (provisional) | Store plain `lat`/`lng` so it stays swappable. |
| Payments | **Stripe on web**; entitlements modelled independently of Stripe | See §2.4 — this is the decision that protects the native option. |
| Staff portal placement | **Route group in the web app**, hard role gate, full audit log | Handoff prefers a separate app; see §6. |
| Analytics | **Open** | Must be privacy-respecting, no ad identifiers. |

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
    db/                  Supabase client, generated types, query functions
    ui-web/              design system: tokens, primitives, icons, StickerBadge
  supabase/
    migrations/
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
browser against Postgres means a local database, a sync engine and conflict resolution, and it is a
large amount of work to put in front of a launch.

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

Do not treat the Stripe subscription as the entitlement. Keep a `subscriptions` table with a
`source` column (`stripe` | `apple` | `google`) and resolve plan access from our own database. This
costs almost nothing now and is expensive to unpick later.

The Crew Pass covers five riders, so it is a seat model: one `subscription` plus
`subscription_seats`, not five copies of a subscription.

---

## 3. Data model

Straight port of the handoff's model. Notable shapes:

| Table | Purpose |
| --- | --- |
| `tricks` | 61 records. `sport`, `cat`, `diff 1..5`, `about`, `tips`, `fact`, nullable `free` override, `is_live` |
| `trick_prereqs` | Edge table (`trick_id`, `prereq_id`). Constraint: both sides same sport |
| `profiles` | 1:1 with `auth.users`. name, handle, town, stance, level, goal, avatar, privacy, `sports[]`, streak, last_ride |
| `trick_progress` | `(profile_id, trick_id) → stage`. The `byId` map |
| `trick_log` | Append-only. `(profile_id, trick_id, stage, at, estimated)`. Drives every date in the app |
| `trick_notes` | Per-rider session notes |
| `clips` | Private storage paths, never public |
| `stickers` | Name, hue, icon, condition copy, editable threshold `n`, `is_live`. Rules stay in code |
| `rider_stickers` | `earned_at` plus `seen_at`, so a sticker is never re-announced |
| `plans`, `subscriptions`, `subscription_seats` | See §2.4 |
| `crews`, `crew_members`, `crew_invites` | Real crews — the prototype has one demo crew |
| `challenges`, `challenge_log` | Per sport per week. State derived from dates |
| `spots` | Includes `status` (`pending`/`live`/`rejected`) and `submitted_by` — that is the review queue |
| `events`, `event_attendance` | "I'm going" |
| `announcements`, `announcement_dismissals` | Replaces `seenNotices` |
| `audit_log` | Actor, action, entity, before, after. The handoff flags its absence explicitly |

`trick_log` keeps the `estimated` flag from the prototype's `est: true`. The UI says when a date is
estimated rather than pretending it is exact — keep that behaviour.

### Row-level security

Three policies matter more than the rest:

1. **Profile privacy.** `public` / `members` / `private` maps directly onto read policies for
   `profiles`, `trick_progress` and `rider_stickers`. A private rider still appears on the crew
   board by name and score, so the crew board reads a narrower view, not the profile row.
2. **Clips are never public.** Private bucket, signed URLs, and no policy path that exposes a clip
   to another rider. The privacy policy in the handoff promises this.
3. **The paywall is a database rule, not a UI rule.** The insert policy on `trick_progress` must
   reject a paid trick for a rookie-plan rider. If the paywall only lives in the client it is a
   suggestion.

---

## 4. Build order

**Phase 1 — Foundations.** Monorepo, Supabase project, schema and migrations, seed the 61 tricks and
their prerequisite edges, design tokens as CSS custom properties, `packages/core` ported and
unit-tested against the prototype's behaviour. No screens yet.

**Phase 2 — Signed out.** Landing, the five legal documents, sign in / sign up, four-step
onboarding. *Blocked on the age and consent decision.*

**Phase 3 — The core loop.** Home, trick library with filters, trick detail, locked trick, progress
(by category, by stage, over time, skill tree). This is the product; Phases 1–2 are scaffolding.

**Phase 4 — Social and content.** Sticker wall, crew, rider profile with the privacy gating, weekly
challenge, events, spots + map.

**Phase 5 — Money.** Plans page, Stripe, entitlement resolution, Crew Pass seats.

**Phase 6 — Staff.** Admin portal (nine tabs) and the audit log.

**Phase 7 — Reach.** PWA and offline cache, then the Expo app on top of `core` and `db`.

Phase 3 is the one worth protecting. Everything before it is setup and everything after is
expansion; the trick loop is what riders actually come for.

---

## 5. What the prototype fakes

Tracked from the handoff's own list, mapped to phases:

| Faked | Real version | Phase |
| --- | --- | --- |
| `localStorage` persistence | Supabase | 1 |
| Auth and accounts | Real sign-up, reset, under-16 consent | 2 |
| Streaks (a counter) | Date logic, timezones, grace period | 3 |
| Crews (one demo crew) | Creation, invites, membership | 4 |
| Clips (`createObjectURL`, die on refresh) | Upload, storage, signed delivery | 4 |
| The map (one embed at a time) | Mapbox with every spot plotted | 4 |
| Payments (instant and free) | Stripe + entitlements | 5 |
| Admin rider list (mock data) | Real riders | 6 |
| Moderation (queue for spots only) | Reporting for profiles and clips | 6 |
| Offline | Service worker cache, then native | 7 |

---

## 6. Still needed from you

**Blocking Phase 2 — auth and the under-16 question.** Minimum age for a solo account, how parental
consent works below it, and which regimes apply (UK AADC, GDPR, COPPA if there are US riders). The
handoff is right that this wants a lawyer before build, not before launch: the safeguarding page
makes promises the implementation has to keep.

**Blocking Phase 4 — clip cost ceiling.** A per-rider storage cap, retention rules, and what happens
to clips on account deletion. Supabase Storage is assumed; confirm before clips are built.

**Blocking Phase 5 — pricing confirmation.** The prototype shows £3.99 Shredder and £8.99 Crew Pass,
monthly. Confirm those and the yearly equivalents.

**Worth deciding soon — analytics.** Instrumentation should go in as screens are built.

**Worth revisiting — staff portal placement.** The handoff recommends a separate internal app. This
plan puts it in a route group in the web app behind a role gate, which is cheaper at current team
size and keeps one deploy. The audit log is non-negotiable either way. Revisit when non-engineering
staff need access on a different release cadence.
