'use client';

import styles from './log.module.css';

/**
 * The log panel's pager (T30): arrows, one button per page, and "1–3 of 7" on
 * the right. Drawn only when there is more than one page — the handoff shows
 * nothing under a list that fits.
 *
 * `page` is zero-based and clamped by the caller (`pageIndex` below), because
 * removing the last note on the last page has to land the rider on the page
 * before it rather than on an empty one.
 */
export function Pager({
  total,
  perPage,
  page,
  onPage,
  bare = false,
  label,
}: {
  total: number;
  perPage: number;
  page: number;
  onPage: (page: number) => void;
  /** No rule above it — under the video grid the form carries the rule. */
  bare?: boolean;
  /** What is being paged, for the arrows' accessible names. */
  label: string;
}) {
  const count = pageCount(total, perPage);
  if (count <= 1) return null;
  const current = pageIndex(page, total, perPage);
  const from = current * perPage + 1;
  const to = Math.min(total, (current + 1) * perPage);

  return (
    <nav
      className={`${styles.pager}${bare ? ` ${styles.pagerBare}` : ''}`}
      aria-label={`${label} pages`}
    >
      <button
        type="button"
        className={styles.pageBtn}
        disabled={current === 0}
        onClick={() => onPage(current - 1)}
        aria-label={`Previous ${label}`}
      >
        ←
      </button>
      {Array.from({ length: count }, (_, k) => (
        <button
          type="button"
          key={k}
          className={`${styles.pageBtn} ${styles.pageNum}${k === current ? ` ${styles.pageNumOn}` : ''}`}
          aria-current={k === current ? 'page' : undefined}
          onClick={() => onPage(k)}
        >
          {k + 1}
        </button>
      ))}
      <button
        type="button"
        className={styles.pageBtn}
        disabled={current >= count - 1}
        onClick={() => onPage(current + 1)}
        aria-label={`Next ${label}`}
      >
        →
      </button>
      <span className={`lab ${styles.range}`}>
        {from}–{to} of {total}
      </span>
    </nav>
  );
}

/** How many pages `total` items make at `perPage` — never fewer than one. */
export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}

/** `page`, clamped into the pages `total` actually has. */
export function pageIndex(page: number, total: number, perPage: number): number {
  return Math.min(Math.max(0, page), pageCount(total, perPage) - 1);
}

/** The slice of `items` on `page`. */
export function pageOf<T>(items: readonly T[], page: number, perPage: number): readonly T[] {
  const current = pageIndex(page, items.length, perPage);
  return items.slice(current * perPage, current * perPage + perPage);
}
