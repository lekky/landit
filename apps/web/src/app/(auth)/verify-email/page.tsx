import type { Metadata } from 'next';
import Link from 'next/link';

import { ROUTES } from '@/lib/routes';

import { AuthCard } from '../AuthCard';

import { VerifyEmailForm } from './VerifyEmailForm';

export const metadata: Metadata = {
  title: 'Confirm your email · Land The Trick',
  description: 'One press, and your account can be recovered if you lose your password.',
};

/**
 * Where the confirmation email lands.
 *
 * **The visit does not confirm anything — the press does.** The token arrives in
 * the query and goes into a form, exactly as `/reset-password` and the two
 * guardian-consent links do, because mail scanners follow links in an inbox and
 * a link that acted on GET would be actioned by a spam filter rather than by the
 * rider (plan §6.2).
 *
 * PocketBase's own template does not point here and setting the app URL does not
 * make it: its stock body links to the admin UI at
 * `{APP_URL}/_/#/auth/confirm-verification/{TOKEN}`. `pocketbase/templates/verify-email.html`
 * is the replacement, pasted onto the users collection — see that directory's
 * README and `docs/infrastructure.md` runbook 6.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;

  return (
    <AuthCard
      title="Confirm your email"
      lede="So we can get you back in if you lose your password"
      footer={
        <>
          Not what you were after? <Link href={ROUTES.dashboard}>Back to riding</Link>
        </>
      }
    >
      <VerifyEmailForm token={token} />
    </AuthCard>
  );
}
