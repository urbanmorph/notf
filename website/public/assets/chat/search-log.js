/**
 * Logs each "Find communities" search to Supabase (public.chat_searches): what
 * was typed and which records were shown, so search can be improved from real
 * questions. No visitor ID, IP or device details are sent, and phone numbers and
 * emails are blanked first. Admins read the table; rows are deleted after 90 days
 * (supabase/migrations/20261031120000_add_chat_searches.sql).
 *
 * Logging never gets in the way: if it fails, the search still works.
 */

const SEARCH_LOG_MAX_LENGTH = 200;

/** The query with emails and phone numbers blanked, trimmed to what the table accepts. */
function redactQuery(text) {
    return String(text ?? '')
        .replace(/[^\s@]+@[^\s@]+/g, '[email]')
        // Seven or more digits with spaces, dashes or brackets: a phone number,
        // not a pin code, ward or year. Same pattern the table's check refuses.
        .replace(/\+?[0-9][0-9 ().-]{6,}[0-9]/g, '[number]')
        .trim()
        .slice(0, SEARCH_LOG_MAX_LENGTH);
}

/** The row to store: only each shown record's slug, name and type. */
function searchLogRow({ query, results, city, lang, page }) {
    const shown = results.slice(0, 10);
    return {
        query: redactQuery(query),
        results: shown.map((r) => ({
            slug: r.slug || null,
            name: String(r.name || '').slice(0, 120),
            type: r.resourceType,
        })),
        result_count: shown.length,
        city: city || null,
        lang: String(lang || '').slice(0, 5) || null,
        page: String(page || '').slice(0, 100) || null,
    };
}

/** Send the row and forget it. */
function logSearch(row) {
    const client = window.dataLoader?.getSupabaseClient?.();
    if (!client || !row.query) return;
    client.from('chat_searches').insert(row).then(
        ({ error }) => { if (error) console.warn('[SearchLog] not logged:', error.message); },
        () => {}
    );
}
