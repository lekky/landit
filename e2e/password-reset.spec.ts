import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

// The mailbox lives with the PocketBase suite because it exists to catch what
// PocketBase sends; issue #16 is already about this repo growing a second copy
// of a test harness, so this imports it rather than adding one.
import { decodeBody, startMailbox, tokenFrom, type Mailbox } from '../pocketbase/tests/mailbox';

import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD } from './support/fixtures';
import { POCKETBASE_URL } from './support/seed-library';

/**
 * "I clicked the link, I typed a new password, and it said that is done" —
 * followed by the question nothing in this repository could answer: *did it*?
 *
 * Two separate things have to be true and neither was covered anywhere.
 *
 * 1. **The link in the email has to reach a page this app serves.** PocketBase
 *    templates its own emails at its own admin UI, so the stock reset body
 *    points at `{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}` and hands a
 *    rider a 404 — observed on the live instance 2026-08-18. The corrected body
 *    is `pocketbase/templates/password-reset.html`, and until now it was a file
 *    nothing read: a reference copy for a human to paste into the admin UI, with
 *    no check that the URL inside it still matched the route.
 * 2. **Setting the password has to change the password.** `confirmResetAction`
 *    reports success when the SDK call does not throw, which is correct — but
 *    "the form said yes" and "the account has a new password" were two claims
 *    with only the first one ever observed.
 *
 * So this asks on `/forgot-password`, takes the token out of the message
 * PocketBase actually sent, puts it through **the href in this repository's
 * template**, and walks whatever URL comes out: set a password on the page it
 * lands on, then sign in with it. The old password failing at the end matters as
 * much as the new one working.
 *
 * **Why the template is substituted rather than installed.** The obvious version
 * of this test pastes `password-reset.html` into the instance the way a human
 * would, and it works — but PocketBase's automigrate notices the collection
 * change and writes a `*_updated_users.js` into `pocketbase/migrations/`, so
 * every run of the suite leaves a migration in the repository. Reading the href
 * out of the file and filling in `{APP_URL}` and `{TOKEN}` ourselves proves the
 * same thing about the same string and writes nothing. What it does not prove is
 * that the *live* instance still has this body pasted into it; that is instance
 * state, and `docs/infrastructure.md` says so.
 *
 * `pocketbase/tests/password-reset.test.ts` proves the same of the API alone and
 * runs in seconds; this one is here for the two halves that only exist in a
 * browser — the template's URL and the page it opens.
 */

const template = readFileSync(
  new URL('../pocketbase/templates/password-reset.html', import.meta.url),
  'utf8',
);

const unique = () => Math.random().toString(36).slice(2, 10);
const oldPassword = 'a-long-local-test-password';
const newPassword = 'a-different-long-password';

async function pb<T = Record<string, unknown>>(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.token) headers.Authorization = options.token;
  const response = await fetch(`${POCKETBASE_URL}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : {}) as T };
}

test.describe('resetting a password', () => {
  let mailbox: Mailbox;
  let token: string;

  test.beforeAll(async () => {
    mailbox = await startMailbox();

    const auth = await pb<{ token: string }>(
      'POST',
      '/api/collections/_superusers/auth-with-password',
      { body: { identity: SUPERUSER_EMAIL, password: SUPERUSER_PASSWORD } },
    );
    expect(auth.status).toBe(200);
    token = auth.body.token;

    // Where the email goes, and the only thing this touches. Settings are not
    // collections, so unlike a template paste this leaves no migration behind.
    const settings = await pb('PATCH', '/api/settings', {
      token,
      body: {
        smtp: {
          enabled: true,
          host: '127.0.0.1',
          port: mailbox.port,
          username: '',
          password: '',
          authMethod: '',
          tls: false,
          localName: '127.0.0.1',
        },
      },
    });
    expect(settings.status).toBe(200);
  });

  test.afterAll(async () => {
    // Leave the instance as it was found: the other specs share it, and an
    // enabled SMTP pointing at a closed socket is a trap for whoever runs next.
    if (token) {
      await pb('PATCH', '/api/settings', { token, body: { smtp: { enabled: false } } }).catch(
        () => {},
      );
    }
    await mailbox?.stop();
  });

  test('the emailed link lands on a page that actually sets the password', async ({ page }) => {
    const email = `reset-${unique()}@landit.invalid`;

    const created = await pb('POST', '/api/collections/users/records', {
      body: {
        email,
        password: oldPassword,
        passwordConfirm: oldPassword,
        name: 'Forgetful Rider',
        handle: `forgot${unique()}`,
        country: 'GB',
        age_band: 'adult',
      },
    });
    expect(created.status).toBe(200);

    // --- ask, on the screen a rider asks from ---------------------------------
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: /send/i }).click();

    const message = decodeBody(await mailbox.waitFor((m) => m.includes(email), 20_000));
    const resetToken = tokenFrom(message);

    // --- the link this repository's template would have sent ------------------
    const href = template.match(/href="([^"]*\{TOKEN\}[^"]*)"/)?.[1];
    expect(href, 'password-reset.html must link somewhere with {TOKEN} in it').toBeTruthy();
    // `{APP_URL}` is whatever the instance is told it is; here that is the app
    // this run is driving, taken from the project rather than written out again.
    const appUrl = test.info().project.use.baseURL!;
    const link = href!.replace('{APP_URL}', appUrl).replace('{TOKEN}', resetToken);

    // Named rather than merely navigated to, so a template that goes back to
    // pointing at PocketBase's admin UI fails here with the reason rather than
    // thirty lines later on a missing form field.
    expect(
      new URL(link).pathname,
      'the reset email must link at /reset-password, not PocketBase’s admin UI',
    ).toBe('/reset-password');

    // --- set the new password on the page that link opens ---------------------
    await page.goto(link);
    await page.getByLabel('New password').fill(newPassword);
    await page.getByRole('button', { name: 'Set the password' }).click();
    await expect(page.getByText('That is done')).toBeVisible();

    // --- and now the only thing that settles it -------------------------------
    await page.goto('/signin');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(newPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/signin'));

    // The old one has to have stopped working, or nothing was reset — it was
    // merely added to.
    const withOld = await pb('POST', '/api/collections/users/auth-with-password', {
      body: { identity: email, password: oldPassword },
    });
    expect(withOld.status).toBe(400);
  });
});
