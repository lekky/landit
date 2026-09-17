'use client';

import {
  CUSTOM_GOAL_ID,
  CUSTOM_GOAL_MAX_LENGTH,
  LEVELS,
  SPORTS,
  SPORT_IDS,
  STANCES,
  goalsFor,
  profileChoiceProblem,
  type LevelId,
  type SportId,
  type StanceId,
} from '@landit/core';
import { Avatar, Button, Equipment, Panel, avatarById } from '@landit/ui-web';
import { startTransition, useCallback, useEffect, useRef, useState } from 'react';

import { AvatarPicker } from '@/components/AvatarPicker';
import { SPORT_LOOKS, countWord, sentenceCase } from '@/lib/sports';

import { saveProfileAction } from './actions';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { runActionOr } from '@/lib/runAction';

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
 * **Every answer saves as it is made**, which is the prototype's behaviour and,
 * on reflection, the owner's (Rachid, 2026-09-04, in chat). This panel shipped
 * with one form and one Save button, reasoning that a tap-per-round-trip was
 * expensive and that a half-applied profile — new sports stored, the goal that
 * depended on them not — was a state worth not having. The first half was worth
 * less than the defect it bought: a rider opened the picker, chose a face,
 * closed it, saw their new avatar sitting in the panel and left, and nothing
 * had been written. The second half never needed a button, because
 * `saveProfileAction` writes the whole profile every time. Posting the
 * *complete* draft on every change is what makes a half-applied profile
 * unreachable — deferring the write was never the part doing that work.
 *
 * Two rules follow from having no button:
 *
 * 1. **An incomplete draft is never posted.** `profileChoiceProblem` — the same
 *    function the server re-runs, and the one onboarding uses — is checked here
 *    first, and a draft that fails it is held rather than sent. Tapping
 *    "Something else" before typing a goal is not an error a rider should be
 *    shouted at for; it is an answer they have not finished. So the panel says
 *    what is missing and writes nothing, leaving whatever is stored intact
 *    until there is a complete answer to replace it with.
 * 2. **A failed write has to be recoverable**, because there is no longer a
 *    button to press again. The draft stays pending on failure, and "Try again"
 *    re-posts it.
 *
 * Every picker is a button over local state rather than a radio, because two of
 * the five are clearable by tapping the chosen answer again (stance, per the
 * prototype) and one is a multi-select with a floor of one (sports).
 *
 * The privacy control below deliberately keeps its button. That one is not a
 * preference but a setting about who can see a child, and it changes when a
 * rider says so rather than when a finger lands on a list while scrolling.
 */

/**
 * Which of the panel's two halves to draw (T51, rethink §3.9).
 *
 * `/account` is a list of rows now, and two of the rows — "Your profile" and
 * "What you ride" — are two halves of this one panel. They are drawn from the
 * same component rather than split into two, because `saveProfileAction` writes
 * the **whole** profile every time: a component owning only the sports would
 * post a profile with the other five answers missing, and the first tap on
 * `/account/sports` would wipe a rider's goal, stance, level and picture.
 *
 * So both screens hold the whole draft and show part of it. `'all'` is the
 * default and is exactly what the panel drew before this prop existed.
 */
export type ProfileSection = 'all' | 'profile' | 'sports';

/**
 * The six answers this panel owns, held as one value.
 *
 * Six `useState` calls would mean building each save out of five stale closure
 * variables and one fresh one. One value means a save posts exactly the draft
 * the rider just produced.
 */
interface Draft {
  sports: SportId[];
  level: LevelId | null;
  goal: string | null;
  custom: string;
  stance: StanceId | null;
  avatarKey: string | null;
}

/**
 * Which control a rider touched, for the counter.
 *
 * These are catalogue facts — the name of a control, never the value chosen in
 * it, and `goal_text` never carries a word of what was typed.
 */
