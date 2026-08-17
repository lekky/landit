/// <reference path="../.pb_data/types.d.ts" />

/**
 * Video links (T15b) — guarantee 2's link half, enforced.
 *
 * Its own file rather than more lines in `60_ownership.pb.js`, on the same
 * reasoning `15_insights.pb.js` gives for itself: that file is about fields the
 * server decides instead of the client, and this one is about a **cap and a
 * grammar**, which are refusals rather than defaults. Keeping them apart means
 * neither is read as the other by the next session.
 *
 * Two layers, and the split is the whole design:
 *
 * - **The request hook** decides whose row it is and when it happened. It steps
 *   aside for a superuser token, because staff acting through a server action is
 *   a legitimate path (plan §3) and that client has no `e.auth` rider to read.
 * - **The model hooks** parse the link, normalise the visibility, freeze what
 *   must not move and count the cap. They have **no bypass at all**. A rule
 *   cannot count rows, and a request-layer check would leave the cap defeatable
 *   by our own server actions — the property T14's byte cap had, kept.
 *
 * Nothing here awards anything. `30_stickers.pb.js` still fires on `clips`
 * writes and `first-clip` ("Caught On Cam") is still `isLive: false` in
 * `@landit/core`, which `lib/stickers.js` skips — whether video links re-arm that
 * sticker is the owner's decision (issue #131), not a side effect of this file.
 */

/**
 * The row is the caller's, and it is dated by the server.
 *
 * `user` is set from the token rather than trusted from the body, so a rider
 * cannot add a video to somebody else's profile — the create rule would refuse
 * it anyway, and this makes the refusal unnecessary rather than relying on it.
 * `at` is set here because it is the ordering key on both surfaces: a
 * client-supplied timestamp would let a rider pin their own video to the top of
 * their own list forever, which is harmless, and would also let a clock skew
 * reorder a list for no reason, which is not.
 */
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth() && e.auth) e.record.set('user', e.auth.id);
  if (!e.record.getString('at')) e.record.set('at', new DateTime().string());
  e.next();
}, 'clips');

/**
 * A rider may change one thing about an existing link: who can see it. The
 * model hook below freezes everything else; this stops the request layer being
 * the place that has to know that.
 */
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const before = e.record.original();
    e.record.set('at', before.getString('at'));
  }
  e.next();
}, 'clips');

/** The parse, the default and the cap. No superuser bypass — see the file note. */
onRecordCreate((e) => {
  require(`${__hooks}/lib/landit.js`).enforceVideoLink(e.app, e.record, true);
  e.next();
}, 'clips');

/** The parse again, and the freeze. No superuser bypass, for the same reason. */
onRecordUpdate((e) => {
  require(`${__hooks}/lib/landit.js`).enforceVideoLink(e.app, e.record, false);
  e.next();
}, 'clips');
