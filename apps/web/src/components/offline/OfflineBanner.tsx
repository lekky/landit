'use client';

import { Icon } from '@landit/ui-web';
import { useEffect, useState, useSyncExternalStore } from 'react';

import styles from './offline.module.css';

/**
 * The browser's own connection flag, as a store React can read.
 *
 * `useSyncExternalStore` rather than an effect that copies it into state: the
 * flag is exactly the kind of thing this hook exists for, and its server
 * snapshot — always "online" — is what keeps the first render identical on both
 * sides of hydration without anybody having to remember why.
 */
function subscribeToConnection(changed: () => void): () => void {
  window.addEventListener('online', changed);
  window.addEventListener('offline', changed);
  return () => {
    window.removeEventListener('online', changed);
    window.removeEventListener('offline', changed);
  };
}

/**
 * The bar that appears when the signal goes.
 *
 * Plan §2.3 buys reading offline and refuses writing offline, and this is where
 * a rider is told which of the two they have. Without it the honest half of that
 * trade is invisible: the library looks normal, so the first thing a rider
 * learns about the limit is a stage change that failed.
 *
 * It sits in the flow rather than over the top bar, so it moves the page when it
 * arrives. That is the intent — connectivity changing is exactly the moment to
 * be noticed — and it keeps the bar clear of the fixed bottom nav below 860px.
 *
 * **Two signals, because one of them lies.** `navigator.onLine` reports the
 * network interface, not the internet, so a phone associated with a park's wifi
 * that routes nowhere reports itself online — and it is also what fires the
 * `online`/`offline` events, so it is the only thing that can notice the signal
 * coming *back*. The service worker is the other half: it is the one part of the
 * system that watched a request actually fail, and this page asks it, on mount,
 * whether the page being read came off the network or off the disk.
 *
 * The alternative was Next 16's `useOffline` hook, which needs
 * `experimental.useOffline` — and that flag also changes what every Server
 * Action in the app does when a request fails, queueing and retrying it instead
 * of throwing. That is a decision about whether Land The Trick logs offline, and §2.3
 * says it does not: confirmed for launch by the owner on 2026-08-17, which is
 * why this bar tells a rider to wait rather than promising to catch up.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    // Ask the worker whether this very page came out of its cache. The reply
    // comes back down a channel created here, so nothing else on the origin can
    // answer for it.
    const worker = navigator.serviceWorker?.controller;
    if (!worker) return;

    const channel = new MessageChannel();
    channel.port1.onmessage = (event: MessageEvent<{ fromCache?: boolean }>) => {
      if (event.data?.fromCache) setFromCache(true);
    };
    worker.postMessage({ type: 'landit:served', path: window.location.pathname }, [channel.port2]);

    // The worker's answer describes the page as it was *loaded*. Signal coming
    // back is the one event that makes it out of date without a navigation, so
    // it clears here as well as flipping `online` above.
    const cleared = () => setFromCache(false);
    window.addEventListener('online', cleared);

    return () => {
      window.removeEventListener('online', cleared);
      channel.port1.close();
    };
  }, []);

  if (online && !fromCache) return null;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      {/* `bolt`, not a new glyph: the icon set is transcribed from the
          prototype path-for-path and drawing a signal icon to go in it would be
          the one shape in there nobody designed (`ui-web/src/icons.tsx`). */}
      <Icon name="bolt" size={17} strokeWidth={2.6} />
      <span>
        <strong className="cond">No signal.</strong> You can read your tricks. Logging waits until
        you are back.
      </span>
    </div>
  );
}
