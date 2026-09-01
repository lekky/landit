import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StickerBadge } from './StickerBadge';

/**
 * What a browser is actually handed, rather than what the helpers return.
 *
 * `sticker-art.test.ts` proves the URLs; this proves they reach the markup, and
 * that the two halves of the fallback survive: the master PNG stays the `src`
 * for a browser with no WebP, and a record with no printed art still gets the
 * drawn SVG rather than an `<img>` pointed at nothing.
 */
describe('a badge with printed art', () => {
  const html = renderToStaticMarkup(
    <StickerBadge sticker={{ name: 'Bar Spin', hue: '#F3B84E', img: 'bar-spin.png' }} earned />,
  );

  it('keeps the master PNG as the src', () => {
    expect(html).toContain('src="/stickers/bar-spin.png"');
  });

  /**
   * Matched case-insensitively because React writes the attribute as `srcSet`.
   * HTML attribute names are case-insensitive, so a browser reads it either
   * way — but a test spelling it in lower case fails against markup that is
   * correct, which is a worse outcome than the looser match.
   */
  it('offers a resized WebP at each width', () => {
    expect(html.toLowerCase()).toContain(
      'srcset="/stickers/w160/bar-spin.webp 160w, /stickers/w320/bar-spin.webp 320w"',
    );
  });

  it('declares the size it is drawn at, and loads off-screen ones late', () => {
    expect(html).toContain('sizes="160px"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });

  it("takes a caller's sizes when it is drawn at some other width", () => {
    const wide = renderToStaticMarkup(
      <StickerBadge
        sticker={{ name: 'Bar Spin', hue: '#F3B84E', img: 'bar-spin.png' }}
        sizes="320px"
        earned
      />,
    );
    expect(wide).toContain('sizes="320px"');
  });
});

describe('a badge with no printed art', () => {
  const html = renderToStaticMarkup(
    <StickerBadge sticker={{ name: 'Five Deep', hue: '#F3B84E', icon: 'star' }} />,
  );

  it('is still drawn in SVG, with no image to 404', () => {
    expect(html).toContain('<svg');
    expect(html.toLowerCase()).not.toContain('srcset');
    expect(html).not.toContain('<img');
  });

  it('spells its own locked state, as it always did', () => {
    expect(html).toContain('LOCKED');
  });
});
