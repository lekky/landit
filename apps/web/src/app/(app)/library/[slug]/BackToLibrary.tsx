'use client';

import Link from 'next/link';
import { useState } from 'react';

import { BackLink } from '@/components/shell/BackLink';
import { rememberedLibraryHref } from '@/lib/libraryPlace';
import { ROUTES } from '@/lib/routes';

/**
 * The arrow out of a trick page, and the other half of the library's place
 * memory (`lib/libraryPlace.ts`).
 *
 * It was a plain `<Link href={ROUTES.library}>` until 2026-09-12, which is to
 * say it was a *forward* navigation dressed as a way back: a rider who had
 * searched, filtered and scrolled to the bottom of the grid pressed it and got
 * the top of an unnarrowed library. Browser Back at least had the browser's own
 * scroll restoration to fall back on; this had nothing.
 *
 * Two things it now does, and neither of them fires unless the rider came from
 * the library on the hop before this one:
 *
 * - **It goes to the address they left**, `?mine=1` and `?cat=` included, so
 *   the arrow and a browser Back land on the same URL rather than two.
 * - **It stops Next scrolling to the top** (`scroll={false}`), because the
 *   library is about to put the rider back at their own offset and the two
 *   would otherwise fight over the same frame — the jump to the top would be
 *   visible. With nothing remembered, the default stands: a fresh arrival
 *   belongs at the top of the page.
 *
 * Read once, in a `useState` initialiser rather than an effect, so the href is
 * decided before the first paint and cannot change under a rider mid-press.
 * On the server the memory is always empty (see the module), so the markup a
 * fresh page load hydrates against is the plain `/library` link it was before.
 */
export function BackToLibrary({
  /**
   * The ghost button at the foot of a locked trick rather than the arrow at the
   * top of the page. Two shapes of the same link: a locked page offers the way
   * back twice, and a rider who takes the second one is going to the same place
   * as one who takes the first.
   */
  button = false,
}: {
  button?: boolean;
} = {}) {
  const [remembered] = useState(() => rememberedLibraryHref());
  const href = remembered ?? ROUTES.library;
  // Only ours to suppress when we are about to restore an offset ourselves.
  const scroll = remembered === null;

  if (button) {
    return (
      <Link className="btn ghost" href={href} scroll={scroll}>
        Back to the library
      </Link>
    );
  }

  /*
   * `BackLink` rather than this page's own 13.5px link (§2.3, which names the
   * trick page's as a `BackLink`). The old one measured 17px tall — the
   * smallest target on the page, on the control a rider presses most — while
   * every other screen in the product had been on the 44px shape since T45.
   * The place memory is unchanged: same href, same `scroll`.
   */
  return <BackLink href={href} label="All tricks" scroll={scroll} />;
}
