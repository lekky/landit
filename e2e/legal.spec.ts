import { CONTACT } from '@landit/core';
import { expect, test } from '@playwright/test';

/**
 * The five legal documents.
 *
 * Most of these are not "does the page render" tests. They hold the specific
 * copy decisions in plan §6.2–§6.4 that the design pack got wrong, and they are
 * written so that reintroducing one of those mistakes fails a build rather than
 * shipping a promise the product cannot keep. A copy edit that trips one of
 * these should be read as the test doing its job.
 */

const DOCS = [
  ['privacy', 'Privacy policy'],
  ['terms', 'Terms of use'],
  ['safeguarding', 'Safeguarding'],
  ['cookies', 'Cookies'],
  ['about', 'About Land It'],
] as const;

test('every document has its own URL and its own heading', async ({ page }) => {
  for (const [slug, title] of DOCS) {
    await page.goto(`/legal/${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  }
});

test('the index moves between documents and marks the current one', async ({ page }) => {
  await page.goto('/legal/privacy');

  await expect(page.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('link', { name: 'Safeguarding' }).click();
  await expect(page).toHaveURL('/legal/safeguarding');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Safeguarding');
});

test('an unknown document is a 404, not an empty page', async ({ page }) => {
  const response = await page.goto('/legal/nonsense');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('That page');
});

test('no document states a minimum age (plan §6.2)', async ({ page }) => {
  // Claiming one obliges us to enforce it with highly effective age assurance,
  // which a tick-box is explicitly not. Younger riders are welcome with a
  // guardian; the age is never a gate we advertise.
  for (const [slug] of DOCS) {
    await page.goto(`/legal/${slug}`);
    const body = await page.locator('main, body').first().innerText();
    expect(body).not.toMatch(/\b13\s*\+/);
    expect(body).not.toMatch(/(be|are|is)\s+13\s+or\s+over/i);
    expect(body).not.toMatch(/minimum age of/i);
  }
});

test('the Crew Pass is gone from every document (plan §2.4)', async ({ page }) => {
  // It was dropped, so terms describing it describe a mechanism that does not
  // exist — which is what made the pack's copy wrong rather than merely draft.
  for (const [slug] of DOCS) {
    await page.goto(`/legal/${slug}`);
    await expect(page.locator('body')).not.toContainText('Crew Pass');
  }
});

test('no document promises a clip vault, or private storage for uploads', async ({ page }) => {
  // The owner reversed clip hosting on 2026-08-17 (plan §1, §6.6, §3 guarantee
  // 2). Until then the privacy policy said "Clips you upload are yours, and only
  // you can watch them… the storage they sit in is private", and the terms said
  // saved clips stayed watchable after a downgrade. Both described a vault that
  // no longer exists, and a promise about how carefully nothing is stored is
  // worse than no promise: it tells a parent this product holds their child's
  // video. These are published documents, so the absence is asserted rather than
  // trusted. `t15b-video-links` adds copy about *pasted links* — a video on
  // YouTube, not here — and will need its own assertions, not a loosening of
  // these.
  // Note these are the *promises*, not the word "upload" — the replacement copy
  // uses it to deny hosting ("There is no upload, and no clip of yours is stored
  // on our servers"), which is the sentence this test exists to protect.
  for (const [slug] of DOCS) {
    await page.goto(`/legal/${slug}`);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/vault/i);
    expect(body).not.toMatch(/\d\s*GB\b/i);
    expect(body).not.toMatch(/clips you upload/i);
    expect(body).not.toMatch(/storage they sit in/i);
    expect(body).not.toMatch(/stay watchable/i);
    // No document may describe uploading as something a rider can do here.
    expect(body).not.toMatch(/(can|may|you)\s+upload/i);
  }
});

test('the privacy policy states plainly that Land It hosts no video', async ({ page }) => {
  await page.goto('/legal/privacy');
  await expect(page.locator('body')).toContainText('We do not host video');
});

test('the privacy policy says new accounts start private (plan §6.4)', async ({ page }) => {
  await page.goto('/legal/privacy');
  await expect(page.locator('body')).toContainText('New accounts start private');
});

test('the privacy policy explains the age band and the discarded birth date', async ({ page }) => {
  await page.goto('/legal/privacy');
  const body = await page.locator('body').innerText();
  expect(body).toContain('age band');
  expect(body).toMatch(/never sent to us/i);
  // The US refusal is deliberate and stated, not quietly applied (§6.3).
  expect(body).toMatch(/United States and under 13/);
});

test('safeguarding keeps the one-working-day promise and claims only email reporting', async ({
  page,
}) => {
  await page.goto('/legal/safeguarding');
  const body = await page.locator('body').innerText();

  // Ships as written — owner decision, 2026-08-16.
  expect(body).toContain('within one working day');
  expect(body).toContain(CONTACT.safeguarding);

  // Softened until T18 builds the flow — same decision. The pack promised
  // "Every profile and clip can be reported" while no button existed. There are
  // no clips at all now (2026-08-17), so the claim is doubly gone.
  expect(body).not.toMatch(/every profile and clip can be reported/i);
});

test('safeguarding states the no-stranger-contact position (plan §6.1)', async ({ page }) => {
  await page.goto('/legal/safeguarding');
  const body = await page.locator('body').innerText();
  expect(body).toMatch(/invite only/i);
  expect(body).toMatch(/no private messaging/i);
  expect(body).toMatch(/no feed of strangers/i);
});

test('the cookies page does not offer a setting that does not exist', async ({ page }) => {
  await page.goto('/legal/cookies');
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/opt out in your account settings/i);
  expect(body).toMatch(/without cookies/i);
});
