import { assetLinkStatementsFromEnv } from '@/lib/androidApp';

/**
 * `GET /.well-known/assetlinks.json` — the site's half of the Android app's
 * domain handshake, served here and rewritten onto that path in
 * `next.config.ts`.
 *
 * **Why a route and not a file in `public/`.** The statement names a signing
 * certificate that does not exist yet and that no build session may hold, so it
 * cannot be committed (see `lib/androidApp.ts`). Reading it from the
 * environment per request means publishing the Play app is two Coolify values
 * and a restart — no rebuild, and no code change on the day it matters.
 *
 * **Why the path is a rewrite.** Next's router ignores directories beginning
 * with a dot, so `app/.well-known/…` is unreachable however it is spelled. The
 * rewrite is what puts this response on the exact path Android fetches; nothing
 * else may serve it, because Android does not follow redirects here and will
 * not look anywhere else.
 *
 * **404 while unconfigured** — every checkout, all of CI, and production until
 * there is an app — which is the honest answer: there is no Android app that
 * this domain vouches for. A placeholder would be a statement, and a wrong
 * statement fails as quietly as a right one works.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  const statements = assetLinkStatementsFromEnv();
  if (!statements) return new Response('Not found', { status: 404 });

  return Response.json(statements, {
    headers: {
      /**
       * Android re-checks this periodically and caches it in between, and a
       * fingerprint changes only when a signing key does — so an hour is long
       * enough to spare the box the traffic and short enough that fixing a
       * wrong value is not a day of riders seeing a URL bar.
       *
       * `public` because there is nothing private here: the file is a public
       * assertion about a public app, and Android fetches it without a session.
       */
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
