'use client';

import type { LatLng } from '@landit/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  MAP_ATTRIBUTION,
  MAP_BASE_STYLE,
  MAP_DEFAULT_CENTRE,
  MAP_DEFAULT_ZOOM,
  MAP_WORKER_URL,
} from '@/lib/map';

import styles from './spots.module.css';

import 'maplibre-gl/dist/maplibre-gl.css';

interface Plottable {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
}

/**
 * Every plotted spot, on a MapLibre map, in the design language (plan §7, T13).
 *
 * **How the design language survives a third-party map.** The basemap draws the
 * ground and nothing else: a quiet `positron` base (see `@/lib/map`), with
 * every Land The Trick surface on this panel drawn by us — square markers with
 * a 3px ink keyline and a hard offset shadow, our own zoom controls, and the
 * panel's own header and footer bars. A basemap in the palette would mean
 * authoring a style of our own; this is the version that is honest about what
 * we can build, and swapping `MAP_BASE_STYLE` for a bespoke one later changes
 * one line.
 *
 * **Attribution stays.** MapLibre reads the OpenStreetMap and OpenMapTiles
 * credits out of the style's own sources; they are restyled to the palette and
 * never hidden.
 *
 * **The library is still loaded lazily** — a dynamic `import()`, so a page that
 * merely mentions this component does not pull a megabyte of WebGL into its
 * bundle. What changed with OpenFreeMap is that there is no longer a *key* to
 * be missing: the map draws in every checkout and in CI, and the placeholder
 * below is now only ever the failure path.
 *
 * **A map that cannot be drawn is not a broken screen.** Tiles come from a
 * small, donation-funded service with no SLA (plan §1). If it is unreachable
 * the panel says so in one line and the list beside it — search, filters,
 * directions on every spot — is entirely unaffected.
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
  const container = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  // The imperative half lives in one ref-holding object so the effects below
  // stay readable. `any` because the module is only ever loaded inside an
  // effect — importing its types at the top would pull maplibre-gl into every
  // bundle that so much as mentions this file.
  const control = useRef<MapControl | null>(null);

  /* Build the map once, when there is a container. */
  useEffect(() => {
    if (!container.current || control.current) return;

    let cancelled = false;
    const node = container.current;

    void (async () => {
      try {
        // The whole module, not a default export: maplibre-gl has no default,
        // which is the one place its API differs from the mapbox-gl this
        // replaced (plan §1, 2026-08-17).
        const maplibregl = await import('maplibre-gl');
        if (cancelled) return;

        // Before the map exists, or it will look for its worker beside a hashed
        // Next chunk and quietly draw nothing but our own markers. See
        // `MAP_WORKER_URL`.
        maplibregl.setWorkerUrl(MAP_WORKER_URL);

        const instance = new maplibregl.Map({
          container: node,
          style: MAP_BASE_STYLE,
          center: [MAP_DEFAULT_CENTRE.lng, MAP_DEFAULT_CENTRE.lat],
          zoom: MAP_DEFAULT_ZOOM,
          // Nothing on this map is worth a 3D tilt, and a child dragging a
          // two-finger rotate into an upside-down map cannot easily undo it.
          pitchWithRotate: false,
          dragRotate: false,
          touchPitch: false,
          attributionControl: { customAttribution: MAP_ATTRIBUTION },
          cooperativeGestures: true,
        });
        instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        instance.on('error', () => setFailed(true));

        /*
         * Follow the container's size, rather than only the window's.
         *
         * This panel is laid out beside the list and reaches its real width
         * after the map is built, so MapLibre sized its canvas to a narrower
         * box and kept it: 128px of canvas inside a 556px panel, measured on
         * 2026-08-17. It corrects itself the first time the window resizes,
         * which is exactly the kind of bug nobody reports because every
         * developer resizes their window.
         */
        const resize = new ResizeObserver(() => instance.resize());
        resize.observe(node);

        control.current = { maplibregl, instance, markers: new Map(), here: null, resize };
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
      control.current?.resize.disconnect();
      control.current?.instance.remove();
      control.current = null;
    };
    // Built once. The effects below carry every later change into it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Every call into MapLibre goes through here, and a throw becomes the
   * placeholder rather than a blank screen.
   *
   * **This is a real failure, found by a flaky test.** When the basemap dies —
   * no WebGL, or tiles unreachable — MapLibre fires `error`, `failed` is set,
   * and the effect below removes the instance. But effects in the same commit
   * run in declaration order, so a rider pressing "Near me" at that moment
   * reached a map that had errored and not yet been torn down; `Marker.addTo`
   * threw, React unmounted the tree, and **the whole screen went with it** —
   * list, search and filters, not just the map. Reproduced roughly one run in
   * three once the spot list grew (2026-08-18).
   *
   * The plan's promise for this screen is that the list works whether or not a
   * map appears (§7, T13). A third-party canvas throwing must therefore degrade
   * to the honest "map would not load" state, which is what this does. It is
   * deliberately not a silent catch: `setFailed` shows the rider something is
   * wrong and takes the half-drawn map away with it.
   */
  const withMap = useCallback((work: (control: MapControl) => void) => {
    if (!control.current) return;
    try {
      work(control.current);
    } catch {
      /*
       * Scheduled, not set here. The throw happens inside an effect body, and
       * a synchronous `setFailed` there is a cascading render in the same
       * commit — which `react-hooks/set-state-in-effect` rejects, rightly: the
       * failure came from an external system, so it belongs in a callback the
       * way any other subscription update would. A microtask is the shortest
       * delay that gets it out of the effect, so the placeholder still appears
       * in the same frame a rider would notice.
       */
      queueMicrotask(() => setFailed(true));
    }
  }, []);

  /* Markers follow the filtered list. */
  useEffect(() => {
    withMap((map) => sync(map, spots, selectedId, onSelect));
  }, [spots, selectedId, onSelect, withMap]);

  /* The rider's dot follows the opt-in, and disappears with it. */
  useEffect(() => {
    withMap((map) => drawHere(map, here));
  }, [here, withMap]);

  /*
   * Tear the map down when it fails, before the placeholder replaces it.
   *
   * Without this the fallback is a lie you can see: React reconciles the two
   * branches below as the same `div` and only swaps its class, so the library's
   * injected children — the markers, the zoom buttons, the attribution —
   * survive the switch and end up floating over the "map would not load"
   * hatching. A half-drawn map is still, unmistakably, a map. `remove()` takes
   * its DOM with it, and the `key`s below stop React reusing the node.
   */
  useEffect(() => {
    if (!failed || !control.current) return;
    control.current.resize.disconnect();
    control.current.instance.remove();
    control.current = null;
  }, [failed]);

  if (failed) {
    return (
      <div key="placeholder" className={styles.mapPlaceholder}>
        <p className={`cond ${styles.mapPlaceholderText}`}>
          The map would not load just now. Every spot is still in the list, with directions on each
          one.
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
  maplibregl: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markers: Map<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  here: any;
  readonly resize: ResizeObserver;
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
      marker = new control.maplibregl.Marker({ element, anchor: 'bottom' })
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
    const bounds = new control.maplibregl.LngLatBounds();
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

  // A torn-down map leaves `instance` null; drawing a dot on nothing is not an
  // error worth surfacing, it is simply nothing to do.
  if (!control.instance) return;

  if (!control.here) {
    const element = document.createElement('div');
    element.className = styles.hereDot!;
    element.setAttribute('aria-label', 'Roughly where you are');
    control.here = new control.maplibregl.Marker({ element }).addTo(control.instance);
  }
  control.here.setLngLat([here.lng, here.lat]);
}
