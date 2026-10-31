/**
 * Discovery Engine
 * Finds communities and solution providers for the chatbot's "Find communities"
 * mode, using the keyword index in search-index.js and the city helpers in
 * city-map.js.
 */

class DiscoveryEngine {
    constructor(communities, members) {
        this.communities = communities || [];
        this.members = members || [];
        this.allResources = [
            ...this.communities.map(c => ({...c, resourceType: 'community'})),
            ...this.members.map(m => ({...m, resourceType: 'provider'}))
        ];
        this.index = buildSearchIndex(this.allResources);
    }

    async search(query) {
        const queryLower = query.toLowerCase();

        // Detect if user is asking for specific resource type
        const requestedType = this.detectResourceType(queryLower);

        // A named city narrows every result to that city; the rest of the
        // question is matched within it ("waste in Pune" → "waste").
        const found = typeof findCityIn === 'function' ? findCityIn(queryLower) : null;
        const city = found?.city || '';
        const keep = (r) => (!requestedType || r.resourceType === requestedType) &&
            (!city || this.cityOf(r) === city);
        const rest = found ? queryLower.replace(found.phrase, ' ') : queryLower;

        // Just a city ("communities in Pune"): everyone there.
        if (city && !tokenize(rest).length) {
            return this.allResources.filter(keep).slice(0, 10);
        }

        return searchIndex(this.index, rest, keep)
            .slice(0, 10)
            .map(({ resource, score }) => ({ ...resource, matchScore: score }));
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
}
