import { CATS, TIERS_LABEL, categoryLabel, type Trick } from '@landit/core';
import { Difficulty, Icon, Panel, SportChip, Tag } from '@landit/ui-web';
import Link from 'next/link';

import { ROUTES, trickHref } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';

import styles from './trick.module.css';

/**
 * What a rookie sees when they open a Spicy, Gnarly or Pro trick (screenshot 10).
 *
 * Two things this page deliberately does **not** do. It does not hide the trick
 * — the name, the category, the sport and the difficulty are all here, because
 * "locked tricks stay visible throughout, never hidden" (handoff) and a rider
 * is owed a straight answer about what they are missing. And it does not render
 * the lowdown, the tips, the fun fact or the stage picker: those are the thing
 * behind the tier, and the copy says so rather than showing them greyed out.
 *
 * The page is the *expression* of the paywall, never the paywall itself. The
 * refusal lives in the `trick_progress` hook and holds on every write path
 * (plan §3, guarantee 3), so nothing here is load-bearing for the guarantee —
 * which is exactly why an e2e test watches this page: it is the half that can
 * be edited away without anything failing.
 */
export function LockedTrick({
  trick,
  prereqs,
  landedIds,
  lockedPrereqIds,
}: {
  trick: Trick;
  /** What this one is built on, in the order the library lists them. */
  prereqs: readonly Trick[];
  /** Which of those the rider has already landed. */
  landedIds: readonly string[];
  /** Which of those are themselves behind the paywall. */
  lockedPrereqIds: readonly string[];
}) {
  const tier = TIERS_LABEL[trick.diff - 1];
  const category = CATS[trick.cat];

  return (
    <div>
      <Link className={`cond ${styles.back}`} href={ROUTES.library}>
        <Icon name="back" size={16} /> All tricks
      </Link>

      <Panel className={styles.panel}>
        <div className={`${styles.header} ${styles.headerLocked}`}>
          <div style={{ minWidth: 0 }}>
            <div className={styles.headerTags}>
              <Tag color={category.color}>{categoryLabel(trick.cat, trick.sport)}</Tag>
              <SportChip sport={SPORT_LOOKS[trick.sport]} />
            </div>
            <h1 className={`d ${styles.nameLocked}`}>{trick.name}</h1>
          </div>
          <div className={styles.difficulty}>
            <div className="lab" style={{ color: 'var(--ink-2)' }}>
              Difficulty · {tier}
            </div>
            <Difficulty value={trick.diff} />
          </div>
        </div>

        <div className={styles.lockBody}>
          <span className={styles.lockMark}>
            <Icon name="lock" size={27} strokeWidth={2.4} />
          </span>
          <div className={`d ${styles.lockTitle}`}>{tier} tier is on Shredder</div>
          <p className={styles.lockCopy}>
            Rookie covers the {TIERS_LABEL[0]} and {TIERS_LABEL[1]} tiers. The lowdown, the tips and
            the tracking for this one come with Shredder, along with the rest of the {tier} tier.
          </p>
          <div className={styles.lockActions}>
            {/*
              T15 landed `/plans`, so the button that had lost its href to
              `typedRoutes` has it back (LESSONS §3a). It is a link rather than a
              button because it navigates, and a rider should be able to open it
              in a new tab (issue #53's shape).
            */}
            <Link className="btn" href={ROUTES.plans}>
              See plans
            </Link>
            <Link className="btn ghost" href={ROUTES.library}>
              Back to the library
            </Link>
          </div>

          {prereqs.length > 0 && (
            <div className={styles.lockPrereqs}>
              <div className="lab" style={{ color: 'var(--ink-3)' }}>
                You&rsquo;d want these first
              </div>
              <div className={styles.lockPrereqRow}>
                {prereqs.map((prereq) => {
                  const landed = landedIds.includes(prereq.id);
                  const locked = lockedPrereqIds.includes(prereq.id);
                  return (
                    <Link
                      key={prereq.id}
                      href={trickHref(prereq.id)}
                      className={`pill ${styles.pillLink}${landed ? ` ${styles.pillLanded}` : ''}${
                        locked ? ` ${styles.pillLocked}` : ''
                      }`}
                    >
                      {landed && <Icon name="check" size={12} strokeWidth={3} />}
                      {locked && <Icon name="lock" size={11} strokeWidth={2.8} />}
                      {prereq.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
