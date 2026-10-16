// Supabase Data Loader for Public Pages
// Loads data client-side from Supabase

// The direct project host. Kept as the fallback for non-browser contexts.
const SUPABASE_PROJECT_URL = 'https://abblyaukkoxmgzwretvm.supabase.co';

// Route every Supabase call through a same-origin path (/api/supabase/*) that
// our own origin proxies to the project: Vercel via a rewrite (vercel.json) in
// production, and Vite via server.proxy in dev. Some ISPs (observed on ACT
// Fibernet) DNS-block *.supabase.co to a sinkhole, so the browser's direct
// calls failed with ERR_CONNECTION_CLOSED and the homepage counts rendered
// empty. Talking only to our own domain sidesteps any third-party host block.
// The anon key is public (RLS-gated), so nothing secret is exposed by proxying.
const SUPABASE_URL = (typeof window !== 'undefined' && window.location && window.location.origin)
    ? `${window.location.origin}/api/supabase`
    : SUPABASE_PROJECT_URL;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiYmx5YXVra294bWd6d3JldHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMzE4NTQsImV4cCI6MjA4MzgwNzg1NH0.neJmkUmGFPfXMC5PZNRhaXIGEefj_b79L_YceXl5jxU';

// Initialize Supabase client (lazy initialization)
let supabasePublic = null;
function getSupabaseClient() {
    if (!supabasePublic && window.supabase) {
        supabasePublic = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabasePublic;
}

// Simple in-memory cache to prevent duplicate API calls
const _cache = {};

// Load all solution providers
async function loadSolutionProviders() {
    const cacheKey = 'solutionProviders';
    if (_cache[cacheKey]) return _cache[cacheKey];
    const supabase = getSupabaseClient();
    if (!supabase) {
        console.error('Supabase client not initialized');
        return [];
    }

    const { data, error } = await supabase
        .from('file_metadata')
        .select('*')
        .eq('file_type', 'solution-provider')
        .eq('status', 'active')
        .order('slug', { ascending: true });

    if (error) {
        console.error('Error loading solution providers:', error);
        return [];
    }

    const result = (data || []).map(item => ({
        slug: item.slug,
        name: item.metadata?.name || item.slug,
        type: 'solution-provider',
        theme: item.metadata?.theme || '',
        location: item.metadata?.location || '',
        city: extractCity(item.metadata?.location),
        neighborhoods: item.metadata?.neighborhoods || [],
        description: item.metadata?.description || '',
        contact: item.metadata?.contact || {},
        offers: item.metadata?.offers || [],
        asks: item.metadata?.asks || [],
        infrastructure_offers: item.metadata?.infrastructure_offers || [],
        stories: item.metadata?.stories || null,
        latitude: item.latitude || null,
        longitude: item.longitude || null,
        neighborhood: item.neighborhood || null,
        ward: item.ward || null
    }));
    _cache[cacheKey] = result;
    return result;
}

// Load all communities
async function loadCommunities(cityFilter = null) {
    const cacheKey = `communities_${cityFilter || 'all'}`;
    if (_cache[cacheKey]) return _cache[cacheKey];

    const supabase = getSupabaseClient();
    if (!supabase) {
        console.error('Supabase client not initialized');
        return [];
    }

    let query = supabase
        .from('file_metadata')
        .select('*')
        .eq('file_type', 'community')
        .eq('status', 'active')
        .order('slug', { ascending: true });

    if (cityFilter) {
        query = query.eq('city', cityFilter);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error loading communities:', error);
        return [];
    }

    const result = (data || []).map(item => ({
        slug: item.slug,
        name: item.metadata?.name || item.slug,
        type: 'community',
        city: item.city || item.metadata?.city || '',
        state: item.metadata?.state || '',
        neighborhood: item.neighborhood || item.metadata?.neighborhood || '',
        themes: item.metadata?.themes || [],
        domains: item.metadata?.domains || [],
        description: item.metadata?.description || '',
        contact: item.metadata?.contact || {},
        offers: item.metadata?.offers || [],
        asks: item.metadata?.asks || [],
        stories: item.metadata?.stories || null,
        latitude: item.latitude || null,
        longitude: item.longitude || null,
        ward: item.ward || null
    }));
    _cache[cacheKey] = result;
    return result;
}

// Load all stories
async function loadStories(cityFilter = null) {
    const cacheKey = `stories_${cityFilter || 'all'}`;
    if (_cache[cacheKey]) return _cache[cacheKey];

    const supabase = getSupabaseClient();
    if (!supabase) {
        console.error('Supabase client not initialized');
        return [];
    }

    let query = supabase
        .from('file_metadata')
        .select('*')
        .eq('file_type', 'story')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    if (cityFilter) {
        query = query.eq('city', cityFilter);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error loading stories:', error);
        return [];
    }

    const result = (data || []).map(item => ({
        slug: item.slug,
        title: item.metadata?.title || item.slug,
        type: 'story',
        city: item.city || item.metadata?.city || '',
        community: item.metadata?.community || '',
        location: item.metadata?.location || '',
        themes: item.metadata?.themes || [],
        excerpt: item.metadata?.excerpt || '',
        content: item.metadata?.content || '',
        youtube_url: item.metadata?.youtube_url || null,
        created_at: item.created_at || null
    }));
    _cache[cacheKey] = result;
    return result;
}

// Get unique cities from communities
async function getCities() {
    const supabase = getSupabaseClient();
    if (!supabase) {
        console.error('Supabase client not initialized');
        return [];
    }

    const { data, error } = await supabase
        .from('file_metadata')
        .select('city')
        .eq('file_type', 'community')
        .eq('status', 'active')
        .not('city', 'is', null);

    if (error) {
        console.error('Error loading cities:', error);
        return [];
    }

    const cities = [...new Set(data.map(item => item.city).filter(c => c))];
    return cities.sort();
}

// Helper: Extract city from location string
function extractCity(location) {
    if (!location) return '';
    const parts = location.split(',');
    return parts[parts.length - 1].trim();
}

// Helper: Format date
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });
}

