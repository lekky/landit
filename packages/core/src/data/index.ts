/**
 * The canonical data.
 *
 * Everything here is transcribed from the design pack in `design-handoff/`
 * (except the plans, where the implementation plan overrides it — see
 * `plans.ts`). It is the **single source** for two consumers that must never
 * disagree: the PocketBase seed scripts (T4) and the fixtures the rules are
 * tested against. Each record already carries the fields its collection needs,
 * so a seed script can hand a record straight to PocketBase.
 *
 * Nothing here is behaviour. The rules that read these records live in
 * `../rules`.
 */

export { AVATARS, AVATAR_GROUPS, type AvatarId } from './avatars';
export { CATS, CATEGORY_IDS, TIERS_LABEL, categoryLabel } from './categories';
export { CONTACT, CONTACT_ADDRESSES, DOMAIN, SITE_URL } from './contact';
export {
  COUNTRIES,
  COUNTRY_CODES,
  COUNTRY_SUGGESTIONS,
  DEFAULT_COUNTRY,
  countryName,
  countryOptions,
} from './countries';
export { CHALLENGES, type ChallengeId } from './challenges';
export { EVENTS, type EventId } from './events';
export { PLAN, PLAN_IDS, PLANS } from './plans';
export {
  CUSTOM_GOAL_ID,
  CUSTOM_GOAL_MAX_LENGTH,
  DEFAULT_PRIVACY,
  GOALS,
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  HANDLE_PATTERN,
  LEVELS,
  PRIVACY,
  RESERVED_HANDLES,
  STANCES,
} from './profile';
export { SPORT_IDS, SPORTS } from './sports';
export { SPOTS } from './spots';
export { LANDED_STAGES, STAGE, STAGE_IDS, STAGES } from './stages';
export { STICKERS, type StickerId } from './stickers';
export { TRICK_PREREQS, TRICKS, type TrickId } from './tricks';
