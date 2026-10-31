// Admin Authentication Utilities
// Uses Supabase Auth for login/logout

// The direct project host. Kept as the fallback for non-browser contexts.
const SUPABASE_PROJECT_URL = 'https://abblyaukkoxmgzwretvm.supabase.co';

// Route admin auth, queries and Edge Function calls through the same-origin
// /api/supabase/* proxy, so an ISP block on *.supabase.co can't lock admins
// out. Same logic as resolveSupabaseUrl in /assets/js/data-loader.js.
function resolveSupabaseUrl(win) {
    const origin = win && win.location && win.location.origin;
    return origin && origin !== 'null' ? `${origin}/api/supabase` : SUPABASE_PROJECT_URL;
}
const SUPABASE_URL = resolveSupabaseUrl(typeof window !== 'undefined' ? window : undefined);
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiYmx5YXVra294bWd6d3JldHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMzE4NTQsImV4cCI6MjA4MzgwNzg1NH0.neJmkUmGFPfXMC5PZNRhaXIGEefj_b79L_YceXl5jxU';

// supabase-js names its session key after the URL hostname. Pin it to the key
// derived from the project host so existing admin sessions survive the switch
// to the proxy URL (which would otherwise derive "sb-www-auth-token").
const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_PROJECT_URL).hostname.split('.')[0]}-auth-token`;

// Lazy initialization of Supabase client
let supabaseClient = null;
function getSupabaseAuthClient() {
    if (!supabaseClient && window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { storageKey: AUTH_STORAGE_KEY }
        });
    }
    return supabaseClient;
}

// Check if user is authenticated
async function checkAuth() {
    const client = getSupabaseAuthClient();
    const { data: { session } } = await client.auth.getSession();
    return session;
}

// The signed-in user's NOTF role from their active admin_users row: 'admin'
// (read and change), 'viewer' (read only), or null (no NOTF access). The Edge
// Functions and RLS enforce the same roles server-side; the UI only follows.
async function getNotfRole(userId) {
    if (!userId) return null;
    const client = getSupabaseAuthClient();
    const { data, error } = await client
        .from('admin_users')
        .select('notf_role')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
    if (error) {
        console.error('admin_users role check failed:', error.message);
        return null;
    }
    return data?.notf_role === 'admin' || data?.notf_role === 'viewer' ? data.notf_role : null;
}

async function isActiveAdmin(userId) {
    return (await getNotfRole(userId)) !== null;
}

// Redirect to login if not signed in, or not a NOTF admin or viewer. Marks the
// page with the role (<html data-notf-role="viewer">) so CSS hides what viewers
// may not do.
async function requireAuth() {
    const session = await checkAuth();
    if (!session) {
        window.location.href = '/admin/login.html';
        return null;
    }
    const role = await getNotfRole(session.user?.id);
    document.documentElement.dataset.notfRole = role || '';
    window.authUtils.role = role;
    if (!role) {
        const client = getSupabaseAuthClient();
        await client.auth.signOut();
        window.location.href = '/admin/login.html?denied=1';
        return null;
    }
    return session;
}

// Login with email and password
async function login(email, password) {
    const client = getSupabaseAuthClient();
    const { data, error } = await client.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        throw error;
    }

    return data;
}

// Where the emailed "reset your password" link lands.
const RESET_PAGE = '/admin/reset-password.html';

// Email a reset link. Supabase answers the same for unknown emails, and the
// login page shows one neutral message either way; only rate limits surface.
async function requestPasswordReset(email) {
    const client = getSupabaseAuthClient();
    const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${RESET_PAGE}`
    });
    if (error && error.status === 429) throw error;
}

// Open the recovery session from the emailed link, which comes in one of two
// forms: ?token_hash=…&type=recovery (a custom email template; verified here,
// through the proxy) or Supabase's default #access_token=…&type=recovery, which
// supabase-js reads itself. Returns the session, or throws why the link failed.
async function startPasswordRecovery() {
    const client = getSupabaseAuthClient();
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get('error_description')) throw new Error(hash.get('error_description'));
    const tokenHash = query.get('token_hash');
    if (tokenHash && query.get('type') === 'recovery') {
        const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
        // The token works once; keep it out of the address bar and history.
        history.replaceState(null, '', window.location.pathname);
        if (error) throw error;
        return data.session;
    }
    const { data: { session } } = await client.auth.getSession();
    if (!session) throw new Error('This reset link is invalid or has expired.');
    return session;
}

// Save a new password for the signed-in (recovering) user, then sign out so the
// next sign-in uses it.
async function updatePassword(password) {
    const client = getSupabaseAuthClient();
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    await client.auth.signOut();
}

// Logout
async function logout() {
    const client = getSupabaseAuthClient();
    const { error } = await client.auth.signOut();
    if (error) {
        console.error('Logout error:', error);
    }
    // Redirect to home page
    window.location.href = '/';
}

// Get current user
async function getCurrentUser() {
    const client = getSupabaseAuthClient();
    const { data: { user } } = await client.auth.getUser();
    return user;
}

// Export functions
window.authUtils = {
    checkAuth,
    requireAuth,
    isActiveAdmin,
    getNotfRole,
    role: null,
    login,
    logout,
    requestPasswordReset,
    startPasswordRecovery,
    updatePassword,
    getCurrentUser,
    get supabase() { return getSupabaseAuthClient(); }  // Export as lazy getter
};
