import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { ROUTES, signInHref } from '@/lib/routes';
import { currentRider, type RiderSession } from '@/lib/session';

/**
 * The rider, read once for the whole account render.
 *
 * `/account` is a layout **and** a page now (the list beside the panel), and
 * both need the rider record: the layout to write the rows' current values, the
 * page to fill the panel. Called twice that would be two `refreshAuth` round
 * trips per screen where the old single page made one, which is a cost the
 * rethink has no business adding to the one screen it is tidying.
 *
 * `cache` is React's per-request memo, so layout and page share the answer and
 * nothing is held between requests — the token is still re-checked against the
 * server on every navigation, which is what `currentRider`'s own note says has
 * to keep happening for a suspended account to stop working immediately.
 */
export const accountSession = cache(currentRider);

/**
 * The signed-in, onboarded rider for one of the account's screens — or a
 * redirect.
 *
 * `returnTo` is the screen being asked for, so a rider who followed a link to
 * "who can see your profile" while signed out arrives back at it rather than on
 * the dashboard (issue #66). `/account` itself keeps the plain `/signin` it has
 * always redirected to; the deep screens are the ones a link can point at.
 */
export async function requireAccountRider(returnTo?: Route): Promise<RiderSession> {
  const session = await accountSession();
  if (!session) redirect(returnTo ? signInHref(returnTo) : ROUTES.signIn);
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);
  return session;
}
