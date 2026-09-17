# What Land The Trick does today

A code-derived snapshot of the shipped product, for orienting a session or the owner without
re-reading the build history. **Audited against `main` @ `48a44a2`, 2026-08-18**, by reading the
code — not the plan, not the design pack. **Session tracking (T36–T44) re-audited against `main`
@ `f9dcb8f`, 2026-09-14**; everything else still carries the August stamp. Orientation, not
authority: when this file disagrees with the code, the code wins and this file gets re-audited. Decisions and their reasoning stay in
`docs/implementation-plan.md`; live gaps stay in the issue tracker.

The product is **live at `landthetrick.com`** (since 2026-08-17), with Stripe and transactional
email both on. Deploys are manual, so `main` and the deployed box are routinely different commits.

## The product in one paragraph

A trick tracker for scooter, skateboard and BMX riders, built for children with safeguarding as a
feature: log tricks through five honesty-based stages, keep a weekly riding streak, earn stickers,
follow weekly challenges, find real spots and events worldwide, link YouTube videos of your
landings, log a session at a spot and keep the diary of it, and share progress with an invite-only
crew. Free tier plus two paid plans; guardian consent gates under-threshold riders; there is
deliberately no stranger-contact surface anywhere.

**Session tracking is built but not released.** Nine tasks of it are in the tree (T36–T44), and
everything in the Sessions rows below is real code with real server rules — reachable today by the
owner alone. Releasing it is environment values and a restart, not a code change, but it is **two
values on two services, and they fail opposite ways**:

- **Web** (`apps/web/src/lib/sessionsPreview.ts`): `LANDIT_SESSIONS_OPEN=1` opens every session
  surface to everyone, signed out included. Otherwise the answer is `isOwner`, which **fails
  closed** — an unset `LANDIT_OWNER_ID` shows sessions to nobody rather than to everybody.
- **API** (`pocketbase/hooks/lib/session_rules.js`): `LANDIT_SESSIONS_PREVIEW_ID` names the one
  rider who may write a session, and **empty means open** — the deliberate opposite, so the
  preview key cannot linger as a second gate after release and the integration suite (one
  PocketBase, riders it makes during the run) needs no key at all.

So the API is held separately from the screens, because a hidden screen does not stop a direct
write; and releasing sessions means setting the web value **and** clearing the PocketBase one.
Leaving the second set would open the screens to everyone and then refuse their writes.

## Screens (apps/web, Next.js App Router)