// Helper: Format domains/themes
function formatDomains(domains) {
    if (!domains || !Array.isArray(domains)) return '';
    return domains.map(d => {
        if (typeof d === 'string') {
            return d.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        return d;
    }).join(', ');
}

// Wait for Supabase library to be ready
async function waitForSupabase(maxAttempts = 50) {
    for (let i = 0; i < maxAttempts; i++) {
        if (window.supabase) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.error('Supabase library failed to load');
    return false;
}

// Initialize and populate global data cache for chatbot and other components
async function initializeGlobalData() {
    try {
        await waitForSupabase();

        console.log('[DataLoader] Loading communities, providers, and stories...');

        // Load communities, providers, and stories in parallel
        const [communities, providers, stories] = await Promise.all([
            loadCommunities(),
            loadSolutionProviders(),
            loadStories()
        ]);

        // Populate global data object
        window.notfData = {
            communities: communities,
            members: providers, // Alias for backward compatibility
            providers: providers,
            stories: stories,
            lastUpdated: new Date().toISOString()
        };

        console.log(`[DataLoader] Loaded ${communities.length} communities, ${providers.length} providers, ${stories.length} stories`);
        return true;
    } catch (error) {
        console.error('[DataLoader] Failed to initialize global data:', error);
        return false;
    }
}

// Auto-initialize on pages that need it (those with chatbot)
if (document.querySelector('#notf-chatbot, #chat-fab')) {
    console.log('[DataLoader] Chatbot detected, initializing global data...');
    initializeGlobalData();
}

// Export for use in pages
window.dataLoader = {
    getSupabaseClient,
    loadSolutionProviders,
    loadCommunities,
    loadStories,
    getCities,
    formatDate,
    formatDomains,
    extractCity,
    waitForSupabase,
    initializeGlobalData
};
