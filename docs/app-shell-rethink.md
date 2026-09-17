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
| D3 | **LOG opens a sheet with three actions**: I rode today, Log a trick, Log a session. *Four until 2026-09-17, when the owner removed "Add a clip link" — it opened the trick picker only to land on the video field the trick page already carries. Clips themselves are unchanged.* | 2026-09-15, amended 2026-09-17 |
| D4 | **The bell ("What's new") has two tabs**: You, and one per crew. In-app only; push notifications are out of scope. | 2026-09-15 |
| D5 | **The sport is chosen once**, in a top-bar chip that carries the sport's icon *and name*. The top bar's bottom rule takes the sport colour. Every in-page sport tab row goes. Lists that used to carry their own sport row follow the chip through one dropdown (O1 below). | 2026-09-15 |
| D6 | Every tab row is a row of separate boxes with the 3px keyline and the hard offset shadow; the active tab lifts to a 4px offset in yellow (the `.sporttab` treatment). Pills keep their keyline-only look because they filter rather than navigate. | 2026-09-15 |
| D7 | **Trick page: the badge is in the hero, then the stage ladder, then the video, then the sections.** *Layout A until 2026-09-17, when the owner put the badge back in the hero and moved the video under the ladder: the row above the band pushed the page's only control below the fold on a phone with a tutorial. The award card's two lines — "Earned &lt;date&gt;" / "Land it at Sometimes" — went with the card and are on no screen now.* | 2026-09-16, amended 2026-09-17 |
| D7a | ~~**On a phone the two cards stack, video first; the row is desktop's.**~~ *Superseded the same day by the owner's amendment to D7. The size complaint it fixed is kept — the video is full width at both widths — but it is under the band rather than above it, because the ladder is the only thing on this page a rider does.* | 2026-09-17, superseded 2026-09-17 |
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
| **LOG** (phone) / **Log** (desktop) | a **sheet** (phone) or **modal** (desktop), never a page | I rode today · Log a trick · Log a session | the middle cell / the yellow button beside the chip |
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

**An event page carries "Events", and the last breadcrumb in the product goes with it** *(added by
the owner-pass-1 worker, 2026-09-17, after the independent review of the combined branch)*. §2.3
names the spot page and not the calendar's own detail page, and T52 converted the one it named — so
the Find group shipped with its two detail pages disagreeing: `/spots/[slug]` on a 44px `BackLink`
and `/events/[slug]` still on `EVENTS / UNITED KINGDOM / MANCHESTER`. The trail's two tail segments
were plain text repeating the sub-line under the title, which already reads "Projekts MCR ·
Manchester", and its one link was 12.5px of unpadded type — the smallest target on the page.
**Nothing a crawler reads is lost**: the page's JSON-LD is `eventLd`, an `Event` with a `Place` and
a `PostalAddress`, never a `BreadcrumbList`, so the town and country still reach a search engine
through `addressLocality` and `addressCountry` as well as through the `<h1>`, the sub-line and the
metadata description. The `.crumb` rules go with the markup that wrote them.

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

**`BellButton`** — a 34px square (`.tb-btn` look: `--ink-raise` fill, paper keyline) with the bell icon and, when the unseen count is above zero, a pink count badge (`--pink`, 2px ink keyline, Barlow Condensed 700 11px) at the top-right corner. **Opens `WhatsNewPanel` at both widths** (owner, 2026-09-17, in chat: "/whats-new feels better as a slide down panel"): a full-width panel dropped from under the top bar on a phone (`Dropdown fullWidth`), the 420px column on a desktop. `/whats-new` stays a real route — the panel's "All →", a deep link and a rider with no JavaScript all still land there, and the page counts its own opening. `aria-label`: "What's new, 3 unread." Fires `whats_new_opened` `{ where: 'mobile' | 'top', unread }` (a count, not a fact about the rider).

**`AccountMenu`** — unchanged.

### 3.2 Overlays

**`Sheet`** (new, `packages/ui-web/src/components/overlays.tsx`, additive)
- A bottom sheet for phones. Paper surface, 3px ink top keyline, a 44×5 ink handle centred at the top, 16px side padding, `padding-bottom: max(28px, env(safe-area-inset-bottom))`. Sits above `.mobnav` (z-index above 70, below toasts). Scrim `rgba(18,16,11,.55)`.
- Uses `modal-layer.ts` for body scroll lock and focus trapping, as `Modal` does; Escape and a scrim tap close it; drag down more than 80px closes it (pointer events, no library). **A visible Close sits in the top right** — the same square as `Modal`'s, with the offset shadow (owner, 2026-09-17: "panel should have an x in top right, and if on a circle or square it should be shadowed").
- **It stands 30px clear of the bottom bar's top edge**, not flush with it: the LOG square is raised 30px above the bar (§3.1), and a panel that stopped at the scrim's own edge cut the yellow square in half (owner, 2026-09-17). The scrim still reaches the bar, so the square stands in the dimmed band where the plus can be seen turning into a cross. The spots map sheet keeps the same line.
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
- Fires `tabs_switched` `{ group, tab }` where both are catalogue ids (e.g. `find` / `spots`, `progress` / `over-time`, `whats-new` / `crew-1`).
- **A label that does not fit is clipped, and the type tightens first** (`.rowFit` in `apps/web/src/components/shell/shell.module.css`, added by T47 — see below).
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

**The row never widens the page, and the words are the last thing to give** *(added by the T47
worker, 2026-09-17, pending owner confirmation)*. §3.3 specifies the tab's type and says nothing
about what happens when a label is longer than its share of the row. What happens is that the whole
document scrolls sideways: `.tabrow .sporttab` is `flex: 1` with `white-space: nowrap`, and a flex
item's `min-width` is `auto`, so the box refuses to shrink below its content. Measured on
`/whats-new` with a 40-character crew name — the maximum a rider can set — the page was 475px wide
at 320, 360, 375 and 390, with the feed panel's right keyline off screen and the last tab cut
mid-word. Issue #550 filed the general case after T46 met it on Progress with three ordinary words.

`TabRow` now adds `.rowFit` to every row it draws, and it gives way in the order T45 used for the
sport chip's name below 520px — the decoration first, the words last:

1. **Below 420px the type tightens**: 12px at 0.05em with 4px of side padding, where the row is
   otherwise 13px at 0.09em with 10px. These are T46's numbers, proved on Progress and promoted
   here so no screen has to remember them.
2. **`min-width: 0` on the box**, which is what actually stops the overflow at every width rather
   than postponing it to a longer label.
3. **The label clips with an ellipsis** and keeps the full string in the DOM, so a screen reader
   still reads the whole crew name; a pointer gets it from `title`, which `TabRow` sets from the
   item. `packages/ui-web` wraps a plain tab label in `span.tab-label` for this, because
   `text-overflow` needs a box and the anonymous text run inside a flex container is not one.

It is in `TabRow` rather than in `packages/ui-web`'s `.tabrow` because that stylesheet is merged
shared code two sibling tasks were building on in the same wave; this reaches every row that goes
through the component and moves nothing that does not.

**`BackLink`** (new, `apps/web/src/components/shell/BackLink.tsx`) — arrow-left icon + label in `.lab` at 13px, `--ink-3`. A link. Used per §2.3.

**`SportScopeSelect`** (new, `apps/web/src/components/shell/SportScopeSelect.tsx`) — one line under a list's header: a `.lab` label ("Show") and a **styled `<select>`** in the design's select treatment (the Country select on `/events` is the precedent: 3px keyline, `--sh-sm`, Barlow Condensed 700 uppercase). Options: **Your sport (Scooter)** — which tracks the chip, so switching the chip switches the list — then **All sports** (reads "Every spot" on Spots), then one entry per other sport the rider does not currently have selected. Default per O1: Spots → Every spot; Events, Sessions, Glossary → Your sport. Choosing fires `sport_scope_set` `{ screen, scope: 'chip' | 'all' | 'other' }` (never the sport id of an "other" choice beyond the three catalogue ids). The choice is per screen and per device (`localStorage` key `landit.scope.<screen>`), not rider data.

**Three corrections to the paragraph above, from the code that built it** *(added by the T48
worker, 2026-09-17, pending owner confirmation)*.

- **The keyline is 2.5px, not 3.** The paragraph names the Country select on `/events` as the
  precedent *and* says "3px keyline"; the precedent is `2.5px solid var(--ink)`, and the control
  matches the precedent rather than the number, because it sits one line away from it on the same
  screen. The face is `.cond` (Barlow Condensed 600), which is the same class the Country select
  uses, rather than the 700 named above.
- **The browser's own menulist is turned off.** `appearance: none`, the inline chevron and 38px of
  right padding, the block `additions.css` already applies to `.field select` and explains there:
  left alone, WebKit paints a grey rounded menulist inside the ink keyline, which is the only radius
  and the only grey fill on the page. Stated unconditionally, where the package's copy lives inside
  a phone media query — the reason is not a phone reason, and one control that looks the same at
  every width beats two that differ at 861px. The same three lines and §4's 44px went onto
  `/events`' Country select in the same pass ([issue #552](https://github.com/lekky/landit/issues/552)).
- **With no rider there is no "Your sport" option at all.** Signed out the top bar has no sport chip
  (T45 hides the right-hand group with the rider), so the first option would be a claim about
  somebody the product has never met, following a fallback they cannot see or change. The control
  therefore takes "is anybody signed in" as its own input — never as a fallback that happens to name
  a real sport (LESSONS §3a) — and with no rider it offers "All sports" and then every sport, a
  stored `'chip'` reads as the screen's default, and both screens pass "every sport" as that
  default. See §3.7.

### 3.4 Home

**`LinkCard`** (new, `apps/web/src/app/(app)/home/LinkCard.tsx`) — a coloured card that is a link: `.lab` title with a 18px icon at the right, an Anton number at 30px, a 12.5px `--ink-2` sub-line, an arrow at the bottom-right. 3px keyline, `--sh-sm`, `min-height: 112px`. Press: the button press. Four of them on Home in a `2 × 2` grid below 860px and one `4-up` row above, in the owner's order of 2026-09-17 (in chat) — **Stickers, Sessions, Challenge, Progress**, replacing the canvas order this section was written from: **Progress** (landed count · learning · want to), **Sessions** (this month · last spot and day; hidden when sessions are not enabled for the rider, as `sessionsEnabled` already decides), **Stickers** (earned · newest), **Challenge** (logged / goal · title · ends). Fires the existing `nav_clicked` `{ to, where: 'home-card' }`.

