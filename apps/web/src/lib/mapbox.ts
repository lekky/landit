/**
 * The Mapbox access token, and the one question the spots screen asks about it:
 * is there one?
 *
 * **Read literally, on purpose.** Next replaces `process.env.NEXT_PUBLIC_*`
 * with a string constant only where it appears *verbatim* in the source, so a
 * tidier `readEnv('NEXT_PUBLIC_MAPBOX_TOKEN')` would compile, pass every test
 * under Node, and then hand the browser `undefined` while the variable is
 * plainly set in the container. That defect has already been paid for once here
 * (issue #44, `packages/db/src/clients.ts`) and the fix is to write the whole
 * name out. Do not "simplify" this.
 *
 * The `try` covers the case where nothing substituted anything and there is no
 * `process` either — the bare reference would throw.
 */
export function mapboxToken(): string | undefined {
  try {
    const value = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    return value && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether the map can be drawn at all.
 *
 * There is no token in this repo and there is no account behind it yet
 * (`docs/infrastructure.md`), so "no token" is the *normal* state of every
 * checkout, every CI run and every preview until the owner supplies one. The
 * spots screen therefore treats it as a first-class case rather than an error:
 * the list, the search, the filters and the submission form all work, and the
 * map panel says in one line what is missing. A thing that cannot work yet says
 * so; it does not render a grey rectangle and 401 into the console.
 */
export function mapIsAvailable(): boolean {
  return mapboxToken() !== undefined;
}

/**
 * The base style the markers sit on (plan §7, T13).
 *
 * A quiet, low-contrast Mapbox style, with the whole Land The Trick visual language
 * carried by what we draw on top of it — the markers, the controls and the
 * panel around it. The alternative, a custom style authored in Mapbox Studio to
 * match the palette, needs a Studio account and a designer: it is owner work,
 * not session work, and this is swappable to it in one line when it exists.
 *
 * `light-v11` rather than `streets-v12` because the markers are loud by design:
 * a basemap with its own strong colours fights them, and the thing a rider needs
 * to read off the map is which pin is theirs and what road it is near.
 */
export const MAP_BASE_STYLE = 'mapbox://styles/mapbox/light-v11';

/** Where the map opens when it has no spots to fit — the middle of the UK. */
export const MAP_DEFAULT_CENTRE = { lat: 53.4, lng: -2.5 } as const;
export const MAP_DEFAULT_ZOOM = 5.4;
