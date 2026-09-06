# Handoff: Event & Spot Pages

## Overview

Four public, crawlable pages for Land The Trick (`lekky/landit`), plus the changes they force on the two existing list screens:

1. **Event page** — a real page per event, replacing "detail lives only in a modal". Three date states: upcoming, today, over.
2. **Spot page** — a real page per spot, carrying a thin listing (sometimes ~25 words of unique data) without photography.
3. **Events list** — the shipped row is kept; the name becomes a link, the Details modal gains a "View full page" CTA, and past events get their own view with a year/town index.
4. **Spots list** — resolves the card-click ambiguity: the card navigates, an explicit button selects the spot on the map.

Two product constraints shaped everything and must be preserved:

- **There is no photography anywhere on this site.** No hero images, no venue photos, no user uploads. Structure, colour and type carry the page. The only picture is a schematic map.
- **Attendance is private.** There is no attendee list, no count, no "12 going". A rider's "I'm going" is visible to that rider only. Nothing on these pages may leak it.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour, not production code to copy directly. The task is to **recreate these designs in the target codebase's existing environment** — here, the Next.js app at `apps/web` with CSS Modules and the tokens/primitives in `packages/ui-web` — using its established patterns.

Concretely, for this repo:

- `pages.css` in this bundle is a **transcription** of `packages/ui-web/src/styles/tokens.css` and `primitives.css`. Do not port it. Import the real tokens and primitives and delete anything here that duplicates them.
- Sport chips, tags, buttons and panels already exist in `packages/ui-web`. Reuse those components rather than the classes in this bundle.
- The sport icon paths in the prototypes are copied verbatim from `packages/ui-web/src/icons.tsx`. Use the real icon components.
- Event field names follow `apps/web/src/app/(app)/events/view.ts`. **No fields were invented.** Any field absent from the source data renders as an explicit "not listed" state (see below) — never an empty row, and never a fabricated value.
- The prototype `?state=` / `?v=` / `?view=` / `?modal=` / `?sheet=` query params and the black "Prototype" bar at the top of each page are **scaffolding for review only**. They are not part of the design. Real routes are listed under "Routes" below.

## Fidelity

**High-fidelity.** Final colours, typography, spacing, borders, shadows and interaction states. Recreate pixel-perfectly using the existing `ui-web` primitives. Every value in this README is exact and taken from the built prototypes.

The one deliberately loose element is the **map**, which is drawn in CSS as a schematic (see "The map" below). It stands in for whatever real map component you use; only its *claims* about accuracy are part of the design.

---

## Design Tokens

All tokens are the repo's existing ones. Listed here so the README is self-sufficient.

### Colour

| Token | Hex | Used for |
| --- | --- | --- |
| `--ink` | `#12100B` | Text, every border, every shadow |
| `--ink-2` | `#3A352C` | Body copy, blurbs |
| `--ink-3` | `#6E665A` | Meta lines, labels, muted notes |
| `--paper` | `#FFFDF5` | Panels, rows, cards |
| `--paper-2` | `#FFF7E4` | Panel headers, fact cells, secondary fills |
| `--wash` | `#F2ECDC` | Page background, hairline row dividers, past-event rows |
| `--pink` | `#FF3D78` | Jam kind, event band default |
| `--orange` | `#FF5A1F` | Primary buttons, links, map pin, Comp kind |
| `--yellow` | `#FFC23F` | Signup panel, nav current underline, full-page CTA, hover fill, selection keyline |
| `--lime` | `#9CE05B` | "Today" status band, location-on chip, toggle-on |
| `--green` | `#10A06A` | Session kind, "Going" confirmed state |
| `--sky` | `#3AC0FF` | Map water, ledges feature bar, info bullet |
| `--blue` | `#246BFF` | Class kind, skate chip, spot page band |
| `--violet` | `#8A3BE0` | Mini-ramp feature bar, private-note bullet, sparse spot band |
| `--red` | `#E0392B` | "Over" stamp and Over tag. Used for nothing else. |