**Home order** (phone): greeting → streak card → four cards → **Your tricks** (2 tricks, "All N of yours →" — one heading whatever the rider's state, owner 2026-09-17, replacing "Working on it" and its empty-account twin "Start here") → crew activity (3 lines, "Crew →") → Next up (the next event the rider said yes to, "Find →") → Your spots (faves). Desktop: greeting + streak/challenge rail as today, then the 4-up card row, then Working on it 4-up, then crew activity and Next up side by side. The `SportSwitch` row goes from Home; the greeting panel's four stat blocks stay on desktop and go on the phone (the cards carry the numbers there).

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
1. **I rode today** (lime tick) — "One tap. Counts a ride for the streak, nothing else." Calls the existing `rodeTodayAction`; on success the sheet closes and the existing toast shows. **Once today's ride is counted the row says so and goes inert** — "Counted today. One a day is all it takes.", the disabled treatment, and `log_action_picked` does not fire for a tap that can do nothing (owner, 2026-09-17: "i rode today should be disabled somehow if they already logged today?"). The shell computes it from `users.last_ride` in the rider's own timezone.
2. **Log a trick** (yellow grid) — "One trick, up a stage." Opens the trick picker: the rider's three most recently worked-on tricks on the current sport, then a search field over the library; choosing one goes to `/library/[slug]#ladder` where the existing `StagePicker` is the action.
3. **Log a session** (sky clock) — "A ride: where, how long, how it felt, the tricks you worked on." Opens the existing quick log (`QuickLog`) in the same sheet; "Add tricks, clip and notes" escalates to the full form as today. Shown only when `sessionsEnabled`.
- **A fourth row, "Add a clip link", was here until 2026-09-17** (owner, in chat). It opened the trick picker limited to landed tricks and then landed on the video-link field the trick page already carries — a signpost to a signpost. Clips are unchanged: they are added on the trick page, in "Your history, notes and videos". `#clips` remains a valid anchor and still opens that row on Your videos; nothing in the sheet sends a rider to it now.
- Fires `log_action_picked` `{ action: 'rode' | 'trick' | 'session' }`.

**A rider with nothing on the go is offered somewhere to start, and the row is where the recents
would be** *(added by the integration-pass worker, 2026-09-17, pending owner confirmation)*. §3.5
item 2 gives the picker "the rider's three most recently worked-on tricks on the current sport, then
a search field" and does not say what a rider on their **first day** meets. What they met was an
empty box under "Search for the one you rode." — a sentence addressed to somebody who has ridden
nothing this product knows about, on the screen the whole bottom bar points at, two taps after
sign-up. So with no recents the picker shows **four tricks to begin on**: `suggestedNextTricks`, the
same source and the same sort as Home's own "Start here", free-tier and with every prerequisite
landed, under "Start here — or search for another". The prereq read that needs is made **only** in
that branch, so a rider with something in progress pays nothing for a list they will never see.

It sits **in the recents' slot, under the search field**, rather than literally above the search as
the finding phrased it: the two lists answer the same question at two ages of account, one of them
is on screen at a time, and moving the search box down the sheet for a new rider would give the
sheet two shapes to learn. *(The sentence that stood here about "Add a clip link" being unchanged
went with the row itself on 2026-09-17.)*

**And the picker never offers a trick the rider's plan does not open** *(added by the
integration-pass worker, 2026-09-17, pending owner confirmation)*. §3.5 is silent on the paywall and
the first cut listed every live trick in the sport, unmarked: a Rookie searching "whip" was offered
twelve paid tricks and, on choosing one, arrived at `LockedTrick` — which has no `#ladder` on it, so
the tap that was going to log a trick could not. The session form's picker has always left them out
and FEATURES says so in as many words ("locked ones left out"); the rule is `lib/trickLock.ts` now,
asked by both. Nothing about **enforcement** moves — the `trick_progress` hook is still where the
paywall binds (plan §3, guarantee 3) — and nothing is hidden that a rider cannot already see: the
library still shows every locked trick with its lock on it, which is the product's position. This is
only about what a *picker* offers, and a picker exists to offer things that work.

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

**T50 looked, and left it** *(added by the T50 worker, 2026-09-17, pending owner confirmation)*.
The paragraph above offers this as a T50 addition "once the form is stepped", so here is the answer
now that it is. Stepping the form changed nothing about the reason: what makes embedding expensive
is not the form's length but its **data**. `QuickLog` needs a `SessionFormData` — known spots, the
recent-spot list, the stamp, the quota, the plan's clip allowance — and `LogSheet` lives in the
shell, which wraps every screen in the product. Embedding means either loading that on every page
render, or fetching it on open and re-implementing `SessionFormScreen`'s state machine (four stages,
the grace, the wall, the saved state) inside the sheet. The steps are presentation over that same
machine, so there is no smaller version of it to embed. The row still navigates, and the rider meets
the same quick log from the same tap.

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

*And on `--ease-spring`, which the first cut got the other way round (added by the integration-pass
worker, 2026-09-17, pending owner confirmation).* §3.2's prose says "an 8px rise and fade over
160ms ease-out", and §4's rule above the table is the one that governs: **open toward, close away** —
sheets, modals and dropdowns all open on the spring. `.dropdown`'s `dropin` was written with
`--ease-out`, so the surface a desktop rider meets most often was the one of the three that did not
move like the others. Corrected in `additions.css`; it is `Dropdown`'s own rule, added in this wave,
so nothing that shipped before the rethink changes. Read §3.2's "ease-out" as describing the close.

### 3.6 What's new

**`WhatsNewPanel`** (new, `apps/web/src/components/whats-new/`) — header "What's new" with "Mark all read"; a `TabRow` of **You** and one tab per crew (named after the crew); a `Panel flat` of **`FeedLine`s** (the existing crew-feed row: 32px avatar or icon disc, one sentence, a `.lab` time and source).
- **You** lists, newest first: stickers earned (`sticker_earned` rows), events the rider said yes to that are within 7 days ("Corby Jam is Saturday. You said you're going."), the live challenge's deadline once inside 3 days ("Switch week ends Sunday. 1 of 3 logged."), a banked week ("Week 5 banked."), and joins to the rider's crews ("Leo joined Ramp Rats with your code"). Every line is a sentence the product wrote from catalogue facts; nothing typed by anyone appears. *(The last clause is not quite right and T47 corrected it in the build: a rider's **display name** and a **crew's name** are rider-typed, and both reach a line. See "The two rider-typed strings" below.)*
- A crew tab is the existing crew activity feed (`crewActivityLine`, the six sentences), unchanged.
- **Data:** nothing new is stored per item. The list is derived at read time from collections the rider can already read. One additive field on `users`: `whats_new_seen_at` (date). The unseen count is the number of derived lines newer than it; "Mark all read" and opening the panel set it to now. Server-side, the field is own-write only.
- **Both widths open a panel from the bell** (owner, 2026-09-17, in chat: "/whats-new feels better as a slide down panel"). Phone: full width, dropped from under the top bar. Desktop: a `Dropdown` from the bell, 420px wide. Both are capped at 8 lines with "All →" to `/whats-new`, which stays a real route for deep links, "All →" and a rider with no JavaScript.
- The bell count badge **pops** when it increments while the page is open (scale .6 → 1.1 → 1 over 300ms, the existing `pop` shape scaled down); it does not animate on first paint.

**The badge counts the You lines and not the crew tabs** *(added by the T47 worker, 2026-09-17,
pending owner confirmation)*. §3.6 says the unseen count is "the number of derived lines newer than"
`whats_new_seen_at` and does not say whether a crew tab's rows are derived lines. They are not, for
two reasons and the second settles it. A crew feed is a place to go and look rather than news
addressed to this rider; and it carries the reader's **own** stage changes and stickers back to
them, so a badge fed by it would light up because the rider logged a trick — a notification about
yourself. It also keeps the read on the bar cheap, which the next paragraph is about.

**The count is on every page render; the panel's contents are not** *(added by the T47 worker,
2026-09-17, pending owner confirmation; the numbers corrected after the review)*. The bell is in the
top bar of every signed-in screen, so whatever it needs is paid for on the dashboard, the library,
every trick page and every spot page.

The count is one derived computation from **four reads fired together — the rider's stickers earned
in the last thirty days, the live challenges closing inside three, their crews, and the live events
inside the next seven — and then up to four more that depend on what the first four found**: the
sticker catalogue only if a sticker was earned, the attendance rows only for events that exist, the
challenge log only for challenges that are closing, the crew joins only if there are crews. A rider
with none of those pays four. It is memoised for the request, so a `/whats-new` render does not pay
for it twice, and it fails soft to zero so a feed that will not load costs a badge rather than a
page. The **panel** is a further read per crew for the crew tabs, so it is fetched when the panel
opens: the same trade T45 made for the sport menu's counts, for the same reason.

*This paragraph first said "six windowed reads", and one of the six was windowed.* The other four
were `getFullList` — one of them reading every challenge that has ever existed for every sport, 81
rows and growing by three a week, to answer a question about the next three days, and another
reading a rider's whole logging history to count this week's entries. The independent review of
2026-09-17 measured nine extra API calls on one `/library` load and said so. The reads are windowed
now and the sentence is the one the code produces, which is the point of writing a cost down.

**A line about something still to come is dated to the moment it started being true — or to the
moment the rider opted in, whichever is later** *(added by the T47 worker, 2026-09-17, pending owner
confirmation; the second half added after the review)*. A sticker, a banked week and a crew join
happened at a time, and that time is their `at`. "Corby Jam is Saturday" has not happened yet, so it
is dated to the later of the event's date minus seven days and the moment the rider pressed "I'm
going"; the challenge deadline, which nobody opts into, is dated to its end minus three.

*The opt-in half was missing and it broke the common case.* Most riders say yes to an event inside
the week, and the window-opening rule then dated the line five days into the past: it arrived older
than the rider's bookmark, so the bell never counted it, and it filed itself below stickers earned
minutes earlier. §3.6's own worked example was the one line a rider creates by hand and the one line
that could not badge. `event_attendance.created` is what the later stamp reads. That is what makes one unseen count mean the same thing for both
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

**A private rider's crew join is not mentioned** *(added by the T47 worker, 2026-09-17, pending
owner confirmation)*. §3.6 asks for "joins to the rider's crews" and does not say whose. The
conservative reading ships: the line appears only for a crew-mate this reader could already see —
`public`, or `members` and in the crew — which is decided by asking `users.listRule` rather than by
keeping a second copy of the privacy model.

That is the same test `pocketbase/hooks/85_crews.pb.js` spells out for the crew feed, and it is the
test rather than the crew board's on purpose. The board names a private rider by name and score,
which is plan §3 guarantee 1's single carve-out, and the feed's own comment says in as many words
that the carve-out "does not stretch to here", because what a rider *did* is more than a name and a
score. The first cut of T47 read the board, and the result was a You tab reading "Cara Quiet joined
Ramp Rats." one tab away from a crew feed whose empty state says private riders never show up — a
promise and a screen disagreeing inside the same panel.

**Widening it is the owner's call.** The argument for is real: "somebody joined your crew" is
arguably board-shaped — a membership, not an activity — and a rider who joins a crew has chosen to
be in it. If that is the decision, the crew tab's empty-state sentence needs rewriting in the same
change, because it would stop being true of the screen it is on.

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
still saying four until they happened to navigate. So the panel stamps and then asks for a fresh
layout, which keeps client state — the dropdown stays open, the tab does not move, the number goes.

**It does that only when there is something to clear and the read succeeded.** An opening at zero
unread makes no request at all: no write, no re-render, nothing. The first cut stamped on every
opening, so a rider pressing the bell out of habit paid a write and a full server re-render of
whatever page they were on to move a bookmark that was already past everything; and because the
loader fails soft to an empty list, a *failed* read would have walked the bookmark past news nobody
was shown. `WhatsNewLines` carries `ok` for the second half of that.

**No line is ever struck off or greyed**: this is what has happened lately, not an inbox, so "read"
changes the count and nothing else.

**The tab row is hidden for a rider in one crew** *(added by the T47 worker, 2026-09-17, pending
owner confirmation)*. §3.6 asks for "a `TabRow` of **You** and one tab per crew", and a rider in no
crew or one crew gets no row at all — the same call §3.1 makes for the sport chip, which is hidden
for a rider who tracks one sport, and for the same reason: a row of one is not a choice, and two
tabs where the second is the rider's only crew is a control that says nothing the screen does not.
It comes back the moment there is a second crew. Named here because it is a behaviour the spec does
not describe, not because it needs deciding.

**"Mark all read" is offered only when it would do something** *(added by the T47 worker,
2026-09-17, pending owner confirmation)*. At zero unread it reads "All read" and is disabled, which
is also what it says the moment it has been pressed, and `whats_new_read` fires only when the count
it cleared was above zero. Without that the button was live on an empty feed and on a bell already
at zero, and the event carried the same number as the `whats_new_opened` before it — because
opening had already stamped — so it measured nothing the first event did not. It now answers "how
many lines did a rider clear by hand", which is a different question from "how many did they have".

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

