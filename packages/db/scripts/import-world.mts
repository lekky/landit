#!/usr/bin/env node
/**
 * Build the world skatepark snapshot and write it to `src/imports/world.data.ts`.
 *
 *   pnpm --filter @landit/db import:world -- --tnf <dir>
 *
 * **Which places, and whose data.** The list of places is Trucks and Fins' map
 * (trucksandfins.com), the largest skatepark directory there is — about 27,600
 * parks (owner's call, 2026-09-11, in chat). For each one, OpenStreetMap is
 * asked first: where an OpenStreetMap skateboarding object sits within 150
 * metres, its point, name, address and tags are the ones kept, under the Open
 * Database Licence we already hold and credit. Roughly two thirds of the parks
 * have one. The rest are kept on Trucks and Fins' point and name alone. From
 * Trucks and Fins the file takes **facts and nothing else**: a point, a name,
 * and which of its thirteen map filters list the park. Never a description, an
 * address, a review or a photograph — none of its prose reaches this
 * repository, and every sentence on a spot page is written by us
 * (`SPOT_FEATURES` in `@landit/core`).
 *
 * **Trucks and Fins is never fetched by this script.** The site sits behind a
 * bot shield (Bunny Shield: a 403 and a proof-of-work page to anything that is
 * not a browser), and this script does not try to get past it. The two inputs
 * are captured in an ordinary browser and passed in with `--tnf <dir>`:
 *
 * 1. `spots.html` — https://trucksandfins.com/en/spots?f_skate=1, saved with
 *    "Save page as… (HTML only)". The whole list is inline in the page.
 * 2. `features.json` — on that same page, run this in the console; it asks for
 *    each filter the way the page's own dropdown does, a second apart, and
 *    downloads the park numbers each one lists:
 *
 *        const ids = {7:0,14:0,18:0,22:0,29:0,36:0,38:0,40:0,46:0,51:0,52:0,59:0,98:0};
 *        const re = /\/spots\/skateparks\/[^`]*\/(\d+)`/g, features = {};
 *        for (const id of Object.keys(ids)) {
 *          const html = await (await fetch(`/en/spots?f_skate=1&f_feature=${id}`)).text();
 *          features[id] = { ids: [...new Set([...html.matchAll(re)].map((m) => +m[1]))] };
 *          await new Promise((r) => setTimeout(r, 1000));
 *        }
 *        const a = document.createElement('a');
 *        a.href = URL.createObjectURL(new Blob([JSON.stringify({ capturedAt: new Date(), features })]));
 *        a.download = 'features.json'; a.click();
 *
 * **Everything else is fetched and cached** under `--cache` (default
 * `node_modules/.cache/landit-import-world`): OpenStreetMap through Overpass, in
 * twelve longitude bands because one worldwide query times out; GeoNames'
 * `cities1000` (CC BY 4.0) for the town a park is in; Natural Earth's admin-0
 * borders (public domain) to check the country. Delete the cache to refresh.
 *
 * **A snapshot, like France's.** The seed reads the committed file and never
 * the network, so a seed on the live box depends on nobody else's server, and a
 * reviewer can read what is about to be written. The naming, tag, sports and
 * duplicate rules are in `src/imports/world.ts`, pure and unit-tested; this
 * script only gathers, matches and places.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

import {
  ADDRESS_MAX,
  OSM_BIT,
  PHONE_MAX,
  TNF_FILTERS,
  TNF_FLAG,
  TOWN_MAX,
  type WorldSourceRow,
} from '../src/imports/world-source.ts';

/* ------------------------------------------------------------ arguments -- */

const here = path.dirname(fileURLToPath(import.meta.url));

