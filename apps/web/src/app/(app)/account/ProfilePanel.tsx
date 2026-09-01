'use client';

import {
  CUSTOM_GOAL_ID,
  CUSTOM_GOAL_MAX_LENGTH,
  LEVELS,
  SPORTS,
  SPORT_IDS,
  STANCES,
  goalsFor,
  type LevelId,
  type SportId,
  type StanceId,
} from '@landit/core';
import { Avatar, avatarById, Button, Equipment, foregroundFor, Panel } from '@landit/ui-web';
import { useActionState, useState } from 'react';

import { AvatarPicker } from '@/components/AvatarPicker';
import { SPORT_LOOKS, countWord } from '@/lib/sports';

import { saveProfileAction, type ProfileFormState } from './actions';

import { ANALYTICS_EVENTS, capture, useFailureCapture } from '@/lib/analyticsClient';

import styles from './account.module.css';

/**
 * The profile editor (`landit-screens-c.jsx`, screenshots 21-23) — T23.
 *
 * Onboarding asked five questions and nothing asked again, so what a rider
 * answered on their first evening was what they were stuck with: no way to take
 * up a second sport, move off "just started", change the goal on their own
 * dashboard, say which foot leads once they knew, or pick a different picture
 * (issue #96). The panels below are the prototype's, in its order, folded into
 * the screen that already holds the privacy control rather than given a route
 * of their own.
 *
 * **One form, one Save**, where the prototype saved on every tap. The prototype
 * has no server; here each tap would be a round trip, and a half-applied
 * profile — new sports stored, the goal that depended on them not — is a state
 * worth not having. It also reads consistently with the privacy control
 * directly below, which posts rather than saving onChange for its own and
 * stronger reason.
 *
 * Every picker is a button over hidden state rather than a radio, because two
 * of the five are clearable by tapping the chosen answer again (stance, per the
 * prototype) and one is a multi-select with a floor of one (sports). The form
 * posts the hidden inputs, and `saveProfileAction` re-checks all of it.
 */
