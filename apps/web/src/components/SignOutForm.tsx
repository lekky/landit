'use client';

import type { ReactNode } from 'react';

import { signOutAction } from '@/app/(auth)/actions';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

/**
 * The sign-out form, wherever it appears — the account screen and the staff
 * portal (§6.8).
 *
 * It exists because both of those are **server** components, and a server
 * component cannot carry an `onSubmit`. The alternatives were worse: making
 * either page a client component would ship it to the browser for the sake of
 * one counter, and leaving sign-out uncounted would put a hole in the middle of
 * a session funnel.
 *
 * The button is passed in rather than rendered here, because the two call sites
 * style it differently and this is a wrapper, not a redesign. `where` tells the
 * two apart; it is a fixed string, not a rider fact.
 */
export function SignOutForm({
  where,
  children,
}: {
  where: 'account' | 'admin';
  children: ReactNode;
}) {
  return (
    <form action={signOutAction} onSubmit={() => capture(ANALYTICS_EVENTS.signedOut, { where })}>
      {children}
    </form>
  );
}