Page background is `--wash` plus a dot field: `radial-gradient(rgba(18,16,11,.07) 1.1px, transparent 1.1px)` at `background-size: 14px 14px`.

### Typography

| Token | Family | Use |
| --- | --- | --- |
| `--fd` | **Anton**, 400 only, uppercase, `line-height: .92`, `letter-spacing: .01em` | H1, H2, section heads, row titles, big numerals |
| `--fc` | **Barlow Condensed**, 600/700, uppercase | Labels, buttons, meta lines, chips, prices, nav |
| `--fb` | **Archivo**, 400–700 | Body copy, blurbs, notes, inputs |

Scale as built:

- Page H1 (band): `clamp(32px, 5.6vw, 62px)` Anton, white, `text-shadow: 3px 3px 0 var(--ink)`
- List H1: `clamp(30px, 4.6vw, 46px)` Anton, ink
- Section head H2: `clamp(20px, 2.4vw, 27px)` Anton
- Row title: `clamp(19px, 2vw, 25px)` Anton
- Modal title: `clamp(26px, 3.6vw, 40px)` Anton, white, `text-shadow: 3px 3px 0 var(--ink)`
- Lede/blurb: 16–16.5px Archivo, `line-height: 1.55`, `color: var(--ink-2)`, `max-width: 60–62ch`
- Body/fact copy: 14–14.5px Archivo, `line-height: 1.4–1.5`
- `.lab` label: 11px Barlow Condensed 700, `letter-spacing: .16em`, uppercase
- `.eyebrow`: 12px Barlow Condensed 700, `letter-spacing: .22em`, uppercase, `--ink-3`
- Meta line: 13px Barlow Condensed 600, `letter-spacing: .07em`, uppercase, `--ink-3`

### Geometry

**Border radius is 0 on every element without exception.** The only curve in the system is the dashed circle on the event map and the 50% dot inside the location chip.

- Standard border: `3px solid var(--ink)`. Modal: `4px`. Small controls, chips, map frame: `2–2.5px`.
- Shadow: `5px 5px 0 var(--ink)` (panels/rows), `3px 3px 0` (flat panels, small buttons), `2px 2px 0` (chips, tiny buttons), `9px 9px 0 rgba(18,16,11,.5)` (modal). Never blurred, never coloured, always down-right.
- Content width: `1180px` max, `18px` side padding.
- Detail-page grid: `minmax(0,1fr) 350px`, `26px` gap, collapsing to one column at `820px`.
- Spots list grid: `minmax(0,1fr) 400px`, `24px` gap, collapsing at `900px`.

### Motion

One interaction pattern only, used on every button and hoverable row:

- Hover: `transform: translate(-1px,-1px)` (rows `-2px,-2px`), shadow grows by 2px. `transition: transform .12s, box-shadow .12s`.
- Active: `transform: translate(2px,2px)`, shadow shrinks to `1px 1px 0`.
- Mobile map sheet: `transform .2s`.

No fades, no scale, no easing curves beyond the browser default.

---

## Routes

The prototype query params map to real routes:

| Prototype file | Real route |
| --- | --- |
| `Event Page.html?state=up\|today\|over` | `/events/[slug]` — state is derived from the event date, never from a param |
| `Spot Page.html?v=rich\|sparse` | `/spots/[slug]` — variant is just how complete the record is |
| `Events List.html?view=up` | `/events` |
| `Events List.html?view=past` | `/events/past` (and `/events/past/[year]/[town]` for the index) |
| `Events List.html?view=empty` | same past route, no results |
| `Events List.html?modal=1` | not a route — modal state, see below |
| `Spots List.html?sheet=0\|1` | `/spots` — sheet is local UI state |

Both detail pages need `<title>`, meta description and OG tags built from `name`, `town`, `country` — the whole reason they exist is to be linkable and crawlable.

---

## Screen 1 — Event page

**File:** `Event Page.html` · **Purpose:** everything a rider needs to decide whether to go, and somewhere to go next if they can't.

