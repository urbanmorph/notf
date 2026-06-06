// Catalogue ↔ provider dependency helpers (admin).
//
// The public catalogue (window.CATALOG_PROJECTS) references each project's
// provider by display name. The DB tracks providers by `slug`. Archiving,
// deleting, or renaming a provider that has catalogue entries silently breaks
// that link and drops the provider from the home-page count — so the admin
// must be warned first. These pure helpers compute that dependency and are
// unit-tested in website/tests/unit/catalogue-deps.test.ts.
//
// Loaded as an ES module in the admin; it also exposes window.catalogueDeps for
// the classic admin scripts. In Deno (tests) `window` is undefined, so the
// global assignment is skipped and only the exports are used.

/**
 * Normalize a provider display name to the DB slug convention
 * (lowercase, punctuation removed, spaces -> single dash).
 * Verified against every active provider slug, incl. "B.PAC" -> "bpac" and
 * "BRM (Blue Ribbon Movement)" -> "brm-blue-ribbon-movement".
 */
export function slugifyProvider(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // drop punctuation: B.PAC -> bpac
    .trim()
    .replace(/\s+/g, "-") // spaces -> dash
    .replace(/-+/g, "-") // collapse repeats
    .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes
}

/**
 * Catalogue entries attached to a provider, matched by slug.
 * @returns array of { id, title } for entries whose provider maps to providerSlug.
 */
export function catalogueEntriesForProvider(projects, providerSlug) {
  if (!providerSlug) return [];
  return (projects || [])
    .filter((p) => slugifyProvider(p.provider) === providerSlug)
    .map((p) => ({ id: p.id, title: p.title }));
}

/**
 * Cross-check the catalogue against the set of ACTIVE provider slugs.
 * Returns the catalogue entries whose provider is not an active provider
 * (orphans) — i.e. archived/missing providers still referenced by the
 * catalogue, which would show in the catalogue but not in the home listing.
 * @returns { orphans: [{ id, title, provider, slug }] }
 */
export function catalogueConsistency(projects, activeProviderSlugs) {
  const active = new Set(activeProviderSlugs || []);
  const orphans = [];
  for (const p of projects || []) {
    const slug = slugifyProvider(p.provider);
    if (!active.has(slug)) {
      orphans.push({ id: p.id, title: p.title, provider: p.provider, slug });
    }
  }
  return { orphans };
}

// Expose for the classic (non-module) admin scripts. In browsers globalThis IS
// window, so window.catalogueDeps resolves; in Deno (tests) this is a harmless
// no-op on the test global.
globalThis.catalogueDeps = {
  slugifyProvider,
  catalogueEntriesForProvider,
  catalogueConsistency,
};
