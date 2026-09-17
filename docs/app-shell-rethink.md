# App shell rethink — the spec the build sessions work from

**Status:** design agreed with the owner in chat, 2026-09-15 and 2026-09-16, on the design canvas
<https://claude.ai/artifact/MW331uq9Ybh5sbXfnEcW4J> (pages 1–4: the shape, the pieces, every
mobile screen today and proposed, every desktop screen today and proposed). This document is the
build contract derived from that canvas. Where the two disagree, this document wins, because it
was written after the canvas and records the decisions the canvas only illustrates. Where this
document is silent, the canvas is the reference. Tasks T45–T52 in `docs/implementation-plan.md` §7
build it.

**One rule above all the others.** The mockups on the canvas are HTML approximations drawn in an
environment that could not load the product's fonts. **Nothing is built from the mockups' CSS.**
Everything is built from `packages/ui-web` — its tokens, its components, its stylesheet — and new
UI extends that vocabulary: 3px ink keylines, hard offset shadows (`--sh`, `--sh-sm`), zero border
radius, Anton / Barlow Condensed / Archivo, the fixed-fill colours. A session that finds itself
writing a new colour, a new shadow or a new radius has left the design system and stops.

---

## 1. Decisions, with provenance

All by Rachid, in chat, on the dates given.

| # | Decision | Date |
| --- | --- | --- |
| D1 | The phone's bottom bar is five cells: **Home · Tricks · LOG · Find · Crew**, LOG raised and yellow in the middle (shape A; B and C rejected). | 2026-09-15 |
| D2 | **Find opens on a summary page** ("For you"), with Spots and Events as tabs of one row, not a drawer. | 2026-09-15 |
| D3 | **LOG opens a sheet with four actions**: I rode today, Log a trick, Log a session, Add a clip link. | 2026-09-15 |
| D4 | **The bell ("What's new") has two tabs**: You, and one per crew. In-app only; push notifications are out of scope. | 2026-09-15 |
| D5 | **The sport is chosen once**, in a top-bar chip that carries the sport's icon *and name*. The top bar's bottom rule takes the sport colour. Every in-page sport tab row goes. Lists that used to carry their own sport row follow the chip through one dropdown (O1 below). | 2026-09-15 |
| D6 | Every tab row is a row of separate boxes with the 3px keyline and the hard offset shadow; the active tab lifts to a 4px offset in yellow (the `.sporttab` treatment). Pills keep their keyline-only look because they filter rather than navigate. | 2026-09-15 |
| D7 | **Trick page: layout A** — the sticker and the video share one row directly under the name, then the stage ladder, then the sections. With no video the sticker card takes the row alone. | 2026-09-16 |
| D8 | **Desktop follows the same four groups in its top nav** (Home · Tricks · Find · Crew) with the sport chip, Log and the bell beside them. Progress, Sessions, Stickers and Challenge are reached from the Home cards; Plans and the rest from the avatar menu. Every desktop page gets the pass, not only the five with a new shape. | 2026-09-16 |
| D9 | The streak chip leaves the top bar at every width. It never showed below 520px; the streak is on Home and in What's new. | 2026-09-16 |

**O1, decided 2026-09-16 (Rachid, in chat).** The sport scope on a list is a **dropdown**, not a
toggle: the options are "Your sport (Scooter)", "All sports" and one entry per other sport. The
default follows the quality of the data: **Spots opens on Every spot** (spot sport tags are thin;
about 210 of 3,463 carry BMX, and the 2026-09-12 decision to show every spot stands), **Events opens
on your sport** (74 staff-tagged events). Sessions and the glossary open on your sport. See
`SportScopeSelect`, §3.3.

**O2, decided 2026-09-16 (Rachid, in chat).** The build runs from a fresh orchestrator session on
the owner's laptop, not in the cloud, so the combined branch can be run on localhost and looked at.
See §9.

**Branching, decided 2026-09-16 (Rachid, in chat).** All eight task PRs target an integration
branch, **`shell-rethink`**, cut from `main`. The owner reviews the whole rethink on that branch
(a draft PR `shell-rethink → main`, opened at the start, gives one place to comment and a preview
deploy). The orchestrator has standing permission to **raise and merge each task PR into
`shell-rethink` when its checks are green**, and merges `main` into `shell-rethink` after each wave
so the final merge stays small. The PR from `shell-rethink` to `main` is asked for separately, as
CLAUDE.md step 8 requires, and merging it is still not shipping.

---

## 2. Information architecture

### 2.1 Groups

Nine destinations become four groups plus the things that are yours, at every width.

| Group | Lands on | Holds | Reached from |
| --- | --- | --- | --- |
| **Home** `/home` | the dashboard | Progress `/progress`, Sessions `/progress/sessions`, Stickers `/stickers`, Challenge `/challenge` — four **record cards** on Home; each of those screens shows a **Home** back link and keeps the Home cell / nav item lit | bar, nav |
| **Tricks** `/library` | the library | the trick page `/library/[slug]`, the glossary `/glossary` | bar, nav |
| **LOG** (phone) / **Log** (desktop) | a **sheet** (phone) or **modal** (desktop), never a page | I rode today · Log a trick · Log a session · Add a clip link | the middle cell / the yellow button beside the chip |
| **Find** `/find` (new route) | the **For you** summary | Spots `/spots`, Events `/events`, the archive `/events/past`, your events `/events/mine` (folded into For you as "You're going") — one row of tabs on all of them | bar, nav |
| **Crew** `/crew` | the crew | rider profiles `/riders/[handle]`, invites `/join/[code]` | bar, nav |
| **Avatar menu** | — | Your account, Coach / parent view, Plans and pricing, Tell us an idea, Report something, (staff) Admin portal, Sign out — unchanged | top bar |
| **Sport chip** | a sheet (phone) / dropdown (desktop) | the sports the rider tracks; a sport they do not track is shown greyed and points at Account | top bar |
| **Bell** | `/whats-new` page (phone) / dropdown (desktop) | tabs: You · one per crew | top bar |

**The covers-everything test is asked of a written-out list, not of `TOP_NAV`** *(added by the T45
worker, 2026-09-16, pending owner confirmation)*. The old test asserted that every `TOP_NAV` entry
was reachable from `MOBILE_NAV` plus the account menu. With both bars the same four groups that
check passes trivially and proves nothing. So `nav.ts` exports `DESTINATIONS` — everywhere in the
rider app a rider can go, written out by hand — and the test asserts each one is a group, something a
group `reaches`, an account-menu row, or `BELL_DESTINATION`. `/whats-new` is the bell's and is
therefore *not* in any group's `reaches`: putting it there would light a cell on a screen §2.2 says
lights nothing.

`nav.ts` keeps its shape (`TOP_NAV`, `MOBILE_NAV`, `ACCOUNT_MENU`, `reaches`, `alsoActiveFor`,
`isNavActive`) and the test that every destination is still reachable. What changes: `TOP_NAV`
becomes the same four groups as `MOBILE_NAV`; the `tabs` / `SectionDrawer` mechanism is removed;
`reaches` on Home lists the four record screens, on Tricks the glossary, on Find `/spots`,
`/events`, `/events/past`, `/events/mine`, on Crew `/riders`, `/join`. `/whats-new`, `/find` and
the sessions routes are added to the reach lists so the covers-everything test still holds.

