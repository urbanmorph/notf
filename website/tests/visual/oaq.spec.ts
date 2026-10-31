import { test, expect } from '@playwright/test';
import { stubOaq, stubSupabase } from './fixtures';

// Behaviour of the home page's OAQ card and the "Air Quality" menu link.
// The visual/a11y audit of the whole page lives in home.spec.ts.
test.describe('OAQ on the home page', () => {
  test.beforeEach(async ({ page }) => {
    await stubSupabase(page);
  });

  test('card shows live numbers from the OAQ mirror', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'desktop-only behaviour test');
    await stubOaq(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    const card = page.locator('#oaq');
    await card.scrollIntoViewIfNeeded();

    await expect(card.locator('#oaqStations')).toHaveText('8');
    await expect(card.locator('#oaqCities')).toHaveText('7');
    await expect(card.locator('#oaqNetworks')).toHaveText('3');
    await expect(card.locator('#oaqNow li')).toHaveCount(6);
    await expect(card.locator('#oaqNow li').first()).toContainText('Bengaluru');
    await expect(card.locator('#oaqNow li').first()).toContainText('130');
    // Only the two Bengaluru sensors fall on the Bengaluru outline (Mumbai's doesn't).
    await expect(card.locator('#oaqMap .oaq-map-dots circle')).toHaveCount(2);

    await expect(card.getByRole('link', { name: 'See the live map' })).toHaveAttribute('href', 'https://oaq.notf.in');
    await expect(card.getByRole('link', { name: /host a sensor/i })).toHaveAttribute(
      'href',
      'https://oaq.notf.in/deployments',
    );
  });

  test('card keeps its text and links when the mirror is down', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'desktop-only behaviour test');
    await page.route('https://mugilu.live/**', (route) => route.fulfill({ status: 503, body: '' }));
    await page.goto('/', { waitUntil: 'networkidle' });
    const card = page.locator('#oaq');
    await card.scrollIntoViewIfNeeded();

    await expect(card.locator('#oaqLive')).toBeHidden();
    await expect(card.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(card.getByRole('link', { name: /host a sensor/i })).toBeVisible();
  });

  test('main menu links to OAQ in a new tab', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'desktop-only behaviour test');
    await stubOaq(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    const link = page.locator('#navMenu a[href="https://oaq.notf.in"]');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toContainText('Air Quality');
  });

  test('home page no longer shows the climate stats bar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'desktop-only behaviour test');
    await stubOaq(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('.climate-stats-bar')).toHaveCount(0);
  });
});
