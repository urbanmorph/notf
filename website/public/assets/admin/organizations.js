// Organizations CRUD Management

let organizations = [];
let isEditing = false;
let editingId = null;
let currentStatusFilter = 'all';
window.currentStatusFilter = 'all'; // Expose to window for Excel export

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

    await loadOrganizations();
    setupEventListeners();
    setupModalDrag();
    setupFormModalDrag();
})();

async function loadOrganizations() {
    const supabase = authUtils.supabase;

    let query = supabase
        .from('file_metadata')
        .select('*')
        .eq('file_type', 'solution-provider')
        .order('slug', { ascending: true });

    if (currentStatusFilter !== 'all') {
        query = query.eq('status', currentStatusFilter);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error loading organizations:', error);
        document.getElementById('organizationsList').innerHTML = '<p class="error">Failed to load organizations</p>';
        return;
    }

    organizations = data || [];
    window.organizations = organizations; // Expose to window for Excel export
    renderOrganizations(organizations);
}

function setStatusFilter(status, chipElement) {
    currentStatusFilter = status;
    window.currentStatusFilter = status; // Expose to window for Excel export

    // Update active chip
    document.querySelectorAll('.filter-chips .chip').forEach(chip => {
        chip.classList.remove('active');
    });
    chipElement.classList.add('active');

    // Reload organizations
    loadOrganizations();
}

