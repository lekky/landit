# Handoff: Trick page — Alt A (award-led hero)

## Overview
The trick detail page for the scooter trick tracker. One trick per page: the award badge, the "Can you do it?" stage log, how to do the trick, the rider's own clips and notes, and what landing it unlocks.

Two things changed from the current live page:

1. **The award is never greyed out.** An unearned badge keeps its full colour. State is carried by a mark laid over the badge instead: a red graffiti stamp reading **LANDED** when earned, a dashed grey **NOT YET** in the same position when not.
2. **The stage log is a black band.** "Can you do it?" moved out of the body copy into a full-width black strip directly under the hero, with the five stages as one horizontal ladder. It is the loudest interactive element on the page, which matches its importance — it is the only thing the rider actually does here.

## About the design files
The files in `design/` are **design references created in HTML** — prototypes showing intended look and behaviour, not production code to copy directly. The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, SwiftUI, native, whatever is in use) following its established patterns, component library and state management. If no environment exists yet, pick the most appropriate framework for the project and implement the designs there.

`design/trickpage.css` is a flat prototype stylesheet, not a design system. Treat its class names as documentation of values, not as an API to ship.

## Fidelity
**High fidelity.** Final colours, typography, spacing and states. Recreate pixel-accurately using the codebase's own components. One exception: the badge artwork inside the shield is a **striped placeholder** — real badge art is to be supplied and dropped into the same slot (see Assets).

## Screens / views

### 1. Trick page — desktop (`Trick Page - Desktop (not landed).html`)
Rider has not started tracking this trick.

**Layout**
- Page background: `#F2ECDC` with a 14×14px dot grid (`radial-gradient(rgba(18,16,11,.07) 1.1px, transparent 1.1px)`).
- Content column max-width 1200px, centred, page padding 34px 40px.
- "← All tricks" back link above the card, 13px condensed uppercase, `#6E665A`.
- One card: `background #FFFDF5`, `border 3px solid #12100B`, `box-shadow 5px 5px 0 #12100B`, no radius anywhere in this design.

**Card sections, top to bottom**
1. **Hero** — green `#10A06A`, padding 18px 22px 26px, 3px ink bottom border, flex row, items bottom-aligned, gap 16px.
   - Badge 118×136px, `margin-bottom:-46px` so it overhangs into the section below. Drop shadow `4px 4px 0 #12100B`.
   - Category tags: "Flat" (solid ink) and "Scooter" (outline, orange text/border on paper).
   - Title "Tic Tac" — Anton 56px uppercase, white, `text-shadow 3px 3px 0 #12100B`.
   - Subline "The award · Land the Tic Tac" — Barlow Condensed 14px uppercase, ink.
   - Right-aligned block: label "Difficulty · Rookie" (11px, .16em tracking) over a 5-segment difficulty meter (13×10px skewed `skewX(-16deg)` bars, 2px ink border, filled = solid ink).
2. **Black log band** — `#12100B`, padding 18px 22px 20px **158px** (the left inset clears the overhanging badge).
   - Row: "Can you do it?" in yellow `#FFC23F`, right side status in `#C9C2B4` ("Nothing logged yet" / "Logged · Sometimes").
   - Stage ladder: 5 equal cells in one row, container `border 2.5px solid #FFFDF5`, cells split by 2.5px ink dividers, each cell = 15px circle over a 13.5px condensed uppercase label. Cell padding 14px 4px 13px.
   - Helper line in `#C9C2B4`: "Tap a stage to start tracking. The badge gets stamped at **Sometimes**."
3. **Body** — padding 22px, CSS grid `minmax(0,1.3fr) minmax(0,1fr)`, gap 24px.
   - Left column (gap 16px): "◆ The lowdown" + paragraph; "What you need" kit block (34px orange square + label + line, cream `#FFF7E4` bg, 2.5px ink border); "◆ Tips" + paragraph; "Fun fact" block (cream bg, 7px green left border, Anton 13px green key); "Land this and you unlock" panel of chips.
   - Right column (gap 16px): "Your videos" panel (16:9 dark video slot with 44px orange play square, then a paste-link field), privacy note, "Session notes" panel with a textarea-style note box.
   - Section eyebrows are green 11px condensed uppercase prefixed with "◆".

