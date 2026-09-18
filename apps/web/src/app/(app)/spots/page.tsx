import {
  regionFromAcceptLanguage,
  spotCountryForRegion,
  spotFeature,
  unitsForCountry,
} from '@landit/core';
import { listOwnSpots, pageSpots } from '@landit/db';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { ROUTES } from '@/lib/routes';
import { anonymousClient, currentRider } from '@/lib/session';

import { SpotsScreen } from './SpotsScreen';
import { SPOTS_PAGE, toSpotView } from './view';

export const metadata: Metadata = {
  title: 'Spots · Land The Trick',
  description: 'Parks, street spots and bowls riders have put on the map.',
  alternates: { canonical: ROUTES.spots },
};

/**
 * Where to ride (plan §7, T13; screenshot 19).
 *
 * **Readable signed out**, like the library: `spots` lists a `live` row to
 * anybody by its own API rule, and there is nothing private on this screen —
 * a spot is a public place. What signing in adds is the ability to put one
 * forward, and to see your own submissions while they wait.
 *
 * **One page, not the world** (issue #367). This used to hand the screen every
 * live spot and let the browser filter and page it, which was 1.34 MB of HTML
 * once France's census landed. Now it renders the first screenful for the
 * query the screen will open with, and the screen asks `listActions.ts` for
 * everything after that. The count line is counted here, over the whole
 * collection, so it says what it always said. The per-sport counts went with
 * the pill row they sat on (rethink §3.3, O1): a `<select>` has no room for a
 * number beside each option, so `countSpotsBySport` is one query this page no
 * longer makes.
 *
 * **The first page is every sport**, which is O1's default for this screen and
 * therefore the query it opens on for anybody who has not chosen otherwise
 * (rethink §3.3; the 2026-09-12 decision that spot tags are too thin to open
 * narrowed is unchanged). The server and the first client render agree, because
 * `useSportScope` hands the default to both: it is a `useSyncExternalStore`
 * whose server snapshot is `null`, so there is no mismatch to reconcile and
 * nothing that could throw the tree away (LESSONS §3a).
 *
 * A rider who *has* chosen a scope on this device sees their list a moment
 * after hydration, when `localStorage` is first readable and the screen asks
 * for that page. That swap is the price of a per-device preference the server
 * cannot see, and it is deliberately not paid by a cookie: a display choice
 * about which sports a list shows does not belong in a header sent with every
 * request, and the default is the wider list, so what changes is a narrowing
 * rather than a rider being shown somebody else's list first.
 *
 * **The list is whatever the rules hand back, and nothing here filters for
 * safety.** A rider's own pending and rejected submissions come back to them
 * because that is what the `listRule` says; somebody else's are not omitted
 * here, they are invisible (plan §6.1, proven over HTTP in
 * `pocketbase/tests/spot-submission.test.ts`).
 *
 * **Distances are in the reader's units, resolved here, on the server.**
 * Two signals, and the weaker one is only consulted when the stronger is
 * absent: a signed-in rider's **declared country** wins, because they told us;
 * a signed-out visitor is read from **`Accept-Language`**, which is a browser
 * setting rather than a location and is therefore the guess, not the answer.
 * Neither is stored, and both are settled before the markup exists — nothing on
 * a screen that hydrates may be locale-derived (LESSONS §5). The same signal
 * decides whose parks lead the list.
 */
export default async function SpotsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await currentRider();
  const client = session?.client ?? anonymousClient();

  /*
   * `?feature=flat`, from a trick page's "Where to practise" line (T31).
   *
   * Read here rather than with `useSearchParams` so the narrowed list is the
   * first paint, not a swap a frame later (the library makes the same choice
   * for `?mine=1`). Validated against `SPOT_FEATURES` rather than passed
   * through: the value is whatever a stranger put in the address bar, and an
   * unknown one opens the plain list — not an error, and not an empty one.
   */
  const params = await searchParams;
  const requested = Array.isArray(params.feature) ? params.feature[0] : params.feature;
  const feature = requested ? spotFeature(requested) : null;

  const region = session
    ? session.rider.country
    : regionFromAcceptLanguage((await headers()).get('accept-language'));
  const homeCountry = spotCountryForRegion(region);

  const [first, own] = await Promise.all([
    pageSpots(
      client,
      { search: '', feature: feature?.id ?? null },
      { home: homeCountry, page: 1, perPage: SPOTS_PAGE },
    ),
    session ? listOwnSpots(client) : Promise.resolve([]),
  ]);

  return (
    <SpotsScreen
      initialSpots={first.items.map(toSpotView)}
      initialTotal={first.total}
      ownSpots={own.map(toSpotView)}
      signedIn={!!session}
      units={unitsForCountry(region)}
      initialFeature={feature?.id ?? null}
    />
  );
}
