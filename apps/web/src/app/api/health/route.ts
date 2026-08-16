import { checkHealth, HEALTH_DETAIL } from '@landit/db';
import { NextResponse } from 'next/server';

/**
 * `GET /api/health` — is this deployment able to do its job?
 *
 * Two checks, and the second is the one issue #62 is about: PocketBase answers,
 * and the superuser credentials this app holds are both **set** and **accepted**.
 * Without them "I rode today" tells the rider to try again in a moment, forever,
 * and nothing anywhere says why. This is where that becomes a red light.
 *
 * **503, not 200, when a check fails.** The point is to be noticed by something
 * that watches — Coolify's health check, Uptime Kuma (`docs/infrastructure.md`)
 * — and a monitor cannot read JSON, only a status code. The body is for whoever
 * the alert wakes up.
 *
 * **What it does not say.** Three states are worth distinguishing (`missing`,
 * `rejected`, `unreachable`) because each sends a different person to a
 * different place. The email, the password and the PocketBase URL are not among
 * them and are not in the response: this endpoint is reachable without
 * authentication, by design, so it carries the diagnosis and none of the
 * material.
 *
 * **Reachable while the holding page is up.** `src/proxy.ts` names it in
 * `ALWAYS_OPEN`; without that the gate would rewrite it to "Coming soon" and
 * answer 200, and a health check that is green because it is being served the
 * wrong page is worse than none.
 */

// Never prerendered, never cached. A health check answering from build time
// would report the state of a machine that no longer exists — which is the
// exact class of quiet lie this endpoint was added to end.
export const dynamic = 'force-dynamic';

export async function GET() {
  const report = await checkHealth();

  if (!report.ok) {
    // Into the container's logs, where an operator reading "why is the health
    // check red" will look first.
    console.error(
      `[health] not ok — pocketbase: ${report.pocketbase}, superuser: ${report.superuser}. ${HEALTH_DETAIL[report.superuser]}`,
    );
  }

  return NextResponse.json(
    {
      ok: report.ok,
      checks: { pocketbase: report.pocketbase, superuser: report.superuser },
      detail: report.ok ? undefined : HEALTH_DETAIL[report.superuser],
    },
    {
      status: report.ok ? 200 : 503,
      headers: { 'cache-control': 'no-store' },
    },
  );
}
