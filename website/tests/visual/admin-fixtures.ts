import type { Page } from '@playwright/test';

// Shared by the admin behaviour specs: a fake Supabase session, and a recorder
// for direct *.supabase.co traffic and console errors.

export const LEGACY_AUTH_KEY = 'sb-abblyaukkoxmgzwretvm-auth-token';

function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

export function fakeSession() {
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
export async function instrument(page: Page) {
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
