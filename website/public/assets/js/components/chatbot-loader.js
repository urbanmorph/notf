(function() {
    var container = document.getElementById('notf-chatbot');
    if (!container) return;

    if (!document.querySelector('link[href="/assets/chat/chat.css"]')) {
        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = '/assets/chat/chat.css';
        document.head.appendChild(css);
    }

    container.innerHTML =
        '<button id="chat-fab" class="chat-fab hidden" data-i18n-aria="chatbot.openChat" aria-label="Open NOTF Assistant">' +
            '<img src="/assets/images/icons/communication.svg" alt="" style="width:40px;height:40px;">' +
        '</button>' +
        '<div id="notf-chatbot-widget" class="chat-widget">' +
            '<div class="chat-header">' +
                '<div class="chat-header-title">' +
                    '<i class="fa-solid fa-robot"></i>' +
                    '<span class="chat-mode-title" data-i18n="chatbot.title">NOTF Assistant</span>' +
                '</div>' +
                '<div class="chat-header-actions">' +
                    '<button class="chat-switch-mode-button hidden" aria-label="Switch mode">' +
                        '<i class="fa-solid fa-repeat"></i>' +
                    '</button>' +
                    '<button class="chat-close-button" data-i18n-aria="common.close" aria-label="Close chat">' +
                        '<i class="fa-solid fa-xmark"></i>' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div class="chat-messages"></div>' +
            '<div class="chat-input">' +
                '<textarea class="chat-input-field" data-i18n-placeholder="chatbot.inputPlaceholder" placeholder="Type your message..." rows="1" aria-label="Chat message input"></textarea>' +
                '<button class="chat-send-button" aria-label="Send message">' +
                    '<i class="fa-solid fa-paper-plane"></i>' +
                '</button>' +
            '</div>' +
        '</div>';

    // Load scripts sequentially — each waits for the previous to load
    // unified-chatbot.js MUST load last (depends on all others)
    var scripts = [
        'https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js',
        'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js',
        '/assets/chat/search-index.js',
        '/assets/chat/search-log.js',
        '/assets/chat/discovery-engine.js',
        '/assets/chat/complaint-engine.js',
        '/assets/chat/boundary-loader.js',
        '/assets/chat/boundary-validator.js',
        '/assets/chat/notf-cms-api.js',
        '/assets/js/theme-categories.js',
        '/assets/js/utils.js',
        '/assets/chat/onboarding-engine.js',
        '/assets/chat/modes/complaint.js'
    ];
    var lastScript = '/assets/chat/unified-chatbot.js';
    var moduleScript = '/assets/chat/semantic-matcher.js';

    // Load the module script (independent, doesn't block)
    var mod = document.createElement('script');
    mod.src = moduleScript;
    mod.type = 'module';
    document.body.appendChild(mod);

    // Load dependency scripts, then unified-chatbot.js last
    var loaded = 0;
    function onScriptLoad() {
        loaded++;
        if (loaded === scripts.length) {
            // All dependencies loaded — now load unified-chatbot.js
            var final = document.createElement('script');
            final.src = lastScript;
            document.body.appendChild(final);
        }
    }

    scripts.forEach(function(src) {
        var el = document.createElement('script');
        el.src = src;
        el.onload = onScriptLoad;
        el.onerror = onScriptLoad; // count errors too so we don't hang
        document.body.appendChild(el);
    });
})();
