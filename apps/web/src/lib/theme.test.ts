import { describe, expect, it } from 'vitest';

import {
  THEME_BOOT_SCRIPT,
  THEME_CHOICES,
  THEME_STORAGE_KEY,
  applyThemeChoice,
  isThemeChoice,
  readThemeChoice,
} from './theme';

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}

function fakeRoot() {
  const attrs = new Map<string, string>();
  return {
    attrs,
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    removeAttribute: (k: string) => void attrs.delete(k),
  };
}

describe('readThemeChoice', () => {
  it('is system when nothing is stored, or storage is missing', () => {
    expect(readThemeChoice(fakeStorage())).toBe('system');
    expect(readThemeChoice(null)).toBe('system');
    expect(readThemeChoice(undefined)).toBe('system');
  });

  it('reads a stored choice and rejects anything else', () => {
    expect(readThemeChoice(fakeStorage({ [THEME_STORAGE_KEY]: 'dark' }))).toBe('dark');
    expect(readThemeChoice(fakeStorage({ [THEME_STORAGE_KEY]: 'light' }))).toBe('light');
    expect(readThemeChoice(fakeStorage({ [THEME_STORAGE_KEY]: 'neon' }))).toBe('system');
  });

  it('survives storage that throws, as a private window does', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(readThemeChoice(throwing)).toBe('system');
  });
});

describe('applyThemeChoice', () => {
  it('stamps dark and remembers it', () => {
    const root = fakeRoot();
    const storage = fakeStorage();
    applyThemeChoice('dark', root, storage);
    expect(root.attrs.get('data-theme')).toBe('dark');
    expect(storage.store.get(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('system clears the stamp and forgets, so the OS decides again', () => {
    const root = fakeRoot();
    const storage = fakeStorage({ [THEME_STORAGE_KEY]: 'light' });
    root.attrs.set('data-theme', 'light');
    applyThemeChoice('system', root, storage);
    expect(root.attrs.has('data-theme')).toBe(false);
    expect(storage.store.has(THEME_STORAGE_KEY)).toBe(false);
  });

  it('still stamps the page when storage refuses the write', () => {
    const root = fakeRoot();
    const refusing = {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    applyThemeChoice('dark', root, refusing);
    expect(root.attrs.get('data-theme')).toBe('dark');
  });
});

describe('the boot script', () => {
  it('reads the same key the app writes, and only accepts the two stamps', () => {
    expect(THEME_BOOT_SCRIPT).toContain(`'${THEME_STORAGE_KEY}'`);
    expect(THEME_BOOT_SCRIPT).toContain("t==='dark'");
    expect(THEME_BOOT_SCRIPT).toContain("t==='light'");
    expect(THEME_BOOT_SCRIPT).toContain("setAttribute('data-theme',t)");
  });

  it('is wrapped so it can never throw before the page has painted', () => {
    expect(THEME_BOOT_SCRIPT.startsWith('try{')).toBe(true);
    expect(THEME_BOOT_SCRIPT.endsWith('catch(e){}')).toBe(true);
    expect(THEME_BOOT_SCRIPT).not.toContain('\n');
  });

  it('agrees with the choices Account offers', () => {
    expect(THEME_CHOICES.map((c) => c.id)).toEqual(['system', 'light', 'dark']);
    for (const c of THEME_CHOICES) expect(isThemeChoice(c.id)).toBe(true);
  });
});
