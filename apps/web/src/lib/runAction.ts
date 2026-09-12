'use client';

import { ANALYTICS_EVENTS, capture } from './analyticsClient';

/**
 * Call a Server Function and turn a **thrown** one into the refusal it should
 * have been.
 *
 * ## The bug this exists for
 *
 * Every write in this app follows the same shape: move the UI optimistically,
 * await the action, and put the UI back if the server says no.
 *
 * ```ts
 * setCurrent(next);
 * startTransition(async () => {
 *   const result = await setStageAction({ ... });
 *   if (result.ok) { toast('Saved'); return; }
 *   setCurrent(previous);              // ← the revert
 *   toast(result.message, 'var(--red)');
 * });
 * ```
 *
 * That handles `ok: false` — a paywall, a cap, a signed-out session — because
 * the action *returned* it. It does not handle the action **throwing**, and
 * when it throws, neither of the last two lines runs: the optimistic value
 * stands, no toast appears, and the write is gone. The rider is looking at a
 * screen that says the change was made. They find out days later that it was
 * not, which is exactly how "Stop tracking doesn't seem to save all the time"
 * was reported (owner, 2026-09-12, in chat).
 *
 * Nothing about that is unlikely on this product:
 *
 * - **No signal.** A trick page is cacheable offline (`isCacheablePage` allows
 *   `/library/<slug>`), so a rider at a park with no route to anywhere can be
 *   reading a real page from disk. The service worker never touches a non-GET,
 *   and Next's action queueing is deliberately off — §2.3 says logging needs
 *   signal — so the POST throws. `OfflineBanner` already predicted this in
 *   prose: *"the first thing a rider learns about the limit is a stage change
 *   that failed"*. It was never true, because nothing said it failed.
 * - **A dropped request** — a phone moving between cell and wifi mid-POST.
 * - **A stale bundle.** Deploys here are manual (`docs/infrastructure.md`), so
 *   a page left open overnight can POST a Server Function id the running
 *   server no longer knows.
 *
 * There is no `error.tsx` in this app, so an error escaping a transition does
 * not land anywhere useful either.
 *
 * ## What it does
 *
 * Wraps the call, so a throw comes back as `{ ok: false, message }` in the same
 * shape the action itself uses — every existing `if (result.ok)` branch then
 * reverts and toasts on its own, without a line of it changing:
 *
 * ```ts
 * const result = await runAction('trick_stage', () => setStageAction({ ... }));
 * ```
 *
 * It never throws, so a call site cannot go back to losing writes silently by
 * forgetting a `catch`.
 *
 * **Reads use it too.** The spots screen fetches its pages, its map points and
 * its cards through Server Functions, and each already has a `setError` path
 * for a refusal that a throw skipped in exactly the same way — leaving a screen
 * that has simply stopped, with nothing said. Same translation, different
 * wording (`MESSAGES` below), and `kind` on the event keeps a lost read from
 * being counted as a lost write.
 */

/**
 * Which call failed, as a fixed string chosen here.
 *
 * This is the `request` property on `request_failed`, so the rule in
 * `analytics.ts` applies to it: **catalogue facts, never rider facts.** These
 * name a *kind of call* — the same value for every rider who makes one — and
 * nothing about what was sent or who sent it. Add a name here when a screen
 * starts using `runAction`; the union is what stops a call site inventing a
 * spelling that quietly splits the count in two.
 *
 * Writes first, then the reads. A lost write is the sharp one — a rider
 * believing something saved that did not — and `kind` below is what keeps the
 * two countable apart.
 */
export type RequestName =
  /* -------------------------------------------------------- the loop -- */
  | 'trick_stage'
  | 'note_add'
  | 'note_update'
  | 'note_remove'
  | 'challenge_log'
  | 'ride_logged'
  /* ------------------------------------------------------- content -- */
  | 'video_add'
  | 'video_visibility'
  | 'video_remove'
  | 'spot_submit'
  | 'event_attendance'
  /* ------------------------------------------------------- account -- */
  | 'profile_save'
  | 'crew_invite'
  /* --------------------------------------------------------- staff -- */
  | 'admin_save'
  /* ------------------------------------- reads a screen waits on -- */
  | 'admin_read'
  | 'spots_page'
  | 'spots_points'
  | 'spots_cards';

