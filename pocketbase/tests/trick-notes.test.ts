import { beforeAll, describe, expect, it } from 'vitest';

import { baseFixtures, call, makeRider, superuser, type Rider } from './helpers';

/**
 * Session notes as a log (T30, `1788652800_trick_notes_log.js` and
 * `47_trick_notes.pb.js`).
 *
 * Until 2026-09-07 a rider held **one** note per trick, and the schema said so
 * with a unique index. Now they hold a dated list, and three new things are
 * true of the collection that a rule cannot express — so all three are asserted
 * here as observed API behaviour (LESSONS §5), and two of them are also driven
 * through a **superuser** token, which is the only way to tell a model-layer
 * refusal from a request-layer one:
 *
 * 1. **Many per trick.** Two notes on one trick from one rider both land, and
 *    both come back. The old index would have refused the second with a 400.
 * 2. **The stage vocabulary.** `stage` is one of the five ids or nothing. A
 *    made-up stage is refused on the request path *and* on the model path.
 * 3. **The cap.** Fifty per rider per trick, counted server-side. The
 *    fifty-first is refused with a 403 for the rider and for a superuser acting
 *    for them, and a different trick is unaffected — the cap is per pair, not
 *    per rider.
 *
 * Plus the freeze: a note may be reworded and deleted, never moved to another
 * rider or trick. And the guarantee that did **not** move — a note is private
 * at every privacy setting — is still `guarantee-1-privacy.test.ts`'s to prove;
 * nothing here re-tests it and nothing here loosened it.
 */

interface NoteRow {
  id: string;
  user: string;
  trick: string;
  body: string;
  stage: string;
  created: string;
}

interface ListBody {
  items: NoteRow[];
  totalItems: number;
}

/** POST a note as a rider, the way the app does. */
function addNote(
  rider: Rider,
  body: Record<string, unknown>,
): Promise<{ status: number; body: NoteRow }> {
  return call<NoteRow>('POST', '/api/collections/trick_notes/records', {
    token: rider.token,
    body: { user: rider.id, ...body },
  });
}

function listNotes(rider: Rider, trick: string): Promise<{ status: number; body: ListBody }> {
  return call<ListBody>('GET', '/api/collections/trick_notes/records', {
    token: rider.token,
    query: { perPage: '200', filter: `user='${rider.id}' && trick='${trick}'`, sort: '-created' },
  });
}

