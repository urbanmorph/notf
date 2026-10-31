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

  // Settle non-deterministic regions first: the chatbot panel opens over the
  // page on small screens and would take the chip click.
  await hideDynamic(page);

  // Whole fixture renders first.
  await expect(page.locator('.community-card')).toHaveCount(3);

  // Pick Bengaluru on the city map's chips, which filter by exact city
  // (deterministic), rather than the fuzzy search box. toHaveCount auto-retries
  // until the grid re-renders.
  await page.locator('#cityMap .city-chip[data-city="Bengaluru"]').click();
  await expect(page.locator('.community-card')).toHaveCount(2);
  await expect(page).toHaveURL(/[?&]city=Bengaluru/);

  await page.evaluate(() => (document as any).fonts?.ready);
  await expect(page).toHaveScreenshot('communities-filter-bengaluru.png', { fullPage: true });
});

test('city map shows a bubble per city and a ?city= link opens filtered', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'desktop-only behaviour test');
  await stubSupabase(page);
  await page.goto('/communities/?city=Mumbai', { waitUntil: 'networkidle' });
  await hideDynamic(page);

  const map = page.locator('#cityMap');
  await expect(map.locator('.city-bubble')).toHaveCount(2);
  await expect(map.locator('.city-chip[data-city="Mumbai"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.community-card')).toHaveCount(1);

  // Clicking the selected bubble again clears the filter.
  await map.locator('.city-bubble[data-city="Mumbai"]').click();
  await expect(page.locator('.community-card')).toHaveCount(3);
  await expect(map.locator('.city-chip[data-city=""]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).not.toHaveURL(/city=/);
});
