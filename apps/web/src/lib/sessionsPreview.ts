import { isOwner } from './staff';

/**
 * Sessions are in preview: only the owner sees them (plan §7, T41 — Rachid,
 * 2026-09-13, in chat: "enable only for me now").
 *
 * Every web surface of session tracking asks this one function: the Sessions
 * tab, every `/progress/sessions` route, the spot/event/trick blocks, Home's
 * "Log a session" (T43, added 2026-09-14), the "Who sees new sessions" setting
 * and the plans comparison.
 *
 * - **`LANDIT_SESSIONS_OPEN=1` opens them to everyone**, signed out included —
 *   exactly the behaviour T37–T40 shipped with: `/plans` shows its comparison to
 *   a visitor, a session URL sends a signed-out visitor to sign in, and the blocks
 *   still render nothing without a rider. That is how the e2e server runs (its
 *   riders are made during the run and none is the owner), and it is how sessions
 *   are released: a value and a restart, not a code change.
 * - **Otherwise it is `isOwner`**, which inherits that gate's two properties —
 *   read per request on the server (rotating `LANDIT_OWNER_ID` is a restart, not
 *   a rebuild), and **unset fails closed**, so a deploy nobody configured shows
 *   sessions to nobody rather than to everybody.
 *
 * The API is held separately, in `pocketbase/hooks/lib/session_rules.js`
 * (`sessionsPreviewAllows`, `LANDIT_SESSIONS_PREVIEW_ID`), because a hidden
 * screen does not stop a direct write to the collection.
 */
export function sessionsEnabledFor(rider: Parameters<typeof isOwner>[0]): boolean {
  if ((process.env.LANDIT_SESSIONS_OPEN ?? '').trim() === '1') return true;
  return isOwner(rider);
}

/**
 * The same question asked of a **viewer** — "is there somebody signed in, and
 * are sessions on for them" — which is the form every screen actually wants.
 *
 * It exists because the other form is easy to misuse in exactly one way, and
 * T52 misused it: `sessionsEnabledFor(session?.rider ?? null)` on the spot page
 * put a "Log here" button in front of a **signed-out visitor**, because the
 * first line above answers `true` for a `null` rider once the flag is set — and
 * the flag being set is how sessions are released. The blocks have always asked
 * both halves (`riderFor`: `viewer && sessionsEnabledFor(viewer.rider)`); this
 * is that expression, named, so a screen cannot write the shorter one by
 * accident.
 *
 * Sync and viewer-shaped rather than `riderFor`'s async lookup, so a server
 * component that already holds its session can ask without a second read.
 */
export function sessionsEnabledForViewer(
  viewer: { readonly rider: Parameters<typeof isOwner>[0] } | null | undefined,
): boolean {
  return viewer ? sessionsEnabledFor(viewer.rider) : false;
}
