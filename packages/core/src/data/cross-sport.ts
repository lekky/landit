import type { SportId } from '../types';

/**
 * The cross-sport map (T28): which trick in another sport is the *same
 * movement* as this one. A scooter bunny hop is a skate ollie is a BMX bunny
 * hop; a scooter tailwhip has no skate equivalent at all.
 *
 * Researched 2026-09-07 alongside the per-trick content, from the three
 * libraries' own copy: two tricks are paired when the description of the
 * movement is the same with the vehicle swapped, and not paired on a shared
 * name alone — a skate 540 is an inverted McTwist, a BMX 540 is not, so they
 * are not a pair. 137 of the 259 tricks have at least one equivalent. The
 * rest either belong to their vehicle (whips, barspins, kickflips, peg
 * stalls) or have a namesake that is a different trick.
 *
 * **One equivalent per sport, and the map is symmetric.** Where a library
 * splits a movement into two tricks that another sport has as one — skate's
 * frontside and backside 180, scooter's 50-50 and double peg grind — the base
 * trick is the one mapped and the variant is left out, so that following the
 * link and coming back lands on the trick you left. The comments on the loose
 * pairings below record why each one was drawn the way it was; a pair with no
 * comment is a straight rename. The data tests hold the map symmetric, never
 * same-sport, and pointing only at tricks that exist.
 *
 * Nothing here is behaviour. `crossSportEquivalents()` in `../rules/tricks.ts`
 * reads it against the live trick list, so a hidden trick drops out of the
 * result without this file changing.
 */
