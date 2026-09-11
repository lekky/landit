'use client';

import { useEffect, useState } from 'react';

import type { AnalyticsEvent } from '@/lib/analytics';
import type { AuthForm } from '@/lib/authRefusal';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import type { AuthFormState } from './actions';

/**
 * What the auth forms do with the answer the server last gave them (issue #370).
 */

/**
 * Count a refusal: `auth_refused`, with which form and why, and the form's own
 * event with `outcome: 'failed'` beside it.
 *
 * **Once per answer, keyed on the state object.** `useActionState` hands back a
 * new object every time an action settles and the same one on every other
 * render, so the object itself is the "this is new" signal. The auth forms used
 * `useFailureCapture` (`lib/analyticsClient.ts`) until now, which keys on the
 * message text instead — and so did two things this does not. It never fired
 * for a refusal under a field, so a rider turned away for a short name counted
 * as a success in `signed_up`'s attempted-minus-failed; and it fired once for
 * two identical refusals in a row, so a rider who pressed a dead link twice
 * counted once. Both were small overcounts of success, which is the direction
 * a funnel should never be wrong in.
 *
 * What travels is the form and the reason, both fixed strings — never the
 * message, never what was typed.
 */
export function useRefusalCapture(
  form: AuthForm,
  state: AuthFormState | undefined,
  failed?: AnalyticsEvent,
): void {
  useEffect(() => {
    const reason = state?.refused;
    if (!reason) return;
    capture(ANALYTICS_EVENTS.authRefused, { form, reason });
    if (failed) capture(failed, { outcome: 'failed' });
  }, [form, state, failed]);
}

/**
 * The message under each field: the last answer's, until the rider changes
 * that field.
 *
 * An error that stays on screen after the rider has fixed the thing it names
 * reads as the fix not having worked. So each field remembers which answer it
 * was last edited under, and its error hides while that is still the answer on
 * screen — then comes back, if it is still true, when the next one arrives.
 * Remembering the answer rather than a flag is what makes the reset free: no
 * effect has to clear anything when a new answer lands.
 *
 * Field errors only. The line above the button (`form`) stays until the next
 * press, because it is about the attempt as a whole rather than one field.
 */
export function useFieldErrors(state: AuthFormState | undefined): {
  errorFor: (field: string) => string | undefined;
  edited: (field: string) => void;
} {
  const [editedUnder, setEditedUnder] = useState<
    Readonly<Record<string, AuthFormState | undefined>>
  >({});
  const errors = state?.errors ?? {};

  return {
    errorFor: (field) =>
      field in editedUnder && editedUnder[field] === state ? undefined : errors[field],
    edited: (field) =>
      setEditedUnder((previous) =>
        field in previous && previous[field] === state ? previous : { ...previous, [field]: state },
      ),
  };
}
