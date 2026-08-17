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
