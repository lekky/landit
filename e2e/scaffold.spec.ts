import { expect, test } from '@playwright/test';

/**
 * Proves the scaffold end to end: Next serves a page, and that page renders
 * values imported from all three workspace packages. Replaced by real flows in
 * T20; until then this is what stops the e2e wiring rotting unnoticed.
 */
test('the app serves a page built from the workspace packages', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Land It' })).toBeVisible();

  const packages = page.getByTestId('workspace-packages');
  await expect(packages).toContainText('@landit/core');
  await expect(packages).toContainText('@landit/db');
  await expect(packages).toContainText('@landit/ui-web');
});
