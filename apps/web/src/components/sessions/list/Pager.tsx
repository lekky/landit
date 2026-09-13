'use client';

import { pageWindow } from '@/lib/sessionList';

import styles from './sessionsList.module.css';

/**
 * "Showing 1–3 of 10", then Newer, the page numbers and Older (1a). Newer and
 * Older dim at the ends rather than disappearing, so the row never shifts. On a
 * phone (2a) only the numbers are drawn, in a window of at most five.
 */
export function Pager({
  label,
  page,
  totalPages,
  onPage,
  className,
}: {
  label: string;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  className?: string;
}) {
  const first = page <= 1;
  const last = page >= totalPages;
  return (
    <nav className={`${styles.pager} ${className ?? ''}`} aria-label="Pages">
      <span className={styles.pageLabel}>{label}</span>
      <div className={styles.pages}>
        <button
          type="button"
          className={`${styles.pageStep} ${styles.hidePhone}`}
          disabled={first}
          onClick={() => onPage(page - 1)}
        >
          Newer
        </button>
        {pageWindow(page, totalPages).map((n) => (
          <button
            key={n}
            type="button"
            className={`${styles.pageNum} ${styles.tap} ${n === page ? styles.pageOn : ''}`}
            aria-current={n === page ? 'page' : undefined}
            aria-label={`Page ${n}`}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.pageStep} ${styles.hidePhone}`}
          disabled={last}
          onClick={() => onPage(page + 1)}
        >
          Older
        </button>
      </div>
    </nav>
  );
}