| Area | Routes | What a rider gets |
| --- | --- | --- |
| Marketing | `/`, `/story`, `/coming-soon`, `/legal/{privacy,terms,safeguarding,cookies,about}`, `/offline` | Landing (the "wall": hero with an email shortcut into sign-up and two no-sign-up peeks at Spots and Events, four step rows, a sample season grid, FAQ, CTA band), the founding story told by the 12-year-old rider whose idea the product was (`/story`, statically rendered, distinct from the factual `/legal/about`; since 2026-09-12 it carries five photographs of him riding and of the ramp he built, each of which expands to the uncropped picture in a dialog, and its prose carries no em dashes by house rule), holding page (dormant now the site is live), five legal docs, offline fallback. |
| Auth | `/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` | Sign-up asks country + age band (never a date of birth); verification is asked for but blocks nothing. A refused form keeps what was typed (never the password) and says why in the app's own words, never PocketBase's (issue #370): a taken email says so under the field with a "Sign in instead?" link, a wrong password gets one line that does not say which half was wrong, and a dead reset or confirmation link says it has expired beside the way to a fresh one. A field's error clears once it is edited. |
| Onboarding | `/onboarding`, `/consent/[action]/[token]` | Five-step first-run picking sport/level/goal/tricks and asking where the rider found us (optional, fixed list, write-once); the trick step offers only free tricks, filtered by `isTrickFree` and capped by the declared level; guardian approve/revoke landing needs no sign-in. |
| Core loop | `/home`, `/library`, `/library/[slug]`, `/library?mine=1`, `/progress`, `/stickers`, `/challenge` | Dashboard — since the app shell rethink (T46) a **board of record cards**: the greeting, the weekly streak with "I rode today", then **four coloured cards that are links** (Progress · landed, learning, want to; Sessions · this month and the last ride's spot and day, drawn only for a rider the sessions preview covers; Stickers · earned and the newest; Challenge · logged/goal, title and the day it ends), 2 × 2 on a phone and a filled row above 860px, then "Working on it" (two tricks on a phone, four on desktop, with "All N of yours →"), the crew's **activity** as three product-written sentences, "Next up" — the next event the rider said yes to — and "Your spots", their faves. Progress, Sessions, Stickers and the Challenge have no cell in either bar: these cards are the way in, each of those screens carries a **Home back link**, and Home's cell stays lit on all four. The dashboard's sport tab row is gone with every other in-page sport row (the top bar's chip is the switcher); the greeting's four stat blocks and the full challenge panel are desktop-only, because the cards carry them on a phone. Also announcements, and a 259-trick library (a rider who opens a trick and comes straight back gets the grid as they left it: the same scroll position, search text, tier, status and sort, and the same `?mine=1`/`?cat=` address — kept in memory for that one hop and forgotten the moment they are on another screen), per-trick stage ladder under an award-led hero (the trick's badge, stamped LANDED once earned) with a "Your log" panel beside it — a dated list of session notes (each stamped with the stage the rider was at, editable, removable through a confirm, 3 to a page) and the rider's YouTube links (4 to a page) on two tabs — and, since T31, the rider's own history with the trick as a timeline (newest first, and paged, since 2026-09-13), the whole prerequisite road (landed steps ticked, paywalled steps hatched with the plan that opens them), a where-it-sits strip of counts, a "worth a grown-up knowing" line on `supervise` tricks, four tricks like it, and a "where to practise" line into `/spots?feature=…`, and, since T32, the trick's common mistakes with their fixes as numbered rows under the tips, a one-sentence "Why it's Spicy" under the facts strip, a "Same trick, other sports" panel linking the same movement in the other sports, and glossary words throughout the copy dotted-underlined into `/glossary?from=<slug>`; and, since T35, a **"Watch it" panel leading the left column** on the tricks that have one — a single staff-picked YouTube tutorial, its title and channel stored rather than fetched, click-to-play so nothing reaches Google before the press, with "Something wrong?" into the report form; a trick with no video shows no panel at all, and never another sport's video; the road, facts, mistakes, cross-sport panel, similar cards, practise line, watch panel and glossary links render signed out too; and, since 2026-09-13, the **"Share it" card is a real image** — on a landed trick and on an earned sticker alike it draws itself as a 1080×1920 PNG in the browser and hands it to the device's own share sheet, falling back to the caption and link where the browser will not take a file and to the clipboard where there is no sheet at all, with Save image and Copy caption beside it, My Tricks; **Progress on three tabs** (T46) — Record (by category, by stage, printable sheets on desktop's rail), Over time (the six-month chart, the latest lands, the Legend insights panel) and Skill tree — with the Sessions / Where-you're-at row gone from it and `/progress` still meaning "Where you're at" rather than redirecting (issue #522); the sticker wall with **Earned · Not yet as a boxed tab row in its header**, counts and all; the weekly challenge per sport, its sport row gone and the top bar's chip switching it. |
| Sessions | `/progress/sessions`, `/progress/sessions/new`, `/progress/sessions/[id]`, `/progress/sessions/[id]/edit` | **Owner-only until `LANDIT_SESSIONS_OPEN=1`** (T41). A ride at a spot, logged: where and when, how long (30/60/120/180 minutes), which sport, an optional aim, how it felt (five faces, optional since T42), the weather, notes, the crew-mates you rode with, the tricks you worked on, and one clip link. Sessions is **its own Home card** since the app shell rethink (T46): neither bar has a Progress cell any more, the dashboard's Sessions card lands here, and the screen carries a Home back link with Home's cell lit. (Before that, T42 made the Sessions tab lead Progress from both bars; the in-page Sessions / Where-you're-at row still draws on this screen, and its header is T50's.) The screen draws one read of the diary four ways: a three-per-page feed, a 25-row desktop table, phone month accordions opening on this month and last, and four sidebar cards (month summary, quota, where you ride, a Legend insights teaser). Filtering, paging, grouping and the view toggle all happen in the browser off that one read, so nothing is a second request. **Logging is a quick log or a full form** — a bottom sheet on a phone, a modal over the list on desktop through a `@modal` parallel-and-intercepting slot, and a full page for a hard load or a shared link; escalating from quick to full carries the values across. The quick log sends one hour and suggests the rider's three most recently logged tricks on that sport, locked ones left out. A trick entry can **move that trick up the stage ladder to a stage the rider picks** (T42 — "Learning → …", not the old unnamed tickbox), and the move is **one-way**: editing or deleting the session never demotes it. Each session has a page of its own — hero, stat strip, clip player, "What this one changed", the tricks with their stage moves, crew chips, the visibility card and newer/older — and a **crew-mate viewing a Crew session gets stage moves only**, no Edit, no Delete, no quota line, no visibility card, because the rest is about a diary their client cannot read. Read-only blocks on the spot, event and trick pages show the rider's own sessions there with a "Log a session here" entry point; Home's streak card leads with **"Log a session"** (T43) above "I rode today". A signed-out visitor on a session URL is sent to sign in and brought back; every session page is `noindex`. |
| Glossary | `/glossary`, `/glossary?sport=skate`, `/glossary?from=<trick>#<term>` | 84 words riders use — kerb, fakie, coping, whip — explained for a twelve year old, filtered by sport in the address, jumped by an A–Z strip, each with "See it in" links to live tricks whose copy uses the word. Readable signed out. `GlossaryText` (`components/glossary`) links the first mention of any term in a run of copy with a dotted underline, ready for the trick page to adopt (T31); the matching rule and its traps live in `@landit/core`. |
| World | `/spots`, `/spots/[slug]`, `/events`, `/events/[slug]`, `/events/past`, `/events/past/[year]/[town]`, `/events/mine` | 98 researched real venues plus ~3,100 French skateparks imported from the Ministry of Sport’s open-data census (issue #362: seeded once and never overwritten, `sports: ['skate']` and `operating: unknown` until staff say otherwise, every row stamped with an internal `source`/`licence`, credited in the line under the map) and ~25,300 more worldwide from the world import (2026-09-11: the places on Trucks and Fins' map, matched to OpenStreetMap within 150 m where it has them — about 60% — facts only, no prose or photos; pump tracks listed for BMX; internal licence column records that no licence was granted; credited as OpenStreetMap contributors and GeoNames) and ~7,700 OpenStreetMap-only parks whose outline encloses at least 300 m² (#390: plain ODbL, private and point-only objects left out) on a MapLibre/OpenFreeMap map (no key, no account), served a page of 24 at a time from the server — search, sport and feature filters are PocketBase queries mirroring the core rules, the reader’s country leads the order, and "Near me" sorts a compact point list in the browser then fetches the nearest cards by id (issue #367; plan §6.4 standard 10 as amended 2026-09-08), and "Search this area" — offered over the map once a rider has moved it — narrows the list to the spots in view, nearest its middle first, the same way (the view never leaves the browser, the map stops re-framing itself while an area is held, and a "This area ×" pill or "Near me" ends it), and the map draws every matching spot — grouped into numbered blocks where they crowd, each opening to the zoom at which it splits, with the chosen spot always its own pin (issue #388; the compact point list is fetched whenever the map is on screen) — with a Plain/Detail ground toggle, opening on Detail (there is no satellite layer — see plan §7 T13) + rider submissions; on a phone the map is a sheet that comes up when a spot is chosen — three quarters of the screen, above the nav rather than over it, and modal: a scrim, the page held still behind it, and one finger dragging the map rather than the list; filtered by a multi-select sport row — “Every spot” plus one pill per sport, opening on every spot, any combination allowed, and the same three sports for every rider whatever their profile records (2026-09-12; the global sport tabs are gone from this screen and from `/events`). Every approved spot also has a public, crawlable page of its own at `/spots/[slug]` — a "What's here" grid explaining each feature in plain words, the exact map pin, the listing with explicit "not listed" states, and the nearest other spots; only `status = 'live'` spots get one, and the submitter is never shown; the world import's pages carry `noindex` and are left out of the sitemap, and each page reads only the spots around it for its onward list. The point list (every live spot) is read once and served from the web server's memory for five minutes, refreshed in the background (issue #393), and goes out in two halves over cacheable `GET` routes rather than a Server Function (2026-09-12): `/api/spots/points` carries what the list waits on — id, coordinates, sports and tags, 437 KB gzipped — and `/api/spots/names` the names and towns that only a typed search and the map's pin labels need, so a rider who presses "Near me" on a phone and never opens the map downloads half of what one combined payload cost. Both are stamped with a content hash, so a returning rider is answered with a 304 rather than the bytes again. "Near me" starts that download the moment the position is asked for rather than waiting for it to arrive, so the fix and the fetch overlap instead of queueing. 74 researched events with "I'm going", each with a public page of its own carrying the listing, a schematic town-accurate map, and what else is on nearby (upcoming / today / over, derived per request from the reader's clock; past events keep their page and stay in the sitemap). The calendar shows upcoming events only and the archive at `/events/past` shows finished ones only — two routes over one split made in `@landit/core`, with a year-and-town index that lists **only** the corners holding events (an empty corner a reader types answers with an empty state and `noindex`). An event row's name links to its page, the Details modal is kept as the quick look and is addressable at `?event=slug`, and a spot card is a link to its page with map selection moved to an explicit "Show on map" button. A rider's own events are a third tab, `/events/mine` — what they are down for, then what they have been to, under "Coming up" and "Been to" headings — cut from the same two halves so it cannot disagree with the calendar about an event's tense; it is the one events route behind sign-in (`GATED_ROUTES`, `noindex`), the tab is not shown to a visitor, its count updates as rows are marked, and it never defaults to a country. The list's order is a Soonest / Nearest control (Most recent / Nearest on the archive), so a rider can put the calendar back in date order without giving up their location and the distance labels with it. A signed-in rider can **fave a spot** — a star on a list card and a Fave button on the spot's own page — and a **Faves** pill on `/spots`, which appears only once they have some, narrows the list to them under the same search, sport and feature filters; faves are free on every plan, private to the rider (no public count, no path to one), capped only by a flood limit of 200 held and 60 an hour, allowed for a rider still waiting on a guardian (a fave reaches nobody), and taken with the account on erasure and included in the data download. Both readable signed out; distances use the reader's units; geolocation is never prompted for unless a rider presses for it (both screens re-read it on load where the browser already grants it, and the calendar says "Nearest first" while it does), announced whenever it is in hand, kept in memory only, never sent to the server. |
| Social | `/crew`, `/join/[code]`, `/riders/[handle]` | Up to 5 owned crews, server-minted invite codes (25 uses / 14 days), crew board + fixed-sentence activity feed, public profiles. |
| Money | `/plans`, Stripe Checkout | Rookie free / Shredder £3.99 / Legend £6.99 monthly (yearly ≈ 2 months free). Under-16s never see a payment form — the guardian gets a checkout link by email. Where sessions are open, each card carries one derived session line ("Four sessions a month", "Unlimited sessions") read off that plan's own record rather than written into it, and a **"What each plan logs"** comparison sits under the cards — a table above 700px, three stacked cards at or below — whose every allowance is likewise rendered from the records. No card says "clip": the clip-link allowance lives in the comparison, under a header that gives it the context a lone bullet cannot. |
| Account | `/account`, `/account/close`, `/coach`, `/report`, `/suggest` | Profile editor (sports, avatar, level, goal, stance) that saves as a rider changes it, with no Save button — an answer that is not yet complete is held rather than written, so the stored one survives; privacy is the deliberate exception and keeps its button, as does **"Who sees new sessions"** directly under it where sessions are open — a setting about who can see a child changes when the rider says so, not on the tap. Guardian panel and data export; account closure on a page of its own, linked from the data panel rather than sitting on the account screen; read-only coach view (free, unlisted); report/appeal form that works signed out; suggestion box (`/suggest`, riders only) for tricks, features, events and bugs — a separate collection from reports, so ideas cannot spend the safeguarding rate limit. |
| Staff | `/admin` + 12 sections in three groups | See below. Hidden from non-staff with a 404, not a 403, and absent from their account menu. |
| Shell | `/find`, `/whats-new` | The frame every signed-in screen renders inside, on **four groups at every width** (app shell rethink, T45): Home · Tricks · LOG · Find · Crew on the phone's fixed bottom bar, the same four in the desktop top nav. LOG is the middle cell — a raised yellow square, and a yellow button beside the sport chip on a desktop — and it opens a sheet (a modal above 860px) offering **I rode today** (the one-tap ride, the same server action the streak card posts to), **Log a trick** and **Add a clip link** (a picker of the three tricks the rider last worked on, then a search over that sport's library, landing on the trick's own page), and **Log a session** where sessions are open. A visitor with no account gets the same middle cell as a link to sign in rather than a sheet whose options have nothing to act on. The sport is chosen once, in a top-bar chip carrying the sport's icon and short name at every width; it opens a sheet on a phone and a dropdown on a desktop, offers the sports the rider tracks with how many of each they have landed and are learning (read once when the panel opens), and names the ones they do not with a line pointing at their account, and **the top bar's bottom rule takes the current sport's colour**. A bell beside it goes to `/whats-new` on a phone and opens the same panel as a 420px dropdown on a desktop, with a pink count of what the rider has not read yet (T47 — see the What’s new row). `/find` is the Find group's landing screen and **redirects to `/spots` until T48**. The streak chip has left the bar at every width (it never showed below 520px; the streak is on Home). The four screens that lost a cell — Progress, Sessions, Stickers, Challenge — belong to Home and light its cell, but **nothing on a screen points at them yet**: T46 builds the record cards that will, and until then they are reached by address and, for all but Sessions, from the site footer. The glossary is under Tricks the same way; Spots, Events, the archive and a rider's own events are under Find; and the group's cell stays lit on every screen it holds, while `/account`, `/plans`, `/coach`, `/suggest`, `/report` and `/whats-new` light nothing. The confirm-your-email reminder is a one-line strip rather than a panel. |
| What’s new | `/whats-new` | The bell’s contents, **derived at read time and stored nowhere** (T47). A **You** tab lists, newest first, the stickers the rider earned and the crews somebody joined in the last 30 days, an event they said yes to once it is within 7 days, the live challenge for each sport they ride once its deadline is within 3 days, and the week they have just banked. Every line is a sentence the product wrote from catalogue facts — a sticker’s name, an event’s name, a crew’s name, a rider’s display name — and nothing anybody typed appears, the same rule the crew feed is built on. One tab per crew beside it carries that crew’s existing activity feed unchanged; the row is hidden for a rider in no crew. A line about something still to come is dated to the moment it started being true, so the unseen count means the same for it as for a sticker; a banked week is dropped rather than dated to a day the streak tuple cannot place it on; and a join says "Leo joined Ramp Rats", because nothing records whose invite brought a member in. Phone: the page. Desktop: the dropdown, capped at 8 lines with "All →" to the page. Opening it, and "Mark all read", stamp `users.whats_new_seen_at` and the badge clears while the panel is still open; no line is ever struck off, because this is what has happened lately rather than an inbox. The count is computed on every page render from six windowed reads fired together, memoised for the request and failing soft to zero; the crew feeds behind the tabs are fetched when the panel opens. |

## Data model (PocketBase)

One `users` auth collection (handle, sports, privacy, plan, role, age band, consent state,
server-owned streak tuple, server-owned `last_seen`, rider-owned `whats_new_seen_at` — the bookmark What’s new measures its
unseen count against, and the whole of what that screen stores) plus: `plans`, `subscriptions`, `guardian_consents` (token hashes only),
`tricks` (copy, tier, `supervise`, and since T28 `mistakes` json + `hard` text — researched content the
tricks hook holds to `TRICK_CONTENT_LIMITS`; since T35 `video_id` + `video_title` + `video_channel`, the
staff-picked tutorial, **database-only so a seed run cannot revert a curation pass**, re-parsed to an
eleven-character id on every write and refused unless a link and a title arrive together) + `trick_prereqs` + `trick_progress` + `trick_log` (append-only) + `trick_notes`
(owner-only; a dated log since 2026-09-07 — many per rider per trick, each with a nullable `stage`
snapshot, capped at 50 per trick in a hook), `clips` (now YouTube-link rows — the name is a leftover from the reversed
clip-hosting feature), `stickers` + `rider_stickers` (hook-written only), `crews` + `crew_members`
+ `crew_invites`, `challenges` + `challenge_log`, `spots` (pending/live/rejected) + `spot_favourites`, `events` +
`event_attendance` (own-only, so "who else is going" cannot exist), `announcements` +
dismissals, `reports` (open create, incl. signed out), `suggestions` (signed-in create, own-read,
staff `note` read back by its sender), `audit_log` (superuser-only).

Sessions (T36) add three collections and nothing else moves: `sessions` (one row per ride —
`started_at`, `duration_minutes`, `sport`, `spot`, `event`, `aim`, `feel`, `weather`, `notes`,
`rode_with` (max 10), `clip_platform` + `clip_id`, `visibility`, plus a frozen-after-create
`month_key` and a `grace` flag, both server-owned), `session_tricks` (one row per trick worked on,
cascade-deleted with its session, carrying `landed` and the `stage_from`/`stage_to` of the move it
made) and `session_grace` (the once-per-account "save this one anyway" — **a collection with no
delete rule and a unique index on `user`**, so deleting the session that spent the grace does not
give it back). `session_tricks` is a join rather than a JSON column because three things query it:
the trick page's "your sessions on this trick", the paywall (`enforcePaywall` is reused, not
copied), and the one-way promotion, which records exactly once per entry which move it made. One
field lands on `users` (`session_visibility_default`) and four on `plans` (`session_month_cap`,
`sessions_unlimited`, `session_clip_cap`, `session_clips_unlimited`). The grace is deliberately
**not** a field on `users`: a server-owned field there would have to join the frozen list in
`guardUserWrite`, which is a behaviour change to a merged shared hook.

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
- **Sessions** (T36, owner-preview): **the stricter of the session and the profile wins.** A
  session is `public` / `members` ("Crew") / `private`, defaulting to `private`, and the view rule
  intersects it with the owner's profile privacy — so a `public` session on a `private` profile
  reaches only its owner, and `members` on a session means *crew-mates*, expressed as a walk from
  the owner through their memberships rather than trusted to a component. `session_tricks` carries
  the same rule pathed through its parent, so a trick entry is never more visible than its session.
  A consent-limited or suspended rider's sessions reach nobody, and they still read their own.
  "Rode with" is refused for anyone who is not a crew-mate, and a viewer is only sent the tagged
  ids whose profiles they could have opened anyway. The monthly quota (four on Rookie), the
  once-per-account grace and the session clip-link caps (0 / 10 / unlimited, its **own** allowance
  separate from trick video links) are all enforced at the model layer with **no superuser bypass**
  — asserted as such in `pocketbase/tests/sessions.test.ts`. `month_key` is computed in Node,
  bounds-checked in the hook and frozen after create, so the quota counts a month a rider cannot
  edit around. The preview gate has a server half of its own (`sessionsPreviewAllows` in
  `hooks/lib/session_rules.js`), because a hidden screen does not stop a direct write.
- **Guardian consent**: sign-up requires country + age band; US under-13 refused outright (COPPA);
  under-threshold riders (default 13, EEA 16) sit in a limited state — invisible to other riders,
  no crews, no spots, no events, no subscription — until a guardian approves by email; consent
  lapses and releases automatically on age-band boundaries at next sign-in.
- **Rate limits**: handle changes 20/h; spot submissions 3/h + 10 pending; spot faves 60/h + 200 held; consent requests 3/h,
  10/day, 5/day per guardian address; reports 5/h + 20 open; suggestions 3/h + 10 open, counted
  against their own collection so ideas and safeguarding reports never share an allowance;
  exports 5/h. Sessions are bounded by the monthly quota rather than an hourly one, with a session
  holding at most 20 trick entries, 10 crew-mates, a 120-character aim and 2,000 characters of
  notes.
- **Own-write, and the difference matters**: `users.whats_new_seen_at` (T47) is deliberately *not* in
  the guard’s frozen lists — it is a rider’s own bookmark in their own news, freezing it would break
  the feature, and forging it costs its owner a badge and nobody else anything. What stops it being
  set on somebody else is `users.updateRule` (`id = @request.auth.id`), which 404s another rider’s
  record before a hook runs; `pocketbase/tests/whats-new-seen.test.ts` asserts that status by name
  rather than "not 200", so a loosened rule would show up as a failure rather than as a pass through
  a different door. It is cleared on erasure and written into the rider’s own data export.
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
- **Sessions** (`rules/sessions.ts`, transcribed for the hook into `hooks/lib/session_rules.js`
  with a parity test between them): **Rookie logs four a calendar month**, warned at three, and the
  fifth meets a wall offering the **once-per-account grace**. **The ride and the streak always
  save, even when the session is refused** — `logSession` marks the day's ride before it asks for
  the session, idempotent with the "I rode today" tap, so a rider who hits the cap never loses the
  week. The month is the one the session was *logged* in on the rider's own clock, not the month it
  is dated. Five feels (sent / good / fine / rough / hurt, optional since T42 — a screen draws
  nothing rather than defaulting to "Fine", which would be the session saying something the rider
  did not), five weathers, four durations. A clip is a **YouTube, Instagram or TikTok link**, never
  an upload, parsed server-side to `{ platform, id }`. **A stage move is one-way**: a landed entry
  promotes the trick once, to a stage the rider picks from those above where it sits, and the hook
  honours the pick only when it names a higher stage — so a pick that went stale while the form was
  open costs the session nothing, and editing or deleting the session never demotes the trick.
  Achievements are never for sale, so a stage move from a session is free on every plan and keeps
  working after the monthly allowance runs out.
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
  staff (reports and suggestions) or stays owner-only (notes). A session is the closest the product
  comes to a post and it is still not one: there is no session feed beyond the rider's own, the
  crew feed's line is fixed at "logged a session" with no spot, aim, notes or tricks in the
  payload, and "rode with" can only name a crew-mate. **No idea board and no voting** —
  a suggestion is read by staff and by the rider who sent it, never by another rider.
- **No video hosting** (reversed 2026-08-17): riders link YouTube videos instead, and a session
  clip is a YouTube, Instagram or TikTok **link** on the same footing — we hold the link, never the
  file, which is why no plan card is allowed to say "clip", "vault", "upload" or a byte figure.
- **No DOB stored**, no geolocation stored, no third-party map account (OpenFreeMap). PostHog is
  wired but **cookie-less and profile-less** — no cookie, no device storage, no `identify()`, no
  autocapture, no session replay, and inert without a key. 81 hand-written events cover nearly
  every rider action; autocapture is refused on purpose, because it would send the text of what
  was clicked. **No session event carries a spot, an event, a time or a duration** — a session is
  the first thing in the product that knows where a child was, so its eight events carry only
  catalogue facts: which control was pressed, which view, which form, and a plan slug. Riders are counted by a server-side hash that is re-salted nightly, so "unique"
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
sheet with email/age/last ride/how they found us (`heard_about`, resolved to its label and
read-only — the field is write-once, so the sheet shows the answer and offers no way to change
it)/plan, the latest guardian request — address, standing and dates,
per-rider so no other guardian's address is in the page — plan override, suspend); tricks (copy, tier, and the T28
content — why it's this tier, and three or four common mistakes as what/fix rows), stickers,
spots (approve/reject), events, challenges, notices, plans (copy + display prices only —
entitlement flags read-only); moderation queue for reports/appeals; an Ideas queue over
`suggestions`, deliberately a separate tab over a separate collection. Every mutation is audited
twice (app layer + hook layer). Under 900px wide the riders, tricks, stickers and spots tables
show each row as a card with its column names printed in it, and events and challenges scroll
sideways with the name column pinned; at 900px and above every table is unchanged.

**The twelve sections are grouped into three, named, and shown as a drawer or a rail**
(2026-09-14, replacing one wrapping row of pills): *Riders & money* (Overview, Riders, Plans),
*Waiting on you* (Moderation, Spots, Ideas, Video checks) and *What the app shows* (Trick library,
Challenges, Events, Announcements, Stickers). Below 900px the list collapses behind one button
naming the section you are on; at 900px and above it is a permanent left rail beside the screen.
The three queues carry how much is waiting — open reports, spots still waiting, unread ideas —
read in the layout, with a failed count dropping its badge rather than showing a wrong zero; video
checks is a job history rather than a queue and carries none. Each screen's filters sit under a
label of their own (*Show*, or what they narrow where a screen has two sets), as a smaller joined
control that cannot be mistaken for the navigation above it.

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

**2,193 Vitest cases across 136 files** (core rules 888, PocketBase 531, web libs 377, db 311,
ui-web 86 — counted from the runner on 2026-09-14, not estimated), of which **28 are PocketBase
HTTP suites (407 cases) driving the real pinned binary**, including one suite per security
guarantee; the other 8 files in that project hold two files to each other as text, which is how a
migration or a Dockerfile that cannot import the workspace is kept in step with it. **28 Playwright
specs (243 tests)**, of which four are sessions (`sessions-list`, `session-form`, `session-detail`,
`session-plans` — 14 tests), running against a server the Playwright config starts with
`LANDIT_SESSIONS_OPEN=1`, so the release state is what the browser tests see. Sessions are also
covered by `pocketbase/tests/sessions.test.ts` (the visibility matrix — three profile settings ×
three session settings × four viewers — plus every refusal, the quota, the grace and the
superuser-cannot-bypass assertions) and by `session-rules.test.ts`, which holds the hook's
transcription of `rules/sessions.ts` to the original. CI: gates (build/test/lint), Docker image
checks (boots both images, asserts live and holding-page modes), e2e. Known coverage gaps: no specs
for crews/admin/report flows (#98, #136, #146) and no staff-portal e2e (#502).
