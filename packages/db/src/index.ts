/**
 * `@landit/db` — PocketBase clients, the generated collection types, and the
 * typed reads and writes every screen goes through.
 *
 * Three layers, in the order you usually reach for them:
 *
 * 1. **Clients** (`clients.ts`) — browser, per-request server, and the
 *    server-held superuser. Which one you hold decides which rules apply to
 *    you, so it is the first decision, not an afterthought.
 * 2. **Typed access** (`collections.ts`) — `records(client, 'tricks')` for
 *    anything the named functions do not already cover. Filters are always
 *    parameterised.
 * 3. **Named reads and writes** (`queries.ts`, `mutations.ts`) — the queries
 *    the product actually makes, with their filters written once and their
 *    side effects kept together.
 *
 * **This package holds no rules.** Nothing here decides whether a trick is
 * free, whether a sticker is earned or whether a profile is visible: those live
 * in `@landit/core` (defined) and `pocketbase/` (enforced). A check written
 * here would be a third copy, weaker than both, and the one most likely to
 * drift (plan §3).
 */

/** Package identity. Exists so the scaffold has something real to import and test. */
export const DB_PACKAGE = '@landit/db' as const;

export {
  createBrowserClient,
  createServerClient,
  createSuperuserClient,
  MissingPocketBaseUrl,
  SuperuserUnavailable,
  type Client,
  type ClientOptions,
  type ServerClientOptions,
  type SuperuserClientOptions,
} from './clients';

export {
  checkHealth,
  HEALTH_DETAIL,
  superuserCredentialsPresent,
  type HealthOptions,
  type HealthReport,
  type SuperuserHealth,
} from './health';

export {
  approveConsent,
  claimHandle,
  confirmPasswordReset,
  isUniqueViolation,
  previewConsentLink,
  refreshAuth,
  requestGuardianConsent,
  requestPasswordReset,
  revokeConsent,
  signIn,
  signUp,
  type AgeDeclarationInput,
  type AuthResult,
  type ConsentDecision,
  type ConsentLinkPreview,
  type ConsentRequestResult,
  type SignUpInput,
} from './auth';

export {
  isForbidden,
  isNotFound,
  records,
  type CollectionCreate,
  type CollectionUpdate,
  type FilterParams,
  type ListOptions,
  type Page,
  type PageOptions,
} from './collections';

export * from './generated/collections';

export {
  challengesFromRecords,
  eventsFromRecords,
  getCrewBoard,
  getRider,
  getRiderByHandle,
  getTrickBySlug,
  getTrickNote,
  listAnnouncementDismissals,
  listAnnouncements,
  listChallengeLog,
  listChallenges,
  listCrewMemberships,
  listEventAttendance,
  listEvents,
  listPlans,
  listRiderStickers,
  listSpots,
  listStickers,
  listTrickLog,
  listTrickPrereqs,
  listTrickProgress,
  listTricks,
  listUnseenRiderStickers,
  riderSnapshot,
  trickLogEntries,
  trickProgressById,
  tricksFromRecords,
  type CrewBoardRider,
  type TrickFilter,
} from './queries';

export {
  attendEvent,
  clearTrickStage,
  deleteLogEntry,
  dismissAnnouncement,
  logChallengeEntry,
  markStickerSeen,
  saveTrickNote,
  saveWeeklyStreak,
  setInsightsOptIn,
  setTrickStage,
  submitSpot,
  unattendEvent,
  updateProfile,
  type ProfileEdit,
  type StageChange,
  type WeeklyStreakWrite,
} from './mutations';

export { buildSeed, seed, type SeedPlan, type SeedResult } from './seed';
