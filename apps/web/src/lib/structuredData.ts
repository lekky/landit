import {
  CONTACT,
  SITE_URL,
  SPORTS,
  TIERS_LABEL,
  eventSourceLink,
  spotLatLng,
  type LandItEvent,
  type SpotLike,
  type Trick,
} from '@landit/core';

import { lowerLabel } from '@/lib/sports';

/**
 * Schema.org descriptions of what a page is about, for the machines that read
 * pages rather than look at them.
 *
 * **Why this exists.** A search engine and an answer engine are both guessing,
 * from prose, what a page is: whether "Bunny Hop" is a trick or a rabbit,
 * whether Land The Trick is a company or a turn of phrase. JSON-LD stops the
 * guessing. It is the difference between a page that might be summarised
 * correctly and one that describes itself, and it is the only part of a page an
 * AI system can read without inferring anything.
 *
 * **Only what the page already says.** A claim here that the page does not
 * carry is what search engines call structured-data spam, and it is also simply
 * a lie about the product. Every field below is read off the trick record or
 * off `data/contact.ts`; nothing is written out a second time, for the same
 * reason the sports list is generated rather than typed (LESSONS §4).
 *
 * This module imports nothing from React or Next and returns plain objects, so
 * the shapes are unit-testable without rendering anything. That matters more
 * here than usual: a malformed graph fails **silently** — it is ignored, and
 * nobody finds out.
 */

/** The loose shape of a JSON-LD node. Values are whatever schema.org allows. */
export type JsonLdNode = Record<string, unknown>;

/**
 * Land The Trick itself, and the site it runs.
 *
 * Two nodes rather than one, because they answer different questions: the
 * `Organization` is who publishes this, and the `WebSite` is the thing at this
 * address. Giving both an `@id` is what lets every other page point at the
 * publisher instead of restating it ninety-odd times.
 *
 * `sameAs` is the list of profiles that are demonstrably the same brand, which
 * is how a search engine reconciles those accounts with this site. It matches
 * the footer's list exactly (`components/site/SiteFooter.tsx`) — if one gains
 * an account, so does the other.
 */
export function organizationLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Land The Trick',
        url: SITE_URL,
        logo: `${SITE_URL}/icon.png`,
        email: CONTACT.hello,
        sameAs: ['https://instagram.com/landthetrickapp', 'https://tiktok.com/@landthetrick'],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'Land The Trick',
        url: SITE_URL,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en-GB',
      },
    ],
  };
}

/** What `trickHowToLd` needs that is not on the trick record. */
export type TrickHowToContext = {
  /** The page's own absolute URL. */
  url: string;
  /** The "What you need" line, which is staff copy on the sport, not the trick. */
  equipment?: string;
};

/**
 * One trick, as a `HowTo`.
 *
 * `HowTo` rather than `Article`, because that is what the page is: a thing a
 * rider is trying to do, what they need in order to do it, and what to do. The
 * page already carries every part of that shape, so this describes the page
 * rather than adding to it.
 *
 * **The steps are the ones the page shows, and no more.** It is tempting to
 * invent numbered steps out of the prose, and it would be wrong — a `HowTo`
 * listing steps a reader cannot find on the page is exactly the mismatch the
 * structured-data guidelines are written against. Staff copy is one lowdown and
 * one set of tips, so this is two steps — and a third, "Why it isn't working",
 * only when the trick carries T28's `mistakes` and the page draws them (T32).
 * Each mistake and its fix is a `HowToTip` inside that step, which is the
 * schema.org shape for "a thing to know, not a thing to do"; a trick without
 * any gets two steps, because that is what its page shows.
 *
 * The prerequisite tricks are deliberately **not** here. They are on the page,
 * as links, which is the form that is useful to a crawler; `HowTo` has no field
 * that means "be able to do this first" — `supply` and `tool` both mean things
 * you own — and bending one of those to fit would describe the page wrongly to
 * say something the links already say properly.
 */
