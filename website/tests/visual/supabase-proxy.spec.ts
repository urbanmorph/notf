import { test, expect } from '@playwright/test';
import { stubSupabase, COMMUNITIES, PROVIDERS } from './fixtures';

// Behaviour test (no screenshot): public pages must reach Supabase only through
// the same-origin /api/supabase proxy, never the third-party *.supabase.co host.
// An ISP DNS block on that host made the homepage's live counts render as 0.
// Runs desktop-only; the page specs already cover layout at every viewport.
test.describe('supabase proxy', () => {
  test('homepage reads data via /api/supabase, never *.supabase.co', async ({ page, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'desktop-only behaviour test');

    const origin = new URL(baseURL!).origin;
    const direct: string[] = [];
    const proxied: string[] = [];
    const consoleErrors: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.hostname.endsWith('.supabase.co')) direct.push(req.url());
      if (url.origin === origin && url.pathname.startsWith('/api/supabase/rest/v1/file_metadata')) {
        proxied.push(url.search);
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
    });

    await stubSupabase(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    // Live counts come through the proxy (served from the fixture here).
    await expect(page.locator('#statCommunities')).toHaveText(String(COMMUNITIES.length));
    await expect(page.locator('#statProviders')).toHaveText(String(PROVIDERS.length));

    expect(proxied.some((q) => q.includes('file_type=eq.community')), 'no proxied communities call').toBe(true);
    expect(proxied.some((q) => q.includes('file_type=eq.solution-provider')), 'no proxied providers call').toBe(true);
    expect(direct, `direct *.supabase.co requests:\n${direct.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
