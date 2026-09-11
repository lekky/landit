import type { CategoryId } from '../types';

/**
 * What each thing on a spot's tag list actually **is**, in plain words.
 *
 * **This exists because a spot record is about twenty-five words long.** A name,
 * a town, a type, a coordinate pair and a handful of tags — and ninety-odd
 * near-identical pages built from that much data is the doorway pattern search
 * engines exist to demote, quite reasonably, because it is ninety-odd pages
 * that tell a reader nothing. The answer is not more words about each spot: we
 * do not have any, and inventing them is the one thing the spot research was
 * told never to do (`SPOTS` in `./spots.ts`). The answer is to say what the
 * tags *mean*. "Bowl · Ledges · Rails" is a filter facet; "curved concrete you
 * carry speed around, with no flat bottom to land on" is something a
 * twelve-year-old who has never been to a park can use.
 *
 * **One explanation per feature type, not per spot** (the design handoff's open
 * question 4, answered here). Every ledge in the product gets the same
 * sentence, which is the honest position: we know what a ledge is, and we know
 * nothing about *that* ledge beyond the tag. Writing it once also means it can
 * be corrected once — and it means the explanation cannot drift into a claim
 * about a particular place, which is how this kind of copy usually goes wrong.
 *
 * **`tricks` points at a library filter, and only where that is true.** There is
 * no feature-to-trick relation in this product and this file does not invent
 * one: it maps a feature to the category the library already sorts tricks
 * into, so "Bowl tricks" opens the park category rather than a list somebody
 * curated. Where no category is honestly the answer — a pump track is for
 * pumping, moguls are not a trick surface — it is `null` and the page shows no
 * link rather than a wrong one.
 *
 * Tags are staff-written on the researched spots and are drawn from a short
 * list on the submission form, so this table covers the vocabulary that is
 * actually in the data. A tag with no entry here is still shown on the page as
 * a feature; it simply has no explanation to give, which is the honest failure
 * direction and is far better than guessing at what a word means.
 */

/**
 * The design system's colour names, as used for a feature's 9px bar.
 *
 * A name rather than a hex value, because the tokens are the design system's to
 * define (`packages/ui-web/src/styles/tokens.css`) and this package must not
 * hold a second copy of them that can drift.
 */
export type SpotFeatureAccent =
  'yellow' | 'sky' | 'pink' | 'lime' | 'violet' | 'orange' | 'green' | 'blue';

export interface SpotFeature {
  /** The tag, normalised: lowercase, single spaces. The lookup key. */
  readonly id: string;
  /** How it is written on the page. */
  readonly label: string;
  /**
   * The same thing as a noun phrase, for prose: "a bowl", "flat ground".
   *
   * The page's opening sentence lists what a spot has — "a concrete park in
   * Ventnor with a bowl, ledges and a mini ramp" — and a label dropped
   * straight into that reads as "with bowl and flat". English needs the
   * article and sometimes a second word, and which one is a fact about the
   * feature rather than about the sentence, so it belongs here beside the
   * label rather than in a rule at the call site.
   */
  readonly phrase: string;
  /** What the thing is, to somebody who has never seen one. */
  readonly about: string;
  /** The colour of the bar above the name. */
  readonly accent: SpotFeatureAccent;
  /**
   * The library category whose tricks belong on this feature, or `null` where
   * no category is honestly the answer.
   */
  readonly tricks: CategoryId | null;
}

