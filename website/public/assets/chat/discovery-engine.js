/**
 * Discovery Engine
 * Handles community and resource discovery using semantic matching and Fuse.js fallback
 */

class DiscoveryEngine {
    constructor(communities, members) {
        this.communities = communities || [];
        this.members = members || [];
        this.allResources = [
            ...this.communities.map(c => ({...c, resourceType: 'community'})),
            ...this.members.map(m => ({...m, resourceType: 'provider'}))
        ];

        // Initialize smart matcher with optimized weights for discovery
        this.initializeSmartMatcher();

        // Listen for configuration changes from admin matcher
        window.addEventListener('matchingSettingsChanged', (e) => {
            console.log('[Discovery] Detected config change from admin:', e.detail);
            this.refreshMatcherConfig();
        });

        // Listen for storage changes (cross-tab/window)
        window.addEventListener('storage', (e) => {
            if (e.key === 'matchingSettings') {
                console.log('[Discovery] Detected config change via storage event');
                this.refreshMatcherConfig();
            }
        });

        // Initialize both semantic matcher and Fuse.js (fallback)
        this.initializeSemanticMatcher();
        this.initializeFuse();
    }

    initializeSmartMatcher() {
        if (typeof SmartMatcher === 'undefined') {
            console.warn('[Discovery] SmartMatcher not loaded. Using fallback Fuse.js.');
            this.smartMatcher = null;
            return;
        }

        // Load settings from localStorage (admin matcher's config)
        const savedSettings = JSON.parse(localStorage.getItem('matchingSettings') || '{}');

        // Discovery-optimized defaults (used if no admin settings)
        const defaultWeights = {
            tags: 30,          // Tag matching (important for theme-based searches)
            keywords: 20,      // Keyword matching (important for text searches)
            city: 15,          // City matching (important for location-based searches)
            theme: 10,         // Theme matching
            semantic: 25,      // Semantic text similarity (important for natural queries)
            proximity: 35      // Geographical proximity (highest priority for local searches)
        };

        // Use admin settings if available, otherwise use discovery-optimized defaults
        const config = {
            weights: savedSettings.weights || defaultWeights,
            cityMatchMode: savedSettings.cityMatchMode || 'fuse',
            semanticThreshold: savedSettings.semanticThreshold || 0.35,
            minMatchScore: savedSettings.minMatchScore || 0.25,
            proximityEnabled: savedSettings.proximityEnabled !== false, // Respect admin's proximity toggle
            maxDistanceKm: savedSettings.maxDistanceKm || 50
        };

        this.smartMatcher = new SmartMatcher(config);

        console.log('[Discovery] SmartMatcher initialized with config:', config);
        console.log('[Discovery] Using admin settings:', savedSettings.weights ? 'YES' : 'NO (defaults)');
    }

    /**
     * Refresh matcher configuration from localStorage
     * Called when admin settings change
     */
    refreshMatcherConfig() {
        console.log('[Discovery] Refreshing matcher config from localStorage...');
        this.initializeSmartMatcher();
        console.log('[Discovery] Matcher config refreshed');
    }

    async initializeSemanticMatcher() {
        if (typeof window.semanticMatcher === 'undefined' || !window.semanticMatcher.isReady) {
            console.log('[Discovery] SemanticMatcher not ready yet');
            return;
        }

        try {
            console.log('[Discovery] Precomputing embeddings for', this.allResources.length, 'resources...');

            // Precompute embeddings for all resources
            this.resourceEmbeddings = [];

            for (const resource of this.allResources) {
                // Create rich text representation
                const resourceText = this.getResourceText(resource);

                // Get embedding
                const embedding = await window.semanticMatcher.embed(resourceText);
                this.resourceEmbeddings.push({
                    resource: resource,
                    embedding: embedding,
                    text: resourceText
                });
            }

            console.log('[Discovery] Semantic matching ready for', this.resourceEmbeddings.length, 'resources!');
        } catch (error) {
            console.error('[Discovery] Failed to initialize semantic matcher:', error);
        }
    }

