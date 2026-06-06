// Communities CRUD Management

let communities = [];
let isEditing = false;
let editingId = null;
let wardMapping = null;
let locationMap = null;
let locationMarker = null;

// SECURITY: HTML escaping function to prevent XSS attacks
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Require authentication and load data
(async function() {
    const session = await authUtils.requireAuth();
    if (!session) return;

    // Load ward mapping
    try {
        const response = await fetch('/assets/geodata/ward-mapping.json');
        wardMapping = await response.json();
        console.log('Loaded ward mapping');
    } catch (error) {
        console.warn('Could not load ward mapping:', error);
    }

    await loadCommunities();
    setupEventListeners();
    setupModalDrag();
    setupStoryModalDrag();
    setupFormModalDrag();
})();

let currentStatusFilter = 'all';
window.currentStatusFilter = 'all'; // Expose to window for Excel export

async function loadCommunities() {
    const supabase = authUtils.supabase;

    let query = supabase
        .from('file_metadata')
        .select('*')
        .eq('file_type', 'community')
        .order('slug', { ascending: true });

    if (currentStatusFilter !== 'all') {
        query = query.eq('status', currentStatusFilter);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error loading communities:', error);
        document.getElementById('communitiesList').innerHTML = '<p class="error">Failed to load communities</p>';
        return;
    }

    communities = data || [];
    window.communities = communities; // Expose to window for Excel export
    renderCommunities(communities);
}

function setStatusFilter(status, chipElement) {
    currentStatusFilter = status;
    window.currentStatusFilter = status; // Expose to window for Excel export

    // Update active chip
    document.querySelectorAll('.filter-chips .chip').forEach(chip => {
        chip.classList.remove('active');
    });
    chipElement.classList.add('active');

    // Reload communities
    loadCommunities();
}

function renderCommunities(comms) {
    const container = document.getElementById('communitiesList');

    // Update count display
    const countEl = document.getElementById('adminCommunityCount');
    if (countEl) {
        countEl.textContent = `(${comms.length})`;
    }

    if (comms.length === 0) {
        container.innerHTML = '<p class="empty-state">No communities found. Click "Add New" to create one.</p>';
        return;
    }

    container.innerHTML = comms.map(comm => {
        // SECURITY: Escape all user-supplied data to prevent XSS
        const name = escapeHtml(comm.metadata?.name || comm.slug);
        const city = escapeHtml(comm.metadata?.city || comm.city || 'City not specified');
        const state = escapeHtml(comm.metadata?.state || '');

        // Display neighborhoods with "First +N" format
        const neighborhoods = comm.metadata?.neighborhoods ||
                             (comm.neighborhood ? [comm.neighborhood] : []);
        const neighborhoodDisplay = neighborhoods.length > 0
            ? escapeHtml(neighborhoods[0]) + (neighborhoods.length > 1 ? ` +${neighborhoods.length - 1}` : '')
            : '';

        // Display wards with "First +N" format
        const wards = comm.metadata?.wards || (comm.ward ? [comm.ward] : []);
        const wardDisplay = wards.length > 0
            ? escapeHtml(wards[0]) + (wards.length > 1 ? ` +${wards.length - 1}` : '')
            : '';

        const themes = comm.metadata?.themes || [];
        const themesText = Array.isArray(themes) ? themes.slice(0, 3).map(t => escapeHtml(t)).join(', ') : escapeHtml(themes || '');
        const description = comm.metadata?.description || '';
        const truncatedDesc = escapeHtml(description.length > 100 ? description.substring(0, 100) + '...' : description);

        // Check for missing data
        const missing = [];
        if (!comm.latitude || !comm.longitude) missing.push('Location');
        if (wards.length === 0) missing.push('Ward');
        if (neighborhoods.length === 0) missing.push('Neighborhood');
        if (!themes || themes.length === 0) missing.push('Themes');
        if (!description) missing.push('Description');

        const missingBadge = missing.length > 0 ?
            `<div class="org-meta">
                <span style="color: #f59e0b;">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    Missing: ${missing.join(', ')}
                </span>
            </div>` : '';

        const statusIcon = comm.status === 'active' ? 'fa-circle-check' : comm.status === 'pending' ? 'fa-clock' : 'fa-circle';
        const statusEscaped = escapeHtml(comm.status);

        // Source badge — shows how this community was created
        const source = comm.metadata?.submitted_via;
        const sourceLabel = source === 'join_form' ? 'Form'
            : source === 'chatbot' ? 'Chatbot'
            : source === 'admin' ? 'Admin'
            : source === 'excel_import' ? 'Import'
            : 'Legacy';
        const sourceIcon = source === 'join_form' ? 'fa-file-pen'
            : source === 'chatbot' ? 'fa-robot'
            : source === 'admin' ? 'fa-user-lock'
            : source === 'excel_import' ? 'fa-file-excel'
            : 'fa-database';
        const sourceColor = source === 'join_form' ? '#3F5F7A'
            : source === 'chatbot' ? '#B04E24'
            : source === 'admin' ? '#2F4A2C'
            : source === 'excel_import' ? '#F5B82E'
            : '#888';

        return `
            <div class="org-card minimal ${comm.status === 'pending' ? 'pending-highlight' : ''}">
                <div class="org-info">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                        <h3>${name}</h3>
                        <span class="status-indicator ${statusEscaped}">
                            <i class="fa-solid ${statusIcon}"></i>
                            ${statusEscaped}
                        </span>
                        <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: ${sourceColor}15; color: ${sourceColor}; font-weight: 600; white-space: nowrap;">
                            <i class="fa-solid ${sourceIcon}" style="margin-right: 3px;"></i>${sourceLabel}
                        </span>
                    </div>
                    ${themesText ? `<p style="color: #666; font-size: 0.875rem; margin-bottom: 0.5rem;">${themesText}</p>` : ''}
                    ${description ? `<p style="color: #888; font-size: 0.875rem; margin-bottom: 0.5rem;">${truncatedDesc}</p>` : ''}
                    <div class="org-meta">
                        ${city ? `<span><i class="fa-solid fa-location-dot"></i> ${city}${state ? ', ' + state : ''}</span>` : ''}
                        ${neighborhoodDisplay ? `<span><i class="fa-solid fa-house"></i> ${neighborhoodDisplay}</span>` : ''}
                        ${wardDisplay ? `<span><i class="fa-solid fa-map"></i> ${wardDisplay}</span>` : ''}
                    </div>
                    ${missingBadge}
                </div>
                <div class="card-actions">
                    <button class="mini-icon-btn view" title="View Details" onclick="viewCommunity('${escapeHtml(comm.id)}')">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="mini-icon-btn edit" title="Edit" onclick="editCommunity('${escapeHtml(comm.id)}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="mini-icon-btn delete" title="Delete" onclick="deleteCommunity('${escapeHtml(comm.id)}', '${escapeHtml(comm.metadata?.name || comm.slug)}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    ${comm.status === 'pending' ?
                        `<button class="mini-icon-btn activate" title="Activate" onclick="updateStatus('${comm.id}', 'active')">
                            <i class="fa-solid fa-check"></i>
                        </button>` :
                        `<button class="mini-icon-btn deactivate" title="Deactivate" onclick="updateStatus('${comm.id}', 'archived')">
                            <i class="fa-solid fa-ban"></i>
                        </button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

function matchNeighborhoodToWard(neighborhood) {
    if (!neighborhood || !wardMapping) return null;

    const normalized = neighborhood.toLowerCase().trim();

    // Try exact match first
    if (wardMapping.mapping[normalized]) {
        return wardMapping.mapping[normalized];
    }

    // Try partial match
    for (const [key, value] of Object.entries(wardMapping.mapping)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return value;
        }
    }

    return null;
}

function setupEventListeners() {
    // Search with Fuse.js fuzzy matching
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.trim();

            if (!searchTerm) {
                // Show all communities if search is empty
                renderCommunities(communities);
                return;
            }

            // Configure Fuse.js for admin search
            const fuseOptions = {
                keys: [
                    { name: 'metadata.name', weight: 2.0 },              // Name highest priority
                    { name: 'metadata.neighborhoods', weight: 1.5 },     // Neighborhoods
                    { name: 'metadata.wards', weight: 1.5 },             // Wards
                    { name: 'metadata.city', weight: 1.2 },              // City
                    { name: 'city', weight: 1.2 },                       // City (fallback field)
                    { name: 'metadata.themes', weight: 1.0 },            // Themes
                    { name: 'metadata.state', weight: 0.8 },             // State
                    { name: 'slug', weight: 0.5 }                        // Slug lowest priority
                ],
                threshold: 0.4,                 // Fuzzy matching tolerance
                includeScore: true,             // Include relevance scores
                ignoreLocation: true,           // Search entire string
                shouldSort: true,               // Sort by relevance
                minMatchCharLength: 2           // Minimum characters to match
            };

            const fuse = new Fuse(communities, fuseOptions);
            const fuseResults = fuse.search(searchTerm);
            const filtered = fuseResults.map(result => result.item);

            renderCommunities(filtered);
        });
    }

    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', loadCommunities);
    }

    // Form submission
    const communityForm = document.getElementById('communityForm');
    if (communityForm) {
        communityForm.addEventListener('submit', handleFormSubmit);
    } else {
        console.error('communityForm not found! Form submit handler not attached.');
    }

    // Auto-populate ward when neighborhood changes (initial setup)
    setupNeighborhoodWardAutofill();

    // Check if URL has ?action=new
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'new') {
        showCreateForm();
    }
}

