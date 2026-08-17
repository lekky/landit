import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { scrubBreadcrumb, scrubEvent, sentryEnabled, sentryOptions, stripQuery } from './sentry';

/**
 * Error reporting, proven rather than configured (T18).
 *
 * The task this landed under asked for Sentry to be wired **and verified**, and
 * "there is a config file" is not a verification — a DSN read from the wrong
 * variable, an SDK that never initialises, an `enabled: false` left in place all
 * look exactly like a working integration until the day something breaks. There
 * is no Sentry project provisioned (plan §6.5), so the honest verification is
 * the one below: point the SDK at a **local listener**, throw something, and
 * assert an envelope arrives.
 *
 * The privacy assertions are the other half, and matter more. This is a service
 * used by children; what an error report is allowed to carry is a decision, and
 * a decision nobody tests is a default somebody will change.
 */

let sink: Server;
let received: string[] = [];
let dsn = '';

beforeAll(async () => {
  sink = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += String(chunk)));
    request.on('end', () => {
      received.push(`${request.url}\n${body}`);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{}');
    });
  });

  await new Promise<void>((resolve) => sink.listen(0, '127.0.0.1', resolve));
  const { port } = sink.address() as AddressInfo;
  // A DSN is a URL: `<protocol>://<public key>@<host>/<project id>`. Nothing
  // about it is secret, which is why one can be pointed at a local port.
  dsn = `http://0123456789abcdef0123456789abcdef@127.0.0.1:${port}/1`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => sink.close(() => resolve()));
});

describe('whether reporting is on', () => {
  it('is off with no DSN, which is every checkout and CI today', () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    expect(sentryEnabled()).toBe(false);
    expect(sentryOptions().enabled).toBe(false);
  });

  it('is on with one, and reads the variable the env template documents', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = dsn;
    expect(sentryEnabled()).toBe(true);
    expect(sentryOptions().dsn).toBe(dsn);
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });
});

describe('what an error report is allowed to carry', () => {
  it('never asks the SDK for IP addresses, cookies or usernames', () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = dsn;
    // `sendDefaultPii` is the switch. On a service used by children it is the
    // one option in this file that must not drift.
    expect(sentryOptions().sendDefaultPii).toBe(false);
    // Tracing off: a trace is a record of a child moving around the app.
    expect(sentryOptions().tracesSampleRate).toBe(0);
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  it('strips the query string, where the rider ids are', () => {
    expect(stripQuery('https://landthetrick.com/report?about=profile&id=abc123')).toBe(
      'https://landthetrick.com/report',
    );
    expect(stripQuery('https://landthetrick.com/home')).toBe('https://landthetrick.com/home');

    const scrubbed = scrubEvent({
      type: undefined,
      request: { url: 'https://landthetrick.com/report?id=abc123', query_string: 'id=abc123' },
      breadcrumbs: [{ data: { url: 'https://landthetrick.com/riders/kai?x=1' } }],
    });
    expect(scrubbed.request?.url).toBe('https://landthetrick.com/report');
    expect(scrubbed.request?.query_string).toBeUndefined();
    expect(scrubbed.breadcrumbs?.[0]?.data?.url).toBe('https://landthetrick.com/riders/kai');
    expect(JSON.stringify(scrubbed)).not.toContain('abc123');

    // The earlier of the two hooks, on its own.
    expect(scrubBreadcrumb({ data: { url: '/report?id=abc123' } }).data?.url).toBe('/report');
  });

  it('redacts the guardian-consent token, which is in the path and not the query', () => {
    // Holding this token grants or withdraws a guardian's consent for a child,
    // with no account and no sign-in (plan §6.2, §3 guarantee 4). Query-string
    // stripping alone would have shipped it to Sentry whole, which is what the
    // security review of this branch found.
    const token = 'aVeryLongCapabilityTokenThatIsNotAnIdentifier';
    expect(stripQuery(`https://landthetrick.com/consent/approve/${token}`)).toBe(
      'https://landthetrick.com/consent/approve/[redacted]',
    );
    expect(stripQuery(`https://landthetrick.com/consent/revoke/${token}?x=1`)).toBe(
      'https://landthetrick.com/consent/revoke/[redacted]',
    );

    const event = scrubEvent({
      type: undefined,
      request: { url: `https://landthetrick.com/consent/approve/${token}` },
      breadcrumbs: [{ data: { url: `/consent/revoke/${token}` } }],
    });
    expect(JSON.stringify(event)).not.toContain(token);
  });
});

describe('an event actually leaves the process', () => {
  it('delivers a captured exception to the DSN it was given', async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = dsn;
    received = [];

    // The **same package and the same options** `instrumentation.ts` uses. A
    // test against a hand-built client would prove something about the SDK; this
    // proves something about what ships.
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({ ...sentryOptions(), integrations: [] });

    Sentry.captureException(new Error('landit sentry wiring check'));
    await Sentry.flush(5_000);

    expect(received.length).toBeGreaterThan(0);
    const envelope = received.join('\n');
    expect(envelope).toContain('/api/1/envelope/');
    expect(envelope).toContain('landit sentry wiring check');

    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });
});
