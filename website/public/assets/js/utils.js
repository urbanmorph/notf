/**
 * Shared utility functions used across NOTF website.
 */

/** Generate a URL-safe slug from text */
function generateSlug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Validate email address */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Generate a reference number (NOTF-YYYY-NNNN) */
function generateRefNumber() {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `NOTF-${year}-${rand}`;
}

/**
 * Build a standardized join record for Supabase file_metadata table.
 * Used by both the join form and chatbot onboarding.
 */
function buildJoinRecord(data) {
    const slug = generateSlug(data.name);
    return {
        file_path: `${data.type === 'community' ? 'communities' : 'solution-providers'}/${slug}.md`,
        file_type: data.type === 'community' ? 'community' : 'solution-provider',
        slug: slug,
        city: data.city || null,
        neighborhood: data.neighborhood || null,
        status: 'pending',
        metadata: {
            name: data.name,
            city: data.city || '',
            neighborhood: data.neighborhood || '',
            description: data.description || '',
            themes: data.themes || [],
            contact: {
                person: data.contactPerson || '',
                email: data.email || '',
                phone: data.phone || ''
            },
            website: data.website || '',
            offers: data.offers ? (Array.isArray(data.offers) ? data.offers : [data.offers]) : [],
            asks: data.asks ? (Array.isArray(data.asks) ? data.asks : [data.asks]) : [],
            submitted_via: data.source || 'join_form',
            submitted_at: new Date().toISOString()
        }
    };
}

/** True if a Supabase/Postgres error is a unique-constraint violation (23505). */
function isUniqueViolation(error) {
    if (!error) return false;
    const code = error.code || '';
    const msg = (error.message || '').toLowerCase();
    return code === '23505' ||
        msg.includes('duplicate key') ||
        msg.includes('unique constraint');
}

/** Slug for a given retry attempt: the base slug for attempt 0, suffixed after. */
function slugVariant(baseSlug, attempt) {
    return attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
}

/**
 * Insert a public join record, regenerating a unique slug + file_path if the
 * name collides with an existing entry. `file_path` is UNIQUE in the DB, so two
 * signups with the same name (duplicates, resubmissions, or near-simultaneous
 * submissions during a flurry) would otherwise fail with a unique violation.
 * On such a collision we retry with `name-2`, `name-3`, … ; any other error is
 * surfaced immediately. Returns { data, error, slug }.
 */
async function insertJoinRecord(supabase, record, maxAttempts = 6) {
    const baseSlug = record.slug;
    const dir = record.file_type === 'community' ? 'communities' : 'solution-providers';
    let lastError = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const slug = slugVariant(baseSlug, attempt);
        const candidate = { ...record, slug, file_path: `${dir}/${slug}.md` };
        const { data, error } = await supabase.from('file_metadata').insert(candidate);
        if (!error) return { data, error: null, slug };
        if (!isUniqueViolation(error)) return { data: null, error, slug };
        lastError = error; // collision — try the next variant
    }
    return {
        data: null,
        error: lastError ||
            new Error('Could not create a unique entry. Please try a slightly different name.'),
        slug: baseSlug
    };
}
