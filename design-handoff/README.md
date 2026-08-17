# Handoff: Land The Trick

A trick tracker for scooter and skateboard riders. Riders log every trick they can do through five honesty-based stages, earn stickers, follow a weekly challenge, find spots and events, and compare with a crew. Staff run the whole thing from an in-app admin portal.

Built for riders of all ages, so the safeguarding defaults and the parent/coach view matter as much as the tracking.

> **Start with Step 0: decide the stack, below.** Do not begin implementing screens until those decisions are made and recorded. Several of them (platform, offline, payments, minimum age) change what gets built and are expensive to reverse.

---

## About the design files

Everything in `design/` is a **design reference built in HTML, React 18 (via in-browser Babel) and plain JS**. It is a prototype: it shows the intended look, copy and behaviour. It is **not production code to lift**.

The job is to **recreate these designs in the target codebase**, using its existing framework, component library, routing and data layer. If there is no codebase yet, pick the framework that suits the product (a React or React Native app with a real API behind it is the obvious fit) and build the designs there.

Two things in the prototype that must not survive into production:

- **All state lives in `localStorage`** under `landit.v2` (rider) and `landit.admin.lib` (staff edits). This is a stand-in for a real backend.
- **The rider list in the admin portal is mock data** in `landit-admin.jsx`. Only the locally signed-in rider is real.

Open `design/Land It.html` in a browser to use the prototype. Nothing needs to be installed.

**The prototype predates the name.** The product was called **Land It** until 2026-08-17, when the
owner renamed it **Land The Trick** to match the domain. Everything in `design/` is frozen as it was
shipped, so its filenames, its wordmark and its copy all still read "Land It" — including
`Land It.html` and `Land It - Avatars.html`, which are referenced by those names throughout this
document and the plan. The design is the contract; the name in it is not. Where this README describes
the *product*, it says Land The Trick; where it names a *file*, it says what the file is called.

---

## Step 0: decide the stack before writing anything

**Do this first.** Nothing else in this document should be started until these decisions are made and written down. Several of them are hard to reverse later, and a few of them change what the screens can do at all.

Work through them with the team, record the answers at the bottom of this section, then build.

### 1. What is Land The Trick, as software?

The single decision everything else hangs off.

| Option | Argues for it | Argues against it |
| --- | --- | --- |
| **Responsive web app (PWA)** | One codebase, no app stores, instant updates, links open straight to a profile or an invite. Riders are teenagers with mixed devices. | No store presence, weaker offline story, no push on some platforms, camera and file handling are clumsier. |
| **React Native / Expo** | Real app, real camera, real push, real offline, one codebase for both stores. Clip capture becomes a first-class feature. | Store review, release cycles, and a marketing site to build anyway. |
| **Native iOS + Android** | Best possible camera, video and offline behaviour. | Two codebases for a small team. Hard to justify at this stage. |

**Recommendation:** Expo (React Native) for the rider app, with a small marketing and legal site on the web. The product's two strongest features, filming attempts and using it at a park with no signal, are both weak in a browser. If the team is web-only, a PWA is a defensible start, but decide it now rather than drifting into it.

### 2. Offline behaviour

Riders open this at a skate park with no signal. Pick a level:

- **None.** Needs a connection. Simplest, and wrong for this product.
- **Read-only cache.** The library and their tracked list are readable offline, logging needs signal.
- **Full local-first.** Everything works offline and syncs later. Needs conflict resolution and a local database.

**Recommendation:** local-first from day one. Retrofitting it is painful. Use a local database with sync (WatermelonDB, or a hosted local-first backend) rather than hand-rolling a queue.

### 3. Backend and data

- **Backend-as-a-service** (Supabase, Firebase). Auth, database, storage, row-level security and realtime out of the box. Fastest route to a working product with a small team.
- **Custom API** (Node/TypeScript, Rails, Go). Full control, more work, more sensible once there is real scale or unusual logic.

**Recommendation:** Supabase. Postgres suits this data, which is relational: tricks, prerequisite edges and a log of stage changes. Row-level security maps neatly onto the three-way profile privacy setting, and storage covers clips.

Whatever is chosen, settle the trick library schema early. It is the spine of the product: 61 records with prerequisite edges, difficulty tiers and per-record free/paid flags, all editable by staff.

