'use client';

import {
  CLIP_LINK_REFUSALS,
  SESSION_DURATIONS,
  SESSION_FEELS,
  SESSION_LIMITS,
  SESSION_VISIBILITIES,
  SESSION_WEATHER,
  SESSION_WEATHER_SELECTED_COLOR,
  SPORTS,
  STAGE,
  clipLinkProblem,
  clipWatchUrl,
  isLandedStage,
  parseClipLink,
  stagesAbove,
  type SessionField,
  type SportId,
  type StageId,
} from '@landit/core';
import {
  Avatar,
  ClipPoster,
  Equipment,
  FeelFace,
  Icon,
  PlatformBadge,
  SegmentedPicker,
  Tag,
  VISIBILITY_ICONS,
  WeatherIcon,
} from '@landit/ui-web';
import Link from 'next/link';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { TAB_PANEL, TabRow, type TabRowItem } from '@/components/shell/TabRow';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { ROUTES } from '@/lib/routes';
import {
  eventsAtSpotToday,
  trickStageLine,
  visibilityLine,
  type SessionFormValues,
} from '@/lib/sessionForm';

import styles from './form.module.css';
// Type only, so the cycle with `SavedState` (which imports `ChevronRight` from
// here) is erased rather than real.
import type { FreshSection } from './SavedState';
import { SpotSearchSheet } from './SpotSearchSheet';
import type { FormSpot, FormTrick, SessionFormData } from './types';

/**
 * The full form's twelve fields, in the handoff's order (1c phone, 2g desktop).
 * One component tree for both: two columns above 700px, one below, with each
 * card's `order` putting the phone sequence back together.
 *
 * **Since T50 it is three steps, at every width** (rethink §3.10). Twelve
 * fields in one scroll is the longest thing in the product on a 390px phone,
 * and "Log a session" competing with a form a rider has to scroll twice to see
 * the end of is why the quick log exists at all. The row is `TabRow`
 * (`group: 'session-form'`), the same boxed row the rest of the rethink
 * navigates with, and the footer's primary button reads **Next** until the last
 * step, where it reads Save.
 *
 * Nothing about what is *saved* moved: the same values object, the same server
 * action, the same month cap, grace and one-way stage promotion. A step is
 * where a field is drawn, not what it means.
 */

/**
 * The three steps, in order (§3.10). `id` is also `tabs_switched`'s `tab`.
 *
 * `elementId` is what the panel is `aria-labelledby` (review S3): ARIA names a
 * `tabpanel` after the tab that controls it, and a panel cannot point at an
 * element with no id. It buys the reference, not a unique name — the Notes step
 * and the notes textarea inside it are both honestly called Notes.
 */
export const SESSION_STEPS = [
  { id: 'when', label: 'When & where', elementId: 'session-step-when' },
  { id: 'what', label: 'What', elementId: 'session-step-what' },
  { id: 'notes', label: 'Notes', elementId: 'session-step-notes' },
] as const satisfies readonly TabRowItem[];

export type SessionStepId = (typeof SESSION_STEPS)[number]['id'];

/**
 * Which step holds a field, so a refusal lands on the step that can fix it.
 *
 * Without this a rider on Notes who presses Save with no spot picked gets an
 * error message about a control two steps behind them — the stepped form's one
 * new way to be wrong, and the reason `formProblems` is still run over the
 * whole values object rather than per step. Validating only the visible step
 * would let a rider walk past a missing spot and meet it from the server
 * instead, which is a round trip to say something the browser already knew.
 *
 * **A map rather than a chain of `if`s** (review N5). The chain fell through to
 * `'notes'`, so a `SessionField` added later would have landed there silently
 * and sent a rider to the wrong step to fix it. `satisfies` makes the next
 * field a compile error instead.
 */
const FIELD_STEPS = {
  startedAt: 'when',
  durationMinutes: 'when',
  spotId: 'when',
  sport: 'what',
  aim: 'what',
  tricks: 'what',
  feel: 'notes',
  weather: 'notes',
  notes: 'notes',
  crewIds: 'notes',
  clip: 'notes',
} as const satisfies Record<SessionField, SessionStepId>;

export function stepForField(field: SessionField): SessionStepId {
  return FIELD_STEPS[field];
}

