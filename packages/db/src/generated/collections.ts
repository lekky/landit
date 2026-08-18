/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with `pnpm --filter @landit/db typegen` after changing anything
 * in `pocketbase/migrations/`. `collections.drift.test.ts` fails if this file
 * and the migrations disagree, so a stale copy cannot reach main.
 *
 * Every field is present on the `*Record` shapes because PocketBase returns a
 * zero value rather than omitting a field. Optionality only means something on
 * write, which is what `*Create` and `*Update` describe.
 */

/** Every collection Land The Trick defines. PocketBase's own `_`-prefixed ones are not here. */
export type CollectionName =
  | 'announcement_dismissals'
  | 'announcements'
  | 'audit_log'
  | 'challenge_log'
  | 'challenges'
  | 'clips'
  | 'crew_invites'
  | 'crew_members'
  | 'crews'
  | 'event_attendance'
  | 'events'
  | 'guardian_consents'
  | 'plans'
  | 'reports'
  | 'rider_stickers'
  | 'spots'
  | 'stickers'
  | 'subscriptions'
  | 'trick_log'
  | 'trick_notes'
  | 'trick_prereqs'
  | 'trick_progress'
  | 'tricks'
  | 'users';

export type AnnouncementsAudience = 'all' | 'plan' | 'sport';
export type AnnouncementsAudiencePlan = 'rookie' | 'shredder' | 'legend';
export type AnnouncementsAudienceSport = 'scooter' | 'skate' | 'bmx';
export type AuditLogActorKind = 'rider' | 'staff' | 'superuser' | 'guest' | 'system';
export type ChallengesSport = 'scooter' | 'skate' | 'bmx';
export type ClipsVisibility = 'private' | 'members';
export type CrewMembersRole = 'owner' | 'member';
export type EventsKind = 'Comp' | 'Session' | 'Class' | 'Jam';
export type EventsSports = 'scooter' | 'skate' | 'bmx';
export type GuardianConsentsMethod = 'email_approval';
export type ReportsReason = 'harassment' | 'unsafe' | 'illegal' | 'sexual' | 'self_harm' | 'spam' | 'other';
export type ReportsStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';
export type ReportsSubjectType = 'profile' | 'clip' | 'spot' | 'other';
export type SpotsSports = 'scooter' | 'skate' | 'bmx';
export type SpotsStatus = 'pending' | 'live' | 'rejected';
export type StickersSport = 'scooter' | 'skate' | 'bmx';
export type SubscriptionsPayerKind = 'rider' | 'guardian';
export type SubscriptionsSource = 'stripe' | 'apple' | 'google' | 'staff';
export type SubscriptionsStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
export type TrickLogStage = 'want' | 'trying' | 'some' | 'most' | 'every';
export type TrickProgressStage = 'want' | 'trying' | 'some' | 'most' | 'every';
export type TricksCat = 'flat' | 'street' | 'park' | 'hybrid' | 'air';
export type TricksFreeOverride = 'free' | 'paid';
export type TricksSport = 'scooter' | 'skate' | 'bmx';
export type UsersAgeBand = 'under_13' | '13_15' | '16_17' | 'adult';
export type UsersConsentState = 'not_required' | 'pending' | 'granted' | 'revoked';
export type UsersLevel = 'new' | 'some' | 'solid' | 'send';
export type UsersPlan = 'rookie' | 'shredder' | 'legend';
export type UsersPrivacy = 'public' | 'members' | 'private';
export type UsersRole = 'rider' | 'staff';
export type UsersSports = 'scooter' | 'skate' | 'bmx';
export type UsersStance = 'regular' | 'goofy' | 'switch';

/** A `announcement_dismissals` record as PocketBase returns it. */
export interface AnnouncementDismissalsRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  user: string;
  announcement: string;
  created: string;
}

/** The shape accepted when creating a `announcement_dismissals` record. */
export interface AnnouncementDismissalsCreate {
  id?: string;
  user: string;
  announcement: string;
}

/** The shape accepted when updating a `announcement_dismissals` record. */
export type AnnouncementDismissalsUpdate = Partial<AnnouncementDismissalsCreate>;

