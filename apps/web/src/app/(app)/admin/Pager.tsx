'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import styles from './admin.module.css';

/**
 * The foot of a paged staff table, and the URL plumbing behind it.
 *
 * Extracted when the third and fourth tables wanted one. The Riders and
 * Moderation tabs each grew their own copy of the same twenty lines, and the
 * two had already drifted in a way worth not repeating: both put page state in
 * the URL and both reset to page one when the filter changes, but only one of
 * them says so anywhere. Keeping the rule in one place is the point — a table
 * that forgot the reset shows an empty page four of a filter matching six rows,
 * which reads as "nothing here" rather than as a paging bug.
 *
 * Page state lives in the **URL**, not in component state, for the reason the
 * riders page gives: a staff member can send somebody a link to exactly what
 * they are looking at, and the back button works.
 */

/**
 * The navigation half, for a screen that also owns filters.
 *
 * `pending` is the transition's, so the caller can dim the rows it already has
 * rather than blanking the table on every click — the old rows stay on screen
 * and go translucent while the new ones are fetched.
 */
export function useTableNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const replace = (next: URLSearchParams) => {
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  };

  return {
    pending,
    /** The current query string, to be edited and handed back to `setFilter`. */
    params: () => new URLSearchParams(searchParams.toString()),
    /**
     * Apply a changed filter, returning to page one.
     *
     * The reset is not optional and is why this is a function rather than a
     * bare `router.replace`: staying on page 4 of a filter that now matches six
     * rows shows an empty table that looks like an empty collection.
     */
    setFilter: (next: URLSearchParams) => {
      next.delete('page');
      replace(next);
    },
    /** Move to a page, keeping every filter as it is. */
    goToPage: (n: number) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set('page', String(n));
      replace(next);
    },
  };
}

/**
 * "340 spots · page 2 of 9", and the two buttons.
 *
 * The count is of everything matching, not of the rows on screen, because the
 * number staff want from a queue is how much of it there is. `noun` is given
 * both ways rather than pluralised here: this codebase does not guess at
 * English, and "40 spots" and "1 spot" are the caller's words.
 *
 * Paging is handed in rather than taken from a `useTableNav` of its own, so the
 * screen's single transition covers filtering *and* paging. A second transition
 * in here would leave the rows undimmed while the next page was fetched, which
 * is the one thing the transition exists to prevent.
 */
export function Pager({
  page,
  totalPages,
  totalItems,
  noun,
  nounPlural,
  onPage,
  busy = false,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  noun: string;
  nounPlural: string;
  /** `goToPage` from the screen's own `useTableNav`. */
  onPage: (n: number) => void;
  busy?: boolean;
}) {
  return (
    <div className={styles.tableFoot}>
      <span className="cond">
        {totalItems === 1 ? `1 ${noun}` : `${totalItems} ${nounPlural}`}
        {totalPages > 1 && ` · page ${page} of ${totalPages}`}
      </span>
      {totalPages > 1 && (
        <div className={styles.pager}>
          <button
            type="button"
            className="btn sm ghost"
            disabled={page <= 1 || busy}
            onClick={() => onPage(page - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn sm ghost"
            disabled={page >= totalPages || busy}
            onClick={() => onPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
