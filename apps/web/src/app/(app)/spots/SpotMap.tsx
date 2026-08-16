'use client';

import type { LatLng } from '@landit/core';
import { useEffect, useRef, useState } from 'react';

import { MAP_BASE_STYLE, MAP_DEFAULT_CENTRE, MAP_DEFAULT_ZOOM, mapboxToken } from '@/lib/mapbox';

import styles from './spots.module.css';

import 'mapbox-gl/dist/mapbox-gl.css';

interface Plottable {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
}

/**
 * Every plotted spot, on a Mapbox map, in the design language (plan §7, T13).
 *
 * **How the design language survives a third-party map.** Mapbox draws the
 * ground and nothing else: a quiet `light-v11` base (see `@/lib/mapbox`), with
 * every Land It surface on this panel drawn by us — square markers with a 3px
 * ink keyline and a hard offset shadow, our own zoom controls, and the panel's
 * own header and footer bars. A basemap in the palette would need a style
 * authored in Mapbox Studio, which needs a Studio account and a designer; this
 * is the version that is honest about what we can build, and swapping
 * `MAP_BASE_STYLE` for a bespoke one later changes one line.
 *
 * **Attribution stays.** The Mapbox logo and the OpenStreetMap credit are a
 * condition of using the service, not a styling choice. They are restyled to
 * the palette and never hidden.
 *
 * **No token, no map, and no pretending.** `mapbox-gl` is not even imported
 * until we know there is a token — a dynamic `import()`, so a checkout without
 * one never downloads a megabyte of WebGL to draw a placeholder, and CI (which
 * has no token) never opens a socket to Mapbox. What the rider sees instead is
 * one line saying the map is not switched on. The list beside it is unaffected.
 *
 * **`here` is drawn, never recorded.** It arrives as a prop, becomes a marker,
 * and is dropped when the rider turns it off. It is not in the map's state, not
 * in a URL, and never in a request (§6.4, standard 10).
 */
