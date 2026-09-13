'use server';

import type { StageId, VideoVisibilityId } from '@landit/core';
import {
  addTrickNote,
  addVideoLink,
  clearTrickHistory,
  clearTrickStage,
  deleteTrickNote,
  isForbidden,
  removeVideoLink,
  saveTrickNote,
  setTrickStage,
  setVideoLinkVisibility,
  updateTrickNote,
} from '@landit/db';
import { revalidatePath } from 'next/cache';

import { ROUTES, trickHref } from '@/lib/routes';
import { currentRider } from '@/lib/session';
import { unseenStickers, type StickerToast } from '@/lib/stickers';

/**
 * The two writes the trick page makes.
 *
 * Neither of them checks the paywall, and that is deliberate. The
 * `trick_progress` hook refuses a paid trick to a rookie on every write path
 * including this one (plan §3, guarantee 3), so a check here would be a second,
 * weaker copy of it — and the copy that goes stale. What this file does with a
 * refusal is *translate* it: a 403 becomes a sentence a fourteen year old can
 * read, rather than a stack trace or a silent no-op.
 */

export type StageActionResult =
  | {
      readonly ok: true;
      /**
       * Stickers the award hook created on this write and the rider has never
       * been shown. Empty on almost every save, which is the point — landing a
       * trick is ordinary and earning a sticker is not (T10).
       */
      readonly earned?: readonly StickerToast[];
    }
  | { readonly ok: false; readonly message: string };

/**
 * Set — or clear — the rider's stage on one trick.
 *
 * Clearing removes the progress row and leaves the log alone, which is
 * `clearTrickStage`'s documented behaviour: untracking a trick is not a claim
 * that it was never landed, and the rider's history is theirs to delete
 * separately (plan §3, "log semantics, reconciled").
 */
export async function setStageAction(input: {
  trickId: string;
  slug: string;
  stage: StageId | null;
}): Promise<StageActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to keep track of this one.' };

  try {
    if (input.stage === null) {
      await clearTrickStage(session.client, session.rider.id, input.trickId);
    } else {
      await setTrickStage(session.client, {
        userId: session.rider.id,
        trickId: input.trickId,
        stage: input.stage,
      });
    }
  } catch (error) {
    if (isForbidden(error)) {
      return {
        ok: false,
        message: 'This one is on the Shredder plan, so it cannot be tracked yet.',
      };
    }
    return { ok: false, message: 'That did not save. Try again in a moment.' };
  }

  // Read *after* the write, because the award hook runs inside it: the
  // `trick_progress` create/update succeeds, `30_stickers.pb.js` re-evaluates
  // every rule against fresh stats, and any `rider_stickers` rows it created
  // are already there. Nothing is computed here — asking the client which
  // stickers it thinks it earned is exactly the forgery the hook exists to
  // stop (plan §3).
  const earned = await unseenStickers(session.client, session.rider.id);

  revalidatePath(trickHref(input.slug));
  revalidatePath(ROUTES.library);
  revalidatePath(ROUTES.stickers);
  // T22: the dashboard's "Working on it" can now set a stage without opening
  // the trick, so it is a caller of this action and has to be refreshed like
  // any other. The picker corrects itself optimistically; this is what stops
  // the *rest* of the screen — the counts, the "all N of yours" link, which
  // tricks are in the section at all — disagreeing with it until the next load.
  revalidatePath(ROUTES.dashboard);
  // And the progress screen, which is built from `trick_progress` by the same
  // `trickProgressById` the library uses. It was the one reader of this row
  // never told the row had moved, so a rider who stopped tracking a trick found
  // it still counted there — which reads as the write not having saved.
  revalidatePath(ROUTES.progress);
  return { ok: true, earned };
}

export type ClearHistoryActionResult =
  | { readonly ok: true; readonly cleared: number }
  | { readonly ok: false; readonly message: string };

