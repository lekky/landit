import { describe, expect, it } from 'vitest';

import { CONTACT, CONTACT_ADDRESSES, DOMAIN, SITE_URL } from './contact';

describe('the addresses the product publishes', () => {
  it('are all on the product domain', () => {
    // The point of the constant: an address left on an old domain after a move
    // is a promise pointing at a mailbox nobody can read. This is what catches
    // a half-finished rename.
    for (const address of CONTACT_ADDRESSES) {
      expect(address, address).toMatch(new RegExp(`@${DOMAIN.replace('.', '\\.')}$`));
    }
  });

  it('are addresses, not prose', () => {
    for (const address of CONTACT_ADDRESSES) {
      expect(address, address).toMatch(/^[a-z][a-z0-9._-]*@[a-z0-9.-]+\.[a-z]{2,}$/);
    }
  });

  it('has the four the copy actually uses', () => {
    // Each of these appears in published copy: the legal documents, the
    // guardian consent email, and the sign-up decline notice. Removing one
    // means finding where it was promised first.
    expect(Object.keys(CONTACT).sort()).toEqual(['events', 'hello', 'privacy', 'safeguarding']);
  });

  it('builds the site URL from the same domain', () => {
    expect(SITE_URL).toBe(`https://${DOMAIN}`);
    expect(SITE_URL.startsWith('https://')).toBe(true);
  });
});
