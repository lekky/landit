import { isOwner } from './staff';

/**
 * Sessions are in preview: only the owner sees them (plan §7, T41 — Rachid,
 * 2026-09-13, in chat: "enable only for me now").
 *
 * Every web surface of session tracking asks this one function: the Sessions
 * tab, every `/progress/sessions` route, the spot/event/trick blocks, the
 * "Who sees new sessions" setting and the plans comparison.
 *
 * - **`LANDIT_SESSIONS_OPEN=1` opens them to everyone.** That is how the e2e
 *   server runs (its riders are made during the run and none is the owner), and
 *   it is how sessions are released: a value and a restart, not a code change.
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
  if ((process.env.LANDIT_SESSIONS_OPEN ?? '').trim() === '1') return !!rider;
  return isOwner(rider);
}