export function trickHowToLd(trick: Trick, context: TrickHowToContext): JsonLdNode {
  // `lowerLabel`, not `.toLowerCase()`: "BMX" is an acronym and survives, where
  // "Skateboard" does not (`lib/sports.ts`). This string is the `HowTo`'s name,
  // which is the single sentence most likely to be read back to somebody.
  const sport = lowerLabel(trick.sport);
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to ${trick.name.toLowerCase()} on a ${sport}`,
    description: trick.about,
    url: context.url,
    inLanguage: 'en-GB',
    publisher: { '@id': `${SITE_URL}/#organization` },
    /*
     * Free to read, and true. The paywall is on *tracking* a trick, never on
     * its lowdown, and a locked trick renders the locked page — which is a
     * different page and is not described by this.
     */
    isAccessibleForFree: true,
    /** Rookie to Pro, in the words the page uses. */
    educationalLevel: TIERS_LABEL[trick.diff - 1],
    about: { '@type': 'Thing', name: `${SPORTS[trick.sport].label} tricks` },
    ...(context.equipment ? { supply: [{ '@type': 'HowToSupply', name: context.equipment }] } : {}),
    step: [
      { '@type': 'HowToStep', name: 'The lowdown', text: trick.about },
      { '@type': 'HowToStep', name: 'Tips', text: trick.tips },
      ...(trick.mistakes && trick.mistakes.length > 0
        ? [
            {
              '@type': 'HowToStep',
              name: "Why it isn't working",
              itemListElement: trick.mistakes.map((mistake) => ({
                '@type': 'HowToTip',
                text: `${mistake.what} ${mistake.fix}`,
              })),
            },
          ]
        : []),
    ],
  };
}

/**
 * The half of a `spots` row this describes.
 *
 * A structural type rather than `SpotsRecord`, so this module keeps its promise
 * of importing nothing but `@landit/core` — and so the shape it needs is
 * written down in one place where a reader can see that `submitted_by` is not
 * in it, and could not be passed in even by accident.
 */
export type SpotLdSource = SpotLike & {
  readonly type?: string;
  readonly address?: string;
  readonly phone?: string;
  readonly country?: string;
};

/** What `spotPlaceLd` needs that is not on the `spots` row. */
export type SpotPlaceContext = {
  /** The page's own absolute URL. */
  url: string;
  /** The page's own description, so the graph and the meta tag agree. */
  description: string;
};

/**
 * One spot, as a `SkateboardPark`.
 *
 * **The type is a claim and it is chosen carefully.** schema.org has
 * `SkateboardPark`, a subtype of `SportsActivityLocation`, and both are
 * declared: a spot in this product is a place people go to ride, which is
 * exactly what those two mean, and being specific is the whole value of doing
 * this at all. It is used for street spots as well as parks, which is the one
 * looseness worth naming — a plaza with a good ledge is not a facility anybody
 * built, and schema.org has no better word for it. `additionalType` carries the
 * spot's own kind in our words so the distinction is not lost.
 *
 * **Only what the page already carries**, which is the rule at the head of this
 * file and matters more here than anywhere else in it. A spot record is about
 * twenty-five words, and the fields a `Place` invites — opening hours, a
 * telephone, an address, a price range, a review — are mostly fields we do not
 * have. Every one below is conditional, so a spot with no address emits no
 * `address` rather than an empty one, and nothing here is written out a second
 * time in prose the page does not show.
 *
 * **The coordinates are exact, and that is a real difference from an event.**
 * An event page holds a town, so it says so and declines to plot a pin. A spot
 * is stored as a latitude and longitude somebody read off a map and checked
 * against the venue's own page (`SPOTS` in `@landit/core`), so `geo` is a true
 * statement about the place and the map caption on the page says the same
 * thing. Emitted only when `hasCoords` agrees the pair is usable — `0, 0` is
 * how an unset number field reads, not a place anybody rides.
 *
 * **`submitted_by` is not here and must never be.** A spot record may carry the
 * rider who put it forward; the page does not render them and neither does
 * this. There is no schema.org field for it that would not be a disclosure.
 */
export function spotPlaceLd(spot: SpotLdSource, context: SpotPlaceContext): JsonLdNode {
  const point = spotLatLng(spot);
  const features = (spot.tags ?? []).filter((tag) => tag.trim().length > 0);

  return {
    '@context': 'https://schema.org',
    '@type': ['SkateboardPark', 'SportsActivityLocation'],
    name: spot.name,
    url: context.url,
    description: context.description,
    inLanguage: 'en-GB',
    publisher: { '@id': `${SITE_URL}/#organization` },
    /*
     * Free to visit as far as this page is concerned: every spot listed is one
     * a rider can turn up at, and nothing on the page is behind the paywall.
     * A private indoor park's own admission charge is not ours to state and is
     * not stated — this says the *page* costs nothing, which is `isAccessibleForFree`'s
     * meaning here as it is on a trick.
     */
    isAccessibleForFree: true,
    ...(spot.type ? { additionalType: spot.type } : {}),
    ...(point
      ? { geo: { '@type': 'GeoCoordinates', latitude: point.lat, longitude: point.lng } }
      : {}),
    ...(spot.address || spot.town || spot.country
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(spot.address ? { streetAddress: spot.address } : {}),
            ...(spot.town ? { addressLocality: spot.town } : {}),
            ...(spot.country ? { addressCountry: spot.country } : {}),
          },
        }
      : {}),
    ...(spot.phone ? { telephone: spot.phone } : {}),
    /*
     * The tag list, as amenities. `amenityFeature` is the field that means
     * "this place has one of these", which is what a bowl or a set of ledges
     * is, and it is the only structured field that says anything the page's
     * "What's here" grid says. The explanation beside each one on the page is
     * ours rather than the place's, so it stays out of the graph.
     */
    ...(features.length
      ? {
          amenityFeature: features.map((tag) => ({
            '@type': 'LocationFeatureSpecification',
            name: tag,
            value: true,
          })),
        }
      : {}),
  };
}

