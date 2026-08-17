import { SPORTS, SPORT_IDS, isTrickFree } from '@landit/core';
import {
  adminRiderCounts,
  listPlans,
  listStaffAudit,
  listTricks,
  records,
  tricksFromRecords,
  type AuditLogRecord,
} from '@landit/db';
import { Bar, Panel } from '@landit/ui-web';
import type { Metadata } from 'next';

import { shortDateTime } from '@/lib/dates';
import { requireStaff } from '@/lib/staff';

import type { AdminActivityRow, AdminAttentionRow, AdminBar, AdminStatCard } from './view';

import styles from './admin.module.css';

/**
 * The Overview tab (`landit-admin.jsx`, `AdminOverview`).
 *
 * Every number is counted off the database rather than off `@landit/core`'s
 * canonical constants, and that is not a stylistic choice: the constants seed
 * the collections and the collections are what staff edit (T17), so a screen
 * reading the constants would show a tricks count that ignores every edit made
 * on the tab next door.
 *
 * Read as the product, not as the reader: `users` is privacy-filtered and
 * `audit_log` is superuser-only, so a portal on the staff member's own token
 * would under-report the rider base and show an empty activity panel — both
 * silently. `requireStaff` is what supplies the client that sees everything.
 */
export const dynamic = 'force-dynamic';

/** On the page, not the layout — see `layout.tsx` for why that matters. */
export const metadata: Metadata = {
  title: 'Overview · Staff portal',
  robots: { index: false, follow: false },
};

/** A day's worth of activity, for the "rode in the last day" figure. */
const DAY_MS = 86_400_000;

/** Read in a helper rather than in the render body: the clock is not pure. */
function since(): Date {
  return new Date(Date.now() - DAY_MS);
}

/**
 * One audit row as a sentence.
 *
 * Written by the product from the row's own fields, never from anything a
 * person typed — the same rule the crew feed follows (plan §6.1). An action
 * this does not recognise still renders: T17 adds `admin.*` verbs this file has
 * never heard of, and a panel that dropped them would quietly under-report the
 * log rather than look unfinished.
 */
function auditLine(row: AuditLogRecord): string {
  const after = (row.after ?? {}) as Record<string, unknown>;

  switch (row.action) {
    case 'admin.plan_override':
      return `moved a rider onto ${String(after.plan ?? 'another plan')}`;
    case 'admin.suspend':
      return 'suspended an account';
    case 'admin.restore':
      return 'restored an account';
    default: {
      const verb = row.action.startsWith('admin.') ? row.action.slice(6) : row.action;
      return `${verb.replace(/_/g, ' ')} on ${row.entity}`;
    }
  }
}