**The two rider-typed strings, named** *(added by the T47 worker, 2026-09-17, pending owner
confirmation)*. §3.6 and the plan both say "nothing typed by anyone appears", and that is not true of
any version of this screen: a **crew's name** and a rider's **display name** are free text, 2–40
characters, unmoderated, and both reach a You line — the crew name twice, since it is also a tab
label. The three other values dropped into a sentence are staff-entered catalogue rows: a sticker's
name, an event's name, a challenge's title.

The thing §6.1 is actually about still holds, which is why this is a correction to the sentence
rather than to the screen: the **frame** of every line is the product's, the two names reach only the
crew-mates who can already read them on the crew screen, a rider cannot aim one at a particular
person, and no line has a field a rider could put a sentence in. What would make this a messaging
channel is a sentence somebody wrote, and there is nowhere for one. `whats-new.test.ts` now passes a
crew name in as what it is — punctuation, an emoji and all — rather than as a catalogue string.

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
- **On a phone the filters fold behind one "Filters & sort" disclosure** (owner, 2026-09-17, in chat: "events page, this is all messy it needs to be cleaner and simpler proper sectioned"), the same control and the same `filterwrap` the trick library uses. Closed by default, with a count when something is applied; the desktop bar is unchanged. What is applied is always said above the list, so a folded panel never hides a narrowing.
- Fires `tabs_switched` `{ group: 'find', tab }`.

**The hub keeps its header at every width, and the two lists give theirs up by clipping it**
*(added by the T48 worker, 2026-09-17, pending owner confirmation)*. §3.7 asks for "Find / Where to
ride" on the hub and for `/spots` and `/events` to lose their eyebrow + h1 on the phone. Two things
had to be settled to build that. The hub is the group's *landing* screen rather than a list with a
lit tab above it, so nothing else on it says where a rider is — its header stays on at 390px. And
the two lists take the clip that the spot cards already use (`position: absolute`, 1×1,
`clip-path: inset(50%)`) rather than `display: none`, because the latter takes the `h1` out of the
accessibility tree as well as off the screen, and a phone screen with no heading at all is a worse
page than one with a redundant heading. On `/events` the clip goes on the header *row* rather than
on a wrapper inside it: `.page` is a flex column with an 18px gap, and a row that is merely empty
still collects a gap on each side — 36px of nothing, which is most of what hiding the heading was
meant to save.

**`/events/mine` keeps its title at every width, has no pills and no sport scope, and takes no
back link** *(added by the T48 worker, 2026-09-17, pending owner confirmation; amended after the
independent review of 2026-09-17, findings B1 and S3)*. It is the one screen in the group that the
Upcoming · Past pills cannot describe — they are each other's exact complement and a rider's own
events are neither — so the pills are not rendered there at all, and with the title clipped a phone
would show a list of events with nothing on screen saying whose they are.

**The sport scope does not apply to it either.** O1 sets a default for *a calendar of what is on*;
a rider's own events are a record of decisions they already made, and a filter over five rows can
only hide one of them. Measured before the fix: a rider down for two events across two sports
opened the screen and saw one. So `mine` is every sport, whatever is stored, and
`SportScopeSelect` is not rendered on it — the same treatment the pills get, for the same reason.

**And it carries no back link.** §2.3 asks a screen reached from somewhere else for one, and the
first cut gave this one "← For you"; but §2.3's examples are screens with no row above them naming
the parent, and here the Find tab row is there with "For you" lit. Two controls with the same words,
going to the same address, 40px apart on a phone is a thing a child has to work out rather than
read. The row is the back link. The calendar's own "You're down for N events" panel keeps its
"See yours →", which makes two doors into the route rather than the one the Mine pill used to be.

**A visitor's lists open on every sport, and are never offered "your sport"** *(added by the T48
worker, 2026-09-17, pending owner confirmation; independent review finding S1)*. §3.7's signed-out
line covers the hub and not the two lists. Signed out there is no sport chip — T45 hides the whole
right-hand group with the rider — and `useSport()` still answers with its first sport, so the first
cut opened a visitor's `/events`, `/events/past` and `/events/past/[year]/[town]` narrowed to
scooter under a control reading "Your sport (Scooter)". Three things were wrong with that and only
one of them is cosmetic: those are public, crawlable pages whose whole justification is a stranger
arriving from a search result; the words are a claim about somebody we have never met; and the
Upcoming pill above still read the unfiltered total over a narrowed list, so the screen disagreed
with itself.

So the scope control takes "is anybody signed in" as its own input. With no rider the chip is
`null`: the first option is not offered at all, a stored `'chip'` reads as the screen's default,
and both screens pass "every sport" as that default. `/spots` gets the same treatment in the same
change — its default was already "every spot", but a stored `'chip'` could have narrowed it the
same way, and one rule is better than one rule and an exception.

**"Coming up" opens on the reader's country and widens rather than emptying** *(added by the T48
worker, 2026-09-17, pending owner confirmation)*. §3.7 says "the next events" and does not say
whose. The calendar is two hundred-odd events across thirty countries and `/events` already opens
narrowed to the reader's own country for that reason (2026-09-12), resolved on the server from a
declared sign-up country or `Accept-Language`; a hub that led with a jam in Chile for a rider in
Corby would be a section nobody reads twice. Where that country has nothing upcoming in it the
section falls back to the whole calendar, because an empty panel reads as a product with no events
in it. A `.lab` line says which country when the narrowing actually held, and says nothing when it
did not, so it never claims a filter that is not on. Events the rider is already going to are left
out, so the hub does not print the same jam twice.

**The hub's rows send `from=list`, and the hub itself fires nothing new** *(added by the T48 worker,
2026-09-17, pending owner confirmation)*. §5 gives T48 one event, `tabs_switched`, and `TabRow`
fires it. The section links ("Mine →", "All spots →", "All events →") deliberately fire nothing:
`nav_clicked`'s `to` is a group id and its `where` is one of four fixed places, so a route pushed
into it from here would be a property invented at the call site, which is the one thing the
catalogue forbids. An event row on the hub links with `EventPageSource` `'list'` — the same value a
row on `/events` sends — rather than a fourth value, because the hub is a list of events and adding
one would be a catalogue change for a distinction nothing is asking about yet. What measures the
hub is `tabs_switched { group: 'find' }` plus the `spot_page_opened` and `event_page_opened` the
rows already land on.

**A stored scope arrives one render after the server's default** *(added by the T48 worker,
2026-09-17, pending owner confirmation)*. `SportScopeSelect` keeps its choice in `localStorage`,
which the server cannot see, so `useSportScope` is a `useSyncExternalStore` whose server snapshot is
the screen's default — no hydration mismatch, nothing that could throw the tree away (LESSONS §3a) —
and a rider who has chosen a scope on this device sees their list a moment after hydration. That is
the price of a per-device preference; it is deliberately not paid with a cookie, because a display
choice about which sports a list shows does not belong in a header sent with every request, and on
both screens the default is the wider list, so what changes after hydration is a narrowing rather
than a rider being shown somebody else's list first.

**The per-sport counts go with the pills, and `/spots` makes one query less** *(added by the T48
worker, 2026-09-17, pending owner confirmation)*. The multi-select's pills each carried a count
("BMX 210"), which answered "is it worth narrowing to this?" before a rider narrowed. A `<select>`
has no room for a number beside each option and an option that carried one would read as part of the
sport's name, so they are gone — and with them `countSpotsBySport`, which `/spots` called on every
load to compute them. `view.countBySport` stays on the events view, which is cheap and which
`/events/past` may still want.

**The scope select is 44px where the Country select it copies is about 32** *(added by the T48
worker, 2026-09-17, pending owner confirmation)*. §3.3 names the Country control on `/events` as the
precedent for the select treatment, and §4 says nothing tappable is below 44px. The precedent sets
the look and the floor sets the size; where they disagree the floor wins, because this control
replaced a row of pills a thumb could hit. `/events`' own Country select is left alone — it is not
this task's, and it has [issue #552](https://github.com/lekky/landit/issues/552) of its own.

**The scope select on its own line is a phone layout; the desktop has one filter bar** *(T48's
paragraph above amended, and the bar added, by the owner — Rachid, 2026-09-17, in chat: "bad layout
on screenshot", looking at `/events` at about 1740px)*.

T48 put `SportScopeSelect` on a line of its own under the search box on both lists, so that the same
control was not in two different places on two screens a rider crosses with one tap. **That reading
holds below 861px and is where it stays.** Above it, three full-width rows of controls — `Show [All
sports]` alone; `Country [UK]` with `Sort` a thousand pixels away at the right edge; the kind pills;
then the "Showing UK · See everywhere" strip — is four sparse bands before the first event. It reads
as a form to fill in rather than a bar to skim, and the two selects sat at different widths with
their labels on different lines.

So on a desktop `/events` is **one filter bar** under the search box: `Show`, `Country`, the kind
pills flowing left to right, and `Sort` pushed to the right-hand end by `margin-left: auto` —
because Sort is the one control there that is about the *list* rather than about what is in it. The
"Showing UK · See everywhere" strip stays beneath it. Between 861 and about 1200px the bar wraps;
the pills are a group (`.kinds`) so all five drop together rather than leaving one orphan on a line,
which is the failure mode a bare row of pills has.

**One set of markup, two layouts.** The phone's three lines come back out of the same row by giving
the scope select and the pill group a full-width flex basis below 861px, so the bar breaks at
exactly the two places it used to be cut. Nothing is rendered twice and nothing has to be kept in
step.

**And the pills go last on the phone, which took an `order`.** The bar reads sport → country → kind
→ Sort left to right, and taking that straight into the stack put the pill *group* between Country
and Sort — so Sort could never share Country's line, and the phone got a fourth row where T48 had
three. Below 861px the four take explicit `order` values with the pills last. Measured: the stack is
T48's three lines from 860 down to about 430, and at 390 and 320 Sort drops to a line of its own
because the Country select and the Soonest / Nearest pair genuinely do not fit beside each other —
which is the flex row measuring honestly rather than a layout choice. No width scrolls sideways.

**Heights and gaps are stated for the bar.** `additions.css` puts the 44px floor on `.pill` inside
its `@media (max-width: 860px)` touch block, so on a desktop the kind pills measured 35px beside two
44px selects — one bar, two control heights, which is half of what the owner was looking at. Both
lists now state the floor for their own bar at every width, rather than widening a merged shared
stylesheet for one screen's layout. The measure is a 14px column gap between controls against the
8px inside one, so a group reads as a group.

**`/spots` gets the same bar**, so the two lists read alike: the same gaps and the same 44px floor
over the row it already had (`Show`, Faves, the feature and area pills, then the location controls
at the right). Its order and contents are unchanged — this is the measure, not a rearrangement.

### 3.8 Trick page (D7)

Phone order *(amended by the owner, 2026-09-17)*: BackLink → hero band (**the award badge**, category
tag, difficulty, name, one-line lowdown) → the yellow "Can you do it?" band with the `StagePicker`
and Share → **"Watch it"**, full width, where the trick has a tutorial → **`Accordion`** rows for The
lowdown, Tips, What you need, The road to it, Where to practise, Your history / notes / clips → More
like this. **Desktop is the same order**, so the page has one shape to learn.

*It was a **sticker + video row** directly under the name (D7), with the badge in a paper card
carrying "Earned &lt;date&gt;" or "Land it at Sometimes". The row is gone, the badge is the hero's
again, and the card's two lines are on no screen — see D7 and "the ladder below the fold", which
this is the answer to.*

**`Accordion`** (new, `packages/ui-web`, additive) — a row (3px keyline, `--sh-sm`, paper, `min-height: 56px`) with a Barlow Condensed 16px title, an optional 13px sub-line and a chevron that rotates 180° over 120ms; the body opens with `grid-template-rows: 0fr → 1fr` over 200ms ease-out. `<details>`/`<summary>` underneath for no-JS and accessibility. Open state is not persisted. Desktop does not use it: the page keeps its two columns and plain panels, with the badge in the hero and the video under the ladder (owner, 2026-09-17).


**What "the sections" turned out to be, and where the three the list does not name went**
*(added by the T49 worker, 2026-09-17, pending owner confirmation)*. §3.8 names six rows — The
lowdown, Tips, What you need, The road to it, Where to practise, Your history / notes / clips — and
the page has twelve sections. The rest are rows too, keeping the titles they already had, because a
page that is eight rows and four loose panels is neither a list nor a page. So the phone order is:
The lowdown, Tips, Why it isn't working, What you need, The road to it, Where to practise, Where it
sits, Same trick other sports, and the rider's own. Three exceptions, each for its own reason:

- **The fun fact is inside The lowdown** rather than a row of its own. It is two lines about the
  trick, which is what the lowdown is, and a chevron guarding a sentence is a chevron that costs
  more than it saves.
- **The guardian line is outside the rows altogether**, full width under the band at both widths. It
  is the one thing on this page written for a grown-up, and a safety note behind a chevron is a
  safety note nobody opened. It was in the reading column beside the kit; it is now on screen at
  both widths without anybody pressing anything.
- **"Your history / notes / clips" is one row, not three**, holding the history timeline and the
  notes-and-videos panel. It is the row `#clips` names, and the slashes in §3.8's own title are what
  say it is one thing. The rider's *sessions* on the trick were briefly in there too and are not:
  see "the rider's sessions are not in it" below.

**The lowdown opens with the page; everything else is shut** *(owner, 2026-09-17, in chat)*. §3.8
says the open state is not persisted and does not say what the first paint looks like. The T49
worker shut everything, on the argument that a hero, a band and then nine names is the short scroll
the rethink is for. The owner opened the first row: it is the one that answers "what is this
trick", and a rider who came to find out should not have to press anything. The rest stay shut,
because opening them all is the scroll the rows replaced.

**§3.8's "Clip" is drawn as "Video", and the fragment stays `#clips`** *(added by the T49 worker,
2026-09-17, pending owner confirmation)*. The third jump button and the row it points at use the
word this page already uses. Plan §6.6 withdrew the clip vocabulary from the trick page when clip
hosting was reversed; T15b's rider-video panel came back as **"Your videos"**, and
`e2e/library.spec.ts` has asserted the absence of the word on this page ever since — deliberately,
as the tripwire that notices a vault reappearing. Putting "Clip" on a 44px button would have meant
loosening that assertion to gain a word no rider is waiting for. The **address** is untouched:
`#clips` is what T45's Log sheet pushes, and it is an address rather than something anybody reads.
*The independent review of 2026-09-17 agreed and recommended keeping "Video": the line in §3.8 above
is the one that wants correcting, and that is the owner's to make rather than a worker's.*

