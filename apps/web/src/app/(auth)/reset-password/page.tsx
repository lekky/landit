import type { Metadata } from 'next';
import Link from 'next/link';

import { ROUTES } from '@/lib/routes';

import { AuthCard } from '../AuthCard';

import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Set a new password · Land The Trick',
  description: 'Pick something you have not used anywhere else.',
};

/**
 * Where the reset email lands.
 *
 * The token arrives in the query, is read here and posted back in the form body
 * rather than being acted on by the visit itself.
 *
 * **PocketBase's default template does not link here, and setting the app URL
 * does not make it.** Its stock body points at PocketBase's *own* admin UI —
 * `{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}` — so pointing `APP_URL` at
 * the web app produces a 404 on `/_` and a rider who cannot reset their
 * password (observed on the live instance, 2026-08-18). The template itself has
 * to be edited, on the users collection, to `{APP_URL}/reset-password?token={TOKEN}`.
 * That is instance configuration and lives in the settings database, not in this
 * repository — `docs/infrastructure.md` runbook 6 carries it.
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
