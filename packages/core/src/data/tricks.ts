import type { Trick } from '../types';

/**
 * The trick library: 259 tricks, 84 in scooter, 85 in skate and 90 in BMX.
 *
 * Ninety-seven of them are the original set — 30 scooter and 31 skate
 * transcribed from `design-handoff/design/landit-data.js`, plus 36 BMX
 * researched in T21 (see the provenance note above the BMX block, which is not
 * the same standard). The other 162 were researched in T27, 54 per sport; the
 * provenance note above the first T27 block records how and what it is worth.
 *
 * `pre` never crosses sports — the same-sport constraint is asserted by this
 * package's tests and enforced server-side by a PocketBase hook (plan §3).
 *
 * ## `mistakes` and `hard` (T28)
 *
 * Every trick carries three or four common mistakes, each with a fix, and a
 * line on why it sits at its tier. Researched on 2026-09-07 by six agents, two
 * per sport and split by category, from published coaching sources. **181 of
 * the 259 entries cite a source that addresses the trick itself; the other 78
 * apply a source about the trick's family** — the mistakes on a frontside
 * boardslide taken from a boardslide tutorial, and so on. The owner chose to
 * ship all 259 rather than hold the 78 back, and to review them in the staff
 * trick editor where each one can be corrected in place (Rachid, 2026-09-07,
 * in chat). Which entries are which, and the URL behind each, is in
 * `docs/research/trick-content-2026-09-07/sources.json` — provenance only,
 * no copy, so the sources survive in the repo without becoming a second copy
 * of this file. The word limits are `TRICK_CONTENT_LIMITS` in
 * `../rules/tricks.ts`, pinned by the data tests and enforced on staff edits
 * by the tricks hook.
 *
 * `supervise` marks a trick a guardian should know about. It is deliberately
 * **not** a difficulty flag: the line is that the rider goes upside down (a
 * flip or an invert), commits to a drop they cannot step out of, or the
 * trick's own tips send them to a foam pit or a resi ramp first. So the
 * difficulty-2 drop-ins carry one and several difficulty-5 flatground tricks
 * do not. The coach view reads this field: `needsSupervision()` in
 * `../rules/crew.ts` falls back to `SUPERVISED_MIN_DIFF` only for a trick that
 * carries no flag at all, which is a database older than the column.
 *
 * ## The free tier
 *
 * Twenty free tricks per sport, spread **every Rookie trick, a fill of Easy,
 * four Spicy and two Gnarly, and nothing at Pro** (owner, 2026-09-12, in chat).
 * It doubles the ten-trick tier of 2026-09-04, which itself replaced the
 * original "whatever sits at difficulty 1 and 2", and it keeps that tier's
 * principle: weighted towards the easy end, but reaching past it, because an
 * experienced rider shown only tricks they landed years ago is shown nothing.
 *
 * **The shape could not simply double, and that is why it is phrased as a rule
 * rather than as five numbers.** 4/3/2/1 doubled is 8 Rookie, and no sport has
 * eight Rookie tricks — scooter and skate have six each, BMX four. So the
 * Rookie slot is "all of them" and the Easy fill absorbs the difference: eight
 * for scooter and skate, ten for BMX. A sport that gains a Rookie trick gains a
 * free one; its Easy fill drops by one to hold the twenty.
 *
 *  - scooter (6/8/4/2): `bunny-hop`, `tic-tac`, `fakie`, `kickturn`,
 *    `tail-tap`, `pump`, `180`, `50-50`, `drop-in`, `manual`,
 *    `quarter-pipe-air`, `gap`, `hippie-jump`, `acid-drop`, `tailwhip`,
 *    `bar-spin`, `nose-manual`, `boardslide`, `360`, `bar-to-whip`
 *  - skate (6/8/4/2): `sk-kickturn`, `sk-tic-tac`, `sk-fakie-roll`,
 *    `sk-curb-drop`, `sk-ramp-kickturn`, `sk-pump`, `sk-ollie`, `sk-manual`,
 *    `sk-drop-in`, `sk-shuvit`, `sk-fakie-ollie`, `sk-curb-ollie`,
 *    `sk-rock-to-fakie`, `sk-powerslide`, `sk-kickflip`, `sk-50-50`,
 *    `sk-axle-stall`, `sk-indy`, `sk-wallride`, `sk-backside-air`
 *  - BMX (4/10/4/2): `bmx-wheelie`, `bmx-pump`, `bmx-track-stand`,
 *    `bmx-curb-drop`, `bmx-bunny-hop`, `bmx-drop-in`, `bmx-air`, `bmx-manual`,
 *    `bmx-fakie`, `bmx-x-up`, `bmx-nollie`, `bmx-180`, `bmx-hop-on-off`,
 *    `bmx-double-peg-stall`, `bmx-double-peg`, `bmx-one-hander`,
 *    `bmx-wallride`, `bmx-half-cab`, `bmx-flyout-tailwhip`, `bmx-360`
 *
 * Every trick that was free at ten is still free at twenty. That is not a
 * coincidence to be re-derived next time: a rider may already hold progress on
 * one, and taking a trick back behind the paywall strands that progress where
 * the rider can see it and not touch it.
 *
 * Three rules held while choosing them. A test pins the first.
 *
 * **A free trick's entire prerequisite chain is free.** The paywall is
 * enforced server-side on `trick_progress` creation, so a rider cannot land a
 * locked prerequisite — a free Gnarly trick whose ancestors are paid is
 * permanently unreachable, which is worse than not offering it at all.
 *
 * **Every category a sport has is enterable, as far as twenty slots reach.**
 * That is the argument the `bmx-double-peg` comment below makes for street,
 * generalised: a free rider who can see a branch and never enter it has been
 * shown a wall, not a library. Four of five categories are enterable in each
 * sport, up from three in scooter and skate. The fifth is out of reach and
 * says so here rather than quietly: **scooter's air and skate's and BMX's
 * hybrid all start at difficulty 4**, so entering one costs both a Spicy slot
 * for its prerequisite and one of the two Gnarly slots, and the trade buys
 * less than `bar-to-whip`, `sk-backside-air` and `bmx-360` do where they are.
 * If a sport ever gains a difficulty-3 entry into its missing category, that is
 * the moment to revisit it.
 *
 * **No difficulty-1 trick is paid.** True again, in all three sports: the
 * ten-trick tier broke it (four slots, six Rookie entries in scooter and skate)
 * and the note here recorded the breakage. Selling a child their second-easiest
 * trick was always the weakest thing about that shape, and "all of them" costs
 * two slots per sport to fix.
 *
 * `free` is the override that implements all of this, and it wins either way
 * over `diff <= FREE_MAX_DIFF` (see `../rules/tricks.ts`). Do not change
 * `FREE_MAX_DIFF` to re-tier the library — it moves every sport at once.
 */
export const TRICKS = [
  {
    id: 'bunny-hop',
    name: 'Bunny Hop',
    sport: 'scooter',
    cat: 'flat',
    diff: 1,
    pre: [],
    about:
      'The foundation under every trick. Crouch, explode upward and pull the bars to your hips so both wheels leave the ground at once. Land it clean and the whole sport opens up.',
    tips: 'Practice popping over a crack or a stick on flat ground first. Pull up, don’t just jump. The bars do the lifting.',
    fact: 'Almost every other trick. 180s, bar spins, grinds. Starts from a solid hop. Nail this before anything else.',
    mistakes: [
      {
        what: 'Pulling with your arms only.',
        fix: 'Bend your knees deep and jump with your legs; the bars come up because you did.',
      },
      {
        what: 'Jumping forward instead of up.',
        fix: 'Push straight down and spring straight up so both wheels leave together.',
      },
      {
        what: 'Feet leaving the deck late.',
        fix: 'Lift your feet at the same moment you pull, so the deck stays under you.',
      },
      {
        what: 'Landing with straight legs.',
        fix: 'Soften your knees as the wheels touch so the landing stays quiet and you keep rolling.',
      },
    ],
    hard: 'It is the first trick, so nothing comes before it. What makes it a trick at all is timing: legs, arms and feet have to fire together or one wheel stays down.',
    isLive: true,
  },
  {
    id: 'tic-tac',
    name: 'Tic Tac',
    sport: 'scooter',
    cat: 'flat',
    diff: 1,
    pre: [],
    about:
      'Lift the front wheel and swing it left, then right, hopping the nose across the ground to build speed without pushing.',
    tips: 'Small swings, quick rhythm. Keep your weight over the back wheel the whole time.',
    fact: 'It’s the first bit of board control most riders learn, and it doubles as a warm-up drill forever after.',
    mistakes: [
      {
        what: 'Swinging the nose too wide.',
        fix: 'Keep each swing short; a small wiggle each side builds speed faster than a big one.',
      },
      {
        what: 'Lifting the front wheel too high.',
        fix: 'Lift it a finger’s width; any more and you stall between swings.',
      },
      {
        what: 'Weight drifting forward.',
        fix: 'Stay over the back wheel so the front stays light enough to swing.',
      },
      {
        what: 'Looking at the front wheel.',
        fix: 'Look ahead and let your shoulders start each swing; the wheel follows.',
      },
    ],
    hard: 'Nothing sits before it. It is Rookie because both wheels stay near the ground and you can stop any time; the skill is only rhythm and a light front end.',
    isLive: true,
  },
  {
    id: 'manual',
    name: 'Manual',
    sport: 'scooter',
    cat: 'flat',
    diff: 2,
    pre: ['bunny-hop'],
    about:
      'Balancing along on the back wheel with the nose held up, rolling as far as you can. Pure control. It lives in your hips and ankles.',
    tips: 'Find the balance point and hold it with tiny ankle taps. Look ahead, not down, and you’ll ride it way longer.',
    fact: 'Manuals get judged on distance. Riders hold them clean across an entire car park in line competitions.',
    mistakes: [
      {
        what: 'Yanking the bars up hard.',
        fix: 'Lift gently and stop at the balance point rather than blasting past it.',
      },
      {
        what: 'Locking your knees.',
        fix: 'Keep both knees soft so small dips and bumps do not throw you off.',
      },
      {
        what: 'Chasing it with your arms.',
        fix: 'Steer the balance with your hips and back foot; your arms stay relaxed.',
      },
      {
        what: 'Rolling too slowly.',
        fix: 'A steady walking pace gives you time to correct; crawling makes every wobble bigger.',
      },
    ],
    hard: 'A bunny hop is over in a moment; a manual asks you to hold a balance point for metres. Too little lift and the wheel drops, too much and you loop out backwards.',
    isLive: true,
  },
  {
    id: 'fingerwhip',
    name: 'Fingerwhip',
    sport: 'scooter',
    cat: 'flat',
    diff: 3,
    pre: ['bunny-hop'],
    about:
      'Flick the deck around a full whip with your hand instead of your foot while the wheels stay on the ground. A flatground party trick.',
    tips: 'Crouch, grab the deck near the headtube and snap your wrist. Let it spin a full lap and stamp it flat under you.',
    fact: 'One of the only whips you can learn standing dead still. No hop required to get it round.',
    mistakes: [
      {
        what: 'Grabbing the deck too far back.',
        fix: 'Take it just behind the headtube, where a small flick moves the whole deck.',
      },
      {
        what: 'Letting the bars tip while you lift.',
        fix: 'Keep the bars level with your other hand so the deck spins flat, not on a slant.',
      },
      {
        what: 'Watching your hand, not the deck.',
        fix: 'Track the deck all the way round; your feet land where your eyes are.',
      },
      {
        what: 'Trying to catch it half round.',
        fix: 'Let it finish the full lap before you stamp down, or the deck lands on its edge.',
      },
    ],
    hard: 'The hop and the flick are different jobs for different limbs, and both must fire together. The deck only spins flat if the bars stay level while one hand lets go.',
    isLive: true,
  },
  {
    id: 'hippie-jump',
    name: 'Hippie Jump',
    sport: 'scooter',
    cat: 'flat',
    diff: 2,
    pre: ['bunny-hop'],
    about:
      'Roll under a bar or gap, jump straight off the deck and land back on it while the scooter keeps rolling underneath you.',
    tips: 'Jump up, not forward. Keep the bars steady with one hand if you need the confidence.',
    fact: 'Great confidence builder. It teaches you that the scooter will still be there when you come down.',
    mistakes: [
      {
        what: 'Jumping forward off the deck.',
        fix: 'Push straight up from the middle of the deck so the scooter keeps its line.',
      },
      {
        what: 'Pushing on the tail as you leave.',
        fix: 'Take off from flat feet; pressing the tail or nose sends the deck off course.',
      },
      {
        what: 'Losing sight of the scooter.',
        fix: 'Watch the deck roll under the bar and land on its middle.',
      },
      {
        what: 'Rolling in too slowly.',
        fix: 'Carry enough speed that the scooter is still moving when you come down.',
      },
    ],
    hard: 'It is the bunny hop with the deck left behind. Simpler than it looks because the scooter does nothing clever, but you must trust it to keep rolling under you.',
    isLive: true,
  },
  {
    id: 'x-up',
    name: 'X-Up',
    sport: 'scooter',
    cat: 'flat',
    diff: 2,
    pre: [],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Twist the bars a full 180° while airborne (or even standing still) and catch them backwards, then twist back before you need to steer.',
    tips: 'Start standing still to learn the catch, then take it into a small hop. Keep your grip loose so the twist doesn’t fight your wrists.',
    fact: 'One of the first bar tricks most riders learn. It’s the natural stepping stone into bar spins.',
    mistakes: [
      {
        what: 'Gripping the bars tight.',
        fix: 'Loosen your grip so your wrists can roll with the twist.',
      },
      {
        what: 'Turning them only halfway.',
        fix: 'Start with a quarter turn standing still, then add more each go until the bars are backwards.',
      },
      {
        what: 'Untwisting too late.',
        fix: 'Bring them back before the front wheel touches or you land steering sideways.',
      },
      {
        what: 'Twisting from the elbows.',
        fix: 'Cross from the shoulders; your arms make the X and the bars follow.',
      },
    ],
    hard: 'No prerequisite because it starts standing still. It stays Easy because the wheels never leave the ground until you choose; the only new thing is your arms crossing and uncrossing in time.',
    isLive: true,
  },
  {
    id: 'nose-manual',
    name: 'Nose Manual',
    sport: 'scooter',
    cat: 'flat',
    diff: 3,
    pre: ['manual'],
    // Free by the free-tier shape at the top of this file.
    free: true,
    about:
      'The manual, flipped: rolling forward on the front wheel with the back end lifted behind you.',
    tips: 'Way twitchier than a manual. Ease your weight forward, never lunge, and bail backwards if it tips.',
    fact: 'Nose manual into a bunny hop out is a classic line-ender on flatground.',
    mistakes: [
      {
        what: 'Lunging your weight forward.',
        fix: 'Ease onto the front wheel bit by bit; a lunge sends you over the bars.',
      },
      {
        what: 'Front foot too far back.',
        fix: 'Push it right up to the headtube so you have leverage over the front wheel.',
      },
      {
        what: 'Straight arms, stiff body.',
        fix: 'Bend the elbows and knees a little so you can make small corrections.',
      },
      {
        what: 'Bailing forwards.',
        fix: 'When it tips, drop the back wheel and step off behind; never dive over the bars.',
      },
    ],
    hard: 'A manual balances over the wheel that steers; this one balances over the wheel that does not. The balance point is smaller and forward of your hands, so the fall is over the bars.',
    isLive: true,
  },
  {
    id: '180',
    name: 'The 180',
    sport: 'scooter',
    cat: 'street',
    diff: 2,
    pre: ['bunny-hop'],
    about:
      'A half rotation: you and the scooter spin 180° and roll away switch (backwards). Wind your shoulders up, then whip them round and let the deck chase your head.',
    tips: 'Spot your landing over your shoulder and commit fully. A lazy half-spin is how ankles get rolled.',
    fact: "Land enough of them and 'switch' riding stops feeling alien. Pros drill both frontside and backside until either feels normal.",
    mistakes: [
      {
        what: 'Forcing the spin with the bars.',
        fix: 'Lead with your eyes and shoulders; the scooter follows your head.',
      },
      {
        what: 'Spotting the landing late.',
        fix: 'Look over your leading shoulder as you take off so you see the ground early.',
      },
      {
        what: 'Stopping the turn halfway.',
        fix: 'Commit to the whole half turn; a lazy spin lands you sideways.',
      },
      {
        what: 'Landing with locked knees.',
        fix: 'Bend as you land so you can ride away fakie without a wobble.',
      },
    ],
    hard: 'A bunny hop with a twist added. Easy because the hop is small, but you must land rolling backwards, so the fakie needs to feel normal before you add the spin.',
    isLive: true,
  },
  {
    id: '50-50',
    name: '50-50 Grind',
    sport: 'scooter',
    cat: 'street',
    diff: 2,
    pre: ['bunny-hop'],
    about:
      'Both pegs lock onto a ledge or rail and you slide straight along it. The grind that every other grind is built on top of.',
    tips: 'Hop on with your weight centred over the deck and ride it out dead flat. A little wax lets you slide much further.',
    fact: 'Get comfy on 50-50s and feebles, smiths and crooked grinds all suddenly start to make sense.',
    mistakes: [
      {
        what: 'Hopping straight at the ledge.',
        fix: 'Roll in almost parallel, only a little angled, so you land along the edge not across it.',
      },
      {
        what: 'One peg landing before the other.',
        fix: 'Aim to set both pegs down together or the scooter twists off.',
      },
      {
        what: 'Leaning away from the ledge.',
        fix: 'Keep your weight over the middle of the deck for the whole slide.',
      },
      {
        what: 'Panicking and bailing early.',
        fix: 'Trust the slide and ride it to the end before you hop off.',
      },
    ],
    hard: 'Your first grind. The hop is the same, but the landing is now a narrow edge and your speed carries you along it. The pegs make it forgiving next to the balance grinds after it.',
    isLive: true,
  },
  {
    id: 'gap',
    name: 'Gap',
    sport: 'scooter',
    cat: 'street',
    diff: 2,
    pre: ['bunny-hop'],
    supervise: true,
    about:
      'Clear a set of stairs, a hole or a road gap in one hop. Speed plus a solid pop and nothing else.',
    tips: 'Commit to your speed before the run-up ends. Slowing down mid-approach is what causes casing.',
    fact: 'Most street parts are built around one gap the rider spent a whole day on.',
    mistakes: [
      {
        what: 'Slowing down on the run-up.',
        fix: 'Pick your speed before the run-up and hold it all the way to the lip.',
      },
      {
        what: 'Popping too late.',
        fix: 'Hop a stride before the edge so you are already rising when you leave it.',
      },
      {
        what: 'Looking down at the gap.',
        fix: 'Look at the landing spot; where your eyes go, your wheels go.',
      },
      {
        what: 'Landing stiff on the front wheel.',
        fix: 'Land both wheels together with bent knees and roll out.',
      },
    ],
    hard: 'The hop is one you already own; what is new is that you cannot stop halfway. Easy on a small gap, but the commitment is real, which is why a grown-up should be watching.',
    isLive: true,
  },
  {
    id: 'icepick',
    name: 'Icepick',
    sport: 'scooter',
    cat: 'street',
    diff: 4,
    pre: ['50-50'],
    about:
      'A grind on the back peg only, with the front end of the scooter tipped up above the ledge.',
    tips: 'Land back-peg first and keep your shoulders level. Lean too far back and it slips out behind you.',
    fact: 'Icepicks look far harder than they are. Which is exactly why riders love them.',
    mistakes: [
      {
        what: 'Slamming the back peg down.',
        fix: 'Let the peg glide onto the ledge level; a slam kills your speed.',
      },
      {
        what: 'Front wheel bobbing up and down.',
        fix: 'Lock your arms at one height so the front end stays still.',
      },
      {
        what: 'Leaning in or out.',
        fix: 'Keep your weight exactly above the ledge, knees bent, like a manual.',
      },
      { what: 'Looking down at the peg.', fix: 'Look along the ledge to where you will drop off.' },
    ],
    hard: 'A 50-50 has two pegs on the ledge. An icepick has one, so it is a manual on a narrow edge with nothing to catch you. That missing contact point is the whole jump.',
    isLive: true,
  },
  {
    id: 'feeble',
    name: 'Feeble Grind',
    sport: 'scooter',
    cat: 'street',
    diff: 4,
    pre: ['50-50'],
    about:
      'A grind where the back peg rides the ledge or rail while the front wheel hangs out over the edge. Equal parts balance and attitude.',
    tips: 'Approach at a slight angle, lock the peg on, keep your weight just behind centre. A little wax makes the ledge way friendlier.',
    fact: "'Feeble' was borrowed straight from BMX and skating. Half of scootering’s trick names are inherited from its older cousins.",
    mistakes: [
      {
        what: 'Hopping in with speed too early.',
        fix: 'Practise a slow hop onto the ledge first so the back peg learns to lock.',
      },
      {
        what: 'Front wheel pointing sideways.',
        fix: 'Keep the front wheel facing forward along the ledge.',
      },
      {
        what: 'Weight too far back.',
        fix: 'Sit just behind centre; too far back and the back peg slips off.',
      },
      {
        what: 'Rolling in dead straight.',
        fix: 'Come in at a slight angle so the front wheel can drop over the edge.',
      },
    ],
    hard: 'The back peg grinds while the front wheel rolls on top, so the two ends of the scooter sit at different heights. Balance that a 50-50 gave you for free now comes from you.',
    isLive: true,
  },
  {
    id: 'smith',
    name: 'Smith Grind',
    sport: 'scooter',
    cat: 'street',
    diff: 4,
    pre: ['feeble'],
    about:
      'The feeble’s mirror: front peg grinds the rail while the back end hangs down on the outside.',
    tips: 'Angle in slightly nose-first and keep pressure on that front peg the whole way.',
    fact: 'Feeble and smith are the pair that make a rider look like they actually ride street.',
    mistakes: [
      {
        what: 'Letting the front peg lift.',
        fix: 'Keep pressure through your front foot so the peg stays on the ledge.',
      },
      {
        what: 'Coming in square on.',
        fix: 'Angle in nose-first a little so the back end can hang outside.',
      },
      {
        what: 'Leaning out too far.',
        fix: 'A slight lean away helps; more than that and you slide out.',
      },
      { what: 'Rushing the lock-in.', fix: 'Set the front peg first, then let the back settle.' },
    ],
    hard: 'It is the feeble in reverse. You already know the tilted balance, but now the loaded peg is the front one, which puts your weight over the bars and the ledge at once.',
    isLive: true,
  },
  {
    id: '180-grind-out',
    name: '180 Out',
    sport: 'scooter',
    cat: 'street',
    diff: 4,
    pre: ['50-50', '180'],
    about: 'Ride out of any grind with a half spin, landing switch off the end of the ledge.',
    tips: 'Start the wind-up before the ledge runs out. Turn your head first, everything else follows.',
    fact: "Adding an 'out' to a grind you already have is the cheapest way to double your trick list.",
    mistakes: [
      {
        what: 'Starting the spin after the ledge ends.',
        fix: 'Wind your shoulders while you still have ledge under you.',
      },
      {
        what: 'Hopping out too low.',
        fix: 'Pop up off the end, not just off it; you need height for the half turn.',
      },
      {
        what: 'Eyes staying on the ledge.',
        fix: 'Turn your head first and let the scooter chase it.',
      },
      {
        what: 'Landing on the front wheel.',
        fix: 'Land both wheels together and ride out fakie with soft knees.',
      },
    ],
    hard: 'A 180 and a grind are both yours already; the hard part is doing one out of the other. You spin from a moving slide with no ground to push from, and land rolling backwards.',
    isLive: true,
  },
  {
    id: 'tailwhip',
    name: 'Tailwhip',
    sport: 'scooter',
    cat: 'park',
    diff: 3,
    pre: ['bunny-hop'],
    // One of scooter's four free Spicy tricks (see the free-tier note at the
    // top of this file). It is the sport's rite of passage — the trick riders
    // themselves treat as the milestone — and a milestone behind a paywall is an
    // achievement for sale (issue #75). No-footer, toboggan and everything above
    // them stay paid; `bar-spin`, `nose-manual` and `boardslide` are the other
    // three, and `bar-to-whip` is the Gnarly trick this one leads into.
    free: true,
    about:
      'The signature scooter move. Hop up, kick the deck through a full 360° loop around the headtube, then stomp it back under your feet mid-air.',
    tips: 'Kick with your front foot and keep the bars dead still. Spot the grip tape coming back round before you stamp down.',
    fact: 'The tailwhip is basically the symbol of scootering. Your first clean one is a genuine rite of passage.',
    mistakes: [
      {
        what: 'Kicking before you have left the ground.',
        fix: 'Hop first, then kick; the deck needs clear air underneath it to spin.',
      },
      {
        what: 'A soft kick that stalls halfway.',
        fix: 'Kick through the deck with your whole lower leg so it comes all the way round.',
      },
      {
        what: 'Feet too far forward on the deck.',
        fix: 'Stand with your front foot near the middle so your kick has room to swing.',
      },
      {
        what: 'Landing with straight legs.',
        fix: 'Bend your knees as the deck comes under you so the landing does not jar.',
      },
    ],
    hard: 'The bunny hop only asks you to leave the ground. A tailwhip asks you to send the deck round a full turn while you hang above it, then time both feet onto a moving target.',
    isLive: true,
  },
  {
    id: 'bar-spin',
    name: 'Bar Spin',
    sport: 'scooter',
    cat: 'park',
    diff: 3,
    pre: ['bunny-hop'],
    // Free by the free-tier shape at the top of this file.
    free: true,
    about:
      'Float off the ground and spin the bars a full 360°, then catch them dead straight before you land. It’s all in the wrists and timing.',
    tips: 'Throw with your lead hand, catch with the other. Keep your shoulders square. Only the bars should move, not you.',
    fact: "Stack a bar spin onto a tailwhip and you’ve got a 'ridiculous'. One of scootering’s classic combo names.",
    mistakes: [
      {
        what: 'Gripping the bars too tight.',
        fix: 'Keep your arms loose so the bars can turn freely and your catch has some give.',
      },
      {
        what: 'Pushing the bars down as they spin.',
        fix: 'Keep the bars turning level and close to your body, not up or down.',
      },
      {
        what: 'Spinning and hoping the bars come back.',
        fix: 'Watch the grips round and reach for them with your catching hand before you land.',
      },
      {
        what: 'Wheels tilted during the hop.',
        fix: 'Hop with both wheels level so the scooter stays under you while the bars turn.',
      },
    ],
    hard: 'A bunny hop keeps everything attached. A bar spin lets go of the only thing steering you, so the whole trick hangs on catching a full turn in one short hop.',
    isLive: true,
  },
  {
    id: 'no-footer',
    name: 'No Footer',
    sport: 'scooter',
    cat: 'park',
    diff: 3,
    pre: ['bunny-hop'],
    about:
      'Off a jump you kick both feet off the deck, hang them out in the air, then snap them back on before you land. Pure expression.',
    tips: 'Get plenty of height first, push the bars down slightly and keep your eyes locked on the deck the whole time.',
    fact: 'Style tricks like this are where riders build their own signature look in the air.',
    mistakes: [
      {
        what: 'Kicking the feet out too early.',
        fix: 'Wait until you feel the top of the jump, then take both feet off together.',
      },
      {
        what: 'Letting the scooter drop away beneath you.',
        fix: 'Keep a firm pull on the bars so the deck stays where your feet left it.',
      },
      {
        what: 'Reaching for the deck one foot first.',
        fix: 'Bring both feet back together so the landing is level rather than twisted.',
      },
      {
        what: 'Trying it off a small hop.',
        fix: 'Learn it where you have real air time, on a ramp or over a soft landing.',
      },
    ],
    hard: 'The bunny hop keeps your feet planted. A no footer takes away your only contact with the deck, so you must trust the bars to hold the scooter and get both feet back in time.',
    isLive: true,
  },
  {
    id: 'toboggan',
    name: 'Toboggan',
    sport: 'scooter',
    cat: 'park',
    diff: 4,
    pre: ['no-footer'],
    about:
      'Grab the deck behind you with one hand and twist the bars, holding the shape at the peak of the jump.',
    tips: 'Reach back early. The trick lives at the top of the arc, so pull the shape and hold it a beat.',
    fact: 'A grab trick judges reward for how long and how obviously you hold it.',
    mistakes: [
      {
        what: 'Grabbing before the bars have turned.',
        fix: 'Turn the bars sideways first, then reach back for the deck so the shape opens up.',
      },
      {
        what: 'Letting the grab pull you forward.',
        fix: 'Keep your weight over the bars and let the grab come to you, not the other way.',
      },
      {
        what: 'Holding on too long.',
        fix: 'Let go and straighten the bars as soon as you start to drop from the peak.',
      },
      {
        what: 'Sitting back too far on the deck.',
        fix: 'Crouch over the scooter rather than behind it so the grab does not pull you off the back.',
      },
    ],
    hard: 'A no footer trusts the bars. A toboggan lets one hand go, turns the bars and grabs the deck all in the same moment, so there is more to put back before you land.',
    isLive: true,
  },
  {
    id: '360',
    name: 'The 360',
    sport: 'scooter',
    cat: 'park',
    diff: 4,
    pre: ['180'],
    // Free by the free-tier shape at the top of this file.
    free: true,
    about:
      'A full 360° spin of you and the scooter together off a ramp or jump. Spot it, wind up, and whip the whole rotation the way round.',
    tips: 'Wind your upper body before you leave the lip and keep spotting your landing the entire way around.',
    fact: 'Stack a 360 with a bar spin or a whip and you are deep into competition-run territory.',
    mistakes: [
      {
        what: 'Chasing height instead of rotation.',
        fix: 'Turn your head and shoulders hard; the spin comes from your body, not from jumping higher.',
      },
      {
        what: 'Looking at the ground on take-off.',
        fix: 'Pick a spot behind your shoulder and find it again as you come round.',
      },
      {
        what: 'Leaving the bars straight while you spin.',
        fix: 'Keep the bars turned with your body so the scooter comes round with you.',
      },
      {
        what: 'Landing stiff after the spin.',
        fix: 'Bend your knees on landing so you can ride out a little short or a little over.',
      },
    ],
    hard: 'A 180 lands you facing the ramp with the spin done. A 360 needs twice the turn from the same air, so the wind-up, the head turn and the spot all have to be sharper.',
    isLive: true,
  },
  {
    id: 'heelwhip',
    name: 'Heelwhip',
    sport: 'scooter',
    cat: 'park',
    diff: 4,
    pre: ['tailwhip'],
    about: 'A tailwhip spun the opposite way, kicked round with your heel instead of your toes.',
    tips: 'It feels backwards for weeks. Drill the kick standing still against a wall before you take it to a ramp.',
    fact: 'Riders who learn heelwhips early tend to end up with the cleanest whip catches.',
    mistakes: [
      {
        what: 'Kicking with the toes out of habit.',
        fix: 'Push the deck away with the heel of your front foot so it turns the other way.',
      },
      {
        what: 'Turning your body with the deck.',
        fix: 'Keep your hips square over the bars; only the deck should go round.',
      },
      {
        what: 'Expecting the same catch as a tailwhip.',
        fix: 'The deck arrives from the other side, so watch for it there and stamp down late.',
      },
      {
        what: 'Trying it on a ramp too soon.',
        fix: 'Land it on flat first so the new direction is in your legs before you add speed.',
      },
    ],
    hard: 'The tailwhip has drilled one direction into your feet. A heelwhip sends the deck the other way, so the kick, the catch and where you look all have to be relearned against that habit.',
    isLive: true,
  },
  {
    id: 'double-whip',
    name: 'Double Whip',
    sport: 'scooter',
    cat: 'park',
    diff: 4,
    pre: ['tailwhip'],
    about: 'Two full deck rotations in one hop. You need serious height and a fast, flat kick.',
    tips: 'Kick harder and later than feels sensible, and don’t reach for the first rotation.',
    fact: 'The jump from single to double is the biggest single step in park riding.',
    mistakes: [
      {
        what: 'Catching after the first rotation.',
        fix: 'Let the deck go past you once and only look for it on the second lap.',
      },
      {
        what: 'Kicking the deck downwards.',
        fix: 'Kick it out flat and level so it spins fast instead of dropping.',
      },
      {
        what: 'Hop too small for two spins.',
        fix: 'Take it to a ramp or box where the air time is already there.',
      },
      {
        what: 'Feet drifting apart while you wait.',
        fix: 'Keep your knees tucked and feet close so both land on the deck together.',
      },
    ],
    hard: 'A single whip fits inside a bunny hop. A double needs the deck to go round twice in the same air, so you need more height, a faster kick and the patience to wait.',
    isLive: true,
  },
  {
    id: '540',
    name: 'The 540',
    sport: 'scooter',
    cat: 'park',
    diff: 5,
    pre: ['360'],
    supervise: true,
    about:
      'A spin and a half. One and a half rotations before you land, usually off a big transition.',
    tips: 'You have to over-rotate the 360 for weeks before this clicks. Keep the wind-up low and tight.',
    fact: 'Most riders land their first 540 on a quarter pipe, where the transition does half the work.',
    mistakes: [
      {
        what: 'Trying it first on hard ground.',
        fix: 'Learn it into foam or on a resi ramp with someone watching; a half-landed 540 drops you sideways.',
      },
      {
        what: 'Stopping the head turn halfway.',
        fix: 'Keep looking round past the first full turn until the landing appears again.',
      },
      {
        what: 'Opening your arms during the spin.',
        fix: 'Keep your elbows in and the bars close so the spin stays fast.',
      },
      {
        what: 'Not knowing which way you land.',
        fix: 'Decide before you go whether you land forwards or fakie, and set your feet for it.',
      },
    ],
    hard: 'A 360 lands after one full turn. A 540 needs another half turn from the same air, so you are still spinning when a 360 would already be down.',
    isLive: true,
  },
  {
    id: 'whip-to-bar',
    name: 'Whip to Bar',
    sport: 'scooter',
    cat: 'hybrid',
    diff: 4,
    pre: ['tailwhip', 'bar-spin'],
    about:
      'Catch a tailwhip and immediately throw a bar spin in the same air. Two tricks, one jump.',
    tips: 'Catch the whip early and high. If the whip is late there’s no room left for the bars.',
    fact: 'Combos like this are what separate a park run from a park lap.',
    mistakes: [
      {
        what: 'Throwing the bars before the whip lands.',
        fix: 'Feel both feet on the deck first, then throw; the bars need a steady base.',
      },
      {
        what: 'Letting your body follow the whip.',
        fix: 'Keep your shoulders square during the whip so the bars are still in front of you.',
      },
      {
        what: 'Slow catch on the bars.',
        fix: 'Throw hard and reach for the grips straight away, because there is no air left to spare.',
      },
      {
        what: 'Practising both halves on flat only.',
        fix: 'Take it to a ramp or box where the extra air gives the second trick room.',
      },
    ],
    hard: 'Each half is a trick you already have. Stacking them means the whip has to land early enough to leave air for a full bar spin, which is the part no single trick teaches.',
    isLive: true,
  },
  {
    id: 'bri-flip',
    name: 'Bri Flip',
    sport: 'scooter',
    cat: 'hybrid',
    diff: 5,
    pre: ['tailwhip'],
    about:
      'A backflip of the deck only: you flick the scooter over underneath you like a kickflip and re-catch it before landing. A proper advanced trick.',
    tips: 'Pop hard, flick with your toe and be patient. Wait for the grip to come all the way round before you reach for it.',
    fact: 'It’s one of the rare tricks named after a person. The rider who first landed it.',
    mistakes: [
      {
        what: 'Bars left straight during the flip.',
        fix: 'Turn the bars a quarter turn first so the deck can flip over sideways without hitting your legs.',
      },
      {
        what: 'Hands in the wrong order.',
        fix: 'Lead with the hand that matches your stance so the turned bars sit naturally in your grip.',
      },
      {
        what: 'Watching the bars, not the deck.',
        fix: 'Keep your eyes on the grip tape all the way over so you know when to reach.',
      },
      {
        what: 'Legs straight underneath.',
        fix: 'Tuck your knees up so the deck has room to flip beneath you.',
      },
    ],
    hard: 'A tailwhip spins the deck flat around the bars. A bri flip turns the bars a quarter and sends the deck over end to end, a rotation you have never caught before.',
    isLive: true,
  },
  {
    id: 'scooter-flip',
    name: 'Scooter Flip',
    sport: 'scooter',
    cat: 'hybrid',
    diff: 4,
    pre: ['bri-flip'],
    about: 'The deck rotates a whip and a flip at the same time while you float above it.',
    tips: 'Learn the bri flip properly first. This is that motion plus a kick, and it punishes half-commitment.',
    fact: 'Slow-motion clips of scooter flips are how most riders finally work out the timing.',
    mistakes: [
      {
        what: 'Letting go with both hands.',
        fix: 'One hand stays on the bars the whole time; it is what brings the scooter back.',
      },
      {
        what: 'Flipping without any whip.',
        fix: 'Kick the deck sideways as you flick it over so it turns and flips together.',
      },
      {
        what: 'Reaching for the deck too early.',
        fix: 'Wait until the grip tape faces up again before your feet go looking for it.',
      },
      {
        what: 'Small pop and a big flick.',
        fix: 'Get proper height first; the flick only works when there is time for it.',
      },
    ],
    hard: 'A bri flip keeps both hands on and only flips. A scooter flip lets one hand go and adds a whip, so the deck moves two ways with less holding it.',
    isLive: true,
  },
  {
    id: 'backflip',
    name: 'Backflip',
    sport: 'scooter',
    cat: 'air',
    diff: 5,
    pre: ['360'],
    supervise: true,
    about:
      'The big one: a full backward rotation, you and the scooter together, launched off a ramp or jump box. Total commitment required.',
    tips: 'Learn it into a foam pit or a resi ramp first. Tuck your knees, throw your head back and spot the landing on the way round.',
    fact: 'The earliest scooter backflips went down on the same ramps BMX and MTB riders used. Scooters were the new kids at the park.',
    mistakes: [
      {
        what: 'First attempts on wood or concrete.',
        fix: 'A backflip is learned into foam or onto a resi ramp with someone watching, and nowhere else first.',
      },
      {
        what: 'Throwing your head back too early.',
        fix: 'Wait until the front wheel has left the lip before you lean back, or the ramp is in the way.',
      },
      {
        what: 'Letting go of the scooter mid-flip.',
        fix: 'Keep both hands on the bars the whole way round; a loose scooter lands wherever it likes.',
      },
      {
        what: 'Bailing halfway round.',
        fix: 'Once you have left the lip the flip is happening, so keep tucking and finish it.',
      },
    ],
    hard: 'A 360 turns you flat, with the ground in view for most of it. A backflip turns you upside down, hides the landing until late and cannot be stopped once you have thrown it.',
    isLive: true,
  },
  {
    id: 'frontflip',
    name: 'Front Flip',
    sport: 'scooter',
    cat: 'air',
    diff: 5,
    pre: ['backflip'],
    supervise: true,
    about:
      'A forward rotation off a jump box. Harder to spot than a backflip because the landing hides until the last moment.',
    tips: 'Foam pit only until it’s automatic. Throw from the chest and keep the scooter pinned to your feet.',
    fact: 'Front flips stayed a contest-only trick for years after backflips went mainstream.',
    mistakes: [
      {
        what: 'Skipping the foam pit stage.',
        fix: 'Front flips go into foam until the landing shows up on its own, then a resi ramp, with someone watching.',
      },
      {
        what: 'Pulling the bars down too hard.',
        fix: 'A controlled pull rotates you; a violent one sends you past the landing.',
      },
      {
        what: 'Hands creeping to the ends of the grips.',
        fix: 'Hold the bars in the middle of the grips so the pull is even and the scooter stays straight.',
      },
      {
        what: 'Opening up before you see the ground.',
        fix: 'Stay tucked until the landing appears, then extend your legs to meet it.',
      },
    ],
    hard: 'A backflip shows you the landing early in the second half. A front flip rotates you towards it, so the ground hides behind your own body until the last moment.',
    isLive: true,
  },
  {
    id: 'superman',
    name: 'Superman',
    sport: 'scooter',
    cat: 'air',
    diff: 4,
    pre: ['no-footer'],
    about:
      'Feet off and legs stretched straight out behind you, hanging off the bars at the top of a big air.',
    tips: 'You need real height. Push the scooter forward as your legs go back, then pull it home.',
    fact: 'Pure spectator trick. It reads from the back of any crowd.',
    mistakes: [
      {
        what: 'Legs going out sideways instead of back.',
        fix: 'Push your hips forward and let both legs trail straight behind you.',
      },
      {
        what: 'Arms bent and the scooter close.',
        fix: 'Straighten your arms so the scooter goes out in front, or the shape never appears.',
      },
      {
        what: 'Bringing the scooter back too late.',
        fix: 'Start pulling it home as soon as you feel the peak, because the feet need time to find it.',
      },
      {
        what: 'Trying it off a small jump.',
        fix: 'Learn it on a box or big quarter where the air time is already there.',
      },
    ],
    hard: 'A no footer keeps your legs under you. A superman sends them straight out behind and the scooter out in front, so the whole shape has to fold back before you land.',
    isLive: true,
  },
  {
    id: 'flair',
    name: 'Flair',
    sport: 'scooter',
    cat: 'air',
    diff: 5,
    pre: ['backflip', '360'],
    supervise: true,
    about: 'A backflip with a 180 built in, landing switch out of a quarter pipe.',
    tips: 'Only after backflips are boring. Start the twist on the way up, not at the peak.',
    fact: "The flair is the standard 'final trick' of a contest run in every wheeled sport.",
    mistakes: [
      {
        what: 'Taking it straight to the ramp.',
        fix: 'A flair is learned into foam or on a resi quarter with someone watching, after the backflip is solid.',
      },
      {
        what: 'Flipping first and twisting after.',
        fix: 'The half turn has to be in the throw from the lip, not added at the top.',
      },
      {
        what: 'Going straight up the ramp.',
        fix: 'Ride up the quarter at a slight angle so the turn has somewhere to go.',
      },
      {
        what: 'Losing the ramp on the way down.',
        fix: 'Look for the coping as you come round so you land back in the transition, not on the deck.',
      },
    ],
    hard: 'A backflip goes straight over. A flair adds a half turn and lands back in the quarter you left, so you flip, twist and find a ramp behind you all at once.',
    isLive: true,
  },
  {
    id: 'tailwhip-flip',
    name: 'Flip Whip',
    sport: 'scooter',
    cat: 'air',
    diff: 5,
    pre: ['backflip', 'tailwhip'],
    supervise: true,
    about:
      'A full flip with a tailwhip thrown inside it. Backflip or frontflip both count. Top of the pile.',
    tips: 'Both halves need to be automatic on their own before you stack them.',
    fact: 'There are still only a handful of riders who throw these in a contest run.',
    mistakes: [
      {
        what: 'Stacking them without a soft landing.',
        fix: 'A flip whip is built in foam and on resi with someone watching, because the deck can be anywhere.',
      },
      {
        what: 'Kicking the whip as you leave the lip.',
        fix: 'Throw the flip first and kick once you are already upside down.',
      },
      {
        what: 'Bars moving during the whip.',
        fix: 'Keep the bars locked to your chest so the deck spins round them, not with them.',
      },
      {
        what: 'Looking for the landing before the deck.',
        fix: 'Spot the grip tape first, catch it, then find the ground.',
      },
    ],
    hard: 'The backflip and the tailwhip are both automatic on their own. Together the whip has to be kicked while you are upside down, so you spot the deck and the landing in the same rotation.',
    isLive: true,
  },

  /* ------------------------------------------------ scooter, T27 additions --
   *
   * 162 tricks were added on 2026-09-04 (T27), 54 per sport, taking the
   * library from 97 to 259. **Read this before changing a `diff` or a `pre`
   * in any of the three T27 blocks.**
   *
   * How they were found: six research agents, two per sport and split by
   * category, each working from published coaching and tutorial sources.
   * Every candidate that shipped carries at least one source; names that could
   * not be verified against a real source were dropped rather than guessed at,
   * and a handful of medium-confidence entries were cut by the owner to level
   * the three sports at 54 each.
   *
   * Three honest caveats, recorded so a later session does not read these as
   * settled:
   *
   *  1. **The prerequisite edges are largely inferred, not cited.** The
   *     researching agents were given trick ids and difficulties but not the
   *     existing prerequisite graph, so `pre` was reconstructed afterwards
   *     from the trick descriptions. Sources agree on what these tricks are;
   *     they mostly do not say what comes before them.
   *  2. **`diff` is a mapping, not a rating.** Almost no source rates
   *     difficulty on a five-point scale. The numbers place each trick against
   *     the tricks already in this file, which is a judgement about this
   *     library rather than a fact about the sport.
   *  3. **Some tricks need parts the rider may not have.** Where a trick
   *     cannot be done without pegs — scooter `double-peg`, `nose-grind` and
   *     `crooked-grind`, and the BMX peg grinds and stalls — the copy says so,
   *     so a rider without them is not left wondering what they are doing
   *     wrong.
   *
   * Street tricks here are scoped to ledges and low flat rails throughout.
   * Handrails stay excluded, and the copy on anything that could read as a
   * handrail trick says ledge or low rail in as many words.
   */

  {
    id: 'fakie',
    name: 'Fakie',
    sport: 'scooter',
    cat: 'flat',
    diff: 1,
    pre: [],
    about:
      'Rolling backwards with the tail leading. Nothing else changes — same stance, same feet — you are just going the other way and looking over your shoulder.',
    tips: 'Ride up a gentle bank, let it push you back down and hold it instead of turning out. Look where you are going, not at the deck.',
    fact: 'Every half cab and every fakie spin starts here. Get comfortable rolling backwards early and a whole branch of the library opens up.',
    mistakes: [
      {
        what: 'Leaning back as you roll.',
        fix: 'Lean slightly over the bars; leaning back makes the front wheel wander.',
      },
      {
        what: 'Steering the way you expect.',
        fix: 'Turn the bars the opposite way to where you want to go.',
      },
      { what: 'Staring down at the deck.', fix: 'Look over your shoulder at where you are going.' },
      {
        what: 'Going too fast at first.',
        fix: 'Roll gently up a small bank and let it push you back slowly.',
      },
    ],
    hard: 'Nothing before it and Rookie because nothing leaves the ground. What is new is that the steering feels backwards, and your body has to trust a direction it cannot see straight ahead.',
    isLive: true,
  },
  {
    id: 'kickturn',
    name: 'Kickturn',
    sport: 'scooter',
    cat: 'flat',
    diff: 1,
    pre: [],
    about:
      'Weight back to lighten the front wheel, then swivel the scooter round to point somewhere else while you are still rolling. This is how you steer properly.',
    tips: 'Roll slowly and keep the lift tiny — a centimetre is plenty. Turn your shoulders first and the scooter follows.',
    fact: 'It is the only way to change direction on a bank or in a bowl without putting a foot down.',
    mistakes: [
      { what: 'Kicking too hard.', fix: 'Nudge the front round; a small push turns you plenty.' },
      {
        what: 'Not lightening the front wheel.',
        fix: 'Put a little weight on your back foot so the front can swing.',
      },
      {
        what: 'Looking down at the wheel.',
        fix: 'Look where you want to end up; your body follows.',
      },
      {
        what: 'Turning the bars, not your shoulders.',
        fix: 'Turn your shoulders first and let the scooter come round after.',
      },
    ],
    hard: 'Rookie because you barely lift anything, and you can put the wheel down whenever you like. The point is learning to lighten the front and turn with your shoulders, which every spin uses later.',
    isLive: true,
  },
  {
    id: 'nose-pivot',
    name: 'Nose Pivot',
    sport: 'scooter',
    cat: 'flat',
    diff: 2,
    pre: ['fakie'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Balance on the front wheel for a moment and swing the back of the scooter a half turn around it, landing rolling backwards.',
    tips: 'Press down over the bars until the back wheel just clears, then turn your hips. Roll slowly for the first few.',
    fact: 'It is a 180 you can learn without leaving the ground, which makes it a cheap way to find out which way you like to spin.',
    mistakes: [
      {
        what: 'Lifting the back wheel too high.',
        fix: 'Press over the bars just enough for the back wheel to clear.',
      },
      {
        what: 'Turning from the arms.',
        fix: 'Twist your hips and lean sideways; the back end swings round after.',
      },
      { what: 'Rolling in fast.', fix: 'Go slowly until the half turn is smooth.' },
      {
        what: 'Landing and forgetting the fakie.',
        fix: 'Look over your shoulder as you land so you roll away backwards in control.',
      },
    ],
    hard: 'You already ride fakie; now you must land into it from a half turn on the front wheel. The front wheel is the twitchy one to balance on, so this sits above a kickturn.',
    isLive: true,
  },
  {
    id: 'powerslide',
    name: 'Powerslide',
    sport: 'scooter',
    cat: 'flat',
    diff: 2,
    pre: ['manual'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Kick the back wheel out sideways so it skids across the ground while the front keeps rolling, then straighten up and carry on.',
    tips: 'Build a bit of speed and lean back as you push the tail out. Smooth concrete slides, rough tarmac grabs.',
    fact: 'It is a stopping trick as much as a trick trick. Riders use it to scrub speed at the top of a bank.',
    mistakes: [
      {
        what: 'Not turning your shoulders.',
        fix: 'Turn your shoulders and hips into the slide; that starts the skid.',
      },
      {
        what: 'Leaning too far back.',
        fix: 'Keep your weight over the deck or the back wheel skids out from under you.',
      },
      {
        what: 'Half committing.',
        fix: 'Push the tail out properly; a hesitant push just judders.',
      },
      {
        what: 'Trying it on rough ground.',
        fix: 'Find smooth concrete; rough tarmac grabs the wheel and stops it dead.',
      },
    ],
    hard: 'A manual taught you to shift weight to the back wheel. Here you throw that weight sideways and let the wheel skid, trusting a wheel that is not gripping. Low and slow keeps it Easy.',
    isLive: true,
  },
  {
    id: 'cali-slider',
    name: 'Cali Slider',
    sport: 'scooter',
    cat: 'flat',
    diff: 2,
    pre: ['manual'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Hook your back heel under the tail of the deck so it lifts slightly, then ride along with the tail skimming the ground behind you.',
    tips: 'Find the hook standing still first. Lift just enough for the tail to touch — any more and the back wheel leaves the floor.',
    fact: 'You can hold it for as long as you like, which makes it a favourite for filming a line rather than a single trick.',
    mistakes: [
      {
        what: 'Hooking the heel too deep.',
        fix: 'Catch the tail with the edge of your heel; a deep hook lifts the whole back wheel.',
      },
      {
        what: 'Pulling up too far.',
        fix: 'Lift until the tail just kisses the ground and no more.',
      },
      {
        what: 'Trying it at speed first.',
        fix: 'Find the hook standing still, then roll at a walking pace.',
      },
      {
        what: 'Back knee locked.',
        fix: 'Keep the back knee bent so the hook stays steady over bumps.',
      },
    ],
    hard: 'A manual moves weight to the back wheel; this one keeps it there while your heel also holds the tail up. Two jobs for one foot, but low and slow, so it stays Easy.',
    isLive: true,
  },
  {
    id: 'chairman',
    name: 'Chairman',
    sport: 'scooter',
    cat: 'flat',
    diff: 2,
    pre: [],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Sit up on the handlebars facing forward with your legs hanging out over the front wheel, and roll along like that.',
    tips: 'Get moving first, then hop up — do not try to set off already sitting. Keep a hand either side of the bars.',
    fact: 'Nobody scores points for it. Everybody tries it once, usually while waiting their turn on a ramp.',
    mistakes: [
      {
        what: 'Hopping up while standing still.',
        fix: 'Get rolling first, then hop up; a still scooter tips the moment you sit.',
      },
      {
        what: 'Sitting to one side of the bars.',
        fix: 'Sit in the middle with a hand either side so the front wheel stays straight.',
      },
      {
        what: 'Letting your legs swing.',
        fix: 'Keep your legs still over the front wheel; swinging turns the bars.',
      },
      {
        what: 'Trying it on a slope.',
        fix: 'Flat ground only, where the scooter cannot pick up speed under you.',
      },
    ],
    hard: 'No trick comes before it because it is not built on a hop. Easy because you roll slowly on both wheels, but your weight sits over the front wheel with no feet to correct.',
    isLive: true,
  },
  {
    id: 'body-varial',
    name: 'Body Varial',
    sport: 'scooter',
    cat: 'flat',
    diff: 3,
    pre: ['bunny-hop'],
    about:
      'Hop clear of the deck, spin your body a half turn while the scooter stays where it is, and land back on it facing the other way.',
    tips: 'Jump straight up, not sideways. Keep hold of the bars the whole time so the scooter cannot get away from you.',
    fact: 'It is the cheapest way to find out how switch stance feels, because the scooter never actually moves.',
    mistakes: [
      {
        what: 'Jumping sideways.',
        fix: 'Jump straight up; the turn comes from your hips, not from where you jump.',
      },
      {
        what: 'Letting go of the bars.',
        fix: 'Keep both hands on so the scooter stays exactly where you left it.',
      },
      {
        what: 'Turning your head late.',
        fix: 'Look over your shoulder as you leave the deck; the rest of you follows.',
      },
      {
        what: 'Landing on the edge of the deck.',
        fix: 'Aim your feet for the middle and bend your knees as you land.',
      },
    ],
    hard: 'You turn half round while the scooter does not. The bunny hop is the same, but landing switch-footed on a deck that has not moved is a strange feeling your feet have to learn.',
    isLive: true,
  },
  {
    id: 'x-ride',
    name: 'X-Ride',
    sport: 'scooter',
    cat: 'flat',
    diff: 3,
    pre: ['x-up'],
    about:
      'Ride along flat ground with the bars turned right round and your arms crossed into an X, holding it there rather than snapping it back.',
    tips: 'Learn the X-Up first, then hold it a second longer each go. Keep your weight centred or the front wheel wanders.',
    fact: 'Holding the cross while you roll is the whole difference from an X-Up, and it is much harder than it looks.',
    mistakes: [
      {
        what: 'Snapping the bars back too soon.',
        fix: 'Hold the X a little longer each try instead of rushing back to straight.',
      },
      {
        what: 'Weight drifting to one side.',
        fix: 'Stay centred over the deck so the front wheel tracks straight.',
      },
      {
        what: 'Bars not fully turned.',
        fix: 'Turn them right round; half turned and the wheel steers off line.',
      },
      {
        what: 'Rolling too fast.',
        fix: 'Walking pace gives you time to feel the balance with crossed arms.',
      },
    ],
    hard: 'An X-up lasts a moment; the X-ride holds it while rolling. Steering with crossed arms and a backwards front wheel means every correction is the wrong way round, which is the step up.',
    isLive: true,
  },
  {
    id: 'weedwacker',
    name: 'Weedwacker',
    sport: 'scooter',
    cat: 'flat',
    diff: 3,
    pre: ['bar-spin'],
    about:
      'Set the bars spinning and swing one leg over the top of them as they go round, then put the foot back on the deck. All of it with the wheels on the ground.',
    tips: 'Get the bar spin landing consistently first. Swing the leg late — early is how you catch a shin.',
    fact: 'It is one of very few tricks where the bars spin a full turn and your wheels never leave the floor.',
    mistakes: [
      {
        what: 'Swinging the leg too early.',
        fix: 'Throw the bars first and let them start turning before your leg goes over.',
      },
      {
        what: 'Standing too upright.',
        fix: 'Crouch a little so the bars pass under your leg with room to spare.',
      },
      {
        what: 'Foot landing on the edge.',
        fix: 'Bring the foot back down on the middle of the deck.',
      },
      { what: 'Watching your foot.', fix: 'Keep your eyes on the bars so you catch them square.' },
    ],
    hard: 'The bar spin is done, but now a leg passes over the bars while they are still turning. It is timing between hand and foot, and a miss is a bar in the shin.',
    isLive: true,
  },
  {
    id: 'foot-jam',
    name: 'Foot Jam',
    sport: 'scooter',
    cat: 'flat',
    diff: 3,
    pre: ['nose-manual'],
    about:
      'Jam your front foot against the tyre behind the forks so the scooter stops dead and stalls up on the front wheel, then release it and roll away.',
    tips: 'Roll in slowly and put the foot in gently. Wear shoes with a solid sole — this one chews them.',
    fact: 'It is the base of the whiplash and most front-wheel tricks, and you can learn it on any flat bit of ground.',
    mistakes: [
      {
        what: 'Jamming the foot in hard.',
        fix: 'Press the sole in gently; a hard jam stops the scooter while you keep going.',
      },
      {
        what: 'Coming in with speed.',
        fix: 'Walking pace only; the tyre stops quicker than you think.',
      },
      {
        what: 'Foot in front of the forks.',
        fix: 'Push against the tyre behind the forks so the wheel cannot spit it out.',
      },
      {
        what: 'Arms straight and stiff.',
        fix: 'Bend your elbows so the stop does not throw you over the bars.',
      },
    ],
    hard: 'It is a nose manual with the front wheel stopped dead. The stall happens fast, so you go from rolling to balanced on one wheel in a moment, then have to release it cleanly.',
    isLive: true,
  },
  {
    id: 'hang-5',
    name: 'Hang-5',
    sport: 'scooter',
    cat: 'flat',
    diff: 4,
    pre: ['nose-manual'],
    about:
      'Roll along on the front wheel alone with one foot on the deck and the other hanging off the side. A nose manual with half your balance taken away.',
    tips: 'Get nose manuals long and steady first. Move the free foot out slowly — a quick swing throws the whole thing sideways.',
    fact: 'BMX has a trick with the same name that is nothing like this one. On a scooter it is a nose manual variation.',
    mistakes: [
      {
        what: 'Swinging the free foot quickly.',
        fix: 'Slide it off slowly; a fast swing throws the whole balance sideways.',
      },
      {
        what: 'Throwing your body forward.',
        fix: 'Pivot from the shoulders and draw the deck foot under you.',
      },
      {
        what: 'Deck foot off centre.',
        fix: 'Put it under the middle of the balance so the free foot can swing to steady you.',
      },
      {
        what: 'Bent arms.',
        fix: 'Push the arms nearly straight so the bars take some of your weight.',
      },
    ],
    hard: 'A nose manual with one foot gone. You had two feet to make small corrections; now one is dangling and the other has to do everything, on the twitchy wheel.',
    isLive: true,
  },
  {
    id: 'pogo',
    name: 'Pogo',
    sport: 'scooter',
    cat: 'flat',
    diff: 4,
    pre: ['manual', 'foot-jam'],
    about:
      'Tuck the bars into your waist, hook your front leg under the deck and hop along on the back wheel only, like a pogo stick.',
    tips: 'Find the upright balance point against a wall first. Small hops, and keep the bars pressed into you the whole time.',
    fact: 'It is one of the oldest scooter tricks there is, and one of the very few where you never travel forwards.',
    mistakes: [
      {
        what: 'Jumping off the deck.',
        fix: 'Pull the bars up into you and let the scooter come up with your feet.',
      },
      {
        what: 'Hopping straight up.',
        fix: 'Hop towards the side you are falling to, deck first, so it stays under you.',
      },
      {
        what: 'Bars drifting from your waist.',
        fix: 'Keep the bars pressed against you the whole time.',
      },
      { what: 'Big hops.', fix: 'Small quick hops; a big hop has time to tip.' },
    ],
    hard: 'It leaves rolling behind completely: you balance on one wheel standing up and keep the balance by hopping. Each hop is a fresh balance point, with no speed to help.',
    isLive: true,
  },
  {
    id: 'tail-tap',
    name: 'Tail Tap',
    sport: 'scooter',
    cat: 'street',
    diff: 1,
    pre: ['bunny-hop'],
    about:
      'Roll at a low kerb, hop so the back wheel taps the edge of it, then come straight back down and ride away.',
    tips: 'A kerb, not a ledge. Hop early enough that you are already on the way down when the wheel touches.',
    fact: 'For most riders it is the first trick done on an obstacle rather than on flat ground.',
    mistakes: [
      {
        what: 'Hopping too late.',
        fix: 'Pop early enough that the wheel touches on your way down.',
      },
      {
        what: 'Slamming the wheel down.',
        fix: 'Tap the edge lightly so it does not bounce you off line.',
      },
      {
        what: 'Using a high ledge.',
        fix: 'A kerb is plenty; start low and stay low until it feels smooth.',
      },
      { what: 'Looking at the kerb.', fix: 'Look past it at where you will roll away.' },
    ],
    hard: 'Only a bunny hop before it. It is Rookie because the kerb is low and you land where you would have anyway; the new bit is timing the hop against something.',
    isLive: true,
  },
  {
    id: 'acid-drop',
    name: 'Acid Drop',
    sport: 'scooter',
    cat: 'street',
    diff: 2,
    pre: ['bunny-hop'],
    supervise: true,
    about:
      'Roll straight off the edge of a ledge, a step or a ramp lip and land with both wheels touching down at the same moment.',
    tips: 'Start off something knee high. Weight centred, knees soft — leaning back is what makes the front end kick up on landing.',
    fact: 'Landing both wheels together is the whole trick. Nose first is how wrists and bars get hurt, so the height goes up slowly.',
    mistakes: [
      {
        what: 'Leaning back off the edge.',
        fix: 'Keep your weight centred so the front wheel does not kick up on landing.',
      },
      { what: 'Rolling off at a crawl.', fix: 'A little speed carries both wheels off together.' },
      {
        what: 'Straight legs on landing.',
        fix: 'Bend your knees as you touch so the drop is absorbed, not felt.',
      },
      { what: 'Looking at the edge.', fix: 'Look at the landing spot before you roll off.' },
    ],
    hard: 'There is no hop in it, but there is no way to stop once the front wheel leaves. That commitment is why it is Easy and not Rookie, and why a grown-up should be around.',
    isLive: true,
  },
  {
    id: 'pole-tap',
    name: 'Pole Tap',
    sport: 'scooter',
    cat: 'street',
    diff: 3,
    pre: ['tail-tap', 'bunny-hop'],
    about:
      'Hop towards an upright pole so the tail of the deck taps against it in mid-air, then land and ride away.',
    tips: 'Aim to tap high on the pole rather than low, and come in at a slight angle so you are not riding straight into it.',
    fact: 'A scaffold pole or a lamp post will do. It is one of the few street tricks that needs no ledge at all.',
    mistakes: [
      {
        what: 'Riding straight at the pole.',
        fix: 'Come in at a slight angle so you pass beside it after the tap.',
      },
      {
        what: 'Tapping low on the pole.',
        fix: 'Aim high; a low tap catches the deck and stops it.',
      },
      {
        what: 'Hop too small.',
        fix: 'Get a proper bunny hop; the tap comes at the top, not the bottom.',
      },
      {
        what: 'Pushing off the pole.',
        fix: 'Just touch it; pushing sends the back end away and you land twisted.',
      },
    ],
    hard: 'A tail tap with the target turned upright. Kerbs are under you; a pole is beside you, so the hop has to be higher and angled, and the miss is a wheel into a pole.',
    isLive: true,
  },
  {
    id: 'boardslide',
    name: 'Boardslide',
    sport: 'scooter',
    cat: 'street',
    diff: 3,
    pre: ['bunny-hop', '50-50'],
    // Free by the free-tier shape at the top of this file.
    free: true,
    about:
      'Hop onto a low ledge sideways so the underside of the deck slides along the edge while you stay facing forwards.',
    tips: 'A waxed ledge, low enough to step off. Land with the deck square across the edge, never at an angle.',
    fact: 'Scooter riders took the name and the trick from skateboarding, where the deck really is the board.',
    mistakes: [
      {
        what: 'Landing at an angle.',
        fix: 'Turn the deck a full quarter so it sits square across the edge.',
      },
      {
        what: 'Looking down at the deck.',
        fix: 'Look ahead along the ledge to where you drop off.',
      },
      {
        what: 'Feet too close together.',
        fix: 'Front foot near the headtube, back foot at the tail, so the deck stays level.',
      },
      { what: 'Trying a tall ledge first.', fix: 'Pick one low enough to step off.' },
    ],
    hard: 'A 50-50 is a ledge under your pegs; this is a ledge under the deck, sideways. Your body faces forward while the scooter faces across, and that twist is what makes it Spicy.',
    isLive: true,
  },
  {
    id: 'double-peg',
    name: 'Double Peg Grind',
    sport: 'scooter',
    cat: 'street',
    diff: 3,
    pre: ['50-50'],
    about:
      'Grind along a ledge on both pegs on one side of the scooter. You need pegs fitted to do it at all — they bolt on beside the wheels.',
    tips: 'Wax a low ledge and land both pegs at once. If your scooter has no pegs yet, this one has to wait until it does.',
    fact: 'Pegs are the cheapest upgrade that opens a whole category of tricks. Most street riders run two, some run four.',
    mistakes: [
      {
        what: 'Pegs hitting one at a time.',
        fix: 'Land both pegs together or the scooter twists off the ledge.',
      },
      {
        what: 'Weight on the wrong side.',
        fix: 'Keep your weight centred over the deck, not hanging over the ledge.',
      },
      {
        what: 'Loose pegs.',
        fix: 'Check the peg bolts are tight before you grind; a slipping peg stops you dead.',
      },
      {
        what: 'No wax on the ledge.',
        fix: 'Wax a low ledge so the pegs slide instead of grabbing.',
      },
    ],
    hard: 'A 50-50 on one side of the scooter, so you grind beside the ledge rather than on it. Both pegs share the work, but your weight sits off the edge. You need pegs fitted.',
    isLive: true,
  },
  {
    id: 'lipslide',
    name: 'Lipslide',
    sport: 'scooter',
    cat: 'street',
    diff: 4,
    pre: ['boardslide'],
    about:
      'A boardslide entered the other way round: the back of the scooter comes over the ledge first, so you slide with your back to the obstacle.',
    tips: 'Boardslides need to be automatic first. Bring the back end over higher than feels necessary — clipping the edge is the usual bail.',
    fact: 'From the front it looks almost identical to a boardslide, which is exactly why riders make a point of it.',
    mistakes: [
      { what: 'Coming in too slow.', fix: 'Carry enough speed for a clean hop over the ledge.' },
      {
        what: 'Back end clipping the edge.',
        fix: 'Lift the tail higher than feels needed as it passes over.',
      },
      {
        what: 'Shoulders facing the wrong way.',
        fix: 'Keep your shoulders square to the ledge so the slide stays balanced.',
      },
      {
        what: 'Dropping in at an angle.',
        fix: 'Land the deck square across the ledge, the same as a boardslide.',
      },
    ],
    hard: 'A boardslide where the back end goes over the ledge first. You have to hop higher and further, and you slide with your back to the obstacle, so you cannot see the ledge under you.',
    isLive: true,
  },
  {
    id: 'nose-grind',
    name: 'Nose Grind',
    sport: 'scooter',
    cat: 'street',
    diff: 4,
    pre: ['50-50', 'double-peg'],
    about:
      'Grind a ledge balanced on the front peg alone with the back of the scooter held clear. Pegs are needed, and the front one takes the whole trick.',
    tips: 'Keep your weight forward over the bars the entire time. The moment it drifts back the rear peg touches and you stop dead.',
    fact: 'It is the same idea as a skateboard nosegrind, and just as unforgiving about where your weight is.',
    mistakes: [
      {
        what: 'Weight sliding back.',
        fix: 'Keep your weight forward over the bars; drift back and the rear peg catches.',
      },
      { what: 'Back end held too low.', fix: 'Lift the tail well clear of the ledge.' },
      {
        what: 'Front peg missing the edge.',
        fix: 'Set the front peg down on the ledge first, then let the tail lift.',
      },
      {
        what: 'Coming in too straight.',
        fix: 'Angle in slightly nose-first so the back end can clear.',
      },
    ],
    hard: 'A double peg has two pegs on the ledge; this has one, at the front. You balance on it with your weight over the bars, a nose manual on a ledge. Pegs are needed.',
    isLive: true,
  },
  {
    id: 'crooked-grind',
    name: 'Crooked Grind',
    sport: 'scooter',
    cat: 'street',
    diff: 4,
    pre: ['nose-grind'],
    about:
      'A nose grind with the deck angled away from the ledge so only the front peg and the edge of the deck touch. Pegs needed for this one too.',
    tips: 'Land it already crooked rather than straightening into it. Wax helps more here than on any other grind.',
    fact: 'The angle is the point. A crooked grind that ends up straight is just a nose grind.',
    mistakes: [
      {
        what: 'Straightening into it.',
        fix: 'Land already angled; the crook is set in the air, not on the ledge.',
      },
      {
        what: 'Deck angled too far.',
        fix: 'A small angle is enough; too much and the deck stops on the ledge.',
      },
      {
        what: 'Weight back on the deck.',
        fix: 'Stay forward over the front peg for the whole slide.',
      },
      { what: 'Dry ledge.', fix: 'Wax it well; the deck edge grabs more than a peg does.' },
    ],
    hard: 'A nose grind with the deck angled out, so the deck edge drags along the ledge as well as the peg. Two surfaces slide at once, and the angle is set mid-air. Pegs needed.',
    isLive: true,
  },
  {
    id: 'wallride',
    name: 'Wallride',
    sport: 'scooter',
    cat: 'street',
    diff: 4,
    pre: ['bunny-hop', 'acid-drop'],
    about:
      'Ride at a wall, lean into it and roll along the vertical surface with both wheels, then come back down to the ground.',
    tips: 'Approach at an angle rather than straight on, and commit. A wall with a bank or a kerb at the bottom is far easier than a flat one.',
    fact: 'Speed is what holds you on the wall. Riders who bail almost always slowed down at the last second.',
    mistakes: [
      {
        what: 'Riding at the wall straight on.',
        fix: 'Come in at an angle so you can roll along the wall, not into it.',
      },
      {
        what: 'Not getting sideways enough.',
        fix: 'Lean your body towards level with the wall so the wheels stick.',
      },
      { what: 'Too slow.', fix: 'Carry speed; the wall only holds you while you are moving.' },
      {
        what: 'Forgetting the exit.',
        fix: 'Hop or drop off before you slow down and the wheels peel away.',
      },
    ],
    hard: 'A bunny hop gets you on and an acid drop gets you off; the middle is new. Your wheels stay on the wall only while speed and angle are right, and both run out fast.',
    isLive: true,
  },
  {
    id: 'wall-plant',
    name: 'Wall Plant',
    sport: 'scooter',
    cat: 'street',
    diff: 4,
    pre: ['wallride'],
    about:
      'Hop at a wall and plant a foot flat against it while the scooter stays in the air underneath you, then push off and land.',
    tips: 'Plant with the ball of your foot, not the toe, and push away from the wall as much as up.',
    fact: 'It is what lets you use a wall with nothing at the bottom of it, where a wallride would never hold.',
    mistakes: [
      { what: 'Planting the toe.', fix: 'Plant with the ball of your foot flat on the wall.' },
      {
        what: 'Pushing only up.',
        fix: 'Push away from the wall as well as up so you land clear of it.',
      },
      {
        what: 'Scooter drifting away.',
        fix: 'Keep hold of the bars and pull the scooter under you as you push off.',
      },
      {
        what: 'Planting low.',
        fix: 'Hop first and plant high so you have room to come back down.',
      },
    ],
    hard: 'In a wallride the wheels touch the wall; here your foot does, while the scooter hangs in the air. You leave the deck and get back on in one hop, which the wallride never asked.',
    isLive: true,
  },
  {
    id: 'rail-ride',
    name: 'Rail-Ride',
    sport: 'scooter',
    cat: 'street',
    diff: 4,
    pre: ['50-50', 'manual'],
    about:
      'Ride along the top of a low flat rail with both wheels on it, travelling down its length rather than grinding across it.',
    tips: 'A low flat rail or a ledge with a rounded edge, never a handrail. Get on straight and look at the far end, not at the wheels.',
    fact: 'It is a balance trick rather than a grind — nothing slides, and the wheels do all the work.',
    mistakes: [
      {
        what: 'Getting on at an angle.',
        fix: 'Hop on dead straight so both wheels sit along the rail.',
      },
      {
        what: 'Watching your wheels.',
        fix: 'Look at the far end of the rail; wheels follow eyes.',
      },
      { what: 'Stiff legs.', fix: 'Bend your knees so tiny corrections stay tiny.' },
      {
        what: 'Picking a rail that is too high.',
        fix: 'A low flat rail or a rounded ledge only, close enough to step off.',
      },
    ],
    hard: 'A grind slides on pegs; this rolls on wheels, with nothing locking you on. It is a manual’s balance on something the width of a wheel, which is why it sits above the 50-50.',
    isLive: true,
  },
  {
    id: 'whip-out',
    name: 'Whip Out',
    sport: 'scooter',
    cat: 'street',
    diff: 5,
    pre: ['50-50', 'tailwhip', '180-grind-out'],
    about:
      'Grind a ledge, then hop out of the grind straight into a full tailwhip and catch the deck before you land.',
    tips: 'The whip has to be automatic before you throw one out of a grind. Pop up off the end first, then kick — not both at once.',
    fact: 'Coming out of a grind you have less pop and less time than off flat ground, which is the whole difficulty.',
    mistakes: [
      {
        what: 'Kicking while still on the ledge.',
        fix: 'Pop up off the end first, then kick the deck.',
      },
      {
        what: 'Hopping out low.',
        fix: 'Get real height off the ledge; the whip needs time to go round.',
      },
      {
        what: 'Losing sight of the deck.',
        fix: 'Watch the deck all the way round and catch it with both feet.',
      },
      {
        what: 'Grinding too slowly.',
        fix: 'Carry speed through the grind so you have momentum for the hop.',
      },
    ],
    hard: 'Every part is already yours: the grind, the hop out, the whip. Pro because the whip starts from a slide with no ground under it, and the catch lands as your speed runs out.',
    isLive: true,
  },
  {
    id: 'pump',
    name: 'Pump',
    sport: 'scooter',
    cat: 'park',
    diff: 1,
    pre: [],
    about:
      'Speed without pushing. Sink down through the bottom of a transition and stand tall as it flattens out, and the ramp hands the speed back to you.',
    tips: 'Time it against the shape of the ramp, not against a count. Your legs do the work and the bars stay still.',
    fact: 'Pumping is how a rider links a whole run together without ever putting a foot down for speed.',
    mistakes: [
      {
        what: 'Standing tall the whole way.',
        fix: 'Crouch as you go into the transition so you have somewhere to stand up from.',
      },
      {
        what: 'Standing up too late.',
        fix: 'Start pushing your legs straight as the ramp curves, not once you are already back on the flat.',
      },
      {
        what: 'Pulling on the bars for speed.',
        fix: 'The push comes from your legs into the deck; pulling the bars just lifts the front wheel.',
      },
      {
        what: 'Stiff knees on the way down.',
        fix: 'Let your knees bend as the ramp steepens so the scooter stays on the surface.',
      },
    ],
    hard: 'It is the first ramp skill and needs no air, which is why it starts the ladder. The catch is timing: the push only works in the curve of the transition.',
    isLive: true,
  },
  {
    id: 'drop-in',
    name: 'Drop In',
    sport: 'scooter',
    cat: 'park',
    diff: 2,
    pre: ['pump'],
    supervise: true,
    about:
      'Back wheel on the coping, deck hanging over the transition, then commit your weight forward and roll in.',
    tips: 'Weight over the front, both wheels down together, and go the first time you think about it. Half-committing is what puts riders down.',
    fact: 'It is the moment a park stops being a set of obstacles you ride around and starts being one you ride.',
    mistakes: [
      {
        what: 'Learning it on the biggest ramp there.',
        fix: 'Start on the smallest quarter you can find and move up one ramp at a time.',
      },
      {
        what: 'Nobody watching the first ones.',
        fix: 'The first drop-ins happen with someone watching from the bottom, because a lean-back fall lands you flat.',
      },
      {
        what: 'Front wheel pushed out into the air.',
        fix: 'Keep the front wheel close to the coping so it meets the ramp surface, not the flat.',
      },
      {
        what: 'Bars turned as you tip in.',
        fix: 'Point the bars straight down the ramp and keep them there until you reach the bottom.',
      },
    ],
    hard: 'Pumping keeps you inside the ramp. A drop-in starts on the coping and asks you to lean out over the transition, which is the first moment on a ramp you cannot step out of.',
    isLive: true,
  },
  {
    id: 'quarter-pipe-air',
    name: 'Quarter Pipe Air',
    sport: 'scooter',
    cat: 'park',
    diff: 2,
    pre: ['pump', 'fakie'],
    about:
      'Ride up and out of the lip of a quarter pipe, turn back towards the ramp above the coping, and drop into the transition.',
    tips: 'Start with the wheels barely leaving the coping and build up from there. Look back into the ramp as you turn.',
    fact: 'Almost every park trick above this one is this trick with something added while you are in the air.',
    mistakes: [
      {
        what: 'Slowing down before the lip.',
        fix: 'Carry your speed all the way up; braking at the top leaves you with no air at all.',
      },
      {
        what: 'Jumping off the coping.',
        fix: 'Let the ramp send you up; a hop at the lip throws the scooter away from the transition.',
      },
      {
        what: 'Turning too late.',
        fix: 'Start turning the bars as the back wheel leaves the coping so you land pointing down the ramp.',
      },
      {
        what: 'Landing on the flat bottom.',
        fix: 'Aim to touch down on the transition with both wheels, well below the coping.',
      },
    ],
    hard: 'Pumping keeps the wheels on the ramp and fakie only teaches rolling backwards. An air puts the whole scooter above the coping and asks you to turn and find the ramp again coming down.',
    isLive: true,
  },
  {
    id: 'bank-transfer',
    name: 'Bank Transfer',
    sport: 'scooter',
    cat: 'park',
    diff: 2,
    pre: ['quarter-pipe-air'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Ride out of one bank or ramp and land in another, crossing the gap between them without touching the flat.',
    tips: 'Pick two ramps that already face each other, and look at your landing rather than at the gap.',
    fact: 'Transfers are how riders read a park as one run instead of a set of separate obstacles.',
    mistakes: [
      {
        what: 'Too little speed for the gap.',
        fix: 'Roll in faster than feels needed; landing short on the flat is the usual fall.',
      },
      {
        what: 'Popping straight up off the first ramp.',
        fix: 'Let the take-off ramp send you across, and lean slightly towards the landing.',
      },
      {
        what: 'Looking down into the gap.',
        fix: 'Eyes on the second ramp; you land where you look.',
      },
      {
        what: 'Landing with locked legs.',
        fix: 'Bend your knees as the wheels meet the second bank so the slope takes the speed.',
      },
    ],
    hard: 'A quarter pipe air lands you back where you left. A transfer lands on a different ramp across a gap, so speed and line must be right before take-off, not fixed in the air.',
    isLive: true,
  },
  {
    id: 'one-hander',
    name: 'One Hander',
    sport: 'scooter',
    cat: 'park',
    diff: 2,
    pre: ['quarter-pipe-air'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Let go with one hand at the top of an air, hold it out to the side, and get it back on the bars before you land.',
    tips: 'Let go later than feels right and grab back early. Keep the other hand firmly in the middle of the grip.',
    fact: 'It is the first trick where you deliberately stop holding on, and everything no-handed grows out of it.',
    mistakes: [
      {
        what: 'Letting go on the way up.',
        fix: 'Wait for the weightless moment at the top; the hand comes off when nothing is pulling.',
      },
      {
        what: 'Bars turning as the hand comes off.',
        fix: 'Lock your remaining wrist so the front wheel stays pointed where it was.',
      },
      {
        what: 'Waving the free arm about.',
        fix: 'Hold it out steady to the side; a flailing arm twists your shoulders.',
      },
      {
        what: 'Watching your hand instead of the landing.',
        fix: 'Keep your eyes on the ramp so the hand goes back on without thinking.',
      },
    ],
    hard: 'The air itself is the same one you already have. What changes is that one hand leaves the bars at the top, and the other has to hold the scooter straight on its own.',
    isLive: true,
  },
  {
    id: 'indy-grab',
    name: 'Indy Grab',
    sport: 'scooter',
    cat: 'park',
    diff: 2,
    pre: ['quarter-pipe-air'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Reach down in mid-air and grab the deck between your feet on the side your toes point to, then let go again to land.',
    tips: 'Bring the scooter up to your hand rather than reaching down for it. Suck your knees up as you go.',
    fact: 'Grabs reached scooters from BMX and skateboarding, and this is the one nearly everybody learns first.',
    mistakes: [
      {
        what: 'Bending at the waist to reach.',
        fix: 'Keep your back straight and lift your knees; the deck should come to you.',
      },
      {
        what: 'Grabbing with the wrong hand.',
        fix: 'Reach with the hand on the side your toes point to, between your feet.',
      },
      {
        what: 'Holding the grab too long.',
        fix: 'Let go as soon as you start dropping so both hands are back for the landing.',
      },
      {
        what: 'Both hands off the bars.',
        fix: 'The other hand stays on the grip the whole time and keeps the bars straight.',
      },
    ],
    hard: 'The quarter pipe air is the base. An indy adds a reach down to the deck at the top, which pulls your weight forward unless your knees come up to meet it.',
    isLive: true,
  },
  {
    id: 'rock-n-roll',
    name: "Rock 'n' Roll",
    sport: 'scooter',
    cat: 'park',
    diff: 3,
    pre: ['fakie', 'quarter-pipe-air'],
    about:
      'Hang the front wheel over the coping with the back wheel still in the transition, rock there for a beat, then come back down riding backwards.',
    tips: 'Get right over the coping before you lean back, and lift the front wheel clear on the way down or it catches.',
    fact: 'Plenty of riders call the same trick a rock to fakie. Both names describe exactly this.',
    mistakes: [
      {
        what: 'Arriving at the coping too slowly.',
        fix: 'Carry enough speed that the front wheel clears the coping without a hop.',
      },
      {
        what: 'Leaning back while the front wheel climbs.',
        fix: 'Let the deck settle on the coping first, then shift your weight towards the ramp.',
      },
      {
        what: 'Turning the bars during the rock.',
        fix: 'Keep the bars straight the whole time; you are coming back down the way you went up.',
      },
      {
        what: 'Rushing the fakie roll-out.',
        fix: 'Ride the transition backwards for a few metres before turning round.',
      },
    ],
    hard: "A quarter pipe air stays in the ramp. A rock 'n' roll hangs the scooter on the coping and comes back down backwards, so it joins a stall with a fakie ride you must trust.",
    isLive: true,
  },
  {
    id: 'half-cab',
    name: 'Half Cab',
    sport: 'scooter',
    cat: 'park',
    diff: 3,
    pre: ['fakie', '180'],
    about: 'Rolling backwards, hop and turn a half rotation so you land riding forwards again.',
    tips: 'Look over the shoulder you are turning towards before you pop. Riding fakie has to be comfortable first.',
    fact: 'It is named after the full cab, which is the same thing with twice the spin. Most riders get the half first.',
    mistakes: [
      {
        what: 'Rolling too slowly into it.',
        fix: 'A little speed keeps the fakie roll stable; a crawling scooter wobbles as you hop.',
      },
      {
        what: 'Turning the bars before the hop.',
        fix: 'Hop first, then turn shoulders and bars together, so the scooter comes round in the air.',
      },
      {
        what: 'Stopping at a quarter turn.',
        fix: 'Keep the head turning until you see the way you came from; that is the full half.',
      },
      {
        what: 'Landing on the front wheel first.',
        fix: 'Aim for both wheels together so the forward roll-out is level.',
      },
    ],
    hard: 'A 180 starts from riding forwards, which is where your balance lives. A half cab starts rolling backwards, so the hop, the turn and the spot all begin from the less steady stance.',
    isLive: true,
  },
  {
    id: 'no-hander',
    name: 'No Hander',
    sport: 'scooter',
    cat: 'park',
    diff: 3,
    pre: ['one-hander', 'quarter-pipe-air'],
    about:
      'Both hands off the bars at the top of an air, arms out to the sides, feet staying on the deck, then back on the grips to land.',
    tips: 'Squeeze the deck with your feet the whole time. Let go for a fraction of a second at first and build up.',
    fact: 'The scooter goes exactly where you left it, which is why the feet matter far more than the hands.',
    mistakes: [
      {
        what: 'Letting go while the scooter is still rising.',
        fix: 'Both hands come off only at the very top, when the scooter is floating with you.',
      },
      {
        what: 'Pushing the bars away as you release.',
        fix: 'Open your hands in place; a push sends the bars turning and the scooter away.',
      },
      {
        what: 'Arms out but eyes on your hands.',
        fix: 'Look at the bars so they are exactly where you expect when you grab back.',
      },
      {
        what: 'Grabbing back with one hand first.',
        fix: 'Both hands return together so the bars do not twist on landing.',
      },
    ],
    hard: 'A one hander always keeps something steering. A no hander lets both hands go, so for that moment only your feet hold the scooter and nothing holds the bars straight.',
    isLive: true,
  },
  {
    id: 'tuck-no-hander',
    name: 'Tuck No Hander',
    sport: 'scooter',
    cat: 'park',
    diff: 3,
    pre: ['no-hander'],
    about:
      'Tuck the steering tube between your knees so your legs hold the scooter, then throw both arms out wide.',
    tips: 'Pull the bars into your knees before you let go, not after. Squeeze hard — the legs are doing all the holding.',
    fact: 'It reads much bigger than a plain no-hander, because the arms can go straight out instead of hovering near the bars.',
    mistakes: [
      {
        what: 'Bars pulled to the chest, not the knees.',
        fix: 'Bring the bars down and in so the tube sits between your knees, not your stomach.',
      },
      {
        what: 'Knees too wide to grip.',
        fix: 'Bring your knees together as the bars come in; the pinch is what holds the scooter.',
      },
      {
        what: 'Letting go and then tucking.',
        fix: 'Tuck, feel the pinch, then open your hands; the order matters.',
      },
      {
        what: 'Straightening the legs to land.',
        fix: 'Get the hands back on before your knees release the tube, then stand up.',
      },
    ],
    hard: 'A no hander only asks you to let go for a beat. A tuck no hander pins the bars between your knees first, so you have to fold, pinch and release in the right order.',
    isLive: true,
  },
  {
    id: 'table-top',
    name: 'Table Top',
    sport: 'scooter',
    cat: 'park',
    diff: 3,
    pre: ['quarter-pipe-air', 'indy-grab'],
    about:
      'Turn the bars and lay the scooter flat out to one side at the top of an air, so the deck lies level like a table.',
    tips: 'Turn the bars and pull the deck up in one motion. Level it, then bring it straight back underneath you.',
    fact: 'It is judged on how flat you get it, and a half-turned table still gets called a table by everybody watching.',
    mistakes: [
      {
        what: 'Deck hanging down instead of flat.',
        fix: 'Lift with your knees and push the bars away so the deck rises level.',
      },
      {
        what: 'Laying it out on the way up.',
        fix: 'Start the shape at the peak; you need the drop to bring it back.',
      },
      {
        what: 'Turning the bars without the body.',
        fix: 'Lean your hips the same way as the bars so the whole scooter lies over.',
      },
      {
        what: 'Straightening late.',
        fix: 'Bring it back under you as soon as it is flat; the ground arrives faster than you think.',
      },
    ],
    hard: 'The air and the reach are from the tricks before it. A table top turns the bars and lifts the deck together, so the scooter leaves its line and must be brought back.',
    isLive: true,
  },
  {
    id: 'can-can',
    name: 'Can-Can',
    sport: 'scooter',
    cat: 'park',
    diff: 3,
    pre: ['no-footer'],
    about:
      'Swing both legs off one side of the deck in mid-air, hold the pose, then bring them back for the landing.',
    tips: 'Kick from the hips, not the knees. Get the feet back on early — reaching for the deck late is the usual bail.',
    fact: 'The name comes from the dance, and the leg position is genuinely the same one.',
    mistakes: [
      {
        what: 'Legs swung under the deck.',
        fix: 'Swing both legs up and over the edge of the deck, not beneath it.',
      },
      {
        what: 'Bars turning with your legs.',
        fix: 'Keep your arms firm so the scooter stays straight while your body goes sideways.',
      },
      {
        what: 'Reaching back one foot at a time.',
        fix: 'Bring both feet back over together so they land side by side on the deck.',
      },
      {
        what: 'Holding the pose past the peak.',
        fix: 'The legs come back the moment you feel yourself start to drop.',
      },
    ],
    hard: 'A no footer takes the feet off and puts them back where they were. A can-can moves both legs to one side of the scooter, which shifts your weight and makes the way back longer.',
    isLive: true,
  },
  {
    id: 'airwalk',
    name: 'Airwalk',
    sport: 'scooter',
    cat: 'park',
    diff: 3,
    pre: ['no-footer'],
    about:
      'Kick both feet out in opposite directions mid-air, one forward and one back, then bring them together on the deck to land.',
    tips: 'Split them properly — a small split just reads as a wobble. Hold the bars firm so the scooter stays under you.',
    fact: 'It came from skateboarding, where the front hand grabs the nose. On a scooter the bars already do that job.',
    mistakes: [
      {
        what: 'Kicking down instead of out.',
        fix: 'Send one foot forward and one back level with the deck, not towards the ground.',
      },
      {
        what: 'Kicking the deck away as you split.',
        fix: 'Lift your feet clear of the deck first, then split, so the scooter stays put.',
      },
      {
        what: 'Leaning back as the front foot goes.',
        fix: 'Keep your chest over the bars so the split does not tip you.',
      },
      {
        what: 'Feet closing late.',
        fix: 'Snap them back to the deck at the top of the jump, with time to spare.',
      },
    ],
    hard: 'A no footer keeps both feet close to the deck. An airwalk sends them in opposite directions, so there is a wider shape to make and more distance for each foot to come back.',
    isLive: true,
  },
  {
    id: 'candy-bar',
    name: 'Candy Bar',
    sport: 'scooter',
    cat: 'park',
    diff: 3,
    pre: ['no-footer'],
    about:
      'Kick one foot up and over the handlebars in mid-air so the leg passes between the bars and your body, then bring it back.',
    tips: 'Bars low and level, and lift the knee high. Catching a heel on the bar is what stops most first attempts.',
    fact: 'It is the same shape as the BMX candybar, and one of the few tricks where the leg goes over the bars rather than the deck.',
    mistakes: [
      {
        what: 'Kicking the leg straight out.',
        fix: 'Bend the knee and lift it high; a straight leg cannot clear the bars.',
      },
      {
        what: 'Bars pulled up as the leg comes over.',
        fix: 'Push the bars down and away so there is room for the leg above them.',
      },
      {
        what: 'Other foot leaving the deck.',
        fix: 'Keep your standing foot planted; it is the only thing keeping the scooter under you.',
      },
      {
        what: 'Leg brought back too late.',
        fix: 'Swing it back over as soon as it has cleared; the deck is waiting below.',
      },
    ],
    hard: 'A no footer takes both feet off and back the same way. A candy bar sends one foot over the bars and returns it, so the leg has to clear the same obstacle twice.',
    isLive: true,
  },
  {
    id: 'turndown',
    name: 'Turndown',
    sport: 'scooter',
    cat: 'park',
    diff: 4,
    pre: ['table-top', 'quarter-pipe-air'],
    about:
      'Kick the deck out to one side and turn the bars down sharply without crossing your hands, then straighten it all out to land.',
    tips: 'The bars and the deck move together, and you straighten early. Being late is what turns a turndown into a crash.',
    fact: 'Tables and turndowns look similar in a photo. The difference is the bars, which point down rather than across.',
    mistakes: [
      {
        what: 'Crossing the hands.',
        fix: 'Turn the bars down with both hands staying on their own side of the stem.',
      },
      {
        what: 'Deck kicked out flat like a table.',
        fix: 'Kick the deck out and let the bars turn down past it, so the scooter twists.',
      },
      {
        what: 'Body staying upright.',
        fix: 'Let your shoulders turn with the bars; the trick is the whole body, not the wrists.',
      },
      {
        what: 'Waiting to see it before straightening.',
        fix: 'Start bringing the bars back as soon as they are down; you do not have time to admire it.',
      },
    ],
    hard: 'A table top lays the scooter flat. A turndown twists the bars down against a kicked-out deck, so the scooter is folded rather than laid out and takes longer to unfold.',
    isLive: true,
  },
  {
    id: 'cannonball',
    name: 'Cannonball',
    sport: 'scooter',
    cat: 'park',
    diff: 4,
    pre: ['no-footer', 'toboggan'],
    about:
      'Take both feet off, grab the deck with both hands and tuck into a ball in mid-air, then find the deck again to land.',
    tips: 'Both hands need to be on the deck before both feet come off. Tuck small and open up early.',
    fact: 'For a moment nothing holds the scooter except your hands, which is why a no-footer has to come first.',
    mistakes: [
      {
        what: 'One hand still on the bars.',
        fix: 'Both hands hold the deck, so the bars have to be let go completely before the tuck.',
      },
      {
        what: 'Feet leaving before the hands land.',
        fix: 'Grab first, kick second; the deck has to be in your hands before it leaves your feet.',
      },
      {
        what: 'Grabbing the deck by its edges.',
        fix: 'Hold it near the middle with both hands so it stays balanced and does not tip.',
      },
      {
        what: 'Unfolding feet first.',
        fix: 'Let go with the hands, get them back on the bars, then let the feet find the deck.',
      },
    ],
    hard: 'A toboggan keeps one hand on the bars. A cannonball puts both hands on the deck and both feet off, so nothing touches the bars and everything must go back before landing.',
    isLive: true,
  },
  {
    id: '720',
    name: 'The 720',
    sport: 'scooter',
    cat: 'park',
    diff: 5,
    pre: ['540'],
    supervise: true,
    about: 'Two full rotations in one air off a ramp. Riders call it a seven.',
    tips: 'Foam pit first, then resi. Wind up hard on the way in and spot your landing on the second lap, not the first.',
    fact: 'Two spins need the same air time as a 540 and twice the wind-up, so the ramp matters here as much as the rider.',
    mistakes: [
      {
        what: 'Going for it without foam or resi.',
        fix: 'A 720 goes into foam, then onto resi, with someone watching; a half-turn short lands you sideways.',
      },
      {
        what: 'Opening up after the first turn.',
        fix: 'Stay tight with elbows in until the second rotation is done; opening early stops the spin.',
      },
      {
        what: 'Spotting the landing on lap one.',
        fix: 'Let the first lap blur past and look for the landing only on the second.',
      },
      {
        what: 'Big first wind-up and nothing after.',
        fix: 'The spin has to keep going; keep turning your head all the way round.',
      },
    ],
    hard: 'A 540 is one and a half turns. A 720 needs two full turns from the same air, so you spend the whole flight spinning and have no slack for a slow start.',
    isLive: true,
  },
  {
    id: 'handplant',
    name: 'Handplant',
    sport: 'scooter',
    cat: 'air',
    diff: 5,
    pre: ['quarter-pipe-air', 'rock-n-roll'],
    supervise: true,
    about:
      'Plant one hand on the coping and go upside down with the scooter held under your feet, then come back down into the ramp.',
    tips: 'Learn the hand position on a low kerb long before you take it to coping. Helmet and pads on every attempt.',
    fact: 'It is one of the oldest ramp tricks in any wheeled sport, and it arrived on scooters from skateboarding.',
    mistakes: [
      {
        what: 'First tries on a real quarter.',
        fix: 'A handplant goes upside down on coping, so it is learned with someone watching and a soft landing nearby.',
      },
      {
        what: 'Planting the hand too late.',
        fix: 'Reach for the coping as the front wheel reaches it, not after you are already past.',
      },
      {
        what: 'Letting the scooter drift away.',
        fix: 'Keep the other hand on the bars and the feet squeezing the deck so it comes back with you.',
      },
      {
        what: 'Arriving at the coping too fast.',
        fix: 'Roll up just fast enough to reach the lip; extra speed throws you over the coping.',
      },
    ],
    hard: "A rock 'n' roll hangs the scooter on the coping the right way up. A handplant hangs you off it upside down on one arm, so your body is the part balanced on the lip.",
    isLive: true,
  },
  {
    id: 'flair-whip',
    name: 'Flair Whip',
    sport: 'scooter',
    cat: 'air',
    diff: 5,
    pre: ['flair', 'tailwhip'],
    supervise: true,
    about:
      'A flair — a backflip with a half turn in it — with a tailwhip thrown during the rotation, landing back into the ramp.',
    tips: 'Flairs have to be boring before you add a whip. Foam pit, then resi, then wood, in that order.',
    fact: 'Two rotations on two different axes at once. Very few riders have one, and fewer still put it in a run.',
    mistakes: [
      {
        what: 'Adding the whip on wood.',
        fix: 'The whip is added into foam and then on resi, with someone watching, before any hard ramp.',
      },
      {
        what: 'Kicking as you leave the lip.',
        fix: 'Throw the flair first and kick the whip once the rotation has started.',
      },
      {
        what: 'Bars drifting during the whip.',
        fix: 'Pin the bars to your chest so the deck spins round them and comes back to your feet.',
      },
      {
        what: 'Looking for the ramp before the deck.',
        fix: 'Spot the grip tape, catch it, then find the transition.',
      },
    ],
    hard: 'A flair is already a flip and a turn. Adding a whip means kicking the deck away while you are upside down and turning, then catching it before the ramp arrives.',
    isLive: true,
  },
  {
    id: 'backflip-no-hander',
    name: 'Backflip No Hander',
    sport: 'scooter',
    cat: 'air',
    diff: 5,
    pre: ['backflip'],
    supervise: true,
    about:
      'A backflip with both hands off the bars and the arms out to the sides, back on the grips before you land.',
    tips: 'Backflips into foam until they are dull. Let go at the top of the flip and take the hands straight back.',
    fact: 'Letting go upside down is as much a nerve trick as a physical one, which is why the flip comes first.',
    mistakes: [
      {
        what: 'Letting go on hard ground first.',
        fix: 'The hands come off into foam and then over resi, with someone watching, before a real landing.',
      },
      {
        what: 'Letting go as you throw the flip.',
        fix: 'Throw with both hands on; release only when you are already upside down.',
      },
      {
        what: 'Feet loosening as the hands go.',
        fix: 'Squeeze the deck harder with your feet as your hands open; they are all that holds the scooter.',
      },
      {
        what: 'Hands back on too late.',
        fix: 'Reach for the bars as soon as the landing appears, not when it arrives.',
      },
    ],
    hard: 'A backflip keeps both hands on the whole way. Letting go while upside down means your feet alone hold the scooter, and the bars have to be found again before the ground does.',
    isLive: true,
  },
  {
    id: 'backflip-barspin',
    name: 'Backflip Barspin',
    sport: 'scooter',
    cat: 'air',
    diff: 5,
    pre: ['backflip', 'bar-spin'],
    supervise: true,
    about:
      'A backflip with a full turn of the handlebars thrown and caught while you are upside down.',
    tips: 'Both halves have to be automatic on their own. Foam pit and resi before anything solid, every time.',
    fact: 'Catching the bars upside down makes the spin feel like it is going the other way. That is the part riders drill.',
    mistakes: [
      {
        what: 'Throwing the bars on a hard ramp first.',
        fix: 'The bars get thrown into foam, then on resi, with someone watching, before any solid landing.',
      },
      {
        what: 'Throwing the bars from the lip.',
        fix: 'Get the flip going first; throw the bars once you are upside down.',
      },
      {
        what: 'Losing the deck when the hands open.',
        fix: 'Grip the deck with your feet the whole time; the scooter comes with you only if they do.',
      },
      {
        what: 'Catching with one hand and hoping.',
        fix: 'Catch with both hands together so the bars are straight when the wheels land.',
      },
    ],
    hard: 'A backflip with both hands on is one thing to control. Spinning the bars while upside down means letting go of the scooter mid-flip and catching it again before the landing appears.',
    isLive: true,
  },
  {
    id: 'krippleflip',
    name: 'Krippleflip',
    sport: 'scooter',
    cat: 'air',
    diff: 5,
    pre: ['bri-flip', 'scooter-flip'],
    about:
      'The scooter flips backwards between your legs with both hands off the bars, and you catch it again with your feet.',
    tips: 'Bri flips and scooter flips both need to be dialled. Learn the catch over foam or a resi landing.',
    fact: 'The scooter does the flipping, not you, which makes it feel nothing like a backflip even though it looks close.',
    mistakes: [
      {
        what: 'Letting go with the deck still flat.',
        fix: 'Start the flip while your hands are still on; the release comes after it is already turning.',
      },
      {
        what: 'Legs together as the scooter flips.',
        fix: 'Keep your legs apart so the scooter has a gap to flip through.',
      },
      {
        what: 'Reaching for the bars first.',
        fix: 'Catch the deck with your feet first; the bars follow once the scooter is under you.',
      },
      {
        what: 'First tries over hard ground.',
        fix: 'Learn the catch over foam or resi, because a missed catch leaves the scooter anywhere.',
      },
    ],
    hard: 'A scooter flip keeps one hand on. A krippleflip lets both go and flips the scooter between your legs, so for a moment nothing connects you to it at all.',
    isLive: true,
  },
  {
    id: 'truck-driver',
    name: 'Truck Driver',
    sport: 'scooter',
    cat: 'hybrid',
    diff: 4,
    pre: ['360', 'bar-spin'],
    about: 'A full bar spin thrown and caught inside a 360. Riders also call it a 360 barspin.',
    tips: 'Throw the bars the instant you leave the ground so you have the whole spin left to catch them in.',
    fact: 'The name comes from the steering motion, and it is one of the most-used combinations in a contest run.',
    mistakes: [
      {
        what: 'Winding up the spin after the throw.',
        fix: 'Load the 360 before you leave the lip so the bars go the moment you are airborne.',
      },
      {
        what: 'Bars thrown against the spin.',
        fix: 'Spin the bars the same way you are turning so they come round with your body.',
      },
      {
        what: 'Watching the bars and losing the spot.',
        fix: 'Catch the bars by feel and keep your head turning for the landing.',
      },
      {
        what: 'Slowing the spin to catch.',
        fix: 'Keep rotating through the catch; stopping to grab leaves you short of the full turn.',
      },
    ],
    hard: 'The 360 and the bar spin each take your whole attention on their own. A truck driver runs both at once, so the catch happens while you are still spinning and still spotting.',
    isLive: true,
  },
  {
    id: 'bar-to-whip',
    name: 'Bar to Whip',
    sport: 'scooter',
    cat: 'hybrid',
    diff: 4,
    pre: ['bar-spin', 'tailwhip'],
    // Free by the free-tier shape at the top of this file.
    free: true,
    about:
      'A full bar spin thrown and caught, then a tailwhip straight after it, both inside the same jump.',
    tips: 'You need real height for this. Get the bars round early — everything after it depends on catching them fast.',
    fact: 'It is the reverse of a whip to bar, and most riders find one of the two much easier than the other.',
    mistakes: [
      {
        what: 'Kicking before the bars are caught.',
        fix: 'Catch the bars fully, then kick; a whip with loose bars goes nowhere.',
      },
      {
        what: 'Bars thrown late in the air.',
        fix: 'Throw the bars the moment you leave the ground so most of the air is left for the whip.',
      },
      {
        what: 'Feet lifting during the bar spin.',
        fix: 'Keep both feet planted through the spin; they only move once the bars are back.',
      },
      {
        what: 'Learning it on flat ground.',
        fix: 'Use a ramp or box; the whip needs air time the bar spin has already used.',
      },
    ],
    hard: 'Each half is a trick you have. A bar to whip needs the bars caught with air still left for a full whip, so the order and timing are new though the moves are not.',
    isLive: true,
  },
  {
    id: 'full-whip',
    name: 'Full Whip',
    sport: 'scooter',
    cat: 'hybrid',
    diff: 4,
    pre: ['tailwhip', 'heelwhip', 'bar-spin'],
    about:
      'A tailwhip and a bar spin at the same time, both turning the same way and both finished before you land.',
    tips: 'Kick and throw together rather than one then the other. Spot the grip tape and the bars coming round as one thing.',
    fact: 'Doing them at once takes less air time than doing them one after the other, which is why it needs less pop than a bar to whip.',
    mistakes: [
      {
        what: 'Bars and deck going opposite ways.',
        fix: 'Kick and throw in the same direction so the two catches arrive together.',
      },
      {
        what: 'Kick first, bars second.',
        fix: 'They leave at the same moment; a gap between them means one is late.',
      },
      {
        what: 'Catching the bars and ignoring the deck.',
        fix: 'Keep your eyes on the grip tape; the bars come back into your hands by feel.',
      },
      {
        what: 'Not enough height for both.',
        fix: 'Take it to a ramp or box where a bigger air gives both parts time.',
      },
    ],
    hard: 'A whip to bar does one thing after the other. A full whip does both at the same moment, so there is one kick, one throw and two catches all landing in the same beat.',
    isLive: true,
  },
  {
    id: 'rewind',
    name: 'Rewind',
    sport: 'scooter',
    cat: 'hybrid',
    diff: 4,
    pre: ['tailwhip', 'heelwhip'],
    about:
      'Kick a whip one way, catch the deck part way round and send it back the other way before you land.',
    tips: 'Tailwhips and heelwhips both need to be clean, because a rewind is one of each. Catch it with the front foot.',
    fact: 'The deck never completes a full turn in either direction, which is what makes it look like a mistake being fixed.',
    mistakes: [
      {
        what: 'Kicking the first whip too hard.',
        fix: 'A gentle first kick is enough; too much force sends the deck past the catch point.',
      },
      {
        what: 'Catching with the toes.',
        fix: 'Stop the deck with the sole of your foot, flat, so it can be sent straight back.',
      },
      {
        what: 'Sending it back with the wrong foot.',
        fix: 'The foot that catches is the foot that kicks it back; the other stays where it is.',
      },
      {
        what: 'Learning the tailwhip version first.',
        fix: 'Start with the heelwhip rewind; the return kick is a tailwhip, which is the one you know best.',
      },
    ],
    hard: 'A tailwhip and a heelwhip are each one direction. A rewind sends the deck out, stops it halfway and sends it back, so you kick, catch and kick again in one hop.',
    isLive: true,
  },
  {
    id: '360-whip',
    name: '360 Whip',
    sport: 'scooter',
    cat: 'hybrid',
    diff: 4,
    pre: ['360', 'tailwhip'],
    about: 'A full 360 body rotation with a tailwhip thrown and caught inside it.',
    tips: 'Wind up for the 360 first and kick the whip once you are already spinning. Rushing the kick stalls the spin.',
    fact: 'The whip and your body turn the same way, so the deck comes back round sooner than you expect it to.',
    mistakes: [
      {
        what: 'Letting the spin stop for the kick.',
        fix: 'Keep your shoulders turning through the kick; the deck follows your rotation.',
      },
      {
        what: 'Looking down at the deck.',
        fix: 'Feel the deck round and keep your head turning to spot the landing.',
      },
      {
        what: 'Snatching the whip and killing the spin.',
        fix: 'Let the deck complete its turn; a snatched catch pulls you off the rotation.',
      },
      {
        what: 'Not enough air for both.',
        fix: 'Learn it on a box or big jump where the 360 already has time to spare.',
      },
    ],
    hard: 'The 360 alone uses all your air. Putting a whip inside it means kicking and catching the deck while your body is still turning, with the spot to find at the end.',
    isLive: true,
  },
  {
    id: 'whiplash',
    name: 'Whiplash',
    sport: 'scooter',
    cat: 'hybrid',
    diff: 4,
    pre: ['foot-jam', 'tailwhip'],
    about:
      'Stall up in a foot jam with neither foot on the deck, then swing the deck a full turn around the stem and catch it.',
    tips: 'The foot jam has to hold rock steady before you add the swing. Kick with the free foot and catch it flat.',
    fact: 'It is a tailwhip with the front wheel still on the ground, so balance matters more than pop.',
    mistakes: [
      {
        what: 'Foot jam too shallow.',
        fix: 'Wedge the foot firmly between the wheel and the fork so the scooter is locked before you swing.',
      },
      {
        what: 'Swinging with the jammed foot.',
        fix: 'The jammed foot stays put; the other foot swings the deck round.',
      },
      {
        what: 'Bars turning during the swing.',
        fix: 'Hold the bars still and upright so the deck has a fixed point to swing around.',
      },
      {
        what: 'Catching the deck at an angle.',
        fix: 'Wait for it to come round flat and land your foot in the middle.',
      },
    ],
    hard: 'A foot jam holds the scooter still and a tailwhip spins the deck in the air. A whiplash spins the deck from a standstill, so you balance on one foot while the other works.',
    isLive: true,
  },
  {
    id: 'buttercup',
    name: 'Buttercup',
    sport: 'scooter',
    cat: 'hybrid',
    diff: 5,
    pre: ['tailwhip', 'bri-flip'],
    about: 'A tailwhip, then a bri flip, then another tailwhip, all inside one jump.',
    tips: 'Three separate tricks stacked, so all three have to be automatic. A big jump box gives you the air time.',
    fact: 'Three rotations in one hop is about as much as a scooter jump allows, which is why so few riders have one.',
    mistakes: [
      {
        what: 'Bri flip started before the whip lands.',
        fix: 'Feel the first whip under your feet before the bars turn for the flip.',
      },
      {
        what: 'Bars left straight for the bri.',
        fix: 'Turn the bars a quarter as the flip starts, just like a bri flip on its own.',
      },
      {
        what: 'Reaching for the deck after the flip.',
        fix: 'The flip is followed by another whip, so wait for the deck to come round again.',
      },
      {
        what: 'Running out of air.',
        fix: 'Learn it into foam or on a big box; three tricks need more height than a hop gives.',
      },
    ],
    hard: 'A bri flip alone is a hard catch. A buttercup puts a tailwhip on each side of it, so there are three catches and two changes of motion in one jump.',
    isLive: true,
  },
  {
    id: 'front-bri',
    name: 'Front Bri',
    sport: 'scooter',
    cat: 'hybrid',
    diff: 5,
    pre: ['bri-flip', 'tailwhip'],
    about:
      'The scooter front-flips over your head while both of your hands stay on the bars the whole way round.',
    tips: 'Bri flips first. Then learn the front rotation into a foam pit, hands on, before you take it anywhere solid.',
    fact: 'Keeping hold of the bars through a forward flip of the deck is the hard part, and it is what sets it apart from a bri flip.',
    mistakes: [
      {
        what: 'Pushing the bars away from you.',
        fix: 'Pull the bars towards your chest and down; that is what sends the front of the scooter over.',
      },
      {
        what: 'Knees low as the scooter comes over.',
        fix: 'Pull your knees up high so the deck can pass under you without catching a shoe.',
      },
      {
        what: 'Feet hunting for the deck too soon.',
        fix: 'Wait for the grip tape to come back up before your feet go looking for it.',
      },
      {
        what: 'Grip creeping to the ends of the bars.',
        fix: 'Hold the middle of each grip so the pull is even and the scooter comes over straight.',
      },
    ],
    hard: 'A bri flip sends the deck backwards over itself. A front bri sends it forwards, so the pull comes from the bars towards you, which is a new direction for your hands and your catch.',
    isLive: true,
  },
  {
    id: 'sk-ollie',
    name: 'Ollie',
    sport: 'skate',
    cat: 'flat',
    diff: 2,
    pre: [],
    about:
      'Pop the tail, drag your front foot up the board and level it out in the air. Every other trick in skateboarding is built on top of this one.',
    tips: 'Snap the tail hard and slide the front foot straight up to the nose. Jump with the board, don’t just flick and hope.',
    fact: 'Alan Gelfand did the first one in a pool around 1978. Rodney Mullen took it to flat ground and the whole sport changed.',
    mistakes: [
      {
        what: 'Pop and slide as two moves.',
        fix: 'Snap the tail and start the front foot sliding in the same instant.',
      },
      {
        what: 'Not crouching before the pop.',
        fix: 'Bend deep first; the height comes from how low you start.',
      },
      {
        what: 'Shoulders twisted across the board.',
        fix: 'Keep your shoulders in line with the deck, or the board turns in the air.',
      },
      {
        what: 'Popping the tail at an angle.',
        fix: 'Stamp the tail straight down; a sideways pop spins you off line.',
      },
    ],
    hard: 'Easy rather than Rookie because the board leaves the ground for the first time, and it only does so if the pop, the slide and the jump happen together. Nothing before it needed timing.',
    isLive: true,
  },
  {
    id: 'sk-manual',
    name: 'Manual',
    sport: 'skate',
    cat: 'flat',
    diff: 2,
    pre: [],
    about: 'Rolling along on the back two wheels with the nose held up. Balance, not pop.',
    tips: 'Find the tipping point and hold it with your ankles. Look where you’re going, not at the board.',
    fact: 'Manual pads exist in nearly every park because a manual is the glue between two other tricks in a line.',
    mistakes: [
      {
        what: 'Yanking the nose up.',
        fix: 'Press the tail gently and let the nose rise; a yank sends you past the balance point.',
      },
      {
        what: 'Feet too far apart.',
        fix: 'Bring them in a little so small ankle moves can steer the balance.',
      },
      {
        what: 'Fighting every wobble.',
        fix: 'Make one small correction and wait; chasing wobbles makes them bigger.',
      },
      {
        what: 'Going too slowly.',
        fix: 'Roll at a steady walking pace; a crawling board wobbles far more.',
      },
    ],
    hard: 'Easy because nothing pops and you can drop the nose at any moment. It is more than Rookie because the balance point is narrow, and the ankles have to find it while rolling.',
    isLive: true,
  },
  {
    id: 'sk-shuvit',
    name: 'Shuvit',
    sport: 'skate',
    cat: 'flat',
    diff: 2,
    pre: [],
    about: 'Scoop the board 180° under your feet while you hop. The board spins, you don’t.',
    tips: 'Scoop back with the tail foot and lift your front foot out of the way. Stay over the board or it shoots out.',
    fact: 'It’s usually the first trick where a beginner has to trust a board that isn’t under them.',
    mistakes: [
      {
        what: 'Scooping with the whole leg.',
        fix: 'Curl the ankle round the tail; a leg kick sends the board across the ground.',
      },
      {
        what: 'Jumping too high.',
        fix: 'Hop just enough to clear the deck; a big jump lands you off it.',
      },
      {
        what: 'Shoulders following the board.',
        fix: 'Keep your shoulders square to the direction of travel; only the board turns.',
      },
      {
        what: 'Back wheels gripping, not sliding.',
        fix: 'Scoop the tail back and slightly down so the wheels break loose.',
      },
    ],
    hard: 'Easy because the board stays near the ground for most of the spin and you only hop over it. It is not Rookie because the scoop and the hop have to happen together.',
    isLive: true,
  },
  {
    id: 'sk-fakie-ollie',
    name: 'Fakie Ollie',
    sport: 'skate',
    cat: 'flat',
    diff: 2,
    pre: ['sk-ollie'],
    about:
      'An ollie while rolling backwards. Same motion, opposite feel, and the board wants to fly out in front of you.',
    tips: 'Pop slightly later than you think and keep your shoulders over the board.',
    fact: 'Fakie tricks are how most skaters end up comfortable riding switch.',
    mistakes: [
      {
        what: 'Looking down at the tail.',
        fix: 'Look over your leading shoulder at where you are going to land.',
      },
      {
        what: 'Pulling the front foot up early.',
        fix: 'Let the front foot slide as it does forwards; it is the same ollie, not a new one.',
      },
      {
        what: 'Tail scraping on landing.',
        fix: 'Lift the back knee after the pop so the board levels out under you.',
      },
      {
        what: 'Popping at a crawl.',
        fix: 'Roll at a comfortable pace; a slow fakie lets the board wander before the pop.',
      },
    ],
    hard: 'Still Easy because it is the ollie you already have; nothing about the feet changes. What it adds is popping while rolling in a direction you cannot fully see, which changes the timing.',
    isLive: true,
  },
  {
    id: 'sk-pop-shuvit',
    name: 'Pop Shuvit',
    sport: 'skate',
    cat: 'flat',
    diff: 3,
    pre: ['sk-ollie', 'sk-shuvit'],
    // Paid from 2026-09-04. It was one of three flatground rungs freed together
    // in T24 because skate's free tier was thin (issue #75); the six Rookie
    // entries T27 added are what fills that gap now, so the override came off
    // and the difficulty decides. `sk-kickflip` keeps its override — see the
    // free-tier note at the top of this file. Freeing this one is also what a
    // free `sk-varial-flip` would cost, which is why skate's hybrid category is
    // the one it cannot enter.
    about:
      'A shuvit with an ollie pop in it, so the board spins in the air rather than on the ground.',
    tips: 'Pop and scoop in the same motion. Front foot goes up and slightly out to leave room for the spin.',
    fact: 'Pop shuvits and kickflips are the two branches the whole flatground trick list grows out of.',
    mistakes: [
      {
        what: 'Back foot leaving the tail early.',
        fix: 'Keep the back foot on the tail until the scoop has finished.',
      },
      {
        what: 'Scooping so hard the board flips.',
        fix: 'Scoop smoothly; a flip means your toes caught the edge.',
      },
      {
        what: 'Watching the ground, not the board.',
        fix: 'Watch the graphic come round and put the feet down as it stops.',
      },
      {
        what: 'Leaning back to make room.',
        fix: 'Stay centred over the board; leaning back is why it shoots forward.',
      },
    ],
    hard: 'Spicy because the board now spins in the air, not on the ground, so the ollie pop and the shuvit scoop have to fire in one tail strike. One late and it flips or shoots.',
    isLive: true,
  },
  {
    id: 'sk-180',
    name: 'Frontside 180',
    sport: 'skate',
    cat: 'flat',
    diff: 3,
    pre: ['sk-ollie'],
    // Paid from 2026-09-04, with `sk-pop-shuvit` — see the note there. It was
    // freed as the gateway to riding fakie; `sk-fakie-roll` is that gateway now,
    // sits at difficulty 1, and is free.
    about:
      'You and the board turn a half rotation together and roll away fakie, with your chest opening towards the direction of travel.',
    tips: 'Wind your shoulders the opposite way first, then unwind. Turn your head and the rest follows.',
    fact: 'Backside 180s spin the other way and feel completely different. Most skaters strongly prefer one.',
    mistakes: [
      {
        what: 'Pushing the tail straight down.',
        fix: 'Push the tail slightly forward as you pop; that starts the board turning.',
      },
      {
        what: 'Trying to finish every degree in the air.',
        fix: 'Land on the front truck and pivot the last bit round on the ground.',
      },
      {
        what: 'Back foot in the middle of the tail.',
        fix: 'Move it towards the outside of the tail so it can push the board round.',
      },
      {
        what: 'Stopping the turn at the hips.',
        fix: 'Let the hips follow the shoulders right through, or you land at ninety degrees.',
      },
    ],
    hard: 'Spicy because the ollie now has a turn in it, and the turn has to start in the shoulders before the pop. An ollie done late or a turn done early lands sideways.',
    isLive: true,
  },
  {
    id: 'sk-nollie',
    name: 'Nollie',
    sport: 'skate',
    cat: 'flat',
    diff: 3,
    pre: ['sk-ollie'],
    about: 'An ollie popped off the nose instead of the tail, rolling forwards.',
    tips: 'Weight forward, snap the nose, drag the back foot. It’s an ollie with your stance rebuilt.',
    fact: 'Nollie, switch and fakie versions triple the size of any trick list without adding a single new motion.',
    mistakes: [
      {
        what: 'Front foot off the nose pocket.',
        fix: 'Put the front foot right in the curve of the nose, toes in line with it.',
      },
      {
        what: 'Leaning back as you pop.',
        fix: 'Lean a little forward; leaning back is what pulls the front foot off the board.',
      },
      {
        what: 'Pushing the nose straight down.',
        fix: 'Push it down and forward, so the board stays under you instead of flying back.',
      },
      {
        what: 'Turning the shoulders early.',
        fix: 'Keep the shoulders square or you get an accidental nollie 180.',
      },
    ],
    hard: 'Spicy because the pop moves to the nose, so the foot that used to slide now pops and the foot that popped now drags. Every timing from the ollie has to be relearned backwards.',
    isLive: true,
  },
  {
    id: 'sk-kickflip',
    name: 'Kickflip',
    sport: 'skate',
    cat: 'flat',
    diff: 3,
    pre: ['sk-ollie'],
    // One of skate's four free Spicy tricks, and the sport's rite of passage —
    // the same argument that frees the scooter `tailwhip`. Heelflip, tre flip,
    // hardflip and the rest of the flip family stay paid.
    free: true,
    about:
      'Ollie up and flick the edge of the nose with your toes so the board spins a full barrel roll under you, then catch it with your feet.',
    tips: 'Ollie first, flick second. Keep your shoulders square and catch it with the back foot before you look for the ground.',
    fact: "Rodney Mullen invented the flat ground version in 1983. Before that a 'flip' meant flipping the board with your hands.",
    mistakes: [
      {
        what: 'Flicking forward off the nose.',
        fix: 'Flick sideways off the corner of the nose; a forward flick just pushes the board.',
      },
      {
        what: 'Kicking with the whole leg.',
        fix: 'A quick ankle flick is enough; a leg kick throws the board out.',
      },
      {
        what: 'Front foot stuck to the board.',
        fix: 'Point the front knee out slightly so the toes can leave the edge.',
      },
      {
        what: 'Leaning back away from the flick.',
        fix: 'Keep a little weight on the front foot while it flicks.',
      },
    ],
    hard: 'Spicy because the ollie and the flick have to happen in one movement: the front foot slides for the ollie and flicks off the corner in the same stroke. Flick early and you lose height.',
    isLive: true,
  },
  {
    id: 'sk-heelflip',
    name: 'Heelflip',
    sport: 'skate',
    cat: 'flat',
    diff: 3,
    pre: ['sk-ollie'],
    about:
      'The kickflip’s mirror: flick off the heel side of the nose so the board rolls the opposite way.',
    tips: 'Front foot points slightly inward, flick out with the heel. Land on the bolts, not the middle of the board.',
    fact: 'Skaters are almost always noticeably better at one of the two flips, and rarely both.',
    mistakes: [
      {
        what: 'Kicking straight ahead.',
        fix: 'Kick out and forward together so the heel catches the corner of the nose.',
      },
      {
        what: 'Front knee locked straight.',
        fix: 'Keep the front knee bent; the flick comes from the lower leg swinging.',
      },
      {
        what: 'Weight sat on the back foot.',
        fix: 'Keep some weight forward or the heel skims past without catching.',
      },
      {
        what: 'Toes fully on the board.',
        fix: 'Let the big toe hang just off the edge so the heel has an edge to hit.',
      },
    ],
    hard: 'Spicy for the same reason as the kickflip: the ollie and the flick share one stroke. The heel has less feel than the toes, so the catch on the nose corner is harder to judge.',
    isLive: true,
  },
  {
    id: 'sk-nose-manual',
    name: 'Nose Manual',
    sport: 'skate',
    cat: 'flat',
    diff: 3,
    pre: ['sk-manual'],
    about:
      'A manual on the front wheels with the tail held up behind you. Twitchier and far less forgiving.',
    tips: 'Move your weight, don’t lunge. Tiny corrections only.',
    fact: 'Nose manual to nollie flip out is the kind of line that decides a game of SKATE.',
    mistakes: [
      {
        what: 'Head out past the front foot.',
        fix: 'Keep your head over the front foot, or just behind it.',
      },
      {
        what: 'Steering with the front foot.',
        fix: 'The back foot does the balancing here; use it to lift or drop the tail.',
      },
      {
        what: 'Front foot hanging off the tip.',
        fix: 'Stand on the flat of the nose, not the very end.',
      },
      {
        what: 'Bailing forwards.',
        fix: 'If you lose it, drop the tail and take the back wheels down instead.',
      },
    ],
    hard: 'Spicy while the manual is Easy because the balance point is on the front truck, ahead of your weight, so a lean too far tips you forward off the board rather than onto the tail.',
    isLive: true,
  },
  {
    id: 'sk-50-50',
    name: '50-50 Grind',
    sport: 'skate',
    cat: 'street',
    diff: 3,
    pre: ['sk-ollie'],
    // Free for the same reason as `bmx-double-peg`: every skate ledge trick
    // descends from this one, so leaving it paid puts no street grind at all in
    // the free tier. Boardslide, noseslide, nosegrind, crooked and tailslide all
    // stay paid; `sk-5-0` is the first rung above it that is not free, and
    // `sk-wallride` is the free Gnarly trick on the street branch.
    free: true,
    about: 'Both trucks lock onto a ledge or rail and you grind along it dead straight.',
    tips: 'Ollie level with the ledge, land on both trucks at once and stay centred. Wax makes a huge difference.',
    fact: 'Skate 50-50s came from roller skating and BMX pegs before they became the base of every ledge trick.',
    mistakes: [
      {
        what: 'Riding straight at the ledge.',
        fix: 'Come in at a shallow angle so the ollie carries you onto the edge.',
      },
      {
        what: 'Leaning into the ledge.',
        fix: 'Keep hips and shoulders square to the direction you are grinding.',
      },
      {
        what: 'Bailing as soon as it slows.',
        fix: 'Ride it out; the trucks hold on longer than it feels.',
      },
      {
        what: 'Dropping the back truck off first.',
        fix: 'Shift weight slightly forward so the front truck leaves the end first.',
      },
    ],
    hard: 'Spicy because it is the ollie landed on something a few centimetres wide, with both trucks arriving at once. A curb ollie asked you to land on top; this asks for the edge.',
    isLive: true,
  },
  {
    id: 'sk-boardslide',
    name: 'Boardslide',
    sport: 'skate',
    cat: 'street',
    diff: 3,
    pre: ['sk-ollie'],
    about:
      'You ollie over the rail and slide along it on the underside of the deck, between the trucks.',
    tips: 'Get all the way over before you commit. Turn your shoulders with the slide and keep your weight over the rail.',
    fact: 'Boardslide and 50-50 are the two tricks that make everything else on a rail possible.',
    mistakes: [
      {
        what: 'Ollieing high and dropping on.',
        fix: 'Pop lightly and ride the board onto the rail; a big drop sticks.',
      },
      {
        what: 'Standing tall on the rail.',
        fix: 'Stay crouched; a low body can correct a wobble, a tall one cannot.',
      },
      {
        what: 'Weight on the front truck.',
        fix: 'Keep weight between your feet, over the rail, not on the leading wheels.',
      },
      {
        what: 'Same depth on every ledge.',
        fix: 'Push the board further across on a rough ledge, less on a slippery one.',
      },
    ],
    hard: 'Spicy because you have to turn the board a quarter turn in the air and land it on the rail with the wheels off the ground. The ollie before it never had a turn.',
    isLive: true,
  },
  {
    id: 'sk-noseslide',
    name: 'Noseslide',
    sport: 'skate',
    cat: 'street',
    diff: 3,
    pre: ['sk-boardslide'],
    about: 'Slide along the ledge on the nose of the board with the tail hanging off the side.',
    tips: 'Approach parallel and quite close. Keep weight forward the whole slide, then turn out at the end.',
    fact: 'Noseslides are the ledge trick most likely to teach you how much wax matters.',
    mistakes: [
      {
        what: 'Turning less than ninety degrees.',
        fix: 'Turn the board a full quarter so the nose sits square on the ledge.',
      },
      {
        what: 'Arms lined up with the board.',
        fix: 'Hold your arms along the ledge, not across it, to stay balanced.',
      },
      {
        what: 'Sliding before you can land it.',
        fix: 'Ollie into the noseslide position and stop there, without sliding, until it feels normal.',
      },
      {
        what: 'Ollieing too far past the ledge.',
        fix: 'Aim the nose at the edge, not over it, so it lands on the corner.',
      },
    ],
    hard: 'Spicy alongside the boardslide because only the nose is on the ledge, so the balance point is small. It is still a quarter turn, but the whole slide sits on one end of the board.',
    isLive: true,
  },
  {
    id: 'sk-5-0',
    name: '5-0 Grind',
    sport: 'skate',
    cat: 'street',
    diff: 4,
    pre: ['sk-50-50'],
    about: 'A 50-50 on the back truck only, with the nose held up like a manual on the ledge.',
    tips: 'It’s a manual and a grind at once. Lock the back truck, hold the balance, ride out flat.',
    fact: '5-0s are named for the American cop show. A lot of skate names come from nowhere sensible.',
    mistakes: [
      {
        what: 'Both trucks landing on the ledge.',
        fix: 'Aim to land the back truck only, with the nose held up.',
      },
      {
        what: 'Nose dipping mid-grind.',
        fix: 'You are leaning forward; sit back over the back truck a little.',
      },
      {
        what: 'Leaning too far back.',
        fix: 'Lean back just enough to keep the nose up, not so far the wheel slips out.',
      },
      {
        what: 'Rolling in too slowly.',
        fix: 'Take a little more speed than a 50-50 so the single truck keeps sliding.',
      },
    ],
    hard: 'Gnarly because it is the 50-50 with the front truck lifted, so a manual’s narrow balance point now has to be held on a moving edge. The 50-50 shared the weight; this does not.',
    isLive: true,
  },
  {
    id: 'sk-nosegrind',
    name: 'Nosegrind',
    sport: 'skate',
    cat: 'street',
    diff: 4,
    pre: ['sk-50-50'],
    about: 'Grinding on the front truck alone with the tail up behind you.',
    tips: 'Ollie in nose-first and keep pressure on that front truck. Pop out of the end rather than sliding off.',
    fact: 'Nosegrinds are widely considered the hardest of the basic grinds to make look good.',
    mistakes: [
      {
        what: 'Nose scraping the ledge.',
        fix: 'Keep the front wheels right on the edge; if the nose touches, the board stalls.',
      },
      {
        what: 'Landing both trucks on.',
        fix: 'Aim the front truck at the edge and keep the tail up behind you.',
      },
      {
        what: 'Tail dragging on the way off.',
        fix: 'Push the nose forward at the end so the back truck lifts clear.',
      },
      {
        what: 'Learning it backside first.',
        fix: 'Start frontside, where you can see the ledge the whole way along.',
      },
    ],
    hard: 'Gnarly for the same reason as the 5-0 but on the front truck, so it is a nose manual on a ledge. The balance point is ahead of you; a lean forward is a fall.',
    isLive: true,
  },
  {
    id: 'sk-crooked',
    name: 'Crooked Grind',
    sport: 'skate',
    cat: 'street',
    diff: 4,
    pre: ['sk-nosegrind'],
    about:
      'A nosegrind held at an angle so the nose also slides along the ledge. Grind and slide together.',
    tips: 'Angle the board in, don’t square it up. The nose does half the work.',
    fact: "Short for 'crooked nosegrind'. Most people have only ever called it a k-grind.",
    mistakes: [
      {
        what: 'All the weight on the nose.',
        fix: 'Share some weight to the back foot or the nose digs in and stalls.',
      },
      {
        what: 'Front wheel not on the ledge.',
        fix: 'Lock in with the truck sideways and the front wheel sat up on the edge.',
      },
      {
        what: 'Trying to pop straight out.',
        fix: 'Learn the exit by turning out to fakie first; it is the simpler way off.',
      },
      {
        what: 'Hesitating at the lip.',
        fix: 'Commit to the ollie; a half pop leaves the truck short of the edge.',
      },
    ],
    hard: 'Gnarly because it is the nosegrind at an angle, so the front truck is locked sideways and the nose is sliding at the same time. Two things have to stay balanced instead of one.',
    isLive: true,
  },
  {
    id: 'sk-tailslide',
    name: 'Tailslide',
    sport: 'skate',
    cat: 'street',
    diff: 4,
    pre: ['sk-noseslide'],
    about: 'Slide along the ledge on the tail with the nose out over the drop, then turn back out.',
    tips: 'Turn a full 90° in the air before you land on it. Half-committing is what makes it hang up.',
    fact: 'The tailslide is the trick most skaters name when asked which one finally feels like real skateboarding.',
    mistakes: [
      {
        what: 'Tail below the ledge on entry.',
        fix: 'Pop with the tail lower than the nose so it drops straight onto the edge.',
      },
      {
        what: 'Weight spread over both feet.',
        fix: 'Once you lock in, shift all of it onto the tail.',
      },
      {
        what: 'Riding in too far from the ledge.',
        fix: 'Roll close and parallel, so the tail only has to move sideways.',
      },
      {
        what: 'Leaning back away from the ledge.',
        fix: 'Keep your weight centred over the tail, or the slide slips out.',
      },
    ],
    hard: 'Gnarly while the noseslide is Spicy because the tail is behind you, so you cannot see it lock in, and you need a frontside 180 ollie to get the board round in time.',
    isLive: true,
  },
  {
    id: 'sk-gap',
    name: 'Stair Set',
    sport: 'skate',
    cat: 'street',
    diff: 3,
    pre: ['sk-ollie'],
    supervise: true,
    about: 'Ollie a set of stairs or a gap in one go, and roll away from the landing.',
    tips: 'Speed is safety here. Bend your knees on impact and keep rolling.',
    fact: 'The stair count arms race in the 90s is why almost every skate video has a slam section.',
    mistakes: [
      {
        what: 'Popping at the very edge.',
        fix: 'Pop about a board length before the top step so the board levels over the set.',
      },
      {
        what: 'Legs straight in the air.',
        fix: 'Pull your knees up after the pop and let them bend again on landing.',
      },
      { what: 'Starting on a big set.', fix: 'Learn it on two wide steps and add one at a time.' },
      {
        what: 'Bailing mid-air.',
        fix: 'Once you have popped, ride it out; changing your mind in the air is what hurts.',
      },
    ],
    hard: 'Spicy because the ollie is one you already own, but the ground drops away under it. The pop has to come early and the landing takes more speed than flat ground did.',
    isLive: true,
  },
  {
    id: 'sk-drop-in',
    name: 'Drop In',
    sport: 'skate',
    cat: 'park',
    diff: 2,
    pre: [],
    supervise: true,
    about: 'Set the tail on the coping, lean forward over the front truck and ride down the ramp.',
    tips: 'Commit forward. Leaning back is the one thing that guarantees you go down.',
    fact: 'It’s the single biggest confidence barrier in skateboarding, and it’s over in half a second.',
    mistakes: [
      {
        what: 'Locking your knees straight.',
        fix: 'Keep both knees soft so your legs can soak up the curve of the ramp.',
      },
      {
        what: 'Throwing the front foot on late.',
        fix: 'Set the front foot over the bolts first, then tip in with everything already in place.',
      },
      {
        what: 'Standing on the coping thinking.',
        fix: 'Count to three and go; the longer you stand there the harder it gets.',
      },
      {
        what: 'Learning it on the big ramp alone.',
        fix: 'Your first drop-ins belong on a small ramp with someone watching who can call for help.',
      },
    ],
    hard: 'Nothing before it asks you to lean into a fall. The first metre is pure commitment: the board is level, the ramp is not, and only your weight over the front truck joins them.',
    isLive: true,
  },
  {
    id: 'sk-rock-to-fakie',
    name: 'Rock to Fakie',
    sport: 'skate',
    cat: 'park',
    diff: 2,
    pre: ['sk-drop-in'],
    about:
      'Ride up the transition, put the middle of the board over the coping, then rock back and roll down fakie.',
    tips: 'Push the nose over properly, then lift it back before the front truck catches.',
    fact: 'Rock to fakie is where most skaters first learn to trust riding backwards.',
    mistakes: [
      {
        what: 'Rolling up too slowly.',
        fix: 'Carry enough speed that the front truck clears the coping on its own.',
      },
      {
        what: 'Panicking as you roll away backwards.',
        fix: 'Rolling fakie is the trick; practise it on flat and low on the ramp first.',
      },
      {
        what: 'Looking at your feet on the way down.',
        fix: 'Look back down the ramp so your shoulders stay over the board rolling fakie.',
      },
      {
        what: 'Rocking with the board pointing sideways.',
        fix: 'Go straight up the ramp so the board rocks square over the coping.',
      },
    ],
    hard: 'The drop-in taught you to commit forwards; this is the first trick that sends you down backwards. The hang-up is real: lift the nose late and the front truck catches the coping.',
    isLive: true,
  },
  {
    id: 'sk-axle-stall',
    name: 'Axle Stall',
    sport: 'skate',
    cat: 'park',
    diff: 3,
    pre: ['sk-drop-in'],
    // Free by the free-tier shape at the top of this file.
    free: true,
    about: 'Turn and set both trucks on the coping, hold it, then drop back in.',
    tips: 'Turn your shoulders early and put the back truck on first.',
    fact: 'Every lip trick in a bowl is a variation on stopping on the coping and choosing how to come back.',
    mistakes: [
      {
        what: 'Pivoting too soon.',
        fix: 'Wait until the front truck is above the coping before you turn the hips.',
      },
      {
        what: 'Front truck landing short.',
        fix: 'A weak pivot leaves the front truck below the coping, so commit the whole 90 degrees.',
      },
      {
        what: 'Rushing the drop back in.',
        fix: 'Settle on both trucks for a breath, then press the tail and pivot in.',
      },
      {
        what: 'Learning it frontside first.',
        fix: 'Backside is the natural way round; get that solid before you try the other.',
      },
    ],
    hard: 'A drop-in starts still; here you arrive with speed, turn a quarter and land two trucks on a bar a few centimetres wide, then reverse it. The timing window is short.',
    isLive: true,
  },
  {
    id: 'sk-blunt-fakie',
    name: 'Blunt to Fakie',
    sport: 'skate',
    cat: 'park',
    diff: 5,
    pre: ['sk-axle-stall'],
    about: 'Stall on the tail with the back wheels above the coping, then pop back in fakie.',
    tips: 'Pop off the tail on the way in. Just leaning back drops you straight down the ramp.',
    fact: 'Blunts came out of vert skating in the 80s and moved to street ledges a decade later.',
    mistakes: [
      {
        what: 'Letting the board lie flat in the stall.',
        fix: 'Keep the board near vertical with your weight over the back truck so it does not slip.',
      },
      {
        what: 'Popping out too high.',
        fix: 'A small pop clears the front truck; a big one lands you on the flat, not the ramp.',
      },
      {
        what: 'Landing front truck first.',
        fix: 'Land the back truck first and hold a short fakie manual so the nose clears the coping.',
      },
      {
        what: 'Skipping the pivot to fakie.',
        fix: 'Pivot to fakies and blunt stalls on a kerb teach the balance point before the coping does.',
      },
    ],
    hard: 'An axle stall rests on two trucks; a blunt balances on the tail with both back wheels above the coping, and the only way out is an ollie into a ramp you cannot see.',
    isLive: true,
  },
  {
    id: 'sk-hip-transfer',
    name: 'Hip Transfer',
    sport: 'skate',
    cat: 'park',
    diff: 4,
    pre: ['sk-drop-in'],
    about: 'Take a hip or channel in the park and air from one transition across into another.',
    tips: 'Look at the landing ramp, not the gap. Carry more speed than feels comfortable.',
    fact: 'Transfers are how a bowl run stops being laps and starts being a line.',
    mistakes: [
      {
        what: 'Going straight up the first wall.',
        fix: 'Approach on an angle that already points you at the landing ramp.',
      },
      {
        what: 'Landing with the board sideways.',
        fix: 'Turn your shoulders in the air so the wheels point down the second ramp.',
      },
      {
        what: 'Stiffening up over the top.',
        fix: 'Stay low and let your knees fold on landing; a stiff landing bounces you off.',
      },
      {
        what: 'Starting on a big hip.',
        fix: 'Find a low hip and roll over it before you try to air it.',
      },
    ],
    hard: 'Every trick before it stays on one wall. Here you leave one transition and land in another that faces a different way, so speed, angle and turn all have to be right at once.',
    isLive: true,
  },
  {
    id: 'sk-varial-flip',
    name: 'Varial Kickflip',
    sport: 'skate',
    cat: 'hybrid',
    diff: 4,
    pre: ['sk-kickflip', 'sk-pop-shuvit'],
    about: 'A kickflip and a pop shuvit at once. The board flips and spins 180° in the same hop.',
    tips: 'Scoop first, flick second, and catch it late. Rushing the catch is what causes the primo landing.',
    fact: 'Varial flips are the classic gateway from single tricks into combination flip tricks.',
    mistakes: [
      {
        what: 'Board stops spinning when you flick.',
        fix: 'Flick straight off the nose, not out to the side, so the spin keeps going.',
      },
      {
        what: 'Popping so hard the flick misses.',
        fix: 'A normal pop is enough; the front foot needs to stay on the board to flick.',
      },
      { what: 'Spinning past 180.', fix: 'Ease the scoop and let the flick do more of the work.' },
      {
        what: 'Turning the shoulders with the board.',
        fix: 'Keep your shoulders square to the direction you are rolling; only the board turns.',
      },
    ],
    hard: 'A kickflip and a shuvit each use one foot. Here both feet fire at once with different jobs, and the catch comes with the board pointing the other way from where it started.',
    isLive: true,
  },
  {
    id: 'sk-hardflip',
    name: 'Hardflip',
    sport: 'skate',
    cat: 'hybrid',
    diff: 5,
    pre: ['sk-varial-flip'],
    about:
      'A frontside pop shuvit with a kickflip through it, so the board comes up through your legs.',
    tips: 'Front foot scoops down and forward. You have to open your legs and let it come through.',
    fact: 'Named because it is, genuinely, hard. One of the few honestly named tricks.',
    mistakes: [
      {
        what: 'Kicking the front foot straight forward.',
        fix: 'Kick out sideways or slightly behind you, not over the nose corner like a kickflip.',
      },
      {
        what: 'Turning your body with the board.',
        fix: 'Your body stays square; only the board turns, unlike a frontside flip.',
      },
      {
        what: 'Legs in the board’s path.',
        fix: 'Pull both knees up high so the board has room to come through.',
      },
      {
        what: 'Flicking before the spin starts.',
        fix: 'Get the flat spin going off the tail first, then add the flip.',
      },
    ],
    hard: 'The varial flip spins the board away from you. The hardflip spins it frontside and sends it up between your legs, so the flick direction and the catch are both unlike anything before it.',
    isLive: true,
  },
  {
    id: 'sk-tre-flip',
    name: 'Tre Flip',
    sport: 'skate',
    cat: 'hybrid',
    diff: 5,
    pre: ['sk-varial-flip'],
    about:
      'A 360 pop shuvit with a kickflip in it. The board spins a full lap and flips at the same time.',
    tips: 'Scoop much harder than a normal shuvit and flick out at the same moment. Then be patient.',
    fact: "Also called a 360 flip. The trick most often used as the benchmark for 'can actually skate'.",
    mistakes: [
      {
        what: 'Swinging the back foot out wide.',
        fix: 'Scoop down and round through the tail; the flip comes from the truck springing back, not a swing.',
      },
      {
        what: 'Scooping before you leave the ground.',
        fix: 'Pop first, then let the scoop finish as the board rises.',
      },
      {
        what: 'Jumping forwards or backwards.',
        fix: 'Jump straight up with the back knee lifting high so the board spins under you.',
      },
      {
        what: 'Feet too close together.',
        fix: 'Spread the stance so the front foot can flick without blocking the spin.',
      },
    ],
    hard: 'The varial flip’s spin is half a turn from the front foot’s flick. Here the back foot drives a full turn and the flip together, so one scoop has two jobs.',
    isLive: true,
  },
  {
    id: 'sk-flip-slide',
    name: 'Kickflip Boardslide',
    sport: 'skate',
    cat: 'hybrid',
    diff: 5,
    pre: ['sk-kickflip', 'sk-boardslide'],
    about: 'Kickflip into a boardslide, catching the flip exactly as the board meets the rail.',
    tips: 'Flip early and low. If the flip is late you land on the rail with nothing under you.',
    fact: 'Flip-in tricks are how street skating scores the difference between clean and spectacular.',
    mistakes: [
      {
        what: 'Flipping like a flatground kickflip.',
        fix: 'Flick as if starting a 180, so the board turns sideways to the rail.',
      },
      {
        what: 'Setting it on the rail before the catch.',
        fix: 'Catch the board snug under both feet above the rail, then lower it on.',
      },
      {
        what: 'Ollieing too high.',
        fix: 'A low flip lands on the rail softly; a high one snaps boards and bounces you off.',
      },
      {
        what: 'Boardslides not automatic yet.',
        fix: 'Slide the rail plain until you never think about it, then add the flip.',
      },
    ],
    hard: 'A boardslide asks for a quarter turn; a kickflip asks for a flick. Putting both in one pop means catching a flipping board mid-air and landing it across a bar, not on the ground.',
    isLive: true,
  },
  {
    id: 'sk-indy',
    name: 'Indy Grab',
    sport: 'skate',
    cat: 'air',
    diff: 3,
    pre: ['sk-drop-in'],
    // Free by the free-tier shape at the top of this file.
    free: true,
    about: 'Air out of the transition and grab the toe edge between your feet with your back hand.',
    tips: 'Get proper height first, then reach. Suck your knees up to bring the board to your hand.',
    fact: 'The indy is the default grab in every wheeled sport. It’s the easiest hand to reach the board with.',
    mistakes: [
      {
        what: 'Grabbing before you leave the lip.',
        fix: 'A pre-grab is a crutch; ollie off the coping, then reach for the board.',
      },
      {
        what: 'Reaching between your knees.',
        fix: 'Reach round the outside of your back knee for the toe edge.',
      },
      {
        what: 'Holding the grab into the landing.',
        fix: 'Let go before the wheels reach the ramp so your knees can bend.',
      },
      {
        what: 'Airing straight up the wall.',
        fix: 'Carve a slight angle so you come back into the ramp, not down on the coping.',
      },
    ],
    hard: 'A drop-in keeps four wheels on the ramp. This is the first time you leave it: ollie above the coping, find the board with a hand, and come back in with the wheels pointed down.',
    isLive: true,
  },
  {
    id: 'sk-backside-air',
    name: 'Backside Air',
    sport: 'skate',
    cat: 'air',
    diff: 4,
    pre: ['sk-axle-stall', 'sk-indy'],
    // Free by the free-tier shape at the top of this file.
    free: true,
    about: 'Fly out above the coping, grab, turn and drop back into the transition.',
    tips: 'Look back down the ramp as you turn. Keep the grab until the wheels are pointed at the ramp.',
    fact: 'Tony Alva’s backside airs in the 70s are why vert skating looks the way it does.',
    mistakes: [
      {
        what: 'Turning early on the wall.',
        fix: 'Ride straight up until the front truck is above the coping, then turn in the air.',
      },
      {
        what: 'Too much speed for the ramp.',
        fix: 'Just enough speed to clear the coping; extra speed sends you out over the flat.',
      },
      {
        what: 'Landing sideways.',
        fix: 'Bring the shoulders all the way round so the board points down the transition before the wheels touch.',
      },
      {
        what: 'Reaching down for the board.',
        fix: 'Pull your knees up to your hand rather than bending to the board.',
      },
    ],
    hard: 'The indy taught you to leave the lip and grab. Now you add a half turn in the air, with the ramp behind you as you rotate and only a moment to find it again.',
    isLive: true,
  },
  {
    id: 'sk-handplant',
    name: 'Handplant',
    sport: 'skate',
    cat: 'air',
    diff: 5,
    pre: ['sk-axle-stall'],
    supervise: true,
    about:
      'Plant one hand on the coping, invert fully with the board grabbed above you, then come back in.',
    tips: 'Learn it on a low ramp with a spotter. The hand goes down before your body commits.',
    fact: 'Invert variations carried names like the Andrecht and the Eggplant, after the skaters who first did them.',
    mistakes: [
      {
        what: 'Hand landing behind the coping.',
        fix: 'Plant your palm right on the coping; practise the hand position on a fence first.',
      },
      {
        what: 'Kicking the feet past your hands.',
        fix: 'Stack your feet straight above the planted hand; over-kick and you go past the point of return.',
      },
      {
        what: 'Going upside down without a soft landing.',
        fix: 'Foam, a resi ramp or a spotter is how the first inverts end without a head injury.',
      },
      {
        what: 'Skipping the flat-ground version.',
        fix: 'Learn the 180 handplant on flat, then on a bank, before you plant on coping.',
      },
    ],
    hard: 'An axle stall balances on the trucks. A handplant balances on one arm, upside down, above a vertical wall, with the board held in the other hand and your head nearest the ground.',
    isLive: true,
  },
  {
    id: 'sk-540',
    name: '540 McTwist',
    sport: 'skate',
    cat: 'air',
    diff: 5,
    pre: ['sk-backside-air'],
    supervise: true,
    about: 'An inverted one and a half rotation out of a vert ramp. Big consequences, big airtime.',
    tips: 'Only with pads, a big ramp and a lot of backside airs behind you.',
    fact: 'Mike McGill landed the first one in 1984 and it reset what a contest run could contain.',
    mistakes: [
      {
        what: 'Spinning flat instead of tipping.',
        fix: 'The turn is inverted; let your shoulders dip so the spin goes over, not round.',
      },
      {
        what: 'Looking for the ramp too early.',
        fix: 'You cannot see the landing until the last quarter turn; keep the head turning.',
      },
      {
        what: 'First tries on the ramp itself.',
        fix: 'This is learned into foam or a resi ramp, with someone watching, before it touches wood.',
      },
      {
        what: 'Letting go of the grab in the spin.',
        fix: 'Hold the mute grab all the way round; it keeps the board on your feet.',
      },
    ],
    hard: 'A backside air turns half a rotation upright. This adds a full extra turn, goes inverted, and the landing appears only at the very end, so nothing before it prepares your eyes.',
    isLive: true,
  },

  /* -------------------------------------------------- skate, T27 additions --
   * Same research, same caveats: see the T27 note above the scooter block.
   */

  {
    id: 'sk-kickturn',
    name: 'Kick Turn',
    sport: 'skate',
    cat: 'flat',
    diff: 1,
    pre: [],
    about:
      'Lean on the tail until the front wheels lift a few centimetres, swing the nose round to point somewhere new, and set it back down.',
    tips: 'Roll slowly and lift barely at all. Look where you want to go and turn your shoulders — the board follows them.',
    fact: 'It is the first thing that makes a board steer properly, and every 180 you ever do starts from this movement.',
    mistakes: [
      {
        what: 'Lifting the nose too high.',
        fix: 'Lift the front wheels a finger’s width; a high nose tips you off the back.',
      },
      {
        what: 'Turning with the feet only.',
        fix: 'Turn your head and chest first and let the board catch up.',
      },
      {
        what: 'Front leg stiff and straight.',
        fix: 'Keep both knees soft so the board can pivot under you.',
      },
      { what: 'Standing too tall.', fix: 'Crouch a little; a low body has less to wobble.' },
    ],
    hard: 'Rookie because nothing leaves the ground and you can step off at any point. The whole trick is a small weight shift onto the tail and back again.',
    isLive: true,
  },
  {
    id: 'sk-tic-tac',
    name: 'Tic Tac',
    sport: 'skate',
    cat: 'flat',
    diff: 1,
    pre: ['sk-kickturn'],
    about:
      'Lift the nose and swing it left, then right, over and over. Each swing pushes you along, so you build speed without ever putting a foot down.',
    tips: 'Small swings and a quick rhythm. Weight over the back foot, eyes up the path rather than down at the board.',
    fact: 'It is a way of getting moving and a warm-up drill at the same time. Skaters still do it thirty years in.',
    mistakes: [
      {
        what: 'Swinging the nose too far each way.',
        fix: 'Keep each swing to about a quarter turn so the next one comes quickly.',
      },
      {
        what: 'Pausing between swings.',
        fix: 'Set the nose down and lift it again straight away, like tapping a foot.',
      },
      {
        what: 'Arms hanging still.',
        fix: 'Swing your arms with the board; they are what carries the rhythm.',
      },
      {
        what: 'Leaning back behind the tail.',
        fix: 'Stay stacked over the back truck, not behind it, or the nose lifts too much.',
      },
    ],
    hard: 'Still Rookie: it is the kick turn repeated, and the board never leaves the ground. What is new is the rhythm, and a missed swing costs you speed, not a fall.',
    isLive: true,
  },
  {
    id: 'sk-fakie-roll',
    name: 'Riding Fakie',
    sport: 'skate',
    cat: 'flat',
    diff: 1,
    pre: ['sk-kickturn'],
    about:
      'Rolling with the tail leading instead of the nose, standing exactly as you normally would. You are going backwards, not switching feet.',
    tips: 'Ride up a bank, let it roll you back down and hold it rather than kick-turning out. Glance over your shoulder, do not twist round.',
    fact: 'Half cabs, fakie ollies and every fakie flip trick need this first. It is the cheapest doorway in the whole library.',
    mistakes: [
      {
        what: 'Twisting the whole body to look.',
        fix: 'Turn only your head; keep hips and shoulders square over the board.',
      },
      {
        what: 'Weight sliding onto the front foot.',
        fix: 'Keep a little more weight on the back foot, which is now leading.',
      },
      {
        what: 'Stiff, straight legs.',
        fix: 'Bend your knees; you cannot balance backwards with locked legs.',
      },
      {
        what: 'Rushing to turn back round.',
        fix: 'Hold the fakie roll for a few metres before you kick-turn out of it.',
      },
    ],
    hard: 'Rookie because your feet never move and nothing pops. The difficulty is only that your body has to trust a direction it cannot see well.',
    isLive: true,
  },
  {
    id: 'sk-powerslide',
    name: 'Powerslide',
    sport: 'skate',
    cat: 'flat',
    diff: 2,
    pre: ['sk-kickturn'],
    about:
      'Turn the board sideways at speed so all four wheels skid across the ground, scrubbing off speed until you straighten out again.',
    tips: 'You need real speed for the wheels to break loose — going too slow is why it grips. Crouch and push the board out with your heels.',
    fact: 'It is how skaters stop on a hill without stepping off, and it wears a flat patch on your wheels doing it.',
    mistakes: [
      {
        what: 'Standing tall as you turn.',
        fix: 'Get low before you throw the board sideways; height tips you over the wheels.',
      },
      {
        what: 'Leaning into the direction of travel.',
        fix: 'Keep your weight slightly behind the slide so the wheels skid rather than grip.',
      },
      {
        what: 'Turning only the board.',
        fix: 'Turn your shoulders and hips with it, or the board turns and you do not.',
      },
      {
        what: 'Straightening up too late.',
        fix: 'Bring the nose back round as the speed drops, before the wheels grip again.',
      },
    ],
    hard: 'Easy rather than Rookie because for the first time the wheels have to stop gripping. That needs real speed and a committed sideways push, and a half-hearted one grips and throws you.',
    isLive: true,
  },
  {
    id: 'sk-hippie-jump',
    name: 'Hippie Jump',
    sport: 'skate',
    cat: 'flat',
    diff: 2,
    pre: [],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Roll straight at a low bar, jump up off the board and let it carry on rolling underneath, then land back on it on the far side.',
    tips: 'Jump up, not forward, and keep your feet over the bolts. The board will still be there — the hard part is trusting that.',
    fact: 'It is taught as ollie preparation, because it teaches your feet to find the board again while you are in the air.',
    mistakes: [
      {
        what: 'Pushing off the board as you jump.',
        fix: 'Jump straight up from both feet; a push sends the board away from you.',
      },
      {
        what: 'Jumping too early.',
        fix: 'Leave the board just before the bar, not a metre before it.',
      },
      {
        what: 'Staring at the bar.',
        fix: 'Look past the bar to where the board will be when you come down.',
      },
      {
        what: 'Landing with straight legs.',
        fix: 'Bend your knees on the way down so the board does not shoot out.',
      },
    ],
    hard: 'Easy because the board never pops or spins; it just rolls. What makes it more than Rookie is leaving the board on purpose and finding it again while moving.',
    isLive: true,
  },
  {
    id: 'sk-body-varial',
    name: 'Body Varial',
    sport: 'skate',
    cat: 'flat',
    diff: 2,
    pre: ['sk-fakie-roll'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Jump off the rolling board, spin your body a half turn, and land back on it while the board keeps pointing the same way.',
    tips: 'Straight up, not sideways, and spin from the shoulders. Land over the bolts, not in the middle of the deck.',
    fact: 'You end up riding fakie without the board having turned at all, which is a good way to learn what fakie feels like.',
    mistakes: [
      {
        what: 'Not winding up first.',
        fix: 'Turn your arms and shoulders slightly the wrong way, then unwind into the spin.',
      },
      {
        what: 'Jumping forward as you spin.',
        fix: 'Jump straight up; the board is rolling and will meet you.',
      },
      {
        what: 'Landing with the feet together.',
        fix: 'Keep your feet a shoulder’s width apart so both land over a truck.',
      },
      {
        what: 'Spinning backside first.',
        fix: 'Learn it frontside, where you can see the board the whole way round.',
      },
    ],
    hard: 'Easy because the board does nothing but roll. Compared with riding fakie, your body has to leave the board, turn a half circle and find it again, all while moving.',
    isLive: true,
  },
  {
    id: 'sk-caveman',
    name: 'Caveman',
    sport: 'skate',
    cat: 'flat',
    diff: 2,
    pre: [],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Hold the board in your hand, throw it down under you and jump onto it in one movement, rolling away.',
    tips: 'Drop it flat and land over the bolts as it touches down. Hold it by the nose so it does not spin as it falls.',
    fact: 'It is the quickest way onto a board from standing, and skaters use it to get straight onto a ledge or a bank.',
    mistakes: [
      {
        what: 'Throwing the board forward.',
        fix: 'Drop it straight down under you; a throw leaves it ahead of your feet.',
      },
      {
        what: 'Jumping before the wheels touch.',
        fix: 'Let the board hit the ground first, then land on it a beat later.',
      },
      {
        what: 'Feet landing on nose and tail.',
        fix: 'Aim both feet for the bolts, or the board see-saws out.',
      },
      {
        what: 'Dropping it from too high.',
        fix: 'Hold it low, near your knees, so it has less time to twist.',
      },
    ],
    hard: 'Easy because you are standing still and the board is in your hands. It is harder than a hippie jump only because you have to land on a board that has just been moving.',
    isLive: true,
  },
  {
    id: 'sk-boneless',
    name: 'Boneless',
    sport: 'skate',
    cat: 'park',
    diff: 2,
    pre: ['sk-caveman'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Grab the board with your back hand, plant your front foot on the ground, then spring off that foot back onto the board and ride away.',
    tips: 'Grab first, plant second — doing it the other way round is how the board gets away from you. A small bank is easier than flat.',
    fact: 'It is older than the ollie and was one of the first ways skaters got airborne over anything.',
    mistakes: [
      {
        what: 'Planting the foot too far ahead.',
        fix: 'Step down close to the board so you can jump before the foot gets away.',
      },
      {
        what: 'Pushing the board away with the grab.',
        fix: 'Hold the toe edge with the back hand and keep the board against the back foot.',
      },
      {
        what: 'Jumping before the board is lifted.',
        fix: 'Lift the board with the hand, then spring off the planted foot.',
      },
      {
        what: 'Landing with the front foot late.',
        fix: 'Put the front foot back over the bolts before the wheels touch.',
      },
    ],
    hard: 'The caveman starts from standing. A boneless takes the front foot off a rolling board, jumps from it and gets it back on, all while one hand holds the board.',
    isLive: true,
  },
  {
    id: 'sk-no-comply',
    name: 'No Comply',
    sport: 'skate',
    cat: 'flat',
    diff: 2,
    pre: [],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Step your front foot down onto the ground for an instant while your back foot pops the board up, then step straight back on and roll away.',
    tips: 'The pop and the step happen together. Keep the board close to your leg so it does not shoot out in front.',
    fact: 'You do not need an ollie for it, which makes it one of the few real tricks available before you have one.',
    mistakes: [
      {
        what: 'Planting the front foot too far away.',
        fix: 'Step it down just beside the board, level with the front truck.',
      },
      {
        what: 'Back foot leaving the tail.',
        fix: 'Keep the back foot glued to the tail; it steers the board the whole time.',
      },
      {
        what: 'Pushing the tail down and away.',
        fix: 'Pop the tail straight down and slightly forward so it comes up towards your hip.',
      },
      {
        what: 'Standing up on the planted leg.',
        fix: 'Keep that leg bent; it is the spring for the jump back on.',
      },
    ],
    hard: 'Easy because one foot is on the ground the whole time, so you can always bail. Compared with a kick turn, the board leaves the ground and you have to get back on it.',
    isLive: true,
  },
  {
    id: 'sk-curb-drop',
    name: 'Curb Drop',
    sport: 'skate',
    cat: 'street',
    diff: 1,
    pre: [],
    about:
      'Roll straight off the edge of a low kerb and land both sets of wheels without the nose dipping.',
    tips: 'Weight over the back foot as you go over the edge, knees soft on landing. A kerb, not a stair set.',
    fact: 'It is the first time the board leaves the ground with you on it, and every drop and gap after it starts here.',
    mistakes: [
      {
        what: 'Lifting the nose too early.',
        fix: 'Lift the front wheels just as they reach the edge, not before.',
      },
      {
        what: 'Both feet in the middle.',
        fix: 'Back foot on the tail and front foot at the bolts, like a kick turn.',
      },
      {
        what: 'Slowing down before the edge.',
        fix: 'Keep rolling at a steady pace; a crawl lets the nose drop.',
      },
      {
        what: 'Landing on the back wheels first.',
        fix: 'Shift your weight forward as the tail clears so all four wheels land together.',
      },
    ],
    hard: 'Rookie because the kerb does the work: you are rolling off something the height of a hand. Nothing pops, and the only timing is a small nose lift at the edge.',
    isLive: true,
  },
  {
    id: 'sk-curb-ollie',
    name: 'Curb Ollie',
    sport: 'skate',
    cat: 'street',
    diff: 2,
    pre: ['sk-ollie', 'sk-curb-drop'],
    about:
      'Ollie up onto a kerb or low ledge and roll away on top of it, rather than rolling off one.',
    tips: 'Come in at a slight angle and pop earlier than you think. Level the board out over the edge before you land.',
    fact: 'It is the first rung of the whole street ladder — every ledge trick above it starts by getting on top of the ledge.',
    mistakes: [
      {
        what: 'Front foot lazy on the slide.',
        fix: 'Slide the front foot hard to the nose so the board levels and the tail clears the kerb.',
      },
      {
        what: 'Landing on the nose first.',
        fix: 'Bring the back knee up after the pop so all four wheels land on top together.',
      },
      { what: 'Looking at the kerb.', fix: 'Look at the spot on top where you want to land.' },
      {
        what: 'Creeping up to the kerb.',
        fix: 'Keep a steady pace so a slightly short ollie still carries the back wheels over.',
      },
    ],
    hard: 'Easy because it is the flat ollie with a target. What changes is that a rocket ollie now catches the tail on the kerb, so the front foot has to level the board every time.',
    isLive: true,
  },
  {
    id: 'sk-ramp-kickturn',
    name: 'Kick Turn on a Ramp',
    sport: 'skate',
    cat: 'park',
    diff: 1,
    pre: [],
    about:
      'Ride up a bank or a small ramp, press the tail and pivot at the top, then roll back down the way you came.',
    tips: 'Look back down the ramp before you turn. Go higher a little at a time rather than aiming for the coping on day one.',
    fact: 'It is what a rider does in their first hour on a ramp, and it works on every transition in the park.',
    mistakes: [
      {
        what: 'Lifting the nose too high.',
        fix: 'The wheels only need to clear the ramp; a big lift tips you backwards.',
      },
      {
        what: 'Turning with your feet first.',
        fix: 'Arms, shoulders, then hips; the board follows the turn, it does not start it.',
      },
      {
        what: 'Stopping halfway round.',
        fix: 'Keep turning until the nose points down the ramp, then set the wheels down.',
      },
      {
        what: 'Frontside before backside.',
        fix: 'Backside is easier because you can see the ramp; learn that side first.',
      },
    ],
    hard: 'This is the first trick on a slope. On flat a kick turn can stall; on a ramp you slow down as you climb and must turn before you stop.',
    isLive: true,
  },
  {
    id: 'sk-pump',
    name: 'Pump a Transition',
    sport: 'skate',
    cat: 'park',
    diff: 1,
    pre: [],
    about:
      'Speed without pushing. Sink down through the bottom of a transition and stand tall as it rises, and the ramp gives you the speed back.',
    tips: 'Time it against the shape of the ramp rather than counting. Your legs do the work; your arms stay quiet.',
    fact: 'Once you can pump you can ride a bowl for as long as your legs hold out without ever touching the ground.',
    mistakes: [
      {
        what: 'Standing tall through the bottom.',
        fix: 'Sink low as you enter the curve and stand up as the ramp rises under you.',
      },
      {
        what: 'Bouncing instead of pressing.',
        fix: 'Push down through the wheels on the steep part; hopping loses contact and speed.',
      },
      {
        what: 'Pumping on the flat.',
        fix: 'There is nothing to push against on flat; save it for where the ramp curves.',
      },
      {
        what: 'Pushing with a foot.',
        fix: 'Pushing off makes the board wobble at the top; let the pump make the speed.',
      },
    ],
    hard: 'It is the only trick here where nothing leaves the ramp. It sits at Rookie because the fall is small, not because the timing is simple: press too early or late and you go nowhere.',
    isLive: true,
  },
  {
    id: 'sk-roll-in',
    name: 'Roll In',
    sport: 'skate',
    cat: 'park',
    diff: 2,
    pre: ['sk-ramp-kickturn', 'sk-pump'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    supervise: true,
    about:
      'Enter a transition with speed already on, rolling over the top edge and down the ramp rather than starting stopped on the coping.',
    tips: 'Commit and keep your weight forward over the front foot. Slowing down at the edge is what makes the nose catch.',
    fact: 'It is a genuinely different trick from a drop in, where you start still — here you are already moving when you go over.',
    mistakes: [
      {
        what: 'Starting too close to the edge.',
        fix: 'Set up several board lengths back so you arrive rolling, not pushing.',
      },
      {
        what: 'Standing up over the lip.',
        fix: 'Crouch before the edge and stay low through the whole curve.',
      },
      {
        what: 'Rolling in straight at first.',
        fix: 'Come in on an angle with a small backside kick turn until you trust it straight.',
      },
      {
        what: 'First roll-ins on a big ramp alone.',
        fix: 'A small bank with someone watching is where this is learned; the fall is over the nose.',
      },
    ],
    hard: 'A kick turn and a pump keep you inside the ramp. A roll-in crosses the coping at speed with the nose leading, and there is no step-off once the front wheels tip over.',
    isLive: true,
  },
  {
    id: 'sk-tail-stall',
    name: 'Tail Stall',
    sport: 'skate',
    cat: 'park',
    diff: 2,
    pre: ['sk-drop-in', 'sk-pump'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Ride up the ramp, come to rest with the tail on the coping and the wheels off it, then drop back in.',
    tips: 'Get all the way up so the tail lands properly on the coping, not just near it. Keep your back foot weighted.',
    fact: 'Stalls teach you where the coping is without needing a trick over it, which is why they come before grinds.',
    mistakes: [
      {
        what: 'Dropping the tail too early.',
        fix: 'Wait until the back wheels are almost at the coping, or the tail slides on the ramp.',
      },
      {
        what: 'Dropping the tail too late.',
        fix: 'If the wheels roll over first, sit back sooner next time.',
      },
      {
        what: 'Standing up in the stall.',
        fix: 'Stay in a drop-in crouch on the tail and drop back in from there.',
      },
      {
        what: 'Too much speed on the way up.',
        fix: 'Enough to roll gently over the coping; any more and you fly over it.',
      },
    ],
    hard: 'It is a drop-in you have to arrive at yourself, rolling fakie. Timing the tail onto the coping is the new part: early slides, late rolls over.',
    isLive: true,
  },
  {
    id: 'sk-slash-grind',
    name: 'Slash Grind',
    sport: 'skate',
    cat: 'park',
    diff: 2,
    pre: ['sk-ramp-kickturn', 'sk-pump'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Carve up to the coping so the front truck passes over it and the back truck grinds along it for a moment, then carve back into the ramp.',
    tips: 'Speed and a carving line, not a straight one. Lean into the ramp as the truck catches so it does not throw you out.',
    fact: 'It is usually the first coping trick a rider gets, because you never have to stop or leave the ramp to do it.',
    mistakes: [
      {
        what: 'Approaching straight up the ramp.',
        fix: 'Come in at a slight angle so the back truck meets the coping side-on.',
      },
      {
        what: 'Trying to lock both trucks.',
        fix: 'Only the back truck touches; the front truck passes over and comes straight back.',
      },
      {
        what: 'Forcing the turn with your feet.',
        fix: 'Snap the shoulders round and let the board follow the carve.',
      },
      {
        what: 'Weight on the front foot.',
        fix: 'Shift weight back as you reach the top so the back truck can grind.',
      },
    ],
    hard: 'A ramp kick turn keeps the wheels on the ramp. This lets the back truck touch the coping for the first time, so it needs a carving line and enough speed to reach the top.',
    isLive: true,
  },
  {
    id: 'sk-no-comply-180',
    name: 'No Comply 180',
    sport: 'skate',
    cat: 'flat',
    diff: 3,
    pre: ['sk-no-comply', 'sk-180'],
    about:
      'A no comply with a half turn in it, so the board and your body rotate together off the planted foot and you roll away fakie.',
    tips: 'Turn your shoulders before your foot leaves the ground. The plant does the pushing and the shoulders do the spinning.',
    fact: 'It is one of the very few 180s you can learn without an ollie underneath it.',
    mistakes: [
      {
        what: 'Front foot planted too far away.',
        fix: 'Step it down just behind the heel edge, close enough to jump straight back on.',
      },
      {
        what: 'Back foot lifting during the turn.',
        fix: 'Keep the back foot glued to the grip and follow the board round.',
      },
      {
        what: 'Front foot angled like a kickflip.',
        fix: 'Point the front foot straight across the board or the board flips.',
      },
      {
        what: 'Waiting on the ground.',
        fix: 'Start the jump back the moment the front foot touches down.',
      },
    ],
    hard: 'Spicy because the no comply’s step now has a half turn on top: the back foot steers the board round while the front foot is on the ground and the shoulders are already turning.',
    isLive: true,
  },
  {
    id: 'sk-bs-180',
    name: 'Backside 180',
    sport: 'skate',
    cat: 'flat',
    diff: 3,
    pre: ['sk-ollie', 'sk-180'],
    about:
      'An ollie turned a half rotation backside, so you spin with your back leading and cannot see where you are landing until late.',
    tips: 'Wind your shoulders the opposite way first, then unwind hard. Turn your head last, not first.',
    fact: 'Frontside and backside 180s feel nothing alike, and almost every skater is noticeably better at one of them.',
    mistakes: [
      {
        what: 'Back foot on the outside of the tail.',
        fix: 'Move it towards the inside of the tail so it can push the board behind you.',
      },
      {
        what: 'Popping straight down.',
        fix: 'Pop the tail down and slightly behind you to start the board turning.',
      },
      {
        what: 'Expecting the full turn in the air.',
        fix: 'Land on the front truck and pivot the last few degrees round.',
      },
      {
        what: 'Trying it before the frontside.',
        fix: 'Get frontside 180s solid first; backside adds the blind landing on top.',
      },
    ],
    hard: 'Spicy alongside the frontside because your back leads the turn, so you lose sight of the landing for most of it. The pop and the wind-up are the same; the blind spot is new.',
    isLive: true,
  },
  {
    id: 'sk-switch-ollie',
    name: 'Switch Ollie',
    sport: 'skate',
    cat: 'flat',
    diff: 3,
    pre: ['sk-ollie', 'sk-fakie-roll'],
    about:
      'An ollie done standing the other way round, with your feet swapped. Same trick, completely rebuilt.',
    tips: 'Push around switch for a few sessions before you try to pop. It is the stance that needs learning, not the ollie.',
    fact: 'Skaters describe it as writing with the other hand. It doubles the size of your trick list without adding a new motion.',
    mistakes: [
      {
        what: 'Front foot too near the middle.',
        fix: 'Set it just behind the front bolts, the same place as in your normal ollie.',
      },
      {
        what: 'Popping with a soft ankle.',
        fix: 'Snap the tail with the ankle; the weaker foot needs a sharper pop, not a bigger one.',
      },
      {
        what: 'Sliding the front foot flat.',
        fix: 'Turn the foot slightly and roll it up on the outside edge, as you do forwards.',
      },
      {
        what: 'Standing tall to feel safer.',
        fix: 'Crouch as deep as you do regular; the height comes from the bend, not the nerve.',
      },
    ],
    hard: 'Spicy because every part of the ollie moves to the other foot: the strong foot now slides and the weak one pops. The trick is the same; the muscles doing it are not.',
    isLive: true,
  },
  {
    id: 'sk-half-cab',
    name: 'Half Cab',
    sport: 'skate',
    cat: 'flat',
    diff: 3,
    pre: ['sk-fakie-ollie', 'sk-fakie-roll', 'sk-kickturn'],
    about:
      'Rolling fakie, pop and turn a half rotation backside so you come out riding forwards again.',
    tips: 'Fakie ollies have to be comfortable first. Look over your shoulder into the turn before you pop, not during it.',
    fact: 'It is named after the full cab, and the half is what nearly every skater learns first.',
    mistakes: [
      {
        what: 'Feet trying to do the spin.',
        fix: 'Drive the turn with shoulders and hips; the feet cannot turn the board by themselves.',
      },
      {
        what: 'Knees staying low in the air.',
        fix: 'Pull the knees up towards your chest so the board has room to come round.',
      },
      {
        what: 'Weight sat back on the tail.',
        fix: 'Stay centred over the bolts, or the board shoots out ahead of you.',
      },
      {
        what: 'Landing between the bolts.',
        fix: 'Aim both feet for the bolts so you do not land primo.',
      },
    ],
    hard: 'Spicy because the fakie ollie now has a half turn in it, and the turn goes backside, so the landing is out of sight until late. It joins two things you learned separately.',
    isLive: true,
  },
  {
    id: 'sk-fs-pop-shuvit',
    name: 'Frontside Pop Shuvit',
    sport: 'skate',
    cat: 'flat',
    diff: 3,
    pre: ['sk-pop-shuvit'],
    about:
      'A pop shuvit spun the other way, so the board scoops away from you frontside instead of behind you.',
    tips: 'Scoop with the toes rather than the heel. Keep your front foot low over the board so it has somewhere to come back to.',
    fact: 'Most skaters find one direction far easier than the other, and which one is nothing to do with your stance.',
    mistakes: [
      {
        what: 'Back foot centred on the tail.',
        fix: 'Move it towards the outside of the tail so it can push the board forward.',
      },
      {
        what: 'Front foot chasing the board.',
        fix: 'Move the front foot a little back, out of the board’s path, and let it come round to you.',
      },
      {
        what: 'Scooping as hard as backside.',
        fix: 'Use less; the frontside board over-rotates far more readily.',
      },
      {
        what: 'Catching with the feet apart.',
        fix: 'Bring both feet down on the bolts together to stop the spin.',
      },
    ],
    hard: 'Spicy alongside the pop shuvit because the board now spins in front of you, where you cannot see it until late. The scoop is a push forward instead of behind, so the power is different.',
    isLive: true,
  },
  {
    id: 'sk-rock-n-roll',
    name: "Rock 'n' Roll",
    sport: 'skate',
    cat: 'park',
    diff: 3,
    pre: ['sk-rock-to-fakie', 'sk-ramp-kickturn'],
    about:
      'Push the front trucks over the coping, then lift clear and pivot a half turn on the way down so you ride away forwards.',
    tips: 'Get the front trucks properly over before you pivot. Lifting the nose as you turn is what stops it hanging up.',
    fact: 'It is usually rated easier than the rock to fakie, because turning out feels more natural than rolling backwards.',
    mistakes: [
      {
        what: 'Not winding your body up in the rock.',
        fix: 'Twist your shoulders backside while the board points frontside, so you have something to unwind.',
      },
      {
        what: 'Leaning back in the stall.',
        fix: 'Too much lean and the board slips away down the ramp.',
      },
      {
        what: 'Turning before the back wheels land.',
        fix: 'Plant the back wheels hard on the ramp first, then pivot the nose over.',
      },
      {
        what: 'A low front truck on the turn.',
        fix: 'Pull the front wheels high, up and over the coping, not across it.',
      },
    ],
    hard: 'A rock to fakie comes out backwards along the same line. Here you add a half turn from the stall, with the front truck lifting over the coping while your body unwinds.',
    isLive: true,
  },
  {
    id: 'sk-nose-stall',
    name: 'Nose Stall',
    sport: 'skate',
    cat: 'park',
    diff: 3,
    pre: ['sk-tail-stall', 'sk-nose-manual'],
    about:
      'Stall with the nose of the board resting on the coping and the wheels off it, then come back down into the ramp.',
    tips: 'Weight forward the whole time. Come in a little slower than for a tail stall — the nose grabs more.',
    fact: 'It is the front-foot mirror of the tail stall, and it is the stall that nosepicks and noseblunts grow out of.',
    mistakes: [
      {
        what: 'Front foot too far back.',
        fix: 'Move your front foot onto the nose before the ramp, not at the top.',
      },
      {
        what: 'Lifting the back wheels too early.',
        fix: 'Bend the back knee to lift the wheels only as the nose reaches the coping.',
      },
      {
        what: 'Full stall on day one.',
        fix: 'Tap the nose and drop back in first; hold it longer as your legs get stronger.',
      },
      {
        what: 'Moving the front foot back late.',
        fix: 'Return the front foot to the bolts as you sit back, in one movement.',
      },
    ],
    hard: 'The tail stall used the drop-in position you know. The nose stall puts you at the front of the board, lifting the back wheels, and sends you down fakie from there.',
    isLive: true,
  },
  {
    id: 'sk-feeble-stall',
    name: 'Feeble Stall',
    sport: 'skate',
    cat: 'park',
    diff: 3,
    pre: ['sk-axle-stall'],
    about:
      'Stall on the coping with the back truck locked on and the front truck hanging over the far side, resting on the deck.',
    tips: 'Axle stalls need to be solid first. Drop the front truck over deliberately rather than letting it fall over.',
    fact: 'It is usually described as the easiest step after the axle stall, and it teaches the shape of a feeble grind.',
    mistakes: [
      {
        what: 'Front truck landing on the coping.',
        fix: 'The front truck belongs over the far side, resting on the deck, not on the bar.',
      },
      {
        what: 'Weight over the front foot.',
        fix: 'Keep your weight on the back truck; the front is only resting.',
      },
      {
        what: 'Coming out without a lift.',
        fix: 'Lift the front truck back over the coping before you drop in, or it hangs up.',
      },
      {
        what: 'Board straight across the coping.',
        fix: 'Angle the nose slightly over the deck so the deck edge sits on the coping.',
      },
    ],
    hard: 'An axle stall puts both trucks on the coping. The feeble hangs the front truck over the far side, so you balance on one truck with the board tilted, then must lift it back.',
    isLive: true,
  },
  {
    id: 'sk-fastplant',
    name: 'Fastplant',
    sport: 'skate',
    cat: 'park',
    diff: 3,
    pre: ['sk-boneless', 'sk-ollie'],
    about:
      'A footplant like a boneless, but with an ollie under it and the board grabbed by the back hand rather than the front.',
    tips: 'Ollie first, grab second, plant last. Rushing the grab is what leaves the board behind.',
    fact: 'The different hand is what separates it from a boneless, and it lets you take it into a ramp rather than off flat.',
    mistakes: [
      {
        what: 'Taking too long in the air.',
        fix: 'It is called fast for a reason; plant and jump the moment the board is in your hand.',
      },
      {
        what: 'Grabbing with the front hand.',
        fix: 'The back hand grabs the toe edge; that is what separates it from a boneless.',
      },
      {
        what: 'Letting the front foot leave the board.',
        fix: 'The front foot stays on the board the whole time; only the back foot plants.',
      },
      {
        what: 'Planting the foot too far away.',
        fix: 'Plant close under you so you can spring straight back onto the board.',
      },
    ],
    hard: 'A boneless plants a foot from a rolling board. A fastplant plants it from an ollie, so the grab and the plant both happen in the air, in a shorter time.',
    isLive: true,
  },
  {
    id: 'sk-melon',
    name: 'Melon Grab',
    sport: 'skate',
    cat: 'air',
    diff: 3,
    pre: ['sk-indy', 'sk-backside-air'],
    about:
      'A backside air where your front hand reaches behind your leg to grab the heel edge between your feet, then tweaks the board out.',
    tips: 'Get backside airs clean first. Reach through early — the grab has to happen on the way up, not at the top.',
    fact: 'Melons, mutes and methods are all the same air with a different hand in a different place, and each has its own name for it.',
    mistakes: [
      {
        what: 'Reaching over your front knee.',
        fix: 'The front hand goes behind the front leg to the heel edge, not over the top.',
      },
      {
        what: 'Tweaking before the grab is solid.',
        fix: 'Grab first, then push the board forward; a tweak with a loose grip drops it.',
      },
      {
        what: 'Dropping the front shoulder.',
        fix: 'Keep your chest up as you reach behind your leg or you fold over the nose.',
      },
      {
        what: 'Landing still tweaked.',
        fix: 'Bring the board back square under you before you let go.',
      },
    ],
    hard: 'An indy uses the back hand on the toe side. A melon uses the front hand on the heel side, reaching behind the leg, so the grab has to happen sooner and further away.',
    isLive: true,
  },
  {
    id: 'sk-mute',
    name: 'Mute Grab',
    sport: 'skate',
    cat: 'air',
    diff: 3,
    pre: ['sk-indy'],
    about:
      'Grab the toe edge between your feet with your front hand, reaching around the front leg, while you turn backside.',
    tips: 'Pull your knees up to the board rather than reaching down to it. Let go early enough to get your feet flat.',
    fact: 'It is named after a skater who was deaf, and the name has stuck across skating, snowboarding and BMX.',
    mistakes: [
      {
        what: 'Grabbing the wrong edge.',
        fix: 'The front hand crosses in front of your body to the toe edge between your feet.',
      },
      {
        what: 'Board hanging below you.',
        fix: 'Suck both knees up so the board comes to the hand, not the hand to the board.',
      },
      {
        what: 'Watching the grab the whole time.',
        fix: 'You can see this grab out of the corner of your eye; look at the ramp instead.',
      },
      {
        what: 'Twisting the board sideways.',
        fix: 'Keep the board flat under you as you grab; the twist comes later.',
      },
    ],
    hard: 'The indy grab is with the back hand on the near edge. The mute crosses the front hand over to the same edge, which turns your shoulders and pulls you off line.',
    isLive: true,
  },
  {
    id: 'sk-tailgrab',
    name: 'Tail Grab',
    sport: 'skate',
    cat: 'air',
    diff: 3,
    pre: ['sk-indy'],
    about:
      'Grab the tail of the board with your back hand while you are in the air, then let go to land.',
    tips: 'Suck your back knee up so the tail comes to your hand. Grabbing low and late is how the board gets pulled off your feet.',
    fact: 'It is the grab most riders get first, because the tail is already closest to your hand when you leave the ramp.',
    mistakes: [
      {
        what: 'Front foot sliding off the nose.',
        fix: 'Press the front foot down into the nose as you reach back for the tail.',
      },
      {
        what: 'Reaching back with your shoulders.',
        fix: 'Turn only the arm back; keep the shoulders over the board.',
      },
      {
        what: 'Holding the tail too long.',
        fix: 'Drop the tail early so both feet are flat before the wheels land.',
      },
      {
        what: 'Grabbing the very tip.',
        fix: 'Grab the tail where it meets the wheel, so you have a real hold.',
      },
    ],
    hard: 'An indy holds the board in the middle, where it is steady. A tail grab holds one end, which tips the nose and unsettles the front foot, so it is famously twitchy.',
    isLive: true,
  },
  {
    id: 'sk-nosegrab',
    name: 'Nose Grab',
    sport: 'skate',
    cat: 'air',
    diff: 3,
    pre: ['sk-indy'],
    about: 'Grab the nose of the board with your front hand in the air, then let go again to land.',
    tips: 'Lift the nose towards your hand as you leave the lip. Keep your back foot pressed down or the board tips.',
    fact: 'It is used as much for control as for style — skaters grab the nose on a transfer to keep the board underfoot.',
    mistakes: [
      {
        what: 'Grabbing with the back hand.',
        fix: 'The front hand takes the nose; the back hand reaching that far pulls you round.',
      },
      {
        what: 'Back foot floating off the tail.',
        fix: 'Pop the back foot off only briefly; get it back over the bolts before you let go.',
      },
      {
        what: 'Pulling the nose up to your chest.',
        fix: 'Lift the nose only as far as the hand; more and the tail drops away.',
      },
      {
        what: 'Letting go too late.',
        fix: 'Release the nose before the wheels reach the ramp so the board levels out.',
      },
    ],
    hard: 'Like the tail grab it holds one end, but the end in front of you. Lifting the nose lowers the tail, so the board wants to slide out behind on landing.',
    isLive: true,
  },
  {
    id: 'sk-360-shuvit',
    name: '360 Pop Shuvit',
    sport: 'skate',
    cat: 'flat',
    diff: 4,
    pre: ['sk-pop-shuvit'],
    about:
      'A pop shuvit where the board spins a full circle underneath you before you catch it and ride away.',
    tips: 'Scoop harder and jump higher than for a pop shuvit, and lift your front foot right out of the way.',
    fact: 'Twice the rotation needs about twice the scoop, which is why plenty of skaters have a pop shuvit and not this.',
    mistakes: [
      {
        what: 'Toes hanging off the tail.',
        fix: 'Put the back foot squarely on the tail so the scoop does not add a flip.',
      },
      {
        what: 'Front foot angled across.',
        fix: 'Keep the front foot straight, or the board flips as it spins.',
      },
      {
        what: 'Scooping with everything at once.',
        fix: 'Build the scoop up over sessions; too much at once sends the board into a wild spin.',
      },
      {
        what: 'Watching the ground.',
        fix: 'Watch the board through the full circle and drop the feet as the nose comes round.',
      },
    ],
    hard: 'Gnarly because the board has to spin a full circle in the air, so the scoop needs twice a pop shuvit’s power without becoming a flip. More power and less flip pull against each other.',
    isLive: true,
  },
  {
    id: 'sk-nollie-kickflip',
    name: 'Nollie Kickflip',
    sport: 'skate',
    cat: 'flat',
    diff: 4,
    pre: ['sk-nollie', 'sk-kickflip'],
    about:
      'A kickflip popped off the nose from the nollie stance, so the board flips from the front end.',
    tips: 'Nollies and kickflips both need to be automatic. Flick off the tail side with your back foot — it is the mirror of a normal flick.',
    fact: 'Nollie flip tricks get their own tutorials rather than being filed as a stance variation, because the flick genuinely changes.',
    mistakes: [
      {
        what: 'Flicking towards the ground.',
        fix: 'Keep the flick level; the board flips from the corner, not from being kicked down.',
      },
      {
        what: 'Front foot not popping the nose.',
        fix: 'Snap the nose hard first; the flick means nothing without height.',
      },
      {
        what: 'Leaning back over the flick.',
        fix: 'Keep your weight forward over the nose the whole way through.',
      },
      {
        what: 'Learning it rolling.',
        fix: 'Stand still on grass and rehearse the pop and the flick until they feel like one move.',
      },
    ],
    hard: 'Gnarly because it is a kickflip with the roles swapped: the front foot pops the nose and the back foot flicks. Nollies sit lower than ollies, so the flick has less room.',
    isLive: true,
  },
  {
    id: 'sk-lipslide',
    name: 'Lipslide',
    sport: 'skate',
    cat: 'street',
    diff: 4,
    pre: ['sk-boardslide', 'sk-180'],
    about:
      'A boardslide taken the other way in: the tail goes over the ledge first and you turn in, sliding on the middle of the deck.',
    tips: 'Boardslides first. Ollie higher than feels needed so the tail clears the edge — catching it is the usual bail.',
    fact: 'From the front it looks nearly identical to a boardslide, and skaters can always tell which one it was.',
    mistakes: [
      {
        what: 'Turning before the tail is over.',
        fix: 'Get the whole board above the ledge, then turn the back end across.',
      },
      {
        what: 'Shoulders turning with the hips.',
        fix: 'Turn the hips into the slide and keep the shoulders facing along the ledge.',
      },
      {
        what: 'Feet drifting off the bolts.',
        fix: 'Keep both feet on the bolts so the board stays flat on the edge.',
      },
      {
        what: 'Weight leaning out over the ledge.',
        fix: 'Stay centred with a touch more on the back foot, or the board slips out.',
      },
    ],
    hard: "Gnarly while the boardslide is Spicy because you turn the back of the board over the ledge, so the ollie needs a backside 180's height and turn before the slide has even started.",
    isLive: true,
  },
  {
    id: 'sk-feeble',
    name: 'Feeble Grind',
    sport: 'skate',
    cat: 'street',
    diff: 4,
    pre: ['sk-50-50', 'sk-boardslide'],
    about:
      'The back truck grinds the ledge while the front truck hangs down over the far side of it.',
    tips: 'A low waxed ledge, not a handrail. Lean slightly over the ledge so the back truck stays locked on.',
    fact: 'It is one of a family of grinds that are all a 50-50 with one truck moved somewhere else.',
    mistakes: [
      {
        what: 'Front truck on top of the ledge.',
        fix: 'Let the front truck hang over the far side; on top is a 50-50.',
      },
      {
        what: 'Back truck landing short.',
        fix: 'Aim the back truck at the edge and let the deck’s edge rest across the ledge.',
      },
      {
        what: 'Weight sat on the front foot.',
        fix: 'Keep most of your weight over the back truck, which is doing the grinding.',
      },
      {
        what: 'Sliding off the end.',
        fix: 'Pop a small ollie out, or let it twist and turn out 180.',
      },
    ],
    hard: 'Gnarly because it is a 5-0 with the front truck dropped over the far side, so the board sits across the ledge like a boardslide while only the back truck grinds. Two locks, one balance.',
    isLive: true,
  },
  {
    id: 'sk-smith',
    name: 'Smith Grind',
    sport: 'skate',
    cat: 'street',
    diff: 4,
    pre: ['sk-50-50', 'sk-5-0'],
    about:
      'The back truck locks onto the ledge with the front truck dipped down below it on the near side, so the board angles into the obstacle.',
    tips: 'Keep the weight firmly on the back truck. If it drifts forward the front truck catches and stops you dead.',
    fact: 'It is named after Mike Smith, who is one of very few people with a grind named after them.',
    mistakes: [
      {
        what: 'Board staying level.',
        fix: 'Stretch the front leg so the nose presses down beside the ledge; level is a 5-0.',
      },
      {
        what: 'Leaning in over the ledge.',
        fix: 'Lean the body slightly away from it, standing on the back leg.',
      },
      {
        what: 'Body going loose mid-grind.',
        fix: 'Keep everything tense; the angle only holds while you hold it.',
      },
      {
        what: 'Front truck climbing onto the ledge.',
        fix: 'Keep the front truck down beside the ledge, on the side you came from.',
      },
    ],
    hard: 'Gnarly because it is a 5-0 with the nose pressed down beside the ledge, so the back truck grinds while the front truck is held in the air at an angle by muscle alone.',
    isLive: true,
  },
  {
    id: 'sk-wallride',
    name: 'Wallride',
    sport: 'skate',
    cat: 'street',
    diff: 4,
    pre: ['sk-ollie', 'sk-kickturn'],
    // Free by the free-tier shape at the top of this file.
    free: true,
    about:
      'Ride along a wall with all four wheels on the vertical surface, then come back down to the ground and roll away.',
    tips: 'Start on a slanted wall or a bank into a wall, and come in at an angle with speed. Keep the board flat against it.',
    fact: 'Speed is what keeps you on. Slowing down at the last second is the single most common way it goes wrong.',
    mistakes: [
      {
        what: 'Front foot doing the work.',
        fix: 'Push up the wall with the back foot; it carries most of the ride.',
      },
      {
        what: 'Nose above the tail coming off.',
        fix: 'Keep the front truck lower than the back as you drop back to the ground.',
      },
      {
        what: 'Leaning away from the wall.',
        fix: 'Drive your weight up the wall for as long as the speed lasts.',
      },
      {
        what: 'Tail not touching down first.',
        fix: 'Let the tail scrape the ground just before the wheels meet the wall.',
      },
    ],
    hard: 'Gnarly because the board is on its side on a vertical surface with only speed holding it there. The ollie gets you up and the kick turn brings you off; the wall is new ground.',
    isLive: true,
  },
  {
    id: 'sk-smith-stall',
    name: 'Smith Stall',
    sport: 'skate',
    cat: 'park',
    diff: 4,
    pre: ['sk-feeble-stall'],
    about:
      'Stall on the coping on the back truck with the front truck dropped below it into the ramp, then roll back in.',
    tips: 'Feeble stalls first. The front truck goes below the coping here, not above it — that is the whole difference.',
    fact: 'It is the stall version of the smith grind, and it is how most skaters learn where their weight has to sit for one.',
    mistakes: [
      {
        what: 'Front truck hanging over the deck.',
        fix: 'Point the nose down into the ramp; that is the feeble, not the smith.',
      },
      {
        what: 'Locking on with a flat board.',
        fix: 'Angle the front truck away and down so the deck edge sits on the coping.',
      },
      {
        what: 'Weight over the front truck.',
        fix: 'Stay over the back truck; the front truck is just a marker.',
      },
      {
        what: 'Popping out flat.',
        fix: 'Lift the nose slightly and press the back truck off, or the front wheels hang.',
      },
    ],
    hard: 'The feeble tilts the nose up over the deck. The smith tilts it down into the ramp, so the front truck has nothing to rest on and you balance on the back one alone.',
    isLive: true,
  },
  {
    id: 'sk-disaster',
    name: 'Disaster',
    sport: 'skate',
    cat: 'park',
    diff: 4,
    pre: ['sk-rock-n-roll', 'sk-180'],
    about:
      'Ollie a half turn at the lip and land across it, with the back truck over the edge and the nose pointing down into the transition.',
    tips: 'Land on the middle of the board, not the tail, then lean forward straight away to bring it back in.',
    fact: 'The name is honest: land too far back and it hangs up on the coping, which is exactly what it sounds like.',
    mistakes: [
      {
        what: 'Popping too close to the coping.',
        fix: 'Pop about a board length below the coping so you rise over it.',
      },
      {
        what: 'Turning the shoulders late.',
        fix: 'Wind the shoulders before the pop, the same as a 180 on flat.',
      },
      {
        what: 'Slamming the board onto the coping.',
        fix: 'Crouch as you land; a hard disaster snaps boards.',
      },
      {
        what: 'Lifting off the coping too soon.',
        fix: 'Press the front truck into the ramp long enough that the back truck lifts clear.',
      },
    ],
    hard: "A rock 'n' roll rolls the board over the coping. A disaster ollies a half turn onto it, landing across the bar on the middle of the board, then rocking back in.",
    isLive: true,
  },
  {
    id: 'sk-nosepick',
    name: 'Nosepick',
    sport: 'skate',
    cat: 'park',
    diff: 4,
    pre: ['sk-nose-stall', 'sk-axle-stall'],
    about:
      'Stall on the front truck on the coping with the tail high and the board grabbed, then hop back into the transition.',
    tips: 'Grab the board before the truck lands. Nose stalls and axle stalls both need to be steady first.',
    fact: 'It came from BMX, where the same balance point on the front end has been a coping trick for decades.',
    mistakes: [
      {
        what: 'Front truck landing on the deck.',
        fix: 'Aim the front truck onto the coping itself, not past it.',
      },
      {
        what: 'Tail dropping into the ramp.',
        fix: 'Pull the tail up with the grab so the board stays steep.',
      },
      {
        what: 'Straightening up on the coping.',
        fix: 'Stay folded over the front truck; the hop back in starts from low.',
      },
      {
        what: 'Letting go before you hop.',
        fix: 'Hold the grab through the hop and release as the wheels find the ramp.',
      },
    ],
    hard: 'A nose stall rests the nose on the coping. A nosepick locks the front truck on it and lifts the tail, held by a hand, so you re-enter with a hop instead of a lean.',
    isLive: true,
  },
  {
    id: 'sk-pivot-fakie',
    name: 'Pivot to Fakie',
    sport: 'skate',
    cat: 'park',
    diff: 4,
    pre: ['sk-rock-to-fakie', 'sk-5-0'],
    about:
      'Balance on the back truck alone at the coping, pivot round on it, and ride back down the ramp backwards.',
    tips: 'A 5-0 needs to be comfortable first — this is the same balance point, standing still. Turn your shoulders to pivot.',
    fact: 'Balancing on one truck at the top of a ramp is filed as an expert step on every transition ladder there is.',
    mistakes: [
      {
        what: 'Turning the shoulders with the hips.',
        fix: 'Turn only the hips 90 degrees to lock in; keep the shoulders straight.',
      },
      {
        what: 'Weight spread across both trucks.',
        fix: 'All your weight sits on the back truck; nothing on the front.',
      },
      {
        what: 'Lifting the front truck early.',
        fix: 'Wait until the back truck reaches the coping, then turn to lock on.',
      },
      {
        what: 'Front truck catching on the way out.',
        fix: 'Lean back into the ramp and lift the truck clear before you roll fakie.',
      },
    ],
    hard: 'A rock to fakie balances the middle of the board. A pivot balances one truck on the coping, and the turn to lock on and the turn back out are both done standing still.',
    isLive: true,
  },
  {
    id: 'sk-frontside-air',
    name: 'Frontside Air',
    sport: 'skate',
    cat: 'air',
    diff: 4,
    pre: ['sk-backside-air', 'sk-indy'],
    about:
      'Grab the toe edge between your feet with the trailing hand, lift off the lip, turn frontside and drop back in.',
    tips: 'Backside airs first. You are turning towards the ramp here, so look over your leading shoulder early.',
    fact: 'It is a separate milestone from the backside air, not a variation — the grab hand and the direction both change.',
    mistakes: [
      {
        what: 'Grabbing through your legs.',
        fix: 'Grab round the outside of your knees, or a stink-bug habit sets in.',
      },
      {
        what: 'Too much speed.',
        fix: 'Enough speed to clear the coping; any more and you lose control in the air.',
      },
      {
        what: 'Weight over the front foot at the lip.',
        fix: 'Let your weight drift to the back foot as you leave the coping so the board pops into your hand.',
      },
      {
        what: 'Going straight up the wall.',
        fix: 'Approach at a slight angle with your shoulders facing the coping.',
      },
    ],
    hard: 'A backside air turns you towards the ramp so you can see it. A frontside air turns your back to it first, so the landing is found by looking over the shoulder.',
    isLive: true,
  },
  {
    id: 'sk-stalefish',
    name: 'Stalefish',
    sport: 'skate',
    cat: 'air',
    diff: 4,
    pre: ['sk-backside-air', 'sk-melon'],
    about:
      'A heel-edge grab where the back hand reaches around behind the back leg to get it, while the board stays under you.',
    tips: 'Melons first — this is the same edge with the other hand. Reach behind the leg early or you will not get there.',
    fact: 'Tony Hawk named it after the food he was eating in Sweden in 1985 when he first tried it.',
    mistakes: [
      {
        what: 'Grabbing the toe edge.',
        fix: 'The back hand goes round behind the back leg to the heel edge.',
      },
      {
        what: 'Reaching for it on the coping.',
        fix: 'This grab comes late by nature; get the height first, then reach.',
      },
      {
        what: 'Twisting the shoulders back.',
        fix: 'Keep the chest facing forward and let the arm do the reaching.',
      },
      {
        what: 'Leaving the back knee straight.',
        fix: 'Fold the back knee so the heel edge comes up to meet the hand.',
      },
    ],
    hard: 'A melon reaches behind the front leg with the front hand. A stalefish reaches behind the back leg with the back hand, which is further, later and harder to see.',
    isLive: true,
  },
  {
    id: 'sk-method-air',
    name: 'Method Air',
    sport: 'skate',
    cat: 'air',
    diff: 4,
    pre: ['sk-melon', 'sk-backside-air'],
    about:
      'A backside air where the hips straighten and the knees fold so the board comes up high behind your back.',
    tips: 'Grab the heel edge, then push the board back and up with your legs. Height comes from the pull, not the jump.',
    fact: 'Neil Blender is credited with it in 1985, and it is still the trick used to show off style rather than difficulty.',
    mistakes: [
      {
        what: 'Bending at the waist.',
        fix: 'Straighten the hips and fold the knees; bending forward drops the board.',
      },
      {
        what: 'Grabbing too far back.',
        fix: 'Grab the heel edge between your feet, not near the tail.',
      },
      {
        what: 'Kicking the board out too late.',
        fix: 'Push the board back as you rise; at the top there is no time to tweak.',
      },
      {
        what: 'Not resetting before landing.',
        fix: 'Pull the board back under you before you let go.',
      },
    ],
    hard: 'A melon holds the heel edge and tweaks it forward. A method holds the same edge and folds the whole body so the board goes behind your back, then unfolds in time to land.',
    isLive: true,
  },
  {
    id: 'sk-benihana',
    name: 'Benihana',
    sport: 'skate',
    cat: 'air',
    diff: 4,
    pre: ['sk-tailgrab', 'sk-backside-air'],
    about:
      'A one-footed tail grab: the back foot comes right off and kicks down while the tail is held in the back hand.',
    tips: 'Tail grabs need to be solid first. Kick the foot straight down and bring it back before you start looking for the landing.',
    fact: 'It is one of a small group of tricks where a foot leaves the board completely, and it is by far the most common of them.',
    mistakes: [
      {
        what: 'Taking the back foot off early.',
        fix: 'Grab the tail first; the foot only leaves once the hand has it.',
      },
      {
        what: 'Front foot leaving the board.',
        fix: 'Straighten the front leg and keep that foot pressed on the board.',
      },
      {
        what: 'Rushing the kick.',
        fix: 'Slow it down; a tense, hurried kick throws the board off your front foot.',
      },
      {
        what: 'Trying it on the big ramp first.',
        fix: 'Learn it on flat from an ollie, then on a small ramp.',
      },
    ],
    hard: 'A tail grab keeps both feet on. A benihana takes the back foot off and kicks it down while one hand and one foot hold the board, so it needs stretch and calm.',
    isLive: true,
  },
  {
    id: 'sk-varial-heelflip',
    name: 'Varial Heelflip',
    sport: 'skate',
    cat: 'hybrid',
    diff: 4,
    pre: ['sk-heelflip', 'sk-pop-shuvit'],
    about:
      'A heelflip and a frontside pop shuvit at once, so the board flips and turns a half rotation in the same jump.',
    tips: 'Scoop and flick together. Keep your shoulders square — turning them makes the board spin past where you want it.',
    fact: 'It is the heelflip half of the pair. The varial kickflip is the same idea flicked the other way.',
    mistakes: [
      {
        what: 'Front foot toes on the board.',
        fix: 'Let your toes hang off the edge so the heel can kick out.',
      },
      {
        what: 'Popping straight down.',
        fix: 'Pop the tail down and a little forward to start the frontside spin.',
      },
      {
        what: 'Flicking out to the side.',
        fix: 'Kick the heel forward in front of you, not away from the board.',
      },
      {
        what: 'Only one foot doing the work.',
        fix: 'If it flips without spinning add scoop; if it spins without flipping add flick.',
      },
    ],
    hard: 'A heelflip kicks forward; a frontside shuvit pushes forward too. Doing both at once means two feet moving the same way with different jobs, and the board comes back facing the other way.',
    isLive: true,
  },
  {
    id: 'sk-frontside-flip',
    name: 'Frontside Flip',
    sport: 'skate',
    cat: 'hybrid',
    diff: 4,
    pre: ['sk-kickflip', 'sk-180'],
    about:
      'A kickflip and a frontside 180 in the same motion, so you and the board turn together and land rolling fakie.',
    tips: 'Both halves first, then commit to the turn before the flick. Being timid with the shoulders is why it under-rotates.',
    fact: 'It is one of the tricks skaters point to as the moment flip tricks and spins stopped being separate lists.',
    mistakes: [
      {
        what: 'A flat, straight-down pop.',
        fix: 'Pop the tail down and forward to help the board round the turn.',
      },
      {
        what: 'Catching the flip before the turn.',
        fix: 'Let the board flip through, then catch it as your body finishes turning.',
      },
      {
        what: 'Landing stiff at 90 degrees.',
        fix: 'Land with weight on the front truck and let the back truck slide the last bit round.',
      },
      {
        what: 'Front foot too far forward.',
        fix: 'Set the front foot just behind the bolts at a kickflip angle.',
      },
    ],
    hard: 'A kickflip and a 180 each need a full pop. Together the pop has to spin you, flip the board and keep it under you as you turn, all in one jump.',
    isLive: true,
  },
  {
    id: 'sk-bigspin',
    name: 'Bigspin',
    sport: 'skate',
    cat: 'hybrid',
    diff: 4,
    pre: ['sk-pop-shuvit', 'sk-180'],
    about:
      'A backside 360 pop shuvit with a 180 body varial, so the board spins twice as far as you do.',
    tips: 'Get 360 shuvits landing first. Turn your body only half as far as the board — over-spinning yourself is the usual miss.',
    fact: 'The board and the rider finishing in different places is the whole trick, and it is why it reads so strangely on film.',
    mistakes: [
      {
        what: 'Scooping like a normal shuvit.',
        fix: 'The tail needs a harder scoop than a pop shuvit to get the full 360.',
      },
      {
        what: 'Catching too late.',
        fix: 'Catch the board on the bolts about 90 degrees into your turn and turn the rest together.',
      },
      {
        what: 'Shoulders not wound up.',
        fix: 'Bend and turn the shoulders before the pop; they start your 180.',
      },
      {
        what: 'Landing on the tail.',
        fix: 'Land over the bolts with knees bent; a tail landing ends the spin early.',
      },
    ],
    hard: 'A pop shuvit spins the board half a turn and you not at all. A bigspin spins the board a full turn while you turn half, so the two spins have to finish together.',
    isLive: true,
  },
  {
    id: 'sk-half-cab-flip',
    name: 'Half-Cab Kickflip',
    sport: 'skate',
    cat: 'hybrid',
    diff: 4,
    pre: ['sk-kickflip', 'sk-fakie-ollie'],
    about:
      'Rolling fakie, pop into a half turn backside and kickflip the board part way through the rotation, landing forwards.',
    tips: 'Half cabs and kickflips both need to be automatic. Flick after the turn has started, not before.',
    fact: 'It is one of the most-used tricks in street skating, because it comes out of fakie and lands you back facing forwards.',
    mistakes: [
      {
        what: 'Back foot catching the board.',
        fix: 'Tuck the back foot up as you turn so the board can flip under it.',
      },
      {
        what: 'Catching late.',
        fix: 'Catch the board as soon as the flip finishes and carry it round the last part.',
      },
      {
        what: 'Turning from the feet.',
        fix: 'Start the turn with your head and shoulders; the feet follow.',
      },
      {
        what: 'Rolling fakie too slowly.',
        fix: 'A little speed helps the board round; a crawl leaves it under-rotated.',
      },
    ],
    hard: 'The half cab turns you backside from fakie; the kickflip flips the board. Here the flick happens mid-turn, rolling backwards, so the board flips while it is also rotating under you.',
    isLive: true,
  },
  {
    id: 'sk-bluntslide',
    name: 'Bluntslide',
    sport: 'skate',
    cat: 'street',
    diff: 5,
    pre: ['sk-tailslide', 'sk-50-50'],
    about:
      'Slide along the ledge on the tail with the back wheels resting up on the edge, then pop out of it at the end.',
    tips: 'A low waxed ledge, and pop out rather than sliding off. This one hangs up hard if the wheels drop.',
    fact: 'The back wheels being on top of the edge is what separates it from a tailslide, and it is why it stops so suddenly.',
    mistakes: [
      {
        what: 'Back truck not clearing the ledge.',
        fix: 'Ollie high enough for the back wheels to land on top of the edge.',
      },
      {
        what: 'Board lying flat.',
        fix: 'Keep the board as close to upright as you can; flat is what slips out.',
      },
      {
        what: 'Weight forward off the tail.',
        fix: 'Keep nearly all your weight on the tail, leaning slightly away from the ledge.',
      },
      {
        what: 'Shoulders over-rotating.',
        fix: 'Keep the shoulders facing along the ledge, not round past it.',
      },
    ],
    hard: 'Pro because the back wheels sit on top of the ledge, so the board stands almost upright on its tail, and you must pop out rather than slide off. Every part is at its limit.',
    isLive: true,
  },
  {
    id: 'sk-noseblunt',
    name: 'Noseblunt Slide',
    sport: 'skate',
    cat: 'street',
    diff: 5,
    pre: ['sk-noseslide', 'sk-crooked', 'sk-bluntslide'],
    about:
      'Slide on the nose with the front wheels resting on top of the edge of the ledge, then come out of it forwards.',
    tips: 'Bluntslides and noseslides both first. Get right over the nose and stay there — leaning back drops you off the ledge.',
    fact: 'It is routinely listed among the hardest ledge tricks, mostly because of how little of the board is actually on anything.',
    mistakes: [
      {
        what: 'Front wheels short of the top.',
        fix: 'Ollie high so both front wheels land up on the ledge, not against it.',
      },
      {
        what: 'Board flattening out.',
        fix: 'Hold the board steep on its nose; a flat board drops the wheels off.',
      },
      {
        what: 'Locking in with the nose angled.',
        fix: 'Land the nose square across the ledge; an angle turns it into a crooked grind.',
      },
      {
        what: 'Letting the nose drop off the end.',
        fix: 'Pop the nose to come out forwards rather than letting it drop.',
      },
    ],
    hard: 'Pro because it is the bluntslide on the nose, so the balance point is ahead of you, and the wheels on the ledge drag like a powerslide the whole way. Nothing below asks for both.',
    isLive: true,
  },
  {
    id: 'sk-airwalk',
    name: 'Airwalk',
    sport: 'skate',
    cat: 'air',
    diff: 5,
    pre: ['sk-benihana', 'sk-frontside-air'],
    about:
      'A backside air with the nose grabbed in the front hand and both feet off, split wide apart, before they come back to the board.',
    tips: 'Grab the nose properly before the feet leave. Bring them back early — reaching for the board late is how it ends.',
    fact: 'It is one of very few no-footed vert tricks with a published step-by-step, which is why it is here and its cousins are not.',
    mistakes: [
      {
        what: 'Feet going the same way.',
        fix: 'Front foot kicks off the toe side, back foot off the heel side.',
      },
      {
        what: 'Grabbing the nose with the back hand.',
        fix: 'The front hand holds the nose; the back hand is free for balance.',
      },
      {
        what: 'Kicking wide on a small air.',
        fix: 'Height first; the split needs time you only get above the coping.',
      },
      {
        what: 'Bringing the feet back one at a time.',
        fix: 'Both feet come back together onto the bolts, before you look down.',
      },
    ],
    hard: 'A benihana takes one foot off; an airwalk takes both. For a moment only the hand on the nose holds the board, and both feet have to find the bolts again before landing.',
    isLive: true,
  },
  {
    id: 'sk-backside-flip',
    name: 'Backside Flip',
    sport: 'skate',
    cat: 'hybrid',
    diff: 5,
    pre: ['sk-frontside-flip', 'sk-kickflip'],
    about:
      'A kickflip merged with a backside 180, so you turn away from where the board is heading and land rolling fakie.',
    tips: 'Frontside flips first. You cannot see the landing here until very late, so commit to the full turn from the pop.',
    fact: 'Skaters routinely name it as the trick that took them longest, because the flick and the blind turn fight each other.',
    mistakes: [
      {
        what: 'Board flipping away behind you.',
        fix: 'Lean slightly back into the trick and pop straight up and higher.',
      },
      {
        what: 'Shoulders not started.',
        fix: 'Wind the shoulders backside before the pop, the same as a backside 180.',
      },
      {
        what: 'Hunting for the back-truck pivot.',
        fix: 'Aim to finish the whole turn in the air rather than sliding the last bit.',
      },
      {
        what: 'Front foot flat on the board.',
        fix: 'Set it slightly behind the front bolts at the kickflip angle.',
      },
    ],
    hard: 'A frontside flip lets you watch the board most of the way. A backside flip turns you away from it, so the flip and catch happen with your back to the landing.',
    isLive: true,
  },
  {
    id: 'sk-inward-heelflip',
    name: 'Inward Heelflip',
    sport: 'skate',
    cat: 'hybrid',
    diff: 5,
    pre: ['sk-heelflip', 'sk-varial-heelflip'],
    about:
      'A backside pop shuvit merged with a heelflip, so the board rotates in towards you while it flips.',
    tips: 'Varial heelflips first — this is the same pair spun the other way. Keep your front foot high out of the path.',
    fact: 'It is the heel-side counterpart of the hardflip, and skaters usually find one of the two much easier than the other.',
    mistakes: [
      {
        what: 'Turning your upper body backside.',
        fix: 'Keep the shoulders facing forward; only the legs do the backside heelflip.',
      },
      {
        what: 'Shuvit before the flip.',
        fix: 'Flick the heelflip first and let the backside spin follow.',
      },
      { what: 'A small ollie.', fix: 'Pop high; the board needs time to flip and spin under you.' },
      {
        what: 'Feet in the way.',
        fix: 'Lift both feet clear and put them back over the bolts as the flip finishes.',
      },
    ],
    hard: 'A varial heelflip spins the board frontside, away from the heel that flicks it. The inward spins it backside, towards that heel, so the board comes at your front foot as it flips.',
    isLive: true,
  },
  {
    id: 'sk-laser-flip',
    name: 'Laser Flip',
    sport: 'skate',
    cat: 'hybrid',
    diff: 5,
    pre: ['sk-varial-heelflip', 'sk-heelflip'],
    about:
      'A frontside 360 shuvit and a heelflip at once — the board turns a full circle and flips heel side in the same jump.',
    tips: 'You need a big ollie and a clean heelflip before you start. Scoop hard with the back foot and stay over the board.',
    fact: 'It is regularly named among the hardest tricks in skateboarding, and it is the heel-side mirror of the tre flip.',
    mistakes: [
      {
        what: 'Flicking too early.',
        fix: 'Wait until the board has turned about 90 degrees, then flick.',
      },
      { what: 'Flicking forward.', fix: 'Flick in the direction the board is already spinning.' },
      {
        what: 'Jumping forward.',
        fix: 'Jump straight up; the board will follow the spin without you chasing it.',
      },
      {
        what: 'Rolling too slowly.',
        fix: 'A bit of speed keeps the board under you; a crawl lets it fly behind.',
      },
    ],
    hard: 'A varial heelflip spins the board half a turn frontside. A laser spins it a full turn, so the flick has to wait for the spin and then match its direction.',
    isLive: true,
  },
  {
    id: 'sk-kickflip-50-50',
    name: 'Kickflip 50-50',
    sport: 'skate',
    cat: 'hybrid',
    diff: 5,
    pre: ['sk-kickflip', 'sk-50-50'],
    about:
      'Kickflip into a 50-50, landing with both trucks locked on a ledge or a box, then grind along and ride out.',
    tips: 'On a ledge or a box, never a handrail. Catch the flip fully before the trucks touch — a half-caught flip locks on crooked.',
    fact: 'Flipping into a grind is the whole street trick list folded in half, and 50-50 is where riders always start doing it.',
    mistakes: [
      {
        what: 'Approaching straight at the ledge.',
        fix: 'Come in nearly parallel, the same line as a plain 50-50.',
      },
      {
        what: 'Trucks landing one at a time.',
        fix: 'Catch the board level so both trucks meet the ledge together.',
      },
      {
        what: 'Weight too far forward on the lock.',
        fix: 'Stay centred over the trucks; forward sticks, backward slips.',
      },
      { what: 'Dry ledge.', fix: 'Wax it; a grabbing ledge stops the trucks and pitches you off.' },
    ],
    hard: 'A 50-50 lands two trucks on an edge from an ollie. Adding a kickflip means catching a flipping board level at the exact height of the ledge, with no ground to save a crooked catch.',
    isLive: true,
  },

  /* ------------------------------------------------------------------ bmx --
   *
   * BMX, added by T21. **Read this before changing a `diff` or a `pre`.**
   *
   * Unlike the scooter and skate blocks above, these did not come from the
   * design pack — there was none for BMX. They were researched from published
   * BMX coaching sources (Ride UK's Basics series, Dan's Comp, BMXtrix, BMX
   * Union, The-House, a coached flip progression) and the full sourcing,
   * including where sources disagreed, is in the review document dated
   * 2026-08-16.
   *
   * Two honest caveats, recorded because a later session will otherwise assume
   * these numbers are as settled as the other two sports':
   *
   *  1. **No `diff` here comes from a source that rates difficulty.** No BMX
   *     source uses a five-point scale; the numbers are a mapping of published
   *     tiers and tutorial ordering onto ours.
   *  2. **Nine prerequisite edges are inference, not citation** — chiefly the
   *     ones hanging off `bmx-air`, plus `bmx-nose-manual` and `bmx-wallride`.
   *     Sources disagree outright on the grind order (`bmx-feeble` vs
   *     `bmx-double-peg`) and on where `bmx-disaster` belongs.
   *
   * Flatland proper — hang-5, time machine, steamroller — is deliberately
   * absent: it is a separate discipline on a different bike and needs its own
   * tree, not a few tricks bolted onto a park and street progression.
   * Handrails, double flips and brakeless variants were excluded on safety
   * grounds, since no source gives a graduated path to them for a child.
   *
   * **The doubles rule is scoped to flips, and only flips** (Rachid,
   * 2026-09-04, in chat). "Double flips" above was read by a later session as
   * covering doubles of anything, which would have kept out the double and
   * triple tailwhip — tricks with no inversion in them at all, sitting on the
   * same ladder as the tailwhip already here. The owner ruled that it does
   * not extend that far, and the two whips ship in the T27 BMX block below.
   * Nothing else moved: handrails, double *flips* and brakeless variants stay
   * excluded on the original grounds, and this line is the record of the
   * scoping rather than a licence to widen it further.
   */

  {
    id: 'bmx-wheelie',
    name: 'Wheelie',
    sport: 'bmx',
    cat: 'flat',
    diff: 1,
    pre: [],
    about:
      'Pedal hard and pull up on the bars so the front wheel lifts, then keep pedalling to hold it there. The whole trick is finding the point where the bike balances and staying on it.',
    tips: 'Sit down, stay in a low gear and cover your back brake with one finger. A tap of that brake drops the front end back before you loop out.',
    fact: 'It teaches you where the balance point lives. Manuals and everything built on them start from this feeling.',
    mistakes: [
      {
        what: 'Pulling the front up with your arms.',
        fix: 'Snap your hips back as you push the first pedal stroke and let the bars come up on their own.',
      },
      {
        what: 'Pedalling too hard and looping out.',
        fix: 'Keep the pedal strokes small and even, and tap the back brake the moment it climbs too high.',
      },
      {
        what: 'Steering with big handlebar turns.',
        fix: 'Keep your shoulders square and steer with tiny hip shifts instead.',
      },
      {
        what: 'Staring down at the front wheel.',
        fix: 'Look far ahead and pick a line; the bike follows your eyes.',
      },
    ],
    hard: 'There is nothing before it, and the bike helps: pedalling holds the height and a brake tap drops it, so it forgives more than a manual does.',
    isLive: true,
  },
  {
    id: 'bmx-pump',
    name: 'Pump a Ramp',
    sport: 'bmx',
    cat: 'park',
    diff: 1,
    pre: [],
    about:
      'Not a trick, a skill. You push down through the bottom of a transition and lift as you rise, and the ramp gives you speed back. No pedalling needed.',
    tips: 'Think of a swing. Lean back going up, lean forward coming down, and let your legs do the pushing.',
    fact: 'Pumping is how park riders hold speed through a whole run. Get it early and every ramp trick after it gets easier.',
    mistakes: [
      {
        what: 'Pedalling through the transition.',
        fix: 'Stop pedalling before the ramp and let your legs push the bike down the curve instead.',
      },
      {
        what: 'Standing stiff with locked knees.',
        fix: 'Bend your knees and elbows so there is something to push with at the bottom.',
      },
      {
        what: 'Pushing at the wrong moment.',
        fix: 'Push down as the wheels roll into the curve and lighten up as you rise out of it.',
      },
      {
        what: 'Leaning away from the ramp.',
        fix: 'Keep your chest over the bars going up so the front wheel stays planted.',
      },
    ],
    hard: 'It is the first thing you learn on a ramp and nothing has to leave the ground. The only skill is timing a push, which is why it sits at Rookie.',
    isLive: true,
  },
  {
    id: 'bmx-track-stand',
    name: 'Track Stand',
    sport: 'bmx',
    cat: 'flat',
    diff: 1,
    pre: [],
    about:
      'Standing still on the bike without putting a foot down. Turn the front wheel slightly across and balance with tiny pushes on the pedals.',
    tips: 'Find a very slight uphill and rest against it. Look ahead at something still, not down at your front wheel.',
    fact: 'It is the cheapest balance practice there is, and you can do it while you wait your turn on a ramp.',
    mistakes: [
      {
        what: 'Keeping the bars dead straight.',
        fix: 'Turn the front wheel a little across so the tyre has something to push against.',
      },
      {
        what: 'Locking your arms and shoulders.',
        fix: 'Relax your grip and keep a bend in your elbows; tension makes the wobble bigger.',
      },
      {
        what: 'Looking down at the front tyre.',
        fix: 'Fix your eyes on something still a metre or two ahead.',
      },
      {
        what: 'Letting your shoulders drift sideways.',
        fix: 'Keep your hips over the cranks and your chest centred; your upper body is the heavy part.',
      },
    ],
    hard: 'Nothing comes before it and nothing is moving, so a fall is a foot down. The whole skill is tiny pedal pressure against the slope, and that takes patience rather than power.',
    isLive: true,
  },
  {
    id: 'bmx-curb-drop',
    name: 'Curb Drop',
    sport: 'bmx',
    cat: 'street',
    diff: 1,
    pre: [],
    about:
      'Roll off a curb or a low ledge and land both wheels without the front end diving. Your first taste of getting the bike off the ground.',
    tips: 'Keep your weight back over the rear tyre as you go over the edge. Start on a curb, not a set of stairs.',
    fact: 'Every drop, gap and ledge trick starts here. Get comfortable rolling off small things before you hop onto anything.',
    mistakes: [
      {
        what: 'Rolling off with your weight forward.',
        fix: 'Shift your hips back and straighten your arms just before the edge so the front stays light.',
      },
      {
        what: 'Landing on the front wheel first.',
        fix: 'Let the back wheel touch first or both together; a nose-first landing loads your wrists.',
      },
      {
        what: 'Stiff legs on the landing.',
        fix: 'Bend your knees and elbows as the wheels touch so they soak up the drop.',
      },
      {
        what: 'Going too fast the first time.',
        fix: 'Roll to the edge at walking pace until the weight shift feels automatic.',
      },
    ],
    hard: 'There is nothing before it and the bike does the drop for you. All you are learning is the weight shift back and the soft landing that every hop and grind uses later.',
    isLive: true,
  },
  {
    id: 'bmx-bunny-hop',
    name: 'Bunny Hop',
    sport: 'bmx',
    cat: 'flat',
    diff: 2,
    pre: [],
    about:
      'Both wheels off the ground in one motion. Pull the bars back and up, then push forward over the front and suck your feet up so the back wheel follows.',
    tips: 'Learn the front wheel lift on its own first, then add the back end. Hop over a stick or a crack before you go near anything with a real edge.',
    fact: 'This is the trick everything else needs. 180s, grinds, barspins and whips are all a bunny hop with something added.',
    mistakes: [
      {
        what: 'Yanking the bike up with your arms.',
        fix: 'Compress, then spring up from your legs and hips; the arms just guide the bars.',
      },
      {
        what: 'Straightening your legs too early.',
        fix: 'Stay crouched until the front wheel is at its peak, then push the bars forward and scoop.',
      },
      {
        what: 'Front wheel too low before the scoop.',
        fix: 'Lift the front higher first; the back wheel only follows if the front leads.',
      },
      {
        what: 'Riding with pedals up and down.',
        fix: 'Set the pedals level before every hop so your feet can scoop together.',
      },
    ],
    hard: 'It has no prerequisite, but it asks for two movements timed together: a front wheel lift, then a forward push and a scoop with the feet. That timing is why it is not Rookie.',
    isLive: true,
  },
  {
    id: 'bmx-manual',
    name: 'Manual',
    sport: 'bmx',
    cat: 'flat',
    diff: 2,
    pre: [],
    about:
      'Rolling along on the back wheel with no pedalling. You shift your hips back behind the seat and hold the bike at its balance point.',
    tips: 'Push the bike forward underneath you rather than yanking the bars back. Keep a finger on the rear brake so you can tap out if you go too far.',
    fact: 'Manuals carry you across flat sections without pedalling, and they are the base of nose manuals and every manual out of a grind.',
    mistakes: [
      {
        what: 'Standing tall over the bike.',
        fix: 'Get low with your bottom near the back tyre; the lower you are, the steadier it is.',
      },
      {
        what: 'Locking your arms straight at the start.',
        fix: 'Keep a little bend as the wheel lifts, then let the arms extend once you find the balance point.',
      },
      {
        what: 'Leaning too far back.',
        fix: 'Shift your weight back gradually and practise catching a loop-out with one foot on grass first.',
      },
      {
        what: 'Fully straightening your legs.',
        fix: 'Keep your knees bent so tiny leg movements can raise or drop the front wheel.',
      },
    ],
    hard: 'Unlike a wheelie there is no pedalling to hold you up, so the whole trick is a balance point just short of tipping backwards. Finding and holding it is the whole trick.',
    isLive: true,
  },
  {
    id: 'bmx-drop-in',
    name: 'Drop In',
    sport: 'bmx',
    cat: 'park',
    diff: 2,
    pre: ['bmx-bunny-hop'],
    supervise: true,
    about:
      'Starting up on the deck with your back wheel on the coping, then committing forward down the ramp. It is over in a second.',
    tips: 'Small hop off the back wheel so both wheels land flat on the transition, and get your weight forward. Leaning back is the one thing that puts you down.',
    fact: 'Once you can drop in you can use every ramp in the park instead of riding around them.',
    mistakes: [
      {
        what: 'Leaning back as you go over.',
        fix: 'Lean your head and chest into the ramp; leaning away is what tips you onto your back.',
      },
      {
        what: 'Rolling in too slowly.',
        fix: 'Put a solid crank in on the deck so you reach the coping with balance to spare.',
      },
      {
        what: 'Approaching exactly parallel to the coping.',
        fix: 'Come in at a slight angle so your tyre cannot catch in the groove behind the coping.',
      },
      {
        what: 'First go with nobody watching.',
        fix: 'Once you tip in you cannot step out, so have someone there for the first few on a small ramp.',
      },
    ],
    hard: 'Your bunny hop already gets both wheels off the ground. What is new is committing to a slope you cannot stop on, which is a nerve skill more than a bike skill.',
    isLive: true,
  },
  {
    id: 'bmx-fakie',
    name: 'Fakie',
    sport: 'bmx',
    cat: 'park',
    diff: 2,
    pre: ['bmx-drop-in'],
    about:
      'Rolling backwards. You ride up a quarter pipe or a wall, run out of speed and come back down the way you came without turning round.',
    tips: 'Learn it on a small quarter. Look over your shoulder, stay centred and let the bike roll — fighting it is what makes it wobble.',
    fact: 'You need fakie to roll away from a 180. Sort it early and half the spin tricks stop being scary.',
    mistakes: [
      {
        what: 'Jumping before the front wheel reaches the coping.',
        fix: 'Ride all the way up and let the bike run out of speed on its own.',
      },
      {
        what: 'Leaning back as you roll down.',
        fix: 'Lean towards the front tyre on the way down so the bike cannot throw you off the back.',
      },
      {
        what: 'Back-pedalling too fast.',
        fix: 'Turn the cranks backwards just enough to stay with the bike; too fast and you loop out.',
      },
      {
        what: 'Staring at the front tyre.',
        fix: 'Look over your shoulder at where you are going and turn your head first, then your shoulders.',
      },
    ],
    hard: 'You already drop in, so the ramp is familiar. Riding backwards is the new part, and the bike steers the wrong way until you have felt it a few times.',
    isLive: true,
  },
  {
    id: 'bmx-x-up',
    name: 'X-Up',
    sport: 'bmx',
    cat: 'flat',
    diff: 2,
    pre: [],
    about:
      'Turn the bars a full 180 degrees so your arms cross into an X, then turn them back. You can do it rolling along — no hop needed.',
    tips: 'Try it standing still holding a wall first. Loosen your grip so your wrists are not fighting the turn.',
    fact: 'It is the first bar trick most riders get, and it is the doorway to barspins and turndowns.',
    mistakes: [
      {
        what: 'Hands too far out on the grips.',
        fix: 'Move your hands inwards a little; a narrower grip gives your arms room to cross.',
      },
      {
        what: 'Turning the bars slowly.',
        fix: 'Turn them fast and fully, then bring them straight before the front wheel touches down.',
      },
      {
        what: 'Leaning back as the bars cross.',
        fix: 'Stay centred over the bike so the front end stays under control.',
      },
      {
        what: 'Landing with the bars still turned.',
        fix: 'If they are not straight, drop the bike and step off; a half-turned landing hurts.',
      },
    ],
    hard: 'Nothing comes before it, but your arms are crossed in a position they hate, and a wide bar catches your knees. Balance and a full, quick turn are the two things being tested.',
    isLive: true,
  },
  {
    id: 'bmx-nollie',
    name: 'Nollie',
    sport: 'bmx',
    cat: 'flat',
    diff: 2,
    pre: ['bmx-bunny-hop'],
    about:
      'A bunny hop backwards. Your weight goes forward over the front wheel and the back end comes up first.',
    tips: 'Start by just lifting the back wheel and setting it straight back down. Keep the lift small until it stops feeling like you are about to go over the bars.',
    fact: 'Nollies teach you to put your weight forward on purpose, which is exactly what nose manuals and front-peg grinds need.',
    mistakes: [
      {
        what: 'Lifting the back wheel with your arms.',
        fix: 'Push the bars down and forward, then scoop the pedals up with your feet.',
      },
      {
        what: 'Expecting bunny hop height.',
        fix: 'Keep it small; a nollie never goes as high as a hop, so aim over a line, not a kerb.',
      },
      {
        what: 'Weight not far enough forward.',
        fix: 'Lean over the bars until the back wheel wants to lift on its own, before you pop.',
      },
      {
        what: 'Snapping the front down late.',
        fix: 'Pull the bars up to your body as soon as the back wheel is up, or the front stays planted.',
      },
    ],
    hard: 'It is the bunny hop in reverse, so the hop comes first. The back wheel lifts before the front, which means putting your weight over the bars, the opposite of what the hop taught.',
    isLive: true,
  },
  {
    id: 'bmx-pull-up-barspin',
    name: 'Pull-Up Barspin',
    sport: 'bmx',
    cat: 'flat',
    diff: 2,
    pre: ['bmx-x-up'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Lift just the front wheel, let go of the bars and spin them a full turn, then catch them straight before the wheel touches down.',
    tips: 'Throw with one hand and catch with the other, in the same spot every time. Practise the throw standing over the bike before you roll.',
    fact: 'This is the stepping stone to spinning bars in a bunny hop. Get the catch automatic here and the hop version is mostly timing.',
    mistakes: [
      {
        what: 'Throwing before the front wheel is up.',
        fix: 'Pull into a short manual first, then throw; the wheel needs to be clear of the ground.',
      },
      {
        what: 'Letting the bike wobble under you.',
        fix: 'Pinch the seat with your knees as you let go so the frame stays still.',
      },
      {
        what: 'Gripping tight through the throw.',
        fix: 'Use a light grip to throw and catch so the bars can spin freely.',
      },
      {
        what: 'Catching with the throwing hand.',
        fix: 'Throw with one hand and catch with the other, palm open over the top tube.',
      },
    ],
    hard: 'The x-up taught your hands to leave their normal place; this adds letting go altogether. The back wheel stays down, so the balance is a short manual, not a hop.',
    isLive: true,
  },
  {
    id: 'bmx-180',
    name: 'Hop 180',
    sport: 'bmx',
    cat: 'street',
    diff: 2,
    pre: ['bmx-bunny-hop', 'bmx-fakie'],
    about:
      'Bunny hop and turn half way round, landing rolling backwards. Wind your shoulders one way first, then unwind them.',
    tips: 'Look over your shoulder at where you want to land and commit to the whole turn. A half-hearted 90 is how pedals catch.',
    fact: 'The 180 is the start of every spin. Once it is clean, 360s and 180 barspins are the next two steps.',
    mistakes: [
      {
        what: 'Not turning your head.',
        fix: 'Look over your shoulder before you pop and keep looking until you land; the bike follows your head.',
      },
      {
        what: 'Hopping straight with no carve.',
        fix: 'Turn slightly into the spin as you approach so the carve starts the rotation for you.',
      },
      {
        what: 'Leaving your legs long in the air.',
        fix: 'Pull your knees up towards your chest to give the spin time and clearance.',
      },
      {
        what: 'Fighting the fakie after landing.',
        fix: 'Let the bike roll backwards and pedal back with it, then carve out slowly.',
      },
    ],
    hard: 'It needs the hop and the fakie, because you land rolling backwards. The new part is the head turn: the body only spins as far as the eyes go, so a half look stops short.',
    isLive: true,
  },
  {
    id: 'bmx-footjam',
    name: 'Footjam',
    sport: 'bmx',
    cat: 'flat',
    diff: 2,
    pre: [],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Jam your front foot between the fork and the front tyre so the bike stops dead and the back wheel lifts up behind you.',
    tips: 'Roll slowly and put the foot in gently the first few times. Wear proper shoes — this one chews them.',
    fact: 'Footjams are the base of nosepicks and endo tricks, and you can learn one on any flat bit of ground.',
    mistakes: [
      {
        what: 'Jamming the foot in too fast.',
        fix: 'Roll at walking pace; the foot is a brake, and speed sends you over the bars.',
      },
      {
        what: 'Jamming in the wrong spot.',
        fix: 'Press the ball of your shoe into the tyre right behind the fork, toes in and heel out.',
      },
      {
        what: 'Keeping your weight back on the pedals.',
        fix: 'Push the bars forward and move your hips over the front so the back wheel lifts.',
      },
      {
        what: 'Twisting your knee as you bail.',
        fix: 'If it goes wrong, step off on the jam side and let the bike fall away.',
      },
    ],
    hard: 'Nothing comes before it, and the foot does the stopping, so there is less to balance than in an endo. The tricky part is the shoe: the tyre grabs and chews it.',
    isLive: true,
  },
  {
    id: 'bmx-double-peg',
    name: 'Double Peg Grind',
    sport: 'bmx',
    cat: 'street',
    diff: 3,
    pre: ['bmx-bunny-hop'],
    // One of BMX's four free Spicy tricks: every BMX street trick descends from
    // this one, so leaving it paid puts no street content at all in the free
    // tier — a free rider would see the branch and never be able to enter it.
    // Feeble, smith, toothpick and icepick all stay paid. `bmx-one-hander`,
    // `bmx-wallride` and `bmx-half-cab` are the other three.
    free: true,
    about:
      'Hop up so both pegs on one side land on a ledge or rail, then slide along it. The grind every other grind is built from.',
    tips: 'Learn it on a low, waxed ledge long before you go near a rail. Land both pegs at once, stay centred, and ride straight off the end.',
    fact: 'Also called a 50-50. Feebles, smiths, icepicks and toothpicks are all this trick with one peg taken away.',
    mistakes: [
      {
        what: 'Trying it with no pegs fitted.',
        fix: 'You need a front and a back peg on your grind side before this one works.',
      },
      {
        what: 'One peg landing before the other.',
        fix: 'Aim both pegs at the edge together, or front peg first with the back following straight away.',
      },
      {
        what: 'Leaning away from the ledge.',
        fix: 'Bring your body up over the bike and keep it centred above the pegs.',
      },
      {
        what: 'Steering with big bar movements.',
        fix: 'Adjust your balance with small bar turns; a big one tips you off the side.',
      },
    ],
    hard: 'The hop is the entry; the new part is holding your weight over two pegs on a narrow edge while you slide. Too far in and they dig, too far out and they drop off.',
    isLive: true,
  },
  {
    id: 'bmx-feeble',
    name: 'Feeble Grind',
    sport: 'bmx',
    cat: 'street',
    diff: 3,
    pre: ['bmx-double-peg'],
    about:
      'Your back peg grinds the edge while the front wheel rolls along the top of the ledge, so the bike sits at an angle across it.',
    tips: 'Come in at a slight angle and get the back peg down first. Low ledges only until the balance stops being a surprise.',
    fact: 'Feeble is the grind most riders keep for life, and feeble to manual is the first grind combo worth chasing.',
    mistakes: [
      {
        what: 'Front wheel drifting onto the ledge.',
        fix: 'Keep the front tyre right by the edge; let it wander in and the back peg slips off.',
      },
      {
        what: 'Coming in parallel to the ledge.',
        fix: 'Approach at a slight angle so the front wheel goes up and the back peg meets the edge.',
      },
      {
        what: 'Slamming the peg down.',
        fix: 'Hop just high enough to place the bike and land the peg softly.',
      },
      {
        what: 'Weight sitting back on the peg.',
        fix: 'Ease slightly forward onto the front wheel and compress a little as you land.',
      },
    ],
    hard: 'After the double peg, this takes one peg off the edge and puts a wheel on top, so the bike sits at an angle. Balance now lives between a rolling tyre and a sliding peg.',
    isLive: true,
  },
  {
    id: 'bmx-air',
    name: 'Air Out of a Quarter',
    sport: 'bmx',
    cat: 'park',
    diff: 2,
    pre: ['bmx-drop-in', 'bmx-pump'],
    about:
      'Ride up a quarter pipe, leave the coping with both wheels and come back down into the transition. Land on the deck instead and it is a flyout.',
    tips: 'Build up an inch at a time. Pull up as you leave the lip and point the front wheel back down the ramp before you land.',
    fact: 'This is the gate to park riding. Spins, whips, no-handers and flips all begin with getting out of the ramp under control.',
    mistakes: [
      {
        what: 'Pulling up too early.',
        fix: 'Let the front wheel and then the back wheel roll off the coping before you lift.',
      },
      {
        what: 'Landing with the front wheel high.',
        fix: 'Push the bars down as you turn so the front wheel meets the transition first.',
      },
      {
        what: 'Picking a mellow ramp to learn on.',
        fix: 'A steeper quarter gives you height for less speed and lands you further up the curve.',
      },
      {
        what: 'Clearing the coping on the first go.',
        fix: 'Start with small hops below the coping and raise them an inch at a time.',
      },
    ],
    hard: 'Pump gives you the speed and drop in gives you the ramp. Airing adds a moment when neither wheel is on anything, and a hung-up front wheel stops the bike dead.',
    isLive: true,
  },
  {
    id: 'bmx-icepick',
    name: 'Icepick',
    sport: 'bmx',
    cat: 'park',
    diff: 3,
    pre: ['bmx-double-peg'],
    about:
      'Grind or stall on the back peg alone, with the front end lifted up above the coping or the ledge.',
    tips: 'Approach almost parallel and let the peg glide on — do not slam it down. Your weight has to sit right over the edge; lean in or out and it slips.',
    fact: 'Steeper ramps make icepicks easier, not harder. It is the natural next step after double pegs on a quarter.',
    mistakes: [
      {
        what: 'Slamming the peg down onto the coping.',
        fix: 'Let the peg glide on as the carve brings you level with the coping.',
      },
      {
        what: 'Leaning away from the ramp.',
        fix: 'Keep your weight over the transition while the bike leans into the coping.',
      },
      {
        what: 'Coming in with double peg speed.',
        fix: 'Hit the quarter a bit faster than for a double peg so there is time to lift the front.',
      },
      {
        what: 'Dropping the front end while you balance.',
        fix: 'Keep the front wheel up the whole time, or the front peg catches and you land in a double peg.',
      },
    ],
    hard: 'A double peg has two pegs holding you. Here one peg carries all your weight and the bike is shorter under you, so the balance point moves and you have to find it again.',
    isLive: true,
  },
  {
    id: 'bmx-nose-manual',
    name: 'Nose Manual',
    sport: 'bmx',
    cat: 'flat',
    diff: 3,
    pre: ['bmx-manual', 'bmx-nollie'],
    about:
      'A manual on the front wheel. The back end is up and you roll forward on the front tyre alone.',
    tips: 'Twitchier than a manual and far less forgiving. Ease your weight forward, never lunge, and bail off the back if it tips.',
    fact: 'Nose manuals open up nose manual 180s and rolling out of front-peg grinds.',
    mistakes: [
      {
        what: 'Not leaning far enough forward.',
        fix: 'The balance point is further over the bars than feels sensible; commit your chest forward.',
      },
      {
        what: 'Making big corrections.',
        fix: 'Keep your arms straight and adjust with your knees and core in tiny moves.',
      },
      {
        what: 'Looking far down the road.',
        fix: 'Keep your eyes just in front of the front tyre so you feel the balance sooner.',
      },
      {
        what: 'Bending your arms to save it.',
        fix: 'If it tips, step off over the front rather than hanging on with bent arms.',
      },
    ],
    hard: 'The manual taught you a balance point; this one is much twitchier and sits surprisingly far forward. The nollie taught the weight shift, but here you have to hold it.',
    isLive: true,
  },
  {
    id: 'bmx-hop-barspin',
    name: 'Bunny Hop Barspin',
    sport: 'bmx',
    cat: 'flat',
    diff: 3,
    pre: ['bmx-bunny-hop', 'bmx-pull-up-barspin'],
    about:
      'Bunny hop, throw the bars a full spin underneath you and catch them straight before you land.',
    tips: 'Get your legs straight, back and out of the way so the bars can pass. Hinge at the hips and keep your chest over the bike.',
    fact: 'A hop barspin turns up on flat, on banks, over gaps and out of grinds. It is one of the most useful tricks in BMX.',
    mistakes: [
      {
        what: 'Throwing before the bike is level.',
        fix: 'Push the bars forward to level out at the top of the hop, then throw.',
      },
      {
        what: 'Forcing a huge hop.',
        fix: 'A normal, steady hop is enough; a forced one unsettles your balance before you let go.',
      },
      {
        what: 'Knees loose during the spin.',
        fix: 'Pinch the seat with your knees so the bike stays with you while the bars turn.',
      },
      {
        what: 'Catching late, near the ground.',
        fix: 'Hold your catching hand open over the top tube and grab early, before you start dropping.',
      },
    ],
    hard: 'The pull-up barspin let the back wheel stay on the ground. Now both wheels are up, so the throw, the catch and the landing all happen in the air time of one hop.',
    isLive: true,
  },
  {
    id: 'bmx-tabletop',
    name: 'Tabletop',
    sport: 'bmx',
    cat: 'park',
    diff: 4,
    pre: ['bmx-air'],
    about:
      'In the air you turn the bars and lay the bike over to one side so it goes flat like a table top, then bring it back level to land.',
    tips: 'Learn it off a small jump box where the landing is forgiving. Turn the bars and push the bike over with your legs staying together.',
    fact: 'Tabletops are the classic style trick over a jump, and they teach you to move the bike around underneath you in the air.',
    mistakes: [
      {
        what: 'Laying it flat on the first go.',
        fix: 'Push the bars a little further each attempt; a quarter turn that comes back is progress.',
      },
      {
        what: 'Wrong pedal down for the side you table.',
        fix: 'Drop the pedal on the side you are laying the bike towards before you leave the lip.',
      },
      {
        what: 'Hitting the jump too fast.',
        fix: 'Use just enough speed for a couple of feet of air; more speed leaves no time to move the bike.',
      },
      {
        what: 'Forgetting to bring it back.',
        fix: 'Start straightening before the top of the jump so the bike is level long before the landing.',
      },
    ],
    hard: 'An air keeps the bike under you. A tabletop turns the bars and lays the whole bike sideways, then needs it flat again before the wheels touch, all inside one jump.',
    isLive: true,
  },
  {
    id: 'bmx-tuck-no-hander',
    name: 'Tuck No-Hander',
    sport: 'bmx',
    cat: 'park',
    diff: 3,
    pre: ['bmx-air'],
    about:
      'At the top of a jump you pull the bars into your lap, take both hands off, then grab back on before you come down.',
    tips: 'Start by just loosening your grip, then one finger off, then one hand. Only let go fully once you are getting real height.',
    fact: 'No-handers are where most riders start putting their own look into a jump, and they lead straight into turndowns.',
    mistakes: [
      {
        what: 'Pulling the bars in after the top.',
        fix: 'Pull the bars into your lap on the way up, while you still have height to come.',
      },
      {
        what: 'Sitting back when the hands come off.',
        fix: 'Lean over the front so the bars stay locked against you; that is what keeps the bike still.',
      },
      {
        what: 'Learning it on a quarter pipe first.',
        fix: 'Do the first ones out of a flyout, where you land on flat deck instead of transition.',
      },
      {
        what: 'Going for the biggest air possible.',
        fix: 'You need enough height for a comfortable air and no more; extra height just adds fear.',
      },
    ],
    hard: 'An air just needs you to hold on. Here the bars have to be pinned by your body before you let go, and the timing of that pull is what takes the sessions.',
    isLive: true,
  },
  {
    id: 'bmx-tyre-tap',
    name: 'Tyre Tap',
    sport: 'bmx',
    cat: 'park',
    diff: 2,
    pre: ['bmx-air'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Pop out of a quarter pipe, kick the back wheel round onto the deck and tap it there, then come straight back in.',
    tips: 'Come in almost perpendicular to the ramp and use your back brake as the tyre lands. Learn it with brakes fitted — brakeless is a different trick entirely.',
    fact: 'It is the basis of a lot of deck tricks. Once you can tap, a whole family of lip tricks opens up.',
    mistakes: [
      {
        what: 'Front wheel dropping on the way up.',
        fix: 'Keep the front end up and level from the lip until the back tyre lands.',
      },
      {
        what: 'Braking after the tyre lands.',
        fix: 'Squeeze the back brake while you are still in the air so the wheel is locked as it touches.',
      },
      {
        what: 'Turning the whole 180.',
        fix: 'You only need to kick the back wheel round about ninety degrees to reach the deck.',
      },
      {
        what: 'Standing tall on the tap.',
        fix: 'Compress down over the back wheel as it lands so you can hop straight back in.',
      },
    ],
    hard: 'It comes just above the air because the coping is now something you land on rather than clear. The brake timing is the new skill, and it takes a few taps to feel.',
    isLive: true,
  },
  {
    id: 'bmx-disaster',
    name: 'Disaster',
    sport: 'bmx',
    cat: 'park',
    diff: 3,
    pre: ['bmx-air'],
    about:
      'Ride up the quarter, turn half way round at the top and land with the back wheel on the deck and the front wheel back down in the transition.',
    tips: 'Mellow, small ramps first. Come in almost straight on with steady speed and let the bike carve round as it drifts to the deck.',
    fact: 'Disasters are one of the friendliest ways to learn to turn at the top of a ramp, which is what airs and 180s out both need.',
    mistakes: [
      {
        what: 'Carving hard on the way up.',
        fix: 'Go up almost straight so the turn happens at the top, not across the ramp.',
      },
      {
        what: 'Pulling out into an air.',
        fix: 'Use a little less speed than for an air and let the bike drift onto the deck.',
      },
      {
        what: 'Weight over the front when you hang up.',
        fix: 'Keep your weight on the back wheel so the front end can hang over the coping without diving.',
      },
      {
        what: 'Stiffening up in the stall.',
        fix: 'Stay loose with bent knees; the position is unstable and a stiff body cannot adjust.',
      },
    ],
    hard: 'An air keeps you clear of the coping. A disaster lands you across it, half on the deck and half in the transition, and you have to balance there before dropping back in.',
    isLive: true,
  },
  {
    id: 'bmx-wallride',
    name: 'Wallride',
    sport: 'bmx',
    cat: 'street',
    diff: 3,
    pre: ['bmx-bunny-hop'],
    // Free by the free-tier shape at the top of this file.
    free: true,
    about:
      'Ride at a wall, hop onto it and roll along it sideways with both wheels on the wall, then come back down to the ground.',
    tips: 'Get the bike and your body leaned over, as close to square against the wall as you can. Carry speed, because slow wallrides just slide out.',
    fact: 'All you need is a bike and a wall. It is the street trick with the least equipment and the biggest payoff.',
    mistakes: [
      {
        what: 'Staying upright against the wall.',
        fix: 'Lean your body and the bike over together, as close to flat against the wall as you dare.',
      },
      {
        what: 'Leaning only the bike.',
        fix: 'Your body weight is what has to match the wall; the bike follows it, not the other way round.',
      },
      {
        what: 'Hopping huge at the wall.',
        fix: 'Lift the front, give a small pop off the back and ride up the wall to your height.',
      },
      {
        what: 'Starting on a vertical wall.',
        fix: 'Learn on a slanted wall or a bank to a wall first; both need far less lean.',
      },
    ],
    hard: 'The hop gets you on; the hard part is trusting a lean that feels wrong, because upright wheels slide down the wall. A bank to the wall makes the lean smaller to start.',
    isLive: true,
  },
  {
    id: 'bmx-360',
    name: 'Bunny Hop 360',
    sport: 'bmx',
    cat: 'flat',
    diff: 4,
    pre: ['bmx-180'],
    // Free by the free-tier shape at the top of this file.
    free: true,
    about:
      'A full spin, you and the bike together, out of a bunny hop. It is a 180 with a much stronger carve and a committed head turn.',
    tips: 'Carve into it harder than a 180 but keep it controlled, or the bike jackknifes. Smooth flat ground first, then take it to drops and banks.',
    fact: '360s are the base of 540s, truckdrivers and every spin combination that comes after them.',
    mistakes: [
      {
        what: 'Whipping with your arms then looking back.',
        fix: 'Keep your head turned over your shoulder all the way round until you spot the landing.',
      },
      {
        what: 'Not tucking the bike underneath you.',
        fix: 'Pull the bars in and your knees up together; a compact body spins faster.',
      },
      {
        what: 'Fixing an under-rotation on landing.',
        fix: 'Roll away in whatever direction you landed rather than wrenching the bike straight.',
      },
      {
        what: 'Chasing the full spin straight away.',
        fix: 'Land 270s first and roll out; the last quarter comes as the carve and tuck get stronger.',
      },
    ],
    hard: 'A 180 lands with the eyes already on the ground; a 360 needs the head to lead a full turn while the bike is tucked under you. Twice the rotation from the same hop.',
    isLive: true,
  },
  {
    id: 'bmx-smith',
    name: 'Smith Grind',
    sport: 'bmx',
    cat: 'street',
    diff: 3,
    pre: ['bmx-feeble'],
    about:
      'The feeble’s mirror: the front peg grinds the edge while the back wheel rolls along the top of the ledge.',
    tips: 'Nose in slightly and keep steady pressure on that front peg. It punishes leaning back, so stay over the front.',
    fact: 'Feeble and smith together mean you can grind a ledge from either approach, which doubles what any spot is worth.',
    mistakes: [
      {
        what: 'Landing in a double peg by accident.',
        fix: 'Kick the back end up and over the ledge as you hop, so the back wheel lands on top.',
      },
      {
        what: 'Coming in at a feeble angle.',
        fix: 'Approach parallel to the ledge; the smith does not want the angle a feeble does.',
      },
      {
        what: 'Bars turning as the peg lands.',
        fix: 'Keep the bars level and aim the front peg straight down onto the edge.',
      },
      {
        what: 'Popping out front wheel first.',
        fix: 'Exit with both wheels together, or let the back wheel follow the front off the end.',
      },
    ],
    hard: 'It is the feeble mirrored, and the harder half. Getting the back wheel up onto the ledge takes a bigger hop, and getting off is trickier because the back end is still up there.',
    isLive: true,
  },
  {
    id: 'bmx-toothpick',
    name: 'Toothpick Grind',
    sport: 'bmx',
    cat: 'street',
    diff: 4,
    pre: ['bmx-double-peg', 'bmx-nollie'],
    about: 'Grinding on the front peg only, with the back wheel held up in the air behind you.',
    tips: 'You have to get the back end up and keep it up for the whole grind. Short ones first — long toothpicks come much later.',
    fact: 'Toothpick and its variations, like the hangover, are where front-peg riding starts.',
    mistakes: [
      {
        what: 'Trying it without a front peg fitted.',
        fix: 'It needs a peg on the front axle on your grind side; nothing else touches the ledge.',
      },
      {
        what: 'Back end dropping onto the ledge.',
        fix: 'Hold the back wheel up the whole way, like a short nose manual on the peg.',
      },
      {
        what: 'No pressure on the front peg.',
        fix: 'Press down gently through the peg once it lands, or it skips off.',
      },
      {
        what: 'Exiting with a bunny hop.',
        fix: 'Turn the bars away and pop a small nollie off the end; you are leaving front wheel first.',
      },
    ],
    hard: 'The double peg gave you two points of contact; this is one, at the front, with the back wheel held high. The nollie taught the weight shift; here it has to hold while you slide.',
    isLive: true,
  },
  {
    id: 'bmx-180-barspin',
    name: '180 Barspin',
    sport: 'bmx',
    cat: 'street',
    diff: 4,
    pre: ['bmx-hop-barspin', 'bmx-180'],
    about:
      'Spin the bars and turn half way round in the same hop, landing fakie with the bars caught straight.',
    tips: 'Focus on throwing and catching the bars early — the 180 comes round on its own once the spin has started. Begin at about walking pace.',
    fact: 'If you already catch bars nice and early this one comes quite easily. It is also half of a truckdriver.',
    mistakes: [
      {
        what: 'Thinking about the 180.',
        fix: 'Carve in and forget the spin; once started it comes round while you deal with the bars.',
      },
      {
        what: 'Throwing with the wrong hand.',
        fix: 'Right foot forward, throw with the right hand; left foot forward, throw left, so the spin helps the bars.',
      },
      {
        what: 'Throwing while the bike is still tilted.',
        fix: 'Push the bars forward at about ninety degrees to level out, then throw as you would on flat.',
      },
      {
        what: 'Catching after the wheels touch.',
        fix: 'Get both hands back on before you land; you need them for the snap out of fakie.',
      },
    ],
    hard: 'A hop barspin has one thing to catch; this adds a rotation underneath it, so the bike is level for less time and you land fakie with both hands only just back on.',
    isLive: true,
  },
  {
    id: 'bmx-turndown',
    name: 'Turndown',
    sport: 'bmx',
    cat: 'air',
    diff: 3,
    pre: ['bmx-x-up', 'bmx-air'],
    about:
      'In the air you bring the bike up vertical, straighten your body out and turn the bars right down towards your back foot.',
    tips: 'X-ups and lookdowns first — they teach the bar turn without the body position. Full turndowns take a long time, so be patient with them.',
    fact: 'One of the oldest style tricks in BMX and still one of the best-looking. It pairs with a tuck no-hander for the classic combination.',
    mistakes: [
      {
        what: 'Turning the bars into your front foot.',
        fix: 'Turn towards whichever foot is on the back pedal; the other way is much harder to bend into.',
      },
      {
        what: 'Sitting upright while you turn.',
        fix: 'Lean forward over the front; the further forward you get, the further the bars go down.',
      },
      {
        what: 'Starting the turn late.',
        fix: 'Begin as soon as you leave the lip so there is time to hold it and undo it.',
      },
      {
        what: 'Panicking when the back end stays out.',
        fix: 'Relax and let your body untwist; it comes back in time for the landing on its own.',
      },
    ],
    hard: 'An X-up turns the bars while your body stays put. A turndown turns the bike and folds your body over it at the same time, so two things are twisted and both must undo.',
    isLive: true,
  },
  {
    id: 'bmx-feeble-manual',
    name: 'Feeble to Manual',
    sport: 'bmx',
    cat: 'hybrid',
    diff: 4,
    pre: ['bmx-feeble', 'bmx-manual'],
    about:
      'Grind a feeble along the ledge and roll straight out of the end of it into a manual, instead of putting the front wheel down.',
    tips: 'Be confident with both halves on their own first. A short feeble makes the switch into the manual much easier.',
    fact: 'Learn it on a flat ledge, then take it to a hubba: feeble the flat part, manual down the slope.',
    mistakes: [
      {
        what: 'Standing up as the grind starts.',
        fix: 'Stay compressed through the feeble so you have something to spring up from at the end.',
      },
      {
        what: 'Grinding a long way before the manual.',
        fix: 'Keep the feeble short; the switch is much simpler after a metre than after five.',
      },
      {
        what: 'Popping out too late.',
        fix: 'Burst up out of the crouch just before the peg reaches the end of the ledge.',
      },
      {
        what: 'Coming in at feeble speed.',
        fix: 'Carry a little more speed than a plain feeble so the manual has something to roll on.',
      },
    ],
    hard: 'Both halves already exist in your riding. What is new is the moment between them: the front wheel has to come off the ledge and find its balance point in the same movement.',
    isLive: true,
  },
  {
    id: 'bmx-flyout-tailwhip',
    name: 'Flyout Tailwhip',
    sport: 'bmx',
    cat: 'park',
    diff: 4,
    pre: ['bmx-air'],
    // Free by the free-tier shape at the top of this file.
    free: true,
    about:
      'Air out of a quarter onto the deck and kick the frame a full lap around the bars and forks, catching it back under your feet.',
    tips: 'Any ramp with a big enough deck works, and you get to take it at your own pace. Go easy on the reps — your wrists take a beating on flyout landings.',
    fact: 'Flyouts are how nearly everyone learns whips. The bunny hop version comes later, once the kick and the catch are automatic.',
    mistakes: [
      {
        what: 'Carving into the flyout.',
        fix: 'Hit the ramp dead straight; there is nothing to gain from an angle on this one.',
      },
      {
        what: 'Kicking the bike out and away.',
        fix: 'Kick it down and round so the frame stays under you instead of flying ahead of you.',
      },
      {
        what: 'Sitting back over the rear.',
        fix: 'Get your weight over the front end the moment the whip starts; that is where the control is.',
      },
      {
        what: 'Catching with the frame still tilted.',
        fix: 'Push the bars forward as the whip comes round so the bike is level when you catch it.',
      },
    ],
    hard: 'Every trick before it keeps your feet on the pedals. Here both feet leave the bike while the frame spins a full lap, and you have to find the pedals again before you land.',
    isLive: true,
  },
  {
    id: 'bmx-hop-tailwhip',
    name: 'Bunny Hop Tailwhip',
    sport: 'bmx',
    cat: 'park',
    diff: 4,
    pre: ['bmx-flyout-tailwhip', 'bmx-bunny-hop'],
    about:
      'The whole tailwhip out of a bunny hop on flat ground. Kick the frame round with your back foot and land on it as it comes back.',
    tips: 'Keep your weight over the front end while you kick. A mellow bank first makes this a lot easier than dead flat.',
    fact: 'Hop whips take a while to master. This one is measured in months, not sessions.',
    mistakes: [
      {
        what: 'Hopping small to stay safe.',
        fix: 'Hop as big as you can; the height is the time you need for the frame to go round.',
      },
      {
        what: 'Letting the bike drift away.',
        fix: 'Pull the bars in towards your legs as the frame spins so it stays underneath you.',
      },
      {
        what: 'Kicking after the hop has peaked.',
        fix: 'Start the kick on the way up so the frame is halfway round at the top.',
      },
      {
        what: 'Looking at the landing not the pedals.',
        fix: 'Watch the pedals come round and get your feet on them; the landing looks after itself.',
      },
    ],
    hard: 'The flyout gave you a ramp’s worth of height for free. On flat, your bunny hop is the only height there is, so the kick, catch and hop all have to be bigger and quicker.',
    isLive: true,
  },
  {
    id: 'bmx-truckdriver',
    name: 'Truckdriver',
    sport: 'bmx',
    cat: 'hybrid',
    diff: 5,
    pre: ['bmx-180-barspin', 'bmx-360'],
    about:
      'A 360 and a barspin in the same air. The bike spins a full lap under you while the bars spin a full lap too.',
    tips: 'Learn it out of a flyout or a bank first, then a flat bank, then a small drop. The extra height buys you the time to get both round.',
    fact: 'You need a good 180 barspin and a good 360 hop before you start thinking about this one.',
    mistakes: [
      {
        what: 'Throwing the bars at take-off.',
        fix: 'Spin the bars when the bike is halfway round the 360, not as you leave the ground.',
      },
      {
        what: 'Throwing the bars into the spin.',
        fix: 'Throw them away from the direction you are spinning; they come round quicker that way.',
      },
      {
        what: 'Half hopping into the 360.',
        fix: 'Really commit to the hop and the spin; the bars only fit inside a full rotation.',
      },
      {
        what: 'Starting on flat ground.',
        fix: 'Learn it out of a flyout or bank, then a flat bank, then a small drop for extra time.',
      },
    ],
    hard: 'A 180 barspin gives the bars half a spin to fit into. A truckdriver asks for a full spin of the bars inside a full spin of the bike, caught in the last quarter.',
    isLive: true,
  },
  {
    id: 'bmx-540',
    name: '540',
    sport: 'bmx',
    cat: 'air',
    diff: 5,
    pre: ['bmx-360', 'bmx-air'],
    supervise: true,
    about: 'A spin and a half out of a quarter pipe, landing back in the transition.',
    tips: 'Get 360s on ramps dialled first, then take it to a big mellow quarter. Come in faster than you would for a 360, but not so fast you lose control.',
    fact: 'A bigger transition actually makes the spin easier, which is why most riders land their first 540 on the biggest ramp in the park.',
    mistakes: [
      {
        what: 'Trying it on a small quarter.',
        fix: 'Take it to a big mellow transition; the extra curve gives you spin and time.',
      },
      {
        what: 'Going too fast.',
        fix: 'Use a little more speed than a 360 and no more, or you spiral above the coping.',
      },
      {
        what: 'Worrying about clearing the coping.',
        fix: 'Do not aim to clear the coping at first; get the rotation first and the height later.',
      },
      {
        what: 'First tries without foam or a spotter.',
        fix: 'Spinning above coping is a long way to fall, so use foam or have someone watching first.',
      },
    ],
    hard: 'A 360 lands you facing the way you took off. Another half turn means landing back in the transition facing the other way, with no chance to spot the ramp until late.',
    isLive: true,
  },
  {
    id: 'bmx-backflip',
    name: 'Backflip',
    sport: 'bmx',
    cat: 'air',
    diff: 5,
    pre: ['bmx-air'],
    supervise: true,
    about:
      'A full backward rotation with the bike, off a foam pit, a resi ramp or a jump box. Total commitment — hesitating halfway is what hurts.',
    tips: 'Foam pit first and nowhere else. Land ten to fifteen to your wheels in the foam before you go to resi, then ten to fifteen on resi before you go to wood.',
    fact: 'That foam to resi to wood ladder is how coached riders learn flips. Skipping a rung is the most common way people get badly hurt.',
    mistakes: [
      {
        what: 'Bailing halfway round.',
        fix: 'Once you have thrown it, stay with the bike; the middle of the rotation is where letting go hurts.',
      },
      {
        what: 'Looking at the sky.',
        fix: 'Lean your head back and look for the landing while you are upside down.',
      },
      {
        what: 'Pulling the bars straight up.',
        fix: 'Pull them into your lower stomach as you leave the lip; that is what starts the spin.',
      },
      {
        what: 'Going to resi before the foam is boring.',
        fix: 'Land ten to fifteen to your wheels in foam first; that is where this trick is learned.',
      },
    ],
    hard: 'Every trick before it keeps you upright. This is the first time the ground goes over your head, so the bike, the timing and the landing are all found without seeing them at first.',
    isLive: true,
  },
  {
    id: 'bmx-flair',
    name: 'Flair',
    sport: 'bmx',
    cat: 'air',
    diff: 5,
    pre: ['bmx-backflip', 'bmx-180'],
    supervise: true,
    about:
      'A backflip with a half turn built into it, so you land back in the quarter pipe facing the other way.',
    tips: 'Only once backflips are boring. A bigger quarter, around six foot, gives you both the pop and the transition to spin it.',
    fact: 'Riders who already flip onto foam, over a box or out of a flyout tend to find flairs come quickly. It is the standard run-ender at a park contest.',
    mistakes: [
      {
        what: 'Learning it on a small quarter.',
        fix: 'Find a quarter around six foot; a bigger transition gives you the time to get round.',
      },
      {
        what: 'Going for full height at first.',
        fix: 'Use the speed you would need to pop a foot or two above the deck, no more.',
      },
      {
        what: 'Hesitating once upside down.',
        fix: 'Decide before you drop in; the trick only works if you keep turning through the top.',
      },
      {
        what: 'Trying it without foam or a spotter.',
        fix: 'It is a flip into a transition, so start into foam or resi with someone watching the first tries.',
      },
    ],
    hard: 'The backflip is learned over a jump, landing forwards. A flair puts the same flip on a quarter and adds a half turn, so you land back in the transition you left.',
    isLive: true,
  },

  /* ---------------------------------------------------- bmx, T27 additions --
   * Same research, same caveats: see the T27 note above the scooter block.
   *
   * The doubles rule is scoped, not reversed. The T21 note above says double
   * flips were excluded on safety grounds, which read as covering doubles of
   * anything; the owner ruled on 2026-09-04, in chat, that it covers **flips**
   * only and does not extend to tailwhips, so `bmx-double-tailwhip` and
   * `bmx-triple-tailwhip` ship. Nothing else moved: handrails, double flips
   * and brakeless variants all stay excluded on the original grounds.
   */

  {
    id: 'bmx-endo',
    name: 'Endo',
    sport: 'bmx',
    cat: 'flat',
    diff: 2,
    pre: [],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Lift the back wheel and balance on the front one, usually by loading the front brake as you shift your weight forward. The manual, upside down.',
    tips: 'Cover the front brake and squeeze it gently as your weight comes forward. Start with the wheel a hand-width off the ground.',
    fact: 'It is the front-end counterpart to the manual, and it is what nosepicks and front-peg tricks are built on.',
    mistakes: [
      {
        what: 'Grabbing the front brake.',
        fix: 'Squeeze it smoothly as your weight moves forward; a grab sends you into the stem.',
      },
      {
        what: 'Diving your whole body over the front.',
        fix: 'Stack your weight over the bars with heels down; you are loading the front, not throwing yourself at it.',
      },
      {
        what: 'Rolling in too fast.',
        fix: 'Do it almost stopped; the slower you go, the less the brake has to do.',
      },
      {
        what: 'Dropping the back wheel with a thud.',
        fix: 'Let the brake out and push your hips back so the wheel settles down softly.',
      },
    ],
    hard: 'Nothing comes before it and the front brake does the lifting, so it is a weight shift, not a pop. The risk is grabbing the brake: the bike stops and you do not.',
    isLive: true,
  },
  {
    id: 'bmx-rollback',
    name: 'Rollback',
    sport: 'bmx',
    cat: 'flat',
    diff: 2,
    pre: ['bmx-fakie'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'After rolling backwards, pivot a half turn on the back wheel to point forwards again, without either wheel leaving the ground.',
    tips: 'Get the weight over the back wheel and turn your shoulders. Keep it slow — speed makes the pivot into a skid.',
    fact: 'It is the way out of a fakie that does not need a hop, which is why coaches teach it before the 180.',
    mistakes: [
      {
        what: 'Turning the bars hard and fast.',
        fix: 'Use small bar movements while rolling backwards; a big turn becomes a skid.',
      },
      {
        what: 'Head and shoulders staying square.',
        fix: 'Turn your head first, then shoulders, then hips; the bike swings round behind them.',
      },
      {
        what: 'Pedalling backwards at the wrong speed.',
        fix: 'Backpedal to match the wheel so the cranks do not kick your feet mid-turn.',
      },
      {
        what: 'Not weighting the back wheel.',
        fix: 'Lean back and press your front foot as you come round, so the front end pivots and stops rolling backwards.',
      },
    ],
    hard: 'Fakie gets you rolling backwards; this is the turn out of it with both wheels down. The pivot has to be slow and led by the head, and speed turns it into a skid.',
    isLive: true,
  },
  {
    id: 'bmx-half-cab',
    name: 'Half Cab',
    sport: 'bmx',
    cat: 'flat',
    diff: 3,
    pre: ['bmx-fakie', 'bmx-bunny-hop'],
    // Free by the free-tier shape at the top of this file.
    free: true,
    about: 'Rolling backwards in fakie, hop a half turn so you land rolling forwards again.',
    tips: 'Look over the shoulder you are turning towards before you pop. Fakie has to feel normal before you add the hop.',
    fact: 'It is the same idea as a half cab on a skateboard or a scooter, and the name travelled across all three.',
    mistakes: [
      {
        what: 'Rolling fakie for ages first.',
        fix: 'You only need a bike length of fakie; pop as soon as your front foot comes forward.',
      },
      {
        what: 'Hopping without the crank push.',
        fix: 'Give the cranks a firm push forward as you pop; it lifts the front end and starts the turn.',
      },
      {
        what: 'Using arms instead of hips.',
        fix: 'Crouch, push with your legs and start the spin from your hips and core.',
      },
      {
        what: 'Spinning past the landing.',
        fix: 'Spot the landing at ninety degrees and stop the rotation as the bike levels.',
      },
    ],
    hard: 'It is a 180 from fakie, so you start facing the wrong way with the cranks wanting to run backwards. Timing the pop to the pedal stroke is what the flat 180 never asked for.',
    isLive: true,
  },
  {
    id: 'bmx-nollie-180',
    name: 'Nollie 180',
    sport: 'bmx',
    cat: 'flat',
    diff: 3,
    pre: ['bmx-nollie', 'bmx-180', 'bmx-fakie'],
    about:
      'Pop off the front wheel so the back end comes up first, turn a half rotation and roll out backwards.',
    tips: 'Nollies and 180s separately first. Get your weight properly forward — a half-hearted nollie leaves the back end behind.',
    fact: 'It puts the rotation in from the front of the bike instead of the back, which is why it feels nothing like a hop 180.',
    mistakes: [
      {
        what: 'Popping from the back like a hop.',
        fix: 'Compress over the back, then pop forward so the back wheel leaves first.',
      },
      {
        what: 'Head not leading.',
        fix: 'Turn your head the moment you pop; the back end swings round after it.',
      },
      {
        what: 'Landing with the back end still high.',
        fix: 'Steer the front round at ninety degrees and let the back end come down level.',
      },
      {
        what: 'Forgetting the fakie after.',
        fix: 'Roll back for a couple of cranks before you turn out; the landing is only half the trick.',
      },
    ],
    hard: 'You already have the nollie and the 180, but they pull in opposite directions: the weight is over the front while the spin has to come from the back. That mix is the step up.',
    isLive: true,
  },
  {
    id: 'bmx-hop-manual',
    name: 'Bunny Hop to Manual',
    sport: 'bmx',
    cat: 'flat',
    diff: 3,
    pre: ['bmx-bunny-hop', 'bmx-manual'],
    about:
      'Bunny hop up onto a ledge or a box and land straight into a manual, hold the balance point across it, then manual off the end.',
    tips: 'Both halves need to be solid on their own. Land already at the balance point rather than hopping up and then lifting.',
    fact: 'Landing in a manual rather than finding one afterwards is the part that takes the practice, and it is what makes it a trick.',
    mistakes: [
      {
        what: 'Hopping up, then lifting the front.',
        fix: 'Land already at the balance point with your weight back, then squat that bit extra.',
      },
      {
        what: 'Hopping too close to the ledge.',
        fix: 'Pop from about a bike and a half away, with an extra crank of speed to keep rolling.',
      },
      {
        what: 'Landing at manual speed on flat.',
        fix: 'Carry more speed than a flat manual; it is what keeps you balanced on the ledge.',
      },
      {
        what: 'Dropping the front off the end.',
        fix: 'Hold the front up and let the back wheel roll off first.',
      },
    ],
    hard: 'Both halves are separate skills; the join is the problem. There is no time to find the balance point after landing, so you have to hop into it already.',
    isLive: true,
  },
  {
    id: 'bmx-manual-180',
    name: 'Manual 180',
    sport: 'bmx',
    cat: 'flat',
    diff: 3,
    pre: ['bmx-manual', 'bmx-180'],
    about: 'Roll into a manual, then hop a half turn out of it and land rolling backwards.',
    tips: 'Hold the manual for a beat before you spin, and start the turn from the shoulders while the front wheel is still up.',
    fact: 'It is usually done off a kerb or into a wedge, where the drop gives you the moment you need to get round.',
    mistakes: [
      {
        what: 'Spinning the moment the wheel lifts.',
        fix: 'Hold the manual for a beat so you are balanced before you turn.',
      },
      {
        what: 'Pushing the front down to hop.',
        fix: 'Pop off the back wheel with your legs; the front is already up, so the 180 starts from there.',
      },
      {
        what: 'Head staying forward.',
        fix: 'Look over your shoulder as you pop, the same as a flat 180.',
      },
      {
        what: 'Landing before the fakie is ready.',
        fix: 'Get fakie comfortable first; you land rolling backwards from a manual, which feels faster.',
      },
    ],
    hard: 'You have the manual and the 180 already; the hard part is popping the turn from one wheel with nothing to push off at the front. The balance point has to hold until the pop.',
    isLive: true,
  },
  {
    id: 'bmx-full-cab',
    name: 'Full Cab',
    sport: 'bmx',
    cat: 'flat',
    diff: 4,
    pre: ['bmx-half-cab', 'bmx-fakie'],
    about: 'A full 360 spin out of fakie, landing rolling forwards.',
    tips: 'Half cabs have to be comfortable first. Wind the shoulders up hard before you pop, then let them unwind all at once.',
    fact: 'A full cab is to a half cab exactly what a 360 is to a 180 — the same trick with the spin doubled.',
    mistakes: [
      {
        what: 'Popping with half cab effort.',
        fix: 'Wind up harder and pull more; a full cab needs about double the momentum of a half cab.',
      },
      {
        what: 'Popping straight from the fakie.',
        fix: 'Let a little rollout happen first, about ninety degrees, then pop from that point.',
      },
      {
        what: 'Losing the head turn halfway.',
        fix: 'Keep looking over your shoulder until you spot the direction you started facing.',
      },
      {
        what: 'Landing and stopping.',
        fix: 'You land in fakie again, so roll back and carve out; do not try to stand it up.',
      },
    ],
    hard: 'It is to the half cab what the 360 is to the 180. Same pop from fakie, twice the turn, and you land rolling backwards again, so the fakie has to be second nature.',
    isLive: true,
  },
  {
    id: 'bmx-backwards-manual',
    name: 'Backwards Manual',
    sport: 'bmx',
    cat: 'flat',
    diff: 4,
    pre: ['bmx-manual', 'bmx-fakie'],
    about: 'Hold the manual balance point while the bike rolls backwards instead of forwards.',
    tips: 'Get manuals and fakie both dialled first. The balance point sits further back than you expect, and it moves faster.',
    fact: 'Everything you learned about correcting a manual works in reverse here, which is why riders find it so disorienting.',
    mistakes: [
      {
        what: 'Using the forward balance point.',
        fix: 'The point sits further back and moves quicker; expect to relearn it, not reuse it.',
      },
      {
        what: 'Cranks kicking your feet.',
        fix: 'Backpedal to match the wheel speed, or let a freecoaster do it, so the pedals stay still under you.',
      },
      {
        what: 'Staring at the front wheel.',
        fix: 'Look over your shoulder along the line you are rolling; your eyes keep the bike straight.',
      },
      {
        what: 'Big bar movements to save it.',
        fix: 'Steer with tiny bar wiggles and hip shifts; a big turn tips you off the line.',
      },
    ],
    hard: 'The manual gave you a balance point going forwards; rolling backwards it sits further back and moves faster, and the cranks want to turn under your feet. Two known skills, one unfamiliar feeling.',
    isLive: true,
  },
  {
    id: 'bmx-crankflip',
    name: 'Crankflip',
    sport: 'bmx',
    cat: 'flat',
    diff: 4,
    pre: ['bmx-bunny-hop'],
    about:
      'Kick the cranks backwards through a full rotation in mid-air with both feet off, then find the pedals again before you land.',
    tips: 'Learn it hopping on flat first, and wear shin pads. The pedals come back round faster than you expect.',
    fact: 'Pedals to the shins is the standard price of learning this one, which is why riders drill it on flat before a ramp.',
    mistakes: [
      {
        what: 'Pushing down on the back pedal.',
        fix: 'Point your front toes down and pull that pedal up and back; pushing moves your whole body.',
      },
      {
        what: 'Kicking before you have popped.',
        fix: 'Bend your knees, then pull the cranks and hop at the same moment, like an ollie.',
      },
      {
        what: 'Landing with legs together.',
        fix: 'If you are short, widen your legs and land on the ground rather than on the pedals.',
      },
      {
        what: 'Standing over the pedals to learn.',
        fix: 'Learn the flick sitting down first, where the seat holds you up and nothing can hit your shins.',
      },
    ],
    hard: 'Only the hop comes before it. The cranks have to spin a full turn in one hop’s air time, and your feet must find them again before the ground does.',
    isLive: true,
  },
  {
    id: 'bmx-hop-on-off',
    name: 'Hop On/Off',
    sport: 'bmx',
    cat: 'street',
    diff: 2,
    pre: ['bmx-bunny-hop'],
    about:
      'Bunny hop up onto a kerb, ledge or box, then roll off the far side and land compressed and rolling.',
    tips: 'Hop earlier than feels necessary and land with your knees and elbows soft. Start on a kerb, not a box.',
    fact: 'It is the first thing you do with a bunny hop once you have one, and every ledge trick starts by getting on the ledge.',
    mistakes: [
      {
        what: 'Hopping too late.',
        fix: 'Pop about a bike and a half before the kerb; a late hop catches the front wheel.',
      },
      {
        what: 'Hopping as high as you can.',
        fix: 'Just enough height to land on top and keep rolling; extra height wastes your balance.',
      },
      {
        what: 'Landing with straight legs.',
        fix: 'Land slightly compressed so your knees soak up the drop and the bike keeps moving.',
      },
      {
        what: 'Coasting in at flat-hop speed.',
        fix: 'Put in one extra crank so you still have speed once you are on top.',
      },
    ],
    hard: 'It is the bunny hop with a target and a timing. The hop itself is unchanged; what is new is judging the distance to the edge and landing soft enough to keep rolling.',
    isLive: true,
  },
  {
    id: 'bmx-double-peg-stall',
    name: 'Double Peg Stall',
    sport: 'bmx',
    cat: 'street',
    diff: 2,
    pre: ['bmx-bunny-hop'],
    about:
      'Ride slowly at a low ledge, hop both pegs onto the edge and balance there instead of sliding along it. Pegs have to be fitted for this one.',
    tips: 'Come in slow and square. Land both pegs together — one first is what tips you off the side.',
    fact: 'Stalling before you grind is how riders learn where the pegs actually sit, and it costs a lot less skin.',
    mistakes: [
      {
        what: 'Trying it without pegs fitted.',
        fix: 'You need a front and back peg on the same side; the tyres do not stall.',
      },
      {
        what: 'Coming in fast.',
        fix: 'Approach slow and square; you are stopping on the ledge, not sliding along it.',
      },
      {
        what: 'Bike tilted as the pegs land.',
        fix: 'Keep the bike level in the air so both pegs meet the edge at once.',
      },
      {
        what: 'Body hanging out over the ground.',
        fix: 'Keep your body directly over the edge; lean out and the pegs unhook.',
      },
    ],
    hard: 'The hop is the whole entry, and stopping asks less of you than sliding. What is new is trusting two pegs to hold you on an edge, so it sits just above the hop.',
    isLive: true,
  },
  {
    id: 'bmx-feeble-stall',
    name: 'Feeble Stall',
    sport: 'bmx',
    cat: 'street',
    diff: 2,
    pre: ['bmx-bunny-hop'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Hop onto a ledge with the back peg on the edge and the front wheel up on top of it, hold still, then drop back off. Needs a rear peg fitted.',
    tips: 'The front wheel takes most of your weight, not the peg. Come in slowly and stop properly before you think about the exit.',
    fact: 'It is the stall version of the feeble grind, and it teaches the same body position with none of the speed.',
    mistakes: [
      {
        what: 'Trying it with no rear peg.',
        fix: 'Fit a back peg on your grind side first; the wheel on top does not hold you there.',
      },
      {
        what: 'Front wheel too far onto the ledge.',
        fix: 'Keep the tyre close to the edge; drift inwards and the peg slides off.',
      },
      {
        what: 'Hopping too high.',
        fix: 'A small pop is enough; the bike only needs to reach feeble height.',
      },
      {
        what: 'Rushing the exit.',
        fix: 'Come to a proper stop, then lift the front and let the peg drop off the edge.',
      },
    ],
    hard: 'The feeble position without the slide, so only the hop is needed. The balance is a wheel on top and one peg on the edge, held still before you learn to hold it moving.',
    isLive: true,
  },
  {
    id: 'bmx-peg-stall',
    name: 'Double Peg Stall (coping)',
    sport: 'bmx',
    cat: 'park',
    diff: 2,
    pre: ['bmx-pump', 'bmx-bunny-hop'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Ride up a quarter pipe and hop both pegs onto the coping, balance there, then drop back into the transition. Pegs are needed for it.',
    tips: 'Get all the way up so the pegs land on top of the coping rather than against it. Lean into the ramp, not away from it.',
    fact: 'It is the same balance as a double peg stall on a ledge, moved onto the coping where the drop back in is the hard half.',
    mistakes: [
      {
        what: 'Carrying too much speed.',
        fix: 'Use just enough speed to reach the coping; extra speed carries you over onto the deck.',
      },
      {
        what: 'Keeping the bike upright at the top.',
        fix: 'Lean the bike into the coping and keep your body slightly over the transition.',
      },
      {
        what: 'Half committing to the drop back in.',
        fix: 'Turn the wheel into the ramp and lean in; hesitating slides you sideways down the transition.',
      },
      {
        what: 'Pegs hitting the side of the coping.',
        fix: 'Ride all the way up so the pegs land on top, not against the front edge.',
      },
    ],
    hard: 'It is a Rookie balance moved up a ramp. Getting there is a pump, but speed and lean now have to match, and the drop back in is the half that takes the goes.',
    isLive: true,
  },
  {
    id: 'bmx-footplant',
    name: 'Footplant',
    sport: 'bmx',
    cat: 'park',
    diff: 2,
    pre: ['bmx-drop-in', 'bmx-pump'],
    // Paid by the free-tier shape at the top of this file.
    free: false,
    about:
      'Ride up a ramp, step one foot off onto the deck while you hold the bike up, then hop back on and drop in again.',
    tips: 'Keep hold of the bars the whole time and plant flat, not on your toes. A low ramp first.',
    fact: 'On its own it is a way of stopping at the top. It is also the first half of every footplant trick above it.',
    mistakes: [
      {
        what: 'Letting go of the bars.',
        fix: 'Keep both hands on the grips the whole time so the bike is ready to drop in.',
      },
      {
        what: 'Planting on your toes.',
        fix: 'Put the whole foot down flat on the deck so it takes your weight without slipping.',
      },
      {
        what: 'Stepping off before the bike stops.',
        fix: 'Let the bike run out of speed at the coping and then step, not before.',
      },
      {
        what: 'Trying it on a tall ramp first.',
        fix: 'Learn it on a low quarter where the step and the drop back in are both small.',
      },
    ],
    hard: 'It sits with the drop in because that is what it ends with. The new part is trusting one foot on the deck while the bike hangs on the ramp beside it.',
    isLive: true,
  },
  {
    id: 'bmx-ramp-manual',
    name: 'Ramp Manual',
    sport: 'bmx',
    cat: 'park',
    diff: 3,
    pre: ['bmx-manual', 'bmx-air'],
    about:
      'Carve out of a quarter pipe onto the flat deck at the top, manual across it, then carve back into the ramp.',
    tips: 'Come out with enough speed to cross the deck. Find the balance point as you land, not after you have rolled a metre.',
    fact: 'It sits at the top of the coaching basics ladder — the last of the fundamentals rather than the first of the tricks.',
    mistakes: [
      {
        what: 'Popping out too high.',
        fix: 'Stay compressed as you leave the ramp so you come onto the deck low and rolling.',
      },
      {
        what: 'Pulling up hard on landing.',
        fix: 'Lift the front just enough; pull too much with all that speed and you loop out.',
      },
      {
        what: 'Going straight across the deck.',
        fix: 'Lean slightly towards the coping so you turn in a mellow arc back into the ramp.',
      },
      {
        what: 'Choosing a short, busy deck.',
        fix: 'Find a long quarter with a wide, empty deck so there is room and nobody in the way.',
      },
    ],
    hard: 'A flat manual starts from a speed you control. This one starts as you land at speed on a deck, and the balance point must be found while you are already carving back.',
    isLive: true,
  },
  {
    id: 'bmx-wall-tap',
    name: 'Wall Tap',
    sport: 'bmx',
    cat: 'park',
    diff: 3,
    pre: ['bmx-wallride', 'bmx-fakie'],
    about:
      'Ride a transition into a vertical wall above it, tap both tyres against the wall, then drop back down into a fakie.',
    tips: 'Wallrides and fakie both need to be comfortable. Hit the wall square, and keep your weight over the bike as you come off.',
    fact: 'The wall gives you nothing back, so all the speed for coming down has to be there before you go up.',
    mistakes: [
      {
        what: 'Hitting the wall at an angle.',
        fix: 'Aim both tyres square at the wall so the bike pushes straight back off it.',
      },
      {
        what: 'Leaning back as you come off.',
        fix: 'Keep your weight over the bike; you drop into fakie and leaning back tips you off.',
      },
      {
        what: 'Expecting the wall to help.',
        fix: 'All the speed for coming down is the speed you arrive with, so carry enough on the way in.',
      },
      {
        what: 'Going too high up the wall.',
        fix: 'Tap just above the transition at first and raise it once the fakie roll-out is reliable.',
      },
    ],
    hard: 'A wallride keeps rolling; a wall tap stops. You go up, touch, and come down backwards, so the fakie has to be automatic before you add a wall to it.',
    isLive: true,
  },
  {
    id: 'bmx-hip-transfer',
    name: 'Hip Transfer',
    sport: 'bmx',
    cat: 'park',
    diff: 3,
    pre: ['bmx-air', 'bmx-180'],
    about:
      'Air out of one ramp and land in another where two transitions meet at an angle, crossing the corner between them.',
    tips: 'Look at the landing ramp from the moment you leave the first one. Come in with more speed than for a straight air.',
    fact: 'Hips are the corners of a park, and transferring across one is how riders link a whole run rather than a single ramp.',
    mistakes: [
      {
        what: 'Looking at the ramp you are leaving.',
        fix: 'Turn your head to the landing ramp as soon as you leave the first lip.',
      },
      {
        what: 'Airing straight up.',
        fix: 'Carve up the first ramp so your arc carries you across the corner, not back down it.',
      },
      {
        what: 'Coming in with straight-air speed.',
        fix: 'Carry a bit more speed than for an air; the gap across the corner needs it.',
      },
      {
        what: 'Landing with the bike vertical.',
        fix: 'Level the bike and nose into the landing transition so you do not loop out.',
      },
    ],
    hard: 'An air lands in the ramp you left. A transfer lands in a different one, so you leave with more speed, turn part of a 180 and spot a landing you cannot see yet.',
    isLive: true,
  },
  {
    id: 'bmx-rail-ride',
    name: 'Rail Ride',
    sport: 'bmx',
    cat: 'street',
    diff: 3,
    pre: ['bmx-bunny-hop', 'bmx-manual'],
    about:
      'Bunny hop onto a low flat rail and ride along it on your tyres rather than your pegs, balancing down its length.',
    tips: 'A low flat rail or a wide ledge, never a handrail. Land square along the rail and look at the far end of it.',
    fact: 'It is a balance trick rather than a grind — nothing slides, and the tyres do all the work.',
    mistakes: [
      {
        what: 'Going straight to a round rail.',
        fix: 'Ride a painted line, then a kerb edge, then a low square rail before anything round.',
      },
      {
        what: 'Landing both wheels at once.',
        fix: 'Land the front wheel first and let the back wheel line up behind it.',
      },
      {
        what: 'Pedals uneven on landing.',
        fix: 'Land with the pedals level so your feet can make small balance adjustments.',
      },
      {
        what: 'Tensing up on the rail.',
        fix: 'Firm grip, loose body; a rigid rider cannot make the tiny corrections.',
      },
    ],
    hard: 'The hop gets you on; the manual taught the tiny arm and knee corrections that keep you there. What is new is a surface only a tyre wide, so every move must be small.',
    isLive: true,
  },
  {
    id: 'bmx-one-hander',
    name: 'One-Hander',
    sport: 'bmx',
    cat: 'air',
    diff: 3,
    pre: ['bmx-air'],
    // Free because it is where the air category opens, on the same argument as
    // `bmx-double-peg`: a branch a free rider can see and can never enter is a
    // wall, not a library. One-footer, no-footer, can-can and the rest of the
    // air family stay paid.
    free: true,
    about:
      'Take one hand off the bars in the air, hold it out to the side, and get it back before you land.',
    tips: 'Let go later than feels right and grab back early. Keep the other hand firmly in the middle of the grip.',
    fact: 'It is the first trick where you deliberately let go of the bike, and everything no-handed grows out of it.',
    mistakes: [
      {
        what: 'Letting go too early.',
        fix: 'Release just before the top of the air so the hand has the shortest trip back.',
      },
      {
        what: 'Taking the hand a long way out.',
        fix: 'Open the hand on the grip first, then an inch or two away, and build from there.',
      },
      {
        what: 'Steering with the hand that stays on.',
        fix: 'Keep the remaining hand firm and central so the bars do not turn while you let go.',
      },
      {
        what: 'Only ever using one side.',
        fix: 'Learn it with both hands; most tricks above it will want the other one free.',
      },
    ],
    hard: 'It is the first time your grip leaves the bike. Nothing else changes from an air, which is why it is Spicy rather than Gnarly, but the bars can turn the moment a hand goes.',
    isLive: true,
  },
  {
    id: 'bmx-one-footer',
    name: 'One-Footer',
    sport: 'bmx',
    cat: 'air',
    diff: 3,
    pre: ['bmx-air'],
    about:
      'Take one foot off its pedal in the air, kick it out to the side, and get it back on before you land.',
    tips: 'Kick from the hip and bring the foot back early. Find the pedal with your heel first, then roll the foot flat.',
    fact: 'Finding a pedal again in the air is a skill of its own, and it is the reason every no-footed trick needs this one first.',
    mistakes: [
      {
        what: 'Kicking forwards or backwards.',
        fix: 'Kick straight out to the side; forwards or back throws the bike the same way.',
      },
      {
        what: 'Being surprised by the other pedal.',
        fix: 'Expect the foot still on to drop straight down and be ready to balance for it.',
      },
      {
        what: 'Landing before the pedals are level.',
        fix: 'Get the foot back and level the cranks before the wheels touch.',
      },
      {
        what: 'Holding it out too long at first.',
        fix: 'Make the first ones a quick kick out and back, and hold longer as it feels normal.',
      },
    ],
    hard: 'It comes straight after the air because only one thing changes. But the pedal you leave keeps moving, and finding it again with your heel is a skill the air never asked for.',
    isLive: true,
  },
  {
    id: 'bmx-no-footer',
    name: 'No-Footer',
    sport: 'bmx',
    cat: 'air',
    diff: 3,
    pre: ['bmx-one-footer', 'bmx-air'],
    about:
      'Both feet off the pedals in the air, kicked out to the sides, then back on the pedals before you land.',
    tips: 'One-footers on both sides first. Take a bigger jump than you think you need — you want time to find both pedals.',
    fact: 'Missing a pedal on the way down is the standard way this goes wrong, which is why riders learn it over a jump box.',
    mistakes: [
      {
        what: 'Loose cranks or chain.',
        fix: 'Tighten the cranks and chain first so the pedals stay where you left them.',
      },
      {
        what: 'Kicking the feet forward.',
        fix: 'Push both feet straight out to the sides so the bike stays level under you.',
      },
      {
        what: 'Getting the feet back late.',
        fix: 'Bring both feet back before the top of the jump; there is less time than you think.',
      },
      {
        what: 'Taking it to a gap early.',
        fix: 'Keep it on a box or a flyout until both feet come back every single time.',
      },
    ],
    hard: 'A one-footer leaves one foot on to steady the bike. With both off, only your hands hold it, and both feet have to find moving pedals in the same moment.',
    isLive: true,
  },
  {
    id: 'bmx-can-can',
    name: 'Can-Can',
    sport: 'bmx',
    cat: 'air',
    diff: 3,
    pre: ['bmx-one-footer', 'bmx-air'],
    about:
      'Take one foot off and swing that leg right over the top tube to the other side of the bike, then bring it back.',
    tips: 'Lift the knee high so the foot clears the frame. Bring it back the moment it has crossed — do not admire it.',
    fact: 'The name comes from the dance, and the leg goes in exactly the same place.',
    mistakes: [
      {
        what: 'Swinging the foot straight across.',
        fix: 'Lift the knee first and kick the foot over at a downward angle past the other foot.',
      },
      {
        what: 'Going for it without a one-footer.',
        fix: 'Get the one-footer steady on the same jump first; the can-can starts from it.',
      },
      {
        what: 'Learning the movement in the air.',
        fix: 'Practise the leg-over on flat ground standing still so the motion is already known.',
      },
      {
        what: 'Aiming at nothing.',
        fix: 'Aim the foot at your opposite grip so the kick goes the same way every time.',
      },
    ],
    hard: 'A one-footer takes the foot out to its own side. Here it has to cross the top tube and come back, so the frame is in the way both times.',
    isLive: true,
  },
  {
    id: 'bmx-seat-grab',
    name: 'Seat Grab',
    sport: 'bmx',
    cat: 'air',
    diff: 3,
    pre: ['bmx-one-hander', 'bmx-air'],
    about:
      'Let go with one hand in the air and grab the seat, then put the hand back on the bars to land.',
    tips: 'Reach back rather than down, and keep your other arm firm so the bars stay straight while you have one hand off.',
    fact: 'It is the base of the whole superman family, and every trick that pushes the bike away starts with this grip.',
    mistakes: [
      {
        what: 'Looking for the seat.',
        fix: 'Reach back by feel and keep your eyes on the landing.',
      },
      {
        what: 'Reaching down instead of back.',
        fix: 'Push your hips back and reach behind you; the seat is behind, not below.',
      },
      {
        what: 'Loosening the hand on the bars.',
        fix: 'Keep the bar hand firm and central so the front wheel stays straight while you reach.',
      },
      {
        what: 'Grabbing late.',
        fix: 'Reach on the way up so the hand is back on the bars before the top of the air.',
      },
    ],
    hard: 'A one-hander takes the hand off and puts it back. A seat grab sends it somewhere specific behind you, so your body has to shift back too, and that moves your balance.',
    isLive: true,
  },
  {
    id: 'bmx-candybar',
    name: 'Candybar',
    sport: 'bmx',
    cat: 'air',
    diff: 3,
    pre: ['bmx-one-footer', 'bmx-air'],
    about:
      'Kick one foot up and over the handlebars in the air, so the leg passes between the bars and your body, then bring it back.',
    tips: 'Bars level and knee high. Catching a heel on the bar is what stops most first attempts, so lift more than you swing.',
    fact: 'It looks like you are stepping through the bike, and it is one of the few tricks where a leg goes over the bars.',
    mistakes: [
      {
        what: 'Swinging the leg instead of lifting it.',
        fix: 'Lift the knee high first so the heel clears the bar, then bring it across.',
      },
      {
        what: 'Bars turned as the leg comes over.',
        fix: 'Keep the bars level; a turned bar is what the heel catches on.',
      },
      {
        what: 'Bringing the leg back late.',
        fix: 'Get the foot back over and onto the pedal before the top of the jump.',
      },
      {
        what: 'Sitting back as the leg goes over.',
        fix: 'Stay over the front so the bike does not tip back while your leg is across.',
      },
    ],
    hard: 'A one-footer kicks out to the side. A candybar sends the same leg forward and over the bars, so the swing is longer and there is a bar in the way both ways.',
    isLive: true,
  },
  {
    id: 'bmx-abubaca',
    name: 'Abubaca',
    sport: 'bmx',
    cat: 'park',
    diff: 4,
    pre: ['bmx-tyre-tap', 'bmx-fakie', 'bmx-bunny-hop'],
    about:
      'Hop the back tyre onto the coping with the front wheel high, balance there on the brake, then hop backwards off and roll away fakie.',
    tips: 'Tyre taps and fakie both first. The back brake holds the balance — cover it before the tyre lands.',
    fact: 'Ron Wilkerson invented it, and it has one of the clearest prerequisite ladders of any trick in this library.',
    mistakes: [
      {
        what: 'Approaching too fast.',
        fix: 'Ride at moderate speed; too much and you overshoot the coping onto the deck.',
      },
      {
        what: 'Getting crooked on the coping.',
        fix: 'Keep the bike straight over the coping or there is no way back into the ramp.',
      },
      {
        what: 'Pulling up too far.',
        fix: 'Lift just enough to land the back tyre; further and you loop out on the deck.',
      },
      {
        what: 'Hesitating before the hop back.',
        fix: 'Commit to the hop back the moment you feel the balance; waiting is what puts you down.',
      },
    ],
    hard: 'The tyre tap lands and comes straight back. An abubaca stops, balances on the brake, then leaves backwards, so it adds a stall and a fakie exit to a trick you already have.',
    isLive: true,
  },
  {
    id: 'bmx-fufanu',
    name: 'Fufanu',
    sport: 'bmx',
    cat: 'park',
    diff: 4,
    pre: ['bmx-tyre-tap', 'bmx-180'],
    about:
      'Stall the back tyre directly on the coping with the front end up, then hop a half turn back out and ride away.',
    tips: 'Tyre taps first, then hold the stall for a beat before you spin. Turn from the shoulders with the front end still high.',
    fact: 'It is a tyre tap that stops, and the stopping is the part that takes the practice.',
    mistakes: [
      {
        what: 'Landing the tyre on the deck.',
        fix: 'Land the back tyre on the coping itself; on the deck it is a tyre tap.',
      },
      {
        what: 'Weight over the deck.',
        fix: 'Keep your weight back and over the transition so the bike is ready to come in.',
      },
      {
        what: 'Braking on the way up.',
        fix: 'Leave the brake alone until the tyre lands, then pull it hard and hold.',
      },
      {
        what: 'Spinning before the stall.',
        fix: 'Hold the stall for a beat and look where you want to land before you turn.',
      },
    ],
    hard: 'The tyre tap goes in and out. A fufanu stops on the coping, balances, and then spins a half turn back in, so it stacks a stall and a 180 on top of a tap.',
    isLive: true,
  },
  {
    id: 'bmx-nosepick',
    name: 'Nosepick',
    sport: 'bmx',
    cat: 'park',
    diff: 4,
    pre: ['bmx-tyre-tap', 'bmx-toothpick', 'bmx-peg-stall'],
    about:
      'Stall on the front wheel on the coping with the whole back end in the air, then drop back into the transition.',
    tips: 'Endos and tyre taps first. Cover the front brake and get your weight right over the front wheel as it lands.',
    fact: 'Skateboarding took this one from BMX rather than the other way round, which is unusual.',
    mistakes: [
      {
        what: 'Coming in fast.',
        fix: 'Slow down; this one works better with less speed than you expect.',
      },
      {
        what: 'Leaning too far over the bars.',
        fix: 'Get your weight over the front wheel but not past it, or you go over the bars.',
      },
      {
        what: 'Front tyre far from the coping.',
        fix: 'Land the tyre close to and parallel with the coping so the hop back is small.',
      },
      {
        what: 'Tagging the back wheel on the way in.',
        fix: 'Push the back end up and out as you hop back so the tyre clears the coping.',
      },
    ],
    hard: 'The tyre tap balances on the back wheel with the front high. A nosepick flips that: all your weight on the front brake with the back end in the air, on a coping.',
    isLive: true,
  },
  {
    id: 'bmx-360-fakie',
    name: '360 to Fakie',
    sport: 'bmx',
    cat: 'park',
    diff: 4,
    pre: ['bmx-360', 'bmx-fakie', 'bmx-air'],
    about:
      'Air out of a quarter pipe, spin a full 360, and land back in the transition rolling backwards.',
    tips: 'Airs and 360s both need to be automatic. Wind up on the way up the ramp and spot the ramp again on the way down.',
    fact: 'Landing fakie means you never have to complete the last part of the spin, which is why it comes before a full 360 out.',
    mistakes: [
      {
        what: 'Too much speed on the way up.',
        fix: 'Use just enough speed to reach about the top; the spin happens at the coping, not above it.',
      },
      {
        what: 'Losing track of the ramp.',
        fix: 'Keep your head turning through the spin so you can spot the transition on the way down.',
      },
      {
        what: 'Landing the back wheel first while upright.',
        fix: 'Level the bike before you land so the fakie roll starts on both wheels.',
      },
      {
        what: 'Forgetting the fakie half.',
        fix: 'Have fakie rolls automatic; once you land, the ride out is a fakie and nothing else.',
      },
    ],
    hard: 'A 360 on a jump has a landing in front of you. Here you spin over the coping and drop back in backwards, so you must judge the ramp from the middle of the spin.',
    isLive: true,
  },
  {
    id: 'bmx-no-hander',
    name: 'No-Hander',
    sport: 'bmx',
    cat: 'air',
    diff: 4,
    pre: ['bmx-tuck-no-hander', 'bmx-one-hander'],
    about:
      'Both hands off the bars in the air, arms out or clapped behind you, then back on the grips before you land.',
    tips: 'Tuck no-handers first, so your knees already know how to hold the bars. Let go for a fraction of a second and build up.',
    fact: 'It is a different trick from the tuck no-hander, not a bigger version — here nothing at all is holding the bars.',
    mistakes: [
      {
        what: 'Not pinching the seat.',
        fix: 'Set the seat so your knees can grip it; without that the bike falls away from you.',
      },
      {
        what: 'Reaching for where you left the bars.',
        fix: 'Put your hands back where the bars are now, not where they were.',
      },
      {
        what: 'Grabbing and landing in one movement.',
        fix: 'Pull up a little as you grab the grips so the landing is smoother.',
      },
      {
        what: 'Going big on the first day.',
        fix: 'Take the hands off a little, then a little more; it takes weeks and that is normal.',
      },
    ],
    hard: 'The tuck locks the bars against your body. Here nothing holds them but your knees on the seat, so any twist in the front end has to be caught with your hands.',
    isLive: true,
  },
  {
    id: 'bmx-no-foot-can-can',
    name: 'No-Foot Can-Can',
    sport: 'bmx',
    cat: 'air',
    diff: 4,
    pre: ['bmx-can-can', 'bmx-no-footer'],
    about:
      'A can-can where the second foot leaves its pedal too, so both legs end up on the same side of the bike in mid-air.',
    tips: 'Can-cans and no-footers both first. The second foot comes off last and goes back on first.',
    fact: 'Both feet on one side means the bike wants to tip, so the hands have to hold it level the entire time.',
    mistakes: [
      {
        what: 'Taking both feet off together.',
        fix: 'Do the can-can first and let the second foot leave last.',
      },
      {
        what: 'Second foot back late.',
        fix: 'The last foot off is the first foot back; it has the pedal to find.',
      },
      {
        what: 'Letting the bike tip.',
        fix: 'Hold the bars firm and level; with both legs on one side the bike wants to roll.',
      },
      {
        what: 'Learning it on a small jump.',
        fix: 'Use a bigger jump than a can-can needs so there is time for both feet.',
      },
    ],
    hard: 'The can-can keeps one foot on to steady the bike. Take that away and both legs hang on one side, so your hands alone hold the bike level while two feet find pedals.',
    isLive: true,
  },
  {
    id: 'bmx-nac-nac',
    name: 'Nac-Nac',
    sport: 'bmx',
    cat: 'air',
    diff: 4,
    pre: ['bmx-can-can'],
    about:
      'Swing one leg backwards over the rear of the bike in the air while you push the back end out, then bring it back.',
    tips: 'Can-cans first. Push the bike away from you as the leg goes over, or the frame catches your foot on the way back.',
    fact: 'It came from motocross, where riders swing a leg over the back of the bike for exactly the same reason.',
    mistakes: [
      {
        what: 'Swinging the leg over a level bike.',
        fix: 'Push the back end out first; the leg goes over where the wheel was.',
      },
      {
        what: 'Losing pressure on the pedal foot.',
        fix: 'Keep pulling the bars up so the bike stays stuck to the foot still on.',
      },
      {
        what: 'Going straight to the full move.',
        fix: 'Learn the leg kick back on its own first, then take it over the wheel.',
      },
      {
        what: 'Bringing the leg back slowly.',
        fix: 'Snap the foot back onto the pedal quickly and smoothly so you land balanced.',
      },
    ],
    hard: 'A can-can crosses the frame in front. A nac-nac crosses behind, over the back wheel, and only works if you push the bike sideways at the same time, so it is two moves at once.',
    isLive: true,
  },
  {
    id: 'bmx-superman',
    name: 'Superman',
    sport: 'bmx',
    cat: 'air',
    diff: 4,
    pre: ['bmx-no-footer'],
    about:
      'Both feet off the pedals with the legs stretched straight out behind you and the body over the bike, then back on to land.',
    tips: 'No-footers, on a big jump, until they are boring. Push the bike forwards rather than throwing your legs backwards.',
    fact: 'It is the trick that made BMX dirt jumping famous, and it needs more air than almost anything else at its level.',
    mistakes: [
      {
        what: 'Lifting the feet straight up.',
        fix: 'Slide the feet off sideways so the cranks do not spin while you are extended.',
      },
      {
        what: 'Pulling the bike back too early.',
        fix: 'Keep your arms out until your feet are almost at the pedals.',
      },
      {
        what: 'Head up and looking around.',
        fix: 'Keep your head down; it makes the extension and the pull back much simpler.',
      },
      {
        what: 'Landing with the bike still nosed up.',
        fix: 'Flick your wrists as you come back to bring the bike level for the landing.',
      },
    ],
    hard: 'A no-footer takes the feet off and back. A superman pushes the whole bike away from you, so it needs bigger air than anything near it and a pull back with only your arms.',
    isLive: true,
  },
  {
    id: 'bmx-superman-seatgrab',
    name: 'Superman Seatgrab',
    sport: 'bmx',
    cat: 'air',
    diff: 4,
    pre: ['bmx-seat-grab', 'bmx-superman'],
    about:
      'Push the bike right out in front with your body stretched behind it, one hand on the bars and one gripping the seat.',
    tips: 'Supermans and seat grabs both dialled first. The seat hand is what pulls the bike back — get it on before you extend.',
    fact: 'The seat grab is not decoration. It is the only thing bringing the bike back underneath you.',
    mistakes: [
      {
        what: 'Extending before the hand is on the seat.',
        fix: 'Get the seat hand on first; it is what pulls the bike back under you.',
      },
      {
        what: 'Pushing the bike out with both arms.',
        fix: 'The bar hand guides and the seat hand pulls; use them differently.',
      },
      {
        what: 'Going for full stretch on day one.',
        fix: 'Extend a little further each attempt; the full stretch arrives over weeks.',
      },
      {
        what: 'Feet back on with the bike sideways.',
        fix: 'Level the bike with the bar hand before you look for the pedals.',
      },
    ],
    hard: 'A superman keeps both hands on the bars. Moving one to the seat gives you more stretch but takes away half your grip on the bike, so the return has to come from the seat.',
    isLive: true,
  },
  {
    id: 'bmx-toboggan',
    name: 'Toboggan',
    sport: 'bmx',
    cat: 'air',
    diff: 4,
    pre: ['bmx-seat-grab', 'bmx-x-up'],
    about:
      'Grab the seat with one hand, turn the bars about a quarter turn and lean back behind the seat, then straighten it all out to land.',
    tips: 'Seat grabs and X-Ups first. Turn the bars and lean back together, and start straightening before you think you need to.',
    fact: 'It is one of the oldest air tricks in BMX and still one of the most recognisable in a photograph.',
    mistakes: [
      {
        what: 'Turning the bars slowly.',
        fix: 'Turn them quickly and early; the quick turn is what makes the trick.',
      },
      { what: 'Staying upright.', fix: 'Bend right at the hips and lean back behind the seat.' },
      {
        what: 'Doing an X-up with a seat grab.',
        fix: 'Turn the bars a quarter, not a half, and lean back further than feels right.',
      },
      {
        what: 'Straightening late.',
        fix: 'Start turning the bars back before the top of the air.',
      },
    ],
    hard: 'A seat grab moves one hand; an X-up turns the bars. A toboggan does both and leans your body back behind the seat, so three things have to undo before the wheels touch.',
    isLive: true,
  },
  {
    id: 'bmx-crooked',
    name: 'Crooked Grind',
    sport: 'bmx',
    cat: 'street',
    diff: 4,
    pre: ['bmx-double-peg'],
    about:
      'Grind a narrow ledge with the front peg on one side and the rear peg on the other, so the bike straddles it. Needs pegs on both sides.',
    tips: 'Be comfortable bailing out of a grind before you try this one. A low waxed ledge, and land both pegs at the same time.',
    fact: 'The bike sitting across the ledge rather than beside it is what makes it grab so hard if you land it crooked.',
    mistakes: [
      {
        what: 'Pegs fitted on one side only.',
        fix: 'It needs a front peg on one side and a back peg on the other; check before you start.',
      },
      {
        what: 'Weight off to one side.',
        fix: 'Keep your body and bike straight over the ledge; lean either way and a peg slides off.',
      },
      {
        what: 'Bars straight ahead in the grind.',
        fix: 'Turn the bars slightly towards the ledge; it helps the front peg stay hooked.',
      },
      {
        what: 'Sliding off the end without lifting.',
        fix: 'Pull up hard so the front wheel clears back over the ledge, or the cranks catch.',
      },
    ],
    hard: 'A double peg has both pegs on one side; this straddles the ledge with one each side, so your weight must sit centre or a peg lets go. Getting off is just as hard.',
    isLive: true,
  },
  {
    id: 'bmx-pedal-grind',
    name: 'Pedal Grind',
    sport: 'bmx',
    cat: 'street',
    diff: 4,
    pre: ['bmx-feeble'],
    about:
      'Grind a ledge on the rear pedal or the sprocket rather than a peg, with the back end low and the front wheel up on the ledge.',
    tips: 'Wax the ledge properly and expect to mark your pedals. Keep your weight back so the pedal stays loaded.',
    fact: 'It is one of very few tricks that genuinely wears out parts — riders keep an old pedal on for it.',
    mistakes: [
      {
        what: 'Ledge not smooth enough.',
        fix: 'Only use a smooth, well-waxed edge; a rough one wrecks your pedal and stops you dead.',
      },
      {
        what: 'Back foot floating on the pedal.',
        fix: 'Stomp the pedal down onto the edge as you land and keep it loaded the whole way.',
      },
      {
        what: 'Pedal lifting mid-grind.',
        fix: 'If you run a brake, squeeze it as you stomp; it stops the pedal riding up off the edge.',
      },
      {
        what: 'Coasting to the end and dropping.',
        fix: 'Push down through the back foot at the end to pop off, then land both wheels level.',
      },
    ],
    hard: 'It is the feeble with the back end hung much lower, on a pedal instead of a peg. Pedals are not made for it, so the grind is shorter, rougher, and needs constant back-foot pressure.',
    isLive: true,
  },
  {
    id: 'bmx-luc-e',
    name: 'Luc-E Grind',
    sport: 'bmx',
    cat: 'street',
    diff: 4,
    pre: ['bmx-feeble', 'bmx-pedal-grind'],
    about:
      'Grind with the rear peg and the pedal locked on the ledge together, bars turned, front wheel held clear. Pegs and a solid pedal both needed.',
    tips: 'Feebles and pedal grinds first. The bars stay turned for the whole grind — straightening them drops the pedal off.',
    fact: 'It is named after the rider who made it his own, and it is one of the few grinds using two different parts at once.',
    mistakes: [
      {
        what: 'Peg and pedal landing separately.',
        fix: 'Aim to set the back peg and the pedal on the edge together, leaning into the ledge.',
      },
      {
        what: 'Starting right next to the ledge.',
        fix: 'Begin a foot or two out and hop in towards it, turning the wheel away slightly.',
      },
      {
        what: 'Letting the front end dip and stay.',
        fix: 'Let the front dip as you lock in, then pull it back up before you hop off sideways.',
      },
      {
        what: 'Weight leaning away from the ledge.',
        fix: 'Lean into the ledge so the pedal stays pressed on the edge and the peg stays hooked.',
      },
    ],
    hard: 'The pedal grind taught you to load a pedal on an edge; the feeble taught the peg. This locks both at once with the bars turned, so there are three things to hold, not one.',
    isLive: true,
  },
  {
    id: 'bmx-feeble-180',
    name: 'Feeble Grind to 180',
    sport: 'bmx',
    cat: 'street',
    diff: 4,
    pre: ['bmx-bunny-hop', 'bmx-feeble', 'bmx-180', 'bmx-fakie'],
    about:
      'Grind a feeble, then pop the front wheel and the back peg off together into a half turn, rolling away fakie.',
    tips: 'Feebles, 180s and fakie all have to be there first. Pop off the end of the ledge, not from the middle of it.',
    fact: 'Its tutorial lists the four tricks you need before it, which makes it the best-documented ladder in this library.',
    mistakes: [
      {
        what: 'Popping the front wheel first.',
        fix: 'Pop the front wheel and the back peg off together, or the bike leaves lopsided.',
      },
      {
        what: 'Forgetting the bike is tilted.',
        fix: 'The back end starts lower than the front, so level out in the air before you land.',
      },
      {
        what: 'Looking at the ledge, not the landing.',
        fix: 'Turn your head as you pop and look for the spot; you should end up facing the ledge.',
      },
      {
        what: 'Committing to the full turn straight away.',
        fix: 'Feeble slow and pop a 90 out first; the 180 comes as the speed comes.',
      },
    ],
    hard: 'Four skills feed in, but the join is the problem: you pop from a tilted bike with one peg on the edge, not from flat ground. Levelling out in the air is the new thing.',
    isLive: true,
  },
  {
    id: 'bmx-double-peg-hard-180',
    name: 'Double Peg Hard 180',
    sport: 'bmx',
    cat: 'street',
    diff: 4,
    pre: ['bmx-double-peg', 'bmx-180', 'bmx-fakie'],
    about:
      'Lock both pegs on a ledge, then spin a half turn the hard way off the end and roll out backwards.',
    tips: 'The hard way means turning towards the ledge, which you cannot see. Commit to the whole turn or the pegs catch.',
    fact: 'The same grind spun the other way is much easier, which is exactly why this one is called the hard 180.',
    mistakes: [
      {
        what: 'Pulling straight into the spin.',
        fix: 'Lean slightly into the ledge first, then pop and turn away; it gives you the leverage.',
      },
      {
        what: 'Head not leading the turn.',
        fix: 'Turn your head the hard way as you pop; without it you stop at 90.',
      },
      {
        what: 'Leaning back off the pop.',
        fix: 'Keep your chest over the bike; leaning back off a hard 180 can loop you out.',
      },
      {
        what: 'Grinding too slowly.',
        fix: 'Carry a little more speed; a slow grind leaves nothing to spin with.',
      },
    ],
    hard: 'The double peg and the 180 are both solid; the hard way means spinning against your natural direction, from pegs instead of tyres. The head turn has to be quicker and fully committed.',
    isLive: true,
  },
  {
    id: 'bmx-180-double-peg',
    name: '180 to Double Peg Grind',
    sport: 'bmx',
    cat: 'street',
    diff: 4,
    pre: ['bmx-double-peg', 'bmx-180'],
    about:
      'Hop a half turn into the ledge so you land on both pegs already backwards, grind along it, then hop off the end.',
    tips: '180s and double pegs separately first. Get the turn finished before the pegs touch — landing mid-spin is what slips.',
    fact: 'The rotation comes first here and the whole grind happens backwards, which makes it a different trick from a hard 180.',
    mistakes: [
      {
        what: 'Still looking away as the pegs land.',
        fix: 'Finish the head turn early and spot the ledge before the pegs touch.',
      },
      {
        what: 'Leaning over the ledge.',
        fix: 'Keep your body straight over the bike; lean in and the pegs dig, lean out and they drop.',
      },
      {
        what: 'Pushing down with the grind-side foot.',
        fix: 'Keep your legs level and light; pressing that pedal grinds it into the ledge and stops you.',
      },
      {
        what: 'Guessing where the ledge ends.',
        fix: 'Grind it a few times to learn the timing, then pop a 180 off the end rather than peeking back.',
      },
    ],
    hard: 'The 180 and the double peg are both known; landing one inside the other is not. You have to finish the spin blind, set two pegs down backwards, and then slide without seeing the end.',
    isLive: true,
  },
  {
    id: 'bmx-fakie-wallride',
    name: 'Fakie Wallride',
    sport: 'bmx',
    cat: 'street',
    diff: 4,
    pre: ['bmx-wallride', 'bmx-fakie'],
    about:
      'Ride a bank into a wall, plant both tyres on it, then come off the wall backwards and roll away fakie.',
    tips: 'Wallrides and fakie both first. Keep your weight over the bike as it leaves the wall — leaning back drops the front end.',
    fact: 'Coming off a wall backwards means you cannot see the ground, so riders pick a wall they already know well.',
    mistakes: [
      {
        what: 'Leaning back into the wall.',
        fix: 'Extend your legs and push the bike into the wall so both tyres touch; lean forward over the bars.',
      },
      {
        what: 'Only the front wheel touching.',
        fix: 'Push out with your legs until the back wheel lands on the wall too.',
      },
      {
        what: 'Waiting on the wall.',
        fix: 'As soon as both wheels hit, push the bars forward and roll your wrists to get the back wheel off.',
      },
      {
        what: 'Landing and trying to ride forward.',
        fix: 'You come off backwards; roll the fakie down the bank and turn out at the bottom.',
      },
    ],
    hard: 'A wallride comes off forwards and away; this goes straight in and comes straight back off, so the back wheel has to reach the wall and leave it first. Fakie starts the moment you land.',
    isLive: true,
  },
  {
    id: 'bmx-icepick-180',
    name: 'Icepick to 180',
    sport: 'bmx',
    cat: 'street',
    diff: 4,
    pre: ['bmx-icepick', 'bmx-180', 'bmx-manual'],
    about:
      'Grind on the rear peg alone with the front end high, then pop a half turn off the end of the ledge and ride away fakie.',
    tips: 'Ledges and low flat rails only. Hold the front end up right through the grind — dropping it early kills the pop.',
    fact: 'Balancing the front end through a grind and then spinning out of it is two balance problems stacked in one trick.',
    mistakes: [
      {
        what: 'Front wheel hanging over the ledge.',
        fix: 'Stay parallel; if the tyre is over the top it hits the ledge and drops the front end.',
      },
      {
        what: 'Slamming the back peg down.',
        fix: 'Glide the peg onto the edge as level as you can; a slam kills your speed.',
      },
      {
        what: 'Weight drifting in or out.',
        fix: 'Keep your weight exactly over the edge, knees bent, arms locking the front height.',
      },
      {
        what: 'Popping from the tyres.',
        fix: 'Pull hard on the bars and push off with your legs from the peg, then tuck at the top.',
      },
    ],
    hard: 'The icepick is a manual on one peg; adding the 180 means popping a half turn from that peg with the front already high. The pop is legs and bars only.',
    isLive: true,
  },
  {
    id: 'bmx-barspin-fakie',
    name: 'Barspin to Fakie',
    sport: 'bmx',
    cat: 'hybrid',
    diff: 4,
    pre: ['bmx-hop-barspin', 'bmx-fakie', 'bmx-air'],
    about:
      'Air out of a quarter pipe, spin the bars and catch them, then come back into the transition rolling backwards.',
    tips: 'Hop barspins and fakie first. Throw the bars as you leave the coping so you have the whole air to catch them.',
    fact: 'Landing fakie gives you a longer moment at the top of the ramp, which is why bars go here before they go in a 360.',
    mistakes: [
      {
        what: 'Throwing the bars late.',
        fix: 'Throw as you leave the coping so the whole air is there for the catch.',
      },
      {
        what: 'Letting the bike drift across the ramp.',
        fix: 'Hit the ramp almost straight on so you come back down where you left.',
      },
      {
        what: 'Not levelling the bike first.',
        fix: 'Push forward on the bars and pinch the seat with your knees before you throw.',
      },
      {
        what: 'Catching with the bars crooked.',
        fix: 'Catch straight; land with them past ninety degrees and the fakie roll goes wrong at once.',
      },
    ],
    hard: 'A hop barspin lands rolling forwards on flat. This one lands back in the ramp rolling backwards, so the catch has to be clean with no room to correct it.',
    isLive: true,
  },
  {
    id: 'bmx-footjam-whip',
    name: 'Footjam Tailwhip',
    sport: 'bmx',
    cat: 'hybrid',
    diff: 4,
    pre: ['bmx-footjam', 'bmx-hop-tailwhip'],
    about:
      'Jam a foot against the front tyre so the bike stalls, let the frame spin a full turn around the front end, then ride out.',
    tips: 'Footjams have to be rock steady first. Kick the frame with the free foot and catch it flat before you release the jam.',
    fact: 'The front wheel never leaves the ground, which is what puts it below an airborne tailwhip rather than above it.',
    mistakes: [
      {
        what: 'Kicking without the arms.',
        fix: 'The kick starts it; the arms carry the frame round and stop it hitting the floor.',
      },
      {
        what: 'Weak jam.',
        fix: 'Press the tyre into the fork hard; if the front wheel moves the whip cannot happen.',
      },
      {
        what: 'Bars straight with no room for the foot.',
        fix: 'Turn the bars a little so there is space to cross your foot onto the tyre.',
      },
      {
        what: 'Not spotting the pedals.',
        fix: 'Watch the cranks come round and put your feet on before you release the jam.',
      },
    ],
    hard: 'A hop tailwhip spins the frame in the air. Here the front wheel is pinned to the ground, so the whole thing turns around a fixed point and you balance on one foot through it.',
    isLive: true,
  },
  {
    id: 'bmx-footplant-whip',
    name: 'Footplant Tailwhip',
    sport: 'bmx',
    cat: 'hybrid',
    diff: 4,
    pre: ['bmx-footplant', 'bmx-hop-tailwhip'],
    about:
      'Whip the frame a full turn around the bars while one foot is planted on an obstacle, then hop back on and ride away.',
    tips: 'Footplants and bunny hop tailwhips both dialled. Plant firmly — a slipping foot takes the whip with it.',
    fact: 'Planting a foot buys you the time an airborne whip does not have, and takes away the height you would use to catch it.',
    mistakes: [
      {
        what: 'Planting lightly.',
        fix: 'Plant the foot firmly and flat; a slipping foot drags the whip with it.',
      },
      {
        what: 'Kicking before the plant is set.',
        fix: 'Let the planted foot take your weight, then kick.',
      },
      {
        what: 'Letting go with the arms.',
        fix: 'Keep both hands working the bars round; the kick starts the frame but the arms finish it.',
      },
      {
        what: 'Catching before the frame is level.',
        fix: 'Wait for the frame to come flat under you before you step back on.',
      },
    ],
    hard: 'Planting a foot gives you time an airborne whip does not, but takes away the height you would use to catch it, so the catch is lower and the frame must come round flat.',
    isLive: true,
  },
  {
    id: 'bmx-tooth-hanger',
    name: 'Toothpick Hangover',
    sport: 'bmx',
    cat: 'street',
    diff: 5,
    pre: ['bmx-toothpick'],
    about:
      'A front-peg grind with the whole back end thrown over to hang off the far side of the ledge. Needs front pegs fitted.',
    tips: 'Toothpick grinds first. Throw the back end over deliberately and keep your weight forward over the front peg.',
    fact: 'The bike ends up straddling the ledge with almost nothing supporting the back, which is why it needs so much wax and nerve.',
    mistakes: [
      {
        what: 'Back end left over the ledge.',
        fix: 'Throw the back wheel over to the far side on purpose; half over is where it catches.',
      },
      {
        what: 'Weight sitting back.',
        fix: 'Lean forward like a nose manual so the front peg carries you, not the back wheel.',
      },
      {
        what: 'Trying it without a front peg.',
        fix: 'It needs a front peg on the grind side; that peg is the only thing on the ledge.',
      },
      {
        what: 'Learning it long.',
        fix: 'Short hangovers first, and be ready to jump off over the bars if it tips.',
      },
    ],
    hard: 'The toothpick was short and upright; hanging the back end over the far side means leaning further forward on one front peg, with the bike across the ledge. Only a nose manual balance holds it.',
    isLive: true,
  },
  {
    id: 'bmx-nothing',
    name: 'Nothing',
    sport: 'bmx',
    cat: 'air',
    diff: 5,
    pre: ['bmx-no-hander', 'bmx-no-footer'],
    about:
      'Both hands off the bars and both feet off the pedals at the same time, so nothing at all is holding the bike, then all four back on.',
    tips: 'No-handers and no-footers both automatic first, and a big jump. Everything comes off together and goes back on together.',
    fact: 'The name is literal. For a moment the bike is flying beside you, and it is the only trick in the sport where that is true.',
    mistakes: [
      {
        what: 'Taking hands and feet off one by one.',
        fix: 'Everything comes off together and goes back on together.',
      },
      {
        what: 'Small jump.',
        fix: 'Take the biggest jump you are comfortable on; there must be time to find four things.',
      },
      {
        what: 'Loose cranks.',
        fix: 'Tighten cranks and chain so the pedals are where you left them.',
      },
      {
        what: 'Losing the bike.',
        fix: 'Keep the seat pinched by your knees; it is the only thing keeping the bike near you.',
      },
    ],
    hard: 'A no-hander and a no-footer each leave two points on the bike. A nothing leaves none, so for a moment the bike is flying beside you and all four have to come back at once.',
    isLive: true,
  },
  {
    id: 'bmx-handplant',
    name: 'Handplant',
    sport: 'bmx',
    cat: 'air',
    diff: 5,
    pre: ['bmx-air', 'bmx-peg-stall'],
    supervise: true,
    about:
      'Ride up a quarter pipe, plant one hand on the coping and go upside down with the bike, then drop back into the transition.',
    tips: 'Peg stalls and airs first. Helmet and pads on every attempt, and learn the hand position on a low ramp.',
    fact: 'It is one of the oldest ramp tricks in the sport, from the days when BMX and skateboarding shared the same ramps.',
    mistakes: [
      {
        what: 'Planting the hand too far from the coping.',
        fix: 'Plant right on the coping, close to the bike, so your arm can hold the weight.',
      },
      {
        what: 'Letting go with the other hand.',
        fix: 'Keep the bar hand firm; it is what brings the bike back down into the ramp.',
      },
      {
        what: 'Hand down on the first go.',
        fix: 'Learn the reach on a low ramp with airs first, then plant only when you can reach the coping.',
      },
      {
        what: 'Trying it with nobody watching.',
        fix: 'You go upside down over coping, so have someone there and a low ramp for the first ones.',
      },
    ],
    hard: 'A peg stall balances on the coping the right way up. A handplant balances on one arm with the bike above your head, so you are upside down and the drop back in is blind.',
    isLive: true,
  },
  {
    id: 'bmx-frontflip',
    name: 'Frontflip',
    sport: 'bmx',
    cat: 'air',
    diff: 5,
    pre: ['bmx-backflip', 'bmx-air'],
    supervise: true,
    about: 'A full forward rotation off a ramp or a jump, landing back on both wheels.',
    tips: 'Foam pit, then resi, then wood, and not one rung skipped. Backflips need to be automatic before you go forwards.',
    fact: 'There is no gentle way in. Riders learn this one in a foam pit with a coach or they do not learn it at all.',
    mistakes: [
      {
        what: 'Throwing the head down.',
        fix: 'Throw from the hips and shoulders together; a head-first throw folds you over the bars.',
      },
      {
        what: 'Expecting it to feel like a backflip.',
        fix: 'It spins the other way and you see the landing late; get many in foam before anything else.',
      },
      {
        what: 'Skipping resi.',
        fix: 'Foam, then resi, then wood; each rung is there because the landing is what gets you.',
      },
      {
        what: 'Learning it alone.',
        fix: 'This one is learned in a foam pit with a coach watching, or not at all.',
      },
    ],
    hard: 'A backflip rotates the way a ramp already throws you. A frontflip fights that, so it needs a harder throw and the landing appears much later, which is why it comes after the backflip.',
    isLive: true,
  },
  {
    id: 'bmx-360-tailwhip',
    name: '360 Tailwhip',
    sport: 'bmx',
    cat: 'hybrid',
    diff: 5,
    pre: ['bmx-360', 'bmx-hop-tailwhip', 'bmx-truckdriver'],
    about: 'A full 360 spin with the frame completing a tailwhip around the bars at the same time.',
    tips: 'Spin first, kick second — throwing the whip too early stalls the rotation. You need the biggest jump you can find.',
    fact: 'Two rotations happening at once means you can only spot the landing once, right at the end of both of them.',
    mistakes: [
      {
        what: 'Kicking before the spin has started.',
        fix: 'Start the 360 first and kick second; an early whip stalls the rotation.',
      },
      {
        what: 'Small jump.',
        fix: 'Use the biggest jump you have; two rotations need all the air you can find.',
      },
      {
        what: 'Looking for the landing early.',
        fix: 'Watch the frame come round; the landing can only be spotted at the end of both spins.',
      },
      {
        what: 'Kicking against the spin.',
        fix: 'Kick the frame the same way you are spinning so the two help each other.',
      },
    ],
    hard: 'A truckdriver spins the bars inside a 360. A 360 tailwhip spins the whole frame inside a 360, so your feet leave the bike mid-spin and find it again as both finish together.',
    isLive: true,
  },
  {
    id: 'bmx-downside-whip',
    name: 'Downside Tailwhip',
    sport: 'bmx',
    cat: 'hybrid',
    diff: 5,
    pre: ['bmx-hop-tailwhip', 'bmx-360-tailwhip'],
    about:
      'Your body spins one way while the frame whips the other, so the bike comes back underneath you from the wrong side.',
    tips: 'Tailwhips have to be automatic. Turn your shoulders against the kick — it feels wrong, and that is the trick.',
    fact: 'Everything you learned about catching a tailwhip arrives from the opposite direction here, which is the whole difficulty.',
    mistakes: [
      {
        what: 'Turning the shoulders with the kick.',
        fix: 'Turn them against the kick; it feels wrong and that is the trick.',
      },
      {
        what: 'Expecting the catch on the usual side.',
        fix: 'The frame arrives from the other side, so look for it there.',
      },
      {
        what: 'Not having an oppo spin.',
        fix: 'Be able to spin the other way, or whip the other way, before you combine them.',
      },
      {
        what: 'Slow kick.',
        fix: 'Kick hard; you are spinning away from the frame and it has further to come.',
      },
    ],
    hard: 'Every whip so far turns with your body. Here your body spins one way while the frame goes the other, so everything you know about catching arrives from the wrong side.',
    isLive: true,
  },
  {
    id: 'bmx-decade',
    name: 'Decade',
    sport: 'bmx',
    cat: 'hybrid',
    diff: 5,
    pre: ['bmx-hop-tailwhip', 'bmx-360'],
    about:
      'You and the bars swing a full turn around the bike while the back end stays where it is. A tailwhip with the roles swapped.',
    tips: 'Tailwhips first, so you know how far a full turn is. Swing from the hips and keep the bike level under you.',
    fact: 'It is an old trick and a rare one — riders spin around bikes far less often than they spin bikes around themselves.',
    mistakes: [
      {
        what: 'Letting the frame turn.',
        fix: 'Push against the frame so it stays still; you are the thing that spins, not the bike.',
      },
      {
        what: 'Looking at the landing.',
        fix: 'Keep your eyes locked on the pedals until your feet are back on them.',
      },
      {
        what: 'Landing with the front high.',
        fix: 'Nose the bike into the landing so you do not loop out.',
      },
      {
        what: 'Learning it over a gap.',
        fix: 'Use a tabletop or foam so you can bail onto something; you will bail a lot.',
      },
    ],
    hard: 'A tailwhip spins the bike around you. A decade spins you around the bike, which means both feet off, a full body turn in the air, and feet finding a bike that has not moved.',
    isLive: true,
  },
  {
    id: 'bmx-double-tailwhip',
    name: 'Double Tailwhip',
    sport: 'bmx',
    cat: 'hybrid',
    diff: 5,
    pre: ['bmx-hop-tailwhip'],
    about: 'Two full tailwhips around the bars in a single hop, caught on the second one.',
    tips: 'Single whips have to be effortless and high before you kick a second. Kick harder, not later, and take the biggest jump you have.',
    fact: 'The frame has to travel twice as far in the same air, so height is what makes it possible rather than technique.',
    mistakes: [
      {
        what: 'Kicking the second one later.',
        fix: 'Kick harder, not later; the second lap comes from the first kick.',
      },
      {
        what: 'Same height as a single.',
        fix: 'Take a bigger jump; twice the frame travel in the same air needs more time.',
      },
      {
        what: 'Catching after the first lap.',
        fix: 'Let the first one pass and watch the frame; the catch is on the second.',
      },
      {
        what: 'Single not yet effortless.',
        fix: 'Singles should be high and boring before you add a second.',
      },
    ],
    hard: 'A single whip is caught after one lap. Here the frame has to travel twice as far in the same air, so height is what makes it possible, not a different technique.',
    isLive: true,
  },
  {
    id: 'bmx-triple-tailwhip',
    name: 'Triple Tailwhip',
    sport: 'bmx',
    cat: 'hybrid',
    diff: 5,
    pre: ['bmx-double-tailwhip'],
    about: 'Three full tailwhips around the bars in one hop, caught on the third.',
    tips: 'Doubles first, on a big jump, until they are boring. Everything here comes from air time and a hard first kick.',
    fact: 'Very few riders have one, and almost all of them learned it off a big dirt jump or a resi landing rather than a park box.',
    mistakes: [
      {
        what: 'Kicking three times.',
        fix: 'One hard kick; the frame does all three laps on its own momentum.',
      },
      {
        what: 'Learning it on a park box.',
        fix: 'Learn it off a big dirt jump or a resi landing; the box does not give enough air.',
      },
      {
        what: 'Watching the landing.',
        fix: 'Count the laps and catch on the third; the landing waits.',
      },
      {
        what: 'Doubles not yet boring.',
        fix: 'Doubles should be automatic on a big jump before a third is added.',
      },
    ],
    hard: 'It is the double with one more lap and no more air to be had, so the first kick has to be hard enough for three and the catch comes with almost no time left.',
    isLive: true,
  },
] as const satisfies readonly Trick[];

/** Every trick id in the library, as a union. */
export type TrickId = (typeof TRICKS)[number]['id'];

/**
 * The prerequisite graph as edge records, shaped for the `trick_prereqs`
 * collection (plan §3) so a seed script can write it straight out.
 */
export const TRICK_PREREQS: readonly { readonly trick: TrickId; readonly prereq: TrickId }[] =
  TRICKS.flatMap((t) =>
    (t.pre as readonly TrickId[]).map((prereq) => ({ trick: t.id as TrickId, prereq })),
  );