**And `#clips` lands on the videos tab** *(added by the T49 worker, 2026-09-17, after the
independent review, S4; the row that produced it removed by the owner later the same day)*. §3.5
item 4 said the row "opens the trick picker limited to landed tricks, **then the existing
video-link field on the trick page**", and the first cut arrived with the notes form showing and
the field a rider had pressed for one unlabelled tap away. `LogPanel` reads the `#clips` fragment
on the load and on a `hashchange`, and opens on Your videos; every other arrival still opens on the
notes. The behaviour stays now the sheet's row is gone, because `#clips` is still a valid address
for that row — it simply has no producer inside the app.

**The ladder is the band's own, not `StagePicker`** *(added by the T49 worker, 2026-09-17, pending
owner confirmation)*. §3.8 says the yellow band carries "the `StagePicker` and Share". The band has
never used that component and `trick.module.css` says why: the ladder needs a third state for the
stages a rider has already passed, which `StagePicker` does not have, and widening the shared
component for one band would change how the dashboard and the design gallery draw (CLAUDE.md step
5). T49 reorders the page; it does not rewrite the one control on it. Read §3.8's `StagePicker` as
naming the stage ladder rather than the export.

**The row is above the band at both widths** *(added by the T49 worker, 2026-09-17, pending owner
confirmation)*. §3.8's desktop sentence says the sticker + video row is "above the ladder in the
left column", and the ladder is a full-width band with no column to be in. D7 settles it — "the
sticker and the video share one row directly under the name, then the stage ladder" — so the row is
full width under the hero at every width, two equal columns of it, and the band follows. Equal
columns rather than a badge-sized track and the rest, because a 16:9 player given two thirds of a
1180px page is 440px tall and pushes the band — the only control on this page — off the first
screenful.

**What the row costs, measured three times: the cap, then the stack** *(added by the T49 worker,
2026-09-17, pending owner confirmation; the desktop numbers corrected and the cap added after the
independent review's S5, the phone numbers corrected and the conclusion rewritten after its second
pass, L1)*. D7 puts a card-height row between the name and the ladder, and the first cut of it took
the yellow band a long way down the page. The independent review measured it and found the cost was
**two costs, not one**: the band only fell below a 1280 × 720 fold on a trick with a **curated
video**, which is a minority today and a growing one, and not on the videoless majority.

Top of the band, page coordinates, `main` against this branch at each of the three shapes:

| | `main` | first cut | with the cap | with D7a's stack |
| --- | --- | --- | --- | --- |
| 1280 × 720, with a video | 291 | 785 | **665** | 665 |
| 1280 × 720, no video | 291 | 527 | **519** | 519 |
| 390 × 844, with a video | 312 | 554 | 573 | **760** |
| 390 × 844, no video | 312 | 480 | 464 | **419** |

On the **desktop** the player is capped: a **360px track** takes the frame from 506 × 316 to
328 × 205 and the band from 785 to 665, which is 55px of yellow on screen at 720 rather than none.
328 × 205 is not a small player — it is exactly the size `main` gave the same tutorial on a phone —
and the arithmetic does not allow better: a 16:10 frame under this hero cannot leave the whole 79px
band above a 720px fold without shrinking to about 224px wide, which is a worse trade than the one
it fixes. The toast overlap the review found at 785 (S5) goes with it. D7a changed nothing here.

**On a phone D7a moved the cost rather than removing it, and this is where it landed.** Stacking
gives the tutorial back 85% of the area it has on `main` (302 × 189 against 132 × 83) and costs the
band the height of the second card. Measured against the **effective** first screenful — the
viewport less the fixed bottom bar, which is what a rider actually sees — on a trick **with** a
curated video:

| phone | band top | usable above the bottom bar | band visible |
| --- | --- | --- | --- |
| iPhone SE · 375 × 667 | 788 | 604 | **none** |
| Galaxy A · 360 × 740 | 777 | 677 | **none** |
| iPhone 13 · 390 × 844 | 760 | 781 | **21px of 84** — the "Can you do it?" strip, no stage buttons |
| Pixel 7 · 412 × 915 | 757 | 852 | all 84 |

So the honest sentence is not the one this paragraph used to end with. **On a trick with a curated
video the band is one short scroll down on the smaller phones**, and entirely off the first screen
on two of the four; without a video it is on the first screenful everywhere (419). Nothing is
hidden, nothing is unreachable, and the video is what a rider opened the page to see — but the
rethink's stated priority is the phone, and D7a was chosen on the strength of the older, stale
version of this table, so the number is written down here rather than left to be rediscovered.

**Two levers, and both are the owner's.** Moving the compact sticker card **below the band** on a
phone recovers about **140px** (band to roughly 620, fully visible on three of the four phones
above); capping the phone frame's **height** recovers about **50** more. On a 667-tall phone with a
top bar, a full-width player and a bottom bar, nothing gets all of it back. Neither is done here:
D7a says video first and the row is the owner's shape, and moving a card past the band is a third
arrangement rather than a correction to the second.

**Desktop is the same markup, held open** *(added by the T49 worker, 2026-09-17, pending owner
confirmation)*. §3.8 says "Desktop does not use it", and one server render cannot know the width, so
"does not use it" is built as `Accordion`'s `plainAbove={820}`: above that width every row is held
open, the chevron goes, the summary stops being a control and the trick page's own stylesheet
repaints the head as the 2026-09-07 pack's diamond-and-rule heading. 820 because that is where the
page's two columns already begin, so there is one number for "is this the wide page" rather than two
that could disagree by a pixel. The width is read after hydration, so the desktop half of that
repaint is written into the page's media query as well — otherwise a wide screen meets a page of
headings with nothing under them for one frame.

**"Stops being a control" is three things, and the first cut had one of them** *(added by the T49
worker, 2026-09-17, after the independent review, S3)*. It stopped *responding* — `plain`
short-circuited the handlers — while staying `tabIndex 0` and announced as a disclosure, so a
keyboard rider on the desktop trick page tabbed through seven stops drawn as plain headings that did
nothing when pressed. It now takes `tabIndex={-1}` and `pointer-events: none`, with the chevron and
the press already gone, so the row is a heading at that width in every sense a rider can test.

**On paper, every row is open** *(added by the T49 worker, 2026-09-17, after the independent review,
S1)*. A printed page's media queries evaluate against the **paper** — about 816 CSS px for A4 at
96dpi — which is *below* any `plainAbove` a caller is likely to set, so a trick page printed from a
desktop came out as nine headings and 595 characters against `main`'s 2083. `additions.css` carries
an `@media print` block that opens the grid row and restores `content-visibility`. A coach or a
parent printing a trick is exactly who the trick page is for, and the product already treats
printing as real (Progress's printable sheets).

**The phone stacks the two cards, video first** *(D7a, Rachid, 2026-09-17, in chat, answering the
question the independent review raised as B2)*. D7 says the sticker and the video share one row and
§3.8 repeats it, and neither said what a *phone* does with that row. Two attempts said "two columns",
and both cost the tutorial more than the arrangement was worth. Measured at 390 on the same trick:

| | video frame at 390 | share of `main` |
| --- | --- | --- |
| `main` (panel at the top of the reading column) | **328 × 205** | — |
| first cut, two equal columns | **132 × 83** | 16% |
| second cut, 0.8 / 1.2 in the video's favour | **164 × 102** | 25% |
| **stacked, full width** | **302 × 189** | **85%** |

So below 820px the cards stack, with the **video first** — which is what the 2026-09-12 instruction
("the owner asked for prominence where there is a video") asked for, and what a rider opened the
page to see — and the sticker card under it drawn **compact**, its badge beside its two lines rather
than over them: 122px tall against the 257 the stacked card was, which is 135px of the band's height
bought back. Measured at 390 the band's top is **760** against an 844 viewport (**419** without a
video), and nothing overflows sideways at 320, 360 or 390. *What those two numbers mean for the
smaller phones is the paragraph above — on a trick with a video the band is one short scroll down
there, and the compact card is what stops it being further.* With no video the sticker card is
simply the one card, as D7 already says. **Above 820px nothing changes**: the row is exactly as D7
drew it, with the player capped at a 360px track (see the measurements above).

The `@container (max-width: 260px)` rule in `video.module.css` stays, and still bites in three
measured places: the trick page's own card at **320px**, where a full-width frame is 232; the rider
profile's video wall (`auto-fill minmax(220px, 1fr)`, 215px frames); and the two-column link grid
just above 520px, at about 240. It is a rule about a size rather than about a layout, which is why it
survived the layout that first met it. The four overrides that propped up a 158px card's foot are
gone with the 158px card.

