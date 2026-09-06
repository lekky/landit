/// <reference path="../.pb_data/types.d.ts" />

/**
 * Every spot gets a URL segment, and it gets it on the way in.
 *
 * `1788220800_spot_slug.js` gave `spots` a `slug` column and filled it for the
 * rows that already existed. This is the other half: the rows written from here
 * on — a rider's submission, a staff entry, a seed run — each get one before
 * they are stored, so nothing can end up in the collection with no address.
 *
 * **A model hook, not a request hook, and that is the whole design.**
 * `62_spots.pb.js` steps aside for a superuser because the refusals in it are
 * about what a *rider* may do. This one is not a refusal at all: a spot with no
 * slug is a spot with no page, whoever created it, so the seed's superuser
 * token has to go through it exactly as a twelve-year-old's does.
 *
 * **On create only.** A slug is an address, and an address that moves when
 * staff fix a typo in a name is a link somebody shared that now 404s. Renaming
 * a spot leaves its URL alone, deliberately; the day that needs an override,
 * the answer is a staff field, not a rule here.
 *
 * **The value is built from an allowlist**, because `name` is text a child
 * typed into the submission form. `packages/core/src/rules/slug.ts` is the
 * definition and argues the case at length; this is the enforcement (plan §3),
 * and the two are held in step by `pocketbase/tests/spot-slugs.test.ts`. The
 * short version: the output is assembled from the `[a-z0-9]` runs that survive,
 * so no combination of dots, slashes, percent-escapes, zero-width characters or
 * right-to-left overrides can make the segment mean something other than a
 * spot. What it deliberately does not do is judge the *words* — an offensive
 * name makes a tidy slug of offensive English, and the thing that stops it
 * reaching a reader is that `/spots/[slug]` only serves `status = 'live'`,
 * which a human sets.
 *
 * **Collisions are expected, not exceptional.** Spot names are not unique —
 * plenty of towns have a park signposted "Skatepark" — so the slug is derived
 * from name *and* town, and a genuine clash counts up `-2`, `-3`. Counting
 * rather than randomising is what makes a reseed land on the same URLs.
 */

onRecordCreate((e) => {
  // Everything this handler uses is declared inside it: the handler is
  // serialised into an isolated VM and arrives with no closure over this file,
  // so a file-scope `const` reads as `undefined` (see `62_spots.pb.js`).
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

  /*
   * Is anything already at this address?
   *
   * One query per candidate, which is fine because the loop below almost never
   * runs twice. A `findFirstRecordByFilter` that throws is PocketBase's way of
   * saying "no match", so the absence of a row and a broken query look the
   * same here — and the collection's unique index is what refuses a duplicate
   * for real if this ever guesses wrong.
   */
  const taken = (candidate) => {
    try {
      return !!e.app.findFirstRecordByFilter('spots', 'slug = {:slug}', { slug: candidate });
    } catch {
      return false;
    }
  };

  // A slug the caller supplied is honoured — staff correcting one through the
  // admin UI, and the migration's own rows — but it is still put through the
  // allowlist, so "supplied" can never mean "unfiltered".
  const supplied = slugify(e.record.getString('slug'));
  const base = supplied || spotSlug(e.record.getString('name'), e.record.getString('town'));

  let slug = base;
  for (let n = 2; taken(slug) && n <= 200; n += 1) {
    const suffix = `-${n}`;
    const room = SLUG_MAX_LENGTH - suffix.length;
    const stem =
      (base.length > room ? base.slice(0, room).replace(/-+$/g, '') : base) || SLUG_FALLBACK;
    slug = `${stem}${suffix}`;
  }

  e.record.set('slug', slug);
  e.next();
}, 'spots');
