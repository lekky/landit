'use client';

import { Dropdown, Icon } from '@landit/ui-web';
import Link from 'next/link';
import { useRef, useState, useSyncExternalStore } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import { BELL_DESTINATION } from './nav';
import styles from './shell.module.css';

/**
 * "What's new" (D4, rethink §3.1 and §3.6).
 *
 * T45 builds the button and the slot its count sits in; **T47 builds what is
 * behind it** — the derived feed, the `whats_new_seen_at` field that decides
 * what counts as unseen, and the panel with its You / crew tabs. Until then
 * `unread` is 0, the badge is therefore not drawn, and both the page and the
 * dropdown say so in a line.
 *
 * Splitting it this way is deliberate rather than tidy-minded. The bell is part
 * of the bar's shape: the right-hand group is the sport chip, Log, the bell and
 * the avatar, and a bar built without the bell would have to be rebuilt to take
 * it. What is *behind* it needs a migration, a hook and a set of rules in
 * `packages/core`, which is a task's worth of work and not a bar's.
 *
 * **Phone: a link to `/whats-new`. Desktop: a dropdown.** The same split the
 * account menu and the sport chip make, for the same reason — a 420px panel
 * hanging off the right edge of a 375px screen is not a panel.
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

/** What the panel says until T47 fills it. One line, in the product's voice. */
const NOTHING_YET = 'Nothing here yet. Stickers, crew joins and what’s coming up will land here.';

export function BellButton({ unread = 0 }: { unread?: number }) {
  const phone = usePhone();
  const holder = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // `unread` is a count of lines the product wrote, never a description of the
  // rider: catalogue facts only, as the catalogue entry says.
  // The curly apostrophe the rest of the product uses — `/whats-new`'s own
  // `<h1>` and `<title>`, and `NOTHING_YET` above (review N4).
  const label = unread > 0 ? `What’s new, ${unread} unread.` : 'What’s new';

  const glyph = (
    <>
      <Icon name="bell" size={19} strokeWidth={2.2} />
      {unread > 0 && (
        <span className={styles.tbBadge} aria-hidden="true">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </>
  );

  /*
   * **A link at both widths** (review S3), and the desktop takes the press back.
   *
   * `usePhone()` answers `false` on the server, so a bell rendered as a button
   * on the phone branch was served as a button to *every* request and only
   * became a link once hydration ran — a control that does nothing, on the one
   * width where a real page exists behind it, for anybody reading before the
   * JavaScript lands or after it fails. The sport chip's version of the same
   * choice is safe because only its *panel* depends on width; here it was the
   * element itself.
   *
   * So the markup is a `Link` always. Above 860px the click is prevented and
   * the dropdown opens instead, which leaves the no-JS and pre-hydration path
   * navigating to the page that the dropdown is a shortcut for.
   */
  return (
    <div className={styles.anchor} ref={holder}>
      <Link
        href={BELL_DESTINATION}
        className={styles.tbBtn}
        aria-label={label}
        aria-haspopup={phone ? undefined : 'dialog'}
        aria-expanded={phone ? undefined : open}
        onClick={(event) => {
          if (phone) {
            capture(ANALYTICS_EVENTS.whatsNewOpened, { where: 'mobile', unread });
            return;
          }
          event.preventDefault();
          if (!open) capture(ANALYTICS_EVENTS.whatsNewOpened, { where: 'top', unread });
          setOpen(!open);
        }}
      >
        {glyph}
      </Link>

      {!phone && open && (
        <Dropdown
          label="What’s new"
          width={420}
          holder={holder}
          onClose={() => setOpen(false)}
          className={styles.menuPad}
        >
          <p className={styles.sheetNote}>{NOTHING_YET}</p>
        </Dropdown>
      )}
    </div>
  );
}
