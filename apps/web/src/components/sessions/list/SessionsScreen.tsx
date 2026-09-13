'use client';

import {
  SESSIONS_PER_PAGE,
  filterSessions,
  groupSessionsByMonth,
  sessionStageMoves,
  sessionTimeLabel,
} from '@landit/core';
import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { DeleteSessionDialog } from '@/components/sessions/DeleteSessionDialog';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { ROUTES } from '@/lib/routes';
import {
  clampPage,
  defaultOpenMonths,
  pageCount,
  pageRangeLabel,
  sessionCountLabel,
  sessionFilterFor,
  type SessionListFilterId,
} from '@/lib/sessionList';
import { newSessionHref } from '@/lib/sessionRoutes';

import { FeedCard } from './FeedCard';
import { MonthAccordions } from './MonthAccordions';
import { Pager } from './Pager';
import { ProgressTabs } from './ProgressTabs';
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
 */
export function SessionsScreen({ view }: { view: SessionsView }) {
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>('feed');
  const [filter, setFilter] = useState<SessionListFilterId>('all');
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

  const filtered = useMemo(() => {
    const kept = filterSessions(
      all.map((s) => s.session),
      sessionFilterFor(filter),
    );
    return kept.map((s) => byId.get(s.id)).filter((s): s is SessionCardView => Boolean(s));
  }, [all, byId, filter]);

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

  const chooseFilter = (id: SessionListFilterId) => {
    setFilter(id);
    setPage(1);
    setTablePage(1);
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

  const filters: { id: SessionListFilterId; label: string }[] = [
    { id: 'all', label: 'All' },
    ...view.filterSports.map((s) => ({ id: s.id, label: s.label })),
    { id: 'event', label: 'At an event' },
  ];

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

  return (
    <div className={styles.screen}>
      <div className={styles.top}>
        <h1 className={styles.title}>Progress</h1>
        <Link
          href={newSessionHref()}
          className={`${styles.logBtn} ${styles.hidePhone}`}
          onClick={logOpened}
        >
          <Icon name="plus" size={17} />
          Log a session
        </Link>
      </div>

      <ProgressTabs current="sessions" />

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
            {countHead}

            <div className={styles.filters}>
              <span className={`${styles.filterLabel} ${styles.hidePhone}`}>Filter</span>
              <div className={styles.chips} role="group" aria-label="Filter sessions">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`${styles.chip} ${styles.tap} ${filter === f.id ? styles.chipOn : ''}`}
                    aria-pressed={filter === f.id}
                    onClick={() => chooseFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
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
