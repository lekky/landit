import type { SportId } from '../types';
import type { TrickId } from './tricks';

/**
 * The glossary: 84 words riders use, in the order the page lists them.
 *
 * Researched on 2026-09-07 from the product's own copy — every `about`, `tips`
 * and `fact` in `./tricks.ts` was read for the words it uses without
 * explaining — and each definition was then checked against a published
 * glossary before it shipped. The sources, so a later session can check a
 * definition rather than trust it:
 *
 *  - https://en.wikipedia.org/wiki/Freestyle_scootering
 *  - https://en.wikipedia.org/wiki/Frontside_and_backside
 *  - https://en.wikipedia.org/wiki/Half-pipe
 *  - https://en.wikipedia.org/wiki/Nollie
 *  - https://forum.scooterresource.com/threads/trick-dictionary.4917/
 *  - https://thebmxdude.com/bmx-glossary/
 *  - https://www.danscomp.com/glossary-of-bmx-terms/cp502
 *  - https://www.justrampsskatepark.co.uk/pages/foam-pit-resi-ramp
 *  - https://www.redbull.com/us-en/skateboarding-glossary
 *  - https://www.strayrocket.com/skatepark-terminology/
 *  - https://www.surfertoday.com/skateboarding/the-definitive-guide-to-skateboard-obstacles-and-elements
 *  - https://www.surfertoday.com/skateboarding/the-glossary-of-skateboarding-terms-and-slang
 *  - https://www.the-house.com/portal/bmx-slang-for-newbies/
 *
 * What the research is worth, honestly: a definition is a paraphrase written
 * for a twelve year old, not a quotation, and where sports disagree about a
 * word (`deck` most of all) the definition says so rather than picking one.
 * `sports` is which sports *use* the word, not which sports it originated in.
 * `seeIn` names live tricks whose copy carries the word, and every id in it is
 * checked against the library by `glossary.test.ts`.
 *
 * **What the aliases are for.** `glossaryMatches` in `../rules/glossary.ts` links
 * the first occurrence of a term or an alias in a piece of copy. So an alias is
 * a claim that a word in a trick's copy *means this term*, which is a stronger
 * claim than a synonym: a word with a second, ordinary sense is left out or
 * excluded rather than linked wrongly (see `except`, and the notes on Hip and
 * Trucks below).
 *
 * Sorted A–Z by `term` and the sort is asserted, so the page can group by
 * letter without sorting and a term added out of order fails a test rather
 * than landing under the wrong letter.
 */
export interface GlossaryTerm {
  /** The word as the page shows it: "Kerb", "Front foot / back foot". */
  readonly term: string;
  /** The anchor on `/glossary` and the key analytics carries. Unique. */
  readonly slug: string;
  /**
   * Other spellings and forms that mean this term, matched whole-word and
   * case-insensitively alongside `term` itself.
   */
  readonly aliases: readonly string[];
  /** Which sports use the word. Every term has at least one. */
  readonly sports: readonly SportId[];
  readonly definition: string;
  /** Tricks whose copy uses the word — the page's "See it in" links. */
  readonly seeIn: readonly TrickId[];
  /**
   * Phrases that contain the term or an alias but mean something else, so a
   * whole-word match inside one of them is never linked: "truck driver" holds
   * "truck" and is a trick, not a skateboard part.
   */
  readonly except?: readonly string[];
}