/** A `announcements` record as PocketBase returns it. */
export interface AnnouncementsRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  title: string;
  body: string;
  label: string;
  audience: AnnouncementsAudience;
  audience_plan: AnnouncementsAudiencePlan;
  audience_sport: AnnouncementsAudienceSport;
  hue: string;
  starts: string;
  ends: string;
  is_live: boolean;
  created: string;
  updated: string;
}

/** The shape accepted when creating a `announcements` record. */
export interface AnnouncementsCreate {
  id?: string;
  title: string;
  body?: string;
  label?: string;
  audience?: AnnouncementsAudience;
  audience_plan?: AnnouncementsAudiencePlan;
  audience_sport?: AnnouncementsAudienceSport;
  hue?: string;
  starts?: string;
  ends?: string;
  is_live?: boolean;
}

/** The shape accepted when updating a `announcements` record. */
export type AnnouncementsUpdate = Partial<AnnouncementsCreate>;

/** A `audit_log` record as PocketBase returns it. */
export interface AuditLogRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  actor: string;
  actor_kind: AuditLogActorKind;
  actor_label: string;
  action: string;
  entity: string;
  entity_id: string;
  before: unknown;
  after: unknown;
  created: string;
}

/** The shape accepted when creating a `audit_log` record. */
export interface AuditLogCreate {
  id?: string;
  actor?: string;
  actor_kind?: AuditLogActorKind;
  actor_label?: string;
  action: string;
  entity: string;
  entity_id?: string;
  before?: unknown;
  after?: unknown;
}

/** The shape accepted when updating a `audit_log` record. */
export type AuditLogUpdate = Partial<AuditLogCreate>;

/** A `challenge_log` record as PocketBase returns it. */
export interface ChallengeLogRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  user: string;
  challenge: string;
  at: string;
  created: string;
}

/** The shape accepted when creating a `challenge_log` record. */
export interface ChallengeLogCreate {
  id?: string;
  user: string;
  challenge: string;
  at?: string;
}

/** The shape accepted when updating a `challenge_log` record. */
export type ChallengeLogUpdate = Partial<ChallengeLogCreate>;

/** A `challenges` record as PocketBase returns it. */
export interface ChallengesRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  slug: string;
  sport: ChallengesSport;
  week: string;
  title: string;
  blurb: string;
  starts: string;
  ends: string;
  goal: number;
  reward: string;
  hue: string;
  riders_copy: string;
  verb: string;
  created: string;
  updated: string;
}

/** The shape accepted when creating a `challenges` record. */
export interface ChallengesCreate {
  id?: string;
  slug: string;
  sport: ChallengesSport;
  week?: string;
  title: string;
  blurb?: string;
  starts: string;
  ends: string;
  goal?: number;
  reward?: string;
  hue?: string;
  riders_copy?: string;
  verb?: string;
}

/** The shape accepted when updating a `challenges` record. */
export type ChallengesUpdate = Partial<ChallengesCreate>;

/** A `clips` record as PocketBase returns it. */
export interface ClipsRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  user: string;
  trick: string;
  at: string;
  created: string;
  updated: string;
  video_id: string;
  visibility: ClipsVisibility;
}

/** The shape accepted when creating a `clips` record. */
export interface ClipsCreate {
  id?: string;
  user: string;
  trick?: string;
  at?: string;
  video_id?: string;
  visibility?: ClipsVisibility;
}

/** The shape accepted when updating a `clips` record. */
export type ClipsUpdate = Partial<ClipsCreate>;

/** A `crew_invites` record as PocketBase returns it. */
export interface CrewInvitesRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  crew: string;
  code: string;
  created_by: string;
  expires: string;
  uses: number;
  max_uses: number;
  created: string;
}

/** The shape accepted when creating a `crew_invites` record. */
export interface CrewInvitesCreate {
  id?: string;
  crew: string;
  code: string;
  created_by?: string;
  expires?: string;
  uses?: number;
  max_uses?: number;
}

