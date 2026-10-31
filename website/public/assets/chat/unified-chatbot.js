/**
 * NOTF Unified Chatbot
 * Triple-mode chatbot: Discovery Mode + Onboarding Mode + Complaint Mode
 * Last updated: 2026-03-27
 */

class NotfChatbot {
    constructor() {
        this.state = 'intent_selection';
        this.mode = null; // 'discovery', 'onboarding', or 'complaint'
        this.conversationHistory = [];
        this.formData = {};

        // Initialize components
        this.discoveryEngine = null;
        this.complaintEngine = null;
        this.boundaryValidator = null;
        this.onboardingEngine = null;

        // Session ID
        this.sessionId = this.generateSessionId();

        // Load saved session if exists
        this.loadSession();

        // Initialize UI
        this.initializeUI();
        this.bindEvents();

        // Load chatbot state (minimized/expanded)
        this.loadChatbotState();

        // Show welcome message
        this.showWelcomeMessage();

        // Listen for external onboarding trigger (e.g. from CTA button)
        window.addEventListener('notf-open-onboarding', () => {
            if (this.mode !== 'onboarding') {
                this.selectIntent('onboarding').catch(err => {
                    console.warn('[Chatbot] Failed to open onboarding mode:', err);
                });
            }
        });
    }

    generateSessionId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    initializeUI() {
        const chatWidget = document.getElementById('notf-chatbot-widget') || document.getElementById('notf-chatbot');
        const chatFab = document.getElementById('chat-fab');

        if (!chatWidget) {
            console.error('Chatbot widget element not found');
            return;
        }

        // Add resize handle (role=separator for a11y — aria-label on a bare div
        // triggers axe's aria-prohibited-attr; separator is the correct role for
        // an interactive splitter between two regions).
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'chat-resize-handle';
        resizeHandle.setAttribute('role', 'separator');
        resizeHandle.setAttribute('aria-label', 'Resize chatbot window');
        resizeHandle.setAttribute('aria-orientation', 'horizontal');
        resizeHandle.setAttribute('tabindex', '0');
        chatWidget.insertBefore(resizeHandle, chatWidget.firstChild);

        this.elements = {
            widget: chatWidget,
            fab: chatFab,
            messagesContainer: chatWidget.querySelector('.chat-messages'),
            inputField: chatWidget.querySelector('.chat-input-field'),
            sendButton: chatWidget.querySelector('.chat-send-button'),
            closeButton: chatWidget.querySelector('.chat-close-button'),
            switchModeButton: chatWidget.querySelector('.chat-switch-mode-button'),
            modeTitle: chatWidget.querySelector('.chat-mode-title'),
            resizeHandle: resizeHandle
        };

        // Setup resize functionality
        this.setupResize();

        // Start in open state (widget visible, FAB hidden)
        this.elements.widget.classList.remove('hidden');
        if (this.elements.fab) {
            this.elements.fab.classList.add('hidden');
        }
    }

    setupResize() {
        let isResizing = false;
        let startX, startY, startWidth, startHeight, startBottom, startRight;

        this.elements.resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = this.elements.widget.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;
            startBottom = window.innerHeight - rect.bottom;
            startRight = window.innerWidth - rect.right;

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaX = startX - e.clientX; // Reversed for top-left
            const deltaY = startY - e.clientY; // Reversed for top-left

            const newWidth = startWidth + deltaX;
            const newHeight = startHeight + deltaY;

            // Apply min/max constraints
            const finalWidth = Math.max(360, Math.min(newWidth, window.innerWidth - 40));
            const finalHeight = Math.max(400, Math.min(newHeight, window.innerHeight - 40));

            this.elements.widget.style.width = finalWidth + 'px';
            this.elements.widget.style.height = finalHeight + 'px';

            // Keep bottom-right position fixed
            this.elements.widget.style.bottom = startBottom + 'px';
            this.elements.widget.style.right = startRight + 'px';
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }

    openChatbot() {
        this.elements.widget.classList.remove('hidden');
        if (this.elements.fab) {
            this.elements.fab.classList.add('hidden');
        }
        // Focus input field for better UX
        setTimeout(() => {
            this.elements.inputField?.focus();
        }, 100);
        // Save state
        this.saveChatbotState('expanded');
    }

    closeChatbot() {
        // Close = minimize (return to FAB)
        this.elements.widget.classList.add('hidden');
        if (this.elements.fab) {
            this.elements.fab.classList.remove('hidden');
        }
        // Save state
        this.saveChatbotState('minimized');
    }

