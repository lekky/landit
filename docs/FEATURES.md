# What Land The Trick does today

A code-derived snapshot of the shipped product, for orienting a session or the owner without
re-reading the build history. **Audited against `main` @ `48a44a2`, 2026-08-18**, by reading the
code — not the plan, not the design pack. Orientation, not authority: when this file disagrees with
the code, the code wins and this file gets re-audited. Decisions and their reasoning stay in
`docs/implementation-plan.md`; live gaps stay in the issue tracker.

The product is **live at `landthetrick.com`** (since 2026-08-17), with Stripe and transactional
email both on. Deploys are manual, so `main` and the deployed box are routinely different commits.

## The product in one paragraph

A trick tracker for scooter, skateboard and BMX riders, built for children with safeguarding as a
feature: log tricks through five honesty-based stages, keep a weekly riding streak, earn stickers,
follow weekly challenges, find real spots and events worldwide, link YouTube videos of your
landings, and share progress with an invite-only crew. Free tier plus two paid plans; guardian
consent gates under-threshold riders; there is deliberately no stranger-contact surface anywhere.

## Screens (apps/web, Next.js App Router)

| Area | Routes | What a rider gets |
| --- | --- | --- |
| Marketing | `/`, `/coming-soon`, `/legal/{privacy,terms,safeguarding,cookies,about}`, `/offline` | Landing (the "wall": hero with an email shortcut into sign-up and two no-sign-up peeks at Spots and Events, four step rows, a sample season grid, FAQ, CTA band), holding page (dormant now the site is live), five legal docs, offline fallback. |
| Auth | `/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` | Sign-up asks country + age band (never a date of birth); verification is asked for but blocks nothing. |
| Onboarding | `/onboarding`, `/consent/[action]/[token]` | Four-step first-run picking sport/level/goal/tricks; guardian approve/revoke landing needs no sign-in. |
| Core loop | `/home`, `/library`, `/library/[slug]`, `/library?mine=1`, `/progress`, `/stickers`, `/challenge` | Dashboard (weekly streak, "I rode today", working trick, announcements), 97-trick library, per-trick stage ladder/notes/videos under an award-led hero (the trick's badge, stamped LANDED once earned), My Tricks, progress + skill tree + printable sheets, sticker wall, weekly challenge per sport. |
| World | `/spots`, `/events` | 98 researched real venues on a MapLibre/OpenFreeMap map (no key, no account) with a Plain/Detail ground toggle, opening on Detail (there is no satellite layer — see plan §7 T13) + rider submissions; on a phone the map is a sheet that comes up when a spot is chosen, docked above the nav; filtered by sport tabs covering all three sports; 74 researched events with "I'm going". Both readable signed out; distances use the reader's units; geolocation is never prompted for unless a rider presses for it (both screens re-read it on load where the browser already grants it, and the calendar says "Nearest first" while it does), announced whenever it is in hand, kept in memory only, never sent to the server. |
| Social | `/crew`, `/join/[code]`, `/riders/[handle]` | Up to 5 owned crews, server-minted invite codes (25 uses / 14 days), crew board + fixed-sentence activity feed, public profiles. |
| Money | `/plans`, Stripe Checkout | Rookie free / Shredder £3.99 / Legend £6.99 monthly (yearly ≈ 2 months free). Under-16s never see a payment form — the guardian gets a checkout link by email. |
| Account | `/account`, `/coach`, `/report` | Profile editor (sports, avatar, level, goal, stance) that saves as a rider changes it, with no Save button — an answer that is not yet complete is held rather than written, so the stored one survives; privacy is the deliberate exception and keeps its button. Guardian panel, data export, account closure; read-only coach view (free, unlisted); report/appeal form that works signed out. |
| Staff | `/admin` + 9 tabs | See below. Hidden from non-staff with a 404, not a 403. |

## Data model (PocketBase)

One `users` auth collection (handle, sports, privacy, plan, role, age band, consent state,
server-owned streak tuple) plus: `plans`, `subscriptions`, `guardian_consents` (token hashes only),
`tricks` + `trick_prereqs` + `trick_progress` + `trick_log` (append-only) + `trick_notes`
(owner-only), `clips` (now YouTube-link rows — the name is a leftover from the reversed
clip-hosting feature), `stickers` + `rider_stickers` (hook-written only), `crews` + `crew_members`
+ `crew_invites`, `challenges` + `challenge_log`, `spots` (pending/live/rejected), `events` +
`event_attendance` (own-only, so "who else is going" cannot exist), `announcements` +
dismissals, `reports` (open create, incl. signed out), `audit_log` (superuser-only).

## Server-side enforcement (pocketbase/hooks — the four guarantees plus the rest)

- **Privacy**: three-way profile privacy (`private` default / `crew` / `everyone`) enforced in API
  rules; the crew board serves a fixed six-field shape and skips consent-limited and suspended
  riders; the crew feed applies full privacy and has no ranking.
- **Paywall**: tricks at difficulty ≥ 3 are gated at the model layer (no superuser bypass), free
  tier keeps difficulty ≤ 2 plus per-trick overrides. The trick stays visible; only tracking is
  gated. Achievements are never for sale.
- **Video never public**: only an 11-char YouTube id is stored (re-parsed server-side), visibility
  is `private`/`members` with no public state, caps by plan (0 / 10 / unlimited) counted
  server-side.
- **Guardian consent**: sign-up requires country + age band; US under-13 refused outright (COPPA);
  under-threshold riders (default 13, EEA 16) sit in a limited state — invisible to other riders,
  no crews, no spots, no events, no subscription — until a guardian approves by email; consent
  lapses and releases automatically on age-band boundaries at next sign-in.
- **Rate limits**: handle changes 20/h; spot submissions 3/h + 10 pending; consent requests 3/h,
  10/day, 5/day per guardian address; reports 5/h + 20 open; exports 5/h.
- **Also server-owned**: role/plan/consent/suspension/streak fields frozen against client writes;
  sticker awards; one live challenge per sport with a log window; subscription→plan resolution
  (staff overrides outrank provider rows); an audit row for every staff-collection write; the
  `users` row itself is not deletable over the API, so closure always goes through the
  anonymise-and-retain route rather than a cascade that would take guardian consent with it.

## Game mechanics (packages/core — pure TS, no React/DOM)

- **259 tricks** (84 scooter, 85 skate, 90 BMX — the 97 originals plus 162 researched and cited in
  T27, 54 per sport, never invented), 5 categories, difficulty 1–5 (Rookie/Easy/Spicy/Gnarly/Pro),
  prerequisite graph. An optional `supervise` flag marks flips, inverts and committed drops for the
  coach view — set per trick, not inferred from difficulty.
- **Ten free tricks per sport**, spread 4 Rookie / 3 Easy / 2 Spicy / 1 Gnarly and nothing at Pro
  (T27). Every free trick's whole prerequisite chain is free, so none of them is unreachable behind
  a paid rung; the paywall itself is enforced server-side on `trick_progress` creation.
- **5 stages** per trick: want → trying → landed some → landed most → every time.
- **Weekly streak**: 2 rides in a Mon–Sun week, server-owned, no grace week. (A deprecated daily
  API survives in `rules/streak.ts` for the additive-only rule; nothing calls it.)
- **297 awards** (T24's 135 plus T27's 162: one badge per trick plus platform/streak/contribution/
  completion awards, printed art in `packages/ui-web/assets/stickers/`; `promoter` dormant, and the
  162 T27 badges are recorded with their filenames while the art is printed) and 10 retired legacy
  stickers.
  A trick's own badge leads its trick page (T25, moved into the hero by T26) — never greyed out,
  and stamped LANDED in red once earned, NOT YET in dashed grey until then — where the original
  design pack had a photo placeholder that was never filled.
  Rule *kinds* in code, parameters and thresholds staff-tunable on the record;
  **18 challenges** (6 per sport), state derived from dates in the rider's timezone.
- 36 avatars, 4 levels, stances, goals, country/consent tables, contact addresses.

## What deliberately does not exist

- **No stranger contact**: no messaging, no DMs, no algorithmic feed, no crew discovery or search,
  no "who else is going", no comments. The only rider-authored free text that leaves them goes to
  staff (reports) or stays owner-only (notes).
- **No video hosting** (reversed 2026-08-17): riders link YouTube videos instead.
- **No DOB stored**, no geolocation stored, no third-party map account (OpenFreeMap). PostHog is
  wired but **cookie-less and profile-less** — no cookie, no device storage, no `identify()`, no
  autocapture, no session replay, and inert without a key. 33 hand-written events cover nearly
  every rider action; autocapture is refused on purpose, because it would send the text of what
  was clicked. Riders are counted by a server-side hash that is re-salted nightly, so "unique"
  means unique per day (Sentry is wired but inert without a DSN).
- **No minimum age statement** — by design, part of the child-safety position.

## Staff portal

`/admin` (role gate, 404 to non-staff, role settable only from the PocketBase superuser
dashboard): overview; riders (sheet with email/age/plan, plan override, suspend); tricks, stickers,
spots (approve/reject), events, challenges, notices, plans (copy + display prices only —
entitlement flags read-only); moderation queue for reports/appeals. Every mutation is audited
twice (app layer + hook layer).

## Money

Stripe Checkout subscriptions, GBP only (issue #170), VAT-inclusive prices, metadata-keyed
webhook that writes our own `subscriptions` rows; plan entitlement resolved server-side. An 18+
confirmation is required to start checkout; under-16 upgrades go via a guardian email carrying a
Stripe link. With no Stripe keys set, every path degrades honestly.

## Email

Two hook-built senders (guardian-consent request, guardian upgrade link) ship in the container;
PocketBase's own auth emails (verify, reset) live as templates in its settings database —
version-controlled reference copies in `pocketbase/templates/`, changed by pasting in the admin
UI, not by deploying. Sender is MailerSend over SMTP; mailboxes receive via cPanel.

## PWA / offline

Installable manifest (start URL is the dashboard), generated icons (a designed icon is issue
#141), service worker with two caches (build assets + rendered pages, wiped on rider change),
read-only offline: the library reads at the park, writes need a connection.

## Discoverability (search engines and answer engines)

`robots.txt` and `sitemap.xml` are both live-gated off `LANDIT_SITE_LIVE`: shut, everything is
disallowed and the sitemap is empty; open, everything is allowed and robots points at the sitemap.
The sitemap lists the public pages and every live trick read from the database — `lib/publicRoutes.ts`
is the list of what counts as public, with a test that fails if a sign-in-gated route creeps in.
Trick cards in the library are real `<a href>` links, which is what makes the ~97 trick pages
reachable at all. Every public page carries a canonical URL; every page carries `Organization` and
`WebSite` JSON-LD, and a trick page adds `HowTo` built from the same staff copy it renders. There is
a `/llms.txt` site map in prose. Staff and rider-private screens carry `robots: { index: false }`.

Not done: `www.landthetrick.com` still serves a full duplicate of the site rather than redirecting
(canonicals mitigate it; the redirect is infrastructure), and the AI-crawler policy is the blanket
`Allow: /` rather than a stated decision.

## Tests and CI

~1000 Vitest cases (core rules, db, generated-type drift, web libs), 21 PocketBase HTTP suites
(~295 cases) driving the real pinned binary — including one suite per security guarantee — and 15
Playwright specs (126 tests). CI: gates (build/test/lint), Docker image checks (boots both images,
asserts live and holding-page modes), e2e. Known coverage gaps: no specs for crews/admin/report
flows (#98, #136, #146).