/** The shape accepted when updating a `crew_invites` record. */
export type CrewInvitesUpdate = Partial<CrewInvitesCreate>;

/** A `crew_members` record as PocketBase returns it. */
export interface CrewMembersRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  crew: string;
  user: string;
  role: CrewMembersRole;
  joined: string;
  created: string;
}

/** The shape accepted when creating a `crew_members` record. */
export interface CrewMembersCreate {
  id?: string;
  crew: string;
  user: string;
  role?: CrewMembersRole;
  joined?: string;
}

/** The shape accepted when updating a `crew_members` record. */
export type CrewMembersUpdate = Partial<CrewMembersCreate>;

/** A `crews` record as PocketBase returns it. */
export interface CrewsRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  name: string;
  slug: string;
  owner: string;
  hue: string;
  created: string;
  updated: string;
}

/** The shape accepted when creating a `crews` record. */
export interface CrewsCreate {
  id?: string;
  name: string;
  slug: string;
  owner: string;
  hue?: string;
}

/** The shape accepted when updating a `crews` record. */
export type CrewsUpdate = Partial<CrewsCreate>;

/** A `event_attendance` record as PocketBase returns it. */
export interface EventAttendanceRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  user: string;
  event: string;
  created: string;
}

/** The shape accepted when creating a `event_attendance` record. */
export interface EventAttendanceCreate {
  id?: string;
  user: string;
  event: string;
}

/** The shape accepted when updating a `event_attendance` record. */
export type EventAttendanceUpdate = Partial<EventAttendanceCreate>;

/** A `events` record as PocketBase returns it. */
export interface EventsRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  slug: string;
  name: string;
  kind: EventsKind;
  town: string;
  venue: string;
  date: string;
  sports: EventsSports[];
  level: string;
  price: string;
  spots_copy: string;
  blurb: string;
  is_live: boolean;
  created: string;
  updated: string;
  country: string;
  address: string;
  phone: string;
  source_url: string;
  lat: number;
  lng: number;
}

/** The shape accepted when creating a `events` record. */
export interface EventsCreate {
  id?: string;
  slug: string;
  name: string;
  kind?: EventsKind;
  town?: string;
  venue?: string;
  date?: string;
  sports?: EventsSports[];
  level?: string;
  price?: string;
  spots_copy?: string;
  blurb?: string;
  is_live?: boolean;
  country?: string;
  address?: string;
  phone?: string;
  source_url?: string;
  lat?: number;
  lng?: number;
}

/** The shape accepted when updating a `events` record. */
export type EventsUpdate = Partial<EventsCreate>;

/** A `guardian_consents` record as PocketBase returns it. */
export interface GuardianConsentsRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  user: string;
  guardian_email: string;
  approval_expires: string;
  requested: string;
  granted: string;
  revoked: string;
  method: GuardianConsentsMethod;
  created: string;
  updated: string;
}

/** The shape accepted when creating a `guardian_consents` record. */
export interface GuardianConsentsCreate {
  id?: string;
  user: string;
  guardian_email: string;
  approval_expires?: string;
  requested?: string;
  granted?: string;
  revoked?: string;
  method?: GuardianConsentsMethod;
}

/** The shape accepted when updating a `guardian_consents` record. */
export type GuardianConsentsUpdate = Partial<GuardianConsentsCreate>;

/** A `plans` record as PocketBase returns it. */
export interface PlansRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  slug: string;
  name: string;
  price_monthly: string;
  price_yearly: string;
  per: string;
  hue: string;
  pitch: string;
  perks: unknown;
  missing: unknown;
  popular: boolean;
  unlocks_paid_tricks: boolean;
  clip_cap_bytes: number;
  is_live: boolean;
  created: string;
  updated: string;
  includes_insights: boolean;
  includes_flair: boolean;
  video_link_cap: number;
  video_links_unlimited: boolean;
}