### 2. Trick page — desktop, landed (`Trick Page - Desktop (landed).html`)
Same page once the rider has logged Sometimes. Differences only:
- Badge carries the red **LANDED** stamp instead of NOT YET.
- Band status reads "Logged · Sometimes" in sky `#3AC0FF`; the first three ladder cells are filled (past = cream bg + solid ink dot, current = sky bg + hollow dot).
- Helper line is replaced by a "First landed 18 Aug 2026" pair plus **Stop tracking** (ghost) and **Share it** (orange) buttons.
- Unlock panel heading becomes "You unlocked" and already-landed chips get the lime `#9CE05B` fill.

### 3. Trick page — mobile (`Trick Page - Mobile (landed).html`)
420px wide, one column, landed state shown.
- Ink app bar (title + avatar dot) at top, ink tab bar at the bottom with the active item in yellow.
- Same card structure, compressed: badge 82×96px overhanging `-40px`; hero title 30px; the cream strip under the hero carries the award name and "Earned 31 Aug 2026"; the black log band follows with the ladder abbreviated to Want / Learn / Some / Most / Every.
- Everything below is a single stack, 12–14px padding, panels 13px padding.
- All tap targets ≥ 44px. Stage cells are full-height rows of the ladder — keep them at 44px minimum when implementing.

### 4. Award states (`Award States.html`)
Reference sheet for the badge. Large (150×174) and small (82×96) sizes, both states, plus the rules.

## The award badge — spec
- **Shield**: yellow `#FFC23F`, `clip-path: polygon(50% 0, 100% 13%, 100% 62%, 50% 100%, 0 62%, 0 13%)`, hard drop shadow `drop-shadow(Npx Npx 0 #12100B)` (3–4px at page sizes, 6–7px when the badge is a hero element).
- **Art slot**: `inset: 12% 18% 46%` — real artwork goes here.
- **Nameplate**: ink bar at `top:52%`, inset 6% each side, Anton 12px paper text, centred, single line, overflow hidden.
- **Star**: at `top:73%`, centred, ink.
- **Earned stamp** (`.gs`): Anton 24px uppercase in red `#E5203C`, 4px solid red box, rotated `-12deg`, centred at `top:30%` so it crosses the art and never the nameplate, `mix-blend-mode: multiply`, distressed with a mask (`repeating-linear-gradient(58deg, #000 0 9px, transparent 9px 10.5px)` intersected with a soft radial), and two small paint drips hanging off the bottom edge via `::before`/`::after`. Small variant `.gs.sm` is 16px/3px border.
- **Date chip** (`.gs.date`): paper background, 2.5px red border, Anton 12px red, rotated `-4deg`, sits 6px below the badge. No mask, no blend mode. Reserve ~30px below the badge for it.
- **Not-earned mark** (`.pend`): Anton 19px uppercase `#6E665A`, 3px dashed border, same rotation and position as the stamp, opacity .75.

**Rules**
- Stamp appears when the rider first logs **Sometimes** and never comes off, even if they later move the stage back down.
- Date chip shows the *first* landed date, not the most recent.
- Below 60px badge height, drop the date chip and use the small stamp only.
- Never desaturate, grey out or reduce the opacity of the shield.

## Interactions & behaviour
- **Stage ladder** — five mutually exclusive options; tapping one sets the rider's stage for this trick and saves immediately (no confirm step). Tapping the current stage again does nothing. Cells: default paper, past = cream + filled dot, current = sky `#3AC0FF` + hollow dot.
- **First log** starts tracking the trick. **Stop tracking** (landed state) needs a confirm — it clears the stage but must not clear the first-landed date or the earned stamp.
- **Award transition** — when the stage crosses into Sometimes, the stamp should land rather than fade: quick scale from ~1.25 → 1 with the rotation held, ~180ms, plus a 1-frame offset "ink" shadow. No bounce.
- **Add video** — paste a YouTube URL, validate it is a YouTube watch/shorts/youtu.be link, store the link only, never the file. New clips default to private. Show an inline error under the field on an invalid link.
- **Session notes** — free text, autosave on blur.
- **Unlock chips** — each links to that trick's page. Landed ones carry the lime fill.
- **Hover** (desktop) — panels and buttons shift 1px toward their shadow (`translate(1px,1px)` with the shadow reduced by 1px), giving a pressed feel. No colour change.
- **Responsive** — the two-column body collapses to one column below ~900px; the black band's 158px left inset drops to normal padding once the badge no longer overhangs (mobile puts the badge overhang against a cream strip instead).

