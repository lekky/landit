'use client';

import { useEffect, type ReactNode } from 'react';

import { cx } from '../cx';

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
  onClose: () => void;
  /** Max width in px. The panel is `min(width, 100%)`. */
  width?: number;
  /** Accessible name for the dialog. */
  label?: string;
};

/** Escape closes, and so does a click on the scrim. */
export function Modal({ children, onClose, width = 520, label }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{ width: `min(${width}px,100%)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
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
