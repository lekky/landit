'use client';

import { Panel, Tag } from '@landit/ui-web';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/providers/toast';

import { StaffEditor } from '../StaffEditor';
import { savePlanAction } from '../content-actions';
import type { AdminPlanCard } from '../view';

import styles from '../admin.module.css';

/**
 * The plans editor (`landit-admin.jsx`, `AdminPlans`).
 *
 * The prototype had one price per plan. There are two here — monthly and yearly
 * — because T15's plans page has a billing toggle, and a single field would have
 * meant editing one of them and silently leaving the other saying whatever it
 * said before.
 *
 * Both are **display strings**. Stripe holds the amounts that are actually
 * charged, so nothing typed here changes anybody's bill; the card says so, out
 * loud, next to the button (issue #123).
 */
export function PlansScreen({ cards }: { cards: readonly AdminPlanCard[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<AdminPlanCard | null>(null);

  return (
    <div className={styles.stack}>
      <div className={styles.planGrid}>
        {cards.map((plan) => (
          <Panel key={plan.id} className={styles.planCard}>
            <div className={styles.planHead} style={{ background: plan.hue }}>
              <div className={`d ${styles.planName}`}>{plan.name}</div>
              <div className={styles.planPrice}>
                <span className="d" style={{ fontSize: 26 }}>
                  {plan.priceMonthly || '—'}
                </span>
                <span className="lab" style={{ color: 'var(--ink)' }}>
                  {plan.per || 'per month'}
                </span>
              </div>
            </div>

            <div className={styles.planBody}>
              <p className={styles.planPitch}>{plan.pitch}</p>

              <div className={styles.chipRow}>
                <Tag color={plan.isLive ? 'var(--green)' : 'var(--ink-3)'} style={{ fontSize: 10 }}>
                  {plan.isLive ? 'On sale' : 'Off sale'}
                </Tag>
                <Tag
                  color={plan.unlocksPaidTricks ? 'var(--violet)' : 'var(--paper-2)'}
                  style={{ fontSize: 10, color: plan.unlocksPaidTricks ? '#fff' : 'var(--ink)' }}
                >
                  {plan.unlocksPaidTricks ? 'Unlocks paid tricks' : 'Free tier'}
                </Tag>
              </div>

              <div className="lab" style={{ color: 'var(--ink-3)' }}>
                {plan.perks.length} perks · {plan.missing.length} crossed out ·{' '}
                {plan.riders === 1 ? '1 rider' : `${plan.riders} riders`}
              </div>
              <div className="lab" style={{ color: 'var(--ink-3)' }}>
                Yearly {plan.priceYearly || 'not set'}
              </div>

              <button type="button" className="btn sm wide ghost" onClick={() => setEditing(plan)}>
                Edit plan
              </button>
            </div>
          </Panel>
        ))}
      </div>

      <p className={styles.footnote}>
        Copy and pricing only. Which tricks a plan unlocks is set per trick in the library, and the
        paid-trick entitlement itself is not editable from here — it is what the paywall reads.
      </p>
      <p className={styles.footnote}>
        The prices on this screen are the ones riders are <em>shown</em>. What is actually charged
        lives in Stripe, so editing here does not change a bill and can disagree with checkout —
        change both, or neither (issue #123).
      </p>

      {editing && (
        <StaffEditor
          key={editing.id}
          title={`Edit ${editing.name}`}
          value={{
            name: editing.name,
            priceMonthly: editing.priceMonthly,
            priceYearly: editing.priceYearly,
            per: editing.per,
            pitch: editing.pitch,
            perks: editing.perks.join('\n'),
            missing: editing.missing.join('\n'),
          }}
          fields={[
            { k: 'name', label: 'Plan name' },
            { k: 'per', label: 'Billing', placeholder: 'per month' },
            {
              k: 'priceMonthly',
              label: 'Price, monthly',
              placeholder: '£3.99',
              hint: 'Shown to riders. Stripe holds what is charged.',
            },
            { k: 'priceYearly', label: 'Price, yearly', placeholder: '£39.99' },
            { k: 'pitch', label: 'One line pitch', type: 'text', rows: 2, wide: true },
            { k: 'perks', label: 'Included, one per line', type: 'text', rows: 6, wide: true },
            { k: 'missing', label: 'Crossed out, one per line', type: 'text', rows: 3, wide: true },
          ]}
          onSave={async (value) => {
            const result = await savePlanAction(editing.id, {
              name: String(value.name ?? ''),
              priceMonthly: String(value.priceMonthly ?? ''),
              priceYearly: String(value.priceYearly ?? ''),
              per: String(value.per ?? ''),
              pitch: String(value.pitch ?? ''),
              perks: String(value.perks ?? ''),
              missing: String(value.missing ?? ''),
            });
            if (result.ok) {
              toast(`${String(value.name)} updated`, editing.hue);
              router.refresh();
            }
            return result;
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
