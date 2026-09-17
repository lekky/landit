'use client';

import { SPORTS, STAGE } from '@landit/core';
import { Icon, Sheet, Tag, type IconName } from '@landit/ui-web';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { trickHref } from '@/lib/routes';
import { runActionOr } from '@/lib/runAction';
import { newSessionHref } from '@/lib/sessionRoutes';
import { useSport } from '@/providers/sport';
import { useToast } from '@/providers/toast';

import { rodeTodayAction } from '@/app/(app)/home/actions';

import { trickPickerAction, type PickerTrick, type TrickPicker } from './actions';
import styles from './shell.module.css';

/**
 * "Log something" — the sheet behind the LOG cell and the desktop Log button
 * (D3, rethink §3.5).
 *
 * The product's four ways of recording a ride were in four different places: "I
 * rode today" on Home's streak card, the stage picker on a trick page, the
 * session form behind Progress, and the clip field further down a trick page.
 * A rider who opened the app to log something had to know which screen held
 * which. This is the one front door, and it is the middle cell of the bar on a
 * phone because logging is what a rider opens this product to do.
 *
 * It does not log anything itself beyond the one-tap ride: the other three hand
 * over to the screens that already own those writes, which is what keeps this a
 * signpost rather than a fifth way to write a session.
 *
 * `Sheet` is a sheet on a phone and the shared `Modal` on a desktop, so this
 * file says nothing about widths.
 */

/* ------------------------------------------------------------ option row -- */

/**
 * One of the sheet's four (and the shape the settings list and Home's cards
 * take later): a fixed-fill icon square, a title, a line saying what it costs,
 * and an arrow.
 *
 * The line is the part that earns its place. "Log a session" and "I rode today"
 * are the same act at two levels of effort, and a rider deciding between them
 * on a wet Tuesday is deciding how much they can face — so each row says what
 * it will ask of them rather than what it is called.
 */