**"Your history / notes / clips" is one row; the rider's sessions are not in it** *(added by the T49
worker, 2026-09-17, pending owner confirmation; corrected after the independent review, B3)*. The
first cut read §3.8's slashes as "everything of the rider's, together" and put the
sessions-on-this-trick block inside that row — which is the **last** row of the **second** column,
so the block went from high in the reading column to the foot of the page and behind a chevron. That
reverses a dated instruction: "the rider's own sessions on this trick, high in the reading column
rather than near the foot of it (Rachid, 2026-09-13, in chat) … a rider scrolled past everything the
page could teach them to reach the one part that is theirs." The first cut also deleted the comment
that recorded it.

So the block is **its own row, first**, at both widths: "Your sessions on this trick", with
`trickBlockMeta`'s "6 sessions · first tried 2 Sep" as the sub-line, above The lowdown on a phone and
first in the left column on a desktop. It is drawn only when there is something in it, and the count
that decides is read once per request and shared with the block (`trickSessionsForOwner`, `cache`d),
so a rider the sessions preview does not cover pays for nothing. The `#clips` row keeps the history,
the notes and the video links — the three that really are one thing — and the 2026-09-13 provenance
is back in a comment beside the row.

**The title is a heading, and `<summary>` is where it goes** *(added by the T49 worker, 2026-09-17,
pending owner confirmation)*. §3.8 gives the row "a Barlow Condensed 16px title" and does not say
what element it is. It is an `h2`: the page's twelve `SectionHead`s were twelve `h2`s, and turning
them into spans would take the document outline away from exactly the rider who most needs it — a
screen reader moves between sections by heading, and there would have been none. `<summary>`'s
content model allows heading content, so this is the native element's own provision rather than ARIA
laid over it; the sub-line sits inside the heading, so a row is announced as "The road to it, 3
steps".

### 3.9 Account

**`SettingsList` / `SettingsRow`** (new, `apps/web/src/app/(app)/account/`) — rows of 60px: a 40px icon square with a fixed fill, a 16px title, a 13px sub-line showing the current value, a right-pointing chevron. Seven rows: Your profile · What you ride · Who can see your profile · Who sees new sessions (when enabled) · Plans and billing · Coach / parent view · Your data. Phone: each row is a link to its own screen (`/account/profile`, `/account/sports`, `/account/privacy`, `/account/sessions`, `/plans`, `/coach`, `/account/data`), which is the existing panel on its own page with a "Your account" back link. Desktop: the list is a 340px left column and the chosen panel renders on the right; the URL still changes so a link lands on the right panel.