/** A tag as written, reduced to the form {@link SPOT_FEATURES} is keyed by. */
export function spotFeatureId(tag: string): string {
  return String(tag ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const FEATURES = [
  /*
   * The seven the design names, with its copy kept word for word — it was
   * written against the screenshots and it is the right register: short,
   * concrete, no jargon a rider would have to already know.
   */
  {
    id: 'bowl',
    label: 'Bowl',
    phrase: 'a bowl',
    about: 'Curved concrete you carry speed around. Transitions, no flat bottom to land on.',
    accent: 'yellow',
    tricks: 'park',
  },
  {
    id: 'ledges',
    label: 'Ledges',
    phrase: 'ledges',
    about: 'Low straight edges for grinds and slides. The first place most riders learn a 50-50.',
    accent: 'sky',
    tricks: 'street',
  },
  {
    id: 'rails',
    label: 'Rails',
    phrase: 'rails',
    about: 'Round bar, usually flat and low here. Grinds and stalls.',
    accent: 'pink',
    tricks: 'street',
  },
  {
    id: 'banks',
    label: 'Banks',
    phrase: 'banks',
    about: 'Straight slopes rather than curves. Good for airs and first drops.',
    accent: 'lime',
    tricks: 'park',
  },
  {
    id: 'mini',
    label: 'Mini',
    phrase: 'a mini ramp',
    about: 'Small ramp with coping both sides. Where most air tricks start.',
    accent: 'violet',
    tricks: 'park',
  },
  /*
   * Halfpipe and DIY arrived with the world import (2026-09-11): two of the
   * map filters it reads are features the catalogue had no sentence for.
   */
  {
    id: 'halfpipe',
    label: 'Halfpipe',
    phrase: 'a halfpipe',
    about:
      'Two quarter pipes facing each other across a flat bottom, bigger than a mini. You carry speed from one wall to the other.',
    accent: 'sky',
    tricks: 'park',
  },
  {
    id: 'flat',
    label: 'Flat',
    phrase: 'flat ground',
    about:
      'Smooth open ground. Flat tricks, manuals, whips — and space to try them without queueing.',
    accent: 'lime',
    tricks: 'flat',
  },
  {
    /*
     * `park` rather than `air`, and the choice is worth writing down. The `air`
     * category is "flips and inverts" — a property of a trick, landed on every
     * surface in this list — while `park` is "ramps, boxes and airtime", and a
     * vert ramp is the largest ramp there is. Sending a rider who tapped a vert
     * wall to the flips is the more exciting answer and the less true one.
     */
    id: 'vert',
    label: 'Vert',
    phrase: 'a vert wall',
    about:
      'A ramp tall enough to go vertical at the top. Drop in, pump the transition, come out above the coping.',
    accent: 'orange',
    tricks: 'park',
  },

  /* ---------------------------------------------------------- the rest -- */
  /*
   * Everything else the researched spots are actually tagged with. The design
   * only had to specify the seven its two example listings used; a real page
   * for a real park has to say something about "Spine" and "Foam pit" too, or
   * the grid that is the whole point of the page comes out half empty.
   */
  {
    id: 'street',
    label: 'Street',
    phrase: 'a street section',
    about:
      'A section built to look like a road: kerbs, steps, banks and rails, without the traffic.',
    accent: 'orange',
    tricks: 'street',
  },
  {
    id: 'street course',
    label: 'Street course',
    phrase: 'a street course',
    about:
      'A whole area laid out as street furniture, usually the part a competition is judged on.',
    accent: 'orange',
    tricks: 'street',
  },
  {
    id: 'plaza',
    label: 'Plaza',
    phrase: 'a plaza',
    about: 'Open ground with kerbs, blocks and steps around it, built to be ridden like a square.',
    accent: 'orange',
    tricks: 'street',
  },
  {
    id: 'stairs',
    label: 'Stairs',
    phrase: 'stairs',
    about: 'A set of steps with something to ride at the top and a flat run-out at the bottom.',
    accent: 'pink',
    tricks: 'street',
  },
  {
    id: 'hubba',
    label: 'Hubba',
    phrase: 'a hubba',
    about: 'A ledge running down beside a set of stairs. A grind that drops as you hold it.',
    accent: 'sky',
    tricks: 'street',
  },
  {
    id: 'funbox',
    label: 'Funbox',
    phrase: 'a funbox',
    about: 'A raised box with a slope on each side, usually a rail or a ledge across the top.',
    accent: 'yellow',
    tricks: 'street',
  },
  {
    id: 'box jump',
    label: 'Box jump',
    phrase: 'a box jump',
    about: 'A take-off ramp facing a landing ramp with a gap between them. Airtime on purpose.',
    accent: 'yellow',
    tricks: 'park',
  },
  {
    id: 'jump box',
    label: 'Jump box',
    phrase: 'a jump box',
    about: 'A take-off ramp facing a landing ramp with a gap between them. Airtime on purpose.',
    accent: 'yellow',
    tricks: 'park',
  },
  {
    id: 'spine',
    label: 'Spine',
    phrase: 'a spine',
    about: 'Two ramps back to back sharing one piece of coping. You cross it rather than turn.',
    accent: 'violet',
    tricks: 'park',
  },
  {
    id: 'quarter pipes',
    label: 'Quarter pipes',
    phrase: 'quarter pipes',
    about: 'Single curved walls with coping on top. The building block every park is made of.',
    accent: 'violet',
    tricks: 'park',
  },
  {
    id: 'micro ramp',
    label: 'Micro ramp',
    phrase: 'a micro ramp',
    about: 'A mini ramp scaled down — low walls, quick back and forth. Where a first air fits.',
    accent: 'violet',
    tricks: 'park',
  },
  {
    id: 'indoor ramps',
    label: 'Indoor ramps',
    phrase: 'indoor ramps',
    about: 'Wooden ramps under a roof. It rides the same in February as it does in July.',
    accent: 'violet',
    tricks: 'park',
  },
  {
    id: 'ramps',
    label: 'Ramps',
    phrase: 'ramps',
    about: 'Built transitions rather than poured concrete — usually plywood, usually indoors.',
    accent: 'violet',
    tricks: 'park',
  },
  {
    id: 'snake run',
    label: 'Snake run',
    phrase: 'a snake run',
    about: 'A long curving channel you pump down, walls on both sides. Speed without pedalling.',
    accent: 'yellow',
    tricks: 'park',
  },
  {
    id: 'pool',
    label: 'Pool',
    phrase: 'a pool',
    about: 'A bowl shaped like a swimming pool, with tiles and a deep end. Steep and unforgiving.',
    accent: 'yellow',
    tricks: 'park',
  },
  {
    id: 'peanut bowl',
    label: 'Peanut bowl',
    phrase: 'a peanut bowl',
    about: 'Two round bowls joined in the middle, so you can carry a line from one into the other.',
    accent: 'yellow',
    tricks: 'park',
  },
  {
    id: 'full pipe',
    label: 'Full pipe',
    phrase: 'a full pipe',
    about:
      'A complete circle of transition. The wall keeps going past vertical and over your head.',
    accent: 'yellow',
    tricks: 'park',
  },
  {
    id: 'rhythm section',
    label: 'Rhythm section',
    phrase: 'a rhythm section',
    about: 'A run of jumps and rollers set out so one landing sets up the next take-off.',
    accent: 'lime',
    tricks: 'park',
  },
  {
    /*
     * `air`, and this one earns it: a resi is a landing ramp surfaced so a
     * failed flip hurts less, and it exists for exactly the category the
     * library calls "flips and inverts, big consequences".
     */
    id: 'resi',
    label: 'Resi',
    phrase: 'a resi landing',
    about:
      'A landing ramp with a soft surface, built so trying a flip costs less when it goes wrong.',
    accent: 'green',
    tricks: 'air',
  },
  {
    id: 'foam pit',
    label: 'Foam pit',
    phrase: 'a foam pit',
    about: 'A pit of foam blocks to land in. Where a trick gets tried before it gets landed.',
    accent: 'green',
    tricks: 'air',
  },

  /*
   * No link on these three, deliberately. A pump track is ridden by pumping
   * rather than by landing tricks, moguls are a surface to get across, and a
   * bike run is a route rather than an obstacle — no category in the library is
   * the honest answer for any of them, so the cell explains the thing and stops
   * there.
   */
  {
    id: 'pump track',
    label: 'Pump track',
    phrase: 'a pump track',
    about:
      'A loop of rollers and bermed corners. You keep speed by pushing into them, never pedalling.',
    accent: 'lime',
    tricks: null,
  },
  {
    id: 'moguls',
    label: 'Moguls',
    phrase: 'moguls',
    about: 'A field of small bumps. Something to cross and carry speed over rather than to hit.',
    accent: 'lime',
    tricks: null,
  },
  {
    id: 'bike run',
    label: 'Bike run',
    phrase: 'a bike run',
    about: 'A dirt or gravel line built for bikes, ridden as a route from top to bottom.',
    accent: 'green',
    tricks: null,
  },
  {
    id: 'diy',
    label: 'DIY',
    phrase: 'rider-built concrete',
    about:
      'Concrete riders poured themselves, often under a bridge or on spare ground. Rough, always changing, and sometimes gone next time.',
    accent: 'green',
    tricks: 'park',
  },
] as const satisfies readonly SpotFeature[];

/** Every explained feature, keyed by {@link spotFeatureId}. */
export const SPOT_FEATURES: Readonly<Record<string, SpotFeature>> = Object.freeze(
  Object.fromEntries(FEATURES.map((feature) => [feature.id, feature])),
);

/** The explained features in the order they are written above. */
export const SPOT_FEATURE_LIST: readonly SpotFeature[] = FEATURES;

/**
 * The explanation for a tag, or `null` when there is none.
 *
 * Returning `null` rather than a placeholder is the point: the caller then
 * decides whether to show the feature bare, and nothing here ever invents a
 * sentence about a word it does not recognise.
 */
export function spotFeature(tag: string): SpotFeature | null {
  return SPOT_FEATURES[spotFeatureId(tag)] ?? null;
}
