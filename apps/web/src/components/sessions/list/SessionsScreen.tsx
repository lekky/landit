'use client';

import {
  SESSIONS_PER_PAGE,
  filterSessions,
  groupSessionsByMonth,
  sessionMonthSummary,
  sessionStageMoves,
  sessionTimeLabel,
} from '@landit/core';
import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { DeleteSessionDialog } from '@/components/sessions/DeleteSessionDialog';
import { BackLink } from '@/components/shell/BackLink';
import { SportScopeSelect, useSportScope } from '@/components/shell/SportScopeSelect';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { ROUTES } from '@/lib/routes';
import type { SportScope } from '@/lib/sportScope';
import {
  clampPage,
  defaultOpenMonths,
  pageCount,
  pageRangeLabel,
  sessionCountLabel,
  sessionListFilter,
} from '@/lib/sessionList';
import { newSessionHref } from '@/lib/sessionRoutes';

import { FeedCard } from './FeedCard';
import { MonthAccordions } from './MonthAccordions';
import { Pager } from './Pager';
import { SessionsSidebar } from './SessionsSidebar';
import { SessionsTable } from './SessionsTable';
import type { SessionCardView, SessionsView } from './types';
import styles from './sessionsList.module.css';

/** Rows on a page of the desktop table: a whole summer, as 1b draws it. */
export const TABLE_PER_PAGE = 25;

type ViewMode = 'feed' | 'list';

/**
 * Progress › Sessions (T37): the feed (1a/2a), the desktop table (1b), the
 * phone month accordions (2b), the filters and the sidebar.
 *
 * A client component because the filters, the pages, the view toggle and the
 * accordions are all instant local state over a diary the server already
 * sent. Every count on screen is recomputed from `@landit/core` over the
 * filtered sessions (`filterSessions`, `groupSessionsByMonth`), never kept as a
 * second number that could disagree.
 *
 * **The header is the screen's own since T50** (rethink §3.10). It said
 * *Progress* under a Home back link, with the Sessions / Where-you're-at row
 * beneath it — so a rider who pressed the blue **Sessions** card on Home landed
 * on a page called *Progress*, one tap from where the green **Progress** card
 * goes. T46 left that deliberately (its note says so) because the header was
 * this task's; it now reads **Sessions**, and `ProgressTabs` is gone with the
 * rest of the in-page tab rows the rethink retired. Progress is reached from
 * its own card on Home.
 */