function argument(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

const TNF_DIR = argument('tnf');
if (!TNF_DIR) {
  console.error('usage: import:world -- --tnf <dir with spots.html and features.json>');
  process.exit(1);
}
const CACHE =
  argument('cache') ?? path.join(here, '..', 'node_modules', '.cache', 'landit-import-world');
const OVERPASS = argument('overpass') ?? 'https://overpass-api.de/api/interpreter';
const OUT = path.join(here, '..', 'src', 'imports', 'world.data.ts');

const USER_AGENT = 'LandTheTrick-import/1.0 (+https://landthetrick.com)';

/** How close an OpenStreetMap object must be to count as the same park. */
const MATCH_METRES = 150;

/* ---------------------------------------------------------------- cache -- */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function cached(file: string, fetcher: () => Promise<Buffer>): Promise<Buffer> {
  const at = path.join(CACHE, file);
  if (existsSync(at)) return readFile(at);
  const body = await fetcher();
  await mkdir(CACHE, { recursive: true });
  await writeFile(at, body);
  return body;
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/* ----------------------------------------------------------- geometry -- */

function metres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A bucket grid over points, for "what is near here" without a full scan. */
class Grid<T extends { lat: number; lng: number }> {
  private readonly cells = new Map<string, T[]>();
  private readonly size: number;
  constructor(size: number, items: Iterable<T>) {
    this.size = size;
    for (const item of items) {
      const key = this.key(item.lat, item.lng);
      const cell = this.cells.get(key);
      if (cell) cell.push(item);
      else this.cells.set(key, [item]);
    }
  }
  private key(lat: number, lng: number): string {
    return `${Math.floor(lat / this.size)},${Math.floor(lng / this.size)}`;
  }
  /** Everything within `rings` cells of the point, unsorted. */
  near(lat: number, lng: number, rings: number): T[] {
    const cy = Math.floor(lat / this.size);
    const cx = Math.floor(lng / this.size);
    const out: T[] = [];
    for (let y = cy - rings; y <= cy + rings; y += 1) {
      for (let x = cx - rings; x <= cx + rings; x += 1) {
        const cell = this.cells.get(`${y},${x}`);
        if (cell) out.push(...cell);
      }
    }
    return out;
  }
}

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

/** Lowercase, accents folded, punctuation to spaces. */
const fold = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/* ------------------------------------------------------ Trucks and Fins -- */

/**
 * The page writes names HTML-escaped inside its script — "Aaron&#039;s Hill" —
 * so an apostrophe or an ampersand arrives as an entity and would reach a card,
 * and a slug, as "039". Decoded here, once, before anything reads the name.
 */
function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
    nbsp: ' ',
  };
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : entity;
    }
    return named[body.toLowerCase()] ?? entity;
  });
}

interface TnfPark {
  readonly id: number;
  readonly lat: number;
  readonly lng: number;
  readonly name: string;
  flags: number;
}

async function readTrucksAndFins(dir: string): Promise<TnfPark[]> {
  const html = await readFile(path.join(dir, 'spots.html'), 'utf8');
  const row =
    /\[``, (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?), icons\['skatepark'\]\['iconUrl'\], `([^`]*)`, `https:\/\/trucksandfins\.com\/en\/spots\/skateparks\/[^`]*\/(\d+)`/g;
  const parks = new Map<number, TnfPark>();
  for (const match of html.matchAll(row)) {
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    const id = Number(match[4]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) continue;
    parks.set(id, {
      id,
      lat,
      lng,
      name: decodeEntities(match[3]!).replace(/\s+/g, ' ').trim(),
      flags: 0,
    });
  }
  if (parks.size < 20_000) {
    throw new Error(`spots.html holds ${parks.size} parks — is it the saved list page?`);
  }

  const features = JSON.parse(await readFile(path.join(dir, 'features.json'), 'utf8')) as {
    features: Record<string, { ids: number[] }>;
  };
  for (const [filter, { flag }] of Object.entries(TNF_FILTERS)) {
    const listed = features.features[filter]?.ids;
    if (!listed) throw new Error(`features.json has no list for filter ${filter}`);
    for (const id of listed) {
      const park = parks.get(Number(id));
      if (park) park.flags |= TNF_FLAG[flag];
    }
  }
  return [...parks.values()].sort((a, b) => a.id - b.id);
}