export function SpotMap({
  spots,
  selectedId,
  onSelect,
  here,
}: {
  readonly spots: readonly Plottable[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly here: LatLng | null;
}) {
  const token = mapboxToken();
  const container = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  // The imperative half lives in one ref-holding object so the effects below
  // stay readable. `unknown` because the module is only ever loaded inside an
  // effect — importing its types at the top would pull mapbox-gl into every
  // bundle that so much as mentions this file.
  const control = useRef<MapControl | null>(null);

  /* Build the map once, when there is a token and a container. */
  useEffect(() => {
    if (!token || !container.current || control.current) return;

    let cancelled = false;
    const node = container.current;

    void (async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        if (cancelled) return;

        mapboxgl.accessToken = token;
        const instance = new mapboxgl.Map({
          container: node,
          style: MAP_BASE_STYLE,
          center: [MAP_DEFAULT_CENTRE.lng, MAP_DEFAULT_CENTRE.lat],
          zoom: MAP_DEFAULT_ZOOM,
          // Nothing on this map is worth a 3D tilt, and a child dragging a
          // two-finger rotate into an upside-down map cannot easily undo it.
          pitchWithRotate: false,
          dragRotate: false,
          touchPitch: false,
          attributionControl: true,
          cooperativeGestures: true,
        });
        instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
        instance.on('error', () => setFailed(true));

        control.current = { mapboxgl, instance, markers: new Map(), here: null };
        if (cancelled) return;
        // Plot whatever is already selected, without waiting for a state change.
        sync(control.current, spots, selectedId, onSelect);
        drawHere(control.current, here);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      control.current?.instance.remove();
      control.current = null;
    };
    // Built once. The effects below carry every later change into it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* Markers follow the filtered list. */
  useEffect(() => {
    if (control.current) sync(control.current, spots, selectedId, onSelect);
  }, [spots, selectedId, onSelect]);

  /* The rider's dot follows the opt-in, and disappears with it. */
  useEffect(() => {
    if (control.current) drawHere(control.current, here);
  }, [here]);

  /*
   * Tear the map down when it fails, before the placeholder replaces it.
   *
   * Without this the fallback is a lie you can see: React reconciles the two
   * branches below as the same `div` and only swaps its class, so mapbox-gl's
   * injected children — the markers, the zoom buttons, the logo — survive the
   * switch and end up floating over the "map would not load" hatching. A wrong
   * token draws a broken map that is still, unmistakably, a map. `remove()`
   * takes its DOM with it, and the `key`s below stop React reusing the node.
   */
  useEffect(() => {
    if (!failed || !control.current) return;
    control.current.instance.remove();
    control.current = null;
  }, [failed]);

  if (!token || failed) {
    return (
      <div key="placeholder" className={styles.mapPlaceholder}>
        <p className={`cond ${styles.mapPlaceholderText}`}>
          {failed
            ? 'The map would not load just now. Every spot is still in the list.'
            : 'The map is not switched on yet — it needs a Mapbox key. Every spot is in the list, with directions on each one.'}
        </p>
      </div>
    );
  }

  return (
    <div
      key="canvas"
      ref={container}
      className={styles.mapCanvas}
      aria-label="Map of spots"
      role="group"
    />
  );
}

/* ------------------------------------------------------------ imperative -- */

interface MapControl {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapboxgl: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markers: Map<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  here: any;
}

/**
 * Reconcile the markers with the list, then move the camera.
 *
 * Markers are added and removed rather than rebuilt, so panning does not reset
 * every time a keystroke narrows the search.
 */
function sync(
  control: MapControl,
  spots: readonly Plottable[],
  selectedId: string | null,
  onSelect: (id: string) => void,
): void {
  const wanted = new Set(spots.map((spot) => spot.id));

  for (const [id, marker] of control.markers) {
    if (!wanted.has(id)) {
      marker.remove();
      control.markers.delete(id);
    }
  }

  for (const spot of spots) {
    let marker = control.markers.get(spot.id);
    if (!marker) {
      const element = document.createElement('button');
      element.type = 'button';
      // `!` because CSS-module class names type as possibly-absent under
      // `noUncheckedIndexedAccess`; these three are declared in the file next door.
      element.className = styles.pin!;
      element.setAttribute('aria-label', `Show ${spot.name} on the map`);
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        onSelect(spot.id);
      });
      marker = new control.mapboxgl.Marker({ element, anchor: 'bottom' })
        .setLngLat([spot.lng, spot.lat])
        .addTo(control.instance);
      control.markers.set(spot.id, marker);
    }
    const element = marker.getElement() as HTMLElement;
    const on = spot.id === selectedId;
    element.classList.toggle(styles.pinOn!, on);
    element.setAttribute('aria-pressed', String(on));
  }

  const selected = spots.find((spot) => spot.id === selectedId);
  if (selected) {
    control.instance.easeTo({ center: [selected.lng, selected.lat], zoom: 13, duration: 600 });
    return;
  }

  if (spots.length === 1) {
    const only = spots[0]!;
    control.instance.easeTo({ center: [only.lng, only.lat], zoom: 12, duration: 600 });
    return;
  }

  if (spots.length > 1) {
    const bounds = new control.mapboxgl.LngLatBounds();
    for (const spot of spots) bounds.extend([spot.lng, spot.lat]);
    control.instance.fitBounds(bounds, { padding: 56, maxZoom: 12, duration: 600 });
  }
}

/** One dot for the rider, for as long as they leave it on. */
function drawHere(control: MapControl, here: LatLng | null): void {
  if (!here) {
    control.here?.remove();
    control.here = null;
    return;
  }

  if (!control.here) {
    const element = document.createElement('div');
    element.className = styles.hereDot!;
    element.setAttribute('aria-label', 'Roughly where you are');
    control.here = new control.mapboxgl.Marker({ element }).addTo(control.instance);
  }
  control.here.setLngLat([here.lng, here.lat]);
}
