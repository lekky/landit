'use client';

import { useEffect } from 'react';

/**
 * Installs the offline read cache, and tells it who is signed in.
 *
 * Mounted by `AppShell`, which is the frame around the product and nothing else
 * — so the worker is registered from inside the app and never from the holding
 * page, the landing page or a legal document. That placement is load-bearing:
 * while the pre-launch gate is shut every route renders `/coming-soon`, and a
 * worker registered from there would spend its life caching "Coming soon" as the
 * trick library.
 *
 * `rider` is the signed-in rider's own id, or nothing. It is not used to
 * identify anybody — the worker only ever compares it with the last one it saw,
 * and empties its page cache when the two differ. That is what makes signing out
 * on a shared phone take the cached screens with it, without every future
 * sign-out path having to remember the cache exists (`service-worker.ts`).
 */
export function ServiceWorkerRegistrar({ rider }: { rider?: string }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          // Bundled from source rather than served as a static file, so the
          // worker can import the cache policy from `@landit/core` instead of
          // keeping a second copy of it. The emitted URL carries a content
          // hash, which is also how a deploy gets riders onto the new worker.
          new URL('../../sw/service-worker.ts', import.meta.url),
          // `updateViaCache: 'none'` so the browser's HTTP cache can never be
          // the reason a rider is stuck on an old worker.
          { scope: '/', updateViaCache: 'none' },
        );

        // `ready` rather than the registration's own state: on a first visit the
        // worker is still installing, and there is nothing to post to until it
        // has activated and claimed this page.
        const active = (await navigator.serviceWorker.ready).active;
        if (cancelled) return;
        active?.postMessage({ type: 'landit:session', rider: rider ?? '' });

        void registration;
      } catch {
        // A worker that will not install is a rider without an offline cache,
        // which is the state every rider was in before this shipped. Nothing on
        // screen depends on it, so there is nothing to tell them.
      }
    };

    void register();

    return () => {
      cancelled = true;
    };
  }, [rider]);

  return null;
}
