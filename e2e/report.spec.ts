import { REPORT_REASONS, REPORT_SUBJECTS } from '@landit/core';
import { expect, test } from '@playwright/test';

/**
 * The reporting form's two choices, after they became pill rows (T52, §3.10).
 *
 * This screen had no browser coverage at all, and it is the one screen in the
 * product where a control that *looks* selected while the form posts something
 * else is worse than a broken page: a report filed under the wrong reason goes
 * to the same queue saying the wrong thing, and nobody finds out. So the thing
 * asserted is not the look — it is that the native radios underneath are still
 * a group, still reachable from a keyboard, and still the values the server
 * receives.
 *
 * **Signed out**, which is how the Online Safety Act route has to work and
 * therefore the state worth exercising. Nothing here files a report: the
 * queue's own rules (the rate limit, the reference, what a moderator sees) are
 * proved in `pocketbase/tests` and are deliberately not this file's business —
 * issue #460 is about the queue, not about the form.
 */

test.describe('the report form', () => {
  test('is two radio groups wearing pill rows, and keeps the values', async ({ page }) => {
    await page.goto('/report');

    /*
     * Scoped to the two fieldsets rather than to the page, because the two
     * lists share a label: "Something else" is both a subject and a reason.
     * That they are separate groups is the thing being asserted as much as it
     * is a way of finding them — a rider choosing a reason must not silently
     * change what they said the report was about.
     */
    const about = page.getByRole('group', { name: 'What is this about?' });
    const why = page.getByRole('group', { name: 'Why?' });

    // Every subject is offered, including the one whose surface is thin: the
    // form does not hide an option it can take a report about.
    for (const subject of REPORT_SUBJECTS) {
      await expect(about.getByRole('radio', { name: new RegExp(subject.label) })).toHaveCount(1);
    }
    for (const reason of REPORT_REASONS) {
      await expect(why.getByRole('radio', { name: reason.label })).toHaveCount(1);
    }

    // The default subject is "profile", as it was when these were dots.
    const first = about.getByRole('radio', { name: new RegExp(REPORT_SUBJECTS[0]!.label) });
    await expect(first).toBeChecked();

    // Pressing the row checks the radio, which is the whole trick: the input is
    // clipped out of sight, and the label is what a thumb actually hits.
    const second = REPORT_SUBJECTS[1]!;
    await about.getByText(second.label, { exact: true }).click();
    await expect(about.getByRole('radio', { name: new RegExp(second.label) })).toBeChecked();
    await expect(first).not.toBeChecked();

    /*
     * **No reason is checked to begin with**, which is how it was when these
     * were dots and is the half of the payload a pill row makes easy to lose: a
     * row that looks like a button invites a default, and a default here would
     * file every report somebody abandoned halfway under whichever reason
     * happened to be first. `main`'s markup has no `defaultChecked` on this
     * group and neither does this one.
     */
    for (const reason of REPORT_REASONS) {
      await expect(why.getByRole('radio', { name: reason.label })).not.toBeChecked();
    }

    // Choosing a reason leaves the subject where the rider put it.
    const reason = REPORT_REASONS[1]!;
    await why.getByText(reason.label, { exact: true }).click();
    await expect(why.getByRole('radio', { name: reason.label })).toBeChecked();
    await expect(about.getByRole('radio', { name: new RegExp(second.label) })).toBeChecked();

    // The arrow keys walk this group too, not only `/suggest`'s topics.
    await why.getByRole('radio', { name: reason.label }).press('ArrowDown');
    await expect(why.getByRole('radio', { name: REPORT_REASONS[2]!.label })).toBeChecked();
  });

  test('every row is a 44px target at 320px, and nothing overflows', async ({ page }) => {
    /*
     * §4: nothing tappable below 44px. The rows this replaced were a 13px radio
     * dot with a label beside it — the smallest targets in the product, on the
     * form somebody upset is filling in on a borrowed phone.
     */
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/report');

    const why = page.getByRole('group', { name: 'Why?' });
    for (const reason of REPORT_REASONS) {
      const row = why.getByText(reason.label, { exact: true });
      const box = await row.boundingBox();
      expect(box?.height, `"${reason.label}" is ${box?.height}px tall`).toBeGreaterThanOrEqual(44);
    }

    const overflow = await page.locator('html').evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, `the document is ${overflow}px wider than the screen`).toBeLessThanOrEqual(0);
  });
});
