import {
  SPORT_IDS,
  regionFromAcceptLanguage,
  spotCountryForRegion,
  spotFeature,
  unitsForCountry,
  type SportId,
} from '@landit/core';
import { countSpotsBySport, listOwnSpots, pageSpots } from '@landit/db';
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
 * everything after that. The count line and the sport tabs' notes are
 * counted here, over the whole collection, so they say what they always said.
 *
 * **The first page is for the sport the screen will show first.** The sport
 * lives in the browser (`localStorage`, see `providers/sport.tsx`) and cannot
 * be read here; what *can* be known is the default the provider falls back to
 * before it reads storage — the rider's first sport, else the first sport
 * there is — and that is the page rendered. A rider whose stored choice
 * differs sees the list swap once after hydration, which is exactly what the
 * old screen did when it filtered the full list on the same tick.
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

  const riderSports = (session?.rider.sports ?? []) as SportId[];
  const initialSport: SportId = riderSports[0] ?? SPORT_IDS[0]!;

  const [first, counts, own] = await Promise.all([
    pageSpots(
      client,
      { search: '', sport: initialSport, feature: feature?.id ?? null },
      { home: homeCountry, page: 1, perPage: SPOTS_PAGE },
    ),
    countSpotsBySport(client, SPORT_IDS),
    session ? listOwnSpots(client) : Promise.resolve([]),
  ]);

  return (
    <SpotsScreen
      initialSpots={first.items.map(toSpotView)}
      initialTotal={first.total}
      initialSport={initialSport}
      countsBySport={counts}
      ownSpots={own.map(toSpotView)}
      signedIn={!!session}
      units={unitsForCountry(region)}
      initialFeature={feature?.id ?? null}
    />
  );
}