### 4. Auth, and the under-16 problem

Riders are children. This decision carries legal weight and must be made before any account code is written.

- What is the minimum age for a solo account? The prototype says 13.
- How does parental consent work below that? A Crew Pass held by an adult is the prototype's answer, but it needs a real consent flow.
- Which regimes apply: UK Age Appropriate Design Code, GDPR, COPPA if there are US riders?
- Email and password, magic links, or social sign-in? Social sign-in with children carries its own consent questions.

**Get this in front of a lawyer before build, not before launch.** The safeguarding page in the design makes promises the implementation has to keep.

### 5. Clip storage and video

Clips are the main paid feature and the most expensive thing here.

- Where do they live: S3, R2, Supabase Storage?
- Is there transcoding, or are originals served as-is? Phone video is large.
- What are the retention and deletion rules, and how do they interact with account deletion?
- Are clips ever shareable outside the app? The privacy policy currently says they are never public.

Decide a cost ceiling per rider before offering unlimited clip saving.

### 6. Maps

The prototype embeds one Google Map at a time because plotting every spot needs a key.

- **Google Maps Platform.** Best data and directions, per-request billing.
- **Mapbox.** Nicer styling, generous free tier, can be made to match the design language.
- **Leaflet with OpenStreetMap.** Free, self-hostable, more work.

**Recommendation:** Mapbox. The design has a strong visual identity and Google's default map fights it. Store spot coordinates as plain lat and lng either way so this stays swappable.

### 7. Payments

Three plans, monthly and yearly, with a five-rider family tier.

- Web-only would use Stripe directly. Cheapest and simplest.
- Native apps must use in-app purchase for digital subscriptions, which means store commission and a different receipt model. **This is a second reason the platform decision comes first.**
- The Crew Pass covering five riders needs a proper seat and billing model, not a copied subscription.

### 8. Staff portal

The admin work in the design is substantial: riders, plans, the trick library, stickers, spots, events, challenge scheduling and announcements.

- Build it as a separate internal web app. Recommended: different users, different security, different release cadence.
- Or ship it inside the rider app behind a role check, as the prototype does.

Either way, add an audit log. Staff can change what riders see and what they have paid for, and there is currently no record of who changed what.

### 9. Analytics and error reporting

Pick these now so instrumentation goes in as screens are built, not after. Given the audience, choose a privacy-respecting option and honour the cookie policy: no advertising identifiers, no cross-site tracking.

### 10. Anything with a deadline

- Do events or spots need a third-party feed, or is staff entry enough to start?
- Is there a launch date tied to a season or a comp?
- How many riders should the first release hold?

### Record the decisions here

| Decision | Chosen | Who decided | Date |
| --- | --- | --- | --- |
| Platform |  |  |  |
| Offline level |  |  |  |
| Backend |  |  |  |
| Auth and minimum age |  |  |  |
| Clip storage |  |  |  |
| Maps provider |  |  |  |
| Payments |  |  |  |
| Staff portal placement |  |  |  |
| Analytics |  |  |  |

---

## Fidelity

**High fidelity.** Colours, typography, spacing, borders, shadows, copy and interaction states are all final and intentional. Recreate them faithfully. The visual language is deliberately loud: heavy black keylines, hard offset shadows, no soft corners, no gradients.

---

## Design tokens

### Colour

| Token | Hex | Use |
| --- | --- | --- |
| `--ink` | `#12100B` | Text, every border, dark surfaces |
| `--ink-2` | `#3A352C` | Body copy on light surfaces |
| `--ink-3` | `#6E665A` | Muted labels, meta text |
| `--paper` | `#FFFDF5` | Card surface |
| `--paper-2` | `#FFF7E4` | Secondary card surface, table headers |
| `--wash` | `#F2ECDC` | Page background (with dot pattern) |
| `--pink` | `#FF3D78` | Accent |
| `--orange` | `#FF5A1F` | Primary button, scooter sport colour, Street category |
| `--yellow` | `#FFC23F` | Brand accent, streak, highlight rows |
| `--lime` | `#9CE05B` | Progress fill, landed state |
| `--green` | `#10A06A` | Success, "Every time" stage, Flat category |
| `--mint` | `#2EC4B6` | "Most times" stage |
| `--sky` | `#3AC0FF` | "Sometimes" stage, info toasts |
| `--blue` | `#246BFF` | Skate sport colour, Park category |
| `--violet` | `#8A3BE0` | Paywall, staff/admin, Hybrid category |
| `--red` | `#E0392B` | Destructive actions, errors, Air category |

