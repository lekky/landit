import {
  AWARDS,
  LANDED_STAGES,
  STAGE,
  STAGES,
  TRICKS,
  type StageId,
  type Sticker,
} from '@landit/core';

/*
 * `AWARDS` is a `const` tuple of 135 differently-shaped literals, so TypeScript
 * only offers the fields every one of them has — `kind` and `trick` are not
 * among them. Widening to the interface they all satisfy is what makes the two
 * optional fields readable; it costs nothing, because `data.test.ts` already
 * asserts the shape.
 */
const STICKERS: readonly Sticker[] = AWARDS;

/**
 * The "one rider, one season" grid on the landing page.
 *
 * **This is sample data, and the page says so.** The design pack asks for
 * "a real rider's tracked tricks with real stages", and offers two ways to be
 * honest about it: a real opted-in rider, or something clearly labelled. The
 * owner picked the label (2026-09-04, in chat), and the reasons hold up on
 * their own — a real rider's grid needs their consent on the record, drifts
 * every time they log something, and puts a database read on the one page that
 * has no session and wants to be fast.
 *
 * What is real is everything underneath. The names come from `TRICKS`, the
 * stage colours and labels from `STAGES`, and the badge on a tile is the award
 * that trick actually grants, looked up in `AWARDS` by trick id. So the grid is
 * a truthful picture of what a season looks like even though no single rider
 * rode it: rename a trick, restage it, or retire its award, and this follows.
 * Nothing here is a hand-picked icon, which is the thing the pack was most
 * insistent about.
 *
 * The ids below are the only hand-written part, and `landingSeason.test.ts`
 * fails if any of them stops existing.
 */

/** A landed trick and how solid it is. Ordered by stage, best first, by `seasonGrid`. */
const LANDED: readonly { trick: string; stage: StageId }[] = [
  { trick: 'bunny-hop', stage: 'every' },
  { trick: 'sk-ollie', stage: 'every' },
  { trick: '180', stage: 'every' },
  { trick: 'sk-drop-in', stage: 'every' },
  { trick: 'x-up', stage: 'every' },
  { trick: 'sk-fakie-ollie', stage: 'every' },
  { trick: 'manual', stage: 'most' },
  { trick: 'bar-spin', stage: 'most' },
  { trick: 'sk-shuvit', stage: 'most' },
  { trick: 'fingerwhip', stage: 'most' },
  { trick: 'bmx-air', stage: 'most' },
  { trick: 'tailwhip', stage: 'some' },
  { trick: 'sk-50-50', stage: 'some' },
  { trick: 'sk-rock-to-fakie', stage: 'some' },
  { trick: 'bmx-tabletop', stage: 'some' },
  { trick: 'sk-nose-manual', stage: 'trying' },
];

/**
 * The dashed tiles. The point of them is that a wall is never finished, so
 * these are deliberately the loud ones a rider would want next — not filler.
 */
const NOT_TRACKED: readonly string[] = [
  'bri-flip',
  'double-whip',
  'sk-tre-flip',
  'flair',
  'smith',
  'backflip',
  'bmx-turndown',
  'sk-blunt-fakie',
  'sk-hardflip',
  'bmx-truckdriver',
  'bmx-360',
  'feeble',
];

export type SeasonBadge = {
  /** The award's own name, for the alt text. */
  readonly name: string;
  /** The file under `/stickers/`, or undefined for a record with no art. */
  readonly img: string | undefined;
};

export type SeasonTile = {
  readonly id: string;
  readonly name: string;
  /** Null on a dashed, not-tracked tile. */
  readonly stage: { readonly label: string; readonly color: string } | null;
  /** The award this trick grants, when it has a live one. */
  readonly badge: SeasonBadge | null;
};

function trickName(id: string): string {
  const trick = TRICKS.find((t) => t.id === id);
  // Canonical data is in the same repo, so a miss is a rename that needs
  // following up here rather than a runtime condition to paper over. Same
  // reasoning the old landing page's `sampleTrick` used.
  if (!trick) throw new Error(`Landing season references unknown trick "${id}"`);
  return trick.name;
}

/**
 * The award a trick grants, or null.
 *
 * `kind === 'trick'` is the whole filter: a milestone or a streak award is
 * earned by riding, not by landing this one trick, so it has no business
 * hanging off this tile. `isLive` keeps a retired award off the page (#246 is
 * the other half of that story — riders who hold one can still see it).
 *
 * **A trick at `trying` earns nothing.** `LANDED_STAGES` is the product's one
 * scoring rule — landed means `some` or above — and a badge on a tile that says
 * "Learning" would show a stranger a thing the app does not do. Caught by
 * `landingSeason.test.ts` rather than noticed, which is the argument for the
 * test: the badge lookup and the stage were two independent facts on the tile
 * until this made them one.
 */
function trickBadge(id: string, stage: StageId): SeasonBadge | null {
  if (!(LANDED_STAGES as readonly StageId[]).includes(stage)) return null;
  const award = STICKERS.find((a) => a.kind === 'trick' && a.trick === id && a.isLive);
  return award ? { name: award.name, img: award.img } : null;
}

/** Best stage first, so the four rows the pack asks for lead the grid. */
const stageRank = (id: StageId): number => STAGES.findIndex((s) => s.id === id);

/**
 * The grid, landed tiles first in stage order, then the dashed ones.
 *
 * Pure and module-level: it reads only canonical data, so the page stays a
 * static render and this can be unit-tested without a browser.
 */
export function seasonGrid(): readonly SeasonTile[] {
  const landed = [...LANDED]
    .sort((a, b) => stageRank(b.stage) - stageRank(a.stage))
    .map(({ trick, stage }) => ({
      id: trick,
      name: trickName(trick),
      stage: { label: STAGE[stage].short, color: STAGE[stage].color },
      badge: trickBadge(trick, stage),
    }));

  const untracked = NOT_TRACKED.map((id) => ({
    id,
    name: trickName(id),
    stage: null,
    badge: null,
  }));

  return [...landed, ...untracked];
}

/**
 * The legend under the grid: the four stages that appear, plus the dashed one.
 *
 * Derived from the tiles rather than typed out again, so a stage that leaves
 * `LANDED` leaves the legend with it. `want` is not in either — a wall shows
 * what you have done and what you have not, and "want to learn" is neither.
 */
export function seasonLegend(): readonly { label: string; color: string | null }[] {
  const shown = new Set(LANDED.map((l) => l.stage));
  return [
    ...STAGES.filter((s) => shown.has(s.id))
      .sort((a, b) => stageRank(b.id) - stageRank(a.id))
      .map((s) => ({ label: s.short, color: s.color })),
    { label: 'Not tracked yet', color: null },
  ];
}