/* ------------------------------------------------------- OpenStreetMap -- */

/** South, west, north, east. Small enough that none times out. */
const BANDS = [
  [-90, -180, 90, -100],
  [-90, -100, 38, -80],
  [38, -100, 90, -80],
  [-90, -80, 25, -60],
  [25, -80, 38, -60],
  [38, -80, 42, -60],
  [42, -80, 90, -60],
  [-90, -60, 90, -5],
  [-90, -5, 90, 8],
  [-90, 8, 90, 20],
  [-90, 20, 90, 60],
  [-90, 60, 90, 180],
] as const;

interface OsmElement {
  readonly type: 'node' | 'way' | 'relation';
  readonly id: number;
  readonly lat?: number;
  readonly lon?: number;
  readonly center?: { lat: number; lon: number };
  readonly tags?: Record<string, string>;
}

interface OsmPlace {
  readonly ref: string;
  readonly lat: number;
  readonly lng: number;
  readonly tags: Record<string, string>;
}

async function overpassBand(band: readonly number[]): Promise<OsmElement[]> {
  const bbox = band.join(',');
  const query = `[out:json][timeout:260];(nwr["sport"~"skateboard"](${bbox});nwr["leisure"="skatepark"](${bbox}););out center tags;`;
  const body = await cached(`overpass-${band.join('_')}.json`, async () => {
    for (let attempt = 1; ; attempt += 1) {
      const response = await fetch(OVERPASS, {
        method: 'POST',
        headers: { 'user-agent': USER_AGENT, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
      });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
      if (attempt >= 4 || (response.status !== 429 && response.status !== 504)) {
        throw new Error(`Overpass ${bbox} → ${response.status}`);
      }
      console.log(`  Overpass ${bbox} → ${response.status}, waiting…`);
      await sleep(60_000 * attempt);
    }
  });
  const parsed = JSON.parse(body.toString('utf8')) as { elements: OsmElement[]; remark?: string };
  if (parsed.remark && /error|timed out/i.test(parsed.remark)) {
    throw new Error(`Overpass ${bbox}: ${parsed.remark} (delete the cached band and retry)`);
  }
  return parsed.elements;
}

/** Objects that carry a skateboarding tag but are not a place to ride. */
const NOT_A_PARK = ['shop', 'club', 'office', 'craft', 'healthcare'];

async function readOpenStreetMap(): Promise<OsmPlace[]> {
  const byRef = new Map<string, OsmPlace>();
  for (const band of BANDS) {
    for (const element of await overpassBand(band)) {
      const tags = element.tags ?? {};
      if (NOT_A_PARK.some((key) => key in tags)) continue;
      const lat = element.lat ?? element.center?.lat;
      const lng = element.lon ?? element.center?.lon;
      if (lat === undefined || lng === undefined) continue;
      const ref = `${element.type[0]}${element.id}`;
      byRef.set(ref, { ref, lat, lng, tags });
    }
  }
  return [...byRef.values()];
}

/**
 * OpenStreetMap's name for a park, in Latin script where it has one: `name` as
 * the mappers wrote it, or `name:en` when `name` is in another script and an
 * English name exists. A rider reads the card in English.
 */
function osmName(tags: Record<string, string>): string {
  const name = (tags.name ?? '').replace(/\s+/g, ' ').trim();
  const english = (tags['name:en'] ?? '').replace(/\s+/g, ' ').trim();
  const latin = /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]*$/u.test(name);
  return !latin && english ? english : name;
}

function osmBits(tags: Record<string, string>): number {
  let bits = 0;
  if (
    tags.covered === 'yes' ||
    tags.indoor === 'yes' ||
    tags.location === 'indoor' ||
    (tags.building !== undefined && tags.building !== 'no')
  ) {
    bits |= OSM_BIT.covered;
  }
  if (/\bbmx\b/i.test(tags.sport ?? '')) bits |= OSM_BIT.bmx;
  if (tags.disused === 'yes' || tags.abandoned === 'yes') bits |= OSM_BIT.closed;
  return bits;
}