Page background pattern: `radial-gradient(rgba(18,16,11,.07) 1.1px, transparent 1.1px)` at `14px 14px`.

### Typography

Three Google Fonts:

- **Anton** (`--fd`) — display. Uppercase, `letter-spacing: .01em`, `line-height: .92`. Every heading and every large number.
- **Barlow Condensed** (`--fc`) — labels and UI chrome. Weights 500/600/700.
  - `.lab` — 11px, 700, uppercase, `letter-spacing: .16em`
  - `.cond` — 600, uppercase, `letter-spacing: .06em`
  - `.eyebrow` — 12px, 700, uppercase, `letter-spacing: .22em`, colour `--ink-3`
- **Archivo** (`--fb`) — body copy. Weights 400–700. Base size 14.5–16px, `line-height: 1.45–1.55`.

Never below 13px for body copy. Labels bottom out at 9.5px and are always uppercase and letter-spaced.

### Structure

- Borders: `3px solid var(--ink)` for panels, `2.5px` for nested elements, `2px` for dividers (`--wash`).
- Shadows: `--sh` = `5px 5px 0 var(--ink)`, `--sh-sm` = `3px 3px 0 var(--ink)`. Hard offsets only, never blurred.
- Border radius: **0 everywhere**, except avatars and stage dots, which are full circles.
- Max content width: 1180px, 18px side padding.
- Button press: `translate(2px,2px)` with the shadow dropping to `1px 1px`. Hover lifts `-1px,-1px` and grows the shadow.

---

## Data model

### Trick

```
{ id, name, sport: "scooter"|"skate", cat: "flat"|"street"|"park"|"hybrid"|"air",
  diff: 1..5, pre: [trickId], about, tips, fact, free?: boolean }
```

61 tricks: 30 scooter, 31 skate. `pre` never crosses sports. `free` is a staff override; when absent, a trick is free if `diff <= FREE_MAX_DIFF` (currently 2).

Difficulty tiers are named: **Rookie, Easy, Spicy, Gnarly, Pro**.

### Stages

Five, in order: `want` (Want to learn), `trying` (Learning), `some` (Sometimes), `most` (Most times), `every` (Every time). A trick counts as **landed** at `some` or above.

### Rider state

```
{ signedIn, name, plan: "rookie"|"shredder"|"crew", onboarded,
  sports: ["scooter"|"skate"], view: currently selected sport,
  stance: "regular"|"goofy"|"switch"|null,
  privacy: "public"|"members"|"private",
  goal, goalCustom, level, avatar,
  byId: { trickId: stage },
  log: [{ id, stage, at: epochMs, est?: true }],
  clips: [{ trick, src, kind, date }],
  notes: { trickId: string },
  streak, days, lastRide, crew,
  challengeLogged: { challengeId: count },
  eventsGoing: [eventId], seenNotices: [noticeId], submittedSpots: []
}
```

`log` is append-only and drives every date in the app. `est: true` marks entries backfilled for riders who tracked tricks before dates were recorded — the UI says so rather than pretending.

### Other records

- **Sticker** — `{ id, name, sport|null, hue, ico, cond, n?, rule(stats, sticker), off? }`. `n` is an editable threshold; sport-specific stickers are judged against that sport's stats alone, shared ones against the rider's combined stats.
- **Challenge** — `{ id, sport, week, title, blurb, starts, ends, goal, reward, hue, riders, verb }`. Dates decide state: `upcoming`, `live`, `past`. One live challenge per sport.
- **Spot** — `{ name, town, type, dist, lat, lng, sports[], tags[] }`.
- **Event** — `{ id, name, kind: "Comp"|"Session"|"Class"|"Jam", town, venue, date, sports[], level, price, spots, blurb }`.
- **Plan** — `{ id, name, price, per, hue, pitch, perks[], missing[], popular? }`.

---

## Screens

### Signed out

