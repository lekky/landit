'use client';

import { BILLING_PERIODS, type BillingPeriod } from '@landit/core';
import { Button, Panel, Tag } from '@landit/ui-web';
import Link from 'next/link';
import { useActionState } from 'react';

import { TabRow, TAB_PANEL } from '@/components/shell/TabRow';
import { useTabParam } from '@/components/shell/useTabParam';
import { ROUTES } from '@/lib/routes';

import { openBillingPortalAction } from './actions';
import { PlanCard } from './PlanCard';
import { SessionPlanComparison } from './SessionPlanComparison';
import type { PlansView } from './view';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

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
 * **They were not accurate, though, until 2026-09-04.** Every card described
 * the paywall as a tier line ("up to the Easy tier", "unlocks the Spicy,
 * Gnarly and Pro tiers") when it has never been one, and two of them still
 * named two sports on a three-sport product (issue #286). The lede and the
 * FAQ answer below were part of that and were rewritten with the cards;
 * `PLANS` in `@landit/core` carries the reasoning and the tests that pin it.
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

/**
 * The saving tag's own id, so the Yearly tab can point `aria-describedby` at it.
 *
 * The tag is a sibling of the row rather than a child of the tab — a `TabRow`
 * draws its own buttons — so the association cannot be structural and is made
 * by reference instead.
 */
const SAVING_TAG_ID = 'plans-yearly-saving';

/**
 * A period tab's DOM id, so the cards under it can be `aria-labelledby` it.
 *
 * ARIA's tabs pattern names a `tabpanel` after the tab that controls it, and a
 * panel cannot point at an element with no id. One function, so the tab and the
 * panel cannot drift (the session form's three steps do the same).
 */
const periodTabId = (period: BillingPeriod) => `plans-period-${period}`;

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
    a: 'No. Stickers and stages are earned by riding, on every plan, and none of them is ever for sale. Paying opens the rest of the library and the progress insights.',
  },
  {
    q: 'Can I cancel?',
    a: 'Whenever you like. Your tricks, your stickers and your streak stay exactly where they are.',
  },
];