    saveChatbotState(state) {
        try {
            localStorage.setItem('notf_chatbot_state', state);
        } catch (e) {
            console.error('Failed to save chatbot state:', e);
        }
    }

    loadChatbotState() {
        try {
            const state = localStorage.getItem('notf_chatbot_state');
            if (state === 'minimized') {
                // Start minimized
                this.closeChatbot();
            }
            // If expanded or no saved state, widget stays visible (default)
        } catch (e) {
            console.error('Failed to load chatbot state:', e);
        }
    }

    bindEvents() {
        // Send message on button click
        this.elements.sendButton?.addEventListener('click', () => this.sendMessage());

        // Send message on Enter key
        this.elements.inputField?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Close button (minimizes to FAB)
        this.elements.closeButton?.addEventListener('click', () => this.closeChatbot());

        // FAB button - open chatbot
        this.elements.fab?.addEventListener('click', () => this.openChatbot());

        // Switch mode button
        this.elements.switchModeButton?.addEventListener('click', () => this.switchMode());
    }

    showWelcomeMessage() {
        this.addBotMessage(`
            <div class="welcome-message">
                <h3><i class="fa-solid fa-hand"></i> Hello! I'm the NOTF Assistant</h3>
                <p>I can help you:</p>
                <div class="intent-options">
                    <button class="intent-button discovery-button" data-intent="discovery">
                        <span class="icon"><i class="fa-solid fa-magnifying-glass"></i></span>
                        <span class="label">Find Communities & Resources</span>
                        <span class="description">Discover organizations, projects, and opportunities</span>
                    </button>
                    <button class="intent-button onboarding-button" data-intent="onboarding">
                        <span class="icon"><i class="fa-solid fa-user-plus"></i></span>
                        <span class="label">Join NOTF</span>
                        <span class="description">Register your community or organisation to join the network</span>
                    </button>
                    <!-- File a Complaint intent temporarily hidden while notf-cms
                         complaint management is under repair. Re-enable by
                         uncommenting this button. -->
                </div>
                <p class="chat-tips"><i class="fa-solid fa-lightbulb"></i> <strong>Tips:</strong> You can switch modes anytime using the <i class="fa-solid fa-repeat"></i> button in the header. Resize this window by dragging the top-left corner.</p>
            </div>
        `);

        // Bind intent selection buttons
        setTimeout(() => {
            document.querySelectorAll('.intent-button').forEach(button => {
                button.addEventListener('click', (e) => {
                    const intent = e.currentTarget.dataset.intent;
                    // Don't await - let it run in background to avoid blocking click handler
                    this.selectIntent(intent).catch(err => {
                        console.error('Intent selection error:', err);
                        this.addBotMessage('Sorry, something went wrong. Please try again.');
                    });
                });
            });
        }, 100);
    }

    async selectIntent(intent) {
        this.mode = intent;

        // Update header title immediately (non-blocking)
        this.updateHeaderTitle(intent);

        // Show mode switch button immediately
        this.elements.switchModeButton?.classList.remove('hidden');

        // Add user's choice to conversation immediately
        const choiceLabels = {
            'discovery': 'Find Communities & Resources',
            'onboarding': 'Join NOTF',
            'complaint': 'File a Complaint'
        };
        this.addUserMessage(choiceLabels[intent] || intent);

        // Initialize appropriate engine (async, but UI already updated)
        if (intent === 'discovery') {
            // This will show loading state and wait for data asynchronously
            await this.initializeDiscoveryMode();
        } else if (intent === 'onboarding') {
            await this.initializeOnboardingMode();
        } else {
            // Complaint mode is immediate, no data loading required
            this.initializeComplaintMode();
        }

        this.saveSession();
    }

    updateHeaderTitle(mode) {
        if (!this.elements.modeTitle) return;

        if (mode === 'discovery') {
            this.elements.modeTitle.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Discovery Mode';
        } else if (mode === 'onboarding') {
            this.elements.modeTitle.innerHTML = '<i class="fa-solid fa-user-plus"></i> Join NOTF';
        } else if (mode === 'complaint') {
            this.elements.modeTitle.innerHTML = '<i class="fa-solid fa-file-pen"></i> Complaint Mode';
        } else {
            this.elements.modeTitle.textContent = 'NOTF Assistant';
        }
    }