### 2.2 Which cell stays lit

The group's cell stays lit for every screen the group reaches. A rider on `/progress` sees Home
lit; on `/spots/[slug]` sees Find lit; on `/riders/zara` sees Crew lit. `/account`, `/plans`,
`/coach`, `/suggest`, `/report`, `/whats-new` light nothing, as `/account` does today.

### 2.3 Back links

A screen reached from a Home card carries a **Home** back link at the top (`BackLink`, §3). A
trick page carries "All tricks"; a spot page "Spots"; a rider profile "Crew"; the account
sub-screens (phone) "Your account". Back links are ordinary links to the parent route, not
`history.back()`, so a deep link still has somewhere to go.

---

## 3. Components

Each entry: where it lives, what it is for, anatomy, states, tokens, motion, accessibility, and
the analytics it fires. **Additive-only applies**: nothing here changes an existing export's
signature or behaviour in `packages/ui-web`; new components are new exports, and a change to an
existing component is a new prop with the old behaviour as its default.

### 3.1 Shell

**`TopBar`** (`apps/web/src/components/shell/TopBar.tsx`, changed)
- Anatomy, left to right: wordmark → nav (desktop only, four items, `.nav a` unchanged) → right group: `SportChip`, `LogButton` (desktop only), `BellButton`, `AccountMenu`.
- The `.topbar` bottom rule (`border-bottom: 3px solid`) takes the **current sport's colour** (`SPORTS[id].color`) via a CSS variable set on `.topbar` from `useSport()`. Everywhere else the bar is unchanged.
- The streak chip is removed (D9). `.streakchip` CSS stays until nothing uses it, then goes in the same PR.
- Widths: the four-item nav fits at 960px at full size (measured on the canvas with a wider fallback font, so the real bar has more room). `e2e/shell.spec.ts` keeps its overflow assertion at 861px and 375px and adds one at 960px and 1280px.

**`MobileNav`** (`apps/web/src/components/shell/MobileNav.tsx`, changed)
- Five cells, `repeat(5, 1fr)`, as today. Cells 1, 2, 4, 5 are links as today. Cell 3 is **`LogCell`**: a 58×58 yellow square (`--yellow`, `3px` keyline, `--sh-sm`) holding a 30px plus, raised 30px above the bar (`margin-top: -30px`), with the label LOG in yellow beneath like the other labels. It is a `button`, not a link; it opens `LogSheet`.
- The `SectionDrawer`, its CSS module, `tabs` on `NavItem`, `useCompactViewport` and the `nav_section_opened` event go. The `MobileNav` tests that exercised the drawer go with them; the covers-everything test stays.
- Fires `nav_clicked` `{ to, where: 'mobile' }` as today; the LOG cell fires `log_sheet_opened` `{ where: 'mobile' }`.

**Signed out, the LOG cell is a link to `/signin`** *(added by the T45 worker, 2026-09-16, pending
owner confirmation)*. `AppShell` hands `MobileNav` a `signedIn` flag, decided from the same `rider`
the top bar already uses to hide the chip, the Log button and the bell. With no rider the middle
cell keeps its square and its label and becomes a link ("Sign in to log something"); the bar stays
five cells, because `.mobnav` is `repeat(5, 1fr)` and a four-cell bar on the signed-out screens
beside a five-cell one on the signed-in ones would be two bars to learn. Drawn as a button it was
the loudest control on `/spots`, `/events` and `/library` for somebody it could do nothing for: "I
rode today" bounced them to `/signin` with no explanation, and both trick pickers came back empty,
because `trickPickerAction` answers a session-less call with nothing. A link says where it goes
before it is pressed, which is the honest version of the same invitation.

**The chip's name is on at every width** *(added by the T45 worker, 2026-09-16, pending owner
confirmation)*. The first cut hid it below 520px to buy room, which reversed D5 on the one device
the rethink is for — a rider who has never opened the sheet was left decoding a 20px glyph.
Two things pay for it, and **both are in the code now** rather than held in reserve. Below 520px the
chip's type tightens (12px, less tracking, 7px of side padding), which buys about 14px. Below 400px
**the wordmark shrinks** — 42px of art to 32px, with the bar's gaps and side padding tightened with
it — because measured at 320px with the name on, the bar was 30px over and the whole document
scrolled sideways. The order is a decision rather than an arithmetic: the mark is the one thing on
the bar that tells a rider nothing they do not already know, and the chip's word is the only thing
that says which library they are looking at, so the mark takes the cut. It already does the same in
the 861–1100px band for the same reason.

**The bell reads "What's new" at zero unread** *(added by the T45 worker, 2026-09-16, pending owner
confirmation)*. §3.1's `aria-label` is "What's new, 3 unread."; at zero the count is dropped rather
than read as "0 unread", which is a sentence about nothing. The count comes back the moment there is
one (T47).

**`SportChip`** (new switcher, `apps/web/src/components/shell/SportChip.tsx`; the existing display-only `SportChip` in `packages/ui-web/src/components/nav.tsx` is **not** touched — the new one is named `SportSwitchChip` to avoid the collision)
- A 34px-tall button in the top bar: sport icon (20px) + the sport's short name (`SPORTS[id].short`: Scooter / Skate / BMX), Barlow Condensed 700 13px 0.09em uppercase, filled with the sport colour, 2.5px paper keyline like `.avatarbtn`. Ink text on the fill (`--on-light`).
- Hidden when the rider tracks one sport, as the tab row is today ("nothing below two").
- Opens `SportSheet` (phone) or `SportMenu` (desktop), both listing the sports the rider tracks with landed / learning counts, the current one filled and ticked, and any sport not tracked greyed with "Add it in your account" linking to `/account`.
- Choosing a sport calls `setSport` from `providers/sport.tsx` (unchanged: it is already global and persisted) and fires `sport_switched` `{ sport, from, where: 'chip' }` — the existing event with one new property.
- `aria-label`: "Riding: Scooter. Switch sport."

**`LogButton`** (desktop, in `TopBar`) — a 34px-tall yellow button, plus + "Log", same type as the chip. Opens `LogSheet` as a `Modal`. Fires `log_sheet_opened` `{ where: 'top' }`.

**`BellButton`** — a 34px square (`.tb-btn` look: `--ink-raise` fill, paper keyline) with the bell icon and, when the unseen count is above zero, a pink count badge (`--pink`, 2px ink keyline, Barlow Condensed 700 11px) at the top-right corner. Phone: a link to `/whats-new`. Desktop: opens `WhatsNewPanel` as a dropdown. `aria-label`: "What's new, 3 unread." Fires `whats_new_opened` `{ where: 'mobile' | 'top', unread }` (a count, not a fact about the rider).

**`AccountMenu`** — unchanged.

### 3.2 Overlays

