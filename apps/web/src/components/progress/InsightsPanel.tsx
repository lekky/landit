'use client';

import { Bar, Button, Difficulty, Icon, Panel, Slot, Tag } from '@landit/ui-web';
import Link from 'next/link';
import { useActionState } from 'react';

import { setInsightsAction, type InsightsFormState } from '@/app/(app)/progress/actions';
import type { InsightsView } from '@/app/(app)/progress/view';
import { ROUTES } from '@/lib/routes';

import styles from './progress.module.css';

/**
 * Progress insights — Legend's per-category trends, personal records and
 * next-trick suggestions (plan §2.4).
 *
 * Three states, and the middle one is the important one:
 *
 * 1. **Not entitled.** The house upsell pattern: violet flag, violet slot, the
 *    plain sentence about what it is, and — since T15 landed the route — a way
 *    to go and read what Legend costs. (This pattern was set by the clips panel,
 *    which was removed when clip hosting was reversed on 2026-08-17; this is now
 *    the only screen that uses it.)
 * 2. **Entitled, not opted in.** An invitation, not a panel. Insights are
 *    profiling under the Children's code (plan §6.4, standard 12), so they are
 *    off by default *even on Legend* — paying for a feature is not asking for
 *    it. This state says in plain words what would be looked at, that it is
 *    only ever the rider's own riding, and that it can be turned off again;
 *    then it asks.
 * 3. **Opted in.** The panel, plus the way back out at the same size as the
 *    way in. No countdown, no "you'll lose", nothing that nudges (§6.4,
 *    standard 13).
 *
 * Nothing here decides anything. When the panel is absent so is the data: the
 * server does not compute insights for a rider who has not opted in, so this
 * component cannot leak them by rendering the wrong branch.
 */

export type InsightsPanelProps = {
  readonly insights: InsightsView | null;
  readonly entitled: boolean;
  readonly optedIn: boolean;
};

export function InsightsPanel({ insights, entitled, optedIn }: InsightsPanelProps) {
  const [state, action, pending] = useActionState<InsightsFormState | undefined, FormData>(
    setInsightsAction.bind(null, !optedIn),
    undefined,
  );

  if (!entitled) {
    return (
      <Panel flat className={styles.pad}>
        <div className={styles.insightsHead}>
          <div className="lab">Progress insights</div>
          <span className={`lab ${styles.insightsFlag}`}>Legend</span>
        </div>
        <Slot
          className={styles.lockSlot}
          minHeight={90}
          label={
            <span className={styles.lockCopy}>
              Trends, personal records and what to try next — part of Legend
            </span>
          }
        />
        <p className={styles.plain}>
          Legend riders can switch on a read of their own riding: which categories they have been
          landing lately, their own records, and which trick the skill tree says is closest. It is
          always their choice, and always only their own tricks.
        </p>
        <Link className="btn ghost sm" href={ROUTES.plans}>
          See plans
        </Link>
      </Panel>
    );
  }

  if (!optedIn || !insights) {
    return (
      <Panel flat className={styles.pad}>
        <div className={styles.insightsHead}>
          <div className="lab">Progress insights</div>
          <span className={`lab ${styles.muted}`}>Off</span>
        </div>
        <div className={styles.optIn}>
          <p className={styles.plain}>
            Insights read back over the tricks you have logged and tell you three things: which
            categories you have been landing lately, a few of your own records, and which trick the
            skill tree reckons is closest. They are off unless you ask for them.
          </p>
          <ul className={styles.optInPromises}>
            <li>Only your own tricks are ever looked at. Nobody else&rsquo;s, ever.</li>
            <li>Nothing new is collected — it is the log you already keep.</li>
            <li>You can turn it off again whenever you like, right here.</li>
          </ul>
          <form action={action} className={styles.optInRow}>
            <Button type="submit" disabled={pending}>
              {pending ? 'Turning on…' : 'Turn insights on'}
            </Button>
            <span className={`cond ${styles.muted}`} style={{ fontSize: 13 }}>
              Nothing happens until you press it.
            </span>
          </form>
          {state?.error && <p className={styles.error}>{state.error}</p>}
        </div>
      </Panel>
    );
  }

  return (
    <Panel className={styles.pad}>
      <div className={styles.insightsHead}>
        <div className="lab">Progress insights</div>
        <span className={`lab ${styles.muted}`}>{insights.windowLabel}</span>
      </div>

      <div className={styles.insightsGrid}>
        <div>
          <div className="lab" style={{ marginBottom: 12 }}>
            By category, lately
          </div>
          <div className={styles.trendList}>
            {insights.trends.map((trend) => (
              <div key={trend.cat}>
                <div className={styles.catRow}>
                  <span className={`cond ${styles.catName}`}>{trend.label}</span>
                  <span className={`lab ${styles.muted}`}>
                    {trend.recent} recent · {trend.previous} before
                  </span>
                </div>
                <Bar
                  pct={trend.total ? (trend.landed / trend.total) * 100 : 0}
                  color={trend.color}
                  height={13}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="lab" style={{ marginBottom: 12 }}>
            Your records
          </div>
          {insights.records.length ? (
            <div className={styles.recordGrid}>
              {insights.records.map((record) => (
                <div key={record.id} className={styles.record}>
                  <div className={`lab ${styles.muted}`}>{record.label}</div>
                  <div className={`d ${styles.recordValue}`}>{record.value}</div>
                  {record.detail && (
                    <div className={`cond ${styles.muted}`} style={{ fontSize: 13 }}>
                      {record.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.plain}>
              Records show up once there is something to measure. Log a trick and they start.
            </p>
          )}
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <div className="lab" style={{ marginBottom: 12 }}>
          What the tree says is closest
        </div>
        {insights.next.length ? (
          <div className={styles.nextList}>
            {insights.next.map((next) => (
              <div key={next.id} className={styles.next}>
                <span className={`d ${styles.nextName}`}>{next.name}</span>
                <div className={styles.nextMeta}>
                  <Tag color={next.color} style={{ fontSize: 11 }}>
                    {next.label}
                  </Tag>
                  <Difficulty value={next.diff} small />
                </div>
                <span className={`cond ${styles.muted}`} style={{ fontSize: 13 }}>
                  {next.why}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.plain}>
            Nothing left that is unlocked and unlanded here — which is its own kind of answer.
          </p>
        )}
      </div>

      <form action={action} className={styles.optInRow} style={{ marginTop: 22 }}>
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          <Icon name="chart" size={15} strokeWidth={2.4} />
          {pending ? 'Turning off…' : 'Turn insights off'}
        </Button>
        <span className={`cond ${styles.muted}`} style={{ fontSize: 13 }}>
          Turning it off leaves every trick you have logged exactly where it is.
        </span>
      </form>
      {state?.error && <p className={styles.error}>{state.error}</p>}
    </Panel>
  );
}