function osmAddress(tags: Record<string, string>): string {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const town = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  if (!street) return '';
  const address = town ? `${street}, ${town}` : street;
  return address.length <= ADDRESS_MAX ? address : '';
}

function osmPhone(tags: Record<string, string>): string {
  const phone = (tags.phone ?? tags['contact:phone'] ?? '').split(';')[0]!.trim();
  return phone.length <= PHONE_MAX ? phone : '';
}

/**
 * Pair each park with the OpenStreetMap object nearest to it, one to one: all
 * pairs within {@link MATCH_METRES} are taken closest first, and an object or
 * a park already paired is skipped. Two parks either side of one mapped area
 * cannot both claim it.
 */
function match(parks: readonly TnfPark[], places: readonly OsmPlace[]): Map<number, OsmPlace> {
  const grid = new Grid(0.01, places);
  const pairs: { d: number; park: number; place: OsmPlace }[] = [];
  for (const park of parks) {
    for (const place of grid.near(park.lat, park.lng, 1)) {
      const d = metres(park.lat, park.lng, place.lat, place.lng);
      if (d <= MATCH_METRES) pairs.push({ d, park: park.id, place });
    }
  }
  pairs.sort((a, b) => a.d - b.d || a.park - b.park || a.place.ref.localeCompare(b.place.ref));
  const matched = new Map<number, OsmPlace>();
  const used = new Set<string>();
  for (const { park, place } of pairs) {
    if (matched.has(park) || used.has(place.ref)) continue;
    matched.set(park, place);
    used.add(place.ref);
  }
  return matched;
}

/* ------------------------------------------------------------ GeoNames -- */

interface Town {
  readonly name: string;
  readonly folded: ReadonlySet<string>;
  readonly lat: number;
  readonly lng: number;
  readonly country: string;
  /** GeoNames feature code: `PPLX` is a section of a bigger place. */
  readonly code: string;
}

