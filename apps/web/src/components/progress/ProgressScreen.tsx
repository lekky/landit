'use client';

import type { PlanId, SportId } from '@landit/core';
import { Bar, Panel, SectionHead, SkillNode, Tag } from '@landit/ui-web';

import type { SportProgressView } from '@/app/(app)/progress/view';
import { SectionTabs } from '@/components/shell/SectionTabs';
import { PROGRESS_TABS } from '@/components/shell/nav';
import { SportSwitch } from '@/components/shell/SportSwitch';
import { trickHref } from '@/lib/routes';
import { useSport } from '@/providers/sport';
import { useRouter } from 'next/navigation';

import { InsightsPanel } from './InsightsPanel';
import { PrintableSheets } from './PrintableSheets';
import styles from './progress.module.css';

/**
 * Progress: by category, by stage, over time, the skill tree, insights and the
 * printable sheets (screenshots 11–13).
 *
 * A client component only because the sport switch is client state. Every
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
};

export function ProgressScreen({
  views,
  plan,
  entitledToInsights,
  optedIntoInsights,
}: ProgressScreenProps) {
  const { sport } = useSport();
  const router = useRouter();
  const view = views.find((v) => v.sport === sport) ?? views[0];

  if (!view) {
    return (
      <div className={styles.screen}>
        <SectionTabs tabs={PROGRESS_TABS} label="Progress" />

        <div className={styles.headHold}>
          <span className="eyebrow">Progress</span>
          <h1 className={`d ${styles.head}`}>Where you&rsquo;re at</h1>
        </div>
        <Panel className={styles.pad}>
          <p className={styles.plain}>
            Pick a sport in your account and this fills up as you track tricks.
          </p>
        </Panel>
      </div>
    );
  }

  const pctOf = (id: SportId) => `${views.find((v) => v.sport === id)?.pct ?? 0}%`;
  const peak = Math.max(1, ...view.months.map((m) => m.n));

  return (
    <div className={styles.screen}>
      <SectionTabs tabs={PROGRESS_TABS} label="Progress" />

      <div className={styles.headHold}>
        <span className="eyebrow">Progress</span>
        <h1 className={`d ${styles.head}`}>Where you&rsquo;re at</h1>
      </div>

      <SportSwitch note={pctOf} label="Progress by sport" />

      <div className={styles.topGrid}>
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
              <span className={`d ${styles.stageCount} ${styles.muted}`}>{view.untouched}</span>
            </div>
          </div>
        </Panel>
      </div>

      <div>
        <SectionHead>Over time</SectionHead>
        <Panel className={styles.pad}>
          <div className={styles.timeGrid}>
            <div>
              <div className={styles.timeHead}>
                <span className={`d ${styles.timeTotal}`}>{view.landedInWindow}</span>
                <span className={`cond ${styles.timeLede}`}>
                  {view.sportShort.toLowerCase()} tricks landed in the last six months
                </span>
              </div>
              <div className={styles.chart}>
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
                <p className={styles.plain}>
                  Nothing landed on the {view.sportShort.toLowerCase()} yet. The first one dates
                  itself.
                </p>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <div>
        <SectionHead>Insights</SectionHead>
        <InsightsPanel
          insights={view.insights}
          entitled={entitledToInsights}
          optedIn={optedIntoInsights}
        />
      </div>

      <div>
        <SectionHead>Skill tree</SectionHead>
        <p className={styles.treeLede}>
          Tricks unlock tricks. Land the ones on the left and the next column opens up.
          {view.lockedCount > 0 && view.lockedTiers
            ? ` The ${view.lockedTiers} nodes need Shredder.`
            : ''}
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

      <PrintableSheets
        plan={plan}
        sportLabel={view.sportLabel}
        rows={view.sheet}
        landed={view.landed}
        total={view.total}
      />
    </div>
  );
}
