/// <reference path="../.pb_data/types.d.ts" />

/**
 * Clips: guarantee 2's write half, plus the per-plan cap from §6.6.
 *
 * The read half is not here — it is the `clips` collection's owner-only rules
 * plus `protected: true` on the file field, which together mean bytes only ever
 * leave the server against a short-lived token minted for a request that still
 * has to satisfy the view rule.
 *
 * Model-level, so a server action holding a superuser client cannot skip the
 * cap either. T14 builds the upload flow on top of this.
 */
onRecordCreate((e) => {
  require(`${__hooks}/lib/landit.js`).enforceClipCap(e.app, e.record);
  e.next();
}, 'clips');

/**
 * Everything about a clip that the client does not get to decide.
 *
 * Four fields, and each of them is here for its own reason:
 *
 * - **`size`** is what the cap is measured against, so it is taken from the
 *   uploaded file rather than from whatever the client claimed. A client-set
 *   size is a client-set cap.
 * - **`user`** is the caller. Without this a rider could file a clip against
 *   somebody else's account — spending *their* vault, and putting a video into
 *   a row whose owner never uploaded it.
 * - **`kind`** decides whether the panel draws a play button or a photo, and it
 *   is read off the stored file's name rather than the body's `kind`, so the
 *   two cannot disagree. The mime allowlist on the field has already refused
 *   anything that is neither.
 * - **`at`** is the date on the tile. Server time, always: it is the only clock
 *   here that is not a rider's to set, and a "filmed on" a client could choose
 *   would be worth nothing on a moderation queue (plan §3, `reports` takes
 *   `clip` as a subject).
 *
 * Request-layer on purpose — a superuser tool restoring a clip legitimately
 * carries its own `user` and `at`. The *cap* is the thing that must hold on
 * every path, and that one is at the model layer above.
 */
onRecordCreateRequest((e) => {
  // `findUploadedFiles` **throws** when the request carries no multipart form
  // rather than returning nothing, and a hook that throws a non-API error comes
  // back as a bare 400 with "Something went wrong" — so before T14 every
  // JSON-bodied create on this collection failed with a message that named
  // neither the cause nor the field (LESSONS §3, the same generic 400 that hid
  // a scoping bug in `85_crews.pb.js`). Reading "no form" as "no files" is what
  // makes the refusal below the one a client actually gets.
  let files = null;
  try {
    files = e.findUploadedFiles('file');
  } catch {
    files = null;
  }

  if (files && files.length) {
    e.record.set('size', files[0].size);
    const name = String(files[0].originalName || files[0].name || '').toLowerCase();
    e.record.set('kind', /\.(jpe?g|png)$/.test(name) ? 'photo' : 'video');
  } else if (!e.hasSuperuserAuth()) {
    // A row with no file is not a clip: it spends no vault, plays nothing, and
    // would draw as a broken tile. Nothing in the product creates one, so this
    // takes away no behaviour a client has — it replaces an accidental refusal
    // (above) with a deliberate one. Superusers keep the path for restores and
    // for the tests that fill a vault without moving gigabytes; the *cap* still
    // holds on that path, because the cap is at the model layer.
    throw new BadRequestError('A clip needs a file.');
  }

  if (!e.hasSuperuserAuth() && e.auth) {
    e.record.set('user', e.auth.id);
    e.record.set('at', new DateTime().string());
  }
  e.next();
}, 'clips');
