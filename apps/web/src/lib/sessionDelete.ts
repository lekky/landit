/**
 * The words on the delete-a-session confirm (T36), as data.
 *
 * Here rather than inside `DeleteSessionDialog` for the reason `rules/streak.ts`
 * keeps the streak card's words in `@landit/core`: they are a decision, not
 * decoration, and this app's unit tests may only reach `src/lib` (see
 * `vitest.config.ts`). The decision is the one the design makes and the plan
 * records: **deleting a session never takes back a stage** it moved, and the
 * confirm has to say so before the rider presses the button.
 *
 * Copy from the session-tracking handoff's delete modal, verbatim apart from
 * the session's own name and date, which the caller passes pre-formatted from
 * the server (LESSONS §3a — no locale formatting on both sides of a hydration
 * boundary).
 */

export interface DeleteSessionCopy {
  readonly title: string;
  /** "Adrenaline Alley on 12 Sep goes for good." */
  readonly lead: string;
  readonly body: string;
  /** The bold half of the body. */
  readonly keeps: string;
  readonly keepsTail: string;
  readonly cancel: string;
  readonly confirm: string;
  readonly working: string;
  readonly failed: string;
}

export function deleteSessionCopy(session: {
  spotName: string;
  dateLabel: string;
}): DeleteSessionCopy {
  const spot = session.spotName.trim() || 'This session';
  const on = session.dateLabel.trim();
  return {
    title: 'Delete this session?',
    lead: on ? `${spot} on ${on} goes for good.` : `${spot} goes for good.`,
    body: 'It comes off your month and off the spot.',
    keeps: 'Tricks you moved up stay where they are',
    keepsTail: ' — a stage you earned is not undone by tidying your log.',
    cancel: 'Keep it',
    confirm: 'Delete session',
    working: 'Deleting…',
    failed: 'That session did not delete. Try again in a moment.',
  };
}
