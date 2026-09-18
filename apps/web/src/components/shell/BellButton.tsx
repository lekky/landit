'use client';

import { Dropdown, Icon } from '@landit/ui-web';
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { whatsNewViewAction } from '@/components/whats-new/actions';
import type { WhatsNewView } from '@/components/whats-new/view';
import { WhatsNewPanel } from '@/components/whats-new/WhatsNewPanel';
import whatsNew from '@/components/whats-new/whats-new.module.css';
import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import { BELL_DESTINATION } from './nav';
import styles from './shell.module.css';

/**
 * "What's new" (D4, rethink §3.1 and §3.6).
 *
 * T45 built the button and the slot its count sits in; **T47 filled it** — the
 * derived feed, `whats_new_seen_at`, the unseen count and the panel with its
 * You / crew tabs. `unread` now arrives from the app layout's server render.
 *
 * **A panel at both widths** (owner, 2026-09-17, in chat: "/whats-new feels
 * better as a slide down panel"). The phone used to navigate to `/whats-new`
 * and the desktop opened a dropdown; reading the news is a glance and a glance
 * should not cost a page, so the bell now drops a panel from under the top bar
 * on a phone — full width (`Dropdown fullWidth`) rather than the desktop's
 * 420px column — and the rider keeps their place on the screen behind it.
 *
 * **`/whats-new` is still a real route**, and still what the markup points at:
 * the panel's "All →" goes there, a deep link lands there, and a rider with no
 * JavaScript follows the link rather than pressing a button that does nothing.
 * The press is taken back in the handler at both widths now, which is also why
 * this stays a `Link`: `usePhone()` answers `false` on the server, so a bell
 * rendered as a button on the phone branch would be served as a button to
 * every request and only become a link once hydration ran (review S3, T45).
 *
 * **The panel's contents are fetched when it opens**, never with the page. The
 * bell is in the top bar of every screen and a crew feed per crew on every page
 * render would be several reads to fill a panel most page views never open —
 * the trade T45's sport menu already made. What *is* on every render is the
 * count, which is one derived computation, memoised for the request
 * (`components/whats-new/load.ts`).
 *
 * It lights no nav cell (§2.2): the bell is on every screen, so a rider reading
 * their own news is not "in" a group.
 */

const PHONE = '(max-width: 860px)';

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(PHONE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function usePhone() {
  return useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

/**
 * Does the badge pop this render (§3.6, §4)?
 *
 * **On increment only, and never on first paint.** The count comes from the
 * server, so it changes when a navigation brings a fresh layout render — a
 * rider who earns a sticker and moves to another screen sees the number arrive
 * with a pop. A bell that has only just mounted has no previous count to
 * compare with and therefore does not animate, which is the whole of "never on
 * first paint": a badge that popped on every page load would be decoration, and
 * §4 says motion here is feedback for something the rider did.
 */
function usePopOnIncrement(unread: number): boolean {
  const previous = useRef<number | null>(null);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    const before = previous.current;
    previous.current = unread;
    if (before === null || unread <= before) return;

    setPop(true);
    const timer = setTimeout(() => setPop(false), 400);
    return () => clearTimeout(timer);
  }, [unread]);

  return pop;
}

export function BellButton({ unread = 0 }: { unread?: number }) {
  const phone = usePhone();
  const holder = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<WhatsNewView | null>(null);
  const pop = usePopOnIncrement(unread);

  // `unread` is a count of lines the product wrote, never a description of the
  // rider: catalogue facts only, as the catalogue entry says.
  // The curly apostrophe the rest of the product uses — `/whats-new`'s own
  // `<h1>` and `<title>` (review N4).
  const label = unread > 0 ? `What’s new, ${unread} unread.` : 'What’s new';

  const glyph = (
    <>
      <Icon name="bell" size={19} strokeWidth={2.2} />
      {unread > 0 && (
        <span
          className={`${styles.tbBadge} ${pop ? whatsNew.badgePop : ''}`.trim()}
          aria-hidden="true"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </>
  );

  return (
    <div className={styles.anchor} ref={holder}>
      <Link
        href={BELL_DESTINATION}
        className={styles.tbBtn}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          /*
           * **Both widths open the panel now** (owner, 2026-09-17). The phone
           * used to let the click through and navigate, and `/whats-new` counted
           * its own opening on mount — which it still does, for the rider who
           * arrives there by "All →", by a deep link or by the back button. What
           * changed is that the bell no longer navigates, so the press counts
           * here, with `where` saying which bell it was.
           */
          event.preventDefault();
          if (!open) {
            capture(ANALYTICS_EVENTS.whatsNewOpened, {
              where: phone ? 'mobile' : 'top',
              unread,
            });
            /*
             * Re-read every time it opens rather than once: the panel is a
             * shortcut to a live page, and a list cached from the first press
             * of the session would be a stale one by the second.
             *
             * The old view is dropped first, so a second opening shows the
             * loading line rather than the *first* opening's list while the new
             * one is in flight (review N6).
             */
            setView(null);
            void whatsNewViewAction().then(setView);
          }
          setOpen(!open);
        }}
      >
        {glyph}
      </Link>

      {open && (
        <Dropdown
          label="What’s new"
          width={420}
          /* Full width under the bar on a phone, the 420px column above it. */
          fullWidth={phone}
          holder={holder}
          onClose={() => setOpen(false)}
          className={styles.menuPad}
        >
          {view ? (
            <WhatsNewPanel view={view} place="dropdown" />
          ) : (
            <p className={styles.sheetNote}>Loading…</p>
          )}
        </Dropdown>
      )}
    </div>
  );
}
