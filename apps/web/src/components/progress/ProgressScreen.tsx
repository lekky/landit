'use client';

import type { PlanId } from '@landit/core';
import { Bar, Panel, SectionHead, SkillNode, Tag } from '@landit/ui-web';
import { useState } from 'react';

import type { SportProgressView } from '@/app/(app)/progress/view';
import { BackLink } from '@/components/shell/BackLink';
import { TAB_PANEL, TabRow, type TabRowItem } from '@/components/shell/TabRow';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { ROUTES, trickHref } from '@/lib/routes';
import { useSport } from '@/providers/sport';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { InsightsPanel } from './InsightsPanel';
import { PrintableSheets } from './PrintableSheets';
import { trendLine } from './trend';
import styles from './progress.module.css';

/**
 * Progress: by category, by stage, over time, the skill tree, insights and the
 * printable sheets (screenshots 11–13).
 *
 * **Three tabs, and no sport row** (rethink §3.10). The screen used to be one
 * long scroll under two rows of tabs — a navigation row (Sessions / Where
 * you're at) and a sport row that looked exactly like it, which issue #379 item
 * 5 logged as a collision. Both are gone. The sport is the top bar's chip now
 * (D5), so every number here follows it through `useSport` exactly as it
 * followed the row; and the screen's own length is a `TabRow` of **Record ·
 * Over time · Skill tree**, which is what a rider actually chooses between.
 *
 * `TabRow` fires `tabs_switched` `{ group: 'progress', tab }` itself, so this
 * screen cannot forget it (§3.3) — and the tab ids are the catalogue's, never
 * anything about the rider.
 *
 * **Where you're at, and it does not redirect** (issue #522, owner 2026-09-16
 * in chat, option 1). `/progress` is this screen and stays it; the Sessions
 * diary is its own address, reached from its own Home card. The two used to
 * share a tab row, which is what made "which one does `/progress` mean" a
 * question at all.
 *
 * A client component because the sport and the tab are client state. Every
 * number on it was computed on the server, from the rider's own rows, and
 * arrives as plain strings — see `app/(app)/progress/view.ts` for why, and for
 * why no month name or date on this screen comes out of ICU.
 *
 * The lock states here are **drawings, not decisions**. A paywalled node is
 * hatched violet because the server said the rider's plan does not unlock it;
 * the refusal itself lives in the `trick_progress` hook, on every write path
 * (plan §3, guarantee 3). Nothing on this screen is load-bearing for it.
 */

export type ProgressScreenProps = {
  readonly views: readonly SportProgressView[];
  readonly plan: PlanId;
  readonly entitledToInsights: boolean;
  readonly optedIntoInsights: boolean;
  /**
   * Owner-only preview (T41).
   *
   * It no longer draws anything on this screen — the Sessions diary is reached
   * from its own Home card now, not from a tab row here — but the prop stays
   * because the page has the answer and `SessionsScreen` is T50's to reshape.
   * Removing it would be a change to a signature another task is holding.
   */
  readonly sessionsEnabled: boolean;
};

/** The three tabs, in the order §3.10 names them. */
const TABS: readonly TabRowItem[] = [
  { id: 'record', label: 'Record', icon: 'chart' },
  { id: 'over-time', label: 'Over time', icon: 'clock' },
  { id: 'skill-tree', label: 'Skill tree', icon: 'grid' },
];