    switchMode() {
        // Return to welcome / mode selection screen
        const hasMessages = this.conversationHistory.length > 1;

        if (hasMessages) {
            const confirmed = confirm(
                'Switching modes will start a new conversation. ' +
                'Your current conversation will be cleared. Continue?'
            );

            if (!confirmed) {
                return;
            }
        }

        // Clear conversation
        this.conversationHistory = [];
        this.formData = {};

        // Reset onboarding engine if it exists
        if (this.onboardingEngine) {
            this.onboardingEngine.reset();
        }

        // Reset state
        this.state = 'intent_selection';
        this.mode = null;

        // Reset UI
        this.elements.messagesContainer.innerHTML = '';
        this.elements.switchModeButton?.classList.add('hidden');
        this.updateHeaderTitle(null);

        // Show welcome message again
        this.showWelcomeMessage();
    }

    async initializeDiscoveryMode() {
        this.state = 'discovery_welcome';

        // Wait for data to load
        const dataLoaded = await this.waitForData();

        if (!dataLoaded) {
            // Data failed to load, error message already shown
            return;
        }

        // Remove loading message
        const loadingMsg = this.elements.messagesContainer.querySelector('.loading-message');
        if (loadingMsg) {
            loadingMsg.remove();
        }

        // Lazy load discovery engine
        if (!this.discoveryEngine) {
            this.discoveryEngine = new DiscoveryEngine(
                this.getCommunitiesData(),
                this.getMembersData()
            );
        }

        this.addBotMessage(`
            <div class="mode-message">
                <p>Great! I'll help you discover communities and resources.</p>
                <p>What are you looking for? You can search by:</p>
                <ul>
                    <li><i class="fa-solid fa-house-user"></i> Community name or neighborhood</li>
                    <li><i class="fa-solid fa-tags"></i> Theme (waste, education, water, health, etc.)</li>
                    <li><i class="fa-solid fa-location-dot"></i> Location (city, area)</li>
                    <li><i class="fa-solid fa-handshake"></i> Resources (funding, volunteers, space)</li>
                </ul>
                <p>Try asking: <em>"Find communities working on waste management in Bengaluru"</em></p>
                <p class="chat-privacy-note" data-i18n="chatbot.searchLogNote">${this.escapeHtml(this.t('chatbot.searchLogNote',
                    'We keep the words you search for and what we showed you, not who you are, to improve search.'))}</p>
            </div>
        `);

        this.enableInput();
    }

