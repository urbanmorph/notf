/**
 * Excel Import Functionality
 * Imports and validates communities and solution providers from Excel (.xlsx)
 */

// ==================== STATE ====================

let importState = {
    file: null,
    parsedData: null,
    validationResults: null,
    isImporting: false
};

// ==================== MODAL MANAGEMENT ====================

/**
 * Show import modal
 */
function showImportModal() {
    const modal = document.getElementById('importModal');
    if (!modal) {
        console.error('Import modal not found in DOM');
        return;
    }

    // Reset state
    importState = {
        file: null,
        parsedData: null,
        validationResults: null,
        isImporting: false
    };

    // Reset UI
    document.getElementById('fileInput').value = '';
    document.getElementById('uploadArea').classList.remove('drag-over');
    document.getElementById('validationResults').style.display = 'none';
    document.getElementById('importActions').style.display = 'none';

    modal.style.display = 'flex';
}

/**
 * Close import modal
 */
function closeImportModal() {
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Show import progress modal
 * @param {number} current - Current progress
 * @param {number} total - Total items
 */
function showImportProgress(current, total) {
    const modal = document.getElementById('progressModal');
    if (!modal) return;

    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    const percentage = Math.round((current / total) * 100);
    progressBar.style.width = percentage + '%';
    progressText.textContent = `Updating ${current} of ${total}...`;

    modal.style.display = 'flex';
}

/**
 * Close import progress modal
 */
function closeProgressModal() {
    const modal = document.getElementById('progressModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ==================== FILE HANDLING ====================

/**
 * Handle file upload
 * @param {File} file - Uploaded Excel file
 */
async function handleFileUpload(file) {
    if (!file) return;

    // Validate file type
    const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];

    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx')) {
        alert('Please upload a valid Excel file (.xlsx)');
        return;
    }

    try {
        // Show loading
        if (window.showNotification) {
            window.showNotification('Reading file...', 'info');
        }

        importState.file = file;

        // Read file
        const data = await readExcelFile(file);
        importState.parsedData = data;

        // Validate data
        const validationResults = await validateImportData(data);
        importState.validationResults = validationResults;

        // Display validation results
        displayValidationPreview(validationResults);

        if (window.showNotification) {
            window.showNotification('File validated', 'success');
        }

    } catch (err) {
        console.error('File upload error:', err);
        alert('Failed to read file: ' + err.message);
    }
}

/**
 * Read Excel file and parse sheets
 * @param {File} file - Excel file
 * @returns {Promise<Object>} Parsed data { communities: [], providers: [] }
 */
function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                const result = {
                    communities: [],
                    providers: []
                };

                // Parse Communities sheet
                if (workbook.SheetNames.includes('Communities')) {
                    const sheet = workbook.Sheets['Communities'];
                    const rows = XLSX.utils.sheet_to_json(sheet);
                    result.communities = rows;
                }

                // Parse Solution Providers sheet
                if (workbook.SheetNames.includes('Solution Providers')) {
                    const sheet = workbook.Sheets['Solution Providers'];
                    const rows = XLSX.utils.sheet_to_json(sheet);
                    result.providers = rows;
                }

                resolve(result);

            } catch (err) {
                reject(new Error('Failed to parse Excel file: ' + err.message));
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

// ==================== VALIDATION ====================

/**
 * Validate all import data
 * @param {Object} data - Parsed data { communities: [], providers: [] }
 * @returns {Promise<Object>} Validation results
 */
async function validateImportData(data) {
    const results = {
        communities: {
            valid: [],
            invalid: [],
            errors: []
        },
        providers: {
            valid: [],
            invalid: [],
            errors: []
        }
    };

    // Validate communities
    for (let i = 0; i < data.communities.length; i++) {
        const row = data.communities[i];
        const errors = await validateCommunityRow(row, i);

        if (errors.length === 0) {
            results.communities.valid.push({ index: i, data: row });
        } else {
            results.communities.invalid.push({ index: i, data: row });
            results.communities.errors.push(...errors);
        }
    }

    // Validate solution providers
    for (let i = 0; i < data.providers.length; i++) {
        const row = data.providers[i];
        const errors = await validateProviderRow(row, i);

        if (errors.length === 0) {
            results.providers.valid.push({ index: i, data: row });
        } else {
            results.providers.invalid.push({ index: i, data: row });
            results.providers.errors.push(...errors);
        }
    }

    return results;
}

/**
 * Validate community row
 * @param {Object} row - Excel row data
 * @param {number} index - Row index
 * @returns {Promise<Array>} Array of validation errors
 */
async function validateCommunityRow(row, index) {
    const errors = [];
    const { createValidationError, isValidEmail, isValidCoordinate, isValidStatus, checkFileExists } = window.ExcelCommon;

    // Required fields
    if (!row['File Path']) {
        errors.push(createValidationError(index, 'File Path', 'Required field', row['File Path']));
    }
    if (!row['Name']) {
        errors.push(createValidationError(index, 'Name', 'Required field', row['Name']));
    }
    if (!row['City']) {
        errors.push(createValidationError(index, 'City', 'Required field', row['City']));
    }

    // Validate email format
    if (row['Contact Email'] && !isValidEmail(row['Contact Email'])) {
        errors.push(createValidationError(index, 'Contact Email', 'Invalid email format', row['Contact Email']));
    }

    // Validate coordinates
    if (row['Latitude'] && !isValidCoordinate(row['Latitude'], 'latitude')) {
        errors.push(createValidationError(index, 'Latitude', 'Invalid latitude (-90 to 90)', row['Latitude']));
    }
    if (row['Longitude'] && !isValidCoordinate(row['Longitude'], 'longitude')) {
        errors.push(createValidationError(index, 'Longitude', 'Invalid longitude (-180 to 180)', row['Longitude']));
    }

    // Validate status
    if (row['Status'] && !isValidStatus(row['Status'])) {
        errors.push(createValidationError(index, 'Status', 'Invalid status (must be: active, pending, or archived)', row['Status']));
    }

    // Check file exists (skip for now - too slow for bulk validation)
    // Could be optional or done during import phase
    // if (row['File Path']) {
    //     const exists = await checkFileExists(row['File Path']);
    //     if (!exists) {
    //         errors.push(createValidationError(index, 'File Path', 'File not found in storage', row['File Path']));
    //     }
    // }

    return errors;
}

/**
 * Validate solution provider row
 * @param {Object} row - Excel row data
 * @param {number} index - Row index
 * @returns {Promise<Array>} Array of validation errors
 */
async function validateProviderRow(row, index) {
    const errors = [];
    const { createValidationError, isValidEmail, isValidStatus } = window.ExcelCommon;

    // Required fields
    if (!row['File Path']) {
        errors.push(createValidationError(index, 'File Path', 'Required field', row['File Path']));
    }
    if (!row['Name']) {
        errors.push(createValidationError(index, 'Name', 'Required field', row['Name']));
    }

    // Validate email format
    if (row['Contact Email'] && !isValidEmail(row['Contact Email'])) {
        errors.push(createValidationError(index, 'Contact Email', 'Invalid email format', row['Contact Email']));
    }

    // Validate status
    if (row['Status'] && !isValidStatus(row['Status'])) {
        errors.push(createValidationError(index, 'Status', 'Invalid status (must be: active, pending, or archived)', row['Status']));
    }

    return errors;
}

// ==================== DISPLAY ====================

/**
 * Display validation preview
 * @param {Object} results - Validation results
 */
function displayValidationPreview(results) {
    const container = document.getElementById('validationResults');
    const statsContainer = document.getElementById('validationStats');
    const errorsContainer = document.getElementById('errorsList');
    const actions = document.getElementById('importActions');

    if (!container || !statsContainer || !errorsContainer || !actions) {
        console.error('Validation UI elements not found');
        return;
    }

    const totalValid = results.communities.valid.length + results.providers.valid.length;
    const totalInvalid = results.communities.invalid.length + results.providers.invalid.length;
    const totalErrors = results.communities.errors.length + results.providers.errors.length;

    // Display stats
    statsContainer.innerHTML = `
        <div class="validation-stat">
            <div class="stat-value">${totalValid}</div>
            <div class="stat-label">Valid Rows</div>
        </div>
        <div class="validation-stat">
            <div class="stat-value">${totalInvalid}</div>
            <div class="stat-label">Invalid Rows</div>
        </div>
        <div class="validation-stat">
            <div class="stat-value">${totalErrors}</div>
            <div class="stat-label">Errors</div>
        </div>
    `;

    // Display errors
    if (totalErrors > 0) {
        const allErrors = [...results.communities.errors, ...results.providers.errors];

        errorsContainer.innerHTML = `
            <h4>Validation Errors (showing first 20):</h4>
            <div class="errors-table">
                ${allErrors.slice(0, 20).map(err => `
                    <div class="error-row">
                        <span class="error-row-num">Row ${err.row}</span>
                        <span class="error-field">${err.field}</span>
                        <span class="error-message">${err.message}</span>
                        <span class="error-value">${err.value}</span>
                    </div>
                `).join('')}
                ${allErrors.length > 20 ? `<div class="error-row"><em>... and ${allErrors.length - 20} more errors</em></div>` : ''}
            </div>
        `;
    } else {
        errorsContainer.innerHTML = '<p style="color: #2F4A2C;"><i class="fa-solid fa-circle-check"></i> All rows valid!</p>';
    }

    // Show results and actions
    container.style.display = 'block';
    actions.style.display = 'flex';

    // Enable/disable import button
    const importBtn = document.getElementById('executeImportBtn');
    if (importBtn) {
        importBtn.disabled = totalValid === 0;
        importBtn.textContent = totalValid > 0 ? `Import ${totalValid} Valid Rows` : 'No Valid Rows';
    }

    // Show download errors button if there are errors
    const downloadErrorsBtn = document.getElementById('downloadErrorsBtn');
    if (downloadErrorsBtn) {
        downloadErrorsBtn.style.display = totalErrors > 0 ? 'inline-block' : 'none';
    }
}

// ==================== IMPORT EXECUTION ====================

/**
 * Execute import for valid rows
 */
async function executeImport() {
    if (!importState.validationResults) {
        alert('Please upload and validate a file first');
        return;
    }

    if (importState.isImporting) {
        alert('Import already in progress');
        return;
    }

    const { communities, providers } = importState.validationResults;
    const totalValid = communities.valid.length + providers.valid.length;

    if (totalValid === 0) {
        alert('No valid rows to import');
        return;
    }

    const confirmed = confirm(`This will update ${totalValid} records. Continue?`);
    if (!confirmed) return;

    importState.isImporting = true;
    closeImportModal();

    const errors = [];
    let successCount = 0;
    let currentIndex = 0;

    try {
        // Import communities
        for (const item of communities.valid) {
            currentIndex++;
            showImportProgress(currentIndex, totalValid);

            try {
                await updateCommunity(item.data);
                successCount++;
            } catch (err) {
                const { createApiError } = window.ExcelCommon;
                errors.push(createApiError(item.index, 'Failed to update', err.message));
            }
        }

        // Import solution providers
        for (const item of providers.valid) {
            currentIndex++;
            showImportProgress(currentIndex, totalValid);

            try {
                await updateProvider(item.data);
                successCount++;
            } catch (err) {
                const { createApiError } = window.ExcelCommon;
                errors.push(createApiError(item.index, 'Failed to update', err.message));
            }
        }

        closeProgressModal();

        // Show results
        if (errors.length === 0) {
            if (window.showNotification) {
                window.showNotification(`Successfully updated ${successCount} records`, 'success');
            } else {
                alert(`Successfully updated ${successCount} records`);
            }

            // Reload page to show updated data
            setTimeout(() => window.location.reload(), 1500);

        } else {
            if (window.showNotification) {
                window.showNotification(
                    `Updated ${successCount} records with ${errors.length} errors. Download error log for details.`,
                    'warning'
                );
            } else {
                alert(`Updated ${successCount} records with ${errors.length} errors`);
            }

            // Offer to download error log
            if (confirm('Download error log?')) {
                downloadErrorLog(errors);
            }
        }

    } catch (err) {
        console.error('Import execution error:', err);
        closeProgressModal();
        alert('Import failed: ' + err.message);

    } finally {
        importState.isImporting = false;
    }
}

// ==================== UPDATE FUNCTIONS ====================

/**
 * Get Supabase client (supports both window.supabaseClient and authUtils.supabase)
 * @returns {Object} Supabase client
 */
function getSupabaseClient() {
    // Check for authUtils.supabase first (used in newer admin pages)
    if (typeof authUtils !== 'undefined' && authUtils.supabase) {
        return authUtils.supabase;
    }

    // Fallback to window.supabaseClient (legacy)
    if (typeof window.supabaseClient !== 'undefined') {
        return window.supabaseClient;
    }

    throw new Error('Supabase client not found. Please ensure auth.js is loaded.');
}

/**
 * Get auth token for API requests
 * @returns {Promise<string>} Access token
 */
async function getAuthToken() {
    const supabase = getSupabaseClient();

    // Try newer getSession() method first
    if (supabase.auth.getSession) {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token || '';
    }

    // Fallback to older session() method
    return supabase.auth.session()?.access_token || '';
}

/**
 * Update community via Edge Function
 * @param {Object} row - Excel row data
 */
async function updateCommunity(row) {
    const { semicolonToArray, parseCoordinate, parseFilePath } = window.ExcelCommon;

    // Use the authoritative stored File Path verbatim — do NOT recompute it
    // (recomputing from the name would orphan the existing Storage file).
    const filePath = row['File Path'];
    if (!filePath) {
        throw new Error('Invalid file path');
    }

    // Unflatten data. cleanObject() drops empty fields, and the Edge Function
    // merges into existing metadata, so absent columns are preserved (not wiped).
    const updatedData = unflattenCommunity(row);

    // Route through the update-file Edge Function on the SAME project as the rest
    // of the app (invoke() handles auth + correct project automatically).
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('update-file', {
        body: {
            file_path: filePath,
            file_type: 'community',
            updates: updatedData
        }
    });

    if (error) {
        throw new Error(error.message || 'Update failed');
    }
    if (data?.error) {
        throw new Error(data.error);
    }

    return data;
}

/**
 * Update solution provider via Edge Function
 * @param {Object} row - Excel row data
 */
async function updateProvider(row) {
    const { parseFilePath } = window.ExcelCommon;

    // Use the authoritative stored File Path verbatim — do NOT recompute it.
    const filePath = row['File Path'];
    if (!filePath) {
        throw new Error('Invalid file path');
    }

    // Unflatten data. cleanObject() drops empty fields, and the Edge Function
    // merges into existing metadata, so absent columns are preserved (not wiped).
    const updatedData = unflattenProvider(row);

    // Route through the update-file Edge Function on the SAME project as the rest
    // of the app (invoke() handles auth + correct project automatically).
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('update-file', {
        body: {
            file_path: filePath,
            file_type: 'solution-provider',
            updates: updatedData
        }
    });

    if (error) {
        throw new Error(error.message || 'Update failed');
    }
    if (data?.error) {
        throw new Error(data.error);
    }

    return data;
}

// ==================== UNFLATTEN FUNCTIONS ====================

/**
 * Convert Excel row to community API format
 * @param {Object} row - Excel row
 * @returns {Object} API-formatted community object
 */
function unflattenCommunity(row) {
    const { semicolonToArray, parseCoordinate } = window.ExcelCommon;

    const data = {
        name: row['Name'],
        city: row['City'],
        neighborhoods: semicolonToArray(row['Neighborhoods']),
        ward: row['Ward'] || null,

        contact: {
            person: row['Contact Person'] || null,
            email: row['Contact Email'] || null,
            phone: row['Contact Phone'] || null
        },

        website: row['Website'] || null,

        location: {
            latitude: parseCoordinate(row['Latitude']),
            longitude: parseCoordinate(row['Longitude']),
            address: row['Address'] || null
        },

        focus_areas: semicolonToArray(row['Focus Areas']),
        what_they_offer: semicolonToArray(row['What They Offer']),
        what_they_ask_for: semicolonToArray(row['What They Ask For']),

        elected_representatives: {
            mla: {
                name: row['MLA Name'] || null,
                party: row['MLA Party'] || null
            },
            mp: {
                name: row['MP Name'] || null,
                party: row['MP Party'] || null
            },
            corporator: {
                name: row['Corporator Name'] || null,
                party: row['Corporator Party'] || null
            }
        },

        organization_type: row['Organization Type'] || null,
        registration_number: row['Registration Number'] || null,
        year_established: row['Year Established'] || null,
        team_size: row['Team Size'] || null,

        neighborhood_size: row['Neighborhood Size'] || null,
        population_served: row['Population Served'] || null,

        status: row['Status'] ? row['Status'].toLowerCase() : undefined,  // omit when blank so existing status is preserved (no silent auto-approve)
        submitted_via: 'excel_import',
        submitted_at: new Date().toISOString()
    };

    // Remove null/empty values to preserve existing data
    return cleanObject(data);
}

/**
 * Convert Excel row to provider API format
 * @param {Object} row - Excel row
 * @returns {Object} API-formatted provider object
 */
function unflattenProvider(row) {
    const { semicolonToArray } = window.ExcelCommon;

    // Normalize themes: build both `themes` (canonical array) and
    // `theme` (CSV string for backward compat) from whichever column exists.
    const themesArr = semicolonToArray(row['Focus Areas'] || row['Theme/Sector'] || '');
    const themeStr = row['Theme/Sector'] || themesArr.join(', ') || null;

    const data = {
        name: row['Name'],
        theme: themeStr,
        themes: themesArr.length ? themesArr : null,
        focus_areas: semicolonToArray(row['Focus Areas']),
        domains: semicolonToArray(row['Domains']),

        contact: {
            person: row['Contact Person'] || null,
            email: row['Contact Email'] || null,
            phone: row['Contact Phone'] || null
        },

        website: row['Website'] || null,
        organization_type: row['Organization Type'] || null,
        city: row['City'] || null,

        status: row['Status'] ? row['Status'].toLowerCase() : undefined,  // omit when blank so existing status is preserved (no silent auto-approve)
        submitted_via: 'excel_import',
        submitted_at: new Date().toISOString()
    };

    // Remove null/empty values to preserve existing data
    return cleanObject(data);
}

/**
 * Remove null/undefined/empty values from object recursively
 * @param {Object} obj - Object to clean
 * @returns {Object} Cleaned object
 */
function cleanObject(obj) {
    if (Array.isArray(obj)) {
        return obj.filter(item => item != null && item !== '');
    }

    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined || value === '') {
            continue; // Skip empty values
        }

        if (typeof value === 'object') {
            const cleanedValue = cleanObject(value);
            if (Object.keys(cleanedValue).length > 0) {
                cleaned[key] = cleanedValue;
            }
        } else {
            cleaned[key] = value;
        }
    }

    return cleaned;
}