/**
 * Wipe the rider's whole history with one trick — the reset, not the untrack.
 *
 * `setStageAction(null)` above stops tracking and keeps everything: the log
 * rows, the first-landed date, the badge. That is the right default and it did
 * not move. This is the other answer, for a rider who tapped a stage by mistake
 * or was messing about and wants the trick back to how it was before they
 * touched it — offered from the history panel once they have already stopped
 * tracking, behind a confirm that says the badge goes (Rachid, 2026-09-13, in
 * chat).
 *
 * It clears the stage as well as the log, and in that order. The screen only
 * offers this on an untracked trick, so `clearTrickStage` finds no progress row
 * and does nothing — it is here so the *action* lands a trick in one known
 * state rather than trusting a caller to have stopped tracking first, and so
 * the hook below never judges a rider who is still on the ladder.
 *
 * **The badge is not taken here, and it is not taken by the rider's client
 * either.** `rider_stickers` is `deleteRule: null`, so the only writer is the
 * server: `30_stickers.pb.js` re-judges what the rider holds when the last log
 * row goes, against stats recomputed from the database. Asking this action
 * which stickers should go would be the mirror image of the forgery the hook
 * exists to stop (plan §3).
 */
export async function clearTrickHistoryAction(input: {
  trickId: string;
  slug: string;
}): Promise<ClearHistoryActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to change what you are tracking.' };

  let cleared = 0;
  try {
    // Stage first, log second: the hook keys the sticker re-judgement off the
    // last log row going, so the progress row has to be gone by then or the
    // pass would judge a rider who is still tracking the trick.
    await clearTrickStage(session.client, session.rider.id, input.trickId);
    cleared = await clearTrickHistory(session.client, session.rider.id, input.trickId);
  } catch (error) {
    if (isForbidden(error)) {
      return { ok: false, message: 'That is not yours to clear.' };
    }
    return { ok: false, message: 'That did not clear. Try again in a moment.' };
  }

  revalidatePath(trickHref(input.slug));
  revalidatePath(ROUTES.library);
  // The screens built from the log rather than from `trick_progress`: the
  // months, the latest lands and the sticker wall, which may have just lost a
  // badge. A rider who resets a trick and still sees it counted on Progress has
  // been told the reset worked and shown that it did not.
  revalidatePath(ROUTES.progress);
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.stickers);
  return { ok: true, cleared };
}

/* ----------------------------------------------------------- video links -- */

export type VideoLinkActionResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * Add a video link to one trick (T15b, plan §6.6).
 *
 * **Nothing is validated here and nothing is capped here**, on exactly the same
 * reasoning the two actions above do not check the paywall.
 * `pocketbase/hooks/45_video_links.pb.js` parses the link and counts the
 * allowance at the model layer, so a check in this file would be a second,
 * weaker copy of both — and the copy that goes stale the day the cap moves. What
 * this does with a refusal is *translate* it: the hook's 400 and its two 403s
 * become sentences a fourteen year old can read.
 *
 * The raw paste is what travels. `VideosPanel` runs `parseYouTubeVideoId` before
 * calling this, purely so a wrong link is refused without a round trip; the
 * value sent is still what the rider typed, and the id that gets stored is the
 * one the server parsed.
 */
export async function addVideoLinkAction(input: {
  trickId: string;
  slug: string;
  link: string;
  visibility: VideoVisibilityId;
}): Promise<VideoLinkActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to add a video.' };

  try {
    await addVideoLink(session.client, {
      userId: session.rider.id,
      link: input.link,
      trickId: input.trickId,
      visibility: input.visibility,
    });
  } catch (error) {
    // The hook's own message is the useful one here — it distinguishes "that is
    // not a YouTube link" from "that is all ten of your video links", and the
    // rider needs to know which. Passed through when it is one of ours and
    // replaced when it is not, so a stack trace never reaches a screen.
    const message = refusalMessage(error);
    return { ok: false, message };
  }

  revalidatePath(trickHref(input.slug));
  return { ok: true };
}

/** Change who can see one video. The only thing about a link that moves. */
export async function setVideoLinkVisibilityAction(input: {
  videoLinkId: string;
  slug: string;
  visibility: VideoVisibilityId;
}): Promise<VideoLinkActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to change that.' };

  try {
    await setVideoLinkVisibility(session.client, input.videoLinkId, input.visibility);
  } catch (error) {
    return { ok: false, message: refusalMessage(error) };
  }

  revalidatePath(trickHref(input.slug));
  return { ok: true };
}

/** Remove a video link. The video stays on YouTube; only our row goes. */
export async function removeVideoLinkAction(input: {
  videoLinkId: string;
  slug: string;
}): Promise<VideoLinkActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to remove that.' };

  try {
    await removeVideoLink(session.client, input.videoLinkId);
  } catch (error) {
    return { ok: false, message: refusalMessage(error) };
  }

  revalidatePath(trickHref(input.slug));
  return { ok: true };
}