/** The one file in a single-entry zip, without a dependency. */
function unzip(archive: Buffer, entry: string): Buffer {
  let end = -1;
  for (let i = archive.length - 22; i >= Math.max(0, archive.length - 65_557); i -= 1) {
    if (archive.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end === -1) throw new Error('not a zip');
  const count = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  for (let n = 0; n < count; n += 1) {
    const method = archive.readUInt16LE(at + 10);
    const size = archive.readUInt32LE(at + 20);
    const nameLength = archive.readUInt16LE(at + 28);
    const extraLength = archive.readUInt16LE(at + 30);
    const commentLength = archive.readUInt16LE(at + 32);
    const local = archive.readUInt32LE(at + 42);
    const name = archive.toString('utf8', at + 46, at + 46 + nameLength);
    if (name === entry) {
      const start =
        local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
      const data = archive.subarray(start, start + size);
      return method === 0 ? data : inflateRawSync(data);
    }
    at += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`${entry} is not in the archive`);
}

async function readTowns(): Promise<Town[]> {
  const zip = await cached('cities1000.zip', () =>
    download('https://download.geonames.org/export/dump/cities1000.zip'),
  );
  const towns: Town[] = [];
  for (const line of unzip(zip, 'cities1000.txt').toString('utf8').split('\n')) {
    const f = line.split('\t');
    if (f.length < 15 || f[6] !== 'P') continue;
    const name = f[1]!.trim();
    if (!name || name.length > TOWN_MAX) continue;
    const folded = new Set(
      [name, f[2]!, ...(f[3] ? f[3].split(',') : [])].map(fold).filter(Boolean),
    );
    towns.push({ name, folded, lat: Number(f[4]), lng: Number(f[5]), country: f[8]!, code: f[7]! });
  }
  return towns;
}

/* -------------------------------------------------------- Natural Earth -- */

type Ring = readonly (readonly [number, number])[];

interface Country {
  readonly code: string;
  readonly polygons: readonly {
    readonly box: readonly [number, number, number, number];
    readonly rings: readonly Ring[];
  }[];
}

async function readBorders(): Promise<Country[]> {
  const body = await cached('ne_10m_admin_0_countries.geojson', () =>
    download(
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson',
    ),
  );
  const geo = JSON.parse(body.toString('utf8')) as {
    features: {
      properties: Record<string, string>;
      geometry: { type: string; coordinates: unknown };
    }[];
  };
  const countries: Country[] = [];
  for (const feature of geo.features) {
    const p = feature.properties;
    const code = [p.ISO_A2_EH, p.ISO_A2].find((value) => value && value !== '-99');
    if (!code) continue;
    const polys = (
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates
    ) as [number, number][][][];
    countries.push({
      code,
      polygons: polys.map((rings) => {
        let [w, s, e, n] = [180, 90, -180, -90];
        for (const [x, y] of rings[0]!) {
          w = Math.min(w, x);
          e = Math.max(e, x);
          s = Math.min(s, y);
          n = Math.max(n, y);
        }
        return { box: [w, s, e, n] as const, rings };
      }),
    });
  }
  return countries;
}

function inRing(ring: Ring, lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function countryAt(countries: readonly Country[], lat: number, lng: number): string | null {
  for (const country of countries) {
    for (const { box, rings } of country.polygons) {
      if (lng < box[0] || lat < box[1] || lng > box[2] || lat > box[3]) continue;
      if (inRing(rings[0]!, lng, lat) && !rings.slice(1).some((hole) => inRing(hole, lng, lat))) {
        return country.code;
      }
    }
  }
  return null;
}

/**
 * Territories GeoNames codes on their own and Natural Earth draws inside their
 * sovereign's border (or the other way round). Réunion is `RE` to GeoNames and
 * part of France's multipolygon to Natural Earth; both are right.
 */
// prettier-ignore
const SOVEREIGN: Readonly<Record<string, string>> = {
  GF: 'FR', GP: 'FR', MQ: 'FR', RE: 'FR', YT: 'FR', PM: 'FR', BL: 'FR', MF: 'FR', NC: 'FR',
  PF: 'FR', WF: 'FR', PR: 'US', GU: 'US', VI: 'US', AS: 'US', MP: 'US', UM: 'US', AW: 'NL',
  CW: 'NL', SX: 'NL', BQ: 'NL', GL: 'DK', FO: 'DK', SJ: 'NO', AX: 'FI', CX: 'AU', CC: 'AU',
  NF: 'AU', HK: 'CN', MO: 'CN', GG: 'GB', JE: 'GB', IM: 'GB', GI: 'GB', BM: 'GB', KY: 'GB',
  VG: 'GB', TC: 'GB', MS: 'GB', AI: 'GB', FK: 'GB', SH: 'GB', PN: 'GB', IO: 'GB',
};

const sameCountry = (border: string | null, town: string): boolean =>
  !border || border === town || SOVEREIGN[town] === border || SOVEREIGN[border] === town;

/** "Rolla skatepark" → "rolla": the place a park's own name points at. */
function nameHint(name: string): string {
  return fold(name.replace(/\s*\bskate\s*-?\s*(?:park|parc|plaza|spot|bowl)\b.*$/i, ''));
}

/**
 * The town a park is in: among the populated places near it and inside the
 * same border, the one its own name points at if there is one, otherwise the
 * nearest that is not merely a section of a bigger place, otherwise the
 * nearest at all. The search widens until something is found.
 */
function placePark(
  towns: Grid<Town>,
  border: string | null,
  lat: number,
  lng: number,
  hint: string,
): Town | null {
  for (const [rings, limit] of [
    [1, 30_000],
    [4, 100_000],
    [12, 350_000],
    [40, 1_500_000],
  ] as const) {
    const near = towns
      .near(lat, lng, rings)
      .map((town) => ({ town, d: metres(lat, lng, town.lat, town.lng) }))
      .filter(({ d }) => d <= limit)
      .sort((a, b) => a.d - b.d);
    const inside = near.filter(({ town }) => sameCountry(border, town.country));
    const pool = inside.length ? inside : near;
    if (!pool.length) continue;
    const named = hint ? pool.find(({ town }) => town.folded.has(hint)) : undefined;
    const whole = pool.find(({ town }) => town.code !== 'PPLX');
    return (named ?? whole ?? pool[0])!.town;
  }
  return null;
}

/* ----------------------------------------------------------------- run -- */

console.log('Reading Trucks and Fins…');
const parks = await readTrucksAndFins(TNF_DIR);
console.log(`  ${parks.length} parks`);

console.log('Reading OpenStreetMap (cached bands, or Overpass)…');
const places = await readOpenStreetMap();
console.log(`  ${places.length} skateboarding objects`);

const matched = match(parks, places);
console.log(`  ${matched.size} parks matched within ${MATCH_METRES} m`);

console.log('Reading GeoNames and Natural Earth…');
const towns = new Grid(0.25, await readTowns());
const borders = await readBorders();

const rows: WorldSourceRow[] = [];
let unplaced = 0;
for (const park of parks) {
  const osm = matched.get(park.id);
  const lat = osm?.lat ?? park.lat;
  const lng = osm?.lng ?? park.lng;
  const border = countryAt(borders, lat, lng);
  const town = placePark(towns, border, lat, lng, nameHint(park.name));
  if (!town) {
    unplaced += 1;
    continue;
  }
  const country = sameCountry(border, town.country) ? town.country : (border ?? town.country);
  const tags = osm?.tags ?? {};
  rows.push([
    park.id,
    osm?.ref ?? '',
    round6(lat),
    round6(lng),
    osmName(tags),
    park.name,
    park.flags,
    osm ? osmBits(tags) : 0,
    osmAddress(tags),
    osmPhone(tags),
    town.name,
    country,
  ]);
}

const today = new Date().toISOString().slice(0, 10);
const byCountry = new Map<string, number>();
for (const row of rows) byCountry.set(row[11], (byCountry.get(row[11]) ?? 0) + 1);

const header = `/**
 * GENERATED by \`pnpm --filter @landit/db import:world\` on ${today} — do not edit.
 *
 * ${rows.length} skateparks: the places on Trucks and Fins' map, ${matched.size} of them
 * matched to an OpenStreetMap object within ${MATCH_METRES} metres (point, name, address and
 * tags from OpenStreetMap, Open Database Licence) and the rest on Trucks and Fins'
 * point and name. From Trucks and Fins: points, names and filter flags only — no
 * prose. Towns from GeoNames (CC BY 4.0); countries checked against Natural Earth
 * (public domain). ${unplaced} parks could not be placed and were dropped.
 * Field order is \`WorldSourceRow\` in \`./world-source.ts\`.
 */
import type { WorldSourceRow } from './world-source';

/** The day this snapshot was taken, for the credit line under the spots map. */
export const WORLD_SNAPSHOT_DATE = '${today}';

// prettier-ignore
export const WORLD_SOURCE_ROWS: readonly WorldSourceRow[] = [
`;

await writeFile(OUT, `${header}${rows.map((row) => `  ${JSON.stringify(row)},`).join('\n')}\n];\n`);

console.log(`Wrote ${rows.length} rows to ${path.relative(process.cwd(), OUT)}`);
console.log(`  matched to OpenStreetMap: ${matched.size}; unplaced: ${unplaced}`);
console.log(
  `  countries: ${[...byCountry]
    .sort((a, b) => b[1] - a[1])
    .map(([code, n]) => `${code} ${n}`)
    .join(', ')}`,
);