export function PlansScreen({
  view,
  showSessions,
}: {
  view: PlansView;
  /** Owner-only preview (T41): the sessions comparison shows for `sessionsEnabledFor` alone. */
  showSessions: boolean;
}) {
  /*
   * **The period is in `?tab=`, not in `useState`** (the Progress pattern,
   * `useTabParam`; independent review of the combined branch, 2026-09-17).
   *
   * Two things it buys, and the first is the one a rider notices. A link to
   * yearly pricing works: `/plans?tab=yearly` opens on the yearly prices, which
   * is what somebody sharing "it's £39.99 a year" actually means to send. And
   * Back keeps the tab — a rider who presses Yearly, opens a card's checkout and
   * comes back lands on the prices they were reading rather than on Monthly.
   *
   * `replace`, not `push`, so pressing both tabs does not leave two history
   * entries for Back to walk out through; and the default is spelled by
   * *absence*, so the screen as it opens has one address rather than two that
   * render the same thing. `useTabParam` validates against `BILLING_PERIODS`,
   * so a hand-typed `?tab=nonsense` opens Monthly rather than an empty screen.
   *
   * It is still a `role="tablist"` with a `role="tabpanel"` under it: the panel
   * changes in place and the document does not navigate. Only where the answer
   * is stored moved.
   */
  const [tab, setTab] = useTabParam(BILLING_PERIODS, 'monthly');
  const period = tab as BillingPeriod;
  const setPeriod = setTab;
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
          {/*
            "Loads", not "Twenty" (Rachid, 2026-09-17, in chat).

            This sentence went first, on the reasoning that a ceiling at the top
            of the page a rider is being sold on reads as a limit before the free
            tier has been described. Later the same day the owner took the
            number out **everywhere** — "dont mention counts of tricks in free
            text as its always subject to change, so remove it everywhere" — so
            this is no longer the odd one out: no plan card, no landing
            paragraph, no locked trick and no library banner counts them now.

            The number itself is unchanged. `FREE_TRICKS_PER_SPORT` and the hook
            that enforces it are exactly where they were; `plans.ts` carries the
            full reasoning and `plans.test.ts` fails if a count comes back.
          */}
          Loads of hand-picked tricks in every sport, full tracking and the sticker wall cost
          nothing, forever. Paying opens the rest of the library and shows you the numbers behind
          your riding.
        </p>

        {/*
          Monthly · Yearly, as a `TabRow` (§3.10, D6).

          It was a two-cell segmented control of its own design. The row is the
          product's one shape for a choice between views of a screen now, so the
          plans page stops being the only place with a second one.

          **The saving is the tilted lime tag again** (Rachid, 2026-09-17, in
          chat: "the yearly should have a green 2 months free overlay thing — it
          was present on main"). T52 moved the words inside the Yearly tab, as
          the row's faded `.n`, on the reasoning that a boxed row has no edge to
          slap a tag over. The reasoning was sound and the result was quieter
          than the thing it replaced: a saving that is the reason to press
          Yearly at all went from an overlay a reader cannot miss to a dimmed
          number they read as a count. The owner reversed it, and §3.10 records
          the reversal rather than dropping the paragraph.

          It sits over the Yearly tab rather than over the row, which is the
          whole point of the tilt: beside the control it would read as a
          property of whatever is selected, so a visitor on Monthly would be
          told they are getting two months free. Position carries that for a
          sighted reader and nothing for anyone else, so `aria-describedby`
          says it again to a screen reader — a *description* of the tab, not
          part of its name, which is where the tab's own `note` had put it.
        */}
        <div className={styles.toggleRow}>
          <div className={styles.toggleWrap}>
            <TabRow
              items={BILLING_PERIODS.map((value) => ({
                id: value,
                label: value === 'monthly' ? 'Monthly' : 'Yearly',
                elementId: periodTabId(value),
                ...(value === 'yearly' && view.savingLabel ? { describedById: SAVING_TAG_ID } : {}),
              }))}
              value={period}
              group="plans"
              label="Billing period"
              className={styles.toggle}
              onChange={setPeriod}
            />
            {view.savingLabel && (
              <Tag
                tilt
                color="var(--lime)"
                className={styles.savingTag}
                style={{ color: 'var(--ink)' }}
              >
                <span id={SAVING_TAG_ID}>{view.savingLabel}</span>
              </Tag>
            )}
          </div>
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

      {/*
        The other half of the tab row: the thing that actually changes when a
        period is pressed, named after the tab that changed it.

        Without it a screen reader is told "Yearly, tab, 2 of 2" and then told
        about no panel at all, so the row announces a relationship the document
        does not have. `aria-labelledby` rather than a copy of the word in an
        `aria-label`, because the tab already carries the name and two copies of
        one name can drift.

        **Only the cards are in it.** They are what the period changes — every
        price on both sides was computed on the server (`view.ts`). The guardian
        notices, the currency footnote, the sessions comparison and the FAQ all
        read the same either way, and a panel that claimed them would be telling
        a screen reader the FAQ answers change with the billing period.

        Keyed on the period so React remounts it and §4's 120ms cross-fade runs
        on every switch.
      */}
      <div
        key={period}
        role="tabpanel"
        aria-labelledby={periodTabId(period)}
        className={`${styles.grid} ${TAB_PANEL}`}
      >
        {view.cards.map((card) => (
          <PlanCard key={card.slug} card={card} period={period} view={view} />
        ))}
      </div>

      {/*
        Under the cards, and only for a reader outside the UK (`view.pricesAreForeign`,
        resolved on the server in `page.tsx`). Stripe takes a card from anywhere
        against a GBP price, so a parent in Dublin or Toronto can buy today and
        find out the currency at Stripe's checkout and the conversion fee on
        their statement — which is the worst possible place for it. Saying it
        here costs a line. Multi-currency itself is issue #170 and is a tax
        position, not a formatting change; this is the honest holding position
        until that is decided.

        A UK reader never sees it: the note is a conversion dampener on the main
        market's paywall, and `pricesAreForeignTo` deliberately reads an unknown
        country as "not foreign" for the same reason.
      */}
      {view.pricesAreForeign && (
        <p className={`cond ${styles.footnote}`}>
          Prices are in pounds sterling. Your bank may add a conversion fee.
        </p>
      )}

      {/*
        Sessions (T40): what each plan logs, rendered from the same records as
        the cards. Under the cards and the currency note, so the note stays
        beside the prices it is about.
      */}
      {showSessions ? <SessionPlanComparison comparison={view.sessions} /> : null}

      {view.signedIn && view.hasSubscription && (
        <Panel flat className={styles.notice}>
          <div className="lab">Your billing</div>
          <p className={styles.noticeCopy}>
            Card details, invoices and cancelling all live with Stripe, who take the payment. Land
            It never sees a card number and never stores one.
          </p>
          <form
            action={portalAction}
            onSubmit={() => capture(ANALYTICS_EVENTS.billingPortalOpened)}
          >
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
