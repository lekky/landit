'use server';

import { clipUploadProblem, clipVault } from '@landit/core';
import {
  clipCapBytes,
  clipFileToken,
  clipFileUrl,
  clipVaultUsage,
  createBrowserClient,
  deleteClip,
  getClip,
  isForbidden,
  refusalMessage,
  uploadClip,
} from '@landit/db';
import { revalidatePath } from 'next/cache';

import { trickHref } from '@/lib/routes';
import { currentRider } from '@/lib/session';

/**
 * The three things a rider can do with a clip (T14).
 *
 * None of them is a permission check. The cap, the ownership and the consent
 * gate are all enforced in `pocketbase/hooks/50_clips.pb.js` and the `clips`
 * collection's owner-only rules, on every write path including a superuser one
 * (plan §3, guarantee 2; §6.6). What this file does with a refusal is translate
 * it into a sentence, exactly as `../actions.ts` does for the paywall.
 *
 * The client-side check in `uploadClipAction` is there for speed of feedback,
 * not for safety: it is the same pure function the panel calls before the file
 * leaves the browser, and the server re-decides regardless.
 */

export type ClipActionResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

export type ClipPlaybackResult =
  | { readonly ok: true; readonly url: string; readonly kind: 'video' | 'photo' }
  | { readonly ok: false; readonly message: string };

/** Save one clip against one trick. */
export async function uploadClipAction(form: FormData): Promise<ClipActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to save a clip.' };

  const file = form.get('file');
  const trickId = String(form.get('trickId') ?? '');
  const slug = String(form.get('slug') ?? '');
  if (!(file instanceof File) || !trickId) {
    return { ok: false, message: 'That did not upload. Pick the file again.' };
  }

  // Both numbers come from the server, never from the form: the cap off the
  // rider's plan record (staff-tunable, plan §6.6) and the usage off their own
  // rows. A client that under-reported either would still be refused by the
  // hook, but it would be refused *after* uploading the bytes.
  const [capBytes, usage] = await Promise.all([
    clipCapBytes(session.client, session.rider.plan),
    clipVaultUsage(session.client, session.rider.id),
  ]);
  const problem = clipUploadProblem(
    { size: file.size, type: file.type, name: file.name },
    clipVault({ usedBytes: usage.bytes, capBytes }),
  );
  if (problem) return { ok: false, message: problem };

  try {
    await uploadClip(session.client, {
      userId: session.rider.id,
      trickId,
      file,
      filename: file.name,
    });
  } catch (error) {
    if (isForbidden(error)) {
      // The hook writes a rider-readable sentence on every refusal it raises,
      // and throwing it away would make the cap unguessable (`refusalMessage`).
      return { ok: false, message: refusalMessage(error) ?? 'That clip could not be saved.' };
    }
    return { ok: false, message: 'That clip did not save. Try again in a moment.' };
  }

  if (slug) revalidatePath(trickHref(slug));
  return { ok: true };
}

/** Delete a clip. The space comes back with it — the cap is a sum of the rows that exist. */
export async function deleteClipAction(input: {
  clipId: string;
  slug: string;
}): Promise<ClipActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to manage your clips.' };

  try {
    await deleteClip(session.client, input.clipId);
  } catch {
    return { ok: false, message: 'That clip did not delete. Try again in a moment.' };
  }

  if (input.slug) revalidatePath(trickHref(input.slug));
  return { ok: true };
}

/**
 * Where one clip's bytes are, for the next couple of minutes.
 *
 * Guarantee 2's delivery half, and the reason this is an action rather than
 * something the page renders. A file token lives for minutes: a URL baked into
 * the HTML would be dead by the time a rider scrolled to it, and a page whose
 * *source* carries a working clip URL is a page somebody can paste. So the
 * token is minted once per press, for a request that has already had to satisfy
 * the owner-only view rule twice — once here, when `getClip` returns `null` for
 * anybody else's clip, and again inside PocketBase when the bytes are asked
 * for.
 *
 * The URL is built against the **public** PocketBase address, not the one this
 * server reads through: `POCKETBASE_URL` may be an internal name the browser
 * cannot resolve, and it is the browser that fetches these bytes.
 */
export async function clipPlaybackAction(clipId: string): Promise<ClipPlaybackResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to watch your clips.' };

  try {
    const clip = await getClip(session.client, clipId);
    if (!clip) return { ok: false, message: 'That clip is not there any more.' };

    const token = await clipFileToken(session.client);
    return { ok: true, url: clipFileUrl(createBrowserClient(), clip, token), kind: clip.kind };
  } catch {
    return { ok: false, message: 'That clip would not open. Try again in a moment.' };
  }
}
