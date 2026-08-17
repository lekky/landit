'use client';

import { BILLING_PERIODS, type BillingPeriod } from '@landit/core';
import { Button, Panel, Tag } from '@landit/ui-web';
import Link from 'next/link';
import { useActionState, useState } from 'react';

import { ROUTES } from '@/lib/routes';

import { openBillingPortalAction } from './actions';
import { PlanCard } from './PlanCard';
import type { PlansView } from './view';

import styles from './plans.module.css';

/**
 * Membership (`Plans` in `landit-screens-c.jsx`, screenshot 20).
 *
 * The screenshot shows three cards and the third is **Crew Pass**, five riders
 * for £8.99. It is not what gets built: the Crew Pass was dropped on 2026-08-15
 * (plan §2.4) because its seat model was the fiddliest part of payments and its
 * other job — being the parental-consent mechanism — is done properly by the
 * consent flow instead. The third card is **Legend**, still one rider, and its
 * pitch is the flair and the progress insights. The layout, the raised "Most
 * riders" card and the toggle are the screenshot's exactly; only that card's
 * contents diverge, and the plan records why.
 *
 * **Legend has lost its headline perk.** Until 2026-08-17 the card led on a 5GB
 * clip vault against Shredder's 2GB; the owner reversed clip hosting that day
 * (plan §1, §6.6) and the vault lines are gone from `PLANS` in `@landit/core`.
 * Nothing was invented to replace them — what a paid tier is *worth* is a
 * pricing decision the owner reserved, and it is filed as an issue. So these
 * cards are currently accurate and thin, which is the right way round.
 *
 * **The FAQ is a rewrite, not a transcription**, for the reason T5's legal
 * pages were: two of the prototype's four answers sell Crew Pass and one
 * promises vinyl stickers through the letterbox, which nobody has decided to
 * post (issue #101). What replaces them says the two things this product must
 * never be vague about — that achievements are not for sale, and that an adult
 * is the one who pays. `e2e/plans.spec.ts` asserts both against the rendered
 * page, so a careless copy edit fails a build rather than quietly reversing a
 * decision (LESSONS §3a).
 *
 * A client component because of the toggle and nothing else. Every price string
 * on both sides of it was computed on the server (`view.ts`).
 */

const FAQ: readonly { readonly q: string; readonly a: string }[] = [
  {
    q: 'Does the free tier expire?',
    a: 'No. There is no trial timer and no card needed. Rookie stays free, and everything you track on it stays yours.',
  },
  {
    q: 'Can a parent pay?',
    a: 'Yes — and for a rider under 16 it is the only way. They ask from here, the checkout link goes to their parent or carer by email, and whoever pays confirms they are 18 or over.',
  },
  {
    q: 'Do stickers come faster on a paid plan?',
    a: 'No. Stickers and stages are earned by riding, on every plan, and none of them is ever for sale. Paying opens the harder tricks and the progress insights.',
  },
  {
    q: 'Can I cancel?',
    a: 'Whenever you like. Your tricks, your stickers and your streak stay exactly where they are.',
  },
];

export function PlansScreen({ view }: { view: PlansView }) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [portal, portalAction, portalPending] = useActionState<{ error?: string }, FormData>(
    openBillingPortalAction,
    {},
  );

  return (
    <div>
      <div className={styles.head}>
        <span className="eyebrow">Membership</span>
        <h1 className={`d ${styles.title}`}>A free tier that isn&rsquo;t a trial</h1>
        <p className={styles.lede}>
          Both libraries up to the Easy tier, full tracking and the sticker wall cost nothing,
          forever. Paying opens the harder tiers and shows you the numbers behind your riding.
        </p>

        <div className={styles.toggleRow}>
          <div className={styles.toggle} role="group" aria-label="Billing period">
            {BILLING_PERIODS.map((value) => (
              <button
                key={value}
                type="button"
                className={`cond ${styles.toggleButton}`}
                aria-pressed={period === value}
                data-on={period === value ? 'true' : undefined}
                onClick={() => setPeriod(value)}
              >
                {value === 'monthly' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
          {view.savingLabel && (
            <Tag tilt color="var(--lime)" style={{ color: 'var(--ink)' }}>
              {view.savingLabel}
            </Tag>
          )}
        </div>
      </div>

      {view.signedIn && view.upgradeRoute === 'blocked' && (
        <Panel flat className={styles.notice}>
          <div className="lab">Waiting on a grown-up</div>
          <p className={styles.noticeCopy}>
            This account is waiting for a parent or carer to approve it, so it cannot go onto a paid
            plan yet. Everything on Rookie still works — the library, tracking, notes and the streak
            are all yours in the meantime.
          </p>
        </Panel>
      )}

      {view.signedIn && view.upgradeRoute === 'guardian' && (
        <Panel flat className={styles.notice}>
          <div className="lab">A grown-up sorts this one out</div>
          <p className={styles.noticeCopy}>
            We do not take payment from riders under 16. Pick a plan and we will email the link to
            the parent or carer on this account — they set it up, and they can stop it whenever they
            want.
          </p>
        </Panel>
      )}

      <div className={styles.grid}>
        {view.cards.map((card) => (
          <PlanCard key={card.slug} card={card} period={period} view={view} />
        ))}
      </div>

      {view.signedIn && view.hasSubscription && (
        <Panel flat className={styles.notice}>
          <div className="lab">Your billing</div>
          <p className={styles.noticeCopy}>
            Card details, invoices and cancelling all live with Stripe, who take the payment. Land
            It never sees a card number and never stores one.
          </p>
          <form action={portalAction}>
            <Button type="submit" variant="ghost" size="sm" disabled={portalPending}>
              {portalPending ? 'Opening…' : 'Manage billing'}
            </Button>
          </form>
          {portal.error && <p className={styles.error}>{portal.error}</p>}
        </Panel>
      )}

      <Panel className={styles.faq}>
        <div className={`d ${styles.faqTitle}`}>Questions we get asked</div>
        <div className={styles.faqGrid}>
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <div className={`cond ${styles.faqQuestion}`}>{q}</div>
              <p className={styles.faqAnswer}>{a}</p>
            </div>
          ))}
        </div>
      </Panel>

      {!view.checkoutLive && (
        <p className={`cond ${styles.footnote}`}>
          Upgrading is not switched on yet, so nothing on this page can charge anybody. The prices
          are the real ones.
        </p>
      )}

      {!view.signedIn && (
        <p className={`cond ${styles.footnote}`}>
          <Link href={ROUTES.signUp}>Make an account</Link> to start on Rookie. It is free, and no
          card is asked for.
        </p>
      )}
    </div>
  );
}