/**
 * Which step holds a "while it's fresh" prompt's anchor (review B1).
 *
 * After a quick log the saved card offers three prompts — Tricks you worked on,
 * A clip, Notes and the aim — and each reopens the form scrolled to the section
 * it names. On one long form every anchor was always in the document; with
 * three steps only the open step's cards are rendered, so `getElementById`
 * answered `null` and `?.scrollIntoView()` did nothing. A rider who pressed
 * "A clip" got When, How long and Where, with no clip field anywhere and no
 * message saying why.
 *
 * The map is not `stepForField`'s: the anchors are card ids rather than field
 * names, and `session-notes` is on the **aim** card (`order: 4`), which is on
 * What. That is where `main` scrolled to as well, so the prompt lands exactly
 * where it always did.
 */
const SECTION_STEPS = {
  tricks: 'what',
  notes: 'what',
  clip: 'notes',
} as const satisfies Record<FreshSection, SessionStepId>;

export function stepForSection(section: FreshSection): SessionStepId {
  return SECTION_STEPS[section];
}

type Change = (patch: Partial<SessionFormValues>) => void;
type Errors = Partial<Record<SessionField, string>>;

/* ---------------------------------------------------------- the chrome -- */

export function FormHeader(props: {
  title: string;
  sub: string;
  saveLabel: string;
  pending: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.head}>
      <button
        type="button"
        className={`${styles.headClose} ${styles.headCloseLeft}`}
        aria-label="Close"
        onClick={props.onClose}
      >
        <CloseGlyph />
      </button>
      <span className={styles.headTitle}>{props.title}</span>
      {props.sub ? <span className={styles.headSub}>{props.sub}</span> : null}
      <button
        type="button"
        className={styles.headSave}
        onClick={props.onSave}
        disabled={props.pending}
      >
        {props.pending ? 'Saving…' : props.saveLabel}
      </button>
      <button
        type="button"
        className={`${styles.headClose} ${styles.headCloseRight}`}
        aria-label="Close"
        onClick={props.onClose}
      >
        <CloseGlyph />
      </button>
    </div>
  );
}

export function CloseGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="21"
      height="21"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ChevronRight({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function FlagGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="#8a3be0"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 21V4M6 5h13l-2.5 4L19 13H6" />
    </svg>
  );
}

function Card(props: { children: ReactNode; order: number; id?: string; className?: string }) {
  return (
    <section
      id={props.id}
      className={`${styles.card} ${props.className ?? ''}`}
      // The phone order only: on desktop each column keeps its source order.
      style={{ '--card-order': props.order } as CSSProperties}
    >
      {props.children}
    </section>
  );
}

function Label(props: { children: ReactNode; aside?: ReactNode; id?: string; spaced?: boolean }) {
  return (
    <div className={`${styles.labelRow} ${props.spaced ? styles.labelSpaced : ''}`}>
      <span className={styles.label} id={props.id}>
        {props.children}
      </span>
      {props.aside ? <span className={styles.labelAside}>{props.aside}</span> : null}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className={styles.fieldError} role="alert">
      {message}
    </p>
  ) : null;
}

/* -------------------------------------------------------------- where ---- */

export function useKnownSpots(data: SessionFormData) {
  const [picked, setPicked] = useState<FormSpot[]>([]);
  const spots = useMemo(() => {
    const byId = new Map<string, FormSpot>();
    for (const s of [...data.spots, ...picked]) byId.set(s.id, s);
    return byId;
  }, [data.spots, picked]);
  const remember = (spot: FormSpot) => setPicked((current) => [...current, spot]);
  return { spots, remember };
}

