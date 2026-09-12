import { afterEach, describe, expect, it, vi } from 'vitest';

import { runAction, runActionOr } from './runAction';

/**
 * `runAction` exists so that a Server Function which *throws* is reported to
 * the rider instead of vanishing, and these are the assertions that keep it
 * that way. Two of them are the bug itself, written down: a thrown action must
 * come back as a refusal, and this module must never throw — a call site that
 * gets an exception here is a call site back to losing writes silently.
 *
 * `analyticsClient` is mocked rather than imported. Its own header says not to
 * pull it into a test: `posthog-js` reaches for `window` when it loads, and
 * these run in node. The mock is also what lets the last test assert on the
 * *properties* — which is the privacy claim, not a detail.
 */
const capture = vi.hoisted(() => vi.fn());

vi.mock('./analyticsClient', () => ({
  capture,
  ANALYTICS_EVENTS: { requestFailed: 'request_failed' },
}));

afterEach(() => {
  capture.mockClear();
  vi.unstubAllGlobals();
});

describe('an action that answers', () => {
  it('hands back a success untouched', async () => {
    const result = await runAction('trick_stage', async () => ({ ok: true, earned: ['x'] }));

    expect(result).toEqual({ ok: true, earned: ['x'] });
  });

  /*
   * The distinction the whole design rests on. A paywall or a cap saying no is
   * the product working: the server answered, the screen already shows the
   * rider a sentence, and folding it in with lost writes would bury the number
   * `request_failed` exists to produce.
   */
  it('hands back a refusal untouched, and does not count it as a failure', async () => {
    const result = await runAction('trick_stage', async () => ({
      ok: false,
      message: 'This one is on the Shredder plan, so it cannot be tracked yet.',
    }));

    expect(result).toEqual({
      ok: false,
      message: 'This one is on the Shredder plan, so it cannot be tracked yet.',
    });
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('an action that throws', () => {
  const throwing = () => Promise.reject(new Error('Failed to fetch'));

  it('comes back as a refusal rather than throwing', async () => {
    const result = await runAction('trick_stage', throwing);

    // The point of the whole module: `ok: false` reaches the call site, so the
    // `if (result.ok)` there reverts the optimistic value and toasts, exactly
    // as it does when the server refuses.
    expect(result.ok).toBe(false);
    expect((result as { message: string }).message).toBe(
      'That did not save. Try again in a moment.',
    );
  });

  it('says it was the signal when the browser knows it was', async () => {
    vi.stubGlobal('navigator', { onLine: false });

    const result = await runAction('trick_stage', throwing);

    expect((result as { message: string }).message).toBe(
      'No signal, so that did not save. Try again when you are back online.',
    );
    // It must tell the rider to come back and do it again, and must not
    // promise to catch up on its own — nothing is queued (plan §2.3).
    expect((result as { message: string }).message).toMatch(/try again/i);
    expect((result as { message: string }).message).not.toMatch(
      /queued?|automatically|catch up|will save|saved when/i,
    );
  });

  it('builds the caller’s own failure shape through runActionOr', async () => {
    const result = await runActionOr('ride_logged', throwing, (message) => ({ error: message }));

    expect(result).toEqual({ error: 'That did not save. Try again in a moment.' });
  });

  /**
   * The privacy claim, and the reason this assertion is on the properties
   * rather than on the call. A thrown Server Function carries a stack, a digest
   * and a URL; none of that belongs in a counter on a product used by children,
   * and the catalogue rule in `analytics.ts` is catalogue facts only. Three
   * fixed strings are the whole of what travels.
   */
  it('counts the failure with three fixed strings and nothing else', async () => {
    vi.stubGlobal('navigator', { onLine: true });

    await runAction('note_add', () => Promise.reject(new Error('secret-looking/stack/trace')));

    expect(capture).toHaveBeenCalledTimes(1);

    // Pinned as an exhaustive shape rather than a "does not contain" search:
    // three keys, and three values that came from this repository rather than
    // from the thrown object. Nothing the error carried can reach any of them.
    const [event, properties] = capture.mock.calls[0] as [string, Record<string, unknown>];
    expect(event).toBe('request_failed');
    expect(Object.keys(properties).sort()).toEqual(['kind', 'reason', 'request']);
    expect(properties).toEqual({ request: 'note_add', kind: 'write', reason: 'error' });
  });
});

/**
 * The spots screen fetches through Server Functions too, and a thrown read left
 * the same silence — a list that had simply stopped. Same translation, but a
 * lost read must not be counted as a lost write: `kind` is the property the
 * sharp finding is filtered on, and it is derived here rather than passed in so
 * a call site cannot mislabel one.
 */
describe('a read that throws', () => {
  it('says load rather than save, and is counted as a read', async () => {
    const result = await runActionOr(
      'spots_page',
      () => Promise.reject(new Error('Failed to fetch')),
      (error) => ({ error }),
    );

    expect(result).toEqual({ error: 'That could not load. Try again in a moment.' });
    expect(capture).toHaveBeenCalledWith('request_failed', {
      request: 'spots_page',
      kind: 'read',
      reason: 'error',
    });
  });

  it('says load rather than save when the signal is gone as well', async () => {
    vi.stubGlobal('navigator', { onLine: false });

    const result = (await runActionOr(
      'spots_cards',
      () => Promise.reject(new Error('Failed to fetch')),
      (error) => ({ error }),
    )) as { error: string };

    expect(result.error).toBe(
      'No signal, so that could not load. Try again when you are back online.',
    );
    expect(result.error).not.toMatch(/save/i);
  });
});
