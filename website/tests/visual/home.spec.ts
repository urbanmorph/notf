import { test, expect } from '@playwright/test';
import { auditPage } from './_helpers';
import { stubOaq, stubSupabase } from './fixtures';

test('home', async ({ page }, info) => {
  await auditPage(page, info, '/');
});

test('home "Cities" stat counts the cities communities and catalogue projects name', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'desktop-only behaviour test');
  await stubSupabase(page);
  await stubOaq(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  // The fixture's communities are in Bengaluru and Mumbai, which catalogue
  // projects also name, so the count is the catalogue's distinct cities.
  const expected = await page.evaluate(() =>
    new Set((window as any).CATALOG_PROJECTS.flatMap((p: any) => p.cities).concat(['Bengaluru', 'Mumbai'])).size,
  );
  await expect(page.locator('#statCities')).toHaveText(String(expected));
  await expect(page.locator('#cityItems')).toHaveCount(0);
  await expect(page.locator('#navMenu a[href="/cities/"]')).toHaveCount(0);
});