### Layout, top to bottom

1. **Site header** (`.top`) — `--paper`, `3px` ink bottom border, 11px/18px padding. Wordmark left (Anton 21px, preceded by an 11px orange square with a 2px ink border), nav right (Barlow Condensed 700 13.5px, `.1em`), current item gets `box-shadow: inset 0 -5px 0 var(--yellow)`. Ends with a small orange "Sign up free" button.
2. **Breadcrumb** (`.crumb`) — Events / United Kingdom / Ventnor. 12.5px condensed, `--ink-3`, links in ink.
3. **Header band** (`.band`) — full-bleed colour, `3px` ink bottom border, `24px/18px/28px` padding. Contains: chips row (kind tag + one sport chip per sport), H1 (event name + town, `max-width: 20ch`), sub-line (venue · town · country) in condensed 700 15px **full-opacity white with `2px 2px 0 var(--ink)` shadow**.
4. **Status band** (`.status`) — the state machine, see below.
5. **Two-column body** — main + 350px rail.
6. **Footer** (`.foot`) — three columns of condensed links, `3px` ink top border.
7. **Mobile:** nav collapses, a fixed bottom bar appears (`Tricks / Spots / Events / You`, current tab filled `--yellow`), body gets `56px` bottom padding.

### The three date states

The state must be legible in a thumbnail, without reading. Each state changes three things at once.

**A · Upcoming** — band `--pink`. Status band `--paper-2` with a large Anton countdown numeral (`clamp(34px,4.6vw,54px)`), "DAYS AWAY", the full date, and a right-aligned cost/format line. Rail shows an unpressed "I'm going to this" toggle.

**B · Today** — band `--pink`. Status band `--lime` (the only lime band on the site) reading "HAPPENING TODAY", the date and "All day", with an ink "Open in maps" button. Rail toggle is pressed: lime fill, filled checkbox, label "You're going today".

**C · Over** — three simultaneous signals:
- Band drops from pink to `--ink`; its sub-line turns `--yellow`.
- Status band is `--ink`/`--paper`: "THIS EVENT HAS FINISHED", "Was Saturday 13 June 2026 · 12 weeks ago", plus two yellow-underlined onward links.
- A `--red` stamp panel appears at the top of the main column: "Kept online for the record. Nothing here is happening." Red is used nowhere else on the site.
- **The three onward blocks move above the blurb** (`order: -1`), so the first thing under the stamp is somewhere else to go.
- Rail toggle becomes a static ink "Went" tag plus "Log what you landed".

### Main column

- **Lede** — organiser blurb, 16.5px Archivo, `max-width: 60ch`.
- **Fact grid** (`.facts`) — 3 columns (2 at ≤820px) in a `3px` ink hairline grid: cells are `--paper-2`, separated by the ink background showing through 3px gaps, whole grid bordered `3px` with a `3px 3px 0` shadow. Six cells: Where, Who for, Cost, Places, Distance, Date. Each is a `.lab` label, a condensed 16px value, and a 14px `--ink-2` qualifier. The Date cell's value and qualifier change per state.
- **"Getting there & who runs it" panel** — three rows in a `6.6rem / 1fr` grid separated by `2px solid var(--wash)`: Address (+ "Open in maps →"), Phone, Listing. Closes with the provenance note: *"Every detail here comes from the organiser's listing. We add nothing they haven't published, so some rows read 'not listed'. Check with them before travelling."*
- **Three onward sections** — "What else is on near Ventnor", "Also at Ventnor Skatepark", "Spots near Ventnor". Each has a section head (Anton H2 + a `3px` ink rule filling remaining width + a right-aligned underlined "more" link) over an `.olist`.

### `.olist` — the onward link list

The workhorse component, used on all four pages. A `3px`-bordered ink-background container with `3px` gaps between `--paper` rows, so the ink shows as hairlines. Each row is a single `<a>`: a `5.4rem` condensed date/type column in `--ink-3`, a condensed 15.5px uppercase name, and a right-aligned 13px meta. **Hover fills the entire row `--yellow`** and darkens both secondary texts to ink. On mobile the row wraps and the meta un-truncates.