describe('trick_notes — a dated log, not a single row', () => {
  let trick: string;
  let otherTrick: string;
  let rider: Rider;

  beforeAll(async () => {
    const fixtures = await baseFixtures();
    trick = fixtures.freeTrick;
    otherTrick = fixtures.freeTrickSkate;
    rider = await makeRider({}, { consent_state: 'not_required' });
  });

  // -------------------------------------------------------- many per trick --

  it('keeps two notes on one trick from one rider, and lists both', async () => {
    const first = await addNote(rider, { trick, body: 'Deck only gets halfway.', stage: 'trying' });
    const second = await addNote(rider, { trick, body: 'Landed one off the kerb.', stage: 'some' });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(second.status, JSON.stringify(second.body)).toBe(200);

    const listed = await listNotes(rider, trick);
    expect(listed.status).toBe(200);
    expect(listed.body.items.map((row) => row.id)).toEqual(
      expect.arrayContaining([first.body.id, second.body.id]),
    );
    expect(listed.body.items.find((row) => row.id === first.body.id)?.stage).toBe('trying');
    expect(listed.body.items.find((row) => row.id === second.body.id)?.stage).toBe('some');
  });

  it('accepts a note with no stage — the shape every pre-T30 note has', async () => {
    const bare = await addNote(rider, { trick, body: 'Written before there were stages.' });
    expect(bare.status, JSON.stringify(bare.body)).toBe(200);
    expect(bare.body.stage).toBe('');
  });

  // ------------------------------------------------------------ the stage --

  it('refuses a stage that is not one of the five, from a rider', async () => {
    const wrong = await addNote(rider, { trick, body: 'x', stage: 'flying' });
    expect(wrong.status).toBe(400);
  });

  it('refuses a stage that is not one of the five, from a superuser', async () => {
    // The select field would refuse this on the request path anyway; a
    // superuser going through the same door proves the model hook does too.
    const token = await superuser();
    const wrong = await call('POST', '/api/collections/trick_notes/records', {
      token,
      body: { user: rider.id, trick, body: 'x', stage: 'flying' },
    });
    expect(wrong.status).toBe(400);
  });

  // ------------------------------------------------------------- the body --

  it('refuses a body over 2000 characters with a sentence, not a blob', async () => {
    const long = await addNote(rider, { trick, body: 'a'.repeat(2001) });
    expect(long.status).toBe(400);
    // Either the field's own validator or the hook may answer first; both are
    // 400 and both stop the row. What matters is that it did not land.
    const listed = await listNotes(rider, trick);
    expect(listed.body.items.some((row) => row.body.length > 2000)).toBe(false);
  });

  // ----------------------------------------------------------- the freeze --

  it('lets a rider reword a note, and re-stage it', async () => {
    const note = await addNote(rider, { trick, body: 'first draft', stage: 'trying' });
    expect(note.status).toBe(200);

    const edited = await call<NoteRow>(
      'PATCH',
      `/api/collections/trick_notes/records/${note.body.id}`,
      { token: rider.token, body: { body: 'second draft', stage: 'some' } },
    );
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);
    expect(edited.body.body).toBe('second draft');
    expect(edited.body.stage).toBe('some');
  });

  it('refuses to move a note to another trick, even for a superuser', async () => {
    const note = await addNote(rider, { trick, body: 'stays put' });
    expect(note.status).toBe(200);

    const token = await superuser();
    const moved = await call('PATCH', `/api/collections/trick_notes/records/${note.body.id}`, {
      token,
      body: { trick: otherTrick },
    });
    expect(moved.status).toBe(403);
  });

  it('refuses to move a note to another rider, even for a superuser', async () => {
    const note = await addNote(rider, { trick, body: 'mine' });
    const someoneElse = await makeRider({}, { consent_state: 'not_required' });

    const token = await superuser();
    const moved = await call('PATCH', `/api/collections/trick_notes/records/${note.body.id}`, {
      token,
      body: { user: someoneElse.id },
    });
    expect(moved.status).toBe(403);
  });

  // -------------------------------------------------------------- the cap --

  describe('the cap', () => {
    let full: Rider;

    beforeAll(async () => {
      full = await makeRider({}, { consent_state: 'not_required' });
      // Fill exactly to the cap, one at a time, as a rider would. Fifty writes
      // is a few seconds against the local binary and is the honest way to
      // reach the wall — a fixture that shrank the cap would test the fixture.
      for (let i = 0; i < 50; i += 1) {
        const added = await addNote(full, { trick, body: `note ${i + 1}` });
        expect(added.status, `note ${i + 1}: ${JSON.stringify(added.body)}`).toBe(200);
      }
    });

    it('holds fifty', async () => {
      const listed = await listNotes(full, trick);
      expect(listed.body.totalItems).toBe(50);
    });

    it('refuses the fifty-first to the rider, with a sentence', async () => {
      const over = await addNote(full, { trick, body: 'one too many' });
      expect(over.status).toBe(403);
      expect(String((over.body as unknown as { message?: string }).message)).toMatch(/50 notes/);
    });

    it('refuses the fifty-first to a superuser acting for the rider', async () => {
      const token = await superuser();
      const over = await call('POST', '/api/collections/trick_notes/records', {
        token,
        body: { user: full.id, trick, body: 'one too many' },
      });
      expect(over.status).toBe(403);
    });

    it('counts per trick — another trick still has room', async () => {
      const elsewhere = await addNote(full, { trick: otherTrick, body: 'a different trick' });
      expect(elsewhere.status, JSON.stringify(elsewhere.body)).toBe(200);
    });

    it('frees a slot when one is removed', async () => {
      const listed = await listNotes(full, trick);
      const victim = listed.body.items[0]!;
      const gone = await call('DELETE', `/api/collections/trick_notes/records/${victim.id}`, {
        token: full.token,
      });
      expect(gone.status).toBe(204);

      const again = await addNote(full, { trick, body: 'back to fifty' });
      expect(again.status, JSON.stringify(again.body)).toBe(200);
    });
  });
});
