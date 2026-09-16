import type { Metadata } from 'next';

import { AppShell } from '@/components/shell/AppShell';

import { ShellPreview } from './preview';

/**
 * `/design/shell` — the app shell, with something inside it.
 *
 * A reference sheet like `/design`, and for the same reason: the shell is a
 * T5 deliverable but the screens that will live inside it are T7 onwards, so
 * without this page there is nothing to look at and nothing for a test to
 * drive. It is not in the navigation, nothing links to it, and it is kept out
 * of search results.
 *
 * It passes a sample rider so the top bar's sport chip, Log, bell and avatar can be
 * checked. There is no auth here — T6 supplies the real one.
 *
 * `?staff=1` draws the same shell with the sample rider marked as staff, which
 * is the only way to see the account menu's admin row without a staff account:
 * the real flag comes from `users.role` through `app/(app)/layout.tsx`, and
 * nothing on this page is gated, so the row here is a drawing of a link and not
 * a way into `/admin` — `requireStaff` still answers that, on the server, with
 * a 404 for everybody else. It is what `e2e/shell.spec.ts` drives.
 */
export const metadata: Metadata = {
  title: 'App shell · Land The Trick',
  description: 'The rider app frame, with the toast and modal hosts live.',
  robots: { index: false, follow: false },
};

export default async function ShellPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string; rider?: string }>;
}) {
  const params = await searchParams;
  const staff = params.staff === '1';
  /*
   * `?rider=0` draws the shell with nobody signed in.
   *
   * The signed-out frame is real — `/spots`, `/events`, `/library`, `/plans`
   * and `/report` all read without an account — and it is a different bar: the
   * top bar's right-hand end is a Sign in button, and the bottom bar's middle
   * cell is a link to sign in rather than the LOG sheet. There was no way to
   * see or drive it on this sheet, which is how a signed-out visitor came to be
   * offered a sheet whose every option dead-ended.
   */
  const signedOut = params.rider === '0';

  return (
    <AppShell rider={signedOut ? undefined : { name: 'Miles', avatarId: 'helmet-land', staff }}>
      <ShellPreview />
    </AppShell>
  );
}
