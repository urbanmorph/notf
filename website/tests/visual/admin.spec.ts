import { test } from '@playwright/test';
import { auditPage } from './_helpers';

// Admin pages are gated by login; we screenshot the login screen as a baseline.
// Logged-in flows are added in PR 5 once a test admin seed exists.
test('admin login', async ({ page }, info) => {
  await auditPage(page, info, '/admin/login.html');
});

// Opened without an emailed link, the reset page shows its "invalid or expired
// link" state, which needs no auth stub and renders the same on every run.
test('admin reset password', async ({ page }, info) => {
  await auditPage(page, info, '/admin/reset-password.html', { name: 'reset-password' });
});
