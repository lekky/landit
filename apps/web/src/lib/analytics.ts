/**
 * What Land The Trick tells PostHog, and what it deliberately does not (§6.8).
 *
 * The options live here rather than inline in the provider for the same reason
 * Sentry's do (`sentry.ts`): they are a **privacy decision** about a service
 * used by children, and a privacy decision inlined into a React component is one
 * nobody tests. Every choice below is asserted in `analytics.test.ts`.
 *
 * **It is off unless a key is set**, which is the honest default for CI, for
 * every local checkout, and for any deployment nobody has configured. A build
 * that quietly started reporting a child's navigation somewhere would be worse
 * than one that reports nothing.
 *
 * ## What the cookie policy already promises
 *
 * `/legal/cookies` is public and says, of this: it is "set up without cookies
 * and without advertising identifiers, and the counts are not attached to you.
 * There is no per-rider analytics profile here — not one to look at, not one to
 * switch off, and not one to ask us for." That is not marketing copy to live up
 * to later; it is a published statement that this file has to keep true. Three
 * options carry it, and none of them is a default:
 *
 *  - **`cookieless_mode: 'always'` with `persistence: 'memory'`** — no cookie,
 *    no `localStorage`, no `sessionStorage`. Nothing is written to a rider's
 *    device at all, so there is no identifier to carry between page loads and
 *    none to ask us to delete. Riders are counted instead by a hash PostHog
 *    computes on its own servers from
 *    `(team, daily salt, IP, user agent, hostname)`; the salt is thrown away at
 *    the end of each day, which is what makes the hash irreversible and stops it
 *    being an identifier for a person rather than for a day's visit.
 *
 *    **So "unique riders" means unique *per day*.** The same child on Tuesday
 *    and Wednesday is two, because the salt changed — a monthly figure is a sum
 *    of daily ones and will overcount. That is the honest limit of counting
 *    without storing anything, and it is the right way round for this product:
 *    the alternative buys a truer monthly number with a durable identifier for a
 *    child, which is the thing `/legal/cookies` says we do not keep.
 *
 *    `persistence: 'memory'` stays set beneath it. Cookieless mode already
 *    disables storage, but the two are independent switches and only one of them
 *    is named in the policy.
 *  - **`person_profiles: 'never'`** — the SDK will not create a person profile
 *    even if some future call site reaches for `identify()`. The promise is then
 *    enforced by configuration rather than by everyone remembering, which is the
 *    difference between a guarantee and a habit.
 *  - **`autocapture: false`** — autocapture records the text of what was
 *    clicked. On this product that is rider handles, crew names, trick names a
 *    child typed and the free-text goal from onboarding step 3. Every event here
 *    is therefore hand-written below, and a screen that wants a new one adds it
 *    to `ANALYTICS_EVENTS` where it can be read and argued with.
 *
 * Session replay, surveys and feature flags are off as well: a replay is a
 * recording of a child using an app, a survey is third-party UI rendered in
 * front of one, and we use no flags. `disable_external_dependency_loading` stops
 * the SDK fetching the scripts those three would need, so switching one on is a
 * deliberate change here rather than a remote toggle in somebody's dashboard.
 *
 * ## Two things this file cannot do
 *
 * **Cookieless mode has to be switched on in the PostHog project as well**
 * ("Cookieless server hash mode", under the project's web-analytics settings).
 * The SDK asking for it is not enough: with the project setting off, PostHog
 * **ignores every cookieless event**, so the failure mode is an empty dashboard
 * rather than an error. That is the one thing to check first if nothing appears.
 *
 * **The IP address is PostHog's to handle, not ours.** The SDK's own `ip` option
 * is deprecated and does nothing, and the `$ip` denylist below only removes the
 * property the *browser* sends — ingestion reads an address off the request
 * regardless. In cookieless mode that address is the hash's main ingredient and
 * is stripped before any transformation runs, which is why GeoIP and bot
 * detection stop enriching events. **Do not also switch on "Discard client IP
 * data"**: cookieless mode already does that job, and the two settings pull on
 * the same input with no documented answer for what happens when both are set.
 *
 * **A processor contract still has to exist.** Plan §6.5 lists PostHog among the
 * services needing an Article 28 contract and a ROPA entry. Wiring the SDK does
 * not create one.
 */

import type { PostHogConfig, Properties } from 'posthog-js';