function showCreateForm() {
    isEditing = false;
    editingId = null;
    document.getElementById('modalTitle').textContent = 'Add Community';
    document.getElementById('communityForm').reset();
    document.getElementById('formModal').style.display = 'flex';

    // Initialize ward autocomplete
    setupWardAutocomplete();

    // Setup neighborhood-to-ward autofill
    setTimeout(() => {
        setupNeighborhoodWardAutofill();
    }, 50);

    // Initialize map
    setTimeout(() => {
        initLocationMap();
    }, 100);
}

async function editCommunity(id) {
    const comm = communities.find(c => c.id === id);
    if (!comm) return;

    isEditing = true;
    editingId = id;

    // Debug: log the raw data so we can inspect in console if fields appear empty
    console.log('[Admin] editCommunity data:', JSON.stringify({
        id: comm.id, slug: comm.slug,
        name: comm.metadata?.name, contact: comm.metadata?.contact,
        city: comm.metadata?.city, themes: comm.metadata?.themes
    }));

    try {

    document.getElementById('modalTitle').textContent = 'Edit Community';
    document.getElementById('commId').value = comm.id;
    document.getElementById('commFilePath').value = comm.file_path;
    document.getElementById('commName').value = comm.metadata?.name || comm.name || comm.slug || '';
    document.getElementById('commCity').value = comm.metadata?.city || comm.city || '';
    document.getElementById('commState').value = comm.metadata?.state || '';

    // Load neighborhoods - try plural first, fall back to singular for backward compatibility
    const neighborhoods = comm.metadata?.neighborhoods ||
                         (comm.neighborhood ? [comm.neighborhood] :
                         (comm.metadata?.neighborhood ? [comm.metadata.neighborhood] : []));
    document.getElementById('commNeighborhoods').value = neighborhoods.join('\n');

    // Load wards as chips - try plural first, fall back to singular
    const wards = comm.metadata?.wards ||
                 (comm.ward ? [comm.ward] : []);
    setSelectedWards(wards);

    document.getElementById('commDescription').value = comm.metadata?.description || '';
    document.getElementById('commPopulation').value = comm.metadata?.population || '';
    document.getElementById('commGeography').value = comm.metadata?.geography || '';
    // Set theme checkboxes
    const themes = comm.metadata?.themes || comm.metadata?.focus_areas || [];
    document.querySelectorAll('#commThemeCheckboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = themes.includes(cb.value);
    });
    // Handle "Other" themes not in THEME_CATEGORIES
    const knownThemes = typeof THEME_CATEGORIES !== 'undefined' ? THEME_CATEGORIES : [];
    const otherThemes = themes.filter(t => !knownThemes.includes(t));
    const otherCheck = document.getElementById('commThemeOtherCheck');
    const otherInput = document.getElementById('commThemeOtherInput');
    if (otherThemes.length > 0) {
        otherCheck.checked = true;
        otherInput.style.display = 'block';
        otherInput.value = otherThemes.join(', ');
    } else {
        otherCheck.checked = false;
        otherInput.style.display = 'none';
        otherInput.value = '';
    }
    document.getElementById('commLeadOrg').value = comm.metadata?.lead_organization || '';
    document.getElementById('commLeadOrgName').value = comm.metadata?.lead_organization_name || '';
    document.getElementById('commContactPerson').value = comm.metadata?.contact?.person || '';
    document.getElementById('commContactEmail').value = comm.metadata?.contact?.email || '';
    document.getElementById('commContactPhone').value = comm.metadata?.contact?.phone || '';
    document.getElementById('commOffers').value = (comm.metadata?.offers || []).join('\n');
    document.getElementById('commAsks').value = (comm.metadata?.asks || []).join('\n');
    document.getElementById('commStories').value = comm.metadata?.stories || '';
    document.getElementById('commStatus').value = comm.status || 'active';
    document.getElementById('commCollabStatus').value = comm.metadata?.collaboration_status || '';
    document.getElementById('commStarted').value = comm.metadata?.started || '';
    document.getElementById('commLastUpdated').value = comm.metadata?.last_updated || '';
    document.getElementById('commLatitude').value = comm.latitude || '';
    document.getElementById('commLongitude').value = comm.longitude || '';

    // Populate Elected Representatives fields
    document.getElementById('commMlaName').value = comm.metadata?.elected_representatives?.mla?.name || comm.metadata?.mla?.name || '';
    document.getElementById('commMlaParty').value = comm.metadata?.elected_representatives?.mla?.party || comm.metadata?.mla?.party || '';
    document.getElementById('commMlaConstituency').value = comm.metadata?.elected_representatives?.mla?.constituency || comm.metadata?.mla?.constituency || '';

    document.getElementById('commMpName').value = comm.metadata?.elected_representatives?.mp?.name || '';
    document.getElementById('commMpParty').value = comm.metadata?.elected_representatives?.mp?.party || '';
    document.getElementById('commMpConstituency').value = comm.metadata?.elected_representatives?.mp?.constituency || '';

    document.getElementById('commCorporatorName').value = comm.metadata?.elected_representatives?.corporator?.name || '';
    document.getElementById('commCorporatorParty').value = comm.metadata?.elected_representatives?.corporator?.party || '';
    document.getElementById('commCorporatorWard').value = comm.metadata?.elected_representatives?.corporator?.ward || '';

    document.getElementById('formModal').style.display = 'flex';

    // Initialize ward autocomplete
    setupWardAutocomplete();

    // Setup neighborhood-to-ward autofill
    setTimeout(() => {
        setupNeighborhoodWardAutofill();
    }, 50);

    // Initialize map and set marker if coordinates exist
    setTimeout(() => {
        initLocationMap();
        if (comm.latitude && comm.longitude) {
            setLocation(comm.latitude, comm.longitude);
        }
    }, 100);

    } catch (err) {
        console.error('[Admin] editCommunity error — some fields may not have populated:', err);
        alert('Warning: some form fields may not have loaded correctly. Check browser console for details.\n\n' + err.message);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const submitBtnText = document.getElementById('submitBtnText');
    const submitBtnLoader = document.getElementById('submitBtnLoader');

    submitBtn.disabled = true;
    submitBtnText.style.display = 'none';
    submitBtnLoader.style.display = 'inline-block';

    const name = document.getElementById('commName').value.trim();
    const city = document.getElementById('commCity').value.trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Parse neighborhoods (one per line from textarea)
    const neighborhoods = document.getElementById('commNeighborhoods').value
        .split('\n')
        .map(s => s.trim())
        .filter(s => s);

    // Get wards from chips (managed by chip functions)
    const wards = getSelectedWards();

    const contactPhone = document.getElementById('commContactPhone').value.trim();
    const stories = document.getElementById('commStories').value.trim();

    const metadata = {
        name: name,
        type: 'community',
        city: city,
        state: document.getElementById('commState').value.trim(),
        neighborhoods: neighborhoods,  // Array of neighborhoods
        wards: wards,                   // Array of wards
        description: document.getElementById('commDescription').value.trim(),
        population: document.getElementById('commPopulation').value.trim(),
        geography: document.getElementById('commGeography').value.trim(),
        themes: (function() {
            const checked = Array.from(document.querySelectorAll('#commThemeCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
            const otherCheck = document.getElementById('commThemeOtherCheck');
            const otherInput = document.getElementById('commThemeOtherInput');
            if (otherCheck?.checked && otherInput?.value.trim()) {
                checked.push(...otherInput.value.split(',').map(s => s.trim()).filter(s => s));
            }
            return checked;
        })(),
        focus_areas: (function() {
            const checked = Array.from(document.querySelectorAll('#commThemeCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
            const otherCheck = document.getElementById('commThemeOtherCheck');
            const otherInput = document.getElementById('commThemeOtherInput');
            if (otherCheck?.checked && otherInput?.value.trim()) {
                checked.push(...otherInput.value.split(',').map(s => s.trim()).filter(s => s));
            }
            return checked;
        })(),
        lead_organization: document.getElementById('commLeadOrg').value.trim(),
        lead_organization_name: document.getElementById('commLeadOrgName').value.trim(),
        contact: {
            person: document.getElementById('commContactPerson').value.trim(),
            email: document.getElementById('commContactEmail').value.trim(),
            phone: contactPhone
        },
        offers: document.getElementById('commOffers').value.split('\n').map(s => s.trim()).filter(s => s),
        asks: document.getElementById('commAsks').value.split('\n').map(s => s.trim()).filter(s => s),
        stories: stories || null,
        collaboration_status: document.getElementById('commCollabStatus').value.trim(),
        started: document.getElementById('commStarted').value,
        last_updated: new Date().toISOString().split('T')[0]
    };

    // Preserve the original source tracking fields from the existing record
    // so admin edits don't erase how the community was originally submitted.
    if (editingId) {
        const existing = communities.find(c => c.id === editingId);
        if (existing?.metadata?.submitted_via) {
            metadata.submitted_via = existing.metadata.submitted_via;
        }
        if (existing?.metadata?.submitted_at) {
            metadata.submitted_at = existing.metadata.submitted_at;
        }
    } else {
        // New community created by admin
        metadata.submitted_via = 'admin';
        metadata.submitted_at = new Date().toISOString();
    }

    // Add Elected Representatives information
    const mlaName = document.getElementById('commMlaName').value.trim();
    const mlaParty = document.getElementById('commMlaParty').value.trim();
    const mlaConstituency = document.getElementById('commMlaConstituency').value.trim();
    const mpName = document.getElementById('commMpName').value.trim();
    const mpParty = document.getElementById('commMpParty').value.trim();
    const mpConstituency = document.getElementById('commMpConstituency').value.trim();
    const corporatorName = document.getElementById('commCorporatorName').value.trim();
    const corporatorParty = document.getElementById('commCorporatorParty').value.trim();
    const corporatorWard = document.getElementById('commCorporatorWard').value.trim();

    if (mlaName || mlaParty || mlaConstituency || mpName || mpParty || mpConstituency || corporatorName || corporatorParty || corporatorWard) {
        metadata.elected_representatives = {
            mla: {
                name: mlaName,
                party: mlaParty,
                constituency: mlaConstituency
            },
            mp: {
                name: mpName,
                party: mpParty,
                constituency: mpConstituency
            },
            corporator: {
                name: corporatorName,
                party: corporatorParty,
                ward: corporatorWard
            }
        };
    }

    const status = document.getElementById('commStatus').value;

    // Debug: Log raw field values before parsing
    const latFieldValue = document.getElementById('commLatitude').value;
    const lngFieldValue = document.getElementById('commLongitude').value;
    console.log('Form submit - Raw field values:', {
        latFieldValue,
        lngFieldValue,
        latFieldExists: !!document.getElementById('commLatitude'),
        lngFieldExists: !!document.getElementById('commLongitude')
    });

    const latitude = latFieldValue ? parseFloat(latFieldValue) : null;
    const longitude = lngFieldValue ? parseFloat(lngFieldValue) : null;

    // Normalize city name for file path (lowercase, replace spaces with hyphens)
    const citySlug = city.toLowerCase().replace(/\s+/g, '-');
    const filePath = isEditing ? document.getElementById('commFilePath').value : `communities/${citySlug}/${slug}.md`;

    console.log('Form submit - Parsed coordinates:', { latitude, longitude });

    // Add location coordinates to metadata (for frontmatter)
    if (latitude !== null && longitude !== null) {
        metadata.location = {
            latitude: latitude,
            longitude: longitude
        };
    }

    // Add status to metadata
    metadata.status = status;

    const supabase = authUtils.supabase;

    try {
        if (isEditing) {
            // Update existing using Edge Function (storage-first architecture)
            console.log('Updating via Edge Function:', { file_path: filePath, updates: metadata });

            // Call Edge Function using Supabase client (handles auth automatically)
            const { data, error } = await supabase.functions.invoke('update-file', {
                body: {
                    file_path: filePath,
                    file_type: 'community',
                    updates: metadata,
                    markdown_body: stories || ''
                }
            });

            console.log('Edge Function response:', data);

            if (error) {
                throw new Error(error.message || 'Edge Function failed');
            }

            if (data?.error) {
                throw new Error(data.error);
            }
        } else {
            // Create new using Edge Function (storage-first architecture)
            console.log('Creating via Edge Function:', { file_path: filePath, updates: metadata });

            // Call Edge Function using Supabase client (handles auth automatically)
            const { data, error } = await supabase.functions.invoke('update-file', {
                body: {
                    file_path: filePath,
                    file_type: 'community',
                    updates: metadata,
                    markdown_body: stories || ''
                }
            });

            console.log('Edge Function response:', data);

            if (error) {
                throw new Error(error.message || 'Edge Function failed');
            }

            if (data?.error) {
                throw new Error(data.error);
            }
        }

        closeModal();
        await loadCommunities();
        alert(`Success: Community ${isEditing ? 'updated' : 'created'} successfully!`);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtnText.style.display = 'inline';
        submitBtnLoader.style.display = 'none';
    }
}

async function deleteCommunity(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
        return;
    }

    const supabase = authUtils.supabase;

    try {
        // Find the community to get file_path
        const community = communities.find(c => c.id === id);
        if (!community) {
            throw new Error('Community not found');
        }

        // Call delete-file Edge Function using Supabase client (handles auth automatically)
        const { data, error } = await supabase.functions.invoke('delete-file', {
            body: {
                file_path: community.file_path,
                file_type: 'community'
            }
        });

        if (error) {
            throw new Error(error.message || 'Delete failed');
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        await loadCommunities();
        alert('Success: Community deleted successfully!');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function updateStatus(id, newStatus) {
    const supabase = authUtils.supabase;

    try {
        // Find the community to get file_path
        const community = communities.find(c => c.id === id);
        if (!community) {
            throw new Error('Community not found');
        }

        // Call update-file Edge Function using Supabase client (handles auth automatically)
        const { data, error } = await supabase.functions.invoke('update-file', {
            body: {
                file_path: community.file_path,
                file_type: 'community',
                updates: { status: newStatus }
            }
        });

        if (error) {
            throw new Error(error.message || 'Status update failed');
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        await loadCommunities();
    } catch (error) {
        alert('Error updating status: ' + error.message);
    }
}

function closeModal() {
    document.getElementById('formModal').style.display = 'none';
    document.getElementById('communityForm').reset();
    isEditing = false;
    editingId = null;

    // Clean up map
    if (locationMap) {
        locationMap.remove();
        locationMap = null;
        locationMarker = null;
    }
}

// Populate ward dropdown
function populateWardDropdown() {
    const wardSelect = document.getElementById('commWard');
    if (!wardMapping || !wardMapping.wards) {
        console.warn('Ward mapping not loaded');
        return;
    }

    // Clear existing options except the first one
    wardSelect.innerHTML = '<option value="">Select Ward...</option>';

    // Add all wards as options
    wardMapping.wards.sort().forEach(ward => {
        const option = document.createElement('option');
        option.value = ward;
        option.textContent = ward;
        wardSelect.appendChild(option);
    });
}

// Story Editor Functions
function openStoryEditor() {
    const currentStory = document.getElementById('commStories').value;
    const storyModal = document.getElementById('storyModal');
    const storyEditor = document.getElementById('storyEditorText');

    storyEditor.value = currentStory;
    updateStoryPreview();

    // Reset modal position and size
    const modalContent = storyModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.transform = 'translate(-50%, -50%)';
        modalContent.style.left = '50%';
        modalContent.style.top = '50%';
        modalContent.style.width = '';
        modalContent.style.height = '';
    }

    storyModal.style.display = 'flex';

    // Setup live preview
    storyEditor.addEventListener('input', updateStoryPreview);
}

function updateStoryPreview() {
    const markdown = document.getElementById('storyEditorText').value;
    const preview = document.getElementById('storyPreview');

    if (!markdown.trim()) {
        preview.innerHTML = '<p style="color: #999; font-style: italic;">Preview will appear here...</p>';
        return;
    }

    // Use marked.js to parse markdown
    if (typeof marked !== 'undefined') {
        preview.innerHTML = marked.parse(markdown);
    } else {
        // Fallback to plain text if marked isn't loaded
        preview.innerHTML = '<pre>' + markdown + '</pre>';
    }
}

function saveStoryContent() {
    const storyContent = document.getElementById('storyEditorText').value;
    document.getElementById('commStories').value = storyContent;
    closeStoryEditor();
}

function closeStoryEditor() {
    const storyModal = document.getElementById('storyModal');
    storyModal.style.display = 'none';
}

// Map Picker Functions
function initLocationMap() {
    const mapContainer = document.getElementById('locationMap');
    if (!mapContainer) return;

    // Initialize map centered on Bangalore
    locationMap = L.map('locationMap').setView([12.9716, 77.5946], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(locationMap);

    // Click handler for placing marker
    locationMap.on('click', function(e) {
        setLocation(e.latlng.lat, e.latlng.lng);
    });

    // Fix map size after modal opens
    setTimeout(() => {
        locationMap.invalidateSize();
    }, 100);
}

function setLocation(lat, lng) {
    // Remove existing marker if any
    if (locationMarker) {
        locationMap.removeLayer(locationMarker);
    }

    // Add new marker
    locationMarker = L.marker([lat, lng], {
        draggable: true
    }).addTo(locationMap);

    // Update form fields
    const latField = document.getElementById('commLatitude');
    const lngField = document.getElementById('commLongitude');

    if (latField && lngField) {
        latField.value = lat;
        lngField.value = lng;
        console.log('Map picker - Set coordinates:', { lat, lng });
        console.log('Hidden fields after update:', {
            latValue: latField.value,
            lngValue: lngField.value
        });
    } else {
        console.error('Could not find hidden lat/lng fields!');
    }

    document.getElementById('currentCoords').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    // Handle marker drag
    locationMarker.on('dragend', function(e) {
        const newLatLng = e.target.getLatLng();
        latField.value = newLatLng.lat;
        lngField.value = newLatLng.lng;
        document.getElementById('currentCoords').textContent = `${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}`;
        console.log('Map picker - Marker dragged to:', { lat: newLatLng.lat, lng: newLatLng.lng });
    });

    // Center map on marker
    locationMap.setView([lat, lng], 15);
}

function clearLocation() {
    if (locationMarker) {
        locationMap.removeLayer(locationMarker);
        locationMarker = null;
    }
    document.getElementById('commLatitude').value = '';
    document.getElementById('commLongitude').value = '';
    document.getElementById('currentCoords').textContent = 'No location set';
    locationMap.setView([12.9716, 77.5946], 12);
}

// View Community Details
function viewCommunity(id) {
    const comm = communities.find(c => c.id === id);
    if (!comm) return;

    const meta = comm.metadata || {};
    const name = meta.name || comm.slug;
    const city = meta.city || comm.city || '';
    const state = meta.state || '';

    // Load neighborhoods as array (with backward compatibility)
    const neighborhoods = meta.neighborhoods || (comm.neighborhood ? [comm.neighborhood] : (meta.neighborhood ? [meta.neighborhood] : []));

    // Load wards as array (with backward compatibility)
    const wards = meta.wards || (comm.ward ? [comm.ward] : []);

    const themes = meta.themes || [];
    const description = meta.description || '';
    const contact = meta.contact || {};
    const offers = meta.offers || [];
    const asks = meta.asks || [];
    const stories = meta.stories || '';
    const population = meta.population || '';
    const geography = meta.geography || '';
    const leadOrg = meta.lead_organization_name || meta.lead_organization || '';
    const collabStatus = meta.collab_status || '';
    const elected_reps = meta.elected_representatives || {};

    // Update modal header
    document.getElementById('viewTitle').textContent = name;
    const statusIcon = comm.status === 'active' ? 'fa-circle-check' : comm.status === 'pending' ? 'fa-clock' : 'fa-circle';
    document.getElementById('viewStatus').innerHTML = `<i class="fa-solid ${statusIcon}"></i> ${comm.status}`;
    document.getElementById('viewStatus').className = `status-indicator ${comm.status}`;

    // Build view content
    let html = '';

    // Basic Info Section
    html += `
        <div class="detail-section">
            <h3 class="section-title">Basic Information</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">City</span>
                    <span class="detail-value">${city || '<span class="empty">Not specified</span>'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">State</span>
                    <span class="detail-value">${state || '<span class="empty">Not specified</span>'}</span>
                </div>
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <span class="detail-label">Neighborhoods</span>
                    <span class="detail-value">
                        ${neighborhoods.length > 0
                            ? neighborhoods.map(n => `<span class="tag">${n}</span>`).join('')
                            : '<span class="empty">Not specified</span>'}
                    </span>
                </div>
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <span class="detail-label">Wards</span>
                    <span class="detail-value">
                        ${wards.length > 0
                            ? wards.map(w => `<span class="tag">${w}</span>`).join('')
                            : '<span class="empty">Not specified</span>'}
                    </span>
                </div>
                ${population ? `
                <div class="detail-item">
                    <span class="detail-label">Population</span>
                    <span class="detail-value">${population}</span>
                </div>` : ''}
                ${geography ? `
                <div class="detail-item">
                    <span class="detail-label">Geography</span>
                    <span class="detail-value">${geography}</span>
                </div>` : ''}
            </div>
            ${description ? `<p style="margin-top: 1rem; color: #555; line-height: 1.6;">${description}</p>` : ''}
        </div>
    `;

    // Location Section
    if (comm.latitude && comm.longitude) {
        html += `
            <div class="detail-section">
                <h3 class="section-title">Location</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Latitude</span>
                        <span class="detail-value">${comm.latitude}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Longitude</span>
                        <span class="detail-value">${comm.longitude}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Themes Section
    if (themes.length > 0) {
        html += `
            <div class="detail-section">
                <h3 class="section-title">Focus Areas / Themes</h3>
                <div class="tag-list">
                    ${themes.map(theme => `<span class="tag">${theme}</span>`).join('')}
                </div>
            </div>
        `;
    }

    // Elected Representatives
    if (elected_reps && Object.keys(elected_reps).length > 0) {
        html += `
            <div class="detail-section">
                <h3 class="section-title">Elected Representatives</h3>
        `;
        if (elected_reps.mla) {
            html += `
                <div style="margin-bottom: 1rem;">
                    <div style="font-weight: 600; color: #667eea; margin-bottom: 0.5rem;">MLA</div>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Name</span>
                            <span class="detail-value">${elected_reps.mla.name || '<span class="empty">Not specified</span>'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Party</span>
                            <span class="detail-value">${elected_reps.mla.party || '<span class="empty">Not specified</span>'}</span>
                        </div>
                        <div class="detail-item" style="grid-column: 1 / -1;">
                            <span class="detail-label">Constituency</span>
                            <span class="detail-value">${elected_reps.mla.constituency || '<span class="empty">Not specified</span>'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        if (elected_reps.mp) {
            html += `
                <div style="margin-bottom: 1rem;">
                    <div style="font-weight: 600; color: #667eea; margin-bottom: 0.5rem;">MP</div>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Name</span>
                            <span class="detail-value">${elected_reps.mp.name || '<span class="empty">Not specified</span>'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Party</span>
                            <span class="detail-value">${elected_reps.mp.party || '<span class="empty">Not specified</span>'}</span>
                        </div>
                        <div class="detail-item" style="grid-column: 1 / -1;">
                            <span class="detail-label">Constituency</span>
                            <span class="detail-value">${elected_reps.mp.constituency || '<span class="empty">Not specified</span>'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        if (elected_reps.corporator) {
            html += `
                <div>
                    <div style="font-weight: 600; color: #667eea; margin-bottom: 0.5rem;">Corporator</div>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Name</span>
                            <span class="detail-value">${elected_reps.corporator.name || '<span class="empty">Not specified</span>'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Party</span>
                            <span class="detail-value">${elected_reps.corporator.party || '<span class="empty">Not specified</span>'}</span>
                        </div>
                        <div class="detail-item" style="grid-column: 1 / -1;">
                            <span class="detail-label">Ward</span>
                            <span class="detail-value">${elected_reps.corporator.ward || '<span class="empty">Not specified</span>'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
    }

    // Lead Organization
    if (leadOrg) {
        html += `
            <div class="detail-section">
                <h3 class="section-title">Lead Organization</h3>
                <div class="detail-grid">
                    <div class="detail-item" style="grid-column: 1 / -1;">
                        <span class="detail-value">${leadOrg}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Contact Section
    if (contact && (contact.person || contact.email || contact.phone)) {
        html += `
            <div class="detail-section">
                <h3 class="section-title">Contact Information</h3>
                <div class="detail-grid">
                    ${contact.person ? `
                    <div class="detail-item">
                        <span class="detail-label">Contact Person</span>
                        <span class="detail-value">${contact.person}</span>
                    </div>` : ''}
                    ${contact.email ? `
                    <div class="detail-item">
                        <span class="detail-label">Email</span>
                        <span class="detail-value"><a href="mailto:${contact.email}">${contact.email}</a></span>
                    </div>` : ''}
                    ${contact.phone ? `
                    <div class="detail-item">
                        <span class="detail-label">Phone</span>
                        <span class="detail-value"><a href="tel:${contact.phone}">${contact.phone}</a></span>
                    </div>` : ''}
                </div>
            </div>
        `;
    }

    // Offers Section
    if (offers.length > 0) {
        html += `
            <div class="detail-section">
                <h3 class="section-title">What They Offer</h3>
                <ul style="margin: 0; padding-left: 1.5rem;">
                    ${offers.map(offer => `<li style="margin-bottom: 0.5rem;">${offer}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    // Asks Section
    if (asks.length > 0) {
        html += `
            <div class="detail-section">
                <h3 class="section-title">What They Need</h3>
                <ul style="margin: 0; padding-left: 1.5rem;">
                    ${asks.map(ask => `<li style="margin-bottom: 0.5rem;">${ask}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    // Stories Section (Markdown formatted)
    if (stories && stories.trim()) {
        html += `
            <div class="detail-section">
                <h3 class="section-title">Stories & Impact</h3>
                <div class="markdown-content">
                    ${typeof marked !== 'undefined' ? marked.parse(stories) : '<pre>' + stories + '</pre>'}
                </div>
            </div>
        `;
    }

    // Collaboration Status
    if (collabStatus) {
        html += `
            <div class="detail-section">
                <h3 class="section-title">Collaboration Status</h3>
                <div class="detail-value">${collabStatus}</div>
            </div>
        `;
    }

    document.getElementById('viewBody').innerHTML = html;

    // Reset modal position and size
    const modalContent = document.querySelector('#viewModal .modal-content');
    if (modalContent) {
        modalContent.style.transform = 'translate(-50%, -50%)';
        modalContent.style.left = '50%';
        modalContent.style.top = '50%';
        modalContent.style.width = '';
        modalContent.style.height = '';
    }

    document.getElementById('viewModal').style.display = 'flex';
}

function closeViewModal() {
    document.getElementById('viewModal').style.display = 'none';
}

// BBMP Wards List (Complete list of all 243 wards + 15 upcoming wards)
const BBMP_WARDS = [
    "Ward 1 - Yeshwanthpura",
    "Ward 2 - Doddabommasandra",
    "Ward 3 - Vishwanathapura",
    "Ward 4 - Nagashettyhalli",
    "Ward 5 - Chowdeshwari",
    "Ward 6 - Laggere",
    "Ward 7 - Radhakrishna Temple",
    "Ward 8 - Nandini Layout",
    "Ward 9 - Peenya Industrial Area",
    "Ward 10 - Lakshmi Devi Nagar",
    "Ward 11 - Peenya",
    "Ward 12 - Jalahalli",
    "Ward 13 - Radhakrishna Nagar",
    "Ward 14 - Kodigehalli",
    "Ward 15 - Vidyaranyapura",
    "Ward 16 - Dodda Bommasandra",
    "Ward 17 - Kuvempu Layout",
    "Ward 18 - Hebbal",
    "Ward 19 - Vishwanath Nagenahalli",
    "Ward 20 - Nagavara",
    "Ward 21 - HBR Layout",
    "Ward 22 - Horamavu",
    "Ward 23 - Ramamurthy Nagar",
    "Ward 24 - Banasavadi",
    "Ward 25 - Kammanahalli",
    "Ward 26 - Kacharkanahalli",
    "Ward 27 - Kadugondanahalli",
    "Ward 28 - Kushal Nagar",
    "Ward 29 - Kaval Byrasandra",
    "Ward 30 - Jayachamarajapura",
    "Ward 31 - Manorayanapalya",
    "Ward 32 - Ganganagar",
    "Ward 33 - Sagayapura",
    "Ward 34 - Shantala Nagar",
    "Ward 35 - Bharathi Nagar",
    "Ward 36 - Pulakeshi Nagar",
    "Ward 37 - Sarvagnanagar",
    "Ward 38 - DJ Halli",
    "Ward 39 - Varthuru",
    "Ward 40 - Maruthi Seva Nagar",
    "Ward 41 - Benniganahalli",
    "Ward 42 - Vannarpet",
    "Ward 43 - R.T. Nagar",
    "Ward 44 - Malleshwaram",
    "Ward 45 - Jayamahal",
    "Ward 46 - Rajaji Nagar",
    "Ward 47 - Prakashnagar",
    "Ward 48 - Basaveshwara Nagar",
    "Ward 49 - Rajaji Nagar(CMC)",
    "Ward 50 - Kaveripura",
    "Ward 51 - Govindaraja Nagar",
    "Ward 52 - Subramanya Nagar",
    "Ward 53 - Atturu",
    "Ward 54 - Chikka Banaswadi",
    "Ward 55 - Muneshwara Nagar",
    "Ward 56 - Pattabhirama Nagar",
    "Ward 57 - Nagarabhavi",
    "Ward 58 - Herohalli",
    "Ward 59 - Kottegepalya",
    "Ward 60 - Kengeri",
    "Ward 61 - RajaRajeshwari Nagar",
    "Ward 62 - Hosahalli",
    "Ward 63 - Giri Nagar",
    "Ward 64 - Katriguppe",
    "Ward 65 - Viswaneedam",
    "Ward 66 - Srinagar",
    "Ward 67 - Pattanagere",
    "Ward 68 - Chandra Layout",
    "Ward 69 - Shrinivasa Nagar",
    "Ward 70 - Banasavadi",
    "Ward 71 - Yediyur",
    "Ward 72 - Pattanagere",
    "Ward 73 - Rajarajeshwari Nagar",
    "Ward 74 - Uttarahalli",
    "Ward 75 - Kengeri Satellite Town",
    "Ward 76 - Jaraganahalli",
    "Ward 77 - Puttenahalli",
    "Ward 78 - Bilekhalli",
    "Ward 79 - Ganesha Mandira",
    "Ward 80 - Koramangala",
    "Ward 81 - Adugodi",
    "Ward 82 - Eajipura",
    "Ward 83 - Varthuru",
    "Ward 84 - Hongasandra",
    "Ward 85 - Bommanahalli",
    "Ward 86 - Arekere",
    "Ward 87 - Madiwala",
    "Ward 88 - BTM Layout",
    "Ward 89 - Koramangala",
    "Ward 90 - Hombe Gowda Nagar",
    "Ward 91 - JP Nagar",
    "Ward 92 - Sarakki",
    "Ward 93 - Shakambari Nagar",
    "Ward 94 - Banashankari Temple",
    "Ward 95 - Kumaraswamy Layout",
    "Ward 96 - Padmanabha Nagar",
    "Ward 97 - Chickpet",
    "Ward 98 - Shanthinagar",
    "Ward 99 - Sudham Nagar",
    "Ward 100 - Dharmaraja Koil",
    "Ward 101 - Vishveshwara Puram",
    "Ward 102 - Bhashyam Circle",
    "Ward 103 - Basavanagudi",
    "Ward 104 - Hanumanth Nagar",
    "Ward 105 - Sri Nagar",
    "Ward 106 - Katriguppe",
    "Ward 107 - Jayanagar",
    "Ward 108 - Vikasa Soudha",
    "Ward 109 - Jayanagar East",
    "Ward 110 - Gurappana Palya",
    "Ward 111 - Madivala",
    "Ward 112 - Jayanagar",
    "Ward 113 - Ragigudda",
    "Ward 114 - HSR Layout",
    "Ward 115 - Bommanahalli",
    "Ward 116 - Arakere Mico Layout",
    "Ward 117 - BTM Layout",
    "Ward 118 - Koramangala",
    "Ward 119 - Koramangala 4th Block",
    "Ward 120 - Shanthi Nagar",
    "Ward 121 - Jogupalya",
    "Ward 122 - Halsuru",
    "Ward 123 - Ulsoor",
    "Ward 124 - Bharathi Nagar",
    "Ward 125 - Shivaji Nagar",
    "Ward 126 - Vasanth Nagar",
    "Ward 127 - Gandhinagar",
    "Ward 128 - Subhash Nagar",
    "Ward 129 - Okalipuram",
    "Ward 130 - Yeshwanthpura",
    "Ward 131 - TP Kere",
    "Ward 132 - Goraguntepalya",
    "Ward 133 - Seshadripuram",
    "Ward 134 - Mahalakshmipuram",
    "Ward 135 - Rajajinagar",
    "Ward 136 - Malleshwaram",
    "Ward 137 - Gayathri Nagar",
    "Ward 138 - Aramane Nagar",
    "Ward 139 - Mathikere",
    "Ward 140 - Yeshwanthpura",
    "Ward 141 - Marappana Palya",
    "Ward 142 - Mallasandra",
    "Ward 143 - Nandini Layout",
    "Ward 144 - Sanjaynagar",
    "Ward 145 - Ganga Nagar",
    "Ward 146 - RT Nagar",
    "Ward 147 - Jayachamarajapuram",
    "Ward 148 - Kaval Byrasandra",
    "Ward 149 - Pulikeshinagar",
    "Ward 150 - Sri Rama Mandir",
    "Ward 151 - Domlur",
    "Ward 152 - Koramangala",
    "Ward 153 - Agara",
    "Ward 154 - Vannar Pet",
    "Ward 155 - Nilasandra",
    "Ward 156 - Shanthi Nagar",
    "Ward 157 - Sudham Nagar",
    "Ward 158 - Hosahalii",
    "Ward 159 - Amruthnagar",
    "Ward 160 - Hoysala Nagar",
    "Ward 161 - Lakkasandra",
    "Ward 162 - Adugodi",
    "Ward 163 - Ejipura",
    "Ward 164 - Neelasandra",
    "Ward 165 - Konena Agrahara",
    "Ward 166 - Shanthi Nagar",
    "Ward 167 - Dharmarajakoil",
    "Ward 168 - Channasandra",
    "Ward 169 - Kadugodi",
    "Ward 170 - Hagadur",
    "Ward 171 - Doddanekundi",
    "Ward 172 - Marathahalli",
    "Ward 173 - HAL Airport",
    "Ward 174 - Jeevan Bhima Nagar",
    "Ward 175 - Jogupalya",
    "Ward 176 - Halsoor",
    "Ward 177 - Bharathinagar",
    "Ward 178 - Shivaji Nagar",
    "Ward 179 - Vasanthanagar",
    "Ward 180 - Gandhi Nagar",
    "Ward 181 - Subhash Nagar",
    "Ward 182 - Cleveland Town",
    "Ward 183 - Shreeram Nagar",
    "Ward 184 - Ayappa Swamy Temple",
    "Ward 185 - Binnamangala",
    "Ward 186 - Bapuji Nagar",
    "Ward 187 - Kodichikkanhalli",
    "Ward 188 - Hudi",
    "Ward 189 - Singasandra",
    "Ward 190 - Begur",
    "Ward 191 - Arakere Mico Layout",
    "Ward 192 - Gottigere",
    "Ward 193 - Konankunte",
    "Ward 194 - Anjanpura",
    "Ward 195 - Vasanthpura",
    "Ward 196 - Marenahalli",
    "Ward 197 - Kalkere",
    "Ward 198 - Varthuru",
    "Ward 199 - Bellanduru",
    "Ward 200 - Koramangala",
    "Ward 201 - Agara",
    "Ward 202 - Hongasandra",
    "Ward 203 - Mangammanapalya",
    "Ward 204 - Singasandra",
    "Ward 205 - Begur",
    "Ward 206 - Bommanahalli",
    "Ward 207 - Koramangala 1st Block",
    "Ward 208 - Jakkasandra",
    "Ward 209 - HSR Layout",
    "Ward 210 - Bannerghatta",
    "Ward 211 - JP Nagar",
    "Ward 212 - Puttenahalli",
    "Ward 213 - Chikkalsandra",
    "Ward 214 - Uttarahalli",
    "Ward 215 - Yelachenahalli",
    "Ward 216 - Jaraganahalli",
    "Ward 217 - Rajarajeshwari Nagar",
    "Ward 218 - Kengeri",
    "Ward 219 - Jnana Bharathi",
    "Ward 220 - JP Park",
    "Ward 221 - Banashankari 2nd Stage",
    "Ward 222 - Kumaraswamy Layout",
    "Ward 223 - Padmanabhanagar",
    "Ward 224 - Chikkallasandra",
    "Ward 225 - Uttarahalli",
    "Ward 226 - Yelachenahalli",
    "Ward 227 - Kathriguppe",
    "Ward 228 - Thalaghattapura",
    "Ward 229 - Konanakunte",
    "Ward 230 - Anjanapura",
    "Ward 231 - Bangalore University",
    "Ward 232 - Yeshwanthpura",
    "Ward 233 - Nagashettyhalli",
    "Ward 234 - Makali",
    "Ward 235 - Dodda Bommasandra",
    "Ward 236 - JP Nagar",
    "Ward 237 - Padmanabhanagar",
    "Ward 238 - Banashankari Temple Ward",
    "Ward 239 - Sri Nagar",
    "Ward 240 - Kalkere",
    "Ward 241 - Hongasandra",
    "Ward 242 - Bommanahalli",
    "Ward 243 - Koramangala",
    "New Ward 1 - Anekal (Upcoming)",
    "New Ward 2 - Bommasandra (Upcoming)",
    "New Ward 3 - Sarjapur (Upcoming)",
    "New Ward 4 - Jigani (Upcoming)",
    "New Ward 5 - Attibele (Upcoming)",
    "New Ward 6 - Hennagara (Upcoming)",
    "New Ward 7 - Ragihalli (Upcoming)",
    "New Ward 8 - Kasavanahalli (Upcoming)",
    "New Ward 9 - Deverabi Sana Halli (Upcoming)",
    "New Ward 10 - Kaggalipura (Upcoming)",
    "New Ward 11 - Harohalli (Upcoming)",
    "New Ward 12 - Haragadde (Upcoming)",
    "New Ward 13 - Kalkere (Upcoming)",
    "New Ward 14 - Avalahalli (Upcoming)",
    "New Ward 15 - Chandapura (Upcoming)"
];

// Ward Chips State and Management Functions
let selectedWards = [];

// Add ward chip
function addWardChip(ward) {
    // Check for duplicates
    if (selectedWards.includes(ward)) {
        return;
    }

    selectedWards.push(ward);
    renderWardChips();

    // Clear autocomplete input
    const wardInput = document.getElementById('commWardInput');
    if (wardInput) {
        wardInput.value = '';
    }

    // Load elected representatives for first ward
    if (selectedWards.length === 1) {
        loadElectedRepresentatives(ward);
    }
}

// Remove ward chip
function removeWardChip(ward) {
    selectedWards = selectedWards.filter(w => w !== ward);
    renderWardChips();

    // If removed the first ward, reload representatives for new first ward
    if (selectedWards.length > 0) {
        loadElectedRepresentatives(selectedWards[0]);
    }
}

// Render ward chips HTML
function renderWardChips() {
    const container = document.getElementById('commWardChips');
    if (!container) return;

    if (selectedWards.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = selectedWards.map(ward => `
        <div class="ward-chip">
            <span>${ward}</span>
            <button type="button" onclick="removeWardChip('${ward.replace(/'/g, "\\'")}')">×</button>
        </div>
    `).join('');
}

// Get wards array (for form submission)
function getSelectedWards() {
    return selectedWards;
}

// Set wards array (for form loading)
function setSelectedWards(wards) {
    selectedWards = wards || [];
    renderWardChips();
}

// Ward Autocomplete functionality
let wardAutocomplete = {
    input: null,
    dropdown: null,
    filtered: [],
    selectedIndex: -1
};

function setupWardAutocomplete() {
    wardAutocomplete.input = document.getElementById('commWardInput');
    wardAutocomplete.dropdown = document.getElementById('wardDropdown');

    if (!wardAutocomplete.input || !wardAutocomplete.dropdown) return;

    // Input event
    wardAutocomplete.input.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase().trim();

        if (!query) {
            wardAutocomplete.dropdown.style.display = 'none';
            return;
        }

        // Filter wards
        wardAutocomplete.filtered = BBMP_WARDS.filter(ward =>
            ward.toLowerCase().includes(query)
        );

        if (wardAutocomplete.filtered.length === 0) {
            wardAutocomplete.dropdown.innerHTML = '<div class="autocomplete-no-results">No wards found</div>';
            wardAutocomplete.dropdown.style.display = 'block';
            return;
        }

        // Render dropdown
        wardAutocomplete.dropdown.innerHTML = wardAutocomplete.filtered
            .slice(0, 10) // Show max 10 results
            .map((ward, index) => `
                <div class="autocomplete-item" data-index="${index}" data-ward="${ward}">
                    ${ward.replace(new RegExp(query, 'gi'), match => `<strong>${match}</strong>`)}
                </div>
            `)
            .join('');

        wardAutocomplete.dropdown.style.display = 'block';
        wardAutocomplete.selectedIndex = -1;

        // Click handlers for items
        wardAutocomplete.dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', function() {
                addWardChip(this.dataset.ward);
                wardAutocomplete.dropdown.style.display = 'none';
            });
            item.addEventListener('mouseenter', function() {
                wardAutocomplete.selectedIndex = parseInt(this.dataset.index);
                updateActiveItem();
            });
        });
    });

    // Keyboard navigation
    wardAutocomplete.input.addEventListener('keydown', function(e) {
        if (!wardAutocomplete.dropdown.style.display || wardAutocomplete.dropdown.style.display === 'none') return;

        const items = wardAutocomplete.dropdown.querySelectorAll('.autocomplete-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            wardAutocomplete.selectedIndex = Math.min(wardAutocomplete.selectedIndex + 1, items.length - 1);
            updateActiveItem();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            wardAutocomplete.selectedIndex = Math.max(wardAutocomplete.selectedIndex - 1, 0);
            updateActiveItem();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (wardAutocomplete.selectedIndex >= 0 && items[wardAutocomplete.selectedIndex]) {
                addWardChip(items[wardAutocomplete.selectedIndex].dataset.ward);
                wardAutocomplete.dropdown.style.display = 'none';
            }
        } else if (e.key === 'Escape') {
            wardAutocomplete.dropdown.style.display = 'none';
        }
    });

    // Click outside to close
    document.addEventListener('click', function(e) {
        if (e.target !== wardAutocomplete.input && !wardAutocomplete.dropdown.contains(e.target)) {
            wardAutocomplete.dropdown.style.display = 'none';
        }
    });
}

function updateActiveItem() {
    const items = wardAutocomplete.dropdown.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
        if (index === wardAutocomplete.selectedIndex) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

// Neighborhood-to-Ward and Elected Representatives Autofill
function setupNeighborhoodWardAutofill() {
    const neighborhoodsField = document.getElementById('commNeighborhoods');
    if (!neighborhoodsField) return;

    // Remove any existing listeners to avoid duplicates
    const newNeighborhoodsField = neighborhoodsField.cloneNode(true);
    neighborhoodsField.parentNode.replaceChild(newNeighborhoodsField, neighborhoodsField);

    newNeighborhoodsField.addEventListener('blur', function() {
        const neighborhoods = this.value.split('\n').map(s => s.trim()).filter(s => s);

        if (neighborhoods.length === 0) return;

        // Map each neighborhood to its ward
        const mappedWards = neighborhoods
            .map(n => matchNeighborhoodToWard(n))
            .filter(w => w); // Remove nulls

        // Remove duplicates
        const uniqueWards = [...new Set(mappedWards)];

        if (uniqueWards.length > 0) {
            console.log(`Auto-populated ${uniqueWards.length} wards from ${neighborhoods.length} neighborhoods`);

            // Clear existing chips and add new ones
            selectedWards = [];
            uniqueWards.forEach(ward => addWardChip(ward));
        }
    });
}

// Load elected representatives based on ward
async function loadElectedRepresentatives(ward) {
    if (!ward) return;

    console.log(`Looking up elected representatives for ward: ${ward}`);

    try {
        // Try to load elected representatives mapping
        const response = await fetch('/assets/geodata/elected-representatives.json');
        if (!response.ok) {
            console.log('Elected representatives mapping not found - will need to be populated manually');
            return;
        }

        const electrepsData = await response.json();
        const normalized = ward.toLowerCase().trim();

        // Try to find a match
        const reps = electrepsData[ward] || electrepsData[normalized];

        if (reps) {
            // Populate MLA fields
            if (reps.mla) {
                const mlaNameField = document.getElementById('commMlaName');
                const mlaPartyField = document.getElementById('commMlaParty');
                const mlaConstituencyField = document.getElementById('commMlaConstituency');

                if (mlaNameField && !mlaNameField.value) mlaNameField.value = reps.mla.name || '';
                if (mlaPartyField && !mlaPartyField.value) mlaPartyField.value = reps.mla.party || '';
                if (mlaConstituencyField && !mlaConstituencyField.value) mlaConstituencyField.value = reps.mla.constituency || '';
            }

            // Populate MP fields
            if (reps.mp) {
                const mpNameField = document.getElementById('commMpName');
                const mpPartyField = document.getElementById('commMpParty');
                const mpConstituencyField = document.getElementById('commMpConstituency');

                if (mpNameField && !mpNameField.value) mpNameField.value = reps.mp.name || '';
                if (mpPartyField && !mpPartyField.value) mpPartyField.value = reps.mp.party || '';
                if (mpConstituencyField && !mpConstituencyField.value) mpConstituencyField.value = reps.mp.constituency || '';
            }

            // Populate Corporator fields
            if (reps.corporator) {
                const corpNameField = document.getElementById('commCorporatorName');
                const corpPartyField = document.getElementById('commCorporatorParty');
                const corpWardField = document.getElementById('commCorporatorWard');

                if (corpNameField && !corpNameField.value) corpNameField.value = reps.corporator.name || '';
                if (corpPartyField && !corpPartyField.value) corpPartyField.value = reps.corporator.party || '';
                if (corpWardField && !corpWardField.value) corpWardField.value = reps.corporator.ward || ward;
            }

            console.log('Auto-populated elected representatives:', reps);
        } else {
            console.log(`No elected representatives data found for ward: ${ward}`);
        }
    } catch (error) {
        console.log('Could not load elected representatives:', error.message);
    }
}

// Modal Drag and Resize Functionality
let modalDragState = {
    isDragging: false,
    isResizing: false,
    startX: 0,
    startY: 0,
    startTop: 0,
    startLeft: 0,
    startWidth: 0,
    startHeight: 0
};

function setupModalDrag() {
    const modal = document.getElementById('viewModal');
    const modalContent = modal.querySelector('.modal-content');
    const header = document.getElementById('viewModalHeader');
    const resizeHandle = modalContent.querySelector('.resize-handle');

    if (!header || !resizeHandle) return;

    // Drag functionality (header)
    header.addEventListener('mousedown', function(e) {
        // Don't drag if clicking on close button
        if (e.target.closest('.btn-close')) return;

        modalDragState.isDragging = true;
        modalDragState.startX = e.clientX;
        modalDragState.startY = e.clientY;

        const rect = modalContent.getBoundingClientRect();
        modalDragState.startLeft = rect.left;
        modalDragState.startTop = rect.top;

        modalContent.classList.add('dragging');
        // Remove transform to enable position-based movement
        modalContent.style.transform = 'none';
    });

    // Resize functionality (resize handle)
    resizeHandle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();

        modalDragState.isResizing = true;
        modalDragState.startX = e.clientX;
        modalDragState.startY = e.clientY;

        const rect = modalContent.getBoundingClientRect();
        modalDragState.startWidth = rect.width;
        modalDragState.startHeight = rect.height;

        modalContent.classList.add('resizing');
    });

    // Mouse move handler
    document.addEventListener('mousemove', function(e) {
        if (modalDragState.isDragging) {
            const deltaX = e.clientX - modalDragState.startX;
            const deltaY = e.clientY - modalDragState.startY;

            modalContent.style.left = (modalDragState.startLeft + deltaX) + 'px';
            modalContent.style.top = (modalDragState.startTop + deltaY) + 'px';
        }

        if (modalDragState.isResizing) {
            const deltaX = e.clientX - modalDragState.startX;
            const deltaY = e.clientY - modalDragState.startY;

            const newWidth = Math.max(500, modalDragState.startWidth + deltaX);
            const newHeight = Math.max(400, modalDragState.startHeight + deltaY);
            const maxHeight = window.innerHeight * 0.85;

            modalContent.style.width = newWidth + 'px';
            modalContent.style.height = Math.min(newHeight, maxHeight) + 'px';
        }
    });

    // Mouse up handler
    document.addEventListener('mouseup', function() {
        if (modalDragState.isDragging || modalDragState.isResizing) {
            modalDragState.isDragging = false;
            modalDragState.isResizing = false;
            modalContent.classList.remove('dragging', 'resizing');
        }
    });
}

// Story Modal Drag and Resize Functionality
let storyModalDragState = {
    isDragging: false,
    isResizing: false,
    startX: 0,
    startY: 0,
    startTop: 0,
    startLeft: 0,
    startWidth: 0,
    startHeight: 0
};

function setupStoryModalDrag() {
    const modal = document.getElementById('storyModal');
    if (!modal) return;

    const modalContent = modal.querySelector('.modal-content');
    const header = document.getElementById('storyModalHeader');
    const resizeHandle = modalContent.querySelector('.resize-handle');

    if (!header || !resizeHandle) return;

    // Drag functionality (header)
    header.addEventListener('mousedown', function(e) {
        // Don't drag if clicking on close button
        if (e.target.closest('.btn-close')) return;

        storyModalDragState.isDragging = true;
        storyModalDragState.startX = e.clientX;
        storyModalDragState.startY = e.clientY;

        const rect = modalContent.getBoundingClientRect();
        storyModalDragState.startLeft = rect.left;
        storyModalDragState.startTop = rect.top;

        modalContent.classList.add('dragging');
        // Remove transform to enable position-based movement
        modalContent.style.transform = 'none';
    });

    // Resize functionality (resize handle)
    resizeHandle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();

        storyModalDragState.isResizing = true;
        storyModalDragState.startX = e.clientX;
        storyModalDragState.startY = e.clientY;

        const rect = modalContent.getBoundingClientRect();
        storyModalDragState.startWidth = rect.width;
        storyModalDragState.startHeight = rect.height;

        modalContent.classList.add('resizing');
    });

    // Mouse move handler
    document.addEventListener('mousemove', function(e) {
        if (storyModalDragState.isDragging) {
            const deltaX = e.clientX - storyModalDragState.startX;
            const deltaY = e.clientY - storyModalDragState.startY;

            modalContent.style.left = (storyModalDragState.startLeft + deltaX) + 'px';
            modalContent.style.top = (storyModalDragState.startTop + deltaY) + 'px';
        }

        if (storyModalDragState.isResizing) {
            const deltaX = e.clientX - storyModalDragState.startX;
            const deltaY = e.clientY - storyModalDragState.startY;

            const newWidth = Math.max(600, storyModalDragState.startWidth + deltaX);
            const newHeight = Math.max(500, storyModalDragState.startHeight + deltaY);
            const maxHeight = window.innerHeight * 0.9;

            modalContent.style.width = newWidth + 'px';
            modalContent.style.height = Math.min(newHeight, maxHeight) + 'px';
        }
    });

    // Mouse up handler
    document.addEventListener('mouseup', function() {
        if (storyModalDragState.isDragging || storyModalDragState.isResizing) {
            storyModalDragState.isDragging = false;
            storyModalDragState.isResizing = false;
            modalContent.classList.remove('dragging', 'resizing');
        }
    });
}

// Form Modal Drag and Resize
let formModalDragState = {
    isDragging: false,
    isResizing: false,
    startX: 0,
    startY: 0,
    startTop: 0,
    startLeft: 0,
    startWidth: 0,
    startHeight: 0
};

function setupFormModalDrag() {
    const modal = document.getElementById('formModal');
    const modalContent = modal.querySelector('.modal-content');
    const header = document.getElementById('formModalHeader');
    const resizeHandle = modalContent.querySelector('.resize-handle');

    if (!header || !resizeHandle) return;

    // Drag functionality (header)
    header.addEventListener('mousedown', function(e) {
        // Don't drag if clicking on close button or input fields
        if (e.target.closest('.btn-close') || e.target.closest('input') || e.target.closest('textarea') || e.target.closest('select')) return;

        formModalDragState.isDragging = true;
        formModalDragState.startX = e.clientX;
        formModalDragState.startY = e.clientY;

        const rect = modalContent.getBoundingClientRect();
        formModalDragState.startLeft = rect.left;
        formModalDragState.startTop = rect.top;

        modalContent.classList.add('dragging');
        modalContent.style.transform = 'none';
    });

    // Resize functionality (resize handle)
    resizeHandle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();

        formModalDragState.isResizing = true;
        formModalDragState.startX = e.clientX;
        formModalDragState.startY = e.clientY;

        const rect = modalContent.getBoundingClientRect();
        formModalDragState.startWidth = rect.width;
        formModalDragState.startHeight = rect.height;

        modalContent.classList.add('resizing');
    });

    // Mouse move handler
    document.addEventListener('mousemove', function(e) {
        if (formModalDragState.isDragging) {
            const deltaX = e.clientX - formModalDragState.startX;
            const deltaY = e.clientY - formModalDragState.startY;

            modalContent.style.left = (formModalDragState.startLeft + deltaX) + 'px';
            modalContent.style.top = (formModalDragState.startTop + deltaY) + 'px';
        }

        if (formModalDragState.isResizing) {
            const deltaX = e.clientX - formModalDragState.startX;
            const deltaY = e.clientY - formModalDragState.startY;

            const newWidth = Math.max(600, formModalDragState.startWidth + deltaX);
            const newHeight = Math.max(500, formModalDragState.startHeight + deltaY);
            const maxHeight = window.innerHeight * 0.9;

            modalContent.style.width = newWidth + 'px';
            modalContent.style.height = Math.min(newHeight, maxHeight) + 'px';
        }
    });

    // Mouse up handler
    document.addEventListener('mouseup', function() {
        if (formModalDragState.isDragging || formModalDragState.isResizing) {
            formModalDragState.isDragging = false;
            formModalDragState.isResizing = false;
            modalContent.classList.remove('dragging', 'resizing');
        }
    });
}