**Landing** — Dark top bar with wordmark and Sign in. Hero: violet tag, three-line Anton headline at `clamp(42px,7.6vw,80px)` with "Proven." in yellow with a `4px 4px 0` ink shadow, body paragraph, two buttons. Right: four sample trick cards on a 2×2 grid, rotated ±1.8°. Below: four feature cards. Then the full site footer.

**Auth** — Centred 430px card on solid ink, with an `8px 8px 0 var(--yellow)` shadow. Sign up asks name, email, password; sign in drops the name. Inline validation on submit only: name ≥ 2 chars, email regex, password ≥ 6. Errors in `--red`, uppercase Barlow Condensed.

**Onboarding** — Four steps with a segmented progress bar.
1. **What you ride** — two large sport cards, multi-select, at least one required. Below, a stance question (Regular / Goofy / Both), skippable.
2. **Where you're at** — avatar picker strip plus four riding-level cards.
3. **What you're after** — goal pills filtered by chosen sports, plus "+ Something else" revealing a 60-character free-text field.
4. **First few tricks** — a grid of suggested tricks, tap once for learning, twice for landed. Only free-tier tricks appear.

### Signed in

**Home** — Optional staff announcement banner at the top. Sport tabs. Two-column hero: greeting with the rider's first name, a summary sentence, four stat blocks (Landed / Learning / Want to / Stickers), and a library progress bar. Right column: streak card on ink with a seven-day strip and a "I rode today" button that turns green once tapped, plus the live challenge card in the challenge's own colour. Then Working on it (or Start here), an optional wish list, and two-up Stickers and Your crew. Crew rows are buttons that open profiles.

**Tricks (library)** — Sport tabs, search, and a sticky filter column (category, difficulty tier, my status, sort). Rookie riders get a violet banner above the grid explaining what's locked. Trick cards carry a folded corner in the category colour, name, category tag, difficulty bars, sport chip, and a footer strip in the current stage's colour. Locked cards use a diagonal hatch, a violet "Gnarly/Pro" flag and a "Shredder plan" footer.

**Trick detail** — Header band in the category colour with the category tag, sport chip, name in white with a 3px ink shadow, and difficulty on the right. Two columns: photo placeholder, the lowdown, a "What you need" kit row, tips, and a fun-fact block with a 7px left rule. Right: stage picker (five buttons), first-landed date with a Share button, clips panel (locked to a Shredder upsell on the free plan), session notes, and prerequisite/unlock pills.

**Locked trick** — Same page furniture, hatched header, name in `--ink-3`, and a violet lock block explaining the tier with See plans / Back, plus free prerequisite tricks listed underneath.

**Progress** — Sport tabs. Two panels: by category (bars) and by stage (counts). "Over time": a six-month bar chart of tricks landed, latest lands with dates, and an honest note about estimated dates. Then the skill tree — one branch per category, tricks laid out in dependency stages; nodes are green when landed, hatched-dashed when prerequisites are missing, hatched-violet when behind the paywall. Ends with a printable-sheets panel.

**Stickers** — Sport tabs (sport stickers plus shared ones). Count headline, progress bar, then the wall: circular die-cut badges drawn in SVG on a solid ink panel, earned ones in colour, locked ones with a padlock. Tapping one opens a detail modal with a Share button.

**Crew** — Board of six riders sorted by landed, each row a button into that rider's profile, with sport chips and streak/landed columns. "Just happened" feed with clickable names. "Invite a mate" opens the invite share (below).

**Rider profile** — Public view of any rider. Ink header with avatar, name, handle, town, stance and sport chips, plus a privacy chip. Four stat cells. A "Viewing as: signed-in rider / signed-out visitor" toggle that demonstrates the gating. Then what they've landed (with dates for your own), stickers and crew. Private or gated profiles show a lock state instead.

**Challenge** — Sport tabs. Live challenge card with a state tag, date range, title, brief, progress bar and a log button that only works while live. A row pointing at the other sport's challenge. "Coming up" cards for scheduled weeks. "Past weeks" with per-week results, blurred behind an upgrade prompt on the free plan.

**Events** — Sport tabs, type filters, and a list where each row has a coloured date block, type tag, sport chips, venue line, price, places, Details and "I'm going". Details opens a modal.