**The eighth row is "Your guardian", and it goes first while it applies** *(added by the T51
worker, 2026-09-17; the row itself is Rachid's, 2026-09-16, in chat)*. §3.9 lists seven rows and
the guardian panel is not one of them — which would have left the consent gate's only control with
no way in from a screen that is now a list, on the one account most likely to need it. The owner
added it. Where it goes was left open, and it goes **first**, above Your profile, because the
screen it replaces put the panel above everything for the same reason: a rider held behind the gate
has one thing to do here and every other row is a setting they can come back to. Measured fifth in
the list on a 390px phone it sat below the fold behind the bottom bar.

It is drawn for `pending` and `revoked` — `isConsentLimited` — and for nobody else, because the
panel behind it is written to a rider waiting on a grown-up or told no and has nothing to say to a
rider whose account was never gated or whose guardian has already said yes. `/account/guardian`
asks the same question rather than trusting that nobody typed the address, and answers a rider it
is not about with a **redirect back to the list**: not a 404, because the screen exists, and not an
error, because they have done nothing wrong. `/account/sessions` gives a rider outside the sessions
preview the same answer, for the same reasons.

**And the panel itself is still on `/account`, under the lede, while the gate applies** *(added by
the T51 worker, 2026-09-17, after the independent review; pending owner confirmation)*. A row
first in a list is a signpost, and putting the gate behind one is only an improvement if the child
is standing where the list starts — measured on the first cut at 390px, the row's top was **450px
down**, behind the eyebrow, the heading, the lede and the whole identity card, with the email field
a tap beyond that. On `main` a gated child's first screen carried the field. It carries it again:
`GuardianPanel` renders directly under the lede for `pending` and `revoked`, exactly where it was,
and the row stays as well. Two places, one panel, and it is not a value shown twice — the panel is
the ask, and the row is the way back to it once the screen has been scrolled past. Both disappear
the moment a grown-up says yes. *(Whether a gated rider should see the identity summary underneath
it at all is a smaller question and the owner's, and it belongs on the rethink's own tracking issue,
[#541](https://github.com/lekky/landit/issues/541), rather than in this paragraph.)*

**The sub-line is the current value, and it is a catalogue fact every time** *(added by the T51
worker, 2026-09-17, pending owner confirmation)*. §3.9 says "the current value" and does not say
what may be one. The rule the list is built to is the analytics catalogue's: a privacy setting's
label, the sports' names, the plan's name, the word for a consent state — all rows in
`@landit/core`, written by this repository. **The written goal is deliberately not on any row**,
which is the one value on the old screen a rider could have typed; "Your profile" reads its level
and stance instead. A settings list is read over a child's shoulder more often than any other
screen in the product. Two rows carry a fixed sentence rather than a value, because what is behind
them is not a setting with a state: Coach / parent view and Your data. Every sub-line is short
enough to finish inside the 340px rail rather than be clipped, which `accountRows.test.ts` pins.

**The panels moved and did not change, which cost each of them one display prop** *(added by the
T51 worker, 2026-09-17, pending owner confirmation)*. §8's T51 row says the panels move; two things
follow that the section does not mention.

- **`ProfilePanel` is two of the eight rows** — "Your profile" and "What you ride" are its two
  halves — and it is still **one component**, drawn with a new `section` prop. Not split in two,
  because `saveProfileAction` writes the *whole* profile on every change: a component owning only
  the sports would post a profile with the other five answers missing, and the first tap on
  `/account/sports` would wipe a rider's goal, stance, level and picture. Both screens therefore
  hold the whole draft and show part of it.
- **And the goal picker goes to the sports screen when a toggle takes the goal, rather than the
  rider going to it.** Turning a sport off can orphan the goal that belonged to it; T23's rule is
  that the panel then holds the *whole* change — the sport and the goal it forced — until there is
  a complete answer, and writes both in one post. That rule needed the two controls on one screen,
  and the first cut of this task did not notice: it sent the rider to `/account/profile` with a
  "Pick a new one →" link, the route change unmounted the panel holding the pending draft, and the
  sport change was **discarded without a word**. Measured: a rider turned Skateboard off, picked a
  new goal, saw "Saved", came back, and Skateboard was still on. So the picker is drawn inline
  under the sport cards for exactly as long as the rider is without a goal, over the same draft, and
  the single post happens as it always did. The link is gone — it was also being drawn for *every*
  incomplete answer, so an unset level read "Tell us roughly where you are at. Pick a new one →".
  `e2e/profile.spec.ts` covers the whole flow, including that both halves survive a reload.
- **The other panels take `headed`**, which drops the label they draw for themselves. The screen's
  own `h1` is already those words, and the alternative is the same four words twice, 20px apart, in
  two sizes. It defaults to drawing the label, so nothing that has not asked has changed.
  `SessionVisibilityPanel`'s label is *clipped* rather than removed, because it also names the
  radio group (`aria-labelledby`) and `display: none` would take the group's name with it.

**Two things the sub-screens do not wear, and what is left on the list's own column** *(added by
the T51 worker, 2026-09-17, pending owner confirmation)*.

- **No eyebrow.** Every other screen in the product has one; here it would read "YOUR ACCOUNT"
  directly under a back link reading "← YOUR ACCOUNT", two identical lines of the same small caps
  6px apart on a 390px phone. On a desktop the list is on the left with the row lit, which says it
  better. The parent is named once, by whichever of the two the width has drawn — and the back link
  is therefore hidden above 861px, the call T48 made on `/events/mine` for the same reason.
- **Sign out, the staff portal's door and "Still on its way" are at the foot of the list column,
  and only at `/account`.** None of them is a setting about this rider, and on a phone the column
  *is* the `/account` screen — so they end up exactly where they were, under everything. The last
  clause of this bullet used to read "while a rider on `/account/privacy` is not offered a sign-out
  button beside a radio group", and above 861px that was **false**: the list column is drawn at
  every address, so every sub-screen had a SIGN OUT button 360px from its control. `AccountShell`
  draws them only at the root now, at both widths, which is what the sentence always described.
- **The route group is `account/(settings)/`**, so `/account/close` keeps its own page and its own
  shape untouched. Closing an account is a page a rider goes to on purpose (2026-09-12, owner in
  chat) and a settings list beside it would be this task redesigning the one screen it was told to
  leave alone. The group contributes nothing to the URL. `/account/close`'s "Download your data"
  link follows the panel to `/account/data`, because a rider sent to a list of eight rows to find
  the download is a tap worse off than before.

**On a desktop `/account` itself shows who you are, rather than "pick something on the left"**
*(added by the T51 worker, 2026-09-17, pending owner confirmation)*. §3.9 says the chosen panel
renders on the right and does not say what is there when none is chosen. The summary is: the
rider's picture, handle, country, sports, plan tag and a link to their crew — the header the old
screen opened with, and nothing on it is a control. On a phone it is the top of the same screen,
above the rows, which is the order a rider wants: who you are, then what you can change.

Three corrections to it, from the independent review. The card does **not** print the rider's name,
because the `h1` 60px above it already is their name — the same duplication the sub-screens dropped
their eyebrow to avoid. Its plan tag reads `PLAN[id].name` rather than the stored id, so a paid
rider is not told "shredder" beside a row saying "Shredder". And **"Your crew" is back**: `main`'s
"Your profile, and who it is for" panel carried three links, the public profile moved to
`/account/privacy` and the coach view became a row, and this one was removed with nothing said
about it. The cost was small — Crew is a cell in the bar at every width — but a link deleted in
silence is a link nobody decided to delete. *(The coach view's reassurance that "it is not shared
with anyone and there is no separate login for it" went with that panel and has not come back:
`/coach`'s own lede says the same thing on the screen it is about. That one is a deletion this
paragraph is naming rather than reversing.)*

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
- **Session form** — three steps on the phone via `TabRow` (When & where · What · Notes) with Next / Save; "What you rode" is **one row** — the sport tag and a quiet "Change" link on the same line, not a panel with a boxed button (owner, 2026-09-17: "what you rode panel is a bit messy"). The aim is a **textarea**, not a single line (same date). **Where** takes a spot from the map *or* a place the rider typed — "Can't find it? Type where it was" under the search results, saved to `sessions.spot_name`, rendered as words with no page behind it (owner, 2026-09-17: "free text ones obviously don't link to a page after"). Desktop: the same three steps inside the modal, step one as two cards side by side.
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

**The scope and the event pill are two controls, and the stat blocks are the sidebar's numbers**
*(added by the T50 worker, 2026-09-17, pending owner confirmation)*. Three things §3.10's line
decides without saying so.

- **"At an event" stops being an alternative to a sport.** The row it leaves was one `aria-pressed`
  group — All · Scooter · BMX · At an event — so "BMX" and "At an event" were answers to the same
  question and "my BMX jam sessions" could not be asked for at all. With the sport on the select and
  the pill on its own, both hold at once (`sessionListFilter`). **Both reset the pager**, as the one
  row did: a rider on page 2 who widens the scope to "All sports" is looking at page 2 of a longer
  list, so the newest sessions in the sport they just added are on the page above and they are never
  shown them (review S2). And the pill is drawn at 44px rather than 28, because it is now the only
  pill on a line with a 44px control instead of one of five identical chips (review N1).
- **`StatBlock` is Home's, not a `packages/ui-web` export.** §3.10 names it and the only one in the
  product is a local function in `HomeScreen`. This screen draws its own in the same treatment — 3px
  keyline, 3px offset, a fixed fill, an Anton number over a `.lab` — rather than lifting Home's into
  shared code, because two screens is not yet a component and `ui-web` is additive-only shared code
  in a wave three siblings are building on.
- **The numbers are `view.sidebar`'s**, so the blocks and the desktop's ink month card can never
  disagree: this month on the rider's clock, counted on the server, not a sum over whatever the feed
  is currently filtered to. The blocks are drawn below 700px only and the sidebar above it, so
  neither width is told its month twice, and the phone's three (sessions, time, moved up) are three
  of the card's four — "spots ridden" is the one that did not make the cut, because a rider who
  logged four sessions at one park learns least from it. *(The first half of this bullet is
  reversed below: the blocks follow the scope now.)*

**The phone's three blocks are the scope's month, not the account's** *(added by the
integration-pass worker, 2026-09-17, pending owner confirmation; it reverses the last bullet above)*.
The bullet chose "counted on the server" over "a sum over whatever the feed is filtered to", and the
screen that produced read "3 SESSIONS · 3H · 1 MOVED UP" and then, an inch below it, **"No
sessions"** — measured on a rider with three scooter sessions and the chip on skate. A number
directly above a list it does not describe is not a more authoritative number, it is a screen
disagreeing with itself, and the blocks are drawn *for* the feed under them.

So they are the same `sessionMonthSummary` the server runs, over the same filtered list. It is the
first of the finding's two options and it is both cheap and exact: the diary's loader reads **every**
one of the rider's sessions and the paging happens in the browser, so the month is already in hand
and nothing is fetched. Two things stay account-wide on purpose. The **quota strip** below, because a
monthly cap counts sessions and not sessions of one sport, and narrowing it would tell a rider they
have more of their allowance left than they do. And the **desktop sidebar's** ink month card, which
is not this correction's — it carries the streak, the quota and "where you ride" beside the four
numbers, and scoping only some of what is in one card is a second decision. That leaves the two
widths answering differently until somebody settles it:
[issue #570](https://github.com/lekky/landit/issues/570).

**`ProgressTabs` and the screen's title** *(added by the T50 worker, 2026-09-17)*. The header is
this task's, as the T46 paragraph above says. `/progress/sessions` now reads **Sessions** under the
Home back link, `ProgressTabs.tsx` and its module are deleted with the last screen that drew them,
and the page title drops "· Progress". The asymmetry T46 recorded is closed by the Home cards being
the route to both screens rather than by either linking to the other.

**What the three steps hold, and which one a refusal lands on** *(added by the T50 worker,
2026-09-17, pending owner confirmation)*. §3.10 names the steps and not their contents. The cut is
the handoff's own phone order, 1c, in three contiguous pieces — nothing is resequenced, so a rider
who knew the long form meets the same fields in the same order with two page breaks in it:

1. **When & where** — when, how long, where, and the "is on here today" event band.
2. **What** — what you rode, the aim, the tricks.
3. **Notes** — how it felt, the weather, notes, who you rode with, the clip, who can see it.

"How it felt" is on Notes rather than What because it is a thing a rider *says* about the ride
rather than a thing they did, and because **it is the one required field that is not on step one**:
putting it on the step with Save means the refusal is beside the control. The steps apply **at every
width**, which is what §3.10's "the same three steps inside the modal" asks for, so there is one
component tree and not a phone one and a desktop one.

Six consequences, each of them a decision the section is silent on. The last three were found by the
independent review of 2026-09-17 and are recorded here with the rest:

- **Next validates its own step and Save validates everything.** `formProblems` runs over the whole
  values object either way — it is the one place that knows the rules — and Next keeps only the
  answers belonging to the step in front of the rider. Without that, a rider fills three steps and
  is thrown back to the first for a spot they never picked; with it, they cannot walk past the
  problem in the first place.
- **A refusal lands on the step that can fix it** (`stepForField`). This is the stepped form's one
  new way to be wrong: a message about a control two steps behind the rider is a message nobody can
  act on, and it applies to the server's refusals as much as the browser's.
- **The header's button follows the footer's.** Two primaries saying different things would be a
  form arguing with itself.
- **Next is for a *new* session only; an edit saves from whichever step it is on** (review S1). The
  argument for stepping is "twelve fields in one scroll", which is a problem a blank form has. An
  edit arrives with every field filled and already valid, and the rider is there to change one word
  — so making them walk to the third step to find Save, past two buttons pointing the other way,
  was a change to a shipped screen that nothing asked for. `isEdit` rather than `mode === 'edit'`,
  so it covers the session a quick log just saved and a prompt reopened.
- **The saved state's three "while it's fresh" prompts set the step, not only the scroll** (review
  B1 — a blocker). On one long form every anchor was always in the document; with three steps only
  the open step's cards are rendered, so a rider who pressed "A clip" landed on When & where with no
  clip field, no message and a button reading Next. `stepForSection` maps the three prompts onto
  their steps — `tricks` and `notes` to What, because `#session-notes` is the **aim** card, which is
  where `main` scrolled to as well, and `clip` to Notes — and the scroll effect waits for the step
  as well as the stage.
- **A step change moves focus to the panel, which is named by its tab** (review S3). The whole panel
  is replaced, so a rider on a screen reader who pressed Next heard nothing and had to walk
  backwards through the document to find out whether anything had happened; the panel takes
  `tabIndex={-1}` and is focused on a change but not on first render. It is `aria-labelledby` the
  tab rather than `aria-label`led with the tab's words, because **that is ARIA's tabs pattern**: a
  `tabpanel` is named by the tab that controls it, and a name that references its source cannot
  drift from it the way a copied string can. `TabItem` and `TabRowItem` gain an optional
  `elementId` for that — it is what makes the reference possible, since a panel cannot point at an
  element with no id — and it is additive: a row that passes none renders exactly what it did.
  **It does not remove the duplicate name**, and was never going to: the third step is called Notes
  and so is the textarea inside it, so two elements answer to "Notes" before and after. A query has
  to pick by role, which is what `e2e/session-form.spec.ts` does. Renaming the step or the field to
  separate them would be a copy change to §3.10's own words, so it is not made here.
  *(Arrow-key navigation inside `Tabs` does nothing, on all nine `TabRow` users. That is shared and
  pre-existing — [issue #565](https://github.com/lekky/landit/issues/565).)*

And one smaller thing: **the revealed sport picker has a "Keep <sport>" way out** (review N4).
Without it the only exit is to pick something, and picking the sport already showing is what tells
the form the rider answered this themselves — so "never mind" would quietly stop the top bar's chip
leading the field.

**`?sport=` becomes the glossary's default rather than its address, and the per-sport counts go**
*(added by the T50 worker, 2026-09-17, pending owner confirmation)*. The row the select replaces
wrote `/glossary?sport=skate` on every press, deliberately, "so it can be linked and bookmarked like
`/library?mine=1`". That cannot survive as written: the scope is a per-device choice the server
cannot see, and `'chip'` — the option that tracks the top bar — has no address at all, because its
answer changes when the chip does. So the param is read on the server as the screen's **default**,
which keeps an old link or bookmark working for a reader with nothing stored on this device, and
the control no longer writes it. `glossarySportHref` is deleted with the row that was its only
caller. The tabs' per-sport counts ("Skate 31") go for the reason T48's paragraph in §3.7 gives:
a `<select>` has no room for a number beside each option, and one that carried it would read as
part of the sport's name.

**The glossary reads `signedIn` on the server** *(added by the T50 worker, 2026-09-17, pending
owner confirmation)*. It is public and crawlable, so it takes the T48
rule in §3.7 without exception: with no rider the first option is not offered and the page opens on
every sport. `currentRider()` is called in `page.tsx` — the same second read `/events` and `/spots`
already make for the same control, on a route group whose layout resolves the rider anyway.

**Crew's three tabs are on at every width, and §7's desktop cell is the older
sentence** *(added by the T52 worker, 2026-09-17, pending owner confirmation)*. §3.10 asks for a
`TabRow` of Board · Activity · Members and §7's desktop column still says "board left, activity
right", which is the layout the screen had. Only one of the two can be built, and the row wins on
three counts. §3.3 lists Crew among `TabRow`'s users with no width on it, as it lists Progress and
Stickers, and both of those are tabbed at every width since T46. A row that existed only below
860px would leave **Members with nowhere to be** on a desktop, since the desktop layout §7
describes has two panels and Members is a third. And the phone — the device this rethink is for —
read the old grid as one long scroll with the activity underneath the board, which is what the
tabs are for. So the `1fr / 340px` grid goes and one panel is on screen at a time.

**Members is the board's own rows without the ranking** *(added by the T52 worker, 2026-09-17,
pending owner confirmation)*. §3.10 says "the existing members list", and there was not one: the
board *is* every member, ranked, with two scores each. So the third tab is the same payload drawn
as a roster — avatar, name, sports, and the one fact the board has never shown, which of them
started the crew. **It reads nothing new.** Those rows come from
`GET /api/landit/crew-board/{crew}`, the single route allowed to name a rider whose profile is
private, to a crew-mate, by name and score (plan §3 guarantee 1). A Members tab that reached for
`users` instead would quietly list the public riders and drop the private ones; one that showed
activity would show more than the feed beside it, which is the line
`pocketbase/hooks/85_crews.pb.js` draws in a comment. `e2e/crew.spec.ts` puts a private rider in a
crew and asserts both halves.

**The tab carries no count** *(added by the T52 worker, 2026-09-17, after the second review pass —
nit 10)*. It did: `TabRowItem`'s `note`, which exists to give a rider a reason to press a tab —
"Not yet 118" is a wall worth opening where "Not yet" is a word. Here the reason was already
answered ten pixels above it, because the header reads "Ramp Rats · 3 riders". One number, once, and
the tab is the word. There is no search on it, nothing to press but a rider's own profile,
and no way to reach a crew from it — §6.1 is a fact about what this tab does not render.

**The crew's two ghost buttons are 44px at every width** *(added by the T52 worker, 2026-09-17,
after the independent review — finding 4)*. They measured 36px at 1280 and 44px on a phone, under a
comment claiming `.btn.sm` already gave them the floor. It does not: `additions.css` raises `.btn`
to 44px only inside its coarse-pointer block, so the floor arrived with the pointer rather than with
§4, which has no width on it. The spot page's action row in this same task states its own
`min-height` for that reason and these now do too. "Invite a mate" and "Leave crew" are the same
miss and are **not** changed here — they are not this task's, and they are listed with the rest of
the screens' pre-existing under-44px controls in
[issue #567](https://github.com/lekky/landit/issues/567).

**"Start another" and "Join with a code" open one at a time, and keep the ceiling they had**
*(added by the T52 worker, 2026-09-17, pending owner confirmation)*. §3.10 asks for two small ghost
buttons revealing "the existing forms"; they reveal one each, because the two are alternatives — a
rider is either starting a crew or redeeming somebody's code — and a phone that opened both put two
forms and four controls under somebody who wanted one. The pair is still drawn only while the rider
owns fewer than `MAX_OWNED_CREWS`, exactly as the `<details>` was: joining is not capped by the
server, but widening what the screen offers is not a change this task came for.

**A rider profile's Videos tab is not drawn when there is nothing on the wall** *(added by the T52
worker, 2026-09-17, pending owner confirmation)*. `VideoWall` renders nothing rather than saying
"this rider has videos you cannot see", because a count of what you may not see is information
about a choice somebody made — and an empty list is the same answer for a rider with no clips and
for a viewer the `clips` rule refused. A tab that was always there would put that sentence back one
level up. So the row is Landed · Stickers for most riders and gains Videos where there is something
to show, which is the call §3.1 makes for the sport chip at one sport and §3.6 for What's new at one
crew. **Two panels stay off the row**: "Who sees this" is about the profile rather than a view of
it, and "Getting in touch" is the OSA route to a person (plan §6.1) — a safeguarding link a reader
has to find the right tab for is a safeguarding link that is not there.

**A rider's own sticker wall shows twelve badges where it showed six** *(added by the T52 worker,
2026-09-17, after the independent review — nit 8)*. The wall was a 300px side panel three badges
across, so six was two rows; the tab has the full width and fits four or five across, so six was a
row and a half of a panel with room for three. Twelve is two full rows at every width this screen
has. It is a content change and it was not named anywhere, which is what the nit was about — the
whole wall is still one tap away at `/stickers`, and somebody else's is still a count rather than
the art.

