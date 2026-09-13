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
| Marketing | `/`, `/story`, `/coming-soon`, `/legal/{privacy,terms,safeguarding,cookies,about}`, `/offline` | Landing (the "wall": hero with an email shortcut into sign-up and two no-sign-up peeks at Spots and Events, four step rows, a sample season grid, FAQ, CTA band), the founding story told by the 12-year-old rider whose idea the product was (`/story`, statically rendered, distinct from the factual `/legal/about`; since 2026-09-12 it carries five photographs of him riding and of the ramp he built, each of which expands to the uncropped picture in a dialog, and its prose carries no em dashes by house rule), holding page (dormant now the site is live), five legal docs, offline fallback. |
| Auth | `/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` | Sign-up asks country + age band (never a date of birth); verification is asked for but blocks nothing. A refused form keeps what was typed (never the password) and says why in the app's own words, never PocketBase's (issue #370): a taken email says so under the field with a "Sign in instead?" link, a wrong password gets one line that does not say which half was wrong, and a dead reset or confirmation link says it has expired beside the way to a fresh one. A field's error clears once it is edited. |
| Onboarding | `/onboarding`, `/consent/[action]/[token]` | Five-step first-run picking sport/level/goal/tricks and asking where the rider found us (optional, fixed list, write-once); the trick step offers only free tricks, filtered by `isTrickFree` and capped by the declared level; guardian approve/revoke landing needs no sign-in. |
| Core loop | `/home`, `/library`, `/library/[slug]`, `/library?mine=1`, `/progress`, `/stickers`, `/challenge` | Dashboard (weekly streak, "I rode today", working trick, announcements), 259-trick library (a rider who opens a trick and comes straight back gets the grid as they left it: the same scroll position, search text, tier, status and sort, and the same `?mine=1`/`?cat=` address — kept in memory for that one hop and forgotten the moment they are on another screen), per-trick stage ladder under an award-led hero (the trick's badge, stamped LANDED once earned) with a "Your log" panel beside it — a dated list of session notes (each stamped with the stage the rider was at, editable, removable through a confirm, 3 to a page) and the rider's YouTube links (4 to a page) on two tabs — and, since T31, the rider's own history with the trick as a timeline, the whole prerequisite road (landed steps ticked, paywalled steps hatched with the plan that opens them), a where-it-sits strip of counts, a "worth a grown-up knowing" line on `supervise` tricks, four tricks like it, and a "where to practise" line into `/spots?feature=…`, and, since T32, the trick's common mistakes with their fixes as numbered rows under the tips, a one-sentence "Why it's Spicy" under the facts strip, a "Same trick, other sports" panel linking the same movement in the other sports, and glossary words throughout the copy dotted-underlined into `/glossary?from=<slug>`; the road, facts, mistakes, cross-sport panel, similar cards, practise line and glossary links render signed out too, My Tricks, progress + skill tree + printable sheets, sticker wall, weekly challenge per sport. |
| Glossary | `/glossary`, `/glossary?sport=skate`, `/glossary?from=<trick>#<term>` | 84 words riders use — kerb, fakie, coping, whip — explained for a twelve year old, filtered by sport in the address, jumped by an A–Z strip, each with "See it in" links to live tricks whose copy uses the word. Readable signed out. `GlossaryText` (`components/glossary`) links the first mention of any term in a run of copy with a dotted underline, ready for the trick page to adopt (T31); the matching rule and its traps live in `@landit/core`. |
| World | `/spots`, `/spots/[slug]`, `/events`, `/events/[slug]`, `/events/past`, `/events/past/[year]/[town]` | 98 researched real venues plus ~3,100 French skateparks imported from the Ministry of Sport’s open-data census (issue #362: seeded once and never overwritten, `sports: ['skate']` and `operating: unknown` until staff say otherwise, every row stamped with an internal `source`/`licence`, credited in the line under the map) and ~25,300 more worldwide from the world import (2026-09-11: the places on Trucks and Fins' map, matched to OpenStreetMap within 150 m where it has them — about 60% — facts only, no prose or photos; pump tracks listed for BMX; internal licence column records that no licence was granted; credited as OpenStreetMap contributors and GeoNames) and ~7,700 OpenStreetMap-only parks whose outline encloses at least 300 m² (#390: plain ODbL, private and point-only objects left out) on a MapLibre/OpenFreeMap map (no key, no account), served a page of 24 at a time from the server — search, sport and feature filters are PocketBase queries mirroring the core rules, the reader’s country leads the order, and "Near me" sorts a compact point list in the browser then fetches the nearest cards by id (issue #367; plan §6.4 standard 10 as amended 2026-09-08), and "Search this area" — offered over the map once a rider has moved it — narrows the list to the spots in view, nearest its middle first, the same way (the view never leaves the browser, the map stops re-framing itself while an area is held, and a "This area ×" pill or "Near me" ends it), and the map draws every matching spot — grouped into numbered blocks where they crowd, each opening to the zoom at which it splits, with the chosen spot always its own pin (issue #388; the compact point list is fetched whenever the map is on screen) — with a Plain/Detail ground toggle, opening on Detail (there is no satellite layer — see plan §7 T13) + rider submissions; on a phone the map is a sheet that comes up when a spot is chosen — three quarters of the screen, above the nav rather than over it, and modal: a scrim, the page held still behind it, and one finger dragging the map rather than the list; filtered by a multi-select sport row — “Every spot” plus one pill per sport, opening on every spot, any combination allowed, and the same three sports for every rider whatever their profile records (2026-09-12; the global sport tabs are gone from this screen and from `/events`). Every approved spot also has a public, crawlable page of its own at `/spots/[slug]` — a "What's here" grid explaining each feature in plain words, the exact map pin, the listing with explicit "not listed" states, and the nearest other spots; only `status = 'live'` spots get one, and the submitter is never shown; the world import's pages carry `noindex` and are left out of the sitemap, and each page reads only the spots around it for its onward list. The map's point list (every live spot) is read once and served from the web server's memory for five minutes, refreshed in the background (issue #393). 74 researched events with "I'm going", each with a public page of its own carrying the listing, a schematic town-accurate map, and what else is on nearby (upcoming / today / over, derived per request from the reader's clock; past events keep their page and stay in the sitemap). The calendar shows upcoming events only and the archive at `/events/past` shows finished ones only — two routes over one split made in `@landit/core`, with a year-and-town index that lists **only** the corners holding events (an empty corner a reader types answers with an empty state and `noindex`). An event row's name links to its page, the Details modal is kept as the quick look and is addressable at `?event=slug`, and a spot card is a link to its page with map selection moved to an explicit "Show on map" button. Both readable signed out; distances use the reader's units; geolocation is never prompted for unless a rider presses for it (both screens re-read it on load where the browser already grants it, and the calendar says "Nearest first" while it does), announced whenever it is in hand, kept in memory only, never sent to the server. |
| Social | `/crew`, `/join/[code]`, `/riders/[handle]` | Up to 5 owned crews, server-minted invite codes (25 uses / 14 days), crew board + fixed-sentence activity feed, public profiles. |
| Money | `/plans`, Stripe Checkout | Rookie free / Shredder £3.99 / Legend £6.99 monthly (yearly ≈ 2 months free). Under-16s never see a payment form — the guardian gets a checkout link by email. |
| Account | `/account`, `/account/close`, `/coach`, `/report`, `/suggest` | Profile editor (sports, avatar, level, goal, stance) that saves as a rider changes it, with no Save button — an answer that is not yet complete is held rather than written, so the stored one survives; privacy is the deliberate exception and keeps its button. Guardian panel and data export; account closure on a page of its own, linked from the data panel rather than sitting on the account screen; read-only coach view (free, unlisted); report/appeal form that works signed out; suggestion box (`/suggest`, riders only) for tricks, features, events and bugs — a separate collection from reports, so ideas cannot spend the safeguarding rate limit. |
| Staff | `/admin` + 10 tabs | See below. Hidden from non-staff with a 404, not a 403, and absent from their account menu. |

## Data model (PocketBase)

One `users` auth collection (handle, sports, privacy, plan, role, age band, consent state,
server-owned streak tuple, server-owned `last_seen`) plus: `plans`, `subscriptions`, `guardian_consents` (token hashes only),
`tricks` (copy, tier, `supervise`, and since T28 `mistakes` json + `hard` text — researched content the
tricks hook holds to `TRICK_CONTENT_LIMITS`) + `trick_prereqs` + `trick_progress` + `trick_log` (append-only) + `trick_notes`
(owner-only; a dated log since 2026-09-07 — many per rider per trick, each with a nullable `stage`
snapshot, capped at 50 per trick in a hook), `clips` (now YouTube-link rows — the name is a leftover from the reversed
clip-hosting feature), `stickers` + `rider_stickers` (hook-written only), `crews` + `crew_members`
+ `crew_invites`, `challenges` + `challenge_log`, `spots` (pending/live/rejected), `events` +
`event_attendance` (own-only, so "who else is going" cannot exist), `announcements` +
dismissals, `reports` (open create, incl. signed out), `suggestions` (signed-in create, own-read,
staff `note` read back by its sender), `audit_log` (superuser-only).

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
  10/day, 5/day per guardian address; reports 5/h + 20 open; suggestions 3/h + 10 open, counted
  against their own collection so ideas and safeguarding reports never share an allowance;
  exports 5/h.
- **Also server-owned**: role/plan/consent/suspension/streak fields frozen against client writes;
  sticker awards; one live challenge per sport with a log window; subscription→plan resolution
  (staff overrides outrank provider rows); an audit row for every staff-collection write; the
  `users` row itself is not deletable over the API, so closure always goes through the
  anonymise-and-retain route rather than a cascade that would take guardian consent with it;
  session notes capped at 50 per rider per trick, with the stage stamp held to the five ids and
  a note never movable to another rider or trick.

## Game mechanics (packages/core — pure TS, no React/DOM)

- **259 tricks** (84 scooter, 85 skate, 90 BMX — the 97 originals plus 162 researched and cited in
  T27, 54 per sport, never invented), 5 categories, difficulty 1–5 (Rookie/Easy/Spicy/Gnarly/Pro),
  prerequisite graph. A `supervise` flag marks flips, inverts and committed drops — set per trick,
  not inferred from difficulty, and stored as its own column so the coach view's guardian list
  reads it from the live rows. A trick that carries no flag at all falls back to difficulty 5.
- **Per-trick content (T28)**: every trick carries three or four common mistakes with a fix and a
  line on why it sits at its tier, researched from coaching sources (181 cited on the trick, 78 on
  its family; all shipped for staff review) and editable in the staff portal. `TRICK_CONTENT_LIMITS`
  holds the word limits and the tricks hook enforces them on every write. A **cross-sport map**
  (`CROSS_SPORT`, `crossSportEquivalents()`) pairs 137 tricks with the same movement in the other
  sports, symmetric and one per sport. Nothing rider-facing renders either yet — that is the trick
  page's follow-up (`t31-trick-page`).
- **Twenty free tricks per sport** — every Rookie trick, a fill of Easy (8 scooter and skate, 10
  BMX), 4 Spicy, 2 Gnarly, nothing at Pro (owner, 2026-09-12; T27's ten, doubled). 60 of 259, 23.2%
  of the library. Every free trick's whole prerequisite chain is free, so none of them is
  unreachable behind a paid rung; the paywall itself is enforced server-side on `trick_progress`
  creation. No difficulty-1 trick is paid in any sport, and each sport's free set enters four of
  its five categories — the fifth starts at difficulty 4 everywhere.
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
  **81 challenges** (27 fortnightly slots per sport, running to 2027-09-12), state derived from
  dates in the rider's timezone; a rider's challenge history starts on the day they joined.
- 36 avatars, 4 levels, stances, goals, country/consent tables, contact addresses.

## What deliberately does not exist

- **No stranger contact**: no messaging, no DMs, no algorithmic feed, no crew discovery or search,
  no "who else is going", no comments. The only rider-authored free text that leaves them goes to
  staff (reports and suggestions) or stays owner-only (notes). **No idea board and no voting** —
  a suggestion is read by staff and by the rider who sent it, never by another rider.
- **No video hosting** (reversed 2026-08-17): riders link YouTube videos instead.
- **No DOB stored**, no geolocation stored, no third-party map account (OpenFreeMap). PostHog is
  wired but **cookie-less and profile-less** — no cookie, no device storage, no `identify()`, no
  autocapture, no session replay, and inert without a key. 58 hand-written events cover nearly
  every rider action; autocapture is refused on purpose, because it would send the text of what
  was clicked. Riders are counted by a server-side hash that is re-salted nightly, so "unique"
  means unique per day (Sentry is wired but inert without a DSN).
- **No minimum age statement** — by design, part of the child-safety position.

## Staff portal

`/admin` (role gate, 404 to non-staff, role settable only from the PocketBase superuser
dashboard; reached from the top bar's avatar menu, which carries an "Admin portal" row for
staff accounts and shows non-staff nothing at all about a portal): overview (rider/trick/spot counts, riders by plan, by sport and by how they found us —
the last with a paid split withheld below 10 riders per option); riders (last seen, from
`users.last_seen` which the server stamps on authentication and throttles to 15 minutes — the
column showed `last_ride` until `feat-last-seen`, and so reported rides while headed "Last active";
an account tag of ok/guardian/withdrawn/suspended, where the middle two are the consent gate's two
halves — `revoked` read as `ok` until 2026-09-12, so a withdrawn consent was invisible to staff;
sheet with email/age/last ride/plan, the latest guardian request — address, standing and dates,
per-rider so no other guardian's address is in the page — plan override, suspend); tricks (copy, tier, and the T28
content — why it's this tier, and three or four common mistakes as what/fix rows), stickers,
spots (approve/reject), events, challenges, notices, plans (copy + display prices only —
entitlement flags read-only); moderation queue for reports/appeals; an Ideas queue over
`suggestions`, deliberately a separate tab over a separate collection. Every mutation is audited
twice (app layer + hook layer). Under 900px wide the riders, tricks, stickers and spots tables
show each row as a card with its column names printed in it, and events and challenges scroll
sideways with the name column pinned; at 900px and above every table is unchanged.

Six tabs page on the server with their filters (and, where they have one, search) in the URL —
riders (40), spots (40), events (25), moderation (25), challenges (25), notices (20). Per-row
counts on events, challenges and notices are scoped to the page rather than read from the whole
join collection. The other three are bounded catalogues that fetch in full and filter in the
browser: tricks, stickers, plans.

## Money

Stripe Checkout subscriptions, GBP only (issue #170 — `/plans` tells a reader outside the UK
the prices are sterling and their bank may convert), VAT-inclusive prices, metadata-keyed
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
disallowed and the sitemap is empty; open, robots points at the sitemap and allows everything
except what serves a crawler nothing — the gated screens, the auth screens, `/consent/` and
`/join/` token URLs, `/admin`, `/api/`, `/design` and `/offline` (`apps/web/src/app/robots.ts`).
The sitemap lists the public pages, every live trick and every live event read from the database
(past events included, deliberately: they keep pulling in traffic) — `lib/publicRoutes.ts`
is the list of what counts as public, with a test that fails if a sign-in-gated route creeps in.
Trick cards in the library are real `<a href>` links, which is what makes the trick pages
reachable at all. Every public page carries a canonical URL; every page carries `Organization` and
`WebSite` JSON-LD, and a trick page adds `HowTo` built from the same staff copy it renders, and an event page adds
`Event` built only from what that page carries — no `geo` (coordinates are the town, not the venue),
no `offers` (price is display copy, not a number). There is
a `/llms.txt` site map in prose. Staff and rider-private screens carry `robots: { index: false }`.

Not done: `www.landthetrick.com` still serves a full duplicate of the site rather than redirecting
(canonicals mitigate it; the redirect is infrastructure), and the AI-crawler policy is the blanket
`Allow: /` rather than a stated decision.

## Tests and CI

~1000 Vitest cases (core rules, db, generated-type drift, web libs), 29 PocketBase HTTP suites
(384 cases) driving the real pinned binary — including one suite per security guarantee — and 15
Playwright specs (126 tests). CI: gates (build/test/lint), Docker image checks (boots both images,
asserts live and holding-page modes), e2e. Known coverage gaps: no specs for crews/admin/report
flows (#98, #136, #146).
