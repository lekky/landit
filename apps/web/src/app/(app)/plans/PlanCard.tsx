'use client';

import type { BillingPeriod } from '@landit/core';
import { Button, Icon } from '@landit/ui-web';
import Link from 'next/link';
import { useActionState } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { ROUTES } from '@/lib/routes';

import { startUpgradeAction, type UpgradeFormState } from './actions';
import type { PlanCardView, PlansView } from './view';

import styles from './plans.module.css';

/**
 * One plan card (screenshot 20).
 *
 * The head takes the plan's hue with the name in Anton over a hard ink shadow,
 * the perks carry a filled tick in the same hue and the missing lines are
 * struck through at 45% — all straight from the prototype. The raised card with
 * the tilted "Most riders" tag is Shredder's and comes off `popular` on the
 * record, not off a slug in this file.
 *
 * The call to action is where the plan diverges from the prototype, and it is
 * the safeguarding decision rather than a design one (§6.2):
 *
 * - signed out → sign up, because there is nothing to attach a plan to yet
 * - waiting on a guardian → no button at all, and the panel above says why
 * - under 16 → "Ask a grown-up", which emails the checkout link to their parent
 *   or carer and never opens a payment form in front of the child
 * - otherwise → checkout, behind an 18+ confirmation the subscription then
 *   stores, so the hook can refuse one that never had it
 *
 * The confirmation lives on the card rather than once at the top of the page
 * because it is a statement about *this* purchase, and a tick box that stays
 * ticked from a previous visit is not a confirmation of anything.
 */
export function PlanCard({
  card,
  period,
  view,
}: {
  card: PlanCardView;
  period: BillingPeriod;
  view: PlansView;
}) {
  const [state, action, pending] = useActionState<UpgradeFormState | undefined, FormData>(
    startUpgradeAction.bind(null, card.slug),
    undefined,
  );

  const buyable = view.signedIn && card.paid && !card.current && view.upgradeRoute !== 'blocked';

  return (
    <div
      className={`panel ${styles.card}${card.popular ? ` ${styles.cardPopular}` : ''}`}
      data-plan={card.slug}
    >
      <div className={styles.cardHead} style={{ background: card.hue }}>
        {card.popular && <span className={`tag tilt ${styles.popularTag}`}>Most riders</span>}
        <div className={`d ${styles.cardName}`}>{card.name}</div>
        <div className={styles.priceRow}>
          <span className={`d ${styles.price}`}>{card.price[period]}</span>
          <span className={`lab ${styles.per}`}>{card.per[period]}</span>
        </div>
      </div>

      <div className={styles.cardBody}>
        <p className={styles.pitch}>{card.pitch}</p>

        <div className={styles.perks}>
          {card.perks.map((perk) => (
            <div key={perk} className={styles.perk}>
              <span className={styles.tick} style={{ background: card.hue }}>
                <Icon name="check" size={10} strokeWidth={3.6} style={{ color: '#fff' }} />
              </span>
              <span className={styles.perkText}>{perk}</span>
            </div>
          ))}
          {card.missing.map((missing) => (
            <div key={missing} className={`${styles.perk} ${styles.perkMissing}`}>
              <span className={styles.tickEmpty} />
              <span className={styles.perkText}>{missing}</span>
            </div>
          ))}
        </div>

        {card.current && (
          <Button wide variant="ghost" disabled>
            Your plan
          </Button>
        )}

        {!card.current && !view.signedIn && (
          <Link className="btn wide ghost" href={ROUTES.signUp}>
            Start on Rookie
          </Link>
        )}

        {!card.current && view.signedIn && !card.paid && (
          // Downgrading is cancelling, and cancelling happens in Stripe's own
          // portal so that stopping a payment is never something this product
          // could get wrong. The button says what it does.
          <Button wide variant="ghost" disabled>
            {view.hasSubscription ? 'Cancel in Manage billing' : 'Your plan'}
          </Button>
        )}

        {!card.current && view.signedIn && card.paid && view.upgradeRoute === 'blocked' && (
          <Button wide variant="ghost" disabled>
            Waiting on a grown-up
          </Button>
        )}

        {buyable && (
          <form
            action={action}
            className={styles.buy}
            // Checkout *started*, which is all this side can honestly claim: the
            // rider leaves for Stripe, and whether they paid comes back through
            // the webhook, not through a browser. `upgradeRoute` is carried
            // because "ask a grown-up" and "pay for it yourself" are two very
            // different journeys behind one button (§6.2).
            onSubmit={() =>
              capture(ANALYTICS_EVENTS.upgradeStarted, {
                plan: card.slug,
                period,
                route: view.upgradeRoute,
              })
            }
          >
            <input type="hidden" name="period" value={period} />
            <label className={styles.confirm}>
              <input type="checkbox" name="confirm_adult" value="yes" />
              <span>
                {view.upgradeRoute === 'guardian'
                  ? 'A parent or carer is here and is 18 or over.'
                  : 'I am 18 or over and I am the one paying.'}
              </span>
            </label>
            <Button type="submit" wide disabled={pending} style={{ background: card.hue }}>
              {pending
                ? 'One moment…'
                : view.upgradeRoute === 'guardian'
                  ? `Ask a grown-up for ${card.name}`
                  : `Get ${card.name}`}
            </Button>
          </form>
        )}

        {state?.error && <p className={styles.error}>{state.error}</p>}
        {state?.guardianEmailed && (
          <p className={styles.sent}>
            Sent. Your parent or carer has the link — nothing changes until they use it.
          </p>
        )}
        {state?.guardianQueued && (
          <p className={styles.sent}>
            We could not get the email out just now. Nothing has been charged, and nothing on your
            account has changed.
          </p>
        )}
      </div>
    </div>
  );
}
