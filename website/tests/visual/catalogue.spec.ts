import { test, expect } from '@playwright/test';
import { auditPage, hideDynamic } from './_helpers';

test('catalogue', async ({ page }, info) => {
  await auditPage(page, info, '/catalog/');
});

test('catalogue city map filters projects by where they have run', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'desktop-only behaviour test');
  await page.goto('/catalog/', { waitUntil: 'networkidle' });
  await hideDynamic(page);
  const map = page.locator('#cityMap');
  const visible = page.locator('.theme-card-item:not(.hidden)');
  const total = await visible.count();

  // The catalogue's own data decides the expected count, so adding a project
  // doesn't break this test.
  const inMumbai = await page.evaluate(
    () => (window as any).CATALOG_PROJECTS.filter((p: any) => p.cities.includes('Mumbai')).length,
  );
  expect(inMumbai).toBeGreaterThan(0);

  await map.locator('.city-chip[data-city="Mumbai"]').click();
  await expect(visible).toHaveCount(inMumbai);

  // Less busy cities sit behind "More cities" until it's pressed.
  const quiet = map.locator('.city-chip.is-extra').first();
  await expect(quiet).toBeHidden();
  await map.locator('.city-chips-more').click();
  await expect(quiet).toBeVisible();
  await expect(map.locator('.city-chips-more')).toHaveAttribute('aria-expanded', 'true');

  await map.locator('.city-chip[data-city=""]').click();
  await expect(visible).toHaveCount(total);
});
