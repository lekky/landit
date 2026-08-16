'use client';

import { useEffect, useRef } from 'react';

/**
 * A hidden field carrying the browser's IANA timezone.
 *
 * `users.timezone` is what makes a rider's *day* mean something — streaks,
 * "rode today" and challenge boundaries are all day comparisons, and a day only
 * exists inside a timezone (plan §3). It is captured here rather than guessed
 * from an IP address, which would be both less accurate and more personal data
 * than we want.
 *
 * The value is written to the DOM node rather than held in React state on
 * purpose: the server has no idea what zone the browser is in, so rendering it
 * into the initial HTML would be a hydration mismatch, and setting state in an
 * effect to fix that is a cascading render for a value nothing re-reads.
 */
export function TimezoneField({ name = 'timezone' }: { name?: string }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      ref.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    } catch {
      ref.current.value = '';
    }
  }, []);

  return <input ref={ref} type="hidden" name={name} defaultValue="" />;
}

/** The same value, for code that is not inside a form. */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}
