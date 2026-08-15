/**
 * The game rules, as pure functions.
 *
 * Each one is the *definition* of a behaviour. Several of them are also
 * *enforced* somewhere else — the paywall and the sticker award run in
 * PocketBase hooks on the server (plan §3), and the copies the client calls
 * exist only so the UI can respond instantly. Where a rule matters for
 * security, its doc comment says where the enforcement lives.
 */

export {
  canLogChallenge,
  challengeProgress,
  challengeRangeLabel,
  challengeState,
  challengesFor,
  challengesOverlap,
  isDayInChallenge,
  liveChallenge,
  overlappingChallenges,
  type ChallengeProgress,
} from './challenges';
export {
  firstLanded,
  landedByMonth,
  latestLanded,
  logEntriesForTrick,
  type LandedMonth,
  type LogOptions,
} from './log';
export { goalLabel, goalsFor, isValidCustomGoal } from './profile';
export { distanceMiles, isValidLatLng, parseCoords } from './spots';
export { computeSportStats, computeStats, sportsOf, type StatsCatalogue } from './stats';
export {
  STICKER_RULES,
  earnedStickerIds,
  evaluateSticker,
  newlyEarnedStickerIds,
  stickerCondition,
  stickerRule,
  stickerScope,
  stickersFor,
} from './stickers';
export {
  STREAK_GRACE_DAYS,
  currentStreak,
  logRide,
  riderToday,
  rodeToday,
  streakStrip,
  type RideResult,
  type RiderClock,
  type StreakState,
} from './streak';
export {
  DEFAULT_TIMEZONE,
  addDays,
  compareDayKeys,
  daysBetween,
  isDayKey,
  isDayWithin,
  toDayKey,
} from './time';
export {
  FREE_MAX_DIFF,
  isLandedStage,
  isTrickFree,
  isTrickLanded,
  isTrickLocked,
  isTrickUnlocked,
  missingPrereqs,
  openTricks,
  planUnlocksPaidTricks,
  sportOf,
  suggestedNextTricks,
  trickById,
  tricksFor,
  tricksInCategory,
} from './tricks';
