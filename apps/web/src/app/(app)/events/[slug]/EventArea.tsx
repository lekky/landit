'use client';

import { useCallback, useMemo } from 'react';

import { EVENT_AREA_RADIUS_M } from '@/lib/map';

import { SpotMap } from '../../spots/SpotMap';

/**
 * Where this event roughly is, on the real map.
 *
 * **The CSS schematic this replaces was the one drawn thing on a page whose
 * whole argument is that it does not draw things.** The handoff's map — a
 * dotted grid, three rotated roads and a band of sea — is a placeholder, and
 * its own README says so: "It stands in for whatever real map component you
 * use; only its *claims* about accuracy are part of the design." Every event
 * got the same three roads and the same sea, in Salford as in Ventnor, under a
 * caption naming a town it had never heard of. `/spots/[slug]` reached the same
 * conclusion first (`SpotPin`), for the same reason.
 *
 * **The claim comes with it, and it is not the spot page's claim.** A spot's
 * coordinates were read off a source and checked against the venue's own page,
 * so a spot is a pin. An event holds the *town* (issue #210) — so this draws
 * `MapArea`: a 1.5km circle with the venue somewhere inside it, and a dot on
 * the point we actually hold. The caption under the map and the note under that
 * both say so in words, because a circle alone is not a sentence.
 *
 * A client component for the one reason `SpotPin` is: `SpotMap` takes an
 * `onSelect` callback and a function cannot cross the server boundary. The
 * panel, its header, the caption and the footer are all server-rendered around
 * it, so a crawler still reads the place and the claim.
 */
export function EventArea({ lat, lng, town }: { lat: number; lng: number; town: string }) {
  /* There is nothing to select: no pin on this map is a thing to choose. */
  const noop = useCallback(() => {}, []);

  /*
   * Memoised so the map is not handed a new object on every render — the effect
   * that re-draws the circle watches this identity, and an inline literal would
   * repaint it on each pass for no change at all.
   */
  const area = useMemo(() => ({ lat, lng, radiusM: EVENT_AREA_RADIUS_M }), [lat, lng]);

  return (
    <SpotMap
      spots={[]}
      selectedId={null}
      onSelect={noop}
      here={null}
      area={area}
      label={`Map of the area around ${town}`}
    />
  );
}
