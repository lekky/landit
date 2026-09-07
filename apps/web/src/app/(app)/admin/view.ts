import { HEARD_ABOUT, type TrickMistake } from '@landit/core';
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
  /**
   * When the rider last *used* Land The Trick: "40 min ago", "Yesterday",
   * "3 days ago", "18 Aug 2026", "—".
   *
   * `users.last_seen`, stamped by the server whenever a session authenticates
   * or refreshes — not `last_ride`, which is the day a rider tapped "I rode
   * today" and which this column showed, under the heading "Last active", until
   * 2026-09-07. The two answer different questions and can be months apart: a
   * rider who opens the app nightly and never taps that button read as an
   * account nobody had touched. The ride figure is still held, on the sheet.
   */
  readonly seen: string;
  /** True when `seen` is today, which the table colours differently. */
  readonly seenToday: boolean;
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
  /**
   * A second line under the bar — "3 on a paid plan".
   *
   * Optional, and absent means absent rather than zero: the "how riders found
   * us" panel withholds this line below a threshold, and a bar that printed
   * "0 on a paid plan" where the truth is "too few riders to say" would be
   * reporting a suppression as a finding.
   */
  readonly sub?: string;
}

/* --------------------------------------------------- how riders found us -- */

/**
 * How many riders must have picked an option before its paid share is shown.
 *
 * **Ten, set by the owner on 2026-09-06 in chat**, when the panel was asked for
 * (issue #323). The *count* is always shown; it is the **split** that is
 * withheld, because a bar reading "1 rider, 1 on a paid plan" beside the Riders
 * tab is two facts about one identifiable child on a service used by children.
 * A staff screen is not a public one, but "only staff can see it" is the
 * argument that ends with a portal that quietly knows everything, and the
 * number costs nothing to respect.
 *
 * Raising it is safe. Lowering it is a decision for the owner, not a tidy-up.
 */
export const PAID_SHARE_FLOOR = 10;

/** The date the question started being asked, for the panel's own note. */
const HEARD_ABOUT_SINCE = '6 September 2026';

export interface HeardAboutPanel {
  readonly bars: readonly AdminBar[];
  readonly note: string;
  /** The denominator the bars are drawn against — riders who answered. */
  readonly of: number;
}

export interface HeardAboutCounts {
  readonly total: number;
  readonly answered: number;
  readonly byOption: Readonly<Record<string, number>>;
  readonly paidByOption: Readonly<Record<string, number>>;
}

/**
 * The "How riders found us" panel, built where it can be tested (§323).
 *
 * Three decisions live in here rather than in the page, because each one is a
 * judgement that could be quietly reversed by an edit that still rendered:
 *
 * 1. **The denominator is riders who answered**, not every rider. The question
 *    is asked once, at the end of onboarding, so every account older than it
 *    will never be asked — drawing nine slivers against a giant unanswered bar
 *    would report the rollout rather than the channels.
 * 2. **A bar below `PAID_SHARE_FLOOR` gets no `sub` at all**, rather than one
 *    reading "0 on a paid plan". Printing a zero there would report a
 *    suppression as a finding, which is worse than saying nothing.
 * 3. **Every option draws a bar**, including the ones nobody picked, because
 *    "nothing came from TikTok" is a finding and a chart that omitted it would
 *    read as though the option was never offered.
 */
export function heardAboutPanel(counts: HeardAboutCounts): HeardAboutPanel {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const bars: AdminBar[] = HEARD_ABOUT.map((option) => {
    const count = counts.byOption[option.id] ?? 0;
    return {
      label: option.label,
      count,
      // One colour for all nine, on purpose. The plan and sport panels colour
      // their bars because those colours mean something everywhere else in the
      // product; there is no colour language for a channel, and inventing one
      // would make nine arbitrary hues look like categories somebody decided on.
      color: 'var(--mint)',
      ...(count >= PAID_SHARE_FLOOR
        ? { sub: `${counts.paidByOption[option.id] ?? 0} on a paid plan` }
        : {}),
    };
  });

  const unanswered = Math.max(0, counts.total - counts.answered);
  const note =
    counts.answered === 0
      ? `Nobody has answered yet. The question was added on ${HEARD_ABOUT_SINCE} and is asked once, at the end of onboarding, so only accounts made since then are ever asked.`
      : `Shares are of the ${plural(counts.answered, 'rider who has', 'riders who have')} answered. ` +
        `${plural(unanswered, 'rider has', 'riders have')} not — the question is asked once, at the end of onboarding, so an account made before ${HEARD_ABOUT_SINCE} was never asked. ` +
        `A paid split is shown only where at least ${PAID_SHARE_FLOOR} riders picked an option.`;

  return { bars, note, of: counts.answered };
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
  /** `users.last_seen`, pre-formatted. "Never" for an account never seen. */
  readonly seen: string;
  /**
   * `users.last_ride`, pre-formatted — the last day the rider tapped "I rode
   * today". It shares the sheet with `seen` rather than the table, which has
   * room for one activity column and shows the one that means "used the app".
   * A rider whose ride stamp is old and whose session stamp is fresh is not a
   * dormant account; they are one that does not use that button.
   */
  readonly lastRide: string;
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
  /**
   * Whether the viewer may delete this account permanently.
   *
   * Computed on the server per sheet, never inferred in the browser: the
   * owner-only rule lives on the deploy (`LANDIT_OWNER_ID`) and a client has no
   * way to know it. False for everybody but the owner, and false for the
   * owner's own row. It decides whether the button *renders*; the action
   * re-checks the same rule, because a hidden button is not a gate.
   */
  readonly canDelete: boolean;
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
  /** Why the trick sits at its tier (T28). Empty when not written yet. */
  readonly hard: string;
  /** The common mistakes (T28), already read through `tricksFromRecords`, so malformed is empty. */
  readonly mistakes: readonly TrickMistake[];
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