/** The shape accepted when creating a `plans` record. */
export interface PlansCreate {
  id?: string;
  slug: string;
  name: string;
  price_monthly?: string;
  price_yearly?: string;
  per?: string;
  hue?: string;
  pitch?: string;
  perks?: unknown;
  missing?: unknown;
  popular?: boolean;
  unlocks_paid_tricks?: boolean;
  clip_cap_bytes?: number;
  is_live?: boolean;
  includes_insights?: boolean;
  includes_flair?: boolean;
  video_link_cap?: number;
  video_links_unlimited?: boolean;
}

/** The shape accepted when updating a `plans` record. */
export type PlansUpdate = Partial<PlansCreate>;

/** A `reports` record as PocketBase returns it. */
export interface ReportsRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  reporter: string;
  reporter_email: string;
  subject_type: ReportsSubjectType;
  subject_id: string;
  reason: ReportsReason;
  detail: string;
  status: ReportsStatus;
  outcome: string;
  created: string;
  updated: string;
  complaint_of: string;
}

/** The shape accepted when creating a `reports` record. */
export interface ReportsCreate {
  id?: string;
  reporter?: string;
  reporter_email?: string;
  subject_type: ReportsSubjectType;
  subject_id?: string;
  reason?: ReportsReason;
  detail?: string;
  status?: ReportsStatus;
  outcome?: string;
  complaint_of?: string;
}

/** The shape accepted when updating a `reports` record. */
export type ReportsUpdate = Partial<ReportsCreate>;

/** A `rider_stickers` record as PocketBase returns it. */
export interface RiderStickersRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  user: string;
  sticker: string;
  earned_at: string;
  seen_at: string;
  created: string;
  updated: string;
}

/** The shape accepted when creating a `rider_stickers` record. */
export interface RiderStickersCreate {
  id?: string;
  user: string;
  sticker: string;
  earned_at?: string;
  seen_at?: string;
}

/** The shape accepted when updating a `rider_stickers` record. */
export type RiderStickersUpdate = Partial<RiderStickersCreate>;

/** A `spots` record as PocketBase returns it. */
export interface SpotsRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  name: string;
  town: string;
  type: string;
  dist: string;
  lat: number;
  lng: number;
  sports: SpotsSports[];
  tags: unknown;
  status: SpotsStatus;
  submitted_by: string;
  created: string;
  updated: string;
  address: string;
  phone: string;
  country: string;
}

/** The shape accepted when creating a `spots` record. */
export interface SpotsCreate {
  id?: string;
  name: string;
  town?: string;
  type?: string;
  dist?: string;
  lat?: number;
  lng?: number;
  sports?: SpotsSports[];
  tags?: unknown;
  status?: SpotsStatus;
  submitted_by?: string;
  address?: string;
  phone?: string;
  country?: string;
}

/** The shape accepted when updating a `spots` record. */
export type SpotsUpdate = Partial<SpotsCreate>;

/** A `stickers` record as PocketBase returns it. */
export interface StickersRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  slug: string;
  name: string;
  sport: StickersSport;
  hue: string;
  ico: string;
  cond: string;
  n: number;
  is_live: boolean;
  created: string;
  updated: string;
}

/** The shape accepted when creating a `stickers` record. */
export interface StickersCreate {
  id?: string;
  slug: string;
  name: string;
  sport?: StickersSport;
  hue?: string;
  ico?: string;
  cond?: string;
  n?: number;
  is_live?: boolean;
}

/** The shape accepted when updating a `stickers` record. */
export type StickersUpdate = Partial<StickersCreate>;

/** A `subscriptions` record as PocketBase returns it. */
export interface SubscriptionsRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  user: string;
  plan: string;
  source: SubscriptionsSource;
  status: SubscriptionsStatus;
  external_id: string;
  period_end: string;
  created: string;
  updated: string;
  payer_kind: SubscriptionsPayerKind;
  payer_adult_confirmed: boolean;
  checkout_ref: string;
}

/** The shape accepted when creating a `subscriptions` record. */
export interface SubscriptionsCreate {
  id?: string;
  user: string;
  plan: string;
  source?: SubscriptionsSource;
  status?: SubscriptionsStatus;
  external_id?: string;
  period_end?: string;
  payer_kind?: SubscriptionsPayerKind;
  payer_adult_confirmed?: boolean;
  checkout_ref?: string;
}