### Rail

- **Private note panel** — the toggle plus a violet-bulleted note: *"**Private.** Only you can see this. Land The Trick has no attendee list and never shows who is going."* This copy is load-bearing; keep it.
- **Map panel** — 200px map, "Open in maps →", and *"We hold the town, not a pin. The circle is the area, not the gate."*
- **Signup panel** — `--yellow` fill, Anton 22px "Track what you land", body copy, full-width ink button. This is the only marketing on the page and it never gates content.
- **Report panel** — flat `--paper-2`: "Something wrong?", a line of examples, and a small underlined `--ink-3` "Report a problem with this listing" that turns `--red` on hover. Deliberately quiet.

### The map

Pure CSS schematic: dotted 22px grid, a `--sky` water band rotated `-3deg` with an ink top border, three `--paper` roads with ink edges at `-6deg`/`4deg`/`9deg`, and an ink caption bar along the bottom in 10px condensed.

**The map's honesty is the design.** Two variants, and they must not be mixed up:

- **Events** — a `132px` dashed ink circle filled `rgba(255,194,63,.34)` with a small rotated orange square at its centre. Caption: *"Ventnor, PO38 — town-accurate, not the exact venue."*
- **Spots** — no circle; a solid `20–26px` rotated orange diamond with a `2.5–3px` ink border and offset shadow. Caption: *"pin is exact."*

Same component, different claim, because the underlying data differs in precision. When you swap in a real map, keep the captions accurate to what you actually hold.

### "Not listed" treatment

Missing data is stated, never hidden and never faked. `.nolisted`: a `2px dashed var(--ink-3)` box, 10.5px condensed `.14em`, `--ink-3`, reading "No phone listed" / "No address listed" / "No phone — street spot". Where the absence has a consequence, a following note explains why it doesn't matter (e.g. "The map pin is exact, so directions still work").

### State

- `going: boolean` per event, per user, **private**. Optimistic toggle; label swaps "I'm going to this" ↔ "You're going". Never rendered as a count.
- Date state is derived (`upcoming | today | over`) from event date vs now — not stored.
- Distance is "about N mi/miles away", computed from the rider's last known town, and is always approximate in wording.

---

## Screen 2 — Spot page

**File:** `Spot Page.html` · **Purpose:** carry a listing that may hold almost no unique prose, without photography and without padding.

Two variants are specified because they are the real range of the data:

- **Rich** — five features, full address, phone. Band `--blue`.
- **Sparse** — two features, no address, no phone. Band `--violet`.

### Layout

1. Header, breadcrumb (Spots / United Kingdom / Ventnor), header band (chips + H1 "Spot name, Town" + white sub-line).
2. **Summary strip** (`.strip`) — `--paper-2`, ink-bordered: Type · What's here (`5 features` / `2 features`) · Distance, with a right-aligned orange "Directions →".
3. **"What's here"** — the section that replaces photography. A responsive grid (`repeat(auto-fill, minmax(210px,1fr))`) in the same ink-hairline treatment as the fact grid. One cell per feature: a 9px coloured bar (Bowl `--yellow`, Ledges `--sky`, Rails `--pink`, Banks/Flat `--lime`, Mini `--violet`), an Anton 24px name, a 13.5px plain-language explanation of what the feature *is*, and a bottom-pinned "X tricks →" link. This turns a tag array into real, useful content and gives the page its visual weight.
4. **Map panel** — 340px (380px on the sparse variant, absorbing the space the missing feature cells left), exact-pin variant, with a footer strip: distance on the left, "Copy coordinates" and "Open in maps →" on the right.
5. **"On here soon"** — `.olist` of events at this spot. On the sparse variant it lists *nearby* events instead, with the note: *"Nothing is listed at this spot itself. These are the nearest events instead — a street spot rarely hosts anything."*
6. **"Other spots near Ventnor"** — `.olist`.
7. Rail: **The listing** panel (Town, Type, Address, Phone, Good for — with "not listed" states on the sparse variant), a sparse-only **"Know this spot?"** panel ("If there is more here than ledges and flat, tell us and we'll add it. We never publish who sent a spot in."), the signup panel, and a report panel with the sky-bulleted note *"Spots are kept up by riders. Gates get locked, parks get resurfaced, ledges get knobbed."*

