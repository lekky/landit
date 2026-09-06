'use client';

import { useCallback } from 'react';

import { SpotMap } from '../SpotMap';

/**
 * This spot, on the real map, with nothing to select.
 *
 * **`SpotMap` rather than the handoff's CSS schematic.** The prototype draws a
 * diagram — a dotted grid, a rotated water band, three roads — because it had
 * no map component to reach for, and its own README says so: "It stands in for
 * whatever real map component you use; only its *claims* about accuracy are
 * part of the design." This product has a real one, and a hand-drawn picture of
 * a place that is not the place would be the single dishonest element on a page
 * whose whole argument is that it does not fabricate.
 *
 * The claim the design *does* carry comes with it. A spot's coordinates were
 * read off a source somebody opened and checked against the venue's own page
 * (`SPOTS` in `@landit/core`), so the pin is the spot rather than the town —
 * which is the opposite of what an event page may say, and the caption below
 * the map says so in words.
 *
 * A client component for one reason: `SpotMap` takes an `onSelect` callback,
 * and a function cannot cross the server boundary. It is as thin as that
 * boundary gets — the panel, its header, its footer and its caption are all
 * server-rendered around it.
 */
export function SpotPin({
  id,
  name,
  lat,
  lng,
}: {
  id: string;
  name: string;
  lat: number;
  lng: number;
}) {
  /*
   * Selection means nothing here: there is one pin and it is already the
   * subject of the page. The map still wants a handler, so it gets one that
   * does nothing rather than a second copy of the list screen's state.
   */
  const noop = useCallback(() => {}, []);

  return <SpotMap spots={[{ id, name, lat, lng }]} selectedId={id} onSelect={noop} here={null} />;
}
