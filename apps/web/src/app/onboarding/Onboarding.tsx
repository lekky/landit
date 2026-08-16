'use client';

import {
  CATS,
  CUSTOM_GOAL_ID,
  CUSTOM_GOAL_MAX_LENGTH,
  FREE_MAX_DIFF,
  LEVELS,
  SPORTS,
  SPORT_IDS,
  STAGE,
  STANCES,
  goalsFor,
  type CategoryId,
  type Difficulty,
  type LevelId,
  type SportId,
  type StageId,
  type StanceId,
} from '@landit/core';
import { Avatar, Button, Icon, Panel, Pill, TrickCard, avatarById } from '@landit/ui-web';
import { useMemo, useState } from 'react';

import { browserTimezone } from '@/components/TimezoneField';

import { SPORT_LOOKS } from '@/lib/sports';

import { AvatarPicker } from './AvatarPicker';
import { finishOnboarding } from './actions';
import styles from './onboarding.module.css';

/**
 * The four steps (screenshot 05 is the first of them).
 *
 * Two differences from the prototype, both the plan's:
 *
 * - **Three sport cards, not two.** The grid renders one card per `SPORT_IDS`
 *   entry and is written to take whatever it finds (`.sports` in the stylesheet).
 * - **Step 4 offers what the database has**, not what the canonical data says.
 *   A pick has to be written as `trick_progress`, which keys off a record id, so
 *   the tricks come down with the page. An unseeded database shows an honest
 *   empty state rather than cards that cannot be saved.
 */

/** A trick as step 4 needs it: identity for the write, look for the card. */
export interface OnboardingTrick {
  readonly id: string;
  readonly name: string;
  readonly sport: SportId;
  readonly cat: CategoryId;
  readonly diff: Difficulty;
}

const STEPS = [
  'What you ride',
  "Where you're at",
  "What you're after",
  'First few tricks',
] as const;

/** How hard a suggestion goes, by how far along the rider says they are. */
const LEVEL_CEILING: Record<LevelId, number> = { new: 2, some: 3, solid: 3, send: 3 };

