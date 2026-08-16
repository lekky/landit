import { CONTACT } from '@landit/core';
import { previewConsentLink, type ConsentLinkPreview } from '@landit/db';
import { Panel } from '@landit/ui-web';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Wordmark } from '@/components/site/Wordmark';
import { anonymousClient } from '@/lib/session';

import styles from '../../consent.module.css';

import { Decision } from './Decision';

export const metadata: Metadata = {
  title: 'A rider needs your OK · Land It',
  description: 'Approve or withdraw a young rider’s Land It account.',
  // A guardian's link is not something to index, and the token is in the path.
  robots: { index: false, follow: false },
};

/**
 * Where a guardian's email lands (plan §6.2).
 *
 * No sign-in, because a parent has no account and is never asked to make one.
 * The page reads what the token is *for* and shows it; the decision itself is a
 * form submission, so nothing has happened by the time a mail scanner has
 * finished following links.
 */
export default async function ConsentPage({
  params,
}: {
  params: Promise<{ action: string; token: string }>;
}) {
  const { action, token: raw } = await params;
  if (action !== 'approve' && action !== 'revoke') notFound();

  const token = decodeURIComponent(raw);

  let preview: ConsentLinkPreview | null = null;
  try {
    preview = await previewConsentLink(anonymousClient(), token);
  } catch {
    preview = null;
  }

  return (
    <div className={styles.screen}>
      <div className={styles.column}>
        <Wordmark onPaper />

        {preview && preview.action === action ? (
          <Decision token={token} action={action} preview={preview} />
        ) : (
          <Panel className={styles.card}>
            <div className="eyebrow">Nothing to do here</div>
            <h1 className={`d ${styles.head}`}>That link is not valid</h1>
            <div className={styles.body}>
              <p>
                It may have been used already, or replaced by a newer one. The rider who asked you
                can send a fresh request from their account.
              </p>
              <p>
                If you were not expecting this email, you can ignore it — nothing happens either
                way. Anything that worries you: {CONTACT.safeguarding}, and we answer within one
                working day.
              </p>
            </div>
          </Panel>
        )}

        <p className={`cond ${styles.footnote}`}>
          Land It is a trick tracker for scooter, skateboard and BMX riders. There is no messaging
          between riders, no public feed, and profiles start private.
        </p>
      </div>
    </div>
  );
}
