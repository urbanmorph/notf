import { test, expect } from '@playwright/test';
import { auditPage, hideDynamic } from './_helpers';
import { stubSupabase } from './fixtures';

test('communities listing', async ({ page }, info) => {
  await auditPage(page, info, '/communities/');
});

test('communities search filters cards', async ({ page }) => {
  // Serve the fixed fixture (2 Bengaluru + 1 Mumbai community) so the
  // filtered result can't drift with live prod data — the same stub every
  // other visual spec uses via auditPage. Must be set up before navigation.
  await stubSupabase(page);
  await page.goto('/communities/', { waitUntil: 'networkidle' });

  const search = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
  if (await search.count()) {
    await search.fill('bengaluru');
    // Wait for the 200 ms-debounced re-render to settle to the filtered
    // count (2 Bengaluru communities in the fixture) rather than a brittle
    // fixed sleep. toHaveCount auto-retries until the grid re-renders.
    await expect(page.locator('.community-card')).toHaveCount(2);
    // Settle non-deterministic regions (chatbot, animations) before the shot.
    await hideDynamic(page);
    await page.evaluate(() => (document as any).fonts?.ready);
    await expect(page).toHaveScreenshot('communities-search-bengaluru.png', { fullPage: true });
  }
});
