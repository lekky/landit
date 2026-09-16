'use server';

import { markWhatsNewSeen } from '@landit/db';

import { currentRider } from '@/lib/session';

import { loadWhatsNewView } from './load';
import type { WhatsNewView } from './view';

/**
 * The two server calls What's new makes.
 *
 * Both take the **rider's own client**, so PocketBase's API rules are the gate
 * exactly as they are in the browser (plan §3). Neither reaches for the
 * superuser client, and neither takes a rider id from the caller: a signed-out
 * call reads nothing and writes nothing, and a call naming somebody else is not
 * a shape that exists here.
 */

/**
 * The panel's contents, for the desktop dropdown.
 *
 * Fetched **on open**, once, the way T45's sport menu fetches its counts and
 * for the reason that decision gives: the bell is in the top bar of every
 * screen, so loading a crew feed per crew on every page render would put
 * several reads on the dashboard, the library and every trick page to fill a
 * panel most page views never open. The phone does not use this — `/whats-new`
 * is a page and renders the same view on the server.
 */
export async function whatsNewViewAction(): Promise<WhatsNewView> {
  return loadWhatsNewView();
}

/**
 * Stamp `users.whats_new_seen_at` to now (rethink §3.6).
 *
 * Called when the panel opens and again when "Mark all read" is pressed. Both,
 * because the spec asks for both and they are not the same promise: opening is
 * the product noticing that the rider looked, and the button is the rider
 * saying so — which is the one a rider will reach for when the list is long and
 * they have skimmed it.
 *
 * It answers `false` rather than throwing when there is nobody signed in or the
 * write fails. Losing a bookmark costs a badge that shows again on the next
 * render; a throw here would surface as an error on whatever screen the panel
 * was opened from.
 */
export async function markWhatsNewSeenAction(): Promise<boolean> {
  const session = await currentRider();
  if (!session) return false;

  try {
    await markWhatsNewSeen(session.client, session.rider.id);
    return true;
  } catch {
    return false;
  }
}
