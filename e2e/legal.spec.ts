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
  ['about', 'About Land The Trick'],
] as const;

test('every document has its own URL and its own heading', async ({ page }) => {
  for (const [slug, title] of DOCS) {
    await page.goto(`/legal/${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  }
});

test('the index moves between documents and marks the current one', async ({ page }) => {
  await page.goto('/legal/privacy');

  // Scoped to the index rather than the page. The site footer arrived on these
  // documents on 2026-09-04 and its Legal and Company columns link the same five
  // titles, so an unscoped `getByRole('link', { name: 'Safeguarding' })` now
  // matches twice and fails on strict mode. Naming the navigation is also what
  // the assertion means: it is the index that marks the current document.
  const index = page.getByRole('navigation', { name: 'The small print' });

  await expect(index.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await index.getByRole('link', { name: 'Safeguarding' }).click();
  await expect(page).toHaveURL('/legal/safeguarding');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Safeguarding');
});

test('every document carries the site footer (2026-09-04)', async ({ page }) => {
  // These were the only five pages in the product without one — and the way in
  // to them is the footer itself, whose Legal and Company columns name all five.
  // A rider who clicked "Privacy policy" there arrived somewhere the route back
  // had disappeared, with nothing but Back to the home page.
  for (const [slug] of DOCS) {
    await page.goto(`/legal/${slug}`);
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    // The other documents, and the reporting route the OSA duty needs easy.
    await expect(footer.getByRole('link', { name: 'Terms of use' })).toBeVisible();
    /*
     * Two of these since 2026-09-12 (plan §7 T5, thirteenth divergence): the
     * Company column and the bottom strip. The strip's copy is what keeps the
     * route one tap away on a phone, where the columns are folded — so the
     * count is the assertion, not an inconvenience to work around with
     * `.first()`. Losing either is the regression this test is for.
     */
    const report = footer.getByRole('link', { name: 'Report something' });
    await expect(report).toHaveCount(2);
    await expect(report.first()).toBeVisible();
    await expect(report.last()).toBeVisible();
  }
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

test('the privacy policy states plainly that Land The Trick hosts no video', async ({ page }) => {
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

test('safeguarding keeps the one-working-day promise and describes the route that exists', async ({
  page,
}) => {
  await page.goto('/legal/safeguarding');
  const body = await page.locator('body').innerText();

  // Ships as written — owner decision, 2026-08-16.
  expect(body).toContain('within one working day');
  expect(body).toContain(CONTACT.safeguarding);

  // T5 softened this paragraph to email only, because the buttons it described
  // did not exist. T18 built them, so the page names them again — and the test
  // now holds the *opposite* assertion: every promise here has to be a control
  // somebody can find. The two surfaces with a report link are profiles and
  // spots; the signed-out form is the OSA duty (plan §6.1).
  expect(body).toMatch(/report control/i);
  expect(body).toMatch(/\/report/);
  expect(body).toMatch(/do not need an account/i);
  // The complaints procedure the codes ask for, in the copy as well as the code.
  expect(body).toMatch(/look again/i);

  // The pack promised "every profile and clip can be reported" while no button
  // existed; there are no clips at all now (2026-08-17), so the page must not
  // claim one in either direction.
  expect(body).not.toMatch(/every profile and clip can be reported/i);
  expect(body).not.toMatch(/clip/i);
});

test('the reporting route works without an account (plan §6.1)', async ({ page }) => {
  // The OSA duty is a route for somebody who is not a signed-up rider, so the
  // assertion that matters is that a signed-out browser reaches the form and is
  // asked for a reply address rather than a sign-in.
  await page.goto('/report');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('not right');
  await expect(page.getByLabel('Your email')).toBeVisible();
  await expect(page.getByRole('button', { name: /send this to a person/i })).toBeVisible();
});

test('the safeguarding page links the form it promises', async ({ page }) => {
  await page.goto('/legal/safeguarding');
  await page
    .getByRole('link', { name: /report/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/report/);
});

test('safeguarding states the no-stranger-contact position (plan §6.1)', async ({ page }) => {
  await page.goto('/legal/safeguarding');
  const body = await page.locator('body').innerText();
  expect(body).toMatch(/invite only/i);
  expect(body).toMatch(/no private messaging/i);
  expect(body).toMatch(/no feed of strangers/i);
});

test('no document is marked as draft copy (2026-08-30)', async ({ page }) => {
  // Every legal page carried a grey "Draft copy, pending legal review" strip,
  // inherited from `landit-legal.jsx`. The owner removed it on 2026-08-30. It is
  // asserted rather than trusted because a published document that calls itself
  // a draft is a thing a rider's parent reads, and it came back once already
  // when the wording was re-dated instead of re-decided.
  //
  // Note what this does *not* claim: §6.3's counsel review of the EEA table and
  // the US posture is still open. That is a plan item, not a banner.
  for (const [slug] of DOCS) {
    await page.goto(`/legal/${slug}`);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/draft copy/i);
    expect(body).not.toMatch(/pending legal review/i);
  }
});

test('the About page says what pays for the site, not what the site earns (2026-09-12)', async ({
  page,
}) => {
  // This section was headed "How we make money" and led with "Subscriptions,
  // and eventually posted sticker packs" until the owner rewrote it on
  // 2026-09-12. Two separate mistakes, and both are held here rather than
  // trusted, because both came from a paste that already came back twice.
  //
  // The posted pack is the same claim T10 dropped from the sticker wall and T15
  // dropped from the FAQ (issues #101, #181): nobody has decided to post
  // physical stickers and `PLANS` carries no such perk, so it is a promise about
  // what money buys on a page with a live checkout behind it. `landing.spec.ts`
  // and `plans.spec.ts` hold the words off those two pages; the legal documents
  // were the gap it survived in, which is what this closes.
  for (const [slug] of DOCS) {
    await page.goto(`/legal/${slug}`);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/vinyl/i);
    expect(body).not.toMatch(/sticker packs?/i);
  }

  await page.goto('/legal/about');
  const body = await page.locator('body').innerText();
  // The heading answers "what keeps this up", not "what do we earn". The site
  // does not currently cover its own costs, and a page announcing otherwise to a
  // parent is flattering rather than true.
  expect(body).not.toMatch(/how we make money/i);
  // Nothing here asserts what the section promises, because on the owner's
  // instruction it no longer promises anything: both halves of the old
  // "Not advertising, and not by selling data about children" are gone, the
  // first to keep advertising an open question and the second because the
  // privacy policy is where that commitment is published and enforced. This
  // test holds the two *claims* off the page and leaves the prose to the owner.
  //
  // No number of free tricks, whatever `PLANS` happens to say. The figure has
  // moved twice and is expected to move again, so this page describes the shape
  // of the free tier instead. Matched on the phrase rather than on a digit: the
  // section above legitimately mentions "the twenty tries at a drop-in".
  expect(body).not.toMatch(/twenty hand-picked tricks/i);
});

test('the cookies page does not offer a setting that does not exist', async ({ page }) => {
  await page.goto('/legal/cookies');
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/opt out in your account settings/i);
  expect(body).toMatch(/without cookies/i);
});

test('the footer has no dead labels, and Contact lands on the addresses', async ({ page }) => {
  // Three placeholders lived here until 2026-08-30: a greyed `Staff` word that
  // opened nothing (issue #135), three social tags that were spans rather than
  // links, and a `Contact` entry pointing at the top of the same page as the
  // `About Land The Trick` entry above it. The rule the footer now keeps is that
  // every entry in it goes somewhere.
  await page.goto('/');
  const footer = page.locator('footer');

  await expect(footer).not.toContainText('Staff');

  // Exact hrefs, not a `/landthetrick/` pattern: the Instagram link pointed at
  // `instagram.com/landthetrick` until 2026-09-11, which is not the account —
  // the handle there is `@landthetrickapp` — and a loose pattern matched it.
  // Facebook's is the numeric page id rather than a vanity username, because the
  // page has not claimed one — see `content/socials.ts`. Asserted exactly like
  // the other two: if a username is claimed later, this line changes with it,
  // and until then a pattern would have hidden a share-link URL slipping in.
  const socials = {
    Instagram: 'https://instagram.com/landthetrickapp',
    TikTok: 'https://tiktok.com/@landthetrick',
    Facebook: 'https://facebook.com/1324987644027132',
  };
  for (const [name, href] of Object.entries(socials)) {
    await expect(footer.getByRole('link', { name })).toHaveAttribute('href', href);
  }

  // A YouTube tag was in that list until 2026-09-05, pointing at a channel that
  // was never claimed (owner, in chat). Asserted absent rather than just dropped
  // from the loop, because the failure this guards against is the link coming
  // back, not the link going missing.
  await expect(footer.getByRole('link', { name: 'YouTube' })).toHaveCount(0);

  await expect(footer.getByRole('link', { name: 'Contact', exact: true })).toHaveAttribute(
    'href',
    '/legal/about#get-in-touch',
  );

  // Nothing in the footer's link columns is a label pretending to be a link.
  await expect(footer.locator('[aria-disabled="true"]')).toHaveCount(0);
});
