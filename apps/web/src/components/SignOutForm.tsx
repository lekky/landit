'use client';

import type { ReactNode } from 'react';

import { signOutAction } from '@/app/(auth)/actions';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

/**
 * The sign-out form, wherever it appears — the account screen, the staff portal
 * (§6.8), and the menu the top bar's avatar opens.
 *
 * It exists because the first two are **server** components, and a server
 * component cannot carry an `onSubmit`. The alternatives were worse: making
 * either page a client component would ship it to the browser for the sake of
 * one counter, and leaving sign-out uncounted would put a hole in the middle of
 * a session funnel. The account menu is a client component already and could
 * have posted its own form, but then `signed_out` would be fired from two
 * places and only one of them would be here when somebody changed what it
 * carries.
 *
 * The button is passed in rather than rendered here, because the three call
 * sites style it differently and this is a wrapper, not a redesign. `where`
 * tells them apart; it is a fixed string, not a rider fact.
 */
export function SignOutForm({
  where,
  children,
}: {
  where: 'account' | 'admin' | 'account-menu';
  children: ReactNode;
}) {
  return (
    <form action={signOutAction} onSubmit={() => capture(ANALYTICS_EVENTS.signedOut, { where })}>
      {children}
    </form>
  );
}
