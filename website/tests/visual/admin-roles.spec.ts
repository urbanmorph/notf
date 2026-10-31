import { test, expect, type Page } from '@playwright/test';
import { LEGACY_AUTH_KEY, fakeSession } from './admin-fixtures';
import { stubSupabase } from './fixtures';

// Behaviour tests (no screenshot) for NOTF admin roles: viewers get a read-only
// admin, accounts without a NOTF role are turned away, and admins manage admins
// and viewers on the Admins page through the manage-admins Edge Function.
// The server (RLS + Edge Functions) enforces the same rules; these check the UI.

const ME = fakeSession().user.id;

async function signInAs(page: Page, notfRole: 'admin' | 'viewer' | null) {
  await stubSupabase(page);
  // Seed the session on the first page only, so a sign-out sticks across redirects.
  await page.addInitScript(
    ([key, session]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(key as string, session as string);
    },
    [LEGACY_AUTH_KEY, JSON.stringify(fakeSession())],
  );
  await page.route('**/api/supabase/rest/v1/admin_users**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(notfRole ? { notf_role: notfRole } : null),
    }),
  );
}

const ADMINS = [
  { id: 'a1', user_id: ME, name: 'Me', email: 'me@example.org', role: 'super_admin', notf_role: 'admin', is_active: true, last_sign_in_at: '2026-10-31T10:00:00Z' },
  { id: 'a2', user_id: 'u2', name: 'Asha', email: 'asha@example.org', role: 'field_officer', notf_role: 'viewer', is_active: true, last_sign_in_at: null },
  { id: 'a3', user_id: 'u3', name: 'Ravi', email: 'ravi@example.org', role: 'field_officer', notf_role: 'admin', is_active: false, last_sign_in_at: null },
];

test.describe('admin roles', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'desktop-only behaviour test');
  });

  test('a viewer sees communities without edit, delete or status buttons', async ({ page }) => {
    await signInAs(page, 'viewer');
    await page.goto('/admin/communities.html', { waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('data-notf-role', 'viewer');
    await expect(page.locator('.mini-icon-btn.view').first()).toBeVisible();
    for (const cls of ['edit', 'delete', 'activate', 'deactivate']) {
      await expect(page.locator(`.mini-icon-btn.${cls}:visible`)).toHaveCount(0);
    }
    await expect(page.locator('[onclick^="showCreateForm"]')).toBeHidden();
  });

  test('an admin sees the edit buttons', async ({ page }) => {
    await signInAs(page, 'admin');
    await page.goto('/admin/communities.html', { waitUntil: 'networkidle' });
    await expect(page.locator('.mini-icon-btn.edit').first()).toBeVisible();
  });

  test('an account without a NOTF role is sent back to sign in', async ({ page }) => {
    await signInAs(page, null);
    await page.route('**/api/supabase/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.goto('/admin/communities.html');
    await page.waitForURL('**/admin/login.html?denied=1');
  });

  test('the dashboard hides Admins and Geocoding from viewers', async ({ page }) => {
    await signInAs(page, 'viewer');
    await page.goto('/admin/index.html', { waitUntil: 'networkidle' });
    await expect(page.locator('.nav-item[data-page="communities"]')).toBeVisible();
    await expect(page.locator('.nav-item[data-page="admins"]')).toBeHidden();
    await expect(page.locator('.nav-item[data-page="geocode"]')).toBeHidden();
  });

  test('admins list admins, invite, and change access; super admins and yourself are locked', async ({ page }) => {
    await signInAs(page, 'admin');
    const calls: Array<Record<string, unknown>> = [];
    await page.route('**/api/supabase/functions/v1/manage-admins', (route) => {
      const body = route.request().postDataJSON();
      calls.push(body);
      const reply = body.action === 'list' ? { me: ME, admins: ADMINS } : { ok: true, invited: true };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
    });

    await page.goto('/admin/admins.html', { waitUntil: 'networkidle' });
    await expect(page.locator('#adminCount')).toHaveText('(3)');
    const rows = page.locator('.admin-row');
    await expect(rows.nth(0)).toContainText('You');
    await expect(rows.nth(0).locator('select')).toHaveCount(0);
    await expect(rows.nth(1)).toContainText('Viewer');
    await expect(rows.nth(2)).toContainText('inactive');

    await page.fill('#inviteName', 'Sonal');
    await page.fill('#inviteEmail', 'sonal@example.org');
    await page.selectOption('#inviteRole', 'admin');
    await page.click('#inviteBtn');
    await expect(page.locator('#inviteStatus')).toHaveText('Invitation sent to sonal@example.org.');

    await rows.nth(1).locator('select').selectOption('admin');
    await expect.poll(() => calls.filter((c) => c.action === 'update').length).toBe(1);
    await page.locator('.admin-row').nth(2).getByRole('button', { name: 'Reactivate' }).click();
    await expect.poll(() => calls.filter((c) => c.action === 'update').length).toBe(2);

    expect(calls.filter((c) => c.action !== 'list')).toEqual([
      { action: 'invite', name: 'Sonal', email: 'sonal@example.org', notf_role: 'admin' },
      { action: 'update', id: 'a2', notf_role: 'admin' },
      { action: 'update', id: 'a3', is_active: true },
    ]);
  });

  test('a refused change shows the reason', async ({ page }) => {
    await signInAs(page, 'admin');
    await page.route('**/api/supabase/functions/v1/manage-admins', (route) => {
      const body = route.request().postDataJSON();
      return body.action === 'list'
        ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ me: ME, admins: ADMINS }) })
        : route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Choose admin or viewer.' }) });
    });
    await page.goto('/admin/admins.html', { waitUntil: 'networkidle' });
    await page.fill('#inviteName', 'X');
    await page.fill('#inviteEmail', 'x@example.org');
    await page.click('#inviteBtn');
    await expect(page.locator('#inviteStatus')).toHaveText('Choose admin or viewer.');
  });

  test('a viewer opening the Admins page is told only admins can manage admins', async ({ page }) => {
    await signInAs(page, 'viewer');
    await page.goto('/admin/admins.html', { waitUntil: 'networkidle' });
    await expect(page.locator('#adminList')).toContainText('Only NOTF admins can manage admins.');
    await expect(page.locator('#inviteForm')).toBeHidden();
  });
});
