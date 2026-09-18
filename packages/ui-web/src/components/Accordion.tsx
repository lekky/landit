'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { cx } from '../cx';
import { Icon } from '../icons';

/**
 * A disclosure row (app shell rethink §3.8) — a title, an optional sub-line, a
 * chevron, and a body that grows out from under it.
 *
 * **Why it exists.** The trick page has a dozen sections and a phone has one
 * column; before T49 a rider scrolled past everything the page could teach them
 * to reach their own history with the trick. Closed rows turn that scroll into
 * a list of names, and a name is something a child can choose from.
 *
 * **`<details>` / `<summary>` underneath.** Not a `div` with `aria-expanded`:
 * the native element already carries the role, the state and the keyboard
 * behaviour, it works with no JavaScript at all, and the browser's own
 * find-in-page opens it. What this component adds on top is the motion the
 * design asks for, which the native element has none of.
 *
 * **How the motion is done.** The body is a grid whose single row goes from
 * `0fr` to `1fr` over `--dur-ui` — the one way to animate to a height nobody
 * has measured. The row is put into that state *one frame after* the `open`
 * attribute lands, because a subtree the UA was hiding has no painted `0fr` to
 * transition from; and on the way back the transition runs first and the
 * attribute is dropped `--dur-ui` later, which is the shape `Sheet` already
 * uses for the same reason. `prefers-reduced-motion` is covered by the floor at
 * the foot of `additions.css`, which clamps the transition; the close then
 * waits 200ms with nothing to look at, which is the right way round (a rider
 * who asked for less motion still asked for the row to shut).
 *
 * **Open state is never persisted** (§3.8). It is a reading position, not a
 * preference: a rider who opened "Tips" on one trick has said nothing about the
 * next one.
 *
 * **A row whose `id` is the address opens itself.** A fragment that scrolls to a
 * shut box is a link that did not work. The check runs on mount and again on
 * `hashchange`, so a second trip to a page already open lands the same way as
 * the first.
 *
 * This was written for the Log sheet's "Add a clip link", which landed on
 * `/library/<trick>#clips`; the owner removed that row on 2026-09-17 and
 * nothing in the app produces the fragment now. The behaviour stays, because
 * `#clips` is still a valid address for that row — it simply has no caller
 * inside the product.
 *
 * **`plainAbove` is what keeps a desktop out of it.** §3.8 says the desktop
 * page keeps its plain panels, and one server render cannot know the width. So
 * above that width the row is held open, the chevron goes and the summary stops
 * being a control — the caller's stylesheet does the rest of the repaint. The
 * width is read the way `Sheet` reads its own (`useSyncExternalStore` over
 * `matchMedia`, the server answering "phone"), so there is no hydration
 * mismatch to throw the tree away (LESSONS §3a); the caller's desktop CSS
 * covers the first frame.
 */

export type AccordionProps = {
  /** The row's name. Words, not markup — it is the summary's whole label. */
  title: ReactNode;
  /** An optional 13px line under the title: a count, a date, a hint. */
  sub?: ReactNode;
  children: ReactNode;
  /** Open on first render. Not persisted, and never read back. */
  defaultOpen?: boolean;
  /**
   * The element's id, which is also the fragment that opens it: a page linking
   * to `#clips` gets the row open rather than a closed box scrolled into view.
   */
  id?: string;
  /**
   * Above this viewport width (in px) the row is held open, loses its chevron
   * and stops being pressable — for a layout whose wide form has no disclosure
   * in it at all. Left out, the row is a disclosure at every width.
   */
  plainAbove?: number;
  /**
   * What level the title is a heading at. `2` by default, which is right under
   * a screen's one `h1`.
   *
   * It **is** a heading, and that is not decoration: a page whose sections are
   * all disclosure rows has no outline at all without one, so a screen-reader
   * rider loses the ability to jump between sections that a page of `SectionHead`s
   * gave them for free. `<summary>`'s content model allows heading content, so
   * this is the native element's own provision rather than ARIA over the top.
   */
  headingLevel?: 2 | 3 | 4;
  className?: string;
  style?: CSSProperties;
};

/**
 * How long a closing row stays open, in step with `--dur-ui`.
 *
 * The token is the authority and this number matches it, for the reason
 * `CLOSE_MS` in `overlays.tsx` gives: a wait shorter than the transition cuts
 * it off, a longer one leaves a row that has finished shutting still marked
 * open.
 */
const CLOSE_MS = 200;

function subscribeToWidth(query: string): (onChange: () => void) => () => void {
  return (onChange) => {
    const mq = window.matchMedia(query);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  };
}

