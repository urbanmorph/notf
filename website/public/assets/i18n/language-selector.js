/**
 * Language Selector Component
 * Creates and manages the language dropdown UI. Every page offers all 11 languages.
 */

/**
 * Create language selector UI
 */
async function createLanguageSelector() {
    const container = document.createElement('div');
    container.className = 'language-selector';

    const currentLang = window.translator.getCurrentLanguage();
    const availableLanguages = window.translator.getLanguages();

    container.innerHTML = `
        <button class="language-selector-button" aria-label="Select language" aria-expanded="false">
            <span class="icon"><i class="fa-solid fa-language"></i></span>
            <span class="language-selector-current">${currentLang.nativeName}</span>
            <span class="chevron"><i class="fa-solid fa-chevron-down"></i></span>
        </button>
        <div class="language-dropdown">
            <div class="language-dropdown-header">Choose Language</div>
            <div class="language-options">
                ${availableLanguages.map(lang => `
                    <button
                        class="language-option ${lang.code === currentLang.code ? 'active' : ''}"
                        data-lang="${lang.code}"
                        onclick="switchLanguage('${lang.code}')"
                    >
                        <div class="language-option-details">
                            <span class="language-option-native">${lang.nativeName}</span>
                            <span class="language-option-english">${lang.name}</span>
                        </div>
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    // Toggle dropdown
    const button = container.querySelector('.language-selector-button');
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        container.classList.toggle('open');
        button.setAttribute('aria-expanded', container.classList.contains('open'));
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            container.classList.remove('open');
            button.setAttribute('aria-expanded', 'false');
        }
    });

    // Close dropdown on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && container.classList.contains('open')) {
            container.classList.remove('open');
            button.setAttribute('aria-expanded', 'false');
            button.focus();
        }
    });

    return container;
}

/**
 * Switch language globally
 */
async function switchLanguage(langCode) {
    const success = await window.translator.setLanguage(langCode);
    if (success) {
        // Close dropdown
        document.querySelectorAll('.language-selector').forEach(selector => {
            selector.classList.remove('open');
            const button = selector.querySelector('.language-selector-button');
            if (button) {
                button.setAttribute('aria-expanded', 'false');
            }
        });
    }
}

/**
 * Add language selector to navigation
 */
async function initLanguageSelector() {
    // Find navigation menu
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) {
        console.warn('Navigation menu not found, language selector not added');
        return;
    }

    // Create and add language selector before admin link
    const languageSelector = await createLanguageSelector();
    const adminLink = navMenu.querySelector('.admin-link');

    if (adminLink) {
        navMenu.insertBefore(languageSelector, adminLink);
    } else {
        navMenu.appendChild(languageSelector);
    }

    console.log('✅ Language selector added');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLanguageSelector);
} else {
    initLanguageSelector();
}

// Re-initialize when language changes (to update dropdown state)
window.addEventListener('languageChanged', () => {
    // Update current language display
    document.querySelectorAll('.language-selector-current').forEach(el => {
        const currentLang = window.translator.getCurrentLanguage();
        el.textContent = currentLang.nativeName;
    });
});
