import type { Metadata } from 'next';
import Link from 'next/link';

import { ROUTES } from '@/lib/routes';

import { AuthCard } from '../AuthCard';

import { ForgotPasswordForm } from './ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Forgotten password · Land It',
  description: 'We will email you a link to set a new one.',
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgotten it?"
      lede="We will email you a link to set a new one"
      footer={
        <>
          Remembered? <Link href={ROUTES.signIn}>Sign in</Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
