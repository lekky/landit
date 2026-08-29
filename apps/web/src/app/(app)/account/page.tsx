import {
  countryName,
  isConsentLimited,
  type ConsentState,
  type LevelId,
  type PrivacyId,
  type SportId,
  type StanceId,
} from '@landit/core';
import { Avatar, Button, Panel, SportChip, Tag } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ROUTES, legalHref, riderHref } from '@/lib/routes';
import { currentRider } from '@/lib/session';
import { SPORT_LOOKS } from '@/lib/sports';
import { isStaff } from '@/lib/staff';

import { SignOutForm } from '@/components/SignOutForm';

import styles from './account.module.css';
import { DataPanel } from './DataPanel';
import { GuardianPanel } from './GuardianPanel';
import { PrivacyPanel } from './PrivacyPanel';
import { ProfilePanel } from './ProfilePanel';

export const metadata: Metadata = {
  title: 'Your account · Land The Trick',
  description: 'Who you are on Land The Trick, and what you have set up.',
};

/**
 * Where a rider lands after signing in.
 *
 * A deliberately small screen, and the plan records why (§7, T6): the dashboard
 * is T8, the library is T7, the profile editor is later still — but a rider has
 * to arrive *somewhere* the moment sign-up exists, and a rider held behind the
 * consent gate needs a place that says so and lets them do something about it.
 * It is the first screen to use the app shell's rider, which T5 left for T6.
 */
export default async function AccountPage() {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);

  const rider = session.rider;
  const sports = (rider.sports ?? []) as SportId[];
  const consent = rider.consent_state as ConsentState;

  return (
    <div>
      <span className="eyebrow">Your account</span>
      <h1 className={`d ${styles.head}`}>{rider.name || 'Rider'}</h1>
      <p className={styles.lede}>
        Everything here is yours and private by default. Nobody else can see your account unless you
        change that.
      </p>

      {isConsentLimited(consent) ? <GuardianPanel state={consent} /> : null}

      <Panel className={styles.identity}>
        <Avatar avatarId={rider.avatar_key || null} name={rider.name} size={64} ringWidth={3} />
        <div className={styles.identityText}>
          <div className={`d ${styles.name}`}>{rider.name || 'Rider'}</div>
          <p className={`cond ${styles.handle}`}>
            {rider.handle ? `@${rider.handle}` : 'Handle on its way'}
            {rider.country ? ` · ${countryName(rider.country)}` : ''}
          </p>
          <div className={styles.sports}>
            {sports.length ? (
              sports.map((sport) => <SportChip key={sport} sport={SPORT_LOOKS[sport]} />)
            ) : (
              <span className="cond">No sports picked yet</span>
            )}
          </div>
        </div>
        <Tag color="var(--violet)">{rider.plan === 'rookie' ? 'Rookie · free' : rider.plan}</Tag>
      </Panel>

      {/*
        T23. The four facts that used to be printed here in a read-only grid —
        level, goal, stance and privacy — are each set below by the control that
        also shows them. Two renderings of one value on one screen is how a
        rider ends up scrolling past "Stance · Regular" to reach a stance picker
        that says the same thing.
      */}
      <ProfilePanel
        name={rider.name}
        sports={sports}
        level={(rider.level || null) as LevelId | null}
        goal={rider.goal || null}
        goalCustom={rider.goal_custom || ''}
        stance={(rider.stance || null) as StanceId | null}
        avatarKey={rider.avatar_key || null}
      />

      {/*
        The privacy control (T11). Until this landed the value was shown here
        and set nowhere — a rider could read "Private" and had no way to choose
        anything else, which makes a high-privacy default (plan §6.4 standard 7)
        into a setting nobody consented to rather than one they were handed.
      */}
      <PrivacyPanel value={(rider.privacy || 'private') as PrivacyId} />

      <Panel flat className={styles.later}>
        <div className="lab">Your profile, and who it is for</div>
        <div className={styles.profileLinks}>
          {rider.handle ? (
            <Link className="btn sm ghost" href={riderHref(rider.handle)}>
              View your public profile
            </Link>
          ) : null}
          <Link className="btn sm ghost" href={ROUTES.crew}>
            Your crew
          </Link>
          <Link className="btn sm ghost" href={ROUTES.coach}>
            Coach / parent view
          </Link>
        </div>
        <p className={`cond ${styles.handle}`} style={{ marginTop: 10 }}>
          The coach view is a read-only summary of the week, on this device, for showing to a
          grown-up. It is not shared with anyone and there is no separate login for it.
        </p>
      </Panel>

      {/*
        The only door into the staff portal, and the one place it makes sense
        (issue #118). `/admin` had no link anywhere: T16 left it out of the
        rider nav on purpose — a staff-only item in a five-slot bar built for
        riders, rendered conditionally on every page, for a link two people use
        — and "staff type the address" is a thing nobody writes down. This is
        the middle option that issue offered: one conditional on a screen that
        already loads the rider record, and no change to the nav types.

        `isStaff` is the same predicate `requireStaff` gates the portal with, so
        a link cannot appear for somebody the portal would 404. The reverse — a
        staff member with no link — is the state this replaces.
      */}
      {isStaff(rider) && (
        <Panel flat className={styles.later}>
          <div className="lab">Staff</div>
          <div className={styles.profileLinks}>
            <Link className="btn sm ghost" href={ROUTES.admin}>
              Open the staff portal
            </Link>
          </div>
          <p className={`cond ${styles.handle}`} style={{ marginTop: 10 }}>
            Riders, the trick library, the spot queue and moderation. Everything you change there is
            logged against your account.
          </p>
        </Panel>
      )}

      <Panel flat className={styles.later}>
        <div className="lab">Still on its way</div>
        <ul className={styles.laterList}>
          <li>Changing your name or your handle</li>
        </ul>
        <p className={`cond ${styles.handle}`} style={{ marginTop: 10 }}>
          Everything you log now is kept and will be there when they land.
        </p>
      </Panel>

      {/* T18: the two things the privacy policy promises and had no control for. */}
      <DataPanel />

      <div className={styles.signOut}>
        <SignOutForm where="account">
          <Button type="submit" variant="ghost">
            Sign out
          </Button>
        </SignOutForm>
        <span className="cond" style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
          <Link href={legalHref('privacy')}>What we keep</Link> ·{' '}
          <Link href={legalHref('safeguarding')}>Safeguarding</Link>
        </span>
      </div>
    </div>
  );
}
