import { test, expect, type Page } from '@playwright/test';

// Behaviour tests (no screenshot): admin auth must go through the same-origin
// /api/supabase proxy, never the third-party *.supabase.co host (ISP DNS blocks
// on that host would lock admins out), and must keep using the session storage
// key supabase-js derived before the switch, so existing sessions survive.
// Desktop-only; the admin login screenshot is covered by admin.spec.ts.

const LEGACY_AUTH_KEY = 'sb-abblyaukkoxmgzwretvm-auth-token';

function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function fakeSession() {
  const now = Math.floor(Date.now() / 1000);
  const user = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'admin@example.org' };
  return {
    access_token: `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: user.id, exp: now + 3600, role: 'authenticated' })}.sig`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'fake-refresh-token',
    user,
  };
}

// Record direct *.supabase.co traffic and console errors; stub the dashboard so
// the post-login redirect lands on a static page instead of running admin code.
async function instrument(page: Page) {
  const direct: string[] = [];
  const consoleErrors: string[] = [];
  page.on('request', (req) => {
    if (new URL(req.url()).hostname.endsWith('.supabase.co')) direct.push(req.url());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
  });
  await page.route('**/admin/index.html', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>dashboard stub</title>' }),
  );
  return { direct, consoleErrors };
}

test.describe('admin supabase proxy', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'desktop-only behaviour test');
  });

  test('login posts to /api/supabase and stores the session under the legacy key', async ({ page, baseURL }) => {
    const { direct, consoleErrors } = await instrument(page);
    await page.route('**/api/supabase/auth/v1/token**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession()) }),
    );

    await page.goto('/admin/login.html', { waitUntil: 'networkidle' });
    await page.fill('#email', 'admin@example.org');
    await page.fill('#password', 'correct horse battery staple');
    const tokenReq = page.waitForRequest('**/api/supabase/auth/v1/token**');
    await page.click('#loginBtn');
    const req = await tokenReq;

    const url = new URL(req.url());
    expect(url.origin).toBe(new URL(baseURL!).origin);
    expect(url.pathname).toBe('/api/supabase/auth/v1/token');
    expect(url.searchParams.get('grant_type')).toBe('password');
    expect(req.method()).toBe('POST');

    await page.waitForURL('**/admin/index.html');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).toContain(LEGACY_AUTH_KEY);
    expect(keys.filter((k) => k.startsWith('sb-') && k !== LEGACY_AUTH_KEY)).toEqual([]);

    expect(direct, `direct *.supabase.co requests:\n${direct.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('an admin already signed in before the switch stays signed in', async ({ page }) => {
    const { direct, consoleErrors } = await instrument(page);
    const authCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/auth/v1/')) authCalls.push(req.url());
    });
    // Seed a pre-existing session exactly where the old client stored it.
    await page.addInitScript(
      ([key, session]) => localStorage.setItem(key as string, session as string),
      [LEGACY_AUTH_KEY, JSON.stringify(fakeSession())],
    );

    await page.goto('/admin/login.html');
    // login.html sends signed-in users straight to the dashboard.
    await page.waitForURL('**/admin/index.html');

    expect(authCalls, 'session was not read from storage (a network auth call happened)').toEqual([]);
    expect(direct, `direct *.supabase.co requests:\n${direct.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
