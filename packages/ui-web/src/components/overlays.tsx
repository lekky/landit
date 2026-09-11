'use client';

import { useId, useRef, type ReactNode } from 'react';

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