export default async function AdminOverviewPage() {
  const staff = await requireStaff();
  const pb = staff.superuser;

  const activeSince = since();

  const [plans, trickRecords, spotsLive, spotsPending, audit] = await Promise.all([
    listPlans(pb),
    // `includeHidden`, because a trick staff have taken down is still a row
    // they are responsible for and the count on this card is about the library
    // they manage, not the one a rider sees.
    listTricks(pb, { includeHidden: true }),
    records(pb, 'spots').page({ filter: 'status = {:s}', params: { s: 'live' }, perPage: 1 }),
    records(pb, 'spots').page({ filter: 'status = {:s}', params: { s: 'pending' }, perPage: 1 }),
    listStaffAudit(pb, { limit: 8 }),
  ]);

  const counts = await adminRiderCounts(
    pb,
    plans.map((p) => p.slug),
    SPORT_IDS,
    activeSince,
  );

  const tricks = tricksFromRecords(trickRecords);
  const live = tricks.filter((t) => t.isLive);
  const locked = live.filter((t) => !isTrickFree(t)).length;

  // "On a paid plan", resolved from the plan record's own entitlement rather
  // than from the string `rookie`. Which tier is free is a staff-editable fact
  // (plan §6.6) and comparing a plan id in code is exactly what §2.4 forbids.
  const paidSlugs = new Set(plans.filter((p) => p.unlocks_paid_tricks).map((p) => p.slug));
  const paid = plans.reduce(
    (n, p) => n + (paidSlugs.has(p.slug) ? (counts.byPlan[p.slug] ?? 0) : 0),
    0,
  );
  const share = counts.total > 0 ? Math.round((paid / counts.total) * 100) : 0;

  const cards: AdminStatCard[] = [
    {
      label: 'Riders',
      value: String(counts.total),
      sub: `${counts.activeToday} rode in the last day`,
      hue: 'var(--paper-2)',
    },
    {
      label: 'On a paid plan',
      value: String(paid),
      // Not "conversion": until T15 there is no checkout to convert through, so
      // most of this number is staff overrides. Saying "paying" would be false.
      sub: counts.total > 0 ? `${share}% of riders, overrides included` : 'No riders yet',
      hue: 'var(--lime)',
    },
    {
      label: 'Monthly revenue',
      // Deliberately blank. The prototype multiplied a plan count by a list
      // price, which ignores yearly billing, cancellations and the staff
      // overrides counted directly above it — a figure precise enough to be
      // quoted and wrong by an unknown margin. The real one is a sum over
      // `subscriptions`, which T15 fills. The card keeps its place in the grid
      // so the layout does not move when it does (owner's call, 2026-08-17).
      value: null,
      sub: 'Lands with billing',
      hue: 'var(--yellow)',
    },
    {
      label: 'Tricks live',
      value: String(live.length),
      sub: `${locked} behind a paid plan`,
      hue: 'var(--paper-2)',
    },
    {
      label: 'Spots live',
      value: String(spotsLive.totalItems),
      sub: `${spotsPending.totalItems} waiting for review`,
      hue: 'var(--paper-2)',
    },
  ];

  const planBars: AdminBar[] = plans.map((p) => ({
    label: p.name,
    count: counts.byPlan[p.slug] ?? 0,
    color: p.hue || 'var(--ink-3)',
  }));

  // Iterated from `SPORT_IDS`, never a scooter/skate pair: three sports ship at
  // launch and a fourth would appear here without a code change (plan §7).
  const sportBars: AdminBar[] = SPORT_IDS.map((id) => ({
    label: SPORTS[id].label,
    count: counts.bySport[id] ?? 0,
    color: SPORTS[id].color,
  }));

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const attention: AdminAttentionRow[] = [
    {
      label: `${plural(spotsPending.totalItems, 'spot', 'spots')} awaiting review`,
      on: spotsPending.totalItems > 0,
    },
    {
      label: `${plural(counts.pendingConsent, 'account', 'accounts')} waiting on a guardian`,
      on: counts.pendingConsent > 0,
    },
    {
      label: `${plural(counts.suspended, 'suspended account', 'suspended accounts')}`,
      on: counts.suspended > 0,
    },
  ];

  const activity: AdminActivityRow[] = audit.map((row) => ({
    id: row.id,
    line: auditLine(row),
    who: row.actor_label ? `@${row.actor_label}` : 'Staff',
    when: shortDateTime(row.created),
  }));

  const barsPanel = (title: string, bars: readonly AdminBar[], note?: string) => (
    <Panel flat style={{ padding: 18 }}>
      <div className="lab" style={{ marginBottom: 13 }}>
        {title}
      </div>
      <div className={styles.bars}>
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className={styles.barHead}>
              <span className="cond" style={{ fontSize: 14.5 }}>
                {bar.label}
              </span>
              <span className="lab" style={{ color: 'var(--ink-3)' }}>
                {bar.count}
              </span>
            </div>
            <Bar
              pct={counts.total > 0 ? (bar.count / counts.total) * 100 : 0}
              color={bar.color}
              height={13}
            />
          </div>
        ))}
        {note && <div className={styles.barNote}>{note}</div>}
      </div>
    </Panel>
  );

  return (
    <div className={styles.stack}>
      <div className={styles.cards}>
        {cards.map((card) => (
          <Panel key={card.label} flat style={{ padding: 16, background: card.hue }}>
            <div className="lab" style={{ color: 'var(--ink-2)' }}>
              {card.label}
            </div>
            <div className="d" style={{ fontSize: 32, marginTop: 6 }}>
              {card.value ?? <span className={styles.pending}>—</span>}
            </div>
            <div className={styles.cardSub}>{card.sub}</div>
          </Panel>
        ))}
      </div>

      <div className={styles.panels}>
        {barsPanel('Riders by plan', planBars)}
        {barsPanel(
          'Riders by sport',
          sportBars,
          `${plural(counts.multiSport, 'rider rides', 'riders ride')} more than one.`,
        )}

        <Panel flat style={{ padding: 18 }}>
          <div className="lab" style={{ marginBottom: 13 }}>
            Needs a human
          </div>
          <div className={styles.attention}>
            {attention.map((row) => (
              <div key={row.label} className={styles.attentionRow}>
                <span className={row.on ? `${styles.dot} ${styles.dotOn}` : styles.dot} />
                <span className="cond" style={{ fontSize: 14.5 }}>
                  {row.label}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel flat style={{ padding: 18 }}>
        <div className="lab" style={{ marginBottom: 13 }}>
          Recent staff activity
        </div>
        {activity.length ? (
          <ul className={styles.activity}>
            {activity.map((row) => (
              <li key={row.id} className={styles.activityRow}>
                <span className="cond" style={{ fontSize: 14.5 }}>
                  <strong>{row.who}</strong> {row.line}
                </span>
                <span className={styles.activityRule} />
                <span className="lab" style={{ color: 'var(--ink-3)' }}>
                  {row.when}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>
            Nothing yet. Every plan change and suspension made in this portal appears here.
          </p>
        )}
        <p className={styles.footnote}>
          Staff actions only, newest first, times in UTC. The full log — including the row
          PocketBase writes inside every audited change — is in the database.
        </p>
      </Panel>
    </div>
  );
}
