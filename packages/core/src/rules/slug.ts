/**
 * Turning a spot's name and town into the segment that goes in a URL.
 *
 * **The input is text a child typed.** A spot's name arrives from the
 * submission form (`AddSpotForm.tsx`), and the town beside it does too. So this
 * is not the usual "make a nice slug" helper: it is the boundary between what a
 * stranger wrote and a string that ends up in an address bar, in a sitemap, in
 * a `Link` header and in whatever a search engine caches. Everything below is
 * an **allowlist** for that reason — the output is built from the characters
 * that survive `[a-z0-9]`, never the input with the bad parts taken out. A
 * denylist is a list of the attacks somebody thought of.
 *
 * What that buys, precisely:
 *
 *  - **No traversal and no second path segment.** `.`, `/` and `\` are not word
 *    characters, so `../../admin` cannot survive as anything but `admin`, and
 *    `Ventnor/../x` collapses to `ventnor-x`. There is no encoding of a slash
 *    that gets through, because nothing is decoded — bytes that are not
 *    `[a-z0-9]` are separators, whatever they meant.
 *  - **No markup, no quotes, no whitespace.** `<script>` becomes `script`. A
 *    slug can therefore never break out of an attribute or a `<link>` tag.
 *  - **No invisible or direction-flipping characters.** Zero-width joiners and
 *    the RTL overrides that make `bmx-kraprv.png` read as a different filename
 *    are dropped with everything else outside the allowlist, so two spots
 *    cannot own visually identical URLs.
 *  - **A bounded length.** `spots.name` allows 80 characters and the town
 *    another 60; a slug is capped at {@link SLUG_MAX_LENGTH} and cut on a word
 *    boundary, so no listing produces a 140-character URL.
 *  - **One canonical case.** Lowercase throughout, so `Ventnor` and `VENTNOR`
 *    are one page rather than two that a case-insensitive filesystem or a
 *    case-sensitive index disagree about.
 *  - **Never empty, never a bare hyphen, never a reserved word.** See
 *    {@link RESERVED_SLUGS}.
 *
 * **What it deliberately does not do is judge the words.** A name that is
 * offensive in English produces a tidy slug of offensive English, and no
 * character filter in any language fixes that. The answer to that problem is
 * elsewhere and it is stronger than a word list: a spot only gets a page at
 * `status = 'live'`, which a human sets in the review queue (plan §6.1). An
 * unapproved submission has a slug and no page, and that is the whole of the
 * protection. This function's job is that the *shape* of the URL is ours.
 *
 * Pure and platform-free like everything in `rules/` — the definition lives
 * here and is mirrored in `pocketbase/hooks/63_spot_slugs.pb.js`, which is
 * where a slug is actually written (plan §3).
 */

/**
 * The longest slug this will produce.
 *
 * Long enough for "ariake-urban-sports-park-koto-city-tokyo" and the
 * double-barrelled English park names, short enough that a shared link is still
 * readable in a message. The database column allows a little more than this so
 * a collision suffix always fits.
 */
export const SLUG_MAX_LENGTH = 60;

/** What a slug becomes when there is nothing left of the input to use. */
export const SLUG_FALLBACK = 'spot';

/**
 * Words a slug may not be, because a static route segment beats a dynamic one
 * in every router this product will ever use — so a spot called "New" would be
 * a page nobody could open the day `/spots/new` exists.
 *
 * Short and boring on purpose. It is not a profanity list and cannot be turned
 * into one; it is the set of segments a future route is likely to want.
 */
export const RESERVED_SLUGS: readonly string[] = Object.freeze([
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
]);

/** Marks left behind by `NFD`, which are dropped so `é` narrows to `e`. */
const COMBINING_MARKS = /[\u0300-\u036f]/gu;

/** Everything outside the allowlist, in runs, so a run becomes one hyphen. */
const NOT_ALLOWED = /[^a-z0-9]+/g;

