import {
  sessionClipAllowanceLabel,
  sessionsPerMonthLabel,
  sessionsPerMonthPerk,
  type SessionAllowance,
} from '@landit/core';

/**
 * "What each plan logs" — the session comparison on `/plans` (T40, screenshots
 * 1g and 2e of the session-tracking handoff).
 *
 * **Every allowance in it is rendered, never typed.** The two numbers that
 * differ between plans — sessions a month and session clip links — come off the
 * `plans` records the page already reads, through `sessionsPerMonthLabel` and
 * `sessionClipAllowanceLabel` in `@landit/core`. That is the rule
 * `packages/core/src/data/plans.ts` sets for the plan cards, for the same
 * reason: a comparison typed out beside the hook is one staff retune away from
 * advertising a cap nobody enforces. The rows that say the same thing on every
 * plan ("Yes", "All of it", "Always") carry no number and are owner's decisions
 * D5 and D6 (plan §1, 2026-09-13): the detail, the history and the stage moves
 * are free on every tier.
 *
 * **Two deliberate differences from the design**, both recorded under T40 in
 * the plan:
 *
 * - **No "Session insights" row.** The design gives Legend "Best days, best
 *   length, spots that move you up", and nothing in the product computes any of
 *   it. A paid line for a feature that does not exist is the defect "Exclusive
 *   avatar drops" was removed for (`plans.ts`), on a page with a live checkout.
 * - **The clip cell is the derived label** ("10 clip links"), not the design's
 *   unnumbered "Video links, private until you say otherwise", so Shredder's
 *   tunable cap is on the page the moment it is on the record.
 *
 * Pure, so it is unit-tested here rather than through a browser (the web
 * package's `vitest` include is `src/lib` for exactly this).
 */

/** One plan as the comparison needs it, already resolved from its record. */
export interface SessionPlanInput {
  readonly slug: string;
  readonly name: string;
  readonly hue: string;
  /** The head's price line: "Free", "£3.99 / mo". */
  readonly price: string;
  readonly sessions: SessionAllowance;
  readonly clips: SessionAllowance;
}

/** How a cell reads: bold, ordinary, greyed, or the green "Always". */
export type SessionPlanTone = 'strong' | 'plain' | 'muted' | 'always';

export interface SessionPlanCell {
  /** The desktop table's words. */
  readonly text: string;
  /** The phone card's words, where they differ from the table's. */
  readonly phoneText: string;
  readonly tone: SessionPlanTone;
}

export type SessionPlanRowId = 'sessions' | 'detail' | 'clips' | 'history' | 'stage_moves';

export interface SessionPlanRow {
  readonly id: SessionPlanRowId;
  /** The desktop row header. */
  readonly label: string;
  /** The phone card's shorter label. */
  readonly phoneLabel: string;
  /** One per plan, in the order the plans were given. */
  readonly cells: readonly SessionPlanCell[];
}

export interface SessionPlanColumn {
  readonly slug: string;
  readonly name: string;
  readonly hue: string;
  readonly price: string;
}

export interface SessionPlanComparison {
  readonly columns: readonly SessionPlanColumn[];
  readonly rows: readonly SessionPlanRow[];
}

function same(text: string, tone: SessionPlanTone, phoneText = text): SessionPlanCell {
  return { text, phoneText, tone };
}

/** "Four a month", "Unlimited" — straight from the record. */
function sessionsCell(allowance: SessionAllowance): SessionPlanCell {
  const text = sessionsPerMonthLabel(allowance);
  return same(text, allowance.unlimited || allowance.cap > 0 ? 'strong' : 'muted');
}

/**
 * "None" where the plan holds no clip links, as the design has it, and the
 * derived label otherwise. `sessionClipAllowanceLabel` says "No clip links" for
 * a zero, which under a "Clip links" header reads twice; "None" says the same
 * with no number to drift, because the number is zero.
 */
function clipsCell(allowance: SessionAllowance): SessionPlanCell {
  if (!allowance.unlimited && allowance.cap === 0) return same('None', 'muted');
  return same(sessionClipAllowanceLabel(allowance), 'plain');
}

export function sessionPlanComparison(plans: readonly SessionPlanInput[]): SessionPlanComparison {
  const each = (cell: (plan: SessionPlanInput) => SessionPlanCell) => plans.map(cell);

  return {
    columns: plans.map(({ slug, name, hue, price }) => ({ slug, name, hue, price })),
    rows: [
      {
        id: 'sessions',
        label: 'Sessions logged',
        phoneLabel: 'Sessions',
        cells: each((plan) => sessionsCell(plan.sessions)),
      },
      {
        id: 'detail',
        label: 'Spot, event, tricks, notes',
        phoneLabel: 'The detail',
        cells: each(() => same('Yes', 'plain', 'Spot, event, tricks, aim, notes')),
      },
      {
        id: 'clips',
        label: 'Clip links',
        phoneLabel: 'Clip links',
        cells: each((plan) => clipsCell(plan.clips)),
      },
      {
        id: 'history',
        label: 'History you can open',
        phoneLabel: 'History',
        cells: each(() => same('All of it', 'plain')),
      },
      {
        id: 'stage_moves',
        label: 'Stage moves from a session',
        phoneLabel: 'Stage moves',
        cells: each(() => same('Always', 'always')),
      },
    ],
  };
}

/* ------------------------------------------------- the card perk line ---- */

/**
 * The session lines a **plan card** carries, appended to the perks the `plans`
 * record holds (#507, owner's decisions of 2026-09-14, in chat).
 *
 * **Derived here rather than written into the record**, which is the whole of
 * the decision and the reason this is a function and not a migration. Three
 * things follow from it, and each one is why an alternative was rejected:
 *
 * - **It cannot drift from the cap the hook enforces.** A literal "Four
 *   sessions a month" in a `plans` row is one staff retune of
 *   `session_month_cap` away from advertising a number nobody enforces — the
 *   defect `plans.ts` and `sessionPlanComparison` above both exist to prevent,
 *   on the one page in the product with a live Stripe checkout behind it.
 * - **It follows the sessions rollout automatically.** The caller passes the
 *   same `sessionsEnabledFor` answer that gates the comparison table and every
 *   other session surface, so while sessions are in owner-only preview the
 *   cards say nothing about them, and `LANDIT_SESSIONS_OPEN=1` turns the lines
 *   on with the screens. Copy written into the rows by a migration would appear
 *   at the next deploy whether or not the flag went with it.
 * - **No card says "clip".** The allowance of session clip links is deliberately
 *   *not* on the cards: it stays in the comparison table below, where the "Clip
 *   links" header gives it the context a lone bullet cannot. That keeps plan
 *   §6.6's rule — nothing on a card may suggest we host video — intact rather
 *   than narrowed, and `data.test.ts` and `video.test.ts` keep holding it.
 *   `noHostingLanguage` in this file's tests holds the same line here.
 *
 * Returns the lines to **append**, never a replacement: the record's own perks
 * are staff-editable and this adds to them.
 */
export function sessionCardPerks(sessions: SessionAllowance): readonly string[] {
  const line = sessionsPerMonthPerk(sessions);
  return line === null ? [] : [line];
}
