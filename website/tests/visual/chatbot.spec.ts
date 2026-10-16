import { test, expect } from '@playwright/test';
import { stubSupabase } from './fixtures';

// Interactive smoke test for the unified chatbot after the PR 5 split
// (complaint mode extracted into modes/complaint.js mixin).
// Runs desktop-only — we don't need the full 5-viewport grid for a
// behavior test. The visual harness already covers the FAB appearance
// at every viewport via the other page specs.
test.describe('chatbot', () => {
  test('FAB opens widget; complaint mixin loaded', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'desktop-only behavior test');
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
    });

    // Serve the DB from the fixed fixture, like every other spec. Without it the
    // homepage's data-loader calls go to the network: that is flaky, and now that
    // those calls are same-origin (/api/supabase/*) they 404 against the static
    // test server instead of silently resolving. Intercept them here too.
    await stubSupabase(page);

    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for chatbot loader to inject the widget and finish loading scripts.
    await page.waitForFunction(() => !!window.notfChatbot, null, { timeout: 10000 });

    // Complaint mode methods should be present on the instance — proves the
    // mixin from modes/complaint.js was applied.
    const hasComplaintMethods = await page.evaluate(() => {
      const c: any = (window as any).notfChatbot;
      return (
        typeof c.initializeComplaintMode === 'function' &&
        typeof c.processComplaintMessage === 'function' &&
        typeof c.showComplaintReview === 'function' &&
        typeof c.submitComplaint === 'function' &&
        typeof c.geocodeAddress === 'function' &&
        typeof c.extractCityFromAddress === 'function' &&
        typeof c.showMapModal === 'function'
      );
    });
    expect(hasComplaintMethods, 'complaint mixin not mixed in').toBe(true);

    // Chatbot widget should be visible (it opens on load by default).
    const widget = page.locator('#notf-chatbot-widget, .chat-widget').first();
    await expect(widget).toBeVisible();

    // Resize handle should have role=separator (axe aria-prohibited-attr fix).
    const handleRole = await page.locator('.chat-resize-handle').first().getAttribute('role');
    expect(handleRole).toBe('separator');

    // No JS errors during load.
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