export function WhereField(props: {
  data: SessionFormData;
  values: SessionFormValues;
  errors: Errors;
  onChange: Change;
  spots: Map<string, FormSpot>;
  remember: (spot: FormSpot) => void;
}) {
  const { data, values, onChange, spots } = props;
  const [searching, setSearching] = useState(false);
  const spot = spots.get(values.spotId) ?? null;
  const attached = values.eventId ? data.events.find((e) => e.id === values.eventId) : null;
  const offered = !values.eventId ? eventsAtSpotToday(data.events, spot, data.today)[0] : undefined;
  const recent = data.recentSpotIds
    .filter((id) => id !== values.spotId)
    .map((id) => spots.get(id))
    .filter((s): s is FormSpot => !!s);

  const pick = (next: FormSpot) => {
    props.remember(next);
    // An event belongs to a place; moving the session somewhere else takes it off.
    onChange({ spotId: next.id, eventId: next.id === values.spotId ? values.eventId : '' });
    setSearching(false);
  };

  return (
    <>
      {spot ? (
        <div className={styles.spotRow}>
          <Icon name="map" size={19} style={{ color: '#ff5a1f' }} />
          <div className={styles.spotText}>
            <div className={styles.spotName}>{spot.name}</div>
            {spot.town ? <div className={styles.spotSub}>{spot.town}</div> : null}
          </div>
          <button type="button" className={styles.miniBtn} onClick={() => setSearching(true)}>
            Change
          </button>
        </div>
      ) : (
        <button type="button" className={styles.spotEmpty} onClick={() => setSearching(true)}>
          <Icon name="map" size={19} style={{ color: '#ff5a1f' }} />
          <span>Pick where you rode</span>
          <ChevronRight />
        </button>
      )}
      <FieldError message={props.errors.spotId} />

      {recent.length ? (
        <div className={styles.recentRow}>
          <span className={styles.recentLabel}>Recent</span>
          {recent.map((r) => (
            <button key={r.id} type="button" className={styles.recentChip} onClick={() => pick(r)}>
              {r.name}
            </button>
          ))}
        </div>
      ) : null}

      {values.eventId ? (
        <div className={styles.eventBand}>
          <FlagGlyph />
          <div className={styles.eventText}>
            <b>{attached?.name ?? 'An event'}</b> · attached to this session
          </div>
          <button
            type="button"
            className={styles.eventGhost}
            onClick={() => onChange({ eventId: '' })}
          >
            Remove
          </button>
        </div>
      ) : offered ? (
        <div className={styles.eventBand}>
          <FlagGlyph />
          <div className={styles.eventText}>
            <b>{offered.name}</b> is on here today.
          </div>
          <button
            type="button"
            className={styles.eventAdd}
            onClick={() => onChange({ eventId: offered.id })}
          >
            Add
          </button>
        </div>
      ) : null}

      {searching ? (
        <SpotSearchSheet
          recent={data.recentSpotIds.map((id) => spots.get(id)).filter((s): s is FormSpot => !!s)}
          onPick={pick}
          onClose={() => setSearching(false)}
        />
      ) : null}
    </>
  );
}

/* --------------------------------------------------------- what you rode -- */

/**
 * "What you rode" — a preset `Tag` with a Change link, not a row of buttons
 * (rethink §3.10, T50).
 *
 * The sport is **chosen once, in the top bar** (D5), and this form now opens on
 * whatever the chip says (`SessionFormScreen` applies it). Asking again with a
 * two- or three-button segmented control was the form disagreeing with the
 * chip about a question the rider had already answered, and it was the widest
 * control on the phone for the field least often changed.
 *
 * So the ordinary case is a statement — a `Tag` in the sport's own colour, the
 * sport art beside it — and changing it is a press away. The picker is the
 * control that was always here, revealed rather than replaced, so the one rider
 * who logs a skate session on a scooter day loses nothing.
 *
 * A rider who tracks one sport gets the tag alone and no Change link: there is
 * nothing to change to, and a control that can only reselect what is already
 * selected is a control that teaches nothing.
 */