export const CROSS_SPORT: Readonly<Record<string, Partial<Record<SportId, string>>>> = {
  /* ----------------------------------------------------------- scooter -- */

  // Skate has Frontside 180 and Backside 180 as separate tricks. sk-180 (Frontside) is the
  // library's base 180 and the one Backside builds on; the scooter and BMX copy name no
  // direction, so it is the one shown. Backside 180 is left unmapped.
  '180': { skate: 'sk-180', bmx: 'bmx-180' },
  // The scooter copy spins off a ramp or jump, the BMX copy out of a bunny hop; the movement is
  // the same full spin with the vehicle. BMX's 360 to Fakie is a different landing and is not
  // the match.
  '360': { bmx: 'bmx-360' },
  '360-whip': { bmx: 'bmx-360-tailwhip' },
  // The BMX copy says it is also called a 50-50. The scooter library's separate Double Peg Grind
  // describes the same grind and is left unmapped so each trick has one equivalent per sport.
  '50-50': { skate: 'sk-50-50', bmx: 'bmx-double-peg' },
  // Skate's 540 McTwist is inverted, so it is not mapped.
  '540': { bmx: 'bmx-540' },
  // The scooter copy rolls off a ledge, step or ramp lip; the skate and BMX copy start on a
  // kerb. Same roll off and land both wheels together.
  'acid-drop': { skate: 'sk-curb-drop', bmx: 'bmx-curb-drop' },
  // The skate copy grabs the nose with the front hand; the scooter copy says the bars do that
  // job. Same split-feet shape.
  airwalk: { skate: 'sk-airwalk' },
  backflip: { bmx: 'bmx-backflip' },
  // The scooter copy is any two facing ramps; the skate and BMX copy name a hip specifically.
  // Same transfer.
  'bank-transfer': { skate: 'sk-hip-transfer', bmx: 'bmx-hip-transfer' },
  // BMX also has a Pull-Up Barspin with only the front wheel lifted; the hop version is what the
  // scooter copy describes.
  'bar-spin': { bmx: 'bmx-hop-barspin' },
  boardslide: { skate: 'sk-boardslide' },
  'body-varial': { skate: 'sk-body-varial' },
  'bunny-hop': { skate: 'sk-ollie', bmx: 'bmx-bunny-hop' },
  // The scooter copy swings both feet off one side of the deck; the BMX copy keeps one foot on
  // and swings the other over the frame. Both end with the legs on one side of the vehicle.
  'can-can': { bmx: 'bmx-can-can' },
  'candy-bar': { bmx: 'bmx-candybar' },
  // BMX's Crooked Grind straddles the ledge on opposite pegs, which is a different trick, so it
  // is not mapped.
  'crooked-grind': { skate: 'sk-crooked' },
  'double-whip': { bmx: 'bmx-double-tailwhip' },
  'drop-in': { skate: 'sk-drop-in', bmx: 'bmx-drop-in' },
  fakie: { skate: 'sk-fakie-roll', bmx: 'bmx-fakie' },
  feeble: { skate: 'sk-feeble', bmx: 'bmx-feeble' },
  flair: { bmx: 'bmx-flair' },
  'foot-jam': { bmx: 'bmx-footjam' },
  frontflip: { bmx: 'bmx-frontflip' },
  gap: { skate: 'sk-gap' },
  'half-cab': { skate: 'sk-half-cab', bmx: 'bmx-half-cab' },
  handplant: { skate: 'sk-handplant', bmx: 'bmx-handplant' },
  'hippie-jump': { skate: 'sk-hippie-jump' },
  // Skate calls the back-truck-only grind with the nose held up a 5-0.
  icepick: { skate: 'sk-5-0', bmx: 'bmx-icepick' },
  'indy-grab': { skate: 'sk-indy' },
  // Skate splits the flat kickturn from the ramp one; this is the flat entry, which is what the
  // scooter copy describes.
  kickturn: { skate: 'sk-kickturn' },
  lipslide: { skate: 'sk-lipslide' },
  // Not the BMX Wheelie, which is pedalled; the BMX Manual is the same no-pedal balance point.
  manual: { skate: 'sk-manual', bmx: 'bmx-manual' },
  'no-footer': { bmx: 'bmx-no-footer' },
  'no-hander': { bmx: 'bmx-no-hander' },
  // BMX calls the front-peg-only grind with the back end held up a Toothpick.
  'nose-grind': { skate: 'sk-nosegrind', bmx: 'bmx-toothpick' },
  'nose-manual': { skate: 'sk-nose-manual', bmx: 'bmx-nose-manual' },
  'one-hander': { bmx: 'bmx-one-hander' },
  // The scooter copy skids the back wheel only; the skate copy skids all four. Same sideways
  // slide to scrub speed.
  powerslide: { skate: 'sk-powerslide' },
  pump: { skate: 'sk-pump', bmx: 'bmx-pump' },
  // Every skate air in the library carries a grab, so none is mapped to this plain air.
  'quarter-pipe-air': { bmx: 'bmx-air' },
  'rail-ride': { bmx: 'bmx-rail-ride' },
  // The scooter copy comes back down riding backwards and says riders call it a rock to fakie.
  // Skate's own Rock 'n' Roll turns out forwards, so it is not the match.
  'rock-n-roll': { skate: 'sk-rock-to-fakie' },
  // The scooter and BMX copy grind the front peg; the skate copy locks the back truck with the
  // nose dipped below the ledge. Same name and the same angled shape in all three.
  smith: { skate: 'sk-smith', bmx: 'bmx-smith' },
  superman: { bmx: 'bmx-superman' },
  'table-top': { bmx: 'bmx-tabletop' },
  // BMX splits the flyout whip from the bunny-hop whip; the scooter copy is out of a hop.
  tailwhip: { bmx: 'bmx-hop-tailwhip' },
  'tic-tac': { skate: 'sk-tic-tac' },
  // The scooter copy grabs the deck; the BMX copy grabs the seat. Same bar turn and lean back.
  toboggan: { bmx: 'bmx-toboggan' },
  'truck-driver': { bmx: 'bmx-truckdriver' },
  'tuck-no-hander': { bmx: 'bmx-tuck-no-hander' },
  turndown: { bmx: 'bmx-turndown' },
  wallride: { skate: 'sk-wallride', bmx: 'bmx-wallride' },
  whiplash: { bmx: 'bmx-footjam-whip' },
  'x-up': { bmx: 'bmx-x-up' },

  /* ------------------------------------------------------------- skate -- */

  // Skate has Frontside 180 and Backside 180 as separate tricks. sk-180 (Frontside) is the
  // library's base 180 and the one Backside builds on; the scooter and BMX copy name no
  // direction, so it is the one shown. Backside 180 is left unmapped.
  'sk-180': { scooter: '180', bmx: 'bmx-180' },
  // Skate calls the back-truck-only grind with the nose held up a 5-0.
  'sk-5-0': { scooter: 'icepick', bmx: 'bmx-icepick' },
  // The BMX copy says it is also called a 50-50. The scooter library's separate Double Peg Grind
  // describes the same grind and is left unmapped so each trick has one equivalent per sport.
  'sk-50-50': { scooter: '50-50', bmx: 'bmx-double-peg' },
  // The skate copy grabs the nose with the front hand; the scooter copy says the bars do that
  // job. Same split-feet shape.
  'sk-airwalk': { scooter: 'airwalk' },
  // Both trucks on the coping, both pegs on the coping.
  'sk-axle-stall': { bmx: 'bmx-peg-stall' },
  'sk-boardslide': { scooter: 'boardslide' },
  'sk-body-varial': { scooter: 'body-varial' },
  // BMX's Crooked Grind straddles the ledge on opposite pegs, which is a different trick, so it
  // is not mapped.
  'sk-crooked': { scooter: 'crooked-grind' },
  // The scooter copy rolls off a ledge, step or ramp lip; the skate and BMX copy start on a
  // kerb. Same roll off and land both wheels together.
  'sk-curb-drop': { scooter: 'acid-drop', bmx: 'bmx-curb-drop' },
  // The BMX copy adds rolling off the far side; the trick in both is hopping up onto the kerb.
  'sk-curb-ollie': { bmx: 'bmx-hop-on-off' },
  'sk-disaster': { bmx: 'bmx-disaster' },
  'sk-drop-in': { scooter: 'drop-in', bmx: 'bmx-drop-in' },
  'sk-fakie-roll': { scooter: 'fakie', bmx: 'bmx-fakie' },
  'sk-feeble': { scooter: 'feeble', bmx: 'bmx-feeble' },
  // The skate copy stalls on coping, the BMX copy on a street ledge. Same feeble shape held
  // still.
  'sk-feeble-stall': { bmx: 'bmx-feeble-stall' },
  'sk-gap': { scooter: 'gap' },
  'sk-half-cab': { scooter: 'half-cab', bmx: 'bmx-half-cab' },
  'sk-handplant': { scooter: 'handplant', bmx: 'bmx-handplant' },
  // The scooter copy is any two facing ramps; the skate and BMX copy name a hip specifically.
  // Same transfer.
  'sk-hip-transfer': { scooter: 'bank-transfer', bmx: 'bmx-hip-transfer' },
  'sk-hippie-jump': { scooter: 'hippie-jump' },
  'sk-indy': { scooter: 'indy-grab' },
  // Skate splits the flat kickturn from the ramp one; this is the flat entry, which is what the
  // scooter copy describes.
  'sk-kickturn': { scooter: 'kickturn' },
  'sk-lipslide': { scooter: 'lipslide' },
  // Not the BMX Wheelie, which is pedalled; the BMX Manual is the same no-pedal balance point.
  'sk-manual': { scooter: 'manual', bmx: 'bmx-manual' },
  'sk-nollie': { bmx: 'bmx-nollie' },
  'sk-nose-manual': { scooter: 'nose-manual', bmx: 'bmx-nose-manual' },
  // BMX calls the front-peg-only grind with the back end held up a Toothpick.
  'sk-nosegrind': { scooter: 'nose-grind', bmx: 'bmx-toothpick' },
  'sk-nosepick': { bmx: 'bmx-nosepick' },
  'sk-ollie': { scooter: 'bunny-hop', bmx: 'bmx-bunny-hop' },
  // The scooter copy skids the back wheel only; the skate copy skids all four. Same sideways
  // slide to scrub speed.
  'sk-powerslide': { scooter: 'powerslide' },
  'sk-pump': { scooter: 'pump', bmx: 'bmx-pump' },
  // The scooter copy comes back down riding backwards and says riders call it a rock to fakie.
  // Skate's own Rock 'n' Roll turns out forwards, so it is not the match.
  'sk-rock-to-fakie': { scooter: 'rock-n-roll' },
  // The scooter and BMX copy grind the front peg; the skate copy locks the back truck with the
  // nose dipped below the ledge. Same name and the same angled shape in all three.
  'sk-smith': { scooter: 'smith', bmx: 'bmx-smith' },
  'sk-tic-tac': { scooter: 'tic-tac' },
  'sk-wallride': { scooter: 'wallride', bmx: 'bmx-wallride' },

  /* --------------------------------------------------------------- bmx -- */

  // Skate has Frontside 180 and Backside 180 as separate tricks. sk-180 (Frontside) is the
  // library's base 180 and the one Backside builds on; the scooter and BMX copy name no
  // direction, so it is the one shown. Backside 180 is left unmapped.
  'bmx-180': { scooter: '180', skate: 'sk-180' },
  // The scooter copy spins off a ramp or jump, the BMX copy out of a bunny hop; the movement is
  // the same full spin with the vehicle. BMX's 360 to Fakie is a different landing and is not
  // the match.
  'bmx-360': { scooter: '360' },
  'bmx-360-tailwhip': { scooter: '360-whip' },
  // Skate's 540 McTwist is inverted, so it is not mapped.
  'bmx-540': { scooter: '540' },
  // Every skate air in the library carries a grab, so none is mapped to this plain air.
  'bmx-air': { scooter: 'quarter-pipe-air' },
  'bmx-backflip': { scooter: 'backflip' },
  'bmx-bunny-hop': { scooter: 'bunny-hop', skate: 'sk-ollie' },
  // The scooter copy swings both feet off one side of the deck; the BMX copy keeps one foot on
  // and swings the other over the frame. Both end with the legs on one side of the vehicle.
  'bmx-can-can': { scooter: 'can-can' },
  'bmx-candybar': { scooter: 'candy-bar' },
  // The scooter copy rolls off a ledge, step or ramp lip; the skate and BMX copy start on a
  // kerb. Same roll off and land both wheels together.
  'bmx-curb-drop': { scooter: 'acid-drop', skate: 'sk-curb-drop' },
  'bmx-disaster': { skate: 'sk-disaster' },
  // The BMX copy says it is also called a 50-50. The scooter library's separate Double Peg Grind
  // describes the same grind and is left unmapped so each trick has one equivalent per sport.
  'bmx-double-peg': { scooter: '50-50', skate: 'sk-50-50' },
  'bmx-double-tailwhip': { scooter: 'double-whip' },
  'bmx-drop-in': { scooter: 'drop-in', skate: 'sk-drop-in' },
  'bmx-fakie': { scooter: 'fakie', skate: 'sk-fakie-roll' },
  'bmx-feeble': { scooter: 'feeble', skate: 'sk-feeble' },
  // The skate copy stalls on coping, the BMX copy on a street ledge. Same feeble shape held
  // still.
  'bmx-feeble-stall': { skate: 'sk-feeble-stall' },
  'bmx-flair': { scooter: 'flair' },
  'bmx-footjam': { scooter: 'foot-jam' },
  'bmx-footjam-whip': { scooter: 'whiplash' },
  'bmx-frontflip': { scooter: 'frontflip' },
  'bmx-half-cab': { scooter: 'half-cab', skate: 'sk-half-cab' },
  'bmx-handplant': { scooter: 'handplant', skate: 'sk-handplant' },
  // The scooter copy is any two facing ramps; the skate and BMX copy name a hip specifically.
  // Same transfer.
  'bmx-hip-transfer': { scooter: 'bank-transfer', skate: 'sk-hip-transfer' },
  // BMX also has a Pull-Up Barspin with only the front wheel lifted; the hop version is what the
  // scooter copy describes.
  'bmx-hop-barspin': { scooter: 'bar-spin' },
  // The BMX copy adds rolling off the far side; the trick in both is hopping up onto the kerb.
  'bmx-hop-on-off': { skate: 'sk-curb-ollie' },
  // BMX splits the flyout whip from the bunny-hop whip; the scooter copy is out of a hop.
  'bmx-hop-tailwhip': { scooter: 'tailwhip' },
  // Skate calls the back-truck-only grind with the nose held up a 5-0.
  'bmx-icepick': { scooter: 'icepick', skate: 'sk-5-0' },
  // Not the BMX Wheelie, which is pedalled; the BMX Manual is the same no-pedal balance point.
  'bmx-manual': { scooter: 'manual', skate: 'sk-manual' },
  'bmx-no-footer': { scooter: 'no-footer' },
  'bmx-no-hander': { scooter: 'no-hander' },
  'bmx-nollie': { skate: 'sk-nollie' },
  'bmx-nose-manual': { scooter: 'nose-manual', skate: 'sk-nose-manual' },
  'bmx-nosepick': { skate: 'sk-nosepick' },
  'bmx-one-hander': { scooter: 'one-hander' },
  // Both trucks on the coping, both pegs on the coping.
  'bmx-peg-stall': { skate: 'sk-axle-stall' },
  'bmx-pump': { scooter: 'pump', skate: 'sk-pump' },
  'bmx-rail-ride': { scooter: 'rail-ride' },
  // The scooter and BMX copy grind the front peg; the skate copy locks the back truck with the
  // nose dipped below the ledge. Same name and the same angled shape in all three.
  'bmx-smith': { scooter: 'smith', skate: 'sk-smith' },
  'bmx-superman': { scooter: 'superman' },
  'bmx-tabletop': { scooter: 'table-top' },
  // The scooter copy grabs the deck; the BMX copy grabs the seat. Same bar turn and lean back.
  'bmx-toboggan': { scooter: 'toboggan' },
  // BMX calls the front-peg-only grind with the back end held up a Toothpick.
  'bmx-toothpick': { scooter: 'nose-grind', skate: 'sk-nosegrind' },
  'bmx-truckdriver': { scooter: 'truck-driver' },
  'bmx-tuck-no-hander': { scooter: 'tuck-no-hander' },
  'bmx-turndown': { scooter: 'turndown' },
  'bmx-wallride': { scooter: 'wallride', skate: 'sk-wallride' },
  'bmx-x-up': { scooter: 'x-up' },
};