import { stripQuery } from './sentry';

/** The project key, or empty when analytics is switched off. */
export function analyticsKey(): string {
  return (process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '').trim();
}

export function analyticsEnabled(): boolean {
  return analyticsKey().length > 0;
}

/**
 * Which PostHog to talk to. **EU by default and on purpose** (plan §1): rider
 * data stays in the EU, which is the same reason R2 and MailerSend were picked.
 * Overridable only so a checkout can point at a throwaway project.
 */
export function analyticsHost(): string {
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '').trim();
  return host.length > 0 ? host : 'https://eu.i.posthog.com';
}

/**
 * The event names, in one place, because a name typed at a call site is a name
 * that gets typed differently at the next one and quietly splits a funnel in
 * two.
 *
 * The rule for what may travel with an event: **catalogue facts, never rider
 * facts.** A trick id, a sport, a difficulty and a plan slug all describe the
 * product and are the same for everybody who touches them. A rider id, a handle,
 * a display name, a guardian's email address and anything a child typed are
 * none of our analytics' business — most sharply the custom goal from onboarding
 * step 3, which is free text written by a child and never leaves the device.
 *
 * **This is the whole of the safety argument now that the catalogue is broad.**
 * Coverage was widened on 2026-08-21 (owner, in chat) from the four areas §6.8
 * named to nearly every action a rider can take. Autocapture was considered for
 * it and refused again in the same breath, because the two are not the same
 * trade: an event written here is one somebody chose the properties for, while
 * autocapture sends the *text of whatever was clicked* — which on this product
 * is crew names, rider handles and spot names a child typed. Breadth is safe;
 * automatic breadth is not. A new screen is therefore untracked until somebody
 * adds an entry below, and that is the direction this should fail in.
 *
 * Three events name a thing that happened on a path carrying something secret,
 * and each carries only that it happened: `consent_decided` (never the token —
 * see `URL_PROPERTIES`), `report_filed` (never a word of the report), and
 * `guardian_asked` (never the address).
 *
 * ## Adding one
 *
 * `CLAUDE.md` asks every session's opening brief to say which events its work
 * adds, so this is the recipe it is pointing at. Four steps, and the third is
 * the one that surprises people:
 *
 *  1. Add the entry below, `camelCase: 'snake_case'`, under the right heading.
 *  2. Call it from the screen, through `capture` in `analyticsClient.ts` —
 *     never `posthog` directly, so an analytics failure cannot break a page.
 *     Fire it **after** the write succeeds, not optimistically; where success
 *     is a redirect, `useFailureCapture` and `useSuccessCapture` are the way.
 *  3. **Add it to the pinned list in `analytics.test.ts`**, which will fail
 *     until you do. That is on purpose: the catalogue is the privacy boundary
 *     now that autocapture is refused, so growing it should cost a deliberate
 *     edit in a file whose whole subject is what may be collected.
 *  4. Check the properties against the rule above. If you are about to send
 *     something a rider typed, send a count or a category of it instead.
 */