## State management
Per trick, per rider:
- `stage`: null | want | learning | sometimes | most | every
- `firstLandedAt`: date, set once when stage first reaches sometimes, never overwritten
- `earned`: derived — `firstLandedAt != null`
- `videos`: [{ id, url, addedAt, visibility }]
- `notes`: string
- `unlocks`: [trickId] with each trick's own earned flag for chip fill

Trick content itself (name, category, difficulty, lowdown, tips, kit, fun fact, badge art) is static CMS data.

## Design tokens
Colours
| Token | Hex | Use |
|---|---|---|
| ink | `#12100B` | borders, shadows, black bands, primary text |
| ink-2 | `#3A352C` | body copy |
| ink-3 | `#6E665A` | secondary labels, not-earned mark |
| paper | `#FFFDF5` | cards |
| paper-2 | `#FFF7E4` | inset blocks (kit, fun fact) |
| wash | `#F2ECDC` | page background |
| green | `#10A06A` | hero, eyebrows, fun-fact rule |
| yellow | `#FFC23F` | badge shield, active nav, band labels |
| orange | `#FF5A1F` | primary buttons, links, outline tags |
| pink | `#FF3D78` | avatar / accent only |
| lime | `#9CE05B` | landed chips |
| sky | `#3AC0FF` | current stage |
| red | `#E5203C` | earned stamp + date chip (this colour is only ever the stamp) |
| band text | `#C9C2B4` | secondary text on ink |

Type
- Display: **Anton**, uppercase, line-height .92. 56px desktop title, 30px mobile title, 32px section heads, 12–15px nameplates.
- Condensed UI: **Barlow Condensed** 600/700, uppercase. Labels 11px / .16em tracking; pills, buttons, ladder 12.5–15px / .09–.1em.
- Body: **Archivo** 400. 15.5px desktop, 14.5px mobile, 13px fine print. `text-wrap: pretty`.

Geometry
- Borders 2.5px (inner elements) and 3px (cards, bands); 4px on the trading-card variant only.
- Shadows: `5px 5px 0 ink` (cards), `3px 3px 0 ink` (flat panels, buttons), `1.5px 1.5px 0 ink` (tags). Always hard, never blurred.
- Border radius: **0 everywhere**, except the 50% circles in the stage ladder and avatar.
- Spacing scale in use: 6 / 9 / 12 / 14 / 16 / 22 / 24px.
- Skewed elements use `skewX(-16deg)`; sticker rotations stay within ±2.5deg.

## Assets
- **Badge artwork** — placeholder only in these files (diagonal stripe fill inside the shield's art slot). Real per-trick art needs supplying; it drops into `inset: 12% 18% 46%` of the shield and must read at 82×96px.
- **Video thumbnails** — the dark striped slot is a placeholder; use the YouTube thumbnail for the stored link.
- **Avatar** — flat pink circle placeholder.
- **Fonts** — Anton, Barlow Condensed, Archivo, all Google Fonts. Self-host in production.
- No icon set is used; the "◆" eyebrow marker and "▶" play glyph are text characters and can be swapped for the codebase's icon set.

## Files
```
design/Trick Page - Desktop (not landed).html
design/Trick Page - Desktop (landed).html
design/Trick Page - Mobile (landed).html
design/Award States.html
design/trickpage.css          shared prototype stylesheet
screenshots/01-desktop-not-landed.png
screenshots/02-desktop-landed.png
screenshots/03-mobile-landed.png
screenshots/04-award-states.png
```

The full exploration this was chosen from — six page layouts and four award-state treatments side by side — lives in the project at `Trick Page Alternatives/Trick Page Alternatives.html`.
