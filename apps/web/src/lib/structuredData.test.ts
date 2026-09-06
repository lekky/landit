import { SITE_URL, SPORTS, TIERS_LABEL, TRICKS, type Trick } from '@landit/core';
import { describe, expect, it } from 'vitest';

import { jsonLdText, organizationLd, spotPlaceLd, trickHowToLd } from './structuredData';

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

describe('spotPlaceLd', () => {
  const rich = {
    name: 'Ventnor Skatepark',
    town: 'Ventnor',
    country: 'United Kingdom',
    type: 'Concrete',
    lat: 50.5936,
    lng: -1.2921,
    tags: ['Bowl', 'Ledges', 'Rails'],
    address: 'Southgrove Rd, Ventnor PO38 1LG',
    phone: '01983 855 123',
  };

  const sparse = {
    name: 'Esplanade Ledges',
    town: 'Ventnor',
    type: 'Street spot',
    lat: 50.5921,
    lng: -1.2895,
    tags: ['Ledges', 'Flat'],
  };

  const context = { url: 'https://example.test/spots/ventnor-skatepark', description: 'A park.' };

  it('says what kind of place it is, in schema.org terms and in ours', () => {
    const node = spotPlaceLd(rich, context);
    expect(node['@type']).toEqual(['SkateboardPark', 'SportsActivityLocation']);
    expect(node.additionalType).toBe('Concrete');
    expect(node.name).toBe('Ventnor Skatepark');
    expect(node.url).toBe(context.url);
  });

  it('plots the pin, because a spot coordinate is exact', () => {
    const geo = spotPlaceLd(rich, context).geo as Record<string, unknown>;
    expect(geo.latitude).toBe(rich.lat);
    expect(geo.longitude).toBe(rich.lng);
  });

  it('plots nothing for a spot with no usable coordinates', () => {
    expect(spotPlaceLd({ ...sparse, lat: 0, lng: 0 }, context).geo).toBeUndefined();
    expect(spotPlaceLd({ name: 'Nowhere' }, context).geo).toBeUndefined();
  });

  it('omits the rows the record does not have rather than emitting empty ones', () => {
    const node = spotPlaceLd(sparse, context);
    expect(node.telephone).toBeUndefined();
    const address = node.address as Record<string, unknown>;
    expect(address.streetAddress).toBeUndefined();
    expect(address.addressLocality).toBe('Ventnor');
    expect(address.addressCountry).toBeUndefined();
  });

  it('emits no address at all when there is nothing to put in one', () => {
    expect(spotPlaceLd({ name: 'Nowhere' }, context).address).toBeUndefined();
  });

  it('lists the features the page lists, and no explanation of them', () => {
    const features = spotPlaceLd(rich, context).amenityFeature as { name: string }[];
    expect(features.map((f) => f.name)).toEqual(['Bowl', 'Ledges', 'Rails']);
  });

  it('never carries the submitter, whatever is handed to it', () => {
    const node = spotPlaceLd({ ...rich, submitted_by: 'rider_abc123' } as never, context);
    expect(JSON.stringify(node)).not.toContain('rider_abc123');
    expect(JSON.stringify(node)).not.toContain('submitted_by');
  });

  it('survives a hostile name without producing a raw bracket', () => {
    const text = jsonLdText(
      spotPlaceLd({ ...rich, name: '</script><img src=x onerror=alert(1)>' }, context),
    );
    expect(text).not.toContain('<');
    expect(() => JSON.parse(text)).not.toThrow();
  });
});
