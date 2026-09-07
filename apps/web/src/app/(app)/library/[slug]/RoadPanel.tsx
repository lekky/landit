import {
  CATS,
  isTrickLanded,
  isTrickLocked,
  type PlanId,
  type RoadStep,
  type StageId,
  type Trick,
} from '@landit/core';
import { Icon, Panel } from '@landit/ui-web';
import type { CSSProperties } from 'react';

import { trickHref } from '@/lib/routes';

import { TrickLink } from './TrickLink';
import styles from './trick.module.css';

/**
 * "The road to it" (T31, section B): the whole prerequisite chain from its
 * root down to this trick, one pill per step joined by an ink line, with
 * "Land this and you unlock" under it.
 *
 * It replaces the "Built on" pill row, which showed only the immediate
 * prerequisite — one word of an answer to "how far am I from this?". The chain
 * is `fullPrereqChain` in `@landit/core`; this file only draws it. Three states
 * on a step, and each is the mark the rest of the page already uses for it:
 * landed is lime with a tick (the ladder, the library grid), behind the paywall
 * is the hatch with a padlock and the name of the plan that opens it (the
 * locked card), and this trick is the category colour with "You are here".
 *
 * Signed out nothing is ticked, because `byId` is empty for a visitor and no
 * step is landed. The plan name still shows on a paywalled step: it is a
 * catalogue fact, not a rider one, and a visitor deciding whether to sign up
 * is exactly who should see it.
 */
export function RoadPanel({
  trick,
  steps,
  byId,
  plan,
  unlocks,
  unlockPlanName,
}: {
  trick: Trick;
  steps: readonly RoadStep[];
  byId: Readonly<Record<string, StageId>>;
  plan: PlanId;
  /** What landing this one opens, from `tricksUnlockedBy`. */
  unlocks: readonly Trick[];
  /** "Shredder" — the cheapest live plan that unlocks paid tricks. */
  unlockPlanName: string;
}) {
  const category = CATS[trick.cat];
  const hereStyle: CSSProperties = { background: category.color };
  const alone = steps.length === 1;

  return (
    <Panel flat className={`${styles.sidePanel} ${styles.road}`}>
      <div className={`d ${styles.panelTitle}`}>The road to it</div>

      {alone ? (
        <div className={styles.roadRow}>
          <span className={`${styles.roadPill} ${styles.roadPillHere}`} style={hereStyle}>
            {trick.name}
          </span>
          <span className={`lab ${styles.roadSide}`}>You are here · where every road starts</span>
        </div>
      ) : (
        <ol className={styles.roadSteps}>
          {steps.map((step, index) => {
            const here = step.trick.id === trick.id;
            const landed = !here && isTrickLanded(byId, step.trick.id);
            const locked = !here && isTrickLocked(step.trick, plan);
            return (
              <li key={step.trick.id} className={styles.roadStep}>
                {index > 0 && <span className={styles.roadJoin} aria-hidden="true" />}
                <div className={styles.roadRow}>
                  {here ? (
                    <span
                      className={`${styles.roadPill} ${styles.roadPillHere}`}
                      style={hereStyle}
                      aria-current="page"
                    >
                      {step.trick.name}
                    </span>
                  ) : (
                    <TrickLink
                      kind="road"
                      from={trick.id}
                      to={step.trick.id}
                      href={trickHref(step.trick.id)}
                      className={`${styles.roadPill}${landed ? ` ${styles.roadPillLanded}` : ''}${locked ? ` ${styles.roadPillLocked}` : ''}`}
                    >
                      {landed && <Icon name="check" size={12} strokeWidth={3} />}
                      {locked && <Icon name="lock" size={11} strokeWidth={2.8} />}
                      {step.trick.name}
                    </TrickLink>
                  )}
                  {here && <span className={`lab ${styles.roadSide}`}>You are here</span>}
                  {locked && (
                    <span className={`lab ${styles.roadSide}`}>{unlockPlanName} plan</span>
                  )}
                  {/*
                    A second prerequisite, hung off the step that needs it. The
                    library's graph is almost entirely chains, so this is rare;
                    when it happens the rider still sees every trick the step
                    is built on, and the road stays one line.
                  */}
                  {step.also.map((other) => {
                    const otherLanded = isTrickLanded(byId, other.id);
                    const otherLocked = isTrickLocked(other, plan);
                    return (
                      <span key={other.id} className={styles.roadAlso}>
                        <span className={`lab ${styles.roadSide}`}>with</span>
                        <TrickLink
                          kind="road"
                          from={trick.id}
                          to={other.id}
                          href={trickHref(other.id)}
                          className={`${styles.roadPill}${otherLanded ? ` ${styles.roadPillLanded}` : ''}${otherLocked ? ` ${styles.roadPillLocked}` : ''}`}
                        >
                          {otherLanded && <Icon name="check" size={12} strokeWidth={3} />}
                          {otherLocked && <Icon name="lock" size={11} strokeWidth={2.8} />}
                          {other.name}
                        </TrickLink>
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {unlocks.length > 0 && (
        <>
          {/* "You unlocked" once it is landed, which is the pack's wording and
              the honest tense for it. Unchanged from T26. */}
          <div className={`lab ${styles.unlocksLabel}`}>
            {isTrickLanded(byId, trick.id) ? 'You unlocked' : 'Land this and you unlock'}
          </div>
          <div className={styles.pillRow}>
            {unlocks.map((next) => {
              const locked = isTrickLocked(next, plan);
              const landed = isTrickLanded(byId, next.id);
              return (
                <TrickLink
                  key={next.id}
                  kind="unlocks"
                  from={trick.id}
                  to={next.id}
                  href={trickHref(next.id)}
                  className={`pill ${styles.pillLink}${locked ? ` ${styles.pillLocked}` : ''}${landed ? ` ${styles.pillLanded}` : ''}`}
                >
                  {locked && <Icon name="lock" size={11} strokeWidth={2.8} />}
                  {landed && <Icon name="check" size={12} strokeWidth={3} />}
                  {next.name}
                </TrickLink>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
