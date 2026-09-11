'use client';

import type { LatLng, MapBounds } from '@landit/core';
import { Icon } from '@landit/ui-web';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  MAP_ATTRIBUTION,
  MAP_DEFAULT_CENTRE,
  MAP_DEFAULT_STYLE,
  MAP_DEFAULT_ZOOM,
  MAP_STYLES,
  MAP_WORKER_URL,
  circleBounds,
  circlePolygon,
  describeMapError,
  isTileScopedMapError,
  tokenColour,
  type MapArea,
  type MapErrorEvent,
  type MapStyleId,
} from '@/lib/map';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

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
 * ground and nothing else — OpenFreeMap's `liberty` by default since
 * 2026-08-31, `positron` one tap away (see `MAP_STYLES`) — with every Land The
 * Trick surface on this panel drawn by us: square markers with a 3px ink
 * keyline and a hard offset shadow, our own zoom controls, and the panel's own
 * header and footer bars. A basemap in the palette would mean authoring a style
 * of our own; this is the version that is honest about what we can build, and
 * swapping either entry in `MAP_STYLES` for a bespoke one later changes one
 * line.
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
 * **But a tile that cannot be drawn is not a map that cannot be drawn.** This
 * component used to treat every MapLibre `error` as fatal, and MapLibre fires
 * that event for a single failed tile request — so one 500, or one moment of
 * bad signal while panning, replaced a working map with the placeholder until
 * the page was reloaded (issue #219). `isTileScopedMapError` is where that
 * distinction now lives, with the evidence for it.
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
  area = null,
  label = 'Map of spots',
  gestures = 'cooperative',
  follow = true,
  onSearchArea,
}: {
  readonly spots: readonly Plottable[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly here: LatLng | null;
  /**
   * An area to draw instead of a pin, for a point that is only known roughly.
   *
   * Optional and absent on the spots screen, which is the whole difference
   * between the two callers: a spot is a checked coordinate and gets a marker,
   * an event holds a town and gets a circle (see `MapArea`). Given one, the map
   * opens on it, the ground toggle is not offered (below), and the circle is
   * re-drawn whenever the style changes under it.
   */
  readonly area?: MapArea | null;
  /** What a screen reader is told this map is. */
  readonly label?: string;
  /**
   * Who gets a one-finger drag over the canvas: the page, or the map.
   *
   * **`cooperative` is the default and the right one nearly everywhere.** This
   * map is usually one panel inside a page a rider scrolls — beside the spot
   * list, under an event's details, on a spot's own page — and MapLibre's
   * cooperative gestures exist for exactly that: a finger dragged over the
   * canvas scrolls the page (`touch-action: pan-x pan-y`), and it takes two to
   * move the map. Without it a rider scrolling past a map gets stuck in it.
   *
   * **`direct` is for a map that *is* the screen.** In the spots sheet the map
   * fills three quarters of a phone, over a page held still behind it — so the
   * page has nothing to scroll and cooperative gestures spend every drag on it
   * anyway: the rider's finger moves nothing and a hint appears telling them to
   * use two. That is the defect the owner reported on 2026-09-08. Given
   * `direct`, MapLibre drops the class it hangs that `touch-action` on and the
   * canvas takes the drag.
   *
   * It is a prop rather than something this component measures because it is
   * not a fact about the viewport: the same phone-width map is cooperative in
   * the page and direct in the sheet, and only the caller knows which it is
   * rendering. MapLibre's own fullscreen control makes the same swap the same
   * way.
   */
  readonly gestures?: 'cooperative' | 'direct';
  /**
   * Whether the camera fits itself to `spots` whenever they change.
   *
   * True everywhere the list decides what the map shows. False while the spots
   * screen holds a searched area, where it is the other way round: the list
   * was drawn from the camera, and fitting the camera to it would move the view
   * the rider has just chosen — and zoom out to frame the list's outliers —
   * every time a card arrived. A chosen spot is still flown to either way;
   * that is a move the rider asked for.
   */
  readonly follow?: boolean;
  /**
   * Offer "Search this area" once the rider has moved the map, and hand the
   * view here when it is pressed. Absent — the spot page, the event page — and
   * no button is ever drawn. The view leaves this component as four edges in
   * degrees and goes nowhere else from here (§6.4, standard 10).
   */
  readonly onSearchArea?: (bounds: MapBounds) => void;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  /*
   * Whether "Search this area" is on offer: the rider has moved the map since
   * the list last matched it.
   *
   * Set by a camera move a gesture started — a drag, a pinch, a scroll-zoom,
   * the zoom buttons, the keyboard, all of which MapLibre tags with an
   * `originalEvent` (its inertial ease after a drag carries the same one) — and
   * cleared by any move this component makes itself: fitting the list, flying
   * to a chosen spot, a resize. So the button offers the view the rider chose,
   * and goes the moment the map is showing something the list already
   * describes. The press clears it too.
   */
  const [offerArea, setOfferArea] = useState(false);

  /*
   * Which ground the map is drawn on — see `MAP_STYLES` for what the two are
   * and why there is no satellite one.
   *
   * **Held here rather than by the screen, so it dies with the map.** When
   * tiles cannot be reached this component returns the placeholder instead of a
   * canvas, and a toggle owned by `SpotsScreen` would go on offering a choice
   * of grounds for a map that is not there — the same defect issue #220 records
   * for the panel's other promises. Rendered inside the canvas branch, it
   * cannot outlive it.
   *
   * Deliberately not persisted. It is a way of looking at one spot for a
   * moment, not a preference, and `localStorage` on this screen is a thing to
   * add on purpose rather than by habit.
   */
  const [styleId, setStyleId] = useState<MapStyleId>(MAP_DEFAULT_STYLE);

  /*
   * What the *map instance* was last told to draw, which is not the same thing
   * as `styleId`.
   *
   * The build effect below runs once, and it runs `await import()` first — so a
   * rider who presses the toggle inside that window would otherwise have their
   * choice overwritten by the initial style a moment later. Reading the ref at
   * construction means the map is built on whatever is current by then, and the
   * effect that follows sees the two already agree and does nothing.
   */
  const drawn = useRef<MapStyleId>(MAP_DEFAULT_STYLE);

  /*
   * The area the map was built on, readable from inside the build effect.
   *
   * Same reasoning as `drawn` above: that effect runs once and does an `await
   * import()` first, so it cannot close over a prop and still be correct. The
   * effect that sets this is declared *before* the build effect, and effects in
   * one commit run in declaration order, so the ref is current by the time the
   * map is constructed.
   */
  const areaRef = useRef<MapArea | null>(area);
  useEffect(() => {
    areaRef.current = area;
  }, [area]);

  /*
   * Which gestures the map was built with, for the same reason as `areaRef`
   * above: the build effect runs once and `await import()`s first, so it cannot
   * close over a prop and still be right. Declared before the build effect so
   * the ref is current by the time the map is constructed; the effect further
   * down carries every later change into the live handler.
   */
  const gesturesRef = useRef(gestures);
  useEffect(() => {
    gesturesRef.current = gestures;
  }, [gestures]);

  /** Has the rider moved the camera themselves? See the resize handler below. */
  const moved = useRef(false);

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
          style: MAP_STYLES[drawn.current].url,
          center: areaRef.current
            ? [areaRef.current.lng, areaRef.current.lat]
            : [MAP_DEFAULT_CENTRE.lng, MAP_DEFAULT_CENTRE.lat],
          zoom: MAP_DEFAULT_ZOOM,
          // Built straight onto the area when there is one, rather than easing
          // there from the default centre: a rail-width map that flies across
          // the country on load reads as a glitch, and there is nothing here
          // for the animation to explain.
          ...(areaRef.current
            ? {
                bounds: circleBounds(areaRef.current),
                fitBoundsOptions: { padding: AREA_PADDING },
              }
            : {}),
          // Nothing on this map is worth a 3D tilt, and a child dragging a
          // two-finger rotate into an upside-down map cannot easily undo it.
          pitchWithRotate: false,
          dragRotate: false,
          touchPitch: false,
          attributionControl: { customAttribution: MAP_ATTRIBUTION },
          cooperativeGestures: gesturesRef.current === 'cooperative',
        });
        instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        /*
         * Not every `error` is a broken map, and treating them alike cost us
         * the whole map (issue #219). A tile that failed is one tile: MapLibre
         * marks it errored, carries on, and still reports itself loaded. Only
         * the errors that leave nothing to look at reach `setFailed`.
         *
         * Both branches log, because the version of this line that discarded
         * the event left a rider's "the map did not load" with nothing behind
         * it — see `describeMapError`.
         */
        instance.on('error', (event: MapErrorEvent) => {
          if (isTileScopedMapError(event)) {
            console.warn(`[map] ${describeMapError(event)}`);
            return;
          }
          console.error(`[map] ${describeMapError(event)}`);
          setFailed(true);
        });

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
        const resize = new ResizeObserver(() => {
          instance.resize();
          /*
           * And re-frame the area, because the width it was framed against was
           * the wrong one. The camera is fitted at construction, when this
           * panel is still narrower than it ends up — so a circle fitted to a
           * 128px box stayed at that zoom in a 344px one and spilled over
           * every edge. Refitting on resize is the same correction `instance
           * .resize()` above already makes for the canvas.
           *
           * **Only until the rider takes over.** `moved` is set by the camera
           * events that carry an `originalEvent` — a drag or a scroll — never
           * by our own `fitBounds`, so a resize after somebody has panned
           * leaves their view alone rather than snapping it back.
           */
          if (areaRef.current && !moved.current) fitArea(instance, areaRef.current);
        });
        resize.observe(node);
        /*
         * The rider taking the camera. `originalEvent` is present only when a
         * gesture caused the move, so our own `fitBounds` never sets this.
         * Written out rather than looped because MapLibre types `on` against a
         * union of literal event names.
         */
        const claim = (event: { originalEvent?: unknown }) => {
          if (event.originalEvent) moved.current = true;
        };
        instance.on('dragstart', claim);
        instance.on('zoomstart', claim);
        instance.on('rotatestart', claim);
        /*
         * The same test decides whether "Search this area" is on offer — see
         * `offerArea`. `movestart` rather than the three above because it is
         * the one event every camera change fires, ours included, and ours are
         * the ones that have to take the offer away.
         */
        instance.on('movestart', (event: { originalEvent?: unknown }) =>
          setOfferArea(Boolean(event.originalEvent)),
        );

        /*
         * The circle is a source and two layers, and a style swap throws both
         * away — so it is painted on every `styledata` rather than once. The
         * guard inside `paintArea` makes the repeats free.
         */
        instance.on('styledata', () => paintArea(instance, areaRef.current));

        control.current = { maplibregl, instance, markers: new Map(), here: null, resize };
        if (cancelled) return;
        // Plot whatever is already selected, without waiting for a state change.
        sync(control.current, spots, selectedId, onSelect, follow);
        drawHere(control.current, here);
        paintArea(instance, areaRef.current);
      } catch (error) {
        if (!cancelled) {
          console.error('[map] could not be built', error);
          setFailed(true);
        }
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
    } catch (error) {
      console.error('[map] a call into MapLibre threw', error);
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

  /*
   * "Search this area", pressed. The view is read off the camera *now*, not
   * remembered from the move that offered it, so a rider who drags, pauses and
   * drags again gets where the map is rather than where it was.
   */
  const searchArea = useCallback(() => {
    withMap((map) => {
      const view = map.instance.getBounds();
      onSearchArea?.({
        south: view.getSouth(),
        west: view.getWest(),
        north: view.getNorth(),
        east: view.getEast(),
      });
    });
    setOfferArea(false);
  }, [onSearchArea, withMap]);

  /* Markers follow the filtered list. */
  useEffect(() => {
    withMap((map) => sync(map, spots, selectedId, onSelect, follow));
  }, [spots, selectedId, onSelect, follow, withMap]);

  /* The rider's dot follows the opt-in, and disappears with it. */
  useEffect(() => {
    withMap((map) => drawHere(map, here));
  }, [here, withMap]);

  /*
   * Hand the drag to the map, or back to the page.
   *
   * `cooperativeGestures` is a constructor option *and* a live handler, and it
   * has to be both here: the spots map is one instance that is a column beside
   * the list at one width and a near-full-screen sheet at another, so the
   * answer changes under a map that is already built. `enable`/`disable` add
   * and remove the class MapLibre's stylesheet hangs the canvas `touch-action`
   * on, which is the whole mechanism — see the prop's own note above.
   *
   * Guarded rather than assumed, because the handler is only constructed when
   * the map is: this also runs on the render where the map has just failed and
   * is about to be torn down, and `withMap` would turn a throw here into the
   * placeholder over a choice of gestures nobody would see the result of.
   */
  useEffect(() => {
    withMap((map) => {
      const handler = map.instance.cooperativeGestures;
      if (!handler) return;
      if (gestures === 'cooperative') handler.enable();
      else handler.disable();
    });
  }, [gestures, withMap]);

  /* A moved or resized area is re-drawn, and re-framed, where it is now. */
  useEffect(() => {
    withMap((map) => {
      paintArea(map.instance, area);
      if (area && !moved.current) fitArea(map.instance, area);
    });
  }, [area, withMap]);

  /*
   * Carry a ground change into the map.
   *
   * **The markers do not need redrawing, and that is not luck.** Both the spot
   * pins and the rider's dot are `Marker`s — absolutely-positioned DOM elements
   * MapLibre keeps outside the canvas and moves on every camera event — so a
   * style swap replaces the tiles under them and leaves them, their selection
   * state and the camera exactly where they were. Anything drawn *as a layer*
   * would have to be re-added on `styledata`; nothing here is.
   *
   * The `drawn` guard is what makes this a no-op on mount: the map was built on
   * `drawn.current` a few lines up, so the first run has nothing to do rather
   * than throwing a second style fetch at OpenFreeMap for the one already on
   * screen.
   */
  useEffect(() => {
    if (drawn.current === styleId) return;
    drawn.current = styleId;
    withMap((map) => map.instance.setStyle(MAP_STYLES[styleId].url));
  }, [styleId, withMap]);

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
    <div key="canvas" className={styles.mapStage}>
      <div ref={container} className={styles.mapCanvas} aria-label={label} role="group" />

      {/*
        Plain or Detail, over the canvas rather than in the panel's header bar.

        **It sits on the map because it is about the map**, and because the
        header already carries the selected spot's name and its "Open in Maps"
        link — a third control there wraps onto its own line at the panel's real
        width. Top-left is the one corner MapLibre leaves alone: its zoom
        buttons are top-right and the attribution is bottom-right, and neither
        may be moved to make room (the credit is a condition of use).

        A radio group, not two toggles: these are two ways of drawing one map,
        exactly one is true at a time, and `aria-checked` says which — which is
        also what a keyboard rider needs to hear when they arrive on it.
      */}
      {/*
        **Not offered on an area map**, which is the one place the choice buys
        nothing. The toggle exists because riders asked for imagery to read a
        spot's surface against (`ANALYTICS_EVENTS.spotsMapGround`); an event's
        circle is 1.5km of town and there is no surface in it to read. It would
        also file its presses under the spots screen's own count, where they
        would answer a question nobody asked.
      */}
      {!area && (
        <div className={styles.ground} role="radiogroup" aria-label="Map detail">
          {Object.values(MAP_STYLES).map((option) => {
            const on = option.id === styleId;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`${styles.groundButton} ${on ? styles.groundButtonOn : ''}`}
                onClick={() => {
                  if (on) return;
                  // Which ground, and nothing else. A style id is one of two
                  // fixed strings and the same for everybody — no spot, no
                  // position.
                  capture(ANALYTICS_EVENTS.spotsMapGround, { ground: option.id });
                  setStyleId(option.id);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {/*
        "Search this area" — top and centre, which is where every map that
        offers it puts it, and over the canvas like the ground toggle for the
        same reason: it is about the map, so it goes when the map does. A
        failed map returns the placeholder above instead of this branch, so the
        button can never promise a search of a map that is not there (the
        class of defect issue #220 records for the panel's other promises).

        A strip that spans the stage with the button in its middle, rather than
        a button centred with a transform: `.btn` owns `transform` for its hover
        lift and its press, and a centring translate on the same element would
        be overwritten the first time a pointer crossed it.
      */}
      {onSearchArea && offerArea && (
        <div className={styles.areaSearch}>
          <button
            type="button"
            className={`btn sm ${styles.areaSearchButton}`}
            onClick={searchArea}
          >
            <Icon name="search" size={15} strokeWidth={2.8} />
            Search this area
          </button>
        </div>
      )}
    </div>
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
 *
 * The camera goes to a chosen spot whenever there is one. Otherwise it frames
 * the list only when `follow` is set — not while the list was itself drawn from
 * the camera by "Search this area", where framing it would move the view the
 * rider just chose (see the prop).
 */
function sync(
  control: MapControl,
  spots: readonly Plottable[],
  selectedId: string | null,
  onSelect: (id: string) => void,
  follow: boolean,
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

  if (!follow) return;

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
    /*
     * **`setLngLat` before `addTo`, which is the only order that works.**
     *
     * `Marker.addTo` subscribes `_update` to the map's `move`, `moveend`,
     * `terrain` and `projectiontransition` events and then calls it — and
     * `_update` dereferences the marker's own `LngLat`. Added first, that is
     * `undefined`, and the call throws `Cannot read properties of undefined
     * (reading 'lng')`. It is the order MapLibre's own examples use, and the
     * one `sync` above already used for the spot pins.
     *
     * **It threw every time, not occasionally.** The listeners are registered
     * *before* the throwing call, so the half-added marker stayed subscribed
     * and threw again on every frame of the next camera ease — uncaught, from
     * inside MapLibre's render loop, where no `try` of ours can reach it.
     *
     * The first throw was caught by `withMap`, which set `failed` — so pressing
     * "Near me" replaced the map with "The map would not load just now". The
     * comment there attributes that throw to a map that had errored and not yet
     * been torn down (issue #219 era). That was a misreading: the marker threw
     * on its own account, on a perfectly healthy map, every single time.
     */
    control.here = new control.maplibregl.Marker({ element })
      .setLngLat([here.lng, here.lat])
      .addTo(control.instance);
    return;
  }

  // Already on the map, so this is just a move.
  control.here.setLngLat([here.lng, here.lat]);
}

/* ------------------------------------------------------------- the area -- */

/**
 * Frame the whole circle, with room around it.
 *
 * The padding is generous on purpose: fitted tight, the circle fills the frame
 * edge to edge and there is no town left around it to recognise — which is the
 * one thing a reader is looking at this for.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fitArea(instance: any, area: MapArea): void {
  if (!instance) return;
  instance.fitBounds(circleBounds(area), { padding: AREA_PADDING, duration: 0 });
}

/** Pixels of ground kept visible around a fitted area. */
const AREA_PADDING = 44;

const AREA_SOURCE = 'landit-area';
const AREA_FILL = 'landit-area-fill';
const AREA_EDGE = 'landit-area-edge';
const AREA_CENTRE = 'landit-area-centre';

/**
 * Draw (or move, or remove) the "roughly here" circle.
 *
 * **Layers rather than a marker**, because a marker is a DOM element pinned to
 * a point and would keep its size as the map zoomed — a 1.5km claim that is
 * 1.5km at one zoom level and 15km at another. These vertices are in degrees
 * (`circlePolygon`), so the circle is stuck to the ground the way a real area
 * is.
 *
 * **Called on every `styledata`, and safe to be.** Swapping the basemap
 * discards every source and layer the style did not bring with it, so the only
 * reliable place to add these is after each style load; the `getSource` check
 * turns every repeat into a `setData`. `isStyleLoaded` is the guard for the
 * calls that arrive mid-load, where `addLayer` would throw.
 *
 * Colours come from `tokens.css` through `tokenColour` — a canvas cannot read
 * `var(--yellow)`, and a hex literal here would be a second copy of a token.
 */
function paintArea(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: any,
  area: MapArea | null,
): void {
  if (!instance || typeof instance.isStyleLoaded !== 'function' || !instance.isStyleLoaded())
    return;

  if (!area) {
    for (const id of [AREA_CENTRE, AREA_EDGE, AREA_FILL]) {
      if (instance.getLayer(id)) instance.removeLayer(id);
    }
    if (instance.getSource(AREA_SOURCE)) instance.removeSource(AREA_SOURCE);
    return;
  }

  const data = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { kind: 'area' },
        geometry: { type: 'Polygon', coordinates: [circlePolygon(area)] },
      },
      {
        type: 'Feature',
        properties: { kind: 'centre' },
        geometry: { type: 'Point', coordinates: [area.lng, area.lat] },
      },
    ],
  };

  const existing = instance.getSource(AREA_SOURCE);
  if (existing) {
    existing.setData(data);
    return;
  }

  const ink = tokenColour('--ink', '#12100b');
  const yellow = tokenColour('--yellow', '#ffc23f');
  const orange = tokenColour('--orange', '#ff5a1f');

  instance.addSource(AREA_SOURCE, { type: 'geojson', data });
  instance.addLayer({
    id: AREA_FILL,
    type: 'fill',
    source: AREA_SOURCE,
    filter: ['==', ['get', 'kind'], 'area'],
    paint: { 'fill-color': yellow, 'fill-opacity': 0.34 },
  });
  instance.addLayer({
    id: AREA_EDGE,
    type: 'line',
    source: AREA_SOURCE,
    filter: ['==', ['get', 'kind'], 'area'],
    // Dashed, which is the design's one way of saying "this edge is not a fact".
    paint: { 'line-color': ink, 'line-width': 2.5, 'line-dasharray': [2, 2] },
  });
  instance.addLayer({
    id: AREA_CENTRE,
    type: 'circle',
    source: AREA_SOURCE,
    filter: ['==', ['get', 'kind'], 'centre'],
    // The point we actually hold — a town centre. Sized in pixels on purpose:
    // it is a mark, not a measurement, and the circle around it carries the
    // claim about distance.
    paint: {
      'circle-radius': 7,
      'circle-color': orange,
      'circle-stroke-color': ink,
      'circle-stroke-width': 2.5,
    },
  });
}
