'use client';

import { Panel } from '@landit/ui-web';
import { useSyncExternalStore } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';
import {
  THEME_CHOICES,
  type ThemeChoice,
  applyThemeChoice,
  isThemeChoice,
  readThemeChoice,
  subscribeThemeChoice,
} from '@/lib/theme';

import styles from './account.module.css';

/**
 * "Light or dark" — the theme switch (owner, 2026-09-01; `lib/theme.ts`).
 *
 * Wears `PrivacyPanel`'s clothes, because it is the same shape of control on
 * the same screen and a second look for radio cards would be a second thing
 * to keep in step. It differs from that panel in one deliberate way: **it
 * applies on change, not on Save.** Privacy is a form post because a setting
 * about who can see a child should change when they say so. A theme is a
 * property of this screen, and the only sensible feedback for "make it dark"
 * is for it to be dark.
 *
 * The current value comes from `useSyncExternalStore`: `localStorage` is an
 * external store, the server's snapshot is always `system` (it has no idea
 * what this device chose), and React reconciles the two after hydration
 * without a mismatch — which is exactly the case a `setState` in an effect
 * would have papered over, and the lint rule rightly refuses.
 */
const getServerSnapshot = (): ThemeChoice => 'system';
const getSnapshot = (): ThemeChoice =>
  readThemeChoice(typeof localStorage === 'undefined' ? null : localStorage);

export function ThemePanel() {
  const choice = useSyncExternalStore(subscribeThemeChoice, getSnapshot, getServerSnapshot);

  const pick = (next: string) => {
    if (!isThemeChoice(next)) return;
    applyThemeChoice(
      next,
      document.documentElement,
      typeof localStorage === 'undefined' ? null : localStorage,
    );
    // The new value, and nothing else. What the OS was set to is never read
    // into an event on its own; only a deliberate choice counts.
    capture(ANALYTICS_EVENTS.themeChanged, { theme: next });
  };

  return (
    <Panel flat className={styles.privacy}>
      <div className="lab">Light or dark</div>
      <p className={styles.privacyLede}>
        Follows your device unless you pick one. Remembered on this device only — not on your
        account.
      </p>

      <div className={styles.privacyForm} role="radiogroup" aria-label="Theme">
        {THEME_CHOICES.map((option) => (
          <label key={option.id} className={styles.privacyOption}>
            <input
              type="radio"
              name="theme"
              value={option.id}
              checked={choice === option.id}
              onChange={(e) => pick(e.target.value)}
            />
            <span>
              <span className={`cond ${styles.privacyLabel}`}>{option.label}</span>
              <span className={styles.privacyBlurb}>{option.blurb}</span>
            </span>
          </label>
        ))}
      </div>
    </Panel>
  );
}
