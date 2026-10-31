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

  // Find communities on a page that does not load city-map.js itself (About): the
  // chatbot loads the community data and the city helpers on its own.
  test('a city in the question keeps answers to that city', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'desktop-only behavior test');
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await stubSupabase(page);
    // Record what the search log sends (registered last, so it wins over the stub).
    const logged: Array<Record<string, unknown>> = [];
    await page.route('**/rest/v1/chat_searches**', (route) => {
      logged.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
    });
    await page.goto('/about/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.notfChatbot, null, { timeout: 10000 });
    await page.locator('.intent-button[data-intent="discovery"]').click();
    await expect(page.locator('.chat-messages')).toContainText('What are you looking for?');
    await expect(page.locator('.chat-privacy-note')).toContainText('not who you are');

    const replies = page.locator('.chat-messages .bot-message');
    const ask = async (question: string) => {
      const before = await replies.count();
      await page.fill('.chat-input-field', question);
      await page.click('.chat-send-button');
      await expect(replies).toHaveCount(before + 1);
      return replies.nth(before);
    };

    // Only Mumbai's communities, and a link to Mumbai's view of /communities/.
    const mumbai = await ask('communities in Mumbai');
    await expect(mumbai).toContainText('in Mumbai for you');
    const places = await mumbai.locator('.community-card .location').allInnerTexts();
    expect(places.length).toBeGreaterThan(0);
    for (const place of places) expect(place).toContain('Mumbai');
    await expect(mumbai.locator('a[href="/communities/?city=Mumbai"]')).toContainText('See the 1 community in Mumbai');

    // Nobody registered: say so, rather than list other cities.
    const kolkata = await ask('waste groups in Calcutta');
    await expect(kolkata).toContainText('no registered communities or solution providers in Kolkata yet');
    await expect(kolkata.locator('.community-card')).toHaveCount(0);
    await expect(kolkata.locator('a[href="/join/"]')).toBeVisible();

    // Live readings live on oaq.notf.in.
    const air = await ask('air quality');
    await expect(air.locator('a[href="https://oaq.notf.in"]')).toBeVisible();

    // Everyday words in other languages find the same records: Hindi for "garbage".
    const waste = await ask('कचरा');
    await expect(waste.locator('.community-card h4').first()).toBeVisible();
    await expect(waste).toContainText('Green Glen Collective');

    // Each search is logged with what was shown, and phone numbers are blanked.
    await ask('call 98450 12345 about lakes');
    await expect.poll(() => logged.length).toBe(5);
    expect(logged[0]).toMatchObject({ query: 'communities in Mumbai', city: 'Mumbai', page: '/about/', lang: 'en' });
    expect(logged[0].result_count).toBe((logged[0].results as unknown[]).length);
    expect(Object.keys((logged[0].results as object[])[0]).sort()).toEqual(['name', 'slug', 'type']);
    expect(logged[1]).toMatchObject({ query: 'waste groups in Calcutta', city: 'Kolkata', result_count: 0, results: [] });
    expect(logged[4].query).toBe('call [number] about lakes');

    expect(errors).toEqual([]);
  });
});
