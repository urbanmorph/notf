(function() {
    const container = document.getElementById('notf-header');
    if (!container) return;

    // Standard navbar
    const html = `
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
                <a href="https://oaq.notf.in" class="nav-external" target="_blank" rel="noopener noreferrer"><span data-i18n="nav.airQuality">Air Quality</span> <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
                <a href="/join/" class="join-link" data-i18n="nav.join">Join</a>
                <a href="/admin/login.html" class="admin-link" data-i18n-title="nav.admin" title="Admin Login">
                    <img src="/assets/images/icons/login.svg" alt="Admin" style="width:36px;height:36px;">
                </a>
            </div>
        </nav>
    </header>`;

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