**`Sheet`** (new, `packages/ui-web/src/components/overlays.tsx`, additive)
- A bottom sheet for phones. Paper surface, 3px ink top keyline, a 44×5 ink handle centred at the top, 16px side padding, `padding-bottom: max(28px, env(safe-area-inset-bottom))`. Sits above `.mobnav` (z-index above 70, below toasts). Scrim `rgba(18,16,11,.55)`.
- Uses `modal-layer.ts` for body scroll lock and focus trapping, as `Modal` does; Escape and a scrim tap close it; drag down more than 80px closes it (pointer events, no library).
- Above 860px the same component renders as `Modal` (one component, one prop: `as="auto"` default picks by the 860px media query; callers can force either).
- Motion: rises from `translateY(100%)` to 0 in **260ms on `cubic-bezier(.2,1.3,.4,1)`** (the modal's existing spring); the scrim fades in over 200ms. Closing is 200ms ease-out with no overshoot. The reduced-motion floor in `additions.css` covers it.

**`Dropdown`** (new, `packages/ui-web`, additive) — the desktop anchor panel used by the bell, the sport chip and (later, if wanted) the avatar. Paper, 3px keyline, `--sh`, anchored under its button's right edge. Opens with an 8px rise and fade over **160ms ease-out**; closes on outside `pointerdown` (the `AccountMenu` pattern, for the same reason it gives) and Escape.

**`Modal`** — unchanged.

### 3.3 Navigation inside a screen

**`TabRow`** (new prop on the existing `Tabs` in `packages/ui-web/src/components/nav.tsx`: `variant="boxed"`; default behaviour unchanged)
- A row of separate boxes, `gap: 8px`, each `flex: 1`, `min-height: 44px`, 3px ink keyline, `--sh-sm`, paper fill, Barlow Condensed 700 13px 0.09em uppercase, optional 16px icon. The active tab: `--yellow` fill and a **4px** offset shadow (the `.sporttab.on` lift).
- Hover: `translate(-1px,-1px)`, 4px shadow (existing `.sporttab:hover`). Press: `translate(2px,2px)`, 1px shadow (existing `.btn:active`).
- Renders as links (`role="tablist"` when the tabs switch content in place; plain `nav` of links when they are routes, as on Find).
- Switching content in place cross-fades the panel over 120ms.
- Fires `tabs_switched` `{ group, tab }` where both are catalogue ids (e.g. `find` / `spots`, `progress` / `over-time`, `whats-new` / `crew`).
- Used by: Find (For you · Spots · Events), Progress (Record · Over time · Skill tree), Stickers (Earned · Not yet), Crew (Board · Activity · Members), Rider profile (Landed · Stickers · Videos), Plans (Monthly · Yearly), Tricks (All · Mine · Filters on the phone; All · Mine on desktop), What's new (You · crews), the session form's three steps.

**`TabRow` is a component in `apps/web`, and it is what fires the event** *(added by the T45 worker,
2026-09-16, pending owner confirmation)*. The paragraph above reads as though `variant="boxed"` is
the whole of it; two of its four bullets cannot live in `packages/ui-web`. So the work is split:

- **`packages/ui-web`** keeps `Tabs variant="boxed"` — the paint. Separate boxes, the 44px floor, the
  yellow 4px lift, the hover and the press.
- **`apps/web/src/components/shell/TabRow.tsx`** is what screens import. It takes a `group` prop and
  **fires `tabs_switched` `{ group, tab }` itself**, so a screen cannot forget one — an event four
  later sessions each have to remember is one that ships half-wired, and there is no autocapture to
  fall back on. It has two forms: items without an `href` render the package's `role="tablist"` of
  buttons, and items **with** an `href` render a plain `nav` of `next/link`s (Find's form). A tab
  that is a page may not be a `role="tab"`: a screen reader told it is a tab expects the panel under
  it to change, not the document.
- **The 120ms cross-fade is the caller's to apply**, because the panel is the caller's — `TabRow`
  draws the row and knows nothing about what is under it. It exports `TAB_PANEL`, a class in the
  shell's module; a screen puts it on the panel and keys the panel on the tab id so React remounts
  it and the fade runs on every switch.

§5's "Fired by: TabRow" therefore means `apps/web/src/components/shell/TabRow.tsx`, not `Tabs`.

**`BackLink`** (new, `apps/web/src/components/shell/BackLink.tsx`) — arrow-left icon + label in `.lab` at 13px, `--ink-3`. A link. Used per §2.3.

**`SportScopeSelect`** (new, `apps/web/src/components/shell/SportScopeSelect.tsx`) — one line under a list's header: a `.lab` label ("Show") and a **styled `<select>`** in the design's select treatment (the Country select on `/events` is the precedent: 3px keyline, `--sh-sm`, Barlow Condensed 700 uppercase). Options: **Your sport (Scooter)** — which tracks the chip, so switching the chip switches the list — then **All sports** (reads "Every spot" on Spots), then one entry per other sport the rider does not currently have selected. Default per O1: Spots → Every spot; Events, Sessions, Glossary → Your sport. Choosing fires `sport_scope_set` `{ screen, scope: 'chip' | 'all' | 'other' }` (never the sport id of an "other" choice beyond the three catalogue ids). The choice is per screen and per device (`localStorage` key `landit.scope.<screen>`), not rider data.

### 3.4 Home

**`LinkCard`** (new, `apps/web/src/app/(app)/home/LinkCard.tsx`) — a coloured card that is a link: `.lab` title with a 18px icon at the right, an Anton number at 30px, a 12.5px `--ink-2` sub-line, an arrow at the bottom-right. 3px keyline, `--sh-sm`, `min-height: 112px`. Press: the button press. Four of them on Home in a `2 × 2` grid below 860px and one `4-up` row above: **Progress** (landed count · learning · want to), **Sessions** (this month · last spot and day; hidden when sessions are not enabled for the rider, as `sessionsEnabled` already decides), **Stickers** (earned · newest), **Challenge** (logged / goal · title · ends). Fires the existing `nav_clicked` `{ to, where: 'home-card' }`.

**Home order** (phone): greeting → streak card → four cards → Working on it (2 tricks, "All N of yours →") → crew activity (3 lines, "Crew →") → Next up (the next event the rider said yes to, "Find →") → Your spots (faves). Desktop: greeting + streak/challenge rail as today, then the 4-up card row, then Working on it 4-up, then crew activity and Next up side by side. The `SportSwitch` row goes from Home; the greeting panel's four stat blocks stay on desktop and go on the phone (the cards carry the numbers there).

**What Home drops to make room, and what the record cards inherit** *(added by the T46 worker,
2026-09-17, pending owner confirmation)*. §3.4's order is a list of what Home holds, and three
things it used to hold are not on it. Each is recorded here rather than left as a silent deletion:

- **The four badge row** (the newest stickers, drawn as art). The Stickers card carries the count
  and the newest one's name, and the wall is one tap behind it. A row of four badges on the
  dashboard was the collection shown twice.
- **"On the wish list"** (a second grid of trick cards). "Want to" is the Progress card's third
  number, and the list itself is `/library?mine=1`. On a phone it was the largest thing on the
  dashboard and the least often acted on.

  **And the route to it is one tap, not two** *(added by the T46 worker after the independent
  review, 2026-09-17)*. The first cut tied the section's "more" link to whether something was **in
  progress**, so a rider with nothing in progress got "Library →" to the *unfiltered* library — and
  that is precisely the rider most likely to have a want-to list, since a want-to is what you have
  instead of something in progress. The heading still follows what is shown ("Working on it" or
  "Start here"); the link now follows what the rider **has**, and reads "All N of yours →" into
  `/library?mine=1` whenever any trick carries a stage at all.
- **The crew board** (a ranked table of names and landed counts). This one is **not** a call the
  worker made: §3.4 puts the crew's *activity* in that slot, so the board's departure is the spec's
  own. It is recorded here because it is the largest visible difference on the screen, not because
  anything is pending on it. The board is still what `/crew` is for.

Two more calls the section is silent on. **"Working on it" and "Start here" both show four cards
on desktop and the first two on a phone**, cut in CSS at 860px rather than sliced — a count
decided in the browser is a count the server guessed differently, and the grid would be rebuilt on
hydration (LESSONS §3a). And **"Your spots" links to `/spots`**, not to `/find`: the faves are
spots, and `/find` is the group's summary rather than the list. "Next up" links to `/find` as §3.4
says.

**"Your spots" is full width beneath the pair on desktop** *(added by the T46 worker, 2026-09-17,
pending owner confirmation)*. §3.4's desktop order stops at "crew activity and Next up side by
side" and does not place the faves. They go under both, across the full width: a third column would
give each of the three about 380px, narrower than the phone's own two-up spot cards, and the faves
are the one of the three that is a **grid** rather than a list — it wants the width more than the
other two want the company.

**Three record cards is the ordinary case** *(added by the T46 worker, 2026-09-17, pending owner
confirmation)*. §3.4 says the Sessions card is hidden unless `sessionsEnabledFor(rider)`, and
sessions are still in owner-only preview (T41) — so nearly every rider sees **three** cards, not
four. The row therefore fills itself rather than holding a four-column track with a hole in it:
above 860px it is `auto-fit`, which collapses the empty track and stretches what is left, and below
it a lone third card spans both columns of the 2 × 2. The Sessions card's two extra reads (the
diary, and the last ride's spot) are made behind the same gate, so a rider who is not shown the
card does not pay for it.

**The desktop keeps both the challenge panel and the Challenge card** *(added by the T46 worker,
2026-09-17, pending owner confirmation)*. §3.4 asks for the "streak/challenge rail as today" on
desktop *and* for a Challenge card in the 4-up row, which means the week appears twice on a wide
screen — once as the coloured panel with its blurb and bar, once as "0/3 · Live scooter week · Ends
Saturday". Built as written, because "as today" is explicit. On a phone only the card is drawn: the
panel is hidden below 860px, where a quarter of the first screenful saying one thing twice is a
real cost. **If the owner would rather the desktop panel went too, that is a one-line change** and
this paragraph is the place it was noticed.

**`VerifyEmailBanner`** becomes a one-line strip (icon, "Confirm your email", "Send again" link, ×) rather than a panel with two buttons. Same cookie, same copy shortened.

**The strip is 50px, and the lock goes at 360px and below** *(added by the T45 worker, 2026-09-16,
pending owner confirmation)*. §3.4 asks for one line and does not give a number, so here is the one the code
produces and why it is a floor rather than a taste. The × and "Send again" are both at §4's 44px
target, the design's 3px keyline takes 3 on each edge, and the strip has no vertical padding at all
— the two controls draw no box of their own, so letting them reach the keylines costs nothing.
44 + 6 = **50px**, against the 159px panel it replaces. It passed through 66px while the controls
were padded rather than sized, and 54px while they were still under the floor; 50 is the first
number that is both one line and reachable by a thumb.

The strip drops two things as it narrows, in this order: the explanatory sentence at 640px and
below, and **the lock square at 360px and below**. With both controls at their 44px targets a 320px
strip has about 130px for the title and "CONFIRM YOUR EMAIL" wants about 140 — measured, it was
being cut to "CONFIRM YOUR E". The lock is `aria-hidden` decoration and the words are the message,
so the square is what goes, and the title tightens with it. 360 rather than 400: measured at 361,
375 and 390 the strip holds the lock, the full title and both controls with room to spare, and a
threshold set where it is not yet needed is a decoration removed for nothing.

### 3.5 Log

**`LogSheet`** (new, `apps/web/src/components/shell/LogSheet.tsx`) — a `Sheet` titled "Log something" with the current sport as a `Tag` at the right, then four **`OptionRow`s** (new, in the same file: 44px icon square with a fixed fill, a Barlow Condensed 16px title, a 13px `--ink-3` line, an arrow; 3px keyline, `--sh-sm`, `min-height: 64px`):
1. **I rode today** (lime tick) — "One tap. Counts a ride for the streak, nothing else." Calls the existing `rodeTodayAction`; on success the sheet closes and the existing toast shows.
2. **Log a trick** (yellow grid) — "One trick, up a stage." Opens the trick picker: the rider's three most recently worked-on tricks on the current sport, then a search field over the library; choosing one goes to `/library/[slug]#ladder` where the existing `StagePicker` is the action.
3. **Log a session** (sky clock) — "A ride: where, how long, how it felt, the tricks you worked on." Opens the existing quick log (`QuickLog`) in the same sheet; "Add tricks, clip and notes" escalates to the full form as today. Shown only when `sessionsEnabled`.
4. **Add a clip link** (dashed keyline, no shadow) — "YouTube or TikTok, onto a trick you have logged." Opens the trick picker limited to landed tricks, then the existing video-link field on the trick page.
- Fires `log_action_picked` `{ action: 'rode' | 'trick' | 'session' | 'clip' }`.

**"Log a session" navigates rather than embedding the quick log** *(added by the T45 worker,
2026-09-16, pending owner confirmation)*. The row goes to `newSessionHref({ quick: true })` — the
existing quick log at its own address, which the sessions layout already intercepts into a modal
from `/progress/sessions`. Rendering `QuickLog` inside the sheet would mean loading its
`SessionFormData` (known spots, the recent-spot list, the stamp) in the shell, on a client, and
re-implementing `SessionFormScreen`'s state machine beside it — a second session form, in the one
component that wraps every screen. It is also T50's territory: that task owns the session form's
three steps and the preset sport tag, and a copy of the form built here would be a copy it then has
to reconcile. The behaviour a rider meets is the same quick log, opened from the same tap; what
changes is that it arrives as a route rather than as a panel inside the sheet. If the owner wants
it truly in-sheet, that is a T50 addition once the form is stepped.

**The counts are fetched on open** *(added by the T45 worker, 2026-09-16, pending owner
confirmation)*. §3.1's landed / learning counts are read by `sportCountsAction`, called when the
sheet or the menu opens and held while it is up — one read of the live tricks and one of the rider's
own `trick_progress`, with their own client, so PocketBase's rules are the gate. Not on every page
render: the chip is in the top bar of every screen, so a count computed there would put two reads on
the dashboard, the library and every trick page to pay for a panel most page views never open. The
rows show nothing where the count has not arrived rather than a zero that then changes — a zero a
rider reads for a frame is a wrong number, not an old one. *(A paragraph here argued for shipping
without the counts; the independent review of 2026-09-16 pointed out that `trickPickerAction` next
door already solves exactly this, and it was right, so the paragraph is gone and the counts are in.)*

**`Sheet` renders into `document.body`** *(added by the T45 worker, 2026-09-16, pending owner
confirmation)*. `Modal` deliberately renders where its caller renders it, and §3.2 said the sheet
sits above `.mobnav`. It cannot, from inside `.topbar`: that element is `position: sticky` with
`z-index: 60` and so makes its own stacking context, which caps everything inside it — measured on a
390px phone, the sport sheet's last row was cut in half by the bottom bar at `z-index: 70`. `Sheet`
therefore portals; `Modal` is untouched.

**"Above `.mobnav`" means the sheet stops at the bar's top edge, and the cross is a state**
*(added by the T45 worker, 2026-09-16, pending owner confirmation)*. §3.2 says the sheet "sits above
`.mobnav`" and §4 says the LOG plus "turns into a cross … so the cell reads as 'close' too". Two
things follow, and only the first was deliverable:

- **The sheet and its scrim both stop where the bar begins** (`63px` plus
  `env(safe-area-inset-bottom)`). The first cut read "above" as a z-index and ran to the bottom
  edge, so the cross rotated *behind* the sheet and nobody ever saw it. The scrim covers everything
  on screen except the bar, so the page behind is still dimmed and a tap anywhere on it is still a
  dismissal.
- **The cross does not close the sheet, and does not claim to.** A sheet is `aria-modal`, and
  `useModalLayer`'s `inertOutside` makes everything outside the dialog `inert` — which is exactly
  what `aria-modal` promises and what stops a rider tabbing into the page behind. An inert subtree
  takes no pointer events, so the cell cannot be pressed while the sheet is up; measured, the click
  lands on `<body>`. The cell therefore keeps `aria-expanded` and its rotation as **state**, and its
  label stays "Log something" rather than offering a close it cannot perform. Escape, the scrim and
  a drag down are the ways out.

Making the cell genuinely pressable would mean teaching `inertOutside` to keep one named element
live. That is shared code another task owns (CLAUDE.md step 5) and it is the same function
[issue #540](https://github.com/lekky/landit/issues/540) is about, so it is flagged rather than
done. If the owner wants the cross to close, that issue is where it lands.

**The scrim's opacity is `.scrim`'s, not a second number** *(added by the T45 worker, 2026-09-16,
pending owner confirmation)*. §3.2 asks for `rgba(18,16,11,.55)`; the sheet reuses the existing
`.scrim` class and therefore its `rgba(18,16,11,.72)`. One scrim in the product beats two that
differ by 17% — a rider who opens a modal and then a sheet should not meet two depths of the same
grey — and the design pack has one. Read §3.2's number as describing the scrim rather than setting a
second one.

**Dropdowns open over `--dur-ui`** *(added by the T45 worker, 2026-09-16, pending owner
confirmation)*. §3.2's prose says 160ms and §4's motion table gives dropdowns `--dur-ui`, which is
200ms. The table wins, because it is the thing the tokens are named from and the point of naming
them is that a surface does not invent a fourth duration. §3.2's 160ms is the stale number.

### 3.6 What's new

**`WhatsNewPanel`** (new, `apps/web/src/components/whats-new/`) — header "What's new" with "Mark all read"; a `TabRow` of **You** and one tab per crew (named after the crew); a `Panel flat` of **`FeedLine`s** (the existing crew-feed row: 32px avatar or icon disc, one sentence, a `.lab` time and source).
- **You** lists, newest first: stickers earned (`sticker_earned` rows), events the rider said yes to that are within 7 days ("Corby Jam is Saturday. You said you're going."), the live challenge's deadline once inside 3 days ("Switch week ends Sunday. 1 of 3 logged."), a banked week ("Week 5 banked."), and joins to the rider's crews ("Leo joined Ramp Rats with your code"). Every line is a sentence the product wrote from catalogue facts; nothing typed by anyone appears.
- A crew tab is the existing crew activity feed (`crewActivityLine`, the six sentences), unchanged.
- **Data:** nothing new is stored per item. The list is derived at read time from collections the rider can already read. One additive field on `users`: `whats_new_seen_at` (date). The unseen count is the number of derived lines newer than it; "Mark all read" and opening the panel set it to now. Server-side, the field is own-write only.
- Phone: the panel is the page `/whats-new`. Desktop: a `Dropdown` from the bell, 420px wide, capped at 8 lines with "All →" to `/whats-new`.
- The bell count badge **pops** when it increments while the page is open (scale .6 → 1.1 → 1 over 300ms, the existing `pop` shape scaled down); it does not animate on first paint.

**The badge counts the You lines and not the crew tabs** *(added by the T47 worker, 2026-09-17,
pending owner confirmation)*. §3.6 says the unseen count is "the number of derived lines newer than"
`whats_new_seen_at` and does not say whether a crew tab's rows are derived lines. They are not, for
two reasons and the second settles it. A crew feed is a place to go and look rather than news
addressed to this rider; and it carries the reader's **own** stage changes and stickers back to
them, so a badge fed by it would light up because the rider logged a trick — a notification about
yourself. It also keeps the read on the bar cheap, which the next paragraph is about.

**The count is on every page render; the panel's contents are not** *(added by the T47 worker,
2026-09-17, pending owner confirmation)*. The bell is in the top bar of every signed-in screen, so
whatever it needs is paid for on the dashboard, the library, every trick page and every spot page.
The count is one derived computation from six windowed reads fired together — the rider's stickers,
their attendance, the challenges and their log, their crews, and the live events inside the next
seven days — memoised for the request so a `/whats-new` render does not pay for it twice, and
failing soft to zero so a feed that will not load costs a badge rather than a page. The **panel** is
a further read per crew for the crew tabs, so it is fetched when the panel opens: the same trade
T45 made for the sport menu's counts, for the same reason.

**A line about something still to come is dated to the moment it started being true** *(added by
the T47 worker, 2026-09-17, pending owner confirmation)*. A sticker, a banked week and a crew join
happened at a time, and that time is their `at`. "Corby Jam is Saturday" has not happened yet, so it
is dated to the event's date minus seven days, and the challenge deadline to its end minus three —
the moment each line appeared. That is what makes one unseen count mean the same thing for both
kinds: a forthcoming line arrives once, counts as unseen once, and stops counting when it has been
read. It also decides the row's `.lab`: a line about something ahead shows its source and no
relative time, because "6 days ago" beside "Corby Jam is Saturday" is a true timestamp describing
the wrong thing.

**"Week 5 banked." ships, but only while the streak tuple can say when the week banked** *(added by
the T47 worker, 2026-09-17, pending owner confirmation)*. §3.6 asked for this judgement. The weekly
streak stores a counter and two day keys; it does not store the moment a week qualified. That is
recoverable in exactly one state — the week containing today has qualified *and* `rides_this_week`
still equals the target, which means the most recent ride is the ride that banked it. So the line
appears when the week banks and is dropped when the rider rides again. The two alternatives were
worse: dating it to the week's Monday files it days early and puts it *behind* a bookmark set
mid-week, so the one line a rider most wants a badge for would never produce one; dating it to the
latest ride re-dates the banking on every ride and tells a rider the same week banked three times.

**"Leo joined Ramp Rats with your code" is "Leo joined Ramp Rats."** *(added by the T47 worker,
2026-09-17, pending owner confirmation)*. `crew_members` records who joined, which crew and when,
and **not** which invite brought them — so "with your code" would be a guess dressed as a fact, and
in a crew where two members have both minted invites it would tell both of them it was theirs. The
join is news to every member of an invite-only crew whoever's code it was. Adding an `invite`
relation to `crew_members` would make the fuller sentence true, and is a second change to the data
model where §6 allows one. The joiner's name and avatar come from the **crew board route**, never
from `users`: a member whose profile is private appears on their crew's board by name and is not
readable any other way (plan §3 guarantee 1), and expanding the relation would quietly name the
public riders and skip the private ones.

**The windows §3.6 does not give** *(added by the T47 worker, 2026-09-17, pending owner
confirmation)*. §3.6 names seven days for an event and three for the challenge and is silent on
stickers and crew joins, so both look back **30 days** — long enough that a rider who opens the app
monthly still meets the stickers they earned, short enough that the screen is what has happened
lately rather than a second copy of the stickers wall. The whole list stops at **50 lines**, which
is not a product rule but a floor under the page: every source is windowed already, so reaching
fifty means something upstream is wrong, and a list that stops is a better way to find that out than
four thousand rows. The challenge line is drawn **per sport the rider rides**, so a scooter-only
rider is never told when the skate week closes.

**Opening the panel clears the badge while it is still open** *(added by the T47 worker,
2026-09-17, pending owner confirmation)*. The count comes from the layout's server render, so
stamping `whats_new_seen_at` alone would leave a rider reading four lines with a badge beside them
still saying four until they happened to navigate. The panel stamps and then asks for a fresh
layout, which keeps client state — the dropdown stays open, the tab does not move, the number goes.
It costs one server render per opening. **No line is ever struck off or greyed**: this is what has
happened lately, not an inbox, so "read" changes the count and nothing else.

**The badge pop keeps §3.6's 300ms rather than taking a token** *(added by the T47 worker,
2026-09-17, pending owner confirmation)*. This is the opposite call to the one T45 made about the
dropdown's duration, and deliberately: there §4's motion table gave dropdowns `--dur-ui` and §3.2's
prose disagreed, so the table won. Nothing in the table covers a pop — `.pop` in `primitives.css`
is already 0.5s of its own — and §4's row for the bell count points back at §3.6. So 300ms is the
pop family's third member, not a fourth UI duration.

**On a desktop the page is capped at 720px** *(added by the T47 worker, 2026-09-17, pending owner
confirmation)*. §7 puts What's new in a dropdown on a desktop and says nothing about the page behind
"All →". Run out to 1280px the sentences ended a third of the way across a row of empty paper. 720
rather than the 640 §3.10 gives the centred screens, because those are forms and this is a list of
one-line sentences with a disc beside each; left-aligned rather than centred, because the page's own
eyebrow and heading start at the left margin.

**The field joins erasure and the data export** *(added by the T47 worker, 2026-09-17, pending
owner confirmation)*. §6 says one additive field and says nothing about the two lists every other
rider fact is on. `whats_new_seen_at` is a record of when a rider last used part of the service, so
`hooks/lib/erasure.js` clears it when an account is closed — otherwise a closed account keeps a
stamp saying when it was last read — and writes it into the rider's own download, because a download
that leaves something out is not everything we hold. Both are one line, and both follow the
precedent `last_seen` set.

### 3.7 Find

**Find hub** (`/find`, new route in `apps/web/src/app/(app)/find/page.tsx`) — header "Find / Where to ride", a `TabRow` of For you · Spots · Events (links), then three sections: **You're going** (the rider's upcoming attended events, "Mine →" to `/events/mine`), **Near you** (the nearest spots once location is granted, else the rider's faves and recent session spots, plus the existing "Near me" button), **Coming up** (the next events, "All events →"). Desktop: the three sections are three columns. Signed out: the tab row and Coming up / Near you only.
- `/spots` and `/events` gain the same `TabRow` at the top and lose their eyebrow + h1 header on the phone (they keep it on desktop). Their sport pill rows become `SportScopeSelect` (O1: Spots opens on Every spot, Events on your sport). Events' Upcoming / Past / Mine switch becomes pills Upcoming · Past; Mine lives on For you.
- Fires `tabs_switched` `{ group: 'find', tab }`.

### 3.8 Trick page (D7)

Phone order: BackLink → hero band (category tag, difficulty, name, one-line lowdown) → **sticker + video row** (`StickerBadge` in a paper card with "Earned <date>" or "Land it at Sometimes", and the existing video block as a 16:9 thumbnail with a play square; with no video the sticker card spans the row) → the yellow "Can you do it?" band with the `StagePicker` and Share → a row of small buttons (Sticker · Watch · Clip) → **`Accordion`** rows for The lowdown, Tips, What you need, The road to it, Where to practise, Your history / notes / clips → More like this.

**`Accordion`** (new, `packages/ui-web`, additive) — a row (3px keyline, `--sh-sm`, paper, `min-height: 56px`) with a Barlow Condensed 16px title, an optional 13px sub-line and a chevron that rotates 180° over 120ms; the body opens with `grid-template-rows: 0fr → 1fr` over 200ms ease-out. `<details>`/`<summary>` underneath for no-JS and accessibility. Open state is not persisted. Desktop does not use it: the page keeps its two columns and plain panels, with the sticker + video row above the ladder in the left column.

### 3.9 Account

**`SettingsList` / `SettingsRow`** (new, `apps/web/src/app/(app)/account/`) — rows of 60px: a 40px icon square with a fixed fill, a 16px title, a 13px sub-line showing the current value, a right-pointing chevron. Seven rows: Your profile · What you ride · Who can see your profile · Who sees new sessions (when enabled) · Plans and billing · Coach / parent view · Your data. Phone: each row is a link to its own screen (`/account/profile`, `/account/sports`, `/account/privacy`, `/account/sessions`, `/plans`, `/coach`, `/account/data`), which is the existing panel on its own page with a "Your account" back link. Desktop: the list is a 340px left column and the chosen panel renders on the right; the URL still changes so a link lands on the right panel.

### 3.10 Other screens

- **Progress** — `TabRow` Record · Over time · Skill tree; the `SportSwitch` and `ProgressTabs` rows go. Record = by category + by stage (+ printable sheets on desktop's rail).

**Where Insights and the printable sheets land** *(added by the T46 worker, 2026-09-17, pending
owner confirmation)*. §3.10 names three tabs and places two of the screen's five blocks; these are
the other two.

- **Insights are on Over time.** They are what six months of logging *mean* — the day a rider lands
  most, the gap between trying and landing — so they belong with the six months. A fourth tab
  holding one panel would spend a quarter of the row saying one thing.
- **The printable sheets are on Record**, on a 340px rail beside the two panels above 1100px and
  stacked under them below it. What they print *is* the record: the rider's list of tricks with a
  box beside each. They are not hidden on narrow screens, because they are what a Shredder rider is
  paying for and a paid feature that only exists on a wide screen is one half the riders never
  find.
- **The tab panel is `role="tabpanel"`, named after its tab**, and keyed on the tab id so §4's
  120ms cross-fade runs on every switch. Both tab rows have one; the wall's is on a wrapper,
  because `Panel` in `packages/ui-web` takes no ARIA props and is not worth widening for two
  attributes.
- **The selected tab lives in `?tab=`**, not in `useState`
  (`apps/web/src/components/shell/useTabParam.ts`, additive, new file). §3.3 does not say where a
  tab row keeps its answer, and component state is the obvious choice until you use one: a rider on
  the skill tree opens a node, reads the trick, presses Back — and lands on Record, having lost
  their place on every node they opened. Before the rethink the tree was part of one long scroll,
  so Back restored it with the scroll position; turning that scroll into tabs took it away. The
  hook `replace`s rather than pushes, so three tab presses do not put three entries in the history,
  and the first tab is spelled by **absence**, so the screen has one address as it opens. It stays
  a `role="tablist"`: the panel still changes in place and the document does not navigate.
- **`ProgressTabs` is removed from `/progress` only.** It still draws on `/progress/sessions`,
  whose header is T50's (§8). Issue #522 closed on option 1, so `/progress` stays "Where you're at"
  and does not redirect; the two screens have separate Home cards now.

  Two consequences of that, neither of them a mistake but neither what the sentence above says it
  is doing, both surfaced by the independent review *(added by the T46 worker, 2026-09-17)*:
  **`/progress` now has no in-page route to the diary at all** — the Home Sessions card is the only
  way, while `/progress/sessions` still links back here, so the pair is asymmetric until T50. And
  **`/progress/sessions` reads top to bottom as `← HOME`, `<h1>Progress</h1>`, then SESSIONS |
  WHERE YOU'RE AT** — so a rider who taps the blue *Sessions* card lands on a page called
  *Progress*, one tap from the green *Progress* card's destination. T46 deliberately adds only the
  back link there and leaves the header to T50, which means **the collision is live on
  `shell-rethink` between the two merges** and is a sequencing fact for the owner rather than
  something this task can close.
- **Sessions** — header with the Log button; on the phone three `StatBlock`s (sessions, time, moved up) then the feed; `SportScopeSelect` replaces the sport pills; the "At an event" pill stays.
- **Session form** — three steps on the phone via `TabRow` (When & where · What · Notes) with Next / Save; "What you rode" becomes a preset `Tag` from the chip with a Change link, not a three-button row. Desktop: the same three steps inside the modal, step one as two cards side by side.
- **Quick log** — unchanged, shows the sport `Tag`; on desktop a 640px modal.
- **Stickers** — Earned / Not yet as a `TabRow` in the header; the `SportSwitch` goes.

**The wall's tabs keep their counts, and `sticker_view_switched` stops firing** *(added by the T46
worker, 2026-09-17, pending owner confirmation)*. Two things follow from moving the switch out of
the ink panel and into a boxed `TabRow`.

- **`TabRowItem` gains an optional `note`**, additively, rendered in `.sporttab`'s faded `.n`. The
  underline bar carried "Earned 3 / Not yet 118", and the count is the reason to press either one:
  "Not yet 118" is a wall worth opening, "Not yet" is a word. The count is a fact on screen, never
  a property on an event — `tabs_switched` carries the tab id and nothing else.
- **The screen stops firing `sticker_view_switched`.** §5's `tabs_switched` entry says it "replaces
  the several per-screen switch events the tab rows are taking over from", and firing both would be
  one tap counted under two names. The catalogue entry stays in `analytics.ts` (nothing is removed
  from it here), and `tabs_switched { group: 'stickers', tab: 'earned' | 'unearned' }` is the
  measurement from now on. The review's note on it stands: a catalogue entry nothing fires is a
  trap for the next reader of `analytics.ts`, and a one-line "nothing fires this since T46" on the
  entry would close it — left for the owner, since the catalogue is deliberately outside T46's
  scope.
- **`empty_state_action { screen: 'home', action: 'library' }` keeps firing.** It came from the
  Stickers empty state, which is a card now; without moving it to "Nothing to show yet / Find a
  trick" the value would have gone quiet altogether, which is a screen going invisible rather than
  a screen going away.

- **Challenge** — the `SportSwitch` goes; layout unchanged (desktop: card left, Coming up and history right).
- **Crew** — `TabRow` Board · Activity · Members; Invite in the header; Start another / Join with a code as two small ghost buttons that reveal the existing forms.
- **Rider profile** — profile card with the three numbers; `TabRow` Landed · Stickers · Videos.
- **Spot page** — three equal actions under the hero on the phone (Faved · Directions · Log here), in the hero band on desktop; What's here as coloured `LinkCard`s.
- **Events archive** — the Past pill; the year/town index stays.
- **Plans** — Monthly · Yearly as a `TabRow`; otherwise unchanged (three cards on desktop, stacked on the phone).
- **Glossary** — `SportScopeSelect` replaces its own sport tabs.
- **Coach, Suggest, Report, Close account** — radio lists become `Pill` rows; content otherwise unchanged; desktop centred at 640px.
- **Tricks** — the `SportSwitch` goes; the phone's Filters toggle joins All · Mine in one `TabRow`; the Rookie nudge moves below the first card rows.

---

## 4. Motion

The design already moves in one voice (`additions.css` documents it): modals rise 26px on
`cubic-bezier(.2,1.3,.4,1)`, toasts slide up, stickers pop, buttons translate on press, and a
`prefers-reduced-motion` floor at the end of `additions.css` clamps every duration to 0.01ms. New
motion uses the same three ideas and nothing else.

| Token (add to `tokens.css`) | Value | Used for |
| --- | --- | --- |
| `--dur-press` | 120ms | button / card / tab press and hover lift, chevrons |
| `--dur-ui` | 200ms | tab cross-fade, accordion open, dropdown, scrim, colour changes |
| `--dur-sheet` | 260ms | sheet rise, modal rise |
| `--ease-out` | `cubic-bezier(.2,.9,.3,1)` | everything that closes or settles (already used by `.bar i`) |
| `--ease-spring` | `cubic-bezier(.2,1.3,.4,1)` | everything that opens toward the rider (already the modal's) |

Rules:
- **Press** is the design's one gesture and every tappable box does it: `translate(2px,2px)` with the shadow dropping to `1px 1px` on `:active`, `--dur-press`. `LinkCard`, `TabRow` tabs, `OptionRow`, `SettingsRow`, `LogCell` all get it; `TrickCard` already has it.
- **Open toward, close away.** Sheets, modals and dropdowns open on `--ease-spring` and close on `--ease-out` with no overshoot.
- **The LOG plus turns into a cross** (rotate 45°, `--dur-ui`) while the sheet is open, so the cell reads as "close" too.
- **Sport switch**: the top bar rule and the chip fill cross-fade colour over `--dur-ui`; the page content re-renders with no transition (it already does).
- **Tab switch**: the newly active tab moves from 3px to 4px shadow over `--dur-press`; content cross-fades over `--dur-press`. Route-changing tabs (Find) do not animate content.
- **Bell count**: pops on increment only (§3.6).
- **No entrance animation on Home** and no page transitions. This is a product used by children; motion is feedback for something the rider did, never decoration. Stickers and toasts keep the celebration they already have.
- **Reduced motion**: the existing floor covers every rule above. The one addition: sheet drag-to-close snaps without animating.
- **Touch targets**: nothing tappable below 44px; bar cells 52px; LOG 58px.

---

## 5. Analytics

New entries in `ANALYTICS_EVENTS` (`apps/web/src/lib/analytics.ts`), each carrying catalogue
facts only, and each added to the pinned list in `analytics.test.ts`:

| Event | Properties | Fired by |
| --- | --- | --- |
| `log_sheet_opened` | `where: 'mobile' \| 'top'` | LogCell, LogButton |
| `log_action_picked` | `action: 'rode' \| 'trick' \| 'session' \| 'clip'` | LogSheet |
| `tabs_switched` | `group`, `tab` (ids from the screen's tab list) | `TabRow` — `apps/web/src/components/shell/TabRow.tsx`, which fires it itself so no screen has to remember (§3.3) |
| `sport_scope_set` | `screen`, `scope: 'chip' \| 'all' \| 'other'` | SportScopeSelect |
| `whats_new_opened` | `where: 'mobile' \| 'top'`, `unread` (integer) | BellButton |
| `whats_new_read` | `unread` (the count cleared) | "Mark all read" |

Changed: `sport_switched` gains `where: 'chip'` (the tab rows that fired it without `where` go).
`nav_clicked` gains the values `find`, `log` for `to` and `'top'` for `where`. Removed:
`nav_section_opened` (the drawer is gone; its doc comment is deleted, not left describing a
control that no longer exists).

---

## 6. Data

One additive field: `users.whats_new_seen_at` (date, own-write). A migration in
`pocketbase/migrations/` adds it; the ownership hook allows the rider to set it on their own record
and nobody else's. Nothing else in the data model changes. The bell is derived, not stored (§3.6),
which keeps the "no algorithmic feed" position intact: it is the crew feed and the rider's own
record, in time order.

---

## 7. Screens, both widths

Reference: canvas page 3 (phone) and page 4 (desktop). "Chrome only" means the screen keeps its
content and gains the new bar and, where it belongs to a group, its back link.

| Screen | Phone | Desktop |
| --- | --- | --- |
| Home | §3.4 | §3.4 |
| Tricks | §3.10 | filter rail stays; All · Mine `TabRow`; nudge below cards |
| Trick page | §3.8 | two columns; sticker + video row above the ladder |
| Glossary | §3.10 | two columns of words |
| Progress / Sessions / Stickers / Challenge | §3.10, Home back link | §3.10, Home back link, Home lit |
| Quick log / full form | §3.10 | modals |
| Crew / Rider profile | §3.10 | board left, activity right / card + tabs |
| Find / Spots / Events / archive / spot page | §3.7, §3.10 | For you three columns; Spots list + map; Events two columns |
| Plans | `TabRow` | `TabRow`, three cards |
| Account and its screens | §3.9 | §3.9 |
| Coach, Suggest, Report, Close | §3.10 | centred 640px |
| Account menu, What's new, Sport switch | page / sheet | dropdowns |
| Sign in, sign up, onboarding, legal, landing, admin, join | unchanged | unchanged |

---

## 8. Build split

One session = one task = one branch = one PR (CLAUDE.md step 3). Eight tasks, in three waves;
T45 first and alone because everything else uses what it adds. **Every task branch is cut from
`shell-rethink` and its PR targets `shell-rethink`** (the branching decision in §1); the
rebase step in CLAUDE.md step 7 rebases onto `origin/shell-rethink`, not `origin/main`.

| Task | Branch | Scope | Depends on |
| --- | --- | --- | --- |
| **T45** | `t45-shell-groups` | `nav.ts` on four groups both bars; `LogCell` + `LogSheet` (+ `Sheet`, `OptionRow`); `SportSwitchChip` + sheet/menu; `TabRow` variant; `BackLink`; `Dropdown`; motion tokens; streak chip out; drawer out; `VerifyEmailBanner` strip; `/find` **placeholder** route that redirects to `/spots` until T48 lands; analytics events; shell e2e at 375 / 861 / 960 / 1280 | — |
| **T46** | `t46-home-cards` | `LinkCard`s and the new Home order both widths; Home back links and lit-cell rules on Progress, Sessions, Stickers, Challenge; Progress `TabRow`; Stickers `TabRow`; `SportSwitch` rows removed from those screens | T45 |
| **T47** | `t47-whats-new` | `whats_new_seen_at` migration + hook; derived feed in `packages/core` (pure, tested) and `packages/db`; `WhatsNewPanel`, `/whats-new`, `BellButton` count and dropdown | T45 |
| **T48** | `t48-find` | `/find` hub; `TabRow` on Spots and Events; `SportScopeSelect` (O1); Events pills; archive; Mine folded | T45 |
| **T49** | `t49-trick-page` | layout A; `Accordion`; the sticker + video row; desktop columns; Log a trick's trick picker lands on `#ladder` | T45 |
| **T50** | `t50-lists-follow-chip` | Sessions header/stats/dropdown; session form steps + preset sport; quick log tag; Glossary dropdown | T45 |
| **T51** | `t51-account-settings` | `SettingsList`, the seven screens, desktop master/detail | T45 |
| **T52** | `t52-secondary-screens` | Crew tabs, rider profile tabs, spot page actions, Plans tabs, Coach / Suggest / Report / Close pills and centring, Tricks header | T45 |

Wave A: T45. Wave B: T46 ∥ T47 ∥ T48 (route-disjoint: Home + record screens / bell / Find).
Wave C: T49 ∥ T50 ∥ T51 ∥ T52 (route-disjoint: trick page / sessions + glossary / account /
the rest). T50 and T52 both touch nothing under `/progress/sessions` except T50; T52 stays out of
it.

Every task: TPO brief first (CLAUDE.md step 1), gates on exit codes, screenshots at 390px and
1280px in the handover against the canvas, `FEATURES.md` rows re-audited for the routes it
touched, and **no PR raised unasked**.

---

## 9. Where the build runs (O2)

On the owner's laptop, in a fresh Claude Code session opened in the repository checkout, so the
owner can run `pnpm dev` from any worktree or from `shell-rethink` and see the work on localhost.
The orchestrator reads this document cold, which is also the test of whether it is complete: a
worker that has to ask is a paragraph this document is missing, and the orchestrator adds it here
(in the task's PR) before the worker continues. Workers are subagents on the Opus model, one per
task, each in its own worktree under `.claude/worktrees/<branch>`. Nothing in this document is
authority the orchestrator can widen; owner decisions still arrive in chat with a date.

To see a task while it is being built: `cd .claude/worktrees/t45-shell-groups && pnpm dev`. To see
the combined work: `git checkout shell-rethink && pnpm dev`. Both need a PocketBase running as the
README describes; the e2e suite's own instance on port 8091 is the quickest.

## 10. The orchestrator's opening message

Paste this, unchanged, as the first message of the new session:

> Read `CLAUDE.md`, then `docs/app-shell-rethink.md` in full, then `docs/implementation-plan.md`
> §7 Wave 9 and §1's "App shell (D7)" row. You are the orchestrator for tasks T45–T52. Do not
> build anything yourself. Open with one TPO brief for T45 (CLAUDE.md step 1); when I answer,
> spawn one Opus worker for T45 in its own worktree cut from `origin/shell-rethink`, with the
> spec as its contract and CLAUDE.md as its process. When T45's PR is green, merge it into
> `shell-rethink` (this permission was granted 2026-09-16 and covers every task PR into
> `shell-rethink`, and nothing into `main`), then brief and spawn T46, T47 and T48 together, then
> T49, T50, T51 and T52 together, merging `main` into `shell-rethink` between waves. Each worker
> ends with the TPO handover and screenshots at 390px and 1280px. Where a worker has to ask
> something the spec should have answered, add the answer to the spec in that worker's PR. If a
> decision needs me, stop and ask in a line. Keep the draft PR `shell-rethink → main` description
> updated with a checklist of the eight tasks as they merge; do not merge it.

