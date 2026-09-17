'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import { cx } from '../cx';
import { useModalLayer } from './modal-layer';

/**
 * Modal and toast.
 *
 * The motion is part of the design and is specified exactly: the scrim fades a
 * 72%-opacity ink over 200ms; the panel rises 26px and scales from .96 over
 * 250ms on `cubic-bezier(.2,1.3,.4,1)`. Toasts slide up from the bottom centre
 * and the caller clears them after 3.2 seconds. All of that lives in the CSS.
 */

export type ModalProps = {
  children: ReactNode;
  /** Close the modal. Called directly unless `onRequestClose` is given. */
  onClose: () => void;
  /** Max width in px. The panel is `min(width, 100%)`. */
  width?: number;
  /**
   * Accessible name for the dialog. Give one, or a `title`: a dialog with
   * neither is announced as "dialog" and nothing else.
   */
  label?: string;
  /**
   * A heading in a bar across the top that stays put while the body scrolls,
   * with a 44px Close in it. For a modal that can be taller than a phone, whose
   * only way out would otherwise scroll away. Names the dialog when there is no
   * `label`. Rendered as the dialog's `<h2>`, so keep it to words.
   */
  title?: ReactNode;
  /**
   * A bar across the bottom that stays put while the body scrolls: Cancel and
   * Save on an editor, so they are in reach from the top of a long form and
   * with the keyboard up.
   */
  footer?: ReactNode;
  /**
   * The ways a modal gets dismissed without a decision — a tap on the scrim,
   * Escape, the title bar's Close — call this instead of `onClose` when it is
   * given. A modal holding unsaved work uses it to ask first; it calls
   * `onClose` itself once the rider has answered.
   */
  onRequestClose?: () => void;
};

/**
 * The shared dialog.
 *
 * **While it is open the page behind it is held still, inert, and out of
 * reach** (`useModalLayer`, issue #372): a scroll on the modal or the scrim no
 * longer moves the page underneath, the panel takes focus when it opens and the
 * button that opened it gets focus back when it closes, and Tab cannot leave
 * the dialog.
 *
 * **Escape closes it, and so does a tap on the scrim**, unless the caller gave
 * `onRequestClose`, in which case both ask the caller first. A tap counts only
 * if it started on the scrim too: a drag that begins in a field and ends in the
 * gutter (selecting text, say) is not a request to throw the form away. With
 * two modals open, Escape closes only the top one.
 *
 * Its height is capped to the screen a rider can actually see — `dvh`, not the
 * design's `88vh`, which on iOS Safari is measured with the browser bars hidden
 * and put a tall modal's ends under them — and on a phone it hangs from the top
 * and clears the bottom bar (`additions.css`). None of that touches the motion.
 */