/**
 * `text`, as a URL segment: lowercase ASCII words joined by single hyphens.
 *
 * Returns `''` when nothing survives — callers decide what an empty slug means,
 * and {@link spotSlug} is the one that answers it for spots.
 */
export function slugify(text: string, max: number = SLUG_MAX_LENGTH): string {
  const folded = String(text ?? '')
    // `NFKD` rather than `NFD`: it also flattens the compatibility forms — the
    // fullwidth Latin letters, the circled and squared characters, the ligature
    // codepoints — which is where the visually-identical-URL tricks live.
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase();

  const joined = folded.replace(NOT_ALLOWED, '-').replace(/^-+|-+$/g, '');
  if (joined.length <= max) return joined;

  // Cut on a hyphen where there is one in the last quarter of the allowance, so
  // the slug ends on a whole word rather than mid-syllable; otherwise take the
  // hard cut and tidy the trailing hyphen.
  const cut = joined.slice(0, max);
  const lastHyphen = cut.lastIndexOf('-');
  const onWord = lastHyphen > max * 0.75 ? cut.slice(0, lastHyphen) : cut;
  return onWord.replace(/-+$/g, '');
}

/**
 * The slug a spot wants, before any collision is resolved.
 *
 * **Name plus town, because spot names are not unique and never will be.** The
 * canonical data alone holds several "Skatepark" and several "The Bowl", and a
 * rider submitting the park at the end of their road types the name on the sign
 * — which in most towns is the name of the town. `name` first because that is
 * what a rider reads in the URL; the town is what disambiguates it. Where the
 * name already carries the town at either end — "Ventnor Skatepark" in Ventnor,
 * "Skatepark Ventnor" in Ventnor — it is not repeated, because
 * "ventnor-skatepark-ventnor" reads like a mistake. Only at the ends: a town
 * that happens to appear in the middle of a longer name is usually part of
 * something else ("Isle of Wight" in Wight), and cutting it there would produce
 * a slug that no longer names the place.
 */
export function spotSlug(name: string, town?: string | null): string {
  const namePart = slugify(name);
  const townPart = slugify(town ?? '');

  const carriesTown =
    namePart === townPart ||
    namePart.startsWith(`${townPart}-`) ||
    namePart.endsWith(`-${townPart}`);
  const base = !townPart || carriesTown ? namePart : `${namePart}-${townPart}`;

  const capped = slugify(base);
  if (!capped) return SLUG_FALLBACK;
  return RESERVED_SLUGS.includes(capped) ? `${capped}-${SLUG_FALLBACK}` : capped;
}

/**
 * The first free slug for a spot: the base, then `-2`, `-3`, and so on.
 *
 * **Deterministic, and the counter is the whole point.** Two parks called
 * "Skatepark" in the same town is a real case — a council one and a school one
 * — and a random suffix would give the second a URL nobody can read and nobody
 * can reproduce when the row is re-seeded. `isTaken` is passed in rather than
 * queried here because this package never talks to a database; the hook and the
 * migration both hand it a lookup over the rows they can see.
 *
 * `limit` stops a broken `isTaken` spinning forever. Reaching it returns the
 * candidate anyway, and the collection's unique index is what refuses a genuine
 * duplicate — an error is a better outcome than a hang.
 */
export function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => boolean,
  limit = 200,
): string {
  if (!isTaken(base)) return base;
  for (let n = 2; n <= limit; n += 1) {
    const suffix = `-${n}`;
    // Trim the base rather than the suffix, so a long name never loses the
    // number that makes it distinct.
    const room = SLUG_MAX_LENGTH - suffix.length;
    const stem =
      (base.length > room ? base.slice(0, room).replace(/-+$/g, '') : base) || SLUG_FALLBACK;
    const candidate = `${stem}${suffix}`;
    if (!isTaken(candidate)) return candidate;
  }
  return `${base}-${limit + 1}`;
}
