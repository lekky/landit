import type { SportLook } from '@landit/ui-web';

/**
 * Everything the portal renders, computed on the server.
 *
 * The same split every screen in this app uses (`crew/view.ts`, `home/view.ts`)
 * and for a reason that is sharper here than anywhere else: the riders table is
 * a client component, so whatever these types carry is what gets serialised
 * into the page and shipped to a browser. That makes this file a statement
 * about what a staff screen may know about a rider, and it deliberately carries
 * no email, no town, no age band and no consent token — none of which the two
 * jobs on this screen (move a plan, suspend an account) need.
 *
 * Dates arrive pre-formatted for the same reason they do on every other screen:
 * `toLocaleDateString` disagrees between Node and the browser and takes the
 * whole tree down with it (LESSONS §3a).
 */

export interface AdminRiderRow {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly avatarKey: string | null;
  readonly sports: readonly SportLook[];
  /** Tricks taken to a landed stage. */
  readonly landed: number;
  /** "Mar 2026". */
  readonly joined: string;
  /** "Today", "Yesterday", "3 days", "—". */
  readonly active: string;
  /** True when `active` is today, which the table colours differently. */
  readonly activeToday: boolean;
  readonly plan: string;
  /** `ok` | `suspended` | `pending` — the account column's tag. */
  readonly status: AdminRiderStatus;
  /** The signed-in staff member's own row, which they may not act on. */
  readonly isMe: boolean;
}

export type AdminRiderStatus = 'ok' | 'suspended' | 'pending';

export interface AdminPlanOption {
  readonly slug: string;
  readonly name: string;
  readonly hue: string;
}

export interface AdminStatCard {
  readonly label: string;
  /** Pre-formatted. `null` renders the em dash placeholder. */
  readonly value: string | null;
  readonly sub: string;
  readonly hue?: string;
}

export interface AdminBar {
  readonly label: string;
  readonly count: number;
  readonly color: string;
}

export interface AdminAttentionRow {
  readonly label: string;
  /** Lit when there is something to do. */
  readonly on: boolean;
}

export interface TrackedTrickView {
  readonly id: string;
  readonly name: string;
  readonly sport: SportLook | null;
  /** The stage's short label — "EVERY", "SOME". */
  readonly stage: string;
  readonly stageColor: string;
  readonly landed: boolean;
}

/**
 * One rider, opened from the table.
 *
 * Loaded on demand rather than with the page: the table shows forty riders and
 * this is a per-rider read, so fetching every sheet up front would be forty
 * progress queries to render one modal nobody may open.
 */
export interface RiderSheetView {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly avatarKey: string | null;
  readonly joined: string;
  readonly active: string;
  readonly plan: string;
  readonly planName: string;
  readonly planHue: string;
  readonly suspended: boolean;
  readonly sports: readonly SportLook[];
  readonly tracked: readonly TrackedTrickView[];
  readonly landed: number;
  readonly clips: number;
}

export interface AdminActivityRow {
  readonly id: string;
  /** "Miles moved a rider onto Shredder" — written by the product, not typed. */
  readonly line: string;
  readonly who: string;
  /** "16 Aug, 14:02". */
  readonly when: string;
}

/* ------------------------------------------------------- content tabs -- */

/**
 * T17's seven content tabs and the moderation queue.
 *
 * Same rule as the rider rows above, and it bites hardest on the last one: a
 * report carries a stranger's typing and, when they left one, their email
 * address. `AdminReportRow` therefore ships the email — a moderator has to be
 * able to reply to a complaint, which is the whole point of the OSA route
 * (plan §6.1/§6.5) — and nothing else about anybody. The *subject* of a report
 * is an id and a type, never a resolved profile: staff open the rider from the
 * Riders tab if they need one, so a moderation screen cannot become a way to
 * read a child's account by reporting them.
 */

/** Which tier a trick sits on, and whether staff said so or the difficulty did. */
export type TrickTier = 'free' | 'paid' | 'inherit';