export const ANALYTICS_EVENTS = {
  /* ------------------------------------------------------------ account -- */
  /** An account was created. Carries nothing about who. */
  signedUp: 'signed_up',
  signedIn: 'signed_in',
  signedOut: 'signed_out',
  passwordResetRequested: 'password_reset_requested',
  passwordResetCompleted: 'password_reset_completed',
  verificationResent: 'verification_resent',
  /**
   * A sign-up, sign-in, new password or email confirmation was refused, and
   * why (issue #370).
   *
   * Carries `form` — `'signup'`, `'signin'`, `'reset'` or `'verify'` — and
   * `reason`, one of `AUTH_REFUSAL_REASONS` in `authRefusal.ts`:
   * `'email_taken'`, `'bad_credentials'`, `'dead_link'`, `'invalid'` or
   * `'other'`. Both are fixed strings chosen in this repository, and the server
   * picks the reason from PocketBase's error *codes*, so neither can carry
   * anything a rider typed.
   *
   * **Never the address, never the password, and never PocketBase's message.**
   * `email_taken` is the category that stands in for the address; the address
   * itself is exactly the rider fact the rule above forbids.
   *
   * It exists because `outcome: 'failed'` on the four forms' own events says
   * *that* a rider was turned away and not *why*, and the why decides the fix.
   * Riders lost to `email_taken` want a better way back into the account they
   * already have; riders lost to `dead_link` are a link that dies too soon
   * (issue #233); `other` is our end breaking. Before this, the forms could not
   * tell those apart even on screen.
   */
  authRefused: 'auth_refused',
  /**
   * A profile answer was stored. The panel autosaves, so this fires once per
   * control a write covered — `field` is one of `avatar`, `sports`, `goal`,
   * `goal_text`, `stance`, `level`, and `outcome` is `saved` or `failed`.
   * The name of the control only: never the goal a rider wrote, never which
   * picture or which sports they chose.
   */
  profileSaved: 'profile_saved',
  /** A privacy toggle moved. Carries which setting and its new value. */
  privacySet: 'privacy_set',

  /* ------------------------------------------------------- safeguarding -- */
  /** A rider asked a grown-up for consent. Never the email address. */
  guardianAsked: 'guardian_asked',
  /** A guardian approved or revoked. Never the token, never the address. */
  consentDecided: 'consent_decided',
  /** A report was filed. **That** it happened, and what kind — never a word of it. */
  reportFiled: 'report_filed',

  /* --------------------------------------------------------- onboarding -- */
  onboardingStep: 'onboarding_step',
  onboardingFinished: 'onboarding_finished',
  /**
   * "Where did you find us?", answered on the last step of onboarding.
   *
   * Carries `source`, one of the nine ids in `HEARD_ABOUT`
   * (`packages/core/src/data/profile.ts`) — a closed list this repo wrote, with
   * no free-text option anywhere near it, which is what makes it sendable under
   * the rule above. Fired only when a rider answers; skipping is silent, so the
   * gap between this and `onboarding_finished` is the skip rate.
   *
   * **It is not the whole answer to "what marketing works", and is not meant to
   * be.** Analytics here is cookieless with no person profiles, so this can only
   * ever count channels — it cannot say whether riders from one of them stayed
   * or paid. That question is answered from `users.heard_about`, which sits
   * beside the plan on the rider's own row. This event exists because the count
   * itself is worth having in the same dashboard as the funnel it ends.
   */
  heardAbout: 'heard_about',

  /* ---------------------------------------------------------- the loop -- */
  /** "I rode today" — the weekly streak, and the best signal the product has. */
  rideLogged: 'ride_logged',
  /** A rider moved a trick's stage. Carries the trick's catalogue facts. */
  trickLogged: 'trick_logged',
  /**
   * A note was saved against a trick — added or reworded (T30 made notes a
   * dated log). Never the note, and never its length. Carries the trick's
   * catalogue facts and, for an add, the stage stamped on it.
   */
  noteSaved: 'note_saved',
  /** A note was removed from a trick's log. Same properties, never the note. */
  noteRemoved: 'note_removed',
  challengeLogged: 'challenge_logged',
  /** The coach-view toggle on the progress screen. */
  insightsSet: 'insights_set',

  /* ------------------------------------------------------------- crews -- */
  crewCreated: 'crew_created',
  crewJoined: 'crew_joined',
  crewLeft: 'crew_left',
  inviteMinted: 'invite_minted',

  /* ------------------------------------------------------------ content -- */
  videoLinkAdded: 'video_link_added',
  videoLinkRemoved: 'video_link_removed',
  videoVisibilitySet: 'video_visibility_set',
  /** A spot was submitted for review. Never its name or the address typed. */
  spotSubmitted: 'spot_submitted',
  /** Going / not going on an event. */
  eventAttendanceSet: 'event_attendance_set',
  /**
   * An event's own page was opened, and how the reader got to it.
   *
   * Carries `source` — `'list'`, `'modal_cta'` or `'direct'`, three fixed
   * strings chosen here — and the event's `kind`, which is catalogue copy
   * ("Jam", "Comp"). Never the event's name, never its town, and nothing about
   * who was reading: an event page is public, so most of the people this counts
   * have no account at all.
   *
   * It exists because we kept the Details modal **and** added a full page, and
   * that is a decision with no obvious right answer. The modal is the quick
   * look and holds "I'm going"; the page is the thing you can share, crawl and
   * come back to. `source` is the only way to find out whether the full-page
   * CTA earns the room it takes in the modal footer, or whether riders were
   * happy in the modal and every real arrival comes from a link somebody sent
   * — which are opposite answers with opposite next steps.
   */
  eventPageOpened: 'event_page_opened',
  /**
   * The calendar was switched between its two halves — Upcoming and the
   * archive.
   *
   * Carries `view`, which is `'upcoming'` or `'past'`: the half being moved
   * *to*, and one of two fixed strings chosen here. Nothing else — not which
   * events were on screen, not the filters, not the reader.
   *
   * It exists because keeping finished events online is a bet, and this is the
   * only thing that settles it. The archive costs a route, a sitemap section
   * and an index panel on the reasoning that riders still look up what happened
   * at their park last summer; if the segmented control is never pressed, the
   * traffic is arriving on the event pages from search and the archive's own
   * front door is furniture. Those are opposite findings and neither is
   * guessable from `event_page_opened`, which cannot tell an archive reader
   * from anybody else.
   */
  eventsViewSwitched: 'events_view_switched',
  /**
   * A glossary term was reached — by a deep link into `/glossary#term`, or by
   * following one of a term's "See it in" pills to a trick (T29).
   *
   * Carries `term` (the slug, one of the catalogue's fixed strings), `source`
   * — `'inline'` when the reader came from a dotted word in a trick's own
   * copy, `'page'` when they were already on the glossary — and `sport`, the
   * active filter or `null`. Never anything a rider typed: the page has no
   * search box, and every value here is chosen from a list we wrote.
   *
   * It exists because the glossary is a bet that riders will follow a word out
   * of a trick page and back again. `source` is what tells the inline links'
   * traffic from the footer's, and a pill press from a page nobody reads past
   * the first screen of — which between them say whether the dotted underline
   * earns its place on every trick's tips, or the page should stay something a
   * curious reader finds on their own.
   */
  glossaryOpened: 'glossary_opened',

  /* ------------------------------------------------------------- awards -- */
  /**
   * An award was announced to its rider — fired when the wall first shows the
   * earned badge, because the earn itself happens in a PocketBase hook where
   * no analytics runs. Carries the award's catalogue facts (slug, stars,
   * rarity), never anything the rider did to earn it.
   */
  stickerEarned: 'sticker_earned',
  /** The share card was opened for an earned award. Carries the slug. */
  stickerShared: 'sticker_shared',
  /**
   * The wall's Earned / Not yet switch was used (T33). Carries `earned` or
   * `unearned` — two fixed strings, the same for every rider.
   *
   * It exists because the wall now opens on a rider's own collection, and the
   * question that answers is whether anybody goes looking at the rest. If the
   * Not yet tab is never pressed, 121 badges are being drawn for nobody and
   * the shelving is the wrong shape; if it is pressed constantly, the default
   * is.
   */
  stickerViewSwitched: 'sticker_view_switched',
  /**
   * A capped shelf was opened with "Show all" (T33). Carries the shelf id —
   * one of the nine in `groups.ts`, a catalogue fact, never how many the rider
   * holds on it.
   *
   * Six per shelf is a guess, and this is what turns it into a measurement:
   * which shelves riders open says where the cap is too tight, and a shelf
   * nobody ever opens says the opposite.
   */
  stickerShelfExpanded: 'sticker_shelf_expanded',

  /* -------------------------------------------------------------- money -- */
  /** A locked trick was opened — the paywall, seen. Carries tier and sport. */
  paywallHit: 'paywall_hit',
  /** Checkout was started from a plan card. Carries plan slug and period. */
  upgradeStarted: 'upgrade_started',
  billingPortalOpened: 'billing_portal_opened',

  /* --------------------------------------------------------- getting about -- */
  /** The sport switcher in the top bar. */
  sportSwitched: 'sport_switched',
  /** A nav destination was chosen. Carries the route, which is not a rider fact. */
  navClicked: 'nav_clicked',
  /**
   * The bottom bar's section drawer was shown.
   *
   * Carries `section` (`whats-on` or `progress`) and `trigger` — `arrival` when
   * the drawer announced itself on the way into the section, `tap` when the
   * rider opened it themselves from the lit cell. Both are fixed strings from
   * `components/shell/nav.ts`; neither can carry anything a rider typed.
   *
   * It exists to answer the one question the drawer is a bet on: whether
   * anybody finds the second screen in a section. Before it, Spots and Events
   * were one label and Progress and Stickers were another, and nothing in the
   * product could say whether the folded half was ever reached. A `tap` is the
   * strong signal — it means the caret was understood without being shown.
   */
  navSectionOpened: 'nav_section_opened',
  /**
   * Something on the signed-out landing page was pressed.
   *
   * Carries `target` — where it goes (`signup`, `signin`, `library`, `spots`,
   * `events`, `plans`) — and `place`, which of the page's three zones it
   * was pressed in (`bar`, `hero`, `band`). Both are fixed strings chosen here,
   * so neither can carry anything a visitor typed.
   *
   * **Emphatically not the email address.** The hero's field is a sign-up
   * shortcut, and this event fires on the press, never with its contents; the
   * address reaches the server as a form field and nothing else. A visitor to
   * this page has no account, so there is no rider to describe even if the rule
   * above allowed it.
   *
   * It exists because the top of the funnel was the one part of the product
   * with no measurement at all — every event in this file needs a rider, and
   * this page's whole job is to produce one. Which of the two no-sign-up peeks
   * a stranger takes is the question the hero was designed around and nothing
   * could answer.
   */
  landingCta: 'landing_cta',
  /**
   * A rider took the one action an empty screen offers — "Find a trick" on a
   * dashboard with nothing landed, "Invite a mate" on an empty crew. Carries
   * which screen and which action, both catalogue facts. This is the first
   * signal a brand-new account gives after onboarding, and the one that says
   * whether the empty state did its job.
   */
  emptyStateAction: 'empty_state_action',
  /*
   * `theme_changed` was here from 2026-09-01 until 2026-09-04, counting the
   * Account theme picker. The product is light-only again (Rachid, in chat) and
   * the picker is gone, so nothing fires it. Removed rather than left in place:
   * this catalogue is the record of what the product actually measures, and a
   * name nobody fires is a funnel somebody will one day go looking for.
   */
  /** The library's sport / category / tier filters. */
  libraryFiltered: 'library_filtered',
  /**
   * A rider followed an onward link from a trick page (T31).
   *
   * Carries `kind` — `'road'`, `'unlocks'`, `'similar'`, `'practise'` or, since
   * T32, `'cross-sport'` for the "Same trick, other sports" panel: the five
   * link groups the page has and five fixed strings chosen here — `from`, the
   * slug of the trick page they were on, and `to`, the slug of the trick they
   * went to, or for `practise` the spot-feature tag the link narrowed the
   * spots list to. Every value is a catalogue fact: slugs and feature tags are
   * written in this repository, and nothing about the rider travels — not
   * whether they had landed either trick, and not which plan they are on.
   *
   * It exists because the page grew four ways onward at once, and the question
   * behind all of them is the same: do riders move *through* the library from
   * a trick page, or do they read one and go back to the grid? `kind` is what
   * says which of the five earns its room, and `from`/`to` are what say
   * whether the road is walked upward, toward harder tricks, or back down —
   * or, for `cross-sport`, whether a rider ever crosses into another sport's
   * library from the trick they know.
   */
  trickLinkFollowed: 'trick_link_followed',
  /**
   * A list went nearest-first, because a position is in hand. Fired by both
   * `/spots` and `/events`.
   *
   * Carries `screen` (`'spots' | 'events'`) and `source`, and nothing else:
   * `'pressed'` when the rider pressed for it on this visit, `'resumed'` when
   * their browser was already granting it and the screen opened that way (§6.4
   * standard 10, as amended 2026-08-30). That distinction is the whole reason
   * the event exists — it is the only way to tell whether the silent resume is
   * doing anything for anybody — and `screen` is what stops the two lists'
   * funnels merging into one number that answers neither question.
   *
   * **The position itself is not a property and never may be.** A latitude and
   * longitude is the sharpest rider fact this product ever holds, it is the one
   * thing standard 10 says we do not keep, and the rule above ("catalogue
   * facts, never rider facts") rules it out on its own.
   */
  nearbySortUsed: 'nearby_sort_used',
  /**
   * The spots map was switched between its two grounds.
   *
   * Carries `ground` — `'plain'` or `'detail'`, two fixed strings that describe
   * the basemap and nobody in particular. Never which spot was on screen when
   * it was pressed, and never a position.
   *
   * It exists to answer the question that made the toggle: riders asked for
   * satellite, this is the answer we could give without putting a paid tile
   * vendor in a child's request path (`MAP_STYLES`), and if nobody ever presses
   * it that is the evidence the real ask was imagery after all.
   */
  spotsMapGround: 'spots_map_ground',
  /**
   * The map sheet came up on a phone. No properties at all.
   *
   * **Fired only below the sheet's own breakpoint**, which is the whole reason
   * it is trustworthy: on a wide screen the map is simply on the page and
   * nothing opens, so counting that too would bury the one figure this is for.
   *
   * It exists because the thing it measures was invisible. The map used to
   * render below every card — 6,435px down on a 375px screen, further with each
   * "Show more" — so a rider tapping "Show on map" got no feedback at all, and
   * nothing in the product could have told you. This is how we find out whether
   * riders on phones now reach the map.
   */
  spotsMapSheetOpened: 'spots_map_sheet_opened',
  /**
   * A spot's own page was opened — `/spots/[slug]`, the crawlable page behind
   * the list.
   *
   * Carries two things. `origin` is `'researched'` or `'submitted'`: whether
   * this is a place staff put on the map or one a rider put forward and staff
   * approved. That is the question the page exists to answer — a page built
   * from a rider's twenty-five words has to earn its place, and this is the
   * only way to find out whether anybody reads one. `type` is the spot's kind
   * (`Concrete`, `Street spot`, `Indoor park`), which is a facet the list
   * already filters by.
   *
   * **Never the spot's name and never its slug**, and this one needs saying
   * because the slug looks like a harmless product fact. It is not: a submitted
   * spot's name is text a child typed, and its slug is that text with the
   * punctuation taken out. Sending either would put a rider's own words in a
   * third party's event store through the back door — exactly what the rule at
   * the head of this list forbids, and exactly why `spot_submitted` above
   * carries neither. The two properties here are both drawn from fixed sets
   * chosen in this repository, so neither can carry anything anybody typed.
   */
  spotPageOpened: 'spot_page_opened',
  /*
   * `spot_page_opened` also carries `operating` (`open` | `closed` | `unknown`)
   * and `indoor` (a boolean). Both are staff-set from fixed lists rather than
   * typed, so both are catalogue facts and neither can leak what a child wrote.
   * `operating` is the one that answers a question we cannot otherwise ask: a
   * closed park keeps its page, and this is the only way to learn whether
   * anybody still reads one.
   *
   * And `source` — a `SPOT_SOURCES` id from `@landit/core` (`researched`,
   * `rider`, `fr-sports-gouv`, and the world import's `osm-tnf`, `tnf` and `osm`), or
   * `unknown` for a value the catalogue does not
   * know. The France import (issue #362) put three thousand machine-named
   * pages on the map at once, and this is the only way to learn whether the
   * imported pages are read at all or only the ones a human researched. The
   * id is chosen in this repository and is never shown on the page.
   */
  /**
   * A spot was put on the map from the list — the "Show on map" button on a
   * card, or a pin.
   *
   * Carries `via`: `'card'` for the button in a card's footer, `'pin'` for a
   * press on the map itself. Two fixed strings chosen here; never the spot's
   * name or slug, for the reason `spot_page_opened` above sets out at length,
   * and never a position.
   *
   * It exists because this gesture just got smaller. The whole card used to
   * select the map; the card is now a link to the spot's page (the design
   * handoff's "the conflict and the resolution"), so map selection has shrunk
   * from a card-sized target to a button. That is a deliberate trade — the
   * frequent gesture got the big target and a real URL — and this is the only
   * way to find out whether the map survived it or whether riders simply
   * stopped reaching the map at all.
   */
  spotMapSelected: 'spot_map_selected',
  /**
   * "Search this area" was pressed on the spots map: the list became the spots
   * inside the view the rider had moved the map to.
   *
   * Carries `view` — `'sheet'` on a phone, where the map is a sheet over the
   * list, or `'column'` where it sits beside it. Two fixed strings chosen here.
   *
   * **Never the view itself** — not its edges, its centre or its zoom, and not
   * how many spots it held. A map nobody has moved sits over the rider's
   * nearest spots, so where a rider is looking can be where a rider is: the
   * rule standard 10 sets for the position covers this too (§6.4, extended
   * 2026-09-11), and it is kept without leaning on the button only appearing
   * after a move.
   *
   * It exists to say whether riders browse by map at all, and it pairs with
   * `spot_map_selected` (`via: 'pin'`) for whether a searched area leads on to
   * a spot being chosen.
   */
  spotsAreaSearched: 'spots_area_searched',
  /**
   * A numbered block on the spots map was pressed, and the map zoomed into it
   * (issue #388).
   *
   * Carries `view` — `'sheet'` or `'column'`, as `spots_area_searched` does —
   * and nothing else: not the count on the block, not where it was, not the
   * zoom. The count is a fact about a place on the map, and a place on the map
   * is the thing standard 10 keeps out of every property (§6.4).
   *
   * It exists to say whether riders browse the map by opening blocks at all —
   * the evidence for whether every-spot plotting was worth the points download
   * it costs every visitor whose map is on screen.
   */
  spotsMapClusterOpened: 'spots_map_cluster_opened',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * Properties whose value is a URL or a path, and which therefore may carry a
 * capability in a path segment.
 *
 * This is the same problem `sentry.ts` solves for error reports, and it uses the
 * same solution rather than a second one: `/consent/approve/<token>` is a live
 * guardian-consent credential (plan §3, guarantee 4), and a `$pageview` from
 * that page would put it in a third party's event store as surely as a stack
 * trace would. `stripQuery` removes the query string and redacts the consent
 * paths; the list below is where it gets applied.
 *
 * Named explicitly rather than guessed at by shape. A rule like "any string that
 * starts with a slash" would be confident and wrong in both directions — the
 * comment in `sentry.ts` on `SECRET_PATHS` argues this at length.
 */
const URL_PROPERTIES: readonly string[] = [
  '$current_url',
  '$pathname',
  '$referrer',
  '$initial_current_url',
  '$initial_pathname',
  '$initial_referrer',
  '$session_entry_url',
  '$session_entry_pathname',
  '$session_entry_referrer',
];

/**
 * Every URL-bearing property, scrubbed, on its way into an event.
 *
 * Returns a new object rather than editing in place: `sanitize_properties` is
 * handed the SDK's own property bag, and a mutation there is a change to state
 * we do not own.
 */
export function scrubProperties(properties: Properties): Properties {
  const out: Properties = { ...properties };
  for (const key of URL_PROPERTIES) {
    if (typeof out[key] === 'string') out[key] = stripQuery(out[key]);
  }
  return out;
}

/** The subset of PostHog's config this app sets. */
export type AnalyticsOptions = Pick<
  PostHogConfig,
  | 'api_host'
  | 'autocapture'
  | 'capture_pageview'
  | 'capture_pageleave'
  | 'disable_session_recording'
  | 'disable_surveys'
  | 'disable_external_dependency_loading'
  | 'cookieless_mode'
  | 'persistence'
  | 'person_profiles'
  | 'property_denylist'
  | 'sanitize_properties'
  | 'advanced_disable_flags'
>;

export function analyticsOptions(): AnalyticsOptions {
  return {
    api_host: analyticsHost(),

    // Hand-written events only — see the note on autocapture above.
    autocapture: false,

    // The app is a single page once it has loaded, so a pageview has to follow
    // `history.pushState` or every route after the first is invisible.
    capture_pageview: 'history_change',
    // The matching "they left" event buys nothing we asked for and doubles the
    // volume of a free tier.
    capture_pageleave: false,

    disable_session_recording: true,
    disable_surveys: true,
    disable_external_dependency_loading: true,

    // Nothing written to the rider's device, and no profile behind it. Riders
    // are counted by PostHog's server-side daily hash instead — see the header
    // for what that does and does not buy.
    cookieless_mode: 'always',
    persistence: 'memory',
    person_profiles: 'never',

    // `$ip`: removes the property the browser sends. The address ingestion
    // reads off the request is PostHog's to strip, not ours — see the header.
    //
    // `title`: the document title, which the SDK attaches to every pageview.
    // Today every title in the app is safe — the rider profile is a flat
    // "Rider · Land The Trick" and a trick page uses the catalogue name. It is
    // dropped anyway, because the *next* person to want a nicer share preview
    // will put a rider's handle in that title and nothing here would notice.
    // The path already says which page it was, so this costs a duplicate.
    property_denylist: ['$ip', 'title'],

    sanitize_properties: scrubProperties,

    // No feature flags are used, so this saves every page load a request to
    // `/flags` and one more thing that could block a render.
    advanced_disable_flags: true,
  };
}