export function Modal({
  children,
  onClose,
  width = 520,
  label,
  title,
  footer,
  onRequestClose,
}: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const pressedOnScrim = useRef(false);
  const titleId = useId();
  const requestClose = onRequestClose ?? onClose;

  useModalLayer(panel, requestClose);

  const hasTitle = title !== undefined && title !== null;
  const hasFooter = footer !== undefined && footer !== null;

  return (
    <div
      className="scrim"
      onPointerDown={(pressed) => {
        pressedOnScrim.current = pressed.target === pressed.currentTarget;
      }}
      onClick={(clicked) => {
        if (clicked.target === clicked.currentTarget && pressedOnScrim.current) requestClose();
      }}
    >
      <div
        ref={panel}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={!label && hasTitle ? titleId : undefined}
        tabIndex={-1}
        style={{ width: `min(${width}px,100%)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {hasTitle && (
          <div className="modal-head">
            <h2 id={titleId} className={cx('d', 'modal-title')}>
              {title}
            </h2>
            <button type="button" className="modal-close" aria-label="Close" onClick={requestClose}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}
        {children}
        {hasFooter && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ sheet -- */

/**
 * The width at which a bottom sheet stops being the right shape.
 *
 * The same 860px the shell already breaks at (`primitives.css`): below it the
 * bottom bar is on and a panel hanging off the bottom edge is where a thumb
 * is, above it the page is a desktop and a centred dialog is.
 */
const PHONE_QUERY = '(max-width: 860px)';

function subscribeToPhone(onChange: () => void): () => void {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * Whether this is a phone, for `Sheet`'s `as="auto"` only.
 *
 * The server has no width and answers `false`, which is safe here in a way it
 * would not be for layout: a sheet exists only after somebody has pressed
 * something, so the first render of one is always in a browser that can be
 * asked. Nothing in the frame depends on this — the shell still lets CSS decide
 * what shows at what width.
 */
function usePhoneViewport(): boolean {
  return useSyncExternalStore(
    subscribeToPhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

/** How far down a sheet has to be dragged before letting go closes it. */
const DRAG_TO_CLOSE = 80;

/**
 * How long a closing sheet stays mounted, in step with `--dur-ui`.
 *
 * The token is the authority and this number has to match it — a wait shorter
 * than the animation cuts it off, and a longer one leaves an invisible dialog
 * holding the page. Under `prefers-reduced-motion` the CSS floor takes the
 * animation to 0.01ms and this wait becomes a 200ms pause with nothing to see;
 * that is the right way round, because a rider who asked for less motion has
 * still asked for the sheet to go away, and it does.
 */
const CLOSE_MS = 200;

/**
 * Put a sheet on `<body>`, out of whatever stacking context opened it.
 *
 * **This is the one thing `Sheet` does that `Modal` does not**, and it is not
 * tidiness. A sheet is opened from the shell's chrome: the sport chip and the
 * bell are inside `.topbar`, which is `position: sticky` with `z-index: 60` and
 * therefore a stacking context of its own. A sheet rendered in there is capped
 * at 60 whatever its own `z-index` says, so the bottom bar (70) painted over
 * it — measured on a 390px phone, where the sport sheet's last row was cut in
 * half by the bar. On `<body>` the numbers in the stylesheet mean what they
 * say: the scrim at 180 is over the bar at 70 and under the toasts at 200.
 *
 * `Modal` is deliberately left alone. It renders where its caller renders it
 * and `inertOutside` walks up from the dialog precisely because of that
 * (`modal-layer.ts`); changing it would be a behaviour change to a shared
 * component every screen already uses. The walk works from `<body>` too — it
 * simply has one level to climb — so portaling here costs nothing.
 */
function portal(node: ReactNode) {
  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}

export type SheetProps = {
  children: ReactNode;
  /** Close the sheet. */
  onClose: () => void;
  /**
   * A heading across the top, inside the sheet. Names the dialog when there is
   * no `label`.
   */
  title?: ReactNode;
  /** Accessible name, for a sheet with no `title`. */
  label?: string;
  /**
   * Something small on the right-hand end of the title's line — the sport `Tag`
   * on the log sheet (§3.5), a count, a Back.
   *
   * Beside the title rather than under it, at both widths, because that is what
   * the spec draws and because a line of its own is a row of chrome above the
   * thing a rider came to press. Give a `label` alongside it: it renders inside
   * the heading, and a dialog should be announced by its words rather than by
   * its words plus a tag.
   */
  titleAside?: ReactNode;
  /**
   * Which shape to take. `auto` (the default) is a sheet below 861px and the
   * shared `Modal` above it; `sheet` and `modal` force one.
   */
  as?: 'auto' | 'sheet' | 'modal';
  /** Max width in px when this renders as a `Modal`. */
  width?: number;
  /** An extra class on the sheet panel, for a caller that needs to size it. */
  className?: string;
};

/**
 * A bottom sheet on a phone, the shared `Modal` on a desktop (rethink §3.2).
 *
 * One component rather than two, because every caller wants the same thing at
 * both widths — the log sheet, the sport switch — and a screen that picked for
 * itself would be a second opinion about the shell's breakpoint. `as` is there
 * for the caller that genuinely knows better.
 *
 * It borrows `Modal`'s whole layer: `useModalLayer` holds the page still, makes
 * it inert, traps focus and answers Escape, so a sheet behaves like a dialog
 * rather than like a div that happens to be on top. A tap on the scrim closes
 * it, counted the way `Modal` counts one — the press has to have started on the
 * scrim, so a drag that ends in the gutter is not a dismissal.
 *
 * **Dragging it down closes it**, which is the gesture a phone rider already
 * has for this shape. The drag starts on the handle and the title bar only, not
 * on the body: a sheet whose content scrolls must not have its scroll eaten by
 * a close gesture. Under `prefers-reduced-motion` the snap back has no
 * transition, which the floor at the foot of `additions.css` takes care of.
 */
export function Sheet({
  children,
  onClose,
  title,
  label,
  titleAside,
  as = 'auto',
  width = 520,
  className,
}: SheetProps) {
  const phone = usePhoneViewport();
  const panel = useRef<HTMLDivElement>(null);
  const pressedOnScrim = useRef(false);
  const titleId = useId();
  const [drag, setDrag] = useState(0);
  const from = useRef<number | null>(null);
  /** How far the finger has travelled, for the pointer-up decision (N8). */
  const dragged = useRef(0);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const asSheet = as === 'sheet' || (as === 'auto' && phone);

  /** The title and whatever sits at the right of its line, as one row. */
  const titleRow =
    titleAside === undefined || titleAside === null ? (
      title
    ) : (
      <span className="sheet-titlerow">
        <span>{title}</span>
        {titleAside}
      </span>
    );

  /*
   * Close on a delay, so the sheet can animate away (§3.2, review S2).
   *
   * Every way out goes through this — Escape and the scrim tap through
   * `useModalLayer` and the scrim handler, the drag through `onPointerUp`, and
   * a caller's own button through the `onClose` it was handed. The caller's
   * `onClose` is what unmounts us, and it is called once: the timer is cleared
   * on unmount and `closing` guards a second request.
   */
  const startClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(onClose, CLOSE_MS);
  }, [closing, onClose]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  /*
   * The layer, claimed only when this really is a sheet.
   *
   * Called unconditionally, as a hook must be — but in the `Modal` branch below
   * `panel` is never attached to anything, so `panel.current` is null and
   * `useModalLayer` returns without claiming a layer. `Modal` then claims its
   * own with its own ref, and the page is held once rather than twice.
   */
  useModalLayer(panel, startClose);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    from.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (from.current === null) return;
    const moved = Math.max(0, event.clientY - from.current);
    dragged.current = moved;
    setDrag(moved);
  };
  /*
   * The decision is read from a ref, not from inside a state updater (review
   * N8). An updater must be pure — React double-invokes them in StrictMode — so
   * closing from inside one was a trap even while it was idempotent.
   */
  const onPointerUp = () => {
    if (from.current === null) return;
    from.current = null;
    const moved = dragged.current;
    dragged.current = 0;
    setDrag(0);
    if (moved > DRAG_TO_CLOSE) startClose();
  };

  if (!asSheet) {
    /*
     * `Modal` draws no gutters — every caller that needs them brings its own —
     * so the body is padded here. Without it the sheet's rows, which are
     * `width: 100%` with their own 3px keyline, sat flush against the dialog's
     * 4px border and the two keylines read as one thick smear. The sheet branch
     * gets the same 16px from `.sheet`'s own padding, so a caller's children
     * are laid out identically at both widths.
     */
    /*
     * The desktop half closes through the same delay, so a `Sheet` behaves the
     * same way at both widths (review S2). `Modal`'s own markup is untouched:
     * the fade-out is drawn by `.sheet-closing` on the wrapper around it, which
     * is the scrim's own child and animates the panel with it.
     */
    return portal(
      <div className={closing ? 'sheet-closing' : undefined}>
        <Modal onClose={startClose} width={width} label={label} title={titleRow}>
          <div className="sheet-body">{children}</div>
        </Modal>
      </div>,
    );
  }

  const hasTitle = title !== undefined && title !== null;

  return portal(
    <div
      className={cx('scrim', 'sheet-scrim', closing && 'sheet-closing')}
      onPointerDown={(pressed) => {
        pressedOnScrim.current = pressed.target === pressed.currentTarget;
      }}
      onClick={(clicked) => {
        if (clicked.target === clicked.currentTarget && pressedOnScrim.current) startClose();
      }}
    >
      <div
        ref={panel}
        className={cx('sheet', className)}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={!label && hasTitle ? titleId : undefined}
        tabIndex={-1}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sheet-grip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="sheet-handle" aria-hidden="true" />
          <div className="sheet-headrow">
            {hasTitle && (
              <h2 id={titleId} className={cx('d', 'sheet-title')}>
                {titleRow}
              </h2>
            )}
            {/*
              A visible way out, in the top right (owner, 2026-09-17: "panel
              should have an x in top right, and if on a circle or square it
              should be shadowed"). The same square as `Modal`'s Close, which
              the spot picker already shows on this screen — a sheet that could
              only be dismissed by a scrim tap, Escape or a drag asked a rider
              to know three gestures and showed them none.

              `stopPropagation` on the press, because the header is also the
              drag handle: without it the grip captures the pointer and the
              button never sees its own click.
            */}
            <button
              type="button"
              className="modal-close sheet-close"
              aria-label="Close"
              onPointerDown={(press) => press.stopPropagation()}
              onClick={startClose}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
  );
}

/* --------------------------------------------------------------- dropdown -- */

export type DropdownProps = {
  children: ReactNode;
  /** Close the panel. */
  onClose: () => void;
  /** Accessible name for the panel. */
  label?: string;
  /** Panel width in px. */
  width?: number;
  /**
   * The positioned element holding both the trigger and this panel.
   *
   * A pointer press outside it closes the panel; a press on the trigger inside
   * it is left to the trigger, which is what makes a second press on the button
   * close what the first one opened. Without it the panel closes itself and the
   * button immediately reopens it.
   */
  holder?: RefObject<HTMLElement | null>;
  /**
   * Drop the panel across the whole width, under the top bar, instead of
   * hanging it off its button's right edge.
   *
   * What the bell asks for on a phone (owner, 2026-09-17: "/whats-new feels
   * better as a slide down panel"): a 420px panel anchored to a 34px button is
   * a desktop shape, and on a 375px screen the same content wants the width it
   * can have. Additive and off by default, so every existing caller is
   * unchanged.
   */
  fullWidth?: boolean;
  className?: string;
  id?: string;
};

/**
 * The desktop anchor panel (rethink §3.2) — what the bell and the sport chip
 * open above 860px, where a bottom sheet would be absurd.
 *
 * Paper, the 3px keyline and the hard offset shadow, hung under the right edge
 * of the button that opened it. It closes on Escape and on an outside
 * `pointerdown` rather than an outside `click`, for the reason `AccountMenu`
 * gives next door: a click on a link inside would close the panel before the
 * link's own handler ran.
 *
 * Deliberately **not** a modal layer. A dropdown is a menu, not a dialog: it
 * does not hold the page still, and a rider who scrolls or clicks past it has
 * dismissed it. That is also why it is not `Sheet`'s desktop half — `Sheet`
 * becomes a `Modal` because its contents are a decision, and this is a glance.
 */
export function Dropdown({
  children,
  onClose,
  label,
  width = 420,
  holder,
  fullWidth = false,
  className,
  id,
}: DropdownProps) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointer = (event: PointerEvent) => {
      const within = holder?.current ?? panel.current;
      if (!within?.contains(event.target as Node)) close();
    };

    /*
     * Tabbing out closes it too (review S12).
     *
     * §3.2 makes this a menu rather than a dialog on purpose, so there is no
     * focus trap — which left one case with no way out: a keyboard rider who
     * opened the bell with Enter and pressed Tab landed on the avatar with the
     * panel still hanging over the page, dismissible only by knowing about
     * Escape. `focusout` fires before the new element takes focus, so the
     * incoming target is read from `relatedTarget`; a null one (focus leaving
     * the document entirely, as when the window is switched) is left alone,
     * because coming back should find the panel where it was.
     */
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (!(next instanceof Node)) return;
      const within = holder?.current ?? panel.current;
      if (!within?.contains(next)) close();
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [close, holder]);

  return (
    <div
      ref={panel}
      id={id}
      className={cx('dropdown', fullWidth && 'dropdown-full', className)}
      role="group"
      aria-label={label}
      /*
       * A full-width panel measures itself against the screen, not against a
       * caller's number: `.dropdown-full` pins its own left and right edges, so
       * an inline width here would fight it.
       */
      style={fullWidth ? undefined : { width: `min(${width}px, calc(100vw - 24px))` }}
    >
      {children}
    </div>
  );
}

export type ToastProps = {
  children: ReactNode;
  /** Colour chip on the left. Stage colour, sticker hue, or a status colour. */
  color?: string;
  className?: string;
};

/** One toast. Dark, paper keyline, round colour chip. */
export function Toast({ children, color, className }: ToastProps) {
  return (
    <div className={cx('toast', className)}>
      <span className="chip" style={{ background: color }} />
      {children}
    </div>
  );
}

export type ToastStackProps = {
  children: ReactNode;
};

/**
 * Fixed container at the bottom centre. Presentational only — owning the queue
 * and the 3.2s timeout is the app shell's job (T5).
 */
export function ToastStack({ children }: ToastStackProps) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {children}
    </div>
  );
}
