import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { GlossaryText } from './GlossaryText';

/**
 * String in, markup out. The rule about *which* words link lives in
 * `@landit/core` and is tested there; this checks that the component wraps
 * exactly those words, leaves everything else byte-for-byte alone, and builds
 * the link the glossary page understands.
 */

/** The `<a>` tags in the markup, as `[href, text]`. */
const links = (html: string): [string, string][] =>
  [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map((m) => [
    m[1]!.replace(/&amp;/g, '&'),
    m[2]!,
  ]);

/** The markup with its tags stripped, so the prose can be compared whole. */
const prose = (html: string): string => html.replace(/<[^>]+>/g, '');

describe('GlossaryText', () => {
  const tips =
    'Learn it off a kerb or a small drop first — the extra air time is where the deck gets round. ' +
    'Pull the bars to your hips. Kick with the heel, not the toe.';

  it('links two glossary words and leaves the trap word alone', () => {
    const html = renderToStaticMarkup(<GlossaryText text={tips} from="tailwhip" />);
    const found = links(html);

    expect(found.map(([, text]) => text)).toEqual(expect.arrayContaining(['kerb', 'deck']));
    // "hips" is the body part, and Hip is a ramp corner: never a link.
    expect(found.map(([, text]) => text.toLowerCase())).not.toContain('hips');
    expect(html).not.toContain('#hip"');
  });

  it('builds each link to the term on the glossary, carrying the trick to come back to', () => {
    const html = renderToStaticMarkup(<GlossaryText text={tips} from="tailwhip" />);
    const hrefs = Object.fromEntries(links(html).map(([href, text]) => [text, href]));
    expect(hrefs.kerb).toBe('/glossary?from=tailwhip#kerb');
    expect(hrefs.deck).toBe('/glossary?from=tailwhip#deck');
  });

  it('omits the way back when there is no trick to go back to', () => {
    const html = renderToStaticMarkup(<GlossaryText text="Off a kerb." />);
    expect(links(html)).toEqual([['/glossary#kerb', 'kerb']]);
  });

  it('changes nothing about the prose itself', () => {
    const html = renderToStaticMarkup(<GlossaryText text={tips} from="tailwhip" />);
    // React escapes the em dash's neighbours as entities in places; decode the
    // handful it uses so the comparison is about words, not encoding.
    const decoded = prose(html)
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');
    expect(decoded).toBe(tips);
  });

  it('links a word once, at its first mention', () => {
    const html = renderToStaticMarkup(
      <GlossaryText text="Kick the deck. Watch the deck. Land the deck." />,
    );
    expect(links(html)).toHaveLength(1);
    expect(html.indexOf('<a')).toBeLessThan(html.indexOf('Watch'));
  });

  it('links only the words a sport uses when told the sport', () => {
    // "frame" is a BMX word; in scooter copy it is not the top tube.
    const text = 'Kick the frame round with your back foot.';
    expect(links(renderToStaticMarkup(<GlossaryText text={text} />)).map(([, t]) => t)).toContain(
      'frame',
    );
    expect(
      links(renderToStaticMarkup(<GlossaryText text={text} sport="scooter" />)).map(([, t]) => t),
    ).not.toContain('frame');
  });

  it('renders plain copy with nothing to link as plain text', () => {
    expect(renderToStaticMarkup(<GlossaryText text="Nothing here." />)).toBe('Nothing here.');
    expect(renderToStaticMarkup(<GlossaryText text="" />)).toBe('');
  });
});