/**
 * Whether losing this call lost something a rider wrote, or only something a
 * screen was going to show them. Everything above is a write except the four
 * names listed here, and it is derived rather than passed in so that a call
 * site cannot mislabel one — `kind` is what the sharp finding is filtered on.
 */
const READS: ReadonlySet<RequestName> = new Set<RequestName>([
  'admin_read',
  'spots_page',
  'spots_points',
  'spots_cards',
]);

/**
 * The shape every action in this app refuses with, and the shape a throw is
 * translated into. `ok: false` with a sentence a fourteen year old can read.
 */
export interface WriteFailed {
  readonly ok: false;
  readonly message: string;
}

/**
 * Why it failed, as far as the browser can tell.
 *
 * Only two answers, because only two lead anywhere different: `offline` is the
 * rider's signal and resolves itself, `error` is ours and does not. Both are
 * fixed strings chosen here.
 */
type Reason = 'offline' | 'error';

/**
 * The four sentences, by what was lost and whose fault it was.
 *
 * "No signal" echoes `OfflineBanner`, which is the phrase this product already
 * uses for the condition; a second wording for the same thing is a second thing
 * a rider has to work out. None of them may promise to catch up — nothing is
 * queued (plan §2.3), so every one of them asks the rider to come back and do
 * it again. And a read says "load" where a write says "save", because "that did
 * not save" about a list nobody was saving is the kind of sentence that makes a
 * rider go looking for what they broke.
 */
const MESSAGES = {
  write: {
    offline: 'No signal, so that did not save. Try again when you are back online.',
    // Ours, not theirs — deliberately the sentence the actions already use.
    error: 'That did not save. Try again in a moment.',
  },
  read: {
    offline: 'No signal, so that could not load. Try again when you are back online.',
    error: 'That could not load. Try again in a moment.',
  },
} as const;

/**
 * `navigator.onLine` reports the network *interface*, so a phone on a park's
 * wifi that routes nowhere says it is online — the same lie `OfflineBanner`
 * documents. That only costs a wrong `reason` and the more generic of two
 * messages, and the write is reported as failed either way, so it is not worth
 * the round trip to do better. Guarded for the server, where there is no
 * `navigator` at all.
 */
function reasonFor(): Reason {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  return 'error';
}

/**
 * Run a Server Function; hand back its result, or build a failure if it threw.
 *
 * The general form, for the call sites that report a failure as something other
 * than `{ ok: false, message }` — `{ error }` on the weekly streak, the
 * challenge log, event attendance and the profile panel, and the spots screen's
 * reads. `failed` turns the sentence into whatever shape that call site already
 * handles, so the branch below it does not change.
 *
 * `request` names the call for `request_failed` and nothing else. The event
 * fires only on a throw, because a refusal the server *returned* is the paywall
 * or a cap doing its job, and is already counted where it happens.
 */
export async function runActionOr<T>(
  request: RequestName,
  call: () => Promise<T>,
  failed: (message: string) => T,
): Promise<T> {
  try {
    return await call();
  } catch {
    // The error itself is deliberately not read and never sent. It is a
    // framework or transport object — a stack, a digest, a URL — and none of
    // that belongs in a counter on a product used by children. That it
    // happened, and which of two kinds it was, is the whole of what is useful.
    const reason = reasonFor();
    const kind = READS.has(request) ? 'read' : 'write';
    capture(ANALYTICS_EVENTS.requestFailed, { request, kind, reason });
    return failed(MESSAGES[kind][reason]);
  }
}

/**
 * The same thing for the shape nearly every action in this app already uses:
 * `{ ok: true, ... }` or `{ ok: false, message }`. A throw comes back as the
 * refusal it should have been, so the `if (result.ok)` at the call site does
 * the reverting and the toasting exactly as it does for a server-side no.
 */
export async function runAction<T extends { readonly ok: boolean }>(
  request: RequestName,
  call: () => Promise<T>,
): Promise<T | WriteFailed> {
  return runActionOr<T | WriteFailed>(request, call, (message) => ({ ok: false, message }));
}
