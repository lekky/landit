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
  confirmVerification,
  isUniqueViolation,
  previewConsentLink,
  refreshAuth,
  requestGuardianConsent,
  requestPasswordReset,
  requestVerification,
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
  deleteAccount,
  exportAccountData,
  fileReport,
  type AccountDeletionResult,
  type AccountExport,
  type ReportInput,
} from './account';

export {
  isForbidden,
  isNotFound,
  isRateLimited,
  records,
  refusalMessage,
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
  emailGuardianUpgrade,
  eventsFromRecords,
  getActiveSubscription,
  getCrew,
  getCrewBoard,
  getCrewFeed,
  getRider,
  getRiderByHandle,
  getRiderSticker,
  getTrickAward,
  getTrickBySlug,
  getTrickNote,
  listAnnouncementDismissals,
  listAnnouncements,
  listChallengeLog,
  listChallenges,
  listCrewInvites,
  listCrewMemberships,
  listCrews,
  listEventAttendance,
  listEvents,
  listPlans,
  listRiderStickers,
  getSpotBySlug,
  listLiveSpots,
  listSpots,
  listStickers,
  listSubscriptions,
  listTrickLog,
  listTrickNotes,
  listTrickPrereqs,
  listTrickProgress,
  listTricks,
  listUnseenRiderStickers,
  countVideoLinks,
  listVideoLinks,
  riderSnapshot,
  trickLogEntries,
  trickProgressById,
  tricksFromRecords,
  videoLinksFromRecords,
  type CrewBoardRider,
  type CrewFeedItem,
  type TrickFilter,
} from './queries';

export {
  addTrickNote,
  addVideoLink,
  attendEvent,
  clearTrickStage,
  createCrew,
  createCrewInvite,
  deleteCrewInvite,
  deleteLogEntry,
  deleteTrickNote,
  dismissAnnouncement,
  joinCrew,
  leaveCrew,
  logChallengeEntry,
  markStickerSeen,
  removeVideoLink,
  saveTrickNote,
  saveWeeklyStreak,
  setInsightsOptIn,
  setTrickStage,
  setVideoLinkVisibility,
  submitSpot,
  unattendEvent,
  updateProfile,
  updateTrickNote,
  upsertSubscription,
  type ProfileEdit,
  type StageChange,
  type SubscriptionWrite,
  type WeeklyStreakWrite,
} from './mutations';

export {
  adminRiderCounts,
  announcementCounts,
  applyStaffChange,
  createStaffRecord,
  deleteRider,
  challengeCounts,
  deleteStaffRecord,
  featuredChallenge,
  getReport,
  landedCountsFor,
  listAdminAnnouncements,
  listAdminAnnouncementsPage,
  listAdminChallengesPage,
  listAdminEvents,
  listAdminEventsPage,
  listAdminPlans,
  listAdminRiders,
  listAdminSpots,
  listAdminSpotsPage,
  listAdminStickers,
  listReports,
  listStaffAudit,
  relationCountsFor,
  reportCounts,
  spotCounts,
  setReportTriage,
  setRiderPlan,
  setRiderSuspended,
  setSpotStatus,
  writeStaffAudit,
  type AdminChallengeFilter,
  type AdminEventFilter,
  type AdminRiderCounts,
  type AdminRiderFilter,
  type AdminSpotFilter,
  type ReportCounts,
  type StaffActor,
  type StaffAuditEntry,
  type StaffChange,
} from './admin';

export {
  buildSeed,
  rowMatches,
  seed,
  seedableTables,
  selectTables,
  type SeedPlan,
  type SeedResult,
} from './seed';

export {
  countSpotsBySport,
  getSpotsByIds,
  listOwnSpots,
  listSpotPoints,
  pageSpots,
  pageWindows,
  spotListFilter,
  type SpotFilter,
  type SpotListQuery,
  type SpotPage,
  type SpotPoint,
} from './spots';