export function ProgressScreen({
  views,
  plan,
  entitledToInsights,
  optedIntoInsights,
}: ProgressScreenProps) {
  const { sport } = useSport();
  const router = useRouter();
  const [tab, setTab] = useState<string>('record');
  const view = views.find((v) => v.sport === sport) ?? views[0];

  const head = (
    <>
      <BackLink href={ROUTES.dashboard} label="Home" />
      <div className={styles.headHold}>
        <span className="eyebrow">Progress</span>
        <h1 className={`d ${styles.head}`}>Where you&rsquo;re at</h1>
      </div>
    </>
  );

  if (!view) {
    return (
      <div className={styles.screen}>
        {head}
        <Panel className={styles.pad}>
          <p className={styles.plain}>
            Pick a sport in your account and this fills up as you track tricks.
          </p>
        </Panel>
      </div>
    );
  }

  const peak = Math.max(1, ...view.months.map((m) => m.n));

  return (
    <div className={styles.screen}>
      {head}

      <TabRow items={TABS} value={tab} group="progress" label="Progress" onChange={setTab} />

      {/*
        Keyed on the tab so React remounts the panel and §4's 120ms cross-fade
        runs on every switch — `TAB_PANEL` is the class, and keying it is what
        makes the animation fire a second time (`TabRow.tsx`).
      */}
      <div
        key={tab}
        role="tabpanel"
        aria-label={TABS.find((t) => t.id === tab)?.label ?? 'Progress'}
        className={`${TAB_PANEL} ${styles.panelStack}`}
      >
        {tab === 'record' && (
          /*
            Record = by category + by stage, with the printable sheets on the
            rail (§3.10). The sheets are on this tab rather than a fourth
            because what they print *is* the record — the rider's list of tricks
            with a box beside each — and a rail is where desktop has the room.
            Below 1100px the rail stacks under the two panels rather than
            vanishing: a paid feature that only exists on a wide screen is a
            paid feature half the riders cannot find.
          */
          <div className={styles.recordGrid}>
            <div className={styles.recordMain}>
              <Panel className={styles.pad}>
                <div className="lab" style={{ marginBottom: 12 }}>
                  {view.sportLabel} by category
                </div>
                <div className={styles.catList}>
                  {view.categories.map((cat) => (
                    <div key={cat.cat}>
                      <div className={styles.catRow}>
                        <span className={`cond ${styles.catName}`}>{cat.label}</span>
                        <span className={`lab ${styles.muted}`}>
                          {cat.count} / {cat.total}
                        </span>
                      </div>
                      <Bar
                        pct={cat.total ? (cat.count / cat.total) * 100 : 0}
                        color={cat.color}
                        height={13}
                      />
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className={styles.pad}>
                <div className="lab" style={{ marginBottom: 12 }}>
                  By stage
                </div>
                <div className={styles.stageList}>
                  {view.stages.map((stage) => (
                    <div key={stage.id} className={styles.stageRow}>
                      <span className={styles.stageChip} style={{ background: stage.color }} />
                      <span className={`cond ${styles.catName}`}>{stage.label}</span>
                      <span className={styles.spacer} />
                      <span className={`d ${styles.stageCount}`}>{stage.n}</span>
                    </div>
                  ))}
                  <div className={styles.untouched}>
                    <span className={`cond ${styles.catName} ${styles.muted}`}>Untouched</span>
                    <span className={styles.spacer} />
                    <span className={`d ${styles.stageCount} ${styles.muted}`}>
                      {view.untouched}
                    </span>
                  </div>
                </div>
              </Panel>
            </div>

            <PrintableSheets
              plan={plan}
              sportLabel={view.sportLabel}
              rows={view.sheet}
              landed={view.landed}
              total={view.total}
            />
          </div>
        )}

        {tab === 'over-time' && (
          <>
            <Panel className={styles.pad}>
              <div className={styles.timeGrid}>
                <div>
                  <div className={styles.timeHead}>
                    <span className={`d ${styles.timeTotal}`}>{view.landedInWindow}</span>
                    <span className={`cond ${styles.timeLede}`}>
                      {view.sportShort.toLowerCase()} tricks landed in the last six months
                    </span>
                  </div>
                  {/*
                    The chart, read out. The sentence is the summary for everyone
                    and sits above the bars; the table is the data for a screen
                    reader and is visually hidden, because six rows under six
                    labelled bars would say the same thing twice to a sighted
                    rider. The bars themselves are `aria-hidden`: without it a
                    screen reader gets "4 Aug 1 Sep 0 Oct" with no structure.
                  */}
                  <p className={`cond ${styles.trend}`}>{trendLine(view.months)}</p>
                  <table className={styles.srTable}>
                    <caption>Tricks landed by month</caption>
                    <thead>
                      <tr>
                        <th scope="col">Month</th>
                        <th scope="col">Landed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.months.map((month) => (
                        <tr key={month.key}>
                          <th scope="row">{month.label}</th>
                          <td>{month.n}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={styles.chart} aria-hidden="true">
                    {view.months.map((month) => (
                      <div key={month.key} className={styles.month}>
                        <span
                          className={`d ${styles.monthCount}`}
                          style={{ color: month.n ? 'var(--ink)' : 'var(--ink-3)' }}
                        >
                          {month.n}
                        </span>
                        <div
                          className={styles.monthBar}
                          style={{
                            height: Math.round(8 + (month.n / peak) * 88),
                            background: month.n ? 'var(--lime)' : 'var(--wash)',
                          }}
                        />
                        <span className={`lab ${styles.muted}`}>{month.label}</span>
                      </div>
                    ))}
                  </div>
                  {view.estimatedInWindow > 0 && (
                    <p className={`cond ${styles.estNote}`}>
                      {view.estimatedInWindow} of these were tracked before dates were recorded, so
                      their month is our best guess rather than the day it happened.
                    </p>
                  )}
                </div>

                <div>
                  <div className="lab" style={{ marginBottom: 12 }}>
                    Latest lands
                  </div>
                  {view.latest.length ? (
                    <div className={styles.landList}>
                      {view.latest.map((land) => (
                        <div key={land.id} className={styles.landRow}>
                          <span className={styles.landDot} style={{ background: land.color }} />
                          <span className={`cond ${styles.landName}`}>{land.name}</span>
                          <span className={styles.spacer} />
                          <span className={`lab ${styles.muted}`}>
                            {land.date}
                            {land.estimated ? ' (about)' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p className={styles.plain}>
                        Nothing landed on the {view.sportShort.toLowerCase()} yet. The first one
                        dates itself.
                      </p>
                      <Link
                        href={ROUTES.library}
                        className="btn ghost sm"
                        style={{ marginTop: 12 }}
                        onClick={() =>
                          capture(ANALYTICS_EVENTS.emptyStateAction, {
                            screen: 'progress',
                            action: 'library',
                          })
                        }
                      >
                        Find a trick
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            {/*
              Insights sit on Over time rather than on a fourth tab: they are
              what the six months mean — the day the rider lands most, the gap
              between trying and landing — and a tab holding one panel is a tab
              that costs a quarter of the row to say one thing.
            */}
            <div>
              <SectionHead>Insights</SectionHead>
              <InsightsPanel
                insights={view.insights}
                entitled={entitledToInsights}
                optedIn={optedIntoInsights}
              />
            </div>
          </>
        )}

        {tab === 'skill-tree' && (
          <div>
            <p className={styles.treeLede}>
              Tricks unlock tricks. Land the ones on the left and the next column opens up.
              {/*
                Not a list of tier names. The free tier is a hand-picked spread across
                every difficulty since T27, so naming the tiers a rookie's locked
                tricks sit in produced "Rookie, Easy, Spicy, Gnarly and Pro" — read
                as "you are missing Rookie" (issue #301). The rest of the product
                says "the rest of the library"; so does this.
              */}
              {view.lockedCount > 0 ? ' The rest of the library needs Shredder.' : ''}
            </p>
            <div className="tree">
              {view.branches.map((branch) => (
                <div key={branch.cat} className="branch">
                  <div className={styles.branchHead}>
                    <Tag color={branch.color} style={{ fontSize: 12 }}>
                      {branch.label}
                    </Tag>
                    <span className={`cond ${styles.branchBlurb}`}>{branch.blurb}</span>
                    <span className={`lab ${styles.branchCount}`}>
                      {branch.landed}/{branch.total}
                    </span>
                  </div>
                  <div className="tier-row">
                    {branch.tiers.map((tier) => (
                      <div
                        key={tier.stage}
                        style={{ display: 'flex', flexDirection: 'column', gap: 9 }}
                      >
                        <span className={`lab ${styles.muted}`}>Stage {tier.stage}</span>
                        {tier.nodes.map((node) => (
                          // Straight into the trick page, the way T7's library grid
                          // opens one. Nodes are keyed by slug, which is what the URL
                          // carries, so this survives a reseed.
                          <SkillNode
                            key={node.id}
                            name={node.name}
                            difficulty={node.diff}
                            state={node.state}
                            onOpen={() => router.push(trickHref(node.id))}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