/**
 * A node, as the text that goes inside `<script type="application/ld+json">`.
 *
 * `JSON.stringify` escapes quotes but not `<`, so staff copy containing
 * `</script>` would close the tag and everything after it would be parsed as
 * markup. Escaping the angle bracket to its `\u003c` form is the standard
 * defence and costs nothing: a JSON parser reads the escape back as the
 * character, and the HTML parser never sees a `<` it could act on.
 */
export function jsonLdText(node: JsonLdNode): string {
  return JSON.stringify(node).replace(/</g, '\\u003c');
}

/** What `eventLd` needs that is not on the event record. */
export type EventLdContext = {
  /** The page's own absolute URL. */
  url: string;
};

/**
 * One event, as an `Event`.
 *
 * **Every field is on the page, and the interesting part is the ones that are
 * not here.** The doctrine at the top of this file is easy to hold when a field
 * is simply missing; it is worth spelling out where the temptation is to fill
 * one in because a richer graph looks better:
 *
 *  - **No `geo`.** An event's coordinates are its *town*, not its venue (issue
 *    #210, and `data/events.ts` says so in its own header). `geo` on a `Place`
 *    means where that place is, and publishing a town centre as a skatepark's
 *    position is exactly the pin the map caption on this page refuses to draw.
 *    The postal address we hold is published by the organiser and is the honest
 *    half; it goes in, and the point does not.
 *  - **No `offers`.** `price` is display copy — "Free for spectators", "£25
 *    early bird, £35 on the door". An `Offer` wants an amount and a currency,
 *    and deriving either from that string is a guess about money.
 *  - **No `eventStatus`.** We do not know whether an organiser has cancelled;
 *    the page says as much out loud ("a session can be cancelled without us
 *    knowing"), so claiming `EventScheduled` would contradict our own copy.
 *  - **No `endDate` and no time of day.** `startDate` is a calendar day because
 *    a calendar day is all the listing carries.
 *
 * **A finished event keeps its markup.** Past events stay indexed on purpose
 * (Rachid, 2026-09-06, in chat: riders keep looking them up), and a page that
 * silently stopped describing itself the morning after would be a page that
 * gets summarised by guesswork for the rest of its life. Nothing here claims
 * the event is upcoming, so nothing has to be taken back.
 */
export function eventLd(event: LandItEvent, context: EventLdContext): JsonLdNode {
  const address: JsonLdNode = {
    '@type': 'PostalAddress',
    ...(event.address ? { streetAddress: event.address } : {}),
    addressLocality: event.town,
    ...(event.country ? { addressCountry: event.country } : {}),
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    url: context.url,
    // A calendar day, exactly as stored. Schema.org accepts a bare date, and a
    // bare date is what this listing knows.
    startDate: event.date,
    // The page is a physical listing with a venue on it and nothing to attend
    // online, which is the one thing this field is for.
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: event.venue,
      address,
    },
    ...(event.blurb ? { description: event.blurb } : {}),
    inLanguage: 'en-GB',
    publisher: { '@id': `${SITE_URL}/#organization` },
    /*
     * The organiser's own page for this event: the receipt the listing was
     * researched from, and on the page as the "Listing" row. `sameAs` is the
     * field for "this is the same thing, over there", which is what that link
     * is — we are not the organiser and this does not say we are.
     */
    ...(eventSourceLink(event.sourceUrl) ? { sameAs: [eventSourceLink(event.sourceUrl)] } : {}),
    /*
     * The sport chips in the header band, said in a field. Written from
     * `SPORTS` rather than out by hand, so a fourth sport reaches this the way
     * it reaches everything else (LESSONS §4).
     */
    about: event.sports.map((id) => ({ '@type': 'Thing', name: `${SPORTS[id].label} tricks` })),
  };
}
