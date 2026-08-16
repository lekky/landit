import { PLAN, type PlanId } from '@landit/core';
import { Button, Panel, Slot } from '@landit/ui-web';

import styles from './trick.module.css';

/**
 * "Your clips", in its locked state — which is the only state it has yet.
 *
 * Clips are T14: the upload, the R2 storage, the token-gated playback and the
 * per-plan cap all land there (plan §7). What T7 owes is the panel's *place* on
 * the page and the upsell a free rider sees (screenshot 09), so that is what
 * this is, and a paid rider is told plainly that filming is not switched on
 * rather than being shown an upload button that does nothing.
 *
 * The upsell is a statement, not a squeeze: what the plan includes, no
 * countdown, no "you're missing out" (plan §6.4, standard 13). `/plans` is a
 * later task, so "See plans" renders as a label rather than a dead link
 * (LESSONS §3a).
 */
export function ClipsPanel({ plan }: { plan: PlanId }) {
  const clipsIncluded = PLAN[plan].clipCapBytes > 0;

  return (
    <Panel flat className={styles.sidePanel}>
      <div className={styles.panelHead}>
        <div className="lab">Your clips</div>
        <span
          className={`lab ${styles.panelHeadEnd}`}
          style={{ color: clipsIncluded ? 'var(--ink-3)' : 'var(--violet)' }}
        >
          {clipsIncluded ? PLAN[plan].name : 'Shredder'}
        </span>
      </div>

      {clipsIncluded ? (
        <>
          <Slot label="Filming lands with clips" minHeight={90} />
          <p className={`cond ${styles.clipNote}`} style={{ marginTop: 10 }}>
            Saving clips is part of your plan. It is not switched on yet.
          </p>
        </>
      ) : (
        <>
          <div className={`slot ${styles.clipSlot}`}>
            <span style={{ color: 'var(--ink-2)' }}>Filming your attempts is part of Shredder</span>
          </div>
          <Button size="sm" wide disabled style={{ background: 'var(--violet)' }}>
            See plans
          </Button>
          <p className={`cond ${styles.clipNote}`} style={{ marginTop: 10 }}>
            Upgrading is not switched on yet.
          </p>
        </>
      )}
    </Panel>
  );
}
