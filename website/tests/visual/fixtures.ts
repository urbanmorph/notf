import type { Page } from '@playwright/test';

/**
 * Deterministic Supabase fixture for visual tests.
 *
 * The public pages render live data from Supabase (`file_metadata`) at runtime,
 * so their height/content — and therefore their screenshots — drift every time
 * the production DB changes. That made the visual suite fail on unrelated commits.
 *
 * `stubSupabase(page)` intercepts the PostgREST call and returns this fixed set,
 * so `stories` / `communities` / `solution-providers` / `home` render identical,
 * data-independent layouts on every run. Update this fixture only when you
 * intend the baselines to change.
 */

type Row = {
  slug: string;
  file_type: 'community' | 'solution-provider' | 'story';
  status: 'active';
  city: string;
  neighborhood?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ward?: string | null;
  created_at?: string | null;
  metadata: Record<string, unknown>;
};

export const COMMUNITIES: Row[] = [
  {
    slug: 'green-glen-collective', file_type: 'community', status: 'active',
    city: 'Bengaluru', neighborhood: 'Bellandur', latitude: 12.93, longitude: 77.67, ward: '150',
    created_at: '2026-01-05T00:00:00Z',
    metadata: {
      name: 'Green Glen Collective', city: 'Bengaluru', neighborhood: 'Bellandur',
      description: 'A resident collective restoring their neighbourhood lake and greening shared streets.',
      themes: ['Water & Ecology', 'Waste & Circular Economy'],
      contact: { person: 'A. Rao', email: 'hello@example.org' },
      offers: ['Volunteer network'], asks: ['Funding for saplings'],
    },
  },
  {
    slug: 'lakeside-residents-forum', file_type: 'community', status: 'active',
    city: 'Bengaluru', neighborhood: 'Jakkur', latitude: 13.07, longitude: 77.6, ward: '6',
    created_at: '2026-01-04T00:00:00Z',
    metadata: {
      name: 'Lakeside Residents Forum', city: 'Bengaluru', neighborhood: 'Jakkur',
      description: 'Neighbours organising monthly clean-ups and pollinator gardens around Jakkur lake.',
      themes: ['Placemaking & Urban Ecology'],
      contact: { person: 'S. Iyer', email: 'forum@example.org' },
      offers: ['Local knowledge'], asks: ['Native plants'],
    },
  },
  {
    slug: 'sahakar-nagar-green-team', file_type: 'community', status: 'active',
    city: 'Mumbai', neighborhood: 'Andheri', latitude: 19.11, longitude: 72.86, ward: 'K/West',
    created_at: '2026-01-03T00:00:00Z',
    metadata: {
      name: 'Sahakar Nagar Green Team', city: 'Mumbai', neighborhood: 'Andheri',
      description: 'A building federation running dry-waste segregation and composting drives.',
      themes: ['Waste & Circular Economy'],
      contact: { person: 'M. Desai', email: 'greenteam@example.org' },
      offers: ['Composting know-how'], asks: ['Segregation bins'],
    },
  },
];

export const PROVIDERS: Row[] = [
  {
    slug: 'urban-canopy-labs', file_type: 'solution-provider', status: 'active',
    city: 'Bengaluru', latitude: 12.97, longitude: 77.59, ward: null,
    metadata: {
      name: 'Urban Canopy Labs', theme: 'Urban Greening', location: 'Bengaluru, Karnataka',
      description: 'Maps and restores urban tree canopy with communities and civic bodies.',
      contact: { person: 'R. Nair', email: 'team@example.org' },
      offers: ['Tree mapping', 'Restoration planning'], asks: ['Partner sites'],
    },
  },
  {
    slug: 'clearflow-water', file_type: 'solution-provider', status: 'active',
    city: 'Bengaluru', latitude: 12.9, longitude: 77.64, ward: null,
    metadata: {
      name: 'ClearFlow Water', theme: 'Water & Ecology', location: 'Bengaluru, Karnataka',
      description: 'Nature-based lake and greywater treatment using floating wetlands.',
      contact: { person: 'P. Kulkarni', email: 'contact@example.org' },
      offers: ['Floating wetlands', 'Water monitoring'], asks: ['Lake access'],
    },
  },
];

export const STORIES: Row[] = [
  {
    slug: 'reviving-the-neighbourhood-lake', file_type: 'story', status: 'active',
    city: 'Bengaluru', created_at: '2026-03-01T00:00:00Z',
    metadata: {
      title: 'Reviving the Neighbourhood Lake', city: 'Bengaluru',
      community: 'Green Glen Collective', location: 'Bellandur', themes: ['Water & Ecology'],
      excerpt: 'How weekend clean-ups and floating islands brought a lake back to life.',
      content: 'A short, fixed story body used only for deterministic visual snapshots.',
      youtube_url: null,
    },
  },
  {
    slug: 'a-street-that-grew-shade', file_type: 'story', status: 'active',
    city: 'Bengaluru', created_at: '2026-02-15T00:00:00Z',
    metadata: {
      title: 'A Street That Grew Shade', city: 'Bengaluru',
      community: 'Lakeside Residents Forum', location: 'Jakkur', themes: ['Placemaking & Urban Ecology'],
      excerpt: 'Residents planted native trees and turned a hot lane into a walkable one.',
      content: 'A short, fixed story body used only for deterministic visual snapshots.',
      youtube_url: null,
    },
  },
];

/** Return the fixture rows for a PostgREST `file_type=eq.<type>` query. */
function rowsForFileType(fileType: string | null): Row[] {
  if (fileType === 'community') return COMMUNITIES;
  if (fileType === 'solution-provider') return PROVIDERS;
  if (fileType === 'story') return STORIES;
  return [];
}

/**
 * Intercept the Supabase REST call for `file_metadata` and fulfil it from the
 * fixture. Must be called before `page.goto`. All query variants (select=*,
 * select=city, ordering, city filters) are served the same rows — the columns
 * they read (`city`, `metadata`, …) are all present on every row.
 */
export async function stubSupabase(page: Page): Promise<void> {
  await page.route('**/rest/v1/file_metadata**', async (route) => {
    const url = new URL(route.request().url());
    const fileTypeParam = url.searchParams.get('file_type') ?? '';
    const fileType = fileTypeParam.startsWith('eq.') ? fileTypeParam.slice(3) : null;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(rowsForFileType(fileType)),
    });
  });
}