export function SessionsScreen({ view }: { view: SessionsView }) {
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>('feed');
  /**
   * The two filters, where there was one row of chips (T50).
   *
   * The sport is the `SportScopeSelect`'s — "Your sport (Scooter)", every
   * sport, or one named sport — and it **tracks the top-bar chip** by default
   * (O1: the diary opens on the rider's own sport), which is what "lists follow
   * the chip" means on this screen. "At an event" is a pill of its own rather
   * than a fourth chip in the same row, because it answers a different
   * question: the old row made "BMX" and "At an event" alternatives, so a rider
   * could not ask for their BMX jam sessions at all.
   */
  const scope = useSportScope('sessions', 'chip');
  const [atEvent, setAtEvent] = useState(false);
  const [page, setPage] = useState(1);
  const [tablePage, setTablePage] = useState(1);
  const [openMonths, setOpenMonths] = useState<ReadonlySet<string>>(
    () => new Set(defaultOpenMonths(view.currentMonthKey)),
  );
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  const [deleting, setDeleting] = useState<SessionCardView | null>(null);

  const all = useMemo(
    () => view.sessions.filter((s) => !removed.has(s.id)),
    [view.sessions, removed],
  );
  const byId = useMemo(() => new Map(all.map((s) => [s.id, s])), [all]);

  const scopeSports = scope.sports;
  const filtered = useMemo(() => {
    const kept = filterSessions(
      all.map((s) => s.session),
      sessionListFilter(scopeSports, atEvent),
    );
    return kept.map((s) => byId.get(s.id)).filter((s): s is SessionCardView => Boolean(s));
  }, [all, byId, scopeSports, atEvent]);

  const months = useMemo(
    () =>
      groupSessionsByMonth(
        filtered.map((s) => s.session),
        view.timezone,
      ).map((group) => ({
        ...group,
        views: group.sessions
          .map((s) => byId.get(s.id))
          .filter((s): s is SessionCardView => Boolean(s)),
      })),
    [filtered, byId, view.timezone],
  );

  const totalMinutes = filtered.reduce((sum, s) => sum + s.session.durationMinutes, 0);
  const totalMoves = filtered.reduce((sum, s) => sum + sessionStageMoves(s.session).length, 0);
  const oldest = filtered[filtered.length - 1];

  const feedPages = pageCount(filtered.length, SESSIONS_PER_PAGE);
  const feedPage = clampPage(page, feedPages);
  const feedItems = filtered.slice(
    (feedPage - 1) * SESSIONS_PER_PAGE,
    feedPage * SESSIONS_PER_PAGE,
  );

  const tablePages = pageCount(filtered.length, TABLE_PER_PAGE);
  const tableAt = clampPage(tablePage, tablePages);
  const tableItems = filtered.slice((tableAt - 1) * TABLE_PER_PAGE, tableAt * TABLE_PER_PAGE);

  const toFirstPage = () => {
    setPage(1);
    setTablePage(1);
  };

  /**
   * The scope select, with both pagers reset behind it (review S2).
   *
   * The chip row it replaced did this on every press, in `chooseFilter`. Left
   * out, a rider on page 2 of the feed who widened the scope to "All sports"
   * stayed on page *2* of a now longer list — so the newest sessions in the
   * sport they had just added were on the page above, and they were never shown
   * them. The pill already resets; this puts the select back in step with it.
   */
  const scopeControl = {
    ...scope,
    setScope: (next: SportScope) => {
      scope.setScope(next);
      toFirstPage();
    },
  };

  const chooseMode = (next: ViewMode) => {
    if (next === mode) return;
    setMode(next);
    capture(ANALYTICS_EVENTS.sessionsViewSet, { view: next });
  };

  const toggleMonth = (key: string) =>
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const logOpened = () => capture(ANALYTICS_EVENTS.sessionLogOpened, { source: 'progress' });

  const quota = view.sidebar.quota;
  const empty = view.sessions.length === 0 || all.length === 0;

  const toggle = (
    <div className={styles.toggle} role="group" aria-label="Show sessions as">
      <button
        type="button"
        className={`${styles.toggleBtn} ${styles.tap} ${mode === 'feed' ? styles.toggleOn : ''}`}
        aria-pressed={mode === 'feed'}
        onClick={() => chooseMode('feed')}
      >
        <svg
          className={styles.hidePhone}
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h11M4 18h7" />
        </svg>
        Feed
      </button>
      <button
        type="button"
        className={`${styles.toggleBtn} ${styles.tap} ${mode === 'list' ? styles.toggleOn : ''}`}
        aria-pressed={mode === 'list'}
        onClick={() => chooseMode('list')}
      >
        <svg
          className={styles.hidePhone}
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 5h16M4 12h16M4 19h16M9 5v14" />
        </svg>
        <span className={styles.hidePhone}>Table</span>
        <span className={styles.hideDesktop}>List</span>
      </button>
    </div>
  );

  const countHead = (
    <div className={`${styles.listHead} ${mode === 'feed' ? styles.hideDesktop : ''}`}>
      <span className={styles.listCount}>{sessionCountLabel(filtered.length)}</span>
      {oldest ? (
        <>
          <span className={`${styles.listMeta} ${styles.hidePhone}`}>
            Since {oldest.sinceLong} · {sessionTimeLabel(totalMinutes)} · {totalMoves} stage{' '}
            {totalMoves === 1 ? 'move' : 'moves'}
          </span>
          <span className={`${styles.listMeta} ${styles.hideDesktop}`}>
            Since {oldest.sinceShort}
          </span>
        </>
      ) : null}
      <div className={styles.listHeadEnd}>{toggle}</div>
    </div>
  );

  /**
   * The month's three numbers, on the phone (rethink §3.10).
   *
   * The desktop has had them since T37, in the ink month card at the top of the
   * sidebar — and `.sidebar` is `display: none` below 700px, so a phone saw
   * none of them. Three blocks in the design's stat treatment put the answer to
   * "how is this month going" above the feed on the one device the rethink is
   * for, and the sidebar is left exactly as it was rather than being unhidden:
   * four cards including a plans teaser is not what belongs above a diary on a
   * 390px screen.
   *
   * **They are the scope's numbers, not the account's** (integration review,
   * F4). They were `view.sidebar`'s — this month across every sport, counted on
   * the server — sitting directly above a feed the `SportScopeSelect` narrows.
   * Measured on a rider with three scooter sessions and the chip on skate, the
   * screen read "3 SESSIONS · 3H · 1 MOVED UP" and then, an inch below it, "No
   * sessions". The blocks and the feed answer the same question now: the same
   * `sessionMonthSummary` the server runs, over the same filtered list the feed
   * is showing. Every session the month holds is already on the client — the
   * loader reads them all and the paging is done here — so this costs no read.
   *
   * The **quota strip** below is deliberately left account-wide: a monthly cap
   * counts sessions, not sessions of one sport, and narrowing it would be a
   * screen telling a rider they have more of their allowance left than they do.
   */
  const scopedMonth = useMemo(
    () =>
      sessionMonthSummary(
        filtered.map((s) => s.session),
        view.currentMonthKey,
        view.timezone,
      ),
    [filtered, view.currentMonthKey, view.timezone],
  );

  const monthStats = (
    <section className={`${styles.phoneMonth} ${styles.hideDesktop}`} aria-label="This month">
      <span className={`lab ${styles.phoneMonthHead}`}>{view.sidebar.monthName} so far</span>
      <div className={styles.monthStats}>
        <StatBlock
          n={scopedMonth.sessions}
          label={scopedMonth.sessions === 1 ? 'session' : 'sessions'}
          hue="var(--yellow)"
        />
        <StatBlock
          n={sessionTimeLabel(scopedMonth.minutes)}
          label="on the board"
          hue="var(--lime)"
        />
        <StatBlock n={scopedMonth.stageMoves} label="moved up" hue="var(--pink-soft)" />
      </div>
    </section>
  );

  return (
    <div className={styles.screen}>
      {/*
        The Home back link (rethink §2.3, T46).

        Sessions is one of the four screens that lost their place in the bar
        when the shell folded nine destinations into four groups (D8): it is
        reached from a record card on Home, and Home's cell stays lit while a
        rider is here. A screen that is under something has to say what, or
        being under it is only true in the routing table.
      */}
      <BackLink href={ROUTES.dashboard} label="Home" />

      <div className={styles.top}>
        <h1 className={styles.title}>Sessions</h1>
        <Link
          href={newSessionHref()}
          className={`${styles.logBtn} ${styles.hidePhone}`}
          onClick={logOpened}
        >
          <Icon name="plus" size={17} />
          Log a session
        </Link>
      </div>

      <Link
        href={newSessionHref()}
        className={`${styles.logBtn} ${styles.logBtnWide} ${styles.hideDesktop}`}
        onClick={logOpened}
      >
        <Icon name="plus" size={18} />
        Log a session
      </Link>

      {quota ? (
        <Link href={ROUTES.plans} className={`${styles.quotaStrip} ${styles.hideDesktop}`}>
          <span className={styles.quotaStripPips} aria-hidden="true">
            {quota.pips.map((pip, i) => (
              <i key={i} className={pip === 'used' ? styles.pipUsed : styles.pipFree} />
            ))}
          </span>
          <span className={styles.quotaStripText}>{quota.line}</span>
          <Icon name="arrow-right" size={18} className={styles.quotaStripArrow} />
        </Link>
      ) : null}

      {empty ? (
        <div className={styles.layout}>
          <div className={styles.main}>
            <section className={styles.empty} aria-labelledby="sessions-empty">
              <h2 id="sessions-empty" className={styles.emptyTitle}>
                Nothing logged yet
              </h2>
              <p className={styles.emptyCopy}>
                Log your next ride — where you went, what you worked on, how it felt — and your
                sessions stack up here.
              </p>
              <Link href={newSessionHref()} className={styles.logBtn} onClick={logOpened}>
                <Icon name="plus" size={17} />
                Log a session
              </Link>
            </section>
          </div>
          <SessionsSidebar sidebar={view.sidebar} />
        </div>
      ) : (
        <div className={`${styles.layout} ${mode === 'list' ? styles.layoutWide : ''}`}>
          <div className={styles.main}>
            {monthStats}
            {countHead}

            <div className={styles.filters}>
              {/*
                "Show: Your sport (Scooter)" (§3.3, O1) — the same control the
                two Find lists carry, on its fourth screen. It fires
                `sport_scope_set` from inside `useSportScope`, so no screen has
                to remember to count the press.
              */}
              <SportScopeSelect
                state={scopeControl}
                everyLabel="All sports"
                label="Show sessions for"
                className={styles.scope}
              />
              {/*
                "At an event" stays a pill (§3.10). It is a filter rather than a
                way of getting about, which is the line D6 draws between a pill
                and a boxed tab, and it is now independent of the sport.
              */}
              <button
                type="button"
                className={`${styles.chip} ${styles.tap} ${atEvent ? styles.chipOn : ''}`}
                aria-pressed={atEvent}
                onClick={() => {
                  setAtEvent((on) => !on);
                  toFirstPage();
                }}
              >
                At an event
              </button>
              {mode === 'feed' ? (
                <div className={`${styles.filtersEnd} ${styles.hidePhone}`}>
                  <span className={styles.rangeCount}>{sessionCountLabel(filtered.length)}</span>
                  {toggle}
                </div>
              ) : null}
            </div>

            {filtered.length === 0 ? (
              <p className={styles.noMatch}>Nothing logged under that filter yet.</p>
            ) : mode === 'feed' ? (
              <>
                <div className={styles.feed}>
                  {feedItems.map((item) => (
                    <FeedCard key={item.id} item={item} onDelete={() => setDeleting(item)} />
                  ))}
                </div>
                <Pager
                  label={pageRangeLabel(feedPage, SESSIONS_PER_PAGE, filtered.length)}
                  page={feedPage}
                  totalPages={feedPages}
                  onPage={setPage}
                />
              </>
            ) : (
              <>
                <div className={styles.hidePhone}>
                  <SessionsTable
                    items={tableItems}
                    footLabel={
                      tablePages === 1
                        ? `All ${filtered.length} · everything you have logged`
                        : pageRangeLabel(tableAt, TABLE_PER_PAGE, filtered.length)
                    }
                    page={tableAt}
                    totalPages={tablePages}
                    onPage={setTablePage}
                    onDelete={setDeleting}
                  />
                </div>
                <div className={styles.hideDesktop}>
                  <MonthAccordions months={months} open={openMonths} onToggle={toggleMonth} />
                </div>
              </>
            )}
          </div>
          {mode === 'feed' ? <SessionsSidebar sidebar={view.sidebar} /> : null}
        </div>
      )}

      {deleting ? (
        <DeleteSessionDialog
          session={{
            id: deleting.id,
            spotName: deleting.spot.name,
            dateLabel: deleting.dateLabel,
          }}
          onClose={() => setDeleting(null)}
          onDeleted={(id) => {
            setDeleting(null);
            setRemoved((prev) => new Set(prev).add(id));
            // The month card, the quota and "Where you ride" are the server's
            // numbers; ask for them again rather than guessing here.
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** One of the month's three numbers, in Home's stat-block treatment (§3.10). */
function StatBlock({ n, label, hue }: { n: number | string; label: string; hue: string }) {
  return (
    <div className={styles.monthStat} style={{ background: hue }}>
      <div className={`d ${styles.monthStatN}`}>{n}</div>
      <div className={`lab ${styles.monthStatL}`}>{label}</div>
    </div>
  );
}
