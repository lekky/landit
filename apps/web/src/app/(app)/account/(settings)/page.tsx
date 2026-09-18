import {
  PLAN,
  countryName,
  isConsentLimited,
  type ConsentState,
  type PlanId,
  type SportId,
} from '@landit/core';
import { Avatar, Panel, SportChip, Tag } from '@landit/ui-web';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ROUTES } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';

import { GuardianPanel } from '../GuardianPanel';
import { requireAccountRider } from '../load';

import styles from '../account.module.css';

export const metadata: Metadata = {
  title: 'Your account · Land The Trick',
  description: 'Who you are on Land The Trick, and what you have set up.',
};

/**
 * `/account` — who you are, with the list of everything you can change beside
 * it (app shell rethink §3.9, T51).
 *
 * This page is now only the *header*: the rider's name, their picture, their
 * handle and country, the sports they ride and the plan they are on. Every
 * control that used to be stacked below it is a row in the list
 * (`(settings)/layout.tsx`), and each row is a screen of its own.
 *
 * On a phone the two read as one screen, in this order: who you are, then what
 * you can change. On a desktop this is the right-hand pane at `/account` and
 * the list sits at 340px on the left — which is why it is a summary and not an
 * empty "pick something on the left": a rider who opens their account with no
 * particular errand should be shown their account.
 *
 * Nothing here is a control, deliberately. The one thing that reads like a
 * fact and is really a setting — the plan tag — is the "Plans and billing" row
 * two centimetres away.
 */
export default async function AccountPage() {
  const { rider } = await requireAccountRider();
  const sports = (rider.sports ?? []) as SportId[];
  const consent = rider.consent_state as ConsentState;
  const plan = PLAN[(rider.plan || 'rookie') as PlanId];

  return (
    <div>
      <span className="eyebrow">Your account</span>
      <h1 className={`d ${styles.head}`}>{rider.name || 'Rider'}</h1>
      <p className={styles.lede}>
        Everything here is yours and private by default. Nobody else can see your account unless you
        change that.
      </p>

      {/*
        The gate, where it was (review S3).

        The "Your guardian" row exists and is first in the list, and it is still
        the panel's address — but a row is a signpost, and a child waiting on a
        grown-up should meet the thing that asks one rather than a chevron.
        Measured on the first cut at 390px, the row's top was 450px down, behind
        the eyebrow, the heading, the lede and the whole identity card, with the
        email field a tap beyond that; on `main` the panel was directly under
        this lede. It is directly under this lede again.

        Twice on the screen is deliberate and is not two copies of a value: this
        is the ask, and the row is the way back to it once it has been scrolled
        past. It disappears entirely the moment a grown-up says yes.
      */}
      {isConsentLimited(consent) ? <GuardianPanel state={consent} /> : null}

      <Panel className={styles.identity}>
        <Avatar avatarId={rider.avatar_key || null} name={rider.name} size={64} ringWidth={3} />
        <div className={styles.identityText}>
          {/*
            No name here (review N14). The `h1` 60px above is the rider's name,
            and this card printing it again is the duplication the sub-screens
            dropped their eyebrow to avoid. What the card is for is everything
            the heading does not say: the picture, the handle, where they are,
            what they ride and what they are on.
          */}
          <p className={`cond ${styles.handle}`} style={{ marginTop: 0 }}>
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
        {/*
          `PLAN[].name`, not the raw id. A paid rider's tag read "shredder" in
          lower case while the "Plans and billing" row two centimetres away read
          "Shredder" — the same fact, spelled two ways, on one screen (N14).
        */}
        <Tag color="var(--violet)">
          {plan ? `${plan.name}${plan.id === 'rookie' ? ' · free' : ''}` : 'Rookie · free'}
        </Tag>
      </Panel>

      {/*
        "Your crew" (review S4). `main`'s "Your profile, and who it is for" panel
        carried three links: the public profile went to `/account/privacy`, the
        coach view became a row of its own, and this one was removed outright
        with nothing said about it. Crew is a cell in the bar at every width, so
        the cost was small — but a link deleted in silence is a link nobody
        decided to delete, so it comes back, on the card about who the rider is.

        In a labelled panel rather than as a bare button (review N17). It arrived
        as one ghost button floating between the identity card and the rows,
        which works and is findable and looks like nothing decided it belonged
        there. This is the treatment the panel it came from used, minus the two
        links that found homes of their own.
      */}
      <Panel flat className={styles.aside}>
        <div className="lab">Who you ride with</div>
        <div className={styles.asideLinks}>
          <Link className="btn sm ghost" href={ROUTES.crew}>
            Your crew
          </Link>
        </div>
      </Panel>
    </div>
  );
}
