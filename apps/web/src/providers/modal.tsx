'use client';

import { Modal } from '@landit/ui-web';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * The modal host.
 *
 * One modal at a time, opened from anywhere. The scrim, the 200ms fade, the
 * 26px rise and Escape-to-close all belong to the design system's `Modal`; what
 * the shell adds is somewhere for a screen to put one without every screen
 * owning its own open/closed flag.
 *
 * Callers arrive with T7 onward: the sticker detail, the share card, the crew
 * invite, the event detail.
 */

type ModalOptions = {
  /** Max width in px. Defaults to the design system's 520. */
  width?: number;
  /** Accessible name for the dialog. */
  label?: string;
};

type ModalContextValue = {
  openModal: (content: ReactNode, options?: ModalOptions) => void;
  closeModal: () => void;
  isOpen: boolean;
};

const ModalContext = createContext<ModalContextValue | null>(null);

type OpenModal = { content: ReactNode; options: ModalOptions };

export function ModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<OpenModal | null>(null);

  const openModal = useCallback((content: ReactNode, options: ModalOptions = {}) => {
    setOpen({ content, options });
  }, []);
  const closeModal = useCallback(() => setOpen(null), []);

  const value = useMemo(
    () => ({ openModal, closeModal, isOpen: open !== null }),
    [openModal, closeModal, open],
  );

  return (
    <ModalContext.Provider value={value}>
      {children}
      {open && (
        <Modal onClose={closeModal} width={open.options.width} label={open.options.label}>
          {open.content}
        </Modal>
      )}
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextValue {
  const value = useContext(ModalContext);
  if (!value)
    throw new Error('useModal must be used inside <ModalProvider>, which AppShell sets up.');
  return value;
}