The sparse variant never pretends to be full: it says two features is all it has, and the layout redistributes rather than padding.

**Submitters are never shown.** The spot record may carry who added it; the page must not render it.

---

## Screen 3 — Events list

**File:** `Events List.html` · **Purpose:** browse and filter; the shipped row design is preserved.

### The row — unchanged from production

`display: flex`, `--paper`, `3px` ink border, `5px 5px 0` shadow, 14px gaps between rows.

- **Date block** — `88px` wide, `3px` ink right border, background = kind colour. Anton 40px day in white with `2.5px 2.5px 0 var(--ink)`, condensed 13px `.14em` ink month below.
- **Body** — chips row (kind tag + sport chips with icons), the event name in Anton `clamp(19px,2vw,25px)`, and a condensed 13px `--ink-3` meta line: `venue · town · country · who for · distance`.
- **Right group** — right-aligned price block (condensed 16.5px value + 13px `--ink-3` sub-line, e.g. "£25 early bird, £35 on the door" / "Separate spectator pass"), then **Details** (ghost) and **I'm going** (orange) small buttons.
- **Going state** — the button turns `--green` with "✓ Going".
- **Past rows** — `--wash` background, ink date block with `--paper` month, `--ink-2` title, a `--red` "Over" tag first in the chips row, and **I'm going replaced by an ink "Full page →" button** (going is meaningless once it's over).
- **Mobile (≤820px)** — the row wraps: the date block becomes a full-width horizontal strip, the right group spans full width and space-betweens.

**One change to the row:** the event name is now an `<a href="/events/[slug]">` (Anton, ink, orange on hover). That gives the row a hover URL, a middle-click and a crawl path.

### Sport chips

`2px` coloured border with `box-shadow: inset 0 -4px 0` the same colour, `--paper` fill, 11px condensed `.12em`, ink text, preceded by a 13px icon from `packages/ui-web/src/icons.tsx` (`scoot`, `board`, `bmx`). Scooter `--orange`, Skate `--blue`, BMX `--pink`.

### Kind colours

Comp `--orange` · Jam `--pink` · Class `--blue` · Session `--green` · Over `--red`. Applied to both the date block and the kind tag, and to the modal header band.

### Details modal — kept, with a new CTA

The modal stays. It is the quick look and it keeps "I'm going", so the common case never leaves the list.