    getResourceText(resource) {
        const parts = [resource.name];

        // Add description
        if (resource.description) parts.push(resource.description);

        // Add themes/focus areas/domains
        if (resource.themes) parts.push(...resource.themes);
        if (resource.focus_areas) parts.push(...resource.focus_areas);
        if (resource.domains) parts.push(...resource.domains);

        // Add asks and offers
        if (resource.asks) parts.push(...resource.asks);
        if (resource.offers) parts.push(...resource.offers);
        if (resource.infrastructure_offers) parts.push(...resource.infrastructure_offers);

        // Add location
        if (resource.neighborhood) parts.push(resource.neighborhood);
        if (resource.city) parts.push(resource.city);

        return parts.join(' ');
    }

    initializeFuse() {
        // Configure Fuse.js with weighted keys for better relevance
        const fuseOptions = {
            keys: [
                { name: 'name', weight: 2.0 },                           // Name is most important
                { name: 'themes', weight: 1.5 },                         // Themes for communities
                { name: 'focus_areas', weight: 1.5 },                    // Focus areas (legacy/providers)
                { name: 'domains', weight: 1.5 },                        // Domains (for providers)
                { name: 'asks', weight: 1.3 },                           // What communities need
                { name: 'offers', weight: 1.3 },                         // What communities offer
                { name: 'infrastructure_offers', weight: 1.2 },          // Infrastructure available
                { name: 'neighborhood', weight: 1.2 },                   // Neighborhood (boosted)
                { name: 'city', weight: 1.0 },                           // City matching
                { name: 'location', weight: 1.0 },                       // Combined location (if available)
                { name: 'metadata.searchable_content', weight: 0.8 },    // Markdown content keywords
                { name: 'state', weight: 0.7 },                          // State
                { name: 'description', weight: 0.5 }                     // Description (if available)
            ],
            threshold: 0.5,                 // 0 = exact match, 1 = match anything (relaxed)
            distance: 100,                  // How far to search in the text
            includeScore: true,             // Include match score for sorting
            minMatchCharLength: 2,          // Minimum character length to match
            shouldSort: true,               // Sort by best match
            findAllMatches: false,          // Stop at first good match per item
            ignoreLocation: true,           // Search entire string, not just beginning
            useExtendedSearch: false        // Simple fuzzy search
        };

        // Check if Fuse is available
        if (typeof Fuse === 'undefined') {
            console.error('Fuse.js not loaded. Falling back to basic search.');
            this.fuse = null;
            return;
        }

        this.fuse = new Fuse(this.allResources, fuseOptions);
    }