export const GLOSSARY: readonly GlossaryTerm[] = [
  {
    term: 'Air',
    slug: 'air',
    aliases: ['airs', 'air out'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Leaving a ramp with both wheels off the ground, usually above the coping, then landing back in it. Almost every park trick is an air with something added.',
    seeIn: ['bmx-air', 'quarter-pipe-air', 'sk-backside-air', 'sk-frontside-air'],
  },
  {
    term: 'Backside',
    slug: 'backside',
    aliases: ['bs'],
    sports: ['scooter', 'skate'],
    definition:
      'One of the two ways to turn or approach an obstacle. Backside means your back faces the obstacle, or you spin so your back leads. The other way is frontside.',
    seeIn: ['180', 'sk-bs-180', 'sk-backside-air', 'sk-backside-flip'],
  },
  {
    term: 'Bail',
    slug: 'bail',
    aliases: ['bailing', 'bail out'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Jumping off or stepping away from the board, scooter or bike before a trick goes wrong. Bailing on purpose is a skill: it is how you avoid a proper crash.',
    seeIn: ['nose-manual', 'sk-lipslide', 'bmx-nose-manual', 'lipslide'],
  },
  {
    term: 'Bank',
    slug: 'bank',
    aliases: ['banks', 'wedge'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'A straight slope up from flat ground, rather than a curve. Easier than a ramp for first airs, drops and 180s. A wedge is a small, short bank.',
    seeIn: ['bank-transfer', 'sk-fakie-roll', 'bmx-truckdriver', 'fakie'],
  },
  {
    term: 'Bars',
    slug: 'bars',
    // Not `grips`: "going too slow is why it grips" is a wheel catching.
    aliases: ['handlebars', 'bar trick'],
    sports: ['scooter', 'bmx'],
    definition:
      'Short for handlebars, on a scooter or a BMX. Bar tricks like bar spins and X-ups turn them while you ride. The grips are the rubber parts you hold.',
    seeIn: ['bar-spin', 'x-up', 'bmx-hop-barspin', 'bmx-x-up'],
  },
  {
    term: 'Bolts',
    slug: 'bolts',
    aliases: ['land on the bolts'],
    sports: ['skate'],
    definition:
      'The bolts holding the trucks to a skateboard deck. Landing on the bolts means putting your feet directly over them, where the board is strongest and snaps least.',
    seeIn: ['sk-heelflip', 'sk-hippie-jump', 'sk-body-varial', 'sk-caveman'],
  },
  {
    term: 'Bowl',
    slug: 'bowl',
    aliases: ['pool'],
    sports: ['scooter', 'skate'],
    definition:
      'A dip of curved concrete with coping round the top, like an empty swimming pool. You carve round it carrying speed, with no flat bottom to stop on.',
    seeIn: ['kickturn', 'sk-ollie', 'sk-axle-stall', 'sk-hip-transfer'],
  },
  {
    term: 'Brake',
    slug: 'brake',
    aliases: ['back brake', 'front brake', 'brakeless', 'cover the brake'],
    sports: ['bmx'],
    definition:
      'BMX bikes usually have a back brake, and some a front one. Covering it means keeping a finger on the lever ready. A bike with none fitted is brakeless.',
    seeIn: ['bmx-tyre-tap', 'bmx-wheelie', 'bmx-endo', 'bmx-abubaca'],
  },
  {
    term: 'Bunny hop',
    slug: 'bunny-hop',
    aliases: ['hop', 'bunnyhop'],
    sports: ['scooter', 'bmx'],
    definition:
      'Jumping both wheels off the ground at once with nothing to push off. On a scooter you pull the bars up; on a BMX the front lifts, then the back. The start of nearly everything.',
    seeIn: ['bunny-hop', 'bmx-bunny-hop', 'bmx-hop-barspin', 'bmx-360'],
  },
  {
    term: 'Carve',
    slug: 'carve',
    aliases: ['carving'],
    sports: ['skate', 'bmx'],
    definition:
      'Turning in a long curve while you roll, leaning the whole way round instead of pivoting. It is how you get round a bowl and up a ramp at an angle.',
    seeIn: ['sk-slash-grind', 'bmx-360', 'bmx-ramp-manual', 'bmx-disaster'],
  },
  {
    term: 'Case',
    slug: 'case',
    aliases: ['casing'],
    sports: ['scooter'],
    definition:
      'Coming up short on a jump or gap, so your back wheel hits the edge of the landing instead of clearing it. Usually caused by slowing down on the run-up.',
    seeIn: ['gap'],
  },
  {
    term: 'Catch',
    slug: 'catch',
    aliases: ['catching', 'catch it'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Getting your feet, or hands, back on the deck or bars after they have spun or flipped, so you land in control. Most tricks live or die on the catch.',
    seeIn: ['x-up', 'sk-kickflip', 'bmx-pull-up-barspin', 'bar-spin'],
  },
  {
    term: 'Coping',
    slug: 'coping',
    // The research gave `lip` to Coping as well as to Lip, and one phrase can
    // only mean one term (`glossary.test.ts`). Lip keeps it: its own definition
    // says "the very top edge of a ramp", which is the sense copy uses.
    aliases: [],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'The round metal or concrete edge along the top of a ramp or bowl. Grinds, stalls and drop-ins all happen on it, and an air leaves from it.',
    seeIn: ['quarter-pipe-air', 'sk-tail-stall', 'bmx-peg-stall', 'rock-n-roll'],
  },
  {
    term: 'Cranks',
    slug: 'cranks',
    aliases: ['crank', 'sprocket', 'pedals'],
    sports: ['bmx'],
    definition:
      'The arms the pedals bolt to on a BMX. They turn the sprocket, the toothed ring that drives the chain. A crankflip spins them backwards in the air.',
    seeIn: ['bmx-crankflip', 'bmx-pedal-grind'],
  },
  {
    term: 'Deck',
    slug: 'deck',
    aliases: ['scooter deck', 'skate deck', 'ramp deck'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'It depends on the sport. On a scooter, the plate you stand on. On a skateboard, the wooden board itself. On a ramp or bowl, the flat platform on top where you wait and drop in from.',
    seeIn: ['tailwhip', 'sk-boardslide', 'bmx-drop-in', 'bmx-flyout-tailwhip'],
  },
  {
    term: 'Dialled',
    slug: 'dialled',
    aliases: ['dialed', 'dialled in'],
    sports: ['scooter', 'bmx'],
    definition:
      'When a trick is so practised that you land it nearly every time without thinking. Tutorials tell you to have the easier tricks dialled before you stack them together.',
    seeIn: ['krippleflip', 'bmx-540', 'bmx-backwards-manual', 'bmx-superman-seatgrab'],
  },
  {
    term: 'Drop in',
    slug: 'drop-in',
    aliases: ['drop-in', 'dropping in', 'roll in'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Starting a ramp from the top: tail or back wheel on the coping, then tipping forward and rolling down the transition. The first big commitment in park riding.',
    seeIn: ['drop-in', 'sk-drop-in', 'bmx-drop-in', 'quarter-pipe-air'],
  },
  {
    term: 'Endo',
    slug: 'endo',
    aliases: ['stoppie'],
    sports: ['bmx'],
    definition:
      'On a BMX, lifting the back wheel and balancing on the front one, usually by squeezing the front brake as you lean forward. A manual the other way up.',
    seeIn: ['bmx-endo', 'bmx-footjam', 'bmx-nosepick'],
  },
  {
    term: 'Fakie',
    slug: 'fakie',
    aliases: ['riding fakie', 'rolling backwards', 'to fakie'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Rolling backwards in your normal stance, so the tail leads. Your feet do not change; only the direction does. Every fakie trick starts from rolling backwards.',
    seeIn: ['fakie', 'sk-fakie-roll', 'bmx-fakie', 'sk-rock-to-fakie'],
  },
  {
    term: 'Flat',
    slug: 'flat',
    aliases: ['flatground', 'flat ground'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      "Ordinary level ground with nothing to ride on. Flatground tricks, like manuals and kickflips, need no ramp or ledge at all. It is also the library's category name for them.",
    seeIn: ['bunny-hop', 'sk-ollie', 'bmx-360', 'fingerwhip'],
    // The adjective, which is most of the copy's uses: "stamp it flat", "ride
    // it out dead flat", "plant a foot flat against it". The noun — "on flat",
    // "flat ground" — is what links.
    except: ['dead flat', 'it flat', 'foot flat', 'flat against', 'flat under', 'flat on'],
  },
  {
    term: 'Flick',
    slug: 'flick',
    aliases: ['flicking'],
    sports: ['scooter', 'skate'],
    definition:
      'On a skateboard, the quick snap of your front foot off the edge of the nose that makes the board flip. On a scooter, the kick or wrist snap that starts a whip.',
    seeIn: ['bri-flip', 'sk-nollie-kickflip', 'sk-kickflip', 'sk-heelflip'],
  },
  {
    term: 'Flyout',
    slug: 'flyout',
    aliases: ['fly out'],
    sports: ['bmx'],
    definition:
      'Riding up a quarter pipe and landing on the deck at the top instead of dropping back in. A safe, slow way to learn spins and whips before doing them in the air.',
    seeIn: ['bmx-flyout-tailwhip', 'bmx-air', 'bmx-truckdriver', 'bmx-flair'],
  },
  {
    term: 'Foam pit',
    slug: 'foam-pit',
    aliases: ['foam'],
    sports: ['scooter', 'bmx'],
    definition:
      'A pit full of foam blocks with a ramp into it. Where flips get tried before they get landed, because falling in costs nothing.',
    seeIn: ['backflip', 'bmx-backflip', 'bmx-frontflip', 'frontflip'],
  },
  {
    term: 'Footjam',
    slug: 'footjam',
    aliases: ['foot jam'],
    sports: ['scooter', 'bmx'],
    definition:
      'Jamming your front foot against the front tyre so the wheel stops dead and the back end lifts up. Done rolling slowly. It is the base of most front-wheel tricks.',
    seeIn: ['foot-jam', 'bmx-footjam', 'bmx-footjam-whip', 'whiplash'],
  },
  {
    term: 'Footplant',
    slug: 'footplant',
    aliases: ['plant', 'wall plant', 'foot plant'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Putting one foot down on the ground, a ramp deck or a wall for a moment in the middle of a trick, then pushing off it to get back on. A boneless is one.',
    seeIn: ['wall-plant', 'sk-boneless', 'bmx-footplant-whip', 'bmx-footplant'],
  },
  {
    term: 'Forks',
    slug: 'forks',
    aliases: ['fork'],
    sports: ['scooter', 'bmx'],
    definition:
      'The part that holds the front wheel and turns with the bars, on a scooter or a BMX. A foot jammed behind the forks against the tyre is a footjam.',
    seeIn: ['foot-jam', 'bmx-footjam', 'bmx-flyout-tailwhip'],
  },
  {
    term: 'Frame',
    slug: 'frame',
    aliases: ['top tube'],
    sports: ['bmx'],
    definition:
      'The main body of a BMX bike. In a tailwhip, the frame is what spins round underneath you. The top tube is the bar under the seat that a can-can swings a leg over.',
    seeIn: ['bmx-can-can', 'bmx-footjam-whip', 'bmx-flyout-tailwhip', 'bmx-hop-tailwhip'],
  },
  {
    term: 'Front foot / back foot',
    slug: 'front-foot-back-foot',
    aliases: ['front foot', 'back foot', 'lead foot'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Your front foot is the one nearer the nose in your normal stance; the back foot is over the tail. Which foot is which depends on the stance you ride.',
    seeIn: ['tailwhip', 'sk-ollie', 'bmx-footjam', 'sk-no-comply'],
  },
  {
    term: 'Frontside',
    slug: 'frontside',
    aliases: ['fs'],
    sports: ['scooter', 'skate'],
    definition:
      'One of the two ways to turn or approach an obstacle. Frontside means your front, your chest, faces the obstacle, or you spin with your chest opening the way you are travelling.',
    seeIn: ['180', 'sk-fs-pop-shuvit', 'sk-frontside-air', 'sk-frontside-flip'],
  },
  {
    term: 'Full cab',
    slug: 'full-cab',
    aliases: ['caballerial', 'cab'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'A full 360 spin done from rolling fakie, landing rolling forwards. Named after skater Steve Caballero. A half cab is the same trick with half the spin.',
    seeIn: ['half-cab', 'sk-half-cab', 'bmx-full-cab'],
  },
  {
    term: 'Gap',
    slug: 'gap',
    aliases: ['gaps', 'road gap'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'A space you have to clear in one jump: a set of stairs, a hole, or the space between two ramps. Also the name of the trick that clears one.',
    seeIn: ['gap', 'sk-gap', 'bmx-curb-drop', 'bank-transfer'],
  },
  {
    term: 'Grab',
    slug: 'grab',
    aliases: ['grabs'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Holding part of the board, scooter or bike with your hand while you are in the air. Indy, melon and seat grab are named by which hand grabs what.',
    seeIn: ['indy-grab', 'sk-tailgrab', 'bmx-seat-grab', 'sk-indy'],
  },
  {
    term: 'Grind',
    slug: 'grind',
    aliases: ['grinds', 'grinding'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Sliding along an edge on the hard parts of your ride: the trucks on a skateboard, the pegs on a scooter or BMX. The 50-50 is the basic grind.',
    seeIn: ['50-50', 'sk-50-50', 'bmx-double-peg', 'feeble'],
  },
  {
    term: 'Grip tape',
    slug: 'grip-tape',
    // Not `grip` on its own: "keep your grip loose" is a hand on the bars.
    aliases: ['griptape'],
    sports: ['scooter'],
    definition:
      'The rough, sandpaper-like sheet stuck to the top of a scooter or skateboard deck so your shoes do not slip. Spotting it coming back round tells you a whip is nearly done.',
    seeIn: ['tailwhip', 'full-whip'],
  },
  {
    term: 'Half cab',
    slug: 'half-cab',
    aliases: ['half-cab'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Rolling fakie, then hopping a 180 so you land rolling forwards. Half of a full cab. All three sports use the name.',
    seeIn: ['half-cab', 'sk-half-cab-flip', 'bmx-half-cab', 'sk-half-cab'],
  },
  {
    term: 'Handrail',
    slug: 'handrail',
    aliases: ['handrails'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'A metal rail down the side of a set of stairs, so it slopes as you grind it. Not in this library at all: the copy says ledge or low rail on purpose.',
    seeIn: ['rail-ride', 'sk-feeble', 'bmx-rail-ride', 'sk-kickflip-50-50'],
  },
  {
    term: 'Hang up',
    slug: 'hang-up',
    aliases: ['hangs up', 'hung up'],
    sports: ['skate'],
    definition:
      'When a truck or wheel catches on the coping as you come back into the ramp, stopping you dead and usually throwing you down the transition.',
    seeIn: ['sk-tailslide', 'sk-rock-n-roll', 'sk-disaster', 'sk-bluntslide'],
  },
  {
    term: 'Hard way',
    slug: 'hard-way',
    aliases: ['hard 180'],
    sports: ['bmx'],
    definition:
      'Spinning a 180 out of a grind by turning towards the ledge, so you turn away from what you can see. The other direction is easier, which is why this one gets the name.',
    seeIn: ['bmx-double-peg-hard-180', 'bmx-180-double-peg'],
  },
  {
    term: 'Headtube',
    slug: 'headtube',
    aliases: ['head tube', 'steering tube', 'stem'],
    sports: ['scooter'],
    definition:
      'The short tube at the front of a scooter that the bars and forks go through, holding the steering. A tailwhip spins the deck around it. Some riders say steering tube or stem.',
    seeIn: ['fingerwhip', 'tailwhip', 'tuck-no-hander', 'whiplash'],
  },
  {
    term: 'Hip',
    slug: 'hip',
    // `hips` is not an alias here although the research listed it: in the
    // product's own copy "hips" is the body part every time ("pull the bars
    // to your hips"), and a link from there to a ramp corner is the trap the
    // glossary research recorded.
    aliases: ['channel'],
    sports: ['skate', 'bmx'],
    definition:
      'Where two ramps meet at an angle, making a corner you can air across from one into the other. A channel is a gap cut between two transitions.',
    seeIn: ['sk-hip-transfer', 'bmx-hip-transfer'],
    // "Kick from the hip" is the body again.
    except: ['from the hip'],
  },
  {
    term: 'Hubba',
    slug: 'hubba',
    aliases: ['hubba ledge'],
    sports: ['bmx'],
    definition: 'A ledge that runs down beside a set of stairs, so it slopes as you grind it.',
    seeIn: ['bmx-feeble-manual'],
  },
  {
    term: 'Jump box',
    slug: 'jump-box',
    aliases: ['box', 'box jump', 'kicker'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'A take-off ramp facing a landing ramp, with a flat top or a gap between them, built for airtime. A kicker is a small stand-alone take-off ramp.',
    seeIn: ['backflip', 'sk-kickflip-50-50', 'bmx-hop-on-off', 'frontflip'],
  },
  {
    term: 'Kerb',
    slug: 'kerb',
    aliases: ['curb', 'kerb drop'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'The raised edge of a pavement. The cheapest obstacle there is: a drop, a low ledge and a gap in one. American copy spells it curb.',
    seeIn: ['tail-tap', 'sk-curb-drop', 'bmx-curb-drop', 'sk-curb-ollie'],
  },
  {
    term: 'Kickturn',
    slug: 'kickturn',
    aliases: ['kick turn', 'kick-turn'],
    sports: ['scooter', 'skate'],
    definition:
      'Lifting the front wheels by leaning on the tail and swinging the nose round to point a new way. How you steer on a board and turn at the top of a bank.',
    seeIn: ['kickturn', 'sk-kickturn', 'sk-ramp-kickturn', 'sk-fakie-roll'],
  },
  {
    term: 'Ledge',
    slug: 'ledge',
    aliases: ['ledges'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'A low, straight edge, usually a concrete block or a low wall, for grinds and slides. Low ledges are where most riders learn a 50-50.',
    seeIn: ['feeble', 'sk-50-50', 'bmx-hop-on-off', 'sk-curb-ollie'],
  },
  {
    term: 'Line',
    slug: 'line',
    aliases: ['lines'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Several tricks done one after another in a single run, without stopping or putting a foot down. Riders film lines, not just single tricks.',
    seeIn: ['manual', 'sk-manual', 'bmx-hip-transfer', 'cali-slider'],
  },
  {
    term: 'Lip',
    slug: 'lip',
    aliases: ['lip trick', 'lip tricks'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'The very top edge of a ramp, bank or quarter pipe, where the transition ends. Lip tricks are stalls, rocks and grinds done right on it.',
    seeIn: ['360', 'sk-axle-stall', 'bmx-air', 'acid-drop'],
  },
  {
    term: 'Manual',
    slug: 'manual',
    aliases: ['manuals', 'nose manual', 'wheelie'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Rolling along balanced on the back wheels with the front lifted, without pedalling or pushing. A nose manual is the same on the front. Manuals are measured in distance.',
    seeIn: ['manual', 'sk-manual', 'bmx-manual', 'nose-manual'],
  },
  {
    term: 'Mellow',
    slug: 'mellow',
    aliases: ['mellow ramp', 'mellow transition'],
    sports: ['bmx'],
    definition:
      'Describes a ramp or transition with a gentle curve rather than a steep one. Mellow ramps are easier to learn on; steep ones give more pop.',
    seeIn: ['bmx-disaster', 'bmx-hop-tailwhip', 'bmx-540'],
  },
  {
    term: 'Nollie',
    slug: 'nollie',
    aliases: ['nose ollie'],
    sports: ['skate', 'bmx'],
    definition:
      'An ollie or hop popped off the nose instead of the tail, while rolling forwards. Short for nose ollie. On a BMX, the back wheel comes up first.',
    seeIn: ['sk-nollie-kickflip', 'bmx-nollie-180', 'sk-nollie', 'bmx-nollie'],
  },
  {
    term: 'Nose',
    slug: 'nose',
    aliases: ['front end'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'The front end of a skateboard, scooter deck or bike. Nose tricks, like nose manuals and nosegrinds, balance on the front. The other end is the tail.',
    seeIn: ['nose-manual', 'sk-nose-manual', 'bmx-nose-manual', 'sk-noseslide'],
  },
  {
    term: 'Ollie',
    slug: 'ollie',
    aliases: ['ollies'],
    sports: ['skate'],
    definition:
      'The basic skateboard jump: snap the tail down, drag the front foot up, and the board leaves the ground with you. Everything else in skateboarding is built on it.',
    seeIn: ['sk-switch-ollie', 'sk-fakie-ollie', 'sk-curb-ollie', 'sk-ollie'],
  },
  {
    term: 'Over the bars',
    slug: 'over-the-bars',
    aliases: ['otb'],
    sports: ['bmx'],
    definition:
      'Being thrown forward over the handlebars when the front wheel stops or dips on landing. The crash scooter and BMX riders most want to avoid.',
    seeIn: ['bmx-nollie'],
  },
  {
    term: 'Park',
    slug: 'park',
    aliases: ['skatepark', 'park riding'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      "Short for skatepark, and the library's category for tricks on ramps, bowls and jump boxes. Park riding is about airtime; street riding is about ledges and rails.",
    // `manual` is not here although the research listed it: the only "park"
    // in that trick's copy is a car park.
    seeIn: ['whip-to-bar', 'sk-manual', 'bmx-pump'],
    // "an entire car park" is a scooter flatland venue, not park riding.
    except: ['car park'],
  },
  {
    term: 'Pegs',
    slug: 'pegs',
    aliases: ['peg'],
    sports: ['scooter', 'bmx'],
    definition:
      'Short metal tubes bolted beside the wheels of a scooter or BMX so you can grind ledges and rails on them. Not fitted as standard, and some grinds need them.',
    seeIn: ['double-peg', 'bmx-double-peg', 'icepick', 'bmx-double-peg-stall'],
  },
  {
    term: 'Pivot',
    slug: 'pivot',
    aliases: ['pivoting'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Turning on one wheel or one truck without hopping, so the rest of the ride swings round it. A rollback and a pivot to fakie are both pivots.',
    seeIn: ['nose-pivot', 'sk-pivot-fakie', 'bmx-rollback', 'sk-rock-n-roll'],
  },
  {
    term: 'Pop',
    slug: 'pop',
    aliases: ['popping', 'popped'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'The snap that gets you off the ground: slamming the tail down on a skateboard, or the hard push of a bunny hop. More pop means more height and more time.',
    seeIn: ['sk-ollie', 'bunny-hop', 'bmx-feeble-180', 'whip-out'],
  },
  {
    term: 'Primo',
    slug: 'primo',
    aliases: ['primo landing'],
    sports: ['skate'],
    definition:
      'Landing with the board on its side, wheels sideways under your feet. A common way a flip trick goes wrong, and a good way to roll an ankle.',
    seeIn: ['sk-varial-flip'],
  },
  {
    term: 'Pump',
    slug: 'pump',
    aliases: ['pumping', 'pumped'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Getting speed from a ramp without pushing or pedalling: crouch through the bottom of the transition and stand up as it rises. How riders keep a run going.',
    seeIn: ['pump', 'sk-pump', 'bmx-pump'],
  },
  {
    term: 'Put down',
    slug: 'put-down',
    aliases: ['put downs', 'foot down'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Touching a foot to the ground to stop or save yourself. A line with no put downs means nothing touched down between the tricks.',
    seeIn: ['kickturn', 'sk-tic-tac', 'bmx-track-stand', 'pump'],
  },
  {
    term: 'Quarter pipe',
    slug: 'quarter-pipe',
    aliases: ['quarter', 'quarters'],
    sports: ['scooter', 'bmx'],
    definition:
      'A single curved ramp with coping on top and a deck behind it: a quarter of a circle. The building block of every park. Riders just say a quarter.',
    seeIn: ['quarter-pipe-air', 'bmx-air', 'bmx-fakie', 'bmx-540'],
  },
  {
    term: 'Rail',
    slug: 'rail',
    aliases: ['rails', 'low rail', 'flat rail', 'flat bar'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'A round metal bar to grind or slide along. This library only uses low, flat rails close to the ground, never handrails down stairs.',
    seeIn: ['rail-ride', 'sk-boardslide', 'bmx-rail-ride', 'sk-flip-slide'],
  },
  {
    term: 'Resi',
    slug: 'resi',
    aliases: ['resi ramp', 'resi landing'],
    sports: ['scooter', 'bmx'],
    definition:
      'A landing ramp covered in a soft, springy surface so a failed flip hurts less. Riders go foam pit, then resi, then a normal wooden ramp.',
    seeIn: ['backflip', 'bmx-backflip', '720', 'flair-whip'],
  },
  {
    term: 'Run',
    slug: 'run',
    // Not `lap`: in this library "a full lap" is what a bar spin or a whip
    // does, not a run of a park. And "run-up" and "the ledge runs out" are
    // the ordinary verb.
    aliases: ['runs', 'contest run'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      "A rider's turn on the park or course, one trick after another, as judged in a contest. A lap is one clean circuit of the park.",
    seeIn: ['whip-to-bar', 'flair', 'sk-540', 'bmx-pump'],
    except: ['run-up', 'run up', 'runs out'],
  },
  {
    term: 'Scoop',
    slug: 'scoop',
    aliases: ['scooping'],
    sports: ['skate'],
    definition:
      'On a skateboard, dragging the back foot round the tail as you pop so the board spins flat, as in a shuvit. A harder scoop gives more spin.',
    seeIn: ['sk-shuvit', 'sk-fs-pop-shuvit', 'sk-360-shuvit', 'sk-pop-shuvit'],
  },
  {
    term: 'Shuvit',
    slug: 'shuvit',
    aliases: ['shove-it', 'pop shuvit'],
    sports: ['skate'],
    definition:
      'The board spins 180 degrees flat under your feet while you hop and keep facing the same way. A pop shuvit adds an ollie so it spins in the air.',
    seeIn: ['sk-360-shuvit', 'sk-pop-shuvit', 'sk-fs-pop-shuvit', 'sk-shuvit'],
  },
  {
    term: 'Slide',
    slug: 'slide',
    aliases: ['slides', 'boardslide'],
    sports: ['scooter', 'skate'],
    definition:
      'Sliding along an edge on the wooden part of a skateboard, or the underside of a scooter deck, rather than on the trucks or pegs. Boardslides and tailslides are slides.',
    seeIn: ['boardslide', 'sk-boardslide', 'sk-noseslide', 'lipslide'],
  },
  {
    term: 'Spins',
    slug: 'spins',
    aliases: ['180', '360', '540', '720', 'seven', 'half turn', 'full turn'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Tricks named by the degrees you turn. A 180 is half a turn, a 360 a full one, a 540 one and a half, a 720 two, which riders call a seven.',
    seeIn: ['180', '360', '540', '720'],
  },
  {
    term: 'Spot',
    slug: 'spot',
    aliases: ['spotting', 'spot the landing'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Looking for where you are going to land partway through a spin or flip. Spotting early is what stops a rotation being a guess. A spot is also a place to ride.',
    seeIn: ['180', '360', '540', 'bmx-360-fakie'],
  },
  {
    term: 'Stairs',
    slug: 'stairs',
    // Not `set` on its own: "a set of stairs" already carries "stairs", and
    // "do not try to set off already sitting" is the verb.
    aliases: ['stair set'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'A set of steps ridden as an obstacle: you ollie or hop from the top and land at the bottom. A stair set is counted by its steps.',
    seeIn: ['gap', 'sk-gap', 'bmx-curb-drop', 'sk-curb-drop'],
  },
  {
    term: 'Stall',
    slug: 'stall',
    aliases: ['stalls', 'stalling'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Stopping on the coping or a ledge for a beat, balanced on trucks, pegs, tail or a wheel, then dropping back in. Stalls come before grinds.',
    seeIn: ['foot-jam', 'sk-nose-stall', 'bmx-double-peg-stall', 'sk-feeble-stall'],
  },
  {
    term: 'Stance',
    slug: 'stance',
    aliases: ['regular', 'goofy'],
    sports: ['scooter', 'skate'],
    definition:
      'How you stand on the board or deck, and which foot leads. Riding your normal way is regular; the other way round is switch.',
    seeIn: ['fakie', 'sk-nollie-kickflip', 'body-varial', 'sk-nollie'],
  },
  {
    term: 'Street',
    slug: 'street',
    aliases: ['street riding'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      "Riding the furniture of a street: ledges, rails, stairs, kerbs and walls. The library's category for grinds, slides, gaps and wallrides.",
    seeIn: ['gap', 'sk-blunt-fakie', 'bmx-wallride', 'smith'],
  },
  {
    term: 'Switch',
    slug: 'switch',
    aliases: ['switch stance', 'riding switch'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Riding with your feet swapped from your normal stance, so your other foot leads. Not the same as fakie, where the feet stay put and you roll backwards.',
    seeIn: ['180', 'sk-switch-ollie', 'bmx-feeble-manual', '180-grind-out'],
  },
  {
    term: 'Tail',
    slug: 'tail',
    aliases: ['back end'],
    sports: ['scooter', 'skate'],
    definition:
      'The back end of a skateboard or scooter deck. On a board it is what you pop; a tail tap or tail stall rests it on an edge. The front end is the nose.',
    seeIn: ['tail-tap', 'sk-tailgrab', 'sk-tail-stall', 'cali-slider'],
  },
  {
    term: 'Toe edge / heel edge',
    slug: 'toe-edge-heel-edge',
    aliases: ['toe edge', 'heel edge', 'toe side', 'heel side'],
    sports: ['skate'],
    definition:
      'The two long edges of a skateboard. The toe edge is under your toes, the heel edge under your heels. Grabs and flicks are named by which edge you use.',
    seeIn: ['sk-heelflip', 'sk-indy', 'sk-melon', 'sk-mute'],
  },
  {
    term: 'Transfer',
    slug: 'transfer',
    aliases: ['transfers'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Airing out of one ramp or bank and landing in a different one, crossing the gap or corner between them instead of coming back down the same ramp.',
    seeIn: ['bank-transfer', 'sk-hip-transfer', 'bmx-hip-transfer', 'sk-nosegrab'],
  },
  {
    term: 'Transition',
    slug: 'transition',
    aliases: ['tranny', 'transitions'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'The curved part of a ramp or bowl between the flat ground and the top. Transition riding means ramps and bowls; street riding means everything else.',
    seeIn: ['540', 'sk-pump', 'bmx-540', 'pump'],
  },
  {
    term: 'Trucks',
    slug: 'trucks',
    aliases: ['truck', 'axle'],
    sports: ['skate'],
    definition:
      'The metal axles bolted under a skateboard that hold the wheels and steer as you lean. Grinds run on the trucks; a 50-50 grinds on both.',
    seeIn: ['sk-50-50', 'sk-5-0', 'sk-nosegrind', 'sk-axle-stall'],
    // "Truck Driver" is a trick (`bmx-truckdriver`), and the word in it is not
    // the skateboard part. Kept out by the exclusion rather than by dropping
    // `truck`, because "the truck" on its own is the part.
    except: ['truck driver'],
  },
  {
    term: 'Varial',
    slug: 'varial',
    aliases: ['body varial'],
    sports: ['scooter', 'skate'],
    definition:
      'A trick where the board spins a half turn under you, or, in a body varial, where you spin a half turn and the board does not. Two opposite uses of one word.',
    seeIn: ['body-varial', 'sk-varial-flip', 'sk-varial-heelflip', 'sk-body-varial'],
  },
  {
    term: 'Vert',
    slug: 'vert',
    aliases: ['vert ramp', 'vertical'],
    sports: ['skate'],
    definition:
      'A ramp so tall that its transition goes fully vertical at the top. Vert riding is big airs above the coping.',
    seeIn: ['sk-blunt-fakie', 'sk-backside-air', 'sk-540', 'sk-airwalk'],
  },
  {
    term: 'Wax',
    slug: 'wax',
    aliases: ['waxed'],
    sports: ['scooter', 'skate', 'bmx'],
    definition:
      'Candle or skate wax rubbed onto a ledge or rail so it slides smoothly. A waxed ledge grinds further and catches less.',
    seeIn: ['50-50', 'sk-50-50', 'bmx-double-peg', 'feeble'],
  },
  {
    term: 'Whip',
    slug: 'whip',
    aliases: ['tailwhip', 'whips', 'heelwhip'],
    sports: ['scooter', 'bmx'],
    definition:
      "Kicking the deck or frame in a full circle round the bars while you hang in the air, then landing back on it. The scooter's signature move, borrowed from BMX.",
    seeIn: ['tailwhip', 'bmx-flyout-tailwhip', 'bmx-hop-tailwhip', 'heelwhip'],
  },
  {
    term: 'Wood',
    slug: 'wood',
    aliases: ['wooden ramp'],
    sports: ['scooter', 'bmx'],
    definition:
      'A normal wooden ramp, as opposed to a foam pit or a resi landing. Foam, then resi, then wood is the order riders learn flips in.',
    seeIn: ['flair-whip', 'bmx-backflip', 'bmx-frontflip'],
  },
];
