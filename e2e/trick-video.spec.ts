import { expect, test } from '@playwright/test';

import {
  NO_VIDEO_TRICK,
  TRICK_VIDEO_CHANNEL,
  TRICK_VIDEO_TITLE,
  VIDEO_TRICK,
} from './support/seed-trick-video';

/**
 * "Watch it" — the staff-picked tutorial on a trick page (T34).
 *
 * Three things this file is for, and only the first is ordinary.
 *
 * **1. It renders signed out.** The owner's decision (2026-09-12, in chat): a
 * visitor who arrived from a search for "how to <trick>" should get the answer
 * they came for. Every test below runs with no session at all, which is also
 * the strongest version of the assertion — if it is there for a guest it is
 * there for a rider.
 *
 * **2. Nothing talks to Google until the press.** Same guarantee
 * `video-links.spec.ts` was written for, and it has to be re-proved here rather
 * than assumed: that spec covers a rider's own links behind a sign-in, and this
 * panel puts the same component on a **public, crawlable page** where the
 * reader may be a child who has not signed in and has agreed to nothing. Plan
 * §6.8 runs this product with no consent banner; an iframe or a
 * `img.youtube.com` poster rendered on load would put one back on the roadmap,
 * and only a network assertion notices.
 *
 * **3. A trick with no video shows nothing at all** — no placeholder, no
 * "coming soon", and no other sport's video (owner, same conversation). The
 * risk in testing an absence is a test that passes because the page did not
 * render, so that test asserts the page *did* render first and only then that
 * the panel is missing (LESSONS §5).
 *
 * `seed-trick-video.ts` is what makes any of this meaningful: the video columns
 * are database-only, so without that one write no trick in the e2e database has
 * a video and the whole file would be green against a page that cannot draw a
 * panel under any circumstances.
 */

/**
 * Every host this page must not touch on load. Broad on purpose, and copied
 * from `video-links.spec.ts`: the mistake being guarded against is reaching for
 * *any* Google-owned URL, and a list of exact hostnames would miss the next one
 * somebody picks.
 */
const GOOGLE =
  /(^|\.)(youtube|youtube-nocookie|youtu\.be|ytimg|googlevideo|google|gstatic|doubleclick)\./;

test.describe('the staff-picked tutorial', () => {
  test('is on the trick page for a signed-out visitor, above the lowdown', async ({ page }) => {
    await page.goto(`/library/${VIDEO_TRICK.id}`);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(VIDEO_TRICK.name);
    await expect(page.getByRole('heading', { name: 'Watch it' })).toBeVisible();

    // What the panel says about the video, from the stored columns — the point
    // being that it can name the video without anybody's server being asked.
    await expect(page.getByText(TRICK_VIDEO_TITLE)).toBeVisible();
    await expect(page.getByText(TRICK_VIDEO_CHANNEL)).toBeVisible();

    // Prominence, as asked for: the panel's heading comes before the lowdown's
    // in the document, which is what puts it first in the column on desktop and
    // first under the ladder on a phone.
    const headings = await page.getByRole('heading', { level: 2 }).allTextContents();
    const watch = headings.findIndex((text) => text.trim() === 'Watch it');
    const lowdown = headings.findIndex((text) => text.trim() === 'The lowdown');
    expect(watch, 'no "Watch it" heading on the page').toBeGreaterThanOrEqual(0);
    expect(lowdown, 'no "The lowdown" heading on the page').toBeGreaterThanOrEqual(0);
    expect(watch).toBeLessThan(lowdown);
  });

  test('contacts Google only once the visitor presses play', async ({ page }) => {
    const reached: string[] = [];
    page.on('request', (request) => {
      const host = new URL(request.url()).hostname;
      if (GOOGLE.test(`${host}.`)) reached.push(request.url());
    });

    await page.goto(`/library/${VIDEO_TRICK.id}`);

    // The network assertions come before anything about the Play button, for
    // the reason `video-links.spec.ts` records: with the click-to-play gate
    // removed there is no Play button, so a test that waited for one would fail
    // on a missing locator and never run the counter — red about the wrong
    // thing. Wait on something that exists either way, then let anything lazy
    // fire before believing an absence.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(VIDEO_TRICK.name);
    await page.waitForLoadState('networkidle');

    expect(reached, `page load contacted Google: ${reached.join(', ')}`).toEqual([]);
    // No frame at all. A *hidden* iframe still loads, so the absence of the
    // element is the assertion and never its visibility.
    await expect(page.locator('iframe')).toHaveCount(0);

    // Then the press, which is the consent, and the frame appears.
    await page.getByRole('button', { name: /^Play / }).click();
    await expect(page.locator('iframe')).toHaveCount(1);
  });

  test('is absent entirely on a trick nobody has picked a video for', async ({ page }) => {
    await page.goto(`/library/${NO_VIDEO_TRICK.id}`);

    // The page rendered — asserted first, so what follows cannot pass because
    // nothing loaded.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(NO_VIDEO_TRICK.name);
    await expect(page.getByRole('heading', { name: 'The lowdown' })).toBeVisible();

    // And now the absence: no heading, no player, no empty frame, and nothing
    // telling a rider that a video might arrive one day.
    await expect(page.getByRole('heading', { name: 'Watch it' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Play / })).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.getByText(/coming soon/i)).toHaveCount(0);
  });
});
