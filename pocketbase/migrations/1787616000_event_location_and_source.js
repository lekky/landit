/// <reference path="../.pb_data/types.d.ts" />

/**
 * An event's country, address, phone, coordinates and source link
 * (2026-08-18, owner in chat).
 *
 * The event row carried a name, a town and a venue. That was enough while the
 * six seeded events were English and all of them were transcribed from the
 * design prototype; it stops being enough the moment the calendar is real and
 * worldwide. A rider deciding whether they can get to a jam wants the street
 * and the distance, a parent ringing ahead about a coached session wants the
 * number, and **both of them need the organiser's own page** — because this is
 * a researched list, not a feed the organisers write, and the only honest thing
 * a researched listing can do is show its working.
 *
 * **Six optional fields, and the optionality is the design.** A commercial
 * indoor park running a comp has all six. A council holiday clinic has an
 * address and a listing page and no phone of its own. A jam announced on an
 * organiser's site may have neither address nor coordinates. Every reader must
 * therefore treat all six as absent-by-default and render each line only when
 * it has one — `EventsScreen.tsx` does, and `buildEventsView` is where a
 * missing value becomes an omitted row rather than an empty label. A required
 * field here would make every existing row unsaveable and would push the seed
 * into inventing values, which is exactly what the research these fields exist
 * for was told never to do.
 *
 * **Why `country` is a field and not the end of `town`.** The same trade
 * `spots` made, for the same two reasons: the seed's natural key for an event
 * is `slug`, and a country folded into a town string cannot be filtered,
 * grouped or counted without parsing it back out. `/events` now has a country
 * filter, which is precisely the thing a parsed-out country cannot be built on.
 * One fact, one column.
 *
 * **Why `source_url` is text and not `url`.** It is displayed and followed, so
 * what protects a reader is not a save-time format check but a render-time
 * scheme check — `eventSourceLink` in `packages/core` returns a link only for
 * `http:` and `https:`, so a `javascript:` URI typed into the staff editor
 * renders as no link at all rather than as a working one. Validating the shape
 * on save and trusting it on render would put the check in the weaker place.
 *
 * **Additive.** Six nullable fields on `events`. No existing field changes
 * shape, no stored value moves, and every row already in the collection reads
 * empty for all six — the honest state for an event nobody has researched. The
 * `down` path removes exactly what `up` adds.
 */
migrate(
  (app) => {
    const events = app.findCollectionByNameOrId('events');

    // The country's common English name ("USA", "New Zealand"), not an ISO
    // code: it is displayed on the card and in the filter as-is, and a code
    // would need a lookup table in `core` that nothing else would use. Matches
    // `spots.country` so the two screens can never disagree about what a
    // country is called.
    events.fields.add(new TextField({ type: 'text', name: 'country', required: false, max: 60 }));

    // Long enough for a full international postal address on one line —
    // "Ariake Urban Sports Park, 1-chome Ariake, Koto City, Tokyo 135-0063,
    // Japan" is 74 — with room for the longer German and Brazilian forms.
    events.fields.add(new TextField({ type: 'text', name: 'address', required: false, max: 200 }));

    /*
     * Stored as the venue publishes it, in international format, and never
     * parsed. A number is for a human to ring: normalising it would mean
     * choosing a canonical form for every country's conventions, and getting
     * that wrong turns a working number into a broken one silently.
     */
    events.fields.add(new TextField({ type: 'text', name: 'phone', required: false, max: 40 }));

    /*
     * The organiser's own page for this event — the receipt for the listing.
     * 500 characters because a real listing URL is often a query-string-laden
     * ticketing or council booking link, and truncating one produces a link
     * that resolves to the wrong page rather than to none.
     */
    events.fields.add(
      new TextField({ type: 'text', name: 'source_url', required: false, max: 500 }),
    );

    // The venue's point, for "Near me". Unset reads back as 0 from PocketBase,
    // which `hasCoords` already treats as absent rather than as Null Island.
    events.fields.add(new NumberField({ type: 'number', name: 'lat', required: false }));
    events.fields.add(new NumberField({ type: 'number', name: 'lng', required: false }));

    app.save(events);
  },

  (app) => {
    const events = app.findCollectionByNameOrId('events');
    for (const name of ['country', 'address', 'phone', 'source_url', 'lat', 'lng']) {
      events.fields.removeByName(name);
    }
    app.save(events);
  },
);
