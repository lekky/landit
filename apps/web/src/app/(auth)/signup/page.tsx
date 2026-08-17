import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ROUTES, legalHref } from '@/lib/routes';
import { currentRider } from '@/lib/session';

import { AuthCard } from '../AuthCard';

import { SignUpForm } from './SignUpForm';

export const metadata: Metadata = {
  title: 'Make an account · Land The Trick',
  description: 'Free tier, no card, keeps everything.',
};

export default async function SignUpPage() {
  if (await currentRider()) redirect(ROUTES.dashboard);

  return (
    <AuthCard
      title="Make an account"
      lede="Free tier, no card, keeps everything"
      footer={
        <>
          Already riding? <Link href={ROUTES.signIn}>Sign in</Link>
        </>
      }
      footnote={
        // The pack said "Under 16? Ask a parent. They can hold the account with
        // a Crew Pass." Both halves are gone: the Crew Pass was dropped (§2.4),
        // and we state no minimum age at all (§6.2). What replaces it is true.
        <>
          Riders of any age are welcome. If you are under the age your country sets, we will ask for
          a parent or carer&rsquo;s email and they decide.
          <br />
          <Link href={legalHref('privacy')}>Privacy</Link> ·{' '}
          <Link href={legalHref('terms')}>Terms</Link> ·{' '}
          <Link href={legalHref('safeguarding')}>Safeguarding</Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