    async search(query) {
        const queryLower = query.toLowerCase();

        console.log('[Discovery] Search query:', query);
        console.log('[Discovery] Total resources:', this.allResources.length);
        console.log('[Discovery] Communities:', this.communities.length);
        console.log('[Discovery] Providers:', this.members.length);

        // Detect if user is asking for specific resource type
        const requestedType = this.detectResourceType(queryLower);
        console.log('[Discovery] Requested type:', requestedType);

        // A named city narrows every result to that city; the rest of the
        // question is matched within it ("waste in Pune" → "waste").
        const found = typeof findCityIn === 'function' ? findCityIn(queryLower) : null;
        const city = found?.city || '';
        const keep = (r) => (!requestedType || r.resourceType === requestedType) &&
            (!city || this.cityOf(r) === city);

        // Remove resource type keywords (and the city) from query for better matching
        const cleanQuery = this.cleanQuery(found ? queryLower.replace(found.phrase, ' ') : queryLower);
        console.log('[Discovery] Clean query:', cleanQuery, 'City:', city || '(any)');

        // Just a city ("communities in Pune"): everyone there.
        if (city && !cleanQuery) {
            return this.allResources.filter(keep).slice(0, 10);
        }

        // Try SmartMatcher first (multi-component scoring)
        if (this.smartMatcher) {
            console.log('[Discovery] Using SmartMatcher (multi-component scoring)...');
            try {
                // Use SmartMatcher's search method
                const smartResults = await this.smartMatcher.search(cleanQuery, this.allResources.filter(keep), {
                    limit: 10,
                    minScore: 0.25  // Lower threshold for discovery (more results)
                });

                if (smartResults.length > 0) {
                    console.log('[Discovery] SmartMatcher found', smartResults.length, 'matches');
                    console.log('[Discovery] Top match:', smartResults[0].name, 'Score:', smartResults[0].matchScore.toFixed(3));
                    return smartResults;
                }
            } catch (error) {
                console.error('[Discovery] SmartMatcher search error:', error);
                // Fall through to other methods
            }
        }

        // Fall back to semantic matching (legacy)
        if (this.resourceEmbeddings && this.resourceEmbeddings.length > 0) {
            console.log('[Discovery] Using semantic matching (fallback)...');
            try {
                const semanticResults = await this.semanticSearch(cleanQuery, keep);
                if (semanticResults.length > 0) {
                    console.log('[Discovery] Found', semanticResults.length, 'semantic matches');
                    return semanticResults;
                }
            } catch (error) {
                console.error('[Discovery] Semantic search error:', error);
            }
        }

        // Fall back to Fuse.js (final fallback)
        if (!this.fuse) {
            console.warn('[Discovery] Fuse.js not available, using basic search');
            return this.basicSearch(cleanQuery, keep);
        }

        console.log('[Discovery] Using Fuse.js fuzzy matching (final fallback)...');
        // Use Fuse.js for fuzzy search
        const results = this.fuse.search(cleanQuery).filter(result => keep(result.item)).map(result => ({
            ...result.item,
            matchScore: 1 - result.score  // Invert score (lower Fuse score = better match)
        }));

        console.log('[Discovery] Final results after filtering:', results.length);
        if (results.length > 0) {
            console.log('[Discovery] Top result:', results[0]);
        }

        // Return top 10 results
        return results.slice(0, 10);
    }

