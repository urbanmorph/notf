(function() {
    const container = document.getElementById('notf-header');
    if (!container) return;

    const city = container.dataset.city || '';
    const citySubPage = container.dataset.citySubpage || '';

    // Standard navbar
    let html = `
    <header>
        <nav>
            <div class="nav-brand">
                <a href="/" class="logo-link">
                    <img src="/assets/images/notf-terracotta.png" alt="NOTF Logo" class="nav-logo">
                </a>
            </div>
            <button class="hamburger" id="hamburger" aria-label="Toggle menu">
                <span></span><span></span><span></span>
            </button>
            <div class="nav-menu" id="navMenu">
                <a href="/" data-i18n="nav.home">Home</a>
                <a href="/about/" data-i18n="nav.about">About</a>
                <a href="/communities/" data-i18n="nav.communities">Communities</a>
                <a href="/catalog/" data-i18n="nav.catalogue">Catalogue</a>
                <a href="/cities/" data-i18n="nav.cities">Cities</a>
                <a href="https://oaq.notf.in" class="nav-external" target="_blank" rel="noopener noreferrer"><span data-i18n="nav.airQuality">Air Quality</span> <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
                <a href="/join/" class="join-link" data-i18n="nav.join">Join</a>
                <a href="/admin/login.html" class="admin-link" data-i18n-title="nav.admin" title="Admin Login">
                    <img src="/assets/images/icons/login.svg" alt="Admin" style="width:36px;height:36px;">
                </a>
            </div>
        </nav>
    </header>`;

    // City sub-nav (only if data-city is set)
    if (city) {
        const citySlug = city.toLowerCase();
        const cityName = city.charAt(0).toUpperCase() + city.slice(1);

        // Determine which sub-pages exist for this city
        const subPages = {
            bengaluru: ['communities', 'map', 'stories']
        };
        const links = subPages[citySlug] || ['map'];

        const icons = {
            communities: 'fa-house-user',
            map: 'fa-map',
            stories: 'fa-book-open'
        };

        const labels = {
            communities: 'Communities',
            map: 'Map',
            stories: 'Stories'
        };

        const i18nKeys = {
            communities: 'cityHub.nav.communities',
            map: 'cityHub.nav.map',
            stories: 'cityHub.nav.stories'
        };

        let backLink;
        if (!citySubPage) {
            // We're on the hub page itself
            backLink = '<a href="/cities/" class="city-sub-nav-link" data-i18n="cityHub.nav.allCities"><i class="fa-solid fa-arrow-left"></i> All Cities</a>' +
                '<a href="/cities/' + citySlug + '/" class="city-sub-nav-link active">' + cityName + '</a>';
        } else {
            backLink = '<a href="/cities/' + citySlug + '/" class="city-sub-nav-link"><i class="fa-solid fa-arrow-left"></i> ' + cityName + '</a>';
        }

        html += '\n<div class="city-sub-nav">' + backLink;

        links.forEach(function(page) {
            const isActive = citySubPage === page ? ' active' : '';
            // A city's communities are the city filter on /communities/.
            const href = page === 'communities' ? '/communities/?city=' + cityName : '/cities/' + citySlug + '/' + page + '/';
            html += '<a href="' + href + '" class="city-sub-nav-link' + isActive + '" data-i18n="' + i18nKeys[page] + '"><i class="fa-solid ' + icons[page] + '"></i> ' + labels[page] + '</a>';
        });

        html += '</div>';
    }

    container.innerHTML = html;

    // Hamburger menu JS
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');

    if (hamburger && navMenu) {
        function closeMenu() {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.classList.remove('menu-open');
        }

        hamburger.addEventListener('click', function() {
            const isOpen = hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.classList.toggle('menu-open', isOpen);
        });

        navMenu.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', closeMenu);
        });

        document.addEventListener('click', function(event) {
            if (!hamburger.contains(event.target) && !navMenu.contains(event.target)) {
                closeMenu();
            }
        });
    }
})();