/**
 * The hook's refusal, or a sentence when it was not one.
 *
 * PocketBase puts a hook's `ForbiddenError`/`BadRequestError` message on
 * `error.response.message`. Only a short, printable string is passed through —
 * anything else becomes the generic line, so a stack trace or an internal path
 * cannot reach a rider's screen through this door.
 */
function refusalMessage(error: unknown): string {
  const response = (error as { response?: { message?: unknown } } | null)?.response;
  const message = typeof response?.message === 'string' ? response.message.trim() : '';
  if (message && message.length <= 200 && !message.includes('\n')) {
    // PocketBase's own generic wrapper says nothing a rider can act on.
    if (!/^failed to (create|update|delete) record/i.test(message)) return message;
  }
  return isForbidden(error)
    ? 'That is not allowed on your plan.'
    : 'That did not save. Check the link and try again.';
}

/* ----------------------------------------------------------------- notes -- */

/**
 * The log's three writes (T30). Each is a rider writing to themselves — the
 * single most private thing in the product (plan §6.1) — and each is enforced
 * where the video-link writes above are: `47_trick_notes.pb.js` counts the cap,
 * checks the stage and freezes the row's owner, and this file only translates a
 * refusal into a sentence. The hook's own message is passed through when it is
 * one of ours, exactly as `refusalMessage` does for video links, because "that
 * is 50 notes on this trick" is the thing the rider needs to hear.
 */

export type NoteActionResult =
  | {
      readonly ok: true;
      /** The row as stored — its id and server date are what the list shows. */
      readonly note: { readonly id: string; readonly created: string };
    }
  | { readonly ok: false; readonly message: string };

/**
 * Add a note. `stage` is whatever the rider's ladder says right now, or `null`
 * for a trick they are not tracking; it is stamped on the note and never moves.
 */
export async function addNoteAction(input: {
  trickId: string;
  slug: string;
  body: string;
  stage: StageId | null;
}): Promise<NoteActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to keep notes.' };

  let note;
  try {
    note = await addTrickNote(session.client, {
      userId: session.rider.id,
      trickId: input.trickId,
      body: input.body,
      stage: input.stage,
    });
  } catch (error) {
    return { ok: false, message: noteRefusalMessage(error) };
  }

  revalidatePath(trickHref(input.slug));
  return { ok: true, note: { id: note.id, created: note.created } };
}

/** Reword one note. The date and the stage stamp stay as they were. */
export async function updateNoteAction(input: {
  noteId: string;
  slug: string;
  body: string;
}): Promise<NoteActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to keep notes.' };

  let note;
  try {
    note = await updateTrickNote(session.client, input.noteId, input.body);
  } catch (error) {
    return { ok: false, message: noteRefusalMessage(error) };
  }

  revalidatePath(trickHref(input.slug));
  return { ok: true, note: { id: note.id, created: note.created } };
}

/** Remove one note. There is no bin to get it back from, and the panel says so. */
export async function removeNoteAction(input: {
  noteId: string;
  slug: string;
}): Promise<VideoLinkActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to keep notes.' };

  try {
    await deleteTrickNote(session.client, input.noteId);
  } catch (error) {
    return { ok: false, message: noteRefusalMessage(error) };
  }

  revalidatePath(trickHref(input.slug));
  return { ok: true };
}

/** `refusalMessage`, with the generic line worded for a note rather than a link. */
function noteRefusalMessage(error: unknown): string {
  const message = refusalMessage(error);
  return message === 'That did not save. Check the link and try again.'
    ? 'That note did not save. Try again in a moment.'
    : message;
}

/**
 * The pre-T30 write, kept for its callers (additive-only): rewords the newest
 * note or starts the log. Nothing on the trick page calls it since the log
 * panel landed; `LogPanel` uses the three actions above.
 */
export async function saveNoteAction(input: {
  trickId: string;
  slug: string;
  body: string;
}): Promise<StageActionResult> {
  const session = await currentRider();
  if (!session) return { ok: false, message: 'Sign in to keep notes.' };

  try {
    await saveTrickNote(session.client, {
      userId: session.rider.id,
      trickId: input.trickId,
      body: input.body,
    });
  } catch {
    return { ok: false, message: 'That note did not save. Try again in a moment.' };
  }

  revalidatePath(trickHref(input.slug));
  return { ok: true };
}
