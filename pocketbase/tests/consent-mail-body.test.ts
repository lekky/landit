import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * What the one email a parent ever receives actually contains.
 *
 * Nothing pinned this until 2026-08-18, which is how the live instance spent
 * two days telling parents the product was called "Land It" and offering a clip
 * upload that had been reversed: the words were right in the repository and
 * nobody could see they were wrong in the message. A test that reads the built
 * HTML would not have caught a stale deploy — but it catches the other half,
 * an edit here that quietly drops a link or a safeguarding address.
 *
 * The hook is loaded the way `video-link-parser.test.ts` loads its own: as
 * source, with the JSVM's globals passed in. No PocketBase instance is needed.
 */

const APP_URL = 'https://landthetrick.com';

function loadHook(path: string, stubs: Record<string, unknown> = {}): Record<string, unknown> {
  const source = readFileSync(new URL(`../hooks/lib/${path}`, import.meta.url), 'utf8');
  const load = new Function('module', 'exports', 'require', '$os', '__hooks', source) as (
    module: { exports: unknown },
    exports: unknown,
    req: (id: string) => unknown,
    os: { getenv: (k: string) => string },
    hooks: string,
  ) => void;
  const container: { exports: unknown } = { exports: {} };
  load(
    container,
    container.exports,
    (id: string) => {
      const key = id.split('/').pop() as string;
      if (key in stubs) return stubs[key];
      return loadHook(key, stubs);
    },
    { getenv: (k: string) => (k === 'LANDIT_APP_URL' ? APP_URL : '') },
    '__hooks',
  );
  return container.exports as Record<string, unknown>;
}

/** The private `body()` is not exported, so reach it the way the hook does. */
function buildEmail(): string {
  const source = readFileSync(new URL('../hooks/lib/consent_mail.js', import.meta.url), 'utf8');
  const load = new Function(
    'module',
    'exports',
    'require',
    '$os',
    '__hooks',
    `${source}\nmodule.exports.__body = body;`,
  ) as (
    module: { exports: Record<string, unknown> },
    exports: unknown,
    req: (id: string) => unknown,
    os: { getenv: (k: string) => string },
    hooks: string,
  ) => void;
  const container = { exports: {} as Record<string, unknown> };
  load(
    container,
    container.exports,
    (id: string) => {
      if (id.endsWith('consent.js')) return { APPROVAL_WINDOW_DAYS: 7 };
      return loadHook('mail_shell.js');
    },
    { getenv: (k: string) => (k === 'LANDIT_APP_URL' ? APP_URL : '') },
    '__hooks',
  );
  const body = container.exports.__body as (input: unknown) => string;
  return body({
    riderName: 'Nia',
    guardianEmail: 'guardian@example.invalid',
    approvalToken: 'approve-token-1',
    revocationToken: 'revoke-token-2',
  });
}

describe('the guardian-consent email', () => {
  const html = buildEmail();

  it('carries both links, pointed at the app rather than the API', () => {
    expect(html).toContain(`${APP_URL}/consent/approve/approve-token-1`);
    expect(html).toContain(`${APP_URL}/consent/revoke/revoke-token-2`);
  });

  it('offers the safeguarding address, for a parent who wants a human', () => {
    expect(html).toContain('safeguarding@landthetrick.com');
  });

  it('names the product as it is called now', () => {
    expect(html).toContain('Land The Trick');
    expect(html).not.toMatch(/Land It\b/);
  });

  it('does not offer anything the product does not do', () => {
    expect(html.toLowerCase()).not.toContain('clip');
  });

  it('says plainly that doing nothing is a decision', () => {
    expect(html).toContain('you do not need to do anything');
  });

  it('escapes the rider name rather than trusting it', () => {
    const source = readFileSync(new URL('../hooks/lib/consent_mail.js', import.meta.url), 'utf8');
    expect(source).toContain('escapeHtml(input.riderName)');
  });
});
