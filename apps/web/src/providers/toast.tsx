'use client';

import { Toast, ToastStack } from '@landit/ui-web';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * The toast host.
 *
 * "Toasts slide up from the bottom centre, dark with a paper border and a
 * colour chip, and clear after 3.2 seconds" (handoff, Interactions). The look
 * and the motion are the design system's; the queue and the timeout are the
 * shell's, which is this.
 *
 * A stage change fires one in the stage's colour, and a newly earned sticker
 * fires one in the sticker's hue — those callers are T7 and T10. Nothing here
 * knows what a stage or a sticker is.
 */

const DISMISS_AFTER_MS = 3200;

type ToastRecord = { id: number; text: string; color?: string };

type ToastContextValue = {
  /** Show one. `color` is the chip on the left: a stage colour, a hue, a status. */
  toast: (text: string, color?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastRecord[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const toast = useCallback((text: string, color?: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, text, color }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setToasts((current) => current.filter((t) => t.id !== id));
    }, DISMISS_AFTER_MS);
    timers.current.add(timer);
  }, []);

  // Without this a navigation mid-toast leaves a timer holding a setState on an
  // unmounted tree.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <ToastStack>
          {toasts.map((t) => (
            <Toast key={t.id} color={t.color}>
              {t.text}
            </Toast>
          ))}
        </ToastStack>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value)
    throw new Error('useToast must be used inside <ToastProvider>, which AppShell sets up.');
  return value;
}
