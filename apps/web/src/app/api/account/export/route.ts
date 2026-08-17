import { exportAccountData, isRateLimited } from '@landit/db';
import { NextResponse } from 'next/server';

import { currentRider } from '@/lib/session';

/**
 * `GET /api/account/export` — the rider's own data, as a file they can keep.
 *
 * A route handler rather than a server action, because the deliverable is a
 * **download**: a server action returns a value to React and cannot set
 * `Content-Disposition`, so the file would have to be rebuilt in the browser
 * from a string the page had already rendered — a second copy of everything,
 * sitting in the DOM.
 *
 * **It carries no parameters and reads none.** The subject is whoever the
 * session cookie belongs to; `/api/landit/account/export` on the PocketBase side
 * likewise takes no account id, so there is nothing in this chain for a query
 * string to influence (plan §3 guarantee 1).
 *
 * `GET` is safe here in the sense that matters: it changes nothing but the audit
 * row that records a subject access request, and a cross-origin page that
 * caused the browser to fetch it could not read the response. `no-store` keeps
 * it out of the browser cache and off any proxy in front of us — this is the
 * one response in the product that is a rider's whole account in one object.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await currentRider();
  if (!session) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  try {
    const payload = await exportAccountData(session.client);
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="land-it-data-${stamp}.json"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    if (isRateLimited(error)) {
      return NextResponse.json(
        { error: 'You have downloaded this a few times just now. Try again in an hour.' },
        { status: 429, headers: { 'cache-control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { error: 'We could not build that just now. Try again in a moment.' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    );
  }
}
