import { test, expect } from '@playwright/test';
import { fakeSession, instrument } from './admin-fixtures';

// Behaviour tests (no screenshot) for "Forgot password": the request and the reset
// both go through the same-origin /api/supabase proxy, the request never reveals
// whether an email is an admin, and the reset page handles both link formats.
// Desktop-only; the login screenshot is covered by admin.spec.ts.

const NEUTRAL = 'If that email belongs to a NOTF admin, we have sent a link to reset the password.';

test.describe('admin password reset', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'desktop-only behaviour test');
  });

  test('"Forgot password?" emails a link back to the reset page', async ({ page, baseURL }) => {
    const { direct, consoleErrors } = await instrument(page);
    await page.route('**/api/supabase/auth/v1/recover**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await page.goto('/admin/login.html', { waitUntil: 'networkidle' });
    await page.fill('#email', 'admin@example.org');
    await page.click('#forgotLink');
    // The email typed for sign-in carries over.
    await expect(page.locator('#resetEmail')).toHaveValue('admin@example.org');

    const recover = page.waitForRequest('**/api/supabase/auth/v1/recover**');
    await page.click('#resetBtn');
    const req = await recover;
    expect(req.method()).toBe('POST');
    expect(req.postDataJSON().email).toBe('admin@example.org');
    expect(new URL(req.url()).searchParams.get('redirect_to')).toBe(`${new URL(baseURL!).origin}/admin/reset-password.html`);
    await expect(page.locator('#resetStatus')).toHaveText(NEUTRAL);

    expect(direct).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('an unknown email gets the same answer as a known one', async ({ page }) => {
    await page.route('**/api/supabase/auth/v1/recover**', (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 400, msg: 'User not found' }) }),
    );
    await page.goto('/admin/login.html', { waitUntil: 'networkidle' });
    await page.click('#forgotLink');
    await page.fill('#resetEmail', 'nobody@example.org');
    await page.click('#resetBtn');
    await expect(page.locator('#resetStatus')).toHaveText(NEUTRAL);
  });

  test('too many requests says to wait', async ({ page }) => {
    await page.route('**/api/supabase/auth/v1/recover**', (route) =>
      route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ code: 429, error_code: 'over_email_send_rate_limit', msg: 'rate limit' }) }),
    );
    await page.goto('/admin/login.html', { waitUntil: 'networkidle' });
    await page.click('#forgotLink');
    await page.fill('#resetEmail', 'admin@example.org');
    await page.click('#resetBtn');
    await expect(page.locator('#resetStatus')).toContainText('Too many requests');
  });

  test('the login page explains a finished reset and a non-admin account', async ({ page }) => {
    await page.goto('/admin/login.html?reset=done', { waitUntil: 'networkidle' });
    await expect(page.locator('#notice')).toContainText('Password updated');
    await page.goto('/admin/login.html?denied=1', { waitUntil: 'networkidle' });
    await expect(page.locator('#notice')).toContainText('not an active NOTF admin');
  });

  test('a token_hash link opens the reset form; a new password is saved and the admin signed out', async ({ page }) => {
    const { direct, consoleErrors } = await instrument(page);
    const calls: string[] = [];
    await page.route('**/api/supabase/auth/v1/verify**', (route) => {
      const { token_hash, type } = route.request().postDataJSON();
      calls.push(`verify ${type} ${token_hash}`);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession()) });
    });
    await page.route('**/api/supabase/auth/v1/user**', (route) => {
      calls.push(`${route.request().method()} user ${route.request().postDataJSON()?.password}`);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession().user) });
    });
    await page.route('**/api/supabase/auth/v1/logout**', (route) => {
      calls.push('logout');
      return route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/admin/reset-password.html?token_hash=abc123&type=recovery', { waitUntil: 'networkidle' });
    await expect(page.locator('#resetForm')).toBeVisible();
    // The one-time token is removed from the address bar once used.
    expect(new URL(page.url()).search).toBe('');

    await page.fill('#newPassword', 'a-new-password');
    await page.fill('#confirmPassword', 'a-different-one');
    await page.click('#saveBtn');
    await expect(page.locator('#formError')).toContainText('do not match');

    await page.fill('#newPassword', 'short');
    await page.fill('#confirmPassword', 'short');
    await page.click('#saveBtn');
    await expect(page.locator('#formError')).toContainText('at least 8');

    await page.fill('#newPassword', 'a-new-password');
    await page.fill('#confirmPassword', 'a-new-password');
    await page.click('#saveBtn');
    await page.waitForURL('**/admin/login.html?reset=done');

    expect(calls).toEqual([
      'verify recovery abc123',
      'PUT user a-new-password',
      'logout',
    ]);
    expect(direct).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('the default emailed link (#access_token=…) also opens the form', async ({ page }) => {
    const s = fakeSession();
    await page.route('**/api/supabase/auth/v1/user**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s.user) }),
    );
    await page.goto(
      `/admin/reset-password.html#access_token=${s.access_token}&expires_in=3600&expires_at=${s.expires_at}` +
        `&refresh_token=${s.refresh_token}&token_type=bearer&type=recovery`,
      { waitUntil: 'networkidle' },
    );
    await expect(page.locator('#resetForm')).toBeVisible();
  });

  test('an expired or missing link says so and offers a new one', async ({ page }) => {
    await page.goto('/admin/reset-password.html#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', { waitUntil: 'networkidle' });
    await expect(page.locator('#linkProblem')).toBeVisible();
    await expect(page.locator('#linkProblem')).toContainText('invalid or has expired');
    await expect(page.locator('#resetForm')).toBeHidden();
    await page.goto('/admin/reset-password.html', { waitUntil: 'networkidle' });
    await expect(page.locator('#linkProblem')).toBeVisible();
    await expect(page.locator('#linkProblem a[href="/admin/login.html?forgot=1"]')).toBeVisible();
  });
});
