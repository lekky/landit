import { expect, test } from '@playwright/test';

/**
 * The story page's photographs.
 *
 * `/story` is otherwise static prose with a unit-tested content module behind
 * it, so what is worth a browser here is the one thing on the page a visitor
 * can do: press a frame and get the photograph whole. The frames crop to
 * portrait, which is the point of expanding one, and the picture the page turns
 * on is the painted ramp.
 *
 * The dismissal assertion is the one that earns its place. The dialog is this
 * page's own element rather than the shell's `Modal`, because `/story` sits
 * outside `AppShell` and has no `ModalProvider` above it, and it borrows
 * `useModalLayer` for the behaviour a dialog is expected to have. Escape
 * closing it is that borrowing working; if a later refactor drops the hook, the
 * photo would still expand and only this would notice.
 */

test('a photo expands, and Escape closes it', async ({ page }) => {
  await page.goto('/story');

  const frame = page.getByRole('button', { name: /^Expand photo: The ramp painted/ });
  await expect(frame).toBeVisible();
  await frame.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // The expanded picture carries the description; the frame that opened it does
  // not, so that a screen reader is not read the photo twice.
  await expect(dialog.getByRole('img', { name: /painted dark grey/ })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('the opening pair is above the first paragraph, not at the foot of the page', async ({
  page,
}) => {
  await page.goto('/story');

  /*
   * Both Greystone photos were at the very bottom until 2026-09-12, under "In a
   * year?", which put the page's evidence that a rider is behind it after
   * everything else. This asserts the order rather than the offsets: a y
   * coordinate would break on any type change, while "before the first
   * sentence" is the decision.
   */
  const riding = page.getByRole('button', { name: /^Expand photo: Miles riding/ });
  const lead = page.getByText('I wanted to be a mountain biker because of a video game.');

  await expect(riding).toBeVisible();
  await expect(lead).toBeVisible();

  const leadComesAfter = await riding.evaluate(
    // `4` is `Node.DOCUMENT_POSITION_FOLLOWING`, spelled as its value because
    // the e2e tsconfig's lib is ES2023 with no DOM: the browser global is not a
    // name TypeScript knows here, even though this callback runs in the page.
    (photo, paragraph) => Boolean(photo.compareDocumentPosition(paragraph) & 4),
    await lead.elementHandle(),
  );

  expect(leadComesAfter).toBe(true);
});

test('the prose carries no em dashes', async ({ page }) => {
  await page.goto('/story');

  // Owner, 2026-09-12, in chat. The rule is about what a reader sees, so this
  // reads the rendered page rather than the content module.
  const body = await page.locator('main, body').first().innerText();
  expect(body).not.toContain('—');
});
