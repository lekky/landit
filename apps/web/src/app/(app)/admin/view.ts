import type { SportLook } from '@landit/ui-web';

/**
 * Everything the portal renders, computed on the server.
 *
 * The same split every screen in this app uses (`crew/view.ts`, `home/view.ts`)
 * and for a reason that is sharper here than anywhere else: the riders table is
 * a client component, so whatever these types carry is what gets serialised
 * into the page and shipped to a browser. That makes this file a statement
 * about what a staff screen may know about a rider, and the two fields added on
 * 2026-08-18 were weighed against that rather than assumed (owner's call, in
 * chat).
 *
 * **Age band travels with the row; email does not.** T16 carried neither, on
 * the grounds that moving a plan and suspending an account need neither. The
 * band earns its place because it is the fact behind the Account column's
 * GUARDIAN tag — staff were reading the consequence with no way to see the
 * cause — and it is a bucket of four, not a birth date, so a row carrying it
 * leaks nothing sharper than the tag beside it already did. Email is different
 * in kind: it identifies a child off the platform, and a table of forty rows is
 * forty addresses in the page source whether or not anyone reads them. It
 * therefore lives on `RiderSheetView` alone, which is fetched per rider when
 * staff open one, so the page carries the address of the rider being looked at
 * and of nobody else. `country` and the consent token stay off both.
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
  /** "Under 13", "13–15", "16–17", "Adult", "—". Pre-formatted; see `AGE_BAND_LABEL`. */
  readonly ageBand: string;
  readonly plan: string;
  /** `ok` | `suspended` | `pending` — the account column's tag. */
  readonly status: AdminRiderStatus;
  /** The signed-in staff member's own row, which they may not act on. */
  readonly isMe: boolean;
}

export type AdminRiderStatus = 'ok' | 'suspended' | 'pending';

/**
 * How the four age bands read on a staff screen.
 *
 * **These are bands, and the labels say so.** There is no date of birth in the
 * database and there never was: the browser works the band out at sign-up and
 * throws the date away (plan §3/§6.2, `bandForAge` in `@landit/core`). A column
 * headed "Age" showing "14" would be inventing precision we deliberately do not
 * collect, so the column is headed "Age band" and shows the bucket.
 *
 * Keyed loosely rather than by `AgeBand` because the column is also what an
 * account with the field unset renders, and a `Record<AgeBand, string>` has no
 * key for that — `bandLabel` maps anything it does not know to an em dash.
 */
const AGE_BAND_LABEL: Readonly<Record<string, string>> = {
  under_13: 'Under 13',
  '13_15': '13–15',
  '16_17': '16–17',
  adult: 'Adult',
};

/** The band's label, or an em dash for an account that has never declared one. */
export function bandLabel(band: string | undefined | null): string {
  return (band && AGE_BAND_LABEL[band]) || '—';
}

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
  /**
   * The address the account signed up with.
   *
   * On the sheet and never on the row — see the head of this file. Empty
   * string for an account with no address on it rather than `null`, so the
   * sheet renders one dash instead of branching.
   */
  readonly email: string;
  /** "Under 13", "13–15", "16–17", "Adult", "—". */
  readonly ageBand: string;
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
  readonly country: string;
  readonly address: string;
  readonly phone: string;
  readonly sourceUrl: string;
  /** As a string, because the editor's inputs are strings and blank means unset. */
  readonly lat: string;
  readonly lng: string;
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
