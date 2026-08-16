import type { Metadata } from 'next';
import Link from 'next/link';

import { ROUTES } from '@/lib/routes';

import { AuthCard } from '../AuthCard';

import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Set a new password · Land It',
  description: 'Pick something you have not used anywhere else.',
};

/**
 * Where the reset email lands.
 *
 * PocketBase's own template links to `/reset-password?token=…` once the app URL
 * is set in its settings, so the token arrives in the query. It is read here and
 * posted back in the form body rather than being acted on by the visit itself.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;

  return (
    <AuthCard
      title="New password"
      lede="Pick something you have not used anywhere else"
      footer={
        <>
          Changed your mind? <Link href={ROUTES.signIn}>Sign in</Link>
        </>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
