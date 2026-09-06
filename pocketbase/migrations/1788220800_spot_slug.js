/// <reference path="../.pb_data/types.d.ts" />

/**
 * `spots.slug` — a spot gets an address of its own (2026-09-06, owner in chat).
 *
 * **Why the column has to exist.** Until now a spot was a card in a list and a
 * pin on a map, reachable only by scrolling to it. `/spots/[slug]` is the page
 * that makes one linkable, shareable and crawlable, and a page needs a segment
 * to live at. The record id would have done the job and would have been the
 * wrong answer twice: an id is fifteen random characters, so a shared link says
 * nothing about where it goes, and an id does not survive a reseed — the seed
 * keys spots on name-plus-town (`packages/db/src/seed.ts`), so a rebuilt
 * database would break every link anybody had saved.
 *
 * **Where the value comes from.** `spotSlug` in `packages/core/src/rules/slug.ts`
 * is the definition; the copy below and the copy in
 * `pocketbase/hooks/63_spot_slugs.pb.js` are the enforcement (plan §3). Three
 * copies of a dozen lines is worse than one, and it is what a PocketBase JSVM
 * migration allows: nothing here can import from the workspace, and a handler
 * cannot even close over a constant in its own file. The shape they agree on is
 * asserted in `pocketbase/tests/spot-slugs.test.ts`.
 *
 * **The name is text a child typed**, so the slug is built from an allowlist —
 * `[a-z0-9]`, everything else a separator — rather than by removing the
 * characters somebody thought of. `slug.ts` argues that at length. What is
 * worth repeating here is the part this file is responsible for: a submitted
 * spot has a slug from the moment it is created, and it has **no page** until
 * staff set `status = 'live'`. The page route refuses anything else, so an
 * unreviewed name never reaches a URL anybody can open.
 *
 * **The backfill is the half that matters on a live box.** Ninety-odd spots are
 * already in production. Without it they would all carry `''`, the route would
 * 404 every one of them, and the sitemap would advertise nothing. Rows are
 * walked in creation order so the value is **deterministic**: two databases
 * seeded from the same data land on the same slugs, and re-running this
 * migration on a database that already has them changes nothing.
 *
 * **The unique index is partial** — `WHERE slug != ''` — for the same reason
 * `idx_users_handle_nocase` is. PocketBase stores an unset text field as the
 * empty string rather than NULL, and SQLite treats two empty strings as a
 * collision, so an unconditional unique index would refuse the second row
 * anything ever failed to name.
 *
 * **Additive.** One nullable field and one index on `spots`, plus a value
 * written to rows that already exist. No existing field changes shape and no
 * stored value moves. The `down` path removes exactly what `up` adds.
 */

migrate(
  (app) => {
    // Declared inside the handler, not at file scope: a migration callback is
    // run in the same isolated JSVM the hooks are, so a `const` outside it
    // reads as `undefined` here (see the note in `62_spots.pb.js`).
    const SLUG_MAX_LENGTH = 60;
    const SLUG_FALLBACK = 'spot';
    const RESERVED_SLUGS = [
      'add',
      'all',
      'api',
      'edit',
      'index',
      'map',
      'new',
      'near',
      'report',
      'search',
    ];

    const slugify = (text) => {
      const folded = String(text || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const joined = folded.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (joined.length <= SLUG_MAX_LENGTH) return joined;
      const cut = joined.slice(0, SLUG_MAX_LENGTH);
      const lastHyphen = cut.lastIndexOf('-');
      const onWord = lastHyphen > SLUG_MAX_LENGTH * 0.75 ? cut.slice(0, lastHyphen) : cut;
      return onWord.replace(/-+$/g, '');
    };

    const spotSlug = (name, town) => {
      const namePart = slugify(name);
      const townPart = slugify(town);
      const carriesTown =
        namePart === townPart ||
        namePart.indexOf(`${townPart}-`) === 0 ||
        (townPart && namePart.slice(-(townPart.length + 1)) === `-${townPart}`);
      const base = !townPart || carriesTown ? namePart : `${namePart}-${townPart}`;
      const capped = slugify(base);
      if (!capped) return SLUG_FALLBACK;
      return RESERVED_SLUGS.indexOf(capped) === -1 ? capped : `${capped}-${SLUG_FALLBACK}`;
    };

    const uniqueSlug = (base, taken) => {
      if (!taken[base]) return base;
      for (let n = 2; n <= 200; n += 1) {
        const suffix = `-${n}`;
        const room = SLUG_MAX_LENGTH - suffix.length;
        const stem =
          (base.length > room ? base.slice(0, room).replace(/-+$/g, '') : base) || SLUG_FALLBACK;
        const candidate = `${stem}${suffix}`;
        if (!taken[candidate]) return candidate;
      }
      return `${base}-201`;
    };

    const spots = app.findCollectionByNameOrId('spots');

    // Room for the longest slug the generator produces plus a collision
    // suffix, and no more: the column is a URL segment, not a description.
    spots.fields.add(
      new TextField({
        type: 'text',
        name: 'slug',
        required: false,
        max: 80,
      }),
    );
    app.save(spots);

    /*
     * Every existing row, in creation order.
     *
     * A `try` around the whole pass because a fresh database has no `spots`
     * collection rows at all, and a migration is not the place to insist there
     * are some — the seed writes them afterwards and the hook slugs each one on
     * the way in.
     */
    try {
      const rows = app.findRecordsByFilter('spots', "id != ''", 'created,id', 0, 0);
      // `Object.create(null)` rather than `{}`: a spot slugged "constructor" or
      // "tostring" would otherwise read as already taken from the prototype.
      const taken = Object.create(null);

      // Rows that somehow already carry a slug keep it and reserve it, so
      // re-running this is a no-op rather than a reshuffle.
      for (const row of rows) {
        const existing = row.getString('slug');
        if (existing) taken[existing] = true;
      }

      for (const row of rows) {
        if (row.getString('slug')) continue;
        const slug = uniqueSlug(spotSlug(row.getString('name'), row.getString('town')), taken);
        taken[slug] = true;
        row.set('slug', slug);
        app.save(row);
      }
    } catch {
      // Nothing to backfill, or a collection that does not exist yet. Either
      // way the hook covers every row written from here on.
    }

    // Partial, so the rows a failed backfill left empty do not collide with
    // each other — see the note above.
    const withIndex = app.findCollectionByNameOrId('spots');
    withIndex.addIndex('idx_spots_slug', true, 'slug', "slug != ''");
    app.save(withIndex);
  },

  (app) => {
    const spots = app.findCollectionByNameOrId('spots');
    spots.fields.removeByName('slug');
    app.save(spots);
  },
);
