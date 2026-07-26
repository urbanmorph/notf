import { expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { stubSupabase } from './fixtures';

/**
 * Standard page audit run on every spec across every viewport.
 * - Full-page screenshot diff
 * - No horizontal overflow
 * - Tap targets >= 44px (mobile only)
 * - Axe WCAG 2 A/AA scan
 * - Console errors fail the test
 */
export const HIDE_DYNAMIC_CSS = `
  #chat-fab, .chat-fab, .chat-widget, #chat-widget, #notf-chatbot, .chat-container { display: none !important; }
  [data-dynamic], .dynamic-counter, .stats-counter { visibility: hidden !important; }
  *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }
`;

export async function hideDynamic(page: Page): Promise<void> {
  await page.addStyleTag({ content: HIDE_DYNAMIC_CSS });
}

export async function auditPage(
  page: Page,
  testInfo: TestInfo,
  path: string,
  opts: { name?: string; waitFor?: string; skipAxe?: boolean; skipConsole?: boolean } = {},
): Promise<void> {
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
  });

  // Serve the DB from a fixed fixture so live prod data can't drift the layout.
  // Must be set up before navigation.
  await stubSupabase(page);

  await page.goto(path, { waitUntil: 'networkidle' });
  if (opts.waitFor) await page.waitForSelector(opts.waitFor, { timeout: 10000 });

  // Hide non-deterministic regions (chatbot, animated counters, dynamic data)
  // before any screenshot.
  await hideDynamic(page);
  // Settle layout (web fonts, lazy images)
  await page.evaluate(() => (document as any).fonts?.ready);
  await page.waitForTimeout(600);

  const screenshotName = `${opts.name ?? 'page'}.png`;
  await expect(page).toHaveScreenshot(screenshotName, { fullPage: true });

  // No horizontal overflow. Gated behind NOTF_STRICT_OVERFLOW for the PR 0
  // baseline (PR 1 fixes the known offenders and turns this on by default).
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  const hasOverflow = overflow.scrollWidth > overflow.innerWidth + 1;
  if (hasOverflow) {
    await testInfo.attach('horizontal-overflow', {
      body: JSON.stringify(overflow, null, 2),
      contentType: 'application/json',
    });
  }
  if (process.env.NOTF_STRICT_OVERFLOW) {
    expect(
      overflow.scrollWidth,
      `horizontal overflow: scrollWidth=${overflow.scrollWidth} > innerWidth=${overflow.innerWidth}`,
    ).toBeLessThanOrEqual(overflow.innerWidth + 1);
  }

  // Tap targets only checked on the small viewports.
  // Gated behind NOTF_STRICT_TAP — sitewide failures tracked in PR 1.
  // Always attached to the test report so we can see progress over time.
  const isMobile = (testInfo.project.use.viewport?.width ?? 1440) <= 480;
  if (isMobile) {
    const small = await page
      .locator('button:visible, a.btn:visible, [role="button"]:visible')
      .evaluateAll((els) =>
        els
          .filter((el) => !el.closest('.leaflet-container'))
          .map((el) => {
            const r = (el as HTMLElement).getBoundingClientRect();
            return { tag: el.tagName, h: r.height, w: r.width, text: (el.textContent ?? '').trim().slice(0, 30) };
          })
          .filter((e) => e.h > 0 && e.w > 0 && e.h < 44),
      );
    if (small.length) {
      await testInfo.attach('tap-targets-under-44', {
        body: JSON.stringify(small, null, 2),
        contentType: 'application/json',
      });
    }
    if (process.env.NOTF_STRICT_TAP) {
      expect(
        small,
        `tap targets under 44px:\n${JSON.stringify(small, null, 2)}`,
      ).toEqual([]);
    }
  }

  if (!opts.skipAxe) {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules([
        // Still excluded: landmark structure on the injected header/footer.
        // Tracked separately; not in scope for the audit PRs.
        'region',
      ])
      .exclude('#chat-fab')
      .exclude('.chat-fab')
      .exclude('.chat-widget')
      .exclude('#chat-widget')
      .exclude('.chat-container')
      .exclude('#notf-chatbot')
      .exclude('.chat-tips')
      .exclude('.leaflet-container') // 3rd-party Leaflet controls
      .analyze();
    expect(
      results.violations,
      `axe violations:\n${results.violations
        .map((v) => `  - ${v.id}: ${v.help} (${v.nodes.length} nodes)`)
        .join('\n')}`,
    ).toEqual([]);
  }

  if (!opts.skipConsole) {
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  }
}