type Field = 'avatar' | 'sports' | 'goal' | 'goal_text' | 'stance' | 'level';

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  /** The write was attempted and failed. Recoverable, so it offers a retry. */
  | { kind: 'error'; message: string }
  /** Not written, because it is not yet a complete answer. Not a failure. */
  | { kind: 'blocked'; message: string };

/**
 * How long a typed goal sits still before it is written.
 *
 * Only the free-text field is debounced. Taps post immediately, so a rider who
 * picks a picture and closes the tab has it saved; the ordering guard below is
 * what makes a burst of taps safe, rather than a delay in front of every one.
 */
const TYPING_DELAY = 700;

/** What `saveProfileAction` reads: the whole profile, every time. */
function formDataFor(draft: Draft): FormData {
  const form = new FormData();
  for (const sport of draft.sports) form.append('sports', sport);
  form.set('level', draft.level ?? '');
  form.set('goal', draft.goal ?? '');
  form.set('goal_custom', draft.custom);
  form.set('stance', draft.stance ?? '');
  form.set('avatar_key', draft.avatarKey ?? '');
  return form;
}

export function ProfilePanel({
  name,
  sports: savedSports,
  level: savedLevel,
  goal: savedGoal,
  goalCustom: savedGoalCustom,
  stance: savedStance,
  avatarKey: savedAvatarKey,
  section = 'all',
}: {
  name: string;
  sports: readonly SportId[];
  level: LevelId | null;
  goal: string | null;
  goalCustom: string;
  stance: StanceId | null;
  avatarKey: string | null;
  section?: ProfileSection;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    sports: [...savedSports],
    level: savedLevel,
    goal: savedGoal,
    custom: savedGoalCustom,
    stance: savedStance,
    avatarKey: savedAvatarKey,
  }));
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [picking, setPicking] = useState(false);
  /**
   * Has a sport toggle taken the goal that belonged to it? (T51, review B1.)
   *
   * On one screen this needed no state: the goal picker was always on the page,
   * so "the draft is incomplete" and "the rider can finish it" were the same
   * fact. Split across two screens they are not, and the first cut sent the
   * rider to `/account/profile` to finish — which **discarded the sport
   * change**, because the pending draft lives in `pending.current` on this
   * component and a route change unmounts it. A rider turned a sport off, was
   * told to pick a goal, picked one, saw "Saved", and the sport was still on.
   *
   * So the goal picker comes to the sports screen instead of the rider going to
   * it, and the single post this panel was built around still happens. It is
   * `true` from the toggle that orphaned the goal until a write actually lands,
   * rather than derived from `status`, so the block does not flicker away
   * between the tap on a goal and the answer coming back.
   */
  const [goalOrphaned, setGoalOrphaned] = useState(false);

  /**
   * The newest draft not yet safely stored, and which controls produced it.
   *
   * It survives a failed write so "Try again" has something to send, and it
   * survives a blocked one so that finishing the answer writes the whole
   * change — the sport toggle *and* the goal it forced, in a single post.
   */
  const pending = useRef<{ draft: Draft; fields: Set<Field> } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Every write takes a ticket, and only the newest one's answer is allowed to
   * land. Two taps can be in flight at once and come back in either order;
   * without this, the older reply would get to set the line the rider reads.
   */
  const issued = useRef(0);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const job = pending.current;
    if (!job) return;

    // Rule 1: an incomplete answer is held, not posted. This is the function
    // the server re-runs, so what is refused here is what it would refuse.
    const problem = profileChoiceProblem({
      sports: job.draft.sports,
      level: job.draft.level,
      goal: job.draft.goal,
      goalCustom: job.draft.custom,
      stance: job.draft.stance,
      avatarKey: job.draft.avatarKey,
    });
    if (problem) {
      setStatus({ kind: 'blocked', message: problem });
      return;
    }

    const ticket = ++issued.current;
    setStatus({ kind: 'saving' });

    /*
     * A Server Function reached from an event handler rather than a `<form
     * action>` has to be wrapped in a transition — that is what a form prop
     * does for you, and it is how the router receives the payload
     * `revalidatePath` produces (`next/dist/docs/01-app/01-getting-started/
     * 07-mutating-data.md`). Without it the write lands and the rest of the
     * page keeps rendering the profile it had.
     */
    startTransition(async () => {
      const result = await runActionOr(
        'profile_save',
        () => saveProfileAction(undefined, formDataFor(job.draft)),
        (error) => ({ error }),
      );

      // A later change is already on its way; its answer is the true one.
      if (ticket !== issued.current) return;

      // One event per control the write covered, so the field breakdown adds
      // up to the number of saves rather than under-counting a coalesced one.
      for (const field of job.fields) {
        capture(ANALYTICS_EVENTS.profileSaved, {
          field,
          outcome: result?.error ? 'failed' : 'saved',
        });
      }

      if (result?.error) {
        // Rule 2: leave it pending, so "Try again" has the draft to re-post.
        setStatus({ kind: 'error', message: result.error });
        return;
      }
      // Clear only what this write actually stored. Anything the rider changed
      // while it was in flight is a newer job, with a timer of its own.
      if (pending.current === job) pending.current = null;
      // The answer is complete and stored, so the sports screen's borrowed goal
      // picker has done its job and goes.
      setGoalOrphaned(false);
      setStatus({ kind: 'saved' });
    });
  }, []);

  const change = useCallback(
    (next: Draft, field: Field, delay = 0) => {
      setDraft(next);
      const fields = new Set<Field>(pending.current?.fields);
      fields.add(field);
      pending.current = { draft: next, fields };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(), delay);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const goals = goalsFor(draft.sports);

  /**
   * Turning a sport off takes a goal that belonged to it.
   *
   * "Land a kickflip" is a skate goal, and a rider who has just turned skate off
   * would otherwise be looking at a selected goal the page no longer offers. It
   * is cleared here, in the browser, on a change the rider just made — which
   * leaves the draft incomplete, so the sport change is held alongside it until
   * they pick a new goal and both are written together. The server keeps
   * whatever is already stored in the meantime, so merely opening this screen
   * and changing your mind loses nobody their goal.
   *
   * On `/account/sports` the goal picker is not on the screen, so this is also
   * what calls it in (`goalOrphaned`). The pair have to finish in one post and
   * the pending draft does not survive a route change — see that state's note.
   */
  function toggleSport(id: SportId) {
    const next = draft.sports.includes(id)
      ? draft.sports.filter((s) => s !== id)
      : [...draft.sports, id];
    // Never empty: every screen in the product is scoped to what a rider rides,
    // so no sports is a product with nothing in it. The button is disabled too;
    // this is the half that does not depend on the button.
    if (!next.length) return;
    const orphaned = Boolean(
      draft.goal &&
      draft.goal !== CUSTOM_GOAL_ID &&
      !goalsFor(next).some((g) => g.id === draft.goal),
    );
    if (orphaned) setGoalOrphaned(true);
    change({ ...draft, sports: next, goal: orphaned ? null : draft.goal }, 'sports');
  }

  /*
   * Which halves this screen draws (T51). `'all'` keeps every block, which is
   * what `/account` rendered before the list; the two screens take one each.
   */
  const showProfile = section !== 'sports';
  const showSports = section !== 'profile';

  /** How many libraries the current draft turns on, in words. */
  const libraryCount =
    draft.sports.length > 1
      ? `${countWord(draft.sports.length)} libraries on, switched from the top bar`
      : 'One library';

  /**
   * The goal picker, which two screens now need.
   *
   * `/account/profile` draws it as one of the trio, where it has always been.
   * `/account/sports` borrows it for as long as a sport toggle has left the
   * rider without a goal, so that the sport change and the goal it forced are
   * still written in **one** post — the thing this panel is built around, and
   * the thing a link to the other screen quietly broke (review B1).
   *
   * A function rather than a second copy of sixty lines of pills: the two
   * differ only in the sentence under the label, because on the sports screen
   * the picker has to say why it has appeared.
   */
  function goalPanel(lede: string) {
    return (
      <div className={`panel flat ${styles.trioPanel}`}>
        <div className="lab">The goal</div>
        <p className={styles.subtle}>{lede}</p>
        <div className={styles.pills}>
          {goals.map((option) => (
            <button
              key={option.id}
              type="button"
              className="pill"
              aria-pressed={draft.goal === option.id}
              onClick={() => change({ ...draft, goal: option.id }, 'goal')}
              style={
                draft.goal === option.id
                  ? {
                      background: option.hue,
                      color: '#fff',
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
            aria-pressed={draft.goal === CUSTOM_GOAL_ID}
            onClick={() => change({ ...draft, goal: CUSTOM_GOAL_ID }, 'goal')}
            style={
              draft.goal === CUSTOM_GOAL_ID
                ? { background: 'var(--ink)', color: 'var(--paper)' }
                : undefined
            }
          >
            + Something else
          </button>
        </div>
        {draft.goal === CUSTOM_GOAL_ID ? (
          <div className={styles.goalOwn}>
            <label className="lab" htmlFor="account-goal-custom">
              Your goal
            </label>
            <input
              id="account-goal-custom"
              className={styles.goalInput}
              value={draft.custom}
              maxLength={CUSTOM_GOAL_MAX_LENGTH}
              onChange={(event) =>
                change({ ...draft, custom: event.target.value }, 'goal_text', TYPING_DELAY)
              }
              // Leaving the field is a rider saying they are done with it,
              // and it beats the debounce — so clicking away writes, rather
              // than racing a timer the page may not be around to fire.
              onBlur={() => flush()}
              placeholder="Land a bri flip before the summer holidays"
            />
            <p className={styles.subtle}>
              {CUSTOM_GOAL_MAX_LENGTH} characters. It goes on your dashboard, so keep it blunt.
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Panel flat className={styles.profile}>
      {/*
        The panel names itself only where nothing else does. On
        `/account/profile` and `/account/sports` the screen's own `h1` is
        already these words — and with no label and nothing saved yet, the row
        was 24px of empty paper at the top of both screens. It collapses to
        nothing instead of reserving its height, and the live region below stays
        in the DOM either way: a region added at the same moment as its content
        is a region some screen readers never announce.
      */}
      <div
        className={`${styles.profileHead} ${
          section !== 'all' && status.kind === 'idle' ? styles.profileHeadQuiet : ''
        }`.trim()}
      >
        {section === 'all' ? <div className="lab">Your profile</div> : <span />}
        {/*
          The one place the panel reports itself. It is announced as well as
          shown, because with no Save button the rider's own tap is the whole of
          their evidence, and this panel is taller than a phone — the control
          they touched is often nowhere near this line.
        */}
        <div className={styles.profileStatus} aria-live="polite">
          {status.kind === 'saving' ? <span className="lab">Saving…</span> : null}
          {status.kind === 'saved' ? (
            <span className={`lab ${styles.privacySaved}`}>Saved</span>
          ) : null}
          {/*
            No link to anywhere. A first cut sent a rider whose sport toggle had
            taken their goal to `/account/profile` to pick a new one, and the
            sport change was thrown away on the way (review B1) — and the link
            was drawn for *every* blocked answer, so an unset level rendered as
            "Tell us roughly where you are at. Pick a new one →", which is not a
            sentence. The picker comes to the rider instead, below.
          */}
          {status.kind === 'blocked' ? (
            <span className={styles.profileBlocked}>{status.message}</span>
          ) : null}
          {status.kind === 'error' ? (
            <>
              <span className={styles.privacyError}>{status.message}</span>
              <button type="button" className="btn sm" onClick={() => flush()}>
                Try again
              </button>
            </>
          ) : null}
        </div>
      </div>
      <p className={styles.profileLede}>
        {showProfile
          ? 'What you told us when you signed up. Change any of it whenever you like — it saves as you go, and nothing you have already tracked is affected.'
          : 'It saves as you go, and nothing you have already tracked is affected.'}
      </p>

      <div className={styles.profileForm}>
        {/* ------------------------------------------------------- picture -- */}
        {showProfile ? (
          <div className={styles.avatarRow}>
            <Avatar avatarId={draft.avatarKey} name={name} size={60} ringWidth={3} />
            <div className={styles.avatarText}>
              <div className="lab">Your picture</div>
              <p className={styles.subtle}>
                {avatarById(draft.avatarKey)?.name ?? 'Your initial, until you pick one'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
              {draft.avatarKey ? 'Change picture' : 'Choose a picture'}
            </Button>
          </div>
        ) : null}

        {/* -------------------------------------------------- what you ride -- */}
        {showSports ? (
          <div>
            {/*
              The count is an aside beside a label, and with the label gone on
              `/account/sports` it was a line of small caps being the aside of
              nothing — a heading that is really a count. There it is an ordinary
              line under the blurb instead.

              The words: "every page tabbed" until T51, which is the session that
              took ownership of this screen. The per-page sport tab rows went
              with D5 — the sport is chosen once, in the top bar's chip — so the
              old copy described a control the product no longer has, on the one
              screen where a rider is deciding how many sports to turn on.
            */}
            {section === 'sports' ? null : (
              <div className={styles.groupHead}>
                <span className="lab">What you ride</span>
                <span className={`lab ${styles.groupAside}`}>{libraryCount}</span>
              </div>
            )}
            <p className={styles.subtle}>
              Turning a sport off hides its library, its stickers and its challenge. Nothing you
              have tracked is deleted, and turning it back on brings all of it back.
              {section === 'sports' ? ` ${sentenceCase(libraryCount)}.` : null}
            </p>
            <div className={styles.sportPicks}>
              {SPORT_IDS.map((id) => {
                const sport = SPORTS[id];
                const on = draft.sports.includes(id);
                const only = on && draft.sports.length === 1;
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
                      color: on ? '#fff' : 'var(--ink)',
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

            {/*
              The goal picker, on the sports screen, only while a toggle has
              taken the rider's goal (review B1). It is the same picker over the
              same draft, so choosing here writes the sport change and the new
              goal together — which is what the panel has always done, and what
              a link to `/account/profile` could not do, because the pending
              draft does not survive a route change.
            */}
            {section === 'sports' && goalOrphaned ? (
              <div className={styles.orphanGoal}>
                {goalPanel(
                  'That sport carried your goal, so it needs a new one. Pick one and both changes save together.',
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {/*
          Goal, stance and level: three pill panels in a row, which is the
          prototype's layout (`landit-screens-c.jsx`) and its widths. They are
          short lists of short answers, and stacking them full-width — the first
          thing this panel did — turned five questions into a page of scrolling.
        */}
        {showProfile ? (
          <div className={styles.trio}>
            {goalPanel('It goes on your dashboard.')}

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
                    aria-pressed={draft.stance === option.id}
                    title={option.sub}
                    onClick={() =>
                      change(
                        { ...draft, stance: draft.stance === option.id ? null : option.id },
                        'stance',
                      )
                    }
                    style={
                      draft.stance === option.id
                        ? { background: 'var(--ink)', color: 'var(--paper)' }
                        : undefined
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {draft.stance ? (
                <p className={`cond ${styles.chosen}`}>
                  {STANCES.find((option) => option.id === draft.stance)?.sub}
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
                    aria-pressed={draft.level === option.id}
                    title={option.sub}
                    onClick={() => change({ ...draft, level: option.id }, 'level')}
                    style={
                      draft.level === option.id
                        ? { background: option.hue, boxShadow: '3px 3px 0 var(--ink)' }
                        : undefined
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {draft.level ? (
                <p className={`cond ${styles.chosen}`}>
                  {LEVELS.find((option) => option.id === draft.level)?.sub}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {picking && showProfile ? (
        <AvatarPicker
          value={draft.avatarKey}
          name={name}
          onPick={(id) => change({ ...draft, avatarKey: id }, 'avatar')}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </Panel>
  );
}
