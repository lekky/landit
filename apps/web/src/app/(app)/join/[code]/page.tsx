import {
  formatInviteCode,
  isConsentLimited,
  isValidInviteCode,
  normaliseInviteCode,
  type ConsentState,
} from '@landit/core';
import { Panel } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ROUTES, joinHref, signInHref } from '@/lib/routes';
import { currentRider } from '@/lib/session';

import { JoinButton } from './JoinButton';

import styles from './join.module.css';

export const metadata: Metadata = {
  title: 'Join a crew · Land The Trick',
  description: 'Somebody sent you an invite.',
  // An invite link is not a page for a search engine to hold on to.
  robots: { index: false, follow: false },
};

/**
 * Where an invite link lands (`landit-screens-d.jsx`'s share URL).
 *
 * **It says nothing about the crew.** Not its name, not its size, not who is in
 * it — a page holding a code has not been let into anything yet, and `crews`
 * has no rule that would tell it. The name arrives on the crew screen, after
 * the code has been redeemed, which is the first moment the reader is a member.
 * That ordering is the no-discovery position (plan §6.1) applied to the one URL
 * that a stranger is most likely to be holding.
 *
 * **Signing in comes back here.** Issue #66: a gated link used to drop a
 * signed-out visitor on `/home` with no trace of what they had followed, which
 * for an invite means the code is simply lost. The path is carried through the
 * sign-in form and validated on the way out.
 */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const raw = decodeURIComponent((await params).code);
  const code = normaliseInviteCode(raw);
  const valid = isValidInviteCode(code);
  const session = await currentRider();

  const consentLimited = session
    ? isConsentLimited(session.rider.consent_state as ConsentState)
    : false;

  return (
    <div className={styles.wrap}>
      <span className="eyebrow">An invite</span>
      <h1 className={`d ${styles.head}`}>Somebody wants you on their crew</h1>

      <Panel className={styles.card}>
        <div className="lab">Join code</div>
        <div className={`d ${styles.code}`}>{valid ? formatInviteCode(code) : 'Not a code'}</div>

        {!valid ? (
          <p className={styles.body}>
            That link is missing something. Ask your mate to send it again, or type the code by hand
            on the crew screen — they look like ABCDE-FGHJK.
          </p>
        ) : !session ? (
          <>
            <p className={styles.body}>
              Sign in and this code puts you straight on the board. Crews are invite-only, so this
              code is the only way in — and it is the only thing this page can tell you about the
              crew.
            </p>
            <div className={styles.actions}>
              <Link className="btn" href={signInHref(joinHref(code))}>
                Sign in and join
              </Link>
              <Link className="btn ghost" href={ROUTES.signUp}>
                Make an account
              </Link>
            </div>
          </>
        ) : consentLimited ? (
          <p className={styles.body}>
            Crews open up as soon as your parent or guardian says yes. Keep this code — it works for
            two weeks — and come back once they have.
          </p>
        ) : (
          <>
            <p className={styles.body}>
              One tap and you are on the board. You can leave again whenever you like, and nobody
              can put you back without a fresh code.
            </p>
            <JoinButton code={code} />
          </>
        )}
      </Panel>

      <p className={styles.foot}>
        <Link href={ROUTES.crew}>Your crew</Link> · There is no messaging on Land The Trick, here or
        anywhere.
      </p>
    </div>
  );
}