/** The shape accepted when updating a `subscriptions` record. */
export type SubscriptionsUpdate = Partial<SubscriptionsCreate>;

/** A `trick_log` record as PocketBase returns it. */
export interface TrickLogRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  user: string;
  trick: string;
  stage: TrickLogStage;
  at: string;
  estimated: boolean;
  created: string;
}

/** The shape accepted when creating a `trick_log` record. */
export interface TrickLogCreate {
  id?: string;
  user: string;
  trick: string;
  stage: TrickLogStage;
  at?: string;
  estimated?: boolean;
}

/** The shape accepted when updating a `trick_log` record. */
export type TrickLogUpdate = Partial<TrickLogCreate>;

/** A `trick_notes` record as PocketBase returns it. */
export interface TrickNotesRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  user: string;
  trick: string;
  body: string;
  created: string;
  updated: string;
}

/** The shape accepted when creating a `trick_notes` record. */
export interface TrickNotesCreate {
  id?: string;
  user: string;
  trick: string;
  body?: string;
}

/** The shape accepted when updating a `trick_notes` record. */
export type TrickNotesUpdate = Partial<TrickNotesCreate>;

/** A `trick_prereqs` record as PocketBase returns it. */
export interface TrickPrereqsRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  trick: string;
  prereq: string;
  created: string;
}

/** The shape accepted when creating a `trick_prereqs` record. */
export interface TrickPrereqsCreate {
  id?: string;
  trick: string;
  prereq: string;
}

/** The shape accepted when updating a `trick_prereqs` record. */
export type TrickPrereqsUpdate = Partial<TrickPrereqsCreate>;

/** A `trick_progress` record as PocketBase returns it. */
export interface TrickProgressRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  user: string;
  trick: string;
  stage: TrickProgressStage;
  created: string;
  updated: string;
}

/** The shape accepted when creating a `trick_progress` record. */
export interface TrickProgressCreate {
  id?: string;
  user: string;
  trick: string;
  stage: TrickProgressStage;
}

/** The shape accepted when updating a `trick_progress` record. */
export type TrickProgressUpdate = Partial<TrickProgressCreate>;

/** A `tricks` record as PocketBase returns it. */
export interface TricksRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  slug: string;
  name: string;
  sport: TricksSport;
  cat: TricksCat;
  diff: number;
  about: string;
  tips: string;
  fact: string;
  free_override: TricksFreeOverride;
  is_live: boolean;
  created: string;
  updated: string;
}

/** The shape accepted when creating a `tricks` record. */
export interface TricksCreate {
  id?: string;
  slug: string;
  name: string;
  sport: TricksSport;
  cat: TricksCat;
  diff: number;
  about?: string;
  tips?: string;
  fact?: string;
  free_override?: TricksFreeOverride;
  is_live?: boolean;
}

/** The shape accepted when updating a `tricks` record. */
export type TricksUpdate = Partial<TricksCreate>;

/** A `users` record as PocketBase returns it. */
export interface UsersRecord {
  collectionId: string;
  collectionName: string;
  id: string;
  email: string;
  emailVisibility: boolean;
  verified: boolean;
  name: string;
  avatar: string;
  created: string;
  updated: string;
  handle: string;
  town: string;
  stance: UsersStance;
  level: UsersLevel;
  goal: string;
  goal_custom: string;
  avatar_key: string;
  privacy: UsersPrivacy;
  sports: UsersSports[];
  streak: number;
  last_ride: string;
  timezone: string;
  role: UsersRole;
  plan: UsersPlan;
  onboarded: boolean;
  suspended: boolean;
  age_band: UsersAgeBand;
  band_next_change_on: string;
  age_declared_at: string;
  country: string;
  consent_state: UsersConsentState;
  week_start: string;
  rides_this_week: number;
  last_qualifying_week: string;
  insights_opt_in: boolean;
  anonymised_at: string;
}

