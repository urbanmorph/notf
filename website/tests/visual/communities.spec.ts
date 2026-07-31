import { test, expect } from '@playwright/test';
import { auditPage, hideDynamic } from './_helpers';
import { stubSupabase } from './fixtures';

test('communities listing', async ({ page }, info) => {
  await auditPage(page, info, '/communities/');
});

test('communities filter narrows cards', async ({ page }) => {
  // Serve the fixed fixture (2 Bengaluru + 1 Mumbai community) so the
  // filtered result can't drift with live prod data — the same stub every
  // other visual spec uses via auditPage. Must be set up before navigation.
  await stubSupabase(page);
  await page.goto('/communities/', { waitUntil: 'networkidle' });

  // Whole fixture renders first.
  await expect(page.locator('.community-card')).toHaveCount(3);

  // Use the city dropdown, which filters by exact match (deterministic),
  // rather than the fuzzy search box. Selecting Bengaluru narrows to the
  // 2 Bengaluru communities. toHaveCount auto-retries until the grid
  // re-renders, replacing the old brittle fixed 500 ms sleep.
  await page.selectOption('#cityFilter', 'Bengaluru');
  await expect(page.locator('.community-card')).toHaveCount(2);

  // Settle non-deterministic regions (chatbot, animations) before the shot.
  await hideDynamic(page);
  await page.evaluate(() => (document as any).fonts?.ready);
  await expect(page).toHaveScreenshot('communities-filter-bengaluru.png', { fullPage: true });
});