    /**
     * Semantic search using Transformers.js embeddings
     * @param {string} query - The search query
     * @param {Function} keep - Which resources may be returned (type and city)
     * @returns {Array} - Matching resources with semantic scores
     */
    async semanticSearch(query, keep) {
        if (!window.semanticMatcher || !window.semanticMatcher.isReady) {
            console.warn('[Discovery] SemanticMatcher not ready');
            return [];
        }

        try {
            // Embed the search query
            const queryEmbedding = await window.semanticMatcher.embed(query);

            const matches = [];
            const SEMANTIC_THRESHOLD = 0.4;  // Minimum similarity score (0-1)

            // Calculate similarity with all resource embeddings
            for (const resEmb of this.resourceEmbeddings) {
                const similarity = window.semanticMatcher.cosineSimilarity(queryEmbedding, resEmb.embedding);

                if (similarity >= SEMANTIC_THRESHOLD && keep(resEmb.resource)) {
                    matches.push({
                        ...resEmb.resource,
                        matchScore: similarity,
                        matchType: 'semantic',
                        matchedText: resEmb.text
                    });
                }
            }

            // Sort by similarity score (highest first) and return top 10
            const sortedMatches = matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 10);

            console.log('[Discovery] Semantic search found', sortedMatches.length, 'matches');
            if (sortedMatches.length > 0) {
                console.log('[Discovery] Top semantic match:', sortedMatches[0].name, 'Score:', sortedMatches[0].matchScore.toFixed(3));
            }

            return sortedMatches;
        } catch (error) {
            console.error('[Discovery] Semantic search error:', error);
            return [];
        }
    }

    // Fallback basic search if Fuse.js fails to load
    basicSearch(cleanQuery, keep) {
        const queryWords = cleanQuery.split(/\s+/).filter(w => w.length > 0);
        const matchScores = new Map();

        this.allResources.forEach((resource, idx) => {
            const searchText = [
                resource.name,
                resource.location,
                resource.city,
                resource.neighborhood,
                resource.state,
                ...(resource.themes || []),                      // Communities use 'themes'
                ...(resource.focus_areas || []),                  // Providers use 'focus_areas'
                ...(resource.domains || []),
                ...(resource.asks || []),                         // What communities need
                ...(resource.offers || []),                       // What communities offer
                ...(resource.infrastructure_offers || []),        // Infrastructure available
                resource.description,
                resource.metadata?.searchable_content || ''       // Indexed markdown content
            ].filter(Boolean).join(' ').toLowerCase();

            queryWords.forEach(word => {
                if (searchText.includes(word)) {
                    matchScores.set(idx, (matchScores.get(idx) || 0) + 1);
                }
            });
        });

        return Array.from(matchScores.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([idx, score]) => ({
                ...this.allResources[idx],
                matchScore: score
            }))
            .filter(keep)
            .slice(0, 10);
    }

    /** One spelling of the city a community or provider is in ("bangalore" → "Bengaluru"). */
    cityOf(resource) {
        return typeof normaliseCity === 'function' ? normaliseCity(resource.city || resource.location) : '';
    }

    /** Everyone registered in `city`, communities and providers. */
    resourcesIn(city) {
        return this.allResources.filter(r => this.cityOf(r) === city);
    }

    detectResourceType(query) {
        // Keywords that indicate user wants communities
        const communityKeywords = [
            'community', 'communities', 'neighbourhood', 'neighborhood',
            'resident', 'residents', 'rwa', 'local group', 'civic group'
        ];

        // Keywords that indicate user wants providers
        const providerKeywords = [
            'provider', 'providers', 'organization', 'organizations',
            'ngo', 'ngos', 'company', 'companies', 'service', 'services',
            'solution provider', 'vendor', 'agency'
        ];

        // Check for community keywords
        if (communityKeywords.some(keyword => query.includes(keyword))) {
            return 'community';
        }

        // Check for provider keywords
        if (providerKeywords.some(keyword => query.includes(keyword))) {
            return 'provider';
        }

        // No specific type requested - search both
        return null;
    }

    cleanQuery(query) {
        // Remove resource type keywords and common words to improve matching
        const stopWords = [
            'community', 'communities', 'provider', 'providers',
            'organization', 'organizations', 'find', 'search',
            'looking for', 'show me', 'in', 'at', 'near',
            'the', 'a', 'an'
        ];

        let cleaned = query;
        stopWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            cleaned = cleaned.replace(regex, ' ');
        });

        // Clean up multiple spaces
        return cleaned.replace(/\s+/g, ' ').trim();
    }

    searchByTheme(theme) {
        return this.communities.filter(community => {
            // Check both 'themes' (communities) and 'focus_areas' (providers)
            const areas = community.themes || community.focus_areas || [];
            if (areas.length === 0) return false;
            return areas.some(area =>
                area.toLowerCase().includes(theme.toLowerCase())
            );
        });
    }

    searchByLocation(city, neighborhood) {
        return this.communities.filter(community => {
            // Communities have separate city and neighborhood fields
            const communityCity = (community.city || '').toLowerCase();
            const communityNeighborhood = (community.neighborhood || '').toLowerCase();
            const communityLocation = (community.location || '').toLowerCase(); // Fallback for providers

            if (neighborhood) {
                // Search for both city and neighborhood
                const neighborhoodMatch = communityNeighborhood.includes(neighborhood.toLowerCase()) ||
                                         communityLocation.includes(neighborhood.toLowerCase());
                const cityMatch = communityCity.includes(city.toLowerCase()) ||
                                communityLocation.includes(city.toLowerCase());
                return neighborhoodMatch && cityMatch;
            }

            // Search for city only
            return communityCity.includes(city.toLowerCase()) ||
                   communityLocation.includes(city.toLowerCase());
        });
    }

    detectIntent(query) {
        const q = query.toLowerCase();

        if (q.includes('find') || q.includes('search') || q.includes('looking for')) {
            return 'find_community';
        }

        if (q.includes('need') || q.includes('offer') || q.includes('funding') ||
            q.includes('volunteer') || q.includes('space') || q.includes('help')) {
            return 'match_resource';
        }

        if (q.includes('near') || q.includes(' in ') || q.includes('around')) {
            return 'location_search';
        }

        // Theme keywords
        const themes = ['waste', 'education', 'water', 'health', 'women', 'environment',
                       'sanitation', 'tree', 'park', 'garden', 'clean'];

        if (themes.some(theme => q.includes(theme))) {
            return 'theme_search';
        }

        return 'general_search';
    }
}
