'use client';

import { useState, type ReactNode } from 'react';

import { Pager } from '@/components/sessions/list/Pager';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import { clampPage, pageCount, pageRangeLabel } from '@/lib/sessionList';

/**
 * A panel's rows, a page at a time (2026-09-13).
 *
 * Both of a trick page's own-record panels used to stop at a fixed number of
 * rows and say nothing about the rest: the history drew every entry it had, and
 * "<Trick> in your sessions" drew six and simply ended. Neither told a rider
 * there was more, which is the thing pagination is actually for here — a rider
 * who logs twice a week has forty sessions on a trick by the spring.
 *
 * **The rows are already loaded**, so paging is local state and not a fetch:
 * both panels read the rider's own rows in one go on the server, and the
 * alternative — a page number in the address — would reload a long trick page
 * to move a list inside it. The trade is that page two has no address of its
 * own, which is the right way round for a panel rather than a screen.
 *
 * Children are the rows, already rendered on the server. They cross the
 * boundary as a payload, so nothing about how a row is drawn moves into the
 * browser — this component only decides which ones are on screen.
 */
export function PagedPanel({
  panel,
  rows,
  perPage,
  noun,
  className,
  pagerClassName,
}: {
  /** Which panel, for `trick_panel_paged`. Never which trick. */
  panel: 'history' | 'sessions';
  rows: readonly ReactNode[];
  perPage: number;
  /** What the rows are, for "Showing 1–6 of 41 sessions". */
  noun: string;
  className?: string;
  pagerClassName?: string;
}) {
  const [page, setPage] = useState(1);
  // The same three helpers the Sessions list pages with, so a panel and a
  // screen cannot drift on what "page 2 of 7" means.
  const totalPages = pageCount(rows.length, perPage);
  const current = clampPage(page, totalPages);
  const from = (current - 1) * perPage;

  return (
    <>
      <div className={className}>{rows.slice(from, from + perPage)}</div>
      {totalPages > 1 ? (
        <Pager
          label={`${pageRangeLabel(current, perPage, rows.length)} ${noun}`}
          page={current}
          totalPages={totalPages}
          className={pagerClassName}
          onPage={(next) => {
            setPage(next);
            capture(ANALYTICS_EVENTS.trickPanelPaged, { panel, page: next });
          }}
        />
      ) : null}
    </>
  );
}
