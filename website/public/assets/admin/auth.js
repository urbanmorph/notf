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

// Check whether a signed-in user is an active admin (the admin_users registry).
// This is the same membership gate the Edge Functions enforce server-side, so
// the UI and the write path agree on who is an admin.
async function isActiveAdmin(userId) {
    if (!userId) return false;
    const client = getSupabaseAuthClient();
    const { data, error } = await client
        .from('admin_users')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
    if (error) {
        console.error('admin_users membership check failed:', error.message);
        return false;
    }
    return !!data;
}

// Redirect to login if not authenticated OR not an active admin.
async function requireAuth() {
    const session = await checkAuth();
    if (!session) {
        window.location.href = '/admin/login.html';
        return null;
    }
    // A valid session is not enough — require active admin_users membership.
    const admin = await isActiveAdmin(session.user?.id);
    if (!admin) {
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
    login,
    logout,
    getCurrentUser,
    get supabase() { return getSupabaseAuthClient(); }  // Export as lazy getter
};
