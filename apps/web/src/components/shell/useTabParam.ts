'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * A `TabRow`'s selected tab, kept in `?tab=` rather than in `useState` (T46).
 *
 * **Why the URL and not component state.** Progress's Skill tree is a
 * browse-and-tap surface: a rider opens a node, reads the trick, presses Back —
 * and with the tab in `useState` they landed on Record, having lost their place
 * on every single node they opened. Before the rethink the tree was part of one
 * long scroll, so Back restored it with the scroll position; turning the scroll
 * into tabs took that away, and this gives it back. Reload keeps the tab for
 * the same reason, and the address can now be shared.
 *
 * **`replace`, not `push`.** Pressing three tabs should not put three entries in
 * the history for Back to walk out through — the tab is a view of one screen,
 * not three screens. `replace` rewrites the current entry, so leaving and
 * returning restores the tab while Back still means "the page before this one".
 * `scroll: false` because switching a tab is not arriving somewhere new.
 *
 * **It stays a `role="tablist"`** (§3.3): the panel under it still changes in
 * place, the document does not navigate, and `TabRow`'s button form is
 * unchanged. Only where the answer is *stored* moves.
 *
 * The value is validated against the tabs the caller actually has, so a
 * hand-typed `?tab=nonsense` opens the first tab rather than an empty screen —
 * and nothing a rider typed is ever read back out as anything but one of these
 * fixed catalogue ids.
 */
export function useTabParam(
  ids: readonly string[],
  fallback: string,
): [string, (id: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const asked = searchParams.get('tab');
  const value = asked && ids.includes(asked) ? asked : fallback;

  const set = (id: string) => {
    const next = new URLSearchParams(searchParams.toString());
    // The first tab is the default, so it is spelled by *absence* — one address
    // for the screen as it opens, rather than two that render the same thing.
    if (id === fallback) next.delete('tab');
    else next.set('tab', id);
    const query = next.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  };

  return [value, set];
}
