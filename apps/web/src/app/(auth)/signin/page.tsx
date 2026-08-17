import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ROUTES, safeReturnTo } from '@/lib/routes';
import { currentRider } from '@/lib/session';

import { AuthCard } from '../AuthCard';

import { SignInForm } from './SignInForm';

export const metadata: Metadata = {
  title: 'Sign in · Land The Trick',
  description: 'Pick up where you left off.',
};

/**
 * Sign in, and land back where the rider was going (issue #66).
 *
 * Until T11 this always redirected to `/home`, so a gated link — an invite, a
 * mate's profile — dropped whoever followed it on the dashboard with no trace
 * of what they had clicked. `next` carries the path across the form and
 * `safeReturnTo` refuses anything that is not a same-site absolute path, so the
 * parameter cannot be turned into an open redirect by whoever wrote the link.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeReturnTo((await searchParams).next);
  if (await currentRider()) redirect(next);

  return (
    <AuthCard
      title="Welcome back"
      lede="Pick up where you left off"
      footer={
        <>
          New here? <Link href={ROUTES.signUp}>Make an account</Link>
        </>
      }
      footnote={<Link href={ROUTES.forgotPassword}>Forgotten your password?</Link>}
    >
      <SignInForm next={next} />
    </AuthCard>
  );
}
