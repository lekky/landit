import { SITE_URL, SPORTS, TIERS_LABEL, TRICKS, type Trick } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { jsonLdText, organizationLd, trickHowToLd } from './structuredData';

/**
 * A malformed graph fails silently — a search engine ignores it and nobody is
 * told — so these tests are the only thing that notices.
 */

const bunnyHop = TRICKS.find((t) => t.id === 'bunny-hop') as Trick;

describe('organizationLd', () => {
  it('names the publisher and the site, each with an id to point at', () => {
    const graph = organizationLd()['@graph'] as Record<string, unknown>[];
    const org = graph.find((n) => n['@type'] === 'Organization');
    const site = graph.find((n) => n['@type'] === 'WebSite');

    expect(org?.['@id']).toBe(`${SITE_URL}/#organization`);
    expect(org?.name).toBe('Land The Trick');
    // The publisher link is by reference, which is what stops every trick page
    // carrying its own copy of the organisation.
    expect(site?.publisher).toEqual({ '@id': `${SITE_URL}/#organization` });
  });

  it('claims only absolute URLs, which is the only kind schema.org resolves', () => {
    const graph = organizationLd()['@graph'] as Record<string, unknown>[];
    const urls = graph.flatMap((n) => [n.url, n.logo].filter(Boolean) as string[]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url.startsWith('https://')).toBe(true);
  });
});

describe('trickHowToLd', () => {
  const node = trickHowToLd(bunnyHop, {
    url: `${SITE_URL}/library/bunny-hop`,
    equipment: 'Scooter, helmet, and pads once you are on ramps',
  });

  it('describes the trick with the copy the page itself shows, not a paraphrase', () => {
    expect(node['@type']).toBe('HowTo');
    expect(node.description).toBe(bunnyHop.about);
    expect(node.educationalLevel).toBe(TIERS_LABEL[bunnyHop.diff - 1]);
    expect(node.name).toContain(SPORTS[bunnyHop.sport].label.toLowerCase());
  });

  it('lists exactly the two steps the page shows, and invents none', () => {
    const steps = node.step as { name: string; text: string }[];
    expect(steps).toHaveLength(2);
    expect(steps.map((s) => s.text)).toEqual([bunnyHop.about, bunnyHop.tips]);
  });

  it('omits the supply list rather than inventing one when there is no kit line', () => {
    const bare = trickHowToLd(bunnyHop, { url: 'https://example.test/x' });
    expect(bare.supply).toBeUndefined();
  });

  it('says the lowdown is free, because the paywall is on tracking not reading', () => {
    expect(node.isAccessibleForFree).toBe(true);
  });
});

describe('jsonLdText', () => {
  it('escapes the angle bracket, so staff copy cannot close the script tag', () => {
    const text = jsonLdText({ name: 'end </script><img src=x onerror=alert(1)>' });
    expect(text).not.toContain('</script>');
    expect(text).not.toContain('<img');
    // And it is still JSON: a parser reads the escape back as the character.
    expect((JSON.parse(text) as { name: string }).name).toContain('</script>');
  });

  it('round-trips every trick in the library without producing a raw bracket', () => {
    for (const trick of TRICKS) {
      const text = jsonLdText(trickHowToLd(trick, { url: 'https://example.test/x' }));
      expect(text).not.toContain('<');
      expect(() => JSON.parse(text)).not.toThrow();
    }
  });
});