    async waitForData(maxAttempts = 50) {
        // Wait for window.notfData to be populated
        for (let i = 0; i < maxAttempts; i++) {
            if (window.notfData &&
                (window.notfData.communities?.length > 0 || window.notfData.members?.length > 0)) {
                console.log('[Chatbot] Data loaded successfully');
                return true;
            }

            if (i === 0) {
                console.log('[Chatbot] Waiting for data to load...');
                // Show loading indicator
                this.addBotMessage('<div class="loading-message"><i class="fa-solid fa-spinner fa-spin"></i> Loading communities data...</div>');
            }

            // Wait 100ms and try again
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.warn('[Chatbot] Data loading timed out after 5 seconds');
        this.addBotMessage('<div class="error-message"><i class="fa-solid fa-exclamation-triangle"></i> Could not load communities data. Please refresh the page and try again.</div>');
        return false;
    }


    async sendMessage() {
        const message = this.elements.inputField.value.trim();

        if (!message) return;

        // Add user message to UI
        this.addUserMessage(message);

        // Clear input
        this.elements.inputField.value = '';

        // Process message based on current mode and state
        await this.processMessage(message);

        // Save session
        this.saveSession();
    }

    async processMessage(message) {
        if (this.mode === 'discovery') {
            await this.processDiscoveryMessage(message);
        } else if (this.mode === 'onboarding') {
            await this.processOnboardingMessage(message);
        } else if (this.mode === 'complaint') {
            await this.processComplaintMessage(message);
        }
    }

    async processDiscoveryMessage(message) {
        await this.loadCityHelpers();

        // Re-initialize discovery engine if it's null (data loaded after initialization)
        if (!this.discoveryEngine) {
            console.log('[Chatbot] Re-initializing discovery engine with loaded data');
            this.discoveryEngine = new DiscoveryEngine(
                this.getCommunitiesData(),
                this.getMembersData()
            );
        }

        // Use discovery engine to process query
        const results = await this.discoveryEngine.search(message);
        const city = typeof findCityIn === 'function' ? findCityIn(message)?.city || '' : '';
        if (typeof logSearch === 'function') {
            logSearch(searchLogRow({
                query: message,
                results,
                city,
                lang: window.translator?.currentLanguage || document.documentElement.lang,
                page: location.pathname
            }));
        }

        if (results.length === 0 && city) {
            this.addBotMessage(this.renderNothingInCity(city) + this.airQualityNote(message));
        } else if (results.length === 0) {
            this.addBotMessage(`
                <p>I couldn't find any communities matching your search.</p>
                <p>Try:</p>
                <ul>
                    <li>Using different keywords</li>
                    <li>Searching by neighborhood or city</li>
                    <li>Browsing by theme (waste, education, water, etc.)</li>
                </ul>
            ` + this.airQualityNote(message));
        } else {
            this.displayDiscoveryResults(results, city, message);
        }
    }

    // translator.t() returns the key itself when a string is missing.
    t(key, fallback) {
        const value = window.translator?.t(key);
        return value && value !== key ? value : fallback;
    }

    // city-map.js (findCityIn, normaliseCity) is already on the home and communities
    // pages. Elsewhere it loads on the first search; by then the page's own scripts
    // have run, so it is never loaded twice. Search still works if it fails to load.
    loadCityHelpers() {
        if (typeof findCityIn === 'function') return Promise.resolve();
        this.cityHelpers ||= new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = '/assets/js/city-map.js';
            script.onload = script.onerror = resolve;
            document.body.appendChild(script);
        });
        return this.cityHelpers;
    }

    chatLinks(links) {
        return `<div class="chat-option-buttons">${links.map(({ href, label }) =>
            `<a href="${href}" class="chat-link-btn"><i class="fa-solid fa-arrow-right"></i> ${this.escapeHtml(label)}</a>`
        ).join('')}</div>`;
    }

    // A link to the city's view on /communities/, when anyone is registered there.
    cityLink(city) {
        const count = this.discoveryEngine.resourcesIn(city).filter(r => r.resourceType === 'community').length;
        if (!count) return '';
        return this.chatLinks([{
            href: `/communities/?city=${encodeURIComponent(city)}`,
            label: `See ${count === 1 ? 'the 1 community' : `all ${count} communities`} in ${city}`
        }]);
    }

    // Say so plainly rather than show other cities; point to the catalogue and to joining.
    renderNothingInCity(city) {
        const name = this.escapeHtml(city);
        if (this.discoveryEngine.resourcesIn(city).length) {
            return `<p>Nothing in ${name} matched that.</p>` + this.cityLink(city);
        }
        const projects = (window.CATALOG_PROJECTS || [])
            .filter(p => (p.cities || []).some(c => normaliseCity(c) === city)).length;
        return `<p>There are no registered communities or solution providers in ${name} yet.</p>` +
            this.chatLinks([
                projects
                    ? { href: `/catalog/?city=${encodeURIComponent(city)}`, label: `See ${projects} ${projects === 1 ? 'project' : 'projects'} in ${city} in the catalogue` }
                    : { href: '/catalog/', label: 'Browse the project catalogue' },
                { href: '/join/', label: `Know a group in ${city}? Invite them to join` }
            ]);
    }

    // Communities can work on air quality, but live readings live on oaq.notf.in.
    airQualityNote(message) {
        if (!/\b(air[ -]?quality|air pollution|aqi|smog|pollution)\b/i.test(message)) return '';
        return '<p><i class="fa-solid fa-wind"></i> For live air quality readings, see ' +
            '<a href="https://oaq.notf.in" target="_blank" rel="noopener">oaq.notf.in</a>.</p>';
    }

    displayDiscoveryResults(results, city = '', message = '') {
        this.currentSearchResults = results; // Store for modal access

        // Determine what types of results we have
        const hasCommunities = results.some(r => r.resourceType === 'community');
        const hasProviders = results.some(r => r.resourceType === 'provider');

        let resultTypeText = '';
        if (hasCommunities && hasProviders) {
            resultTypeText = ' (communities and providers)';
        } else if (hasCommunities) {
            resultTypeText = ' (communities)';
        } else if (hasProviders) {
            resultTypeText = ' (providers)';
        }

        const resultsHtml = `
            <div class="discovery-results">
                <p>I found <strong>${results.length}</strong> result${results.length === 1 ? '' : 's'}${resultTypeText}${city ? ` in ${this.escapeHtml(city)}` : ''} for you:</p>
                ${results.map((result, index) => this.renderResourceCard(result, index)).join('')}
                ${city ? this.cityLink(city) : ''}
                ${this.airQualityNote(message)}
            </div>
        `;

        this.addBotMessage(resultsHtml);
    }

    renderResourceCard(resource, index) {
        const isProvider = resource.resourceType === 'provider';
        const location = resource.location || resource.city || resource.neighborhood || '';
        const focusAreas = resource.focus_areas || resource.domains || [];
        const contact = resource.contact?.email || resource.contact;
        const website = resource.website || resource.url;

        // Store resource in a temporary array for modal access
        if (!this.currentSearchResults) {
            this.currentSearchResults = [];
        }
        this.currentSearchResults[index] = resource;

        return `
            <div class="community-card clickable" onclick="window.notfChatbot.showResourceDetails(${index})">
                <div class="community-header">
                    <h4>${resource.name}</h4>
                    ${isProvider ? '<span class="type-badge">Provider</span>' : '<span class="type-badge">Community</span>'}
                    ${resource.status ? `<span class="status-badge ${resource.status}">${resource.status}</span>` : ''}
                </div>
                <div class="community-details">
                    ${location ? `<p class="location"><i class="fa-solid fa-location-dot"></i> ${location}</p>` : ''}
                    ${focusAreas.length > 0 ? `<p class="tags"><i class="fa-solid fa-tags"></i> ${focusAreas.join(', ')}</p>` : ''}
                    ${resource.members_count ? `<p class="members"><i class="fa-solid fa-users"></i> ${resource.members_count} members</p>` : ''}
                </div>
                <p class="view-details-hint">Click for details →</p>
            </div>
        `;
    }

    showResourceDetails(index) {
        const resource = this.currentSearchResults[index];
        if (!resource) return;

        const isProvider = resource.resourceType === 'provider';
        const location = resource.location || resource.city || resource.neighborhood || '';
        const focusAreas = resource.focus_areas || resource.domains || [];
        const contact = resource.contact?.email || resource.contact;
        const website = resource.website || resource.url;
        const description = resource.description || resource.notes || 'No description available.';
        const stories = resource.stories || 'No stories shared yet.';

        let modalContent = `
            <div class="chat-modal-overlay" onclick="window.notfChatbot.closeResourceModal()">
                <div class="chat-modal-content" onclick="event.stopPropagation()">
                    <div class="chat-modal-header">
                        <h3>${resource.name}</h3>
                        <button class="chat-modal-close" onclick="window.notfChatbot.closeResourceModal()" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="chat-modal-body">
                        <div class="chat-modal-section">
                            <h4>Type</h4>
                            <p>${isProvider ? '<i class="fa-solid fa-building"></i> Solution Provider' : '<i class="fa-solid fa-house-user"></i> Community'}</p>
                        </div>
                        <div class="chat-modal-section">
                            <h4>Location</h4>
                            <p>${location || 'Not specified'}</p>
                        </div>
                        ${focusAreas.length > 0 ? `
                            <div class="chat-modal-section">
                                <h4>${isProvider ? 'Domains' : 'Focus Areas'}</h4>
                                <p>${focusAreas.join(', ')}</p>
                            </div>
                        ` : ''}
                        <div class="chat-modal-section">
                            <h4>Description</h4>
                            <p>${description}</p>
                        </div>
                        ${stories && stories !== 'No stories shared yet.' ? `
                            <div class="chat-modal-section">
                                <h4>Stories</h4>
                                <p>${stories}</p>
                            </div>
                        ` : ''}
                        ${resource.offers && resource.offers.length > 0 ? `
                            <div class="chat-modal-section">
                                <h4>What They Offer</h4>
                                <ul class="chat-modal-list">
                                    ${resource.offers.map(offer => `<li>${offer}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${resource.asks && resource.asks.length > 0 ? `
                            <div class="chat-modal-section">
                                <h4>What They Need</h4>
                                <ul class="chat-modal-list">
                                    ${resource.asks.map(ask => `<li>${ask}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${contact || website ? `
                            <div class="chat-modal-section">
                                <h4>Contact</h4>
                                <div class="chat-modal-actions">
                                    ${contact ? `<a href="mailto:${contact}" class="btn-contact" onclick="event.stopPropagation()"><i class="fa-solid fa-envelope"></i> Email</a>` : ''}
                                    ${website ? `<a href="${website}" target="_blank" class="btn-learn-more" onclick="event.stopPropagation()"><i class="fa-solid fa-globe"></i> Website</a>` : ''}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        // Add modal to body
        const modalDiv = document.createElement('div');
        modalDiv.id = 'chat-resource-modal';
        modalDiv.innerHTML = modalContent;
        document.body.appendChild(modalDiv);
    }

    closeResourceModal() {
        const modal = document.getElementById('chat-resource-modal');
        if (modal) {
            modal.remove();
        }
    }

    // ==========================================
    // Onboarding Mode
    // ==========================================

    async initializeOnboardingMode() {
        this.state = 'onboarding_active';

        // Lazy-load onboarding engine
        if (!this.onboardingEngine) {
            this.onboardingEngine = new OnboardingEngine();
        } else {
            this.onboardingEngine.reset();
        }

        // Initialize with Supabase client from data-loader.js
        try {
            const client = (typeof dataLoader !== 'undefined' && dataLoader.getSupabaseClient)
                ? dataLoader.getSupabaseClient()
                : null;
            if (client) {
                await this.onboardingEngine.init(client);
            }
        } catch (err) {
            console.warn('[Chatbot] Could not initialize Supabase for onboarding:', err);
        }

        // Show the welcome/type selection message
        const welcome = this.onboardingEngine.getWelcomeMessage();
        this.renderOnboardingResponse(welcome);
        this.disableInput();
    }

    async processOnboardingMessage(message) {
        if (!this.onboardingEngine) return;

        const response = await this.onboardingEngine.handleInput(message);

        this.renderOnboardingResponse(response);

        if (response.done) {
            this.disableInput();
        }
    }

    renderOnboardingResponse(response) {
        let html = '';

        // Text content - handle newlines
        if (response.text) {
            const lines = response.text.split('\n').filter(l => l.trim());
            html += lines.map(line => `<p>${this.escapeHtml(line)}</p>`).join('');
        }

        // Buttons (single-select options)
        if (response.buttons && response.buttons.length > 0) {
            html += '<div class="chat-option-buttons">';
            response.buttons.forEach(btn => {
                if (btn.value.startsWith('_link:')) {
                    const url = btn.value.replace('_link:', '');
                    html += `<a href="${url}" class="chat-link-btn"><i class="fa-solid fa-arrow-right"></i> ${this.escapeHtml(btn.label)}</a>`;
                } else {
                    html += `<button class="chat-option-btn" onclick="window.notfChatbot.handleOnboardingButton('${this.escapeHtml(btn.value)}')">${this.escapeHtml(btn.label)}</button>`;
                }
            });
            html += '</div>';
            this.disableInput();
        }

        // Checkboxes (multi-select pills)
        if (response.checkboxes && response.checkboxes.length > 0) {
            html += '<div class="chat-checkboxes" id="onboarding-checkboxes">';
            response.checkboxes.forEach(cb => {
                html += `<button class="chat-checkbox-pill" data-value="${this.escapeHtml(cb.value)}" onclick="window.notfChatbot.toggleOnboardingCheckbox(this)">${this.escapeHtml(cb.label)}</button>`;
            });
            html += '</div>';
            html += '<button class="chat-continue-btn" onclick="window.notfChatbot.submitOnboardingCheckboxes()"><i class="fa-solid fa-arrow-right"></i> Continue</button>';
            this.disableInput();
        }

        // If response only has text and an inputType, enable the input.
        // The field is a <textarea> which has no `type` setter — only
        // assign it when we actually have a text <input>.
        if (response.inputType && !response.buttons && !response.checkboxes) {
            this.enableInput();
            const field = this.elements.inputField;
            const isInput = field && field.tagName === 'INPUT';
            if (response.inputType === 'email') {
                if (isInput) field.type = 'email';
                if (field) field.placeholder = 'Enter your email address';
            } else {
                if (isInput) field.type = 'text';
                if (field) field.placeholder = 'Type your answer...';
            }
        }

        if (html) {
            this.addBotMessage(html);
        }

        // If done, offer return to main menu
        if (response.done) {
            setTimeout(() => {
                this.addBotMessage(`
                    <div style="margin-top: 8px;">
                        <button class="chat-option-btn" onclick="window.notfChatbot.switchMode()">
                            <i class="fa-solid fa-arrow-left"></i> Back to main menu
                        </button>
                    </div>
                `);
            }, 500);
        }
    }

    handleOnboardingButton(value) {
        this.addUserMessage(value === '_other' ? 'Other' : value);
        // Reset input field — the field is a <textarea> which has no `type`
        // setter, so only set it when we're dealing with an <input>.
        if (this.elements.inputField && this.elements.inputField.tagName === 'INPUT') {
            this.elements.inputField.type = 'text';
        }
        if (this.elements.inputField) {
            this.elements.inputField.placeholder = 'Type your message...';
        }
        this.processOnboardingMessage(value);
    }

    toggleOnboardingCheckbox(element) {
        element.classList.toggle('selected');
    }

    submitOnboardingCheckboxes() {
        const container = this.elements.messagesContainer.querySelector('#onboarding-checkboxes');
        if (!container) return;

        const selected = Array.from(container.querySelectorAll('.chat-checkbox-pill.selected'))
            .map(el => el.dataset.value);

        if (selected.length === 0) {
            // Flash the continue button to indicate error
            this.addBotMessage('<p style="color: #C45A2A;">Please select at least one focus area.</p>');
            return;
        }

        this.addUserMessage(selected.join(', '));
        this.processOnboardingMessage(selected);
    }


    // Helper methods
    addBotMessage(html) {
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message bot-message';
        messageEl.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content">${html}</div>
        `;
        this.elements.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();

        // Add to conversation history
        this.conversationHistory.push({
            role: 'bot',
            content: html,
            timestamp: new Date().toISOString()
        });
    }

    addUserMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message user-message';
        messageEl.innerHTML = `
            <div class="message-content">${this.escapeHtml(text)}</div>
            <div class="message-avatar"><i class="fa-solid fa-user"></i></div>
        `;
        this.elements.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();

        // Add to conversation history
        this.conversationHistory.push({
            role: 'user',
            content: text,
            timestamp: new Date().toISOString()
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        setTimeout(() => {
            this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        }, 100);
    }

    enableInput() {
        this.elements.inputField.disabled = false;
        this.elements.inputField.focus();
    }

    disableInput() {
        this.elements.inputField.disabled = true;
    }


    getCommunitiesData() {
        // This will be populated from the page's data
        const communities = window.notfData?.communities || [];
        console.log('[Chatbot] Loaded communities:', communities.length);
        if (communities.length > 0) {
            console.log('[Chatbot] Sample community:', communities[0]);
        }
        return communities;
    }

    getMembersData() {
        // This will be populated from the page's data
        const members = window.notfData?.members || [];
        console.log('[Chatbot] Loaded members:', members.length);
        return members;
    }

    saveSession() {
        const session = {
            sessionId: this.sessionId,
            mode: this.mode,
            state: this.state,
            conversationHistory: this.conversationHistory,
            formData: this.formData,
            timestamp: Date.now()
        };

        try {
            localStorage.setItem('notf_chatbot_session', JSON.stringify(session));
        } catch (e) {
            console.error('Failed to save session:', e);
        }
    }

    loadSession() {
        try {
            const saved = localStorage.getItem('notf_chatbot_session');
            if (saved) {
                const session = JSON.parse(saved);

                // Check if session is less than 1 hour old
                if (Date.now() - session.timestamp < 60 * 60 * 1000) {
                    // Offer to restore session (implement this later)
                    // For now, just start fresh
                }
            }
        } catch (e) {
            console.error('Failed to load session:', e);
        }
    }

}

// Mix the complaint mode methods into NotfChatbot.prototype.
// modes/complaint.js must load before this file runs. If the mixin is
// missing (e.g. a page using the chatbot without the complaint mode),
// complaint features simply won't be available.
if (typeof window.NotfComplaintMixin !== 'undefined') {
    Object.getOwnPropertyNames(window.NotfComplaintMixin.prototype).forEach(function (name) {
        if (name !== 'constructor') {
            NotfChatbot.prototype[name] = window.NotfComplaintMixin.prototype[name];
        }
    });
}

// Initialize chatbot when DOM is ready
// Initialize chatbot — handle both static and dynamic loading
// If loaded dynamically (via chatbot-loader.js), DOMContentLoaded has already fired
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.notfChatbot = new NotfChatbot();
    });
} else {
    window.notfChatbot = new NotfChatbot();
}