**The tab panel renders one node, not three with two of them `null`** *(added by the T52 worker,
2026-09-17, after the independent review — finding 3)*. The review reproduced a React "unique key"
warning on the Stickers panel — "Check the render method of `ProfileTabs`. It was passed a child
from `RiderProfilePage`" — five times out of five for any rider with something on their wall, and
could not find the unkeyed list because there is no `.map` without a key on either screen. The list
was the panel's own children: three panels built in a *server* component cross the RSC boundary and
arrive as a list assembled at runtime rather than the compile-time-static one JSX normally hands
React, and a runtime list of elements is one React checks for keys. Choosing the node before
rendering it means there is no list to check, whatever the transform does. **It does not reproduce
on this branch** — measured on a paid rider with a landed trick, a sticker and a clip, on all three
tabs, the console is empty — so this is the shape being removed rather than a fault being seen; the
review's instance had sixteen stickers where the reproduction has two.

**The spot list card's three text links become buttons, and Directions says where it goes** *(added
by the owner — Rachid, 2026-09-17, in chat: "the report/spot page/directions should be ctas? not
just strings? and the directions should make more clear it opens google maps")*.

A spot card offers three things and all three were set as 12–13px captions: "Report" in the corner,
"Spot page →" and "Directions" in the footer row. They now wear the design's small ghost button —
the shape "Show on map" already has at the other end of the same row — at §4's 44px. All three are
ghost and none is primary: the orange is for the one thing a screen is *for*, and a list card is not
one thing.

Three details that are not cosmetic.

- **"Spot page" stays decorative.** The whole card is already a stretched link to that address
  carrying the spot's name (`.cardLink`), and it sits *above* this span, so a press lands on the link
  exactly as before and a screen reader hears one link to the spot rather than two. It is affordance,
  not a control; its hover comes from the card, because the pointer is never over it.
- **Report keeps its corner.** The footer row is only drawn for a spot with coordinates, and "this is
  wrong, gone, or not safe" has to be on every card (plan §6.1). It is the quietest of the three —
  no shadow, a smaller face, `--ink-3` until hovered — and still a 44px box.
- **Directions names Google Maps.** `mapsLink` builds `google.com/maps/search/?api=1&query=…` on
  every platform, so the label is a fact rather than a guess, and the link carries the spot's
  coordinates and nothing about the rider (§6.4 standard 10). A new `external` icon in
  `packages/ui-web` (additive; the set had no external mark, and `arrow-right` means "onward in this
  product") draws the box-with-an-arrow, and the accessible name says both the destination and that
  it opens a new tab, which `target="_blank"` announces to nobody on its own.

**The full words go where there is room for them; the icon and the accessible name go everywhere**
*(added by the owner-pass-1 worker, 2026-09-17, pending owner confirmation)*. The list card's action
row wraps and can carry "Directions in Google Maps" — four words in caps, about 234px, which wraps
to two lines inside the button at 320px rather than overflowing. The spot page's three equal actions
and the map sheet's two equal halves cannot: they are `minmax(0, 1fr)` columns about 124px wide at
390px with `white-space: nowrap`, and a three-line button beside two one-line ones is worse than a
short label. Those two keep the word "Directions" and carry the glyph and the same `aria-label`. The
map header's existing "Open in Maps" is untouched — it already names where it goes.

**The map's own attribution control is untouched everywhere.** "OpenFreeMap © OpenMapTiles Data from
OpenStreetMap" is the tile licence's own term and is kept byte-identical to what OpenFreeMap serves
so MapLibre de-duplicates it.

**The note under the map goes, and the spot data credit moves into the terms** *(added by the owner
— Rachid, 2026-09-17, in chat)*.

Two paragraphs sat under `/spots`' map. The first explained the interface — "Every matching spot is
on the map. The list shows 24 at a time. Cards are links, so the map only moves when you ask it
to…" — and it is deleted. Its own comments recorded two re-wordings, on 2026-09-06 and 2026-09-11,
each because the behaviour it described had moved under it: a paragraph explaining an interface is a
dated claim about the product (LESSONS §4), and "Show on map" says what it does on the button
itself. With it gone the panel's footer would be an empty bordered strip on a desktop, so the footer
is now the phone sheet's alone, where it carries the travel warning it always carried there.

The second was the data credit, and that one is a **licence term rather than a courtesy**: the spots
are used under ODbL (OpenStreetMap), Licence Ouverte 2.0 (the French census, which asks for the
source *and* the date it was taken) and CC BY 4.0 (GeoNames), all of which want attribution
reasonably reachable from where the data is shown. So it moved rather than went: the full text is a
new **"Data sources and licences"** section in the terms of use, generated by `spotCreditLine()` from
the same `SPOT_SOURCES` table each spot row is stamped from, so the dates cannot drift from the
data — and `/spots` keeps one quiet "Spot data sources" link into that section, at every width,
because a licence that asks to be named is not met at one width only. It is in the terms rather than
the privacy policy because nothing in it is about a rider's data: it is about what we are allowed to
publish and on whose conditions.

**The spot page's breadcrumb becomes the back link** *(added by the T52 worker, 2026-09-17, pending
owner confirmation)*. §2.3 gives the spot page "Spots" and the screen had `Spots / Great Britain /
Corby` instead. The trail's two tail segments are plain text repeating the sub-line under the title,
which already reads "Corby, Great Britain", and its one link was 12.5px of unpadded type — the
smallest target on the page. `BackLink` is the product's one shape for this now, at §4's 44px.
Nothing is lost to a crawler: the page carries no `BreadcrumbList` structured data, and the town and
country are in the `<h1>`, the sub-line, the metadata description and the JSON-LD place.

**The three actions are one row in the DOM, laid out twice, and they are grid columns rather than
flex items** *(added by the T52 worker, 2026-09-17, pending owner confirmation)*. §3.10 puts Faved ·
Directions · Log here "under the hero on the phone, in the hero band on desktop", which is two
positions for one control; they are the same three boxes in the strip that joins the band, and the
strip's own wrap drops them onto a line of their own below 820px. Built with `flex: 1` they measured
**81 / 115 / 115** at 390px: `flex-basis: 0` with `box-sizing: border-box` cannot shrink an item
below its own padding and border, so the two `.btn`s started 34px ahead of the fave wrapper, which
has neither, and then took an equal share of what was left on top of that. `grid-auto-columns:
minmax(0, 1fr)` is equal whatever is inside it, and `grid-auto-flow: column` keeps it equal when
there are two actions or one — `SpotFave` draws nothing signed out, and "Log here" is behind the
sessions preview.

**Equal in height as well, which took a second class** *(added by the T52 worker, 2026-09-17, after
the independent review — finding 2)*. The rule that made the two anchors flex boxes was written as a
single `.action`, one specificity point short of `.btn.sm`, so `.btn`'s own `display` won and they
were laid out as **blocks**: `gap`, `align-items` and `justify-content` all computed and all did
nothing. Measured at 390 the row was 104 / 104 / 104 wide and **44 / 47 / 47 tall**, with the plus
flush against "Log here" where "Directions →" had its space — a 3px step between three hard-keyline
boxes, and a row that was equal in the dimension the spec names and not in the one a rider sees. It
is `.stripPush .action.action` now, which is the trick the padding rule two lines below it already
used.

**"Log here" is the sessions block's link moved, not copied** *(added by the T52 worker,
2026-09-17, after the independent review — finding 5)*. Both rendered `newSessionHref({ spot })`
through `LogSessionLink` with `source: 'spot'`, so a rider covered by the preview met two identical
controls about 600px apart on one page and `session_log_opened` could not tell them apart. §3.10
says "Log here goes where it goes today", which reads as a move, so it is one: the "Log a session
here" button in the header of "Your sessions here" is gone and the hero's action is the single door.
`SpotSessionsBlock` is rendered on the spot page and nowhere else, so nothing else loses a link, and
`EventSessionsBlock` keeps its own because no event page hero offers one.

**And "Log here" asks both halves of the sessions question** *(added by the T52 worker,
2026-09-17)*. `sessionsEnabledFor` answers `true` for a `null` rider once `LANDIT_SESSIONS_OPEN` is
set, which is how a release will run it — so `sessionsEnabledFor(session?.rider ?? null)` put a
"Log here" on a public spot page for a visitor with no account, pointing at a form that would bounce
them to `/signin`. It is **`sessionsEnabledForViewer(session)`** — a named predicate added beside
the old one in `lib/sessionsPreview.ts`, holding the expression `riderFor` has always used for the
block below it, so a screen cannot write the shorter, wrong one by accident. Its own unit tests pin
the trap the e2e cannot reach: with the flag set, the rider-shaped question answers `true` for
nobody at all. Caught by the signed-out case in `e2e/spot-page.spec.ts`,
not by the flag, which is off in most places this is run.