/** The shape accepted when creating a `users` record. */
export interface UsersCreate {
  id?: string;
  name?: string;
  avatar?: string;
  handle?: string;
  town?: string;
  stance?: UsersStance;
  level?: UsersLevel;
  goal?: string;
  goal_custom?: string;
  avatar_key?: string;
  privacy?: UsersPrivacy;
  sports?: UsersSports[];
  streak?: number;
  last_ride?: string;
  timezone?: string;
  role?: UsersRole;
  plan?: UsersPlan;
  onboarded?: boolean;
  suspended?: boolean;
  age_band?: UsersAgeBand;
  band_next_change_on?: string;
  age_declared_at?: string;
  country?: string;
  consent_state?: UsersConsentState;
  week_start?: string;
  rides_this_week?: number;
  last_qualifying_week?: string;
  insights_opt_in?: boolean;
  anonymised_at?: string;
}

/** The shape accepted when updating a `users` record. */
export type UsersUpdate = Partial<UsersCreate>;

/** Collection name to the record it holds. */
export interface CollectionRecords {
  announcement_dismissals: AnnouncementDismissalsRecord;
  announcements: AnnouncementsRecord;
  audit_log: AuditLogRecord;
  challenge_log: ChallengeLogRecord;
  challenges: ChallengesRecord;
  clips: ClipsRecord;
  crew_invites: CrewInvitesRecord;
  crew_members: CrewMembersRecord;
  crews: CrewsRecord;
  event_attendance: EventAttendanceRecord;
  events: EventsRecord;
  guardian_consents: GuardianConsentsRecord;
  plans: PlansRecord;
  reports: ReportsRecord;
  rider_stickers: RiderStickersRecord;
  spots: SpotsRecord;
  stickers: StickersRecord;
  subscriptions: SubscriptionsRecord;
  trick_log: TrickLogRecord;
  trick_notes: TrickNotesRecord;
  trick_prereqs: TrickPrereqsRecord;
  trick_progress: TrickProgressRecord;
  tricks: TricksRecord;
  users: UsersRecord;
}

/** Collection name to the shape its create accepts. */
export interface CollectionCreates {
  announcement_dismissals: AnnouncementDismissalsCreate;
  announcements: AnnouncementsCreate;
  audit_log: AuditLogCreate;
  challenge_log: ChallengeLogCreate;
  challenges: ChallengesCreate;
  clips: ClipsCreate;
  crew_invites: CrewInvitesCreate;
  crew_members: CrewMembersCreate;
  crews: CrewsCreate;
  event_attendance: EventAttendanceCreate;
  events: EventsCreate;
  guardian_consents: GuardianConsentsCreate;
  plans: PlansCreate;
  reports: ReportsCreate;
  rider_stickers: RiderStickersCreate;
  spots: SpotsCreate;
  stickers: StickersCreate;
  subscriptions: SubscriptionsCreate;
  trick_log: TrickLogCreate;
  trick_notes: TrickNotesCreate;
  trick_prereqs: TrickPrereqsCreate;
  trick_progress: TrickProgressCreate;
  tricks: TricksCreate;
  users: UsersCreate;
}

/** Collection name to the shape its update accepts. */
export interface CollectionUpdates {
  announcement_dismissals: AnnouncementDismissalsUpdate;
  announcements: AnnouncementsUpdate;
  audit_log: AuditLogUpdate;
  challenge_log: ChallengeLogUpdate;
  challenges: ChallengesUpdate;
  clips: ClipsUpdate;
  crew_invites: CrewInvitesUpdate;
  crew_members: CrewMembersUpdate;
  crews: CrewsUpdate;
  event_attendance: EventAttendanceUpdate;
  events: EventsUpdate;
  guardian_consents: GuardianConsentsUpdate;
  plans: PlansUpdate;
  reports: ReportsUpdate;
  rider_stickers: RiderStickersUpdate;
  spots: SpotsUpdate;
  stickers: StickersUpdate;
  subscriptions: SubscriptionsUpdate;
  trick_log: TrickLogUpdate;
  trick_notes: TrickNotesUpdate;
  trick_prereqs: TrickPrereqsUpdate;
  trick_progress: TrickProgressUpdate;
  tricks: TricksUpdate;
  users: UsersUpdate;
}
