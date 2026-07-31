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

            // Community Stories card -> Live when the city has stories.
            const storiesCard = document.querySelector('[data-feature="stories"]');
            if (storiesCard && cityStories.length > 0) {
                storiesCard.classList.remove('coming-soon');

                const badge = storiesCard.querySelector('.feature-status-badge');
                if (badge) {
                    badge.className = 'feature-status-badge live';
                    badge.innerHTML =
                        '<i class="fa-solid fa-check-circle"></i> ' +
                        '<span data-i18n="cityHub.features.map.statusLive">Live</span>';
                }

                const desc = storiesCard.querySelector('.feature-description');
                if (desc) {
                    desc.setAttribute('data-i18n', 'cityHub.features.stories.description');
                    desc.textContent =
                        'Discover real stories of neighbourhood transformation, ' +
                        'told by the people who made it happen.';
                }

                const action = storiesCard.querySelector('.feature-action');
                if (action) {
                    action.innerHTML =
                        '<a href="/cities/' + slug + '/stories/" class="btn btn-primary">' +
                        '<span data-i18n="cityHub.features.stories.button">Read Stories</span> ' +
                        '<i class="fa-solid fa-arrow-right"></i></a>';
                }

                // Translate the newly injected data-i18n nodes.
                if (window.translator && typeof window.translator.translatePage === 'function') {
                    window.translator.translatePage();
                }
            }

            console.log('[City Hub]', slug, '-', cityCommunities.length, 'communities,', cityStories.length, 'stories');
        } catch (error) {
            console.error('[City Hub] Error loading data:', error);
        }
    })();
})();
