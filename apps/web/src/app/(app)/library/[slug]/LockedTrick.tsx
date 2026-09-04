import { CATS, TIERS_LABEL, categoryLabel, type Trick } from '@landit/core';
import { Difficulty, Icon, Panel, SportChip, Tag } from '@landit/ui-web';
import Link from 'next/link';

import { ROUTES, trickHref } from '@/lib/routes';
import { SPORT_LOOKS } from '@/lib/sports';

import { PaywallSeen } from './PaywallSeen';

import styles from './trick.module.css';

/**
 * What a rookie sees when they open a locked trick (screenshot 10). Not "a
 * Spicy, Gnarly or Pro trick", which is what this said until 2026-09-04: the
 * free tier is a hand-picked spread rather than a tier line, so a locked trick
 * can sit at any difficulty and a free one can sit well above Easy (`PLANS` in
 * `@landit/core`, issue #286).
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
      {/* Renders nothing; counts the paywall being seen (§6.8). */}
      <PaywallSeen trickId={trick.id} sport={trick.sport} tier={tier} />

      <Link className={`cond ${styles.back}`} href={ROUTES.library}>
        <Icon name="back" size={16} /> All tricks
      </Link>

      <Panel className={styles.panel}>
        <div className={`${styles.header} ${styles.headerLocked}`}>
          <div className={styles.headerText}>
            <div className={styles.headerTags}>
              <Tag color={category.color}>{categoryLabel(trick.cat, trick.sport)}</Tag>
              <SportChip sport={SPORT_LOOKS[trick.sport]} />
            </div>
            <h1 className={`d ${styles.nameLocked}`}>{trick.name}</h1>
          </div>
          {/* Stacked, matching the unlocked header above it — the two are the
              same band and a rider moving between them should not see it
              re-arrange itself. */}
          <div className={styles.difficulty}>
            <div className="lab" style={{ color: 'var(--ink-2)' }}>
              Difficulty
            </div>
            <div className={`d ${styles.difficultyTier}`} style={{ color: 'var(--ink-2)' }}>
              {tier}
            </div>
            <Difficulty value={trick.diff} />
          </div>
        </div>

        <div className={styles.lockBody}>
          <span className={styles.lockMark}>
            <Icon name="lock" size={27} strokeWidth={2.4} />
          </span>
          {/*
            Not "{tier} tier is on Shredder" / "Rookie covers the Rookie and
            Easy tiers", which is what this said until 2026-09-04. Both were
            false: the free tier is a hand-picked spread of ten tricks per sport
            reaching well past Easy, so a Spicy trick may be free and an Easy
            one may be locked (`PLANS` in `@landit/core`, issue #286). This is
            the screen where a rider decides whether to ask a parent for £3.99,
            which makes it the worst place in the product for a claim about what
            is free to be wrong. It now says what is true of *this* trick and
            makes no promise about its neighbours.
          */}
          <div className={`d ${styles.lockTitle}`}>This one is on Shredder</div>
          <p className={styles.lockCopy}>
            Rookie covers ten hand-picked tricks in every sport, and this is not one of them. The
            lowdown, the tips and the tracking for it come with Shredder, along with every other
            trick in the library.
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
