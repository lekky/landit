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
 * A clip's declared `size` is what the cap is measured against, so it is taken
 * from the uploaded file rather than from whatever the client claimed.
 */
onRecordCreateRequest((e) => {
  const files = e.findUploadedFiles('file');
  if (files && files.length) {
    e.record.set('size', files[0].size);
  }
  if (!e.hasSuperuserAuth() && e.auth) e.record.set('user', e.auth.id);
  e.next();
}, 'clips');
