/**
 * The curation worksheet — a running order for the 259-trick tutorial pass (#462).
 *
 * T34 shipped the "Watch it" panel with the catalogue **empty**: the three
 * `video_*` columns are database-only and the seed never writes them, so every
 * trick page still shows no panel until a person has watched a video and typed
 * it into `/admin` → Tricks → Edit. That pass is ten to fifteen hours of
 * somebody's time, and this file exists to take the "what next, and in what
 * order" overhead out of it.
 *
 * **Nothing here picks a video, and nothing here can.** It emits a spreadsheet
 * of tricks and pre-built YouTube *search* links; a human opens each one,
 * watches, and decides. That act is the approval and it is the whole safety
 * model — the coverage measurement behind T34 found that an automatic
 * top-result pick would have put pole vaulting and pole dancing on Pole Tap and
 * moped kick-starting on Kickturn. On a product for children that settles it.
 * There is deliberately no search API call and no automatic fill anywhere in
 * this repo, and adding one here would be the wrong place twice over.
 *
 * This lives in `@landit/db` rather than `@landit/core` because it is staff
 * tooling, like `./imports`, and riders should not carry it in a bundle. It is
 * deliberately **not** exported from `./index`: the script is the only caller.
 */
import { CATS, isTrickFree, SPORT_IDS, TRICKS, type SportId, type Trick } from '@landit/core';

/**
 * What to put in a search box so YouTube understands which sport is meant.
 *
 * "Skate" alone is ambiguous with ice and roller; "BMX" is unambiguous already.
 * These do not rescue the hard cases — the T34 measurement found "Pole Tap" and
 * "Kickturn" still miss with "pro scooter" and "scootering" added, because the
 * problem is that our word is not the riders' word rather than a missing
 * qualifier — but they clear the easy ambiguity, which is most of it.
 */
const SPORT_TERM: Record<SportId, string> = {
  scooter: 'pro scooter',
  skate: 'skateboard',
  bmx: 'BMX',
};

/**
 * Channels worth trying first, from #462. Not an allowlist the code enforces —
 * a curator may pick any video they have watched — just the ones whose hit rate
 * was high enough to be worth a second, narrower search before giving up.
 */
export const CURATION_CHANNELS: Record<SportId, readonly string[]> = {
  scooter: ['Scooter Hut', 'Alli Sports'],
  skate: ['Braille Skateboarding', 'skatedeluxe'],
  bmx: ['TransWorld RideBMX', 'Alli Sports'],
};

/**
 * How likely a tutorial is to exist at all, from T34's stratified sample of 21
 * tricks: skate 7 of 7, BMX 5 of 6, scooter 2 of 7 clean with 3 having nothing.
 *
 * It is a hint, not a verdict on any individual trick. It is here so a curator
 * knows when *not* to spend another ten minutes: roughly 40 scooter tricks have
 * no tutorial anywhere, and the owner's decision (#464) is that those show no
 * panel and that is fine.
 */
const OUTLOOK: Record<SportId, 'high' | 'low'> = {
  scooter: 'low',
  skate: 'high',
  bmx: 'high',
};

/** One line of the worksheet: a trick, in the order it should be worked. */
export interface CurationRow {
  /** 1-based position in the running order, so a re-sorted sheet can be restored. */
  readonly order: number;
  /** `free` tricks come first — they are the pages signed-out visitors and search engines land on. */
  readonly tier: 'free' | 'paid';
  readonly sport: SportId;
  readonly difficulty: number;
  readonly category: string;
  readonly trick: string;
  /** The trick id, which is what identifies it in `/admin` → Tricks. */
  readonly slug: string;
  readonly outlook: 'high' | 'low';
  /** A ready-made YouTube search: the trick, its sport and "tutorial". */
  readonly search: string;
  /** The same search narrowed to the channels in {@link CURATION_CHANNELS}. */
  readonly searchChannels: string;
}

/** A YouTube results page for a query. A search link, never a video link. */
export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/**
 * The 259 tricks in the order the pass should work them.
 *
 * **Free first** — the only ordering rule the owner gave (#462), because those
 * 60 are what a signed-out visitor and a search engine land on, and the panel
 * renders signed out. Within that: canonical sport order, then difficulty, then
 * name, so the sheet is stable across runs and two curators comparing progress
 * see the same row numbers.
 */
export function curationRows(tricks: readonly Trick[] = TRICKS): readonly CurationRow[] {
  const sportOrder = new Map(SPORT_IDS.map((sport, index) => [sport, index]));

  const sorted = [...tricks].sort((a, b) => {
    const tier = Number(isTrickFree(b)) - Number(isTrickFree(a));
    if (tier !== 0) return tier;

    const sport = (sportOrder.get(a.sport) ?? 0) - (sportOrder.get(b.sport) ?? 0);
    if (sport !== 0) return sport;

    if (a.diff !== b.diff) return a.diff - b.diff;
    return a.name.localeCompare(b.name, 'en');
  });

  return sorted.map((trick, index) => {
    const term = SPORT_TERM[trick.sport];
    const channels = CURATION_CHANNELS[trick.sport].join(' OR ');

    return {
      order: index + 1,
      tier: isTrickFree(trick) ? 'free' : 'paid',
      sport: trick.sport,
      difficulty: trick.diff,
      category: CATS[trick.cat].label,
      trick: trick.name,
      slug: trick.id,
      outlook: OUTLOOK[trick.sport],
      search: youtubeSearchUrl(`${trick.name} ${term} tutorial`),
      searchChannels: youtubeSearchUrl(`${trick.name} ${term} tutorial ${channels}`),
    };
  });
}

/**
 * The columns, in order. The last four are left **empty on purpose**: a curator
 * fills them in while watching, and `tutorial_link`, `tutorial_title` and
 * `tutorial_channel` are named to match the three fields in `/admin` → Tricks →
 * Edit exactly, so transcribing a finished sheet is mechanical.
 */
const COLUMNS = [
  'order',
  'done',
  'tier',
  'sport',
  'difficulty',
  'category',
  'trick',
  'slug',
  'outlook',
  'search',
  'search_channels',
  'tutorial_link',
  'tutorial_title',
  'tutorial_channel',
  'notes',
] as const;

/**
 * RFC 4180 quoting: a field is wrapped only when it holds a comma, a quote or a
 * newline, and an embedded quote is doubled. Trick names carry apostrophes
 * ("Rock 'n' Roll") which need nothing, but the notes column is free text a
 * person types, so this has to be right rather than nearly right.
 */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** The worksheet as CSV, ready to open in a spreadsheet and work down. */
export function curationWorksheetCsv(rows: readonly CurationRow[] = curationRows()): string {
  const lines = [COLUMNS.join(',')];

  for (const row of rows) {
    lines.push(
      [
        String(row.order),
        '', // done
        row.tier,
        row.sport,
        String(row.difficulty),
        row.category,
        row.trick,
        row.slug,
        row.outlook,
        row.search,
        row.searchChannels,
        '', // tutorial_link
        '', // tutorial_title
        '', // tutorial_channel
        '', // notes
      ]
        .map(csvField)
        .join(','),
    );
  }

  return `${lines.join('\n')}\n`;
}