**"What's here" takes `LinkCard`'s look, not the component, and fires nothing** *(added by the T52
worker, 2026-09-17, pending owner confirmation)*. §3.10 asks for coloured `LinkCard`s. Home's
`LinkCard` fires `nav_clicked` `{ to, where: 'home-card' }` where `to` is one of four route ids, and
a spot's feature is neither a route nor a Home card — using it would mean inventing a property value
at the call site, which is the one thing `analytics.ts` forbids. These cards fire nothing, as T48
decided for the Find hub's section links, and what measures the screen is the `spot_page_opened` it
already sends. The fill is the design system's own tint recipe, `color-mix(in oklab, <accent> 42%,
#fff)` — the one `StickerBadge` fills its disc with — rather than the accent at full strength:
eight accents reach this grid, `--violet` and `--blue` among them, and ink on either of those at
full strength is the contrast failure `.btn`'s note in `primitives.css` records. A feature with no
library category is a card rather than a link, because an arrow that goes nowhere is a lie. **Two
screens draw that card now**, so [issue #568](https://github.com/lekky/landit/issues/568) proposes
promoting it into `packages/ui-web` — the paint only, with the analytics staying at the call site
the way `TabRow` splits them — for whoever next has both files open.

**Plans: the saving stays a tilted tag over the Yearly tab** *(added by the T52 worker, 2026-09-17;
**reversed by the owner the same day** — Rachid, 2026-09-17, in chat: "the yearly should have a
green 2 months free overlay thing - it was present on main")*.

T52 moved it. On `main` the saving was a lime `Tag`, tilted, slapped over the top edge of the
toggle's right-hand half — positioned so it read as Yearly's rather than as the selected period's,
with `aria-describedby` carrying the same association to a screen reader. T52's reasoning for
moving it was that a boxed row lifts its active tab to a 4px offset and has no edge to slap a tag
over, so the saving became the Yearly tab's `note`: the faded `.n` the sticker wall's counts use,
which makes the association structural rather than positional.

**The owner reversed it on sight**, and the reason is worth keeping rather than the paragraph being
deleted. The saving is the single reason to press Yearly, and the two treatments are not the same
weight: an overlay in the design's loudest fill is an interruption, a dimmed number inside a tab
reads as a count of something. T52 optimised the accessible name and lost the sell.

So what ships is `main`'s treatment on the new row. The tag is absolutely positioned against a
wrapper the row shares, `bottom: calc(100% - 2px)` so it bites 2px into the tab and covers its
keyline, and **`right: 0` rather than `main`'s `-3px`** — on `main` the toggle was an inline-flex
control narrower than the page, and here the row runs the full width of a 320px phone, where three
pixels past its right edge is a document that scrolls sideways (issue #550's fault, in a new place).
The active tab's lift is a `box-shadow` and not a `transform`, so nothing clips the tag.

**The words are a description, not part of the name.** `TabItem` and `TabRowItem` gain an optional
`describedById` (additive; absent by default, so every other row renders the markup it rendered
before) and the Yearly tab points it at the tag's span. A screen reader hears the control called
"Yearly" and described as "2 months free" — which is what it is — where `note` had made "Yearly, 2
months free" the control's own name. A visitor sitting on Monthly is still never told they are
getting two months free, which is the assertion `e2e/plans.spec.ts` keeps either way.

The row is capped at **460px** and centred, because two tabs each taking half of a 1180px page would
put "Monthly" alone in the middle of 570px of paper. The cap moved onto the wrapper, which is also
the tag's positioning context.

**Plans' hero stopped counting tricks, and then so did everything else** *(added by the owner —
Rachid, 2026-09-17, in chat)*. The hero read "Twenty hand-picked tricks in every sport…" and became
"Loads of hand-picked tricks…" on the owner's first pass, on the narrow reasoning that a ceiling at
the top of a page a rider is being sold on reads as a limit before the free tier has been
described. Later the same day the owner generalised it — "dont mention counts of tricks in free
text as its always subject to change, so remove it everywhere" — which reverses the rule
`packages/core/src/data/plans.ts` had carried since 2026-09-04 ("'Twenty' is safe to write down").
So no plan card, landing paragraph, library banner or locked trick states a count now. **The
allowance is unchanged**: `FREE_TRICKS_PER_SPORT` is still twenty a sport, still enforced by the
hook and still asserted by `data.test.ts`. The full reasoning and the tests that hold it live in
`plans.ts` and in the implementation plan; this paragraph is here because `/plans` is a §3.10
screen and the sentence is on it.

**Plans' tabs get a panel, and the period gets an address** *(added by the owner-pass-1 worker,
2026-09-17, after the independent review of the combined branch)*. Two things the row was missing
that every other `TabRow` on a screen already had.

**A `role="tabpanel"`.** A tablist with no panel under it announces a relationship the document does
not have: a screen reader is told "Yearly, tab, 2 of 2" and then told about no panel at all. The
cards are the panel — they are the only thing the period changes, every price on both sides having
been computed on the server — and they are `aria-labelledby` the tab that changed them, through a
shared `periodTabId()` so the tab's `elementId` and the panel's reference cannot drift. The
guardian notices, the currency footnote, the sessions comparison and the FAQ are deliberately
*outside* it: a panel claiming them would be telling a screen reader that the FAQ answers change
with the billing period. Keyed on the period, so §4's 120ms cross-fade runs on every switch.

**And `?tab=`, the Progress pattern** (`useTabParam`). The period was `useState`, so a link to
yearly pricing did not exist and Back after a checkout landed a rider on Monthly. `/plans?tab=yearly`
now opens on the yearly prices, the default is spelled by *absence* so the screen as it opens has
one address rather than two that render the same thing, `replace` rather than `push` keeps pressing
both tabs out of the history, and the value is validated against `BILLING_PERIODS` so a hand-typed
`?tab=nonsense` opens Monthly rather than an empty screen.

**The pill rows are the native radios, clipped** *(added by the T52 worker, 2026-09-17, pending
owner confirmation)*. §3.10 says the radio lists on Coach, Suggest, Report and Close account become
`Pill` rows. `Pill` itself is a `<button aria-pressed>`, and these lists are inside forms that post
a field — so what ships is the design's `.pill` treatment on a `<span>` inside the `<label>`, with
the same `<input type="radio">` underneath, clipped out of sight rather than replaced. The group
still walks under the arrow keys, the label still activates it, a screen reader still hears "radio,
2 of 5", and the server receives exactly the value it did before. `display: none` and
`visibility: hidden` would each have taken the radio out of its group; `appearance: none` would have
left an empty box in forced-colours mode. They are **full-width rows** rather than a wrapping row of
chips because the options carry a sentence each and because a reason that moved position with the
width of the screen would be harder to find twice — on the one form somebody may be filling in while
upset. **Coach and Close account have no radio list at all**, so what §3.10 gives them is the 640px
centring, and both trade their own 13.5px back link for `BackLink` at §4's 44px.

**Tricks: the Filters box is in the row and outside the tab list** *(added by the T52 worker,
2026-09-17, pending owner confirmation)*. §3.10 asks for the phone's Filters toggle to join All ·
Mine "in one `TabRow`". `TabRow`'s button form is a `role="tablist"`, and a disclosure that opens a
panel of checkboxes is not a tab: a screen reader told "Filters, tab, 3 of 3" expects the view under
the row to become the filters. So the row is one flex line holding the two-tab list and one
`<button class="sporttab">`, painted by the same `.tabrow .sporttab` rules — one row to the eye, two
true things to a screen reader. The row sits **above `.two-col`** rather than inside its right-hand
column, which is also what fixes the order on a phone: the left column stacks first, so the Filters
disclosure used to arrive *above* the control that says which list is being narrowed.

**The box keeps its words and its badge** *(added by the T52 worker, 2026-09-17, after the
independent review — finding 6 and nit 11)*. Two things came out in the move and neither was
deliberate. The label was shortened to "Filters", and the panel behind it still holds the **sort**,
so the only thing on the screen that said where sorting lives had gone: it reads "Filters & sort"
again, and clips with an ellipsis like every other label in the row. And the active-filter count
went with the button into `.sporttab`, where the one rule for `.fcount` anywhere in the repository —
`.filter-toggle .fcount`, inside `primitives.css`'s phone block — no longer reaches it, so the pink
badge that told a rider at a glance how many narrowings were on rendered as a bare inherited number.
`.filtersTab .fcount` restates that rule's own values in the screen's module rather than widening
the shared selector, because the package's rule is right for the control it names and this is a
different control.

**And the badge sits on the corner, so the words never give way to it** *(added by the T52 worker,
2026-09-17, after the second review pass — L3)*. Restated in the flow it took about 30px out of a
box with roughly 100px of content width at 390, and the label is what gives first: "FILTERS & SORT"
clipped to "FILTERS …" exactly when a rider had a filter on, which is when they are most likely to
be reading it. Putting "sort" back and then taking it away again whenever the badge appears is not
putting it back. It is the bell's own idiom now (`.tbBadge`) — a pink count on the top-right corner,
outside the box, overlapping the keyline rather than the words — which is why the box is
`position: relative` and `overflow: visible` while the label keeps its own clip.

**The library keeps a sport control, and it is `SportScopeSelect`** *(added by the T52 worker,
2026-09-17, after the independent review — the blocker)*. D5 removes every in-page sport *tab row*
and then says, in the same sentence, that **lists which used to carry their own sport row follow the
chip through one dropdown (O1)**. §3.3's O1 paragraph names Spots, Events, Sessions and the glossary
and omits Tricks, and the first cut of T52 read that omission as "the chip covers it". It does not
cover a **signed-out visitor**: the chip is hidden with the rider (T45), so `/library` opened on
whichever sport `useSport()` fell back to, 175 of the 259 tricks had no route from anywhere, and the
landing page's no-sign-up peek at the library became a peek at a third of it.

So the library gets the same control the other two lists have, on the same terms T48 settled: signed
in the default is `'chip'`, so the list follows the top bar and a rider who never touches it sees
what they saw before; signed out there is no "Your sport (X)" option at all — it would be a claim
about somebody the product has never met — a stored `'chip'` reads as the screen's default, and that
default is **every sport**. Three consequences worth naming. The heading follows the scope rather
than the chip, because "SCOOTER LIBRARY" over a grid of all three is a heading its own rows
disprove. The category pills take the **neutral** names when the scope is every sport, since a
category is named differently per sport and over three there is no one sport whose names are right.
And the scope is one sport or all of them, never a combination — O1 took the multi-select away —
which is exactly what `tricksFor` and `filterTricks` already mean by a `null` sport, so no shared
signature moves.

**The nudge is a grid cell, four cards in** *(added by the T52 worker, 2026-09-17, pending owner
confirmation)*. §3.10 says the Rookie nudge moves below the first card rows, and how many cards make
a row is decided in CSS by the width of the viewport — a count worked out in the browser is one the
server guessed differently (LESSONS §3a). So it is a cell of `.grid-tricks` spanning every column,
placed after four cards: two rows on a phone, where the grid is two columns below 520px, and one on
a desktop. In "Mine", where the grid is cut into stage sections, it follows the first section. A
grid with fewer than four cards puts it at the end of them, which is still below what there is.

**`SportSwitch` stays on the branch** *(added by the T52 worker, 2026-09-17; re-checked after T50
merged)*. T52 removes its last *screen* use, from the library, and T50 removed the glossary's — so
with both in, the grep finds exactly one importer left:
`apps/web/src/app/design/shell/preview.tsx`, a gallery of shell components that is nobody's task
this wave. Three other hits are prose in comments. The component and its styles therefore stay, and
deleting them is a job for whoever clears that preview
([issue #562](https://github.com/lekky/landit/issues/562), which now also carries `.filter-toggle`'s
newly dead CSS). Named here so the next reader does not take a live import for an oversight.

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
| `log_action_picked` | `action: 'rode' \| 'trick' \| 'session'` | LogSheet |
| `tabs_switched` | `group`, `tab` (ids from the screen's tab list; `analyticsId` where the tab is a record, e.g. `crew-1`) | `TabRow` — `apps/web/src/components/shell/TabRow.tsx`, which fires it itself so no screen has to remember (§3.3), and not at all when the pressed tab is the active one *(T47, 2026-09-17)* |
| `sport_scope_set` | `screen`, `scope: 'chip' \| 'all' \| 'other'` | SportScopeSelect |
| `whats_new_opened` | `where: 'mobile' \| 'top'`, `unread` (integer) | `BellButton` for `top`; `WhatsNewPanel`'s mount for `mobile` — the page, not the bell's tap, so "All →", a deep link and the back button all count *(T47, 2026-09-17)* |
| `whats_new_read` | `unread` (the count the panel opened with) | "Mark all read", and only when that count was above zero *(T47, 2026-09-17)* |

Changed: `sport_switched` gains `where: 'chip'` (the tab rows that fired it without `where` go).
`nav_clicked` gains the values `find`, `log` for `to` and `'top'` for `where`. Removed:
`nav_section_opened` (the drawer is gone; its doc comment is deleted, not left describing a
control that no longer exists).

**`sport_filter_set` stops firing but stays in the catalogue** *(added by the T48 worker,
2026-09-17, pending owner confirmation)*. It was the multi-select's event, fired from `/spots` and
`/events`, and `SportScopeSelect` replaced both rows — so nothing sends it any more and
`sport_scope_set` is the question it used to answer. The entry is left where it is rather than
deleted: T46 and T47 have `analytics.ts` open in the same wave, and removing a catalogue line is
also a decision about the history already in the funnel, which is the owner's rather than a build
session's. Its doc comment now describes a control that no longer exists, which
[issue #551](https://github.com/lekky/landit/issues/551) is where that gets settled. Same for
`events_view_switched`'s `'mine'`: the pill that sent it is gone, and `'upcoming'` and `'past'`
still fire from the two that replaced it.

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