export function Onboarding({ name, tricks }: { name: string; tricks: readonly OnboardingTrick[] }) {
  const [step, setStep] = useState(0);
  const [sports, setSports] = useState<SportId[]>([SPORT_IDS[0]!]);
  const [stance, setStance] = useState<StanceId | null>(null);
  const [level, setLevel] = useState<LevelId | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [picks, setPicks] = useState<Record<string, StageId>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /**
   * A new account is on the free plan, so only offer what a Rookie can actually
   * track — the paywall is enforced in a hook and a locked pick would come back
   * a 403 (plan §3 guarantee 3).
   */
  const suggested = useMemo(() => {
    const ceiling = Math.min(FREE_MAX_DIFF, level ? LEVEL_CEILING[level] : 3);
    const perSport = sports.length > 1 ? 6 : 10;
    return sports.flatMap((sport) =>
      tricks.filter((t) => t.sport === sport && t.diff <= ceiling).slice(0, perSport),
    );
  }, [level, sports, tricks]);

  const last = STEPS.length - 1;
  const goals = useMemo(() => goalsFor(sports), [sports]);

  function toggleSport(id: SportId) {
    setSports((current) =>
      current.includes(id)
        ? // Never empty: the last one cannot be turned off.
          current.length > 1
          ? current.filter((s) => s !== id)
          : current
        : [...current, id],
    );
  }

  function cycle(trickId: string) {
    setPicks((current) => {
      const next = { ...current };
      const stage = current[trickId];
      if (stage === 'trying') next[trickId] = 'most';
      else if (stage === 'most') delete next[trickId];
      else next[trickId] = 'trying';
      return next;
    });
  }

  const blocked =
    (step === 0 && sports.length === 0) ||
    (step === 1 && !level) ||
    (step === 2 && (!goal || (goal === CUSTOM_GOAL_ID && !custom.trim())));

  async function submit() {
    setSaving(true);
    setError(null);
    const result = await finishOnboarding({
      sports,
      stance,
      level,
      goal,
      goalCustom: custom,
      avatarKey,
      picks,
      timezone: browserTimezone(),
    });
    // A successful finish redirects, so anything that comes back is a problem.
    setError(result?.error ?? 'We could not save that. Try again in a moment.');
    setSaving(false);
  }

  return (
    <div className={styles.screen}>
      <div className={styles.column}>
        <div className={styles.steps}>
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`${styles.step} ${i <= step ? styles.stepOn : ''}`}
              aria-hidden="true"
            />
          ))}
        </div>
        <span className="eyebrow">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </span>

        {step === 0 ? (
          <div>
            <h1 className={`d ${styles.head}`}>
              Alright {name.split(' ')[0]}.
              <br />
              What do you ride?
            </h1>
            <p className={styles.lede}>
              Pick as many as you do. It sets which library you see, and you can change it any time
              in your profile.
            </p>

            <div className={styles.sports}>
              {SPORT_IDS.map((id) => {
                const sport = SPORTS[id];
                const on = sports.includes(id);
                const count = tricks.filter((t) => t.sport === id).length;
                return (
                  // A `panel` on a `button`, not a `div`: the class is what the
                  // design system styles, and `button { font: inherit }` in the
                  // token sheet is what keeps it looking like one (LESSONS §3a).
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleSport(id)}
                    aria-pressed={on}
                    className={`panel flat ${styles.sport}`}
                    style={{
                      background: on ? sport.color : 'var(--paper)',
                      color: on ? '#fff' : 'var(--ink)',
                      boxShadow: on ? '5px 5px 0 var(--ink)' : '3px 3px 0 var(--ink)',
                    }}
                  >
                    <span className={styles.sportHead}>
                      <span
                        className={styles.sportIcon}
                        style={{ background: on ? 'var(--paper)' : sport.color }}
                      >
                        <Icon
                          name={SPORT_LOOKS[id].icon}
                          size={22}
                          strokeWidth={2.3}
                          style={{ color: 'var(--ink)' }}
                        />
                      </span>
                      <span className={`d ${styles.sportName}`}>{sport.label}</span>
                    </span>
                    <span className={`cond ${styles.sportBlurb}`}>{sport.blurb}</span>
                    <span className="lab" style={{ opacity: 0.8 }}>
                      {count === 0 ? 'Library on the way' : `${count} tricks`}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className={`cond ${styles.note}`}>
              {sports.length > 1
                ? 'Every page gets a tab so you can look at one sport at a time.'
                : 'Ride more than one? Tap the others as well.'}
            </p>

            <Panel flat className={styles.panelGap}>
              <div className="lab" style={{ marginBottom: 4 }}>
                Which foot forward?
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--ink-2)' }}>
                So the tips talk about the right foot. Skip it if you don&rsquo;t know yet.
              </p>
              <div className={styles.pills}>
                {STANCES.map((option) => (
                  <Pill
                    key={option.id}
                    on={stance === option.id}
                    onClick={() => setStance(stance === option.id ? null : option.id)}
                  >
                    {option.label}{' '}
                    <span style={{ opacity: 0.65, fontWeight: 500 }}>· {option.sub}</span>
                  </Pill>
                ))}
              </div>
            </Panel>
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <h1 className={`d ${styles.head}`}>
              How&rsquo;s it going
              <br />
              so far?
            </h1>
            <p className={styles.lede}>
              This just sets where your list starts. You can change it whenever.
            </p>

            <Panel flat className={styles.avatarRow}>
              <Avatar avatarId={avatarKey} name={name} size={48} ringWidth={3} />
              <div className={styles.avatarText}>
                <div className="lab">Your picture</div>
                <p className={`cond ${styles.sportBlurb}`} style={{ margin: '4px 0 0' }}>
                  {avatarById(avatarKey)?.name ?? 'Pick one, or keep your initial'}
                </p>
              </div>
              <div className={styles.avatarPicks}>
                <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
                  Choose a picture
                </Button>
              </div>
            </Panel>

            <div className={styles.levels}>
              {LEVELS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setLevel(option.id)}
                  aria-pressed={level === option.id}
                  className={`panel flat ${styles.level}`}
                  style={{
                    background: level === option.id ? option.hue : 'var(--paper)',
                    boxShadow:
                      level === option.id ? '5px 5px 0 var(--ink)' : '3px 3px 0 var(--ink)',
                  }}
                >
                  <span
                    className={styles.radio}
                    style={{
                      background: level === option.id ? 'var(--ink)' : 'var(--paper)',
                    }}
                  />
                  <span>
                    <span className={`d ${styles.levelName}`}>{option.label}</span>
                    <span className={`cond ${styles.levelSub}`}>{option.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <h1 className={`d ${styles.head}`}>What&rsquo;s the goal?</h1>
            <p className={styles.lede}>
              We&rsquo;ll put it on your dashboard. Write your own if none of these fit.
            </p>

            <div className={styles.pills}>
              {goals.map((option) => (
                <Pill
                  key={option.id}
                  on={goal === option.id}
                  onClick={() => setGoal(option.id)}
                  style={
                    goal === option.id
                      ? { background: option.hue, color: '#fff', boxShadow: '3px 3px 0 var(--ink)' }
                      : undefined
                  }
                >
                  {option.label}
                </Pill>
              ))}
              <Pill on={goal === CUSTOM_GOAL_ID} onClick={() => setGoal(CUSTOM_GOAL_ID)}>
                + Something else
              </Pill>
            </div>

            {goal === CUSTOM_GOAL_ID ? (
              <div style={{ marginTop: 12 }}>
                <label className="lab" htmlFor="goal-custom">
                  Your goal
                </label>
                <input
                  id="goal-custom"
                  className={styles.goalInput}
                  value={custom}
                  maxLength={CUSTOM_GOAL_MAX_LENGTH}
                  onChange={(event) => setCustom(event.target.value)}
                  placeholder="Land a bri flip before the summer holidays"
                />
                <p className={`cond ${styles.note}`} style={{ marginTop: 7 }}>
                  {CUSTOM_GOAL_MAX_LENGTH} characters. It goes on your dashboard, so keep it blunt.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <h1 className={`d ${styles.headSmall}`}>
              Tick anything you
              <br />
              can already do
            </h1>
            <p className={styles.lede}>
              Tap once for <b>learning</b>, twice for <b>landed</b>. Skip it if you&rsquo;d rather
              start clean.
            </p>

            {suggested.length === 0 ? (
              <Panel flat className={styles.empty}>
                <div className="lab" style={{ marginBottom: 6 }}>
                  Nothing to tick yet
                </div>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-2)' }}>
                  There are no tricks in the library for what you ride yet. You can start logging as
                  soon as there are — nothing here is needed to finish.
                </p>
              </Panel>
            ) : (
              <div className={styles.tricks}>
                {suggested.map((trick) => {
                  const stage = picks[trick.id];
                  const look = stage ? STAGE[stage] : null;
                  return (
                    <TrickCard
                      key={trick.id}
                      name={trick.name}
                      category={{ label: CATS[trick.cat].label, color: CATS[trick.cat].color }}
                      difficulty={trick.diff}
                      sport={SPORT_LOOKS[trick.sport]}
                      showSport={sports.length > 1}
                      stage={look ? { id: look.id, label: look.label, color: look.color } : null}
                      emptyLabel="Tap to log"
                      background={
                        stage === 'most' ? '#DFF6C9' : stage === 'trying' ? '#FFE9C2' : undefined
                      }
                      onOpen={() => cycle(trick.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={saving}>
              Back
            </Button>
          ) : null}
          <Button
            className={styles.next}
            disabled={blocked || saving}
            onClick={() => (step < last ? setStep(step + 1) : void submit())}
          >
            {step < last ? 'Next' : saving ? 'Saving…' : "Let's go"}
          </Button>
        </div>
      </div>

      {picking ? (
        <AvatarPicker
          value={avatarKey}
          name={name}
          onPick={(id) => setAvatarKey(id)}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  );
}
