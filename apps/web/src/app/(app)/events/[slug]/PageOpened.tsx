'use client';

import { useEffect } from 'react';

import { ANALYTICS_EVENTS, capture } from '@/lib/analyticsClient';

/**
 * Counts an event page being opened, and where the reader came from. Renders
 * nothing.
 *
 * The page itself is a server component and has to stay one — it is the
 * crawlable half of this feature, and turning it into a client component for
 * the sake of one counter would ship the whole thing to the browser. So the
 * client boundary is this, and it is as small as one gets (`PaywallSeen` next
 * door is the same shape for the same reason).
 *
 * `source` is one of three fixed strings decided on the server from a `from`
 * query parameter, never from anything a reader typed: a `from` we do not
 * recognise reads as `direct`, which is also what a shared link, a search
 * result and a typed address all are. `kind` is catalogue copy — "Jam",
 * "Comp". Neither the event's name nor its town travels: `analytics.ts` allows
 * catalogue facts and this page is public, so most of what it counts is
 * somebody with no account at all.
 */
export function PageOpened({
  source,
  kind,
}: {
  readonly source: 'list' | 'modal_cta' | 'direct';
  readonly kind: string;
}) {
  useEffect(() => {
    capture(ANALYTICS_EVENTS.eventPageOpened, { source, kind });
  }, [source, kind]);

  return null;
}
