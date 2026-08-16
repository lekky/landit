import {
  LEVELS,
  PRIVACY,
  STANCES,
  countryName,
  goalLabel,
  isConsentLimited,
  type ConsentState,
  type SportId,
} from '@landit/core';
import { Avatar, Button, Panel, SportChip, Tag } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ROUTES, legalHref } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';
import { currentRider } from '@/lib/session';

import { signOutAction } from '../../(auth)/actions';

import styles from './account.module.css';
import { GuardianPanel } from './GuardianPanel';

export const metadata: Metadata = {
  title: 'Your account · Land It',
  description: 'Who you are on Land It, and what you have set up.',
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
  const level = LEVELS.find((l) => l.id === rider.level);
  const stance = STANCES.find((s) => s.id === rider.stance);
  const privacy = PRIVACY.find((p) => p.id === rider.privacy);
  const goal = goalLabel(rider.goal, rider.goal_custom);
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

      <div className={styles.facts}>
        <Panel flat className={styles.fact}>
          <div className="lab">Where you are at</div>
          <div className={`d ${styles.factValue}`}>{level?.label ?? 'Not set'}</div>
        </Panel>
        <Panel flat className={styles.fact}>
          <div className="lab">The goal</div>
          <div className={`d ${styles.factValue}`}>{goal ?? 'Not set'}</div>
        </Panel>
        <Panel flat className={styles.fact}>
          <div className="lab">Stance</div>
          <div className={`d ${styles.factValue}`}>{stance?.label ?? 'Not saying'}</div>
        </Panel>
        <Panel flat className={styles.fact}>
          <div className="lab">Who can see you</div>
          <div className={`d ${styles.factValue}`}>{privacy?.label ?? 'Private'}</div>
        </Panel>
      </div>

      <Panel flat className={styles.later}>
        <div className="lab">Still on its way</div>
        <ul className={styles.laterList}>
          <li>Your dashboard, the streak and &ldquo;I rode today&rdquo;</li>
          <li>The trick library, progress and the skill tree</li>
          <li>Crews, spots, events and clips</li>
        </ul>
        <p className={`cond ${styles.handle}`} style={{ marginTop: 10 }}>
          Everything you log now is kept and will be there when they land.
        </p>
      </Panel>

      <div className={styles.signOut}>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost">
            Sign out
          </Button>
        </form>
        <span className="cond" style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
          <Link href={legalHref('privacy')}>What we keep</Link> ·{' '}
          <Link href={legalHref('safeguarding')}>Safeguarding</Link>
        </span>
      </div>
    </div>
  );
}
