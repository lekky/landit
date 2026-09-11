'use client';

import { Icon } from '@landit/ui-web';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

import { MOBILE_NAV, activeSection, isNavActive, type NavItem } from './nav';
import { SectionDrawer } from './SectionDrawer';
import styles from './sectionDrawer.module.css';

/**
 * The fixed bottom bar. Five items, no more: below 861px `.mobnav` is a
 * `repeat(5, 1fr)` grid and the design specifies five (handoff, Responsive).
 *
 * It reads `MOBILE_NAV` rather than the top bar's list, because the five are
 * sections rather than the first five pages — see `nav.ts` for why.
 *
 * It is always in the DOM; the stylesheet is what shows it below 861px and
 * hides `.nav` in the top bar. Keeping the decision in CSS means no layout
 * shift on load and no matchMedia in the shell.
 *
 * ## The section drawer
 *
 * Two of the five cells are sections holding two screens each, and until this
 * component grew a drawer the second screen in both was effectively invisible:
 * "What's on" names neither Spots nor Events, and Stickers sat behind Progress.
 * The row that used to reveal them, `SectionTabs`, was at the top of a
 * scrolling page wearing the sport switch's clothes (issue #379, item 5).
 *
 * The drawer opens **on arrival in a section as well as on a tap of the lit
 * cell** (owner, 2026-09-11, in chat, choosing this over two alternatives). The
 * distinction is the whole point and is worth stating, because the obvious
 * design is worse: a cell that *only* opens a drawer costs a tap on the way to
 * Spots and to Progress, and Progress is the screen riders open most after
 * Home. Announcing on arrival keeps every tap count exactly as it was and still
 * says the sibling's name.
 *
 * `compact` is the one place the shell asks about width in JavaScript, which
 * `AppShell` otherwise avoids on purpose. It is not for layout — CSS still owns
 * that, and the drawer is inside `.mobnav` so it is hidden above 860px whatever
 * this says. It is so that `navSectionOpened` is not reported for a drawer no
 * desktop rider ever saw.
 */

const COMPACT = '(max-width: 860px)';

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(COMPACT);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function useCompactViewport() {
  return useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(COMPACT).matches,
    // The server has no width. Rendering closed and letting the client open it
    // is also what keeps the first paint identical to the markup.
    () => false,
  );
}

/** Which section's drawer is showing, and what put it there. */
type OpenDrawer = { section: string; via: 'arrival' | 'tap' };

export function MobileNav() {
  const pathname = usePathname();
  const compact = useCompactViewport();
  const holder = useRef<HTMLElement>(null);
  const drawerId = useId();

  const section = activeSection(pathname);
  const sectionId = section?.id ?? null;

  const [drawer, setDrawer] = useState<OpenDrawer | null>(null);

  /*
   * Arrival, derived rather than run in an effect.
   *
   * Adjusting state during render is the documented way to react to changed
   * input — React re-renders before painting, so the drawer is never on screen
   * in the wrong section for a frame. An effect would be a cascading render on
   * every route change, which is the trap `AccountMenu` documents next door.
   *
   * **`compact` is part of what was decided, not just an input to it**, and
   * that is not a detail: the server has no width, so the first render on a
   * phone reads `compact` as `false`. Keyed on the section alone, a rider
   * landing on `/spots` had their arrival decided during hydration — against a
   * viewport nobody had measured yet — and the drawer never opened, because
   * the section had not changed by the time the real answer arrived.
   */
  const [decided, setDecided] = useState<{ section: string | null; compact: boolean }>({
    section: null,
    compact: false,
  });
  if (decided.section !== sectionId || decided.compact !== compact) {
    setDecided({ section: sectionId, compact });
    setDrawer(compact && section?.tabs ? { section: section.id, via: 'arrival' } : null);
  }

  const close = useCallback(() => setDrawer(null), []);

  useEffect(() => {
    if (!drawer) return;
    capture(ANALYTICS_EVENTS.navSectionOpened, { section: drawer.section, trigger: drawer.via });
  }, [drawer]);

  useEffect(() => {
    if (!drawer) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    // `pointerdown` rather than `click`, for the reason `AccountMenu` gives: a
    // click on a link inside would close this before the link's own handler ran.
    const onPointer = (event: PointerEvent) => {
      if (!holder.current?.contains(event.target as Node)) close();
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);

    /*
     * Scroll dismisses too, but not until the next frame.
     *
     * A route change can restore a scroll position, and that fires `scroll`
     * immediately — which would close an arrival drawer before anybody saw it,
     * on exactly the navigation that opened it.
     */
    let unscroll = () => {};
    const armed = requestAnimationFrame(() => {
      window.addEventListener('scroll', close, { passive: true, once: true });
      unscroll = () => window.removeEventListener('scroll', close);
    });

    return () => {
      cancelAnimationFrame(armed);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      unscroll();
    };
  }, [drawer, close]);

  /**
   * A tap on a folded cell the rider is already inside opens the drawer instead
   * of navigating.
   *
   * From anywhere else the cell is an ordinary link and arrival does the
   * opening, so this is only ever the "show me the other one" case — including
   * from `/events`, where the old behaviour yanked the rider back to `/spots`
   * for asking what else was in here.
   */
  const onCellClick = (event: MouseEvent, item: NavItem) => {
    if (compact && item.tabs && sectionId === item.id) {
      event.preventDefault();
      setDrawer((open) => (open?.section === item.id ? null : { section: item.id, via: 'tap' }));
      return;
    }
    // The nav item's id, not its href: an id is a fixed name from `nav.ts`,
    // while an href could one day carry a parameter.
    capture(ANALYTICS_EVENTS.navClicked, { to: item.id, where: 'mobile' });
  };

  const open = MOBILE_NAV.find((item) => item.id === drawer?.section);

  return (
    <nav className="mobnav" aria-label="Main, compact" ref={holder}>
      {MOBILE_NAV.map((item) => {
        const active = isNavActive(item, pathname);
        const folded = Boolean(item.tabs);
        const showing = drawer?.section === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`${folded ? styles.cell : ''} ${active ? 'on' : ''}`.trim() || undefined}
            aria-current={active ? 'page' : undefined}
            aria-expanded={folded ? showing : undefined}
            aria-controls={showing ? drawerId : undefined}
            onClick={(event) => onCellClick(event, item)}
          >
            {folded ? (
              <span
                className={`${styles.caret} ${showing ? styles.caretOpen : ''}`.trim()}
                aria-hidden="true"
              />
            ) : null}
            <Icon name={item.icon} size={21} strokeWidth={2.2} />
            {item.label}
          </Link>
        );
      })}
      {open?.tabs ? (
        <SectionDrawer
          id={drawerId}
          tabs={open.tabs}
          label={open.label}
          pathname={pathname}
          onNavigate={close}
        />
      ) : null}
    </nav>
  );
}