function renderOrganizations(orgs) {
    const container = document.getElementById('organizationsList');

    // Update count display
    const countEl = document.getElementById('adminProviderCount');
    if (countEl) {
        countEl.textContent = `(${orgs.length})`;
    }

    if (orgs.length === 0) {
        container.innerHTML = '<p class="empty-state">No organizations found. Click "Add New" to create one.</p>';
        return;
    }

    container.innerHTML = orgs.map(org => {
        // SECURITY: Escape all user-supplied data to prevent XSS
        const name = escapeHtml(org.metadata?.name || org.slug);
        const theme = escapeHtml(org.metadata?.theme || '');
        const focusAreas = org.metadata?.focus_areas || [];
        const focusText = Array.isArray(focusAreas) ? focusAreas.slice(0, 3).map(f => escapeHtml(f)).join(', ') : theme;
        const location = escapeHtml(org.metadata?.location || '');
        const description = org.metadata?.description || '';
        const truncatedDesc = escapeHtml(description.length > 100 ? description.substring(0, 100) + '...' : description);

        const statusIcon = org.status === 'active' ? 'fa-circle-check' : org.status === 'pending' ? 'fa-clock' : 'fa-circle';
        const statusEscaped = escapeHtml(org.status);

        // Source badge
        const source = org.metadata?.submitted_via;
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
            <div class="org-card minimal ${org.status === 'pending' ? 'pending-highlight' : ''}">
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
                    ${focusText ? `<p style="color: #666; font-size: 0.875rem; margin-bottom: 0.5rem;">${focusText}</p>` : ''}
                    ${description ? `<p style="color: #888; font-size: 0.875rem; margin-bottom: 0.5rem;">${truncatedDesc}</p>` : ''}
                    <div class="org-meta">
                        ${location ? `<span><i class="fa-solid fa-location-dot"></i> ${location}</span>` : ''}
                    </div>
                </div>
                <div class="card-actions">
                    <button class="mini-icon-btn view" title="View Details" onclick="viewOrganization('${escapeHtml(org.id)}')">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="mini-icon-btn edit" title="Edit" onclick="editOrganization('${escapeHtml(org.id)}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="mini-icon-btn delete" title="Delete" onclick="deleteOrganization('${escapeHtml(org.id)}', '${escapeHtml(org.metadata?.name || org.slug)}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    ${org.status === 'pending' ?
                        `<button class="mini-icon-btn activate" title="Activate" onclick="updateStatus('${org.id}', 'active')">
                            <i class="fa-solid fa-check"></i>
                        </button>` :
                        `<button class="mini-icon-btn deactivate" title="Deactivate" onclick="updateStatus('${org.id}', 'archived')">
                            <i class="fa-solid fa-ban"></i>
                        </button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

function setupEventListeners() {
    // Search with Fuse.js fuzzy matching
    document.getElementById('searchInput').addEventListener('input', function(e) {
        const searchTerm = e.target.value.trim();

        if (!searchTerm) {
            // Show all organizations if search is empty
            renderOrganizations(organizations);
            return;
        }

        // Configure Fuse.js for admin search
        const fuseOptions = {
            keys: [
                { name: 'metadata.name', weight: 2.0 },              // Name highest priority
                { name: 'metadata.theme', weight: 1.5 },             // Theme
                { name: 'metadata.location', weight: 1.2 },          // Location
                { name: 'metadata.city', weight: 1.0 },              // City
                { name: 'metadata.domains', weight: 1.0 },           // Domains
                { name: 'slug', weight: 0.5 }                        // Slug lowest priority
            ],
            threshold: 0.4,                 // Fuzzy matching tolerance
            includeScore: true,             // Include relevance scores
            ignoreLocation: true,           // Search entire string
            shouldSort: true,               // Sort by relevance
            minMatchCharLength: 2           // Minimum characters to match
        };

        const fuse = new Fuse(organizations, fuseOptions);
        const fuseResults = fuse.search(searchTerm);
        const filtered = fuseResults.map(result => result.item);

        renderOrganizations(filtered);
    });

    // Status filter is handled by chip buttons with onclick handlers in HTML
    // No need for addEventListener here

    // Form submission
    document.getElementById('organizationForm').addEventListener('submit', handleFormSubmit);

    // Check if URL has ?action=new
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'new') {
        showCreateForm();
    }
}

function showCreateForm() {
    isEditing = false;
    editingId = null;
    document.getElementById('modalTitle').textContent = 'Add Solution Provider';
    document.getElementById('organizationForm').reset();
    document.getElementById('formModal').style.display = 'flex';
}

async function editOrganization(id) {
    const org = organizations.find(o => o.id === id);
    if (!org) return;

    isEditing = true;
    editingId = id;

    console.log('[Admin] editOrganization data:', JSON.stringify({
        id: org.id, slug: org.slug,
        name: org.metadata?.name, contact: org.metadata?.contact,
        location: org.metadata?.location, themes: org.metadata?.themes
    }));

    try {

    document.getElementById('modalTitle').textContent = 'Edit Solution Provider';
    document.getElementById('orgId').value = org.id;
    document.getElementById('orgFilePath').value = org.file_path;
    document.getElementById('orgName').value = org.metadata?.name || org.name || org.slug || '';
    // Set theme checkboxes
    const orgThemes = org.metadata?.theme ? org.metadata.theme.split(',').map(s => s.trim()) : (org.metadata?.themes || []);
    document.querySelectorAll('#orgThemeCheckboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = orgThemes.includes(cb.value);
    });
    const knownThemes = typeof THEME_CATEGORIES !== 'undefined' ? THEME_CATEGORIES : [];
    const otherOrgThemes = orgThemes.filter(t => !knownThemes.includes(t) && t);
    const orgOtherCheck = document.getElementById('orgThemeOtherCheck');
    const orgOtherInput = document.getElementById('orgThemeOtherInput');
    if (otherOrgThemes.length > 0) {
        orgOtherCheck.checked = true;
        orgOtherInput.style.display = 'block';
        orgOtherInput.value = otherOrgThemes.join(', ');
    } else {
        orgOtherCheck.checked = false;
        orgOtherInput.style.display = 'none';
        orgOtherInput.value = '';
    }
    document.getElementById('orgCity').value = org.metadata?.city || org.city || '';
    document.getElementById('orgLocation').value = org.metadata?.location || '';
    document.getElementById('orgDescription').value = org.metadata?.description || '';
    document.getElementById('orgContactPerson').value = org.metadata?.contact?.person || '';
    document.getElementById('orgContactEmail').value = org.metadata?.contact?.email || '';
    document.getElementById('orgContactPhone').value = org.metadata?.contact?.phone || '';
    document.getElementById('orgWebsite').value = org.metadata?.website || '';
    document.getElementById('orgOffers').value = (org.metadata?.offers || []).join('\n');
    document.getElementById('orgAsks').value = (org.metadata?.asks || []).join('\n');
    document.getElementById('orgStatus').value = org.status || 'active';

    document.getElementById('formModal').style.display = 'flex';

    } catch (err) {
        console.error('[Admin] editOrganization error — some fields may not have populated:', err);
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

    const name = document.getElementById('orgName').value.trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const metadata = {
        name: name,
        type: 'solution-provider',
        theme: (function() {
            const checked = Array.from(document.querySelectorAll('#orgThemeCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
            const otherCheck = document.getElementById('orgThemeOtherCheck');
            const otherInput = document.getElementById('orgThemeOtherInput');
            if (otherCheck?.checked && otherInput?.value.trim()) {
                checked.push(...otherInput.value.split(',').map(s => s.trim()).filter(s => s));
            }
            return checked.join(', ');
        })(),
        themes: (function() {
            const checked = Array.from(document.querySelectorAll('#orgThemeCheckboxes input[type="checkbox"]:checked')).map(cb => cb.value);
            const otherCheck = document.getElementById('orgThemeOtherCheck');
            const otherInput = document.getElementById('orgThemeOtherInput');
            if (otherCheck?.checked && otherInput?.value.trim()) {
                checked.push(...otherInput.value.split(',').map(s => s.trim()).filter(s => s));
            }
            return checked;
        })(),
        city: document.getElementById('orgCity').value.trim(),
        location: document.getElementById('orgLocation').value.trim(),
        description: document.getElementById('orgDescription').value.trim(),
        contact: {
            person: document.getElementById('orgContactPerson').value.trim(),
            email: document.getElementById('orgContactEmail').value.trim(),
            phone: document.getElementById('orgContactPhone').value.trim()
        },
        website: document.getElementById('orgWebsite').value.trim(),
        offers: document.getElementById('orgOffers').value.split('\n').map(s => s.trim()).filter(s => s),
        asks: document.getElementById('orgAsks').value.split('\n').map(s => s.trim()).filter(s => s),
        stories: null
    };

    const status = document.getElementById('orgStatus').value;
    const filePath = isEditing ? document.getElementById('orgFilePath').value : `solution-providers/${slug}.yaml`;

    // Add status to metadata
    metadata.status = status;

    // Preserve or set source tracking
    if (isEditing && editingId) {
        const existing = organizations.find(o => o.id === editingId);
        if (existing?.metadata?.submitted_via) {
            metadata.submitted_via = existing.metadata.submitted_via;
        }
        if (existing?.metadata?.submitted_at) {
            metadata.submitted_at = existing.metadata.submitted_at;
        }
    } else {
        metadata.submitted_via = 'admin';
        metadata.submitted_at = new Date().toISOString();
    }

    // Warn if renaming a provider that has catalogue entries: the catalogue
    // references providers by name and won't auto-update on rename.
    if (isEditing && editingId) {
        const existing = organizations.find(o => o.id === editingId);
        if (existing && name !== (existing.metadata?.name || '')) {
            const deps = catalogueEntriesForOrg(existing);
            if (deps.length) {
                const noun = deps.length === 1 ? 'entry' : 'entries';
                const titles = deps.map(d => '  • ' + d.title).join('\n');
                const ok = confirm(
                    `⚠️ "${existing.metadata?.name}" is the provider for ${deps.length} catalogue ${noun}:\n\n${titles}\n\n` +
                    `Renaming it to "${name}" won't update the catalogue, which will keep showing the old name.\n\n` +
                    `Rename anyway?`
                );
                if (!ok) {
                    submitBtn.disabled = false;
                    submitBtnText.style.display = 'inline';
                    submitBtnLoader.style.display = 'none';
                    return;
                }
            }
        }
    }

    const supabase = authUtils.supabase;

    try {
        if (isEditing) {
            // Update existing using Edge Function (storage-first architecture)
            console.log('Updating via Edge Function:', { file_path: filePath, updates: metadata });

            // Call Edge Function using Supabase client (handles auth automatically)
            const { data, error } = await supabase.functions.invoke('update-file', {
                body: {
                    file_path: filePath,
                    file_type: 'solution-provider',
                    updates: metadata
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
                    file_type: 'solution-provider',
                    updates: metadata
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
        await loadOrganizations();
        alert(`Success: Organization ${isEditing ? 'updated' : 'created'} successfully!`);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtnText.style.display = 'inline';
        submitBtnLoader.style.display = 'none';
    }
}

// Catalogue entries attached to a provider (matched by slug). Returns [] if the
// dependency module/data isn't loaded. See catalogue-deps.js + RBAC-PLAN.md.
function catalogueEntriesForOrg(org) {
    if (!org || !window.catalogueDeps || !Array.isArray(window.CATALOG_PROJECTS)) return [];
    return window.catalogueDeps.catalogueEntriesForProvider(window.CATALOG_PROJECTS, org.slug);
}

// Build a "this provider has catalogue entries" warning for a CRUD action, or
// '' when there is no catalogue dependency. `action` is e.g. 'Archiving',
// 'Deleting'.
function catalogueDependencyWarning(org, action) {
    const deps = catalogueEntriesForOrg(org);
    if (!deps.length) return '';
    const name = org.metadata?.name || org.slug;
    const noun = deps.length === 1 ? 'entry' : 'entries';
    const titles = deps.map(d => '  • ' + d.title).join('\n');
    return `⚠️ "${name}" is the provider for ${deps.length} catalogue ${noun}:\n\n${titles}\n\n`
        + `${action} it removes it from the Solution Providers count and the home-page `
        + `listing. The catalogue ${noun} will still appear but reference a provider that is `
        + `no longer listed.\n\n`;
}

async function deleteOrganization(id, name) {
    const organization = organizations.find(o => o.id === id);
    const depWarning = organization ? catalogueDependencyWarning(organization, 'Deleting') : '';
    const confirmMsg = depWarning
        ? `${depWarning}Delete anyway? This cannot be undone.`
        : `Are you sure you want to delete "${name}"? This cannot be undone.`;
    if (!confirm(confirmMsg)) {
        return;
    }

    const supabase = authUtils.supabase;

    try {
        if (!organization) {
            throw new Error('Organization not found');
        }

        // Call delete-file Edge Function using Supabase client (handles auth automatically)
        const { data, error } = await supabase.functions.invoke('delete-file', {
            body: {
                file_path: organization.file_path,
                file_type: 'solution-provider'
            }
        });

        if (error) {
            throw new Error(error.message || 'Delete failed');
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        await loadOrganizations();
        alert('Success: Organization deleted successfully!');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}


async function updateStatus(id, newStatus) {
    const supabase = authUtils.supabase;

    // Find the organization to get file_path
    const organization = organizations.find(o => o.id === id);

    // Warn before taking a provider off the home-page listing if it has
    // catalogue entries attached (archive/deactivate only).
    if (organization && (newStatus === 'archived' || newStatus === 'inactive')) {
        const depWarning = catalogueDependencyWarning(organization, 'Archiving');
        if (depWarning && !confirm(`${depWarning}Archive anyway?`)) {
            return;
        }
    }

    try {
        if (!organization) {
            throw new Error('Organization not found');
        }

        // Call update-file Edge Function using Supabase client (handles auth automatically)
        const { data, error } = await supabase.functions.invoke('update-file', {
            body: {
                file_path: organization.file_path,
                file_type: 'solution-provider',
                updates: { status: newStatus }
            }
        });

        if (error) {
            throw new Error(error.message || 'Status update failed');
        }

        if (data?.error) {
            throw new Error(data.error);
        }

        await loadOrganizations();
    } catch (error) {
        alert('Error updating status: ' + error.message);
    }
}

function closeModal() {
    document.getElementById('formModal').style.display = 'none';
    document.getElementById('organizationForm').reset();
    isEditing = false;
    editingId = null;
}

// View Organization Details
function viewOrganization(id) {
    const org = organizations.find(o => o.id === id);
    if (!org) return;

    const meta = org.metadata || {};
    const name = meta.name || org.slug;
    const theme = meta.theme || '';
    const focusAreas = meta.focus_areas || [];
    const location = meta.location || '';
    const description = meta.description || '';
    const contact = meta.contact || {};
    const offers = meta.offers || [];
    const asks = meta.asks || [];
    const stories = meta.stories || '';
    const website = meta.website || '';
    const social = meta.social || {};

    // Update modal header
    document.getElementById('viewTitle').textContent = name;
    const statusIcon = org.status === 'active' ? 'fa-circle-check' : org.status === 'pending' ? 'fa-clock' : 'fa-circle';
    document.getElementById('viewStatus').innerHTML = `<i class="fa-solid ${statusIcon}"></i> ${org.status}`;
    document.getElementById('viewStatus').className = `status-indicator ${org.status}`;

    // Build view content
    let html = '';

    // Basic Info Section
    html += `
        <div class="detail-section">
            <h3 class="section-title">Basic Information</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Location</span>
                    <span class="detail-value">${location || '<span class="empty">Not specified</span>'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Theme/Sector</span>
                    <span class="detail-value">${theme || '<span class="empty">Not specified</span>'}</span>
                </div>
            </div>
            ${description ? `<p style="margin-top: 1rem; color: #555; line-height: 1.6;">${description}</p>` : ''}
        </div>
    `;

    // Focus Areas Section
    if (focusAreas.length > 0) {
        html += `
            <div class="detail-section">
                <h3 class="section-title">Focus Areas</h3>
                <div class="tag-list">
                    ${focusAreas.map(area => `<span class="tag">${area}</span>`).join('')}
                </div>
            </div>
        `;
    }

    // Website & Social Links
    if (website || (social && Object.keys(social).length > 0)) {
        html += `
            <div class="detail-section">
                <h3 class="section-title">Links</h3>
                <div class="detail-grid">
                    ${website ? `
                    <div class="detail-item">
                        <span class="detail-label">Website</span>
                        <span class="detail-value"><a href="${website}" target="_blank" rel="noopener">${website}</a></span>
                    </div>` : ''}
                    ${social.twitter ? `
                    <div class="detail-item">
                        <span class="detail-label">Twitter</span>
                        <span class="detail-value"><a href="https://twitter.com/${social.twitter}" target="_blank" rel="noopener">@${social.twitter}</a></span>
                    </div>` : ''}
                    ${social.instagram ? `
                    <div class="detail-item">
                        <span class="detail-label">Instagram</span>
                        <span class="detail-value"><a href="https://instagram.com/${social.instagram}" target="_blank" rel="noopener">@${social.instagram}</a></span>
                    </div>` : ''}
                    ${social.linkedin ? `
                    <div class="detail-item">
                        <span class="detail-label">LinkedIn</span>
                        <span class="detail-value"><a href="https://linkedin.com/${social.linkedin.startsWith('company/') ? social.linkedin : 'in/' + social.linkedin}" target="_blank" rel="noopener">${social.linkedin}</a></span>
                    </div>` : ''}
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

    // Stories Section (if any)
    if (stories && stories.trim()) {
        html += `
            <div class="detail-section">
                <h3 class="section-title">About / Notes</h3>
                <div class="markdown-content">
                    ${typeof marked !== 'undefined' ? marked.parse(stories) : '<pre>' + stories + '</pre>'}
                </div>
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
