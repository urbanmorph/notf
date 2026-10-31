// Communities listing page: load, sort, filter, search, modal.
// Extracted from communities/index.html (PR 3 of UI/UX audit).

(function () {
    let allCommunities = [];
    let filteredCommunities = [];
    const currentSort = { column: 'name', direction: 'asc' };
    let fuse = null;
    let searchTimeout;
    let selectedCity = '';

    (async function init() {
        await dataLoader.waitForSupabase();
        allCommunities = await dataLoader.loadCommunities();
        filteredCommunities = [...allCommunities];

        if (typeof Fuse !== 'undefined') {
            fuse = new Fuse(allCommunities, {
                keys: ['name', 'city', 'neighborhood', 'themes', 'description'],
                threshold: 0.4,
                ignoreLocation: true
            });
        }

        selectedCity = window.mountCityMap(document.getElementById('cityMap'), {
            items: allCommunities,
            citiesOf: (c) => [c.city],
            onChange: (city) => {
                selectedCity = city;
                applyFilters();
            },
        });
        setupSorting();
        setupSearch();
        injectSchema();
    })();

    function injectSchema() {
        if (!window.notfSeo) return;
        window.notfSeo.injectItemList({
            name: 'NOTF Communities',
            url: 'https://notf.in/communities/',
            items: allCommunities,
            toItem: function (c) {
                const themes = Array.isArray(c.themes) ? c.themes.filter(Boolean) : [];
                const item = {
                    '@type': 'Organization',
                    name: c.name,
                    url: 'https://notf.in/communities/',
                };
                if (c.description) item.description = String(c.description).slice(0, 300);
                if (c.city) {
                    item.address = {
                        '@type': 'PostalAddress',
                        addressLocality: c.city,
                        addressCountry: 'IN',
                    };
                }
                if (themes.length) item.knowsAbout = themes;
                return item;
            },
        });
        window.notfSeo.injectBreadcrumb([
            { name: 'Home', url: 'https://notf.in/' },
            { name: 'Communities', url: 'https://notf.in/communities/' },
        ]);
    }

    function renderCards() {
        const grid = document.getElementById('communitiesGrid');

        document.getElementById('communityCount').textContent = `(${filteredCommunities.length})`;

        if (filteredCommunities.length === 0) {
            grid.innerHTML = '<div class="empty-state">No communities found. Try adjusting your filters.</div>';
            return;
        }

        grid.innerHTML = filteredCommunities.map((comm, idx) => {
            const themes = comm.themes && comm.themes.length > 0
                ? comm.themes.slice(0, 3).map(t => `<span class="theme-tag">${t}</span>`).join('')
                : '';

            const offersCount = (comm.offers || []).length;
            const asksCount = (comm.asks || []).length;

            return `
                <div class="content-card community-card" onclick="showDetails(${idx})">
                    <div class="card-header">
                        <h3 class="card-name">${comm.name}</h3>
                        ${comm.city ? `<span class="card-city"><i class="fa-solid fa-location-dot"></i> ${comm.city}</span>` : ''}
                    </div>
                    <div class="card-body">
                        ${themes ? `<div class="card-themes">${themes}</div>` : ''}
                        <div class="card-stats">
                            <div class="card-stat" onclick="event.stopPropagation(); showOffers(${idx})">
                                <span class="card-stat-value">${offersCount}</span>
                                <span class="card-stat-label">Offers</span>
                            </div>
                            <div class="card-stat" onclick="event.stopPropagation(); showAsks(${idx})">
                                <span class="card-stat-value">${asksCount}</span>
                                <span class="card-stat-label">Asks</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function setupSorting() {
        document.getElementById('sortSelect').addEventListener('change', function () {
            currentSort.column = this.value;
            sortCommunities();
            renderCards();
        });
    }

    function sortCommunities() {
        filteredCommunities.sort((a, b) => {
            let aVal, bVal;

            switch (currentSort.column) {
                case 'name':
                    aVal = a.name || '';
                    bVal = b.name || '';
                    break;
                case 'city':
                    aVal = a.city || '';
                    bVal = b.city || '';
                    break;
                case 'themes':
                    aVal = (a.themes || []).length;
                    bVal = (b.themes || []).length;
                    break;
                case 'offers':
                    aVal = (a.offers || []).length;
                    bVal = (b.offers || []).length;
                    break;
                case 'asks':
                    aVal = (a.asks || []).length;
                    bVal = (b.asks || []).length;
                    break;
                default:
                    return 0;
            }

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (currentSort.direction === 'asc') {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            }
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        });
    }

    function applyFilters() {
        const query = document.getElementById('searchInput').value.trim();

        let results = (query && fuse) ? fuse.search(query).map(r => r.item) : [...allCommunities];

        if (selectedCity) {
            results = results.filter(c => normaliseCity(c.city) === selectedCity);
        }

        filteredCommunities = results;
        sortCommunities();
        renderCards();
    }

    function setupSearch() {
        document.getElementById('searchInput').addEventListener('input', function () {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(applyFilters, 200);
        });
    }

    function showOffers(idx) {
        const comm = filteredCommunities[idx];
        const modal = document.getElementById('detailsModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        modalTitle.textContent = `${comm.name} - Offers`;

        if (comm.offers && comm.offers.length > 0) {
            modalBody.innerHTML = `
                <div class="modal-section">
                    <h3>What They Offer</h3>
                    <ul class="modal-list">
                        ${comm.offers.map(offer => `<li>${offer}</li>`).join('')}
                    </ul>
                </div>
            `;
        } else {
            modalBody.innerHTML = '<p style="color: var(--color-text-lighter);">No offers listed yet.</p>';
        }

        modal.classList.add('active');
    }

    function showAsks(idx) {
        const comm = filteredCommunities[idx];
        const modal = document.getElementById('detailsModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        modalTitle.textContent = `${comm.name} - Asks`;

        if (comm.asks && comm.asks.length > 0) {
            modalBody.innerHTML = `
                <div class="modal-section">
                    <h3>What They Need</h3>
                    <ul class="modal-list">
                        ${comm.asks.map(ask => `<li>${ask}</li>`).join('')}
                    </ul>
                </div>
            `;
        } else {
            modalBody.innerHTML = '<p style="color: var(--color-text-lighter);">No asks listed yet.</p>';
        }

        modal.classList.add('active');
    }

    function showDetails(idx) {
        const comm = filteredCommunities[idx];
        const modal = document.getElementById('detailsModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        modalTitle.textContent = comm.name;

        const themes = comm.themes && comm.themes.length > 0
            ? comm.themes.map(t => `<span class="theme-tag">${t}</span>`).join(' ')
            : '<span style="color: var(--color-text-lighter);">—</span>';

        const description = comm.description || 'No description available.';
        const stories = comm.stories || 'No stories shared yet.';

        let sections = `
            <div class="modal-section">
                <h3>Location</h3>
                <p>${comm.city || 'Not specified'}</p>
            </div>
            <div class="modal-section">
                <h3>Themes</h3>
                <p>${themes}</p>
            </div>
            <div class="modal-section">
                <h3>Description</h3>
                <p>${description}</p>
            </div>
            <div class="modal-section">
                <h3>Stories</h3>
                <p>${stories}</p>
            </div>
        `;

        if (comm.offers && comm.offers.length > 0) {
            sections += `
                <div class="modal-section">
                    <h3>What They Offer</h3>
                    <ul class="modal-list">
                        ${comm.offers.map(offer => `<li>${offer}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        if (comm.asks && comm.asks.length > 0) {
            sections += `
                <div class="modal-section">
                    <h3>What They Need</h3>
                    <ul class="modal-list">
                        ${comm.asks.map(ask => `<li>${ask}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        if (comm.contact && comm.contact.email) {
            sections += `
                <div class="modal-section">
                    <h3>Contact</h3>
                    <p>
                        ${comm.contact.person ? `<strong>${comm.contact.person}</strong><br>` : ''}
                        <a href="mailto:${comm.contact.email}">${comm.contact.email}</a>
                    </p>
                </div>
            `;
        }

        modalBody.innerHTML = sections;
        modal.classList.add('active');
    }

    function closeModal() {
        const modal = document.getElementById('detailsModal');
        modal.classList.remove('active');
    }

    document.addEventListener('click', function (event) {
        const modal = document.getElementById('detailsModal');
        if (event.target === modal) {
            closeModal();
        }
    });

    // Expose handlers used from inline onclick attributes.
    window.showDetails = showDetails;
    window.showOffers = showOffers;
    window.showAsks = showAsks;
    window.closeModal = closeModal;
})();
