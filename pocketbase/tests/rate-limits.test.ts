import { describe, expect, it } from 'vitest';

import { call, makeRider } from './helpers';

/**
 * The two limits T18 added that are not about reports (issue #32, and handles).
 *
 * Both are here rather than beside the feature they guard because both are the
 * same shape: a route that is cheap to call and expensive for somebody else —
 * a stranger's inbox in one case, a child's privacy in the other.
 */

const askGuardian = (token: string, email: string) =>
  call<{ message: string }>('POST', '/api/landit/consent/request', {
    token,
    body: { guardian_email: email },
  });

/** A rider who is actually behind the gate, so the route does not refuse for another reason. */
const gatedRider = () => makeRider({ country: 'GB', age_band: 'under_13' });

describe('how often a guardian may be emailed (issue #32)', () => {
  it('refuses the fourth request in an hour from one rider', async () => {
    const rider = await gatedRider();
    const stem = `guardian-${Date.now()}-a`;

    for (let i = 0; i < 3; i += 1) {
      expect((await askGuardian(rider.token, `${stem}-${i}@example.invalid`)).status).toBe(200);
    }
    const refused = await askGuardian(rider.token, `${stem}-4@example.invalid`);
    expect(refused.status).toBe(429);
  });

  it('counts one address across every rider, because the person being emailed has no account here', async () => {
    const address = `guardian-${Date.now()}-shared@example.invalid`;

    // Five riders, one each, so no rider trips their own hourly limit — the
    // only thing that can refuse the sixth is the per-address count.
    for (let i = 0; i < 5; i += 1) {
      const rider = await gatedRider();
      expect((await askGuardian(rider.token, address)).status).toBe(200);
    }

    const sixth = await gatedRider();
    const refused = await askGuardian(sixth.token, address);
    expect(refused.status).toBe(429);
    // And it says nothing about the other accounts, which would leak that they
    // exist to whoever is holding this phone.
    expect(String(refused.body.message)).not.toMatch(/rider|account|someone/i);
  });
});

describe('how often an account may try a handle', () => {
  /**
   * The oracle this closes: a claim returns 400 when a handle is taken and 200
   * when it is free, one request at a time, and handles are children's names.
   *
   * The assertion that matters is that **failed** attempts count. If the audit
   * row the limit counts were rolled back with the write that failed, a probe
   * loop would cost nothing and this limit would be decoration — so the test
   * spends its whole budget on 400s and then checks that a legitimate change is
   * refused too.
   */
  it('refuses the twenty-first attempt in an hour, counting the ones that failed', async () => {
    const holder = await makeRider();
    const prober = await makeRider();

    for (let i = 0; i < 20; i += 1) {
      const taken = await call('PATCH', `/api/collections/users/records/${prober.id}`, {
        token: prober.token,
        body: { handle: holder.handle },
      });
      // Somebody already holds it: a unique violation, not a rate limit.
      expect(taken.status).toBe(400);
    }

    const refused = await call<{ message: string }>(
      'PATCH',
      `/api/collections/users/records/${prober.id}`,
      { token: prober.token, body: { handle: `free${Date.now()}` } },
    );
    expect(refused.status).toBe(429);
    expect(String(refused.body.message)).toMatch(/lot of handles/i);
  });

  it('leaves every other kind of profile edit alone', async () => {
    const rider = await makeRider();
    for (let i = 0; i < 25; i += 1) {
      const saved = await call('PATCH', `/api/collections/users/records/${rider.id}`, {
        token: rider.token,
        body: { town: `Town ${i}` },
      });
      expect(saved.status).toBe(200);
    }
  });
});
