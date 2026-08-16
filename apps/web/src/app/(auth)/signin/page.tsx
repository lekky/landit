import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

import { AuthCard } from '../AuthCard';

import { SignInForm } from './SignInForm';

export const metadata: Metadata = {
  title: 'Sign in · Land It',
  description: 'Pick up where you left off.',
};

export default async function SignInPage() {
  if (await currentRider()) redirect(ROUTES.account);

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
      <SignInForm />
    </AuthCard>
  );
}