**Spots** — Sport tabs equivalent (a "Good for X" toggle), search, spot cards with tags and sport chips, and a sticky map panel: a Google Maps embed iframe that recentres on the selected spot, with an "Open in Maps" link. Riders can submit a spot, pasting a Maps link or a coordinate pair, and it goes into a review queue.

**Plans** — Three plan cards, monthly/yearly toggle, the middle one raised and tagged "Most riders". Perks with filled ticks, excluded items struck through at 45% opacity. FAQ grid below.

**Profile** — Ink header with a large avatar (tap to change), name, handle, level, stance and plan tag, over a five-cell stat strip. Then: picture picker, what you ride, riding goal (with the custom field), stance, riding level, who can see your profile (three radio cards), coach/parent view, staff portal entry, and account actions.

**Coach view** — Read-only. Five summary cells, a "currently working on" list flagging difficulty-5 tricks for supervision, and a safety note.

**Legal** — Sidebar of five documents (privacy, terms, safeguarding, cookies, about) with the body on the right. Reachable signed in or out. Marked "draft copy, pending legal review".

### Admin portal

Reached from the footer's "Staff" link or the Profile panel. Gate takes a staff email and passcode (prototype: `miles@landit.app` / `ramp`), held in `sessionStorage`. Nine tabs:

1. **Overview** — rider count, paying count, MRR, tricks live, spots live; riders by plan and by sport; a "needs a human" list.
2. **Riders** — search and plan filter, table with sports, landed, joined, last active, a plan-override select and an Open button. Open shows a rider sheet with their tracked list, stages, dates, plan override and suspend.
3. **Trick library** — per sport, search, add a trick, edit any trick, toggle it between the free and paid tier, and remove it (red).
4. **Stickers** — edit name, condition copy, threshold and colour; toggle a sticker live or hidden.
5. **Spots** — review queue with approve/reject, live spots with edit and remove (red), and a form to add one.
6. **Events** — table with edit and delete, plus scheduling new events.
7. **Challenges** — per sport, filter by live/scheduled/finished, a live-week card, and a table with start and end dates. Add, edit, delete.
8. **Announcements** — composer (title, body, label, audience, colour) posting a dismissible banner to riders' dashboards, with a list of live notices and a Pull button.
9. **Plans** — edit each plan's name, price, billing period, pitch, perks and crossed-out items.

Every staff edit writes to `localStorage` and is replayed over the data arrays on load. In production these become API calls.

---

## Interactions and behaviour

- **Sport switching** is global state, not per page. Switching on any page switches everywhere. Tabs only appear when a rider does both sports.
- **Stage changes** append to `log` and fire a toast in the stage's colour. Removing a stage removes that trick's log entries.
- **Stickers** are evaluated on every state change; newly earned ones fire a toast. The app tracks which were already seen so it never re-announces.
- **Toasts** slide up from the bottom centre, dark with a paper border and a colour chip, and clear after 3.2 seconds.
- **Modals** fade a 72%-opacity ink scrim in over 200ms; the panel rises 26px and scales from .96 over 250ms on `cubic-bezier(.2,1.3,.4,1)`. Escape closes.
- **Stickers unlocking** use a `pop` keyframe: scale .3 and rotate −25° up to a 1.12 overshoot.
- **Share** — trick and sticker share cards render a preview and copy a caption. The crew invite draws a 1080×1080 PNG on a canvas and passes it to `navigator.share({ files })`, falling back to sharing text and URL, then to copying the link.
- **Paywall** — free riders cannot open, track or film paid tricks, and cannot save clips at all. Locked tricks stay visible throughout, never hidden.
- **Responsive** — below 860px the nav becomes a five-item fixed bottom bar, filters collapse behind a toggle, and two-column layouts stack. Below 520px trick cards go two-up.

---

## What needs building for real

The prototype fakes these, deliberately:

