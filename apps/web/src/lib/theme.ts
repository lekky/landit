/**
 * Light, dark, or whatever the phone says.
 *
 * The design pack is light-only; the dark theme is a deliberate divergence
 * (owner, 2026-09-01, in chat; plan §7 T5, seventh divergence). The tokens do
 * the actual work in `@landit/ui-web`'s `tokens.css`. This file is the small
 * amount of plumbing that decides which set applies:
 *
 * - **No choice** — nothing is stamped on `<html>`, and the stylesheet's
 *   `prefers-color-scheme` query follows the OS. This is the default and it is
 *   what most riders will have forever.
 * - **A choice** — `data-theme="light"` or `"dark"` on `<html>`, which beats
 *   the OS either way, remembered in `localStorage` on this device only.
 *
 * Per device rather than per rider, deliberately: no schema change, nothing to
 * sync, and a theme is a property of the screen you are looking at rather than
 * of the account — the same rider on a bright phone and a dark laptop wants
 * different answers. If that ever changes it becomes a `users` field and this
 * file reads it instead; nothing rendering the theme would move.
 *
 * `THEME_BOOT_SCRIPT` runs inline in `<head>` before first paint, so a rider
 * who chose dark does not see a cream flash on every load. It reads one key,
 * writes one attribute, and swallows the storage exception a private window
 * throws. There is no CSP on the app to object to it (checked 2026-09-01).
 */

export const THEME_STORAGE_KEY = 'ltt.theme';

export type ThemeChoice = 'system' | 'light' | 'dark';

/** The three options, in the order Account shows them. Copy lives here. */
export const THEME_CHOICES: readonly { id: ThemeChoice; label: string; blurb: string }[] = [
  {
    id: 'system',
    label: 'Match my device',
    blurb: 'Light or dark, whichever your phone or computer is set to.',
  },
  { id: 'light', label: 'Always light', blurb: 'Cream paper, black ink.' },
  { id: 'dark', label: 'Always dark', blurb: 'Black ground, cream ink. Easier at dusk.' },
];

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** What this device has chosen. `system` when nothing is stored or readable. */
export function readThemeChoice(storage: Pick<Storage, 'getItem'> | null | undefined): ThemeChoice {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

type RootLike = Pick<Element, 'setAttribute' | 'removeAttribute'>;
type StorageLike = Pick<Storage, 'setItem' | 'removeItem'>;

/*
 * Listeners for `useSyncExternalStore`. `applyThemeChoice` notifies them, which
 * is what lets the Account panel re-read the store after its own write — the
 * browser's `storage` event only fires in *other* tabs. The panel also
 * subscribes to that event, so a change made in another tab is reflected here.
 */
const listeners = new Set<() => void>();

/** Subscribe to theme changes made in this tab or another. Returns unsubscribe. */
export function subscribeThemeChoice(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === THEME_STORAGE_KEY) listener();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/**
 * Apply a choice: stamp (or clear) `data-theme`, and remember it (or forget
 * it). `system` clears both, so the stylesheet's media query is back in
 * charge — an explicit "system" stored as a string would just be a slower way
 * of saying nothing.
 */
export function applyThemeChoice(
  choice: ThemeChoice,
  root: RootLike,
  storage: StorageLike | null | undefined,
): void {
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  try {
    if (choice === 'system') storage?.removeItem(THEME_STORAGE_KEY);
    else storage?.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // A private window, or storage switched off. The attribute is set for this
    // page load, which is the most that can be done.
  }
  for (const listener of listeners) listener();
}

/**
 * The pre-paint script, as a string for `dangerouslySetInnerHTML`. Kept to one
 * line and no dependencies on purpose: it has to run before anything else has
 * loaded, and it must never throw.
 */
export const THEME_BOOT_SCRIPT =
  `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');` +
  `if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;
