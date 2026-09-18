import type {
  DayKey,
  SessionQuotaStatus,
  SessionVisibilityId,
  SportId,
  StageId,
} from '@landit/core';

import type { SessionFormValues, SessionOpenSource } from '@/lib/sessionForm';

/**
 * What the server hands the session form (T38). Plain data only, so it crosses
 * the server/client boundary as it is, and every date in it is already a
 * finished string (LESSONS §3a).
 */

/** A spot the form can name. Its point is the spot's, never the rider's. */
export interface FormSpot {
  readonly id: string;
  readonly name: string;
  readonly town: string;
  readonly lat: number;
  readonly lng: number;
}

/** A trick the rider can tick. Locked tricks for their plan are left out. */
export interface FormTrick {
  /** The record id — what `session_tricks.trick` holds. */
  readonly id: string;
  readonly name: string;
  readonly sport: SportId;
  readonly stage: StageId | null;
  /** The day of the rider's latest log entry for it, for "since 25 Aug". */
  readonly sinceDay: DayKey | null;
}

/** A crew-mate the rider can tag: from the crew board, so consent-cleared and open. */
export interface FormMate {
  readonly id: string;
  readonly name: string;
  readonly avatarKey: string;
}

export interface FormEvent {
  readonly id: string;
  readonly name: string;
  readonly date: string;
  /** Where it is, for the picker's second line: "Rampworx · Liverpool". */
  readonly venue: string;
  readonly town: string;
  readonly lat: number;
  readonly lng: number;
}

export interface SessionFormData {
  readonly mode: 'new' | 'edit';
  /** The session being edited. */
  readonly sessionId: string | null;
  /** Open on the quick log (`?quick=1`) rather than the full form. */
  readonly quick: boolean;
  /** `session_log_opened`'s `source`. Unused in edit mode. */
  readonly source: SessionOpenSource;
  /** "Sun 13 Sep · 16:20" — now, on the rider's clock. */
  readonly stamp: string;
  /** Edit mode's header date: "Saturday 12 September 2026". */
  readonly dateTitle: string;
  readonly today: DayKey;
  /** The rider's zone, for checking a picked time on submit. Never formatted with in render. */
  readonly timezone: string;
  readonly initial: SessionFormValues;
  /**
   * `initial.sport` was decided by the link the rider arrived on — an event's
   * sport, or a trick's — rather than merely defaulted to their first (T50).
   *
   * The form's sport now follows the top bar's chip (rethink §3.10, D5), which
   * only the browser knows; this says when it must not. A rider who taps "Log a
   * session" from a skateboard trick's page means skateboard, whatever the chip
   * says, and a session saved against the wrong sport drops the trick they came
   * to log (`TricksField` filters by `values.sport`). Always `false` in edit
   * mode, where the saved sport is the rider's own answer and nothing overrides
   * it.
   */
  readonly sportFromLink: boolean;
  /** Trick entries that already moved a stage, and where to: "Most times". Edit mode. */
  readonly promoted: readonly { readonly trickId: string; readonly label: string }[];
  readonly sports: readonly SportId[];
  /** Every spot the form already knows: recent ones, and the prefilled or saved one. */
  readonly spots: readonly FormSpot[];
  /** The rider's three most recent spots, newest first. */
  readonly recentSpotIds: readonly string[];
  /**
   * Live events the session could have been at: today and the thirty days
   * behind it (`EVENT_PICKER_DAYS_BACK`), plus the one a link named or the one
   * attached to the session being edited, whatever its date.
   */
  readonly events: readonly FormEvent[];
  readonly tricks: readonly FormTrick[];
  readonly mates: readonly FormMate[];
  /** The plan slug — a catalogue fact, for `session_quota_wall_seen` and `session_grace_used`. */
  readonly plan: string;
  /** "Rookie". */
  readonly planName: string;
  /** Where the rider stands this month. `null` in edit mode, where it does not apply. */
  readonly quota: SessionQuotaStatus | null;
  /** "1 Oct", and how many days away. */
  readonly resets: { readonly label: string; readonly daysAway: number };
  readonly clip: {
    /** The plan holds session clips at all — `sessionClipAllowance`, never a plan id. */
    readonly allowed: boolean;
    /** Clips left, or `null` when unlimited. */
    readonly remaining: number | null;
  };
  /** The plan the wall sells: its name and monthly price, from the plan record. */
  readonly upgrade: { readonly name: string; readonly price: string } | null;
  readonly visibilityDefault: SessionVisibilityId;
  /** What the delete confirm names, in edit mode. */
  readonly deleteInfo: { readonly spotName: string; readonly dateLabel: string } | null;
}
