'use server';

import { attendEvent, isForbidden, listEvents, unattendEvent } from '@landit/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

/**
 * "I'm going", and taking it back.
 *
 * `event_attendance` is `OWN_AND_CONSENTED`: a rider waiting on a guardian's
 * approval may read and write their own tricks but may not appear anywhere
 * another person can see them, and an attendance row is exactly that (plan §3,
 * guarantee 4). The refusal is the collection rule's, not this file's — what
 * this does is turn the 403 into a sentence a child can read.
 *
 * Takes a **slug**, like every other action: a record id in a form value is a
 * record id in somebody's network tab.
 */

export interface AttendanceState {
  readonly going?: boolean;
  readonly error?: string;
}

export async function setAttendanceAction(slug: string, going: boolean): Promise<AttendanceState> {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);

  const { client, rider } = session;

  const events = await listEvents(client);
  const event = events.find((e) => e.slug === slug);
  if (!event) {
    return { error: 'We could not find that event. Reload the page and try again.' };
  }

  try {
    if (going) await attendEvent(client, rider.id, event.id);
    else await unattendEvent(client, rider.id, event.id);
  } catch (error) {
    if (isForbidden(error)) {
      return {
        error:
          'This account is waiting on a parent or guardian, so it cannot sign up for events yet.',
      };
    }
    return { error: 'We could not save that just now. Try again in a moment.' };
  }

  revalidatePath(ROUTES.events);
  return { going };
}