- **Scrim** — `rgba(18,16,11,.62)`, scrollable, `36px/18px` padding (`14px/12px/70px` on mobile).
- **Modal** — `760px` max, `4px` ink border, `9px 9px 0 rgba(18,16,11,.5)` shadow.
- **Header** — kind-coloured band, `4px` ink bottom border: chips row, Anton `clamp(26px,3.6vw,40px)` title **as a link to the full page** (white, `--yellow` on hover, `3px 3px 0` ink shadow), then the date in condensed 14px ink.
- **Body** — 16px blurb; a 2-column fact grid (Where, Who for, Cost, Places, Distance) that stacks on mobile; a `3px` ink divider; Phone and Listing rows in a `5.6rem/1fr` grid; then the provenance disclaimer: *"We researched this from the organiser's own page, and details change. Check the listing before you set off — dates, prices and age limits move, and a session can be cancelled without us knowing."*
- **Footer** — "Close" (ghost) on the left; on the right a **`--yellow` "View full page →" CTA** (`3px` ink border, `3px 3px 0` shadow, condensed 15px) beside the orange "I'm going". Below them, one 13px `--ink-3` line: *"The full page adds the map, what else is on nearby, other events at this venue, and a link you can share."* On mobile both right-hand buttons go full width.
- **Behaviour** — opens from Details, closes on the Close button, scrim click and Escape; focus moves to Close on open and returns to the triggering Details button on close. Needs `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on the title, and a focus trap in production. Should also push a URL (`/events?event=slug` or a Next.js intercepted route) so the modal is shareable and back-button closable.

### Past events — its own view

Not a filter buried in the pill row. A second view alongside Upcoming in a segmented `.viewsw` control (`3px` ink border, current segment filled ink), with:

- Its own H1: **"Events that have already happened"**, eyebrow "The archive", and the line *"Nothing here is happening. Kept online because riders still look these up."*
- An **index panel** — ink background, `--paper` text: "Browse by year and town", the note *"The archive is a real index, not just a search result. Past events never appear in the upcoming calendar."*, a year pill row (2026/2025/2024) and a town pill row ending in "All towns →".
- **Upcoming never mixes past events in, and past never shows upcoming.** (This was a real bug in the prototype; the row filtering must be tested.)

### Empty state

When a year/town combination has nothing: a `--paper-2` panel with the eyebrow "Ventnor · 2024", an Anton H2 "No past events listed in Ventnor for 2024", the explanation *"We only hold events since 2025 for this town. Try another year, widen to the whole country, or look at what is coming up instead."*, and two buttons — "See upcoming events" and "All past events in the UK". No illustration, no shrug.

### Controls (both views)

Sport tabs (`.sporttab`, `3px` ink border, current filled `--yellow`, each with a count), a search input, a `--lime` "Near me: on" chip with a small ink dot, and kind pills. Pager at the bottom: Previous / "1–4 of 74 upcoming" / Next.

### State

`view: 'upcoming' | 'past'`, `sport`, `kind[]`, `query`, `nearMe`, `year`, `town`, `page`, `openEventId | null`, and per-event private `going`.

---

## Screen 4 — Spots list

**File:** `Spots List.html` · **Purpose:** find a spot. Resolves the one real interaction conflict on the page.

### The conflict and the resolution

A spot card click could mean *"show me this on the map"* or *"open this spot's page"*. It cannot mean both.

**Decision: navigation owns the card.** The card body is a stretched link (`position: absolute; inset: 0` over the card, with a visually-hidden label) to the spot page — the frequent, expected gesture, and the one that needs a real URL. **Map selection is an explicit "Show on map" button** in the card footer, `z-index` above the stretched link. Rejected alternative: whole card selects the map with a small "page" link — that buries the crawlable route in a 12px target and leaves the card with no `href`.

### Card

`--paper`, `3px` ink border, `3px 3px 0` shadow; hover `translate(-2px,-2px)` with a `6px 6px 0` shadow.

- **Selected** — `--paper-2` fill, `6px 6px 0` shadow, and a `9px` `--yellow` keyline bleeding off the left edge (`::before`, ink-bordered, `left: -3px`).
- **Head** — a `44px` ink-bordered `--paper-2` square holding an Anton letter (C concrete / S street / I indoor), then the Anton 23px name, a condensed 13px `--ink-3` meta (`town · country · type · distance`), and a 14px address+phone line — or a muted "No address or phone listed".
- **Chips** — feature tags (`.ttag`, `2px` ink border, `--paper-2`) followed by sport chips.
- **Footer** — separated by `2px solid var(--wash)`: the "Show on map" / "On the map" button (`--sky` when active or hovered, with a small rotated orange diamond), then right-aligned "Spot page →" hint text (orange on card hover) and a ghost "Directions".
- **Report** — a small underlined `--ink-3` "Report" pinned top-right, above the stretched link.

### Map panel (≥900px)

`position: sticky; top: 16px`. Header strip: "The map" + a right-aligned count. The schematic map at 430px with four pins — unselected are `17px` `--paper` diamonds, the selected one is a `22px` solid `--orange` diamond. Below: a "Chosen" ink tag with the spot name, the note *"Cards are links, so the map only changes when you ask it to — use **Show on map** on a card, or a pin."*, and a full-width "Open [spot] page →" button. Pins are clickable in the other direction.

### Mobile sheet (<900px)

The sticky panel is replaced by a docked sheet, fixed above the bottom nav (`bottom: 56px`), `3px` ink top border and a `0 -5px 0 var(--ink)` shadow. It rests at `translateY(calc(100% - 46px))` so its handle is always visible, and slides to `translateY(0)` when open (`transform .2s`). The handle is an ink bar with a `34px` paper grip, "Map · [spot name]", and "Close" right-aligned. Inside: a 190px map, then a **full-width "Open spot page →"** button first, then Directions and Report side by side — so the thumb never hunts for the link behind the map. Tapping "Show on map" on any card raises the sheet. Body padding becomes `104px`.

### State

`spots[]`, `selectedSpotId | null`, `sheetOpen: boolean`, `sportFilter`, `query`, `nearMe`.

---

## Accessibility notes

- Every interactive element is ≥44px tall on mobile (bottom nav items, sheet buttons, full-width CTAs).
- The going toggle is a `<button aria-pressed>`; the map-select button is a real button, not a div.
- Stretched card links carry a visually-hidden descriptive label ("Ventnor Skatepark, Ventnor — open spot page"); the visible "Spot page →" is decorative text inside the card.
- Modal: labelled dialog, Escape to close, focus in on open and restored on close, focus trap required in production.
- All text is full-opacity ink or white-on-colour with an ink shadow — no alpha-muted type. The one 3:1 case is headline-scale band type, which is intentional.
- Colour never carries meaning alone: the date state, the kind and the "over" status are each also stated in words.

## Assets

- **Fonts** — Anton, Barlow Condensed, Archivo (Google Fonts). Already in the app.
- **Icons** — `scoot`, `board`, `bmx` from `packages/ui-web/src/icons.tsx`, drawn `fill: none; stroke: currentColor; stroke-width: 2.2; linecap/linejoin: round` on a 24px box. Copied verbatim into the prototypes; use the real components.
- **No images of any kind.** The map is CSS. If you replace it with a real map component, keep the two accuracy captions.

## Files in this bundle

| File | What it is |
| --- | --- |
| `Artboards.html` | **Start here.** Pannable canvas: all 17 frames (every state, desktop + mobile) with the annotation cards explaining each decision. Frames are live iframes of the files below. |
| `Event Page.html` | Event page. `?state=up` / `?state=today` / `?state=over`. |
| `Spot Page.html` | Spot page. `?v=rich` / `?v=sparse`. |
| `Events List.html` | Events list. `?view=up` / `?view=up&modal=1` / `?view=past` / `?view=empty`. |
| `Spots List.html` | Spots list. `?sheet=0` / `?sheet=1`. |
| `pages.css` | Transcribed tokens + primitives. **Reference only — use the repo's real `ui-web` styles.** |
| `screenshots/` | PNGs of every desktop state: event page upcoming / today / over, spot page rich / sparse, events list upcoming / modal / past / past-empty, spots list. Mobile states are live in `Artboards.html`. |

Open `Artboards.html` in a browser to see everything at once; open the individual pages to click through them. The black prototype bar at the top of each page switches states and is not part of the design.

## Open questions for the team

1. **Modal URL** — should the Details modal push a shareable URL (Next.js intercepted route), or stay client-only? The design assumes it becomes linkable.
2. **Distance** — currently "about N mi away" from the rider's last known town. Confirm the source and whether it should be km outside the UK (the prototype shows `3107 mi` for Montréal, which reads oddly).
3. **Archive depth** — the empty state says "We only hold events since 2025 for this town". Confirm the real cutoff per town.
4. **Spot features** — the "what's here" copy explains each feature type in plain language. Those explanations need to live somewhere central (one per feature type, not per spot).