export function SportField(props: {
  data: SessionFormData;
  values: SessionFormValues;
  onChange: Change;
}) {
  const { data, values, onChange } = props;
  const [picking, setPicking] = useState(false);
  const multiSport = data.sports.length > 1;
  const sport = SPORTS[values.sport];

  return (
    <>
      <Label
        aside={
          multiSport && !picking ? (
            <button type="button" className={styles.miniBtn} onClick={() => setPicking(true)}>
              Change
            </button>
          ) : undefined
        }
      >
        What you rode
      </Label>
      {picking ? (
        <>
          <SegmentedPicker<SportId>
            label="What you rode"
            options={data.sports.map((id) => ({
              id,
              label: (
                <span className={styles.sportLabel}>
                  <Equipment name={SPORTS[id].icon} size={19} />
                  {SPORTS[id].label}
                </span>
              ),
            }))}
            value={values.sport}
            onChange={(next) => {
              onChange({ sport: next });
              setPicking(false);
            }}
            className={styles.seg}
          />
          {/*
            A way back that is not a choice (review N4). Without it the only
            exit from the picker is to pick something — and picking the sport
            already selected is what tells the form the rider answered this
            themselves, which stops the top bar's chip leading it. "Never mind"
            should not quietly change what the form does.
          */}
          <button type="button" className={styles.keepSport} onClick={() => setPicking(false)}>
            Keep {sport.label}
          </button>
        </>
      ) : (
        <div className={styles.sportPreset}>
          <Equipment name={sport.icon} size={26} />
          <Tag color={sport.color}>{sport.label}</Tag>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------- tricks --- */

function TickBox({ on, small }: { on: boolean; small?: boolean }) {
  return (
    <span
      className={`${styles.tick} ${small ? styles.tickSmall : ''} ${on ? styles.tickOn : ''}`}
      aria-hidden="true"
    >
      {on ? <Icon name="check" size={small ? 12 : 15} strokeWidth={4} /> : null}
    </span>
  );
}

function TricksField(props: {
  data: SessionFormData;
  values: SessionFormValues;
  errors: Errors;
  onChange: Change;
}) {
  const { data, values, onChange } = props;
  const [added, setAdded] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const searchId = useId();

  const byId = useMemo(() => new Map(data.tricks.map((t) => [t.id, t])), [data.tricks]);
  const chosen = new Map(values.tricks.map((t) => [t.trickId, t.stagePick ?? null]));
  const promoted = new Map(data.promoted.map((p) => [p.trickId, p.label]));

  const rows: FormTrick[] = useMemo(() => {
    const suggested = data.tricks
      .filter((t) => t.sport === values.sport && t.stage && t.stage !== 'every')
      .sort((a, b) => (b.sinceDay ?? '').localeCompare(a.sinceDay ?? ''))
      .slice(0, 3)
      .map((t) => t.id);
    const ids = [...new Set([...values.tricks.map((t) => t.trickId), ...added, ...suggested])];
    return (
      ids
        .map((id) => byId.get(id))
        .filter((t): t is FormTrick => !!t)
        // Switching What you rode switches the list with it. A trick already
        // ticked on the old sport is dropped from view *and* from the session
        // by the effect below, rather than being saved against a sport the
        // rider did not ride.
        .filter((t) => t.sport === values.sport)
    );
  }, [data.tricks, values.sport, values.tricks, added, byId]);

  /*
   * A session holds one sport, so a trick from another one cannot ride along
   * when the rider changes their mind about what they were on.
   */
  const offSport = values.tricks.filter((t) => byId.get(t.trickId)?.sport !== values.sport);
  useEffect(() => {
    if (!offSport.length) return;
    const drop = new Set(offSport.map((t) => t.trickId));
    onChange({ tricks: values.tricks.filter((t) => !drop.has(t.trickId)) });
    // `values.tricks` and `onChange` are the caller's on every render; the
    // guard above is what makes this run once per actual change of sport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.sport, offSport.length]);

  const full = values.tricks.length >= SESSION_LIMITS.tricksMax;

  const toggle = (id: string) => {
    if (chosen.has(id)) onChange({ tricks: values.tricks.filter((t) => t.trickId !== id) });
    else if (!full) onChange({ tricks: [...values.tricks, { trickId: id, landed: false }] });
  };
  /**
   * Pick the stage this trick is moving to, or unpick the one already chosen.
   *
   * `landed` rides along with it so the two never disagree: picking a landed
   * stage is a landing, and taking the pick away takes the landing with it.
   * The server decides either way — a pick that is no longer above the trick's
   * real stage moves nothing.
   */
  const pickStage = (id: string, stage: StageId) => {
    const current = values.tricks.find((t) => t.trickId === id);
    const next = current?.stagePick === stage ? null : stage;
    if (next) {
      // The two stage words and nothing else — never which trick (`analytics.ts`).
      capture(ANALYTICS_EVENTS.sessionTrickStagePicked, {
        from: byId.get(id)?.stage ?? 'none',
        to: next,
      });
    }
    onChange({
      tricks: values.tricks.map((t) =>
        t.trickId === id
          ? { ...t, stagePick: next, landed: next ? isLandedStage(next) : false }
          : t,
      ),
    });
  };

  const listed = new Set(rows.map((r) => r.id));
  const q = query.trim().toLowerCase();
  /*
   * The library search, **filtered to what the rider said they rode** rather
   * than merely sorted by it (2026-09-13). A session holds one sport, so a
   * scooter session offering a skateboard trick was offering a trick it could
   * not honestly record — and "Fa" on a scooter session came back Riding fakie
   * (Skateboard) and Fakie (BMX) above the scooter trick of the same name.
   */
  const matches =
    q.length >= 2
      ? data.tricks
          .filter(
            (t) =>
              t.sport === values.sport && !listed.has(t.id) && t.name.toLowerCase().includes(q),
          )
          .slice(0, 6)
      : [];

  const addTrick = (id: string) => {
    setAdded((current) => [...current, id]);
    if (!full) onChange({ tricks: [...values.tricks, { trickId: id, landed: false }] });
    setQuery('');
    setSearching(false);
  };

  return (
    <>
      <Label aside={rows.length ? `${values.tricks.length} of ${rows.length} picked` : undefined}>
        Tricks you worked on
      </Label>
      <div className={styles.trickList}>
        {rows.map((trick) => {
          const on = chosen.has(trick.id);
          const picked = chosen.get(trick.id) ?? null;
          const moved = promoted.get(trick.id);
          const options = stagesAbove(trick.stage);
          return (
            <div key={trick.id} className={`${styles.trickRow} ${on ? styles.trickRowOn : ''}`}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                className={styles.trickMain}
                onClick={() => toggle(trick.id)}
                disabled={!on && full}
              >
                <TickBox on={on} />
                <span className={styles.trickText}>
                  <span className={styles.trickName}>{trick.name}</span>
                  <span className={styles.trickStage}>
                    {trickStageLine(trick.stage, trick.sinceDay)}
                  </span>
                </span>
              </button>
              {on ? (
                <div className={styles.landedRow}>
                  {moved ? (
                    <span className={styles.stageDone}>Moved to {moved} · it stays there</span>
                  ) : options.length ? (
                    <>
                      <span className={styles.stageFrom}>
                        {trick.stage ? STAGE[trick.stage].label : 'Not tracked'}
                        <span className={styles.stageArrow} aria-hidden="true">
                          <Icon name="arrow-right" size={15} strokeWidth={2.6} />
                        </span>
                      </span>
                      {/*
                        A radiogroup rather than checkboxes: a trick moves to one
                        stage, and tapping the chosen one again clears it — which
                        is the only way back to "worked on it, moved nothing".
                      */}
                      <div
                        role="radiogroup"
                        aria-label={`Move ${trick.name} to`}
                        className={styles.stageOptions}
                      >
                        {options.map((stage) => {
                          const chosenStage = picked === stage;
                          return (
                            <button
                              key={stage}
                              type="button"
                              role="radio"
                              aria-checked={chosenStage}
                              className={`${styles.stageBtn} ${chosenStage ? styles.stageBtnOn : ''}`}
                              style={chosenStage ? { background: STAGE[stage].color } : undefined}
                              onClick={() => pickStage(trick.id, stage)}
                            >
                              {STAGE[stage].label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <span className={styles.stageDone}>Already every time</span>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
        {searching ? (
          <div className={styles.trickSearch}>
            <label htmlFor={searchId} className={styles.srOnly}>
              Find a trick
            </label>
            <input
              id={searchId}
              className={styles.input}
              type="search"
              value={query}
              placeholder="Find a trick in your library"
              autoFocus
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
            />
            {matches.length ? (
              <div className={styles.matchList}>
                {matches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={styles.matchBtn}
                    onClick={() => addTrick(m.id)}
                  >
                    <span className={styles.trickName}>{m.name}</span>
                    <span className={styles.trickStage}>
                      {SPORTS[m.sport].label} · {trickStageLine(m.stage, m.sinceDay)}
                    </span>
                  </button>
                ))}
              </div>
            ) : q.length >= 2 ? (
              <p className={styles.hint}>No trick by that name you can log on your plan.</p>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className={styles.dashedBtn}
            onClick={() => setSearching(true)}
            disabled={full}
          >
            + Another trick
          </button>
        )}
      </div>
      <FieldError message={props.errors.tricks} />
    </>
  );
}

/* ---------------------------------------------------------------- clip --- */

function ClipField(props: {
  data: SessionFormData;
  values: SessionFormValues;
  errors: Errors;
  onChange: Change;
}) {
  const { data, values, onChange } = props;
  const inputId = useId();

  if (!data.clip.allowed) {
    const upgrade = data.upgrade?.name ?? 'a paid plan';
    return (
      <>
        <Label id={inputId}>Clip</Label>
        <div className={styles.clipLocked} aria-labelledby={inputId} aria-disabled="true">
          <span>YouTube, Instagram or TikTok URL</span>
          <Icon name="lock" size={18} />
        </div>
        <p className={styles.lockCopy}>
          {data.planName} logs sessions in words. Links come with {upgrade}.
        </p>
        <Link href={ROUTES.plans} className={styles.plansLink}>
          See the plans
        </Link>
      </>
    );
  }

  const parsed = parseClipLink(values.clip);
  const problem = clipLinkProblem(values.clip);
  const error = props.errors.clip ?? (problem ? CLIP_LINK_REFUSALS[problem] : undefined);

  return (
    <>
      <Label aside="Paste a link">
        <label htmlFor={inputId}>Clip</label>
      </Label>
      <input
        id={inputId}
        className={styles.input}
        type="url"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="YouTube, Instagram or TikTok URL"
        value={values.clip}
        onChange={(e) => onChange({ clip: e.target.value })}
        aria-invalid={error ? true : undefined}
      />
      {parsed ? (
        <div className={styles.clipPreview}>
          <ClipPoster
            platform={parsed.platform}
            href={clipWatchUrl(parsed)}
            className={styles.clipThumb}
          />
          <div className={styles.clipMeta}>
            <PlatformBadge platform={parsed.platform} />
            <div className={styles.clipUrl}>{values.clip.trim()}</div>
          </div>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Clear the clip"
            onClick={() => onChange({ clip: '' })}
          >
            <CloseGlyph />
          </button>
        </div>
      ) : null}
      <FieldError message={error} />
      {!values.clip.trim() ? (
        <p className={styles.hint}>
          We hold the link, not the video. It plays where you posted it.
        </p>
      ) : null}
      {data.clip.remaining !== null && data.clip.remaining <= 3 ? (
        <p className={styles.hint}>
          {data.clip.remaining === 0
            ? 'That is all your session clip links.'
            : `${data.clip.remaining} session clip link${data.clip.remaining === 1 ? '' : 's'} left.`}
        </p>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------- the form -- */

export function FullForm(props: {
  data: SessionFormData;
  values: SessionFormValues;
  errors: Errors;
  isEdit: boolean;
  onChange: Change;
  /** The step being shown (§3.10). */
  step: SessionStepId;
  onStep: (step: SessionStepId) => void;
}) {
  const { data, values, errors, onChange, step } = props;
  const { spots, remember } = useKnownSpots(data);

  /*
   * Move focus to the panel when the step changes, and only then (review S3).
   *
   * `shown` holds the step the panel last rendered with, so the first render
   * does not steal focus from wherever the rider arrived — a form that grabs
   * focus on load is a form that has taken the browser's Find away before
   * anybody asked it to.
   */
  const panel = useRef<HTMLDivElement | null>(null);
  const shown = useRef<SessionStepId>(step);
  useEffect(() => {
    if (shown.current === step) return;
    shown.current = step;
    panel.current?.focus();
  }, [step]);

  const aimId = useId();
  const notesId = useId();
  const dateId = useId();
  const timeId = useId();

  const mates = new Set(data.mates.map((m) => m.id));
  const unseenMates = values.crewIds.filter((id) => !mates.has(id)).length;
  const toggleMate = (id: string) =>
    onChange({
      crewIds: values.crewIds.includes(id)
        ? values.crewIds.filter((m) => m !== id)
        : values.crewIds.length < SESSION_LIMITS.crewMax
          ? [...values.crewIds, id]
          : values.crewIds,
    });

  /*
   * The nine cards, named rather than nested, so the three steps can be
   * written as lists of them (§3.10). Each keeps the `order` it had before
   * T50, which is what `--card-order` reads on a phone — so within a step the
   * phone sequence is still the handoff's 1c order, and the steps cut it into
   * 1–2, 3–5 and 6–9 rather than resequencing anything.
   */
  const whenCard = (
    <Card key="when" order={1}>
      <Label>When</Label>
      <SegmentedPicker
        label="When"
        options={[
          { id: 'now', label: 'Right now' },
          { id: 'pick', label: 'Pick a time' },
        ]}
        value={values.when}
        onChange={(when) => onChange({ when })}
        className={styles.seg}
      />
      {values.when === 'pick' ? (
        <div className={styles.pickRow}>
          <label htmlFor={dateId} className={styles.srOnly}>
            Day
          </label>
          <input
            id={dateId}
            type="date"
            className={styles.input}
            value={values.pickedAt.slice(0, 10)}
            max={data.initial.pickedAt.slice(0, 10) > data.today ? undefined : data.today}
            onChange={(e) =>
              onChange({
                pickedAt: `${e.target.value}T${values.pickedAt.slice(11, 16) || '12:00'}`,
              })
            }
          />
          <label htmlFor={timeId} className={styles.srOnly}>
            Time
          </label>
          <input
            id={timeId}
            type="time"
            className={`${styles.input} ${styles.timeInput}`}
            value={values.pickedAt.slice(11, 16)}
            onChange={(e) =>
              onChange({
                pickedAt: `${values.pickedAt.slice(0, 10) || data.today}T${e.target.value}`,
              })
            }
          />
        </div>
      ) : null}
      <FieldError message={errors.startedAt} />
      <Label spaced>How long</Label>
      <SegmentedPicker
        label="How long"
        options={SESSION_DURATIONS.map((d) => ({ id: d.minutes, label: d.label }))}
        value={values.durationMinutes}
        onChange={(durationMinutes) => onChange({ durationMinutes })}
        className={styles.seg}
      />
    </Card>
  );

  const whereCard = (
    <Card key="where" order={2}>
      <Label>Where</Label>
      <WhereField
        data={data}
        values={values}
        errors={errors}
        onChange={onChange}
        spots={spots}
        remember={remember}
      />
    </Card>
  );

  const sportCard = (
    <Card key="sport" order={3}>
      <SportField data={data} values={values} onChange={onChange} />
    </Card>
  );

  const tricksCard = (
    <Card key="tricks" order={5} id="session-tricks">
      <TricksField data={data} values={values} errors={errors} onChange={onChange} />
    </Card>
  );

  const feelCard = (
    <Card key="feel" order={6}>
      <Label>How it felt</Label>
      <SegmentedPicker
        label="How it felt"
        options={SESSION_FEELS.map((f) => ({
          id: f.id,
          label: f.label,
          color: f.color,
          icon: <FeelFace feel={f.id} size={30} />,
        }))}
        value={values.feel}
        onChange={(feel) => onChange({ feel })}
        // The faces are painted in the feel's own colour, so a flooded
        // cell is that colour twice over (owner, 2026-09-14, in chat).
        fill="soft"
        className={`${styles.seg} ${styles.faces}`}
      />
      <FieldError message={errors.feel} />
      <Label spaced>Weather</Label>
      <SegmentedPicker
        label="Weather"
        options={SESSION_WEATHER.map((w) => ({
          id: w.id,
          label: w.label,
          // 28, not the stroked glyph's 21: the painted art carries its
          // own die-cut margin, so at 21 the weather row read a full
          // weight lighter than the 30px feel row above it and the
          // snowflake lost its arms (2026-09-14, measured on this card).
          icon: <WeatherIcon weather={w.id} size={28} />,
        }))}
        value={values.weather}
        selectedColor={SESSION_WEATHER_SELECTED_COLOR}
        // Soft for the same reason, and for one of its own: the row's
        // selected blue is the colour `cold` and `rain` are painted in.
        fill="soft"
        onChange={(weather) => onChange({ weather: values.weather === weather ? null : weather })}
        className={`${styles.seg} ${styles.faces}`}
      />
    </Card>
  );

  const aimCard = (
    <Card key="aim" order={4} id="session-notes">
      <Label>
        <label htmlFor={aimId}>Aim of the session</label>
      </Label>
      <input
        id={aimId}
        className={styles.input}
        value={values.aim}
        maxLength={SESSION_LIMITS.aimMax}
        placeholder="What are you here to do?"
        onChange={(e) => onChange({ aim: e.target.value })}
      />
      <FieldError message={errors.aim} />
    </Card>
  );

  const notesCard = (
    <Card key="notes" order={7}>
      <Label>
        <label htmlFor={notesId}>Notes</label>
      </Label>
      <textarea
        id={notesId}
        className={`${styles.input} ${styles.notes}`}
        rows={3}
        maxLength={SESSION_LIMITS.notesMax}
        value={values.notes}
        placeholder="What worked, what did not, what to try next time."
        onChange={(e) => onChange({ notes: e.target.value })}
      />
      <FieldError message={errors.notes} />
      <Label spaced>Who you rode with</Label>
      {data.mates.length || unseenMates ? (
        <div className={styles.mateRow}>
          {data.mates.map((m) => {
            const on = values.crewIds.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                className={`${styles.mate} ${on ? styles.mateOn : ''}`}
                onClick={() => toggleMate(m.id)}
              >
                <Avatar avatarId={m.avatarKey} name={m.name} size={22} ringWidth={2} decorative />
                {m.name}
              </button>
            );
          })}
          {unseenMates ? (
            <span className={styles.mateMore}>+ {unseenMates} more tagged</span>
          ) : null}
        </div>
      ) : (
        <p className={styles.hint}>Riders in a crew with you show up here.</p>
      )}
      <FieldError message={errors.crewIds} />
    </Card>
  );

  const clipCard = (
    <Card key="clip" order={8} id="session-clip">
      <ClipField data={data} values={values} errors={errors} onChange={onChange} />
    </Card>
  );

  const visibilityCard = (
    <Card key="visibility" order={9}>
      <Label>Who can see it</Label>
      <SegmentedPicker
        label="Who can see it"
        options={SESSION_VISIBILITIES.map((v) => ({
          id: v.id,
          label: v.label,
          icon: (
            <svg
              viewBox="0 0 24 24"
              width="19"
              height="19"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={VISIBILITY_ICONS[v.id]} />
            </svg>
          ),
        }))}
        value={values.visibility}
        onChange={(visibility) => onChange({ visibility })}
        className={`${styles.seg} ${styles.faces}`}
      />
      <p className={styles.hint}>
        {visibilityLine(values.visibility, data.visibilityDefault)}{' '}
        {/* "Who sees new sessions" has its own address now (#558). */}
        <Link href={ROUTES.accountSessions} className={styles.inlineLink}>
          Change the default
        </Link>
      </p>
    </Card>
  );

  /**
   * The three steps, as two columns each.
   *
   * §3.10 asks for step one as "two cards side by side" on desktop, and the
   * other two follow the same shape: the left column is what the step is
   * mainly about, the right the rest of it. On a phone `.col` is
   * `display: contents` and `--card-order` puts the cards back in the
   * handoff's order, exactly as it did when all nine were on one screen.
   */
  const columns: Record<SessionStepId, readonly [ReactNode[], ReactNode[]]> = {
    when: [[whenCard], [whereCard]],
    what: [[sportCard, aimCard], [tricksCard]],
    notes: [
      [feelCard, clipCard],
      [notesCard, visibilityCard],
    ],
  };
  const [left, right] = columns[step];

  return (
    <div className={styles.body}>
      {/*
        The step row. `TabRow` fires `tabs_switched { group: 'session-form' }`
        itself and never on the active tab (§3.3, §5), so there is nothing for
        this screen to remember.

        A `role="tablist"` rather than links: the steps change the panel under
        the row, not the document — the form is one address whichever step is
        open, which is also what keeps a half-filled form from acquiring three
        history entries a rider has to press Back through.
      */}
      <TabRow
        items={SESSION_STEPS}
        value={step}
        group="session-form"
        label="Session form steps"
        onChange={(id) => props.onStep(id as SessionStepId)}
        className={styles.steps}
      />
      {/*
        Keyed on the step so React remounts it and §4's 120ms cross-fade runs.

        **Named by its tab, and focused when the step changes** (review S3).
        `aria-labelledby` rather than `aria-label`: ARIA's tabs pattern names a
        panel after the tab that controls it, and a name that references its
        source cannot drift from it the way a copy can. It does not make the
        name unique — "Notes" still resolves to this panel *and* the textarea
        inside it, both honestly called that, so a query picks by role. And a
        panel the whole of which was just replaced is where a
        rider who pressed Next now is: without moving focus, a screen reader
        says nothing at all and the rider has to walk backwards through the
        document to find out whether anything happened. `tabIndex={-1}` makes it
        focusable by script without putting it in the tab order.
      */}
      <div
        key={step}
        ref={panel}
        tabIndex={-1}
        className={`${styles.cols} ${TAB_PANEL}`}
        role="tabpanel"
        aria-labelledby={SESSION_STEPS.find((s) => s.id === step)?.elementId}
      >
        <div className={styles.col}>{left}</div>
        <div className={styles.col}>{right}</div>
      </div>
    </div>
  );
}
