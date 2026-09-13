import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

import { SessionDetail } from '@/components/sessions/detail/SessionDetail';
import { loadSessionDetail } from '@/components/sessions/detail/load';
import { signInHref } from '@/lib/routes';
import { isRecordId, sessionHref, sessionsHref } from '@/lib/sessionRoutes';

/**
 * One session (T39; design 1e desktop, 2c phone).
 *
 * **Who can open it is the API's decision, not this page's.** `getSession` is
 * read with the viewer's own client, so the owner gets their session, a
 * crew-mate gets a `members` session only if they share a crew and the owner's
 * profile is open to them, and everybody else gets `null` — which renders the
 * app's ordinary 404, indistinguishable from an id that never existed.
 *
 * **A signed-out visitor is sent to sign in and brought back** (an undesigned
 * case, flagged in the T39 plan entry). This lives under `/progress`, which is
 * in `GATED_ROUTES` and answers a visitor with a redirect everywhere else; a
 * public session's page served to anybody with the link would make part of a
 * gated tree public without either list saying so. After signing in, the API
 * decides as above.
 *
 * **`load` is memoised per request** with React's `cache()` (issue #421), so
 * `generateMetadata` and the page share one set of reads rather than doing all
 * of them twice.
 */

type Params = { params: Promise<{ id: string }> };

const load = cache((id: string) => loadSessionDetail(id));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const data = await load(id);
  return {
    /*
     * The spot's name only for a viewer who can read the session — the same
     * read that decides whether the page renders. Anybody else (signed out, or
     * refused) gets a title that says nothing about where somebody rode.
     */
    title:
      data.kind === 'ok'
        ? `${data.view.spot.name} · Session · Land The Trick`
        : 'Session · Land The Trick',
    // One rider's diary entry. Nothing here belongs in a search index (§6.4).
    robots: { index: false, follow: false },
  };
}

export default async function SessionPage({ params }: Params) {
  const { id } = await params;
  const data = await load(id);

  if (data.kind === 'signed-out') {
    redirect(signInHref(isRecordId(id) ? sessionHref(id) : sessionsHref()));
  }
  if (data.kind === 'missing') notFound();

  return <SessionDetail view={data.view} />;
}

// The session, its visibility and its neighbours are read per request, per viewer.
export const dynamic = 'force-dynamic';
