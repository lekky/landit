import { randomBytes } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SUPERUSER_EMAIL, SUPERUSER_PASSWORD, startPocketBase, type Instance } from './instance';
import { startMailbox, tokenFrom, type Mailbox } from './mailbox';

/**
 * Does the reset link actually change the password?
 *
 * Nothing proved it before this file. `confirmResetAction` reports success when
 * `confirmPasswordReset` does not throw, and every test in the repo stopped at
 * the form — so "I set a new password and it said that is done" and "my
 * password is now that" were two different claims with only the first one
 * checked. The infrastructure notes record the reset being *walked* on the live
 * box on 2026-08-18, which caught the stock-template 404, but a walk is not a
 * proof that the record changed either.
 *
 * So this drives the real endpoints, in order, against the real binary: ask for
 * the email, read the token out of the email PocketBase actually sent, post it
 * back, and then try to sign in **both ways**. The old password failing matters
 * as much as the new one working: a reset that adds a password without retiring
 * the old one is a reset that has not happened.
 *
 * **Its own instance, not the shared one.** The token only exists in an email,
 * so this has to point PocketBase's SMTP settings at a socket it controls, and
 * settings are global. Borrowing the suite's shared instance would mean every
 * other file's mail behaviour changed underneath it for as long as this ran.
 */
describe('the password reset link', () => {
  let pb: Instance;
  let mailbox: Mailbox;
  let token: string;

  const call = async <T = Record<string, unknown>>(
    method: string,
    path: string,
    options: { token?: string; body?: unknown } = {},
  ): Promise<{ status: number; body: T }> => {
    const headers: Record<string, string> = {};
    if (options.token) headers.Authorization = options.token;
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(new URL(path, pb.url), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let body: unknown = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }
    return { status: response.status, body: body as T };
  };

  const suffix = randomBytes(5).toString('hex');
  const email = `reset-${suffix}@landit.invalid`;
  const oldPassword = 'the-password-they-forgot';
  const newPassword = 'the-password-they-just-set';

  beforeAll(async () => {
    mailbox = await startMailbox();
    pb = await startPocketBase();

    const auth = await call<{ token: string }>(
      'POST',
      '/api/collections/_superusers/auth-with-password',
      { body: { identity: SUPERUSER_EMAIL, password: SUPERUSER_PASSWORD } },
    );
    expect(auth.status).toBe(200);
    token = auth.body.token;

    // No TLS and no credentials: the mailbox is a socket on loopback that keeps
    // whatever it is handed.
    const settings = await call('PATCH', '/api/settings', {
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
        meta: {
          appURL: 'http://127.0.0.1:3000',
          senderName: 'Land The Trick',
          senderAddress: 'no-reply@landit.invalid',
        },
      },
    });
    expect(settings.status).toBe(200);
  }, 120_000);

  afterAll(async () => {
    await pb?.stop();
    await mailbox?.stop();
  });

  it('emails a token, and the token sets the password it was asked to set', async () => {
    const created = await call<{ id: string }>('POST', '/api/collections/users/records', {
      body: {
        email,
        password: oldPassword,
        passwordConfirm: oldPassword,
        name: `Rider ${suffix}`,
        handle: `reset${suffix}`,
        country: 'GB',
        age_band: 'adult',
      },
    });
    expect(created.status).toBe(200);

    // Signing in with the old password first, so a later failure cannot be
    // blamed on an account that never worked.
    const before = await call('POST', '/api/collections/users/auth-with-password', {
      body: { identity: email, password: oldPassword },
    });
    expect(before.status).toBe(200);

    const asked = await call('POST', '/api/collections/users/request-password-reset', {
      body: { email },
    });
    expect(asked.status).toBe(204);

    const message = await mailbox.waitFor((m) => m.includes(email), 15_000);
    const resetToken = tokenFrom(message);

    const confirmed = await call('POST', '/api/collections/users/confirm-password-reset', {
      body: { token: resetToken, password: newPassword, passwordConfirm: newPassword },
    });
    expect(confirmed.status).toBe(204);

    // The two halves of "the password changed".
    const withNew = await call('POST', '/api/collections/users/auth-with-password', {
      body: { identity: email, password: newPassword },
    });
    expect(withNew.status).toBe(200);

    const withOld = await call('POST', '/api/collections/users/auth-with-password', {
      body: { identity: email, password: oldPassword },
    });
    expect(withOld.status).toBe(400);
  });

  // Runs after the test above and depends on it: the message it re-reads is the
  // one that test already spent. Vitest runs a file's tests in order, and this
  // is the only place in the suite that relies on it.
  it('will not spend the same token twice', async () => {
    const again = await call('POST', '/api/collections/users/confirm-password-reset', {
      body: {
        token: tokenFrom(await mailbox.waitFor((m) => m.includes(email))),
        password: 'a-third-password-entirely',
        passwordConfirm: 'a-third-password-entirely',
      },
    });
    expect(again.status).toBe(400);
  });
});