export interface AdminTrickRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly sport: string;
  readonly cat: string;
  readonly catLabel: string;
  readonly catColor: string;
  readonly diff: number;
  readonly tierLabel: string;
  /** Prerequisite trick names, already resolved. "Nothing" when there are none. */
  readonly buildsOn: string;
  /** `free_override`, as the three states the column actually has. */
  readonly tier: TrickTier;
  /** What the paywall makes of it once the default is applied. */
  readonly effectivelyFree: boolean;
  readonly isLive: boolean;
  readonly about: string;
  readonly tips: string;
}

export interface AdminStickerRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly hue: string;
  readonly sport: SportLook | null;
  /** The condition line with the threshold folded in. */
  readonly condition: string;
  readonly cond: string;
  /** `null` where the rule counts nothing and there is no threshold to tune. */
  readonly threshold: number | null;
  readonly isLive: boolean;
  /**
   * False when no rule in `@landit/core` is keyed to this slug — the record
   * exists, and no rider can ever earn it.
   */
  readonly hasRule: boolean;
}

export type AdminSpotStatus = 'pending' | 'live' | 'rejected';

export interface AdminSpotRow {
  readonly id: string;
  readonly name: string;
  readonly town: string;
  readonly type: string;
  readonly tags: readonly string[];
  readonly sports: readonly string[];
  readonly sportLooks: readonly SportLook[];
  readonly status: AdminSpotStatus;
  readonly lat: number;
  readonly lng: number;
  /** Empty when nobody submitted it — a staff-published spot has no submitter. */
  readonly submittedBy: string;
  readonly submitted: string;
}

export interface AdminEventRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly kind: string;
  readonly kindColor: string;
  /** "5 Sep". */
  readonly when: string;
  /** `YYYY-MM-DD`, for the editor. */
  readonly date: string;
  readonly town: string;
  readonly venue: string;
  readonly level: string;
  readonly price: string;
  readonly spotsCopy: string;
  readonly blurb: string;
  readonly sports: readonly string[];
  readonly sportLooks: readonly SportLook[];
  readonly isLive: boolean;
  readonly attending: number;
}

export type AdminChallengeState = 'live' | 'upcoming' | 'past';

export interface AdminChallengeRow {
  readonly id: string;
  readonly slug: string;
  readonly sport: string;
  readonly week: string;
  readonly title: string;
  readonly blurb: string;
  /** "7–13 Sep". */
  readonly range: string;
  readonly starts: string;
  readonly ends: string;
  readonly goal: number;
  readonly reward: string;
  readonly hue: string;
  readonly ridersCopy: string;
  readonly verb: string;
  readonly state: AdminChallengeState;
  /** How many rider log entries a delete would take with it. */
  readonly logged: number;
}

export interface AdminNoticeRow {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly label: string;
  readonly hue: string;
  /** "Everyone", "Scooter riders", "Shredder". */
  readonly audienceLabel: string;
  readonly isLive: boolean;
  readonly posted: string;
  readonly dismissals: number;
}

export interface AdminPlanCard {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly hue: string;
  readonly priceMonthly: string;
  readonly priceYearly: string;
  readonly per: string;
  readonly pitch: string;
  readonly perks: readonly string[];
  readonly missing: readonly string[];
  readonly isLive: boolean;
  readonly unlocksPaidTricks: boolean;
  readonly riders: number;
}

export type AdminReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';

export interface AdminReportRow {
  readonly id: string;
  readonly status: AdminReportStatus;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly reason: string;
  readonly reasonLabel: string;
  readonly detail: string;
  readonly outcome: string;
  /** Empty when the report came from a signed-in rider with no address given. */
  readonly reporterEmail: string;
  /** True when a signed-in rider filed it, without saying which one. */
  readonly fromRider: boolean;
  /** The report this one appeals, if any. */
  readonly complaintOf: string;
  readonly filed: string;
  readonly updated: string;
}