export function ProfilePanel({
  name,
  sports: savedSports,
  level: savedLevel,
  goal: savedGoal,
  goalCustom: savedGoalCustom,
  stance: savedStance,
  avatarKey: savedAvatarKey,
}: {
  name: string;
  sports: readonly SportId[];
  level: LevelId | null;
  goal: string | null;
  goalCustom: string;
  stance: StanceId | null;
  avatarKey: string | null;
}) {
  const [state, save, saving] = useActionState<ProfileFormState | undefined, FormData>(
    saveProfileAction,
    undefined,
  );

  useFailureCapture(ANALYTICS_EVENTS.profileSaved, state?.error);

  const [sports, setSports] = useState<SportId[]>([...savedSports]);
  const [level, setLevel] = useState<LevelId | null>(savedLevel);
  const [goal, setGoal] = useState<string | null>(savedGoal);
  const [custom, setCustom] = useState(savedGoalCustom);
  const [stance, setStance] = useState<StanceId | null>(savedStance);
  const [avatarKey, setAvatarKey] = useState<string | null>(savedAvatarKey);
  const [picking, setPicking] = useState(false);

  const goals = goalsFor(sports);

  /**
   * Turning a sport off takes a goal that belonged to it.
   *
   * "Land a kickflip" is a skate goal, and a rider who has just turned skate off
   * would otherwise be looking at a selected goal the page no longer offers,
   * then be told to pick one by an error after saving. It is cleared here, in
   * the browser, on a change the rider just made — the server keeps whatever is
   * already stored (`profileChoiceProblem` does not narrow goals by sport), so
   * merely opening this screen loses nobody their goal.
   */
  function toggleSport(id: SportId) {
    const next = sports.includes(id) ? sports.filter((s) => s !== id) : [...sports, id];
    // Never empty: every screen in the product is scoped to what a rider rides,
    // so no sports is a product with nothing in it. The button is disabled too;
    // this is the half that does not depend on the button.
    if (!next.length) return;
    setSports(next);
    if (goal && goal !== CUSTOM_GOAL_ID && !goalsFor(next).some((g) => g.id === goal)) {
      setGoal(null);
    }
  }

  return (
    <Panel flat className={styles.profile}>
      <div className="lab">Your profile</div>
      <p className={styles.profileLede}>
        What you told us when you signed up. Change any of it whenever you like — nothing you have
        already tracked is affected.
      </p>

      <form
        action={save}
        className={styles.profileForm}
        onSubmit={() => capture(ANALYTICS_EVENTS.profileSaved, { outcome: 'attempted' })}
      >
        {/* What the pickers above actually post. */}
        <input type="hidden" name="avatar_key" value={avatarKey ?? ''} />
        <input type="hidden" name="level" value={level ?? ''} />
        <input type="hidden" name="goal" value={goal ?? ''} />
        <input type="hidden" name="stance" value={stance ?? ''} />
        {sports.map((sport) => (
          <input key={sport} type="hidden" name="sports" value={sport} />
        ))}

        {/* ------------------------------------------------------- picture -- */}
        <div className={styles.avatarRow}>
          <Avatar avatarId={avatarKey} name={name} size={60} ringWidth={3} />
          <div className={styles.avatarText}>
            <div className="lab">Your picture</div>
            <p className={styles.subtle}>
              {avatarById(avatarKey)?.name ?? 'Your initial, until you pick one'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
            {avatarKey ? 'Change picture' : 'Choose a picture'}
          </Button>
        </div>

        {/* -------------------------------------------------- what you ride -- */}
        <div>
          <div className={styles.groupHead}>
            <span className="lab">What you ride</span>
            <span className={`lab ${styles.groupAside}`}>
              {sports.length > 1
                ? `${countWord(sports.length)} libraries on, every page tabbed`
                : 'One library'}
            </span>
          </div>
          <p className={styles.subtle}>
            Turning a sport off hides its library, its stickers and its challenge. Nothing you have
            tracked is deleted, and turning it back on brings all of it back.
          </p>
          <div className={styles.sportPicks}>
            {SPORT_IDS.map((id) => {
              const sport = SPORTS[id];
              const on = sports.includes(id);
              const only = on && sports.length === 1;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleSport(id)}
                  aria-pressed={on}
                  disabled={only}
                  title={only ? 'Keep at least one sport' : undefined}
                  className={`panel flat ${styles.sportPick}`}
                  style={{
                    background: on ? sport.color : 'var(--paper)',
                    color: on ? (foregroundFor(sport.color) ?? 'var(--on-dark)') : 'var(--ink)',
                  }}
                >
                  <span
                    className={styles.sportPickIcon}
                    style={{ background: on ? 'var(--paper)' : 'var(--wash)' }}
                  >
                    <Equipment name={SPORT_LOOKS[id].icon} size={22} strokeWidth={2.3} />
                  </span>
                  <span className={styles.sportPickText}>
                    <span className={`cond ${styles.optionName}`}>{sport.label}</span>
                    <span className="lab" style={{ opacity: 0.85 }}>
                      {on ? (only ? 'On · your only sport' : 'On') : 'Off'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/*
          Goal, stance and level: three pill panels in a row, which is the
          prototype's layout (`landit-screens-c.jsx`) and its widths. They are
          short lists of short answers, and stacking them full-width — the first
          thing this panel did — turned five questions into a page of scrolling.
        */}
        <div className={styles.trio}>
          <div className={`panel flat ${styles.trioPanel}`}>
            <div className="lab">The goal</div>
            <p className={styles.subtle}>It goes on your dashboard.</p>
            <div className={styles.pills}>
              {goals.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="pill"
                  aria-pressed={goal === option.id}
                  onClick={() => setGoal(option.id)}
                  style={
                    goal === option.id
                      ? {
                          background: option.hue,
                          color: foregroundFor(option.hue) ?? 'var(--on-dark)',
                          boxShadow: '3px 3px 0 var(--ink)',
                        }
                      : undefined
                  }
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                className="pill"
                aria-pressed={goal === CUSTOM_GOAL_ID}
                onClick={() => setGoal(CUSTOM_GOAL_ID)}
                style={
                  goal === CUSTOM_GOAL_ID
                    ? { background: 'var(--ink)', color: 'var(--paper)' }
                    : undefined
                }
              >
                + Something else
              </button>
            </div>
            {goal === CUSTOM_GOAL_ID ? (
              <div className={styles.goalOwn}>
                <label className="lab" htmlFor="account-goal-custom">
                  Your goal
                </label>
                <input
                  id="account-goal-custom"
                  name="goal_custom"
                  className={styles.goalInput}
                  value={custom}
                  maxLength={CUSTOM_GOAL_MAX_LENGTH}
                  onChange={(event) => setCustom(event.target.value)}
                  placeholder="Land a bri flip before the summer holidays"
                />
                <p className={styles.subtle}>
                  {CUSTOM_GOAL_MAX_LENGTH} characters. It goes on your dashboard, so keep it blunt.
                </p>
              </div>
            ) : null}
          </div>

          <div className={`panel flat ${styles.trioPanel}`}>
            <div className="lab">Which foot forward</div>
            <p className={styles.subtle}>
              Which foot leads. Tips are written for your stance. Tap the one you have picked to
              clear it.
            </p>
            <div className={styles.pills}>
              {STANCES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="pill"
                  aria-pressed={stance === option.id}
                  title={option.sub}
                  onClick={() => setStance(stance === option.id ? null : option.id)}
                  style={
                    stance === option.id
                      ? { background: 'var(--ink)', color: 'var(--paper)' }
                      : undefined
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            {stance ? (
              <p className={`cond ${styles.chosen}`}>
                {STANCES.find((option) => option.id === stance)?.sub}
              </p>
            ) : null}
          </div>

          <div className={`panel flat ${styles.trioPanel}`}>
            <div className="lab">Where you are at</div>
            <p className={styles.subtle}>This sets where your suggestions start, nothing else.</p>
            <div className={styles.pills}>
              {LEVELS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="pill"
                  aria-pressed={level === option.id}
                  title={option.sub}
                  onClick={() => setLevel(option.id)}
                  style={
                    level === option.id
                      ? { background: option.hue, boxShadow: '3px 3px 0 var(--ink)' }
                      : undefined
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            {level ? (
              <p className={`cond ${styles.chosen}`}>
                {LEVELS.find((option) => option.id === level)?.sub}
              </p>
            ) : null}
          </div>
        </div>

        <div className={styles.profileActions}>
          <button type="submit" className="btn sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {state?.saved ? <span className={`lab ${styles.privacySaved}`}>Saved</span> : null}
          {state?.error ? <span className={styles.privacyError}>{state.error}</span> : null}
        </div>
      </form>

      {picking ? (
        <AvatarPicker
          value={avatarKey}
          name={name}
          onPick={(id) => setAvatarKey(id)}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </Panel>
  );
}