export function OptionRow({
  icon,
  fill,
  title,
  line,
  onClick,
  quiet = false,
  disabled = false,
}: {
  icon: IconName;
  /** The icon square's fixed fill. Ink sits on it (`--on-light`). */
  fill: string;
  title: string;
  line: string;
  onClick: () => void;
  /** The quiet register: a dashed keyline and no shadow. */
  quiet?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles.optionRow} ${quiet ? styles.optionRowQuiet : ''}`.trim()}
      onClick={onClick}
      disabled={disabled}
    >
      <span className={styles.optionMark} style={{ background: fill }} aria-hidden="true">
        <Icon name={icon} size={22} strokeWidth={2.4} />
      </span>
      <span className={styles.optionText}>
        <span className={styles.optionTitle}>{title}</span>
        <span className={styles.optionLine}>{line}</span>
      </span>
      <Icon name="arrow-right" size={18} strokeWidth={2.4} className={styles.optionArrow} />
    </button>
  );
}

/* ---------------------------------------------------------- trick picker -- */

/**
 * Which trick, for the two rows that need one.
 *
 * Three recent ones and then a search, rather than a search alone: a rider
 * logging a trick is almost always logging one of the two or three they are in
 * the middle of, and making them type its name for the fourth day running is
 * the kind of small tax that stops a thing being logged at all. The three come
 * from the rider's own `trick_progress` rows, newest write first.
 *
 * The search is a plain substring match over the sport's library, done in the
 * browser: the list is a few hundred names and it arrived with the rows above
 * it, so a keystroke costs nothing and nothing a rider types leaves the device.
 */
function TrickPicker({
  landedOnly,
  onPick,
}: {
  landedOnly: boolean;
  onPick: (trick: PickerTrick) => void;
}) {
  const { sport } = useSport();
  const [data, setData] = useState<TrickPicker>({ recent: [], all: [], startHere: [] });
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let live = true;
    void trickPickerAction(sport, landedOnly).then((answer) => {
      if (!live) return;
      setData(answer);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [sport, landedOnly]);

  const needle = query.trim().toLowerCase();
  /*
   * Recents when there are any, the starter tricks when there are not.
   *
   * A rider's first day used to be an empty search box under "Search for the one
   * you rode." — a sentence addressed to somebody who has ridden nothing the
   * product knows about yet. The server sends four tricks to begin on (the same
   * four Home's own "Start here" offers), and the heading changes with them so
   * the list never claims to be a history.
   */
  const starting = data.recent.length === 0 && data.startHere.length > 0;
  const rows = needle
    ? data.all.filter((trick) => trick.name.toLowerCase().includes(needle)).slice(0, 30)
    : starting
      ? data.startHere
      : data.recent;

  return (
    <>
      <div className={`search ${styles.pickerSearch}`}>
        <Icon name="search" size={18} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${SPORTS[sport].label.toLowerCase()} tricks`}
          aria-label="Search tricks"
        />
      </div>

      {!needle && data.recent.length > 0 && (
        <p className={styles.sheetNote}>What you have been working on</p>
      )}
      {!needle && starting && (
        <p className={styles.sheetNote}>Start here — or search for another</p>
      )}

      <ul className={styles.pickerList}>
        {rows.map((trick) => (
          <li key={trick.slug}>
            <button type="button" className={styles.pickerRow} onClick={() => onPick(trick)}>
              {trick.name}
              {trick.stage && (
                <span className={styles.pickerStage}>{STAGE[trick.stage].short}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {loaded && rows.length === 0 && (
        <p className={styles.sheetNote}>
          {needle
            ? 'Nothing by that name.'
            : landedOnly
              ? 'Land a trick first, then a clip has somewhere to go.'
              : 'Search for the one you rode.'}
        </p>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- sheet -- */

type View = 'menu' | 'trick' | 'clip';

export function LogSheet({
  onClose,
  sessionsEnabled,
}: {
  onClose: () => void;
  /** The session rows are drawn only for a rider the preview covers (T41). */
  sessionsEnabled?: boolean;
}) {
  const { sport } = useSport();
  const router = useRouter();
  const { toast } = useToast();
  const [view, setView] = useState<View>('menu');
  const [pending, startTransition] = useTransition();

  const picked = (action: 'rode' | 'trick' | 'session' | 'clip') =>
    capture(ANALYTICS_EVENTS.logActionPicked, { action });

  /*
   * "I rode today", the same server action Home's streak card posts to, wrapped
   * the same way: a thrown action comes back as a refusal rather than vanishing
   * (`runAction.ts`). The toast is the product's existing one, so a ride logged
   * from here and a ride logged from the card say the same thing.
   */
  const rodeToday = () => {
    if (pending) return;
    picked('rode');
    startTransition(async () => {
      const result = await runActionOr('ride_logged', rodeTodayAction, (error) => ({ error }));
      if (result.error) {
        toast(result.error, 'var(--red)');
        return;
      }
      if (result.logged) {
        capture(ANALYTICS_EVENTS.rideLogged, {
          rides_this_week:
            (result.streak?.cells.filter(Boolean).length ?? 0) + (result.streak?.spare ?? 0),
          week_banked: result.streak?.encouragement === 'This week is banked.',
        });
        toast(
          result.streak?.encouragement === 'This week is banked.'
            ? 'Ride logged. This week is banked.'
            : 'Ride logged. Nice one.',
          'var(--lime)',
        );
      } else {
        toast('Already counted today. One a day is all it takes.', 'var(--yellow)');
      }
      // The card on Home shows the same numbers, so the screen behind is asked
      // for fresh ones rather than left showing yesterday's.
      router.refresh();
      onClose();
    });
  };

  const goToTrick = (trick: PickerTrick, hash: string) => {
    onClose();
    // `#ladder` and `#clips` are the trick page's own anchors (T49): the yellow
    // stage band, and the row holding the rider's history, notes and videos —
    // which `LogPanel` opens on Your videos when it is reached this way.
    router.push(`${trickHref(trick.slug)}${hash}` as Route);
  };

  // A string, not a `ReactNode`: it is the dialog's accessible name as well as
  // its heading, and `label` takes words.
  const title =
    view === 'menu' ? 'Log something' : view === 'trick' ? 'Which trick?' : 'Clip on which trick?';

  return (
    <Sheet
      onClose={onClose}
      title={title}
      // The sport sits at the right of the title's line (§3.5), and `label`
      // keeps the dialog announced by its words rather than by its words plus
      // a tag.
      label={title}
      titleAside={<Tag color={SPORTS[sport].color}>{SPORTS[sport].short}</Tag>}
      width={560}
    >
      {view !== 'menu' && (
        <div className={styles.sheetHead}>
          <button type="button" className="btn ghost sm" onClick={() => setView('menu')}>
            Back
          </button>
        </div>
      )}

      {view === 'menu' && (
        <>
          <OptionRow
            icon="check"
            fill="var(--lime)"
            title="I rode today"
            line="One tap. Counts a ride for the streak, nothing else."
            onClick={rodeToday}
            disabled={pending}
          />
          <OptionRow
            icon="grid"
            fill="var(--yellow)"
            title="Log a trick"
            line="One trick, up a stage."
            onClick={() => {
              picked('trick');
              setView('trick');
            }}
          />
          {sessionsEnabled && (
            <OptionRow
              icon="clock"
              fill="var(--sky)"
              title="Log a session"
              line="A ride: where, how long, how it felt, the tricks you worked on."
              onClick={() => {
                picked('session');
                onClose();
                router.push(newSessionHref({ quick: true }));
              }}
            />
          )}
          <OptionRow
            icon="play"
            fill="var(--paper)"
            title="Add a clip link"
            line="YouTube or TikTok, onto a trick you have logged."
            quiet
            onClick={() => {
              picked('clip');
              setView('clip');
            }}
          />
        </>
      )}

      {view === 'trick' && (
        <TrickPicker landedOnly={false} onPick={(trick) => goToTrick(trick, '#ladder')} />
      )}
      {view === 'clip' && <TrickPicker landedOnly onPick={(trick) => goToTrick(trick, '#clips')} />}
    </Sheet>
  );
}