1. **Auth and accounts** — real sign-up, password reset, under-16 parental consent.
2. **Persistence** — everything in `localStorage` becomes a real API. The rider state object above is a reasonable schema starting point.
3. **Crews** — creating a crew, invites and membership. Currently one demo crew you can join.
4. **Clip storage** — clips are `URL.createObjectURL` blobs that die on refresh. Needs real upload, transcode and CDN.
5. **The map** — the embed shows one spot at a time. Plotting every spot needs a Maps API key, or a switch to Mapbox/Leaflet.
6. **Streaks** — currently a counter incremented by a button. Needs real date logic, timezone handling and a grace period decision.
7. **Payments** — plan changes are instant and free.
8. **Moderation** — spot submissions have a queue but no reporting flow for profiles or clips, which the safeguarding page promises.
9. **Offline** — riders use this at a park with no signal. Worth deciding early.

## Assets

- **Avatars** — 36 PNGs in `design/avatars/`, AI-generated then sliced from two source sheets. Circular, flat pastel backgrounds, black ink side profiles, all facing the same way. Registered in `landit-avatars.js` with an id, display name, group (Lids / Heads / Kit) and background hue. `Land It - Avatars.html` documents the set and the rules for adding more.
- **Icons** — inline SVG paths in the `I` map in `landit-ui.jsx`, drawn on a 24px grid, `stroke-width` 2.2, round caps and joins.
- **Stickers** — drawn entirely in SVG at render time in `StickerBadge`. No image assets.
- **Photography** — none. Every image slot is a hatched placeholder with a monospace label saying what belongs there. These need real photography before launch.
- **Fonts** — Anton, Barlow Condensed and Archivo from Google Fonts.

---

## Screenshots

`screenshots/` holds a capture of every screen, numbered in the order a rider meets them, then the staff portal. Note that the Spots map renders as an empty panel in the capture: the live map is an iframe and does not survive screenshotting.

| File | Screen |
| --- | --- |
| 01-landing | Signed-out landing page |
| 02-landing-footer | Feature cards and site footer |
| 03-legal-privacy | Legal document view |
| 04-signup | Sign up, with validation |
| 05-onboarding-sport | Onboarding step 1: what you ride, and stance |
| 06-home | Dashboard, rider on both sports |
| 08-library | Trick library with filters and a locked-tier banner |
| 09-trick-detail | Trick page: stages, kit, tips, notes, prerequisites |
| 10-trick-locked | Locked trick, free plan |
| 11-progress | Progress: by category and by stage |
| 12-progress-overtime | Landed over time |
| 13-skill-tree | Skill tree with prerequisite and paywall locks |
| 14-stickers | Sticker wall |
| 15-crew | Crew board and activity feed |
| 16-rider-profile | Another rider's public profile |
| 17-challenge | Weekly challenge, live and upcoming |
| 18-events | Events list |
| 19-spots | Spot finder |
| 20-plans | Plans and pricing |
| 21-profile | Profile header and picture picker |
| 22-profile-goal-stance | Riding goal, stance, level |
| 23-profile-privacy | Privacy setting and account actions |
| 24-coach-view | Coach / parent read-only view |
| 25-admin-overview | Staff portal: overview |
| 26-admin-riders | Riders, with plan override |
| 27-admin-rider-sheet | One rider's detail sheet |
| 28-admin-trick-library | Trick library editing, free/paid toggle |
| 29-admin-challenges | Challenge scheduling |
| 30-admin-announcements | Announcements composer |
| 31-admin-spots | Spot queue and live spots |

---

## Files

| File | Contains |
| --- | --- |
| `Land It.html` | Shell, every CSS token and class, script loading order |
| `landit-data.js` | Tricks, sports, categories, stages, stickers, plans, crew, spots, challenges, events, privacy, stances |
| `landit-avatars.js` | The 36 built-in avatars |
| `landit-ui.jsx` | Shared primitives, icons, sport scoping, stats, sticker evaluation, share card, store and migrations |
| `landit-legal.jsx` | Site footer and the five legal documents |
| `landit-auth.jsx` | Landing, sign in/up, onboarding, goals and levels |
| `landit-screens-a.jsx` | Home, library, trick detail, locked trick |
| `landit-screens-b.jsx` | Progress, sticker wall, crew, challenge, spots |
| `landit-screens-c.jsx` | Plans, profile, coach view |
| `landit-screens-d.jsx` | Events, rider profile, crew invite |
| `landit-admin.jsx` | The whole staff portal |
| `landit-app.jsx` | App shell, routing, state and actions |
| `Land It - Avatars.html` | Avatar set documentation |