/** Whether the viewport is past `plainAbove`. `false` on the server. */
function usePlain(plainAbove: number | undefined): boolean {
  const query = `(min-width: ${(plainAbove ?? 0) + 1}px)`;
  const subscribe = useCallback(
    (onChange: () => void) =>
      plainAbove === undefined ? () => {} : subscribeToWidth(query)(onChange),
    [plainAbove, query],
  );
  return useSyncExternalStore(
    subscribe,
    () => (plainAbove === undefined ? false : window.matchMedia(query).matches),
    () => false,
  );
}

export function Accordion({
  title,
  sub,
  children,
  defaultOpen = false,
  id,
  plainAbove,
  headingLevel = 2,
  className,
  style,
}: AccordionProps) {
  const Heading = `h${headingLevel}` as const;
  const plain = usePlain(plainAbove);
  const [open, setOpen] = useState(defaultOpen);
  /** The class that drives the transition — a frame behind `open`, and ahead of
   * it on the way back. */
  const [grown, setGrown] = useState(defaultOpen);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  /**
   * Whether the row is on its way shut — which is not the same question as
   * whether it is open.
   *
   * For the `--dur-ui` the close takes, `open` is still `true` while the row is
   * plainly shutting, so a second press branched on `open` alone called `hide()`
   * again: it cancelled the pending timer, re-armed it, and the row finished
   * closing instead of coming back. Measured at +60ms, which is well inside a
   * child's tap cadence (independent review of 2026-09-17, S2).
   */
  const closing = useRef(false);

  const clearPending = useCallback(() => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    closeTimer.current = null;
    frame.current = null;
  }, []);

  const show = useCallback(() => {
    clearPending();
    closing.current = false;
    setOpen(true);
    // Two frames: the first paints the body at `0fr` now that the UA has
    // stopped hiding it, the second is the one the transition starts from.
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => setGrown(true));
    });
  }, [clearPending]);

  const hide = useCallback(() => {
    clearPending();
    closing.current = true;
    setGrown(false);
    closeTimer.current = setTimeout(() => {
      closing.current = false;
      setOpen(false);
    }, CLOSE_MS);
  }, [clearPending]);

  /** The press. Intent, not the attribute — see `closing`. */
  const toggle = useCallback(() => {
    if (open && !closing.current) hide();
    else show();
  }, [open, hide, show]);

  useEffect(() => clearPending, [clearPending]);

  // The fragment that names this row opens it (see the note above).
  useEffect(() => {
    if (!id) return;
    const match = () => {
      if (window.location.hash !== `#${id}`) return;
      clearPending();
      closing.current = false;
      setOpen(true);
      setGrown(true);
    };
    match();
    window.addEventListener('hashchange', match);
    return () => window.removeEventListener('hashchange', match);
  }, [id, clearPending]);

  const isOpen = plain || open;

  return (
    <details
      id={id}
      className={cx('accordion', plain && 'accordion-plain', className)}
      style={style}
      open={isOpen}
      /* React owns the attribute, so the UA's own toggle is undone on the next
         render; `onClick` below is what actually opens and shuts the row. This
         keeps the two in step when a browser toggles it some other way — a
         find-in-page hit, for one. */
      onToggle={(event) => {
        if (plain) return;
        const next = event.currentTarget.open;
        if (next && !open) show();
        if (!next && open) hide();
      }}
    >
      <summary
        className="accordion-head"
        /*
         * **Out of the tab order where there is nothing to disclose** (§3.8;
         * independent review of 2026-09-17, S3). `plain` used to short-circuit
         * the handlers and leave the element exactly as it was, so a keyboard
         * rider on the desktop trick page tabbed through seven stops drawn as
         * plain headings that did nothing when pressed, each announced as a
         * collapsed-or-expanded disclosure. It stops being a control here
         * rather than stopping responding: no focus, no pointer (the
         * stylesheet), no press.
         */
        tabIndex={plain ? -1 : undefined}
        onClick={(event) => {
          event.preventDefault();
          if (plain) return;
          toggle();
        }}
      >
        {/* The sub-line lives inside the heading rather than beside it: a
            `<summary>` may hold phrasing content and headings and nothing else,
            and a row called "The road to it, 3 steps" is a better thing to hear
            than a row called "The road to it" with a number loose beside it. */}
        <Heading className="accordion-title">
          {title}
          {sub && <span className="accordion-sub">{sub}</span>}
        </Heading>
        <Icon name="chevron" size={18} strokeWidth={2.6} className="accordion-chev" />
      </summary>

      <div className={cx('accordion-body', grown && 'is-grown')}>
        <div className="accordion-inner">{children}</div>
      </div>
    </details>
  );
}