// ==================== ERROR LOG ====================

/**
 * Download error log as Excel file
 * @param {Array} errors - Array of error objects
 */
function downloadErrorLog(errors) {
    if (!errors || errors.length === 0) {
        alert('No errors to download');
        return;
    }

    try {
        const { formatDate } = window.ExcelCommon;

        // Convert errors to Excel format
        const errorData = errors.map(err => ({
            'Row': err.row,
            'Field': err.field,
            'Error': err.message,
            'Value': err.value,
            'Type': err.type
        }));

        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(errorData);

        // Auto-size columns
        window.ExcelCommon.autoSizeColumns(ws);
        window.ExcelCommon.formatHeaders(ws);

        XLSX.utils.book_append_sheet(wb, ws, 'Errors');

        // Write file
        const filename = `NOTF_Import_Errors_${formatDate()}.xlsx`;
        XLSX.writeFile(wb, filename);

    } catch (err) {
        console.error('Error downloading error log:', err);
        alert('Failed to download error log: ' + err.message);
    }
}

// ==================== DRAG & DROP ====================

/**
 * Initialize drag and drop handlers
 */
function initializeDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    if (!uploadArea || !fileInput) return;

    // Click to upload
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileUpload(file);
        }
    });

    // Drag events
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileUpload(file);
        }
    });
}

// ==================== INITIALIZATION ====================

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDragAndDrop);
} else {
    initializeDragAndDrop();
}

// ==================== EXPORTS ====================

// Export to global scope
window.showImportModal = showImportModal;
window.closeImportModal = closeImportModal;
window.executeImport = executeImport;
window.downloadErrorLog = () => {
    if (importState.validationResults) {
        const allErrors = [
            ...importState.validationResults.communities.errors,
            ...importState.validationResults.providers.errors
        ];
        downloadErrorLog(allErrors);
    }
};

console.log('✅ Excel Import module loaded');
