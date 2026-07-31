// City hub page: make the quick-stats and feature cards reflect real data,
// standardised across every city hub (mirrors the dynamic behaviour the
// Bengaluru hub does inline). Loaded after data-loader.js on each city
// /cities/<city>/index.html.
//
// - Communities stat  -> live per-city count from Supabase.
// - Community Stories card -> flips Live (links to the city stories page)
//   when the city has at least one story, otherwise left as Coming Soon.
// Climate Sectors and Wards Tracked are intentionally left untouched (they
// count built infrastructure, not DB content).

(function () {
    (async function init() {
        const header = document.getElementById('notf-header');
        const slug = header && header.dataset ? (header.dataset.city || '') : '';
        if (!slug) return;

        try {
            await dataLoader.waitForSupabase();

            // Load all, then filter client-side by lowercased city so we don't
            // depend on the exact casing stored in the DB (same as the
            // Bengaluru hub).
            const [communities, stories] = await Promise.all([
                dataLoader.loadCommunities(),
                dataLoader.loadStories()
            ]);
            const byCity = (x) => x.city && x.city.toLowerCase() === slug;
            const cityCommunities = communities.filter(byCity);
            const cityStories = stories.filter(byCity);

            // Communities stat -> real count.
            const commStat = document.querySelector('[data-stat="communities"]');
            if (commStat) {
                commStat.textContent = cityCommunities.length;
                if (cityCommunities.length > 0) commStat.classList.remove('zero');
            }

            const esc = (s) => String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

            // Communities preview list (Bengaluru-style hub layout).
            const hubCommCount = document.getElementById('hubCommCount');
            if (hubCommCount) hubCommCount.textContent = cityCommunities.length;
            const hubCommunities = document.getElementById('hubCommunities');
            if (hubCommunities) {
                hubCommunities.innerHTML = cityCommunities.length > 0
                    ? cityCommunities.slice(0, 4).map((c) =>
                        '<a href="/communities/" class="hub-preview-item">' +
                        '<strong>' + esc(c.name) + '</strong>' +
                        '<span class="hub-preview-meta">' + esc((c.themes || []).slice(0, 2).join(', ')) + '</span></a>'
                      ).join('')
                    : '<div class="hub-empty">No communities here yet.' +
                      '<a href="/join/"><i class="fa-solid fa-user-plus"></i> Join as a community</a></div>';
            }

            // Stories preview list.
            const hubStories = document.getElementById('hubStories');
            if (hubStories) {
                hubStories.innerHTML = cityStories.length > 0
                    ? cityStories.slice(0, 3).map((s) =>
                        '<a href="/cities/' + slug + '/stories/?story=' + encodeURIComponent(s.slug) + '" class="hub-preview-item">' +
                        '<strong>' + esc(s.title) + '</strong>' +
                        '<span class="hub-preview-meta">' + esc(s.community || s.location || '') + '</span></a>'
                      ).join('')
                    : '<div class="hub-empty">No stories here yet.</div>';

                // Hide the "Read all" link for cities without a stories page yet
                // (they have no stories) so it can't 404. It reappears once a
                // city has stories (and thus a /stories/ page).
                if (cityStories.length === 0) {
                    const seeAll = hubStories.closest('.hub-section');
                    const link = seeAll && seeAll.querySelector('.hub-see-all');
                    if (link) link.style.display = 'none';
                }
            }

            console.log('[City Hub]', slug, '-', cityCommunities.length, 'communities,', cityStories.length, 'stories');
        } catch (error) {
            console.error('[City Hub] Error loading data:', error);
        }
    })();
})();
