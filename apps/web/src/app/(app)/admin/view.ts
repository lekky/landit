import { approvalExpired, HEARD_ABOUT, isConsentLimited, type TrickMistake } from '@landit/core';
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
 * **The guardian's address, added 2026-09-12, is on the sheet under the same
 * rule and for a stronger reason.** It is not the rider's address at all: it
 * belongs to an adult with no account here, typed into a form by a child. It
 * goes where the rider's own address goes — see `GuardianConsentView` — and the
 * table carries the consent *state* only, as a tag, which is a fact about the
 * account rather than about a third party.
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
  /** The account column's tag — see `riderStatus`. */
  readonly status: AdminRiderStatus;
  /** The signed-in staff member's own row, which they may not act on. */
  readonly isMe: boolean;
}

export type AdminRiderStatus = 'ok' | 'suspended' | 'pending' | 'revoked';

/**
 * The account column's tag, for one rider.
 *
 * **`revoked` is a tag of its own, and that is the whole point of this
 * function.** Until 2026-09-12 the table asked `consent_state === 'pending'`
 * and called everything else `ok`, so a rider whose guardian had actively
 * withdrawn consent showed the same green tag as an open account — while being
 * exactly as locked out of crews, invites, events, spots and subscriptions as a
 * rider still waiting for a first answer (`CONSENT_LIMITED_DENIES`). Staff had
 * nowhere to see it: the sheet did not carry consent state either. A parent who
 * had said no was, on the only screen staff read, indistinguishable from a
 * parent who had said yes.
 *
 * So the question it asks is `isConsentLimited`, which is core's own list of
 * the states that hold an account behind the gate, rather than a string test
 * that has to be remembered when a fifth state is added. `pending` and
 * `revoked` are then told apart for the label, because they need different
 * things from staff — one is waiting on a guardian who may never have seen the
 * email, the other is a decision that has been made.
 *
 * Neither is a moderation flag: `suspended` is the only staff action here, and
 * it wins, because a suspended account is shut whatever its guardian thinks.
 */
export function riderStatus(rider: {
  readonly suspended?: boolean;
  readonly consent_state?: string;
}): AdminRiderStatus {
  if (rider.suspended) return 'suspended';
  if (!isConsentLimited(rider.consent_state)) return 'ok';
  return rider.consent_state === 'revoked' ? 'revoked' : 'pending';
}

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
 * The most recent time this rider asked a guardian, as the sheet shows it.
 *
 * **The address is on the sheet and never on the row**, for the reason the head
 * of this file gives about the rider's own email and then some: this one
 * belongs to an adult with no account here, who was typed into a form by a
 * child. A column of it would put every listed guardian's address in the page
 * source of a table nobody had opened. Fetched per rider, so the page carries
 * the address of the one being looked at and of nobody else. (Placement and
 * showing it unmasked: owner's call, 2026-09-12, in chat — staff need it to
 * recognise an inbound support mail from a parent, which a masked address
 * cannot do.)
 *
 * **It describes the row, not the account.** `guardian_consents` is evidence
 * and `90_consent.pb.js` writes a new record per request rather than editing
 * the last, so a rider can have several — and the newest is not always the one
 * the account's state rests on, if a rider asked a second guardian after the
 * first had already answered. Every field here is therefore read off that one
 * record's own timestamps, and the sheet labels the block as the latest
 * request. The account's actual standing is the `consent_state` tag, which is
 * rendered beside it from a different source and can legitimately disagree.
 */
export interface GuardianConsentView {
  /** The address the rider gave. Lower-cased by the hook that stored it. */
  readonly email: string;
  /** "Approved", "Withdrawn", "Waiting on a reply", "Link expired". */
  readonly standing: string;
  readonly standingColor: string;
  /** "1 Sep 2026" — when the rider asked. */
  readonly requested: string;
  /**
   * When the guardian answered, pre-formatted, or `null` if they have not.
   * Separate from `requested` because the gap between the two is the thing
   * staff are usually looking at.
   */
  readonly answered: string | null;
}

/**
 * What the latest guardian request currently says, as a label and a colour.
 *
 * The order is the point. A record carries three independent stamps and more
 * than one can be set at once — a guardian who approved in September and
 * withdrew in October leaves both `granted` and `revoked` on the same row,
 * because the revocation link never expires and revoking does not erase the
 * grant it undoes. Read grant-first, that row says "Approved" forever. So
 * `revoked` is tested first: the last thing a guardian did is what staff need
 * to see, and reading it in the other order would show a withdrawn consent as a
 * live one on the one screen anybody would check.
 *
 * Expiry is only asked about a record nobody has answered, which is why it
 * comes third rather than first: an approval link that ran out after it was
 * used is not a fact about anything.
 */
export function guardianStanding(
  record: {
    readonly granted?: string;
    readonly revoked?: string;
    readonly approval_expires?: string;
  },
  now: Date,
): { readonly standing: string; readonly standingColor: string } {
  if (record.revoked) return { standing: 'Withdrawn', standingColor: 'var(--orange)' };
  if (record.granted) return { standing: 'Approved', standingColor: 'var(--green)' };
  if (approvalExpired(record.approval_expires, now)) {
    // Not a dead end, and the label should not read like one: the rider can
    // always ask for a fresh link, and the revocation link in the email that
    // has already gone out never expires at all (§6.2).
    return { standing: 'Link expired', standingColor: 'var(--ink-3)' };
  }
  return { standing: 'Waiting on a reply', standingColor: 'var(--yellow)' };
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
  /**
   * The rider's most recent guardian request, or `null` if they have never
   * made one — which is every account the gate has never applied to.
   */
  readonly guardian: GuardianConsentView | null;
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
  /**
   * The staff-picked tutorial (T35). All three empty when nobody has picked
   * one, which is the normal state for most of the library.
   *
   * The id rather than a URL, because that is what is stored; the editor shows
   * it back as a watch link so a staff member can press it and check they are
   * looking at the video they think they are.
   */
  readonly videoId: string;
  readonly videoTitle: string;
  readonly videoChannel: string;
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
  /*
   * Whether it is under a roof, and whether it is still standing — the second
   * being a different question from `status` above, which is only whether staff
   * have let the row onto the map. `operating` is a plain string rather than the
   * narrowed union because it arrives from a select field and is validated
   * server-side, in `spotPatch`, where every other field from that form is.
   */
  readonly indoor: boolean;
  readonly operating: string;
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

export type AdminSuggestionStatus = 'new' | 'reviewing' | 'accepted' | 'declined';

/**
 * One idea, as the Ideas tab draws it.
 *
 * Shorter than `AdminReportRow` by exactly the fields that exist to protect
 * somebody: there is no subject, no reporter and no appeal, because a
 * suggestion is about the website rather than about a person. The rider who
 * sent it is not carried at all — staff are judging the idea, and whose it was
 * is not part of that.
 *
 * `note` is the one field that travels back out to a rider: it is shown to
 * whoever sent the idea, on their own row, which the `suggestions` view rule
 * limits to them.
 */
export interface AdminSuggestionRow {
  readonly id: string;
  readonly status: AdminSuggestionStatus;
  readonly topic: string;
  readonly topicLabel: string;
  readonly detail: string;
  readonly note: string;
  readonly sent: string;
  readonly updated: string;
}

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
