/**
 * HTML to JPEG.
 *
 * Chromium rather than a lighter renderer because the brand is built out of SVG
 * filters, blend modes and web fonts — the rough edge on every block is a
 * displacement map, and a renderer that quietly drops it produces a card that
 * is recognisably not ours. Playwright is already a dependency of this repo, so
 * this costs no new one.
 */

import { chromium } from '@playwright/test';

import { config } from './config.mjs';

/**
 * Render one page and write the file.
 *
 * `waitUntil: 'networkidle'` covers the font request; `document.fonts.ready`
 * covers the face actually being usable, which is what the fit-to-width script
 * in the card measures against. The short pause after it is for the filters.
 */
export async function renderCard(html, outPath) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: config.image.width, height: config.image.height },
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: 'networkidle' });
    // Passed as a string rather than a function: the body runs in the page, not
    // in Node, and a `document` written here is a lint error in a file that has
    // no DOM. Playwright evaluates either.
    await page.evaluate('document.fonts.ready');
    await page.waitForTimeout(250);
    await page.screenshot({
      path: outPath,
      type: config.image.type,
      quality: config.image.quality,
    });
  } finally {
    await browser.close();
  }
  return outPath;
}
