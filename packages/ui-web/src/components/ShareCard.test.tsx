import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ShareCard } from './ShareCard';
import { SHARE_POSTER_HEIGHT, SHARE_POSTER_WIDTH, drawSharePoster } from './share-poster';

/**
 * The card's two shapes, and the promise that separates them.
 *
 * `poster` was added so a rider could send the picture rather than screenshot
 * it, and it is optional because `packages/ui-web` is additive-only once
 * merged: a caller that does not pass one must get back exactly the card it had
 * before. That is not a claim a reader can check by eye — the buttons are built
 * in a conditional — so it is pinned here.
 */

const trick = {
  name: 'Tailwhip',
  categoryLabel: 'Street',
  sportLabel: 'Scooter',
  difficulty: 3,
  hue: '#2BAE66',
};

const shared = {
  kind: 'trick',
  trick,
  headline: 'Landed the Tailwhip',
  meta: 'Sam · 14 tricks landed · 3 weeks',
  dateLabel: '13 Sep',
  caption: 'Landed the Tailwhip on scooter. 14 tricks down. Tracked on Land The Trick.',
  onClose: () => {},
} as const;

describe('a card with no poster', () => {
  const html = renderToStaticMarkup(<ShareCard {...shared} />);

  it('is the card it has always been: a caption to copy, and a way out', () => {
    expect(html).toContain('Copy caption');
    expect(html).toContain('Close');
  });

  it('offers nothing it cannot deliver', () => {
    expect(html).not.toContain('Save image');
    expect(html).not.toContain('<canvas');
  });
});

describe('a card with a poster', () => {
  const html = renderToStaticMarkup(
    <ShareCard
      {...shared}
      poster={{ url: 'https://landthetrick.com/library/tailwhip', fileName: 'x.png' }}
    />,
  );

  it('offers all four: share, save, copy and close', () => {
    expect(html).toContain('>Share<');
    expect(html).toContain('Save image');
    expect(html).toContain('Copy caption');
    expect(html).toContain('Close');
  });

  /**
   * Tall, not square: Stories and Reels are where a landed trick goes, and a
   * canvas sized in CSS rather than in attributes would export at the size it
   * was drawn on screen instead of at 1080×1920.
   */
  it('draws onto a canvas sized in attributes, not in CSS', () => {
    expect(html).toContain(`width="${SHARE_POSTER_WIDTH}"`);
    expect(html).toContain(`height="${SHARE_POSTER_HEIGHT}"`);
  });
});

describe('drawing the poster where there is no 2D context', () => {
  /**
   * `getContext` returns null on a browser that has run out of memory for one,
   * and on any test environment without a canvas implementation. Either way the
   * share button must come back empty-handed rather than throw inside a rider's
   * tap handler.
   */
  it('resolves rather than throwing', async () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    await expect(
      drawSharePoster(canvas, {
        kind: 'trick',
        trick,
        headline: shared.headline,
        meta: shared.meta,
        dateLabel: shared.dateLabel,
        caption: shared.caption,
        wordmarkSrc: '/brand/wordmark-line-720.png',
        domain: 'landthetrick.com',
      }),
    ).resolves.toBeUndefined();
  });
});
