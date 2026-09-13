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
  clipLinkProblem,
  clipWatchUrl,
  parseClipLink,
  type SessionField,
  type SportId,
} from '@landit/core';
import {
  Avatar,
  ClipPoster,
  Equipment,
  FeelFace,
  Icon,
  PlatformBadge,
  SegmentedPicker,
  VISIBILITY_ICONS,
  WeatherIcon,
} from '@landit/ui-web';
import Link from 'next/link';
import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';

import { ROUTES } from '@/lib/routes';
import {
  eventsAtSpotToday,
  landedPreview,
  trickStageLine,
  visibilityLine,
  type SessionFormValues,
} from '@/lib/sessionForm';

import styles from './form.module.css';
import { SpotSearchSheet } from './SpotSearchSheet';
import type { FormSpot, FormTrick, SessionFormData } from './types';

/**
 * The full form's twelve fields, in the handoff's order (1c phone, 2g desktop).
 * One component tree for both: two columns above 700px, one below, with each
 * card's `order` putting the phone sequence back together.
 */

type Change = (patch: Partial<SessionFormValues>) => void;
type Errors = Partial<Record<SessionField, string>>;

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];

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
  const chosen = new Map(values.tricks.map((t) => [t.trickId, t.landed]));
  const promoted = new Map(data.promoted.map((p) => [p.trickId, p.label]));

  const rows: FormTrick[] = useMemo(() => {
    const suggested = data.tricks
      .filter((t) => t.sport === values.sport && t.stage && t.stage !== 'every')
      .sort((a, b) => (b.sinceDay ?? '').localeCompare(a.sinceDay ?? ''))
      .slice(0, 3)
      .map((t) => t.id);
    const ids = [...new Set([...values.tricks.map((t) => t.trickId), ...added, ...suggested])];
    return ids.map((id) => byId.get(id)).filter((t): t is FormTrick => !!t);
  }, [data.tricks, values.sport, values.tricks, added, byId]);

  const full = values.tricks.length >= SESSION_LIMITS.tricksMax;

  const toggle = (id: string) => {
    if (chosen.has(id)) onChange({ tricks: values.tricks.filter((t) => t.trickId !== id) });
    else if (!full) onChange({ tricks: [...values.tricks, { trickId: id, landed: false }] });
  };
  const toggleLanded = (id: string) =>
    onChange({
      tricks: values.tricks.map((t) => (t.trickId === id ? { ...t, landed: !t.landed } : t)),
    });

  const listed = new Set(rows.map((r) => r.id));
  const q = query.trim().toLowerCase();
  const matches =
    q.length >= 2
      ? data.tricks
          .filter((t) => !listed.has(t.id) && t.name.toLowerCase().includes(q))
          .sort((a, b) => Number(b.sport === values.sport) - Number(a.sport === values.sport))
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
          const landed = chosen.get(trick.id) === true;
          const moved = promoted.get(trick.id);
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
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={landed}
                    className={`${styles.landedBtn} ${landed ? styles.landedOn : ''}`}
                    onClick={() => toggleLanded(trick.id)}
                  >
                    <TickBox on={landed} small />
                    Landed it
                  </button>
                  {moved ? (
                    <span className={styles.landedTo}>Moved to {moved} · it stays there</span>
                  ) : landed ? (
                    <span className={styles.landedTo}>{landedPreview(trick.stage)}</span>
                  ) : null}
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
}) {
  const { data, values, errors, onChange } = props;
  const { spots, remember } = useKnownSpots(data);
  const aimId = useId();
  const notesId = useId();
  const dateId = useId();
  const timeId = useId();
  const multiSport = data.sports.length > 1;

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

  return (
    <div className={styles.body}>
      <div className={styles.cols}>
        <div className={styles.col}>
          <Card order={1}>
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

          <Card order={2}>
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

          {multiSport ? (
            <Card order={3}>
              <Label>What you rode</Label>
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
                onChange={(sport) => onChange({ sport })}
                className={styles.seg}
              />
              <p className={styles.hint}>
                You ride {NUMBER_WORDS[data.sports.length] ?? data.sports.length} sports, so we ask.
                One sport and this row is gone.
              </p>
            </Card>
          ) : null}

          <Card order={5} id="session-tricks">
            <TricksField data={data} values={values} errors={errors} onChange={onChange} />
          </Card>
        </div>

        <div className={styles.col}>
          <Card order={6}>
            <Label>How it felt</Label>
            <SegmentedPicker
              label="How it felt"
              options={SESSION_FEELS.map((f) => ({
                id: f.id,
                label: f.label,
                color: f.color,
                icon: (
                  <FeelFace feel={f.id} size={30} strokeWidth={values.feel === f.id ? 2.6 : 2.2} />
                ),
              }))}
              value={values.feel}
              onChange={(feel) => onChange({ feel })}
              className={`${styles.seg} ${styles.faces}`}
            />
            <FieldError message={errors.feel} />
            <Label spaced>Weather</Label>
            <SegmentedPicker
              label="Weather"
              options={SESSION_WEATHER.map((w) => ({
                id: w.id,
                label: w.label,
                icon: <WeatherIcon weather={w.id} size={21} />,
              }))}
              value={values.weather}
              selectedColor={SESSION_WEATHER_SELECTED_COLOR}
              onChange={(weather) =>
                onChange({ weather: values.weather === weather ? null : weather })
              }
              className={`${styles.seg} ${styles.faces}`}
            />
          </Card>

          <Card order={4} id="session-notes">
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

          <Card order={7}>
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
                      <Avatar
                        avatarId={m.avatarKey}
                        name={m.name}
                        size={22}
                        ringWidth={2}
                        decorative
                      />
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

          <Card order={8} id="session-clip">
            <ClipField data={data} values={values} errors={errors} onChange={onChange} />
          </Card>

          <Card order={9}>
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
              <Link href={ROUTES.account} className={styles.inlineLink}>
                Change the default
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
