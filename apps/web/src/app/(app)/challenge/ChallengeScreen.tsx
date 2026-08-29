'use client';

import { Bar, Button, Empty, Panel, SectionHead, Tag } from '@landit/ui-web';
import { useTransition } from 'react';

import { SportSwitch } from '@/components/shell/SportSwitch';
import { useSport } from '@/providers/sport';
import { useToast } from '@/providers/toast';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import { logChallengeAction } from './actions';
import styles from './challenge.module.css';
import type { ChallengeSportView } from './view';

/**
 * The weekly challenge (screenshot 17).
 *
 * A client component only because the sport tabs are client state; every
 * string and number on it was computed on the server (`view.ts`).
 *
 * Two things it deliberately does not do:
 *
 * - **It does not decide whether a log is allowed.** `canLog` draws the button
 *   enabled or disabled; the refusal is in the PocketBase hook, on every write
 *   path. If the two ever disagree the server wins and the rider is told why.
 * - **It never says what a rider is about to lose.** Plan §6.4, standard 13:
 *   the copy states what has been done ("1 of 3 logged"), the reward is named
 *   once, and a finished week is reported in the past tense with nothing
 *   attached. No countdown, no "don't break it", no notification.
 */

export function ChallengeScreen({ views }: { readonly views: readonly ChallengeSportView[] }) {
  const { sport, sports, setSport } = useSport();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const view = views.find((v) => v.sport === sport) ?? views[0];
  const other = sports.find((id) => id !== view?.sport);
  const otherView = other ? views.find((v) => v.sport === other) : undefined;

  if (!view) {
    return (
      <div className={styles.page}>
        <span className="eyebrow">Weekly challenge</span>
        <h1 className={`d ${styles.head}`}>Nothing scheduled</h1>
      </div>
    );
  }

  const current = view.current;
  // A free rider is sent no results at all, so this is also "is history paid?".
  const historyShown = view.past.some((w) => w.result);

  const log = () => {
    if (!current) return;
    startTransition(async () => {
      const result = await logChallengeAction(current.id);
      if (result.error) {
        toast(result.error, 'var(--red)');
        return;
      }
      // The challenge id is catalogue data — the same string for everyone who
      // sees this week's challenge.
      capture(ANALYTICS_EVENTS.challengeLogged, { challenge: current.id });
      toast(`Logged. ${current.title}.`, current.hue);
    });
  };

  return (
    <div className={styles.page}>
      <SportSwitch
        note={(id) => views.find((v) => v.sport === id)?.current?.title ?? '—'}
        label="Challenge by sport"
      />

      <div>
        <span className="eyebrow">Weekly challenge · {view.sportLabel}</span>
        <h1 className={`d ${styles.head}`}>{current ? current.week : 'Nothing scheduled'}</h1>
      </div>

      {current ? (
        <Panel className={styles.card}>
          <div className={styles.banner} style={{ background: current.hue }}>
            <div className={styles.bannerTop}>
              <Tag
                color={current.state === 'live' ? 'var(--ink)' : 'var(--paper)'}
                className={current.state === 'live' ? undefined : styles.tagInk}
              >
                {current.stateLabel}
              </Tag>
              <span className={`lab ${styles.range}`}>{current.range}</span>
            </div>
            <div className={`d ${styles.title}`}>{current.title}</div>
            <p className={styles.blurb}>{current.blurb}</p>
          </div>

          <div className={styles.body}>
            <div className={styles.progress}>
              <div className={styles.progressHead}>
                <span className="lab">Your progress</span>
                <span className="lab">
                  {current.logged} / {current.goal}
                </span>
              </div>
              <Bar pct={current.pct} color={current.hue} />
              {current.reward && (
                <p className={`cond ${styles.reward}`}>
                  Reward · {current.reward}
                  {current.rewardHeld ? ' · already on your wall' : ''}
                </p>
              )}
            </div>

            <Button
              onClick={log}
              disabled={!current.canLog || pending}
              aria-label={current.canLog ? `${current.buttonLabel}: ${current.title}` : undefined}
            >
              {pending ? 'Logging…' : current.buttonLabel}
            </Button>
          </div>
        </Panel>
      ) : (
        <Empty
          icon="bolt"
          title="No challenge running"
          sub={`Nothing scheduled for ${view.sportLabel.toLowerCase()} right now. Staff set these a few weeks ahead.`}
        />
      )}

      {otherView && other && (
        <Panel flat className={styles.other}>
          <span className="lab">The other one</span>
          <span className={`cond ${styles.otherTitle}`}>
            {otherView.current ? otherView.current.title : 'Nothing on'}
          </span>
          {otherView.current && (
            <span className={`lab ${styles.muted}`}>
              {otherView.current.logged} of {otherView.current.goal} logged
            </span>
          )}
          <Button size="sm" variant="ghost" className={styles.push} onClick={() => setSport(other)}>
            Switch to it
          </Button>
        </Panel>
      )}

      {view.upcoming.length > 0 && (
        <div>
          <SectionHead>Coming up</SectionHead>
          <div className={styles.upcoming}>
            {view.upcoming.map((week) => (
              <Panel flat key={week.id} className={styles.weekCard}>
                <div className={styles.weekStripe} style={{ background: week.hue }} />
                <div className={styles.weekBody}>
                  <div className={styles.weekHead}>
                    <span className={`lab ${styles.muted}`}>{week.week}</span>
                    <span className={`lab ${styles.muted} ${styles.push}`}>{week.range}</span>
                  </div>
                  <div className={`d ${styles.weekTitle}`}>{week.title}</div>
                  <p className={styles.weekBlurb}>{week.blurb}</p>
                </div>
              </Panel>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionHead>Past weeks</SectionHead>
        {view.hasHistory ? (
          <div className={styles.pastHold}>
            <div className={historyShown ? styles.past : `${styles.past} ${styles.blurred}`}>
              {view.past.map((week) => (
                <Panel flat key={week.id} className={styles.pastCard}>
                  <div className={styles.weekHead}>
                    <span className={`lab ${styles.muted}`}>{week.week}</span>
                    <span className={`lab ${styles.muted} ${styles.push}`}>{week.range}</span>
                  </div>
                  <div className={`d ${styles.weekTitle}`}>{week.title}</div>
                  {/*
                    A free rider is not sent the result at all — see `view.ts`.
                    The placeholder keeps the card the same height so the panel
                    over it covers a real shape rather than a gap.
                  */}
                  <Tag color={week.result?.color ?? 'var(--ink-3)'}>
                    {week.result?.label ?? '· · ·'}
                  </Tag>
                </Panel>
              ))}
            </div>

            {!historyShown && (
              <div className={styles.lockHold}>
                <div className={styles.lock}>
                  <div className={`d ${styles.lockTitle}`}>Challenge history</div>
                  <p className={`cond ${styles.lockNote}`}>
                    Kept on Shredder and above. Logging a challenge, and the sticker for finishing
                    one, are the same on every plan.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Empty
            icon="bolt"
            title="No history yet"
            sub="Finished weeks land here with what you managed."
          />
        )}
      </div>
    </div>
  );
}
