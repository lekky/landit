import { createHash, randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

import { call, makeRider, superuser, type Rider } from './helpers';

/**
 * The guardian-consent flow (T6, plan §6.2), over HTTP.
 *
 * Guarantee 4 — what a `pending` account is refused — is proved next door in
 * `guarantee-4-consent.test.ts` and is not repeated here. This file proves the
 * three things T6 adds around that gate, each of which is a way the gate could
 * be true and useless:
 *
 *  - an account is **put** behind it by the server, not by the client asking
 *    nicely;
 *  - a guardian, who has no account, can **let it out** and put it back;
 *  - it **lapses** on the rider's own birthday with nobody doing anything.
 *
 * The tokens are never returned by the API, so the redemption tests mint their
 * own: a consent record is written server-side with the hash of a token this
 * file knows, which is exactly the shape the route produces. Anything else would
 * be testing a debug backdoor rather than the flow.
 */

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const token = () => randomBytes(24).toString('hex');

/** A consent record with a token this file knows the plaintext of. */
async function craftConsent(
  rider: Rider,
  fields: Record<string, unknown> = {},
): Promise<{ id: string; approval: string; revocation: string }> {
  const approval = token();
  const revocation = token();
  const created = await call<{ id: string }>('POST', '/api/collections/guardian_consents/records', {
    token: await superuser(),
    body: {
      user: rider.id,
      guardian_email: 'guardian@landit.invalid',
      method: 'email_approval',
      requested: new Date().toISOString().replace('T', ' '),
      approval_token_hash: sha256(approval),
      revocation_token_hash: sha256(revocation),
      approval_expires: new Date(Date.now() + 86_400_000).toISOString().replace('T', ' '),
      ...fields,
    },
  });
  if (created.status !== 200) throw new Error(`craft failed: ${JSON.stringify(created)}`);
  return { id: created.body.id, approval, revocation };
}

const consentStateOf = async (rider: Rider): Promise<string> => {
  const seen = await call<{ consent_state: string }>(
    'GET',
    `/api/collections/users/records/${rider.id}`,
    { token: await superuser() },
  );
  return seen.body.consent_state;
};

/** Sign up straight against the API, the way the browser will. */
async function signUp(fields: Record<string, unknown>) {
  const suffix = randomBytes(5).toString('hex');
  const password = 'a-long-local-test-password';
  return call<{ id: string; message?: string }>('POST', '/api/collections/users/records', {
    body: {
      email: `signup-${suffix}@landit.invalid`,
      password,
      passwordConfirm: password,
      name: `Signup ${suffix}`,
      handle: `signup${suffix}`,
      ...fields,
    },
  });
}

describe('the server decides what a sign-up means (plan §6.2)', () => {
  it('refuses a sign-up that declares no age at all', async () => {
    // The hole this closes: a client that simply left the fields out would land
    // as `not_required`, and every refusal in guarantee 4 reads that field. An
    // undeclared age is not an adult.
    const missing = await signUp({});
    expect(missing.status).toBe(400);

    const noCountry = await signUp({ age_band: 'under_13' });
    expect(noCountry.status).toBe(400);

    const nonsense = await signUp({ age_band: 'grown_up', country: 'GB' });
    expect(nonsense.status).toBe(400);
  });

  it('holds a UK under-13 at pending, whatever the client claimed', async () => {
    const created = await signUp({
      age_band: 'under_13',
      country: 'GB',
      band_next_change_on: '2030-04-02 00:00:00.000Z',
      consent_state: 'granted', // smuggled, and ignored
    });
    expect(created.status).toBe(200);

    const seen = await call<{ consent_state: string }>(
      'GET',
      `/api/collections/users/records/${created.body.id}`,
      { token: await superuser() },
    );
    expect(seen.body.consent_state).toBe('pending');
  });

  it('holds a 13-to-15 rider in the EEA, where the threshold is 16', async () => {
    const german = await signUp({ age_band: '13_15', country: 'DE' });
    expect(german.status).toBe(200);
    const seen = await call<{ consent_state: string }>(
      'GET',
      `/api/collections/users/records/${german.body.id}`,
      { token: await superuser() },
    );
    expect(seen.body.consent_state).toBe('pending');
  });

  it('lets a 13-to-15 rider in the UK straight through', async () => {
    const uk = await signUp({ age_band: '13_15', country: 'GB' });
    const seen = await call<{ consent_state: string }>(
      'GET',
      `/api/collections/users/records/${uk.body.id}`,
      { token: await superuser() },
    );
    expect(seen.body.consent_state).toBe('not_required');
  });

  it('declines a US under-13 with a reason, and creates nothing', async () => {
    const declined = await signUp({ age_band: 'under_13', country: 'US' });
    expect(declined.status).toBe(400);
    expect(JSON.stringify(declined.body)).toMatch(/United States/);

    // The refusal is that one case: 13 in the US signs up like anyone else.
    const older = await signUp({ age_band: '13_15', country: 'US' });
    expect(older.status).toBe(200);
  });

  it('takes an ISO-3166-2 country the same way as a bare code', async () => {
    const scotland = await signUp({ age_band: 'under_13', country: 'GB-SCT' });
    expect(scotland.status).toBe(200);
    const seen = await call<{ consent_state: string }>(
      'GET',
      `/api/collections/users/records/${scotland.body.id}`,
      { token: await superuser() },
    );
    expect(seen.body.consent_state).toBe('pending');
  });
});

describe('asking a guardian', () => {
  let pending: Rider;

  beforeAll(async () => {
    pending = await makeRider({ age_band: 'under_13', country: 'GB' });
  });

  it('writes the evidence record and hands the rider no token', async () => {
    const asked = await call<Record<string, unknown>>('POST', '/api/landit/consent/request', {
      token: pending.token,
      body: { guardian_email: 'A.Guardian@Example.com' },
    });
    expect(asked.status).toBe(200);
    expect(asked.body.guardian_email).toBe('a.guardian@example.com');
    // Resend is not provisioned (docs/infrastructure.md), so this says false
    // locally rather than pretending an email went out.
    expect(asked.body).toHaveProperty('emailed');

    // The rider is told nothing that would let them approve themselves.
    const returned = JSON.stringify(asked.body);
    expect(returned).not.toMatch(/token/i);

    const rows = await call<{ items: { guardian_email: string; requested: string }[] }>(
      'GET',
      '/api/collections/guardian_consents/records',
      { token: await superuser(), query: { filter: `user = "${pending.id}"` } },
    );
    expect(rows.body.items).toHaveLength(1);
    expect(rows.body.items[0]!.guardian_email).toBe('a.guardian@example.com');
    expect(rows.body.items[0]!.requested).not.toBe('');
  });

  it('keeps every request, because the record is the evidence', async () => {
    await call('POST', '/api/landit/consent/request', {
      token: pending.token,
      body: { guardian_email: 'second.guardian@example.com' },
    });
    const rows = await call<{ items: unknown[] }>(
      'GET',
      '/api/collections/guardian_consents/records',
      { token: await superuser(), query: { filter: `user = "${pending.id}"` } },
    );
    // Asking again writes a new row rather than editing the last one.
    expect(rows.body.items.length).toBe(2);
  });

  it('refuses an address that is not one, and the rider’s own', async () => {
    const bad = await call('POST', '/api/landit/consent/request', {
      token: pending.token,
      body: { guardian_email: 'not-an-email' },
    });
    expect(bad.status).toBe(400);

    const self = await call('POST', '/api/landit/consent/request', {
      token: pending.token,
      body: { guardian_email: pending.email },
    });
    expect(self.status).toBe(400);
  });

  it('has nothing to ask when the account is not behind the gate', async () => {
    const adult = await makeRider();
    const asked = await call('POST', '/api/landit/consent/request', {
      token: adult.token,
      body: { guardian_email: 'guardian@example.com' },
    });
    expect(asked.status).toBe(400);
  });

  it('is not something a signed-out visitor can do', async () => {
    const anonymous = await call('POST', '/api/landit/consent/request', {
      body: { guardian_email: 'guardian@example.com' },
    });
    expect([401, 403]).toContain(anonymous.status);
  });
});

describe('a guardian with no account approves', () => {
  it('lets the rider out of the gate, and the gate is the same one', async () => {
    const rider = await makeRider({ age_band: 'under_13', country: 'GB' });
    expect(await consentStateOf(rider)).toBe('pending');

    // Refused before: the guarantee-4 gate, unchanged.
    const before = await call('POST', '/api/collections/spots/records', {
      token: rider.token,
      body: { name: 'Before Consent', town: 'Leeds' },
    });
    expect(before.status).toBe(400);

    const crafted = await craftConsent(rider);
    const approved = await call<{ state: string; rider_name: string }>(
      'POST',
      '/api/landit/consent/approve',
      { body: { token: crafted.approval } },
    );
    expect(approved.status).toBe(200);
    expect(approved.body.state).toBe('granted');
    expect(await consentStateOf(rider)).toBe('granted');

    // ...and allowed after. Nothing in this flow re-implements the refusal; it
    // writes the one field the refusal reads.
    const after = await call('POST', '/api/collections/spots/records', {
      token: rider.token,
      body: { name: 'After Consent', town: 'Leeds' },
    });
    expect(after.status).toBe(200);
  });

  it('is idempotent — a link clicked twice is not an error', async () => {
    const rider = await makeRider({ age_band: 'under_13', country: 'GB' });
    const crafted = await craftConsent(rider);

    const once = await call('POST', '/api/landit/consent/approve', {
      body: { token: crafted.approval },
    });
    const twice = await call('POST', '/api/landit/consent/approve', {
      body: { token: crafted.approval },
    });
    expect(once.status).toBe(200);
    expect(twice.status).toBe(200);
    expect(await consentStateOf(rider)).toBe('granted');
  });

  it('refuses a link that has run out, and says a fresh one can be sent', async () => {
    const rider = await makeRider({ age_band: 'under_13', country: 'GB' });
    const crafted = await craftConsent(rider, {
      approval_expires: new Date(Date.now() - 86_400_000).toISOString().replace('T', ' '),
    });

    const approved = await call('POST', '/api/landit/consent/approve', {
      body: { token: crafted.approval },
    });
    expect(approved.status).toBe(400);
    expect(JSON.stringify(approved.body)).toMatch(/fresh one/i);
    expect(await consentStateOf(rider)).toBe('pending');
  });

  it('refuses a token nobody minted, and tells it nothing apart', async () => {
    const unknown = await call<{ message: string }>('POST', '/api/landit/consent/approve', {
      body: { token: token() },
    });
    const empty = await call<{ message: string }>('POST', '/api/landit/consent/approve', {
      body: { token: '' },
    });
    expect(unknown.status).toBe(400);
    expect(empty.status).toBe(400);
    expect(unknown.body.message).toBe(empty.body.message);
  });

  it('will not let the revocation link approve, or the approval link revoke', async () => {
    const rider = await makeRider({ age_band: 'under_13', country: 'GB' });
    const crafted = await craftConsent(rider);

    const wrongWay = await call('POST', '/api/landit/consent/approve', {
      body: { token: crafted.revocation },
    });
    expect(wrongWay.status).toBe(400);
    expect(await consentStateOf(rider)).toBe('pending');

    const otherWay = await call('POST', '/api/landit/consent/revoke', {
      body: { token: crafted.approval },
    });
    expect(otherWay.status).toBe(400);
    expect(await consentStateOf(rider)).toBe('pending');
  });
});

describe('a guardian changes their mind', () => {
  it('revokes, keeps the record, and keeps the rider’s tricks', async () => {
    const rider = await makeRider({ age_band: 'under_13', country: 'GB' });
    const crafted = await craftConsent(rider);
    await call('POST', '/api/landit/consent/approve', { body: { token: crafted.approval } });

    const revoked = await call<{ state: string }>('POST', '/api/landit/consent/revoke', {
      body: { token: crafted.revocation },
    });
    expect(revoked.status).toBe(200);
    expect(await consentStateOf(rider)).toBe('revoked');

    // Revocation is a state, not a delete: the evidence survives, with both
    // timestamps on it.
    const row = await call<{ granted: string; revoked: string }>(
      'GET',
      `/api/collections/guardian_consents/records/${crafted.id}`,
      { token: await superuser() },
    );
    expect(row.body.granted).not.toBe('');
    expect(row.body.revoked).not.toBe('');

    // The rider can still log tricks — that never depended on a guardian.
    const stillMine = await call<{ items: unknown[] }>('GET', '/api/collections/tricks/records', {
      token: rider.token,
    });
    expect(stillMine.status).toBe(200);
  });

  it('works long after the approval link has expired — that link never does', async () => {
    const rider = await makeRider({ age_band: 'under_13', country: 'GB' });
    const crafted = await craftConsent(rider, {
      granted: '2026-01-01 09:00:00.000Z',
      approval_expires: '2026-01-08 09:00:00.000Z',
    });

    const revoked = await call('POST', '/api/landit/consent/revoke', {
      body: { token: crafted.revocation },
    });
    expect(revoked.status).toBe(200);
    expect(await consentStateOf(rider)).toBe('revoked');
  });

  it('refuses to re-approve after a revocation, and points at asking again', async () => {
    const rider = await makeRider({ age_band: 'under_13', country: 'GB' });
    const crafted = await craftConsent(rider);
    await call('POST', '/api/landit/consent/revoke', { body: { token: crafted.revocation } });

    const again = await call('POST', '/api/landit/consent/approve', {
      body: { token: crafted.approval },
    });
    expect(again.status).toBe(400);
    expect(await consentStateOf(rider)).toBe('revoked');
  });

  it('cannot put a rider who has aged out back behind the gate', async () => {
    // The link works forever; the gate does not apply forever. A revocation
    // arriving after the rider's threshold birthday is recorded and changes
    // nothing about what they can do.
    const rider = await makeRider({ age_band: 'adult', country: 'GB' });
    const crafted = await craftConsent(rider);

    const revoked = await call('POST', '/api/landit/consent/revoke', {
      body: { token: crafted.revocation },
    });
    expect(revoked.status).toBe(200);
    expect(await consentStateOf(rider)).toBe('not_required');
  });
});

describe('what a link says before it is used', () => {
  it('names the rider by first name and nothing else', async () => {
    const rider = await makeRider({ name: 'Nia Okafor', age_band: 'under_13', country: 'GB' });
    const crafted = await craftConsent(rider);

    const preview = await call<Record<string, unknown>>('POST', '/api/landit/consent/preview', {
      body: { token: crafted.approval },
    });
    expect(preview.status).toBe(200);
    expect(preview.body.action).toBe('approve');
    expect(preview.body.rider_name).toBe('Nia');
    expect(preview.body.state).toBe('pending');

    // A guardian needs to recognise the rider, not to be handed their profile.
    const returned = JSON.stringify(preview.body);
    expect(returned).not.toMatch(/Okafor/);
    expect(returned).not.toMatch(rider.email);
    expect(returned).not.toMatch(rider.handle);
  });

  it('knows which link it is looking at', async () => {
    const rider = await makeRider({ age_band: 'under_13', country: 'GB' });
    const crafted = await craftConsent(rider);
    const revoke = await call<{ action: string }>('POST', '/api/landit/consent/preview', {
      body: { token: crafted.revocation },
    });
    expect(revoke.body.action).toBe('revoke');
  });

  it('changes nothing — it is the reason approving is not a GET', async () => {
    const rider = await makeRider({ age_band: 'under_13', country: 'GB' });
    const crafted = await craftConsent(rider);
    await call('POST', '/api/landit/consent/preview', { body: { token: crafted.approval } });
    expect(await consentStateOf(rider)).toBe('pending');
  });
});

describe('consent lapses on its own (plan §6.2)', () => {
  it('lets a rider out of the gate on their 13th birthday, with nobody doing anything', async () => {
    // Signed up while still 12, with the boundary ahead of them...
    const rider = await makeRider({
      age_band: 'under_13',
      country: 'GB',
      band_next_change_on: '2099-01-09 00:00:00.000Z',
    });
    expect(await consentStateOf(rider)).toBe('pending');

    // ...and the birthday arrives while they are logged out.
    const moved = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
      token: await superuser(),
      body: { band_next_change_on: '2026-01-09 00:00:00.000Z' },
    });
    expect(moved.status).toBe(200);
    expect(await consentStateOf(rider)).toBe('pending');

    // Signing in is when the server notices. No cron job, no stored birth date.
    const signedIn = await call<{ record: { age_band: string; consent_state: string } }>(
      'POST',
      '/api/collections/users/auth-with-password',
      { body: { identity: rider.email, password: rider.password } },
    );
    expect(signedIn.status).toBe(200);
    expect(await consentStateOf(rider)).toBe('not_required');

    const seen = await call<{ age_band: string; band_next_change_on: string }>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      { token: await superuser() },
    );
    expect(seen.body.age_band).toBe('13_15');
    // Their 16th birthday: three years on from the 13th, no birth date needed.
    expect(seen.body.band_next_change_on).toMatch(/^2029-01-09/);
  });

  it('keeps an EEA rider gated until 16, not 13', async () => {
    const rider = await makeRider(
      { age_band: 'under_13', country: 'DE', band_next_change_on: '2026-01-09 00:00:00.000Z' },
      { consent_state: 'pending' },
    );

    await call('POST', '/api/collections/users/auth-with-password', {
      body: { identity: rider.email, password: rider.password },
    });

    const seen = await call<{ age_band: string }>(
      'GET',
      `/api/collections/users/records/${rider.id}`,
      { token: await superuser() },
    );
    expect(seen.body.age_band).toBe('13_15');
    expect(await consentStateOf(rider)).toBe('pending');
  });

  it('leaves a rider whose birthday has not come alone', async () => {
    const rider = await makeRider(
      { age_band: 'under_13', country: 'GB', band_next_change_on: '2099-01-09 00:00:00.000Z' },
      { consent_state: 'pending' },
    );
    await call('POST', '/api/collections/users/auth-with-password', {
      body: { identity: rider.email, password: rider.password },
    });
    expect(await consentStateOf(rider)).toBe('pending');
  });
});
